import WebSocket from 'ws'

import Logger from "@nostrwatch/logger"
import { parseRelayNetwork } from "@nostrwatch/utils"

import { NocapConfig } from "../types/NocapConfig.js";
import { NocapResult } from "../types/NocapResult.js";

import { SessionHelper } from "./SessionHelper.js";
import { TimeoutHelper } from "./TimeoutHelper.js";
import { LatencyHelper } from "./LatencyHelper.js";
import { DeferredWrapper } from "./DeferredWrapper.js";

import AllDefaultAdapters from "@nostrwatch/nocap-all-adapters-default"

import SAMPLE_EVENT from "../data/sample_event.js"

export default class Check {
  url: string;
  ws: WebSocket | null;
  $instance: any; // TODO: Define type
  cb: Record<string, Function>;
  current: string;
  adaptersInitialized: boolean;
  adapters: Record<string, any>; // TODO: Define type
  adaptersValid: string[];
  checks: string[];
  config: NocapConfig;
  results: NocapResult;
  session: SessionHelper;
  timeouts: TimeoutHelper;
  latency: LatencyHelper;
  promises: DeferredWrapper;
  logger: Logger;
  SAMPLE_EVENT: any; // TODO: Define type
  trackdata: Record<string, any[]> | null; // TODO: Define type

  constructor(url: string, config: ConfigInterface) {
    this.url = url;
    this.ws = null;
    this.$instance = null;
    this.cb = {};
    this.current = "";
    this.adaptersInitialized = false;
    this.adapters = {};
    this.adaptersValid = ['relay', 'info', 'geo', 'dns', 'ssl'];
    this.checks = ['connect', 'read', 'write', 'info', 'geo', 'dns', 'ssl'];
    this.config = new NocapConfig(config);
    this.results = new NocapResult();
    this.session = new SessionHelper();
    this.timeouts = new TimeoutHelper(this.session);
    this.latency = new LatencyHelper(this.session);
    this.promises = new DeferredWrapper(this.session, this.timeouts);
    this.logger = new Logger(url);
    this.trackdata = null;

    this.SAMPLE_EVENT = SAMPLE_EVENT;
    this.results.set('url', url);
    this.results.set('network', parseRelayNetwork(url));
  }

  set(key: string, value: any): void {
    this[key] = value;
  }

  get(key: string): any {
    return this[key];
  }

  async checkAll(): Promise<any> {
    this.defaultAdapters();
    for (const check of this.checks) {
      await this.check(check).catch(this.logger.warn);
    }
    return this.results.dump();
  }

  async check(key: string): Promise<any> {
    this.defaultAdapters();
    const adapter = this.routeAdapter(key);
    if (typeof key !== 'string') {
      return this.throw('Key must be string');
    }
    if (!this.adapters[adapter]?.[`check_${key}`]) {
      return this.throw(`Cannot check ${key}, key invalid`);
    }
    await this.start(key);
    await this.adapters[adapter][`check_${key}`](this.quick_resolve_check.bind(this));
    this.current = key;
    return this.promises.get(key).promise;
  }

  quick_resolve_check(key: string, result: any): Promise<any> {
    this.addPromise(key);
    return this.finish(key, result, this.promises.get(key).resolve);
  }

  async start(key: string): Promise<void> {
    if (key !== 'connect' && !this.isConnected()) {
      await this.adapters.relay.check_connect();
      if (!this.isConnected()) {
        throw new Error(`Cannot check ${key}, cannot connect to relay`);
      }
    }
    this.latency.start(key);
  }

  async finish(key: string, result: any = {}, resolve: Function): Promise<void> {
    this.latency.finish(key);
    result[`${key}Latency`] = this.latency.duration(key);
    this.results.set('url', this.url);
    this.results.set(`${key}Latency`, result[`${key}Latency`]);
    this.results.setMany(result);
    resolve(result);
    this.on_change();
  }

  subid(key: string): string {
    return `${this.session.get()}${this.session.get(key)}`;
  }

  keyFromSubid(subid: string): string | undefined {
    return Object.keys(this.session.id).find(key => subid.startsWith(this.session.get(key)));
  }

  throw(error: string): Promise<never> {
    return Promise.reject(new Error(error));
  }

  unsubscribe(subid: string): void {
    if (!this.isConnected()) {
      return;
    }
    const event = ['CLOSE', subid];
    this.ws?.send(event);
  }

  close(): void {
    this.ws?.close();
  }

  on(method: string, fn: Function): Check {
    this.cb[method] = fn;
    return this;
  }

  cbcall(method: string, ...args: any[]): void {
    if (typeof this.cb[method] === 'function') {
      this.cb[method](...args);
    }
  }

  on_open(e: any): void {
    this.cbcall('open', e);
    this.track('relay', 'open');
    this.handle_connect_check(true);
  }

  on_error(err: Error): void {
    this.cbcall('error');
    this.track('relay', 'error', err);
    this.handle_error(err);
  }

  on_close(e: any): void {
    this.cbcall('close', e);
    this.track('relay', 'close', e);
    this.handle_close(e);
  }

  on_event(subid: string, ev: any): void {
    this.unsubscribe(subid);
    this.track('relay', 'event', ev.id);
    if (this.adapters.relay?.handle_event) {
      this.adapters.relay.handle_event(subid, ev);
    }
    this.handle_read_check(true);
  }

  on_notice(notice: any): void {
    console.log(notice);
    this.track('relay', 'notice', notice);
    this.cbcall('notice');
    if (this.adapters.relay?.handle_notice) {
      this.adapters.relay.handle_notice(notice);
    }
  }

  on_eose(eose: any): void {
    this.cbcall('eose');
    this.track('relay', 'eose', eose);
    this.handle_eose(eose);
    if (this.promises.reflect('read').state.isPending) {
      this.logger.warn(`received EOSE event but read promise is pending`);
    }
  }

  on_ok(ok: any): void {
    this.cbcall('ok');
    this.handle_ok(ok);
    this.handle_write_check(true);
    if (this.promises.reflect('write').state.isPending) {
      this.logger.warn(`received OK event but write promise is pending`);
    }
  }

  on_auth(challenge: any): void {
    this.cbcall('auth', challenge);
    this.track('relay', 'auth', challenge);
    this.handle_auth(challenge);
  }

  on_change(): void {
    this.cbcall('change', this.result);
  }

  handle_connect_check(success: boolean): void {
    const result = { connect: success };
    this.finish('connect', result, this.promises.get('connect').resolve);
  }

  handle_read_check(success: boolean): void {
    const result = { read: success };
    this.finish('read', result, this.promises.get('read').resolve);
  }

  handle_write_check(success: boolean): void {
    const result = { write: success };
    this.finish('write', result, this.promises.get('write').resolve);
  }

  handle_ok(): void {
    // Implementation
  }

  handle_eose(): void {
    // Implementation
  }

  handle_close(): void {
    // Implementation
  }

  track(adapter: string, key: string, data?: any): void {
    if (!this.config.enableCheckLog) {
      return;
    }

    if (!this.trackdata) {
      this.trackdata = {};
    }

    this.trackdata[this.session.get()] = this.trackdata[this.session.get()] || [];
    this.trackdata[this.session.get()].push({
      adapter,
      key,
      data
    });
  }

  getTrack(key: string): any[] | false {
    return this.trackdata?.[key] || false;
  }

  clearTrack(session?: string): void {
    if (session) {
      delete this.trackdata?.[session];
    } else {
      this.trackdata = {};
    }
  }

  isConnecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isClosing(): boolean {
    return this.ws?.readyState === WebSocket.CLOSING;
  }

  isClosed(): boolean {
    return this.ws?.readyState === WebSocket.CLOSED;
  }

  addPromise(key: string): any { // TODO: Define return type
    return this.promises.add(key, this.config?.[`${key}_timeout`]);
  }

  routeAdapter(key: string): string {
    switch (key) {
      case 'connect':
      case 'read':
      case 'write':
        return 'relay';
      case 'info':
      case 'geo':
      case 'dns':
      case 'ssl':
        return key;
      default:
        throw new Error(`Cannot route ${key}, key invalid`);
    }
  }

  async useAdapter(Adapter: any): Promise<void> { // TODO: Define type for Adapter
    const name = Adapter.name;
    const adapterKey = this.getAdapterType(name);
    if (this.adapters?.[adapterKey]) {
      throw new Error(`${adapterKey.charAt(0).toUpperCase() + adapterKey.slice(1)}Adapter has already been initialized with ${this.adapters[adapterKey].name}`);
    }
    const $Adapter = new Adapter(this);
    this.adapters[adapterKey] = $Adapter;
  }

  defaultAdapterKeys(): string[] {
    return Object.keys(AllDefaultAdapters);
  }

  defaultAdapters(): Record<string, any> { // TODO: Define a more specific type for adapters
    if (this.adaptersInitialized) {
      return this.adapters;
    }
    this.defaultAdapterKeys().forEach(adapterKey => {
      const adapterType = this.getAdapterType(adapterKey);
      if (!this.adapters?.[adapterType]) {
        this.useAdapter(AllDefaultAdapters[adapterKey]);
      }
    });
    this.adaptersInitialized = true;
    return this.adapters;
  }

  getAdapterType(adapterName: string): string {
    let type: string | undefined;
    this.adaptersValid.forEach(adapterKey => {
      if (adapterName.toLowerCase().startsWith(adapterKey)) {
        type = adapterKey;
      }
    });
    if (typeof type === 'undefined') {
      throw new Error(`Adapter ${adapterName} is not a valid adapter`);
    }
    return type;
  }
}

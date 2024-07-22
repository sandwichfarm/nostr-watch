import { c as create_ssr_component, g as getContext, b as subscribe, d as each, e as escape } from "../../chunks/ssr.js";
import "vite-plugin-node-polyfills/shims/global";
import { matchFilter, nip19, Relay } from "nostr-tools";
import { EventEmitter } from "tseep";
import createDebug from "debug";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { schnorr } from "@noble/curves/secp256k1";
import { LRUCache } from "typescript-lru-cache";
import "light-bolt11-decoder";
import import2 from "import2";
import { is_node } from "tstl";
import "nostr-fetch";
import Dexie, { liveQuery } from "dexie";
import { merge } from "object-mapper";
import hashObject from "hash-object";
import "ngeohash";
import "murmurhash";
import "fastq";
import "ws";
import "@nostrwatch/logger";
import "@nostrwatch/utils";
import "promise-deferred";
import "websocket-polyfill";
import "cross-fetch";
import "ssl-checker";
import "get-ssl-cert";
import "vite-plugin-node-polyfills/shims/process";
function normalizeRelayUrl(url) {
  let r = normalizeUrl(url.toLowerCase(), {
    stripAuthentication: false,
    stripWWW: false,
    stripHash: true
  });
  if (!r.endsWith("/")) {
    r += "/";
  }
  return r;
}
var DATA_URL_DEFAULT_MIME_TYPE = "text/plain";
var DATA_URL_DEFAULT_CHARSET = "us-ascii";
var testParameter = (name, filters) => filters.some((filter) => filter instanceof RegExp ? filter.test(name) : filter === name);
var supportedProtocols = /* @__PURE__ */ new Set(["https:", "http:", "file:"]);
var hasCustomProtocol = (urlString) => {
  try {
    const { protocol } = new URL(urlString);
    return protocol.endsWith(":") && !protocol.includes(".") && !supportedProtocols.has(protocol);
  } catch {
    return false;
  }
};
var normalizeDataURL = (urlString, { stripHash }) => {
  const match = /^data:(?<type>[^,]*?),(?<data>[^#]*?)(?:#(?<hash>.*))?$/.exec(urlString);
  if (!match) {
    throw new Error(`Invalid URL: ${urlString}`);
  }
  let type = match.groups?.type ?? "";
  let data = match.groups?.data ?? "";
  let hash = match.groups?.hash ?? "";
  const mediaType = type.split(";");
  hash = stripHash ? "" : hash;
  let isBase64 = false;
  if (mediaType[mediaType.length - 1] === "base64") {
    mediaType.pop();
    isBase64 = true;
  }
  const mimeType = mediaType.shift()?.toLowerCase() ?? "";
  const attributes = mediaType.map((attribute) => {
    let [key, value = ""] = attribute.split("=").map((string) => string.trim());
    if (key === "charset") {
      value = value.toLowerCase();
      if (value === DATA_URL_DEFAULT_CHARSET) {
        return "";
      }
    }
    return `${key}${value ? `=${value}` : ""}`;
  }).filter(Boolean);
  const normalizedMediaType = [...attributes];
  if (isBase64) {
    normalizedMediaType.push("base64");
  }
  if (normalizedMediaType.length > 0 || mimeType && mimeType !== DATA_URL_DEFAULT_MIME_TYPE) {
    normalizedMediaType.unshift(mimeType);
  }
  return `data:${normalizedMediaType.join(";")},${isBase64 ? data.trim() : data}${hash ? `#${hash}` : ""}`;
};
function normalizeUrl(urlString, options) {
  options = {
    defaultProtocol: "http",
    normalizeProtocol: true,
    forceHttp: false,
    forceHttps: false,
    stripAuthentication: true,
    stripHash: false,
    stripTextFragment: true,
    stripWWW: true,
    removeQueryParameters: [/^utm_\w+/i],
    removeTrailingSlash: true,
    removeSingleSlash: true,
    removeDirectoryIndex: false,
    removeExplicitPort: false,
    sortQueryParameters: true,
    ...options
  };
  if (typeof options.defaultProtocol === "string" && !options.defaultProtocol.endsWith(":")) {
    options.defaultProtocol = `${options.defaultProtocol}:`;
  }
  urlString = urlString.trim();
  if (/^data:/i.test(urlString)) {
    return normalizeDataURL(urlString, options);
  }
  if (hasCustomProtocol(urlString)) {
    return urlString;
  }
  const hasRelativeProtocol = urlString.startsWith("//");
  const isRelativeUrl = !hasRelativeProtocol && /^\.*\//.test(urlString);
  if (!isRelativeUrl) {
    urlString = urlString.replace(/^(?!(?:\w+:)?\/\/)|^\/\//, options.defaultProtocol);
  }
  const urlObject = new URL(urlString);
  if (options.forceHttp && options.forceHttps) {
    throw new Error("The `forceHttp` and `forceHttps` options cannot be used together");
  }
  if (options.forceHttp && urlObject.protocol === "https:") {
    urlObject.protocol = "http:";
  }
  if (options.forceHttps && urlObject.protocol === "http:") {
    urlObject.protocol = "https:";
  }
  if (options.stripAuthentication) {
    urlObject.username = "";
    urlObject.password = "";
  }
  if (options.stripHash) {
    urlObject.hash = "";
  } else if (options.stripTextFragment) {
    urlObject.hash = urlObject.hash.replace(/#?:~:text.*?$/i, "");
  }
  if (urlObject.pathname) {
    const protocolRegex = /\b[a-z][a-z\d+\-.]{1,50}:\/\//g;
    let lastIndex = 0;
    let result = "";
    for (; ; ) {
      const match = protocolRegex.exec(urlObject.pathname);
      if (!match) {
        break;
      }
      const protocol = match[0];
      const protocolAtIndex = match.index;
      const intermediate = urlObject.pathname.slice(lastIndex, protocolAtIndex);
      result += intermediate.replace(/\/{2,}/g, "/");
      result += protocol;
      lastIndex = protocolAtIndex + protocol.length;
    }
    const remnant = urlObject.pathname.slice(lastIndex, urlObject.pathname.length);
    result += remnant.replace(/\/{2,}/g, "/");
    urlObject.pathname = result;
  }
  if (urlObject.pathname) {
    try {
      urlObject.pathname = decodeURI(urlObject.pathname);
    } catch {
    }
  }
  if (options.removeDirectoryIndex === true) {
    options.removeDirectoryIndex = [/^index\.[a-z]+$/];
  }
  if (Array.isArray(options.removeDirectoryIndex) && options.removeDirectoryIndex.length > 0) {
    let pathComponents = urlObject.pathname.split("/");
    const lastComponent = pathComponents[pathComponents.length - 1];
    if (testParameter(lastComponent, options.removeDirectoryIndex)) {
      pathComponents = pathComponents.slice(0, -1);
      urlObject.pathname = pathComponents.slice(1).join("/") + "/";
    }
  }
  if (urlObject.hostname) {
    urlObject.hostname = urlObject.hostname.replace(/\.$/, "");
    if (options.stripWWW && /^www\.(?!www\.)[a-z\-\d]{1,63}\.[a-z.\-\d]{2,63}$/.test(urlObject.hostname)) {
      urlObject.hostname = urlObject.hostname.replace(/^www\./, "");
    }
  }
  if (Array.isArray(options.removeQueryParameters)) {
    for (const key of [...urlObject.searchParams.keys()]) {
      if (testParameter(key, options.removeQueryParameters)) {
        urlObject.searchParams.delete(key);
      }
    }
  }
  if (!Array.isArray(options.keepQueryParameters) && options.removeQueryParameters === true) {
    urlObject.search = "";
  }
  if (Array.isArray(options.keepQueryParameters) && options.keepQueryParameters.length > 0) {
    for (const key of [...urlObject.searchParams.keys()]) {
      if (!testParameter(key, options.keepQueryParameters)) {
        urlObject.searchParams.delete(key);
      }
    }
  }
  if (options.sortQueryParameters) {
    urlObject.searchParams.sort();
    try {
      urlObject.search = decodeURIComponent(urlObject.search);
    } catch {
    }
  }
  if (options.removeTrailingSlash) {
    urlObject.pathname = urlObject.pathname.replace(/\/$/, "");
  }
  if (options.removeExplicitPort && urlObject.port) {
    urlObject.port = "";
  }
  const oldUrlString = urlString;
  urlString = urlObject.toString();
  if (!options.removeSingleSlash && urlObject.pathname === "/" && !oldUrlString.endsWith("/") && urlObject.hash === "") {
    urlString = urlString.replace(/\/$/, "");
  }
  if ((options.removeTrailingSlash || urlObject.pathname === "/") && urlObject.hash === "" && options.removeSingleSlash) {
    urlString = urlString.replace(/\/$/, "");
  }
  if (hasRelativeProtocol && !options.normalizeProtocol) {
    urlString = urlString.replace(/^http:\/\//, "//");
  }
  if (options.stripProtocol) {
    urlString = urlString.replace(/^(?:https?:)?\/\//, "");
  }
  return urlString;
}
async function runWithTimeout(fn, timeoutMs, timeoutMessage) {
  if (!timeoutMs)
    return fn();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    fn().then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}
var MAX_RECONNECT_ATTEMPTS = 5;
var NDKRelayConnectivity = class {
  ndkRelay;
  _status;
  relay;
  timeoutMs;
  connectedAt;
  _connectionStats = {
    attempts: 0,
    success: 0,
    durations: []
  };
  debug;
  reconnectTimeout;
  ndk;
  constructor(ndkRelay, ndk) {
    this.ndkRelay = ndkRelay;
    this._status = 3;
    this.relay = new Relay(this.ndkRelay.url);
    this.debug = this.ndkRelay.debug.extend("connectivity");
    this.ndk = ndk;
    this.relay.onnotice = (notice) => this.handleNotice(notice);
  }
  async connect(timeoutMs, reconnect = true) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = void 0;
    }
    timeoutMs ??= this.timeoutMs;
    if (!this.timeoutMs && timeoutMs)
      this.timeoutMs = timeoutMs;
    const connectHandler = () => {
      this.updateConnectionStats.connected();
      this._status = 1;
      this.ndkRelay.emit("connect");
      this.ndkRelay.emit("ready");
    };
    const disconnectHandler = () => {
      this.updateConnectionStats.disconnected();
      if (this._status === 1) {
        this._status = 3;
        this.handleReconnection();
      }
      this.ndkRelay.emit("disconnect");
    };
    const authHandler = async (challenge) => {
      const authPolicy = this.ndkRelay.authPolicy ?? this.ndk?.relayAuthDefaultPolicy;
      this.debug("Relay requested authentication", {
        havePolicy: !!authPolicy
      });
      if (authPolicy) {
        if (this._status !== 7) {
          this._status = 7;
          const res = await authPolicy(this.ndkRelay, challenge);
          this.debug("Authentication policy returned", res);
          if (res instanceof NDKEvent) {
            this.relay.auth(async (evt) => {
              return res.rawEvent();
            });
          }
          if (this._status === 7) {
            this.debug("Authentication policy finished");
            this.relay.auth(async (evt) => {
              const event = new NDKEvent(this.ndk, evt);
              await event.sign();
              return event.rawEvent();
            });
            this._status = 1;
            this.ndkRelay.emit("authed");
          }
        }
      } else {
        this.ndkRelay.emit("auth", challenge);
      }
    };
    try {
      this.updateConnectionStats.attempt();
      if (this._status === 3)
        this._status = 0;
      else
        this._status = 4;
      this.relay.onclose = disconnectHandler;
      this.relay._onauth = authHandler;
      await runWithTimeout(
        this.relay.connect.bind(this.relay),
        timeoutMs,
        "Timed out while connecting"
      ).then(() => {
        connectHandler();
      }).catch((e) => {
        this.debug("Failed to connect", this.relay.url, e);
      });
    } catch (e) {
      this._status = 3;
      if (reconnect)
        this.handleReconnection();
      else
        this.ndkRelay.emit("delayed-connect", 2 * 24 * 60 * 60 * 1e3);
      throw e;
    }
  }
  disconnect() {
    this._status = 2;
    try {
      this.relay.close();
    } catch (e) {
      this.debug("Failed to disconnect", e);
      this._status = 3;
    }
  }
  get status() {
    return this._status;
  }
  isAvailable() {
    return this._status === 1;
  }
  /**
   * Evaluates the connection stats to determine if the relay is flapping.
   */
  isFlapping() {
    const durations = this._connectionStats.durations;
    if (durations.length % 3 !== 0)
      return false;
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const variance = durations.map((x) => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const isFlapping = stdDev < 1e3;
    return isFlapping;
  }
  async handleNotice(notice) {
    if (notice.includes("oo many") || notice.includes("aximum")) {
      this.disconnect();
      setTimeout(() => this.connect(), 2e3);
      this.debug(this.relay.url, "Relay complaining?", notice);
    }
    this.ndkRelay.emit("notice", notice);
  }
  /**
   * Called when the relay is unexpectedly disconnected.
   */
  handleReconnection(attempt = 0) {
    if (this.reconnectTimeout)
      return;
    this.debug("Attempting to reconnect", { attempt });
    if (this.isFlapping()) {
      this.ndkRelay.emit("flapping", this._connectionStats);
      this._status = 5;
      return;
    }
    const reconnectDelay = this.connectedAt ? Math.max(0, 6e4 - (Date.now() - this.connectedAt)) : 5e3 * (this._connectionStats.attempts + 1);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = void 0;
      this._status = 4;
      this.connect().then(() => {
        this.debug("Reconnected");
      }).catch((err) => {
        if (attempt < MAX_RECONNECT_ATTEMPTS) {
          setTimeout(() => {
            this.handleReconnection(attempt + 1);
          }, 1e3 * (attempt + 1) ^ 4);
        } else {
          this.debug("Reconnect failed");
        }
      });
    }, reconnectDelay);
    this.ndkRelay.emit("delayed-connect", reconnectDelay);
    this.debug("Reconnecting in", reconnectDelay);
    this._connectionStats.nextReconnectAt = Date.now() + reconnectDelay;
  }
  /**
   * Utility functions to update the connection stats.
   */
  updateConnectionStats = {
    connected: () => {
      this._connectionStats.success++;
      this._connectionStats.connectedAt = Date.now();
    },
    disconnected: () => {
      if (this._connectionStats.connectedAt) {
        this._connectionStats.durations.push(
          Date.now() - this._connectionStats.connectedAt
        );
        if (this._connectionStats.durations.length > 100) {
          this._connectionStats.durations.shift();
        }
      }
      this._connectionStats.connectedAt = void 0;
    },
    attempt: () => {
      this._connectionStats.attempts++;
    }
  };
  /**
   * Returns the connection stats.
   */
  get connectionStats() {
    return this._connectionStats;
  }
};
var NDKRelayPublisher = class {
  ndkRelay;
  constructor(ndkRelay) {
    this.ndkRelay = ndkRelay;
  }
  /**
   * Published an event to the relay; if the relay is not connected, it will
   * wait for the relay to connect before publishing the event.
   *
   * If the relay does not connect within the timeout, the publish operation
   * will fail.
   * @param event  The event to publish
   * @param timeoutMs  The timeout for the publish operation in milliseconds
   * @returns A promise that resolves when the event has been published or rejects if the operation times out
   */
  async publish(event, timeoutMs = 2500) {
    const publishWhenConnected = () => {
      return new Promise((resolve, reject) => {
        try {
          this.publishEvent(event, timeoutMs).then((result) => resolve(result)).catch((err) => reject(err));
        } catch (err) {
          reject(err);
        }
      });
    };
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    });
    const onConnectHandler = () => {
      publishWhenConnected().then((result) => connectResolve(result)).catch((err) => connectReject(err));
    };
    let connectResolve;
    let connectReject;
    if (this.ndkRelay.status === 1) {
      return Promise.race([publishWhenConnected(), timeoutPromise]);
    } else {
      return Promise.race([
        new Promise((resolve, reject) => {
          connectResolve = resolve;
          connectReject = reject;
          this.ndkRelay.once("connect", onConnectHandler);
        }),
        timeoutPromise
      ]).finally(() => {
        this.ndkRelay.removeListener("connect", onConnectHandler);
      });
    }
  }
  async publishEvent(event, timeoutMs) {
    const nostrEvent = event.rawEvent();
    const publish = this.ndkRelay.connectivity.relay.publish(nostrEvent);
    let publishTimeout;
    const publishPromise = new Promise((resolve, reject) => {
      publish.then(() => {
        clearTimeout(publishTimeout);
        this.ndkRelay.emit("published", event);
        event.emit("published", this.ndkRelay);
        resolve(true);
      }).catch((err) => {
        clearTimeout(publishTimeout);
        this.ndkRelay.debug("Publish failed", err, event.id);
        this.ndkRelay.emit("publish:failed", event, err);
        reject(err);
      });
    });
    if (!timeoutMs || event.isEphemeral()) {
      return publishPromise;
    }
    const timeoutPromise = new Promise((_, reject) => {
      publishTimeout = setTimeout(() => {
        this.ndkRelay.debug("Publish timed out", event.rawEvent());
        this.ndkRelay.emit("publish:failed", event, new Error("Timeout"));
        reject(new Error("Publish operation timed out"));
      }, timeoutMs);
    });
    return Promise.race([publishPromise, timeoutPromise]);
  }
};
function calculateGroupableId(filters, closeOnEose) {
  const elements = [];
  for (const filter of filters) {
    const hasTimeConstraints = filter.since || filter.until;
    if (hasTimeConstraints)
      return null;
    const keys = Object.keys(filter || {}).sort().join("-");
    elements.push(keys);
  }
  let id = closeOnEose ? "+" : "";
  id += elements.join("|");
  return id;
}
function mergeFilters(filters) {
  const result = {};
  filters.forEach((filter) => {
    Object.entries(filter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (result[key] === void 0) {
          result[key] = [...value];
        } else {
          result[key] = Array.from(/* @__PURE__ */ new Set([...result[key], ...value]));
        }
      } else {
        result[key] = value;
      }
    });
  });
  return result;
}
var MAX_SUBID_LENGTH = 20;
function compareFilter(filter1, filter2) {
  if (Object.keys(filter1).length !== Object.keys(filter2).length)
    return false;
  for (const [key, value] of Object.entries(filter1)) {
    const valuesInFilter2 = filter2[key];
    if (!valuesInFilter2)
      return false;
    if (Array.isArray(value) && Array.isArray(valuesInFilter2)) {
      const v = value;
      for (const valueInFilter2 of valuesInFilter2) {
        const val = valueInFilter2;
        if (!v.includes(val)) {
          return false;
        }
      }
    } else {
      if (valuesInFilter2 !== value)
        return false;
    }
  }
  return true;
}
function generateSubId(subscriptions, filters) {
  const subIds = subscriptions.map((sub) => sub.subId).filter(Boolean);
  const subIdParts = [];
  const filterNonKindKeys = /* @__PURE__ */ new Set();
  const filterKinds = /* @__PURE__ */ new Set();
  if (subIds.length > 0) {
    subIdParts.push(Array.from(new Set(subIds)).join(","));
  } else {
    for (const filter of filters) {
      for (const key of Object.keys(filter)) {
        if (key === "kinds") {
          filter.kinds?.forEach((k) => filterKinds.add(k));
        } else {
          filterNonKindKeys.add(key);
        }
      }
    }
    if (filterKinds.size > 0) {
      subIdParts.push("kinds:" + Array.from(filterKinds).join(","));
    }
    if (filterNonKindKeys.size > 0) {
      subIdParts.push(Array.from(filterNonKindKeys).join(","));
    }
  }
  let subId = subIdParts.join("-");
  if (subId.length > MAX_SUBID_LENGTH)
    subId = subId.substring(0, MAX_SUBID_LENGTH);
  subId += "-" + Math.floor(Math.random() * 999).toString();
  return subId;
}
var NDKGroupedSubscriptions = class extends EventEmitter {
  subscriptions;
  req;
  debug;
  constructor(subscriptions, debug8) {
    super();
    this.subscriptions = subscriptions;
    this.debug = debug8 || this.subscriptions[0].subscription.debug.extend("grouped");
    for (const subscription of subscriptions) {
      this.handleSubscriptionClosure(subscription);
    }
  }
  /**
   * Adds a subscription to this group.
   * @param subscription
   */
  addSubscription(subscription) {
    this.subscriptions.push(subscription);
    this.handleSubscriptionClosure(subscription);
  }
  eventReceived(rawEvent) {
    for (const subscription of this.subscriptions) {
      subscription.eventReceived(rawEvent);
    }
  }
  eoseReceived(relay) {
    const subscriptionsToInform = Array.from(this.subscriptions);
    subscriptionsToInform.forEach(async (subscription) => {
      subscription.subscription.eoseReceived(relay);
    });
  }
  handleSubscriptionClosure(subscription) {
    subscription.subscription.on("close", () => {
      const index = this.subscriptions.findIndex(
        (i) => i.subscription === subscription.subscription
      );
      this.subscriptions.splice(index, 1);
      if (this.subscriptions.length <= 0) {
        this.emit("close");
      }
    });
  }
  /**
   * Maps each subscription through a transformation function.
   * @param fn - The transformation function.
   * @returns A new array with each subscription transformed by fn.
   */
  map(fn) {
    return this.subscriptions.map(fn);
  }
  [Symbol.iterator]() {
    let index = 0;
    const subscriptions = this.subscriptions;
    return {
      next() {
        if (index < subscriptions.length) {
          return { value: subscriptions[index++], done: false };
        } else {
          return { value: null, done: true };
        }
      }
    };
  }
};
var NDKSubscriptionFilters = class {
  subscription;
  filters = [];
  ndkRelay;
  constructor(subscription, filters, ndkRelay) {
    this.subscription = subscription;
    this.filters = filters;
    this.ndkRelay = ndkRelay;
  }
  eventReceived(rawEvent) {
    if (!this.eventMatchesLocalFilter(rawEvent))
      return;
    const event = new NDKEvent(void 0, rawEvent);
    event.relay = this.ndkRelay;
    this.subscription.eventReceived(event, this.ndkRelay, false);
  }
  eventMatchesLocalFilter(rawEvent) {
    return this.filters.some((filter) => matchFilter(filter, rawEvent));
  }
};
function findMatchingActiveSubscriptions(activeSubscriptions, filters) {
  if (activeSubscriptions.length !== filters.length)
    return false;
  for (let i = 0; i < activeSubscriptions.length; i++) {
    if (!compareFilter(activeSubscriptions[i], filters[i])) {
      break;
    }
    return activeSubscriptions[i];
  }
  return void 0;
}
var NDKRelaySubscriptions = class {
  ndkRelay;
  delayedItems = /* @__PURE__ */ new Map();
  delayedTimers = /* @__PURE__ */ new Map();
  /**
   * Active subscriptions this relay is connected to
   */
  activeSubscriptions = /* @__PURE__ */ new Map();
  activeSubscriptionsByGroupId = /* @__PURE__ */ new Map();
  executionTimeoutsByGroupId = /* @__PURE__ */ new Map();
  debug;
  groupingDebug;
  conn;
  constructor(ndkRelay) {
    this.ndkRelay = ndkRelay;
    this.conn = ndkRelay.connectivity;
    this.debug = ndkRelay.debug.extend("subscriptions");
    this.groupingDebug = ndkRelay.debug.extend("grouping");
  }
  /**
   * Creates or queues a subscription to the relay.
   */
  subscribe(subscription, filters) {
    const groupableId = calculateGroupableId(filters, subscription.closeOnEose);
    const subscriptionFilters = new NDKSubscriptionFilters(
      subscription,
      filters,
      this.ndkRelay
    );
    const isNotGroupable = !groupableId || !subscription.isGroupable();
    if (isNotGroupable) {
      this.executeSubscriptions(
        groupableId,
        // hacky
        new NDKGroupedSubscriptions([subscriptionFilters]),
        filters
      );
      return;
    }
    const activeSubscriptions = this.activeSubscriptionsByGroupId.get(groupableId);
    if (activeSubscriptions) {
      const matchingSubscription = findMatchingActiveSubscriptions(
        activeSubscriptions.filters,
        filters
      );
      if (matchingSubscription) {
        const activeSubscription = this.activeSubscriptions.get(activeSubscriptions.sub);
        activeSubscription?.addSubscription(
          new NDKSubscriptionFilters(subscription, filters, this.ndkRelay)
        );
        return;
      }
    }
    let delayedItem = this.delayedItems.get(groupableId);
    if (!delayedItem) {
      delayedItem = new NDKGroupedSubscriptions([subscriptionFilters]);
      this.delayedItems.set(groupableId, delayedItem);
      delayedItem.once("close", () => {
        const delayedItem2 = this.delayedItems.get(groupableId);
        if (!delayedItem2)
          return;
        this.delayedItems.delete(groupableId);
      });
    } else {
      delayedItem.addSubscription(subscriptionFilters);
    }
    let timeout = this.executionTimeoutsByGroupId.get(groupableId);
    if (!timeout || subscription.opts.groupableDelayType === "at-most") {
      timeout = setTimeout(() => {
        this.executionTimeoutsByGroupId.delete(groupableId);
        this.executeGroup(groupableId, subscription);
      }, subscription.opts.groupableDelay);
      this.executionTimeoutsByGroupId.set(groupableId, timeout);
    }
    if (this.delayedTimers.has(groupableId)) {
      this.delayedTimers.get(groupableId).push(timeout);
    } else {
      this.delayedTimers.set(groupableId, [timeout]);
    }
  }
  /**
   * Executes a delayed subscription via its groupable ID.
   * @param groupableId
   */
  executeGroup(groupableId, triggeredBy) {
    const delayedItem = this.delayedItems.get(groupableId);
    this.delayedItems.delete(groupableId);
    const timeouts = this.delayedTimers.get(groupableId);
    this.delayedTimers.delete(groupableId);
    if (timeouts) {
      for (const timeout of timeouts) {
        clearTimeout(timeout);
      }
    }
    if (delayedItem) {
      const filterCount = delayedItem.subscriptions[0].filters.length;
      const mergedFilters = [];
      for (let i = 0; i < filterCount; i++) {
        const allFiltersAtIndex = delayedItem.map((di) => di.filters[i]);
        mergedFilters.push(mergeFilters(allFiltersAtIndex));
      }
      this.executeSubscriptions(groupableId, delayedItem, mergedFilters);
    }
  }
  executeSubscriptionsWhenConnected(groupableId, groupedSubscriptions, mergedFilters) {
    const readyListener = () => {
      this.executeSubscriptionsConnected(groupableId, groupedSubscriptions, mergedFilters);
    };
    this.ndkRelay.once("ready", readyListener);
    groupedSubscriptions.once("close", () => {
      this.ndkRelay.removeListener("ready", readyListener);
    });
  }
  /**
   * Executes one or more subscriptions.
   *
   * If the relay is not connected, subscriptions will be queued
   * until the relay connects.
   *
   * @param groupableId
   * @param subscriptionFilters
   * @param mergedFilters
   */
  executeSubscriptions(groupableId, groupedSubscriptions, mergedFilters) {
    if (this.conn.isAvailable()) {
      this.executeSubscriptionsConnected(groupableId, groupedSubscriptions, mergedFilters);
    } else {
      this.executeSubscriptionsWhenConnected(
        groupableId,
        groupedSubscriptions,
        mergedFilters
      );
    }
  }
  /**
   * Executes one or more subscriptions.
   *
   * When there are more than one subscription, results
   * will be sent to the right subscription
   *
   * @param subscriptions
   * @param filters The filters as they should be sent to the relay
   */
  executeSubscriptionsConnected(groupableId, groupedSubscriptions, mergedFilters) {
    const subscriptions = [];
    for (const { subscription } of groupedSubscriptions) {
      subscriptions.push(subscription);
    }
    const subId = generateSubId(subscriptions, mergedFilters);
    groupedSubscriptions.req = mergedFilters;
    const subOptions = {
      id: subId,
      onevent: (event) => {
        const e = new NDKEvent(void 0, event);
        e.relay = this.ndkRelay;
        const subFilters = this.activeSubscriptions.get(sub);
        subFilters?.eventReceived(e.rawEvent());
      },
      oneose: () => {
        const subFilters = this.activeSubscriptions.get(sub);
        subFilters?.eoseReceived(this.ndkRelay);
        if (subscriptions.every((sub2) => sub2.closeOnEose)) {
          sub.close();
        }
      },
      onclose: () => {
      }
    };
    const sub = this.conn.relay.subscribe(mergedFilters, subOptions);
    this.activeSubscriptions.set(sub, groupedSubscriptions);
    if (groupableId) {
      this.activeSubscriptionsByGroupId.set(groupableId, { filters: mergedFilters, sub });
    }
    groupedSubscriptions.once("close", () => {
      sub.close();
      this.activeSubscriptions.delete(sub);
      if (groupableId) {
        this.activeSubscriptionsByGroupId.delete(groupableId);
      }
    });
    this.executeSubscriptionsWhenConnected(groupableId, groupedSubscriptions, mergedFilters);
    return sub;
  }
  executedFilters() {
    const ret = /* @__PURE__ */ new Map();
    for (const [, groupedSubscriptions] of this.activeSubscriptions) {
      ret.set(
        groupedSubscriptions.req,
        groupedSubscriptions.map((sub) => sub.subscription)
      );
    }
    return ret;
  }
};
var NDKRelay = class extends EventEmitter {
  url;
  scores;
  connectivity;
  subs;
  publisher;
  authPolicy;
  validationRatio;
  validatedEventCount = 0;
  skippedEventCount = 0;
  /**
   * Whether this relay is trusted.
   *
   * Trusted relay's events do not get their signature verified.
   */
  trusted = false;
  complaining = false;
  debug;
  constructor(url, authPolicy, ndk) {
    super();
    this.url = normalizeRelayUrl(url);
    this.scores = /* @__PURE__ */ new Map();
    this.debug = createDebug(`ndk:relay:${url}`);
    this.connectivity = new NDKRelayConnectivity(this, ndk);
    this.subs = new NDKRelaySubscriptions(this);
    this.publisher = new NDKRelayPublisher(this);
    this.authPolicy = authPolicy;
    this.validationRatio = void 0;
  }
  get status() {
    return this.connectivity.status;
  }
  get connectionStats() {
    return this.connectivity.connectionStats;
  }
  /**
   * Connects to the relay.
   */
  async connect(timeoutMs, reconnect = true) {
    return this.connectivity.connect(timeoutMs, reconnect);
  }
  /**
   * Disconnects from the relay.
   */
  disconnect() {
    if (this.status === 3) {
      return;
    }
    this.connectivity.disconnect();
  }
  /**
   * Queues or executes the subscription of a specific set of filters
   * within this relay.
   *
   * @param subscription NDKSubscription this filters belong to.
   * @param filters Filters to execute
   */
  subscribe(subscription, filters) {
    this.subs.subscribe(subscription, filters);
  }
  /**
   * Publishes an event to the relay with an optional timeout.
   *
   * If the relay is not connected, the event will be published when the relay connects,
   * unless the timeout is reached before the relay connects.
   *
   * @param event The event to publish
   * @param timeoutMs The timeout for the publish operation in milliseconds
   * @returns A promise that resolves when the event has been published or rejects if the operation times out
   */
  async publish(event, timeoutMs = 2500) {
    return this.publisher.publish(event, timeoutMs);
  }
  /**
   * Called when this relay has responded with an event but
   * wasn't the fastest one.
   * @param timeDiffInMs The time difference in ms between the fastest and this relay in milliseconds
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  scoreSlowerEvent(timeDiffInMs) {
  }
  /** @deprecated Use referenceTags instead. */
  tagReference(marker) {
    const tag = ["r", this.url];
    if (marker) {
      tag.push(marker);
    }
    return tag;
  }
  referenceTags() {
    return [["r", this.url]];
  }
  activeSubscriptions() {
    return this.subs.executedFilters();
  }
  addValidatedEvent() {
    this.validatedEventCount++;
  }
  addSkippedEvent() {
    this.skippedEventCount++;
  }
  getValidationRatio() {
    if (this.skippedEventCount === 0) {
      return 1;
    }
    return this.validatedEventCount / (this.validatedEventCount + this.skippedEventCount);
  }
  shouldValidateEvent() {
    if (this.trusted) {
      return false;
    }
    if (this.validationRatio === void 0) {
      return true;
    }
    return this.getValidationRatio() < this.validationRatio;
  }
};
var NDKPublishError = class extends Error {
  errors;
  publishedToRelays;
  /**
   * Intended relay set where the publishing was intended to happen.
   */
  intendedRelaySet;
  constructor(message, errors, publishedToRelays, intendedRelaySet) {
    super(message);
    this.errors = errors;
    this.publishedToRelays = publishedToRelays;
    this.intendedRelaySet = intendedRelaySet;
  }
  get relayErrors() {
    const errors = [];
    for (const [relay, err] of this.errors) {
      errors.push(`${relay.url}: ${err}`);
    }
    return errors.join("\n");
  }
};
var NDKRelaySet = class _NDKRelaySet {
  relays;
  debug;
  ndk;
  constructor(relays, ndk) {
    this.relays = relays;
    this.ndk = ndk;
    this.debug = ndk.debug.extend("relayset");
  }
  /**
   * Adds a relay to this set.
   */
  addRelay(relay) {
    this.relays.add(relay);
  }
  get relayUrls() {
    return Array.from(this.relays).map((r) => r.url);
  }
  /**
   * Creates a relay set from a list of relay URLs.
   *
   * If no connection to the relay is found in the pool it will temporarily
   * connect to it.
   *
   * @param relayUrls - list of relay URLs to include in this set
   * @param ndk
   * @returns NDKRelaySet
   */
  static fromRelayUrls(relayUrls, ndk) {
    const relays = /* @__PURE__ */ new Set();
    for (const url of relayUrls) {
      const relay = ndk.pool.relays.get(normalizeRelayUrl(url));
      if (relay) {
        relays.add(relay);
      } else {
        const temporaryRelay = new NDKRelay(normalizeRelayUrl(url), void 0, ndk);
        ndk.pool.useTemporaryRelay(temporaryRelay);
        relays.add(temporaryRelay);
      }
    }
    return new _NDKRelaySet(new Set(relays), ndk);
  }
  /**
   * Publish an event to all relays in this set. Returns the number of relays that have received the event.
   * @param event
   * @param timeoutMs - timeout in milliseconds for each publish operation and connection operation
   * @returns A set where the event was successfully published to
   * @throws NDKPublishError if no relay was able to receive the event
   * @example
   * ```typescript
   * const event = new NDKEvent(ndk, {kinds: [NDKKind.Message], "#d": ["123"]});
   * try {
   *    const publishedToRelays = await relaySet.publish(event);
   *    console.log(`published to ${publishedToRelays.size} relays`)
   * } catch (error) {
   *   console.error("error publishing to relays", error);
   *
   *   if (error instanceof NDKPublishError) {
   *      for (const [relay, err] of error.errors) {
   *         console.error(`error publishing to relay ${relay.url}`, err);
   *       }
   *   }
   * }
   * ```
   */
  async publish(event, timeoutMs, requiredRelayCount = 1) {
    const publishedToRelays = /* @__PURE__ */ new Set();
    const errors = /* @__PURE__ */ new Map();
    const isEphemeral2 = event.isEphemeral();
    event.publishStatus = "pending";
    const promises = Array.from(this.relays).map((relay) => {
      return new Promise((resolve) => {
        relay.publish(event, timeoutMs).then((e) => {
          publishedToRelays.add(relay);
          resolve();
        }).catch((err) => {
          if (!isEphemeral2) {
            errors.set(relay, err);
          }
          resolve();
        });
      });
    });
    await Promise.all(promises);
    if (publishedToRelays.size < requiredRelayCount) {
      if (!isEphemeral2) {
        const error = new NDKPublishError(
          "Not enough relays received the event",
          errors,
          publishedToRelays,
          this
        );
        event.publishStatus = "error";
        event.publishError = error;
        this.ndk.emit("event:publish-failed", event, error, this.relayUrls);
        if (this.ndk.listeners("event:publish-failed").length === 0) {
          throw error;
        }
      }
    } else {
      event.emit("published", { relaySet: this, publishedToRelays });
    }
    return publishedToRelays;
  }
  get size() {
    return this.relays.size;
  }
};
function calculateRelaySetFromEvent(ndk, event) {
  const relays = /* @__PURE__ */ new Set();
  ndk.pool?.permanentAndConnectedRelays().forEach((relay) => relays.add(relay));
  return new NDKRelaySet(relays, ndk);
}
function mergeTags(tags1, tags2) {
  const tagMap = /* @__PURE__ */ new Map();
  const generateKey = (tag) => tag.join(",");
  const isContained = (smaller, larger) => {
    return smaller.every((value, index) => value === larger[index]);
  };
  const processTag = (tag) => {
    for (const [key, existingTag] of tagMap) {
      if (isContained(existingTag, tag) || isContained(tag, existingTag)) {
        if (tag.length >= existingTag.length) {
          tagMap.set(key, tag);
        }
        return;
      }
    }
    tagMap.set(generateKey(tag), tag);
  };
  tags1.concat(tags2).forEach(processTag);
  return Array.from(tagMap.values());
}
async function generateContentTags(content, tags = []) {
  const tagRegex = /(@|nostr:)(npub|nprofile|note|nevent|naddr)[a-zA-Z0-9]+/g;
  const hashtagRegex = /(?<=\s|^)(#[^\s!@#$%^&*()=+./,[{\]};:'"?><]+)/g;
  const promises = [];
  const addTagIfNew = (t) => {
    if (!tags.find((t2) => ["q", t[0]].includes(t2[0]) && t2[1] === t[1])) {
      tags.push(t);
    }
  };
  content = content.replace(tagRegex, (tag) => {
    try {
      const entity = tag.split(/(@|nostr:)/)[2];
      const { type, data } = nip19.decode(entity);
      let t;
      switch (type) {
        case "npub":
          t = ["p", data];
          break;
        case "nprofile":
          t = ["p", data.pubkey];
          break;
        case "note":
          promises.push(
            new Promise(async (resolve) => {
              addTagIfNew([
                "e",
                data,
                await maybeGetEventRelayUrl(entity),
                "mention"
              ]);
              resolve();
            })
          );
          break;
        case "nevent":
          promises.push(
            new Promise(async (resolve) => {
              let { id, relays, author } = data;
              if (!relays || relays.length === 0) {
                relays = [await maybeGetEventRelayUrl(entity)];
              }
              addTagIfNew(["e", id, relays[0], "mention"]);
              if (author)
                addTagIfNew(["p", author]);
              resolve();
            })
          );
          break;
        case "naddr":
          promises.push(
            new Promise(async (resolve) => {
              const id = [data.kind, data.pubkey, data.identifier].join(":");
              let relays = data.relays ?? [];
              if (relays.length === 0) {
                relays = [await maybeGetEventRelayUrl(entity)];
              }
              addTagIfNew(["a", id, relays[0], "mention"]);
              addTagIfNew(["p", data.pubkey]);
              resolve();
            })
          );
          break;
        default:
          return tag;
      }
      if (t)
        addTagIfNew(t);
      return `nostr:${entity}`;
    } catch (error) {
      return tag;
    }
  });
  await Promise.all(promises);
  content = content.replace(hashtagRegex, (tag, word) => {
    const t = ["t", word.slice(1)];
    if (!tags.find((t2) => t2[0] === t[0] && t2[1] === t[1])) {
      tags.push(t);
    }
    return tag;
  });
  return { content, tags };
}
async function maybeGetEventRelayUrl(nip19Id) {
  return "";
}
function isReplaceable() {
  if (this.kind === void 0)
    throw new Error("Kind not set");
  return [0, 3].includes(this.kind) || this.kind >= 1e4 && this.kind < 2e4 || this.kind >= 3e4 && this.kind < 4e4;
}
function isEphemeral() {
  if (this.kind === void 0)
    throw new Error("Kind not set");
  return this.kind >= 2e4 && this.kind < 3e4;
}
function isParamReplaceable() {
  if (this.kind === void 0)
    throw new Error("Kind not set");
  return this.kind >= 3e4 && this.kind < 4e4;
}
var NDKKind = /* @__PURE__ */ ((NDKKind2) => {
  NDKKind2[NDKKind2["Metadata"] = 0] = "Metadata";
  NDKKind2[NDKKind2["Text"] = 1] = "Text";
  NDKKind2[NDKKind2["RecommendRelay"] = 2] = "RecommendRelay";
  NDKKind2[NDKKind2["Contacts"] = 3] = "Contacts";
  NDKKind2[NDKKind2["EncryptedDirectMessage"] = 4] = "EncryptedDirectMessage";
  NDKKind2[NDKKind2["EventDeletion"] = 5] = "EventDeletion";
  NDKKind2[NDKKind2["Repost"] = 6] = "Repost";
  NDKKind2[NDKKind2["Reaction"] = 7] = "Reaction";
  NDKKind2[NDKKind2["BadgeAward"] = 8] = "BadgeAward";
  NDKKind2[NDKKind2["GroupChat"] = 9] = "GroupChat";
  NDKKind2[NDKKind2["GroupNote"] = 11] = "GroupNote";
  NDKKind2[NDKKind2["GroupReply"] = 12] = "GroupReply";
  NDKKind2[NDKKind2["GenericRepost"] = 16] = "GenericRepost";
  NDKKind2[NDKKind2["ChannelCreation"] = 40] = "ChannelCreation";
  NDKKind2[NDKKind2["ChannelMetadata"] = 41] = "ChannelMetadata";
  NDKKind2[NDKKind2["ChannelMessage"] = 42] = "ChannelMessage";
  NDKKind2[NDKKind2["ChannelHideMessage"] = 43] = "ChannelHideMessage";
  NDKKind2[NDKKind2["ChannelMuteUser"] = 44] = "ChannelMuteUser";
  NDKKind2[NDKKind2["Media"] = 1063] = "Media";
  NDKKind2[NDKKind2["Report"] = 1984] = "Report";
  NDKKind2[NDKKind2["Label"] = 1985] = "Label";
  NDKKind2[NDKKind2["DVMReqTextExtraction"] = 5e3] = "DVMReqTextExtraction";
  NDKKind2[NDKKind2["DVMReqTextSummarization"] = 5001] = "DVMReqTextSummarization";
  NDKKind2[NDKKind2["DVMReqTextTranslation"] = 5002] = "DVMReqTextTranslation";
  NDKKind2[NDKKind2["DVMReqTextGeneration"] = 5050] = "DVMReqTextGeneration";
  NDKKind2[NDKKind2["DVMReqImageGeneration"] = 5100] = "DVMReqImageGeneration";
  NDKKind2[NDKKind2["DVMReqDiscoveryNostrContent"] = 5300] = "DVMReqDiscoveryNostrContent";
  NDKKind2[NDKKind2["DVMReqDiscoveryNostrPeople"] = 5301] = "DVMReqDiscoveryNostrPeople";
  NDKKind2[NDKKind2["DVMReqTimestamping"] = 5900] = "DVMReqTimestamping";
  NDKKind2[NDKKind2["DVMEventSchedule"] = 5905] = "DVMEventSchedule";
  NDKKind2[NDKKind2["DVMJobFeedback"] = 7e3] = "DVMJobFeedback";
  NDKKind2[NDKKind2["Subscribe"] = 7001] = "Subscribe";
  NDKKind2[NDKKind2["Unsubscribe"] = 7002] = "Unsubscribe";
  NDKKind2[NDKKind2["SubscriptionReceipt"] = 7003] = "SubscriptionReceipt";
  NDKKind2[NDKKind2["GroupAdminAddUser"] = 9e3] = "GroupAdminAddUser";
  NDKKind2[NDKKind2["GroupAdminRemoveUser"] = 9001] = "GroupAdminRemoveUser";
  NDKKind2[NDKKind2["GroupAdminEditMetadata"] = 9002] = "GroupAdminEditMetadata";
  NDKKind2[NDKKind2["GroupAdminEditStatus"] = 9006] = "GroupAdminEditStatus";
  NDKKind2[NDKKind2["MuteList"] = 1e4] = "MuteList";
  NDKKind2[NDKKind2["PinList"] = 10001] = "PinList";
  NDKKind2[NDKKind2["RelayList"] = 10002] = "RelayList";
  NDKKind2[NDKKind2["BookmarkList"] = 10003] = "BookmarkList";
  NDKKind2[NDKKind2["CommunityList"] = 10004] = "CommunityList";
  NDKKind2[NDKKind2["PublicChatList"] = 10005] = "PublicChatList";
  NDKKind2[NDKKind2["BlockRelayList"] = 10006] = "BlockRelayList";
  NDKKind2[NDKKind2["SearchRelayList"] = 10007] = "SearchRelayList";
  NDKKind2[NDKKind2["SimpleGroupList"] = 10009] = "SimpleGroupList";
  NDKKind2[NDKKind2["InterestList"] = 10015] = "InterestList";
  NDKKind2[NDKKind2["EmojiList"] = 10030] = "EmojiList";
  NDKKind2[NDKKind2["BlossomList"] = 10063] = "BlossomList";
  NDKKind2[NDKKind2["NostrWaletConnectInfo"] = 13194] = "NostrWaletConnectInfo";
  NDKKind2[NDKKind2["TierList"] = 17e3] = "TierList";
  NDKKind2[NDKKind2["FollowSet"] = 3e4] = "FollowSet";
  NDKKind2[
    NDKKind2["CategorizedPeopleList"] = 3e4
    /* FollowSet */
  ] = "CategorizedPeopleList";
  NDKKind2[NDKKind2["CategorizedBookmarkList"] = 30001] = "CategorizedBookmarkList";
  NDKKind2[NDKKind2["RelaySet"] = 30002] = "RelaySet";
  NDKKind2[
    NDKKind2["CategorizedRelayList"] = 30002
    /* RelaySet */
  ] = "CategorizedRelayList";
  NDKKind2[NDKKind2["BookmarkSet"] = 30003] = "BookmarkSet";
  NDKKind2[NDKKind2["CurationSet"] = 30004] = "CurationSet";
  NDKKind2[NDKKind2["ArticleCurationSet"] = 30004] = "ArticleCurationSet";
  NDKKind2[NDKKind2["VideoCurationSet"] = 30005] = "VideoCurationSet";
  NDKKind2[NDKKind2["InterestSet"] = 30015] = "InterestSet";
  NDKKind2[
    NDKKind2["InterestsList"] = 30015
    /* InterestSet */
  ] = "InterestsList";
  NDKKind2[NDKKind2["EmojiSet"] = 30030] = "EmojiSet";
  NDKKind2[NDKKind2["Draft"] = 31234] = "Draft";
  NDKKind2[NDKKind2["SubscriptionTier"] = 37001] = "SubscriptionTier";
  NDKKind2[NDKKind2["HighlightSet"] = 39802] = "HighlightSet";
  NDKKind2[
    NDKKind2["CategorizedHighlightList"] = 39802
    /* HighlightSet */
  ] = "CategorizedHighlightList";
  NDKKind2[NDKKind2["ZapRequest"] = 9734] = "ZapRequest";
  NDKKind2[NDKKind2["Zap"] = 9735] = "Zap";
  NDKKind2[NDKKind2["Highlight"] = 9802] = "Highlight";
  NDKKind2[NDKKind2["ClientAuth"] = 22242] = "ClientAuth";
  NDKKind2[NDKKind2["NostrWalletConnectReq"] = 23194] = "NostrWalletConnectReq";
  NDKKind2[NDKKind2["NostrWalletConnectRes"] = 23195] = "NostrWalletConnectRes";
  NDKKind2[NDKKind2["NostrConnect"] = 24133] = "NostrConnect";
  NDKKind2[NDKKind2["BlossomUpload"] = 24242] = "BlossomUpload";
  NDKKind2[NDKKind2["HttpAuth"] = 27235] = "HttpAuth";
  NDKKind2[NDKKind2["ProfileBadge"] = 30008] = "ProfileBadge";
  NDKKind2[NDKKind2["BadgeDefinition"] = 30009] = "BadgeDefinition";
  NDKKind2[NDKKind2["MarketStall"] = 30017] = "MarketStall";
  NDKKind2[NDKKind2["MarketProduct"] = 30018] = "MarketProduct";
  NDKKind2[NDKKind2["Article"] = 30023] = "Article";
  NDKKind2[NDKKind2["AppSpecificData"] = 30078] = "AppSpecificData";
  NDKKind2[NDKKind2["Classified"] = 30402] = "Classified";
  NDKKind2[NDKKind2["HorizontalVideo"] = 34235] = "HorizontalVideo";
  NDKKind2[NDKKind2["GroupMetadata"] = 39e3] = "GroupMetadata";
  NDKKind2[NDKKind2["GroupMembers"] = 39002] = "GroupMembers";
  NDKKind2[NDKKind2["NDKRelayMonitor"] = 10166] = "NDKRelayMonitor";
  NDKKind2[NDKKind2["NDKRelayMeta"] = 30066] = "NDKRelayMeta";
  NDKKind2[NDKKind2["NDKRelayDiscovery"] = 30166] = "NDKRelayDiscovery";
  NDKKind2[NDKKind2["AppRecommendation"] = 31989] = "AppRecommendation";
  NDKKind2[NDKKind2["AppHandler"] = 31990] = "AppHandler";
  return NDKKind2;
})(NDKKind || {});
async function encrypt(recipient, signer) {
  if (!this.ndk)
    throw new Error("No NDK instance found!");
  if (!signer) {
    await this.ndk.assertSigner();
    signer = this.ndk.signer;
  }
  if (!recipient) {
    const pTags = this.getMatchingTags("p");
    if (pTags.length !== 1) {
      throw new Error(
        "No recipient could be determined and no explicit recipient was provided"
      );
    }
    recipient = this.ndk.getUser({ pubkey: pTags[0][1] });
  }
  this.content = await signer?.encrypt(recipient, this.content);
}
async function decrypt(sender, signer) {
  if (!this.ndk)
    throw new Error("No NDK instance found!");
  if (!signer) {
    await this.ndk.assertSigner();
    signer = this.ndk.signer;
  }
  if (!sender) {
    sender = this.author;
  }
  this.content = await signer?.decrypt(sender, this.content);
}
function encode() {
  let relays = [];
  if (this.onRelays.length > 0) {
    relays = this.onRelays.map((relay) => relay.url);
  } else if (this.relay) {
    relays = [this.relay.url];
  }
  if (this.isParamReplaceable()) {
    return nip19.naddrEncode({
      kind: this.kind,
      pubkey: this.pubkey,
      identifier: this.replaceableDTag(),
      relays
    });
  } else if (relays.length > 0) {
    return nip19.neventEncode({
      id: this.tagId(),
      relays,
      author: this.pubkey
    });
  } else {
    return nip19.noteEncode(this.tagId());
  }
}
async function repost(publish = true, signer) {
  if (!signer && publish) {
    if (!this.ndk)
      throw new Error("No NDK instance found");
    this.ndk.assertSigner();
    signer = this.ndk.signer;
  }
  const e = new NDKEvent(this.ndk, {
    kind: getKind(this),
    content: ""
  });
  e.tag(this);
  if (e.kind === 16) {
    e.tags.push(["k", `${this.kind}`]);
  } else {
    e.content = JSON.stringify(this.rawEvent());
  }
  if (signer)
    await e.sign(signer);
  if (publish)
    await e.publish();
  return e;
}
function getKind(event) {
  if (event.kind === 1) {
    return 6;
  }
  return 16;
}
function eventHasETagMarkers(event) {
  return event.getMatchingTags("e").some((tag) => tag[3]);
}
function getRootTag(event, searchTag) {
  searchTag ??= event.tagType();
  let rootEventTag = event.tags.find((tag) => tag[3] === "root");
  if (!rootEventTag) {
    if (eventHasETagMarkers(event))
      return;
    const matchingTags = event.getMatchingTags(searchTag);
    if (matchingTags.length < 3)
      return matchingTags[0];
  }
  return rootEventTag;
}
function getReplyTag(event, searchTag) {
  searchTag ??= event.tagType();
  let replyTag = event.tags.find((tag) => tag[3] === "reply");
  if (replyTag)
    return replyTag;
  if (!replyTag)
    replyTag = event.tags.find((tag) => tag[3] === "root");
  if (!replyTag) {
    if (eventHasETagMarkers(event))
      return;
    const matchingTags = event.getMatchingTags(searchTag);
    if (matchingTags.length === 1)
      return matchingTags[0];
    if (matchingTags.length === 2)
      return matchingTags[1];
  }
}
async function fetchTaggedEvent(tag, marker) {
  if (!this.ndk)
    throw new Error("NDK instance not found");
  const t = this.getMatchingTags(tag, marker);
  if (t.length === 0)
    return void 0;
  const [_, id, hint] = t[0];
  let relay;
  let event = await this.ndk.fetchEvent(id, {}, relay);
  return event;
}
async function fetchRootEvent(subOpts) {
  if (!this.ndk)
    throw new Error("NDK instance not found");
  const rootTag = getRootTag(this);
  if (!rootTag)
    return void 0;
  return this.ndk.fetchEventFromTag(rootTag, subOpts);
}
async function fetchReplyEvent(subOpts) {
  if (!this.ndk)
    throw new Error("NDK instance not found");
  const replyTag = getReplyTag(this);
  if (!replyTag)
    return void 0;
  return this.ndk.fetchEventFromTag(replyTag, subOpts);
}
function serialize(includeSig = false, includeId = false) {
  const payload = [0, this.pubkey, this.created_at, this.kind, this.tags, this.content];
  if (includeSig)
    payload.push(this.sig);
  if (includeId)
    payload.push(this.id);
  return JSON.stringify(payload);
}
function deserialize(serializedEvent) {
  const eventArray = JSON.parse(serializedEvent);
  const ret = {
    pubkey: eventArray[1],
    created_at: eventArray[2],
    kind: eventArray[3],
    tags: eventArray[4],
    content: eventArray[5]
  };
  if (eventArray.length === 7)
    ret.sig = eventArray[6];
  if (eventArray.length === 8)
    ret.id = eventArray[7];
  return ret;
}
var worker;
var processingQueue = {};
async function verifySignatureAsync(event, persist) {
  const promise = new Promise((resolve) => {
    const serialized = event.serialize();
    let enqueue = false;
    if (!processingQueue[event.id]) {
      processingQueue[event.id] = { event, resolves: [] };
      enqueue = true;
    }
    processingQueue[event.id].resolves.push(resolve);
    if (!enqueue)
      return;
    worker.postMessage({
      serialized,
      id: event.id,
      sig: event.sig,
      pubkey: event.pubkey
    });
  });
  return promise;
}
var PUBKEY_REGEX = /^[a-f0-9]{64}$/;
function validate() {
  if (typeof this.kind !== "number")
    return false;
  if (typeof this.content !== "string")
    return false;
  if (typeof this.created_at !== "number")
    return false;
  if (typeof this.pubkey !== "string")
    return false;
  if (!this.pubkey.match(PUBKEY_REGEX))
    return false;
  if (!Array.isArray(this.tags))
    return false;
  for (let i = 0; i < this.tags.length; i++) {
    const tag = this.tags[i];
    if (!Array.isArray(tag))
      return false;
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] === "object")
        return false;
    }
  }
  return true;
}
var verifiedEvents = new LRUCache({
  maxSize: 1e3,
  entryExpirationTimeInMS: 6e4
});
function verifySignature(persist) {
  if (typeof this.signatureVerified === "boolean")
    return this.signatureVerified;
  const prevVerification = verifiedEvents.get(this.id);
  if (prevVerification !== null) {
    return this.signatureVerified = prevVerification;
  }
  try {
    if (this.ndk?.asyncSigVerification) {
      verifySignatureAsync(this, persist).then((result) => {
        if (persist) {
          this.signatureVerified = result;
          verifiedEvents.set(this.id, result);
        }
        if (!result) {
          this.ndk.emit("event:invalid-sig", this);
        }
      });
    } else {
      const hash = sha256(new TextEncoder().encode(this.serialize()));
      const res = schnorr.verify(this.sig, hash, this.pubkey);
      verifiedEvents.set(this.id, res);
      return this.signatureVerified = res;
    }
  } catch (err) {
    return this.signatureVerified = false;
  }
}
function getEventHash() {
  return getEventHashFromSerializedEvent(this.serialize());
}
function getEventHashFromSerializedEvent(serializedEvent) {
  const eventHash = sha256(new TextEncoder().encode(serializedEvent));
  return bytesToHex(eventHash);
}
var NDKEvent = class _NDKEvent extends EventEmitter {
  ndk;
  created_at;
  content = "";
  tags = [];
  kind;
  id = "";
  sig;
  pubkey = "";
  signatureVerified;
  _author = void 0;
  /**
   * The relay that this event was first received from.
   */
  relay;
  /**
   * The relays that this event was received from and/or successfully published to.
   */
  onRelays = [];
  /**
   * The status of the publish operation.
   */
  publishStatus = "success";
  publishError;
  constructor(ndk, event) {
    super();
    this.ndk = ndk;
    this.created_at = event?.created_at;
    this.content = event?.content || "";
    this.tags = event?.tags || [];
    this.id = event?.id || "";
    this.sig = event?.sig;
    this.pubkey = event?.pubkey || "";
    this.kind = event?.kind;
  }
  /**
   * Deserialize an NDKEvent from a serialized payload.
   * @param ndk
   * @param event
   * @returns
   */
  static deserialize(ndk, event) {
    return new _NDKEvent(ndk, deserialize(event));
  }
  /**
   * Returns the event as is.
   */
  rawEvent() {
    return {
      created_at: this.created_at,
      content: this.content,
      tags: this.tags,
      kind: this.kind,
      pubkey: this.pubkey,
      id: this.id,
      sig: this.sig
    };
  }
  set author(user) {
    this.pubkey = user.pubkey;
    this._author = user;
    this._author.ndk ??= this.ndk;
  }
  /**
   * Returns an NDKUser for the author of the event.
   */
  get author() {
    if (this._author)
      return this._author;
    if (!this.ndk)
      throw new Error("No NDK instance found");
    const user = this.ndk.getUser({ pubkey: this.pubkey });
    this._author = user;
    return user;
  }
  tag(userOrTagOrEvent, marker, skipAuthorTag, forceTag) {
    let tags = [];
    const isNDKUser = userOrTagOrEvent.fetchProfile !== void 0;
    if (isNDKUser) {
      forceTag ??= "p";
      const tag = [forceTag, userOrTagOrEvent.pubkey];
      if (marker)
        tag.push(...["", marker]);
      tags.push(tag);
    } else if (userOrTagOrEvent instanceof _NDKEvent) {
      const event = userOrTagOrEvent;
      skipAuthorTag ??= event?.pubkey === this.pubkey;
      tags = event.referenceTags(marker, skipAuthorTag, forceTag);
      for (const pTag of event.getMatchingTags("p")) {
        if (pTag[1] === this.pubkey)
          continue;
        if (this.tags.find((t) => t[0] === "p" && t[1] === pTag[1]))
          continue;
        this.tags.push(["p", pTag[1]]);
      }
    } else if (Array.isArray(userOrTagOrEvent)) {
      tags = [userOrTagOrEvent];
    } else {
      throw new Error("Invalid argument", userOrTagOrEvent);
    }
    this.tags = mergeTags(this.tags, tags);
  }
  /**
   * Return a NostrEvent object, trying to fill in missing fields
   * when possible, adding tags when necessary.
   * @param pubkey {string} The pubkey of the user who the event belongs to.
   * @returns {Promise<NostrEvent>} A promise that resolves to a NostrEvent.
   */
  async toNostrEvent(pubkey) {
    if (!pubkey && this.pubkey === "") {
      const user = await this.ndk?.signer?.user();
      this.pubkey = user?.pubkey || "";
    }
    if (!this.created_at) {
      this.created_at = Math.floor(Date.now() / 1e3);
    }
    const { content, tags } = await this.generateTags();
    this.content = content || "";
    this.tags = tags;
    try {
      this.id = this.getEventHash();
    } catch (e) {
    }
    return this.rawEvent();
  }
  serialize = serialize.bind(this);
  getEventHash = getEventHash.bind(this);
  validate = validate.bind(this);
  verifySignature = verifySignature.bind(this);
  isReplaceable = isReplaceable.bind(this);
  isEphemeral = isEphemeral.bind(this);
  isParamReplaceable = isParamReplaceable.bind(this);
  /**
   * Encodes a bech32 id.
   *
   * @param relays {string[]} The relays to encode in the id
   * @returns {string} - Encoded naddr, note or nevent.
   */
  encode = encode.bind(this);
  encrypt = encrypt.bind(this);
  decrypt = decrypt.bind(this);
  /**
   * Get all tags with the given name
   * @param tagName {string} The name of the tag to search for
   * @returns {NDKTag[]} An array of the matching tags
   */
  getMatchingTags(tagName, marker) {
    const t = this.tags.filter((tag) => tag[0] === tagName);
    if (marker !== void 0)
      return t;
    return t.filter((tag) => tag[3] === marker);
  }
  /**
   * Get the first tag with the given name
   * @param tagName Tag name to search for
   * @returns The value of the first tag with the given name, or undefined if no such tag exists
   */
  tagValue(tagName) {
    const tags = this.getMatchingTags(tagName);
    if (tags.length === 0)
      return void 0;
    return tags[0][1];
  }
  /**
   * Gets the NIP-31 "alt" tag of the event.
   */
  get alt() {
    return this.tagValue("alt");
  }
  /**
   * Sets the NIP-31 "alt" tag of the event. Use this to set an alt tag so
   * clients that don't handle a particular event kind can display something
   * useful for users.
   */
  set alt(alt) {
    this.removeTag("alt");
    if (alt)
      this.tags.push(["alt", alt]);
  }
  /**
   * Gets the NIP-33 "d" tag of the event.
   */
  get dTag() {
    return this.tagValue("d");
  }
  /**
   * Sets the NIP-33 "d" tag of the event.
   */
  set dTag(value) {
    this.removeTag("d");
    if (value)
      this.tags.push(["d", value]);
  }
  /**
   * Remove all tags with the given name (e.g. "d", "a", "p")
   * @param tagName Tag name to search for and remove
   * @returns {void}
   */
  removeTag(tagName) {
    this.tags = this.tags.filter((tag) => tag[0] !== tagName);
  }
  /**
   * Sign the event if a signer is present.
   *
   * It will generate tags.
   * Repleacable events will have their created_at field set to the current time.
   * @param signer {NDKSigner} The NDKSigner to use to sign the event
   * @returns {Promise<string>} A Promise that resolves to the signature of the signed event.
   */
  async sign(signer) {
    if (!signer) {
      this.ndk?.assertSigner();
      signer = this.ndk.signer;
    } else {
      this.author = await signer.user();
    }
    const nostrEvent = await this.toNostrEvent();
    this.sig = await signer.sign(nostrEvent);
    return this.sig;
  }
  /**
   *
   * @param relaySet
   * @param timeoutMs
   * @param requiredRelayCount
   * @returns
   */
  async publishReplaceable(relaySet, timeoutMs, requiredRelayCount) {
    this.id = "";
    this.created_at = Math.floor(Date.now() / 1e3);
    this.sig = "";
    return this.publish(relaySet, timeoutMs, requiredRelayCount);
  }
  /**
   * Attempt to sign and then publish an NDKEvent to a given relaySet.
   * If no relaySet is provided, the relaySet will be calculated by NDK.
   * @param relaySet {NDKRelaySet} The relaySet to publish the even to.
   * @param timeoutM {number} The timeout for the publish operation in milliseconds.
   * @param requiredRelayCount The number of relays that must receive the event for the publish to be considered successful.
   * @returns A promise that resolves to the relays the event was published to.
   */
  async publish(relaySet, timeoutMs, requiredRelayCount) {
    if (!this.sig)
      await this.sign();
    if (!this.ndk)
      throw new Error("NDKEvent must be associated with an NDK instance to publish");
    if (!relaySet) {
      relaySet = this.ndk.devWriteRelaySet || calculateRelaySetFromEvent(this.ndk);
    }
    if (this.kind === 5 && this.ndk.cacheAdapter?.deleteEvent) {
      this.ndk.cacheAdapter.deleteEvent(this);
    }
    const rawEvent = this.rawEvent();
    if (this.ndk.cacheAdapter?.addUnpublishedEvent) {
      try {
        this.ndk.cacheAdapter.addUnpublishedEvent(this, relaySet.relayUrls);
      } catch (e) {
        console.error("Error adding unpublished event to cache", e);
      }
    }
    this.ndk.subManager.subscriptions.forEach((sub) => {
      if (sub.filters.some((filter) => matchFilter(filter, rawEvent))) {
        sub.eventReceived(this, void 0, false, true);
      }
    });
    const relays = await relaySet.publish(this, timeoutMs, requiredRelayCount);
    this.onRelays = Array.from(relays);
    return relays;
  }
  /**
   * Generates tags for users, notes, and other events tagged in content.
   * Will also generate random "d" tag for parameterized replaceable events where needed.
   * @returns {ContentTag} The tags and content of the event.
   */
  async generateTags() {
    let tags = [];
    const g = await generateContentTags(this.content, this.tags);
    const content = g.content;
    tags = g.tags;
    if (this.kind && this.isParamReplaceable()) {
      const dTag = this.getMatchingTags("d")[0];
      if (!dTag) {
        const title = this.tagValue("title");
        const randLength = title ? 6 : 16;
        let str = [...Array(randLength)].map(() => Math.random().toString(36)[2]).join("");
        if (title && title.length > 0) {
          str = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") + "-" + str;
        }
        tags.push(["d", str]);
      }
    }
    if (this.ndk?.clientName || this.ndk?.clientNip89) {
      if (!this.tags.some((tag) => tag[0] === "client")) {
        const clientTag = ["client", this.ndk.clientName ?? ""];
        if (this.ndk.clientNip89)
          clientTag.push(this.ndk.clientNip89);
        tags.push(clientTag);
      }
    }
    return { content: content || "", tags };
  }
  muted() {
    const authorMutedEntry = this.ndk?.mutedIds.get(this.pubkey);
    if (authorMutedEntry && authorMutedEntry === "p")
      return "author";
    const eventTagReference = this.tagReference();
    const eventMutedEntry = this.ndk?.mutedIds.get(eventTagReference[1]);
    if (eventMutedEntry && eventMutedEntry === eventTagReference[0])
      return "event";
    return null;
  }
  /**
   * Returns the "d" tag of a parameterized replaceable event or throws an error if the event isn't
   * a parameterized replaceable event.
   * @returns {string} the "d" tag of the event.
   */
  replaceableDTag() {
    if (this.kind && this.kind >= 3e4 && this.kind <= 4e4) {
      const dTag = this.getMatchingTags("d")[0];
      const dTagId = dTag ? dTag[1] : "";
      return dTagId;
    }
    throw new Error("Event is not a parameterized replaceable event");
  }
  /**
   * Provides a deduplication key for the event.
   *
   * For kinds 0, 3, 10k-20k this will be the event <kind>:<pubkey>
   * For kinds 30k-40k this will be the event <kind>:<pubkey>:<d-tag>
   * For all other kinds this will be the event id
   */
  deduplicationKey() {
    if (this.kind === 0 || this.kind === 3 || this.kind && this.kind >= 1e4 && this.kind < 2e4) {
      return `${this.kind}:${this.pubkey}`;
    } else {
      return this.tagId();
    }
  }
  /**
   * Returns the id of the event or, if it's a parameterized event, the generated id of the event using "d" tag, pubkey, and kind.
   * @returns {string} The id
   */
  tagId() {
    if (this.isParamReplaceable()) {
      return this.tagAddress();
    }
    return this.id;
  }
  /**
   * Returns the "reference" value ("<kind>:<author-pubkey>:<d-tag>") for this replaceable event.
   * @returns {string} The id
   */
  tagAddress() {
    if (!this.isParamReplaceable()) {
      throw new Error("This must only be called on replaceable events");
    }
    const dTagId = this.replaceableDTag();
    return `${this.kind}:${this.pubkey}:${dTagId}`;
  }
  /**
   * Determines the type of tag that can be used to reference this event from another event.
   * @returns {string} The tag type
   * @example
   * event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
   * event.tagType(); // "a"
   */
  tagType() {
    return this.isParamReplaceable() ? "a" : "e";
  }
  /**
   * Get the tag that can be used to reference this event from another event.
   *
   * Consider using referenceTags() instead (unless you have a good reason to use this)
   *
   * @example
   *     event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
   *     event.tagReference(); // ["a", "30000:pubkey:d-code"]
   *
   *     event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
   *     event.tagReference(); // ["e", "eventid"]
   * @returns {NDKTag} The NDKTag object referencing this event
   */
  tagReference(marker) {
    let tag;
    if (this.isParamReplaceable()) {
      tag = ["a", this.tagAddress()];
    } else {
      tag = ["e", this.tagId()];
    }
    if (this.relay) {
      tag.push(this.relay.url);
    } else {
      tag.push("");
    }
    if (marker) {
      tag.push(marker);
    }
    return tag;
  }
  /**
   * Get the tags that can be used to reference this event from another event
   * @param marker The marker to use in the tag
   * @param skipAuthorTag Whether to explicitly skip adding the author tag of the event
   * @param forceTag Force a specific tag to be used instead of the default "e" or "a" tag
   * @example
   *     event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
   *     event.referenceTags(); // [["a", "30000:pubkey:d-code"], ["e", "parent-id"]]
   *
   *     event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
   *     event.referenceTags(); // [["e", "parent-id"]]
   * @returns {NDKTag} The NDKTag object referencing this event
   */
  referenceTags(marker, skipAuthorTag, forceTag) {
    let tags = [];
    if (this.isParamReplaceable()) {
      tags = [
        [forceTag ?? "a", this.tagAddress()],
        [forceTag ?? "e", this.id]
      ];
    } else {
      tags = [[forceTag ?? "e", this.id]];
    }
    if (this.relay?.url) {
      tags = tags.map((tag) => {
        tag.push(this.relay?.url);
        return tag;
      });
    } else if (marker) {
      tags = tags.map((tag) => {
        tag.push("");
        return tag;
      });
    }
    if (marker) {
      tags.forEach((tag) => tag.push(marker));
    }
    if (!skipAuthorTag)
      tags.push(...this.author.referenceTags());
    return tags;
  }
  /**
   * Provides the filter that will return matching events for this event.
   *
   * @example
   *    event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
   *    event.filter(); // { "#a": ["30000:pubkey:d-code"] }
   * @example
   *    event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
   *    event.filter(); // { "#e": ["eventid"] }
   *
   * @returns The filter that will return matching events for this event
   */
  filter() {
    if (this.isParamReplaceable()) {
      return { "#a": [this.tagId()] };
    } else {
      return { "#e": [this.tagId()] };
    }
  }
  /**
   * Generates a deletion event of the current event
   *
   * @param reason The reason for the deletion
   * @param publish Whether to publish the deletion event automatically
   * @returns The deletion event
   */
  async delete(reason, publish = true) {
    if (!this.ndk)
      throw new Error("No NDK instance found");
    this.ndk.assertSigner();
    const e = new _NDKEvent(this.ndk, {
      kind: 5,
      content: reason || ""
    });
    e.tag(this);
    if (publish)
      await e.publish();
    return e;
  }
  /**
   * Fetch an event tagged with the given tag following relay hints if provided.
   * @param tag The tag to search for
   * @param marker The marker to use in the tag (e.g. "root")
   * @returns The fetched event or null if no event was found, undefined if no matching tag was found in the event
   * * @example
   * const replyEvent = await ndk.fetchEvent("nevent1qqs8x8vnycyha73grv380gmvlury4wtmx0nr9a5ds2dngqwgu87wn6gpzemhxue69uhhyetvv9ujuurjd9kkzmpwdejhgq3ql2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqz4cwjd")
   * const originalEvent = await replyEvent.fetchTaggedEvent("e", "reply");
   * console.log(replyEvent.encode() + " is a reply to event " + originalEvent?.encode());
   */
  fetchTaggedEvent = fetchTaggedEvent.bind(this);
  /**
   * Fetch the root event of the current event.
   * @returns The fetched root event or null if no event was found
   * @example
   * const replyEvent = await ndk.fetchEvent("nevent1qqs8x8vnycyha73grv380gmvlury4wtmx0nr9a5ds2dngqwgu87wn6gpzemhxue69uhhyetvv9ujuurjd9kkzmpwdejhgq3ql2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqz4cwjd")
   * const rootEvent = await replyEvent.fetchRootEvent();
   * console.log(replyEvent.encode() + " is a reply in the thread " + rootEvent?.encode());
   */
  fetchRootEvent = fetchRootEvent.bind(this);
  /**
   * Fetch the event the current event is replying to.
   * @returns The fetched reply event or null if no event was found
   */
  fetchReplyEvent = fetchReplyEvent.bind(this);
  /**
   * NIP-18 reposting event.
   *
   * @param publish Whether to publish the reposted event automatically @default true
   * @param signer The signer to use for signing the reposted event
   * @returns The reposted event
   *
   * @function
   */
  repost = repost.bind(this);
  /**
   * React to an existing event
   *
   * @param content The content of the reaction
   */
  async react(content, publish = true) {
    if (!this.ndk)
      throw new Error("No NDK instance found");
    this.ndk.assertSigner();
    const e = new _NDKEvent(this.ndk, {
      kind: 7,
      content
    });
    e.tag(this);
    if (publish) {
      await e.publish();
    } else {
      await e.sign();
    }
    return e;
  }
  /**
   * Checks whether the event is valid per underlying NIPs.
   *
   * This method is meant to be overridden by subclasses that implement specific NIPs
   * to allow the enforcement of NIP-specific validation rules.
   *
   * Otherwise, it will only check for basic event properties.
   *
   */
  get isValid() {
    return this.validate();
  }
};
var eventGeoCodedCallbackDefault = async (evs) => evs;
var fetchNearbyOptionDefaults = {
  maxPrecision: 9,
  minPrecision: 4,
  recurse: false,
  minResults: 5,
  callbackFilter: eventGeoCodedCallbackDefault
};
var NDKEventGeoCoded = class _NDKEventGeoCoded extends NDKEvent {
  static EARTH_RADIUS = 6371;
  // km
  static GEOHASH_PRECISION = 12;
  static BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  static geohashFilterFn = (tag) => tag[0] === "g" && (tag[2] === "gh" || tag[2] === "geohash" || tag.length === 2);
  //`g` tags with a length of 2 are NIP-52 geohashes
  _dd;
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    if (_NDKEventGeoCoded.isGeohash(this.geohash)) {
      this.dd = this.geohash;
    }
  }
  static from(event) {
    return new _NDKEventGeoCoded(event.ndk, event.rawEvent());
  }
  /**
   * Compares two geohashes and sorts them based on their length in descending order.
   * 
   * @param a - The first geohash to compare.
   * @param b - The second geohash to compare.
   * @returns A negative number if `b` is longer than `a`, a positive number if `a` is longer than `b`,
   *          or zero if they have the same length.
   * 
   * @static
   */
  static sortGeohashesFn(a, b) {
    return b.length - a.length;
  }
  /**
   * Generates a list of filterable geohashes from a given full geohash.
   * This method creates a set of progressively shorter prefixes of the provided geohash,
   * each representing a broader geographic area. This set can be used for filtering or
   * querying geospatial data structures and is sorted from the most specific (longest)
   * to the least specific (shortest).
   * 
   * @param fullGeohash - The full geohash string from which to generate filterable prefixes.
   * @returns An array of geohash strings, each a prefix of the full geohash, sorted by descending length.
   * 
   * @static
   */
  static generateFilterableGeohash(fullGeohash) {
    const geohashes = /* @__PURE__ */ new Set();
    const deref = String(fullGeohash);
    for (let i = String(fullGeohash).length; i > 0; i--) {
      const n = deref.substring(0, i);
      geohashes.add(n);
    }
    return Array.from(geohashes);
  }
  /**
   * Sets the geographical coordinates or geohash for the current instance, updating latitude, longitude, and geohash values accordingly.
   * If a geohash string is provided, it decodes it into latitude and longitude. If coordinates are provided, it sets those directly and
   * generates a corresponding geohash.
   * 
   * @param coords The coordinates or geohash string to set. Can be undefined to perform no operation.
   */
  set dd(coords) {
    if (!coords)
      return;
    if (typeof coords === "string") {
      this.geohash = coords;
      const { lat, lon } = _NDKEventGeoCoded.decodeGeohash(coords);
      this.lat = lat;
      this.lon = lon;
    } else if ("lat" in coords && "lon" in coords) {
      this.lat = coords.lat;
      this.lon = coords.lon;
      this.geohash = _NDKEventGeoCoded.encodeGeohash(coords);
    }
  }
  /**
   * Gets the current geographical coordinates (latitude and longitude) prioritizing direct coordinates if available.
   * If coordinates are not directly set but a geohash is available, it returns the decoded coordinates from the geohash.
   * 
   * @returns The current geographical coordinates as a DD object or undefined if neither coordinates nor geohash are set.
   */
  get dd() {
    if (typeof this.lat !== "undefined" && typeof this.lon !== "undefined") {
      return { lat: this.lat, lon: this.lon };
    }
    if (typeof this.geohash === "string") {
      this.dd = this.geohash;
      return this.dd;
    }
    return void 0;
  }
  /**
   * Sets the primary geohash for the current instance and updates the list of geohashes with varying precision based on this value.
   * This setter generates filterable geohashes from the provided value, sorts them by descending precision, and updates related class properties.
   * 
   * @param value The geohash to set as the primary geohash.
   */
  set geohash(value) {
    if (!_NDKEventGeoCoded.isGeohash(value))
      return;
    const geohashes = _NDKEventGeoCoded.generateFilterableGeohash(String(value)).sort(_NDKEventGeoCoded.sortGeohashesFn);
    this._updateGeohashTags(geohashes);
  }
  /**
   * Sets the list of geohashes for the current instance, ensuring no duplicates and updating related class properties accordingly.
   * This setter accepts an array of geohashes, deduplicates them, and updates the instance's state.
   * 
   * @param values An array of geohashes to set, potentially containing duplicates.
   */
  set geohashes(values) {
    values = values.filter(_NDKEventGeoCoded.isGeohash);
    this._removeGeoHashes();
    this._updateGeohashTags(Array.from(new Set(values)));
  }
  /**
   * Gets the current list of geohashes associated with the instance, sorted by descending precision.
   * 
   * @returns An array of geohashes sorted by descending precision.
   */
  get geohashes() {
    const tags = this.tags.filter(_NDKEventGeoCoded.geohashFilterFn).map((tag) => tag[1]).sort(_NDKEventGeoCoded.sortGeohashesFn);
    if (!tags.length)
      return void 0;
    return tags;
  }
  /**
   * Gets the the most precise geohash for the current instance, which is the first geohash in the list of geohashes sorted by descending precision.
   * 
   * @returns The primary (most precise) geohash if available, or undefined if no geohashes are set.
   */
  get geohash() {
    return this.geohashes?.[0];
  }
  get countryCode() {
    return this.tagValuesByMarker("g", "countryCode");
  }
  get countryCodeAlpha2() {
    return this.tagValueByKeyAndLength("countryCode", 2);
  }
  get countryCodeAlpha3() {
    return this.tagValueByKeyAndLength("countryCode", 3);
  }
  get countryCodeAlpha4() {
    return this.tagValueByKeyAndLength("countryCode", 4);
  }
  get countryCodeNumeric() {
    return this.tagValueByKeyAndIsNumber("countryCode");
  }
  get regionCodeAlpha2() {
    return this.tagValueByKeyAndLength("regionCode", 2);
  }
  get regionCodeNumeric() {
    return this.tagValueByKeyAndIsNumber("regionCode");
  }
  set countryCode(values) {
    this.removeTagByMarker("g", "countryCode");
    values.forEach((value) => {
      this._setGeoTag("countryCode", value);
    });
  }
  get countryName() {
    return this.tagValueByMarker("g", "countryName");
  }
  set countryName(value) {
    this._setGeoTag("countryName", value);
  }
  get regionCode() {
    return this.tagValueByMarker("g", "regionCode");
  }
  set regionCode(value) {
    this._setGeoTag("regionCode", value);
  }
  set regionName(value) {
    this._setGeoTag("regionName", value);
  }
  get regionName() {
    return this.tagValueByMarker("g", "regionName");
  }
  set continentName(value) {
    this._setGeoTag("continentName", value);
  }
  get continentName() {
    return this.tagValueByMarker("g", "continentName");
  }
  get geo() {
    return [...this.getMatchingTags("g")];
  }
  set geo(tags) {
    this.removeTag("g");
    tags.forEach((tag) => this.tags.push(tag));
  }
  set lat(value) {
    if (!this._dd)
      this._dd = { lat: 0, lon: 0 };
    this._dd.lat = value;
  }
  get lat() {
    return this._dd?.lat;
  }
  set lon(value) {
    if (!this._dd)
      this._dd = { lat: 0, lon: 0 };
    this._dd.lon = value;
  }
  get lon() {
    return this._dd?.lon;
  }
  /**
   * Retrieves all geo tags from the event's tags.
   * 
   * @returns the first geotag if available, otherwise undefined.
   */
  geoObject() {
    const result = {};
    if (this.lat)
      result.lat = this.lat;
    if (this.lon)
      result.lon = this.lon;
    if (this.geohash)
      result.geohash = this.geohash;
    if (this.geohashes)
      result._geohashes = this.geohashes;
    if (this.countryCode)
      result.countryCode = this.countryCode;
    if (this.countryName)
      result.countryName = this.countryName;
    if (this.regionCode)
      result.regionCode = this.regionCode;
    return result;
  }
  /**
   * Fetches events and sorts by distance with a given geohash
   * 
   * @param {NDK} ndk An NDK instance
   * @param {string} geohash The geohash that represents the location to search for relays.
   * @param {NDKFilter} filter An optional, additional filter to ammend to the default filter. 
   * @param {FetchNearbyRelayOptions} options An optional object containing options specific to fetchNearby
   * 
   * @returns Promise resolves to an array of `RelayListSet` objects.
   * 
   * @public
   */
  static async fetchNearby(ndk, geohash, filter, options) {
    const effectiveOptions = {
      ...fetchNearbyOptionDefaults,
      ...options
    };
    let { maxPrecision, minPrecision, minResults, recurse, callbackFilter } = effectiveOptions;
    let events = /* @__PURE__ */ new Set();
    try {
      maxPrecision = Math.min(maxPrecision, geohash.length);
      minPrecision = Math.min(minPrecision, geohash.length);
      const fetchEventsRecursive = async (minPrecision2, maxPrecision2) => {
        if (minPrecision2 < 1 || events.size >= minResults)
          return;
        const geohashes = Array.from({ length: maxPrecision2 - minPrecision2 + 1 }, (_, i) => geohash.slice(0, maxPrecision2 - i));
        const _filter = { ...filter, "#g": geohashes };
        const fetchedEvents = await ndk.fetchEvents(_filter);
        fetchedEvents.forEach((event) => events.add(event));
        if (callbackFilter)
          events = await callbackFilter(events);
        if (recurse && events.size < minResults) {
          await fetchEventsRecursive(minPrecision2 - 1, minPrecision2 - 1);
        }
      };
      await fetchEventsRecursive(minPrecision, maxPrecision);
      if (events.size) {
        events = /* @__PURE__ */ new Set([..._NDKEventGeoCoded.sortGeospatial(geohash, events)]);
      }
      return events;
    } catch (error) {
      console.error(`fetchNearby: Error: ${error}`);
      return events;
    }
  }
  /**
   * Sorts an array of `NDKEventGeoCoded` instances based on their distance from a given latitude and longitude.
   * 
   * @param {Coords} coords An object containing the reference latitude (`lat`) and longitude (`lon`) or a geohash.
   * @param {NDKEventGeoCoded[]} geoCodedEvents An array of `NDKEventGeoCoded` instances to be sorted.
   * @param {boolean} asc Determines the sort order. `true` for ascending (default), `false` for descending.
   * @returns A sorted array of `NDKEventGeoCoded` instances.
   * @throws {Error} If the latitude or longitude is not a finite number.
   */
  static sortGeospatial = (coords, geoCodedEvents, asc = true) => {
    const events = Array.from(geoCodedEvents);
    const { lat, lon } = _NDKEventGeoCoded.parseCoords(coords);
    if (isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon))
      throw new Error("(lat) and (lon), respectively, must be numbers and finite.");
    events.sort((a, b) => {
      if (!a?.lat || !a?.lon || !b?.lat || !b?.lon)
        return 0;
      const distanceA = _NDKEventGeoCoded.distance({ lat, lon }, { lat: a.lat, lon: a.lon });
      const distanceB = _NDKEventGeoCoded.distance({ lat, lon }, { lat: b.lat, lon: b.lon });
      return asc ? distanceA - distanceB : distanceB - distanceA;
    });
    return new Set(events);
  };
  /**
   * Encodes latitude and longitude into a geohash string.
   * 
   * @param {Coords} coords The latitude to encode.
   * @param {number} precision The desired precision of the geohash (length of the geohash string).
   * @returns {string} The encoded geohash string.
   */
  static encodeGeohash(coords, precision = this.GEOHASH_PRECISION) {
    const { lat: latitude, lon: longitude } = _NDKEventGeoCoded.parseCoords(coords);
    let isEven = true;
    const latR = [-90, 90];
    const lonR = [-180, 180];
    let bit = 0;
    let ch = 0;
    let geohash = "";
    while (geohash.length < precision) {
      let mid;
      if (isEven) {
        mid = (lonR[0] + lonR[1]) / 2;
        if (longitude > mid) {
          ch |= 1 << 4 - bit;
          lonR[0] = mid;
        } else {
          lonR[1] = mid;
        }
      } else {
        mid = (latR[0] + latR[1]) / 2;
        if (latitude > mid) {
          ch |= 1 << 4 - bit;
          latR[0] = mid;
        } else {
          latR[1] = mid;
        }
      }
      isEven = !isEven;
      if (bit < 4) {
        bit++;
      } else {
        geohash += _NDKEventGeoCoded.BASE32.charAt(ch);
        bit = 0;
        ch = 0;
      }
    }
    return geohash;
  }
  /**
   * Decodes a geohash string into its latitude and longitude representation.
   * 
   * @param {string} hashString The geohash string to decode.
   * @returns An object containing the decoded latitude (`lat`) and longitude (`lon`).
   */
  static decodeGeohash(hashString2) {
    let isEven = true;
    const latR = [-90, 90];
    const lonR = [-180, 180];
    for (let i = 0; i < hashString2.length; i++) {
      const char = hashString2.charAt(i).toLowerCase();
      const charIndex = _NDKEventGeoCoded.BASE32.indexOf(char);
      for (let j = 0; j < 5; j++) {
        const mask = 1 << 4 - j;
        if (isEven) {
          _NDKEventGeoCoded.decodeIntRefine(lonR, charIndex, mask);
        } else {
          _NDKEventGeoCoded.decodeIntRefine(latR, charIndex, mask);
        }
        isEven = !isEven;
      }
    }
    const lat = (latR[0] + latR[1]) / 2;
    const lon = (lonR[0] + lonR[1]) / 2;
    return { lat, lon };
  }
  /**
   * Checks if a string is a valid geohash.
   * 
   * @param {string} str The string to check.
   * @returns {boolean} True if the string is a valid geohash, false otherwise.
   */
  static isGeohash(str) {
    if (!str || str === "")
      return false;
    str = str.toLowerCase();
    for (let i = 0; i < str.length; i++) {
      if (_NDKEventGeoCoded.BASE32.indexOf(str.charAt(i)) === -1) {
        return false;
      }
    }
    return true;
  }
  /**
   * Calculates the great-circle distance between two points on the Earth's surface given their latitudes and longitudes.
   * This method is a helper for calculating distances using the Haversine formula.
   * 
   * @param {Coords} coords1 The DD or geohash of the first point
   * @param {Coords} coords2 The DD or geohash of the second point.
   * @returns {number} The distance between the two points in kilometers.
   * @public
   * @static
   */
  static distance(coords1, coords2) {
    const { lat: lat1, lon: lon1 } = _NDKEventGeoCoded.parseCoords(coords1);
    const { lat: lat2, lon: lon2 } = _NDKEventGeoCoded.parseCoords(coords2);
    const radius = this.EARTH_RADIUS;
    const latDeg = _NDKEventGeoCoded.toRadians(lat2 - lat1);
    const lonDeg = _NDKEventGeoCoded.toRadians(lon2 - lon1);
    const angle = Math.sin(latDeg / 2) * Math.sin(latDeg / 2) + Math.cos(_NDKEventGeoCoded.toRadians(lat1)) * Math.cos(_NDKEventGeoCoded.toRadians(lat2)) * Math.sin(lonDeg / 2) * Math.sin(lonDeg / 2);
    return radius * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
  }
  /**
   * Parses a Coords object, potentially a geohash, into a DD object
   * 
   * @param {Coords} coords 
   * @returns A DD object
   */
  static parseCoords = (coords) => {
    return typeof coords === "string" ? _NDKEventGeoCoded.decodeGeohash(coords) : coords;
  };
  /**
   * Converts an angle from degrees to radians.
   * 
   * @param {number} degrees The angle in degrees.
   * @returns {number} The angle in radians.
   * @public
   * @static
   */
  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  /**
   * Refines the search interval for a geohash decoding process based on a character from the geohash.
   * This method is part of the geohash decoding process, refining the latitude or longitude range.
   * 
   * @param {number[]} range The current range (latitude or longitude) being refined.
   * @param {number} charIndex The index of the character in the base32 string.
   * @param {number} bitMask The bitmask to apply for refining the range.
   */
  static decodeIntRefine(range, charIndex, bitMask) {
    const mid = (range[0] + range[1]) / 2;
    if ((charIndex & bitMask) > 0) {
      range[0] = mid;
    } else {
      range[1] = mid;
    }
  }
  /**
   * Removes tags by marker (the value at last position in the tag array).
   * 
   * @param key The key to identify which tags to remove.
   */
  removeTagByMarker(key, marker) {
    this.tags = this.tags.filter((tag) => !(tag[0] === key && tag[tag.length - 1] === marker));
  }
  /**
   * Helper method to find a tag by its marker and length of its value.
   * 
   * @param key The key to identify which tag value to find.
   * @return The first value associated with the key, or undefined if not found.
   */
  tagValueByKeyAndLength(key, length) {
    return this.tags.find((tag) => tag[2] === key && tag[1].length === length)?.[1];
  }
  /**
   * Helper method to find a tag by its marker and potential type of its value
   * 
   * @param key The key to identify which tag value to find.
   * @return The first value associated with the key, or undefined if not found.
   */
  tagValueByKeyAndIsNumber(key) {
    const candidates = this.tags.filter((tag) => tag[2] === key);
    return candidates.find((tag) => !isNaN(Number(tag[1])))?.[1];
  }
  /**
   * Helper method to find the first tag value by its marker.
   * 
   * @param key The key to identify which tag value to find.
   * @return The first value associated with the key, or undefined if not found.
   */
  tagValueByMarker(key, marker) {
    const tag = this.tags.find((tag2) => tag2[0] === key && tag2[tag2.length - 1] === marker);
    return tag ? tag[1] : void 0;
  }
  /**
   * Helper method to find all tags by marker
   * 
   * @param key The key to identify which tag value to find.
   * @return The first value associated with the key, or undefined if not found.
   */
  tagValuesByMarker(key, marker) {
    const tags = this.tags.filter((tag) => tag[0] === key && tag[tag.length - 1] === marker).map((tag) => tag[1]).flat();
    return tags?.length ? tags : void 0;
  }
  /**
   * Retrieves tags that are indexed, identified by having their first element's length equal to 1.
   * 
   * @returns An array of NDKTag, filtered to include only indexed tags.
   * 
   * @protected
   */
  get indexedTags() {
    return this.tags.filter((tag) => tag[0].length === 1);
  }
  /**
   * Adds a geo tags to the event's tags, updating or removing existing tags as necessary.
   * This method manages the insertion of geospatial information tags ('g') into the event's tag array.
   * 
   * @param {string} key The geospatial information key (e.g., "lat", "lon", "countryCode").
   * @param {string} value The value associated with the key.
   * @private
   */
  _setGeoTag(key, value) {
    this.removeTagByMarker("g", key);
    this.tags.push(["g", value, key]);
  }
  /**
   * Removes geohash tags ('gh') from the event's tags, cleaning up the tag array from geohash (gh) tags.
   * Additionally, It filters out legacy 'g' tags that represent NIP-52 geohashes, maintaining other geospatial tags intact.
   * 
   * @private
   */
  _removeGeoHashes() {
    this.tags = this.tags.filter((tag) => !_NDKEventGeoCoded.geohashFilterFn(tag));
  }
  /**
   * Updates the geohashes and corresponding tags for this instance.
   * 
   * This method is responsible for updating the internal tags to reflect a new set of geohashes. It first
   * removes any existing geohash-related tags, then adds a generic tag indicating the presence of geohash data
   * followed by individual tags for each geohash in the provided array.
   * 
   * @param geohashes - An array of geohash strings to be updated in the tags.
   * 
   * @private
   */
  _updateGeohashTags(geohashes) {
    this._removeGeoHashes();
    geohashes.forEach((gh) => {
      this.tags.push(["g", gh]);
    });
  }
};
var NDKRelayDiscovery = class _RelayDiscovery extends NDKEventGeoCoded {
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 30166;
  }
  static from(event) {
    return new _RelayDiscovery(event.ndk, event.rawEvent());
  }
  get url() {
    return this.tagValue("d");
  }
  set url(value) {
    this.removeTag("d");
    if (value) {
      this.tags.push(["d", value]);
    }
  }
  get network() {
    return this.tagValue("n");
  }
  set network(value) {
    this.removeTag("n");
    if (value) {
      this.tags.push(["n", value]);
    }
  }
  get nips() {
    return this.tags.filter((tag) => tag[0] === "N").map((tag) => parseInt(tag[1]));
  }
  set nips(values) {
    this.removeTag("N");
    values.forEach((value) => {
      this.tags.push(["N", String(value)]);
    });
  }
  get restrictions() {
    return this.tags.filter((tag) => tag[0] === "R").map((tag) => tag[1]);
  }
  set restrictions(values) {
    this.removeTag("R");
    values.forEach((value) => {
      this.tags.push(["R", value]);
    });
  }
  get software() {
    return this.tagValue("s");
  }
  set software(value) {
    this.removeTag("s");
    if (value) {
      this.tags.push(["s", value]);
    }
  }
};
var REGEX_IPV4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
var REGEX_GEOHASH = /^[0-9b-hjkmnp-z]{1,12}$/;
var NDKRelayMeta = class _RelayMeta extends NDKEvent {
  static groups = ["other", "rtt", "nip11", "dns", "geo", "ssl", "counts"];
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 30066;
  }
  static from(event) {
    return new _RelayMeta(event.ndk, event.rawEvent());
  }
  get url() {
    return this.tagValue("d");
  }
  set url(value) {
    this.removeTag("d");
    if (value) {
      this.tags.push(["d", value]);
    }
  }
  get other() {
    return this.getGroupedTag("other");
  }
  set other(values) {
    this.setGroupedTag("other", values);
  }
  get rtt() {
    return this.getGroupedTag("rtt");
  }
  set rtt(values) {
    this.setGroupedTag("rtt", values);
  }
  get nip11() {
    return this.getGroupedTag("nip11");
  }
  set nip11(values) {
    this.setGroupedTag("nip11", values);
  }
  get dns() {
    return this.getGroupedTag("dns");
  }
  set dns(values) {
    this.setGroupedTag("dns", values);
  }
  get geo() {
    return this.getGroupedTag("geo");
  }
  set geo(values) {
    this.setGroupedTag("geo", values);
  }
  get ssl() {
    return this.getGroupedTag("ssl");
  }
  set ssl(values) {
    this.setGroupedTag("ssl", values);
  }
  get counts() {
    return this.getGroupedTag("counts");
  }
  set counts(values) {
    this.setGroupedTag("counts", values);
  }
  /**
   * Retrieves all metadata grouped by their respective key.
   * 
   * @returns An object where each key is a metadata category (e.g., 'rtt', 'nip11', 'dns', 'geo', 'ssl', 'counts'), and the value is the parsed metadata for that category.
   */
  get all() {
    const result = {};
    _RelayMeta.groups.forEach((group) => {
      const data = this.getGroupedTag(group);
      if (data) {
        result[group] = data;
      }
    });
    return result;
  }
  /**
   * Groups tags by a specific group and parses their values.
   * 
   * @param group The key sto group tags by.
   * @returns An object where each key is a tag within the specified group and its value is either a single metadata value or an array of metadata values, all cast to their appropriate types.
   * 
   * @private
   */
  getGroupedTag(group) {
    const tags = this.tags.filter((tag) => tag[0] === group);
    const data = {};
    tags.forEach((_tag) => {
      const tag = [..._tag];
      tag.shift();
      const [key, ...values] = tag;
      if (!data?.[key]) {
        data[key] = values.length === 1 ? this.castValue(values[0]) : values.map((v) => this.castValue(v));
      } else {
        data[key] = [...values.map((v) => this.castValue(v, key))];
      }
    });
    Object.keys(data).forEach((key) => {
      if (typeof data[key] === "undefined") {
        delete data[key];
      }
    });
    return data;
  }
  /**
   * Sets or updates tags grouped by a specific group with provided values.
   * 
   * @param group The category of the tags to set or update.
   * @param values An object where keys represent the tag names within the group, and the values are the data to be set for those tags.
   * 
   * @private
   */
  setGroupedTag(group, values) {
    this.removeTag(group);
    Object.entries(values).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((val) => this.tags.push([group, key, String(val)]));
      } else {
        this.tags.push([group, key, String(value)]);
      }
    });
  }
  /**
   * Casts a tag value to its appropriate type based on its content and optionally a key.
   * 
   * @param value The string value of the tag to cast.
   * @param key Optionally, the key associated with the value, which may influence the casting (e.g., 'geohash').
   * @returns The value cast to either a boolean, number, or string, or left as undefined if it cannot be reliably cast.
   * 
   * @private
   */
  castValue(value, key) {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
    if (REGEX_IPV4.test(value)) {
      return value;
    }
    const maybeGeohash = REGEX_GEOHASH.test(value);
    if (key === "geohash") {
      if (!maybeGeohash) {
        return void 0;
      }
      return value;
    }
    const asFloat = parseFloat(value);
    if (!isNaN(asFloat) && isFinite(asFloat) && String(asFloat) === value) {
      return asFloat;
    }
    return value;
  }
};
createDebug("ndk:zap");
createDebug("ndk:active-user");
(class extends Error {
  static {
    this.prototype.name = "FetchTillEoseFailedSignal";
  }
});
(class extends Error {
  static {
    this.prototype.name = "FetchTillEoseAbortedSignal";
  }
});
if (is_node()) globalThis.WebSocket ??= import2("ws");
var ISO3166Type = /* @__PURE__ */ ((ISO3166Type2) => {
  ISO3166Type2["CountryCode"] = "countryCode";
  ISO3166Type2["RegionCode"] = "regionCode";
  return ISO3166Type2;
})(ISO3166Type || {});
var ISO3166Format = /* @__PURE__ */ ((ISO3166Format2) => {
  ISO3166Format2["Alpha"] = "alpha";
  ISO3166Format2["Numeric"] = "numeric";
  return ISO3166Format2;
})(ISO3166Format || {});
const extractGeoCodesFromRelayMeta = (event, type) => {
  return event.tags.filter((tag) => tag[0] === "geo" && tag[1] === type).map((tag) => tag[2]);
};
const extractGeoCodesFromRelayDiscovery = (event, type) => {
  return event.tags.filter((tag) => tag[0] === "G" && tag[2] === type).map((tag) => tag[1]);
};
const extractGeoCodes = (event) => {
  let countryCode = [];
  let regionCode = [];
  if (event.kind === NDKKind.RelayMeta) {
    countryCode = extractGeoCodesFromRelayMeta(event, ISO3166Type.CountryCode);
    regionCode = extractGeoCodesFromRelayMeta(event, ISO3166Type.RegionCode);
  }
  if (event.kind === NDKKind.RelayDiscovery) {
    countryCode = extractGeoCodesFromRelayDiscovery(event, ISO3166Type.CountryCode);
    regionCode = extractGeoCodesFromRelayDiscovery(event, ISO3166Type.RegionCode);
  }
  return { countryCode, regionCode };
};
const parseGeocode = (type, code) => {
  const isNumeric = !isNaN(Number(code));
  const ignoreLength = type === ISO3166Type.RegionCode ? true : isNumeric;
  return {
    code,
    type,
    format: isNumeric ? ISO3166Format.Numeric : ISO3166Format.Alpha,
    length: ignoreLength ? -1 : code.length
  };
};
const parseGeocodes = (codes, type) => {
  const geocodeEntries = [];
  if (codes === "string") codes = [codes];
  if (!codes) return;
  codes.forEach((code) => {
    geocodeEntries.push(parseGeocode(type, code));
  });
  return geocodeEntries;
};
const geocodeTransform = (event) => {
  const codes = extractGeoCodes(event);
  const cc = parseGeocodes(codes.countryCode, ISO3166Type.CountryCode);
  const rc = parseGeocodes(codes.regionCode, ISO3166Type.RegionCode);
  const res = [];
  if (cc) res.push(...cc);
  if (rc) res.push(...rc);
  return res;
};
const hashString = async (input) => {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return hashHex;
  } else if (typeof require === "function") {
    const crypto2 = require("crypto");
    return crypto2.createHash("sha256").update(input, "utf8").digest("hex");
  } else {
    throw new Error("Environment not supported");
  }
};
const relayMetaToICheck = ($event) => {
  const { pubkey, created_at } = $event;
  let parsedJson = $event.all;
  if (!parsedJson) parsedJson = {};
  const hasGeo = parsedJson?.geo?.countryCode || parsedJson?.geo?.countryName;
  if (!$event) return {};
  parsedJson.id = $event.id;
  parsedJson.created_at = created_at;
  parsedJson.pubkey = pubkey;
  if ($event && hasGeo)
    parsedJson.geocode = $event.tags.filter((tag) => tag[1] === "regionCode" || tag[1] === "countryCode").map((tag) => tag[2]);
  const checkMapping = {
    "id": "nid",
    "pubkey": "monitorPubkey",
    "nip11.pubkey": "operatorPubkey",
    "other.network": "network",
    "rtt.open": "open",
    "rtt.read": "read",
    "rtt.write": "write",
    "geo.geohash": "geohash",
    "geocode": "geocode",
    "ssl.valid_to": "validTo",
    "ssl.issuer": "issuer",
    "dns.ipv4": "ipv4",
    "dns.ipv6": "ipv6",
    "dns.isp": "isp",
    "nip11.supported_nips": "supportedNips",
    "nip11.payment_required": "paymentRequired",
    "nip11.auth_required": "authRequired",
    "nip11.software": "software",
    "nip11.version": "version",
    "created_at": "createdAt"
  };
  const relayCheck = merge(parsedJson, checkMapping);
  relayCheck.authRequired = relayCheck.authRequired ? 1 : 0;
  relayCheck.paymentRequired = relayCheck.paymentRequired ? 1 : 0;
  relayCheck.relay = $event.url;
  return { ...RelayDb.defaults(), ...relayCheck };
};
const relayMetaToIRelay = ($event) => {
  const { pubkey, created_at: lastSeen, url: relay } = $event;
  const irelay = {
    relay,
    lastSeen,
    network: $event.all?.other?.network
  };
  return { ...RelayDb.defaults(), ...irelay };
};
const relayMetaToIEvent = ($event) => {
  const { pubkey: monitorPubkey2, created_at, id: nid, url: relay, kind: maybeKind } = $event;
  const createdAt = created_at;
  const event = {
    nid,
    kind: maybeKind,
    monitorPubkey: monitorPubkey2,
    relay,
    createdAt,
    event: $event.rawEvent()
  };
  return { ...RelayDb.defaults(), ...event };
};
const relayMetaToNip11 = ($event) => {
  const { url, pubkey: monitorPubkey2, id: nid, created_at: createdAt } = $event;
  if (!createdAt) return;
  let json;
  try {
    json = JSON.parse($event.content);
  } catch (e) {
    return void 0;
  }
  if (!json || !(Object.keys(json)?.length > 0)) return void 0;
  let hash = null;
  hash = hashObject(json);
  const inip11 = {
    relay: url,
    nid,
    monitorPubkey: monitorPubkey2,
    createdAt,
    hash,
    json
  };
  return { ...RelayDb.defaults(), ...inip11 };
};
const relayMetaToSsl = async ($event) => {
  const { url: relay, pubkey: monitorPubkey2 } = $event;
  const cert = $event.tags.find((tag) => tag[1] === "pem_encoded")?.[2];
  if (!cert || !relay) return void 0;
  const hash = await hashString(cert);
  const ssl = {
    relay,
    monitorPubkey: monitorPubkey2,
    hash,
    cert
  };
  return ssl;
};
const nip66ToIGeoCodes = ($event) => {
  const codes = geocodeTransform($event);
  return codes;
};
const relayMetaToIdb = async ($event) => {
  const res = {};
  const check = relayMetaToICheck($event);
  const relay = relayMetaToIRelay($event);
  const event = relayMetaToIEvent($event);
  const nip11 = relayMetaToNip11($event);
  const geocodes = nip66ToIGeoCodes($event);
  const ssl = await relayMetaToSsl($event);
  if (check) res.check = check;
  if (relay) res.relay = relay;
  if (event) res.event = event;
  if (nip11) res.nip11 = nip11;
  if (geocodes) res.geocodes = geocodes;
  if (ssl) res.ssl = ssl;
  return res;
};
const relayDiscoveryToIdb = async ($event) => {
  const res = {};
  const geocodes = nip66ToIGeoCodes($event);
  if (geocodes) res.geocodes = geocodes;
  return res;
};
const transform = async (nostrEvent) => {
  const $event = nostrEvent.kind === NDKKind.RelayMeta ? new NDKRelayMeta(void 0, nostrEvent) : new NDKRelayDiscovery(void 0, nostrEvent);
  let res = {};
  if ($event.kind === NDKKind.RelayMeta) {
    res = await relayMetaToIdb($event);
  }
  if ($event.kind === NDKKind.RelayDiscovery) {
    res = await relayDiscoveryToIdb($event);
  }
  return res;
};
const devnull = () => {
};
class RelayDb extends Dexie {
  constructor() {
    super(RelayDb.NAME);
    this.VERSION = 1;
    try {
      this.version(this.VERSION).stores(RelayDb.indices);
    } catch (error) {
      console.error("Error setting up the database schema:", error);
      Object.entries(RelayDb.indices).forEach(([table, index]) => {
        try {
          this.version(this.VERSION).stores({ [table]: index });
        } catch (innerError) {
          console.error(`Error setting up index for table "${table}" with index "${index}":`, innerError);
        }
      });
    }
    this.open().then(() => {
      console.log("Database opened successfully");
      console.log("Tables:", this.tables.map((table) => table.name));
    }).catch((err) => {
      console.error("Failed to open db: " + err.stack || err);
    });
    this.use({
      stack: "dbcore",
      create: (downlevelDatabase) => {
        return {
          ...downlevelDatabase,
          table: (name) => {
            const downlevelTable = downlevelDatabase.table(name);
            return {
              ...downlevelTable,
              mutate: async (req) => {
                const result = await downlevelTable.mutate(req);
                await this.afterMutate(name, req);
                return result;
              }
            };
          }
        };
      }
    });
  }
  static {
    this.NAME = "RelayDb";
  }
  static {
    this.indices = {
      relays: `&relay, lastSeen, score`,
      checks: `&nid, 
            [relay+monitorPubkey], [software+version], 
            relay, monitorPubkey, operatorPubkey,
            network, category,
            open, read, write,
            geohash, paymentRequired, authRequired,
            validTo, issuer,
            ipv4, ipv6, isp,
            *geocode, *supportedNips,
            createdAt`,
      pastChecks: `&nid, [relay+monitorPubkey], 
                    monitorPubkey, operatorPubkey, 
                    createdAt`,
      nip11s: `[relay+monitorPubkey], hash, relay, nid, json`,
      events: `nid, relay, monitorPubkey, kind, createdAt`,
      geocodes: `code, [type+format+type+length], [type+format+type],[type+format], type, format, length`,
      ssls: `relay, monitorPubkey, hash, nid`
      // globalRtts: `&relay, *monitorPubkeys, operatorPubkey, 
      //                 avgAll, avgOpen, avgRead, avgWrite, 
      //                 createdAt`
    };
  }
  static defaults() {
    const defaultObject = {};
    Object.keys(defaultObject).forEach((key) => {
      defaultObject[key] = null;
    });
    return defaultObject;
  }
  async afterMutate(tableName, req) {
    try {
      if (tableName === "events") {
        await this.handleEventsMutate(req);
      }
      if (tableName === "checks") {
        await this.handleChecksMutate(req);
      }
      if (tableName === "relays") {
        await this.handleRelaysMutate(req);
      }
    } catch (error) {
      console.error(`Error in afterMutate for table ${tableName}:`, error);
    }
  }
  async handleEventsMutate(req) {
    if (req.type === "add" || req.type === "put") {
      for (const event of req.values) {
        const { event: nostrEvent } = event;
        const { check, relay, nip11, geocodes, ssl } = await transform(nostrEvent);
        Dexie.waitFor(async () => {
          const promises = [];
          if (relay) promises.push(this.relays.put(relay));
          if (check) promises.push(this.checks.put(check));
          if (nip11) promises.push(this.nip11s.put(nip11));
          if (geocodes?.length) promises.push(this.geocodes.bulkPut(geocodes).catch(devnull));
          if (ssl) promises.push(this.ssls.put(ssl));
          await Promise.all(promises);
        });
      }
    }
    if (req.type === "delete") {
      for (const key of req.keys) {
        const oldEvent = await this.events.get(key);
        if (!oldEvent) return;
        const { event: nostrEvent } = oldEvent;
        const { check } = await transform(nostrEvent);
        Dexie.waitFor(async () => {
          const promises = [];
          if (check) {
            const { nid } = check;
            promises.push(this.checks.delete(nid));
            promises.push(this.pastChecks.delete(nid));
          }
          await Promise.all(promises);
        });
      }
    }
  }
  async handleRelaysMutate(req) {
    if (req.type === "add" || req.type === "put") {
      for (const relay of req.values) {
        const { relay: relayKey, lastSeen } = relay;
        const transaction = Dexie.currentTransaction;
        if (transaction) {
          transaction.on("complete", async () => {
            const existingRelay = await this.relays.get(relayKey);
            if (existingRelay && existingRelay.lastSeen < lastSeen) {
              await this.relays.where({ relay: relayKey }).modify({ lastSeen });
            }
          });
        } else {
          console.error("No current transaction found for handleRelaysMutate");
        }
      }
    }
    if (req.type === "delete") {
      const transaction = Dexie.currentTransaction;
      if (transaction) {
        transaction.on("complete", async () => {
          for (const key of req.keys) {
            const promises = [];
            promises.push(this.checks.where({ relay: key }).delete());
            promises.push(this.pastChecks.where({ relay: key }).delete());
            promises.push(this.globalRtts.where({ relay: key }).delete());
            promises.push(this.events.where({ relay: key }).delete());
            await Promise.all(promises);
          }
        });
      } else {
        console.error("No current transaction found for handleRelaysMutate delete");
      }
    }
  }
  async handleChecksMutate(req) {
    if (req.type === "add" || req.type === "put") {
      for (const check of req.values) {
        const transaction = Dexie.currentTransaction;
        if (transaction) {
          transaction.on("complete", async () => {
            const { createdAt: lastSeen, relay, monitorPubkey: monitorPubkey2, nid } = check;
            const lastSeenExisting = (await this.relays.get(relay))?.lastSeen;
            if (lastSeenExisting && lastSeen > lastSeenExisting) await this.relays.where({ relay }).modify({ lastSeen });
            const checksToProcess = await this.checks.where({ relay, monitorPubkey: monitorPubkey2 }).and((existingCheck) => existingCheck.nid !== check.nid).toArray();
            await Promise.all(
              checksToProcess.map(async (existingCheck) => {
                await this.pastChecks.put(existingCheck);
                await this.checks.delete(existingCheck.nid);
              })
            );
          });
        } else {
          console.error("No current transaction found for handleChecksMutate");
        }
      }
    }
    if (req.type === "delete") {
      const transaction = Dexie.currentTransaction;
      if (transaction) {
        transaction.on("complete", async () => {
          for (const key of req.keys) {
            const oldCheck = await this.checks.get(key);
            if (!oldCheck) return;
            await this.pastChecks.put(oldCheck);
          }
        });
      } else {
        console.error("No current transaction found for handleChecksMutate delete");
      }
    }
  }
}
const db = new RelayDb();
db.open();
const relayDb = db;
class MonitorDb extends Dexie {
  constructor() {
    super("MonitorDb");
    this.version(1).stores({
      monitors: "&monitorPubkey, *checks, *kinds, geohash, *geocode, isActive, last_active"
    });
    this.hooks();
  }
  hooks() {
  }
}
new MonitorDb();
const queueContextKey = Symbol("queueContext");
const monitorPubkey = "abcde937081142db0d50d29bf92792d4ee9b3d79a83c483453171a6004711832";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $monitorRelays, $$unsubscribe_monitorRelays;
  getContext(queueContextKey);
  const monitorRelays = liveQuery(() => relayDb.checks.where({ monitorPubkey }).toArray());
  $$unsubscribe_monitorRelays = subscribe(monitorRelays, (value) => $monitorRelays = value);
  $$unsubscribe_monitorRelays();
  return `<main> <table>${each($monitorRelays || [], (relay) => {
    return `<tr><td>${escape(relay.relay)}</td> <td data-svelte-h="svelte-17eb83f"></td> <td>${escape(relay.geocode?.filter((code) => isNaN(Number(code)) && code.length === 2) || "")}</td> <td>${escape(relay.open)}ms</td> <td>${escape(relay.geohash || "")}</td> <td>${escape(relay.software || "")}</td> <td>${escape(relay.version || "")}</td> </tr>`;
  })}</table></main>`;
});
export {
  Page as default
};

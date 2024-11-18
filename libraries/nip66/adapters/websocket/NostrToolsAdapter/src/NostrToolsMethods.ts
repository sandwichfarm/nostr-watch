import { IWebsocketAdapterMethods, IWebsocketAdapterCallbacks } from '@nostrwatch/nip66/core'
import { IEvent } from '@nostrwatch/nip66/interfaces';

import { NostrEvent, NostrFetcher, type FetchFilter } from 'nostr-fetch';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools-v2'
import { SimplePool } from 'nostr-tools';
import type { Filter } from 'nostr-tools';
import { isForInStatement } from 'typescript';
import { SubCloser } from 'nostr-tools/abstract-pool';
import { defaultWebsocketAdapterOptions, defaultWebsocketRequestBody, WebsocketAdapterResult, WebsocketAdapterOptions, WebsocketRequestBody } from 'node_modules/@nostrwatch/nip66/src/core';


export interface NostrToolsSubscribeParams {
  relays?: Set<string>
  filters: Filter[] | Filter
  stream?: boolean 
  keepAlive?: boolean
  callbacks?: SubscribeHandlers
  signal?: AbortSignal
}

const nostrToolsSubscribeParams: NostrToolsSubscribeParams = {
  filters: [],
  stream: true
}

export interface SubscribeHandlers {
  onevent?: (event: any) => void
  oneose?: () => void
  onclose?: () => void
}

export class NostrToolsMethods implements IWebsocketAdapterMethods {
  protected relays?: string[];
  protected _pool?: SimplePool;
  protected _fetcher?: NostrFetcher;
  protected subs: Map<string, any> = new Map();
  protected _callbacks?: IWebsocketAdapterCallbacks = {};
  protected _salt: string = 'nip66'
  protected _controller: AbortController = new AbortController();
  protected _signal: AbortSignal = this._controller.signal;
  protected _signalIsInternal: boolean = true;  

  
}
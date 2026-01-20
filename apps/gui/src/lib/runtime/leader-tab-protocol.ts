import type { IEvent } from '@nostrwatch/route66/models';
import type { WebsocketRequestBody } from '@nostrwatch/route66/core';
import type { LeaderTabSnapshot, LeaderTabSnapshotOptions } from './leader-tab-snapshot';

export const LEADER_TAB_RPC_CHANNEL = 'nostrwatch:route66:leader-tab-rpc:v1';
export const LEADER_TAB_PROTOCOL_VERSION = 1 as const;

export type LeaderTabProtocolVersion = typeof LEADER_TAB_PROTOCOL_VERSION;

export type LeaderTabHello = {
  termId: string;
  serverId: string;
  now: number;
};

export type LeaderTabSnapshotResponse = LeaderTabHello & LeaderTabSnapshot;

export type LeaderTabRpcOpMap = {
  'sys.hello': { args: []; result: LeaderTabHello };
  'sys.snapshot': { args: [LeaderTabSnapshotOptions?]; result: LeaderTabSnapshotResponse };

  'cache.REQ': { args: [any[]]; result: IEvent[] };
  'cache.COUNT': { args: [any[]]; result: number };
  'cache.DELETE': { args: [any[]]; result: string[] };
  'cache.DUMP': { args: []; result: Uint8Array };
  'cache.CLOSE': { args: [string]; result: boolean };
  'cache.WIPE': { args: []; result: boolean };
  'cache.addEvent': { args: [IEvent]; result: void };
  'cache.addEvents': { args: [IEvent[]]; result: void };
  'cache.putEvent': { args: [IEvent]; result: void };
  'cache.upsertNip11': { args: [string, any]; result: void };
  'cache.batchUpsertNip11': { args: [{ relay: string; nip11: any }[]]; result: boolean };
  'cache.countNip11s': { args: []; result: number };
  'cache.countUniqueNip11s': { args: []; result: number };
  'cache.getNip11': { args: [any]; result: any };

  'ws.publish': { args: [Partial<WebsocketRequestBody>]; result: boolean };
  'ws.subscribe': { args: [WebsocketRequestBody, any?]; result: IEvent[] | boolean };
  'ws.fetch': { args: [WebsocketRequestBody, any?]; result: IEvent[] | boolean };
  'ws.unsubscribe': { args: [string]; result: boolean };
  'ws.unsubscribeAll': { args: []; result: boolean };
  'ws.abort': { args: []; result: boolean };
};

export type LeaderTabRpcOp = keyof LeaderTabRpcOpMap;

export type RpcRequestMessage = {
  v: LeaderTabProtocolVersion;
  type: 'rpc';
  requestId: string;
  sourceId: string;
  op: LeaderTabRpcOp;
  args: any[];
  stream?: boolean;
};

export type RpcResponseMessage = {
  v: LeaderTabProtocolVersion;
  type: 'rpc-res';
  requestId: string;
  sourceId: string;
  targetId: string;
  ok: boolean;
  result?: any;
  error?: string;
};

export type RpcStreamMessage = {
  v: LeaderTabProtocolVersion;
  type: 'rpc-stream';
  requestId: string;
  sourceId: string;
  targetId: string;
  kind: string;
  data?: any;
};

export type BroadcastMessage = {
  v: LeaderTabProtocolVersion;
  type: 'broadcast';
  sourceId: string;
  kind: string;
  data?: any;
};

export type LeaderTabRpcMessage =
  | RpcRequestMessage
  | RpcResponseMessage
  | RpcStreamMessage
  | BroadcastMessage;

export function createId(): string {
  const cryptoAny = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
  if (cryptoAny?.randomUUID) return cryptoAny.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

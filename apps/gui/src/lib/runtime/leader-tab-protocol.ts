export const LEADER_TAB_RPC_CHANNEL = 'nostrwatch:route66:leader-tab-rpc:v1';

export type RpcRequestMessage = {
  type: 'rpc';
  requestId: string;
  sourceId: string;
  op: string;
  args: any[];
  stream?: boolean;
};

export type RpcResponseMessage = {
  type: 'rpc-res';
  requestId: string;
  sourceId: string;
  targetId: string;
  ok: boolean;
  result?: any;
  error?: string;
};

export type RpcStreamMessage = {
  type: 'rpc-stream';
  requestId: string;
  sourceId: string;
  targetId: string;
  kind: string;
  data?: any;
};

export type BroadcastMessage = {
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

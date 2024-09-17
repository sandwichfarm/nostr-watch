export interface INip11 {
  relay: string;
  monitorPubkey: string;
  hash: string | null;
  json: Record<string, any> | null;
  nid?: string | null;
  createdAt: number;
}
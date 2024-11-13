export type INip11 = {
  relay: string;
  monitorPubkey: string;
  hash: string | null;
  nid?: string | null;
  created_at: number;
  json: Record<string, any> | null;
}
export type IEvent = {
  id: string;
  pubkey: string;
  kind: number;
  tags: string[][];
  content: string;
  signature: string;
  created_at: number | null;
}
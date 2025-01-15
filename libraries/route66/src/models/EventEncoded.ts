export type IEventEncoded = {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number | null;
  encoded: Uint8Array;
}
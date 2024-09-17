export interface IEvent {
  id: string;
  pubkey: string;
  kind: number;
  tags: string[][];
  content: string;
  signature: string;
  createdAt: number | null;
}
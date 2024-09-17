export interface IRelay {
  relay: string;
  lastSeen: number;
  network: string;
  score?: number | null;
}
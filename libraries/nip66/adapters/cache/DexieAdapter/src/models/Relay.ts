export interface IRelay {
  relay: string;
  lastSeen: number;
  network: string;
  created_at: number;
  ignore: boolean;
  score?: number | null;
}
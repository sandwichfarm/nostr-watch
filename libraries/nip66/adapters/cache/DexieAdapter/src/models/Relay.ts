export interface IRelay {
  relay: string;
  lastSeen: number;
  network: string;
  createdAt: number;
  ignore: boolean;
  score?: number | null;
}
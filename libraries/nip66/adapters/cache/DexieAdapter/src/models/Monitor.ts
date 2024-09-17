export interface IMonitor {
  id: string;
  eventId: string;
  frequency: number;
  lastActive: number;
  geohash?: string;
  checks?: string[];
}
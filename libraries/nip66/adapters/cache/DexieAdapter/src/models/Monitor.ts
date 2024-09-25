export interface IMonitor {
  id: string; //pubkey 
  eventId: string; //10166 id
  frequency: number;
  lastActive: number;
  geohash?: string;
  checks?: string[];
}
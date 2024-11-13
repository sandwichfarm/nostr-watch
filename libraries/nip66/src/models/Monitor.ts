export type IMonitor = {
  pubkey: string; 
  eventId: string; 
  frequency: number;
  lastActive?: number;
  geohash?: string;
  geocode?: string[];
  checks?: string[];
}
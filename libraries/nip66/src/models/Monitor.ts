export interface Monitor {
  id: string;
  eventId: string;
  frequency: number;
  lastActive: number;
  geohash?: string;
  checks?: string[];
}
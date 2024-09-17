interface Relay {
  id: string; // Unique identifier, e.g., relay URL
  eventId: string; // Reference to the event in 'events' table
  monitorId: string; // Reference to the monitor in 'monitors' table
  nips?: string[];
  isp?: string;
  ipv4?: string[];
  ipv6?: string[];
  geohash?: string[];
  sslValid?: string;
  countryCode?: string;
  ownerPubkey?: string;
  network?: string;
  rttOpen?: number;
}
// src/services/RelayService.ts

import { ICacheAdapter } from '../interfaces/ICacheAdapter';
import { NostrEvent } from '../models/NostrEvent';

export class RelayService {
  constructor(private cacheAdapter: ICacheAdapter, private websocketAdapter: ICacheAdapter) {}

  /**
   * Fetches recent 30166 events for active monitors based on their frequency.
   * @param activeMonitors Array of active monitors.
   */
  async fetchRecent30166Events(activeMonitors: { pubkey: string }[]): Promise<void> {
    const currentTime = Math.floor(Date.now() / 1000);

    for (const monitor of activeMonitors) {
      const monitorData = await this.cacheAdapter.getMonitor(monitor.pubkey);
      if (!monitorData) continue;

      const since = currentTime - monitorData.frequency;

      try {
        const relays = await this.cacheAdapter.relays
          .where('monitorId')
          .equals(monitorData.id)
          .and((relay) => relay.livenessStatus === 'online' && relay.created_at >= since)
          .toArray();

        // TOODOO: Process relays
      } catch (error) {
        console.error(`RelayService fetchRecent30166Events error for monitor ${monitor.pubkey}:`, error);
      }
    }
  }

  /**
   * Finds relays based on various criteria.
   * @param criteria The criteria to filter relays.
   */
  async findRelays(criteria: Partial<{
    nips: string[];
    condition: 'AND' | 'OR';
    isp: string;
    ip: string;
    countryCode: string;
    ownerPubkey: string;
    network: string;
    rttOpen: number;
    livenessStatus: 'online' | 'offline' | 'dead';
  }>): Promise<any[]> {
    if (criteria.nips && criteria.condition) {
      return await this.cacheAdapter.findRelaysByNIPs(criteria.nips, criteria.condition);
    }
    if (criteria.isp) {
      return await this.cacheAdapter.findRelaysByISP(criteria.isp);
    }
    if (criteria.ip) {
      return await this.cacheAdapter.findRelaysByIP(criteria.ip);
    }
    if (criteria.countryCode) {
      return await this.cacheAdapter.findRelaysByCountryCode(criteria.countryCode);
    }
    if (criteria.ownerPubkey) {
      return await this.cacheAdapter.findRelaysByOwner(criteria.ownerPubkey);
    }
    if (criteria.network) {
      return await this.cacheAdapter.findRelaysByNetwork(criteria.network);
    }
    if (criteria.rttOpen !== undefined) {
      return await this.cacheAdapter.findRelaysByRTTOpen(criteria.rttOpen);
    }
    if (criteria.livenessStatus) {
      return await this.cacheAdapter.findRelaysByLiveness(criteria.livenessStatus);
    }
    return await this.cacheAdapter.relays.toArray();
  }
}

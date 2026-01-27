/**
 * Dimensions Derivation Worker
 *
 * Computes dimension tables (geocodes, softwares, isps, operators, etc.)
 * from relay check aggregates. Runs off main thread to keep UI responsive.
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type AggregateRow = {
  id: string;
  relay: string;
  operatorPubkey?: string;
  software?: string;
  version?: string;
  geocode?: string;
  isp?: string;
  as?: string;
  asname?: string;
  supportedNips?: number[];
  liveness?: 'online' | 'offline' | 'dead';
  lastSeen?: number;
  ipv4?: string[];
  ipv6?: string[];
  rtt?: number;
  rttNormalized?: number;
};

export type GeoRow = {
  id: string;
  geocode: string;
  count: number;
  percent: number;
  relays: string[];
  relaysCount: number;
  softwares: string[];
  softwaresCount: number;
};

export type SoftwareRow = {
  id: string;
  name: string;
  versions: string[];
  versionsNum: number;
  totalDeployed: number;
  marketShare: number;
};

export type StoreIsp = {
  title: string;
  as: string;
  asname: string;
};

export type IspRow = {
  id: string;
  prettyName: string;
  asname: string;
  as: string;
  count: number;
  percent: number;
  softwares: string[];
  softwaresCount: number;
};

export type UpdateMessage = {
  type: 'update';
  aggregates: AggregateRow[];
  config?: {
    onlineOnly?: boolean;
  };
};

export type ConfigMessage = {
  type: 'config';
  onlineOnly?: boolean;
};

export type IncomingMessage = UpdateMessage | ConfigMessage;

export type DimensionsResult = {
  // Geocode dimension
  geocodes: string[];
  geocodeCounts: Record<string, number>;
  geocodePercentages: Record<string, number>;
  relaysByGeo: Record<string, string[]>;
  softwaresByGeo: Record<string, string[]>;
  geoRows: GeoRow[];

  // Software dimension
  softwares: string[];
  softwareCounts: Record<string, number>;
  softwarePercentages: Record<string, number>;
  softwareVersions: Record<string, string[]>;
  softwareVersionCounts: Record<string, Record<string, number>>;
  softwareRelays: Record<string, string[]>;
  softwareOperatorPubkeys: Record<string, string[]>;
  ispsBySoftware: Record<string, string[]>;
  softwareGeocodes: Record<string, string[]>;
  softwareRows: SoftwareRow[];

  // ISP dimension
  isps: StoreIsp[];
  ispCounts: Record<string, number>;
  ispPercentages: Record<string, number>;
  softwaresByIsp: Record<string, string[]>;
  ispRows: IspRow[];

  // NIP dimension
  nips: number[];
  nipCounts: Record<number, number>;
  nipPercentages: Record<number, number>;

  // Version dimension
  versions: string[];

  // IP dimension
  ipRelayMap: Record<string, string[]>;

  // Worker aggregates for lazy helpers
  workerAggregates: AggregateRow[];
};

export type ResultMessage = {
  type: 'result';
  dimensions: DimensionsResult;
  stats: {
    computeMs: number;
    aggregateCount: number;
    dimensionCounts: Record<string, number>;
  };
};

export type ProgressMessage = {
  type: 'progress';
  phase: string;
  percent: number;
};

// ============================================================================
// WORKER STATE
// ============================================================================

const ctx: DedicatedWorkerGlobalScope = self as any;

let currentAggregates: AggregateRow[] = [];
let config = { onlineOnly: true };

let computeTimer: ReturnType<typeof setTimeout> | null = null;
const COMPUTE_DEBOUNCE_MS = 100;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function softwareKey(software: string | undefined): string {
  return software?.toLowerCase() || 'unknown';
}

function deterministicHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// COMPUTATION FUNCTIONS
// ============================================================================

function computeGeocodes(aggregates: AggregateRow[]): {
  geocodes: string[];
  geocodeCounts: Record<string, number>;
  geocodePercentages: Record<string, number>;
  relaysByGeo: Record<string, string[]>;
  softwaresByGeo: Record<string, string[]>;
  geoRows: GeoRow[];
} {
  const geocodeSet = new Set<string>(['unknown']);
  const geocodeCounts: Record<string, number> = {};
  const relaysByGeo: Record<string, string[]> = {};
  const softwaresByGeoSet: Record<string, Set<string>> = {};

  // Single pass through aggregates
  for (const agg of aggregates) {
    const geocode = agg.geocode || 'unknown';

    // Count
    geocodeSet.add(geocode);
    geocodeCounts[geocode] = (geocodeCounts[geocode] || 0) + 1;

    // Relays by geo
    if (!relaysByGeo[geocode]) relaysByGeo[geocode] = [];
    relaysByGeo[geocode].push(agg.relay);

    // Softwares by geo (unique)
    if (!softwaresByGeoSet[geocode]) softwaresByGeoSet[geocode] = new Set();
    if (agg.software) softwaresByGeoSet[geocode].add(agg.software);
  }

  // Convert Set to array
  const softwaresByGeo: Record<string, string[]> = {};
  for (const [geo, set] of Object.entries(softwaresByGeoSet)) {
    softwaresByGeo[geo] = Array.from(set);
  }

  // Calculate percentages
  const total = aggregates.length;
  const geocodePercentages: Record<string, number> = {};
  for (const [geo, count] of Object.entries(geocodeCounts)) {
    geocodePercentages[geo] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
  }

  // Sort geocodes
  const geocodes = Array.from(geocodeSet).sort();

  // Build rows
  const geoRows: GeoRow[] = geocodes.map(geocode => ({
    id: geocode,
    geocode,
    count: geocodeCounts[geocode] || 0,
    percent: geocodePercentages[geocode] || 0,
    relays: relaysByGeo[geocode] || [],
    relaysCount: (relaysByGeo[geocode] || []).length,
    softwares: softwaresByGeo[geocode] || [],
    softwaresCount: (softwaresByGeo[geocode] || []).length,
  }));

  return {
    geocodes,
    geocodeCounts,
    geocodePercentages,
    relaysByGeo,
    softwaresByGeo,
    geoRows,
  };
}

function computeSoftwares(aggregates: AggregateRow[]): {
  softwares: string[];
  softwareCounts: Record<string, number>;
  softwarePercentages: Record<string, number>;
  softwareVersions: Record<string, string[]>;
  softwareVersionCounts: Record<string, Record<string, number>>;
  softwareRelays: Record<string, string[]>;
  softwareOperatorPubkeys: Record<string, string[]>;
  ispsBySoftware: Record<string, string[]>;
  softwareGeocodes: Record<string, string[]>;
  softwareRows: SoftwareRow[];
} {
  const softwareSet = new Set<string>();
  const softwareCounts: Record<string, number> = {};
  const softwareVersionsSet: Record<string, Set<string>> = {};
  const softwareVersionCounts: Record<string, Record<string, number>> = {};
  const softwareRelays: Record<string, string[]> = {};
  const softwareOperatorPubkeysSet: Record<string, Set<string>> = {};
  const ispsBySoftwareSet: Record<string, Set<string>> = {};
  const softwareGeocodesArr: Record<string, string[]> = {};

  // Single pass through aggregates
  for (const agg of aggregates) {
    const sw = softwareKey(agg.software);
    const version = agg.version?.toLowerCase() || 'unknown';

    // Basic software tracking
    if (agg.software) softwareSet.add(sw);
    softwareCounts[sw] = (softwareCounts[sw] || 0) + 1;

    // Versions
    if (!softwareVersionsSet[sw]) softwareVersionsSet[sw] = new Set();
    softwareVersionsSet[sw].add(version);

    // Version counts
    if (!softwareVersionCounts[sw]) softwareVersionCounts[sw] = {};
    softwareVersionCounts[sw][version] = (softwareVersionCounts[sw][version] || 0) + 1;

    // Relays by software
    if (!softwareRelays[sw]) softwareRelays[sw] = [];
    softwareRelays[sw].push(agg.relay);

    // Operator pubkeys by software
    if (!softwareOperatorPubkeysSet[sw]) softwareOperatorPubkeysSet[sw] = new Set();
    if (agg.operatorPubkey) softwareOperatorPubkeysSet[sw].add(agg.operatorPubkey);

    // ISPs by software
    if (!ispsBySoftwareSet[sw]) ispsBySoftwareSet[sw] = new Set();
    const isp = agg.isp || 'unknown';
    ispsBySoftwareSet[sw].add(isp);

    // Geocodes by software
    if (!softwareGeocodesArr[sw]) softwareGeocodesArr[sw] = [];
    if (agg.geocode) softwareGeocodesArr[sw].push(agg.geocode);
  }

  // Convert Sets to arrays
  const softwareVersions: Record<string, string[]> = {};
  for (const [sw, set] of Object.entries(softwareVersionsSet)) {
    softwareVersions[sw] = Array.from(set);
  }

  const softwareOperatorPubkeys: Record<string, string[]> = {};
  for (const [sw, set] of Object.entries(softwareOperatorPubkeysSet)) {
    softwareOperatorPubkeys[sw] = Array.from(set);
  }

  const ispsBySoftware: Record<string, string[]> = {};
  for (const [sw, set] of Object.entries(ispsBySoftwareSet)) {
    ispsBySoftware[sw] = Array.from(set);
  }

  // Calculate percentages
  const total = aggregates.length;
  const softwarePercentages: Record<string, number> = {};
  for (const [sw, count] of Object.entries(softwareCounts)) {
    softwarePercentages[sw] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
  }

  // Sort softwares
  const softwares = Array.from(softwareSet).sort();

  // Build rows
  const softwareRows: SoftwareRow[] = softwares.map(name => ({
    id: deterministicHash(name),
    name,
    versions: softwareVersions[name] || [],
    versionsNum: (softwareVersions[name] || []).length,
    totalDeployed: softwareCounts[name] || 0,
    marketShare: softwarePercentages[name] || 0,
  }));

  return {
    softwares,
    softwareCounts,
    softwarePercentages,
    softwareVersions,
    softwareVersionCounts,
    softwareRelays,
    softwareOperatorPubkeys,
    ispsBySoftware,
    softwareGeocodes: softwareGeocodesArr,
    softwareRows,
  };
}

function computeIsps(aggregates: AggregateRow[]): {
  isps: StoreIsp[];
  ispCounts: Record<string, number>;
  ispPercentages: Record<string, number>;
  softwaresByIsp: Record<string, string[]>;
  ispRows: IspRow[];
} {
  const ispsMap = new Map<string, StoreIsp>();
  const ispCounts: Record<string, number> = {};
  const softwaresByIspSet: Record<string, Set<string>> = {};

  // Single pass through aggregates
  for (const agg of aggregates) {
    const isp = agg.isp || 'unknown';

    // Build ISP info
    if (agg.asname) {
      ispsMap.set(agg.asname, {
        title: agg.isp || '',
        as: agg.as || '',
        asname: agg.asname,
      });
    }

    // Count
    ispCounts[isp] = (ispCounts[isp] || 0) + 1;

    // Softwares by ISP
    if (!softwaresByIspSet[isp]) softwaresByIspSet[isp] = new Set();
    if (agg.software) softwaresByIspSet[isp].add(agg.software);
  }

  // Convert Sets to arrays
  const softwaresByIsp: Record<string, string[]> = {};
  for (const [isp, set] of Object.entries(softwaresByIspSet)) {
    softwaresByIsp[isp] = Array.from(set);
  }

  // Calculate percentages
  const total = aggregates.length;
  const ispPercentages: Record<string, number> = {};
  for (const [isp, count] of Object.entries(ispCounts)) {
    ispPercentages[isp] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
  }

  // Sort ISPs
  const isps = Array.from(ispsMap.values()).sort((a, b) => a.asname.localeCompare(b.asname));

  // Build rows
  const ispRows: IspRow[] = isps.map(isp => ({
    id: isp.as,
    prettyName: isp.title,
    asname: isp.asname,
    as: isp.as,
    count: ispCounts[isp.title] || 0,
    percent: ispPercentages[isp.title] || 0,
    softwares: softwaresByIsp[isp.title] || [],
    softwaresCount: (softwaresByIsp[isp.title] || []).length,
  }));

  return {
    isps,
    ispCounts,
    ispPercentages,
    softwaresByIsp,
    ispRows,
  };
}

function computeNips(aggregates: AggregateRow[]): {
  nips: number[];
  nipCounts: Record<number, number>;
  nipPercentages: Record<number, number>;
} {
  const nipSet = new Set<number>();
  const nipCounts: Record<number, number> = {};

  // Single pass through aggregates
  for (const agg of aggregates) {
    if (agg.supportedNips && agg.supportedNips.length > 0) {
      for (const nip of agg.supportedNips) {
        nipSet.add(nip);
        nipCounts[nip] = (nipCounts[nip] || 0) + 1;
      }
    }
  }

  // Calculate percentages (based on total NIP mentions, not relay count)
  const totalNipMentions = Object.values(nipCounts).reduce((sum, count) => sum + count, 0);
  const nipPercentages: Record<number, number> = {};
  for (const [nip, count] of Object.entries(nipCounts)) {
    nipPercentages[Number(nip)] = totalNipMentions > 0
      ? parseFloat(((count / totalNipMentions) * 100).toFixed(1))
      : 0;
  }

  // Sort nips
  const nips = Array.from(nipSet).sort((a, b) => a - b);

  return {
    nips,
    nipCounts,
    nipPercentages,
  };
}

function computeVersions(aggregates: AggregateRow[]): {
  versions: string[];
} {
  const versionSet = new Set<string>();

  for (const agg of aggregates) {
    if (agg.version) {
      versionSet.add(agg.version);
    }
  }

  return {
    versions: Array.from(versionSet).sort(),
  };
}

function computeIpRelayMap(aggregates: AggregateRow[]): {
  ipRelayMap: Record<string, string[]>;
} {
  const ipRelayMap: Record<string, string[]> = {};

  for (const agg of aggregates) {
    // IPv4
    if (agg.ipv4 && agg.ipv4.length > 0) {
      for (const ip of agg.ipv4) {
        if (!ipRelayMap[ip]) ipRelayMap[ip] = [];
        ipRelayMap[ip].push(agg.relay);
      }
    }
    // IPv6
    if (agg.ipv6 && agg.ipv6.length > 0) {
      for (const ip of agg.ipv6) {
        if (!ipRelayMap[ip]) ipRelayMap[ip] = [];
        ipRelayMap[ip].push(agg.relay);
      }
    }
  }

  return {
    ipRelayMap,
  };
}

function runCompute() {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Filter for dimension computations (counts, percentages, rows)
  let dimensionAggregates = currentAggregates;
  if (config.onlineOnly) {
    dimensionAggregates = currentAggregates.filter(a => a.liveness === 'online');
  }

  // Compute all dimensions using filtered aggregates
  const geocodeResult = computeGeocodes(dimensionAggregates);
  const softwareResult = computeSoftwares(dimensionAggregates);
  const ispResult = computeIsps(dimensionAggregates);
  const nipResult = computeNips(dimensionAggregates);
  const versionResult = computeVersions(dimensionAggregates);
  const ipResult = computeIpRelayMap(dimensionAggregates);

  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const msg: ResultMessage = {
    type: 'result',
    dimensions: {
      ...geocodeResult,
      ...softwareResult,
      ...ispResult,
      ...nipResult,
      ...versionResult,
      ...ipResult,
      // Send ALL aggregates (not filtered) for lazy helpers to filter themselves
      workerAggregates: currentAggregates,
    },
    stats: {
      computeMs: Math.round((end - start) * 100) / 100,
      aggregateCount: dimensionAggregates.length,
      dimensionCounts: {
        geocodes: geocodeResult.geocodes.length,
        softwares: softwareResult.softwares.length,
        isps: ispResult.isps.length,
        nips: nipResult.nips.length,
        versions: versionResult.versions.length,
      },
    },
  };

  ctx.postMessage(msg);
}

function scheduleCompute() {
  if (computeTimer) clearTimeout(computeTimer);
  computeTimer = setTimeout(runCompute, COMPUTE_DEBOUNCE_MS);
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

ctx.onmessage = (ev: MessageEvent) => {
  const message = ev.data as IncomingMessage;
  if (!message || typeof message !== 'object') return;

  if (message.type === 'update') {
    currentAggregates = Array.isArray(message.aggregates) ? message.aggregates : [];
    if (message.config) {
      config = { ...config, ...message.config };
    }
    scheduleCompute();
    return;
  }

  if (message.type === 'config') {
    if (typeof message.onlineOnly === 'boolean') {
      config.onlineOnly = message.onlineOnly;
    }
    scheduleCompute();
    return;
  }
};

// Signal ready
ctx.postMessage({ type: 'ready' });

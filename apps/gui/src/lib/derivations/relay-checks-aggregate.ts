export type RelayChecksByRelay = Record<string, { aggregate: Record<string, any> }>;

type CheckLike = Record<string, any> & {
  relay?: string | null;
  rtt?: number | null;
};

export function relayCheckAggregator(
  checks: CheckLike[],
  activeKeys: string[],
  nip11Errors: Map<string, number> = new Map()
): RelayChecksByRelay {
  const byRelay: Record<string, { checks: CheckLike[]; aggregate?: Record<string, any> }> = {};
  const relayAverages: Record<string, number> = {};
  const relayCounts: Record<string, number> = {};

  for (const check of checks) {
    if (!check?.relay) continue;

    let relay: string = check.relay;
    try {
      relay = new URL(relay).toString();
    } catch {
      // best-effort: keep original
    }

    const rtt = check?.rtt;
    if (typeof rtt !== 'number') continue;

    if (!relayAverages[relay]) {
      relayAverages[relay] = 0;
      relayCounts[relay] = 0;
    }
    relayAverages[relay] += rtt;
    relayCounts[relay] += 1;

    if (!byRelay[relay]) byRelay[relay] = { checks: [] };
    byRelay[relay].checks.push(check);
  }

  const averageValues: number[] = [];
  for (const relay of Object.keys(relayAverages)) {
    const sum = relayAverages[relay];
    const count = relayCounts[relay];
    const avg = count > 0 ? sum / count : 0;
    relayAverages[relay] = avg;
    averageValues.push(avg);
  }

  if (averageValues.length === 0) return {};

  const globalMin = Math.min(...averageValues);
  const globalMax = Math.max(...averageValues);
  const range = globalMax - globalMin || 1;

  for (const relay of Object.keys(byRelay)) {
    const relayChecks = byRelay[relay].checks;

    const aggregate = relayChecks.reduceRight((acc: Record<string, any>, nip66Event: CheckLike) => {
      for (const key of activeKeys) {
        const value = nip66Event?.[key];
        const isNonNull = value !== null && value !== undefined;

        const isArray = Array.isArray(value);
        const isAccArray = Array.isArray(acc[key]);

        if (key === 'nip11ValidationErrors') {
          const nip11ValidationErrors = nip11Errors.get(relay);
          acc.nip11ValidationErrors = nip11ValidationErrors ? nip11ValidationErrors : 0;
          continue;
        }

        if (key === 'nip11IsValid') {
          const nip11ValidationErrors = nip11Errors.get(relay);
          if (typeof nip11ValidationErrors === 'number') {
            acc.nip11IsValid = nip11ValidationErrors === 0;
          } else {
            acc.nip11IsValid = null;
          }
          continue;
        }

        if (key === 'seenTimes') {
          acc.seenTimes = (acc.seenTimes ?? 0) + 1;
          continue;
        }

        if (key === 'monitorPubkey') {
          if (!acc.seenBy) acc.seenBy = [];
          acc.seenBy.push(value);
          continue;
        }

        if (key === 'created_at') {
          if (!acc.lastSeen) acc.lastSeen = value;
          else if (value > acc.lastSeen) acc.lastSeen = value;
          continue;
        }

        if (isNonNull && (key === 'fees' || key === 'retention')) {
          acc[key] = value;
          continue;
        }

        if (isArray) {
          acc[key] = isAccArray ? [...new Set([...acc[key], ...value])] : value;
          continue;
        }

        if (!isArray && isNonNull) {
          acc[key] = value;
        }
      }
      return acc;
    }, {});

    const avg = relayAverages[relay] ?? 0;
    const normalized = (avg - globalMin) / range;
    aggregate.rtt = avg;
    aggregate.rttNormalized = Math.round(normalized * 10000) / 10000;

    byRelay[relay].aggregate = aggregate;
  }

  const result: RelayChecksByRelay = {};
  for (const [relay, entry] of Object.entries(byRelay)) {
    if (!entry.aggregate) continue;
    result[relay] = { aggregate: entry.aggregate };
  }

  return result;
}


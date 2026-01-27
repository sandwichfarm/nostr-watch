export type CheckKey = 'open' | 'read' | 'write';

export type PingStrategy = 'sum' | 'max';

export interface KumaPushPayload {
  status: 'up' | 'down' | 'paused';
  msg?: string;
  ping?: number;
}

export interface KumaMonitorOptions {
  relayUrl: string;
  pushUrl: string; // Full Uptime Kuma push URL
  checks?: CheckKey[]; // default: ['open','read']
  requiredChecks?: CheckKey[]; // default: same as checks
  pingStrategy?: PingStrategy;

  // nocap passthrough config
  nocap?: Partial<{
    logLevel: string;
    checked_by: string;
    timeout: Partial<{
      open: number;
      read: number;
      write: number;
    }>;
    tooManyEventsLimit: number;
    autoDepsIgnoredInResult: boolean;
    removeFromResult: string[];
    failAllChecksOnConnectFailure: boolean;
    rejectOnConnectFailure: boolean;
    websocketAlwaysTerminate: boolean;
    event_sample: any; // NostrEvent shape; permissive typing here
    adapterOptions: Partial<{
      websocket: Record<string, any>;
    }>;
  }>;

  // behavior
  headers?: boolean; // include headers in nocap result
  once?: boolean; // run once then exit
  intervalMs?: number; // when not once, run every N ms
}

export interface CheckResultSummary {
  ok: boolean;
  failing: CheckKey[];
  result: any;
  durations: Partial<Record<CheckKey, number>>;
}


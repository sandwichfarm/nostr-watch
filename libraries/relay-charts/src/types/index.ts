/**
 * Core types for relay chronicle chart adapters
 */

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number | string | boolean | null;
  label?: string;
}

/**
 * Uptime/downtime period for timeline visualization
 */
export interface UptimePeriod {
  start: number;
  end: number | null;
  online: boolean;
  rtt?: number;
}

/**
 * State change event
 */
export interface StateChange {
  timestamp: number;
  from: string | boolean | number | null;
  to: string | boolean | number | null;
  field: string;
}

/**
 * A single delta item within a Kind 1066 event.
 *
 * These are derived from tag keys like `+dns.Answer` / `-dns.Answer` / `software`,
 * with the leading +/- stripped into `op`.
 */
export interface DeltaBlotterItem {
  /** 'add' for +key, 'remove' for -key, otherwise 'change' */
  op: 'add' | 'remove' | 'change';
  /** Key without the leading +/- */
  key: string;
  /** Optional value (some publishers may omit it); consumers may render a placeholder */
  value: string | null;
}

/**
 * A "blotter" point representing one Kind 1066 event's deltas for a category.
 */
export interface DeltaBlotterPoint {
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** Category label used for the y-axis (e.g. 'dns', 'geo', 'limitation', 'info') */
  category: string;
  /** Overall direction of the deltas within this category */
  direction: 'add' | 'remove' | 'mixed' | 'change';
  /** Event id (optional but useful for tooltips/debug) */
  eventId?: string;
  /** Delta items represented by this point */
  items: DeltaBlotterItem[];
}

/**
 * Chart data types
 */
export type ChartDataType =
  | 'timeseries'    // Line/area chart for continuous values
  | 'timeline'      // Timeline showing uptime/downtime periods
  | 'state'         // State transitions chart
  | 'histogram'     // Distribution of values
  | 'scatter';      // Scatter plot

/**
 * Generic chart data structure
 */
export interface ChartData {
  type: ChartDataType;
  relay: string;
  title?: string;
  data: TimeSeriesPoint[] | UptimePeriod[] | StateChange[];
  metadata?: Record<string, any>;
}

/**
 * Chart configuration options
 */
export interface ChartOptions {
  width?: number;
  height?: number;
  title?: string;
  theme?: 'light' | 'dark';
  /**
   * Optional Simple Moving Average (SMA) overlay for numeric time series.
   *
   * The SMA is computed over the last N points (window size).
   */
  sma?: {
    /** Window size in points (e.g. 5). Values <= 1 disable SMA. */
    window: number;
  };
  colors?: {
    online?: string;
    offline?: string;
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
  };
  timeRange?: {
    start?: number;
    end?: number;
  };
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  animation?: boolean;
  responsive?: boolean;
}

/**
 * Base adapter interface that all chart library adapters must implement
 */
export interface ChartAdapter<TChartConfig = any, TChartInstance = any> {
  /**
   * Adapter name
   */
  readonly name: string;

  /**
   * Convert relay chronicle data to chart configuration
   */
  createTimeSeriesChart(
    data: TimeSeriesPoint[],
    options?: ChartOptions
  ): TChartConfig;

  /**
   * Create uptime/downtime timeline chart
   */
  createTimelineChart(
    data: UptimePeriod[],
    options?: ChartOptions
  ): TChartConfig;

  /**
   * Create state transitions chart
   */
  createStateChart(
    data: StateChange[],
    options?: ChartOptions
  ): TChartConfig;

  /**
   * Generic method to create any chart from ChartData
   */
  createChart(
    chartData: ChartData,
    options?: ChartOptions
  ): TChartConfig;

  /**
   * Initialize chart instance (if applicable for the library)
   */
  initialize?(
    container: HTMLElement,
    config: TChartConfig
  ): TChartInstance;

  /**
   * Update existing chart with new data
   */
  update?(
    instance: TChartInstance,
    chartData: ChartData,
    options?: ChartOptions
  ): void;

  /**
   * Destroy chart instance
   */
  destroy?(instance: TChartInstance): void;
}

/**
 * Helper type for extracting chart configuration type from adapter
 */
export type ChartConfigOf<T extends ChartAdapter> =
  T extends ChartAdapter<infer C, any> ? C : never;

/**
 * Helper type for extracting chart instance type from adapter
 */
export type ChartInstanceOf<T extends ChartAdapter> =
  T extends ChartAdapter<any, infer I> ? I : never;

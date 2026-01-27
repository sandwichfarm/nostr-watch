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

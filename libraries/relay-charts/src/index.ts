/**
 * @nostrwatch/relay-charts
 *
 * Chart adapters for visualizing relay data from @nostrwatch/relay-chronicle
 *
 * This library provides adapters for multiple charting libraries:
 * - Chart.js (canvas-based, simple and performant)
 * - Apache ECharts (feature-rich, complex visualizations)
 * - Recharts (React-based, declarative)
 *
 * Usage:
 * ```ts
 * // Import only what you need for tree-shaking
 * import { createChartJsAdapter } from '@nostrwatch/relay-charts/chartjs';
 * import { createEChartsAdapter } from '@nostrwatch/relay-charts/echarts';
 * import { createRechartsAdapter } from '@nostrwatch/relay-charts/recharts';
 * ```
 */

// Export types
export type {
  ChartAdapter,
  ChartData,
  ChartOptions,
  ChartDataType,
  DeltaBlotterItem,
  DeltaBlotterPoint,
  TimeSeriesPoint,
  UptimePeriod,
  StateChange,
  ChartConfigOf,
  ChartInstanceOf,
} from './types/index.ts';

// Export utilities
export {
  transformUptimeHistory,
  transformChangeHistory,
  transformStateChanges,
  extractRttTimeSeries,
  calculateUptimePercentage,
  aggregateTimeSeries,
  filterByTimeRange,
  formatTimestamp,
} from './utils/transforms.ts';

// Note: Adapters are NOT exported from the main index for tree-shaking.
// Import them directly from their specific entry points:
// - '@nostrwatch/relay-charts/chartjs'
// - '@nostrwatch/relay-charts/echarts'
// - '@nostrwatch/relay-charts/recharts'

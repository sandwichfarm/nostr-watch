# @nostrwatch/relay-charts

> Chart adapters for visualizing relay data from @nostrwatch/relay-chronicle

Create beautiful, interactive charts from Nostr relay monitoring data using your preferred charting library.

## Features

- **🔌 Adapter System** - Pluggable architecture for different charting libraries
- **🌲 Tree-Shakable** - Only bundle the adapter you use
- **📊 Multiple Chart Types** - Time series, timelines, state transitions
- **🎨 Themeable** - Light and dark mode support
- **⚡ Peer Dependencies** - No bloat - bring your own charting library

## Supported Adapters

| Adapter | Library | Best For | Type |
|---------|---------|----------|------|
| **Chart.js** | [Chart.js](https://www.chartjs.org/) | Simple, performant canvas charts | Canvas |
| **ECharts** | [Apache ECharts](https://echarts.apache.org/) | Complex, feature-rich visualizations | Canvas/SVG |
| **Recharts** | [Recharts](https://recharts.org/) | React applications | React/SVG |

## Installation

```bash
npm install @nostrwatch/relay-charts @nostrwatch/relay-chronicle

# Install your preferred charting library (peer dependency)
npm install chart.js        # For Chart.js adapter
npm install echarts         # For ECharts adapter
npm install recharts        # For Recharts adapter
```

## Quick Start

### Chart.js Adapter

```typescript
import { createChartJsAdapter } from '@nostrwatch/relay-charts/chartjs';
import { liveness, uptimeHistory } from '@nostrwatch/relay-chronicle';
import Chart from 'chart.js/auto';

// Make Chart.js available globally
globalThis.Chart = Chart;

// Create adapter
const adapter = createChartJsAdapter();

// Get data from relay-chronicle
const storage = /* your storage implementation */;
const periods = await uptimeHistory(storage, 'wss://relay.example.com');

// Create chart configuration
const config = adapter.createTimelineChart(periods, {
  theme: 'dark',
  title: 'Relay Uptime Timeline',
  showTooltip: true,
});

// Initialize chart
const container = document.getElementById('chart');
const chart = adapter.initialize(container, config);
```

### ECharts Adapter

```typescript
import { createEChartsAdapter } from '@nostrwatch/relay-charts/echarts';
import { changeHistory } from '@nostrwatch/relay-chronicle';
import * as echarts from 'echarts';

// Make ECharts available globally
globalThis.echarts = echarts;

// Create adapter
const adapter = createEChartsAdapter();

// Get data from relay-chronicle
const storage = /* your storage implementation */;
const changes = await changeHistory(storage, 'wss://relay.example.com', 'supported_nips');

// Transform to time series
import { transformChangeHistory } from '@nostrwatch/relay-charts';
const timeSeries = transformChangeHistory(changes);

// Create chart
const config = adapter.createTimeSeriesChart(timeSeries, {
  theme: 'light',
  title: 'NIP Support Changes',
  animation: true,
});

// Initialize
const container = document.getElementById('chart');
const chart = adapter.initialize(container, config);
```

### Recharts Adapter (React)

```tsx
import { createRechartsAdapter } from '@nostrwatch/relay-charts/recharts';
import { extractRttTimeSeries } from '@nostrwatch/relay-charts';
import { uptimeHistory } from '@nostrwatch/relay-chronicle';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

function RelayRttChart({ relay }: { relay: string }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function loadData() {
      const adapter = createRechartsAdapter();
      const storage = /* your storage */;
      const periods = await uptimeHistory(storage, relay);
      const rttData = extractRttTimeSeries(periods);

      const chartConfig = adapter.createTimeSeriesChart(rttData, {
        title: 'RTT Over Time',
        theme: 'light',
      });

      setConfig(chartConfig);
    }

    loadData();
  }, [relay]);

  if (!config) return <div>Loading...</div>;

  return (
    <ResponsiveContainer {...config.containerProps}>
      <AreaChart data={config.data} margin={config.margin}>
        {config.components.CartesianGrid && (
          <CartesianGrid {...config.components.CartesianGrid} />
        )}
        <XAxis {...config.components.XAxis} />
        <YAxis {...config.components.YAxis} />
        {config.components.Tooltip && <Tooltip {...config.components.Tooltip} />}
        {config.components.Legend && <Legend {...config.components.Legend} />}
        {config.components.Area?.map((areaProps, i) => (
          <Area key={i} {...areaProps} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

## Chart Types

### Time Series Charts

Display continuous values over time (RTT, metric changes, etc.)

```typescript
const config = adapter.createTimeSeriesChart(
  [
    { timestamp: 1699000000, value: 145, label: 'RTT' },
    { timestamp: 1699000030, value: 152, label: 'RTT' },
    { timestamp: 1699000060, value: 138, label: 'RTT' },
  ],
  {
    title: 'Response Time',
    showGrid: true,
    theme: 'dark',
  }
);
```

### Timeline Charts

Visualize uptime/downtime periods

```typescript
const config = adapter.createTimelineChart(
  [
    { start: 1699000000, end: 1699003600, online: true, rtt: 145 },
    { start: 1699003600, end: 1699007200, online: false },
    { start: 1699007200, end: null, online: true, rtt: 152 },
  ],
  {
    title: 'Uptime Timeline',
    colors: {
      online: '#10b981',
      offline: '#ef4444',
    },
  }
);
```

### State Change Charts

Track field value changes over time

```typescript
const config = adapter.createStateChart(
  [
    { timestamp: 1699000000, from: null, to: 'v2.0.0', field: 'software' },
    { timestamp: 1699003600, from: 'v2.0.0', to: 'v2.1.0', field: 'software' },
  ],
  {
    title: 'Software Version Changes',
  }
);
```

## Utilities

### Transform relay-chronicle data to chart formats

```typescript
import {
  transformUptimeHistory,
  transformChangeHistory,
  transformStateChanges,
  extractRttTimeSeries,
  calculateUptimePercentage,
  aggregateTimeSeries,
  filterByTimeRange,
} from '@nostrwatch/relay-charts';

// Extract RTT from uptime periods
const rttData = extractRttTimeSeries(periods);

// Calculate uptime percentage
const uptime = calculateUptimePercentage(periods, {
  start: Date.now() / 1000 - 86400, // Last 24 hours
  end: Date.now() / 1000,
});

// Aggregate time series into hourly buckets
const hourlyAvg = aggregateTimeSeries(timeSeries, 3600, 'avg');

// Filter by time range
const filtered = filterByTimeRange(
  timeSeries,
  Date.now() / 1000 - 86400, // start
  Date.now() / 1000          // end
);
```

## Chart Options

All adapters support a common set of options:

```typescript
interface ChartOptions {
  width?: number;           // Chart width
  height?: number;          // Chart height
  title?: string;           // Chart title
  theme?: 'light' | 'dark'; // Color theme
  colors?: {                // Custom colors
    online?: string;
    offline?: string;
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
  };
  timeRange?: {             // Time range filter
    start?: number;
    end?: number;
  };
  showLegend?: boolean;     // Show/hide legend
  showGrid?: boolean;       // Show/hide grid
  showTooltip?: boolean;    // Show/hide tooltip
  animation?: boolean;      // Enable/disable animation
  responsive?: boolean;     // Responsive sizing
}
```

## Adapter Interface

All adapters implement the `ChartAdapter` interface:

```typescript
interface ChartAdapter<TChartConfig, TChartInstance> {
  readonly name: string;

  createTimeSeriesChart(
    data: TimeSeriesPoint[],
    options?: ChartOptions
  ): TChartConfig;

  createTimelineChart(
    data: UptimePeriod[],
    options?: ChartOptions
  ): TChartConfig;

  createStateChart(
    data: StateChange[],
    options?: ChartOptions
  ): TChartConfig;

  createChart(
    chartData: ChartData,
    options?: ChartOptions
  ): TChartConfig;

  initialize?(
    container: HTMLElement,
    config: TChartConfig
  ): TChartInstance;

  update?(
    instance: TChartInstance,
    chartData: ChartData,
    options?: ChartOptions
  ): void;

  destroy?(instance: TChartInstance): void;
}
```

## Creating Custom Adapters

You can create your own adapter for any charting library:

```typescript
import type { ChartAdapter } from '@nostrwatch/relay-charts';

class MyCustomAdapter implements ChartAdapter<MyChartConfig, MyChartInstance> {
  readonly name = 'mychart';

  createTimeSeriesChart(data, options) {
    // Transform data to your library's format
    return {
      // Your chart configuration
    };
  }

  createTimelineChart(data, options) {
    // ...
  }

  createStateChart(data, options) {
    // ...
  }

  createChart(chartData, options) {
    switch (chartData.type) {
      case 'timeseries':
        return this.createTimeSeriesChart(chartData.data, options);
      // ...
    }
  }

  initialize(container, config) {
    // Initialize your chart library
    return myChartLib.create(container, config);
  }

  update(instance, chartData, options) {
    // Update chart with new data
  }

  destroy(instance) {
    // Clean up
  }
}
```

## Examples

See the `examples/` directory for complete working examples:

- `chartjs-vanilla.html` - Chart.js in vanilla JavaScript
- `echarts-node.ts` - ECharts server-side rendering
- `recharts-react.tsx` - Recharts in a React application

## Tree-Shaking

This library is designed for optimal tree-shaking. Only import the adapters you use:

```typescript
// ✅ Good - only bundles Chart.js adapter
import { createChartJsAdapter } from '@nostrwatch/relay-charts/chartjs';

// ❌ Bad - might bundle all adapters (depending on bundler)
import { createChartJsAdapter } from '@nostrwatch/relay-charts';
```

## TypeScript

Full TypeScript support with type definitions for all adapters:

```typescript
import type {
  ChartAdapter,
  ChartData,
  ChartOptions,
  TimeSeriesPoint,
  UptimePeriod,
  StateChange,
} from '@nostrwatch/relay-charts';

import type { ChartJsConfig } from '@nostrwatch/relay-charts/chartjs';
import type { EChartsConfig } from '@nostrwatch/relay-charts/echarts';
import type { RechartsConfig } from '@nostrwatch/relay-charts/recharts';
```

## License

MIT

## Related

- [@nostrwatch/relay-chronicle](https://github.com/sandwichfarm/nostr-watch/tree/main/libraries/relay-chronicle) - Core relay history library
- [Chart.js](https://www.chartjs.org/) - Simple, flexible charting
- [Apache ECharts](https://echarts.apache.org/) - Powerful visualization library
- [Recharts](https://recharts.org/) - Composable React charts

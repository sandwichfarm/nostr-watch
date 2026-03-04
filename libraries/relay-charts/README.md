# @nostrwatch/relay-charts

Relay metric visualization with pluggable charting library adapters.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/relay-charts?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/relay-charts)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/relay-charts` generates charts from Nostr relay (a WebSocket server that stores and forwards events) monitoring data — uptime, latency, NIP (Nostr Implementation Possibility) support changes — using Chart.js, Apache ECharts, or Recharts as the rendering backend. It implements a `ChartAdapter` interface so the same data pipeline produces configuration objects suitable for any of the three supported charting libraries. Data is sourced from `@nostrwatch/relay-chronicle`, which reconstructs relay state history from [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) kind 1066 delta events. Adapters are tree-shakable — only the adapter you import is bundled.

## Prerequisites

Node.js >=20 and pnpm >=9.

Install one charting library peer dependency:

- `chart.js >=4` for the Chart.js adapter
- `echarts >=5` for the Apache ECharts adapter
- `recharts >=2` for the Recharts adapter

## Installation

```sh
pnpm add @nostrwatch/relay-charts @nostrwatch/relay-chronicle
```

Then add your charting library:

```sh
pnpm add chart.js        # Chart.js adapter
pnpm add echarts         # ECharts adapter
pnpm add recharts        # Recharts adapter (React)
```

Or with npm:

```sh
npm install @nostrwatch/relay-charts @nostrwatch/relay-chronicle chart.js
```

## Quick Start

Create an uptime timeline chart using the Chart.js adapter:

```ts
import {createChartJsAdapter} from '@nostrwatch/relay-charts/chartjs'
import {uptimeHistory} from '@nostrwatch/relay-chronicle'
import Chart from 'chart.js/auto'

globalThis.Chart = Chart

const adapter = createChartJsAdapter()
const storage = /* your EventStorage implementation */
const periods = await uptimeHistory(storage, 'wss://relay.damus.io')

const config = adapter.createTimelineChart(periods, {
  theme: 'dark',
  title: 'Relay Uptime Timeline'
})

const container = document.getElementById('chart') as HTMLElement
adapter.initialize(container, config)
```

## API

### Adapter factories

Import the adapter factory for your charting library from its sub-path export. Do not import from the main entry — this ensures only your chosen adapter is bundled.

```ts
import {createChartJsAdapter} from '@nostrwatch/relay-charts/chartjs'
import {createEChartsAdapter} from '@nostrwatch/relay-charts/echarts'
import {createRechartsAdapter} from '@nostrwatch/relay-charts/recharts'
```

Each factory returns an object that implements `ChartAdapter`.

### `ChartAdapter` interface

All adapters implement this interface:

```ts
interface ChartAdapter<TConfig, TInstance> {
  readonly name: string
  createTimeSeriesChart(data: TimeSeriesPoint[], options?: ChartOptions): TConfig
  createTimelineChart(data: UptimePeriod[], options?: ChartOptions): TConfig
  createStateChart(data: StateChange[], options?: ChartOptions): TConfig
  createChart(chartData: ChartData, options?: ChartOptions): TConfig
  initialize?(container: HTMLElement, config: TConfig): TInstance
  update?(instance: TInstance, chartData: ChartData, options?: ChartOptions): void
  destroy?(instance: TInstance): void
}
```

**`createTimeSeriesChart(data, options?)`** — Renders continuous values over time (RTT, latency). Expects `TimeSeriesPoint[]`.

**`createTimelineChart(data, options?)`** — Renders uptime/downtime periods as a timeline. Expects `UptimePeriod[]` from `relay-chronicle`.

**`createStateChart(data, options?)`** — Renders field value changes over time (software version, ASN). Expects `StateChange[]`.

**`initialize(container, config)`** — Mounts the chart to a DOM element. Returns the chart instance (type varies by adapter).

**`destroy(instance)`** — Cleans up a mounted chart instance.

### Data types

```ts
interface TimeSeriesPoint {
  timestamp: number  // Unix timestamp
  value: number
  label?: string
}

interface UptimePeriod {
  start: number      // Unix timestamp
  end: number | null // null if ongoing
  online: boolean
  rtt?: number
}

interface StateChange {
  timestamp: number  // Unix timestamp
  from: any
  to: any
  field: string
}
```

### `ChartOptions`

All adapters accept a common options object:

```ts
interface ChartOptions {
  width?: number
  height?: number
  title?: string
  theme?: 'light' | 'dark'
  colors?: {
    online?: string
    offline?: string
    primary?: string
    secondary?: string
    background?: string
    text?: string
  }
  timeRange?: {start?: number; end?: number}
  showLegend?: boolean
  showGrid?: boolean
  showTooltip?: boolean
  animation?: boolean
  responsive?: boolean
}
```

### Utility functions

Transform and aggregate relay-chronicle data before passing to an adapter:

```ts
import {
  transformUptimeHistory,
  transformChangeHistory,
  extractRttTimeSeries,
  calculateUptimePercentage,
  aggregateTimeSeries,
  filterByTimeRange
} from '@nostrwatch/relay-charts'
```

| Function | Description |
|----------|-------------|
| `extractRttTimeSeries(periods)` | Extracts RTT values from `UptimePeriod[]` as `TimeSeriesPoint[]` |
| `calculateUptimePercentage(periods, range)` | Returns uptime percentage over a given time range |
| `aggregateTimeSeries(series, bucketSecs, method)` | Downsamples a series into time buckets (`'avg'`, `'max'`, `'min'`) |
| `filterByTimeRange(series, start, end)` | Filters a series to a unix timestamp range |
| `transformUptimeHistory(periods)` | Converts `UptimePeriod[]` to the adapter-ready `ChartData` format |
| `transformChangeHistory(changes)` | Converts `ChangeInfo[]` to `TimeSeriesPoint[]` |

### TypeScript exports

```ts
import type {
  ChartAdapter,
  ChartData,
  ChartOptions,
  TimeSeriesPoint,
  UptimePeriod,
  StateChange
} from '@nostrwatch/relay-charts'

import type {ChartJsConfig} from '@nostrwatch/relay-charts/chartjs'
import type {EChartsConfig} from '@nostrwatch/relay-charts/echarts'
import type {RechartsConfig} from '@nostrwatch/relay-charts/recharts'
```

### Creating a custom adapter

Implement `ChartAdapter` to support any charting library:

```ts
import type {ChartAdapter, ChartData, ChartOptions} from '@nostrwatch/relay-charts'

class MyAdapter implements ChartAdapter<MyConfig, MyInstance> {
  readonly name = 'mycharts'

  createTimeSeriesChart(data: TimeSeriesPoint[], options?: ChartOptions): MyConfig {
    return {/* transform data to your library's format */}
  }

  createTimelineChart(data: UptimePeriod[], options?: ChartOptions): MyConfig {
    return {/* ... */}
  }

  createStateChart(data: StateChange[], options?: ChartOptions): MyConfig {
    return {/* ... */}
  }

  createChart(chartData: ChartData, options?: ChartOptions): MyConfig {
    if (chartData.type === 'timeseries') return this.createTimeSeriesChart(chartData.data, options)
    if (chartData.type === 'timeline') return this.createTimelineChart(chartData.data, options)
    return this.createStateChart(chartData.data, options)
  }

  initialize(container: HTMLElement, config: MyConfig): MyInstance {
    return myLib.mount(container, config)
  }

  destroy(instance: MyInstance): void {
    instance.dispose()
  }
}
```

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/relay-chronicle`](../relay-chronicle/README.md) — data source; relay-charts consumes `UptimePeriod[]` and `ChangeInfo[]` produced by relay-chronicle
- [`@nostrwatch/route66`](../route66/README.md) — persistent relay state management that wraps relay-chronicle
- [`apps/gui`](../../apps/gui/README.md) — primary consumer; the nostr-watch GUI uses relay-charts for relay monitoring dashboards

## License

[MIT](../../LICENSE)

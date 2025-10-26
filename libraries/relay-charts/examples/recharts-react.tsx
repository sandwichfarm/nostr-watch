/**
 * Recharts React Example
 *
 * Usage:
 * 1. npm install recharts react react-dom @nostrwatch/relay-charts
 * 2. Add this component to your React app
 */

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { createRechartsAdapter } from '@nostrwatch/relay-charts/recharts';
import type { TimeSeriesPoint, UptimePeriod, StateChange } from '@nostrwatch/relay-charts';

// Sample data generators
function generateRttData(): TimeSeriesPoint[] {
  return Array.from({ length: 50 }, (_, i) => ({
    timestamp: Date.now() / 1000 - (50 - i) * 300,
    value: 100 + Math.random() * 100,
    label: 'RTT (ms)',
  }));
}

function generateUptimeData(): UptimePeriod[] {
  const now = Date.now() / 1000;
  return [
    { start: now - 14400, end: now - 10800, online: true, rtt: 145 },
    { start: now - 10800, end: now - 7200, online: false },
    { start: now - 7200, end: now - 3600, online: true, rtt: 152 },
    { start: now - 3600, end: now - 1800, online: false },
    { start: now - 1800, end: now, online: true, rtt: 138 },
  ];
}

function generateStateData(): StateChange[] {
  const now = Date.now() / 1000;
  return [
    { timestamp: now - 7200, from: null, to: 'v2.0.0', field: 'software' },
    { timestamp: now - 5400, from: 'v2.0.0', to: 'v2.1.0', field: 'software' },
    { timestamp: now - 3600, from: 'v2.1.0', to: 'v2.1.1', field: 'software' },
    { timestamp: now - 7000, from: 10, to: 15, field: 'supported_nips' },
    { timestamp: now - 4000, from: 15, to: 18, field: 'supported_nips' },
  ];
}

// RTT Chart Component
export function RttChart() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const adapter = createRechartsAdapter();
    const data = generateRttData();
    const chartConfig = adapter.createTimeSeriesChart(data, {
      title: 'Response Time Over Last 4 Hours',
      theme: 'light',
      showGrid: true,
      showTooltip: true,
    });
    setConfig(chartConfig);
  }, []);

  if (!config) return <div>Loading...</div>;

  return (
    <div>
      <h2>{config.components.Area?.[0]?.name || 'RTT Chart'}</h2>
      <ResponsiveContainer {...config.containerProps}>
        <AreaChart data={config.data} margin={config.margin}>
          {config.components.CartesianGrid && (
            <CartesianGrid {...config.components.CartesianGrid} />
          )}
          <XAxis {...config.components.XAxis} />
          <YAxis {...config.components.YAxis} />
          {config.components.Tooltip && <Tooltip {...config.components.Tooltip} />}
          {config.components.Legend && <Legend {...config.components.Legend} />}
          {config.components.Area?.map((areaProps: any, i: number) => (
            <Area key={i} {...areaProps} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Timeline Chart Component
export function TimelineChart() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const adapter = createRechartsAdapter();
    const data = generateUptimeData();
    const chartConfig = adapter.createTimelineChart(data, {
      title: 'Relay Uptime/Downtime Periods',
      theme: 'light',
      showGrid: true,
      showTooltip: true,
    });
    setConfig(chartConfig);
  }, []);

  if (!config) return <div>Loading...</div>;

  return (
    <div>
      <h2>Uptime Timeline</h2>
      <ResponsiveContainer {...config.containerProps}>
        <BarChart
          data={config.data}
          margin={config.margin}
          layout={config.layout}
        >
          {config.components.CartesianGrid && (
            <CartesianGrid {...config.components.CartesianGrid} />
          )}
          <XAxis {...config.components.XAxis} />
          <YAxis {...config.components.YAxis} />
          {config.components.Tooltip && <Tooltip {...config.components.Tooltip} />}
          {config.components.Legend && <Legend {...config.components.Legend} />}
          {config.components.Bar?.map((barProps: any, i: number) => (
            <Bar key={i} {...barProps} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// State Changes Chart Component
export function StateChangesChart() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const adapter = createRechartsAdapter();
    const data = generateStateData();
    const chartConfig = adapter.createStateChart(data, {
      title: 'Relay Configuration Changes',
      theme: 'light',
      showGrid: true,
      showTooltip: true,
      showLegend: true,
    });
    setConfig(chartConfig);
  }, []);

  if (!config) return <div>Loading...</div>;

  return (
    <div>
      <h2>Configuration Changes</h2>
      <ResponsiveContainer {...config.containerProps}>
        <ScatterChart data={config.data} margin={config.margin}>
          {config.components.CartesianGrid && (
            <CartesianGrid {...config.components.CartesianGrid} />
          )}
          <XAxis {...config.components.XAxis} />
          <YAxis {...config.components.YAxis} />
          {config.components.Tooltip && <Tooltip {...config.components.Tooltip} />}
          {config.components.Legend && <Legend {...config.components.Legend} />}
          {config.components.Scatter?.map((scatterProps: any, i: number) => (
            <Scatter key={i} {...scatterProps} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// Main App Component
export default function App() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>@nostrwatch/relay-charts - Recharts Example</h1>

      <div style={{ marginBottom: '3rem' }}>
        <RttChart />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <TimelineChart />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <StateChangesChart />
      </div>
    </div>
  );
}

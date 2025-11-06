/**
 * Recharts adapter for relay chronicle charts
 *
 * Recharts is a composable charting library built with React components.
 * This adapter generates configuration objects that can be used with Recharts components.
 * https://recharts.org/
 */

import type {
  ChartAdapter,
  ChartData,
  ChartOptions,
  TimeSeriesPoint,
  UptimePeriod,
  StateChange,
} from '../types/index.ts';

/**
 * Recharts configuration (component props)
 */
export interface RechartsConfig {
  type: 'line' | 'area' | 'bar' | 'scatter' | 'composed';
  data: any[];
  layout?: 'horizontal' | 'vertical';
  margin?: { top: number; right: number; bottom: number; left: number };
  components: {
    CartesianGrid?: any;
    XAxis?: any;
    YAxis?: any;
    Tooltip?: any;
    Legend?: any;
    Line?: any[];
    Area?: any[];
    Bar?: any[];
    Scatter?: any[];
    [key: string]: any;
  };
  containerProps?: {
    width?: number | string;
    height?: number | string;
    [key: string]: any;
  };
}

/**
 * Recharts adapter implementation
 *
 * Note: This adapter generates configuration objects for Recharts components.
 * It does not create chart instances directly since Recharts is React-based.
 */
export class RechartsAdapter implements ChartAdapter<RechartsConfig, null> {
  readonly name = 'recharts';

  /**
   * Create a time series line chart configuration
   */
  createTimeSeriesChart(
    data: TimeSeriesPoint[],
    options?: ChartOptions
  ): RechartsConfig {
    const colors = this.getColors(options);

    // Transform data for Recharts
    const chartData = data.map(d => ({
      timestamp: d.timestamp * 1000,
      value: typeof d.value === 'number' ? d.value : 0,
      label: d.label,
      formattedTime: new Date(d.timestamp * 1000).toLocaleString(),
    }));

    return {
      type: 'area',
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
      components: {
        CartesianGrid: options?.showGrid !== false ? {
          strokeDasharray: '3 3',
          stroke: this.hexToRgba(colors.text, 0.1),
        } : undefined,
        XAxis: {
          dataKey: 'timestamp',
          type: 'number',
          domain: ['dataMin', 'dataMax'],
          scale: 'time',
          tickFormatter: (timestamp: number) => new Date(timestamp).toLocaleDateString(),
          stroke: colors.text,
        },
        YAxis: {
          stroke: colors.text,
        },
        Tooltip: options?.showTooltip !== false ? {
          labelFormatter: (timestamp: number) => new Date(timestamp).toLocaleString(),
          contentStyle: {
            backgroundColor: colors.background,
            border: `1px solid ${colors.text}`,
            color: colors.text,
          },
        } : undefined,
        Legend: options?.showLegend !== false ? {
          wrapperStyle: { color: colors.text },
        } : undefined,
        Area: [{
          type: 'monotone',
          dataKey: 'value',
          stroke: colors.primary,
          fill: colors.primary,
          fillOpacity: 0.3,
          strokeWidth: 2,
          dot: { fill: colors.primary, r: 3 },
          activeDot: { r: 5 },
          name: options?.title || 'Value',
          isAnimationActive: options?.animation !== false,
        }],
      },
      containerProps: {
        width: options?.width || '100%',
        height: options?.height || 400,
      },
    };
  }

  /**
   * Create uptime/downtime timeline chart configuration
   */
  createTimelineChart(
    data: UptimePeriod[],
    options?: ChartOptions
  ): RechartsConfig {
    const colors = this.getColors(options);

    // Transform data for Recharts bar chart
    const chartData = data.map((period, index) => {
      const start = period.start * 1000;
      const end = (period.end || Date.now() / 1000) * 1000;
      const duration = (end - start) / 1000 / 60; // minutes

      return {
        index,
        period: `Period ${index + 1}`,
        start,
        end,
        duration,
        status: period.online ? 'Online' : 'Offline',
        fill: period.online ? colors.online : colors.offline,
        rtt: period.rtt,
        formattedStart: new Date(start).toLocaleString(),
        formattedEnd: new Date(end).toLocaleString(),
      };
    });

    return {
      type: 'bar',
      data: chartData,
      layout: 'vertical',
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      components: {
        CartesianGrid: options?.showGrid !== false ? {
          strokeDasharray: '3 3',
          stroke: this.hexToRgba(colors.text, 0.1),
        } : undefined,
        XAxis: {
          type: 'number',
          stroke: colors.text,
        },
        YAxis: {
          type: 'category',
          dataKey: 'period',
          stroke: colors.text,
        },
        Tooltip: options?.showTooltip !== false ? {
          formatter: (value: any, name: string, props: any) => {
            const { payload } = props;
            const hours = Math.floor(payload.duration / 60);
            const mins = Math.floor(payload.duration % 60);
            return [
              `Status: ${payload.status}`,
              `Duration: ${hours}h ${mins}m`,
              payload.rtt ? `RTT: ${Math.round(payload.rtt)}ms` : '',
            ].filter(Boolean);
          },
          labelFormatter: (value: any) => value,
          contentStyle: {
            backgroundColor: colors.background,
            border: `1px solid ${colors.text}`,
            color: colors.text,
          },
        } : undefined,
        Legend: options?.showLegend !== false ? {
          wrapperStyle: { color: colors.text },
        } : undefined,
        Bar: [{
          dataKey: 'duration',
          name: 'Duration (minutes)',
          // Note: fill color is provided in the data for each bar
          // Consumers should handle this via Cell components in their React code
          isAnimationActive: options?.animation !== false,
        }],
      },
      containerProps: {
        width: options?.width || '100%',
        height: options?.height || 400,
      },
    };
  }

  /**
   * Create state transitions chart configuration
   */
  createStateChart(
    data: StateChange[],
    options?: ChartOptions
  ): RechartsConfig {
    const colors = this.getColors(options);

    // Group by field
    const fieldMap = new Map<string, any[]>();

    for (const change of data) {
      if (!fieldMap.has(change.field)) {
        fieldMap.set(change.field, []);
      }
      fieldMap.get(change.field)!.push({
        timestamp: change.timestamp * 1000,
        value: change.to,
        from: change.from,
        field: change.field,
        formattedTime: new Date(change.timestamp * 1000).toLocaleString(),
      });
    }

    // Merge all field data into a single array with field-specific keys
    const chartData: any[] = [];
    const fields = Array.from(fieldMap.keys());

    // Create a unified dataset with all timestamps
    const allTimestamps = new Set<number>();
    for (const points of fieldMap.values()) {
      for (const point of points) {
        allTimestamps.add(point.timestamp);
      }
    }

    for (const timestamp of Array.from(allTimestamps).sort((a, b) => a - b)) {
      const dataPoint: any = {
        timestamp,
        formattedTime: new Date(timestamp).toLocaleString(),
      };

      for (const field of fields) {
        const fieldData = fieldMap.get(field)!;
        const point = fieldData.find(p => p.timestamp === timestamp);
        if (point) {
          dataPoint[field] = point.value;
        }
      }

      chartData.push(dataPoint);
    }

    // Create scatter series for each field
    const scatterSeries = fields.map((field, index) => ({
      dataKey: field,
      name: field,
      fill: this.getColorByIndex(index, colors),
      isAnimationActive: options?.animation !== false,
    }));

    return {
      type: 'scatter',
      data: chartData,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      components: {
        CartesianGrid: options?.showGrid !== false ? {
          strokeDasharray: '3 3',
          stroke: this.hexToRgba(colors.text, 0.1),
        } : undefined,
        XAxis: {
          dataKey: 'timestamp',
          type: 'number',
          domain: ['dataMin', 'dataMax'],
          scale: 'time',
          tickFormatter: (timestamp: number) => new Date(timestamp).toLocaleDateString(),
          stroke: colors.text,
        },
        YAxis: {
          stroke: colors.text,
        },
        Tooltip: options?.showTooltip !== false ? {
          labelFormatter: (timestamp: number) => new Date(timestamp).toLocaleString(),
          contentStyle: {
            backgroundColor: colors.background,
            border: `1px solid ${colors.text}`,
            color: colors.text,
          },
        } : undefined,
        Legend: options?.showLegend !== false ? {
          wrapperStyle: { color: colors.text },
        } : undefined,
        Scatter: scatterSeries,
      },
      containerProps: {
        width: options?.width || '100%',
        height: options?.height || 400,
      },
    };
  }

  /**
   * Create chart from generic ChartData
   */
  createChart(chartData: ChartData, options?: ChartOptions): RechartsConfig {
    switch (chartData.type) {
      case 'timeseries':
        return this.createTimeSeriesChart(
          chartData.data as TimeSeriesPoint[],
          options
        );
      case 'timeline':
        return this.createTimelineChart(
          chartData.data as UptimePeriod[],
          options
        );
      case 'state':
        return this.createStateChart(
          chartData.data as StateChange[],
          options
        );
      default:
        throw new Error(`Unsupported chart type: ${chartData.type}`);
    }
  }

  /**
   * Recharts is React-based, so there's no imperative initialization
   * Consumers should use the config with Recharts components directly
   */
  initialize(): null {
    throw new Error(
      'Recharts is React-based and does not support imperative initialization. ' +
      'Use the config object with Recharts components in your React application.'
    );
  }

  /**
   * Get color scheme
   */
  private getColors(options?: ChartOptions) {
    const theme = options?.theme || 'light';
    const defaultColors = theme === 'dark' ? {
      online: '#10b981',
      offline: '#ef4444',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      background: '#1f2937',
      text: '#f3f4f6',
    } : {
      online: '#10b981',
      offline: '#ef4444',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      background: '#ffffff',
      text: '#1f2937',
    };

    return { ...defaultColors, ...options?.colors };
  }

  /**
   * Get color by index for multiple datasets
   */
  private getColorByIndex(index: number, colors: any): string {
    const palette = [
      colors.primary,
      colors.secondary,
      '#f59e0b',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
    ];
    return palette[index % palette.length];
  }

  /**
   * Convert hex color to rgba
   */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

/**
 * Create a new Recharts adapter instance
 */
export function createRechartsAdapter(): RechartsAdapter {
  return new RechartsAdapter();
}

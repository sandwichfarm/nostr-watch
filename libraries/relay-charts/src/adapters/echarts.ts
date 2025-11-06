/**
 * Apache ECharts adapter for relay chronicle charts
 *
 * ECharts is a powerful, feature-rich charting library with excellent support
 * for complex visualizations and interactions.
 * https://echarts.apache.org/
 */

import type {
  ChartAdapter,
  ChartData,
  ChartOptions,
  TimeSeriesPoint,
  UptimePeriod,
  StateChange,
} from '../types/index.ts';

// ECharts types (will be provided by peer dependency)
export interface EChartsConfig {
  title?: {
    text?: string;
    textStyle?: any;
  };
  tooltip?: any;
  legend?: any;
  grid?: any;
  xAxis?: any;
  yAxis?: any;
  series?: any[];
  toolbox?: any;
  dataZoom?: any[];
  backgroundColor?: string;
  [key: string]: any;
}

/**
 * Apache ECharts adapter implementation
 */
export class EChartsAdapter implements ChartAdapter<EChartsConfig, any> {
  readonly name = 'echarts';

  /**
   * Create a time series line chart
   */
  createTimeSeriesChart(
    data: TimeSeriesPoint[],
    options?: ChartOptions
  ): EChartsConfig {
    const colors = this.getColors(options);

    return {
      title: options?.title ? {
        text: options.title,
        textStyle: { color: colors.text },
      } : undefined,
      tooltip: options?.showTooltip !== false ? {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
      } : undefined,
      legend: options?.showLegend !== false ? {
        data: ['Value'],
        textStyle: { color: colors.text },
      } : undefined,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
        borderColor: this.hexToRgba(colors.text, 0.1),
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          color: colors.text,
        },
        axisLine: {
          lineStyle: { color: this.hexToRgba(colors.text, 0.2) },
        },
        splitLine: {
          show: options?.showGrid !== false,
          lineStyle: { color: this.hexToRgba(colors.text, 0.1) },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: colors.text,
        },
        axisLine: {
          lineStyle: { color: this.hexToRgba(colors.text, 0.2) },
        },
        splitLine: {
          show: options?.showGrid !== false,
          lineStyle: { color: this.hexToRgba(colors.text, 0.1) },
        },
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          start: 0,
          end: 100,
          textStyle: { color: colors.text },
        },
      ],
      series: [{
        name: 'Value',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          color: colors.primary,
          width: 2,
        },
        itemStyle: {
          color: colors.primary,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: this.hexToRgba(colors.primary, 0.3) },
              { offset: 1, color: this.hexToRgba(colors.primary, 0.05) },
            ],
          },
        },
        data: data.map(d => [
          d.timestamp * 1000,
          typeof d.value === 'number' ? d.value : 0,
        ]),
      }],
      backgroundColor: colors.background,
      animation: options?.animation !== false,
    };
  }

  /**
   * Create uptime/downtime timeline chart
   */
  createTimelineChart(
    data: UptimePeriod[],
    options?: ChartOptions
  ): EChartsConfig {
    const colors = this.getColors(options);

    // Transform periods into custom series data
    const seriesData = data.map((period, index) => {
      const start = period.start * 1000;
      const end = (period.end || Date.now() / 1000) * 1000;

      return {
        name: period.online ? 'Online' : 'Offline',
        value: [index, start, end, end - start],
        itemStyle: {
          color: period.online ? colors.online : colors.offline,
        },
      };
    });

    return {
      title: options?.title ? {
        text: options.title,
        textStyle: { color: colors.text },
      } : undefined,
      tooltip: options?.showTooltip !== false ? {
        formatter: (params: any) => {
          const period = data[params.value[0]];
          const start = new Date(params.value[1]);
          const end = new Date(params.value[2]);
          const duration = params.value[3] / 1000 / 60; // minutes
          const hours = Math.floor(duration / 60);
          const mins = Math.floor(duration % 60);

          return [
            `<b>${period.online ? 'Online' : 'Offline'}</b>`,
            `Start: ${start.toLocaleString()}`,
            `End: ${end.toLocaleString()}`,
            `Duration: ${hours}h ${mins}m`,
            period.rtt ? `RTT: ${Math.round(period.rtt)}ms` : '',
          ].filter(Boolean).join('<br/>');
        },
      } : undefined,
      legend: options?.showLegend !== false ? {
        data: ['Online', 'Offline'],
        textStyle: { color: colors.text },
      } : undefined,
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: options?.title ? '15%' : '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          color: colors.text,
        },
        axisLine: {
          lineStyle: { color: this.hexToRgba(colors.text, 0.2) },
        },
        splitLine: {
          show: options?.showGrid !== false,
          lineStyle: { color: this.hexToRgba(colors.text, 0.1) },
        },
      },
      yAxis: {
        type: 'category',
        data: data.map((_, i) => `Period ${i + 1}`),
        axisLabel: {
          color: colors.text,
        },
        axisLine: {
          lineStyle: { color: this.hexToRgba(colors.text, 0.2) },
        },
        splitLine: {
          show: false,
        },
      },
      series: [{
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const categoryIndex = api.value(0);
          const start = api.coord([api.value(1), categoryIndex]);
          const end = api.coord([api.value(2), categoryIndex]);
          const height = api.size([0, 1])[1] * 0.6;

          return {
            type: 'rect',
            shape: {
              x: start[0],
              y: start[1] - height / 2,
              width: end[0] - start[0],
              height: height,
            },
            style: api.style(),
          };
        },
        encode: {
          x: [1, 2],
          y: 0,
        },
        data: seriesData,
      }],
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'weakFilter',
          textStyle: { color: colors.text },
        },
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'weakFilter',
        },
      ],
      backgroundColor: colors.background,
      animation: options?.animation !== false,
    };
  }

  /**
   * Create state transitions chart
   */
  createStateChart(
    data: StateChange[],
    options?: ChartOptions
  ): EChartsConfig {
    const colors = this.getColors(options);

    // Group by field
    const fieldMap = new Map<string, Array<[number, any]>>();

    for (const change of data) {
      if (!fieldMap.has(change.field)) {
        fieldMap.set(change.field, []);
      }
      fieldMap.get(change.field)!.push([change.timestamp * 1000, change.to]);
    }

    const series = Array.from(fieldMap.entries()).map(([field, points], index) => ({
      name: field,
      type: 'scatter',
      symbolSize: 10,
      data: points,
      itemStyle: {
        color: this.getColorByIndex(index, colors),
      },
    }));

    return {
      title: options?.title ? {
        text: options.title,
        textStyle: { color: colors.text },
      } : undefined,
      tooltip: options?.showTooltip !== false ? {
        trigger: 'item',
        formatter: (params: any) => {
          const timestamp = new Date(params.value[0]);
          return [
            `<b>${params.seriesName}</b>`,
            `Time: ${timestamp.toLocaleString()}`,
            `Value: ${JSON.stringify(params.value[1])}`,
          ].join('<br/>');
        },
      } : undefined,
      legend: options?.showLegend !== false ? {
        data: Array.from(fieldMap.keys()),
        textStyle: { color: colors.text },
      } : undefined,
      grid: {
        left: '3%',
        right: '7%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          color: colors.text,
        },
        axisLine: {
          lineStyle: { color: this.hexToRgba(colors.text, 0.2) },
        },
        splitLine: {
          show: options?.showGrid !== false,
          lineStyle: { color: this.hexToRgba(colors.text, 0.1) },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: colors.text,
        },
        axisLine: {
          lineStyle: { color: this.hexToRgba(colors.text, 0.2) },
        },
        splitLine: {
          show: options?.showGrid !== false,
          lineStyle: { color: this.hexToRgba(colors.text, 0.1) },
        },
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          textStyle: { color: colors.text },
        },
      ],
      series,
      backgroundColor: colors.background,
      animation: options?.animation !== false,
    };
  }

  /**
   * Create chart from generic ChartData
   */
  createChart(chartData: ChartData, options?: ChartOptions): EChartsConfig {
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
   * Initialize ECharts instance
   * Note: Requires ECharts to be imported in the consuming application
   */
  initialize(container: HTMLElement, config: EChartsConfig): any {
    // This requires ECharts to be available
    // The consuming application must import ECharts
    if (typeof (globalThis as any).echarts === 'undefined') {
      throw new Error(
        'ECharts is not available. Please import ECharts before using this adapter.'
      );
    }

    const echarts = (globalThis as any).echarts;
    const chart = echarts.init(container);
    chart.setOption(config);
    return chart;
  }

  /**
   * Update existing chart
   */
  update(instance: any, chartData: ChartData, options?: ChartOptions): void {
    const newConfig = this.createChart(chartData, options);
    instance.setOption(newConfig, true);
  }

  /**
   * Destroy chart instance
   */
  destroy(instance: any): void {
    if (instance && typeof instance.dispose === 'function') {
      instance.dispose();
    }
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
 * Create a new ECharts adapter instance
 */
export function createEChartsAdapter(): EChartsAdapter {
  return new EChartsAdapter();
}

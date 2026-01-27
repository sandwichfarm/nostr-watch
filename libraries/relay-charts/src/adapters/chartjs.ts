/**
 * Chart.js adapter for relay chronicle charts
 *
 * Chart.js is a popular, simple, canvas-based charting library.
 * https://www.chartjs.org/
 */

import type {
  ChartAdapter,
  ChartData,
  ChartOptions,
  TimeSeriesPoint,
  UptimePeriod,
  StateChange,
} from '../types/index.ts';

// Chart.js types (will be provided by peer dependency)
export interface ChartJsConfig {
  type: string;
  data: {
    labels?: any[];
    datasets: Array<{
      label?: string;
      data: any[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
      tension?: number;
      pointRadius?: number;
      [key: string]: any;
    }>;
  };
  options?: {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    scales?: any;
    plugins?: any;
    [key: string]: any;
  };
}

/**
 * Chart.js adapter implementation
 */
export class ChartJsAdapter implements ChartAdapter<ChartJsConfig, any> {
  readonly name = 'chartjs';

  /**
   * Create a time series line chart
   */
  createTimeSeriesChart(
    data: TimeSeriesPoint[],
    options?: ChartOptions
  ): ChartJsConfig {
    const colors = this.getColors(options);

    return {
      type: 'line',
      data: {
        labels: data.map(d => new Date(d.timestamp * 1000)),
        datasets: [{
          label: options?.title || 'Value',
          data: data.map(d => typeof d.value === 'number' ? d.value : 0),
          borderColor: colors.primary,
          backgroundColor: this.hexToRgba(colors.primary, 0.1),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
        }],
      },
      options: {
        responsive: options?.responsive !== false,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                hour: 'MMM d, HH:mm',
                day: 'MMM d',
              },
            },
            grid: {
              display: options?.showGrid !== false,
              color: this.hexToRgba(colors.text, 0.1),
            },
            ticks: {
              color: colors.text,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              display: options?.showGrid !== false,
              color: this.hexToRgba(colors.text, 0.1),
            },
            ticks: {
              color: colors.text,
            },
          },
        },
        plugins: {
          legend: {
            display: options?.showLegend !== false,
            labels: {
              color: colors.text,
            },
          },
          tooltip: {
            enabled: options?.showTooltip !== false,
            mode: 'index',
            intersect: false,
          },
          title: options?.title ? {
            display: true,
            text: options.title,
            color: colors.text,
          } : undefined,
        },
        animation: options?.animation !== false ? {} : false,
      },
    };
  }

  /**
   * Create uptime/downtime timeline chart (bar chart)
   */
  createTimelineChart(
    data: UptimePeriod[],
    options?: ChartOptions
  ): ChartJsConfig {
    const colors = this.getColors(options);

    // Transform periods into bar chart data
    const labels: Date[] = [];
    const values: number[] = [];
    const backgroundColors: string[] = [];

    for (const period of data) {
      const start = new Date(period.start * 1000);
      const end = period.end ? new Date(period.end * 1000) : new Date();
      const duration = (end.getTime() - start.getTime()) / 1000 / 60; // minutes

      labels.push(start);
      values.push(duration);
      backgroundColors.push(period.online ? colors.online : colors.offline);
    }

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Duration (minutes)',
          data: values,
          backgroundColor: backgroundColors,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: options?.responsive !== false,
        maintainAspectRatio: false,
        indexAxis: 'y', // Horizontal bars
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              display: options?.showGrid !== false,
              color: this.hexToRgba(colors.text, 0.1),
            },
            ticks: {
              color: colors.text,
            },
          },
          y: {
            type: 'time',
            grid: {
              display: false,
            },
            ticks: {
              color: colors.text,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: options?.showTooltip !== false,
            callbacks: {
              label: (context: any) => {
                const period = data[context.dataIndex];
                const mins = context.parsed.x;
                const hours = Math.floor(mins / 60);
                const remainingMins = Math.floor(mins % 60);
                return [
                  `Status: ${period.online ? 'Online' : 'Offline'}`,
                  `Duration: ${hours}h ${remainingMins}m`,
                  period.rtt ? `RTT: ${Math.round(period.rtt)}ms` : '',
                ].filter(Boolean);
              },
            },
          },
          title: options?.title ? {
            display: true,
            text: options.title,
            color: colors.text,
          } : undefined,
        },
        animation: options?.animation !== false ? {} : false,
      },
    };
  }

  /**
   * Create state transitions chart (scatter plot)
   */
  createStateChart(
    data: StateChange[],
    options?: ChartOptions
  ): ChartJsConfig {
    const colors = this.getColors(options);

    // Group by field
    const fieldMap = new Map<string, Array<{ x: Date; y: any }>>();

    for (const change of data) {
      if (!fieldMap.has(change.field)) {
        fieldMap.set(change.field, []);
      }
      fieldMap.get(change.field)!.push({
        x: new Date(change.timestamp * 1000),
        y: change.to,
      });
    }

    const datasets = Array.from(fieldMap.entries()).map(([field, points], index) => ({
      label: field,
      data: points,
      backgroundColor: this.getColorByIndex(index, colors),
      borderColor: this.getColorByIndex(index, colors),
      pointRadius: 5,
      pointHoverRadius: 7,
    }));

    return {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: options?.responsive !== false,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                hour: 'MMM d, HH:mm',
                day: 'MMM d',
              },
            },
            grid: {
              display: options?.showGrid !== false,
              color: this.hexToRgba(colors.text, 0.1),
            },
            ticks: {
              color: colors.text,
            },
          },
          y: {
            grid: {
              display: options?.showGrid !== false,
              color: this.hexToRgba(colors.text, 0.1),
            },
            ticks: {
              color: colors.text,
            },
          },
        },
        plugins: {
          legend: {
            display: options?.showLegend !== false,
            labels: {
              color: colors.text,
            },
          },
          tooltip: {
            enabled: options?.showTooltip !== false,
            callbacks: {
              label: (context: any) => {
                const change = data[context.dataIndex];
                return [
                  `Field: ${change.field}`,
                  `From: ${JSON.stringify(change.from)}`,
                  `To: ${JSON.stringify(change.to)}`,
                ];
              },
            },
          },
          title: options?.title ? {
            display: true,
            text: options.title,
            color: colors.text,
          } : undefined,
        },
        animation: options?.animation !== false ? {} : false,
      },
    };
  }

  /**
   * Create chart from generic ChartData
   */
  createChart(chartData: ChartData, options?: ChartOptions): ChartJsConfig {
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
   * Initialize Chart.js instance
   * Note: Requires Chart.js to be imported in the consuming application
   */
  initialize(container: HTMLElement, config: ChartJsConfig): any {
    // Get canvas element or create one
    let canvas = container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
    }

    // This requires Chart.js to be available globally or imported
    // The consuming application must import Chart.js
    if (typeof (globalThis as any).Chart === 'undefined') {
      throw new Error(
        'Chart.js is not available. Please import Chart.js before using this adapter.'
      );
    }

    const Chart = (globalThis as any).Chart;
    return new Chart(canvas.getContext('2d'), config);
  }

  /**
   * Update existing chart
   */
  update(instance: any, chartData: ChartData, options?: ChartOptions): void {
    const newConfig = this.createChart(chartData, options);
    instance.data = newConfig.data;
    instance.options = newConfig.options;
    instance.update();
  }

  /**
   * Destroy chart instance
   */
  destroy(instance: any): void {
    if (instance && typeof instance.destroy === 'function') {
      instance.destroy();
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
 * Create a new Chart.js adapter instance
 */
export function createChartJsAdapter(): ChartJsAdapter {
  return new ChartJsAdapter();
}

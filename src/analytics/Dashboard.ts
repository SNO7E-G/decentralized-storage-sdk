import { AnalyticsReport, AnalyticsFilters } from './AnalyticsCollector';
import { AnalyticsEventType } from '../core/types';

/**
 * Analytics Dashboard
 * Provides methods for visualizing SDK analytics data
 */
export class Dashboard {
  /**
   * Creates a new Analytics Dashboard
   */
  constructor() {
    // Dashboard initialization logic would go here
    console.log('Analytics Dashboard initialized');
  }
  
  /**
   * Generates an analytics dashboard with various metrics and visualizations
   * @param report The analytics report to visualize
   * @returns Dashboard data suitable for rendering
   */
  public generateDashboard(report: AnalyticsReport): DashboardData {
    // Extract date range for header
    const startDate = report.timeRange.start.toLocaleDateString();
    const endDate = report.timeRange.end.toLocaleDateString();
    
    // Create metrics cards data
    const metrics = this.generateMetricsCards(report);
    
    // Generate chart data
    const charts = this.generateCharts(report);
    
    // Create dashboard data object
    return {
      title: `Storage SDK Analytics: ${startDate} to ${endDate}`,
      timeRange: {
        start: report.timeRange.start,
        end: report.timeRange.end
      },
      metrics,
      charts,
      topContent: this.getTopContent(report),
      topRegions: this.getTopRegions(report),
      recentActivity: this.getRecentActivity(report)
    };
  }
  
  /**
   * Creates metrics cards for the dashboard
   * @param report The analytics report
   * @returns Array of metric cards
   */
  private generateMetricsCards(report: AnalyticsReport): MetricCard[] {
    const metrics: MetricCard[] = [];
    
    // Total operations count
    metrics.push({
      title: 'Total Operations',
      value: report.totalEvents,
      unit: 'ops',
      change: {
        direction: 'up',
        percentage: 0 // In a real app, we'd compare to previous period
      }
    });
    
    // Uploads count
    const uploads = report.eventCounts[AnalyticsEventType.UPLOAD] || 0;
    metrics.push({
      title: 'Uploads',
      value: uploads,
      unit: 'files',
      color: '#4CAF50', // Green
      change: {
        direction: 'up',
        percentage: 0
      }
    });
    
    // Downloads count
    const downloads = report.eventCounts[AnalyticsEventType.DOWNLOAD] || 0;
    metrics.push({
      title: 'Downloads',
      value: downloads,
      unit: 'files',
      color: '#2196F3', // Blue
      change: {
        direction: 'up',
        percentage: 0
      }
    });
    
    // Error count
    const errors = report.eventCounts[AnalyticsEventType.ERROR] || 0;
    metrics.push({
      title: 'Errors',
      value: errors,
      unit: 'errors',
      color: '#F44336', // Red
      change: {
        direction: errors > 0 ? 'up' : 'down',
        percentage: 0
      }
    });
    
    // Data transferred
    metrics.push({
      title: 'Data Transferred',
      value: this.formatBytes(report.totalTransferredBytes),
      rawValue: report.totalTransferredBytes,
      change: {
        direction: 'up',
        percentage: 0
      }
    });
    
    // Average response time
    metrics.push({
      title: 'Avg Response Time',
      value: report.averageResponseTime.toFixed(2),
      unit: 'ms',
      color: '#FF9800', // Orange
      change: {
        direction: 'neutral',
        percentage: 0
      }
    });
    
    // Cache hit ratio (if available)
    if (report.cacheHitRatio !== undefined) {
      const hitRatioPercentage = (report.cacheHitRatio * 100).toFixed(1);
      metrics.push({
        title: 'Cache Hit Ratio',
        value: hitRatioPercentage,
        unit: '%',
        color: '#9C27B0', // Purple
        change: {
          direction: 'neutral',
          percentage: 0
        }
      });
    }
    
    return metrics;
  }
  
  /**
   * Generates chart data for the dashboard
   * @param report The analytics report
   * @returns Array of chart configurations
   */
  private generateCharts(report: AnalyticsReport): ChartConfig[] {
    const charts: ChartConfig[] = [];
    
    // Operations by type pie chart
    charts.push({
      type: 'pie',
      title: 'Operations by Type',
      data: Object.entries(report.eventCounts).map(([type, count]) => ({
        label: type,
        value: count
      }))
    });
    
    // Geographic distribution map
    charts.push({
      type: 'map',
      title: 'Geographic Distribution',
      data: Object.entries(report.geoDistribution).map(([country, data]) => ({
        region: country,
        value: data.count
      }))
    });
    
    // Response time histogram (simulated for example)
    charts.push({
      type: 'histogram',
      title: 'Response Time Distribution',
      data: this.simulateResponseTimeHistogram(report),
      xLabel: 'Response Time (ms)',
      yLabel: 'Number of Requests'
    });
    
    // Usage over time (simulated for example)
    charts.push({
      type: 'line',
      title: 'Usage Over Time',
      data: this.simulateTimeSeriesData(report),
      xLabel: 'Time',
      yLabel: 'Operations'
    });
    
    return charts;
  }
  
  /**
   * Gets the top content items by usage
   * @param report The analytics report
   * @returns Array of top content items
   */
  private getTopContent(report: AnalyticsReport): TopContentItem[] {
    // Convert content breakdown to array and sort by count
    return Object.entries(report.contentBreakdown)
      .map(([contentId, data]) => ({
        contentId,
        count: data.count,
        // In a real app, we'd include more details about the content
        type: 'unknown', // Would be determined from metadata
        size: 0 // Would be determined from metadata
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 items
  }
  
  /**
   * Gets the top geographic regions by usage
   * @param report The analytics report
   * @returns Array of top regions
   */
  private getTopRegions(report: AnalyticsReport): TopRegionItem[] {
    // Convert geo distribution to array and sort by count
    return Object.entries(report.geoDistribution)
      .map(([region, data]) => ({
        region,
        count: data.count,
        percentage: (data.count / report.totalEvents) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 regions
  }
  
  /**
   * Gets recent activity for the dashboard
   * @param report The analytics report
   * @returns Array of recent activity items
   */
  private getRecentActivity(report: AnalyticsReport): ActivityItem[] {
    // Sort events by timestamp (descending) and take the most recent 10
    return report.events
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)
      .map(event => ({
        timestamp: event.timestamp,
        type: event.type,
        contentId: event.contentId || 'unknown',
        userId: event.userId || 'anonymous',
        status: event.type === AnalyticsEventType.ERROR ? 'error' : 'success',
        details: event.properties ? JSON.stringify(event.properties) : undefined
      }));
  }
  
  /**
   * Formats bytes into a human-readable string
   * @param bytes Number of bytes
   * @returns Formatted string (e.g., "4.2 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Simulates response time histogram data (for demonstration)
   * @param report The analytics report
   * @returns Array of histogram data points
   */
  private simulateResponseTimeHistogram(report: AnalyticsReport): { bin: string, count: number }[] {
    // This is a simplified simulation - in a real app, we'd calculate actual bins
    const avgResponseTime = report.averageResponseTime || 100;
    
    return [
      { bin: '0-50ms', count: Math.floor(report.totalEvents * 0.3) },
      { bin: '50-100ms', count: Math.floor(report.totalEvents * 0.25) },
      { bin: '100-200ms', count: Math.floor(report.totalEvents * 0.2) },
      { bin: '200-500ms', count: Math.floor(report.totalEvents * 0.15) },
      { bin: '500ms+', count: Math.floor(report.totalEvents * 0.1) }
    ];
  }
  
  /**
   * Simulates time series data (for demonstration)
   * @param report The analytics report
   * @returns Array of time series data points
   */
  private simulateTimeSeriesData(report: AnalyticsReport): { time: Date, value: number }[] {
    // This is a simplified simulation - in a real app, we'd aggregate actual time data
    const result: { time: Date, value: number }[] = [];
    const startTime = report.timeRange.start.getTime();
    const endTime = report.timeRange.end.getTime();
    const timeRange = endTime - startTime;
    
    // Create 10 data points spread across the time range
    for (let i = 0; i < 10; i++) {
      const time = new Date(startTime + (timeRange * i / 9));
      const value = Math.floor(Math.random() * 50) + 10; // Random value between 10 and 60
      result.push({ time, value });
    }
    
    return result;
  }
}

/**
 * Dashboard data structure
 */
export interface DashboardData {
  /** Dashboard title */
  title: string;
  /** Time range covered by the dashboard */
  timeRange: {
    start: Date;
    end: Date;
  };
  /** Metrics cards */
  metrics: MetricCard[];
  /** Chart configurations */
  charts: ChartConfig[];
  /** Top content by usage */
  topContent: TopContentItem[];
  /** Top regions by usage */
  topRegions: TopRegionItem[];
  /** Recent activity */
  recentActivity: ActivityItem[];
}

/**
 * Metric card for the dashboard
 */
export interface MetricCard {
  /** Metric title */
  title: string;
  /** Metric value (formatted) */
  value: string | number;
  /** Raw numeric value (optional) */
  rawValue?: number;
  /** Unit of measurement (optional) */
  unit?: string;
  /** Metric color (optional) */
  color?: string;
  /** Change indicator */
  change: {
    /** Direction of change */
    direction: 'up' | 'down' | 'neutral';
    /** Percentage change */
    percentage: number;
  };
}

/**
 * Chart configuration
 */
export interface ChartConfig {
  /** Chart type */
  type: 'pie' | 'line' | 'bar' | 'map' | 'histogram';
  /** Chart title */
  title: string;
  /** Chart data (structure varies by chart type) */
  data: any[];
  /** X-axis label (for applicable charts) */
  xLabel?: string;
  /** Y-axis label (for applicable charts) */
  yLabel?: string;
}

/**
 * Top content item
 */
export interface TopContentItem {
  /** Content ID */
  contentId: string;
  /** Usage count */
  count: number;
  /** Content type */
  type: string;
  /** Content size in bytes */
  size: number;
}

/**
 * Top region item
 */
export interface TopRegionItem {
  /** Region name */
  region: string;
  /** Usage count */
  count: number;
  /** Percentage of total usage */
  percentage: number;
}

/**
 * Activity item
 */
export interface ActivityItem {
  /** Timestamp of the activity */
  timestamp: Date;
  /** Event type */
  type: string;
  /** Related content ID */
  contentId: string;
  /** User ID */
  userId: string;
  /** Activity status */
  status: 'success' | 'error' | 'warning' | 'info';
  /** Additional details */
  details?: string;
} 
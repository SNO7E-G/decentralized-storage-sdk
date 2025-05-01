import { AnalyticsEvent, AnalyticsEventType } from '../core/types';

/**
 * Analytics Collector
 * Collects and manages analytics data for the SDK
 */
export class AnalyticsCollector {
  private events: AnalyticsEvent[] = [];
  private isEnabled: boolean = true;
  private flushInterval: NodeJS.Timeout | null = null;
  
  /**
   * Creates a new Analytics Collector
   * @param options Configuration options
   */
  constructor(options: AnalyticsCollectorOptions = {}) {
    this.isEnabled = options.enabled !== false;
    
    // Set up periodic flushing of analytics if enabled
    if (this.isEnabled && options.autoFlush !== false) {
      const flushIntervalMs = options.flushIntervalMs || 300000; // Default: 5 minutes
      this.flushInterval = setInterval(() => this.flush(), flushIntervalMs);
    }
  }
  
  /**
   * Records an analytics event
   * @param event The event to record
   */
  public recordEvent(event: AnalyticsEvent): void {
    if (!this.isEnabled) {
      return;
    }
    
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = new Date();
    }
    
    // Store the event
    this.events.push(event);
    
    // If we've reached the buffer limit, flush the events
    if (this.events.length >= 1000) {
      this.flush();
    }
  }
  
  /**
   * Gets analytics data, optionally filtered
   * @param filters Optional filters to apply
   * @returns The filtered analytics data
   */
  public async getAnalytics(filters?: AnalyticsFilters): Promise<AnalyticsReport> {
    // Filter events based on criteria
    let filteredEvents = this.events;
    
    if (filters) {
      filteredEvents = this.events.filter(event => {
        // Filter by event type
        if (filters.eventType && event.type !== filters.eventType) {
          return false;
        }
        
        // Filter by time range
        if (filters.startTime && event.timestamp < filters.startTime) {
          return false;
        }
        
        if (filters.endTime && event.timestamp > filters.endTime) {
          return false;
        }
        
        // Filter by content ID
        if (filters.contentId && event.contentId !== filters.contentId) {
          return false;
        }
        
        // Filter by user ID
        if (filters.userId && event.userId !== filters.userId) {
          return false;
        }
        
        return true;
      });
    }
    
    // Generate the analytics report
    return this.generateReport(filteredEvents);
  }
  
  /**
   * Generates an analytics report from events
   * @param events The events to analyze
   * @returns The analytics report
   */
  private generateReport(events: AnalyticsEvent[]): AnalyticsReport {
    // Prepare the basic report structure
    const report: AnalyticsReport = {
      timeRange: {
        start: new Date(0), // Initialize with earliest possible date
        end: new Date()
      },
      eventCounts: {},
      totalEvents: events.length,
      averageResponseTime: 0,
      totalTransferredBytes: 0,
      events: events.slice(0, 100), // Include only first 100 events to keep report size reasonable
      contentBreakdown: {},
      geoDistribution: {}
    };
    
    // If no events, return the empty report
    if (events.length === 0) {
      return report;
    }
    
    // Find the actual time range
    report.timeRange.start = events.reduce(
      (earliest, event) => event.timestamp < earliest ? event.timestamp : earliest,
      events[0].timestamp
    );
    
    report.timeRange.end = events.reduce(
      (latest, event) => event.timestamp > latest ? event.timestamp : latest,
      events[0].timestamp
    );
    
    // Count events by type
    events.forEach(event => {
      // Increment event type counter
      report.eventCounts[event.type] = (report.eventCounts[event.type] || 0) + 1;
      
      // Count by content ID
      if (event.contentId) {
        if (!report.contentBreakdown[event.contentId]) {
          report.contentBreakdown[event.contentId] = { count: 0 };
        }
        report.contentBreakdown[event.contentId].count++;
      }
      
      // Count by geo location
      if (event.geoLocation?.country) {
        const country = event.geoLocation.country;
        if (!report.geoDistribution[country]) {
          report.geoDistribution[country] = { count: 0 };
        }
        report.geoDistribution[country].count++;
      }
      
      // Sum up response time for average calculation
      if (event.responseTime) {
        report.averageResponseTime += event.responseTime;
      }
      
      // Sum up total bytes transferred
      if (event.bytesTransferred) {
        report.totalTransferredBytes += event.bytesTransferred;
      }
    });
    
    // Calculate average response time
    const eventsWithResponseTime = events.filter(e => e.responseTime !== undefined).length;
    if (eventsWithResponseTime > 0) {
      report.averageResponseTime = report.averageResponseTime / eventsWithResponseTime;
    }
    
    // Calculate cache hit ratio
    const cacheHits = report.eventCounts[AnalyticsEventType.CACHE_HIT] || 0;
    const cacheMisses = report.eventCounts[AnalyticsEventType.CACHE_MISS] || 0;
    const totalCacheEvents = cacheHits + cacheMisses;
    
    if (totalCacheEvents > 0) {
      report.cacheHitRatio = cacheHits / totalCacheEvents;
    }
    
    return report;
  }
  
  /**
   * Flushes events to persistent storage
   * In a real implementation, this would send events to a server or database
   */
  public async flush(): Promise<void> {
    if (!this.isEnabled || this.events.length === 0) {
      return;
    }
    
    // In a real implementation, this would:
    // 1. Send the events to a server or database
    // 2. Handle retry logic for failures
    // 3. Clear the events array only after successful storage
    
    console.log(`Flushed ${this.events.length} analytics events`);
    
    // Example of what would happen in production:
    try {
      // await this.sendToServer(this.events);
      this.events = []; // Clear the events after successful flush
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
      // In production, we might retry, back off, or keep a limited number
    }
  }
  
  /**
   * Enables or disables analytics collection
   * @param enabled Whether analytics should be enabled
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    // Clear any existing flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // If enabling and auto-flush was previously set, restart it
    if (enabled) {
      this.flushInterval = setInterval(() => this.flush(), 300000); // 5 minutes
    }
  }
  
  /**
   * Clears all collected analytics data
   */
  public clearData(): void {
    this.events = [];
  }
  
  /**
   * Cleans up resources when the collector is no longer needed
   */
  public dispose(): void {
    // Clear the flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush any remaining events
    this.flush();
  }
}

/**
 * Options for the Analytics Collector
 */
export interface AnalyticsCollectorOptions {
  /** Whether analytics collection is enabled (default: true) */
  enabled?: boolean;
  /** Whether to automatically flush analytics (default: true) */
  autoFlush?: boolean;
  /** Interval in milliseconds between flushes (default: 300000 = 5 minutes) */
  flushIntervalMs?: number;
}

/**
 * Filters for analytics data
 */
export interface AnalyticsFilters {
  /** Filter by event type */
  eventType?: AnalyticsEventType;
  /** Filter by start time */
  startTime?: Date;
  /** Filter by end time */
  endTime?: Date;
  /** Filter by content ID */
  contentId?: string;
  /** Filter by user ID */
  userId?: string;
}

/**
 * Analytics report structure
 */
export interface AnalyticsReport {
  /** Time range of the report */
  timeRange: {
    start: Date;
    end: Date;
  };
  /** Count of events by type */
  eventCounts: Record<string, number>;
  /** Total number of events */
  totalEvents: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Total bytes transferred */
  totalTransferredBytes: number;
  /** Sample of events */
  events: AnalyticsEvent[];
  /** Breakdown by content ID */
  contentBreakdown: Record<string, { count: number }>;
  /** Distribution by country */
  geoDistribution: Record<string, { count: number }>;
  /** Cache hit ratio (if applicable) */
  cacheHitRatio?: number;
} 
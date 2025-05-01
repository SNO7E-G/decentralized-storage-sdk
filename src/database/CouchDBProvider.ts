import axios from 'axios';
import { createDatabaseError, retryWithBackoff } from '../utils/ErrorHandler';
import { ContentMetadata, AnalyticsEvent } from '../core/types';

/**
 * CouchDB configuration
 */
export interface CouchDBConfig {
  /** CouchDB connection URL */
  url: string;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password: string;
  /** Database name for metadata */
  metadataDatabase: string;
  /** Database name for analytics */
  analyticsDatabase?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retries */
  maxRetries?: number;
}

/**
 * CouchDB Database Provider for storing metadata and analytics
 */
export class CouchDBProvider {
  private config: CouchDBConfig;
  private authHeader: string;
  private initialized: boolean = false;

  /**
   * Creates a new CouchDB provider
   * @param config CouchDB configuration
   */
  constructor(config: CouchDBConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 10000,
      maxRetries: config.maxRetries || 3
    };

    // Create Basic Auth header
    this.authHeader = `Basic ${Buffer.from(
      `${config.username}:${config.password}`
    ).toString('base64')}`;
  }

  /**
   * Initialize the database connection
   * Creates databases if they don't exist
   */
  public async connect(): Promise<void> {
    try {
      // Check if metadata database exists, create if not
      await this.createDatabaseIfNotExists(this.config.metadataDatabase);

      // Check if analytics database exists, create if not
      if (this.config.analyticsDatabase) {
        await this.createDatabaseIfNotExists(this.config.analyticsDatabase);
      }

      // Create necessary design documents and indexes
      await this.createDesignDocuments();

      this.initialized = true;
      console.log('CouchDB connection initialized successfully');
    } catch (error) {
      throw createDatabaseError(
        `Failed to connect to CouchDB: ${error instanceof Error ? error.message : String(error)}`,
        'connect',
        error
      );
    }
  }

  /**
   * Close database connection
   */
  public async disconnect(): Promise<void> {
    // CouchDB doesn't require explicit connection closing
    this.initialized = false;
  }

  /**
   * Store content metadata
   * @param metadata Content metadata to store
   */
  public async storeMetadata(metadata: ContentMetadata): Promise<void> {
    this.checkInitialized();

    try {
      // First check if document already exists
      let existingDoc = null;
      try {
        const response = await this.request('GET', 
          `/${this.config.metadataDatabase}/${encodeURIComponent(metadata.contentId)}`);
        existingDoc = response.data;
      } catch (error) {
        // Document doesn't exist, which is fine
      }

      // Prepare the document
      const document = {
        ...metadata,
        _id: metadata.contentId,
        type: 'content-metadata',
        created: metadata.created.toISOString(),
        updated: metadata.updated.toISOString(),
        timestamp: new Date().toISOString()
      };

      // If document exists, include revision to update
      if (existingDoc && existingDoc._rev) {
        document._rev = existingDoc._rev;
      }

      // Store the document
      await this.request('PUT', 
        `/${this.config.metadataDatabase}/${encodeURIComponent(metadata.contentId)}`, 
        document);

    } catch (error) {
      throw createDatabaseError(
        `Failed to store metadata in CouchDB: ${error instanceof Error ? error.message : String(error)}`,
        'storeMetadata',
        error
      );
    }
  }

  /**
   * Retrieve content metadata
   * @param contentId Content ID
   * @returns Content metadata
   */
  public async getMetadata(contentId: string): Promise<ContentMetadata | null> {
    this.checkInitialized();

    try {
      const response = await this.request('GET', 
        `/${this.config.metadataDatabase}/${encodeURIComponent(contentId)}`);

      if (!response.data) {
        return null;
      }

      // Convert dates back to Date objects
      const metadata = response.data;
      metadata.created = new Date(metadata.created);
      metadata.updated = new Date(metadata.updated);

      // Remove CouchDB specific fields
      delete metadata._id;
      delete metadata._rev;
      delete metadata.type;
      delete metadata.timestamp;

      return metadata;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      
      throw createDatabaseError(
        `Failed to get metadata from CouchDB: ${error instanceof Error ? error.message : String(error)}`,
        'getMetadata',
        error
      );
    }
  }

  /**
   * Delete content metadata
   * @param contentId Content ID
   */
  public async deleteMetadata(contentId: string): Promise<void> {
    this.checkInitialized();

    try {
      // Get the current document to get its revision
      const response = await this.request('GET', 
        `/${this.config.metadataDatabase}/${encodeURIComponent(contentId)}`);
      
      if (response.data && response.data._rev) {
        // Delete the document
        await this.request('DELETE', 
          `/${this.config.metadataDatabase}/${encodeURIComponent(contentId)}?rev=${response.data._rev}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Document doesn't exist, nothing to delete
        return;
      }
      
      throw createDatabaseError(
        `Failed to delete metadata from CouchDB: ${error instanceof Error ? error.message : String(error)}`,
        'deleteMetadata',
        error
      );
    }
  }

  /**
   * Store analytics event
   * @param event Analytics event to store
   */
  public async storeAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    this.checkInitialized();

    if (!this.config.analyticsDatabase) {
      console.warn('Analytics database not configured, not storing event');
      return;
    }

    try {
      // Prepare the document
      const document = {
        ...event,
        _id: `${event.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: event.timestamp.toISOString(),
        docType: 'analytics-event'
      };

      // Store the document
      await this.request('POST', `/${this.config.analyticsDatabase}`, document);
    } catch (error) {
      console.error('Failed to store analytics event:', error);
      // Don't throw here, analytics failures shouldn't break the main flow
    }
  }

  /**
   * List metadata based on filter
   * @param filter Filter criteria
   * @param limit Maximum number of items to return
   * @param skip Number of items to skip (for pagination)
   * @returns Array of content metadata
   */
  public async listMetadata(
    filter: Record<string, any> = {}, 
    limit: number = 100, 
    skip: number = 0
  ): Promise<ContentMetadata[]> {
    this.checkInitialized();

    try {
      // Build selector for CouchDB find
      const selector: Record<string, any> = {
        type: 'content-metadata'
      };

      // Add custom filters
      for (const key in filter) {
        selector[key] = filter[key];
      }

      // Execute the query
      const response = await this.request('POST', 
        `/${this.config.metadataDatabase}/_find`, 
        {
          selector,
          limit,
          skip,
          sort: [{ 'updated': 'desc' }]
        });

      // Process results
      return response.data.docs.map((doc: any) => {
        // Convert dates back to Date objects
        doc.created = new Date(doc.created);
        doc.updated = new Date(doc.updated);

        // Remove CouchDB specific fields
        delete doc._id;
        delete doc._rev;
        delete doc.type;
        delete doc.timestamp;

        return doc;
      });
    } catch (error) {
      throw createDatabaseError(
        `Failed to list metadata from CouchDB: ${error instanceof Error ? error.message : String(error)}`,
        'listMetadata',
        error
      );
    }
  }

  /**
   * Update content reference
   * @param oldContentId Old content ID
   * @param newContentId New content ID
   */
  public async updateContentReference(
    oldContentId: string, 
    newContentId: string
  ): Promise<void> {
    const metadata = await this.getMetadata(oldContentId);
    
    if (metadata) {
      metadata.contentId = newContentId;
      await this.storeMetadata(metadata);
      await this.deleteMetadata(oldContentId);
    }
  }

  /**
   * Get analytics events
   * @param filters Filter criteria
   * @returns Analytics events
   */
  public async getAnalyticsEvents(
    filters: Record<string, any> = {}
  ): Promise<AnalyticsEvent[]> {
    this.checkInitialized();

    if (!this.config.analyticsDatabase) {
      throw new Error('Analytics database not configured');
    }

    try {
      // Build selector for CouchDB find
      const selector: Record<string, any> = {
        docType: 'analytics-event'
      };

      // Add custom filters
      for (const key in filters) {
        selector[key] = filters[key];
      }

      // Execute the query
      const response = await this.request('POST', 
        `/${this.config.analyticsDatabase}/_find`, 
        {
          selector,
          limit: 1000,
          sort: [{ 'timestamp': 'desc' }]
        });

      // Process results
      return response.data.docs.map((doc: any) => {
        // Convert timestamp back to Date object
        doc.timestamp = new Date(doc.timestamp);

        // Remove CouchDB specific fields
        delete doc._id;
        delete doc._rev;
        delete doc.docType;

        return doc;
      });
    } catch (error) {
      throw createDatabaseError(
        `Failed to get analytics from CouchDB: ${error instanceof Error ? error.message : String(error)}`,
        'getAnalyticsEvents',
        error
      );
    }
  }

  /**
   * Aggregate analytics data
   * @param pipeline Aggregation pipeline
   * @returns Aggregation results
   */
  public async aggregate(pipeline: any[]): Promise<any> {
    this.checkInitialized();

    if (!this.config.analyticsDatabase) {
      throw new Error('Analytics database not configured');
    }

    try {
      // CouchDB doesn't have a direct equivalent to MongoDB's aggregation pipeline
      // This is a simplified implementation that supports basic aggregation
      const eventType = pipeline.find(stage => stage.$match?.type)?.type;
      const groupBy = pipeline.find(stage => stage.$group)?.$group;
      
      if (!groupBy) {
        throw new Error('Unsupported aggregation pipeline: missing $group stage');
      }

      // Get all events matching the type
      const selector: Record<string, any> = {
        docType: 'analytics-event'
      };
      
      if (eventType) {
        selector.type = eventType;
      }

      const response = await this.request('POST', 
        `/${this.config.analyticsDatabase}/_find`, 
        {
          selector,
          limit: 10000
        });

      // Implement a simple group by operation in memory
      const groupByField = Object.keys(groupBy._id)[0]?.replace('$', '');
      const results: Record<string, any> = {};
      
      for (const doc of response.data.docs) {
        const key = groupByField ? doc[groupByField] : 'all';
        
        if (!results[key]) {
          results[key] = { _id: key, count: 0 };
          
          // Initialize sum fields
          for (const field in groupBy) {
            if (field !== '_id' && groupBy[field].$sum) {
              const sumField = groupBy[field].$sum.replace('$', '');
              results[key][field] = 0;
            }
          }
        }
        
        // Increment count
        results[key].count++;
        
        // Calculate sums
        for (const field in groupBy) {
          if (field !== '_id' && groupBy[field].$sum) {
            const sumField = groupBy[field].$sum.replace('$', '');
            results[key][field] += (doc[sumField] || 0);
          }
        }
      }
      
      return Object.values(results);
    } catch (error) {
      throw createDatabaseError(
        `Failed to aggregate analytics data from CouchDB: ${error instanceof Error ? error.message : String(error)}`,
        'aggregate',
        error
      );
    }
  }

  /**
   * Get storage statistics
   * @returns Storage statistics
   */
  public async getStorageStats(): Promise<any> {
    this.checkInitialized();

    try {
      // Get database stats
      const metadataDbStats = await this.request('GET', 
        `/${this.config.metadataDatabase}`);

      // Get a count of all content items
      const response = await this.request('POST', 
        `/${this.config.metadataDatabase}/_find`, 
        {
          selector: { type: 'content-metadata' },
          fields: ['_id', 'size', 'mimeType'],
          limit: 10000
        });

      // Calculate statistics
      let totalSize = 0;
      const mimeTypes: Record<string, number> = {};
      
      for (const doc of response.data.docs) {
        totalSize += doc.size || 0;
        
        if (doc.mimeType) {
          mimeTypes[doc.mimeType] = (mimeTypes[doc.mimeType] || 0) + 1;
        }
      }

      return {
        totalItems: response.data.docs.length,
        totalSize,
        mimeTypeDistribution: mimeTypes,
        databaseSize: metadataDbStats.data.disk_size || 0,
        docCount: metadataDbStats.data.doc_count || 0
      };
    } catch (error) {
      throw createDatabaseError(
        `Failed to get storage stats from CouchDB: ${error instanceof Error ? error.message : String(error)}`,
        'getStorageStats',
        error
      );
    }
  }

  // Private helper methods

  /**
   * Check if database is initialized
   * @throws Error if not initialized
   */
  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('CouchDB provider not initialized. Call connect() first.');
    }
  }

  /**
   * Create database if it doesn't exist
   * @param dbName Database name
   */
  private async createDatabaseIfNotExists(dbName: string): Promise<void> {
    try {
      // Check if database exists
      await this.request('GET', `/${dbName}`);
      console.log(`Database ${dbName} already exists`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Database doesn't exist, create it
        console.log(`Creating database ${dbName}`);
        await this.request('PUT', `/${dbName}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create design documents for indexes
   */
  private async createDesignDocuments(): Promise<void> {
    // Create index for metadata
    await this.request('POST', `/${this.config.metadataDatabase}/_index`, {
      index: {
        fields: ['type', 'updated']
      },
      name: 'metadata-index'
    });

    // Create index for analytics if analytics database is configured
    if (this.config.analyticsDatabase) {
      await this.request('POST', `/${this.config.analyticsDatabase}/_index`, {
        index: {
          fields: ['docType', 'type', 'timestamp']
        },
        name: 'analytics-index'
      });
    }
  }

  /**
   * Make HTTP request with retry logic
   * @param method HTTP method
   * @param path URL path
   * @param data Request body
   * @returns Response
   */
  private async request(
    method: string, 
    path: string, 
    data?: any
  ): Promise<any> {
    return retryWithBackoff(async () => {
      const response = await axios({
        method,
        url: `${this.config.url}${path}`,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json'
        },
        data,
        timeout: this.config.timeout
      });
      
      return response;
    }, { maxRetries: this.config.maxRetries });
  }
} 
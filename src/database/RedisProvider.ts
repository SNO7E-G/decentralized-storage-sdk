import { createClient, RedisClientType } from 'redis';
import { 
  AnalyticsEvent, 
  ContentMetadata, 
  VersionInfo
} from '../core/types';

/**
 * Redis Database Provider
 * 
 * This provider implements data persistence using Redis for the Decentralized Storage SDK.
 * It handles metadata storage, analytics event tracking, versioning, and user management.
 * 
 * Features:
 * - High-performance key-value storage
 * - Content metadata caching and retrieval
 * - Analytics event logging
 * - Content version history tracking
 * - In-memory data with optional persistence
 * - Optional support for Redis Streams for event tracking
 * 
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */
export class RedisProvider {
  private client: RedisClientType;
  private connected: boolean = false;
  private readonly metadataPrefix: string;
  private readonly analyticsPrefix: string;
  private readonly versionsPrefix: string;
  private readonly usersPrefix: string;
  
  /**
   * Create a Redis Provider
   * @param connectionOptions Redis connection options
   * @param keyPrefixes Key prefix configuration
   */
  constructor(
    connectionOptions: {
      url: string;
      username?: string;
      password?: string;
      database?: number;
    },
    keyPrefixes?: {
      metadata?: string;
      analytics?: string;
      versions?: string;
      users?: string;
    }
  ) {
    this.client = createClient({
      url: connectionOptions.url,
      username: connectionOptions.username,
      password: connectionOptions.password,
      database: connectionOptions.database
    });
    
    // Set key prefixes with defaults
    this.metadataPrefix = keyPrefixes?.metadata || 'metadata:';
    this.analyticsPrefix = keyPrefixes?.analytics || 'analytics:';
    this.versionsPrefix = keyPrefixes?.versions || 'versions:';
    this.usersPrefix = keyPrefixes?.users || 'users:';
    
    // Set up error handler
    this.client.on('error', (err) => console.error('Redis Client Error', err));
  }
  
  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    
    try {
      await this.client.connect();
      this.connected = true;
      console.log('Connected to Redis database');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    if (!this.connected) {
      return;
    }
    
    try {
      await this.client.disconnect();
      this.connected = false;
      console.log('Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
      throw new Error(`Failed to close Redis connection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store content metadata
   * @param metadata Content metadata to store
   * @returns The stored metadata
   */
  public async storeMetadata(metadata: ContentMetadata): Promise<ContentMetadata> {
    await this.ensureConnected();
    
    try {
      const key = `${this.metadataPrefix}${metadata.contentId}`;
      
      // Convert dates to ISO strings for JSON storage
      const metadataForStorage = {
        ...metadata,
        created: metadata.created.toISOString(),
        updated: metadata.updated.toISOString()
      };
      
      // Store metadata as JSON
      await this.client.set(key, JSON.stringify(metadataForStorage));
      
      // Set expiry only if TTL is provided in custom metadata
      if (metadata.customMetadata && metadata.customMetadata.ttl) {
        await this.client.expire(key, Number(metadata.customMetadata.ttl));
      }
      
      // Add to content index
      await this.client.sAdd('content:all', metadata.contentId);
      
      // Add to index by mimetype
      await this.client.sAdd(`content:mimetype:${metadata.mimeType.replace('/', '_')}`, metadata.contentId);
      
      return metadata;
    } catch (error) {
      console.error('Error storing metadata in Redis:', error);
      throw new Error(`Failed to store metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Retrieve content metadata by content ID
   * @param contentId The content ID
   * @returns The content metadata
   */
  public async getMetadata(contentId: string): Promise<ContentMetadata | null> {
    await this.ensureConnected();
    
    try {
      const key = `${this.metadataPrefix}${contentId}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }
      
      // Parse the stored JSON
      const parsed = JSON.parse(data);
      
      // Convert ISO date strings back to Date objects
      return {
        ...parsed,
        created: new Date(parsed.created),
        updated: new Date(parsed.updated)
      };
    } catch (error) {
      console.error(`Error retrieving metadata for ${contentId} from Redis:`, error);
      throw new Error(`Failed to retrieve metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Delete content metadata
   * @param contentId Content ID to delete
   * @returns Boolean indicating success
   */
  public async deleteMetadata(contentId: string): Promise<boolean> {
    await this.ensureConnected();
    
    try {
      const key = `${this.metadataPrefix}${contentId}`;
      
      // Get the metadata first to get the mimetype for index removal
      const metadata = await this.getMetadata(contentId);
      
      // Remove from all indices
      if (metadata) {
        await this.client.sRem('content:all', contentId);
        await this.client.sRem(`content:mimetype:${metadata.mimeType.replace('/', '_')}`, contentId);
      }
      
      // Delete the metadata
      const deleted = await this.client.del(key);
      return deleted > 0;
    } catch (error) {
      console.error(`Error deleting metadata for ${contentId} from Redis:`, error);
      throw new Error(`Failed to delete metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * List content metadata with optional filtering
   * @param options Filter and pagination options
   * @returns Array of content metadata with count
   */
  public async listMetadata(options: {
    filter?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<{ items: ContentMetadata[]; totalItems: number }> {
    await this.ensureConnected();
    
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    
    try {
      let contentIds: string[] = [];
      
      // Apply filtering
      if (options.filter && options.filter.mimeType) {
        // Filter by mime type
        contentIds = await this.client.sMembers(`content:mimetype:${options.filter.mimeType.replace('/', '_')}`);
      } else {
        // Get all content IDs
        contentIds = await this.client.sMembers('content:all');
      }
      
      // Get metadata for all matching content IDs
      const allMetadata: ContentMetadata[] = [];
      
      for (const contentId of contentIds) {
        const metadata = await this.getMetadata(contentId);
        if (metadata) {
          allMetadata.push(metadata);
        }
      }
      
      // Apply additional filtering
      let filteredMetadata = allMetadata;
      
      if (options.filter) {
        filteredMetadata = allMetadata.filter(metadata => {
          for (const [key, value] of Object.entries(options.filter || {})) {
            // Skip mime type as it's already filtered
            if (key === 'mimeType') continue;
            
            // Handle different filter types
            if (key === 'filename' && typeof value === 'string') {
              if (!metadata.filename || !metadata.filename.includes(value)) {
                return false;
              }
            } else if (key === 'encrypted' && typeof value === 'boolean') {
              if (metadata.encrypted !== value) {
                return false;
              }
            } else if (key === 'sizeLessThan' && typeof value === 'number') {
              if (metadata.size >= value) {
                return false;
              }
            } else if (key === 'sizeGreaterThan' && typeof value === 'number') {
              if (metadata.size <= value) {
                return false;
              }
            } else if (key === 'createdBefore' && value instanceof Date) {
              if (metadata.created >= value) {
                return false;
              }
            } else if (key === 'createdAfter' && value instanceof Date) {
              if (metadata.created <= value) {
                return false;
              }
            }
          }
          return true;
        });
      }
      
      // Sort results
      const orderBy = options.orderBy || 'created';
      const orderDirection = options.orderDirection || 'DESC';
      
      filteredMetadata.sort((a, b) => {
        let valueA: any;
        let valueB: any;
        
        // Get sort values based on field
        switch (orderBy) {
          case 'contentId':
            valueA = a.contentId;
            valueB = b.contentId;
            break;
          case 'size':
            valueA = a.size;
            valueB = b.size;
            break;
          case 'mimeType':
            valueA = a.mimeType;
            valueB = b.mimeType;
            break;
          case 'filename':
            valueA = a.filename || '';
            valueB = b.filename || '';
            break;
          case 'updated':
            valueA = a.updated;
            valueB = b.updated;
            break;
          case 'created':
          default:
            valueA = a.created;
            valueB = b.created;
            break;
        }
        
        // Sort in specified direction
        if (orderDirection === 'ASC') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });
      
      // Apply pagination
      const paginatedMetadata = filteredMetadata.slice(offset, offset + limit);
      
      return {
        items: paginatedMetadata,
        totalItems: filteredMetadata.length
      };
    } catch (error) {
      console.error('Error listing metadata from Redis:', error);
      throw new Error(`Failed to list metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store an analytics event
   * @param event The analytics event to store
   * @returns The ID of the stored event
   */
  public async storeAnalyticsEvent(event: AnalyticsEvent): Promise<string> {
    await this.ensureConnected();
    
    try {
      // Generate a unique ID for the event
      const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const key = `${this.analyticsPrefix}${eventId}`;
      
      // Convert dates to ISO strings for storage
      const eventForStorage = {
        ...event,
        timestamp: event.timestamp.toISOString()
      };
      
      // Store the event
      await this.client.set(key, JSON.stringify(eventForStorage));
      
      // Add to analytics index
      await this.client.rPush('analytics:events', eventId);
      
      // Add to type-specific index
      await this.client.rPush(`analytics:type:${event.type}`, eventId);
      
      // Add to content-specific index if applicable
      if (event.contentId) {
        await this.client.rPush(`analytics:content:${event.contentId}`, eventId);
      }
      
      // Add to user-specific index if applicable
      if (event.userId) {
        await this.client.rPush(`analytics:user:${event.userId}`, eventId);
      }
      
      return eventId;
    } catch (error) {
      console.error('Error storing analytics event in Redis:', error);
      throw new Error(`Failed to store analytics event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Query analytics events
   * @param options Query options
   * @returns Analytics events with count
   */
  public async queryAnalytics(options: {
    eventType?: string;
    contentId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ events: AnalyticsEvent[]; totalEvents: number }> {
    await this.ensureConnected();
    
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    
    try {
      let eventIds: string[] = [];
      
      // Choose the most specific index available
      if (options.eventType && options.contentId) {
        // We'll need to get both lists and find the intersection
        const typeEvents = await this.client.lRange(`analytics:type:${options.eventType}`, 0, -1);
        const contentEvents = await this.client.lRange(`analytics:content:${options.contentId}`, 0, -1);
        
        // Find intersection
        eventIds = typeEvents.filter(id => contentEvents.includes(id));
      } else if (options.contentId) {
        eventIds = await this.client.lRange(`analytics:content:${options.contentId}`, 0, -1);
      } else if (options.userId) {
        eventIds = await this.client.lRange(`analytics:user:${options.userId}`, 0, -1);
      } else if (options.eventType) {
        eventIds = await this.client.lRange(`analytics:type:${options.eventType}`, 0, -1);
      } else {
        eventIds = await this.client.lRange('analytics:events', 0, -1);
      }
      
      // Get events
      const allEvents: AnalyticsEvent[] = [];
      
      for (const eventId of eventIds) {
        const key = `${this.analyticsPrefix}${eventId}`;
        const data = await this.client.get(key);
        
        if (data) {
          const parsed = JSON.parse(data);
          
          // Convert ISO date string back to Date
          const event: AnalyticsEvent = {
            ...parsed,
            timestamp: new Date(parsed.timestamp)
          };
          
          // Apply date filtering
          if (options.startDate && event.timestamp < options.startDate) {
            continue;
          }
          
          if (options.endDate && event.timestamp > options.endDate) {
            continue;
          }
          
          allEvents.push(event);
        }
      }
      
      // Sort by timestamp (newest first)
      allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Apply pagination
      const paginatedEvents = allEvents.slice(offset, offset + limit);
      
      return {
        events: paginatedEvents,
        totalEvents: allEvents.length
      };
    } catch (error) {
      console.error('Error querying analytics from Redis:', error);
      throw new Error(`Failed to query analytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store version information for content
   * @param contentId Content ID
   * @param versionInfo Version information
   * @returns The stored version ID
   */
  public async storeVersion(contentId: string, versionInfo: VersionInfo): Promise<string> {
    await this.ensureConnected();
    
    try {
      const key = `${this.versionsPrefix}${contentId}:${versionInfo.versionId}`;
      
      // Convert dates to ISO strings for storage
      const versionForStorage = {
        ...versionInfo,
        created: versionInfo.created.toISOString(),
        timestamp: versionInfo.timestamp.toISOString()
      };
      
      // Store the version
      await this.client.set(key, JSON.stringify(versionForStorage));
      
      // Add to version index for this content
      await this.client.rPush(`versions:${contentId}`, versionInfo.versionId);
      
      return versionInfo.versionId;
    } catch (error) {
      console.error(`Error storing version for ${contentId} in Redis:`, error);
      throw new Error(`Failed to store version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get versions for content
   * @param contentId Content ID
   * @returns Array of version information
   */
  public async getVersions(contentId: string): Promise<VersionInfo[]> {
    await this.ensureConnected();
    
    try {
      // Get all version IDs for this content
      const versionIds = await this.client.lRange(`versions:${contentId}`, 0, -1);
      
      if (!versionIds || versionIds.length === 0) {
        return [];
      }
      
      // Get each version
      const versions: VersionInfo[] = [];
      
      for (const versionId of versionIds) {
        const key = `${this.versionsPrefix}${contentId}:${versionId}`;
        const data = await this.client.get(key);
        
        if (data) {
          const parsed = JSON.parse(data);
          
          // Convert ISO date strings back to Date objects
          versions.push({
            ...parsed,
            created: new Date(parsed.created),
            timestamp: new Date(parsed.timestamp)
          });
        }
      }
      
      // Sort by timestamp (newest first)
      versions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return versions;
    } catch (error) {
      console.error(`Error getting versions for ${contentId} from Redis:`, error);
      throw new Error(`Failed to get versions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Delete old versions of content
   * @param contentId Content ID
   * @param keepLatest Number of latest versions to keep
   * @returns Number of deleted versions
   */
  public async pruneVersions(contentId: string, keepLatest: number): Promise<number> {
    await this.ensureConnected();
    
    try {
      // Get all versions
      const versions = await this.getVersions(contentId);
      
      if (versions.length <= keepLatest) {
        return 0;
      }
      
      // Find versions to delete
      const versionsToDelete = versions.slice(keepLatest);
      
      // Delete each version
      for (const version of versionsToDelete) {
        const key = `${this.versionsPrefix}${contentId}:${version.versionId}`;
        await this.client.del(key);
        await this.client.lRem(`versions:${contentId}`, 1, version.versionId);
      }
      
      return versionsToDelete.length;
    } catch (error) {
      console.error(`Error pruning versions for ${contentId} from Redis:`, error);
      throw new Error(`Failed to prune versions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Update content references from old ID to new ID
   * @param oldContentId The old content ID
   * @param newContentId The new content ID
   * @returns Promise resolving to boolean indicating success
   */
  public async updateContentReference(oldContentId: string, newContentId: string): Promise<boolean> {
    await this.ensureConnected();
    
    try {
      // Get metadata for old content
      const metadata = await this.getMetadata(oldContentId);
      
      if (!metadata) {
        return false;
      }
      
      // Get versions for old content
      const versions = await this.getVersions(oldContentId);
      
      // Store metadata with new content ID
      const updatedMetadata = {
        ...metadata,
        contentId: newContentId,
        updated: new Date()
      };
      
      await this.storeMetadata(updatedMetadata);
      
      // Store versions with new content ID
      for (const version of versions) {
        await this.storeVersion(newContentId, version);
      }
      
      // Update analytics references
      const eventIds = await this.client.lRange(`analytics:content:${oldContentId}`, 0, -1);
      
      for (const eventId of eventIds) {
        const key = `${this.analyticsPrefix}${eventId}`;
        const data = await this.client.get(key);
        
        if (data) {
          const event = JSON.parse(data);
          event.contentId = newContentId;
          await this.client.set(key, JSON.stringify(event));
        }
      }
      
      // Create new analytics index
      if (eventIds.length > 0) {
        // Add each event ID individually since the spread operator causes type issues
        for (const eventId of eventIds) {
          await this.client.rPush(`analytics:content:${newContentId}`, eventId);
        }
      }
      
      // Delete old content data
      await this.deleteMetadata(oldContentId);
      await this.client.del(`versions:${oldContentId}`);
      await this.client.del(`analytics:content:${oldContentId}`);
      
      return true;
    } catch (error) {
      console.error(`Error updating content reference from ${oldContentId} to ${newContentId}:`, error);
      throw new Error(`Failed to update content reference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Ensure that we are connected to Redis
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }
  
  /**
   * Run a Redis command directly (use with caution)
   * @param command Redis command
   * @param args Command arguments
   * @returns Command result
   */
  public async runCommand(command: string, ...args: any[]): Promise<any> {
    await this.ensureConnected();
    
    try {
      // @ts-ignore - runCommand is available on the client
      return await this.client.sendCommand([command, ...args]);
    } catch (error) {
      console.error('Error executing Redis command:', error);
      throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
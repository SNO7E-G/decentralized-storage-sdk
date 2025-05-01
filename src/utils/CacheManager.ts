import { CacheConfig } from '../core/types';

/**
 * Cache Manager
 * Handles caching of content for faster retrieval
 */
export class CacheManager {
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private totalSize: number = 0;
  private evictionTimer: NodeJS.Timeout | null = null;
  
  /**
   * Creates a new Cache Manager
   * @param config Cache configuration
   */
  constructor(config: CacheConfig) {
    this.config = config;
    
    // Start a timer to periodically check for expired cache entries
    this.evictionTimer = setInterval(() => this.evictExpiredEntries(), 60000); // Check every minute
  }
  
  /**
   * Adds content to the cache
   * @param contentId The content ID
   * @param content The content to cache
   * @param ttlOverride Optional TTL override in seconds
   * @returns Promise resolving to success status
   */
  public async addToCache(contentId: string, content: any, ttlOverride?: number): Promise<boolean> {
    try {
      // Calculate the content size (simplified)
      const contentSize = this.estimateSize(content);
      
      // Check if adding this would exceed the max cache size
      if (this.config.maxSize && this.totalSize + contentSize > this.config.maxSize) {
        // Need to make room in the cache
        this.evictEntries(contentSize);
      }
      
      // Determine the TTL based on content type or use default
      let ttl = ttlOverride || this.config.defaultTTL;
      
      // If there's a content-type specific TTL, use that
      if (this.config.contentTypeTTL && content.metadata?.mimeType) {
        const mimeType = content.metadata.mimeType;
        // Check for exact match or pattern match (e.g., image/*)
        for (const [pattern, patternTtl] of Object.entries(this.config.contentTypeTTL)) {
          if (mimeType === pattern || (pattern.endsWith('*') && mimeType.startsWith(pattern.slice(0, -1)))) {
            ttl = patternTtl;
            break;
          }
        }
      }
      
      // Calculate expiration time
      const expiresAt = Date.now() + (ttl * 1000);
      
      // Store in cache
      this.cache.set(contentId, {
        content,
        size: contentSize,
        createdAt: Date.now(),
        expiresAt,
        accessCount: 0,
        lastAccessed: Date.now()
      });
      
      // Update total cache size
      this.totalSize += contentSize;
      
      return true;
    } catch (error) {
      console.error('Error adding to cache:', error);
      return false;
    }
  }
  
  /**
   * Retrieves content from the cache
   * @param contentId The content ID
   * @returns The cached content or null if not found
   */
  public async getFromCache(contentId: string): Promise<any> {
    const entry = this.cache.get(contentId);
    
    // If not found or expired, return null
    if (!entry || entry.expiresAt < Date.now()) {
      if (entry) {
        // Entry exists but is expired, remove it
        this.removeFromCache(contentId);
      }
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    // Return the cached content
    return entry.content;
  }
  
  /**
   * Removes content from the cache
   * @param contentId The content ID
   * @returns Promise resolving to success status
   */
  public async removeFromCache(contentId: string): Promise<boolean> {
    const entry = this.cache.get(contentId);
    if (!entry) {
      return false;
    }
    
    // Remove from cache
    this.cache.delete(contentId);
    
    // Update total cache size
    this.totalSize -= entry.size;
    
    return true;
  }
  
  /**
   * Clears the entire cache
   * @returns Promise resolving to success status
   */
  public async clearCache(): Promise<boolean> {
    this.cache.clear();
    this.totalSize = 0;
    return true;
  }
  
  /**
   * Refreshes the TTL for a cached item
   * @param contentId The content ID
   * @param ttl The new TTL in seconds
   * @returns Promise resolving to success status
   */
  public async refreshTTL(contentId: string, ttl: number): Promise<boolean> {
    const entry = this.cache.get(contentId);
    if (!entry) {
      return false;
    }
    
    // Update expiration time
    entry.expiresAt = Date.now() + (ttl * 1000);
    
    return true;
  }
  
  /**
   * Updates cache configuration
   * @param config New cache configuration
   */
  public updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    
    // If the maxSize was reduced, we might need to evict some entries
    if (config.maxSize && this.totalSize > config.maxSize) {
      this.evictEntries(this.totalSize - config.maxSize);
    }
  }
  
  /**
   * Estimates the size of content in bytes (simplified)
   * @param content The content to estimate size for
   * @returns Estimated size in bytes
   */
  private estimateSize(content: any): number {
    if (!content) {
      return 0;
    }
    
    if (content.data && Buffer.isBuffer(content.data)) {
      // If it's a buffer, use its length
      return content.data.length;
    }
    
    // For other types, use a JSON stringify approximation
    // This is not accurate but gives a rough estimate
    try {
      const jsonString = JSON.stringify(content);
      return jsonString.length * 2; // Unicode characters can take up to 2 bytes
    } catch (error) {
      // If we can't stringify it, make a rough guess
      return 1024; // 1KB default
    }
  }
  
  /**
   * Evicts expired entries from the cache
   */
  private evictExpiredEntries(): void {
    const now = Date.now();
    let removedCount = 0;
    let freedSpace = 0;
    
    for (const [contentId, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(contentId);
        this.totalSize -= entry.size;
        removedCount++;
        freedSpace += entry.size;
      }
    }
    
    if (removedCount > 0) {
      console.log(`Evicted ${removedCount} expired cache entries, freed ${this.formatBytes(freedSpace)}`);
    }
  }
  
  /**
   * Evicts entries to free up a specified amount of space
   * @param spaceNeeded Amount of space needed in bytes
   */
  private evictEntries(spaceNeeded: number): void {
    if (spaceNeeded <= 0 || this.cache.size === 0) {
      return;
    }
    
    // Create a sorted array of entries by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    let freedSpace = 0;
    let removedCount = 0;
    
    // Remove entries until we've freed enough space
    for (const [contentId, entry] of entries) {
      this.cache.delete(contentId);
      this.totalSize -= entry.size;
      freedSpace += entry.size;
      removedCount++;
      
      if (freedSpace >= spaceNeeded) {
        break;
      }
    }
    
    console.log(`Evicted ${removedCount} cache entries to free up space, freed ${this.formatBytes(freedSpace)}`);
  }
  
  /**
   * Gets cache statistics
   * @returns Cache statistics
   */
  public getCacheStats(): CacheStats {
    const now = Date.now();
    let expiredCount = 0;
    let oldestEntry = now;
    let newestEntry = 0;
    let mostAccessed = 0;
    let mostAccessedId = '';
    
    for (const [contentId, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        expiredCount++;
      }
      
      if (entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      
      if (entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
      
      if (entry.accessCount > mostAccessed) {
        mostAccessed = entry.accessCount;
        mostAccessedId = contentId;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      totalSize: this.totalSize,
      formattedSize: this.formatBytes(this.totalSize),
      expiredEntries: expiredCount,
      maxSize: this.config.maxSize ? this.formatBytes(this.config.maxSize) : 'unlimited',
      usagePercentage: this.config.maxSize ? (this.totalSize / this.config.maxSize) * 100 : 0,
      oldestEntry: oldestEntry !== now ? new Date(oldestEntry) : undefined,
      newestEntry: newestEntry !== 0 ? new Date(newestEntry) : undefined,
      mostAccessedEntryId: mostAccessedId || undefined,
      mostAccessedEntryCount: mostAccessed || 0
    };
  }
  
  /**
   * Formats bytes to a human-readable string
   * @param bytes Number of bytes
   * @returns Formatted string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Disposes of the cache manager resources
   */
  public dispose(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    
    this.cache.clear();
    this.totalSize = 0;
  }
}

/**
 * Cache entry
 */
interface CacheEntry {
  /** The cached content */
  content: any;
  /** Size of the content in bytes */
  size: number;
  /** When the entry was created */
  createdAt: number;
  /** When the entry expires */
  expiresAt: number;
  /** Number of times the entry has been accessed */
  accessCount: number;
  /** When the entry was last accessed */
  lastAccessed: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of entries in the cache */
  totalEntries: number;
  /** Total size of all cached content in bytes */
  totalSize: number;
  /** Formatted total size */
  formattedSize: string;
  /** Number of expired entries still in the cache */
  expiredEntries: number;
  /** Maximum cache size */
  maxSize: string;
  /** Percentage of maximum size used */
  usagePercentage: number;
  /** When the oldest entry was created */
  oldestEntry?: Date;
  /** When the newest entry was created */
  newestEntry?: Date;
  /** ID of the most accessed entry */
  mostAccessedEntryId?: string;
  /** Access count of the most accessed entry */
  mostAccessedEntryCount: number;
} 
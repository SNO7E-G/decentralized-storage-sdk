import * as pako from 'pako';
import { createHash } from 'crypto';
import * as brotli from 'brotli';
import { AlgorithmsConfig, ContentMetadata } from '../core/types';
import { ContentRecommendationEngine } from './ContentRecommendationEngine';
import { SDKError, SDKErrorCode, createDatabaseError } from '../utils/ErrorHandler';

// Add proper type declarations
declare module 'brotli';
declare module 'node-zstandard';

/**
 * Result of content duplication check
 */
export interface DuplicationResult {
  /** Whether a duplicate was found */
  found: boolean;
  /** Content ID of the existing duplicate (if found) */
  contentId?: string;
  /** Public URL of the existing duplicate (if found) */
  publicUrl?: string;
  /** CDN URL of the existing duplicate (if found) */
  cdnUrl?: string;
  /** Confidence score of the duplicate match (0-1) */
  confidence?: number;
}

/**
 * Content analysis result interface
 */
export interface ContentAnalysisResult {
  /** Size of the content in bytes */
  size: number;
  /** MIME type of the content */
  mimeType: string;
  /** Timestamp when the analysis was performed */
  analyzedAt: string;
  /** Type of content (image, video, text, etc.) */
  contentType: string;
  /** Content-specific features */
  features: Record<string, any>;
  /** Error message if analysis failed */
  error?: string;
  /** Quality score for the content (0-1) */
  qualityScore?: number;
  /** Content classification tags */
  tags?: string[];
  /** Processing time in milliseconds */
  processingTime?: number;
}

/**
 * Content recommendation item
 */
export interface RecommendationItem {
  /** Content ID */
  contentId: string;
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Recommendation reason */
  reason: string;
  /** Public URL if available */
  publicUrl?: string;
  /** CDN URL if available */
  cdnUrl?: string;
}

/**
 * Algorithm configuration for the SDK
 */
export interface AlgorithmsConfig {
  /** Content recommendation algorithms */
  contentRecommendation?: {
    /** Enable recommendation engine */
    enabled?: boolean;
    /** Algorithm type */
    algorithm?: 'collaborative-filtering' | 'content-based' | 'hybrid' | 'custom';
    /** Training interval in milliseconds */
    trainingInterval?: number;
  };
  /** Content compression algorithms */
  compression?: {
    /** Enable compression */
    enabled?: boolean;
    /** Algorithm to use */
    algorithm?: 'gzip' | 'brotli' | 'zstd' | 'custom';
    /** Compression level (1-9) */
    level?: number;
    /** Whether to return original data if compression fails */
    failSafe?: boolean;
    /** Custom compression/decompression handlers */
    customHandlers?: {
      compress: (data: Buffer) => Promise<Buffer>;
      decompress: (data: Buffer) => Promise<Buffer>;
    };
  };
  /** Content deduplication */
  deduplication?: {
    /** Enable deduplication */
    enabled?: boolean;
    /** Detect similar content */
    detectSimilarContent?: boolean;
    /** Similarity threshold (0-1) */
    similarityThreshold?: number;
    /** Chunk size for deduplication in bytes */
    chunkSize?: number;
  };
  /** Machine learning for optimizations */
  machineLearning?: {
    /** Enable machine learning */
    enabled?: boolean;
    /** Model type */
    modelType?: 'regression' | 'classification' | 'custom';
  };
}

/**
 * Algorithm Manager
 * Handles advanced algorithms like compression, deduplication, and recommendations
 */
export class AlgorithmManager {
  private config: AlgorithmsConfig;
  private deduplicationCache: Map<string, { 
    contentId: string, 
    publicUrl?: string, 
    cdnUrl?: string 
  }> = new Map();
  private recommendationEngine: ContentRecommendationEngine | null = null;
  private contentHashes: Map<string, { contentId: string, publicUrl: string, cdnUrl?: string }> = new Map();
  private contentFeatures: Map<string, Record<string, any>> = new Map();
  private userPreferences: Map<string, Record<string, any>> = new Map();
  private viewHistory: Map<string, Set<string>> = new Map();
  
  /**
   * Creates a new Algorithm Manager
   * @param config Configuration for algorithms
   */
  constructor(config?: AlgorithmsConfig) {
    // Initialize with empty config if not provided
    this.config = config || {};
    
    // Initialize with default values if config is incomplete
    if (!this.config.compression) {
      this.config.compression = { 
        enabled: true, 
        algorithm: 'gzip', 
        level: 6 
      };
    }
    
    if (!this.config.deduplication) {
      this.config.deduplication = { 
        enabled: true, 
        detectSimilarContent: true,
        similarityThreshold: 0.95 
      };
    }
    
    if (!this.config.contentRecommendation) {
      this.config.contentRecommendation = { 
        enabled: true, 
        algorithm: 'collaborative-filtering',
        trainingInterval: 3600000 // 1 hour
      };
    }
    
    // Initialize recommendation engine if enabled
    this.initContentRecommendation();
  }
  
  /**
   * Initialize the content recommendation engine
   */
  private initContentRecommendation(): void {
    if (this.config.contentRecommendation?.enabled) {
      this.recommendationEngine = new ContentRecommendationEngine();
      
      // Set recompute interval if provided
      if (this.config.contentRecommendation.trainingInterval) {
        this.recommendationEngine.setRecomputeInterval(
          this.config.contentRecommendation.trainingInterval
        );
      }
      
      console.log('Content recommendation engine initialized');
    }
  }
  
  /**
   * Compresses data using the configured algorithm
   * @param data Data to compress
   * @returns Promise resolving to compressed data
   * @throws Error if compression fails
   */
  public async compressData(data: Buffer): Promise<Buffer> {
    try {
      if (!this.config.compression || !this.config.compression.enabled) {
        // No compression configured, return original data
        return data;
      }

      const algorithm = this.config.compression.algorithm || 'gzip';
      
      switch (algorithm) {
        case 'gzip':
          // Use pako for gzip compression
          const level = this.config.compression.level || 6;
          const compressed = pako.deflate(data, { level });
          return Buffer.from(compressed);
        case 'brotli':
          // Use brotli
          const brotli = require('brotli');
          const brotliLevel = this.config.compression.level || 4;
          const bCompressed = brotli.compress(data, { 
            quality: brotliLevel 
          });
          return Buffer.from(bCompressed);
        case 'zstd':
          // Use zstd
          const zstd = require('node-zstandard');
          const zstdLevel = this.config.compression.level || 3;
          return await new Promise<Buffer>((resolve, reject) => {
            zstd.compress(data, zstdLevel, (err: Error, result: Buffer) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        case 'custom':
          if (this.config.compression.customHandlers?.compress) {
            return await this.config.compression.customHandlers.compress(data);
          }
          throw new Error('Custom compression handler not provided');
        default:
          // Unsupported algorithm, return original data
          console.warn(`Unsupported compression algorithm: ${algorithm}`);
          return data;
      }
    } catch (error) {
      console.error('Compression error:', error);
      // In case of error, return the original data
      return data;
    }
  }
  
  /**
   * Decompresses data using the specified algorithm
   * @param data Data to decompress
   * @param algorithm Compression algorithm used (default: gzip)
   * @returns Promise resolving to decompressed data
   * @throws Error if decompression fails
   */
  public async decompressData(data: Buffer, algorithm: string = 'gzip'): Promise<Buffer> {
    try {
      switch (algorithm) {
        case 'gzip':
          // Use pako for gzip decompression
          const decompressed = pako.inflate(data);
          return Buffer.from(decompressed);
        case 'brotli':
          // Use brotli
          const brotli = require('brotli');
          const bDecompressed = brotli.decompress(data);
          return Buffer.from(bDecompressed);
        case 'zstd':
          // Use zstd
          const zstd = require('node-zstandard');
          return await new Promise<Buffer>((resolve, reject) => {
            zstd.decompress(data, (err: Error, result: Buffer) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        case 'custom':
          if (this.config?.compression?.customHandlers?.decompress) {
            return await this.config.compression.customHandlers.decompress(data);
          }
          throw new Error('Custom decompression handler not provided');
        default:
          // Unsupported algorithm, return original data
          console.warn(`Unsupported decompression algorithm: ${algorithm}`);
          return data;
      }
    } catch (error) {
      console.error('Decompression error:', error);
      // In case of error, return the original data
      return data;
    }
  }
  
  /**
   * Checks if the given data is a duplicate of already stored content
   * Uses content hashing for exact duplicates and similarity detection for near-duplicates
   * @param data Data to check for duplication
   * @returns Promise resolving to duplication check result
   */
  public async checkForDuplicates(data: Buffer | string): Promise<DuplicationResult> {
    try {
      // Skip duplication check if not enabled
      if (!this.config.deduplication?.enabled) {
        return { found: false };
      }
      
      // Convert string to buffer if needed
      const bufferData = typeof data === 'string' ? Buffer.from(data) : data;
      
      // Calculate hash of the data
      const hash = this.calculateContentHash(bufferData);
      
      // Check for exact duplicates first
      if (this.deduplicationCache.has(hash)) {
        const details = this.deduplicationCache.get(hash);
        
        return {
          found: true,
          contentId: details?.contentId,
          publicUrl: details?.publicUrl,
          cdnUrl: details?.cdnUrl,
          confidence: 1.0 // 100% confidence for exact match
        };
      }
      
      // Check for near-duplicates if configured
      if (this.config.deduplication?.detectSimilarContent) {
        const similarityThreshold = this.config.deduplication.similarityThreshold || 0.95;
        const nearDuplicate = await this.findSimilarContent(bufferData, similarityThreshold);
        
        if (nearDuplicate) {
          return {
            found: true,
            contentId: nearDuplicate.contentId,
            publicUrl: nearDuplicate.publicUrl,
            cdnUrl: nearDuplicate.cdnUrl,
            confidence: nearDuplicate.similarity
          };
        }
      }
      
      return { found: false };
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      // Don't throw an error for duplication check - just return not found
      return { found: false };
    }
  }
  
  /**
   * Find similar content using perceptual hashing or other similarity detection methods
   * This is a simplified implementation - in a real system this would use more sophisticated algorithms
   * @param data Data to find similar content for
   * @param threshold Similarity threshold (0-1)
   * @returns Similar content info or null if none found
   */
  private async findSimilarContent(data: Buffer, threshold: number): Promise<{
    contentId: string;
    publicUrl: string;
    cdnUrl?: string;
    similarity: number;
  } | null> {
    // This would implement perceptual hashing or other content-based similarity measures
    // For this example, we're just returning null as if no similar content was found
    return null;
  }
  
  /**
   * Registers a content hash for deduplication
   * @param contentId Content identifier
   * @param data Content data
   * @param publicUrl Public URL for the content
   * @param cdnUrl CDN URL for the content (if available)
   */
  public registerContentHash(contentId: string, data: Buffer | string, publicUrl: string, cdnUrl?: string): void {
    try {
      // Skip if deduplication is not enabled
      if (!this.config.deduplication?.enabled) {
        return;
      }
      
      // Calculate hash of the data
      const hash = this.calculateContentHash(
        typeof data === 'string' ? Buffer.from(data) : data
      );
      
      // Store hash mapping
      this.deduplicationCache.set(hash, {
        contentId,
        publicUrl,
        cdnUrl
      });
      
      // If content features are extracted, store them for recommendation
      if (this.config.contentRecommendation?.enabled) {
        // This would extract features from the content for recommendation
        // For now, we're just storing a placeholder
        this.contentFeatures.set(contentId, {
          hash,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error registering content hash:', error);
      // Don't throw an error for hash registration - just log it
    }
  }
  
  /**
   * Records a content view by a user for recommendation purposes
   * @param userId User ID
   * @param contentId Content ID
   * @param metadata Additional metadata about the view
   */
  public recordContentView(userId: string, contentId: string, metadata?: Record<string, any>): void {
    try {
      // Skip if recommendation is not enabled
      if (!this.config.contentRecommendation?.enabled) {
        return;
      }
      
      // Initialize user's view history if needed
      if (!this.viewHistory.has(userId)) {
        this.viewHistory.set(userId, new Set());
      }
      
      // Add to user's view history
      this.viewHistory.get(userId)!.add(contentId);
      
      // Update user preferences based on this view
      // In a real system, this would use more sophisticated preference modeling
      const preferences = this.userPreferences.get(userId) || {};
      this.userPreferences.set(userId, {
        ...preferences,
        lastViewedContentId: contentId,
        lastViewedAt: Date.now(),
        ...(metadata || {})
      });
    } catch (error) {
      console.error('Error recording content view:', error);
    }
  }
  
  /**
   * Calculates a SHA-256 hash of content data
   * @param data Data to hash
   * @returns Hex string hash
   */
  private calculateContentHash(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Gets content recommendations based on user and content IDs
   * Uses collaborative filtering and content-based methods for recommendations
   * @param userId User identifier
   * @param contentId Current content identifier
   * @param limit Maximum number of recommendations
   * @returns Promise resolving to array of recommendation items
   */
  public async getContentRecommendations(
    userId: string, 
    contentId: string, 
    limit: number = 5
  ): Promise<RecommendationItem[]> {
    try {
      // Check if content recommendation is enabled
      if (!this.config.contentRecommendation?.enabled) {
        return [];
      }
      
      const algorithm = this.config.contentRecommendation.algorithm || 'hybrid';
      const startTime = Date.now();
      const results: RecommendationItem[] = [];
      
      switch (algorithm) {
        case 'collaborative': {
          // Collaborative filtering based recommendations
          // Find users who viewed the same content
          const similarUsers = this.findSimilarUsers(userId, contentId);
          
          // Get content viewed by similar users that the current user hasn't viewed
          const userViewHistory = this.viewHistory.get(userId) || new Set();
          
          for (const similarUser of similarUsers) {
            const similarUserHistory = this.viewHistory.get(similarUser) || new Set();
            
            for (const viewedContentId of similarUserHistory) {
              // Skip if this user already viewed this content or it's the current content
              if (userViewHistory.has(viewedContentId) || viewedContentId === contentId) {
                continue;
              }
              
              // Add to recommendations
              results.push({
                contentId: viewedContentId,
                relevanceScore: 0.8, // Simplified scoring
                reason: 'Users who viewed this also viewed',
                publicUrl: '', // Would be populated in a real implementation
              });
              
              if (results.length >= limit) break;
            }
            
            if (results.length >= limit) break;
          }
          break;
        }
        
        case 'content-based': {
          // Content-based recommendations
          // In a real implementation, this would match content features
          // For this example, we're just using random recommendations
          const allContentIds = [...this.contentFeatures.keys()];
          const userViewHistory = this.viewHistory.get(userId) || new Set();
          
          for (const candidateId of allContentIds) {
            // Skip if this is the current content or the user already viewed it
            if (candidateId === contentId || userViewHistory.has(candidateId)) {
              continue;
            }
            
            results.push({
              contentId: candidateId,
              relevanceScore: 0.7, // Simplified scoring
              reason: 'Similar to what you\'re viewing',
              publicUrl: '', // Would be populated in a real implementation
            });
            
            if (results.length >= limit) break;
          }
          break;
        }
        
        case 'hybrid':
        default: {
          // Hybrid approach: combine collaborative and content-based recommendations
          const collaborativeRecs = await this.getContentRecommendations(userId, contentId, Math.ceil(limit / 2));
          collaborativeRecs.forEach(rec => results.push(rec));
          
          // If we need more recommendations, add content-based ones
          if (results.length < limit) {
            const contentBasedRecs = await this.getContentRecommendations(
              userId, 
              contentId, 
              limit - results.length
            );
            contentBasedRecs.forEach(rec => results.push(rec));
          }
          break;
        }
      }
      
      const endTime = Date.now();
      console.log(`Generated ${results.length} recommendations using ${algorithm} algorithm in ${endTime - startTime}ms`);
      
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error getting content recommendations:', error);
      return [];
    }
  }
  
  /**
   * Find users with similar viewing patterns to the specified user
   * @param userId User ID to find similar users for
   * @param contentId Current content ID (for context)
   * @returns Array of similar user IDs
   */
  private findSimilarUsers(userId: string, contentId: string): string[] {
    // Get the current user's view history
    const userViewHistory = this.viewHistory.get(userId);
    
    if (!userViewHistory || userViewHistory.size === 0) {
      return [];
    }
    
    // Find users who have viewed this content
    const similarUsers: Array<{ userId: string, similarity: number }> = [];
    
    for (const [candidateId, candidateHistory] of this.viewHistory.entries()) {
      // Skip the current user
      if (candidateId === userId) {
        continue;
      }
      
      // Check if this user has viewed the current content
      if (candidateHistory.has(contentId)) {
        // Calculate similarity (Jaccard similarity coefficient)
        const intersection = new Set(
          [...userViewHistory].filter(id => candidateHistory.has(id))
        );
        
        const union = new Set([...userViewHistory, ...candidateHistory]);
        const similarity = intersection.size / union.size;
        
        similarUsers.push({ userId: candidateId, similarity });
      }
    }
    
    // Sort by similarity and return user IDs
    return similarUsers
      .sort((a, b) => b.similarity - a.similarity)
      .map(user => user.userId);
  }
  
  /**
   * Analyzes content to extract metadata and features
   * @param data Content data
   * @param mimeType MIME type of the content
   * @returns Promise resolving to analysis results
   */
  public async analyzeContent(data: Buffer, mimeType: string): Promise<ContentAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Basic analysis for all content types
      const analysis: ContentAnalysisResult = {
        size: data.length,
        mimeType,
        analyzedAt: new Date().toISOString(),
        contentType: 'unknown',
        features: {},
        qualityScore: 0.5 // Default quality score
      };
      
      // Add specific analysis based on mime type
      if (mimeType.startsWith('image/')) {
        // Image analysis
        analysis.contentType = 'image';
        analysis.features = {
          // In a real implementation, these would be calculated from the image data
          dimensions: { width: 800, height: 600 }, // Placeholder
          colorProfile: 'RGB',
          colorCount: 1000,
          averageColor: '#336699',
          imageFormat: mimeType.split('/')[1]
        };
        
        // Simple quality estimation
        const qualityFactors = {
          size: Math.min(1, data.length / (1024 * 1024)) // Size up to 1MB gets higher score
        };
        analysis.qualityScore = qualityFactors.size;
        
        // Generate tags
        analysis.tags = ['image', mimeType.split('/')[1]];
      } else if (mimeType.startsWith('video/')) {
        // Video analysis
        analysis.contentType = 'video';
        analysis.features = {
          // Placeholder values
          duration: 120, // 2 minutes
          resolution: { width: 1280, height: 720 },
          format: mimeType.split('/')[1],
          bitrate: 5000 // 5 Mbps
        };
        
        // Generate tags
        analysis.tags = ['video', '720p', mimeType.split('/')[1]];
      } else if (mimeType.startsWith('text/')) {
        // Text analysis
        analysis.contentType = 'text';
        
        // Convert buffer to string for text analysis
        const text = data.toString('utf-8');
        const wordCount = text.split(/\s+/).length;
        const lineCount = text.split('\n').length;
        
        analysis.features = {
          length: data.length,
          wordCount,
          lineCount,
          charCount: text.length,
          languageProbabilities: {
            'en': 0.95, // Placeholder - would use language detection in a real implementation
            'es': 0.03,
            'fr': 0.02
          }
        };
        
        // Generate tags - in a real implementation, would extract keywords
        analysis.tags = ['text', 'document'];
      } else if (mimeType.startsWith('audio/')) {
        // Audio analysis
        analysis.contentType = 'audio';
        analysis.features = {
          // Placeholder values
          duration: 180, // 3 minutes
          format: mimeType.split('/')[1],
          bitrate: 320 // 320 kbps
        };
        
        // Generate tags
        analysis.tags = ['audio', mimeType.split('/')[1]];
      } else {
        analysis.contentType = 'binary';
        analysis.tags = ['binary', 'file'];
      }
      
      const endTime = Date.now();
      analysis.processingTime = endTime - startTime;
      
      return analysis;
    } catch (error) {
      const endTime = Date.now();
      console.error('Error analyzing content:', error);
      
      return {
        size: data.length,
        mimeType,
        analyzedAt: new Date().toISOString(),
        contentType: 'unknown',
        features: {},
        error: `Failed to analyze content: ${error instanceof Error ? error.message : String(error)}`,
        processingTime: endTime - startTime
      };
    }
  }
  
  /**
   * Updates algorithm configuration
   * @param config New configuration (partial)
   */
  public updateConfig(config: Partial<AlgorithmsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add content metadata for content-based recommendations
   * @param contentId Content ID
   * @param metadata Content metadata
   */
  public addContentMetadata(contentId: string, metadata: ContentMetadata): void {
    if (this.recommendationEngine) {
      this.recommendationEngine.addContentMetadata(contentId, metadata);
    }
  }

  /**
   * Get recommendation engine statistics
   * @returns Statistics object
   */
  public getRecommendationStats(): Record<string, any> | null {
    if (!this.recommendationEngine) {
      return null;
    }
    
    return {
      userCount: this.recommendationEngine.getUserCount(),
      contentCount: this.recommendationEngine.getContentCount(),
      interactionCount: this.recommendationEngine.getInteractionCount()
    };
  }
} 
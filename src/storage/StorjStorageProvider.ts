import { Buffer } from 'buffer';
import axios from 'axios';
import * as crypto from 'crypto';

import {
  StorageProvider,
  ContentToUpload,
  StorageResult,
  RetrievedContent,
  ContentMetadata,
  StorageListing
} from '../core/types';
import { SecurityManager } from '../utils/SecurityManager';
import { 
  SDKError, 
  SDKErrorCode, 
  createStorageProviderError, 
  retryWithBackoff 
} from '../utils/ErrorHandler';

/**
 * Storj Storage Provider Options
 */
export interface StorjStorageProviderOptions {
  /** Storj API URL */
  apiUrl?: string;
  /** Access key for authentication */
  accessKey: string;
  /** Secret key for authentication */
  secretKey: string;
  /** Bucket name */
  bucketName: string;
  /** Whether to use TLS */
  useTLS?: boolean;
  /** Timeout for operations in milliseconds */
  timeout?: number;
  /** Maximum retries for failed operations */
  maxRetries?: number;
}

/**
 * Storage provider implementation for Storj
 */
export class StorjStorageProvider implements StorageProvider {
  private accessKey: string;
  private secretKey: string;
  private bucketName: string;
  private apiUrl: string;
  private timeout: number;
  private maxRetries: number;
  private securityManager: SecurityManager;
  private contentMetadataCache: Map<string, ContentMetadata> = new Map();

  /**
   * Creates a new Storj Storage Provider
   * @param options Configuration options
   */
  constructor(options: StorjStorageProviderOptions) {
    if (!options.accessKey || !options.secretKey || !options.bucketName) {
      throw createStorageProviderError(
        'Storj storage provider requires accessKey, secretKey, and bucketName',
        { operation: 'constructor' }
      );
    }

    this.accessKey = options.accessKey;
    this.secretKey = options.secretKey;
    this.bucketName = options.bucketName;
    this.apiUrl = options.apiUrl || 'https://gateway.storjshare.io';
    this.timeout = options.timeout || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.securityManager = new SecurityManager();

    // Enforce TLS if required by security configuration
    if (options.useTLS !== false) {
      this.apiUrl = this.securityManager.validateTLS(this.apiUrl);
    }
  }

  /**
   * Helper to create request headers with authentication
   * @param method HTTP method
   * @param path Request path
   * @param contentType Content type
   * @returns Headers for the request
   */
  private createAuthHeaders(
    method: string,
    path: string,
    contentType: string = 'application/octet-stream'
  ): Record<string, string> {
    const timestamp = new Date().toISOString();
    const pathWithBucket = `/${this.bucketName}${path.startsWith('/') ? path : '/' + path}`;
    
    // Create string to sign
    const stringToSign = `${method}\n${timestamp}\n${pathWithBucket}\n${contentType}`;
    
    // Create signature
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(stringToSign)
      .digest('hex');
    
    // Return headers
    return {
      'Authorization': `Bearer ${this.accessKey}:${signature}`,
      'X-Storj-Timestamp': timestamp,
      'Content-Type': contentType
    };
  }

  /**
   * Upload content to Storj
   * @param content Content to upload
   * @returns Promise resolving to storage result
   */
  public async uploadContent(content: ContentToUpload): Promise<StorageResult> {
    try {
      // Validate paths if provided
      if (content.path) {
        content.path = this.securityManager.validatePath(content.path);
      }
      
      // Sanitize metadata and filename
      if (content.metadata) {
        content.metadata = this.securityManager.sanitizeInput(content.metadata);
      }
      
      if (content.filename) {
        content.filename = this.securityManager.sanitizeInput(content.filename) as string;
      }
      
      // Convert string data to Buffer if needed
      const contentData = typeof content.data === 'string' ? 
        Buffer.from(content.data) : 
        content.data;
      
      // Calculate content hash for integrity
      const contentHash = crypto
        .createHash('sha256')
        .update(contentData)
        .digest('hex');
      
      // Define the object path in Storj bucket
      const objectPath = content.path ? 
        `${content.path}/${content.filename || contentHash}` : 
        content.filename || contentHash;
      
      // Upload with retry logic
      const result = await retryWithBackoff(async () => {
        const headers = this.createAuthHeaders('PUT', objectPath, content.mimeType);
        
        const response = await axios({
          method: 'PUT',
          url: `${this.apiUrl}/${this.bucketName}/${objectPath}`,
          headers,
          data: contentData,
          timeout: this.timeout,
          maxContentLength: Infinity
        });
        
        if (response.status !== 200 && response.status !== 201) {
          throw createStorageProviderError(
            `Failed to upload to Storj: ${response.statusText}`,
            { 
              operation: 'uploadContent',
              context: { status: response.status, statusText: response.statusText }
            }
          );
        }
        
        return response;
      }, { maxRetries: this.maxRetries });
      
      // Generate metadata
      const metadata: ContentMetadata = {
        contentId: objectPath,
        mimeType: content.mimeType,
        size: contentData.length,
        filename: content.filename,
        created: new Date(),
        updated: new Date(),
        encrypted: false, // Will be set to true by SDK if encryption is used
        hash: contentHash,
        customMetadata: {
          ...content.metadata,
          storjBucket: this.bucketName
        }
      };
      
      // Cache metadata
      this.contentMetadataCache.set(objectPath, metadata);
      
      // Save metadata as a separate object
      const metadataObjectPath = `${objectPath}.metadata.json`;
      const metadataContent = JSON.stringify(metadata);
      
      // Upload metadata with retry logic (but don't fail if this fails)
      try {
        await retryWithBackoff(async () => {
          const headers = this.createAuthHeaders('PUT', metadataObjectPath, 'application/json');
          
          const response = await axios({
            method: 'PUT',
            url: `${this.apiUrl}/${this.bucketName}/${metadataObjectPath}`,
            headers,
            data: metadataContent,
            timeout: this.timeout
          });
          
          return response;
        }, { maxRetries: 2 });
      } catch (error) {
        console.warn('Failed to upload metadata to Storj, continuing anyway:', error);
      }
      
      // Generate public URL
      const publicUrl = `${this.apiUrl}/${this.bucketName}/${objectPath}`;
      
      // Return storage result
      return {
        contentId: objectPath,
        publicUrl,
        size: contentData.length,
        encrypted: false, // Will be updated by SDK if encryption was used
        timestamp: new Date(),
        providerDetails: {
          bucket: this.bucketName,
          objectKey: objectPath,
          metadataKey: metadataObjectPath,
          integrityHash: contentHash
        }
      };
    } catch (error) {
      console.error('Error uploading to Storj:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else if (axios.isAxiosError(error)) {
        throw createStorageProviderError(
          `Failed to upload to Storj: ${error.message}`,
          {
            operation: 'uploadContent',
            originalError: error,
            context: {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            }
          }
        );
      } else {
        throw createStorageProviderError(
          `Failed to upload to Storj: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }

  /**
   * Retrieve content from Storj
   * @param contentId Content ID (object path)
   * @returns Promise resolving to retrieved content
   */
  public async retrieveContent(contentId: string): Promise<RetrievedContent> {
    try {
      // Sanitize content ID
      contentId = this.securityManager.sanitizeInput(contentId) as string;
      
      // Make sure contentId is a valid path
      contentId = this.securityManager.validatePath(contentId);
      
      let metadata: ContentMetadata;
      
      // Try to get metadata from cache first
      if (this.contentMetadataCache.has(contentId)) {
        metadata = this.contentMetadataCache.get(contentId)!;
      } else {
        // Try to fetch metadata from Storj
        try {
          const metadataObjectPath = `${contentId}.metadata.json`;
          
          const metadataResponse = await retryWithBackoff(async () => {
            const headers = this.createAuthHeaders('GET', metadataObjectPath);
            
            return await axios({
              method: 'GET',
              url: `${this.apiUrl}/${this.bucketName}/${metadataObjectPath}`,
              headers,
              timeout: this.timeout,
              responseType: 'json'
            });
          }, { maxRetries: 2 });
          
          // Parse metadata
          metadata = this.securityManager.sanitizeInput(metadataResponse.data) as ContentMetadata;
          
          // Cache metadata
          this.contentMetadataCache.set(contentId, metadata);
        } catch (error) {
          // If metadata not found, create basic metadata
          metadata = {
            contentId,
            mimeType: 'application/octet-stream',
            size: 0,
            created: new Date(),
            updated: new Date(),
            encrypted: false,
            hash: '',
            customMetadata: {
              storjBucket: this.bucketName
            }
          };
        }
      }
      
      // Fetch content from Storj with retry logic
      const response = await retryWithBackoff(async () => {
        const headers = this.createAuthHeaders('GET', contentId);
        
        return await axios({
          method: 'GET',
          url: `${this.apiUrl}/${this.bucketName}/${contentId}`,
          headers,
          timeout: this.timeout,
          responseType: 'arraybuffer'
        });
      }, { maxRetries: this.maxRetries });
      
      // Update metadata size if not set
      if (metadata.size === 0 && response.data) {
        metadata.size = response.data.byteLength;
      }
      
      // If metadata mime type is not set, use the one from response
      if (metadata.mimeType === 'application/octet-stream' && response.headers['content-type']) {
        metadata.mimeType = response.headers['content-type'];
      }
      
      // Convert response to buffer
      const contentBuffer = Buffer.from(response.data);
      
      // Verify content integrity if hash is available
      if (metadata.hash) {
        const contentHash = crypto
          .createHash('sha256')
          .update(contentBuffer)
          .digest('hex');
          
        if (contentHash !== metadata.hash) {
          throw createStorageProviderError(
            'Content integrity verification failed. The content may have been tampered with.',
            { 
              operation: 'retrieveContent',
              context: { 
                expectedHash: metadata.hash, 
                actualHash: contentHash 
              }
            }
          );
        }
      }
      
      // Return content with metadata
      return {
        data: contentBuffer,
        metadata
      };
    } catch (error) {
      console.error('Error retrieving from Storj:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw createStorageProviderError(
          `Content not found in Storj: ${contentId}`,
          {
            operation: 'retrieveContent',
            originalError: error,
            context: { contentId }
          }
        );
      } else if (axios.isAxiosError(error)) {
        throw createStorageProviderError(
          `Failed to retrieve from Storj: ${error.message}`,
          {
            operation: 'retrieveContent',
            originalError: error,
            context: {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            }
          }
        );
      } else {
        throw createStorageProviderError(
          `Failed to retrieve from Storj: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }

  /**
   * Delete content from Storj
   * @param contentId Content ID (object path)
   * @returns Promise resolving to success status
   */
  public async deleteContent(contentId: string): Promise<boolean> {
    try {
      // Sanitize content ID
      contentId = this.securityManager.sanitizeInput(contentId) as string;
      
      // Make sure contentId is a valid path
      contentId = this.securityManager.validatePath(contentId);
      
      // Delete content
      await retryWithBackoff(async () => {
        const headers = this.createAuthHeaders('DELETE', contentId);
        
        return await axios({
          method: 'DELETE',
          url: `${this.apiUrl}/${this.bucketName}/${contentId}`,
          headers,
          timeout: this.timeout
        });
      }, { maxRetries: this.maxRetries });
      
      // Try to delete metadata object as well
      try {
        const metadataObjectPath = `${contentId}.metadata.json`;
        
        await retryWithBackoff(async () => {
          const headers = this.createAuthHeaders('DELETE', metadataObjectPath);
          
          return await axios({
            method: 'DELETE',
            url: `${this.apiUrl}/${this.bucketName}/${metadataObjectPath}`,
            headers,
            timeout: this.timeout
          });
        }, { maxRetries: 1 });
      } catch (error) {
        // Ignore errors when deleting metadata
        console.warn('Failed to delete metadata from Storj, continuing anyway:', error);
      }
      
      // Remove from metadata cache
      this.contentMetadataCache.delete(contentId);
      
      return true;
    } catch (error) {
      console.error('Error deleting from Storj:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        // If content not found, consider deletion successful
        return true;
      } else if (axios.isAxiosError(error)) {
        throw createStorageProviderError(
          `Failed to delete from Storj: ${error.message}`,
          {
            operation: 'deleteContent',
            originalError: error,
            context: {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            }
          }
        );
      } else {
        throw createStorageProviderError(
          `Failed to delete from Storj: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }

  /**
   * List all content in Storj bucket
   * @returns Promise resolving to storage listing
   */
  public async listContent(): Promise<StorageListing> {
    try {
      const result = await retryWithBackoff(async () => {
        const headers = this.createAuthHeaders('GET', '/');
        
        return await axios({
          method: 'GET',
          url: `${this.apiUrl}/${this.bucketName}/`,
          headers,
          params: {
            'list-type': 2,
            'max-keys': 1000
          },
          timeout: this.timeout,
          responseType: 'text'
        });
      }, { maxRetries: this.maxRetries });
      
      // Simple XML parsing (in a real implementation we'd use a proper XML parser)
      const itemMatches = result.data.match(/<Key>(.*?)<\/Key>/g) || [];
      const items: ContentMetadata[] = [];
      
      for (const match of itemMatches) {
        const key = match.replace(/<Key>(.*?)<\/Key>/, '$1');
        
        // Skip metadata files
        if (key.endsWith('.metadata.json')) {
          continue;
        }
        
        // Get size
        const sizeMatch = result.data.match(new RegExp(`<Key>${key}</Key>.*?<Size>(\\d+)</Size>`, 's'));
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
        
        // Get last modified
        const lastModifiedMatch = result.data.match(new RegExp(`<Key>${key}</Key>.*?<LastModified>(.*?)</LastModified>`, 's'));
        const lastModified = lastModifiedMatch ? new Date(lastModifiedMatch[1]) : new Date();
        
        // Create metadata
        const metadata: ContentMetadata = {
          contentId: key,
          mimeType: 'application/octet-stream', // Default
          size,
          created: lastModified,
          updated: lastModified,
          encrypted: false,
          hash: '',
          customMetadata: {
            storjBucket: this.bucketName
          }
        };
        
        // Add to items
        items.push(metadata);
        
        // Cache metadata
        this.contentMetadataCache.set(key, metadata);
      }
      
      // Return listing
      return {
        items,
        totalItems: items.length
      };
    } catch (error) {
      console.error('Error listing Storj content:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else if (axios.isAxiosError(error)) {
        throw createStorageProviderError(
          `Failed to list content from Storj: ${error.message}`,
          {
            operation: 'listContent',
            originalError: error,
            context: {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            }
          }
        );
      } else {
        throw createStorageProviderError(
          `Failed to list content from Storj: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }

  /**
   * Get content metadata from Storj
   * @param contentId Content ID (object path)
   * @returns Promise resolving to content metadata
   */
  public async getContentMetadata(contentId: string): Promise<ContentMetadata> {
    try {
      // Sanitize content ID
      contentId = this.securityManager.sanitizeInput(contentId) as string;
      
      // Make sure contentId is a valid path
      contentId = this.securityManager.validatePath(contentId);
      
      // Check if metadata is cached
      if (this.contentMetadataCache.has(contentId)) {
        return this.contentMetadataCache.get(contentId)!;
      }
      
      // Try to load metadata from dedicated metadata object
      try {
        const metadataObjectPath = `${contentId}.metadata.json`;
        
        const metadataResponse = await retryWithBackoff(async () => {
          const headers = this.createAuthHeaders('GET', metadataObjectPath);
          
          return await axios({
            method: 'GET',
            url: `${this.apiUrl}/${this.bucketName}/${metadataObjectPath}`,
            headers,
            timeout: this.timeout,
            responseType: 'json'
          });
        }, { maxRetries: 2 });
        
        // Parse and sanitize metadata
        const metadata = this.securityManager.sanitizeInput(metadataResponse.data) as ContentMetadata;
        
        // Cache metadata
        this.contentMetadataCache.set(contentId, metadata);
        
        return metadata;
      } catch (error) {
        // If metadata object not found, try to get basic info about the object
        const headResponse = await retryWithBackoff(async () => {
          const headers = this.createAuthHeaders('HEAD', contentId);
          
          return await axios({
            method: 'HEAD',
            url: `${this.apiUrl}/${this.bucketName}/${contentId}`,
            headers,
            timeout: this.timeout
          });
        }, { maxRetries: this.maxRetries });
        
        // Create basic metadata from headers
        const size = parseInt(headResponse.headers['content-length'] || '0', 10);
        const mimeType = headResponse.headers['content-type'] || 'application/octet-stream';
        const lastModified = headResponse.headers['last-modified'] ? 
          new Date(headResponse.headers['last-modified']) : 
          new Date();
        
        const metadata: ContentMetadata = {
          contentId,
          mimeType,
          size,
          created: lastModified,
          updated: lastModified,
          encrypted: false,
          hash: '',
          customMetadata: {
            storjBucket: this.bucketName
          }
        };
        
        // Cache metadata
        this.contentMetadataCache.set(contentId, metadata);
        
        return metadata;
      }
    } catch (error) {
      console.error('Error getting Storj content metadata:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw createStorageProviderError(
          `Content not found in Storj: ${contentId}`,
          {
            operation: 'getContentMetadata',
            originalError: error,
            context: { contentId }
          }
        );
      } else if (axios.isAxiosError(error)) {
        throw createStorageProviderError(
          `Failed to get metadata from Storj: ${error.message}`,
          {
            operation: 'getContentMetadata',
            originalError: error,
            context: {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            }
          }
        );
      } else {
        throw createStorageProviderError(
          `Failed to get metadata from Storj: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }

  /**
   * Initialize the Storj storage provider
   * Validates connection to Storj
   */
  public async initialize(): Promise<void> {
    try {
      // Check bucket exists by making a HEAD request
      await retryWithBackoff(async () => {
        const headers = this.createAuthHeaders('HEAD', '/');
        
        return await axios({
          method: 'HEAD',
          url: `${this.apiUrl}/${this.bucketName}/`,
          headers,
          timeout: this.timeout
        });
      }, { maxRetries: this.maxRetries });
      
      console.log(`Connected to Storj bucket: ${this.bucketName}`);
    } catch (error) {
      console.error('Error initializing Storj storage provider:', error);
      
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw createStorageProviderError(
          `Storj bucket not found: ${this.bucketName}`,
          {
            operation: 'initialize',
            originalError: error,
            context: { bucket: this.bucketName }
          }
        );
      } else if (axios.isAxiosError(error) && error.response?.status === 403) {
        throw createStorageProviderError(
          `Authentication failed for Storj bucket: ${this.bucketName}`,
          {
            operation: 'initialize',
            originalError: error,
            context: { bucket: this.bucketName }
          }
        );
      } else {
        throw createStorageProviderError(
          `Failed to initialize Storj storage provider: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }
} 
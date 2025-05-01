import { create, IPFSHTTPClient } from 'ipfs-http-client';
import { CID } from 'multiformats/cid';
import { Buffer } from 'buffer';
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
import { SDKError, SDKErrorCode, createStorageProviderError } from '../utils/ErrorHandler';

/**
 * IPFS Storage Provider Options
 */
export interface IPFSStorageProviderOptions {
  /** IPFS gateway URL */
  gateway?: string;
  /** API key for the IPFS gateway */
  apiKey?: string;
  /** Whether to use TLS for connections */
  useTLS?: boolean;
  /** Timeout for IPFS operations in milliseconds */
  timeout?: number;
  /** Maximum retries for failed operations */
  maxRetries?: number;
  /** Whether to pin content automatically */
  autoPin?: boolean;
}

/**
 * IPFS Storage Provider implementation
 * Handles uploading and retrieving content from IPFS
 */
export class IPFSStorageProvider implements StorageProvider {
  private client: IPFSHTTPClient;
  private contentMetadataCache: Map<string, ContentMetadata> = new Map();
  private securityManager: SecurityManager;
  private options: IPFSStorageProviderOptions;
  private defaultGateway = 'https://ipfs.infura.io:5001';
  
  /**
   * Creates a new IPFS Storage Provider
   * @param options IPFS storage provider options
   */
  constructor(options?: IPFSStorageProviderOptions) {
    this.options = {
      gateway: options?.gateway || this.defaultGateway,
      apiKey: options?.apiKey,
      useTLS: options?.useTLS !== false, // Default to true
      timeout: options?.timeout || 30000, // Default 30 seconds
      maxRetries: options?.maxRetries || 3,
      autoPin: options?.autoPin !== false // Default to true
    };
    
    // Initialize security manager
    this.securityManager = new SecurityManager();
    
    // Validate gateway URL
    if (this.options.useTLS && this.options.gateway) {
      this.options.gateway = this.securityManager.validateTLS(this.options.gateway);
    }
    
    // Configure authentication if API key is provided
    const auth = this.options.apiKey ? 
      'Basic ' + Buffer.from(this.options.apiKey.includes(':') ? 
        this.options.apiKey : 
        `${this.options.apiKey}:`).toString('base64') : 
      undefined;
    
    // Create IPFS client with timeout
    this.client = create({
      url: this.options.gateway,
      headers: auth ? { authorization: auth } : undefined,
      timeout: this.options.timeout
    });
  }
  
  /**
   * Uploads content to IPFS
   * @param content The content to upload
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
      
      // Create metadata object with enhanced security
      const metadata = {
        name: content.filename || 'unnamed',
        mimeType: content.mimeType,
        size: contentData.length,
        path: content.path,
        customMetadata: content.metadata,
        encrypted: false, // Will be set to true by SDK if encryption is used
        accessControl: content.accessControl,
        created: new Date(),
        updated: new Date(),
        integrityHash: contentHash
      };
      
      // Add metadata to IPFS with retry logic
      let metadataCid;
      for (let attempt = 0; attempt <= this.options.maxRetries!; attempt++) {
        try {
          metadataCid = await this.client.add(JSON.stringify(metadata));
          break;
        } catch (error) {
          if (attempt === this.options.maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
      
      if (!metadataCid) {
        throw createStorageProviderError('Failed to add metadata to IPFS after multiple attempts');
      }
      
      // Add actual content to IPFS with retry logic
      let result;
      for (let attempt = 0; attempt <= this.options.maxRetries!; attempt++) {
        try {
          result = await this.client.add(contentData, {
            pin: this.options.autoPin
          });
          break;
        } catch (error) {
          if (attempt === this.options.maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
      
      if (!result) {
        throw createStorageProviderError('Failed to add content to IPFS after multiple attempts');
      }
      
      const contentId = result.path;
      
      // Generate public URL using HTTPS for security
      const publicUrl = `https://ipfs.io/ipfs/${contentId}`;
      
      // Store metadata with content ID reference
      const contentMetadata: ContentMetadata = {
        contentId,
        mimeType: content.mimeType,
        size: contentData.length,
        filename: content.filename,
        created: new Date(),
        updated: new Date(),
        encrypted: false, // Will be set to true by SDK if encryption is used
        hash: contentHash,
        customMetadata: {
          ...content.metadata,
          metadataCid: metadataCid.path
        }
      };
      
      // Cache the metadata for faster retrieval later
      this.contentMetadataCache.set(contentId, contentMetadata);
      
      // Return the storage result
      return {
        contentId,
        publicUrl,
        size: contentData.length,
        encrypted: false, // Will be updated by SDK if encryption was used
        timestamp: new Date(),
        providerDetails: {
          metadataCid: metadataCid.path,
          gateway: 'ipfs.io',
          integrityHash: contentHash
        }
      };
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw createStorageProviderError(
        `Failed to upload content to IPFS: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }
  
  /**
   * Retrieves content from IPFS
   * @param contentId The CID of the content to retrieve
   * @returns Promise resolving to the retrieved content
   */
  public async retrieveContent(contentId: string): Promise<RetrievedContent> {
    try {
      // Sanitize content ID
      contentId = this.securityManager.sanitizeInput(contentId) as string;
      
      // Validate CID format
      try {
        CID.parse(contentId);
      } catch (error) {
        throw createStorageProviderError(`Invalid IPFS CID format: ${contentId}`);
      }
      
      // Get metadata (either from cache or fetch it)
      const metadata = await this.getContentMetadata(contentId);
      
      // Get the content from IPFS with retry logic
      const chunks: Uint8Array[] = [];
      
      for (let attempt = 0; attempt <= this.options.maxRetries!; attempt++) {
        try {
          for await (const chunk of this.client.cat(contentId)) {
            chunks.push(chunk);
          }
          break;
        } catch (error) {
          if (attempt === this.options.maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          // Clear chunks from previous attempt
          chunks.length = 0;
        }
      }
      
      if (chunks.length === 0) {
        throw createStorageProviderError(`Failed to retrieve content from IPFS after multiple attempts: ${contentId}`);
      }
      
      // Combine chunks into a single buffer
      const allChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      
      const contentBuffer = Buffer.from(allChunks);
      
      // Verify content integrity if hash is available
      if (metadata.hash && metadata.hash !== contentId) {
        const contentHash = crypto
          .createHash('sha256')
          .update(contentBuffer)
          .digest('hex');
          
        if (contentHash !== metadata.hash) {
          throw createStorageProviderError(
            'Content integrity verification failed. The content may have been tampered with.',
            { expectedHash: metadata.hash, actualHash: contentHash }
          );
        }
      }
      
      // Return the content with its metadata
      return {
        data: contentBuffer,
        metadata
      };
    } catch (error) {
      console.error('Error retrieving from IPFS:', error);
      if (error instanceof SDKError) {
        throw error;
      } else {
        throw createStorageProviderError(
          `Failed to retrieve content from IPFS: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }
  
  /**
   * Deletes content from IPFS (Note: Content on IPFS cannot be truly deleted,
   * but this method will remove it from local cache and can stop pinning it)
   * @param contentId The CID of the content to delete
   * @returns Promise resolving to a boolean indicating "success"
   */
  public async deleteContent(contentId: string): Promise<boolean> {
    try {
      // Sanitize content ID
      contentId = this.securityManager.sanitizeInput(contentId) as string;
      
      // Validate CID format
      try {
        CID.parse(contentId);
      } catch (error) {
        throw createStorageProviderError(`Invalid IPFS CID format: ${contentId}`);
      }
      
      // Remove from local metadata cache
      this.contentMetadataCache.delete(contentId);
      
      // Try to unpin the content with retry logic
      if (this.options.autoPin) {
        for (let attempt = 0; attempt <= this.options.maxRetries!; attempt++) {
          try {
            await this.client.pin.rm(contentId);
            console.log(`Unpinned content ${contentId} from IPFS`);
            break;
          } catch (error) {
            if (attempt === this.options.maxRetries) {
              console.warn(`Could not unpin content ${contentId} after multiple attempts:`, error);
              // This is not a fatal error as the content might be pinned on nodes we don't control
            } else {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting from IPFS:', error);
      if (error instanceof SDKError) {
        throw error;
      } else {
        throw createStorageProviderError(
          `Failed to delete content from IPFS: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }
  
  /**
   * Lists content from IPFS
   * Note: This is limited to content we have metadata for
   * @returns Promise resolving to a listing of content
   */
  public async listContent(): Promise<StorageListing> {
    try {
      // In a real implementation, we might store a list of user's content in a database
      // For this example, we can only return what's in our local cache
      const items = Array.from(this.contentMetadataCache.values());
      
      return {
        items,
        totalItems: items.length
      };
    } catch (error) {
      console.error('Error listing IPFS content:', error);
      throw createStorageProviderError(
        `Failed to list IPFS content: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }
  
  /**
   * Gets metadata for content stored on IPFS
   * @param contentId The CID of the content
   * @returns Promise resolving to content metadata
   */
  public async getContentMetadata(contentId: string): Promise<ContentMetadata> {
    try {
      // Sanitize content ID
      contentId = this.securityManager.sanitizeInput(contentId) as string;
      
      // Check if metadata is in the cache
      if (this.contentMetadataCache.has(contentId)) {
        return this.contentMetadataCache.get(contentId)!;
      }
      
      // Try to get the metadata CID from the content's metadata
      // In a real implementation, we would have a database of content to metadata mappings
      try {
        let metadataCid: string | null = null;
        
        // Try to get pin data which might have metadata with retry logic
        for (let attempt = 0; attempt <= this.options.maxRetries!; attempt++) {
          try {
            const pins = await this.client.pin.ls({ paths: [contentId] });
            for await (const pin of pins) {
              if (pin.type === 'recursive' && pin.metadata) {
                metadataCid = pin.metadata.metadataCid;
                break;
              }
            }
            break;
          } catch (error) {
            if (attempt === this.options.maxRetries) {
              throw error;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          }
        }
        
        if (metadataCid) {
          // Fetch the metadata from IPFS with retry logic
          const chunks: Uint8Array[] = [];
          
          for (let attempt = 0; attempt <= this.options.maxRetries!; attempt++) {
            try {
              for await (const chunk of this.client.cat(metadataCid)) {
                chunks.push(chunk);
              }
              break;
            } catch (error) {
              if (attempt === this.options.maxRetries) {
                throw error;
              }
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
              // Clear chunks from previous attempt
              chunks.length = 0;
            }
          }
          
          if (chunks.length === 0) {
            throw new Error(`Failed to retrieve metadata from IPFS after multiple attempts: ${metadataCid}`);
          }
          
          // Combine chunks
          const allChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
          let position = 0;
          for (const chunk of chunks) {
            allChunks.set(chunk, position);
            position += chunk.length;
          }
          
          // Parse metadata
          const metadataStr = Buffer.from(allChunks).toString('utf8');
          const parsedMetadata = JSON.parse(metadataStr);
          
          // Sanitize metadata for security
          const sanitizedMetadata = this.securityManager.sanitizeInput(parsedMetadata);
          
          // Create ContentMetadata object
          const metadata: ContentMetadata = {
            contentId,
            mimeType: sanitizedMetadata.mimeType || 'application/octet-stream',
            size: sanitizedMetadata.size || 0,
            filename: sanitizedMetadata.name,
            created: new Date(sanitizedMetadata.created || Date.now()),
            updated: new Date(sanitizedMetadata.updated || Date.now()),
            encrypted: sanitizedMetadata.encrypted || false,
            hash: sanitizedMetadata.integrityHash || contentId,
            customMetadata: sanitizedMetadata.customMetadata || {}
          };
          
          // Cache the metadata
          this.contentMetadataCache.set(contentId, metadata);
          
          return metadata;
        }
      } catch (error) {
        console.warn(`Could not fetch metadata for ${contentId}:`, error);
        // Continue to fallback approach
      }
      
      // Fallback: Create basic metadata based on the content itself
      let stat;
      for (let attempt = 0; attempt <= this.options.maxRetries!; attempt++) {
        try {
          stat = await this.client.files.stat(`/ipfs/${contentId}`);
          break;
        } catch (error) {
          if (attempt === this.options.maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
      
      if (!stat) {
        throw createStorageProviderError(`Failed to get stats for IPFS content: ${contentId}`);
      }
      
      const metadata: ContentMetadata = {
        contentId,
        mimeType: 'application/octet-stream', // Default mime type
        size: stat.size || 0,
        created: new Date(),
        updated: new Date(),
        encrypted: false,
        hash: contentId,
        customMetadata: {}
      };
      
      // Cache the metadata
      this.contentMetadataCache.set(contentId, metadata);
      
      return metadata;
    } catch (error) {
      console.error('Error getting IPFS content metadata:', error);
      if (error instanceof SDKError) {
        throw error;
      } else {
        throw createStorageProviderError(
          `Failed to get content metadata from IPFS: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        );
      }
    }
  }
} 
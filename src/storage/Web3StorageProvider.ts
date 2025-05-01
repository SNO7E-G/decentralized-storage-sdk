import { Web3Storage, File, Blob } from 'web3.storage';
import { 
  StorageProvider, 
  ContentToUpload, 
  StorageResult, 
  RetrievedContent, 
  ContentMetadata, 
  StorageListing 
} from '../core/types';

/**
 * Web3.Storage Provider implementation
 * Handles uploading and retrieving content using web3.storage (IPFS-based storage)
 */
export class Web3StorageProvider implements StorageProvider {
  private client: Web3Storage;
  private contentMetadataCache: Map<string, ContentMetadata> = new Map();
  
  /**
   * Creates a new Web3.Storage Provider
   * @param apiKey API token for Web3.Storage
   */
  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error('API key is required for Web3.Storage provider');
    }
    
    this.client = new Web3Storage({ token: apiKey });
  }
  
  /**
   * Uploads content to Web3.Storage
   * @param content The content to upload
   * @returns Promise resolving to storage result
   */
  public async uploadContent(content: ContentToUpload): Promise<StorageResult> {
    try {
      // Convert string data to Buffer if needed
      const contentData = typeof content.data === 'string' ? 
        Buffer.from(content.data) : 
        content.data;
      
      // Create metadata object
      const metadata = {
        name: content.filename || 'unnamed',
        mimeType: content.mimeType,
        size: contentData.length,
        path: content.path,
        customMetadata: content.metadata,
        encrypted: false, // Will be set to true by SDK if encryption is used
        accessControl: content.accessControl,
        created: new Date(),
        updated: new Date()
      };
      
      // Create files to upload (content file and metadata file)
      const files = [
        new File([contentData], content.filename || 'content'),
        new File([JSON.stringify(metadata)], 'metadata.json')
      ];
      
      // Upload to Web3.Storage
      const cid = await this.client.put(files, {
        name: content.filename || 'unnamed',
        wrapWithDirectory: true
      });
      
      // The contentId is the CID of the uploaded content
      const contentId = cid;
      
      // Generate public URLs
      const publicUrl = `https://${contentId}.ipfs.dweb.link/${content.filename || 'content'}`;
      const metadataUrl = `https://${contentId}.ipfs.dweb.link/metadata.json`;
      
      // Create and cache the metadata
      const contentMetadata: ContentMetadata = {
        contentId,
        mimeType: content.mimeType,
        size: contentData.length,
        filename: content.filename,
        created: new Date(),
        updated: new Date(),
        encrypted: false, // Will be set to true by SDK if encryption is used
        hash: contentId,
        customMetadata: {
          ...content.metadata,
          metadataUrl
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
          metadataUrl,
          gateway: 'dweb.link'
        }
      };
    } catch (error) {
      console.error('Error uploading to Web3.Storage:', error);
      throw new Error(`Failed to upload content to Web3.Storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Retrieves content from Web3.Storage
   * @param contentId The CID of the content to retrieve
   * @returns Promise resolving to the retrieved content
   */
  public async retrieveContent(contentId: string): Promise<RetrievedContent> {
    try {
      // Get metadata (either from cache or fetch it)
      const metadata = await this.getContentMetadata(contentId);
      
      // Get the content from Web3.Storage
      const res = await fetch(`https://${contentId}.ipfs.dweb.link/${metadata.filename || 'content'}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch content: HTTP ${res.status}`);
      }
      
      // Get the data as an ArrayBuffer
      const arrayBuffer = await res.arrayBuffer();
      
      // Return the content with its metadata
      return {
        data: Buffer.from(arrayBuffer),
        metadata
      };
    } catch (error) {
      console.error('Error retrieving from Web3.Storage:', error);
      throw new Error(`Failed to retrieve content from Web3.Storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Deletes content from Web3.Storage
   * Note: Web3.Storage doesn't support true deletion, but we can remove from our local records
   * @param contentId The CID of the content to delete
   * @returns Promise resolving to a boolean indicating "success"
   */
  public async deleteContent(contentId: string): Promise<boolean> {
    try {
      // Remove from local metadata cache
      this.contentMetadataCache.delete(contentId);
      
      // Web3.Storage doesn't support deletion, but we can update our list
      console.warn('Web3.Storage does not support true deletion. Content will remain on IPFS but has been removed from local records.');
      
      return true;
    } catch (error) {
      console.error('Error managing Web3.Storage deletion:', error);
      throw new Error(`Failed to update deletion records: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Lists content from Web3.Storage
   * @returns Promise resolving to a listing of content
   */
  public async listContent(): Promise<StorageListing> {
    try {
      // Get uploads from Web3.Storage
      const uploads = [];
      
      // Using for await loop to handle the async iterator
      for await (const upload of this.client.list()) {
        uploads.push(upload);
      }
      
      // Convert uploads to ContentMetadata and update cache
      const items: ContentMetadata[] = [];
      
      for (const upload of uploads) {
        // Check if we already have this in cache
        if (this.contentMetadataCache.has(upload.cid)) {
          items.push(this.contentMetadataCache.get(upload.cid)!);
          continue;
        }
        
        // Try to get metadata
        try {
          // Fetch the metadata.json file if it exists
          const res = await fetch(`https://${upload.cid}.ipfs.dweb.link/metadata.json`);
          
          if (res.ok) {
            const metadataObj = await res.json();
            
            // Create content metadata
            const metadata: ContentMetadata = {
              contentId: upload.cid,
              mimeType: metadataObj.mimeType || 'application/octet-stream',
              size: metadataObj.size || 0,
              filename: metadataObj.name,
              created: new Date(metadataObj.created || upload.created),
              updated: new Date(metadataObj.updated || upload.created),
              encrypted: metadataObj.encrypted || false,
              hash: upload.cid,
              customMetadata: metadataObj.customMetadata || {}
            };
            
            // Cache the metadata
            this.contentMetadataCache.set(upload.cid, metadata);
            items.push(metadata);
          } else {
            // Fallback if metadata.json doesn't exist
            const metadata: ContentMetadata = {
              contentId: upload.cid,
              mimeType: 'application/octet-stream',
              size: 0, // Size unknown
              filename: upload.name,
              created: new Date(upload.created),
              updated: new Date(upload.created),
              encrypted: false,
              hash: upload.cid,
              customMetadata: {}
            };
            
            // Cache the metadata
            this.contentMetadataCache.set(upload.cid, metadata);
            items.push(metadata);
          }
        } catch (error) {
          console.warn(`Error fetching metadata for ${upload.cid}:`, error);
          
          // Create basic metadata without details from the metadata.json
          const metadata: ContentMetadata = {
            contentId: upload.cid,
            mimeType: 'application/octet-stream',
            size: 0, // Size unknown
            filename: upload.name,
            created: new Date(upload.created),
            updated: new Date(upload.created),
            encrypted: false,
            hash: upload.cid,
            customMetadata: {}
          };
          
          // Cache the metadata
          this.contentMetadataCache.set(upload.cid, metadata);
          items.push(metadata);
        }
      }
      
      return {
        items,
        totalItems: items.length
      };
    } catch (error) {
      console.error('Error listing Web3.Storage content:', error);
      throw new Error(`Failed to list Web3.Storage content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets metadata for content stored on Web3.Storage
   * @param contentId The CID of the content
   * @returns Promise resolving to content metadata
   */
  public async getContentMetadata(contentId: string): Promise<ContentMetadata> {
    try {
      // Check if metadata is in the cache
      if (this.contentMetadataCache.has(contentId)) {
        return this.contentMetadataCache.get(contentId)!;
      }
      
      // Try to get info about this content from Web3.Storage
      const info = await this.client.status(contentId);
      
      if (!info) {
        throw new Error(`Content with CID ${contentId} not found`);
      }
      
      // Try to fetch the metadata.json file
      try {
        const res = await fetch(`https://${contentId}.ipfs.dweb.link/metadata.json`);
        
        if (res.ok) {
          const metadataObj = await res.json();
          
          // Create content metadata
          const metadata: ContentMetadata = {
            contentId,
            mimeType: metadataObj.mimeType || 'application/octet-stream',
            size: metadataObj.size || 0,
            filename: metadataObj.name,
            created: new Date(metadataObj.created || info.created),
            updated: new Date(metadataObj.updated || info.created),
            encrypted: metadataObj.encrypted || false,
            hash: contentId,
            customMetadata: metadataObj.customMetadata || {}
          };
          
          // Cache the metadata
          this.contentMetadataCache.set(contentId, metadata);
          
          return metadata;
        } 
      } catch (error) {
        console.warn(`Could not fetch metadata for ${contentId}:`, error);
        // Fall back to basic metadata
      }
      
      // Create basic metadata from status info
      const metadata: ContentMetadata = {
        contentId,
        mimeType: 'application/octet-stream', // Default mime type
        size: 0, // Size unknown
        filename: undefined, // Status object doesn't have a name property
        created: new Date(info.created),
        updated: new Date(info.created),
        encrypted: false,
        hash: contentId,
        customMetadata: {}
      };
      
      // Cache the metadata
      this.contentMetadataCache.set(contentId, metadata);
      
      return metadata;
    } catch (error) {
      console.error('Error getting Web3.Storage content metadata:', error);
      throw new Error(`Failed to get content metadata from Web3.Storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
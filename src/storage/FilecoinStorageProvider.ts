import { 
  StorageProvider, 
  ContentToUpload, 
  StorageResult, 
  RetrievedContent, 
  ContentMetadata, 
  StorageListing 
} from '../core/types';
import axios from 'axios';

/**
 * Filecoin Storage Provider implementation
 * Handles uploading and retrieving content using Filecoin network
 * 
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */
export class FilecoinStorageProvider implements StorageProvider {
  private apiEndpoint: string;
  private apiKey: string;
  private contentMetadataCache: Map<string, ContentMetadata> = new Map();
  
  /**
   * Creates a new Filecoin Storage Provider
   * @param apiKey API token for Filecoin service
   * @param apiEndpoint Optional custom API endpoint
   */
  constructor(apiKey?: string, apiEndpoint: string = 'https://api.filecoin.io') {
    if (!apiKey) {
      throw new Error('API key is required for Filecoin provider');
    }
    
    this.apiKey = apiKey;
    this.apiEndpoint = apiEndpoint;
  }
  
  /**
   * Uploads content to Filecoin network
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
      
      // Prepare form data for upload
      const formData = new FormData();
      const blob = new Blob([contentData], { type: content.mimeType });
      formData.append('file', blob, content.filename);
      formData.append('metadata', JSON.stringify(metadata));
      
      // Upload to Filecoin
      const response = await axios.post(`${this.apiEndpoint}/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (!response.data || !response.data.cid) {
        throw new Error('Failed to get a valid CID from Filecoin upload');
      }
      
      // The contentId is the CID from Filecoin
      const contentId = response.data.cid;
      
      // Generate public URLs
      const publicUrl = `${this.apiEndpoint}/ipfs/${contentId}`;
      const metadataUrl = `${this.apiEndpoint}/ipfs/${contentId}/metadata.json`;
      
      // Create content metadata
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
          metadataUrl,
          filecoinDeal: response.data.dealId
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
          dealId: response.data.dealId,
          miners: response.data.miners
        }
      };
    } catch (error) {
      console.error('Error uploading to Filecoin:', error);
      throw new Error(`Failed to upload content to Filecoin: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Retrieves content from Filecoin
   * @param contentId The CID of the content to retrieve
   * @returns Promise resolving to the retrieved content
   */
  public async retrieveContent(contentId: string): Promise<RetrievedContent> {
    try {
      // Get metadata (either from cache or fetch it)
      const metadata = await this.getContentMetadata(contentId);
      
      // Get the content from Filecoin gateway
      const res = await axios.get(`${this.apiEndpoint}/ipfs/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        responseType: 'arraybuffer'
      });
      
      if (!res.data) {
        throw new Error(`Failed to fetch content: HTTP ${res.status}`);
      }
      
      // Return the content with its metadata
      return {
        data: Buffer.from(res.data),
        metadata
      };
    } catch (error) {
      console.error('Error retrieving from Filecoin:', error);
      throw new Error(`Failed to retrieve content from Filecoin: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Deletes content from Filecoin (not fully possible due to blockchain persistence)
   * @param contentId The CID of the content to delete
   * @returns Promise resolving to a boolean indicating "success"
   */
  public async deleteContent(contentId: string): Promise<boolean> {
    try {
      // Remove from local metadata cache
      this.contentMetadataCache.delete(contentId);
      
      // Attempt to remove pinning (note: data may still exist on Filecoin)
      try {
        await axios.delete(`${this.apiEndpoint}/pins/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });
      } catch (pinError) {
        console.warn('Could not unpin from Filecoin, content may still exist:', pinError);
      }
      
      console.warn('Content cannot be fully deleted from Filecoin once stored. Only unpinning has been attempted.');
      
      return true;
    } catch (error) {
      console.error('Error managing Filecoin deletion:', error);
      throw new Error(`Failed to update deletion records: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Lists content from Filecoin
   * @returns Promise resolving to a listing of content
   */
  public async listContent(): Promise<StorageListing> {
    try {
      // Get all uploads from Filecoin API
      const res = await axios.get(`${this.apiEndpoint}/user/uploads`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      if (!res.data || !Array.isArray(res.data.uploads)) {
        throw new Error('Invalid response from Filecoin API');
      }
      
      // Convert uploads to ContentMetadata
      const items: ContentMetadata[] = [];
      
      for (const upload of res.data.uploads) {
        // Check if we already have this in cache
        if (this.contentMetadataCache.has(upload.cid)) {
          items.push(this.contentMetadataCache.get(upload.cid)!);
          continue;
        }
        
        // Create metadata from upload info
        const metadata: ContentMetadata = {
          contentId: upload.cid,
          mimeType: upload.mimeType || 'application/octet-stream',
          size: upload.size || 0,
          filename: upload.name,
          created: new Date(upload.created),
          updated: new Date(upload.lastAccessed || upload.created),
          encrypted: false,
          hash: upload.cid,
          customMetadata: {
            dealId: upload.dealId,
            miners: upload.miners
          }
        };
        
        // Cache the metadata
        this.contentMetadataCache.set(upload.cid, metadata);
        items.push(metadata);
      }
      
      return {
        items,
        totalItems: items.length
      };
    } catch (error) {
      console.error('Error listing Filecoin content:', error);
      throw new Error(`Failed to list Filecoin content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets metadata for content stored on Filecoin
   * @param contentId The CID of the content
   * @returns Promise resolving to content metadata
   */
  public async getContentMetadata(contentId: string): Promise<ContentMetadata> {
    try {
      // Check if metadata is in the cache
      if (this.contentMetadataCache.has(contentId)) {
        return this.contentMetadataCache.get(contentId)!;
      }
      
      // Try to get metadata from Filecoin API
      try {
        const res = await axios.get(`${this.apiEndpoint}/content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });
        
        if (res.data) {
          const upload = res.data;
          
          // Create metadata from API response
          const metadata: ContentMetadata = {
            contentId,
            mimeType: upload.mimeType || 'application/octet-stream',
            size: upload.size || 0,
            filename: upload.name,
            created: new Date(upload.created),
            updated: new Date(upload.lastAccessed || upload.created),
            encrypted: false,
            hash: contentId,
            customMetadata: {
              dealId: upload.dealId,
              miners: upload.miners,
              status: upload.status
            }
          };
          
          // Cache the metadata
          this.contentMetadataCache.set(contentId, metadata);
          
          return metadata;
        }
      } catch (apiError) {
        console.warn(`Error fetching Filecoin API metadata for ${contentId}:`, apiError);
        // Fall back to IPFS metadata
      }
      
      // Try to fetch the metadata.json file
      try {
        const res = await axios.get(`${this.apiEndpoint}/ipfs/${contentId}/metadata.json`);
        
        if (res.data) {
          const metadataObj = res.data;
          
          // Create content metadata
          const metadata: ContentMetadata = {
            contentId,
            mimeType: metadataObj.mimeType || 'application/octet-stream',
            size: metadataObj.size || 0,
            filename: metadataObj.name,
            created: new Date(metadataObj.created),
            updated: new Date(metadataObj.updated || metadataObj.created),
            encrypted: metadataObj.encrypted || false,
            hash: contentId,
            customMetadata: metadataObj.customMetadata || {}
          };
          
          // Cache the metadata
          this.contentMetadataCache.set(contentId, metadata);
          
          return metadata;
        }
      } catch (metadataError) {
        console.warn(`Could not fetch metadata file for ${contentId}:`, metadataError);
      }
      
      // Fall back to basic metadata
      const metadata: ContentMetadata = {
        contentId,
        mimeType: 'application/octet-stream', // Default mime type
        size: 0, // Size unknown
        filename: undefined,
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
      console.error('Error getting Filecoin content metadata:', error);
      throw new Error(`Failed to get content metadata from Filecoin: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
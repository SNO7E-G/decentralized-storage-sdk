import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { 
  StorageProvider, 
  ContentToUpload, 
  StorageResult, 
  RetrievedContent, 
  ContentMetadata, 
  StorageListing 
} from '../core/types';

/**
 * Arweave Storage Provider implementation
 * Handles uploading and retrieving content using Arweave's permanent storage
 */
export class ArweaveStorageProvider implements StorageProvider {
  private client: Arweave;
  private wallet: JWKInterface | null = null;
  private contentMetadataCache: Map<string, ContentMetadata> = new Map();
  
  /**
   * Creates a new Arweave Storage Provider
   * @param apiKey JWK wallet key as JSON string or direct JWKInterface
   * @param gateway Optional Arweave gateway URL
   */
  constructor(apiKey?: string, gateway: string = 'https://arweave.net') {
    // Create Arweave client
    this.client = Arweave.init({
      host: new URL(gateway).hostname,
      port: new URL(gateway).port ? parseInt(new URL(gateway).port) : 443,
      protocol: new URL(gateway).protocol.replace(':', ''),
    });
    
    // Set wallet if API key provided
    if (apiKey) {
      try {
        this.wallet = typeof apiKey === 'string' ? JSON.parse(apiKey) : apiKey;
      } catch (error) {
        throw new Error(`Invalid Arweave wallet key: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * Uploads content to Arweave
   * @param content The content to upload
   * @returns Promise resolving to storage result
   */
  public async uploadContent(content: ContentToUpload): Promise<StorageResult> {
    try {
      if (!this.wallet) {
        throw new Error('Arweave wallet is required for upload operations');
      }
      
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
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
      
      // Create a transaction for the content data
      const transaction = await this.client.createTransaction({
        data: contentData
      }, this.wallet);
      
      // Add tags for content type and metadata
      transaction.addTag('Content-Type', content.mimeType);
      transaction.addTag('App-Name', 'DecentralizedStorageSDK');
      
      if (content.filename) {
        transaction.addTag('Filename', content.filename);
      }
      
      // Add metadata as a tag (JSON stringified)
      transaction.addTag('Metadata', JSON.stringify(metadata));
      
      // Sign transaction
      await this.client.transactions.sign(transaction, this.wallet);
      
      // Submit transaction
      const response = await this.client.transactions.post(transaction);
      
      if (response.status !== 200) {
        throw new Error(`Failed to upload to Arweave: ${response.statusText}`);
      }
      
      // Transaction ID becomes the content ID
      const contentId = transaction.id;
      
      // Generate public URL
      const publicUrl = `${this.client.api.config.protocol}://${this.client.api.config.host}/${contentId}`;
      
      // Create ContentMetadata object
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
          arweaveTx: contentId
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
          transactionId: contentId,
          gateway: `${this.client.api.config.host}`
        }
      };
    } catch (error) {
      console.error('Error uploading to Arweave:', error);
      throw new Error(`Failed to upload content to Arweave: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Retrieves content from Arweave
   * @param contentId The transaction ID of the content to retrieve
   * @returns Promise resolving to the retrieved content
   */
  public async retrieveContent(contentId: string): Promise<RetrievedContent> {
    try {
      // Get metadata (either from cache or fetch it)
      const metadata = await this.getContentMetadata(contentId);
      
      // Get the content from Arweave
      const response = await this.client.transactions.getData(contentId, {
        decode: true,
        string: false
      });
      
      // The response is a Uint8Array or string
      const data = Buffer.from(response as Uint8Array);
      
      // Return the content with its metadata
      return {
        data,
        metadata
      };
    } catch (error) {
      console.error('Error retrieving from Arweave:', error);
      throw new Error(`Failed to retrieve content from Arweave: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Deletes content from Arweave (not possible - data on Arweave is permanent)
   * @param contentId The transaction ID of the content
   * @returns Promise resolving to a boolean indicating "success"
   */
  public async deleteContent(contentId: string): Promise<boolean> {
    try {
      // Remove from local metadata cache
      this.contentMetadataCache.delete(contentId);
      
      // Arweave is permanent storage and cannot delete content
      console.warn('Content on Arweave cannot be deleted as it is permanent storage. Only removing from local records.');
      
      return true;
    } catch (error) {
      console.error('Error managing Arweave deletion records:', error);
      throw new Error(`Failed to update deletion records: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Lists content from Arweave for the current wallet
   * @returns Promise resolving to a listing of content
   */
  public async listContent(): Promise<StorageListing> {
    try {
      if (!this.wallet) {
        throw new Error('Arweave wallet is required to list content');
      }
      
      // Get wallet address
      const address = await this.client.wallets.getAddress(this.wallet);
      
      // Search for transactions from this wallet with our app tag
      const txids = await this.client.arql({
        op: 'and',
        expr1: {
          op: 'equals',
          expr1: 'from',
          expr2: address
        },
        expr2: {
          op: 'equals',
          expr1: 'App-Name',
          expr2: 'DecentralizedStorageSDK'
        }
      });
      
      // Process each transaction to get metadata
      const items: ContentMetadata[] = [];
      
      for (const txid of txids) {
        // Check if we already have this in cache
        if (this.contentMetadataCache.has(txid)) {
          items.push(this.contentMetadataCache.get(txid)!);
          continue;
        }
        
        try {
          // Get transaction details
          const tx = await this.client.transactions.get(txid);
          
          // Extract metadata from tags
          let metadataObj: any = {};
          let mimeType = 'application/octet-stream';
          let filename: string | undefined;
          
          // Process transaction tags
          if (tx.tags) {
            for (const tag of tx.tags) {
              const key = tag.get('name', { decode: true, string: true });
              const value = tag.get('value', { decode: true, string: true });
              
              if (key === 'Content-Type') {
                mimeType = value;
              } else if (key === 'Filename') {
                filename = value;
              } else if (key === 'Metadata') {
                try {
                  metadataObj = JSON.parse(value);
                } catch (error) {
                  console.warn(`Could not parse metadata for ${txid}:`, error);
                }
              }
            }
          }
          
          // Create metadata object
          const metadata: ContentMetadata = {
            contentId: txid,
            mimeType,
            size: parseInt(tx.data_size),
            filename,
            created: new Date((tx.block && tx.block.timestamp) ? tx.block.timestamp * 1000 : Date.now()),
            updated: new Date((tx.block && tx.block.timestamp) ? tx.block.timestamp * 1000 : Date.now()),
            encrypted: metadataObj.encrypted || false,
            hash: txid,
            customMetadata: metadataObj.customMetadata || {}
          };
          
          // Cache the metadata
          this.contentMetadataCache.set(txid, metadata);
          items.push(metadata);
        } catch (error) {
          console.warn(`Error processing transaction ${txid}:`, error);
        }
      }
      
      return {
        items,
        totalItems: items.length
      };
    } catch (error) {
      console.error('Error listing Arweave content:', error);
      throw new Error(`Failed to list Arweave content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets metadata for content stored on Arweave
   * @param contentId The transaction ID of the content
   * @returns Promise resolving to content metadata
   */
  public async getContentMetadata(contentId: string): Promise<ContentMetadata> {
    try {
      // Check if metadata is in the cache
      if (this.contentMetadataCache.has(contentId)) {
        return this.contentMetadataCache.get(contentId)!;
      }
      
      // Get transaction details
      const tx = await this.client.transactions.get(contentId);
      
      // Extract metadata from tags
      let metadataObj: any = {};
      let mimeType = 'application/octet-stream';
      let filename: string | undefined;
      
      // Process transaction tags
      if (tx.tags) {
        for (const tag of tx.tags) {
          const key = tag.get('name', { decode: true, string: true });
          const value = tag.get('value', { decode: true, string: true });
          
          if (key === 'Content-Type') {
            mimeType = value;
          } else if (key === 'Filename') {
            filename = value;
          } else if (key === 'Metadata') {
            try {
              metadataObj = JSON.parse(value);
            } catch (error) {
              console.warn(`Could not parse metadata for ${contentId}:`, error);
            }
          }
        }
      }
      
      // Create metadata object
      const metadata: ContentMetadata = {
        contentId,
        mimeType,
        size: parseInt(tx.data_size),
        filename,
        created: new Date((tx.block && tx.block.timestamp) ? tx.block.timestamp * 1000 : Date.now()),
        updated: new Date((tx.block && tx.block.timestamp) ? tx.block.timestamp * 1000 : Date.now()),
        encrypted: metadataObj.encrypted || false,
        hash: contentId,
        customMetadata: metadataObj.customMetadata || {}
      };
      
      // Cache the metadata
      this.contentMetadataCache.set(contentId, metadata);
      
      return metadata;
    } catch (error) {
      console.error('Error getting Arweave content metadata:', error);
      throw new Error(`Failed to get content metadata from Arweave: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
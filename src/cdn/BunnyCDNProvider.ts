import axios from 'axios';
import * as crypto from 'crypto';
import { CDNProvider } from '../core/types';
import { SDKError, SDKErrorCode, createNetworkError, retryWithBackoff } from '../utils/ErrorHandler';

/**
 * Bunny CDN Provider Configuration
 */
export interface BunnyCDNConfig {
  /** API access key */
  apiKey: string;
  /** Storage zone name */
  storageZoneName: string;
  /** Pull zone ID */
  pullZoneId: number;
  /** Custom hostname if configured */
  hostname?: string;
  /** Region (optional) */
  region?: 'de' | 'uk' | 'ny' | 'la' | 'sg' | 'syd' | 'br';
  /** Base URL for Bunny CDN API */
  apiUrl?: string;
  /** Base URL for Bunny CDN Storage */
  storageUrl?: string;
  /** Security settings */
  security?: {
    /** Enable token authentication */
    enableTokenAuth: boolean;
    /** Token authentication key */
    tokenAuthKey?: string;
    /** Token expiry time in seconds */
    tokenExpiry?: number;
  }
}

/**
 * Bunny CDN Provider
 * Implements CDN functionality using Bunny CDN
 */
export class BunnyCDNProvider implements CDNProvider {
  private config: BunnyCDNConfig;
  private apiBaseUrl: string;
  private storageBaseUrl: string;
  private cdnBaseUrl: string;

  /**
   * Creates a new Bunny CDN Provider
   * @param config Provider configuration
   */
  constructor(config: BunnyCDNConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl || 'https://api.bunny.net',
      storageUrl: config.storageUrl || 'https://storage.bunnycdn.com',
      region: config.region || 'de'
    };

    // Set up URLs
    this.apiBaseUrl = this.config.apiUrl!;
    this.storageBaseUrl = `${this.config.storageUrl!}/${this.config.storageZoneName}`;

    // Set up CDN URL 
    if (this.config.hostname) {
      this.cdnBaseUrl = `https://${this.config.hostname}`;
    } else {
      this.cdnBaseUrl = `https://${this.config.pullZoneId}.b-cdn.net`;
    }
  }

  /**
   * Add content to CDN
   * @param contentId Content ID
   * @param sourceUrl Source URL of content
   * @param metadata Additional metadata
   * @returns CDN URL for the content
   */
  public async addToCDN(contentId: string, sourceUrl: string, metadata?: any): Promise<string> {
    try {
      // For Bunny CDN, we'll upload the file to storage first, then it will be served through the CDN
      const response = await this.fetchAndUploadToBunnyStorage(sourceUrl, contentId);
      
      // Create the CDN URL
      let cdnUrl = `${this.cdnBaseUrl}/${contentId}`;
      
      // Add token authentication if enabled
      if (this.config.security?.enableTokenAuth && this.config.security.tokenAuthKey) {
        cdnUrl = this.generateSecureUrl(contentId);
      }
      
      return cdnUrl;
    } catch (error) {
      console.error('Error adding content to Bunny CDN:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else {
        throw new SDKError(
          `Failed to add content to Bunny CDN: ${error instanceof Error ? error.message : String(error)}`,
          SDKErrorCode.CDN_ERROR,
          {
            component: 'BunnyCDNProvider',
            operation: 'addToCDN',
            originalError: error
          }
        );
      }
    }
  }

  /**
   * Remove content from CDN
   * @param contentId Content ID
   * @returns True if successfully removed
   */
  public async removeFromCDN(contentId: string): Promise<boolean> {
    try {
      // For Bunny CDN, we need to delete the file from storage
      await this.deleteFromBunnyStorage(contentId);
      
      // Purge the CDN cache to ensure the content is no longer served
      await this.purgeCache(contentId);
      
      return true;
    } catch (error) {
      console.error('Error removing content from Bunny CDN:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else {
        throw new SDKError(
          `Failed to remove content from Bunny CDN: ${error instanceof Error ? error.message : String(error)}`,
          SDKErrorCode.CDN_ERROR,
          {
            component: 'BunnyCDNProvider',
            operation: 'removeFromCDN',
            originalError: error
          }
        );
      }
    }
  }

  /**
   * Purge content from CDN cache
   * @param contentId Content ID
   * @returns True if successfully purged
   */
  public async purgeCache(contentId: string): Promise<boolean> {
    try {
      // Create the path for the content ID
      const contentPath = `/${contentId}`;
      
      // Call Bunny CDN API to purge the cache
      await retryWithBackoff(async () => {
        const response = await axios({
          method: 'POST',
          url: `${this.apiBaseUrl}/purge?url=${encodeURIComponent(this.cdnBaseUrl + contentPath)}`,
          headers: {
            'AccessKey': this.config.apiKey
          }
        });
        
        return response;
      }, { maxRetries: 3 });
      
      return true;
    } catch (error) {
      console.error('Error purging Bunny CDN cache:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else {
        throw new SDKError(
          `Failed to purge Bunny CDN cache: ${error instanceof Error ? error.message : String(error)}`,
          SDKErrorCode.CDN_ERROR,
          {
            component: 'BunnyCDNProvider',
            operation: 'purgeCache',
            originalError: error
          }
        );
      }
    }
  }

  /**
   * Get CDN status and configuration
   * @returns CDN status information
   */
  public async getStatus(): Promise<any> {
    try {
      // Get pull zone details
      const pullZoneResponse = await retryWithBackoff(async () => {
        return await axios({
          method: 'GET',
          url: `${this.apiBaseUrl}/pullzone/${this.config.pullZoneId}`,
          headers: {
            'AccessKey': this.config.apiKey
          }
        });
      }, { maxRetries: 3 });
      
      // Get storage zone details
      const storageZoneResponse = await retryWithBackoff(async () => {
        return await axios({
          method: 'GET',
          url: `${this.apiBaseUrl}/storagezone`,
          headers: {
            'AccessKey': this.config.apiKey
          }
        });
      }, { maxRetries: 3 });
      
      // Find our storage zone
      const storageZone = storageZoneResponse.data.find(
        (zone: any) => zone.Name === this.config.storageZoneName
      );
      
      // Return combined status
      return {
        pullZone: pullZoneResponse.data,
        storageZone: storageZone || null,
        baseUrl: this.cdnBaseUrl,
        securityEnabled: this.config.security?.enableTokenAuth || false
      };
    } catch (error) {
      console.error('Error getting Bunny CDN status:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else {
        throw new SDKError(
          `Failed to get Bunny CDN status: ${error instanceof Error ? error.message : String(error)}`,
          SDKErrorCode.CDN_ERROR,
          {
            component: 'BunnyCDNProvider',
            operation: 'getStatus',
            originalError: error
          }
        );
      }
    }
  }

  /**
   * Fetch content from source URL and upload to Bunny Storage
   * @param sourceUrl Source URL of content
   * @param path Path to store at in Bunny Storage
   * @returns Response from Bunny Storage
   */
  private async fetchAndUploadToBunnyStorage(sourceUrl: string, path: string): Promise<any> {
    try {
      // Fetch the content from source URL
      const contentResponse = await retryWithBackoff(async () => {
        return await axios({
          method: 'GET',
          url: sourceUrl,
          responseType: 'arraybuffer'
        });
      }, { maxRetries: 3 });
      
      // Upload to Bunny Storage
      const uploadResponse = await retryWithBackoff(async () => {
        return await axios({
          method: 'PUT',
          url: `${this.storageBaseUrl}/${path}`,
          headers: {
            'AccessKey': this.config.apiKey,
            'Content-Type': contentResponse.headers['content-type'] || 'application/octet-stream'
          },
          data: contentResponse.data
        });
      }, { maxRetries: 3 });
      
      return uploadResponse;
    } catch (error) {
      console.error('Error fetching content and uploading to Bunny Storage:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else if (axios.isAxiosError(error)) {
        throw createNetworkError(
          `Failed to fetch content and upload to Bunny Storage: ${error.message}`,
          'fetchAndUploadToBunnyStorage',
          error,
          {
            sourceUrl,
            path,
            status: error.response?.status,
            statusText: error.response?.statusText
          }
        );
      } else {
        throw new SDKError(
          `Failed to fetch content and upload to Bunny Storage: ${error instanceof Error ? error.message : String(error)}`,
          SDKErrorCode.CDN_ERROR,
          {
            component: 'BunnyCDNProvider',
            operation: 'fetchAndUploadToBunnyStorage',
            originalError: error
          }
        );
      }
    }
  }

  /**
   * Delete content from Bunny Storage
   * @param path Path to delete
   * @returns Response from Bunny Storage
   */
  private async deleteFromBunnyStorage(path: string): Promise<any> {
    try {
      // Delete from Bunny Storage
      const response = await retryWithBackoff(async () => {
        return await axios({
          method: 'DELETE',
          url: `${this.storageBaseUrl}/${path}`,
          headers: {
            'AccessKey': this.config.apiKey
          }
        });
      }, { maxRetries: 3 });
      
      return response;
    } catch (error) {
      console.error('Error deleting from Bunny Storage:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        // File not found is OK for deletion
        return { status: 'success', alreadyDeleted: true };
      } else if (axios.isAxiosError(error)) {
        throw createNetworkError(
          `Failed to delete from Bunny Storage: ${error.message}`,
          'deleteFromBunnyStorage',
          error,
          {
            path,
            status: error.response?.status,
            statusText: error.response?.statusText
          }
        );
      } else {
        throw new SDKError(
          `Failed to delete from Bunny Storage: ${error instanceof Error ? error.message : String(error)}`,
          SDKErrorCode.CDN_ERROR,
          {
            component: 'BunnyCDNProvider',
            operation: 'deleteFromBunnyStorage',
            originalError: error
          }
        );
      }
    }
  }

  /**
   * Generate a secure URL with token authentication
   * @param path Content path
   * @param expiry Expiry time in seconds (from now)
   * @returns Secure URL with token
   */
  private generateSecureUrl(path: string, expiry?: number): string {
    if (!this.config.security?.enableTokenAuth || !this.config.security.tokenAuthKey) {
      return `${this.cdnBaseUrl}/${path}`;
    }
    
    const expiryTime = Math.floor(Date.now() / 1000) + (expiry || this.config.security.tokenExpiry || 3600);
    const pathWithExpiry = `/${path}?token_expires=${expiryTime}`;
    
    // Generate security token
    const hashableBase = this.config.security.tokenAuthKey + pathWithExpiry;
    const token = crypto
      .createHash('md5')
      .update(hashableBase)
      .digest('hex');
    
    // Create URL with token
    return `${this.cdnBaseUrl}${pathWithExpiry}&token=${token}`;
  }

  /**
   * Retrieve content from Bunny CDN
   * Utility function for the SDK to use
   * @param contentId Content ID
   * @returns Content buffer and metadata
   */
  public async retrieveFromCDN(contentId: string): Promise<{ data: Buffer, headers: Record<string, string> }> {
    try {
      // Generate URL (secure if enabled)
      let url: string;
      
      if (this.config.security?.enableTokenAuth && this.config.security.tokenAuthKey) {
        url = this.generateSecureUrl(contentId);
      } else {
        url = `${this.cdnBaseUrl}/${contentId}`;
      }
      
      // Fetch content
      const response = await retryWithBackoff(async () => {
        return await axios({
          method: 'GET',
          url,
          responseType: 'arraybuffer'
        });
      }, { maxRetries: 3 });
      
      // Return content and headers
      return {
        data: Buffer.from(response.data),
        headers: response.headers as Record<string, string>
      };
    } catch (error) {
      console.error('Error retrieving from Bunny CDN:', error);
      
      if (error instanceof SDKError) {
        throw error;
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new SDKError(
          `Content not found on Bunny CDN: ${contentId}`,
          SDKErrorCode.CONTENT_NOT_FOUND,
          {
            component: 'BunnyCDNProvider',
            operation: 'retrieveFromCDN',
            originalError: error
          }
        );
      } else if (axios.isAxiosError(error)) {
        throw createNetworkError(
          `Failed to retrieve content from Bunny CDN: ${error.message}`,
          'retrieveFromCDN',
          error,
          {
            contentId,
            status: error.response?.status,
            statusText: error.response?.statusText
          }
        );
      } else {
        throw new SDKError(
          `Failed to retrieve content from Bunny CDN: ${error instanceof Error ? error.message : String(error)}`,
          SDKErrorCode.CDN_ERROR,
          {
            component: 'BunnyCDNProvider',
            operation: 'retrieveFromCDN',
            originalError: error
          }
        );
      }
    }
  }
} 
import axios from 'axios';
import { CDNProvider } from '../core/types';

/**
 * Cloudflare CDN Provider implementation
 * Handles serving content via Cloudflare's CDN network
 * 
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */
export class CloudflareCDNProvider implements CDNProvider {
  private apiToken: string;
  private zoneId: string;
  private apiEndpoint: string = 'https://api.cloudflare.com/client/v4';
  private customDomain?: string;
  private cacheTtl: number = 86400; // Default to 1 day
  private shouldPurgeCache: boolean = true;
  
  /**
   * Creates a new Cloudflare CDN Provider instance
   * @param apiToken The Cloudflare API token
   * @param zoneId The Cloudflare zone ID
   * @param options Additional configuration options
   */
  constructor(
    apiToken: string, 
    zoneId: string, 
    options?: {
      customDomain?: string;
      cacheTtl?: number;
      purgeCache?: boolean;
    }
  ) {
    this.apiToken = apiToken;
    this.zoneId = zoneId;
    
    if (options) {
      this.customDomain = options.customDomain;
      this.cacheTtl = options.cacheTtl || this.cacheTtl;
      this.shouldPurgeCache = options.purgeCache !== undefined ? options.purgeCache : this.shouldPurgeCache;
    }
  }
  
  /**
   * Adds content to the Cloudflare CDN
   * @param contentId The content identifier
   * @param sourceUrl The source URL where content is stored
   * @param metadata Optional metadata for the content
   * @returns Promise resolving to the CDN URL of the content
   */
  public async addToCDN(contentId: string, sourceUrl: string, metadata?: any): Promise<string> {
    try {
      // Check if custom domain is set
      const domain = this.customDomain || `cdn.cloudflare.net/${this.zoneId}`;
      
      // For advanced usage, you can set up a worker to proxy content
      const workerName = `cdn-worker-${contentId.substring(0, 8)}`;
      const workerScript = this.generateWorkerScript(contentId, sourceUrl);
      
      // Create a worker route for this content
      await this.createWorker(workerName, workerScript);
      await this.createWorkerRoute(workerName, contentId);
      
      // Cache settings for the content
      if (metadata?.caching) {
        this.cacheTtl = metadata.caching.ttl || this.cacheTtl;
      }
      
      // Set cache rules for the content
      await this.setCacheRules(contentId);
      
      // Construct the CDN URL
      const cdnUrl = `https://${domain}/${contentId}`;
      
      return cdnUrl;
    } catch (error) {
      console.error('Error adding content to Cloudflare CDN:', error);
      throw new Error(`Failed to add content to Cloudflare CDN: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Removes content from the Cloudflare CDN
   * @param contentId The content identifier
   * @returns Promise resolving to a boolean indicating success
   */
  public async removeFromCDN(contentId: string): Promise<boolean> {
    try {
      // Delete the worker route
      const workerName = `cdn-worker-${contentId.substring(0, 8)}`;
      await this.deleteWorkerRoute(contentId);
      
      // Delete the worker
      await this.deleteWorker(workerName);
      
      // Purge cache for this content
      if (this.shouldPurgeCache) {
        await this.purgeCache(contentId);
      }
      
      return true;
    } catch (error) {
      console.error('Error removing content from Cloudflare CDN:', error);
      throw new Error(`Failed to remove content from Cloudflare CDN: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Purges content from the Cloudflare cache
   * @param contentId The content identifier
   * @returns Promise resolving to a boolean indicating success
   */
  public async purgeCache(contentId: string): Promise<boolean> {
    try {
      // Construct the URL pattern to purge
      const domain = this.customDomain || `cdn.cloudflare.net/${this.zoneId}`;
      const urlToPurge = `https://${domain}/${contentId}*`;
      
      // Make the purge request
      const response = await axios.post(
        `${this.apiEndpoint}/zones/${this.zoneId}/purge_cache`,
        {
          files: [urlToPurge]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data?.success === true;
    } catch (error) {
      console.error('Error purging Cloudflare cache:', error);
      throw new Error(`Failed to purge Cloudflare cache: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the status of the Cloudflare CDN
   * @returns Promise resolving to the CDN status
   */
  public async getStatus(): Promise<any> {
    try {
      // Check the zone status
      const response = await axios.get(
        `${this.apiEndpoint}/zones/${this.zoneId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data || !response.data.success) {
        throw new Error('Failed to get Cloudflare zone status');
      }
      
      return {
        active: response.data.result.status === 'active',
        plan: response.data.result.plan?.name,
        nameServers: response.data.result.name_servers,
        status: response.data.result.status
      };
    } catch (error) {
      console.error('Error getting Cloudflare CDN status:', error);
      throw new Error(`Failed to get Cloudflare CDN status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Creates a Cloudflare Worker for content delivery
   * @param name The worker name
   * @param script The worker script
   * @returns Promise resolving to void
   */
  private async createWorker(name: string, script: string): Promise<void> {
    try {
      await axios.put(
        `${this.apiEndpoint}/accounts/${this.zoneId}/workers/scripts/${name}`,
        script,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/javascript'
          }
        }
      );
    } catch (error) {
      console.error('Error creating Cloudflare Worker:', error);
      throw error;
    }
  }
  
  /**
   * Creates a Cloudflare Worker route for content
   * @param workerName The worker name
   * @param contentId The content identifier
   * @returns Promise resolving to void
   */
  private async createWorkerRoute(workerName: string, contentId: string): Promise<void> {
    try {
      const domain = this.customDomain || `cdn.cloudflare.net/${this.zoneId}`;
      const pattern = `*${domain}/${contentId}*`;
      
      await axios.post(
        `${this.apiEndpoint}/zones/${this.zoneId}/workers/routes`,
        {
          pattern,
          script: workerName
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Error creating Cloudflare Worker route:', error);
      throw error;
    }
  }
  
  /**
   * Deletes a Cloudflare Worker route
   * @param contentId The content identifier
   * @returns Promise resolving to void
   */
  private async deleteWorkerRoute(contentId: string): Promise<void> {
    try {
      const domain = this.customDomain || `cdn.cloudflare.net/${this.zoneId}`;
      const pattern = `*${domain}/${contentId}*`;
      
      // Get all routes
      const response = await axios.get(
        `${this.apiEndpoint}/zones/${this.zoneId}/workers/routes`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Find the route ID
      const route = response.data.result.find((r: any) => r.pattern === pattern);
      
      if (route) {
        // Delete the route
        await axios.delete(
          `${this.apiEndpoint}/zones/${this.zoneId}/workers/routes/${route.id}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }
    } catch (error) {
      console.error('Error deleting Cloudflare Worker route:', error);
      throw error;
    }
  }
  
  /**
   * Deletes a Cloudflare Worker
   * @param workerName The worker name
   * @returns Promise resolving to void
   */
  private async deleteWorker(workerName: string): Promise<void> {
    try {
      await axios.delete(
        `${this.apiEndpoint}/accounts/${this.zoneId}/workers/scripts/${workerName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Error deleting Cloudflare Worker:', error);
      throw error;
    }
  }
  
  /**
   * Sets cache rules for content
   * @param contentId The content identifier
   * @returns Promise resolving to void
   */
  private async setCacheRules(contentId: string): Promise<void> {
    try {
      const domain = this.customDomain || `cdn.cloudflare.net/${this.zoneId}`;
      const urlPattern = `*${domain}/${contentId}*`;
      
      // Create a cache rule for this content
      await axios.post(
        `${this.apiEndpoint}/zones/${this.zoneId}/pagerules`,
        {
          targets: [
            {
              target: 'url',
              constraint: {
                operator: 'matches',
                value: urlPattern
              }
            }
          ],
          actions: [
            {
              id: 'cache_level',
              value: 'cache_everything'
            },
            {
              id: 'edge_cache_ttl',
              value: {
                ttl: this.cacheTtl
              }
            }
          ],
          status: 'active'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Error setting Cloudflare cache rules:', error);
      throw error;
    }
  }
  
  /**
   * Generates a Cloudflare Worker script for content delivery
   * @param contentId The content identifier
   * @param sourceUrl The source URL
   * @returns The worker script
   */
  private generateWorkerScript(contentId: string, sourceUrl: string): string {
    return `
    // CDN Worker for ${contentId}
    // Created by Decentralized Storage SDK
    // @author Mahmoud Ashraf (SNO7E)
    // @github https://github.com/SNO7E-G
    
    addEventListener('fetch', event => {
      event.respondWith(handleRequest(event.request))
    })
    
    /**
     * Handle incoming requests to the CDN
     * @param {Request} request - The incoming request
     */
    async function handleRequest(request) {
      // Set the source URL where the content is stored
      const sourceUrl = "${sourceUrl}"
      
      // Clone the request headers
      const headers = new Headers(request.headers)
      
      // Add caching headers
      headers.set('Cache-Control', 'public, max-age=${this.cacheTtl}')
      
      // Fetch the content from the source
      const response = await fetch(sourceUrl, {
        headers,
        cf: {
          // Enable Cloudflare cache
          cacheTtl: ${this.cacheTtl},
          cacheEverything: true,
        }
      })
      
      // Clone the response
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
      
      // Add additional response headers for the CDN
      newResponse.headers.set('X-Powered-By', 'Decentralized Storage SDK')
      newResponse.headers.set('X-Content-ID', '${contentId}')
      
      return newResponse
    }
    `;
  }
} 
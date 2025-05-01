import { 
  DecentralizedStorageSDK, 
  StorageProviderType, 
  CachingStrategy, 
  KeyManagementStrategy,
  CDNProviderType
} from '../src';

// This example shows basic usage of the SDK
async function runExample() {
  try {
    console.log('Initializing Decentralized Storage SDK...');
    
    // Create an instance of the SDK
    const sdk = new DecentralizedStorageSDK({
      storageProvider: StorageProviderType.IPFS,
      // In a real application, you would use a real API key
      apiKey: process.env.STORAGE_API_KEY || 'demo-api-key',
      enableCDN: true,
      enableEncryption: true,
      enableAnalytics: true,
      cdnConfig: {
        enableGeoDistribution: true,
        enableDDoSProtection: true,
        cachingStrategy: CachingStrategy.BASIC,
        provider: CDNProviderType.CLOUDFLARE
      },
      encryptionConfig: {
        algorithm: 'AES-256-GCM',
        keyManagement: KeyManagementStrategy.CLIENT_SIDE,
        customHandlers: {
          encrypt: async (data, key) => data, // Mock implementation
          decrypt: async (data, key) => data  // Mock implementation
        }
      },
      versioningConfig: {
        enabled: true,
        maxVersions: 5,
        autoPrune: true
      },
      cacheConfig: {
        defaultTTL: 3600,
        purgeOnUpdate: true
      }
    });
    
    // Initialize the SDK
    await sdk.initialize();
    console.log('SDK initialized successfully!');
    
    // Upload some content
    console.log('\nUploading content...');
    const content = {
      data: Buffer.from(JSON.stringify({
        message: 'Hello from the Decentralized Storage SDK!',
        timestamp: new Date().toISOString(),
        description: 'This is an example file uploaded for demonstration purposes.'
      }, null, 2)),
      mimeType: 'application/json',
      filename: 'example.json',
      metadata: {
        author: 'SDK Example',
        category: 'demo',
        tags: ['example', 'sdk', 'decentralized']
      },
      accessControl: {
        visibility: 'public' as 'public' // Type assertion to satisfy TypeScript
      }
    };
    
    const uploadResult = await sdk.uploadContent(content);
    console.log('Content uploaded successfully!');
    console.log(`Content ID: ${uploadResult.contentId}`);
    console.log(`Public URL: ${uploadResult.publicUrl}`);
    console.log(`CDN URL: ${uploadResult.cdnUrl || 'Not available'}`);
    console.log(`Size: ${uploadResult.size} bytes`);
    console.log(`Encrypted: ${uploadResult.encrypted}`);
    console.log(`Timestamp: ${uploadResult.timestamp}`);
    
    // Retrieve the content
    console.log('\nRetrieving content...');
    const retrievedContent = await sdk.retrieveContent(uploadResult.contentId);
    console.log('Content retrieved successfully!');
    console.log('Content data:', retrievedContent.data.toString());
    console.log('Metadata:', JSON.stringify(retrievedContent.metadata, null, 2));
    
    // Get the version history
    console.log('\nGetting version history...');
    const versions = await sdk.getContentVersions(uploadResult.contentId);
    console.log(`Found ${versions.length} version(s):`);
    versions.forEach((version, index) => {
      console.log(`  Version ${index + 1}:`);
      console.log(`    ID: ${version.versionId}`);
      console.log(`    Created: ${version.created}`);
      console.log(`    Size: ${version.size} bytes`);
    });
    
    // Get analytics
    console.log('\nGetting analytics data...');
    const analytics = await sdk.getAnalytics();
    console.log(`Total events: ${analytics.totalEvents}`);
    console.log(`Event counts:`, analytics.eventCounts);
    console.log(`Average response time: ${analytics.averageResponseTime.toFixed(2)}ms`);
    
    // Clean up
    console.log('\nCleaning up...');
    const deleteResult = await sdk.deleteContent(uploadResult.contentId);
    console.log(`Content deletion ${deleteResult ? 'successful' : 'failed'}`);
    
    // Close SDK connections
    await sdk.close();
    console.log('\nExample completed successfully!');
  } catch (error) {
    console.error('Error in example:', error);
  }
}

// Run the example
runExample(); 
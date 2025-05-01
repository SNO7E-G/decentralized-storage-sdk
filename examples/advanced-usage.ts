import { 
  DecentralizedStorageSDK, 
  StorageProviderType, 
  CDNProviderType,
  DatabaseProvider,
  FrameworkType,
  ContentToUpload,
  AlgorithmsConfig,
  CachingStrategy,
  KeyManagementStrategy
} from '../src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Advanced example demonstrating the enhanced SDK capabilities
 */
async function runAdvancedExample() {
  console.log('Starting advanced SDK example...');
  
  // Create SDK instance with advanced configuration
  const sdk = new DecentralizedStorageSDK({
    storageProvider: StorageProviderType.IPFS,
    apiKey: process.env.IPFS_API_KEY,
    enableCDN: true,
    cdnConfig: {
      enableGeoDistribution: true,
      enableDDoSProtection: true,
      cachingStrategy: CachingStrategy.AGGRESSIVE,
      provider: CDNProviderType.CLOUDFLARE,
      providerSettings: {
        zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
        email: process.env.CLOUDFLARE_EMAIL || '',
        apiKey: process.env.CLOUDFLARE_API_KEY || ''
      }
    },
    enableEncryption: true,
    encryptionConfig: {
      algorithm: 'AES-256-GCM',
      keyManagement: KeyManagementStrategy.CLIENT_SIDE
    },
    enableAnalytics: true,
    databaseConfig: {
      provider: DatabaseProvider.MONGODB,
      connection: {
        endpoint: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        database: 'decentralized_storage'
      },
      metadataCollection: 'content_metadata',
      analyticsCollection: 'analytics'
    },
    algorithmsConfig: {
      compression: {
        algorithm: 'gzip',
        level: 9
      },
      deduplication: {
        enabled: true
      }
    },
    frameworkConfig: {
      frameworkType: FrameworkType.REACT,
      autoBind: true
    }
  });
  
  try {
    // Initialize the SDK
    await sdk.initialize();
    console.log('SDK initialized successfully');
    
    // Upload content example
    const testFilePath = path.join(__dirname, 'test-file.txt');
    
    // Create test file if it doesn't exist
    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(
        testFilePath, 
        'This is a test file for the Decentralized Storage SDK with built-in CDN.'
      );
    }
    
    // Read file content
    const fileContent = fs.readFileSync(testFilePath);
    
    // Create content object
    const content: ContentToUpload = {
      data: fileContent,
      mimeType: 'text/plain',
      filename: 'test-file.txt',
      metadata: {
        description: 'Test file for advanced SDK usage example',
        tags: ['test', 'example', 'sdk']
      },
      accessControl: {
        visibility: 'public'
      }
    };
    
    // Upload content
    console.log('Uploading content...');
    const uploadResult = await sdk.uploadContent(content);
    console.log('Content uploaded successfully:', uploadResult);
    
    // Get content metadata
    console.log('Getting content metadata...');
    const metadata = await sdk.getContentMetadata(uploadResult.contentId);
    console.log('Content metadata:', metadata);
    
    // Retrieve content
    console.log('Retrieving content...');
    const retrievedContent = await sdk.retrieveContent(uploadResult.contentId);
    console.log('Content retrieved successfully');
    console.log('Content size:', retrievedContent.data.length, 'bytes');
    console.log('Content type:', retrievedContent.metadata.mimeType);
    
    // Test compression (using SDK methods instead of direct algorithmManager access)
    console.log('Testing content functionality...');
    console.log('Original file size:', fileContent.length, 'bytes');
    console.log('Uploaded content size:', uploadResult.size, 'bytes');
    if (uploadResult.size < fileContent.length) {
      console.log('Content was compressed during upload');
      console.log('Compression ratio:', (uploadResult.size / fileContent.length * 100).toFixed(2) + '%');
    }
    
    // List all content
    console.log('Listing content...');
    const contentListing = await sdk.listContent();
    console.log(`Found ${contentListing.items.length} items`);
    
    // Delete content (commented out to avoid removing the uploaded file)
    /*
    console.log('Deleting content...');
    const deleteResult = await sdk.deleteContent(uploadResult.contentId);
    console.log('Content deleted successfully:', deleteResult);
    */
    
    console.log('Advanced example completed successfully');
  } catch (error) {
    console.error('Error in advanced example:', error);
  } finally {
    // Close SDK connections
    await sdk.close();
  }
}

// Execute the example
runAdvancedExample().catch(error => {
  console.error('Unhandled error:', error);
}); 
/**
 * Redis Usage Example with Decentralized Storage SDK
 * 
 * This example demonstrates how to configure and use the Redis provider 
 * for metadata storage in the Decentralized Storage SDK.
 * 
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */

import { 
  DecentralizedStorageSDK, 
  StorageProviderType, 
  DatabaseProvider
} from '../src';
import * as fs from 'fs';
import * as path from 'path';

async function runRedisExample() {
  console.log('Starting Redis provider example...');
  
  // Create SDK instance with Redis configuration
  const sdk = new DecentralizedStorageSDK({
    storageProvider: StorageProviderType.IPFS,
    // In a real application, you would use a real API key
    apiKey: process.env.IPFS_API_KEY || 'demo-api-key',
    enableCDN: true,
    enableEncryption: true,
    databaseConfig: {
      provider: DatabaseProvider.REDIS,
      connection: {
        endpoint: process.env.REDIS_URL || 'redis://localhost:6379',
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        options: {
          database: 0 // Use database 0
        }
      },
      metadataCollection: 'content',
      analyticsCollection: 'events'
    },
    enableAnalytics: true
  });
  
  // Initialize the SDK
  await sdk.initialize();
  console.log('SDK initialized with Redis provider');
  
  try {
    // Upload a file
    const filePath = path.join(__dirname, 'redis-example.txt');
    fs.writeFileSync(filePath, 'This is a test file for Redis example.\nIt contains some text that will be stored using the Decentralized Storage SDK with Redis metadata storage.');
    
    const fileData = fs.readFileSync(filePath);
    
    console.log('Uploading file...');
    const uploadResult = await sdk.uploadContent({
      data: fileData,
      mimeType: 'text/plain',
      filename: 'redis-example.txt',
      metadata: {
        description: 'Example file for Redis provider demo',
        tags: ['example', 'redis', 'test'],
        ttl: 86400 // Redis will expire this entry in 24 hours (in seconds)
      }
    });
    
    console.log(`File uploaded successfully. Content ID: ${uploadResult.contentId}`);
    console.log(`Public URL: ${uploadResult.publicUrl}`);
    
    // Retrieve metadata
    console.log('\nRetrieving metadata from Redis...');
    const metadata = await sdk.getContentMetadata(uploadResult.contentId);
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
    
    // List all content
    console.log('\nListing all content from Redis...');
    const listResult = await sdk.listContent({
      limit: 10,
      orderBy: 'created',
      orderDirection: 'DESC'
    });
    
    console.log(`Found ${listResult.totalItems} items in storage`);
    listResult.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.filename} (${item.contentId})`);
    });
    
    // Record an analytics event
    console.log('\nRecording an analytics event...');
    
    // Get analytics data via querying
    console.log('\nQuerying analytics events...');
    const analytics = await sdk.getAnalytics({
      contentId: uploadResult.contentId,
      limit: 5
    });
    
    console.log(`Found ${analytics.totalEvents} events for this content`);
    
    // Clean up
    console.log('\nCleaning up...');
    await sdk.deleteContent(uploadResult.contentId);
    console.log('Content deleted');
    
    // Clean up file
    fs.unlinkSync(filePath);
    
    // Close SDK
    await sdk.close();
    console.log('SDK closed');
    
  } catch (error) {
    console.error('Error in Redis example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runRedisExample()
    .then(() => console.log('Redis example completed'))
    .catch(err => console.error('Redis example failed:', err));
} 
/**
 * MySQL Usage Example with Decentralized Storage SDK
 * 
 * This example demonstrates how to configure and use the MySQL provider 
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

async function runMySQLExample() {
  console.log('Starting MySQL provider example...');
  
  // Create SDK instance with MySQL configuration
  const sdk = new DecentralizedStorageSDK({
    storageProvider: StorageProviderType.IPFS,
    // In a real application, you would use a real API key
    apiKey: process.env.STORAGE_API_KEY || 'demo-api-key',
    enableCDN: true,
    enableEncryption: false, // Simplified for example purposes
    databaseConfig: {
      provider: DatabaseProvider.MYSQL,
      connection: {
        endpoint: process.env.MYSQL_HOST || 'localhost',
        database: process.env.MYSQL_DATABASE || 'decentralized_storage',
        username: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        options: {
          port: parseInt(process.env.MYSQL_PORT || '3306', 10)
        }
      },
      metadataCollection: 'content_metadata',
      analyticsCollection: 'analytics_events',
      usersCollection: 'users'
    },
    enableAnalytics: true
  });
  
  // Initialize the SDK
  await sdk.initialize();
  console.log('SDK initialized with MySQL provider');
  
  try {
    // Create a test file
    const filePath = path.join(__dirname, 'mysql-example.txt');
    fs.writeFileSync(filePath, 'This is a test file for MySQL example.\nIt contains some text that will be stored using the Decentralized Storage SDK with MySQL metadata storage.');
    
    const fileData = fs.readFileSync(filePath);
    
    console.log('Uploading file...');
    const uploadResult = await sdk.uploadContent({
      data: fileData,
      mimeType: 'text/plain',
      filename: 'mysql-example.txt',
      metadata: {
        description: 'Example file for MySQL provider demo',
        tags: ['example', 'mysql', 'test'],
        author: 'SDK Example User'
      }
    });
    
    console.log(`File uploaded successfully. Content ID: ${uploadResult.contentId}`);
    console.log(`Public URL: ${uploadResult.publicUrl}`);
    
    // Add a small delay to ensure database operations complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Retrieve metadata
    console.log('\nRetrieving metadata from MySQL...');
    const metadata = await sdk.getContentMetadata(uploadResult.contentId);
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
    
    // Upload another version of the file
    console.log('\nUploading an updated version of the file...');
    fs.writeFileSync(filePath, 'This is the updated content for the MySQL example file.\nWe will use this to test versioning with MySQL storage provider.');
    
    const updatedFileData = fs.readFileSync(filePath);
    
    const updateResult = await sdk.updateContent(uploadResult.contentId, {
      data: updatedFileData,
      mimeType: 'text/plain',
      filename: 'mysql-example-updated.txt',
      metadata: {
        description: 'Updated file for MySQL provider demo',
        tags: ['example', 'mysql', 'test', 'updated'],
        author: 'SDK Example User',
        version: '2.0'
      }
    });
    
    console.log(`File updated successfully. Content ID: ${updateResult.contentId}`);
    
    // Get version history
    console.log('\nRetrieving version history...');
    const versions = await sdk.getContentVersions(uploadResult.contentId);
    console.log(`Found ${versions.length} versions:`);
    
    versions.forEach((version, index) => {
      console.log(`Version ${index + 1}:`);
      console.log(`  ID: ${version.versionId}`);
      console.log(`  Created: ${version.created.toISOString()}`);
      console.log(`  Size: ${version.size} bytes`);
      console.log(`  Metadata:`, version.metadata);
    });
    
    // List all content
    console.log('\nListing all content from MySQL...');
    const listResult = await sdk.listContent({
      limit: 10,
      orderBy: 'updated',
      orderDirection: 'DESC'
    });
    
    console.log(`Found ${listResult.totalItems} items in storage`);
    listResult.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.filename} (${item.contentId})`);
      console.log(`   Updated: ${item.updated.toISOString()}`);
      console.log(`   Size: ${item.size} bytes`);
    });
    
    // Filter content
    console.log('\nFiltering content by mimetype...');
    const filteredResult = await sdk.listContent({
      filter: {
        mimeType: 'text/plain'
      },
      limit: 5
    });
    
    console.log(`Found ${filteredResult.totalItems} text/plain items`);
    
    // Record analytics events
    console.log('\nRecording analytics events...');
    
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
    console.error('Error in MySQL example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runMySQLExample()
    .then(() => console.log('MySQL example completed'))
    .catch(err => console.error('MySQL example failed:', err));
} 
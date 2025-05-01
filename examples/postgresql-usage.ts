/**
 * PostgreSQL Usage Example with Decentralized Storage SDK
 * 
 * This example demonstrates how to configure and use the PostgreSQL provider 
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

async function runPostgreSQLExample() {
  console.log('Starting PostgreSQL provider example...');
  
  // Create SDK instance with PostgreSQL configuration
  const sdk = new DecentralizedStorageSDK({
    storageProvider: StorageProviderType.IPFS,
    apiKey: process.env.IPFS_API_KEY || 'your-api-key',
    enableCDN: true,
    enableEncryption: true,
    databaseConfig: {
      provider: DatabaseProvider.POSTGRESQL,
      connection: {
        endpoint: process.env.POSTGRES_URI || 'localhost',
        database: process.env.POSTGRES_DB || 'decentralized_storage',
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        options: {
          port: parseInt(process.env.POSTGRES_PORT || '5432'),
          ssl: process.env.POSTGRES_SSL === 'true'
        }
      },
      metadataCollection: 'content_metadata',
      analyticsCollection: 'analytics_events',
      usersCollection: 'users'
    },
    enableAnalytics: true,
    versioningConfig: {
      enabled: true,
      maxVersions: 10,
      autoPrune: true
    }
  });
  
  try {
    // Initialize the SDK
    console.log('Initializing SDK with PostgreSQL database...');
    await sdk.initialize();
    console.log('SDK initialized successfully');
    
    // Create a test file if it doesn't exist
    const testFilePath = path.join(__dirname, 'test-file.txt');
    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(
        testFilePath, 
        'This is a test file for using PostgreSQL with the Decentralized Storage SDK.'
      );
    }
    
    // Read file content
    const fileContent = fs.readFileSync(testFilePath);
    
    // Upload content
    console.log('Uploading content with PostgreSQL metadata storage...');
    const uploadResult = await sdk.uploadContent({
      data: fileContent,
      mimeType: 'text/plain',
      filename: 'postgresql-example.txt',
      metadata: {
        description: 'PostgreSQL example file',
        tags: ['postgresql', 'example', 'database']
      }
    });
    
    console.log('Content uploaded successfully!');
    console.log(`Content ID: ${uploadResult.contentId}`);
    console.log(`Public URL: ${uploadResult.publicUrl}`);
    console.log(`Size: ${uploadResult.size} bytes`);
    
    // Retrieve metadata from PostgreSQL
    console.log('\nRetrieving metadata from PostgreSQL...');
    const metadata = await sdk.getContentMetadata(uploadResult.contentId);
    console.log('Metadata retrieved:', metadata);
    
    // List content with filter
    console.log('\nListing content with filter...');
    const contentList = await sdk.listContent({
      filter: {
        mimeType: 'text/plain'
      },
      limit: 10
    });
    console.log(`Found ${contentList.items.length} items`);
    contentList.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.filename} (${item.contentId})`);
    });
    
    // Get analytics data
    console.log('\nRetrieving analytics data...');
    const analytics = await sdk.getAnalytics({
      contentId: uploadResult.contentId
    });
    console.log(`Found ${analytics.events.length} events for this content`);
    
    // Update the content to test versioning
    console.log('\nUpdating content to test versioning with PostgreSQL...');
    const updatedContent = Buffer.from(
      'This is an updated version of the test file for PostgreSQL integration.'
    );
    
    const updateResult = await sdk.updateContent(uploadResult.contentId, {
      data: updatedContent,
      mimeType: 'text/plain',
      filename: 'postgresql-example.txt'
    });
    
    console.log('Content updated successfully!');
    console.log(`Updated Content ID: ${updateResult.contentId}`);
    
    // Get version history
    console.log('\nRetrieving version history from PostgreSQL...');
    const versions = await sdk.getContentVersions(uploadResult.contentId);
    console.log(`Found ${versions.length} versions:`);
    versions.forEach((version, index) => {
      console.log(`Version ${index + 1}:`);
      console.log(`  ID: ${version.versionId}`);
      console.log(`  Created: ${version.created}`);
      console.log(`  Size: ${version.size} bytes`);
    });
    
    // Clean up (optional)
    if (process.env.CLEANUP === 'true') {
      console.log('\nCleaning up...');
      await sdk.deleteContent(uploadResult.contentId);
      console.log('Content deleted');
    }
    
  } catch (error) {
    console.error('Error during PostgreSQL example:', error);
  } finally {
    // Close SDK connections
    console.log('\nClosing SDK connections...');
    await sdk.close();
    console.log('Connections closed');
  }
}

// Run the example
if (require.main === module) {
  runPostgreSQLExample()
    .then(() => console.log('PostgreSQL example completed'))
    .catch(error => console.error('PostgreSQL example failed:', error));
}

export default runPostgreSQLExample; 
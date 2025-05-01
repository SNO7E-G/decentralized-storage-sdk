# Decentralized Storage SDK with Built-in CDN

A powerful SDK for decentralized storage with built-in CDN capabilities, providing fast, reliable, and secure content delivery across multiple frameworks, storage providers, and databases.

[![npm version](https://img.shields.io/npm/v/decentralized-storage-sdk.svg)](https://www.npmjs.com/package/decentralized-storage-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 🌟 Features

- **Multiple Storage Providers**: Support for IPFS, Web3.Storage, Arweave, Filecoin, Storj, Swarm, and more
- **Built-in CDN**: Improve content delivery with integrated CDN capabilities including Cloudflare and Bunny CDN
- **Framework Integration**: Built-in support for React, React Native, Angular, Vue, Express, Next.js, NestJS and more
- **Advanced Algorithms**: Content compression, deduplication, and intelligent content recommendation engine
- **Database Support**: MongoDB, PostgreSQL, MySQL, Redis, CouchDB and more for metadata and analytics storage
- **Encryption**: End-to-end encryption and content integrity verification
- **Analytics**: Track content usage and performance metrics with built-in analytics
- **Versioning**: Keep track of content versions with automatic version management
- **Edge Computing**: Run code at the edge for faster processing
- **Robust Error Handling**: Comprehensive error handling with automatic retries, exponential backoff, and detailed error reporting

## 📦 Installation

```bash
npm install decentralized-storage-sdk
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { 
  DecentralizedStorageSDK, 
  StorageProviderType 
} from 'decentralized-storage-sdk';

// Create SDK instance
const sdk = new DecentralizedStorageSDK({
  storageProvider: StorageProviderType.IPFS,
  apiKey: 'your-api-key',
  enableCDN: true,
  enableEncryption: true,
  enableAnalytics: true
});

// Initialize SDK
await sdk.initialize();

// Upload content
const result = await sdk.uploadContent({
  data: Buffer.from('Hello, World!'),
  mimeType: 'text/plain',
  filename: 'hello.txt'
});

console.log('Content uploaded:', result.contentId);
console.log('Public URL:', result.publicUrl);
console.log('CDN URL:', result.cdnUrl);

// Retrieve content
const content = await sdk.retrieveContent(result.contentId);
console.log('Content:', content.data.toString());
console.log('Metadata:', content.metadata);

// Get content recommendations
const recommendations = await sdk.getContentRecommendations('user123', result.contentId, 5);
console.log('Recommended content:', recommendations);

// Close SDK connections when done
await sdk.close();
```

## 🗺️ Implementation Roadmap

Below is the current implementation status of various components in the SDK:

> **Note**: For a more detailed roadmap with timelines and future plans, see the [Detailed Development Roadmap](./docs/ROADMAP.md).

### Storage Providers

| Provider | Status | Features |
|----------|--------|----------|
| IPFS | ✅ Implemented | Content addressing, pinning, gateway integration |
| Web3.Storage | ✅ Implemented | IPFS + Filecoin, content persistence |
| Arweave | ✅ Implemented | Permanent storage, content addressing |
| Filecoin | ✅ Implemented | Long-term storage, retrieval deals |
| Storj | ✅ Implemented | Encrypted distributed storage, content integrity |
| Swarm | 🔄 In Progress | Distributed storage, incentivization |
| Pinata | ✅ Implemented | IPFS pinning service |
| Fleek | 🔄 In Progress | IPFS + Filecoin integration |
| S3 | ✅ Implemented | Object storage (AWS, MinIO) |
| Firebase | 🔄 In Progress | Google Firebase Storage |
| Skynet | 🔜 Planned | Decentralized hosting platform |
| Sia | 🔜 Planned | Distributed cloud storage |

### Database Providers

| Provider | Status | Features |
|----------|--------|----------|
| MongoDB | ✅ Implemented | Document storage, indexes, aggregation |
| PostgreSQL | ✅ Implemented | Relational, ACID, full-text search |
| MySQL/MariaDB | ✅ Implemented | Relational, transaction support |
| Redis | ✅ Implemented | In-memory, caching, pub/sub |
| CouchDB | ✅ Implemented | Document storage, HTTP API, MapReduce |
| Firestore | 🔄 In Progress | NoSQL document, real-time updates |
| DynamoDB | 🔄 In Progress | Key-value and document storage |
| SQLite | 🔄 In Progress | Embedded relational database |
| Fauna | 🔜 Planned | Global distribution, GraphQL |
| CosmosDB | 🔜 Planned | Globally distributed multi-model |
| Cassandra | 🔜 Planned | Wide-column store, high availability |
| InfluxDB | 🔜 Planned | Time series for analytics |
| PineconeDB | 🔜 Planned | Vector database for ML |

### CDN Providers

| Provider | Status | Features |
|----------|--------|----------|
| Cloudflare | ✅ Implemented | Global CDN, DDoS protection, edge functions |
| Bunny CDN | ✅ Implemented | Performance CDN, token authentication |
| Akamai | 🔄 In Progress | Enterprise-grade CDN |
| Fastly | 🔄 In Progress | Edge computing, content delivery |
| CloudFront | 🔄 In Progress | AWS global CDN |
| KeyCDN | 🔜 Planned | Pay-as-you-go CDN |
| StackPath | 🔜 Planned | Edge services platform |
| IPFS Gateways | ✅ Implemented | Decentralized content delivery |
| Cloudinary | 🔜 Planned | Media optimization and delivery |
| Imperva | 🔜 Planned | Security-focused CDN |

### Framework Integrations

| Framework | Status | Features |
|-----------|--------|----------|
| No Framework (Core) | ✅ Implemented | Base SDK functionality |
| ~~React~~ | ⏸️ Deprecated | *Replaced with better integration* |
| React Native | 🔄 In Progress | Mobile SDK integration |
| NestJS | ✅ Implemented | Module, service, controller, decorators |
| Angular | 🔄 In Progress | Services, DI integration |
| Vue | 🔄 In Progress | Composables, plugins |
| Express | 🔄 In Progress | Middleware, routes |
| Next.js | 🔜 Planned | API routes, React integration |
| Svelte | 🔜 Planned | Stores, components |
| Remix | 🔜 Planned | Loaders, actions |
| Nuxt | 🔜 Planned | Server and client integration |
| Electron | 🔜 Planned | Desktop integration |
| Expo | 🔜 Planned | Mobile framework integration |

### Algorithms & Advanced Features

| Feature | Status | Description |
|---------|--------|-------------|
| Content Recommendation | ✅ Implemented | Collaborative filtering, personalization |
| Content Compression | ✅ Implemented | gzip, brotli, zstd compression |
| Deduplication | ✅ Implemented | Content-based deduplication |
| Encryption | ✅ Implemented | End-to-end encryption, key management |
| Analytics | ✅ Implemented | Usage metrics, performance tracking |
| Versioning | ✅ Implemented | Content versioning, history |
| Caching | ✅ Implemented | Multi-level cache, TTL, invalidation |
| Edge Computing | 🔄 In Progress | Code execution at edge locations |
| Content Indexing | 🔄 In Progress | Search capabilities |
| Access Control | ✅ Implemented | Permission-based access |
| Rate Limiting | 🔄 In Progress | Request throttling |
| Webhooks | 🔜 Planned | Event notifications |
| Smart Content Routing | 🔜 Planned | Intelligent provider selection |
| Machine Learning Pipeline | 🔜 Planned | Advanced processing & insights |

Legend:
- ✅ Implemented: Feature is complete and available
- 🔄 In Progress: Feature is currently being developed
- 🔜 Planned: Feature is on the roadmap for future development
- ⏸️ Deprecated: Feature has been removed or replaced

## 📊 Storage Providers

The SDK supports multiple storage providers including:

- **IPFS**: InterPlanetary File System
- **Web3.Storage**: Decentralized storage service built on IPFS and Filecoin
- **Arweave**: Permanent, decentralized storage
- **Filecoin**: Decentralized storage network
- **Storj**: Decentralized cloud object storage
- **Swarm**: Distributed storage platform and content distribution service
- **Pinata**: IPFS pinning service
- **Fleek**: IPFS storage service
- **S3**: Amazon S3 compatible storage (including alternatives like MinIO)
- **Firebase**: Google Firebase Storage
- **Custom**: Implement your own storage provider

```typescript
// Using Storj as storage provider
const sdk = new DecentralizedStorageSDK({
  storageProvider: StorageProviderType.STORJ,
  storageProviderOptions: {
    accessKey: 'your-access-key',
    secretKey: 'your-secret-key',
    bucketName: 'your-bucket-name'
  },
  enableCDN: true
});
```

## 💾 Database Providers

The SDK supports multiple database providers for metadata and analytics storage:

- **MongoDB**: Document database
- **PostgreSQL**: Relational database
- **MySQL/MariaDB**: Relational database
- **Redis**: In-memory data structure store
- **CouchDB**: Document database
- **Firestore**: Google Cloud Firestore
- **DynamoDB**: Amazon DynamoDB
- **SQLite**: Embedded relational database
- **And more**: Including Fauna, CosmosDB, Pinecone, Cassandra, and others

```typescript
// Using CouchDB for metadata storage
const sdk = new DecentralizedStorageSDK({
  storageProvider: StorageProviderType.IPFS,
  apiKey: 'your-api-key',
  databaseConfig: {
    provider: DatabaseProvider.COUCHDB,
    connection: {
      endpoint: 'http://localhost:5984',
      username: 'admin',
      password: 'password'
    },
    metadataCollection: 'content_metadata',
    analyticsCollection: 'analytics_events'
  }
});
```

## 🌐 CDN Providers

The SDK includes built-in CDN support with providers including:

- **Cloudflare**: Global CDN with DDoS protection
- **Bunny CDN**: Performance-focused global CDN
- **Akamai**: Enterprise CDN solution
- **Fastly**: Edge cloud platform
- **CloudFront**: Amazon CloudFront CDN
- **And more**: Including KeyCDN, StackPath, IPFS gateways, and others

```typescript
// Using Bunny CDN for content delivery
const sdk = new DecentralizedStorageSDK({
  storageProvider: StorageProviderType.IPFS,
  apiKey: 'your-api-key',
  enableCDN: true,
  cdnConfig: {
    provider: CDNProviderType.BUNNY,
    providerSettings: {
      apiKey: 'your-bunny-api-key',
      storageZoneName: 'your-storage-zone',
      pullZoneId: 12345,
      security: {
        enableTokenAuth: true,
        tokenAuthKey: 'your-token-auth-key'
      }
    }
  }
});
```

## 🧩 Framework Integrations

### Using with React

```tsx
import React, { useState } from 'react';
import { 
  StorageSDKProvider, 
  useContentUpload, 
  FileUpload 
} from 'decentralized-storage-sdk/frameworks/react';

// Configure SDK
const sdkConfig = {
  storageProvider: 'ipfs',
  apiKey: process.env.STORAGE_API_KEY,
  enableCDN: true,
  enableEncryption: true,
  enableAnalytics: true
};

// Provider component
function App() {
  return (
    <StorageSDKProvider config={sdkConfig}>
      <UploadComponent />
    </StorageSDKProvider>
  );
}

// Upload component using hooks
function UploadComponent() {
  const { uploadContent, loading, result } = useContentUpload();
  const [file, setFile] = useState(null);
  
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    const content = {
      data: await file.arrayBuffer(),
      mimeType: file.type,
      filename: file.name
    };
    
    await uploadContent(content);
  };
  
  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file || loading}>
        {loading ? 'Uploading...' : 'Upload'}
      </button>
      
      {/* Or use the pre-built component */}
      <FileUpload onUploadComplete={(result) => console.log(result)} />
      
      {loading && <p>Uploading...</p>}
      {result && <p>Upload successful: {result.publicUrl}</p>}
    </div>
  );
}
```

### Using with NestJS

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { StorageSdkModule } from 'decentralized-storage-sdk/frameworks/nestjs';
import { StorageProviderType, DatabaseProvider, CDNProviderType } from 'decentralized-storage-sdk';

@Module({
  imports: [
    StorageSdkModule.register({
      config: {
        storageProvider: StorageProviderType.STORJ,
        storageProviderOptions: {
          accessKey: process.env.STORJ_ACCESS_KEY,
          secretKey: process.env.STORJ_SECRET_KEY,
          bucketName: 'my-app-bucket'
        },
        enableCDN: true,
        cdnConfig: {
          provider: CDNProviderType.BUNNY,
          providerSettings: {
            apiKey: process.env.BUNNY_API_KEY,
            storageZoneName: 'my-storage-zone',
            pullZoneId: parseInt(process.env.BUNNY_PULL_ZONE_ID)
          }
        },
        databaseConfig: {
          provider: DatabaseProvider.COUCHDB,
          connection: {
            endpoint: process.env.COUCHDB_URL,
            username: process.env.COUCHDB_USER,
            password: process.env.COUCHDB_PASSWORD
          },
          metadataCollection: 'content_metadata',
          analyticsCollection: 'analytics_events'
        },
        algorithmsConfig: {
          contentRecommendation: {
            enabled: true,
            algorithm: 'collaborative-filtering'
          }
        }
      },
      autoInitialize: true,
      isGlobal: true
    })
  ]
})
export class AppModule {}

// storage.controller.ts
import { Controller, Post, Get, Delete, Param, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from 'decentralized-storage-sdk/frameworks/nestjs';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file) {
    return this.storageService.uploadContent({
      data: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname
    });
  }

  @Get(':id')
  async getFile(@Param('id') id: string) {
    return this.storageService.retrieveContent(id);
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return this.storageService.deleteContent(id);
  }

  @Get('recommendations/:userId')
  async getRecommendations(
    @Param('userId') userId: string,
    @Query('currentContent') currentContentId?: string,
    @Query('limit') limit?: number
  ) {
    return this.storageService.getSdk().getContentRecommendations(
      userId,
      currentContentId,
      limit ? parseInt(limit) : 5
    );
  }
}
```

## 🔬 Advanced Features

### Content Recommendation Engine

The SDK includes a powerful content recommendation engine that uses collaborative filtering to provide personalized content recommendations:

```typescript
// Record user interaction with content
sdk.recordContentView('user123', 'content-123', {
  viewDuration: 120, // seconds
  completionPercentage: 0.85,
  rating: 4.5
});

// Get personalized recommendations
const recommendations = await sdk.getContentRecommendations('user123', 'content-123', 5);
console.log('Recommended content:', recommendations);
/*
[
  { 
    contentId: 'content-456', 
    score: 0.89, 
    reason: 'Similar to content you've interacted with: content-123' 
  },
  ...
]
*/

// Get recommendation system statistics
const stats = sdk.getRecommendationStats();
console.log('Recommendation system stats:', stats);
```

### Error Handling with Retries

The SDK includes comprehensive error handling with automatic retries and exponential backoff:

```typescript
import { retryWithBackoff, SDKError, SDKErrorCode } from 'decentralized-storage-sdk';

try {
  // This will automatically retry failed operations
  const result = await sdk.uploadContent({
    data: Buffer.from('Hello, World!'),
    mimeType: 'text/plain',
    filename: 'hello.txt'
  });
} catch (error) {
  if (error instanceof SDKError) {
    console.error(`SDK Error (${error.code}): ${error.message}`);
    console.error('Details:', error.details);
  } else {
    console.error('Unknown error:', error);
  }
}

// You can also use the retry utility directly
try {
  const result = await retryWithBackoff(
    async () => {
      // Your async operation here
      return await someAsyncOperation();
    },
    {
      maxRetries: 5,
      initialDelayMs: 300,
      maxDelayMs: 10000,
      backoffFactor: 2,
      shouldRetry: (error) => {
        // Custom logic to determine if retry should happen
        return error.isRetryable === true;
      }
    }
  );
} catch (error) {
  console.error('Operation failed after multiple retries:', error);
}
```

## 📚 Documentation

For more detailed documentation, examples, and API reference, check out the [documentation](./docs/).

## 🤝 Contributing

Contributions are welcome! Please check out our [contributing guidelines](./CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details. 
# Decentralized Storage SDK Documentation

Welcome to the documentation for the Decentralized Storage SDK with Built-in CDN. This documentation provides detailed information about the SDK's features, components, and usage guidelines.

## Contents

- [API Reference](./api/README.md): Complete API documentation for the SDK
- [Storage Providers](./storage-providers/README.md): Information about supported storage providers
- [Database Providers](./database-providers/README.md): Details on database providers for metadata storage
- [Algorithms](./algorithms/README.md): Documentation on compression, deduplication, and recommendation algorithms
- [Frameworks](./frameworks/README.md): Integration guides for various frameworks (React, React Native, etc.)
- [Examples](./examples/README.md): Sample code and usage examples
- [Implementation Roadmap](../README.md#%F0%9F%97%BA%EF%B8%8F-implementation-roadmap): Current implementation status of all components
- [Detailed Roadmap](./ROADMAP.md): Comprehensive development timeline and future plans

## Key Features

- **Multiple Storage Providers**: IPFS, Web3.Storage, Arweave, Filecoin, Storj, and more
- **Database Integration**: MongoDB, PostgreSQL, MySQL, Redis, CouchDB, and others
- **CDN Capabilities**: Cloudflare, Bunny CDN, and other providers for fast content delivery
- **Framework Support**: React, React Native, NestJS, Angular, Vue, and many more
- **Advanced Algorithms**: Content recommendation engine, compression, and deduplication
- **Security Features**: Encryption, content integrity verification, and secure authentication
- **Analytics**: Track content usage and performance metrics

## Getting Started

For a quick introduction to using the SDK, please refer to the main [README.md](../README.md) file at the root of the project.

## Implementation Status

The SDK is under active development with many components already implemented and others in progress. For a detailed breakdown of the current implementation status of all providers, frameworks, and features, please see:

- [Implementation Roadmap](../README.md#%F0%9F%97%BA%EF%B8%8F-implementation-roadmap): Quick reference tables in the main README
- [Detailed Roadmap](./ROADMAP.md): Comprehensive development timeline with past achievements and future plans

## Installation

```bash
npm install decentralized-storage-sdk
```

## Basic Usage

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
  enableEncryption: true
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

// Retrieve content
const content = await sdk.retrieveContent(result.contentId);
console.log('Content:', content.data.toString());

// Close SDK connections when done
await sdk.close();
```

## New Features

### Storj Storage Provider

The SDK now supports [Storj](https://www.storj.io/), a decentralized cloud object storage service that provides secure, private, and encrypted cloud storage.

```typescript
import { DecentralizedStorageSDK, StorageProviderType } from 'decentralized-storage-sdk';

const sdk = new DecentralizedStorageSDK({
  storageProvider: StorageProviderType.STORJ,
  storageProviderOptions: {
    accessKey: 'your-access-key',
    secretKey: 'your-secret-key',
    bucketName: 'your-bucket-name'
  }
});
```

### CouchDB Database Provider

Support for [CouchDB](https://couchdb.apache.org/), a document-oriented NoSQL database that offers resilience and scalability for metadata and analytics storage.

```typescript
import { DecentralizedStorageSDK, DatabaseProvider } from 'decentralized-storage-sdk';

const sdk = new DecentralizedStorageSDK({
  // Other config...
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

### Bunny CDN Provider

Integration with [Bunny CDN](https://bunny.net/), a global content delivery network focused on performance and affordability.

```typescript
import { DecentralizedStorageSDK, CDNProviderType } from 'decentralized-storage-sdk';

const sdk = new DecentralizedStorageSDK({
  // Other config...
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

### NestJS Framework Integration

The SDK now offers seamless integration with [NestJS](https://nestjs.com/), a progressive Node.js framework for building efficient and scalable server-side applications.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { StorageSdkModule } from 'decentralized-storage-sdk/frameworks/nestjs';

@Module({
  imports: [
    StorageSdkModule.register({
      config: {
        storageProvider: StorageProviderType.IPFS,
        apiKey: 'your-api-key'
      },
      autoInitialize: true,
      isGlobal: true
    })
  ]
})
export class AppModule {}
```

### Content Recommendation Engine

The SDK includes a powerful content recommendation engine that uses collaborative filtering algorithms to provide personalized content recommendations based on user interactions.

```typescript
// Record a user viewing content
sdk.recordContentView('user123', 'content-id', {
  viewDuration: 120,
  completionPercentage: 0.85
});

// Get personalized recommendations
const recommendations = await sdk.getContentRecommendations('user123', 'current-content-id', 5);
```

## Contributing

If you'd like to contribute to the documentation, please follow the guidelines in the [CONTRIBUTING.md](../CONTRIBUTING.md) file.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details. 
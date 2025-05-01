# Database Providers

The Decentralized Storage SDK supports various database providers for storing metadata and analytics. This document provides details on the available database providers and how to configure them.

## Supported Database Providers

- [MongoDB](#mongodb): Document-based database
- [PostgreSQL](#postgresql): Relational database
- [MySQL](#mysql): Relational database
- [Redis](#redis): In-memory data store
- [CouchDB](#couchdb): Document-oriented NoSQL database
- [More providers](#more-providers): Information about other supported database providers

## Configuration

When initializing the SDK, you can specify a database provider to store metadata and analytics:

```typescript
import { 
  DecentralizedStorageSDK, 
  StorageProviderType, 
  DatabaseProvider 
} from 'decentralized-storage-sdk';

const sdk = new DecentralizedStorageSDK({
  storageProvider: StorageProviderType.IPFS,
  apiKey: 'your-api-key',
  databaseConfig: {
    provider: DatabaseProvider.MONGODB,
    connection: {
      endpoint: 'mongodb://localhost:27017',
      database: 'decentralized_storage',
      username: 'admin',
      password: 'password',
      options: {
        // Database-specific options
      }
    },
    metadataCollection: 'content_metadata',
    analyticsCollection: 'analytics_events',
    usersCollection: 'users',
    enableQueryCache: true,
    maxRetries: 3
  }
});
```

## MongoDB

MongoDB is a document-based NoSQL database that stores data in flexible, JSON-like documents.

### Configuration

```typescript
const sdk = new DecentralizedStorageSDK({
  // Other configuration...
  databaseConfig: {
    provider: DatabaseProvider.MONGODB,
    connection: {
      endpoint: 'mongodb://localhost:27017',
      database: 'decentralized_storage',
      username: 'admin',
      password: 'password',
      options: {
        replicaSet: 'rs0',
        ssl: true,
        authSource: 'admin'
      }
    },
    metadataCollection: 'content_metadata',
    analyticsCollection: 'analytics_events'
  }
});
```

### Supported Features

- Content metadata storage and retrieval
- Analytics event tracking
- Aggregation pipelines for analytics
- Query filtering and pagination
- Indexing for faster queries
- Transactions (for replica sets)

## PostgreSQL

PostgreSQL is a powerful, open-source object-relational database system with a strong reputation for reliability and data integrity.

### Configuration

```typescript
const sdk = new DecentralizedStorageSDK({
  // Other configuration...
  databaseConfig: {
    provider: DatabaseProvider.POSTGRESQL,
    connection: {
      endpoint: 'localhost',
      database: 'decentralized_storage',
      username: 'postgres',
      password: 'password',
      options: {
        port: 5432,
        ssl: false,
        maxConnections: 20
      }
    },
    metadataCollection: 'content_metadata',
    analyticsCollection: 'analytics_events'
  }
});
```

### Supported Features

- Content metadata storage and retrieval
- Analytics event tracking
- Advanced queries with SQL
- Full-text search capabilities
- Transactions with ACID properties
- Stored procedures and functions

## MySQL

MySQL is a widely used open-source relational database management system.

### Configuration

```typescript
const sdk = new DecentralizedStorageSDK({
  // Other configuration...
  databaseConfig: {
    provider: DatabaseProvider.MYSQL,
    connection: {
      endpoint: 'localhost',
      database: 'decentralized_storage',
      username: 'root',
      password: 'password',
      options: {
        port: 3306,
        ssl: false,
        connectionLimit: 10
      }
    },
    metadataCollection: 'content_metadata',
    analyticsCollection: 'analytics_events'
  }
});
```

### Supported Features

- Content metadata storage and retrieval
- Analytics event tracking
- SQL queries
- Indexing for faster queries
- Transactions
- Stored procedures

## Redis

Redis is an in-memory data structure store, used as a database, cache, and message broker.

### Configuration

```typescript
const sdk = new DecentralizedStorageSDK({
  // Other configuration...
  databaseConfig: {
    provider: DatabaseProvider.REDIS,
    connection: {
      endpoint: 'redis://localhost:6379',
      username: '',
      password: '',
      options: {
        database: 0,
        tls: false
      }
    },
    metadataCollection: 'metadata',
    analyticsCollection: 'analytics'
  }
});
```

### Supported Features

- Fast content metadata storage and retrieval
- Analytics event tracking
- Key-value operations
- Data structure operations (lists, sets, sorted sets)
- Time-to-live (TTL) for automatic expiration
- Pub/Sub messaging

## CouchDB

CouchDB is a document-oriented NoSQL database that uses JSON documents, HTTP API, and MapReduce for data storage, access, and indexing.

### Configuration

```typescript
const sdk = new DecentralizedStorageSDK({
  // Other configuration...
  databaseConfig: {
    provider: DatabaseProvider.COUCHDB,
    connection: {
      endpoint: 'http://localhost:5984',
      username: 'admin',
      password: 'password',
      options: {
        timeout: 10000,
        maxRetries: 3
      }
    },
    metadataCollection: 'content_metadata',
    analyticsCollection: 'analytics_events'
  }
});
```

### Supported Features

- Document-based content metadata storage and retrieval
- Analytics event tracking and aggregation
- RESTful HTTP API
- Robust error handling with retry mechanisms
- Bi-directional replication
- Change notifications
- MapReduce views for querying and reporting

### Implementation Details

The CouchDB provider implementation includes:

1. **Connection Management**: Automatic database creation and connection management
2. **Structured Data Storage**: Properly formatted JSON documents with revision control
3. **Error Handling**: Comprehensive error handling with retry logic
4. **Data Validation**: Ensures data integrity and consistent document structure
5. **Analytics Support**: Special handling for analytics events with aggregation capabilities
6. **Design Documents**: Creation of necessary design documents and indexes for efficient querying

### Methods

- `connect()`: Initialize the database connection
- `disconnect()`: Close database connection
- `storeMetadata(metadata)`: Store content metadata
- `getMetadata(contentId)`: Retrieve content metadata
- `deleteMetadata(contentId)`: Delete content metadata
- `listMetadata(filter, limit, skip)`: List metadata based on filter criteria
- `storeAnalyticsEvent(event)`: Store analytics event
- `getAnalyticsEvents(filters)`: Get analytics events
- `updateContentReference(oldContentId, newContentId)`: Update content reference
- `aggregate(pipeline)`: Perform analytics aggregation
- `getStorageStats()`: Get storage statistics

### Example Usage

```typescript
// Initialize SDK with CouchDB
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

// Initialize SDK
await sdk.initialize();

// Use the SDK to store and retrieve data
const result = await sdk.uploadContent({
  data: Buffer.from('Hello, CouchDB!'),
  mimeType: 'text/plain',
  filename: 'hello.txt'
});

// Retrieve storage statistics
const stats = await sdk.getStorageStats();
console.log('Storage stats:', stats);

// Get analytics data
const analytics = await sdk.getAnalytics({
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  endDate: new Date()
});
console.log('Analytics data:', analytics);
```

## More Providers

The SDK also supports or is in the process of adding support for:

- **Firestore**: Google Cloud Firestore
- **DynamoDB**: Amazon DynamoDB
- **SQLite**: Embedded relational database
- **Fauna**: Transactional database with GraphQL
- **CosmosDB**: Microsoft Azure's globally distributed database
- **MariaDB**: Enhanced MySQL fork
- **Oracle**: Enterprise database
- **Neo4j**: Graph database
- **Cassandra**: Wide-column store NoSQL database
- **InfluxDB**: Time series database for analytics

## Custom Database Provider

You can implement your own database provider by:

1. Implementing the required database interface
2. Registering your custom provider with the SDK

```typescript
import { DecentralizedStorageSDK, DatabaseProvider } from 'decentralized-storage-sdk';

// Implement your custom database provider
class MyCustomDatabaseProvider {
  // Implement the required methods
  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
  async storeMetadata(metadata) { /* ... */ }
  async getMetadata(contentId) { /* ... */ }
  async deleteMetadata(contentId) { /* ... */ }
  async listMetadata(filter, limit, skip) { /* ... */ }
  async storeAnalyticsEvent(event) { /* ... */ }
  async getAnalyticsEvents(filters) { /* ... */ }
  async getStorageStats() { /* ... */ }
  // ...
}

// Register your custom provider with the SDK
const sdk = new DecentralizedStorageSDK({
  // Other configuration...
  databaseConfig: {
    provider: DatabaseProvider.CUSTOM,
    customProvider: new MyCustomDatabaseProvider()
  }
});
``` 
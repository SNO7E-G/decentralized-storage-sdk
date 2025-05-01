// Export types
export * from './core/types';

// Export main SDK
export { DecentralizedStorageSDK } from './core/DecentralizedStorageSDK';

// Export storage providers
export { IPFSStorageProvider } from './storage/IPFSStorageProvider';
export { Web3StorageProvider } from './storage/Web3StorageProvider';
export { ArweaveStorageProvider } from './storage/ArweaveStorageProvider';
export { FilecoinStorageProvider } from './storage/FilecoinStorageProvider';
export { StorjStorageProvider } from './storage/StorjStorageProvider';

// Export CDN providers
export { CloudflareCDNProvider } from './cdn/CloudflareCDNProvider';
export { BunnyCDNProvider } from './cdn/BunnyCDNProvider';
export { CDNManager } from './cdn/CDNManager';

// Export database providers
export { MongoDBProvider } from './database/MongoDBProvider';
export { PostgreSQLProvider } from './database/PostgreSQLProvider';
export { MySQLProvider } from './database/MySQLProvider';
export { RedisProvider } from './database/RedisProvider';
export { CouchDBProvider } from './database/CouchDBProvider';

// Export framework integrations
// React integration
// export * from './frameworks/ReactIntegration';

// NestJS integration
export { 
  StorageSdkModule, 
  StorageService, 
  StorageController, 
  UploadContent, 
  RetrieveContent, 
  DeleteContent,
  ContentFile,
  ContentId,
  ContentOptions
} from './frameworks/NestJSModule';

// Export utilities
export { EncryptionManager } from './encryption/EncryptionManager';
export { AlgorithmManager } from './algorithms/AlgorithmManager';
export { AnalyticsCollector } from './analytics/AnalyticsCollector';
export { ContentRecommendationEngine } from './algorithms/ContentRecommendationEngine';

// Export error handling utilities
export { 
  SDKError, 
  SDKErrorCode, 
  retryWithBackoff,
  createStorageProviderError,
  createDatabaseError,
  createNetworkError,
  createCDNError,
  createAlgorithmError,
  createEncryptionError,
  isErrorOfType,
  stringifyError,
  logError
} from './utils/ErrorHandler';

// Export security utilities
export { SecurityManager, SecurityLevel } from './utils/SecurityManager';

// Export version manager
export { VersionManager } from './utils/VersionManager';

// Export cache manager
export { CacheManager } from './utils/CacheManager';

// Other exports can be added here as needed. 
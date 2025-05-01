import {
  SDKConfig,
  StorageProviderType,
  StorageProvider,
  ContentToUpload,
  StorageResult,
  RetrievedContent,
  ContentMetadata,
  StorageListing,
  SDKErrorType,
  AnalyticsEventType,
  AnalyticsEvent,
  CDNProvider,
  DatabaseProvider,
  FrameworkType,
  CDNProviderType
} from './types';

import { IPFSStorageProvider } from '../storage/IPFSStorageProvider';
import { Web3StorageProvider } from '../storage/Web3StorageProvider';
import { ArweaveStorageProvider } from '../storage/ArweaveStorageProvider';
import { CDNManager } from '../cdn/CDNManager';
import { CloudflareCDNProvider } from '../cdn/CloudflareCDNProvider';
import { EncryptionManager } from '../encryption/EncryptionManager';
import { AnalyticsCollector } from '../analytics/AnalyticsCollector';
import { VersionManager } from '../utils/VersionManager';
import { CacheManager } from '../utils/CacheManager';
import { AlgorithmManager } from '../algorithms/AlgorithmManager';
import { MongoDBManager } from '../database/MongoDBManager';
import { FrameworkManager } from '../frameworks/FrameworkManager';
import { SecurityManager, SecurityLevel } from '../utils/SecurityManager';

/**
 * Default SDK configuration
 */
const DEFAULT_CONFIG: SDKConfig = {
  storageProvider: StorageProviderType.IPFS,
  enableCDN: true,
  enableEncryption: false,
  enableAnalytics: true,
  cdnConfig: {
    enableGeoDistribution: true,
    enableDDoSProtection: true,
    cachingStrategy: 'basic' as any,
    provider: CDNProviderType.CLOUDFLARE
  },
  cacheConfig: {
    defaultTTL: 3600, // 1 hour
    purgeOnUpdate: true
  },
  versioningConfig: {
    enabled: true,
    autoPrune: false
  },
  databaseConfig: {
    provider: DatabaseProvider.MONGODB,
    connection: {
      endpoint: 'mongodb://localhost:27017'
    },
    metadataCollection: 'storage_metadata'
  },
  algorithmsConfig: {
    compression: {
      algorithm: 'gzip',
      level: 6
    },
    deduplication: {
      enabled: true
    },
    contentRecommendation: {
      enabled: true
    }
  },
  frameworkConfig: {
    frameworkType: FrameworkType.NONE,
    autoBind: false
  },
  securityConfig: {
    level: SecurityLevel.MEDIUM,
    enableRequestSigning: false,
    enableRateLimiting: true,
    validatePaths: true,
    requireTLS: true,
    sanitizeInput: true
  }
};

/**
 * Main SDK class for interacting with decentralized storage and CDN
 */
export class DecentralizedStorageSDK {
  private config: SDKConfig;
  private storageProvider: StorageProvider;
  private cdnManager: CDNManager | null = null;
  private encryptionManager: EncryptionManager | null = null;
  private analyticsCollector: AnalyticsCollector | null = null;
  private versionManager: VersionManager | null = null;
  private cacheManager: CacheManager | null = null;
  private databaseManager: any = null;
  private algorithmManager: AlgorithmManager | null = null;
  private frameworkManager: FrameworkManager | null = null;
  private securityManager: SecurityManager | null = null;

  /**
   * Creates a new instance of the DecentralizedStorageSDK
   * @param config Configuration options for the SDK
   */
  constructor(config: Partial<SDKConfig> = {}) {
    // Merge provided config with default config
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize security manager first for validation
    this.securityManager = new SecurityManager(this.config.securityConfig);

    // Validate API key if provided
    if (this.config.apiKey && this.securityManager) {
      if (!this.securityManager.validateApiKey(this.config.apiKey)) {
        throw new Error('Invalid API key format or length');
      }
    }

    // Initialize storage provider
    this.storageProvider = this.initializeStorageProvider();

    // Initialize database if configured
    if (this.config.databaseConfig) {
      this.databaseManager = this.initializeDatabaseManager();
    }

    // Initialize CDN if enabled
    if (this.config.enableCDN) {
      this.cdnManager = new CDNManager(this.config.cdnConfig);
    }

    // Initialize encryption if enabled
    if (this.config.enableEncryption) {
      this.encryptionManager = new EncryptionManager(this.config.encryptionConfig);
    }

    // Initialize analytics if enabled
    if (this.config.enableAnalytics) {
      this.analyticsCollector = new AnalyticsCollector();
    }

    // Initialize versioning if enabled
    if (this.config.versioningConfig?.enabled) {
      this.versionManager = new VersionManager(this.config.versioningConfig);
    }

    // Initialize caching if configured
    if (this.config.cacheConfig) {
      this.cacheManager = new CacheManager(this.config.cacheConfig);
    }

    // Initialize algorithm manager if configured
    if (this.config.algorithmsConfig) {
      this.algorithmManager = new AlgorithmManager(this.config.algorithmsConfig);
    }

    // Initialize framework manager if configured and auto-bind is enabled
    if (this.config.frameworkConfig && this.config.frameworkConfig.autoBind) {
      this.frameworkManager = new FrameworkManager(this.config.frameworkConfig);
      this.frameworkManager.bind(this);
    }
  }

  /**
   * Initialize the appropriate storage provider based on configuration
   */
  private initializeStorageProvider(): StorageProvider {
    switch (this.config.storageProvider) {
      case StorageProviderType.IPFS:
        return new IPFSStorageProvider(this.config.apiKey);
      case StorageProviderType.WEB3_STORAGE:
        return new Web3StorageProvider(this.config.apiKey);
      case StorageProviderType.ARWEAVE:
        return new ArweaveStorageProvider(this.config.apiKey);
      case StorageProviderType.STORJ:
        // Import dynamically to avoid circular dependencies
        const { StorjStorageProvider } = require('../storage/StorjStorageProvider');
        return new StorjStorageProvider({
          accessKey: this.config.apiKey,
          secretKey: this.config.storageProviderOptions?.secretKey,
          bucketName: this.config.storageProviderOptions?.bucketName || 'decentralized-storage',
          maxRetries: this.config.storageProviderOptions?.maxRetries || 3
        });
      case StorageProviderType.PINATA:
        // Import dynamically to avoid circular dependencies
        const { PinataStorageProvider } = require('../storage/PinataStorageProvider');
        return new PinataStorageProvider(this.config.apiKey, this.config.storageProviderOptions);
      case StorageProviderType.SWARM:
        // Import dynamically to avoid circular dependencies
        const { SwarmStorageProvider } = require('../storage/SwarmStorageProvider');
        return new SwarmStorageProvider(this.config.apiKey, this.config.storageProviderOptions);
      case StorageProviderType.FLEEK:
        // Import dynamically to avoid circular dependencies
        const { FleekStorageProvider } = require('../storage/FleekStorageProvider');
        return new FleekStorageProvider(this.config.apiKey, this.config.storageProviderOptions);
      case StorageProviderType.SIA:
        // Import dynamically to avoid circular dependencies
        const { SiaStorageProvider } = require('../storage/SiaStorageProvider');
        return new SiaStorageProvider(this.config.apiKey, this.config.storageProviderOptions);
      case StorageProviderType.S3:
        // Import dynamically to avoid circular dependencies
        const { S3StorageProvider } = require('../storage/S3StorageProvider');
        return new S3StorageProvider(this.config.storageProviderOptions);
      case StorageProviderType.FIREBASE:
        // Import dynamically to avoid circular dependencies
        const { FirebaseStorageProvider } = require('../storage/FirebaseStorageProvider');
        return new FirebaseStorageProvider(this.config.storageProviderOptions);
      case StorageProviderType.FILECOIN:
        // Import dynamically to avoid circular dependencies
        const { FilecoinStorageProvider } = require('../storage/FilecoinStorageProvider');
        return new FilecoinStorageProvider(this.config.apiKey, this.config.storageProviderOptions);
      case StorageProviderType.CUSTOM:
        if (!this.config.customStorageProvider) {
          throw new Error('Custom storage provider must be provided');
        }
        return this.config.customStorageProvider;
      default:
        throw new Error(`Unsupported storage provider: ${this.config.storageProvider}`);
    }
  }

  /**
   * Initialize the appropriate database manager based on configuration
   */
  private initializeDatabaseManager(): any {
    if (!this.config.databaseConfig) {
      return null;
    }

    switch (this.config.databaseConfig.provider) {
      case DatabaseProvider.MONGODB:
        return new MongoDBManager(this.config.databaseConfig);
      case DatabaseProvider.POSTGRESQL:
        // Import dynamically to avoid circular dependencies
        const { PostgreSQLProvider } = require('../database/PostgreSQLProvider');
        
        // Configure PostgreSQL connection options
        const connectionOptions = {
          host: this.config.databaseConfig.connection.endpoint || 'localhost',
          port: this.config.databaseConfig.connection.options?.port || 5432,
          database: this.config.databaseConfig.connection.database || 'decentralized_storage',
          user: this.config.databaseConfig.connection.username || 'postgres',
          password: this.config.databaseConfig.connection.password || '',
          ssl: this.config.databaseConfig.connection.ssl || false,
          max: this.config.databaseConfig.connection.options?.maxConnections || 20
        };
        
        // Set up table names
        const tables = {
          metadata: this.config.databaseConfig.metadataCollection || 'content_metadata',
          analytics: this.config.databaseConfig.analyticsCollection || 'analytics_events',
          versions: 'content_versions',
          users: this.config.databaseConfig.usersCollection || 'users'
        };
        
        return new PostgreSQLProvider(connectionOptions, tables);
      case DatabaseProvider.MYSQL:
        // Import dynamically to avoid circular dependencies
        const { MySQLProvider } = require('../database/MySQLProvider');
        
        // Configure MySQL connection options
        const mysqlOptions = {
          host: this.config.databaseConfig.connection.endpoint || 'localhost',
          port: this.config.databaseConfig.connection.options?.port || 3306,
          database: this.config.databaseConfig.connection.database || 'decentralized_storage',
          user: this.config.databaseConfig.connection.username || 'root',
          password: this.config.databaseConfig.connection.password || '',
          ssl: this.config.databaseConfig.connection.ssl || false,
          connectionLimit: this.config.databaseConfig.connection.options?.maxConnections || 10
        };
        
        // Set up table names
        const mysqlTables = {
          metadata: this.config.databaseConfig.metadataCollection || 'content_metadata',
          analytics: this.config.databaseConfig.analyticsCollection || 'analytics_events',
          versions: 'content_versions',
          users: this.config.databaseConfig.usersCollection || 'users'
        };
        
        return new MySQLProvider(mysqlOptions, mysqlTables);
      case DatabaseProvider.REDIS:
        // Import dynamically to avoid circular dependencies
        const { RedisProvider } = require('../database/RedisProvider');
        
        // Configure Redis connection options
        const redisOptions = {
          url: this.config.databaseConfig.connection.endpoint || 'redis://localhost:6379',
          username: this.config.databaseConfig.connection.username,
          password: this.config.databaseConfig.connection.password,
          database: this.config.databaseConfig.connection.options?.database || 0
        };
        
        // Set up key prefixes
        const keyPrefixes = {
          metadata: `${this.config.databaseConfig.metadataCollection || 'metadata'}:`,
          analytics: `${this.config.databaseConfig.analyticsCollection || 'analytics'}:`,
          versions: 'versions:',
          users: `${this.config.databaseConfig.usersCollection || 'users'}:`
        };
        
        return new RedisProvider(redisOptions, keyPrefixes);
      case DatabaseProvider.COUCHDB:
        // Import dynamically to avoid circular dependencies
        const { CouchDBProvider } = require('../database/CouchDBProvider');
        
        // Configure CouchDB connection options
        const couchDBConfig = {
          url: this.config.databaseConfig.connection.endpoint || 'http://localhost:5984',
          username: this.config.databaseConfig.connection.username || 'admin',
          password: this.config.databaseConfig.connection.password || 'password',
          metadataDatabase: this.config.databaseConfig.metadataCollection || 'content_metadata',
          analyticsDatabase: this.config.databaseConfig.analyticsCollection || 'analytics_events',
          timeout: this.config.databaseConfig.connection.options?.timeout || 10000,
          maxRetries: this.config.databaseConfig.connection.options?.maxRetries || 3
        };
        
        return new CouchDBProvider(couchDBConfig);
      case DatabaseProvider.MARIADB:
        // Import dynamically to avoid circular dependencies
        const { MariaDBProvider } = require('../database/MariaDBProvider');
        
        // Configure MariaDB connection options
        const mariaDBOptions = {
          host: this.config.databaseConfig.connection.endpoint || 'localhost',
          port: this.config.databaseConfig.connection.options?.port || 3306,
          database: this.config.databaseConfig.connection.database || 'decentralized_storage',
          user: this.config.databaseConfig.connection.username || 'root',
          password: this.config.databaseConfig.connection.password || '',
          ssl: this.config.databaseConfig.connection.ssl || false,
          connectionLimit: this.config.databaseConfig.connection.options?.maxConnections || 10
        };
        
        // Set up table names
        const mariaDBTables = {
          metadata: this.config.databaseConfig.metadataCollection || 'content_metadata',
          analytics: this.config.databaseConfig.analyticsCollection || 'analytics_events',
          versions: 'content_versions',
          users: this.config.databaseConfig.usersCollection || 'users'
        };
        
        return new MariaDBProvider(mariaDBOptions, mariaDBTables);
      case DatabaseProvider.FIRESTORE:
        // Import dynamically to avoid circular dependencies
        const { FirestoreProvider } = require('../database/FirestoreProvider');
        
        // Configure Firestore connection options
        const firestoreOptions = {
          projectId: this.config.databaseConfig.connection.options?.projectId,
          credential: this.config.databaseConfig.connection.options?.credential,
          databaseURL: this.config.databaseConfig.connection.endpoint,
          collections: {
            metadata: this.config.databaseConfig.metadataCollection || 'content_metadata',
            analytics: this.config.databaseConfig.analyticsCollection || 'analytics_events',
            versions: 'content_versions',
            users: this.config.databaseConfig.usersCollection || 'users'
          }
        };
        
        return new FirestoreProvider(firestoreOptions);
      case DatabaseProvider.DYNAMODB:
        // Import dynamically to avoid circular dependencies
        const { DynamoDBProvider } = require('../database/DynamoDBProvider');
        
        // Configure DynamoDB connection options
        const dynamoDBOptions = {
          region: this.config.databaseConfig.connection.options?.region || 'us-east-1',
          accessKeyId: this.config.databaseConfig.connection.username,
          secretAccessKey: this.config.databaseConfig.connection.password,
          endpoint: this.config.databaseConfig.connection.endpoint,
          tables: {
            metadata: this.config.databaseConfig.metadataCollection || 'content_metadata',
            analytics: this.config.databaseConfig.analyticsCollection || 'analytics_events',
            versions: 'content_versions',
            users: this.config.databaseConfig.usersCollection || 'users'
          }
        };
        
        return new DynamoDBProvider(dynamoDBOptions);
      case DatabaseProvider.SQLITE:
        // Import dynamically to avoid circular dependencies
        const { SQLiteProvider } = require('../database/SQLiteProvider');
        
        // Configure SQLite connection options
        const sqliteOptions = {
          filename: this.config.databaseConfig.connection.options?.filename || ':memory:',
          tables: {
            metadata: this.config.databaseConfig.metadataCollection || 'content_metadata',
            analytics: this.config.databaseConfig.analyticsCollection || 'analytics_events',
            versions: 'content_versions',
            users: this.config.databaseConfig.usersCollection || 'users'
          }
        };
        
        return new SQLiteProvider(sqliteOptions);
      case DatabaseProvider.CUSTOM:
        if (!this.config.databaseConfig.customProvider) {
          throw new Error('Custom database provider must be provided when provider type is CUSTOM');
        }
        return this.config.databaseConfig.customProvider;
      default:
        console.warn(`Unsupported database provider: ${this.config.databaseConfig.provider}. Using no database.`);
        return null;
    }
  }

  /**
   * Uploads content to decentralized storage
   * @param content The content to upload
   * @returns Promise resolving to storage result
   */
  public async uploadContent(content: ContentToUpload): Promise<StorageResult> {
    try {
      // Track start time for analytics
      const startTime = Date.now();

      // Apply rate limiting if enabled
      if (this.securityManager) {
        const clientId = this.config.apiKey || 'anonymous';
        const isAllowed = this.securityManager.checkRateLimit(clientId);
        if (!isAllowed) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }

        // Sanitize input data for security
        if (this.config.securityConfig?.sanitizeInput) {
          if (content.metadata) {
            content.metadata = this.securityManager.sanitizeInput(content.metadata);
          }
          if (content.filename) {
            content.filename = this.securityManager.sanitizeInput(content.filename) as string;
          }
          if (content.path) {
            content.path = this.securityManager.validatePath(content.path);
          }
        }
      }

      // Preprocess content with algorithms if enabled
      let processedContent = { ...content };
      if (this.algorithmManager) {
        // Apply deduplication if enabled
        if (this.config.algorithmsConfig?.deduplication?.enabled) {
          const isDuplicate = await this.algorithmManager.checkForDuplicates(content.data);
          if (isDuplicate.found && isDuplicate.contentId) {
            console.log(`Found duplicate content, reusing existing content ID: ${isDuplicate.contentId}`);
            const metadata = await this.storageProvider.getContentMetadata(isDuplicate.contentId);
            return {
              contentId: isDuplicate.contentId,
              publicUrl: isDuplicate.publicUrl || '',
              cdnUrl: isDuplicate.cdnUrl,
              size: metadata.size,
              encrypted: metadata.encrypted,
              timestamp: new Date(),
              providerDetails: {
                duplicate: true,
                originalContentId: isDuplicate.contentId
              }
            };
          }
        }

        // Apply compression if configured
        if (this.config.algorithmsConfig?.compression) {
          const contentData = typeof content.data === 'string' ? Buffer.from(content.data) : content.data;
          const compressedData = await this.algorithmManager.compressData(contentData);
          processedContent.data = compressedData;
          processedContent.metadata = {
            ...processedContent.metadata,
            compressed: true,
            originalSize: contentData.length,
            compressionAlgorithm: this.config.algorithmsConfig.compression.algorithm
          };
        }
      }

      // Apply encryption if enabled
      if (this.config.enableEncryption && this.encryptionManager) {
        const contentData = typeof processedContent.data === 'string' ? 
          Buffer.from(processedContent.data) : 
          processedContent.data;
        const encryptedData = await this.encryptionManager.encrypt(contentData);
        processedContent.data = encryptedData;
      }

      // Generate content integrity hash
      if (this.encryptionManager) {
        const contentData = typeof processedContent.data === 'string' ? 
          Buffer.from(processedContent.data) : 
          processedContent.data;
        const hash = this.encryptionManager.generateHash(contentData);
        processedContent.metadata = {
          ...processedContent.metadata,
          integrityHash: hash
        };
      }

      // Upload to storage provider
      const result = await this.storageProvider.uploadContent(processedContent);

      // Store metadata in database if enabled
      if (this.databaseManager) {
        await this.databaseManager.storeMetadata(result);
      }

      // Add to CDN if enabled
      if (this.config.enableCDN && this.cdnManager) {
        let cdnUrl: string;
        
        // Verify TLS configuration if security requires it
        if (this.securityManager && this.config.securityConfig?.requireTLS) {
          const secureUrl = this.securityManager.validateTLS(result.publicUrl);
          cdnUrl = await this.cdnManager.addToCDN(result.contentId, secureUrl);
        } else {
          cdnUrl = await this.cdnManager.addToCDN(result.contentId, result.publicUrl);
        }
        
        result.cdnUrl = cdnUrl;
      }

      // Add to version control if enabled
      if (this.versionManager) {
        await this.versionManager.registerVersion(result.contentId, {
          created: new Date(),
          timestamp: result.timestamp,
          size: result.size
        });
      }

      // Log analytics event
      if (this.analyticsCollector) {
        const analyticsEvent: AnalyticsEvent = {
          type: AnalyticsEventType.UPLOAD,
          timestamp: new Date(),
          contentId: result.contentId,
          bytesTransferred: result.size,
          responseTime: Date.now() - startTime,
          properties: {
            mimeType: content.mimeType,
            encrypted: result.encrypted,
            compressed: processedContent.metadata?.compressed || false
          }
        };
        this.analyticsCollector.recordEvent(analyticsEvent);

        // Store analytics in database if configured
        if (this.databaseManager && this.config.databaseConfig?.analyticsCollection) {
          await this.databaseManager.storeAnalyticsEvent(analyticsEvent);
        }
      }

      // Store content hash in algorithm manager for future deduplication
      if (this.algorithmManager && 
          this.config.algorithmsConfig?.deduplication?.enabled) {
        try {
          this.algorithmManager.registerContentHash(
            result.contentId,
            processedContent.data,
            result.publicUrl,
            result.cdnUrl
          );
        } catch (registerError) {
          console.warn('Failed to register content hash:', registerError);
        }
      }

      return result;
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error uploading content', error);
      throw error;
    }
  }

  /**
   * Retrieves content from decentralized storage
   * @param contentId The ID of the content to retrieve
   * @returns Promise resolving to the retrieved content
   */
  public async retrieveContent(contentId: string): Promise<RetrievedContent> {
    try {
      // Track start time for analytics
      const startTime = Date.now();

      // Apply rate limiting if enabled
      if (this.securityManager) {
        const clientId = this.config.apiKey || 'anonymous';
        const isAllowed = this.securityManager.checkRateLimit(clientId);
        if (!isAllowed) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        // Sanitize input
        contentId = this.securityManager.sanitizeInput(contentId) as string;
      }

      // Check database for metadata first if enabled
      let metadata: ContentMetadata | null = null;
      if (this.databaseManager) {
        metadata = await this.databaseManager.getMetadata(contentId);
      }

      // Check cache first if enabled
      let content: RetrievedContent | null = null;
      if (this.cacheManager) {
        content = await this.cacheManager.getFromCache(contentId);
        
        // Log cache hit analytics
        if (content && this.analyticsCollector) {
          this.analyticsCollector.recordEvent({
            type: AnalyticsEventType.CACHE_HIT,
            timestamp: new Date(),
            contentId,
            responseTime: Date.now() - startTime
          });
        }
      }

      // If not in cache, retrieve from storage
      if (!content) {
        // Try to get from CDN first if enabled
        if (this.config.enableCDN && this.cdnManager) {
          try {
            content = await this.cdnManager.retrieveFromCDN(contentId);
          } catch (error) {
            // Fall back to direct storage if CDN retrieval fails
            content = await this.storageProvider.retrieveContent(contentId);
          }
        } else {
          // Retrieve directly from storage provider
          content = await this.storageProvider.retrieveContent(contentId);
        }

        // If we have metadata from database, use it
        if (metadata && content) {
          content.metadata = metadata;
        }

        // Log cache miss analytics
        if (this.analyticsCollector) {
          this.analyticsCollector.recordEvent({
            type: AnalyticsEventType.CACHE_MISS,
            timestamp: new Date(),
            contentId,
            responseTime: Date.now() - startTime
          });
        }

        // Add to cache if enabled
        if (this.cacheManager) {
          await this.cacheManager.addToCache(contentId, content);
        }
      }

      // Ensure content is not null before accessing metadata
      if (content) {
        // If we have metadata from database, use it
        if (metadata) {
          content.metadata = metadata;
        }

        // Verify integrity if hash exists
        if (this.encryptionManager && content.metadata.customMetadata?.integrityHash) {
          const isValid = this.encryptionManager.verifyIntegrity(
            content.data, 
            content.metadata.customMetadata.integrityHash
          );
          
          if (!isValid) {
            throw new Error('Content integrity verification failed. The content may have been tampered with.');
          }
        }

        // Decrypt if the content is encrypted and encryption is enabled
        if (content.metadata.encrypted && this.encryptionManager) {
          const decryptedData = await this.encryptionManager.decrypt(content.data);
          content.data = decryptedData;
        }

        // Decompress if the content was compressed
        if (content.metadata.customMetadata?.compressed && this.algorithmManager) {
          const decompressedData = await this.algorithmManager.decompressData(
            content.data, 
            content.metadata.customMetadata.compressionAlgorithm || 'gzip'
          );
          content.data = decompressedData;
        }

        // Log download analytics
        if (this.analyticsCollector) {
          const downloadEvent: AnalyticsEvent = {
            type: AnalyticsEventType.DOWNLOAD,
            timestamp: new Date(),
            contentId,
            bytesTransferred: content.data.length,
            responseTime: Date.now() - startTime
          };
          
          this.analyticsCollector.recordEvent(downloadEvent);
          
          // Store analytics in database if configured
          if (this.databaseManager && this.config.databaseConfig?.analyticsCollection) {
            await this.databaseManager.storeAnalyticsEvent(downloadEvent);
          }
        }
      }

      // Return content with null check
      return content || {
        data: Buffer.from([]),
        metadata: {
          contentId: '',
          mimeType: 'application/octet-stream',
          size: 0,
          created: new Date(),
          updated: new Date(),
          encrypted: false,
          hash: ''
        }
      };
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error retrieving content', error);
      throw error;
    }
  }

  /**
   * Deletes content from decentralized storage
   * @param contentId The ID of the content to delete
   * @returns Promise resolving to a boolean indicating success
   */
  public async deleteContent(contentId: string): Promise<boolean> {
    try {
      // Delete from storage provider
      const result = await this.storageProvider.deleteContent(contentId);

      // Remove from CDN if enabled
      if (this.config.enableCDN && this.cdnManager) {
        await this.cdnManager.removeFromCDN(contentId);
      }

      // Remove from cache if enabled
      if (this.cacheManager) {
        await this.cacheManager.removeFromCache(contentId);
      }

      // Remove from database if enabled
      if (this.databaseManager) {
        await this.databaseManager.deleteMetadata(contentId);
      }

      // Remove from version control if enabled
      if (this.versionManager) {
        await this.versionManager.deleteAllVersions(contentId);
      }

      return result;
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error deleting content', error);
      throw error;
    }
  }

  /**
   * Lists all content stored by the user
   * @param filter Optional filter criteria
   * @param limit Maximum number of items to return
   * @param skip Number of items to skip (for pagination)
   * @returns Promise resolving to storage listing
   */
  public async listContent(filter: Record<string, any> = {}, limit: number = 100, skip: number = 0): Promise<StorageListing> {
    try {
      // If database is enabled, use it for more efficient querying
      if (this.databaseManager) {
        const items = await this.databaseManager.listMetadata(filter, limit, skip);
        return {
          items,
          totalItems: items.length
        };
      }

      // Otherwise fall back to storage provider's listing
      return await this.storageProvider.listContent();
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error listing content', error);
      throw error;
    }
  }

  /**
   * Gets content metadata
   * @param contentId The ID of the content
   * @returns Promise resolving to content metadata
   */
  public async getContentMetadata(contentId: string): Promise<ContentMetadata> {
    try {
      // Check database first if enabled
      if (this.databaseManager) {
        const metadata = await this.databaseManager.getMetadata(contentId);
        if (metadata) {
          return metadata;
        }
      }

      // Fall back to storage provider
      return await this.storageProvider.getContentMetadata(contentId);
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error getting content metadata', error);
      throw error;
    }
  }

  /**
   * Updates existing content in storage
   * @param contentId The ID of the content to update
   * @param content New content data and metadata
   * @returns Promise resolving to storage result
   */
  public async updateContent(contentId: string, content: ContentToUpload): Promise<StorageResult> {
    try {
      // Check if content exists
      try {
        await this.getContentMetadata(contentId);
      } catch (error) {
        throw new Error(`Content not found with ID: ${contentId}`);
      }

      // If versioning is enabled, store the current version before updating
      if (this.versionManager) {
        // Get current content
        const currentContent = await this.retrieveContent(contentId);
        
        // Register the current version
        await this.versionManager.registerVersion(contentId, {
          created: currentContent.metadata.created,
          timestamp: new Date(),
          size: currentContent.metadata.size,
          metadata: {
            filename: currentContent.metadata.filename,
            mimeType: currentContent.metadata.mimeType
          }
        });
      }

      // Delete the existing content from CDN and cache (but not from storage yet)
      if (this.config.enableCDN && this.cdnManager) {
        await this.cdnManager.removeFromCDN(contentId);
      }
      
      if (this.cacheManager) {
        await this.cacheManager.removeFromCache(contentId);
      }

      // Upload new content (potentially with a new content ID)
      const result = await this.uploadContent(content);
      
      // If the new content has a different ID and database is available,
      // update references to point to the new content
      if (result.contentId !== contentId && this.databaseManager) {
        // Update metadata references
        await this.databaseManager.updateContentReference(contentId, result.contentId);
      }
      
      return result;
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error updating content', error);
      throw error;
    }
  }

  /**
   * Gets content versions if versioning is enabled
   * @param contentId The ID of the content
   * @returns Promise resolving to version history
   */
  public async getContentVersions(contentId: string): Promise<any[]> {
    if (!this.versionManager) {
      throw new Error('Versioning is not enabled in this SDK instance');
    }

    try {
      return await this.versionManager.getVersionHistory(contentId);
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error getting content versions', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific version of content
   * @param contentId The ID of the content
   * @param versionId The version ID to retrieve
   * @returns Promise resolving to the retrieved content
   */
  public async retrieveVersion(contentId: string, versionId: string): Promise<RetrievedContent> {
    if (!this.versionManager) {
      throw new Error('Versioning is not enabled in this SDK instance');
    }

    try {
      // Get the version-specific content ID from the version manager
      const versionContentId = await this.versionManager.getVersionContentId(contentId, versionId);
      
      // Retrieve the specific version
      return await this.retrieveContent(versionContentId);
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error retrieving content version', error);
      throw error;
    }
  }

  /**
   * Gets analytics data if analytics are enabled
   * @param filters Optional filters for the analytics
   * @returns Promise resolving to analytics data
   */
  public async getAnalytics(filters?: any): Promise<any> {
    if (!this.analyticsCollector) {
      throw new Error('Analytics are not enabled in this SDK instance');
    }

    try {
      // If database is enabled, use it for more powerful analytics
      if (this.databaseManager && this.config.databaseConfig?.analyticsCollection) {
        return await this.databaseManager.getAnalyticsEvents(filters);
      }

      // Fall back to in-memory analytics
      return await this.analyticsCollector.getAnalytics(filters);
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error getting analytics', error);
      throw error;
    }
  }

  /**
   * Get analytics aggregations and statistics
   * @param pipeline Aggregation pipeline to run (for MongoDB)
   * @returns Promise resolving to analytics aggregation results
   */
  public async getAnalyticsAggregations(pipeline: any[]): Promise<any> {
    if (!this.databaseManager || !this.config.databaseConfig?.analyticsCollection) {
      throw new Error('Database with analytics collection is required for aggregations');
    }

    try {
      return await this.databaseManager.aggregate(pipeline);
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error running analytics aggregations', error);
      throw error;
    }
  }

  /**
   * Purges content from the CDN
   * @param contentId The ID of the content to purge
   * @returns Promise resolving to a boolean indicating success
   */
  public async purgeCDNCache(contentId: string): Promise<boolean> {
    if (!this.config.enableCDN || !this.cdnManager) {
      throw new Error('CDN is not enabled in this SDK instance');
    }

    try {
      return await this.cdnManager.purgeCache(contentId);
    } catch (error) {
      this.handleError(SDKErrorType.CDN, 'Error purging CDN cache', error);
      throw error;
    }
  }

  /**
   * Gets storage statistics
   * @returns Promise resolving to storage statistics
   */
  public async getStorageStats(): Promise<any> {
    try {
      if (this.databaseManager) {
        return await this.databaseManager.getStorageStats();
      }

      throw new Error('Database is required for storage statistics');
    } catch (error) {
      this.handleError(SDKErrorType.STORAGE, 'Error getting storage statistics', error);
      throw error;
    }
  }

  /**
   * Gets CDN status and statistics
   * @returns Promise resolving to CDN status
   */
  public async getCDNStatus(): Promise<any> {
    if (!this.config.enableCDN || !this.cdnManager) {
      throw new Error('CDN is not enabled in this SDK instance');
    }

    try {
      return this.cdnManager.getCDNStatus();
    } catch (error) {
      this.handleError(SDKErrorType.CDN, 'Error getting CDN status', error);
      throw error;
    }
  }

  /**
   * Initializes framework bindings
   * @param framework Optional framework reference
   * @returns Framework-specific bindings
   */
  public initializeFramework(framework?: any): any {
    if (!this.config.frameworkConfig) {
      throw new Error('Framework configuration is required');
    }

    try {
      this.frameworkManager = new FrameworkManager(this.config.frameworkConfig);
      return this.frameworkManager.bind(this, framework);
    } catch (error) {
      this.handleError(SDKErrorType.UNKNOWN, 'Error initializing framework bindings', error);
      throw error;
    }
  }

  /**
   * Handles errors in the SDK
   * @param type The type of error
   * @param message Error message
   * @param error Original error object
   */
  private handleError(type: SDKErrorType, message: string, error: any): void {
    // Log error to analytics if enabled
    if (this.analyticsCollector) {
      const analyticsEvent: AnalyticsEvent = {
        type: AnalyticsEventType.ERROR,
        timestamp: new Date(),
        properties: {
          errorType: type,
          message,
          originalError: error.message || String(error)
        }
      };
      
      this.analyticsCollector.recordEvent(analyticsEvent);

      // Store error in database if configured
      if (this.databaseManager && this.config.databaseConfig?.analyticsCollection) {
        this.databaseManager.storeAnalyticsEvent(analyticsEvent).catch((dbError: any) => {
          console.error('Failed to store error in database:', dbError);
        });
      }
    }

    // Add additional context to the error
    if (error instanceof Error) {
      error.message = `${message}: ${error.message}`;
    }
  }

  /**
   * Initialize the SDK
   * Sets up all components and makes sure everything is ready to use
   * @returns Promise resolving when initialization is complete
   */
  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Decentralized Storage SDK...');
      
      // Initialize storage provider if needed
      if (typeof (this.storageProvider as any).initialize === 'function') {
        await (this.storageProvider as any).initialize();
      }
      
      // Initialize CDN provider if needed
      if (this.cdnManager && typeof (this.cdnManager as any).initialize === 'function') {
        await (this.cdnManager as any).initialize();
      }
      
      // Initialize database manager
      if (this.databaseManager) {
        await this.databaseManager.connect();
      }
      
      console.log('SDK initialized successfully');
    } catch (error) {
      console.error('Error initializing SDK:', error);
      this.handleError(SDKErrorType.UNKNOWN, 'Error initializing SDK', error);
      throw error;
    }
  }

  /**
   * Close all SDK connections
   * Clean up resources used by the SDK
   * @returns Promise resolving when cleanup is complete
   */
  public async close(): Promise<void> {
    try {
      console.log('Closing Decentralized Storage SDK...');
      
      // Close database connection
      if (this.databaseManager) {
        await this.databaseManager.disconnect();
      }
      
      // Close storage provider if needed
      if (typeof (this.storageProvider as any).close === 'function') {
        await (this.storageProvider as any).close();
      }
      
      // Close CDN provider if needed
      if (this.cdnManager && typeof (this.cdnManager as any).close === 'function') {
        await (this.cdnManager as any).close();
      }
      
      console.log('SDK closed successfully');
    } catch (error) {
      console.error('Error closing SDK:', error);
      this.handleError(SDKErrorType.UNKNOWN, 'Error closing SDK', error);
    }
  }

  /**
   * Record a user viewing content to improve recommendations
   * @param userId User ID
   * @param contentId Content ID
   * @param metadata Additional interaction metadata
   */
  public recordContentView(
    userId: string,
    contentId: string,
    metadata?: {
      viewDuration?: number;
      completionPercentage?: number;
      rating?: number;
    }
  ): void {
    if (!this.algorithmManager) {
      console.warn('Algorithm manager not enabled, cannot record content view');
      return;
    }

    try {
      this.algorithmManager.recordContentView(userId, contentId, metadata);
    } catch (error) {
      this.handleError(SDKErrorType.ALGORITHM_ERROR, 'Error recording content view', error);
    }
  }

  /**
   * Get personalized content recommendations for a user
   * @param userId User ID to get recommendations for
   * @param currentContentId Current content ID (to exclude)
   * @param limit Maximum number of recommendations to return
   * @returns Array of recommended content with relevancy scores
   */
  public async getContentRecommendations(
    userId: string,
    currentContentId?: string,
    limit: number = 5
  ): Promise<Array<{ contentId: string; score: number; reason: string }>> {
    if (!this.algorithmManager) {
      throw new Error('Content recommendation is not enabled in this SDK instance');
    }

    try {
      const recommendations = this.algorithmManager.getContentRecommendations(
        userId,
        currentContentId,
        limit
      );
      
      // If we have a database, fetch full metadata for the recommendations
      if (this.databaseManager) {
        for (const recommendation of recommendations) {
          try {
            const metadata = await this.databaseManager.getMetadata(recommendation.contentId);
            if (metadata) {
              // Add metadata to the recommendation for display
              (recommendation as any).metadata = metadata;
            }
          } catch (error) {
            console.warn(`Failed to fetch metadata for ${recommendation.contentId}:`, error);
          }
        }
      }
      
      return recommendations;
    } catch (error) {
      this.handleError(SDKErrorType.ALGORITHM_ERROR, 'Error getting content recommendations', error);
      throw error;
    }
  }

  /**
   * Get recommendation system statistics
   * @returns Statistics about the recommendation system
   */
  public getRecommendationStats(): Record<string, any> | null {
    if (!this.algorithmManager) {
      return null;
    }

    try {
      return this.algorithmManager.getRecommendationStats();
    } catch (error) {
      this.handleError(SDKErrorType.ALGORITHM_ERROR, 'Error getting recommendation stats', error);
      return null;
    }
  }
} 
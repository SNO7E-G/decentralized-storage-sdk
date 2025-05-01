/**
 * Core types and interfaces for the Decentralized Storage SDK
 */
import { SecurityConfig } from '../utils/SecurityManager';

/**
 * Configuration options for the SDK
 */
export interface SDKConfig {
  /** Storage provider to use (IPFS, Web3.Storage, etc.) */
  storageProvider: StorageProviderType;
  /** API key for the storage provider */
  apiKey?: string;
  /** Provider-specific options for the storage provider */
  storageProviderOptions?: Record<string, any>;
  /** Custom storage provider implementation */
  customStorageProvider?: StorageProvider;
  /** Enable/disable the CDN layer */
  enableCDN: boolean;
  /** CDN configuration settings */
  cdnConfig?: CDNConfig;
  /** Enable/disable encryption for all stored content */
  enableEncryption: boolean;
  /** Encryption settings */
  encryptionConfig?: EncryptionConfig;
  /** Enable/disable analytics collection */
  enableAnalytics: boolean;
  /** Versioning configuration */
  versioningConfig?: VersioningConfig;
  /** Cache configuration */
  cacheConfig?: CacheConfig;
  /** Database configuration for metadata storage */
  databaseConfig?: DatabaseConfig;
  /** Advanced algorithms configuration */
  algorithmsConfig?: AlgorithmsConfig;
  /** Framework specific configuration */
  frameworkConfig?: FrameworkConfig;
  /** Security configuration */
  securityConfig?: SecurityConfig;
}

/**
 * Available storage provider types
 */
export enum StorageProviderType {
  IPFS = 'ipfs',
  WEB3_STORAGE = 'web3.storage',
  ARWEAVE = 'arweave',
  FILECOIN = 'filecoin',
  STORJ = 'storj',
  SWARM = 'swarm',
  PINATA = 'pinata',
  FLEEK = 'fleek',
  SIA = 'sia',
  CERAMIC = 'ceramic',
  S3 = 's3',
  FIREBASE = 'firebase',
  CUSTOM = 'custom'
}

/**
 * Interface that all storage providers must implement
 */
export interface StorageProvider {
  /** Upload content to the storage provider */
  uploadContent(content: ContentToUpload): Promise<StorageResult>;
  /** Retrieve content from the storage provider */
  retrieveContent(contentId: string): Promise<RetrievedContent>;
  /** Delete content from the storage provider */
  deleteContent(contentId: string): Promise<boolean>;
  /** List all content uploaded by this account */
  listContent(): Promise<StorageListing>;
  /** Get metadata about stored content */
  getContentMetadata(contentId: string): Promise<ContentMetadata>;
}

/**
 * Content to be uploaded to storage
 */
export interface ContentToUpload {
  /** Raw content data (file buffer, string, etc.) */
  data: Buffer | string;
  /** MIME type of the content */
  mimeType: string;
  /** Optional filename */
  filename?: string;
  /** Optional path/folder */
  path?: string;
  /** Optional metadata to store with the content */
  metadata?: Record<string, any>;
  /** Access control settings */
  accessControl?: AccessControl;
}

/**
 * Result of a storage operation
 */
export interface StorageResult {
  /** Unique content identifier on the storage network */
  contentId: string;
  /** Public URL for accessing the content */
  publicUrl: string;
  /** CDN-accelerated URL (if CDN is enabled) */
  cdnUrl?: string;
  /** Content size in bytes */
  size: number;
  /** Content encryption status */
  encrypted: boolean;
  /** Timestamp of when the content was uploaded */
  timestamp: Date;
  /** Storage provider specific details */
  providerDetails: Record<string, any>;
}

/**
 * Content retrieved from storage
 */
export interface RetrievedContent {
  /** The content data */
  data: Buffer;
  /** Content metadata */
  metadata: ContentMetadata;
}

/**
 * Metadata about stored content
 */
export interface ContentMetadata {
  /** Unique content identifier */
  contentId: string;
  /** MIME type of the content */
  mimeType: string;
  /** Content size in bytes */
  size: number;
  /** Original filename (if provided) */
  filename?: string;
  /** Timestamp of when the content was created */
  created: Date;
  /** Timestamp of when the content was last updated */
  updated: Date;
  /** Content encryption status */
  encrypted: boolean;
  /** Content hash (for integrity verification) */
  hash: string;
  /** Custom metadata stored with the content */
  customMetadata?: Record<string, any>;
}

/**
 * List of content from storage
 */
export interface StorageListing {
  /** Array of content items */
  items: ContentMetadata[];
  /** Pagination token for fetching more results */
  nextPageToken?: string;
  /** Total number of items (if available) */
  totalItems?: number;
}

/**
 * Access control settings for content
 */
export interface AccessControl {
  /** Visibility of content: public or private */
  visibility: 'public' | 'private' | 'restricted';
  /** List of specific users/keys that can access this content */
  allowedUsers?: string[];
  /** Time-based access control */
  timeRestrictions?: {
    /** Content not accessible before this time */
    notBefore?: Date;
    /** Content not accessible after this time */
    notAfter?: Date;
  };
  /** IP address restrictions */
  ipRestrictions?: string[];
  /** Domain/referrer restrictions */
  domainRestrictions?: string[];
}

/**
 * CDN configuration
 */
export interface CDNConfig {
  /** Enable geo-distribution of content */
  enableGeoDistribution: boolean;
  /** Enable DDoS protection */
  enableDDoSProtection: boolean;
  /** Caching strategy */
  cachingStrategy: CachingStrategy;
  /** Use custom domain for CDN */
  customDomain?: string;
  /** SSL/TLS settings for custom domain */
  sslConfig?: SSLConfig;
  /** CDN provider to use */
  provider: CDNProviderType;
  /** Provider-specific settings */
  providerSettings?: Record<string, any>;
  /** Edge computing settings */
  edgeComputing?: EdgeComputingConfig;
}

/**
 * Available CDN providers
 */
export enum CDNProviderType {
  CLOUDFLARE = 'cloudflare',
  AKAMAI = 'akamai',
  FASTLY = 'fastly',
  CLOUDFRONT = 'cloudfront',
  BUNNY = 'bunny',
  STACKPATH = 'stackpath',
  IPFS_GATEWAY = 'ipfs_gateway',
  NETLIFY = 'netlify',
  VERCEL = 'vercel',
  KEYCDN = 'keycdn',
  GCORE = 'gcore',
  CUSTOM = 'custom'
}

/**
 * Caching strategies for the CDN
 */
export enum CachingStrategy {
  /** No caching */
  NO_CACHE = 'no_cache',
  /** Basic caching with default TTL */
  BASIC = 'basic',
  /** Aggressive caching for static content */
  AGGRESSIVE = 'aggressive',
  /** Content-type specific caching rules */
  CONTENT_BASED = 'content_based',
  /** Custom caching rules */
  CUSTOM = 'custom'
}

/**
 * SSL/TLS configuration for custom domains
 */
export interface SSLConfig {
  /** Enable SSL/TLS */
  enabled: boolean;
  /** Use Let's Encrypt for certificate */
  useLetsEncrypt: boolean;
  /** Path to custom certificate file */
  certificatePath?: string;
  /** Path to private key file */
  privateKeyPath?: string;
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Encryption algorithm to use */
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'custom';
  /** Key management strategy */
  keyManagement: KeyManagementStrategy;
  /** Custom encryption handlers */
  customHandlers?: {
    encrypt: (data: Buffer, key: Buffer) => Promise<Buffer>;
    decrypt: (data: Buffer, key: Buffer) => Promise<Buffer>;
  };
}

/**
 * Key management strategies
 */
export enum KeyManagementStrategy {
  /** Client-side key management (user manages keys) */
  CLIENT_SIDE = 'client_side',
  /** Server-side key management (SDK manages keys) */
  SERVER_SIDE = 'server_side',
  /** Hybrid approach */
  HYBRID = 'hybrid',
  /** Use a third-party KMS */
  THIRD_PARTY_KMS = 'third_party_kms'
}

/**
 * Versioning configuration
 */
export interface VersioningConfig {
  /** Enable versioning */
  enabled: boolean;
  /** Maximum number of versions to keep */
  maxVersions?: number;
  /** Automatic pruning of old versions */
  autoPrune: boolean;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Default TTL for cached content in seconds */
  defaultTTL: number;
  /** Maximum cache size in bytes */
  maxSize?: number;
  /** Content type specific TTL settings */
  contentTypeTTL?: Record<string, number>;
  /** Purge cache on update */
  purgeOnUpdate: boolean;
}

/**
 * Analytics event types
 */
export enum AnalyticsEventType {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  ERROR = 'error',
  DDOS_ATTEMPT = 'ddos_attempt'
}

/**
 * Analytics event data
 */
export interface AnalyticsEvent {
  /** Type of event */
  type: AnalyticsEventType;
  /** Timestamp of when the event occurred */
  timestamp: Date;
  /** Content ID related to the event (if applicable) */
  contentId?: string;
  /** User ID related to the event (if applicable) */
  userId?: string;
  /** Geographic location of the event */
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  /** IP address related to the event */
  ipAddress?: string;
  /** User agent of the client */
  userAgent?: string;
  /** Referrer URL */
  referrer?: string;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Bytes transferred */
  bytesTransferred?: number;
  /** HTTP status code */
  statusCode?: number;
  /** Device information related to the event */
  deviceInfo?: {
    type?: string;
    os?: string;
    osVersion?: string;
    browser?: string;
    browserVersion?: string;
    model?: string;
    brand?: string;
    screenResolution?: string;
  };
  /** Additional metadata for the event */
  metadata?: Record<string, any>;
  /** Additional custom properties */
  properties?: Record<string, any>;
}

/**
 * Error types specific to the SDK
 */
export enum SDKErrorType {
  AUTHENTICATION = 'authentication_error',
  STORAGE = 'storage_error',
  CDN = 'cdn_error',
  ENCRYPTION = 'encryption_error',
  NETWORK = 'network_error',
  RATE_LIMIT = 'rate_limit_error',
  VALIDATION = 'validation_error',
  PERMISSION = 'permission_error',
  NOT_FOUND = 'not_found_error',
  UNKNOWN = 'unknown_error'
}

/**
 * Edge computing configuration for CDN
 */
export interface EdgeComputingConfig {
  /** Enable edge computing */
  enabled: boolean;
  /** JavaScript functions to run at the edge */
  functions?: Record<string, string>;
  /** Rules for when to execute edge functions */
  rules?: EdgeFunctionRule[];
}

/**
 * Rule for edge function execution
 */
export interface EdgeFunctionRule {
  /** Path pattern to match */
  pathPattern: string;
  /** Function name to execute */
  functionName: string;
  /** HTTP methods to match */
  methods?: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS')[];
}

/**
 * Database configuration for metadata storage
 */
export interface DatabaseConfig {
  /** Database provider to use */
  provider: DatabaseProvider;
  /** Connection details */
  connection: {
    /** Connection string or endpoint */
    endpoint?: string;
    /** Database name */
    database?: string;
    /** Username */
    username?: string;
    /** Password */
    password?: string;
    /** SSL options */
    ssl?: boolean;
    /** Additional connection options */
    options?: Record<string, any>;
  };
  /** Default collection or table for content metadata */
  metadataCollection: string;
  /** Collection or table for analytics data */
  analyticsCollection?: string;
  /** Collection or table for user data */
  usersCollection?: string;
  /** Enable query caching */
  enableQueryCache?: boolean;
  /** Number of connection retries */
  maxRetries?: number;
  /** Custom database provider implementation */
  customProvider?: any;
}

/**
 * Available database providers
 */
export enum DatabaseProvider {
  MONGODB = 'mongodb',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  SUPABASE = 'supabase',
  FIREBASE = 'firebase',
  FIRESTORE = 'firestore',
  DYNAMODB = 'dynamodb',
  SQLITE = 'sqlite',
  REDIS = 'redis',
  FAUNA = 'fauna',
  COSMOSDB = 'cosmosdb',
  PINECONE = 'pinecone',
  MARIADB = 'mariadb',
  ORACLE = 'oracle',
  NEO4J = 'neo4j',
  COUCHDB = 'couchdb',
  CASSANDRA = 'cassandra',
  INFLUXDB = 'influxdb',
  CUSTOM = 'custom'
}

/**
 * Algorithm configuration for advanced features
 */
export interface AlgorithmsConfig {
  /** Content recommendation algorithms */
  contentRecommendation?: {
    /** Enable recommendation engine */
    enabled?: boolean;
    /** Algorithm type */
    algorithm: 'collaborative-filtering' | 'content-based' | 'hybrid' | 'custom';
    /** Training interval in milliseconds */
    trainingInterval?: number;
    /** Maximum number of recommendations */
    maxRecommendations?: number;
  };
  /** Content compression algorithms */
  compression?: {
    /** Enable compression */
    enabled?: boolean;
    /** Algorithm to use */
    algorithm: 'gzip' | 'brotli' | 'zstd' | 'custom';
    /** Compression level (1-9) */
    level?: number;
    /** Whether to return original data if compression fails */
    failSafe?: boolean;
    /** Custom compression/decompression handlers */
    customHandlers?: {
      compress: (data: Buffer) => Promise<Buffer>;
      decompress: (data: Buffer) => Promise<Buffer>;
    };
  };
  /** Content deduplication */
  deduplication?: {
    /** Enable deduplication */
    enabled: boolean;
    /** Detect similar content */
    detectSimilarContent?: boolean;
    /** Similarity threshold (0-1) */
    similarityThreshold?: number;
    /** Chunk size for deduplication in bytes */
    chunkSize?: number;
  };
  /** Machine learning for optimizations */
  machineLearning?: {
    /** Enable machine learning */
    enabled: boolean;
    /** Model type */
    modelType?: 'regression' | 'classification' | 'custom';
    /** Custom model handlers */
    customHandlers?: {
      train: (data: any) => Promise<any>;
      predict: (input: any) => Promise<any>;
    };
  };
}

/**
 * Framework integration configuration
 */
export interface FrameworkConfig {
  /** Framework type */
  frameworkType: FrameworkType;
  /** Auto-bind to framework */
  autoBind: boolean;
  /** Framework-specific settings */
  settings?: Record<string, any>;
}

/**
 * Supported application frameworks
 */
export enum FrameworkType {
  REACT = 'react',
  REACT_NATIVE = 'react-native',
  ANGULAR = 'angular',
  VUE = 'vue',
  SVELTE = 'svelte',
  EXPRESS = 'express',
  NEXT = 'next',
  NUXT = 'nuxt',
  GATSBY = 'gatsby',
  ELECTRON = 'electron',
  FLUTTER = 'flutter',
  REMIX = 'remix',
  ASTRO = 'astro',
  SOLID = 'solid',
  LIT = 'lit',
  DENO = 'deno',
  BUN = 'bun',
  NESTJS = 'nestjs',
  LARAVEL = 'laravel',
  DJANGO = 'django',
  NONE = 'none'
}

/**
 * Version information for content
 */
export interface VersionInfo {
  /** Unique version identifier */
  versionId: string;
  /** When this version was created */
  created: Date;
  /** Timestamp when this version was created */
  timestamp: Date;
  /** Size of this version in bytes */
  size: number;
  /** Custom metadata for this version */
  metadata?: Record<string, any>;
}

/**
 * Interface that all CDN providers must implement
 */
export interface CDNProvider {
  /** Add content to CDN */
  addToCDN(contentId: string, sourceUrl: string, metadata?: any): Promise<string>;
  /** Remove content from CDN */
  removeFromCDN(contentId: string): Promise<boolean>;
  /** Purge content from CDN cache */
  purgeCache(contentId: string): Promise<boolean>;
  /** Get CDN status */
  getStatus(): Promise<any>;
} 
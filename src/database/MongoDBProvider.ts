import { MongoClient, Collection, Db, Document, ObjectId, Filter } from 'mongodb';
import { 
  AnalyticsEvent, 
  ContentMetadata, 
  VersionInfo
} from '../core/types';

/**
 * MongoDB Database Provider
 * Handles all interactions with MongoDB for metadata storage
 * 
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */
export class MongoDBProvider {
  private client: MongoClient;
  private db: Db | null = null;
  private connected: boolean = false;
  private connectionPromise: Promise<void> | null = null;
  
  // Collections
  private metadataCollection: Collection | null = null;
  private analyticsCollection: Collection | null = null;
  private versionsCollection: Collection | null = null;
  private usersCollection: Collection | null = null;
  
  /**
   * Create a MongoDB Provider
   * @param connectionString MongoDB connection string
   * @param databaseName Database name
   * @param collections Collection names configuration
   */
  constructor(
    private connectionString: string,
    private databaseName: string,
    private collections: {
      metadata: string;
      analytics?: string;
      versions?: string;
      users?: string;
    }
  ) {
    this.client = new MongoClient(connectionString, {
      // MongoDB connection options
      maxPoolSize: 10,
      minPoolSize: 1,
      retryWrites: true,
      w: 'majority'
    });
  }
  
  /**
   * Connect to MongoDB
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    this.connectionPromise = this.connectToMongoDB();
    return this.connectionPromise;
  }
  
  /**
   * Implementation of MongoDB connection
   */
  private async connectToMongoDB(): Promise<void> {
    try {
      await this.client.connect();
      
      this.db = this.client.db(this.databaseName);
      
      // Initialize collections
      this.metadataCollection = this.db.collection(this.collections.metadata);
      
      if (this.collections.analytics) {
        this.analyticsCollection = this.db.collection(this.collections.analytics);
      }
      
      if (this.collections.versions) {
        this.versionsCollection = this.db.collection(this.collections.versions);
      }
      
      if (this.collections.users) {
        this.usersCollection = this.db.collection(this.collections.users);
      }
      
      this.connected = true;
      console.log(`Connected to MongoDB database: ${this.databaseName}`);
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Close MongoDB connection
   */
  public async close(): Promise<void> {
    if (!this.connected) {
      return;
    }
    
    try {
      await this.client.close();
      this.connected = false;
      this.db = null;
      this.metadataCollection = null;
      this.analyticsCollection = null;
      this.versionsCollection = null;
      this.usersCollection = null;
      this.connectionPromise = null;
      
      console.log('MongoDB connection closed');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
      throw new Error(`Failed to close MongoDB connection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store content metadata
   * @param metadata Content metadata to store
   * @returns The stored metadata with ID
   */
  public async storeMetadata(metadata: ContentMetadata): Promise<ContentMetadata> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      // Prepare document for MongoDB
      const metadataDoc = {
        ...metadata,
        created: metadata.created.toISOString(),
        updated: metadata.updated.toISOString(),
        _id: metadata.contentId
      };
      
      // Insert or update the metadata
      const filter: Filter<Document> = { contentId: metadata.contentId };
      await this.metadataCollection.updateOne(
        filter,
        { $set: metadataDoc },
        { upsert: true }
      );
      
      return metadata;
    } catch (error) {
      console.error('Error storing metadata in MongoDB:', error);
      throw new Error(`Failed to store metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Retrieve content metadata by content ID
   * @param contentId The content ID
   * @returns The content metadata
   */
  public async getMetadata(contentId: string): Promise<ContentMetadata | null> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      const filter: Filter<Document> = { contentId: contentId };
      const doc = await this.metadataCollection.findOne(filter);
      
      if (!doc) {
        return null;
      }
      
      // Convert back to ContentMetadata
      return {
        contentId: doc.contentId,
        mimeType: doc.mimeType,
        size: doc.size,
        filename: doc.filename,
        created: new Date(doc.created),
        updated: new Date(doc.updated),
        encrypted: doc.encrypted,
        hash: doc.hash,
        customMetadata: doc.customMetadata
      };
    } catch (error) {
      console.error(`Error retrieving metadata for ${contentId} from MongoDB:`, error);
      throw new Error(`Failed to retrieve metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Delete content metadata
   * @param contentId Content ID to delete
   * @returns Boolean indicating success
   */
  public async deleteMetadata(contentId: string): Promise<boolean> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      const filter: Filter<Document> = { contentId: contentId };
      const result = await this.metadataCollection.deleteOne(filter);
      return result.deletedCount === 1;
    } catch (error) {
      console.error(`Error deleting metadata for ${contentId} from MongoDB:`, error);
      throw new Error(`Failed to delete metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * List content metadata with optional filtering
   * @param query Query parameters
   * @param limit Maximum number of results
   * @param skip Number of results to skip
   * @returns Array of content metadata
   */
  public async listMetadata(
    query: Record<string, any> = {}, 
    limit: number = 100, 
    skip: number = 0
  ): Promise<{ items: ContentMetadata[]; totalItems: number }> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      // Execute query with pagination
      const filter: Filter<Document> = query;
      const cursor = this.metadataCollection.find(filter).limit(limit).skip(skip);
      const totalItems = await this.metadataCollection.countDocuments(filter);
      const docs = await cursor.toArray();
      
      // Convert documents to ContentMetadata
      const items = docs.map(doc => ({
        contentId: doc.contentId,
        mimeType: doc.mimeType,
        size: doc.size,
        filename: doc.filename,
        created: new Date(doc.created),
        updated: new Date(doc.updated),
        encrypted: doc.encrypted,
        hash: doc.hash,
        customMetadata: doc.customMetadata
      }));
      
      return { items, totalItems };
    } catch (error) {
      console.error('Error listing metadata from MongoDB:', error);
      throw new Error(`Failed to list metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store an analytics event
   * @param event The analytics event to store
   * @returns The stored event with ID
   */
  public async storeAnalyticsEvent(event: AnalyticsEvent): Promise<string> {
    await this.ensureConnected();
    
    if (!this.analyticsCollection) {
      console.warn('Analytics collection not initialized, skipping event storage');
      return '';
    }
    
    try {
      // Prepare document for MongoDB
      const eventDoc = {
        ...event,
        timestamp: event.timestamp.toISOString()
      };
      
      const result = await this.analyticsCollection.insertOne(eventDoc);
      return result.insertedId.toString();
    } catch (error) {
      console.error('Error storing analytics event in MongoDB:', error);
      throw new Error(`Failed to store analytics event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Query analytics events
   * @param query Query parameters
   * @param limit Maximum number of results
   * @param skip Number of results to skip
   * @returns Array of analytics events
   */
  public async queryAnalytics(
    query: Record<string, any> = {}, 
    limit: number = 100, 
    skip: number = 0
  ): Promise<{ events: AnalyticsEvent[]; totalEvents: number }> {
    await this.ensureConnected();
    
    if (!this.analyticsCollection) {
      throw new Error('Analytics collection not initialized');
    }
    
    try {
      // Execute query with pagination
      const cursor = this.analyticsCollection.find(query).limit(limit).skip(skip);
      const totalEvents = await this.analyticsCollection.countDocuments(query);
      const docs = await cursor.toArray();
      
      // Convert documents to AnalyticsEvent
      const events = docs.map(doc => ({
        ...doc,
        timestamp: new Date(doc.timestamp),
        _id: undefined
      } as unknown as AnalyticsEvent));
      
      return { events, totalEvents };
    } catch (error) {
      console.error('Error querying analytics from MongoDB:', error);
      throw new Error(`Failed to query analytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store version information for content
   * @param contentId Content ID
   * @param versionInfo Version information
   * @returns The version ID
   */
  public async storeVersion(contentId: string, versionInfo: VersionInfo): Promise<string> {
    await this.ensureConnected();
    
    if (!this.versionsCollection) {
      throw new Error('Versions collection not initialized');
    }
    
    try {
      // Prepare document for MongoDB
      const versionDoc = {
        contentId,
        versionId: versionInfo.versionId,
        created: versionInfo.created.toISOString(),
        timestamp: versionInfo.timestamp.toISOString(),
        size: versionInfo.size,
        metadata: versionInfo.metadata
      };
      
      const result = await this.versionsCollection.insertOne(versionDoc);
      return result.insertedId.toString();
    } catch (error) {
      console.error(`Error storing version for ${contentId} in MongoDB:`, error);
      throw new Error(`Failed to store version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get versions for content
   * @param contentId Content ID
   * @returns Array of version information
   */
  public async getVersions(contentId: string): Promise<VersionInfo[]> {
    await this.ensureConnected();
    
    if (!this.versionsCollection) {
      throw new Error('Versions collection not initialized');
    }
    
    try {
      // Get all versions for this content ID
      const docs = await this.versionsCollection
        .find({ contentId })
        .sort({ timestamp: -1 })
        .toArray();
      
      // Convert documents to VersionInfo
      return docs.map(doc => ({
        versionId: doc.versionId,
        created: new Date(doc.created),
        timestamp: new Date(doc.timestamp),
        size: doc.size,
        metadata: doc.metadata
      }));
    } catch (error) {
      console.error(`Error getting versions for ${contentId} from MongoDB:`, error);
      throw new Error(`Failed to get versions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Ensure that we are connected to MongoDB
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }
  
  /**
   * Create indexes for better performance
   */
  public async createIndexes(): Promise<void> {
    await this.ensureConnected();
    
    try {
      // Create indexes for metadata collection
      if (this.metadataCollection) {
        await this.metadataCollection.createIndex({ mimeType: 1 });
        await this.metadataCollection.createIndex({ created: -1 });
        await this.metadataCollection.createIndex({ updated: -1 });
        await this.metadataCollection.createIndex({ 'customMetadata.tags': 1 });
      }
      
      // Create indexes for analytics collection
      if (this.analyticsCollection) {
        await this.analyticsCollection.createIndex({ type: 1 });
        await this.analyticsCollection.createIndex({ contentId: 1 });
        await this.analyticsCollection.createIndex({ timestamp: -1 });
        await this.analyticsCollection.createIndex({ 'geoLocation.country': 1 });
      }
      
      // Create indexes for versions collection
      if (this.versionsCollection) {
        await this.versionsCollection.createIndex({ contentId: 1 });
        await this.versionsCollection.createIndex({ versionId: 1 });
        await this.versionsCollection.createIndex({ timestamp: -1 });
      }
      
      console.log('Created MongoDB indexes for optimal performance');
    } catch (error) {
      console.error('Error creating MongoDB indexes:', error);
      throw new Error(`Failed to create indexes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Run an aggregation pipeline on metadata
   * @param pipeline Aggregation pipeline
   * @returns Aggregated results
   */
  public async aggregateMetadata(pipeline: Document[]): Promise<any[]> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      const cursor = this.metadataCollection.aggregate(pipeline);
      return await cursor.toArray();
    } catch (error) {
      console.error('Error running aggregation on MongoDB:', error);
      throw new Error(`Failed to run aggregation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
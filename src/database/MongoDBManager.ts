import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { DatabaseConfig, ContentMetadata, AnalyticsEvent } from '../core/types';

/**
 * MongoDB Database Manager
 * Handles storage and retrieval of metadata and analytics in MongoDB
 */
export class MongoDBManager {
  private config: DatabaseConfig;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private metadataCollection: Collection | null = null;
  private analyticsCollection: Collection | null = null;
  private usersCollection: Collection | null = null;
  private isConnected: boolean = false;
  
  /**
   * Creates a new MongoDB Database Manager
   * @param config Database configuration
   */
  constructor(config: DatabaseConfig) {
    this.config = config;
  }
  
  /**
   * Connects to the MongoDB database
   * @returns Promise resolving when connected
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }
    
    try {
      const endpoint = this.config.connection.endpoint || 'mongodb://localhost:27017';
      const options = this.config.connection.options || {};
      
      // Add authentication if provided
      if (this.config.connection.username && this.config.connection.password) {
        options.auth = {
          username: this.config.connection.username,
          password: this.config.connection.password
        };
      }
      
      // Add SSL if enabled
      if (this.config.connection.ssl) {
        options.ssl = true;
        options.sslValidate = true;
      }
      
      // Create MongoDB client
      this.client = new MongoClient(endpoint, options);
      
      // Connect to MongoDB
      await this.client.connect();
      
      // Get database
      const dbName = this.config.connection.database || 'decentralized_storage_sdk';
      this.db = this.client.db(dbName);
      
      // Initialize collections
      this.metadataCollection = this.db.collection(this.config.metadataCollection);
      
      if (this.config.analyticsCollection) {
        this.analyticsCollection = this.db.collection(this.config.analyticsCollection);
      }
      
      if (this.config.usersCollection) {
        this.usersCollection = this.db.collection(this.config.usersCollection);
      }
      
      // Create indexes for better performance
      await this.createIndexes();
      
      this.isConnected = true;
      console.log(`Connected to MongoDB database: ${dbName}`);
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Creates indexes for collections
   * @returns Promise resolving when indexes are created
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    // Create indexes for metadata collection
    if (this.metadataCollection) {
      await this.metadataCollection.createIndex({ contentId: 1 }, { unique: true });
      await this.metadataCollection.createIndex({ created: -1 });
      await this.metadataCollection.createIndex({ mimeType: 1 });
    }
    
    // Create indexes for analytics collection
    if (this.analyticsCollection) {
      await this.analyticsCollection.createIndex({ timestamp: -1 });
      await this.analyticsCollection.createIndex({ contentId: 1 });
      await this.analyticsCollection.createIndex({ type: 1 });
    }
    
    // Create indexes for users collection
    if (this.usersCollection) {
      await this.usersCollection.createIndex({ userId: 1 }, { unique: true });
      await this.usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    }
  }
  
  /**
   * Disconnects from the MongoDB database
   * @returns Promise resolving when disconnected
   */
  public async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      this.db = null;
      this.metadataCollection = null;
      this.analyticsCollection = null;
      this.usersCollection = null;
      console.log('Disconnected from MongoDB');
    }
  }
  
  /**
   * Stores content metadata in the database
   * @param metadata Content metadata to store
   * @returns Promise resolving to the stored metadata
   */
  public async storeMetadata(metadata: ContentMetadata): Promise<ContentMetadata> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      // Check if metadata already exists
      const existing = await this.metadataCollection.findOne({ contentId: metadata.contentId });
      
      if (existing) {
        // Update existing metadata
        const result = await this.metadataCollection.updateOne(
          { contentId: metadata.contentId },
          { 
            $set: {
              ...metadata,
              updated: new Date()
            } 
          }
        );
        
        if (result.modifiedCount === 0) {
          throw new Error(`Failed to update metadata for content ${metadata.contentId}`);
        }
      } else {
        // Insert new metadata
        await this.metadataCollection.insertOne({
          ...metadata,
          _id: new ObjectId(),
          created: new Date(),
          updated: new Date()
        });
      }
      
      return metadata;
    } catch (error) {
      console.error('Error storing metadata in MongoDB:', error);
      throw new Error(`Failed to store metadata in MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Retrieves content metadata from the database
   * @param contentId The ID of the content
   * @returns Promise resolving to the content metadata
   */
  public async getMetadata(contentId: string): Promise<ContentMetadata | null> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      const result = await this.metadataCollection.findOne({ contentId });
      
      if (!result) {
        return null;
      }
      
      // Convert MongoDB document to ContentMetadata
      const { _id, ...metadata } = result;
      return metadata as ContentMetadata;
    } catch (error) {
      console.error('Error retrieving metadata from MongoDB:', error);
      throw new Error(`Failed to retrieve metadata from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Deletes content metadata from the database
   * @param contentId The ID of the content
   * @returns Promise resolving to a boolean indicating success
   */
  public async deleteMetadata(contentId: string): Promise<boolean> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      const result = await this.metadataCollection.deleteOne({ contentId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting metadata from MongoDB:', error);
      throw new Error(`Failed to delete metadata from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Lists all content metadata with optional filtering
   * @param filter Optional filter criteria
   * @param limit Maximum number of items to return
   * @param skip Number of items to skip (for pagination)
   * @returns Promise resolving to an array of content metadata
   */
  public async listMetadata(filter: Record<string, any> = {}, limit: number = 100, skip: number = 0): Promise<ContentMetadata[]> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      const results = await this.metadataCollection
        .find(filter)
        .sort({ created: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      // Convert MongoDB documents to ContentMetadata objects
      return results.map((doc) => {
        const { _id, ...metadata } = doc;
        return metadata as ContentMetadata;
      });
    } catch (error) {
      console.error('Error listing metadata from MongoDB:', error);
      throw new Error(`Failed to list metadata from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Stores an analytics event in the database
   * @param event Analytics event to store
   * @returns Promise resolving when the event is stored
   */
  public async storeAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    await this.ensureConnected();
    
    if (!this.analyticsCollection) {
      console.warn('Analytics collection not initialized, analytics event will not be stored');
      return;
    }
    
    try {
      await this.analyticsCollection.insertOne({
        ...event,
        _id: new ObjectId(),
        storedAt: new Date()
      });
    } catch (error) {
      console.error('Error storing analytics event in MongoDB:', error);
      // Don't throw error for analytics to prevent disrupting the main flow
    }
  }
  
  /**
   * Retrieves analytics events with filtering
   * @param filter Filter criteria
   * @param limit Maximum number of events to return
   * @param skip Number of events to skip (for pagination)
   * @returns Promise resolving to an array of analytics events
   */
  public async getAnalyticsEvents(filter: Record<string, any> = {}, limit: number = 100, skip: number = 0): Promise<AnalyticsEvent[]> {
    await this.ensureConnected();
    
    if (!this.analyticsCollection) {
      throw new Error('Analytics collection not initialized');
    }
    
    try {
      const results = await this.analyticsCollection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      // Convert MongoDB documents to AnalyticsEvent objects
      return results.map((doc) => {
        const { _id, storedAt, ...event } = doc;
        return event as AnalyticsEvent;
      });
    } catch (error) {
      console.error('Error retrieving analytics events from MongoDB:', error);
      throw new Error(`Failed to retrieve analytics events from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Ensures a connection to the database exists
   * @returns Promise resolving when connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
  
  /**
   * Performs aggregation queries for analytics
   * @param pipeline Aggregation pipeline
   * @returns Promise resolving to aggregation results
   */
  public async aggregate(pipeline: any[]): Promise<any[]> {
    await this.ensureConnected();
    
    if (!this.analyticsCollection) {
      throw new Error('Analytics collection not initialized');
    }
    
    try {
      return await this.analyticsCollection.aggregate(pipeline).toArray();
    } catch (error) {
      console.error('Error performing aggregation in MongoDB:', error);
      throw new Error(`Failed to perform aggregation in MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets a summary of storage statistics
   * @returns Promise resolving to storage statistics
   */
  public async getStorageStats(): Promise<any> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      const totalCount = await this.metadataCollection.countDocuments();
      
      const sizeAggregation = await this.metadataCollection.aggregate([
        { $group: { _id: null, totalSize: { $sum: '$size' } } }
      ]).toArray();
      
      const totalSize = sizeAggregation.length > 0 ? sizeAggregation[0].totalSize : 0;
      
      const mimeTypeAggregation = await this.metadataCollection.aggregate([
        { $group: { _id: '$mimeType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      const latest = await this.metadataCollection
        .find()
        .sort({ created: -1 })
        .limit(1)
        .toArray();
      
      return {
        totalCount,
        totalSize,
        mimeTypes: mimeTypeAggregation.map((doc) => ({
          type: doc._id,
          count: doc.count
        })),
        latestUpload: latest.length > 0 ? latest[0].created : null
      };
    } catch (error) {
      console.error('Error getting storage stats from MongoDB:', error);
      throw new Error(`Failed to get storage stats from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Updates content references from old ID to new ID
   * @param oldContentId Old content ID 
   * @param newContentId New content ID
   * @returns Promise resolving to boolean indicating success
   */
  public async updateContentReference(oldContentId: string, newContentId: string): Promise<boolean> {
    await this.ensureConnected();
    
    if (!this.metadataCollection) {
      throw new Error('Metadata collection not initialized');
    }
    
    try {
      // Update the metadata collection
      const metadataResult = await this.metadataCollection.findOneAndUpdate(
        { contentId: oldContentId },
        { 
          $set: { 
            contentId: newContentId,
            updated: new Date()
          } 
        },
        { returnDocument: 'after' }
      );
      
      // If no metadata was found, return false
      if (!metadataResult) {
        return false;
      }
      
      // Update references in analytics collection if it exists
      if (this.analyticsCollection) {
        await this.analyticsCollection.updateMany(
          { contentId: oldContentId },
          { $set: { contentId: newContentId } }
        );
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating content reference from ${oldContentId} to ${newContentId}:`, error);
      throw new Error(`Failed to update content reference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
import { Pool, QueryResult } from 'pg';
import { 
  AnalyticsEvent, 
  ContentMetadata, 
  VersionInfo
} from '../core/types';

/**
 * PostgreSQL Database Provider
 * 
 * This provider implements data persistence using PostgreSQL for the Decentralized Storage SDK.
 * It handles metadata storage, analytics event tracking, versioning, and user management.
 * 
 * Features:
 * - Automatic table creation and schema management
 * - Content metadata storage and retrieval
 * - Analytics event logging and querying
 * - Content version history tracking
 * - User data management
 * - Connection pooling for optimal performance
 * - Transaction support for data integrity
 * 
 * Usage example:
 * ```typescript
 * const postgresProvider = new PostgreSQLProvider({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'decentralized_storage',
 *   user: 'postgres',
 *   password: 'password',
 *   ssl: false
 * });
 * 
 * await postgresProvider.connect();
 * 
 * // Store content metadata
 * await postgresProvider.storeMetadata({
 *   contentId: 'abc123',
 *   mimeType: 'text/plain',
 *   size: 1024,
 *   filename: 'example.txt',
 *   created: new Date(),
 *   updated: new Date(),
 *   encrypted: false,
 *   hash: 'hash123'
 * });
 * ```
 * 
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */
export class PostgreSQLProvider {
  private pool: Pool;
  private connected: boolean = false;
  private readonly metadataTable: string;
  private readonly analyticsTable: string;
  private readonly versionsTable: string;
  private readonly usersTable: string;
  
  /**
   * Create a PostgreSQL Provider
   * @param connectionOptions PostgreSQL connection options
   * @param tables Table names configuration
   */
  constructor(
    connectionOptions: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean;
      max?: number; // Maximum number of clients
    },
    tables?: {
      metadata?: string;
      analytics?: string;
      versions?: string;
      users?: string;
    }
  ) {
    this.pool = new Pool({
      host: connectionOptions.host,
      port: connectionOptions.port,
      database: connectionOptions.database,
      user: connectionOptions.user,
      password: connectionOptions.password,
      ssl: connectionOptions.ssl === true ? { rejectUnauthorized: false } : undefined,
      max: connectionOptions.max || 20,
      idleTimeoutMillis: 30000
    });
    
    // Set table names with defaults
    this.metadataTable = (tables?.metadata || 'content_metadata');
    this.analyticsTable = (tables?.analytics || 'analytics_events');
    this.versionsTable = (tables?.versions || 'content_versions');
    this.usersTable = (tables?.users || 'users');
  }
  
  /**
   * Connect to PostgreSQL and create tables if needed
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    
    try {
      // Test connection
      const client = await this.pool.connect();
      try {
        console.log('Connected to PostgreSQL database');
        this.connected = true;
        
        // Create tables if they don't exist
        await this.initializeTables();
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw new Error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Close PostgreSQL connection
   */
  public async close(): Promise<void> {
    if (!this.connected) {
      return;
    }
    
    try {
      await this.pool.end();
      this.connected = false;
      console.log('PostgreSQL connection closed');
    } catch (error) {
      console.error('Error closing PostgreSQL connection:', error);
      throw new Error(`Failed to close PostgreSQL connection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Initialize database tables
   */
  private async initializeTables(): Promise<void> {
    try {
      // Create metadata table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.metadataTable} (
          content_id VARCHAR(255) PRIMARY KEY,
          mime_type VARCHAR(255) NOT NULL,
          size BIGINT NOT NULL,
          filename VARCHAR(255),
          created TIMESTAMP NOT NULL,
          updated TIMESTAMP NOT NULL,
          encrypted BOOLEAN DEFAULT false,
          hash VARCHAR(255),
          custom_metadata JSONB
        )
      `);
      
      // Create analytics table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.analyticsTable} (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          content_id VARCHAR(255),
          timestamp TIMESTAMP NOT NULL,
          user_id VARCHAR(255),
          geo_location JSONB,
          device_info JSONB,
          metadata JSONB,
          CONSTRAINT fk_content
            FOREIGN KEY(content_id)
            REFERENCES ${this.metadataTable}(content_id)
            ON DELETE SET NULL
        )
      `);
      
      // Create versions table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.versionsTable} (
          id SERIAL PRIMARY KEY,
          content_id VARCHAR(255) NOT NULL,
          version_id VARCHAR(255) NOT NULL,
          created TIMESTAMP NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          size BIGINT NOT NULL,
          metadata JSONB,
          CONSTRAINT fk_content
            FOREIGN KEY(content_id)
            REFERENCES ${this.metadataTable}(content_id)
            ON DELETE CASCADE,
          UNIQUE(content_id, version_id)
        )
      `);
      
      // Create users table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.usersTable} (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255),
          email VARCHAR(255),
          created TIMESTAMP NOT NULL,
          updated TIMESTAMP NOT NULL,
          settings JSONB,
          metadata JSONB
        )
      `);
      
      // Create indexes
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_metadata_mime_type ON ${this.metadataTable}(mime_type)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_metadata_created ON ${this.metadataTable}(created)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_metadata_updated ON ${this.metadataTable}(updated)`);
      
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON ${this.analyticsTable}(event_type)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_content_id ON ${this.analyticsTable}(content_id)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON ${this.analyticsTable}(timestamp)`);
      
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_versions_content_id ON ${this.versionsTable}(content_id)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_versions_version_id ON ${this.versionsTable}(version_id)`);
      
      console.log('PostgreSQL tables initialized');
    } catch (error) {
      console.error('Error initializing PostgreSQL tables:', error);
      throw new Error(`Failed to initialize tables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store content metadata
   * @param metadata Content metadata to store
   * @returns The stored metadata
   */
  public async storeMetadata(metadata: ContentMetadata): Promise<ContentMetadata> {
    await this.ensureConnected();
    
    try {
      const query = `
        INSERT INTO ${this.metadataTable} (
          content_id, mime_type, size, filename, created, updated, encrypted, hash, custom_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (content_id) DO UPDATE SET
          mime_type = EXCLUDED.mime_type,
          size = EXCLUDED.size,
          filename = EXCLUDED.filename,
          updated = EXCLUDED.updated,
          encrypted = EXCLUDED.encrypted,
          hash = EXCLUDED.hash,
          custom_metadata = EXCLUDED.custom_metadata
        RETURNING *
      `;
      
      const values = [
        metadata.contentId,
        metadata.mimeType,
        metadata.size,
        metadata.filename,
        metadata.created,
        metadata.updated,
        metadata.encrypted,
        metadata.hash,
        metadata.customMetadata ? JSON.stringify(metadata.customMetadata) : null
      ];
      
      const result = await this.pool.query(query, values);
      
      return metadata;
    } catch (error) {
      console.error('Error storing metadata in PostgreSQL:', error);
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
    
    try {
      const query = `
        SELECT * FROM ${this.metadataTable}
        WHERE content_id = $1
      `;
      
      const result = await this.pool.query(query, [contentId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        contentId: row.content_id,
        mimeType: row.mime_type,
        size: row.size,
        filename: row.filename,
        created: new Date(row.created),
        updated: new Date(row.updated),
        encrypted: row.encrypted,
        hash: row.hash,
        customMetadata: row.custom_metadata
      };
    } catch (error) {
      console.error(`Error retrieving metadata for ${contentId} from PostgreSQL:`, error);
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
    
    try {
      const query = `
        DELETE FROM ${this.metadataTable}
        WHERE content_id = $1
        RETURNING content_id
      `;
      
      const result = await this.pool.query(query, [contentId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error deleting metadata for ${contentId} from PostgreSQL:`, error);
      throw new Error(`Failed to delete metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * List content metadata with optional filtering
   * @param options Filter and pagination options
   * @returns Array of content metadata with count
   */
  public async listMetadata(options: {
    filter?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<{ items: ContentMetadata[]; totalItems: number }> {
    await this.ensureConnected();
    
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const orderBy = options.orderBy || 'created';
    const orderDirection = options.orderDirection || 'DESC';
    
    // Build WHERE clause from filter
    let whereClause = '';
    const values: any[] = [];
    let valueIndex = 1;
    
    if (options.filter) {
      const conditions: string[] = [];
      
      for (const [key, value] of Object.entries(options.filter)) {
        // Handle different types of filters
        let condition: string;
        if (key === 'mimeType' && typeof value === 'string') {
          condition = `mime_type = $${valueIndex++}`;
          values.push(value);
        } else if (key === 'filename' && typeof value === 'string') {
          condition = `filename ILIKE $${valueIndex++}`;
          values.push(`%${value}%`);
        } else if (key === 'contentId' && typeof value === 'string') {
          condition = `content_id = $${valueIndex++}`;
          values.push(value);
        } else if (key === 'encrypted' && typeof value === 'boolean') {
          condition = `encrypted = $${valueIndex++}`;
          values.push(value);
        } else if (key === 'sizeLessThan' && typeof value === 'number') {
          condition = `size < $${valueIndex++}`;
          values.push(value);
        } else if (key === 'sizeGreaterThan' && typeof value === 'number') {
          condition = `size > $${valueIndex++}`;
          values.push(value);
        } else if (key === 'createdBefore' && value instanceof Date) {
          condition = `created < $${valueIndex++}`;
          values.push(value);
        } else if (key === 'createdAfter' && value instanceof Date) {
          condition = `created > $${valueIndex++}`;
          values.push(value);
        } else if (key === 'customMetadata' && typeof value === 'object') {
          // Handle nested JSON filtering (basic implementation)
          condition = `custom_metadata @> $${valueIndex++}::jsonb`;
          values.push(JSON.stringify(value));
        } else {
          // Skip unknown filters
          continue;
        }
        
        conditions.push(condition);
      }
      
      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    try {
      // Count total items matching filter
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.metadataTable}
        ${whereClause}
      `;
      
      const countResult = await this.pool.query(countQuery, values);
      const totalItems = parseInt(countResult.rows[0].total);
      
      // Get paginated results
      const query = `
        SELECT *
        FROM ${this.metadataTable}
        ${whereClause}
        ORDER BY ${this.sanitizeIdentifier(orderBy)} ${orderDirection === 'ASC' ? 'ASC' : 'DESC'}
        LIMIT $${valueIndex++} OFFSET $${valueIndex++}
      `;
      
      const queryValues = [...values, limit, offset];
      const result = await this.pool.query(query, queryValues);
      
      // Convert rows to ContentMetadata objects
      const items = result.rows.map((row: any) => ({
        contentId: row.content_id,
        mimeType: row.mime_type,
        size: row.size,
        filename: row.filename,
        created: new Date(row.created),
        updated: new Date(row.updated),
        encrypted: row.encrypted,
        hash: row.hash,
        customMetadata: row.custom_metadata
      }));
      
      return { items, totalItems };
    } catch (error) {
      console.error('Error listing metadata from PostgreSQL:', error);
      throw new Error(`Failed to list metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store an analytics event
   * @param event The analytics event to store
   * @returns The ID of the stored event
   */
  public async storeAnalyticsEvent(event: AnalyticsEvent): Promise<string> {
    await this.ensureConnected();
    
    try {
      const query = `
        INSERT INTO ${this.analyticsTable} (
          event_type, content_id, timestamp, user_id, geo_location, device_info, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const values = [
        event.type,
        event.contentId,
        event.timestamp,
        event.userId,
        event.geoLocation ? JSON.stringify(event.geoLocation) : null,
        event.deviceInfo ? JSON.stringify(event.deviceInfo) : null,
        event.metadata ? JSON.stringify(event.metadata) : null
      ];
      
      const result = await this.pool.query(query, values);
      return result.rows[0].id.toString();
    } catch (error) {
      console.error('Error storing analytics event in PostgreSQL:', error);
      throw new Error(`Failed to store analytics event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Query analytics events
   * @param options Query options
   * @returns Analytics events with count
   */
  public async queryAnalytics(options: {
    eventType?: string;
    contentId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ events: AnalyticsEvent[]; totalEvents: number }> {
    await this.ensureConnected();
    
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    
    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let valueIndex = 1;
    
    if (options.eventType) {
      conditions.push(`event_type = $${valueIndex++}`);
      values.push(options.eventType);
    }
    
    if (options.contentId) {
      conditions.push(`content_id = $${valueIndex++}`);
      values.push(options.contentId);
    }
    
    if (options.userId) {
      conditions.push(`user_id = $${valueIndex++}`);
      values.push(options.userId);
    }
    
    if (options.startDate) {
      conditions.push(`timestamp >= $${valueIndex++}`);
      values.push(options.startDate);
    }
    
    if (options.endDate) {
      conditions.push(`timestamp <= $${valueIndex++}`);
      values.push(options.endDate);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    try {
      // Count total events matching query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.analyticsTable}
        ${whereClause}
      `;
      
      const countResult = await this.pool.query(countQuery, values);
      const totalEvents = parseInt(countResult.rows[0].total);
      
      // Get paginated results
      const query = `
        SELECT *
        FROM ${this.analyticsTable}
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${valueIndex++} OFFSET $${valueIndex++}
      `;
      
      const queryValues = [...values, limit, offset];
      const result = await this.pool.query(query, queryValues);
      
      // Convert rows to AnalyticsEvent objects
      const events = result.rows.map((row: any) => ({
        type: row.event_type,
        contentId: row.content_id,
        timestamp: new Date(row.timestamp),
        userId: row.user_id,
        geoLocation: row.geo_location,
        deviceInfo: row.device_info,
        metadata: row.metadata
      }));
      
      return { events, totalEvents };
    } catch (error) {
      console.error('Error querying analytics from PostgreSQL:', error);
      throw new Error(`Failed to query analytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store version information for content
   * @param contentId Content ID
   * @param versionInfo Version information
   * @returns The stored version ID
   */
  public async storeVersion(contentId: string, versionInfo: VersionInfo): Promise<string> {
    await this.ensureConnected();
    
    try {
      const query = `
        INSERT INTO ${this.versionsTable} (
          content_id, version_id, created, timestamp, size, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const values = [
        contentId,
        versionInfo.versionId,
        versionInfo.created,
        versionInfo.timestamp,
        versionInfo.size,
        versionInfo.metadata ? JSON.stringify(versionInfo.metadata) : null
      ];
      
      const result = await this.pool.query(query, values);
      return result.rows[0].id.toString();
    } catch (error) {
      console.error(`Error storing version for ${contentId} in PostgreSQL:`, error);
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
    
    try {
      const query = `
        SELECT *
        FROM ${this.versionsTable}
        WHERE content_id = $1
        ORDER BY timestamp DESC
      `;
      
      const result = await this.pool.query(query, [contentId]);
      
      // Convert rows to VersionInfo objects
      return result.rows.map((row: any) => ({
        versionId: row.version_id,
        created: new Date(row.created),
        timestamp: new Date(row.timestamp),
        size: row.size,
        metadata: row.metadata
      }));
    } catch (error) {
      console.error(`Error getting versions for ${contentId} from PostgreSQL:`, error);
      throw new Error(`Failed to get versions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get specific version of content
   * @param contentId Content ID
   * @param versionId Version ID
   * @returns Version information
   */
  public async getVersion(contentId: string, versionId: string): Promise<VersionInfo | null> {
    await this.ensureConnected();
    
    try {
      const query = `
        SELECT *
        FROM ${this.versionsTable}
        WHERE content_id = $1 AND version_id = $2
      `;
      
      const result = await this.pool.query(query, [contentId, versionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        versionId: row.version_id,
        created: new Date(row.created),
        timestamp: new Date(row.timestamp),
        size: row.size,
        metadata: row.metadata
      };
    } catch (error) {
      console.error(`Error getting version ${versionId} for ${contentId} from PostgreSQL:`, error);
      throw new Error(`Failed to get version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Delete old versions of content
   * @param contentId Content ID
   * @param keepLatest Number of latest versions to keep
   * @returns Number of deleted versions
   */
  public async pruneVersions(contentId: string, keepLatest: number): Promise<number> {
    await this.ensureConnected();
    
    try {
      const query = `
        WITH ranked_versions AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY content_id ORDER BY timestamp DESC) as rn
          FROM ${this.versionsTable}
          WHERE content_id = $1
        )
        DELETE FROM ${this.versionsTable}
        WHERE id IN (
          SELECT id FROM ranked_versions WHERE rn > $2
        )
        RETURNING id
      `;
      
      const result = await this.pool.query(query, [contentId, keepLatest]);
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Error pruning versions for ${contentId} from PostgreSQL:`, error);
      throw new Error(`Failed to prune versions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Ensure that we are connected to PostgreSQL
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }
  
  /**
   * Sanitize SQL identifier to prevent SQL injection
   * @param identifier The identifier to sanitize
   * @returns Sanitized identifier
   */
  private sanitizeIdentifier(identifier: string): string {
    // Only allow alphanumeric characters and underscores
    // Convert SQL column names (snake_case)
    const safeColumns: Record<string, string> = {
      'contentId': 'content_id',
      'mimeType': 'mime_type',
      'size': 'size', 
      'filename': 'filename',
      'created': 'created',
      'updated': 'updated',
      'encrypted': 'encrypted',
      'hash': 'hash'
    };
    
    if (safeColumns[identifier]) {
      return safeColumns[identifier];
    }
    
    // Default to created if not a valid column
    return 'created';
  }
  
  /**
   * Run a raw SQL query (use with caution)
   * @param query SQL query
   * @param values Query parameters
   * @returns Query result
   */
  public async rawQuery(query: string, values: any[] = []): Promise<QueryResult> {
    await this.ensureConnected();
    
    try {
      return await this.pool.query(query, values);
    } catch (error) {
      console.error('Error executing raw query:', error);
      throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Execute a query within a transaction
   * @param callback Function that executes queries within the transaction
   * @returns Result of the callback function
   */
  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    await this.ensureConnected();
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction failed:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * Update content references from old ID to new ID
   * @param oldContentId The old content ID
   * @param newContentId The new content ID
   * @returns Promise resolving to boolean indicating success
   */
  public async updateContentReference(oldContentId: string, newContentId: string): Promise<boolean> {
    await this.ensureConnected();
    
    try {
      // Begin transaction
      return await this.transaction(async (client) => {
        // Get metadata for old content
        const query = `
          SELECT * FROM ${this.metadataTable}
          WHERE content_id = $1
        `;
        
        const metadataResult = await client.query(query, [oldContentId]);
        
        if (metadataResult.rows.length === 0) {
          // Old content not found
          return false;
        }
        
        // Insert or update with new content ID
        const upsertQuery = `
          INSERT INTO ${this.metadataTable} (
            content_id, mime_type, size, filename, created, updated, encrypted, hash, custom_metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (content_id) DO UPDATE SET
            mime_type = EXCLUDED.mime_type,
            size = EXCLUDED.size,
            filename = EXCLUDED.filename,
            updated = EXCLUDED.updated,
            encrypted = EXCLUDED.encrypted,
            hash = EXCLUDED.hash,
            custom_metadata = EXCLUDED.custom_metadata
        `;
        
        const oldMetadata = metadataResult.rows[0];
        
        const values = [
          newContentId,
          oldMetadata.mime_type,
          oldMetadata.size,
          oldMetadata.filename,
          oldMetadata.created,
          new Date(),
          oldMetadata.encrypted,
          oldMetadata.hash,
          oldMetadata.custom_metadata
        ];
        
        await client.query(upsertQuery, values);
        
        // Update analytics references
        if (this.analyticsTable) {
          const updateAnalyticsQuery = `
            UPDATE ${this.analyticsTable}
            SET content_id = $1
            WHERE content_id = $2
          `;
          
          await client.query(updateAnalyticsQuery, [newContentId, oldContentId]);
        }
        
        // Update version references
        if (this.versionsTable) {
          const updateVersionsQuery = `
            UPDATE ${this.versionsTable}
            SET content_id = $1
            WHERE content_id = $2
          `;
          
          await client.query(updateVersionsQuery, [newContentId, oldContentId]);
        }
        
        // Delete old metadata
        const deleteQuery = `
          DELETE FROM ${this.metadataTable}
          WHERE content_id = $1
        `;
        
        await client.query(deleteQuery, [oldContentId]);
        
        return true;
      });
    } catch (error) {
      console.error(`Error updating content reference from ${oldContentId} to ${newContentId}:`, error);
      throw new Error(`Failed to update content reference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
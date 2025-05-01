import mysql from 'mysql2/promise';
import { 
  AnalyticsEvent, 
  ContentMetadata, 
  VersionInfo
} from '../core/types';

/**
 * MySQL Database Provider
 * 
 * This provider implements data persistence using MySQL for the Decentralized Storage SDK.
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
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */
export class MySQLProvider {
  private pool: mysql.Pool;
  private connected: boolean = false;
  private readonly metadataTable: string;
  private readonly analyticsTable: string;
  private readonly versionsTable: string;
  private readonly usersTable: string;

  /**
   * Create a MySQL Provider
   * @param connectionOptions MySQL connection options
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
      connectionLimit?: number;
    },
    tables?: {
      metadata?: string;
      analytics?: string;
      versions?: string;
      users?: string;
    }
  ) {
    this.pool = mysql.createPool({
      host: connectionOptions.host,
      port: connectionOptions.port,
      database: connectionOptions.database,
      user: connectionOptions.user,
      password: connectionOptions.password,
      ssl: connectionOptions.ssl ? { rejectUnauthorized: false } : undefined,
      connectionLimit: connectionOptions.connectionLimit || 10,
      waitForConnections: true,
      queueLimit: 0
    });
    
    // Set table names with defaults
    this.metadataTable = tables?.metadata || 'content_metadata';
    this.analyticsTable = tables?.analytics || 'analytics_events';
    this.versionsTable = tables?.versions || 'content_versions';
    this.usersTable = tables?.users || 'users';
  }
  
  /**
   * Connect to MySQL and create tables if needed
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    
    try {
      // Test connection
      const connection = await this.pool.getConnection();
      
      try {
        console.log('Connected to MySQL database');
        this.connected = true;
        
        // Create tables if they don't exist
        await this.initializeTables();
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Failed to connect to MySQL:', error);
      throw new Error(`MySQL connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Close MySQL connection
   */
  public async close(): Promise<void> {
    if (!this.connected) {
      return;
    }
    
    try {
      await this.pool.end();
      this.connected = false;
      console.log('MySQL connection closed');
    } catch (error) {
      console.error('Error closing MySQL connection:', error);
      throw new Error(`Failed to close MySQL connection: ${error instanceof Error ? error.message : String(error)}`);
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
          custom_metadata JSON
        )
      `);
      
      // Create analytics table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.analyticsTable} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          content_id VARCHAR(255),
          timestamp TIMESTAMP NOT NULL,
          user_id VARCHAR(255),
          geo_location JSON,
          device_info JSON,
          metadata JSON,
          FOREIGN KEY (content_id) REFERENCES ${this.metadataTable}(content_id) ON DELETE SET NULL
        )
      `);
      
      // Create versions table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.versionsTable} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          content_id VARCHAR(255) NOT NULL,
          version_id VARCHAR(255) NOT NULL,
          created TIMESTAMP NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          size BIGINT NOT NULL,
          metadata JSON,
          FOREIGN KEY (content_id) REFERENCES ${this.metadataTable}(content_id) ON DELETE CASCADE,
          UNIQUE KEY (content_id, version_id)
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
          settings JSON,
          metadata JSON
        )
      `);
      
      // Create indexes
      await this.pool.query(`CREATE INDEX idx_metadata_mime_type ON ${this.metadataTable}(mime_type)`);
      await this.pool.query(`CREATE INDEX idx_metadata_created ON ${this.metadataTable}(created)`);
      await this.pool.query(`CREATE INDEX idx_metadata_updated ON ${this.metadataTable}(updated)`);
      
      await this.pool.query(`CREATE INDEX idx_analytics_event_type ON ${this.analyticsTable}(event_type)`);
      await this.pool.query(`CREATE INDEX idx_analytics_content_id ON ${this.analyticsTable}(content_id)`);
      await this.pool.query(`CREATE INDEX idx_analytics_timestamp ON ${this.analyticsTable}(timestamp)`);
      
      await this.pool.query(`CREATE INDEX idx_versions_content_id ON ${this.versionsTable}(content_id)`);
      await this.pool.query(`CREATE INDEX idx_versions_version_id ON ${this.versionsTable}(version_id)`);
      
      console.log('MySQL tables initialized');
    } catch (error) {
      console.error('Error initializing MySQL tables:', error);
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          mime_type = VALUES(mime_type),
          size = VALUES(size),
          filename = VALUES(filename),
          updated = VALUES(updated),
          encrypted = VALUES(encrypted),
          hash = VALUES(hash),
          custom_metadata = VALUES(custom_metadata)
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
      
      await this.pool.query(query, values);
      
      return metadata;
    } catch (error) {
      console.error('Error storing metadata in MySQL:', error);
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
        WHERE content_id = ?
      `;
      
      const [rows] = await this.pool.query(query, [contentId]);
      const results = rows as any[];
      
      if (results.length === 0) {
        return null;
      }
      
      const row = results[0];
      return {
        contentId: row.content_id,
        mimeType: row.mime_type,
        size: row.size,
        filename: row.filename,
        created: new Date(row.created),
        updated: new Date(row.updated),
        encrypted: Boolean(row.encrypted),
        hash: row.hash,
        customMetadata: row.custom_metadata ? JSON.parse(row.custom_metadata) : undefined
      };
    } catch (error) {
      console.error(`Error retrieving metadata for ${contentId} from MySQL:`, error);
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
        WHERE content_id = ?
      `;
      
      const [result] = await this.pool.query(query, [contentId]);
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error(`Error deleting metadata for ${contentId} from MySQL:`, error);
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
    const orderBy = this.sanitizeIdentifier(options.orderBy || 'created');
    const orderDirection = options.orderDirection || 'DESC';
    
    // Build WHERE clause from filter
    let whereClause = '';
    const values: any[] = [];
    
    if (options.filter) {
      const conditions: string[] = [];
      
      for (const [key, value] of Object.entries(options.filter)) {
        // Handle different types of filters
        if (key === 'mimeType' && typeof value === 'string') {
          conditions.push(`mime_type = ?`);
          values.push(value);
        } else if (key === 'filename' && typeof value === 'string') {
          conditions.push(`filename LIKE ?`);
          values.push(`%${value}%`);
        } else if (key === 'contentId' && typeof value === 'string') {
          conditions.push(`content_id = ?`);
          values.push(value);
        } else if (key === 'encrypted' && typeof value === 'boolean') {
          conditions.push(`encrypted = ?`);
          values.push(value);
        } else if (key === 'sizeLessThan' && typeof value === 'number') {
          conditions.push(`size < ?`);
          values.push(value);
        } else if (key === 'sizeGreaterThan' && typeof value === 'number') {
          conditions.push(`size > ?`);
          values.push(value);
        } else if (key === 'createdBefore' && value instanceof Date) {
          conditions.push(`created < ?`);
          values.push(value);
        } else if (key === 'createdAfter' && value instanceof Date) {
          conditions.push(`created > ?`);
          values.push(value);
        } else {
          // Skip unknown filters
          continue;
        }
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
      
      const [countResult] = await this.pool.query(countQuery, values);
      const totalItems = (countResult as any[])[0].total;
      
      // Get paginated results
      const query = `
        SELECT *
        FROM ${this.metadataTable}
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT ?, ?
      `;
      
      const queryValues = [...values, offset, limit];
      const [rows] = await this.pool.query(query, queryValues);
      const results = rows as any[];
      
      // Convert rows to ContentMetadata objects
      const items = results.map((row: any) => ({
        contentId: row.content_id,
        mimeType: row.mime_type,
        size: row.size,
        filename: row.filename,
        created: new Date(row.created),
        updated: new Date(row.updated),
        encrypted: Boolean(row.encrypted),
        hash: row.hash,
        customMetadata: row.custom_metadata ? JSON.parse(row.custom_metadata) : undefined
      }));
      
      return { items, totalItems };
    } catch (error) {
      console.error('Error listing metadata from MySQL:', error);
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
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
      
      const [result] = await this.pool.query(query, values);
      return String((result as any).insertId);
    } catch (error) {
      console.error('Error storing analytics event in MySQL:', error);
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
    
    if (options.eventType) {
      conditions.push(`event_type = ?`);
      values.push(options.eventType);
    }
    
    if (options.contentId) {
      conditions.push(`content_id = ?`);
      values.push(options.contentId);
    }
    
    if (options.userId) {
      conditions.push(`user_id = ?`);
      values.push(options.userId);
    }
    
    if (options.startDate) {
      conditions.push(`timestamp >= ?`);
      values.push(options.startDate);
    }
    
    if (options.endDate) {
      conditions.push(`timestamp <= ?`);
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
      
      const [countResult] = await this.pool.query(countQuery, values);
      const totalEvents = (countResult as any[])[0].total;
      
      // Get paginated results
      const query = `
        SELECT *
        FROM ${this.analyticsTable}
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ?, ?
      `;
      
      const queryValues = [...values, offset, limit];
      const [rows] = await this.pool.query(query, queryValues);
      const results = rows as any[];
      
      // Convert rows to AnalyticsEvent objects
      const events = results.map((row: any) => ({
        type: row.event_type,
        contentId: row.content_id,
        timestamp: new Date(row.timestamp),
        userId: row.user_id,
        geoLocation: row.geo_location ? JSON.parse(row.geo_location) : undefined,
        deviceInfo: row.device_info ? JSON.parse(row.device_info) : undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      } as AnalyticsEvent));
      
      return { events, totalEvents };
    } catch (error) {
      console.error('Error querying analytics from MySQL:', error);
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
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        contentId,
        versionInfo.versionId,
        versionInfo.created,
        versionInfo.timestamp,
        versionInfo.size,
        versionInfo.metadata ? JSON.stringify(versionInfo.metadata) : null
      ];
      
      const [result] = await this.pool.query(query, values);
      return String((result as any).insertId);
    } catch (error) {
      console.error(`Error storing version for ${contentId} in MySQL:`, error);
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
        WHERE content_id = ?
        ORDER BY timestamp DESC
      `;
      
      const [rows] = await this.pool.query(query, [contentId]);
      const results = rows as any[];
      
      // Convert rows to VersionInfo objects
      return results.map((row: any) => ({
        versionId: row.version_id,
        created: new Date(row.created),
        timestamp: new Date(row.timestamp),
        size: row.size,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));
    } catch (error) {
      console.error(`Error getting versions for ${contentId} from MySQL:`, error);
      throw new Error(`Failed to get versions: ${error instanceof Error ? error.message : String(error)}`);
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
    
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get metadata for old content
      const query = `
        SELECT * FROM ${this.metadataTable}
        WHERE content_id = ?
      `;
      
      const [rows] = await connection.query(query, [oldContentId]);
      const results = rows as any[];
      
      if (results.length === 0) {
        // Old content not found
        await connection.rollback();
        return false;
      }
      
      // Insert or update with new content ID
      const upsertQuery = `
        INSERT INTO ${this.metadataTable} (
          content_id, mime_type, size, filename, created, updated, encrypted, hash, custom_metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          mime_type = VALUES(mime_type),
          size = VALUES(size),
          filename = VALUES(filename),
          updated = VALUES(updated),
          encrypted = VALUES(encrypted),
          hash = VALUES(hash),
          custom_metadata = VALUES(custom_metadata)
      `;
      
      const oldMetadata = results[0];
      
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
      
      await connection.query(upsertQuery, values);
      
      // Update analytics references
      const updateAnalyticsQuery = `
        UPDATE ${this.analyticsTable}
        SET content_id = ?
        WHERE content_id = ?
      `;
      
      await connection.query(updateAnalyticsQuery, [newContentId, oldContentId]);
      
      // Update version references
      const updateVersionsQuery = `
        UPDATE ${this.versionsTable}
        SET content_id = ?
        WHERE content_id = ?
      `;
      
      await connection.query(updateVersionsQuery, [newContentId, oldContentId]);
      
      // Delete old metadata
      const deleteQuery = `
        DELETE FROM ${this.metadataTable}
        WHERE content_id = ?
      `;
      
      await connection.query(deleteQuery, [oldContentId]);
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error(`Error updating content reference from ${oldContentId} to ${newContentId}:`, error);
      throw new Error(`Failed to update content reference: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      connection.release();
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
      // First get the IDs of versions to keep
      const selectQuery = `
        SELECT id FROM ${this.versionsTable}
        WHERE content_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      
      const [rows] = await this.pool.query(selectQuery, [contentId, keepLatest]);
      const results = rows as any[];
      
      if (results.length === 0) {
        return 0;
      }
      
      // Extract IDs to keep
      const idsToKeep = results.map(row => row.id);
      
      // Delete versions not in the keep list
      const deleteQuery = `
        DELETE FROM ${this.versionsTable}
        WHERE content_id = ? AND id NOT IN (?)
      `;
      
      const [result] = await this.pool.query(deleteQuery, [contentId, idsToKeep]);
      return (result as any).affectedRows;
    } catch (error) {
      console.error(`Error pruning versions for ${contentId} from MySQL:`, error);
      throw new Error(`Failed to prune versions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Ensure that we are connected to MySQL
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
    // Convert camelCase to snake_case for column names
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
  public async rawQuery(query: string, values: any[] = []): Promise<any> {
    await this.ensureConnected();
    
    try {
      const [result] = await this.pool.query(query, values);
      return result;
    } catch (error) {
      console.error('Error executing raw query:', error);
      throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
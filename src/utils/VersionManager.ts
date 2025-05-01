import { VersioningConfig } from '../core/types';

/**
 * Version Manager
 * Handles versioning of content, allowing tracking and retrieval of previous versions
 */
export class VersionManager {
  private config: VersioningConfig;
  private versionHistory: Map<string, VersionInfo[]> = new Map();
  
  /**
   * Creates a new Version Manager
   * @param config Versioning configuration
   */
  constructor(config: VersioningConfig) {
    this.config = config;
  }
  
  /**
   * Registers a new version of content
   * @param contentId The content ID
   * @param versionInfo Information about the version
   * @returns Promise resolving to the version ID
   */
  public async registerVersion(contentId: string, versionInfo: Omit<VersionInfo, 'versionId'>): Promise<string> {
    // Generate a unique version ID
    const versionId = this.generateVersionId(contentId);
    
    // Create the version info object
    const version: VersionInfo = {
      ...versionInfo,
      versionId,
      created: new Date()
    };
    
    // Get or create the version history for this content
    let versions = this.versionHistory.get(contentId);
    if (!versions) {
      versions = [];
      this.versionHistory.set(contentId, versions);
    }
    
    // Add the new version to the history
    versions.push(version);
    
    // If max versions is set and we have exceeded it, prune old versions
    if (this.config.maxVersions && versions.length > this.config.maxVersions && this.config.autoPrune) {
      this.pruneVersions(contentId, this.config.maxVersions);
    }
    
    return versionId;
  }
  
  /**
   * Gets the version history for a content item
   * @param contentId The content ID
   * @returns Promise resolving to the version history
   */
  public async getVersionHistory(contentId: string): Promise<VersionInfo[]> {
    const versions = this.versionHistory.get(contentId) || [];
    
    // Sort versions by creation time (newest first)
    return [...versions].sort((a, b) => b.created.getTime() - a.created.getTime());
  }
  
  /**
   * Gets the content ID for a specific version
   * @param contentId The base content ID
   * @param versionId The version ID
   * @returns Promise resolving to the version-specific content ID
   */
  public async getVersionContentId(contentId: string, versionId: string): Promise<string> {
    const versions = this.versionHistory.get(contentId);
    if (!versions) {
      throw new Error(`No version history found for content ${contentId}`);
    }
    
    const version = versions.find(v => v.versionId === versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for content ${contentId}`);
    }
    
    // In a real implementation, this might be a different ID or a path to the versioned content
    // For this example, we'll construct a combined ID
    return `${contentId}/${versionId}`;
  }
  
  /**
   * Prunes old versions to keep history size manageable
   * @param contentId The content ID
   * @param keepCount Number of versions to keep
   */
  public pruneVersions(contentId: string, keepCount: number): void {
    const versions = this.versionHistory.get(contentId);
    if (!versions || versions.length <= keepCount) {
      return;
    }
    
    // Sort versions by creation time (newest first)
    const sortedVersions = [...versions].sort((a, b) => b.created.getTime() - a.created.getTime());
    
    // Keep only the newest versions
    this.versionHistory.set(contentId, sortedVersions.slice(0, keepCount));
    
    // In a real implementation, we would also delete the actual content for pruned versions
    console.log(`Pruned ${versions.length - keepCount} old versions of content ${contentId}`);
  }
  
  /**
   * Deletes all versions of content
   * @param contentId The content ID
   * @returns Promise resolving to the number of versions deleted
   */
  public async deleteAllVersions(contentId: string): Promise<number> {
    const versions = this.versionHistory.get(contentId) || [];
    const count = versions.length;
    
    this.versionHistory.delete(contentId);
    
    // In a real implementation, we would also delete the actual content for all versions
    console.log(`Deleted all ${count} versions of content ${contentId}`);
    
    return count;
  }
  
  /**
   * Generates a unique version ID
   * @param contentId The content ID
   * @returns A unique version ID
   */
  private generateVersionId(contentId: string): string {
    // Generate a version ID based on the content ID and timestamp
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 10000);
    
    return `v-${timestamp}-${randomPart}`;
  }
  
  /**
   * Restores a previous version as the current version
   * @param contentId The content ID
   * @param versionId The version ID to restore
   * @returns Promise resolving to the new current version ID
   */
  public async restoreVersion(contentId: string, versionId: string): Promise<string> {
    const versions = this.versionHistory.get(contentId);
    if (!versions) {
      throw new Error(`No version history found for content ${contentId}`);
    }
    
    const versionToRestore = versions.find(v => v.versionId === versionId);
    if (!versionToRestore) {
      throw new Error(`Version ${versionId} not found for content ${contentId}`);
    }
    
    // In a real implementation, this would involve:
    // 1. Retrieving the data from the old version
    // 2. Creating a new version with that data
    // 3. Setting the new version as the current version
    
    // For this example, we'll just create a new version based on the old one
    const newVersionInfo: Omit<VersionInfo, 'versionId'> = {
      timestamp: new Date(),
      size: versionToRestore.size,
      created: new Date(),
      restoredFrom: versionId
    };
    
    return this.registerVersion(contentId, newVersionInfo);
  }
  
  /**
   * Gets the versioning configuration
   * @returns The current versioning configuration
   */
  public getConfig(): VersioningConfig {
    return { ...this.config };
  }
  
  /**
   * Updates the versioning configuration
   * @param config The new configuration
   */
  public updateConfig(config: Partial<VersioningConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Version information
 */
export interface VersionInfo {
  /** Unique version ID */
  versionId: string;
  /** Timestamp of when the version was created */
  timestamp: Date;
  /** Size of the content in bytes */
  size: number;
  /** Time when the version record was created */
  created: Date;
  /** Version ID this was restored from (if applicable) */
  restoredFrom?: string;
  /** Custom metadata for the version */
  metadata?: Record<string, any>;
} 
/**
 * Content Recommendation Engine
 * Provides personalized content recommendations using collaborative filtering
 */
export class ContentRecommendationEngine {
  // User-Content interaction matrix (sparse)
  private userInteractions: Map<string, Map<string, number>> = new Map();
  // Content similarity matrix (precomputed)
  private contentSimilarity: Map<string, Map<string, number>> = new Map();
  // Content metadata for content-based filtering
  private contentMetadata: Map<string, ContentMetadata> = new Map();
  // Last computation timestamp
  private lastComputation: number = 0;
  // Computation frequency in milliseconds
  private recomputeInterval: number = 3600000; // 1 hour

  /**
   * Record a user's interaction with content
   * @param userId User ID
   * @param contentId Content ID
   * @param strength Interaction strength (0-1)
   */
  public recordInteraction(userId: string, contentId: string, strength: number = 1): void {
    // Get or create user's interactions
    if (!this.userInteractions.has(userId)) {
      this.userInteractions.set(userId, new Map());
    }

    // Record the interaction
    this.userInteractions.get(userId)!.set(contentId, strength);
  }

  /**
   * Add content metadata for content-based recommendations
   * @param contentId Content ID
   * @param metadata Content metadata
   */
  public addContentMetadata(contentId: string, metadata: ContentMetadata): void {
    this.contentMetadata.set(contentId, metadata);
  }

  /**
   * Get recommendations for a user
   * @param userId User ID to get recommendations for
   * @param limit Maximum number of recommendations to return
   * @param excludeIds Content IDs to exclude from recommendations
   * @returns Array of recommendations with scores
   */
  public getRecommendations(
    userId: string, 
    limit: number = 5,
    excludeIds: string[] = []
  ): Array<{ contentId: string; score: number; reason: string }> {
    // Recompute similarities if needed
    this.recomputeIfNeeded();

    // Get user's interactions or return empty if new user
    const userProfile = this.userInteractions.get(userId);
    if (!userProfile || userProfile.size === 0) {
      return this.getPopularContent(limit, excludeIds);
    }

    // Score all content
    const contentScores = new Map<string, { score: number; reason: string }>();
    
    // Item-based collaborative filtering
    for (const [interactedContentId, interactionStrength] of userProfile.entries()) {
      const similarContent = this.contentSimilarity.get(interactedContentId);
      
      if (similarContent) {
        for (const [similarContentId, similarityScore] of similarContent.entries()) {
          // Skip if already interacted with or in exclude list
          if (userProfile.has(similarContentId) || excludeIds.includes(similarContentId)) {
            continue;
          }
          
          // Calculate weighted score
          const weightedScore = interactionStrength * similarityScore;
          
          if (!contentScores.has(similarContentId)) {
            contentScores.set(similarContentId, { 
              score: weightedScore,
              reason: `Similar to content you've interacted with: ${interactedContentId}`
            });
          } else {
            const current = contentScores.get(similarContentId)!;
            if (weightedScore > current.score) {
              contentScores.set(similarContentId, {
                score: weightedScore,
                reason: `Similar to content you've interacted with: ${interactedContentId}`
              });
            }
          }
        }
      }
    }
    
    // Convert to array and sort
    const recommendations = Array.from(contentScores.entries())
      .map(([contentId, { score, reason }]) => ({ contentId, score, reason }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // If we don't have enough recommendations, add popular content
    if (recommendations.length < limit) {
      const popularContent = this.getPopularContent(
        limit - recommendations.length, 
        [...excludeIds, ...recommendations.map(r => r.contentId)]
      );
      
      recommendations.push(...popularContent);
    }
    
    return recommendations;
  }

  /**
   * Get popular content (fallback for new users)
   * @param limit Maximum number of items to return
   * @param excludeIds Content IDs to exclude
   * @returns Array of recommendations
   */
  private getPopularContent(
    limit: number, 
    excludeIds: string[] = []
  ): Array<{ contentId: string; score: number; reason: string }> {
    // Count interactions by content
    const contentPopularity = new Map<string, number>();
    
    for (const userProfile of this.userInteractions.values()) {
      for (const [contentId, strength] of userProfile.entries()) {
        if (excludeIds.includes(contentId)) {
          continue;
        }
        
        contentPopularity.set(
          contentId, 
          (contentPopularity.get(contentId) || 0) + strength
        );
      }
    }
    
    // Convert to array and sort
    return Array.from(contentPopularity.entries())
      .map(([contentId, score]) => ({ 
        contentId, 
        score: score / this.userInteractions.size, // Normalize
        reason: 'Popular content'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Recompute content similarities if enough time has passed
   */
  private recomputeIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastComputation > this.recomputeInterval) {
      this.computeContentSimilarity();
      this.lastComputation = now;
    }
  }

  /**
   * Compute content similarity matrix using collaborative filtering
   */
  private computeContentSimilarity(): void {
    // Clear existing similarities
    this.contentSimilarity.clear();
    
    // Get all content IDs
    const contentIds = new Set<string>();
    for (const userProfile of this.userInteractions.values()) {
      for (const contentId of userProfile.keys()) {
        contentIds.add(contentId);
      }
    }
    
    // For each content pair, compute similarity
    const contentArray = Array.from(contentIds);
    for (let i = 0; i < contentArray.length; i++) {
      const contentId1 = contentArray[i];
      
      // Create similarity map for this content
      if (!this.contentSimilarity.has(contentId1)) {
        this.contentSimilarity.set(contentId1, new Map());
      }
      
      for (let j = i + 1; j < contentArray.length; j++) {
        const contentId2 = contentArray[j];
        
        // Compute similarity
        const similarity = this.computePairSimilarity(contentId1, contentId2);
        
        // Store similarity (both ways)
        if (similarity > 0) {
          this.contentSimilarity.get(contentId1)!.set(contentId2, similarity);
          
          if (!this.contentSimilarity.has(contentId2)) {
            this.contentSimilarity.set(contentId2, new Map());
          }
          
          this.contentSimilarity.get(contentId2)!.set(contentId1, similarity);
        }
      }
    }
  }

  /**
   * Compute similarity between two content items
   * @param contentId1 First content ID
   * @param contentId2 Second content ID
   * @returns Similarity score (0-1)
   */
  private computePairSimilarity(contentId1: string, contentId2: string): number {
    // Users who interacted with both content items
    let coInteractionCount = 0;
    let scoreProduct = 0;
    let scoreSum1 = 0;
    let scoreSum2 = 0;
    
    // Compute cosine similarity
    for (const userProfile of this.userInteractions.values()) {
      const score1 = userProfile.get(contentId1);
      const score2 = userProfile.get(contentId2);
      
      if (score1 !== undefined && score2 !== undefined) {
        coInteractionCount++;
        scoreProduct += score1 * score2;
        scoreSum1 += score1 * score1;
        scoreSum2 += score2 * score2;
      }
    }
    
    // No common users
    if (coInteractionCount === 0) {
      return 0;
    }
    
    // Compute cosine similarity
    return scoreProduct / (Math.sqrt(scoreSum1) * Math.sqrt(scoreSum2));
  }

  /**
   * Set the recompute interval
   * @param intervalMs Interval in milliseconds
   */
  public setRecomputeInterval(intervalMs: number): void {
    this.recomputeInterval = intervalMs;
  }

  /**
   * Force recomputation of similarities
   */
  public forceRecompute(): void {
    this.computeContentSimilarity();
    this.lastComputation = Date.now();
  }

  /**
   * Get the total number of user interactions
   * @returns Number of user interactions
   */
  public getInteractionCount(): number {
    let count = 0;
    for (const userProfile of this.userInteractions.values()) {
      count += userProfile.size;
    }
    return count;
  }

  /**
   * Get the total number of users
   * @returns Number of users
   */
  public getUserCount(): number {
    return this.userInteractions.size;
  }

  /**
   * Get the total number of content items
   * @returns Number of content items
   */
  public getContentCount(): number {
    return this.contentMetadata.size;
  }
}

/**
 * Content metadata for content-based filtering
 */
interface ContentMetadata {
  contentId: string;
  mimeType: string;
  size: number;
  filename?: string;
  created: Date;
  updated: Date;
  tags?: string[];
  categories?: string[];
  customMetadata?: Record<string, any>;
} 
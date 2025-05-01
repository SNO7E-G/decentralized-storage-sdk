/**
 * DDoS Protector
 * Protects CDN nodes from DDoS attacks by tracking request patterns
 * and blocking suspicious activity
 */
export class DDoSProtector {
  private requestCounts: Map<string, RequestTracker> = new Map();
  private ipBlocklist: Set<string> = new Set();
  private suspiciousIPs: Map<string, number> = new Map(); // IP address -> suspicious score
  
  // Configuration
  private readonly REQUEST_WINDOW_MS = 60000; // 1 minute window for rate limiting
  private readonly MAX_REQUESTS_PER_WINDOW = 100; // Maximum requests per minute
  private readonly MAX_REQUESTS_PER_CONTENT = 30; // Maximum requests for the same content
  private readonly MAX_SUSPICIOUS_SCORE = 5; // Score at which an IP gets blocked
  private readonly BLOCK_DURATION_MS = 3600000; // 1 hour block duration
  
  /**
   * Creates a new DDoS Protector
   */
  constructor() {
    // Clean up old request tracking data every minute
    setInterval(() => this.cleanupOldRequests(), 60000);
    
    // Clean up expired IP blocks every hour
    setInterval(() => this.cleanupExpiredBlocks(), 3600000);
    
    console.log('Initialized DDoS Protector');
  }
  
  /**
   * Records a request for rate limiting and DDoS detection
   * @param ip Client IP address
   * @param contentId Content ID being requested
   */
  public recordRequest(ip: string, contentId: string): void {
    // Skip tracking for known good IPs (in a real implementation, this would
    // include trusted partners, CDN internal traffic, etc.)
    if (this.isKnownGoodIP(ip)) {
      return;
    }
    
    // Get or create request tracker for this IP
    let tracker = this.requestCounts.get(ip);
    if (!tracker) {
      tracker = {
        totalRequests: 0,
        contentRequests: new Map(),
        timestamps: []
      };
      this.requestCounts.set(ip, tracker);
    }
    
    // Record the request
    tracker.totalRequests++;
    tracker.timestamps.push(Date.now());
    
    // Track content-specific requests
    const contentCount = tracker.contentRequests.get(contentId) || 0;
    tracker.contentRequests.set(contentId, contentCount + 1);
    
    // Check for suspicious patterns
    this.checkForSuspiciousPatterns(ip, tracker);
  }
  
  /**
   * Determines if a request should be blocked
   * @param ip Client IP address
   * @param contentId Content ID being requested
   * @returns True if the request should be blocked
   */
  public shouldBlock(ip: string, contentId: string): boolean {
    // First check if the IP is on the blocklist
    if (this.ipBlocklist.has(ip)) {
      console.warn(`Blocked request from blacklisted IP: ${ip}`);
      return true;
    }
    
    // Record this request
    this.recordRequest(ip, contentId);
    
    // Get the request tracker for this IP
    const tracker = this.requestCounts.get(ip);
    if (!tracker) {
      return false; // First request from this IP
    }
    
    // Check rate limiting
    const now = Date.now();
    const recentRequests = tracker.timestamps.filter(t => now - t < this.REQUEST_WINDOW_MS);
    
    if (recentRequests.length > this.MAX_REQUESTS_PER_WINDOW) {
      console.warn(`Rate limit exceeded for IP: ${ip} (${recentRequests.length} requests in the last minute)`);
      this.addToSuspiciousIPs(ip, 2); // Add to suspicious IPs with a score increase
      return true;
    }
    
    // Check for too many requests for the same content
    const contentCount = tracker.contentRequests.get(contentId) || 0;
    if (contentCount > this.MAX_REQUESTS_PER_CONTENT) {
      console.warn(`Too many requests for the same content from IP: ${ip} (${contentCount} requests for ${contentId})`);
      this.addToSuspiciousIPs(ip, 1);
      return true;
    }
    
    return false;
  }
  
  /**
   * Checks for suspicious request patterns
   * @param ip Client IP address
   * @param tracker Request tracker for this IP
   */
  private checkForSuspiciousPatterns(ip: string, tracker: RequestTracker): void {
    const now = Date.now();
    
    // Check for suspicious patterns:
    
    // 1. Too many total requests in a short time
    const recentRequests = tracker.timestamps.filter(t => now - t < this.REQUEST_WINDOW_MS);
    if (recentRequests.length > this.MAX_REQUESTS_PER_WINDOW * 0.8) {
      this.addToSuspiciousIPs(ip, 1);
    }
    
    // 2. Making requests to many different content IDs in a short time
    if (tracker.contentRequests.size > 50 && recentRequests.length > 50) {
      this.addToSuspiciousIPs(ip, 1);
    }
    
    // 3. Extremely regular request patterns (bot-like behavior)
    if (recentRequests.length > 10) {
      const intervals = [];
      for (let i = 1; i < recentRequests.length; i++) {
        intervals.push(recentRequests[i] - recentRequests[i-1]);
      }
      
      // Calculate standard deviation of intervals
      const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      
      // If standard deviation is very low, requests are too regular
      if (stdDev < 50 && avg < 1000) { // Less than 50ms variation and less than 1s between requests
        this.addToSuspiciousIPs(ip, 2);
      }
    }
  }
  
  /**
   * Adds an IP to the suspicious list or increases its score
   * @param ip IP address to add
   * @param scoreIncrease Amount to increase the suspicion score by
   */
  private addToSuspiciousIPs(ip: string, scoreIncrease: number): void {
    const currentScore = this.suspiciousIPs.get(ip) || 0;
    const newScore = currentScore + scoreIncrease;
    
    this.suspiciousIPs.set(ip, newScore);
    
    // If the score is too high, block the IP
    if (newScore >= this.MAX_SUSPICIOUS_SCORE) {
      this.blockIP(ip);
    }
  }
  
  /**
   * Adds an IP to the blocklist
   * @param ip IP address to block
   */
  private blockIP(ip: string): void {
    this.ipBlocklist.add(ip);
    
    // Store the block time for later cleanup
    const blockInfo = {
      ip,
      blockTime: Date.now(),
      expiryTime: Date.now() + this.BLOCK_DURATION_MS
    };
    
    // In a real implementation, this would be stored in a database or persistent storage
    console.warn(`Blocked IP ${ip} for suspicious activity`);
    
    // In a real implementation, this might notify security teams or log to a security monitoring system
  }
  
  /**
   * Removes old request tracking data to prevent memory leaks
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const cutoff = now - this.REQUEST_WINDOW_MS;
    
    // Clean up old requests
    for (const [ip, tracker] of this.requestCounts.entries()) {
      // Remove old timestamps
      tracker.timestamps = tracker.timestamps.filter(t => t >= cutoff);
      
      // Remove the tracker if there are no recent requests
      if (tracker.timestamps.length === 0) {
        this.requestCounts.delete(ip);
      }
    }
  }
  
  /**
   * Removes expired IP blocks
   */
  private cleanupExpiredBlocks(): void {
    // In a real implementation, this would remove IPs from the blocklist
    // after their block duration has expired
    console.log('Cleaned up expired IP blocks');
  }
  
  /**
   * Checks if an IP is a known good IP (whitelist)
   * @param ip IP address to check
   * @returns True if the IP is on the whitelist
   */
  private isKnownGoodIP(ip: string): boolean {
    // In a real implementation, this would check against a whitelist
    // For this example, we'll just return false
    return false;
  }
}

/**
 * Interface for tracking requests from a specific IP
 */
interface RequestTracker {
  totalRequests: number;
  contentRequests: Map<string, number>; // contentId -> request count
  timestamps: number[]; // Array of request timestamps
} 
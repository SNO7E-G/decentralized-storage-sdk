import * as crypto from 'crypto';
import { createHash } from 'crypto';
import CryptoJS from 'crypto-js';
import { SDKError, SDKErrorCode, createInvalidParameterError } from './ErrorHandler';
import { PathValidator } from './PathValidator';

/**
 * Security level for SDK operations
 */
export enum SecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Security configuration options
 */
export interface SecurityConfig {
  /** Security level for the SDK */
  level: SecurityLevel;
  /** Enable request signing for API calls */
  enableRequestSigning: boolean;
  /** Enable rate limiting */
  enableRateLimiting: boolean;
  /** Rate limit configuration */
  rateLimiting?: {
    /** Max requests per window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
  };
  /** JWT validation options */
  jwtValidation?: {
    /** JWT secret key */
    secretKey: string;
    /** Issuer to validate */
    issuer?: string;
    /** Audience to validate */
    audience?: string;
    /** Token expiration in seconds */
    expirationSeconds?: number;
  };
  /** CORS settings */
  corsSettings?: {
    /** Allowed origins */
    allowedOrigins: string[];
    /** Allowed methods */
    allowedMethods: string[];
    /** Allow credentials */
    allowCredentials: boolean;
  };
  /** Content Security Policy options */
  contentSecurityPolicy?: Record<string, string[]>;
  /** Path validation */
  validatePaths: boolean;
  /** Require TLS for all connections */
  requireTLS: boolean;
  /** Sanitize input data */
  sanitizeInput: boolean;
}

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  level: SecurityLevel.MEDIUM,
  enableRequestSigning: false,
  enableRateLimiting: true,
  rateLimiting: {
    maxRequests: 100,
    windowSeconds: 60
  },
  validatePaths: true,
  requireTLS: true,
  sanitizeInput: true
};

/**
 * Security Manager
 * Handles security operations for the SDK
 */
export class SecurityManager {
  private config: SecurityConfig;
  private rateLimiters: Map<string, { count: number, resetTime: number }> = new Map();
  private validApiKeys: Set<string> = new Set();
  
  /**
   * Creates a new Security Manager
   * @param config Security configuration
   */
  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }
  
  /**
   * Validates an API key
   * @param apiKey API key to validate
   * @returns True if valid
   */
  public validateApiKey(apiKey: string): boolean {
    if (!apiKey || apiKey.length < 16) {
      return false;
    }
    
    // Check if key is in valid keys set
    if (this.validApiKeys.has(apiKey)) {
      return true;
    }
    
    // Implement more complex validation logic here
    // For now, we're using a simple format check
    const validFormat = /^[a-zA-Z0-9_-]{16,128}$/.test(apiKey);
    
    // If valid, add to cache for future checks
    if (validFormat) {
      this.validApiKeys.add(apiKey);
    }
    
    return validFormat;
  }
  
  /**
   * Create a JWT token
   * @param payload Token payload
   * @param expiresIn Expiration time in seconds
   * @returns JWT token
   */
  public createJWT(payload: Record<string, any>, expiresIn?: number): string {
    if (!this.config.jwtValidation?.secretKey) {
      throw new SDKError(
        'JWT secret key is required to create tokens',
        SDKErrorCode.INVALID_CONFIGURATION
      );
    }
    
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (expiresIn || this.config.jwtValidation.expirationSeconds || 3600);
    
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };
    
    const jwtPayload = {
      ...payload,
      iat: now,
      exp,
      iss: this.config.jwtValidation.issuer,
      aud: this.config.jwtValidation.audience
    };
    
    const headerBase64 = this.base64URLEncode(JSON.stringify(header));
    const payloadBase64 = this.base64URLEncode(JSON.stringify(jwtPayload));
    
    const signature = CryptoJS.HmacSHA256(
      `${headerBase64}.${payloadBase64}`,
      this.config.jwtValidation.secretKey
    ).toString(CryptoJS.enc.Base64);
    
    const signatureBase64 = this.base64URLEncode(signature, true);
    
    return `${headerBase64}.${payloadBase64}.${signatureBase64}`;
  }
  
  /**
   * Verify a JWT token
   * @param token JWT token
   * @returns Decoded payload if valid
   * @throws Error if token is invalid
   */
  public verifyJWT(token: string): Record<string, any> {
    if (!this.config.jwtValidation?.secretKey) {
      throw new SDKError(
        'JWT secret key is required to verify tokens',
        SDKErrorCode.INVALID_CONFIGURATION
      );
    }
    
    // Split token into components
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new SDKError('Invalid token format', SDKErrorCode.AUTHENTICATION_FAILED);
    }
    
    const [headerBase64, payloadBase64, signatureBase64] = parts;
    
    // Verify signature
    const expectedSignature = CryptoJS.HmacSHA256(
      `${headerBase64}.${payloadBase64}`,
      this.config.jwtValidation.secretKey
    ).toString(CryptoJS.enc.Base64);
    
    const expectedSignatureBase64 = this.base64URLEncode(expectedSignature, true);
    
    if (signatureBase64 !== expectedSignatureBase64) {
      throw new SDKError('Invalid token signature', SDKErrorCode.AUTHENTICATION_FAILED);
    }
    
    // Decode payload
    try {
      const payload = JSON.parse(this.base64URLDecode(payloadBase64));
      const now = Math.floor(Date.now() / 1000);
      
      // Check expiration
      if (payload.exp && payload.exp < now) {
        throw new SDKError('Token expired', SDKErrorCode.AUTHENTICATION_FAILED);
      }
      
      // Check issuer
      if (this.config.jwtValidation.issuer && payload.iss !== this.config.jwtValidation.issuer) {
        throw new SDKError('Invalid token issuer', SDKErrorCode.AUTHENTICATION_FAILED);
      }
      
      // Check audience
      if (this.config.jwtValidation.audience && payload.aud !== this.config.jwtValidation.audience) {
        throw new SDKError('Invalid token audience', SDKErrorCode.AUTHENTICATION_FAILED);
      }
      
      return payload;
    } catch (error) {
      if (error instanceof SDKError) {
        throw error;
      } else {
        throw new SDKError('Failed to decode token', SDKErrorCode.AUTHENTICATION_FAILED);
      }
    }
  }
  
  /**
   * Check if a request is within rate limits
   * @param clientId ID of the client making the request
   * @returns True if request is allowed
   */
  public checkRateLimit(clientId: string): boolean {
    if (!this.config.enableRateLimiting) {
      return true;
    }
    
    const maxRequests = this.config.rateLimiting?.maxRequests || 100;
    const windowSeconds = this.config.rateLimiting?.windowSeconds || 60;
    const now = Date.now();
    
    // Get or initialize rate limiter for this client
    let limiter = this.rateLimiters.get(clientId);
    if (!limiter || now > limiter.resetTime) {
      limiter = {
        count: 0,
        resetTime: now + (windowSeconds * 1000)
      };
      this.rateLimiters.set(clientId, limiter);
    }
    
    // Check if limit exceeded
    if (limiter.count >= maxRequests) {
      return false;
    }
    
    // Increment count and return allowed
    limiter.count++;
    return true;
  }
  
  /**
   * Sign a request for API authentication
   * @param method HTTP method
   * @param path Request path
   * @param headers Request headers
   * @param body Request body
   * @param apiKey API key
   * @returns Headers with authentication signature
   */
  public signRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any,
    apiKey?: string
  ): Record<string, string> {
    if (!this.config.enableRequestSigning) {
      return headers;
    }
    
    if (!apiKey) {
      throw new SDKError('API key required for request signing', SDKErrorCode.AUTHENTICATION_FAILED);
    }
    
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Create string to sign
    let stringToSign = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n`;
    
    // Add body hash if present
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      const bodyHash = createHash('sha256').update(bodyStr).digest('hex');
      stringToSign += bodyHash;
    }
    
    // Create HMAC signature
    const signature = crypto.createHmac('sha256', apiKey)
      .update(stringToSign)
      .digest('hex');
    
    // Add authentication headers
    return {
      ...headers,
      'X-API-Key': apiKey,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature
    };
  }
  
  /**
   * Verify a request signature
   * @param method HTTP method
   * @param path Request path
   * @param headers Request headers
   * @param body Request body
   * @returns True if signature is valid
   */
  public verifyRequestSignature(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any
  ): boolean {
    if (!this.config.enableRequestSigning) {
      return true;
    }
    
    // Extract authentication headers
    const apiKey = headers['X-API-Key'];
    const timestamp = headers['X-Timestamp'];
    const nonce = headers['X-Nonce'];
    const signature = headers['X-Signature'];
    
    if (!apiKey || !timestamp || !nonce || !signature) {
      return false;
    }
    
    // Validate API key
    if (!this.validateApiKey(apiKey)) {
      return false;
    }
    
    // Check timestamp to prevent replay attacks (within 5 minutes)
    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 300000) {
      return false;
    }
    
    // Create string to sign
    let stringToSign = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n`;
    
    // Add body hash if present
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      const bodyHash = createHash('sha256').update(bodyStr).digest('hex');
      stringToSign += bodyHash;
    }
    
    // Create HMAC signature
    const expectedSignature = crypto.createHmac('sha256', apiKey)
      .update(stringToSign)
      .digest('hex');
    
    // Compare signatures
    return signature === expectedSignature;
  }
  
  /**
   * Validate a file path to prevent path traversal
   * @param path File path to validate
   * @returns Validated path
   * @throws Error if path is invalid
   */
  public validatePath(path: string): string {
    if (!this.config.validatePaths) {
      return path;
    }
    
    return PathValidator.validatePath(path, false);
  }
  
  /**
   * Sanitize input data to prevent injection attacks
   * @param data Input data to sanitize
   * @returns Sanitized data
   */
  public sanitizeInput(data: any): any {
    if (!this.config.sanitizeInput) {
      return data;
    }
    
    if (typeof data === 'string') {
      // Sanitize string data
      return data
        .replace(/[<>]/g, '') // Remove < > characters
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+(\s*)=/gi, '') // Remove event handlers
        .trim();
    } else if (typeof data === 'object' && data !== null) {
      // Recursively sanitize object properties
      const result: Record<string, any> = Array.isArray(data) ? [] : {};
      
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = this.sanitizeInput(data[key]);
        }
      }
      
      return result;
    } else {
      // Return primitive values as is
      return data;
    }
  }
  
  /**
   * Validate and ensure TLS for a URL
   * @param url URL to validate
   * @returns Validated URL
   * @throws Error if URL is not secure
   */
  public validateTLS(url: string): string {
    if (!this.config.requireTLS) {
      return url;
    }
    
    if (!url.startsWith('https://')) {
      throw new SDKError(
        'TLS is required for all connections. URL must start with https://',
        SDKErrorCode.INVALID_PARAMETER
      );
    }
    
    return url;
  }
  
  /**
   * Generate a secure random key
   * @param length Key length in bytes
   * @returns Secure random key as hex string
   */
  public generateSecureKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Hash a password using bcrypt-like algorithm
   * @param password Password to hash
   * @param rounds Number of hashing rounds
   * @returns Hashed password
   */
  public hashPassword(password: string, rounds: number = 10): string {
    // Generate a random salt
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Hash the password multiple times
    let hash = password;
    for (let i = 0; i < rounds; i++) {
      hash = crypto
        .createHash('sha256')
        .update(salt + hash)
        .digest('hex');
    }
    
    // Return salt and hash
    return `$sdsec$v=1$r=${rounds}$${salt}$${hash}`;
  }
  
  /**
   * Verify a password against a hash
   * @param password Password to verify
   * @param hash Hash to verify against
   * @returns True if password matches
   */
  public verifyPassword(password: string, hash: string): boolean {
    // Parse the hash
    const parts = hash.split('$');
    if (parts.length !== 6 || parts[1] !== 'sdsec' || parts[2] !== 'v=1') {
      return false;
    }
    
    const roundsStr = parts[3].substring(2); // Remove 'r='
    const salt = parts[4];
    const storedHash = parts[5];
    
    const rounds = parseInt(roundsStr, 10);
    if (isNaN(rounds)) {
      return false;
    }
    
    // Hash the password with the same salt and rounds
    let calculatedHash = password;
    for (let i = 0; i < rounds; i++) {
      calculatedHash = crypto
        .createHash('sha256')
        .update(salt + calculatedHash)
        .digest('hex');
    }
    
    // Compare hashes
    return storedHash === calculatedHash;
  }
  
  /**
   * Check if a CORS request is allowed
   * @param origin Request origin
   * @param method Request method
   * @returns True if the request is allowed
   */
  public checkCORS(origin: string, method: string): boolean {
    if (!this.config.corsSettings) {
      return true;
    }
    
    const { allowedOrigins, allowedMethods } = this.config.corsSettings;
    
    // Check origin
    if (allowedOrigins.includes('*')) {
      return true;
    }
    
    if (!allowedOrigins.includes(origin)) {
      return false;
    }
    
    // Check method
    if (!allowedMethods.includes(method) && !allowedMethods.includes('*')) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Updates security configuration
   * @param config New configuration (partial)
   */
  public updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Base64URL encode a string
   * @param input Input string
   * @param isBase64 Whether input is already Base64
   * @returns Base64URL encoded string
   */
  private base64URLEncode(input: string, isBase64: boolean = false): string {
    let base64;
    
    if (isBase64) {
      base64 = input;
    } else {
      base64 = Buffer.from(input).toString('base64');
    }
    
    // Convert to base64url
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  /**
   * Base64URL decode a string
   * @param input Base64URL encoded string
   * @returns Decoded string
   */
  private base64URLDecode(input: string): string {
    // Convert from base64url to base64
    let base64 = input
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    return Buffer.from(base64, 'base64').toString();
  }
} 
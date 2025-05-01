/**
 * SDK Error Codes
 * Standardized error codes for the Decentralized Storage SDK
 */
export enum SDKErrorCode {
  // General errors
  UNKNOWN_ERROR = 'unknown_error',
  INVALID_PARAMETER = 'invalid_parameter',
  INVALID_CONFIGURATION = 'invalid_configuration',
  NOT_IMPLEMENTED = 'not_implemented',
  FEATURE_DISABLED = 'feature_disabled',
  INITIALIZATION_FAILED = 'initialization_failed',
  
  // Authentication errors
  AUTHENTICATION_FAILED = 'authentication_failed',
  INVALID_API_KEY = 'invalid_api_key',
  EXPIRED_TOKEN = 'expired_token',
  PERMISSION_DENIED = 'permission_denied',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  
  // Storage provider errors
  STORAGE_PROVIDER_ERROR = 'storage_provider_error',
  STORAGE_RETRIEVAL_ERROR = 'storage_retrieval_error',
  STORAGE_UPLOAD_ERROR = 'storage_upload_error',
  STORAGE_DELETE_ERROR = 'storage_delete_error',
  CONTENT_NOT_FOUND = 'content_not_found',
  
  // Database errors
  DATABASE_ERROR = 'database_error',
  DATABASE_CONNECTION_ERROR = 'database_connection_error',
  DATABASE_QUERY_ERROR = 'database_query_error',
  DATABASE_TRANSACTION_ERROR = 'database_transaction_error',
  
  // CDN errors
  CDN_ERROR = 'cdn_error',
  CDN_CONFIGURATION_ERROR = 'cdn_configuration_error',
  CDN_CONNECTION_ERROR = 'cdn_connection_error',
  
  // Encryption errors
  ENCRYPTION_ERROR = 'encryption_error',
  DECRYPTION_ERROR = 'decryption_error',
  KEY_GENERATION_ERROR = 'key_generation_error',
  INTEGRITY_CHECK_FAILED = 'integrity_check_failed',
  
  // Network errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  DNS_ERROR = 'dns_error',
  
  // Path and content errors
  PATH_VALIDATION_ERROR = 'path_validation_error',
  CONTENT_VALIDATION_ERROR = 'content_validation_error',
  CONTENT_SIZE_EXCEEDED = 'content_size_exceeded',
  CONTENT_TYPE_NOT_SUPPORTED = 'content_type_not_supported',
  
  // Algorithm errors
  ALGORITHM_ERROR = 'algorithm_error',
  COMPRESSION_ERROR = 'compression_error',
  DECOMPRESSION_ERROR = 'decompression_error',
  DEDUPLICATION_ERROR = 'deduplication_error',
  
  // Framework errors
  FRAMEWORK_ERROR = 'framework_error',
  FRAMEWORK_INITIALIZATION_ERROR = 'framework_initialization_error',
  
  // Analytics errors
  ANALYTICS_ERROR = 'analytics_error',
  
  // Versioning errors
  VERSIONING_ERROR = 'versioning_error',
  VERSION_NOT_FOUND = 'version_not_found'
}

/**
 * SDK Error
 * Custom error class for standardized error handling within the SDK
 */
export class SDKError extends Error {
  /**
   * Creates a new SDK Error
   * @param message Error message
   * @param code Error code
   * @param details Additional error details (optional)
   */
  constructor(
    message: string,
    public readonly code: SDKErrorCode,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'SDKError';
    this.timestamp = new Date();
    
    // Ensure stack trace works correctly in modern environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SDKError);
    }
  }
  
  /**
   * When the error occurred
   */
  public readonly timestamp: Date;
  
  /**
   * Convert the error to a plain object (useful for logging)
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: this.stack
    };
  }
  
  /**
   * Convert the error to a string with detailed information
   */
  public toDetailedString(): string {
    let result = `SDKError (${this.code}): ${this.message}\n`;
    result += `Timestamp: ${this.timestamp.toISOString()}\n`;
    
    if (this.details) {
      result += `Details: ${JSON.stringify(this.details, null, 2)}\n`;
    }
    
    if (this.stack) {
      result += `Stack: ${this.stack}\n`;
    }
    
    return result;
  }
}

/**
 * Create a storage provider error
 * @param message Error message
 * @param details Error details (optional)
 * @returns SDK Error
 */
export function createStorageProviderError(message: string, details?: any): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.STORAGE_PROVIDER_ERROR,
    details
  );
}

/**
 * Create a database error
 * @param message Error message
 * @param details Error details (optional)
 * @returns SDK Error
 */
export function createDatabaseError(message: string, details?: any): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.DATABASE_ERROR,
    details
  );
}

/**
 * Create a network error
 * @param message Error message
 * @param details Error details (optional)
 * @returns SDK Error
 */
export function createNetworkError(message: string, details?: any): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.NETWORK_ERROR,
    details
  );
}

/**
 * Create an encryption error
 * @param message Error message
 * @param details Error details (optional)
 * @returns SDK Error
 */
export function createEncryptionError(message: string, details?: any): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.ENCRYPTION_ERROR,
    details
  );
}

/**
 * Create a CDN error
 * @param message Error message
 * @param details Error details (optional)
 * @returns SDK Error
 */
export function createCDNError(message: string, details?: any): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.CDN_ERROR,
    details
  );
}

/**
 * Create an algorithm error
 * @param message Error message
 * @param details Error details (optional)
 * @returns SDK Error
 */
export function createAlgorithmError(message: string, details?: any): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.ALGORITHM_ERROR,
    details
  );
}

/**
 * Create an invalid parameter error
 * @param message Error message
 * @param paramName Name of the invalid parameter
 * @param value Invalid value
 * @param expected Expected value or type
 * @returns SDK Error
 */
export function createInvalidParameterError(
  message: string,
  paramName: string,
  value?: any,
  expected?: string
): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.INVALID_PARAMETER,
    {
      paramName,
      value,
      expected
    }
  );
}

/**
 * Create an invalid configuration error
 * @param message Error message
 * @param configPath Path to the invalid configuration
 * @param value Invalid value
 * @param expected Expected value or type
 * @returns SDK Error
 */
export function createInvalidConfigError(
  message: string,
  configPath: string,
  value?: any,
  expected?: string
): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.INVALID_CONFIGURATION,
    {
      configPath,
      value,
      expected
    }
  );
}

/**
 * Create a "not found" error
 * @param message Error message
 * @param resourceType Type of resource not found
 * @param resourceId Identifier of the resource
 * @returns SDK Error
 */
export function createNotFoundError(
  message: string,
  resourceType: string,
  resourceId: string
): SDKError {
  return new SDKError(
    message,
    SDKErrorCode.CONTENT_NOT_FOUND,
    {
      resourceType,
      resourceId
    }
  );
}

/**
 * Convert any error to an SDKError
 * @param error The error to convert
 * @param defaultMessage Default message if the error is not an Error object
 * @param defaultCode Default error code to use
 * @returns SDK Error
 */
export function convertToSDKError(
  error: any,
  defaultMessage: string = 'An unknown error occurred',
  defaultCode: SDKErrorCode = SDKErrorCode.UNKNOWN_ERROR
): SDKError {
  // If it's already an SDKError, return it as is
  if (error instanceof SDKError) {
    return error;
  }
  
  // If it's an Error object, extract the message and stack
  if (error instanceof Error) {
    return new SDKError(
      error.message,
      defaultCode,
      {
        originalError: {
          name: error.name,
          stack: error.stack
        }
      }
    );
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return new SDKError(error, defaultCode);
  }
  
  // Handle other types of errors
  return new SDKError(
    defaultMessage,
    defaultCode,
    { originalError: error }
  );
}

/**
 * Check if an error is a specific type of SDK error
 * @param error The error to check
 * @param code The error code to check for
 * @returns True if the error is an SDKError with the specified code
 */
export function isErrorOfType(error: unknown, code: SDKErrorCode): boolean {
  return error instanceof SDKError && error.code === code;
}

/**
 * Safely stringify an error for logging
 * @param error The error to stringify
 * @returns A string representation of the error
 */
export function stringifyError(error: any): string {
  if (error instanceof SDKError) {
    return error.toDetailedString();
  }
  
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\nStack: ${error.stack}`;
  }
  
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

/**
 * Log an error to the console with standardized formatting
 * @param error The error to log
 * @param context Additional context information
 */
export function logError(error: any, context?: Record<string, any>): void {
  const errorString = stringifyError(error);
  const contextString = context ? `\nContext: ${JSON.stringify(context, null, 2)}` : '';
  
  console.error(`[ERROR] ${new Date().toISOString()}${contextString}\n${errorString}`);
}

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param options Retry options
 * @returns The result of the function
 * @throws SDKError if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 300,
    maxDelayMs = 5000,
    backoffFactor = 2,
    shouldRetry = () => true
  } = options;
  
  let lastError: any;
  let delay = initialDelayMs;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw convertToSDKError(error);
      }
      
      // Log retry attempt
      console.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next attempt (with maximum)
      delay = Math.min(delay * backoffFactor, maxDelayMs);
    }
  }
  
  // This should never happen, but TypeScript needs it
  throw convertToSDKError(lastError);
} 
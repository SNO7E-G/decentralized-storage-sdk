import { createInvalidParameterError } from './ErrorHandler';

/**
 * Path Validator
 * Utility for validating file paths to prevent security issues
 */
export class PathValidator {
  /**
   * Normalizes and validates a file path to prevent path traversal and other security issues
   * @param path The path to validate
   * @param allowAbsolute Whether to allow absolute paths
   * @returns Normalized safe path
   * @throws Error if path is invalid or potentially malicious
   */
  public static validatePath(path: string, allowAbsolute: boolean = false): string {
    if (!path) {
      return '';
    }
    
    // Normalize path to prevent directory traversal
    const normalizedPath = path
      .replace(/\\/g, '/') // Convert Windows backslashes to forward slashes
      .replace(/\/\.\//g, '/') // Remove /./ sequences
      .replace(/\/+/g, '/'); // Replace multiple slashes with a single slash
    
    // Check for directory traversal attempts
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      throw createInvalidParameterError(
        'Path contains directory traversal sequences (../ or ..\\)',
        'path',
        path,
        'Path without directory traversal sequences'
      );
    }
    
    // Check for absolute paths if not allowed
    if (!allowAbsolute) {
      // Check for Unix-style absolute paths
      if (normalizedPath.startsWith('/')) {
        throw createInvalidParameterError(
          'Absolute paths are not allowed',
          'path',
          path,
          'Relative path'
        );
      }
      
      // Check for Windows-style absolute paths
      if (/^[A-Za-z]:[\\\/]/.test(normalizedPath)) {
        throw createInvalidParameterError(
          'Absolute paths are not allowed',
          'path',
          path,
          'Relative path'
        );
      }
    }
    
    // Check for suspicious path components
    const suspiciousPatterns = [
      'node_modules',  // Might indicate someone trying to access npm modules
      'proc',          // Linux /proc filesystem
      'etc',           // Linux /etc directory
      'bin',           // Binary directories
      'dev',           // Device files
      'tmp',           // Temporary directory
      '.git',          // Git repository metadata
      '.env',          // Environment files often with sensitive info
      'password',      // Files potentially containing passwords
      'credential',    // Files potentially containing credentials
      'config.json',   // Configuration files
      'secrets',       // Files potentially containing secrets
    ];
    
    const pathLower = normalizedPath.toLowerCase();
    for (const pattern of suspiciousPatterns) {
      // Check if the path contains a suspicious pattern as a whole word
      const regex = new RegExp(`(^|\\/)${pattern}(\\/|$)`, 'i');
      if (regex.test(pathLower)) {
        console.warn(`Potentially suspicious path detected: ${path} (matches pattern: ${pattern})`);
        // We don't throw here, just log a warning as this may be legitimate in some cases
      }
    }
    
    // Remove any duplicate slashes
    let cleanPath = normalizedPath;
    while (cleanPath.includes('//')) {
      cleanPath = cleanPath.replace('//', '/');
    }
    
    // Remove leading ./ if present
    if (cleanPath.startsWith('./')) {
      cleanPath = cleanPath.substring(2);
    }
    
    return cleanPath;
  }
  
  /**
   * Joins path segments safely
   * @param segments Path segments to join
   * @returns Joined path
   */
  public static joinPaths(...segments: string[]): string {
    if (segments.length === 0) {
      return '';
    }
    
    // Normalize and validate each segment
    const validSegments = segments
      .map(segment => this.validatePath(segment, false))
      .filter(segment => segment.length > 0);
    
    // Join segments with a single slash
    return validSegments.join('/');
  }
  
  /**
   * Extracts the file extension from a path
   * @param path The path to extract extension from
   * @returns File extension (lowercase, without the dot) or empty string if none
   */
  public static getFileExtension(path: string): string {
    const validPath = this.validatePath(path, true);
    const lastDotIndex = validPath.lastIndexOf('.');
    
    if (lastDotIndex === -1 || lastDotIndex === validPath.length - 1) {
      return '';
    }
    
    return validPath.slice(lastDotIndex + 1).toLowerCase();
  }
  
  /**
   * Checks if a file extension is potentially dangerous
   * @param extension File extension to check
   * @returns True if the extension is potentially dangerous
   */
  public static isDangerousExtension(extension: string): boolean {
    const dangerousExtensions = [
      'exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'com', 'scr', 'vbs', 'js', 'jse',
      'dll', 'bin', 'vb', 'reg', 'vbe', 'wsf', 'wsh', 'pif'
    ];
    
    return dangerousExtensions.includes(extension.toLowerCase());
  }
  
  /**
   * Extracts directory name from a path
   * @param path The path to extract directory from
   * @returns Directory part of the path
   */
  public static getDirname(path: string): string {
    const validPath = this.validatePath(path, true);
    const lastSlashIndex = validPath.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
      return '';
    }
    
    return validPath.slice(0, lastSlashIndex);
  }
  
  /**
   * Extracts filename from a path
   * @param path The path to extract filename from
   * @returns Filename part of the path
   */
  public static getFilename(path: string): string {
    const validPath = this.validatePath(path, true);
    const lastSlashIndex = validPath.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
      return validPath;
    }
    
    return validPath.slice(lastSlashIndex + 1);
  }
  
  /**
   * Checks if path contains only allowed characters
   * @param path Path to check
   * @returns True if path contains only allowed characters
   */
  public static hasValidCharacters(path: string): boolean {
    // Allow alphanumeric characters, dots, dashes, underscores, and slashes
    const validPathRegex = /^[a-zA-Z0-9\.\-_\/\\]+$/;
    return validPathRegex.test(path);
  }
} 
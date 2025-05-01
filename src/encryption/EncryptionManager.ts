import CryptoJS from 'crypto-js';
import { EncryptionConfig, KeyManagementStrategy } from '../core/types';
import { KeyManager } from './KeyManager';

/**
 * Default encryption configuration
 */
const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'AES-256-GCM',
  keyManagement: KeyManagementStrategy.CLIENT_SIDE
};

/**
 * Encryption Manager
 * Handles encryption and decryption of content
 */
export class EncryptionManager {
  private config: EncryptionConfig;
  private keyManager: KeyManager;
  
  /**
   * Creates a new Encryption Manager
   * @param config Encryption configuration
   */
  constructor(config?: Partial<EncryptionConfig>) {
    this.config = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
    this.keyManager = new KeyManager(this.config.keyManagement);
  }
  
  /**
   * Encrypts data using the configured algorithm
   * @param data Data to encrypt
   * @param keyOverride Optional key to use instead of the managed key
   * @returns Promise resolving to the encrypted data
   */
  public async encrypt(data: Buffer, keyOverride?: Buffer): Promise<Buffer> {
    try {
      // Use custom encryption handler if provided
      if (this.config.customHandlers?.encrypt) {
        return await this.config.customHandlers.encrypt(data, keyOverride || await this.keyManager.getEncryptionKey());
      }
      
      // Get encryption key
      const key = keyOverride?.toString('hex') || await this.keyManager.getEncryptionKeyString();
      
      // Generate a random IV (Initialization Vector)
      const iv = CryptoJS.lib.WordArray.random(16);
      
      // Convert data to WordArray
      const wordArray = CryptoJS.lib.WordArray.create(
        new Uint8Array(data) as any, 
        data.length
      );
      
      // Encrypt the data based on the algorithm
      let encryptedData: CryptoJS.lib.CipherParams;
      
      switch (this.config.algorithm) {
        case 'AES-256-GCM':
          encryptedData = CryptoJS.AES.encrypt(wordArray, key, {
            iv,
            // @ts-ignore - CryptoJS types don't include GCM mode but it's supported at runtime
            mode: CryptoJS.mode.GCM,
            padding: CryptoJS.pad.Pkcs7
          });
          break;
          
        case 'AES-256-CBC':
          encryptedData = CryptoJS.AES.encrypt(wordArray, key, {
            iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          });
          break;
          
        default:
          throw new Error(`Unsupported encryption algorithm: ${this.config.algorithm}`);
      }
      
      // Combine IV and ciphertext
      const combined = iv.concat(encryptedData.ciphertext);
      
      // Convert to Buffer
      const resultArray = Buffer.from(combined.toString(CryptoJS.enc.Hex), 'hex');
      
      return resultArray;
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Decrypts data using the configured algorithm
   * @param encryptedData Encrypted data to decrypt
   * @param keyOverride Optional key to use instead of the managed key
   * @returns Promise resolving to the decrypted data
   */
  public async decrypt(encryptedData: Buffer, keyOverride?: Buffer): Promise<Buffer> {
    try {
      // Use custom decryption handler if provided
      if (this.config.customHandlers?.decrypt) {
        return await this.config.customHandlers.decrypt(encryptedData, keyOverride || await this.keyManager.getEncryptionKey());
      }
      
      // Get encryption key
      const key = keyOverride?.toString('hex') || await this.keyManager.getEncryptionKeyString();
      
      // Convert encrypted data to hex string
      const encryptedHex = encryptedData.toString('hex');
      
      // Extract IV (first 32 hex characters = 16 bytes)
      const ivHex = encryptedHex.substring(0, 32);
      const iv = CryptoJS.enc.Hex.parse(ivHex);
      
      // Extract ciphertext (rest of the data)
      const ciphertextHex = encryptedHex.substring(32);
      const ciphertext = CryptoJS.enc.Hex.parse(ciphertextHex);
      
      // Create cipher params
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext
      });
      
      // Decrypt based on the algorithm
      let decrypted: CryptoJS.lib.WordArray;
      
      switch (this.config.algorithm) {
        case 'AES-256-GCM':
          decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
            iv,
            // @ts-ignore - CryptoJS types don't include GCM mode but it's supported at runtime
            mode: CryptoJS.mode.GCM,
            padding: CryptoJS.pad.Pkcs7
          });
          break;
          
        case 'AES-256-CBC':
          decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
            iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          });
          break;
          
        default:
          throw new Error(`Unsupported encryption algorithm: ${this.config.algorithm}`);
      }
      
      // Convert to Buffer
      const resultArray = Buffer.from(decrypted.toString(CryptoJS.enc.Hex), 'hex');
      
      return resultArray;
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Sets the encryption key for subsequent operations
   * @param key The encryption key to set
   */
  public async setEncryptionKey(key: Buffer | string): Promise<void> {
    await this.keyManager.setEncryptionKey(key);
  }
  
  /**
   * Gets the current encryption algorithm
   * @returns The current encryption algorithm
   */
  public getAlgorithm(): string {
    return this.config.algorithm;
  }
  
  /**
   * Changes the encryption algorithm
   * @param algorithm The new encryption algorithm to use
   */
  public setAlgorithm(algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'custom'): void {
    this.config.algorithm = algorithm;
  }
  
  /**
   * Gets the key management strategy
   * @returns The current key management strategy
   */
  public getKeyManagementStrategy(): KeyManagementStrategy {
    return this.config.keyManagement;
  }
  
  /**
   * Derives a secure key from a user password
   * @param password The user password
   * @param salt Optional salt value
   * @returns Promise resolving to the derived key
   */
  public deriveKeyFromPassword(password: string, salt?: string): Promise<Buffer> {
    return this.keyManager.deriveKeyFromPassword(password, salt);
  }
  
  /**
   * Generates a hash of data for integrity verification
   * @param data The data to hash
   * @returns The hash string
   */
  public generateHash(data: Buffer): string {
    const wordArray = CryptoJS.lib.WordArray.create(
      new Uint8Array(data) as any, 
      data.length
    );
    
    return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
  }
  
  /**
   * Verifies the integrity of data using a hash
   * @param data The data to verify
   * @param hash The expected hash
   * @returns True if the hash matches
   */
  public verifyIntegrity(data: Buffer, hash: string): boolean {
    const calculatedHash = this.generateHash(data);
    return calculatedHash === hash;
  }
} 
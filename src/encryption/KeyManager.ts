import CryptoJS from 'crypto-js';
import { KeyManagementStrategy } from '../core/types';

/**
 * Key Manager
 * Handles encryption key generation, storage, and retrieval
 */
export class KeyManager {
  private strategy: KeyManagementStrategy;
  private encryptionKey: Buffer | null = null;
  
  /**
   * Creates a new Key Manager
   * @param strategy Key management strategy to use
   */
  constructor(strategy: KeyManagementStrategy) {
    this.strategy = strategy;
    
    // Generate or retrieve a key when initializing
    this.initializeKey();
  }
  
  /**
   * Initializes the encryption key based on the selected strategy
   */
  private async initializeKey(): Promise<void> {
    switch (this.strategy) {
      case KeyManagementStrategy.CLIENT_SIDE:
        // For client-side, we don't automatically generate a key
        // The application should set it explicitly
        break;
        
      case KeyManagementStrategy.SERVER_SIDE:
        // Generate a new key and store it
        this.encryptionKey = await this.generateKey();
        break;
        
      case KeyManagementStrategy.HYBRID:
        // In hybrid mode, we generate a key but require a client key for operations
        this.encryptionKey = await this.generateKey();
        break;
        
      case KeyManagementStrategy.THIRD_PARTY_KMS:
        // For third-party KMS, we'd connect to an external service
        // This would be implemented in a real application
        throw new Error('Third-party KMS not implemented in this demo');
        
      default:
        throw new Error(`Unsupported key management strategy: ${this.strategy}`);
    }
  }
  
  /**
   * Generates a cryptographically secure key
   * @returns Promise resolving to the generated key
   */
  public async generateKey(): Promise<Buffer> {
    // Generate a random 256-bit key
    const keyWordArray = CryptoJS.lib.WordArray.random(32); // 32 bytes = 256 bits
    return Buffer.from(keyWordArray.toString(CryptoJS.enc.Hex), 'hex');
  }
  
  /**
   * Gets the current encryption key
   * @returns Promise resolving to the encryption key
   * @throws Error if no key is available
   */
  public async getEncryptionKey(): Promise<Buffer> {
    // If we don't have a key, generate one or throw an error
    if (!this.encryptionKey) {
      if (this.strategy === KeyManagementStrategy.CLIENT_SIDE) {
        throw new Error('No encryption key available. Set a key before using encryption.');
      } else {
        this.encryptionKey = await this.generateKey();
      }
    }
    
    return this.encryptionKey;
  }
  
  /**
   * Gets the current encryption key as a hex string
   * @returns Promise resolving to the encryption key as a hex string
   */
  public async getEncryptionKeyString(): Promise<string> {
    const key = await this.getEncryptionKey();
    return key.toString('hex');
  }
  
  /**
   * Sets the encryption key
   * @param key The encryption key to set
   */
  public async setEncryptionKey(key: Buffer | string): Promise<void> {
    if (typeof key === 'string') {
      // Convert hex string or base64 string to Buffer
      if (/^[0-9a-fA-F]+$/.test(key)) {
        // Hex string
        this.encryptionKey = Buffer.from(key, 'hex');
      } else {
        // Assume base64
        try {
          this.encryptionKey = Buffer.from(key, 'base64');
        } catch (error) {
          // If not valid base64, treat as a password and derive a key
          this.encryptionKey = await this.deriveKeyFromPassword(key);
        }
      }
    } else {
      // Already a Buffer
      this.encryptionKey = key;
    }
  }
  
  /**
   * Derives a key from a password using PBKDF2
   * @param password The password to derive a key from
   * @param salt Optional salt (a random salt will be generated if not provided)
   * @returns Promise resolving to the derived key
   */
  public async deriveKeyFromPassword(password: string, salt?: string): Promise<Buffer> {
    // Create or use the provided salt
    const saltValue = salt ? 
      CryptoJS.enc.Hex.parse(salt) : 
      CryptoJS.lib.WordArray.random(16);
    
    // Derive a key using PBKDF2
    const key = CryptoJS.PBKDF2(password, saltValue, {
      keySize: 256 / 32, // 256 bits
      iterations: 10000,
      hasher: CryptoJS.algo.SHA256
    });
    
    return Buffer.from(key.toString(CryptoJS.enc.Hex), 'hex');
  }
  
  /**
   * Rotates the encryption key
   * @returns Promise resolving to the new encryption key
   */
  public async rotateKey(): Promise<Buffer> {
    // Generate a new key
    this.encryptionKey = await this.generateKey();
    
    // In a real implementation, you would:
    // 1. Keep track of the old key for decrypting existing content
    // 2. Re-encrypt critical content with the new key
    // 3. Update key metadata in storage
    
    return this.encryptionKey;
  }
  
  /**
   * Wraps (encrypts) a data encryption key using a key encryption key
   * @param dataKey The data encryption key to wrap
   * @param keyEncryptionKey The key encryption key
   * @returns The wrapped key
   */
  public wrapKey(dataKey: Buffer, keyEncryptionKey: Buffer): Buffer {
    // Convert keys to WordArrays
    const dataKeyWordArray = CryptoJS.enc.Hex.parse(dataKey.toString('hex'));
    const kekWordArray = CryptoJS.enc.Hex.parse(keyEncryptionKey.toString('hex'));
    
    // Generate a random IV
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Encrypt the data key with the key encryption key
    const encrypted = CryptoJS.AES.encrypt(dataKeyWordArray, kekWordArray, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Combine IV and ciphertext
    const combined = iv.concat(encrypted.ciphertext);
    
    // Return as Buffer
    return Buffer.from(combined.toString(CryptoJS.enc.Hex), 'hex');
  }
  
  /**
   * Unwraps (decrypts) a wrapped data encryption key
   * @param wrappedKey The wrapped key
   * @param keyEncryptionKey The key encryption key
   * @returns The unwrapped data encryption key
   */
  public unwrapKey(wrappedKey: Buffer, keyEncryptionKey: Buffer): Buffer {
    // Convert to hex string
    const wrappedKeyHex = wrappedKey.toString('hex');
    
    // Extract IV (first 32 hex chars = 16 bytes)
    const ivHex = wrappedKeyHex.substring(0, 32);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    
    // Extract ciphertext
    const ciphertextHex = wrappedKeyHex.substring(32);
    const ciphertext = CryptoJS.enc.Hex.parse(ciphertextHex);
    
    // Convert key encryption key to WordArray
    const kekWordArray = CryptoJS.enc.Hex.parse(keyEncryptionKey.toString('hex'));
    
    // Create cipher params
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext
    });
    
    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(cipherParams, kekWordArray, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Return as Buffer
    return Buffer.from(decrypted.toString(CryptoJS.enc.Hex), 'hex');
  }
  
  /**
   * Gets the current key management strategy
   * @returns The current key management strategy
   */
  public getStrategy(): KeyManagementStrategy {
    return this.strategy;
  }
  
  /**
   * Changes the key management strategy
   * @param strategy The new key management strategy
   */
  public setStrategy(strategy: KeyManagementStrategy): void {
    this.strategy = strategy;
    
    // Re-initialize the key based on the new strategy
    this.initializeKey();
  }
} 
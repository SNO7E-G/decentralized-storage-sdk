import { Module, DynamicModule, Provider, Global, Injectable } from '@nestjs/common';
import { DecentralizedStorageSDK } from '../core/DecentralizedStorageSDK';
import { SDKConfig, StorageProviderType } from '../core/types';

/**
 * Service wrapper for the storage SDK in NestJS applications
 */
@Injectable()
export class StorageService {
  private sdk: DecentralizedStorageSDK;

  constructor(sdk: DecentralizedStorageSDK) {
    this.sdk = sdk;
  }

  /**
   * Get the underlying SDK instance
   */
  getSdk(): DecentralizedStorageSDK {
    return this.sdk;
  }

  /**
   * Upload content to storage
   * @param content Content to upload
   * @returns Storage result
   */
  async uploadContent(content: any): Promise<any> {
    return this.sdk.uploadContent(content);
  }

  /**
   * Retrieve content from storage
   * @param contentId Content ID to retrieve
   * @returns Retrieved content
   */
  async retrieveContent(contentId: string): Promise<any> {
    return this.sdk.retrieveContent(contentId);
  }

  /**
   * Delete content from storage
   * @param contentId Content ID to delete
   * @returns True if deleted successfully
   */
  async deleteContent(contentId: string): Promise<boolean> {
    return this.sdk.deleteContent(contentId);
  }

  /**
   * List content in storage
   * @param filter Optional filter criteria
   * @param limit Maximum number of items to return
   * @param skip Number of items to skip for pagination
   * @returns Storage listing
   */
  async listContent(filter: Record<string, any> = {}, limit: number = 100, skip: number = 0): Promise<any> {
    return this.sdk.listContent(filter, limit, skip);
  }

  /**
   * Get content metadata
   * @param contentId Content ID
   * @returns Content metadata
   */
  async getContentMetadata(contentId: string): Promise<any> {
    return this.sdk.getContentMetadata(contentId);
  }

  /**
   * Update existing content
   * @param contentId Content ID to update
   * @param content New content data
   * @returns Updated storage result
   */
  async updateContent(contentId: string, content: any): Promise<any> {
    return this.sdk.updateContent(contentId, content);
  }

  /**
   * Get content versions
   * @param contentId Content ID
   * @returns Version history
   */
  async getContentVersions(contentId: string): Promise<any[]> {
    return this.sdk.getContentVersions(contentId);
  }

  /**
   * Retrieve a specific version of content
   * @param contentId Content ID
   * @param versionId Version ID
   * @returns Retrieved content version
   */
  async retrieveVersion(contentId: string, versionId: string): Promise<any> {
    return this.sdk.retrieveVersion(contentId, versionId);
  }

  /**
   * Get analytics data
   * @param filters Optional filters
   * @returns Analytics data
   */
  async getAnalytics(filters?: any): Promise<any> {
    return this.sdk.getAnalytics(filters);
  }

  /**
   * Purge content from CDN cache
   * @param contentId Content ID
   * @returns True if purged successfully
   */
  async purgeCDNCache(contentId: string): Promise<boolean> {
    return this.sdk.purgeCDNCache(contentId);
  }

  /**
   * Get CDN status
   * @returns CDN status information
   */
  async getCDNStatus(): Promise<any> {
    return this.sdk.getCDNStatus();
  }

  /**
   * Get storage statistics
   * @returns Storage statistics
   */
  async getStorageStats(): Promise<any> {
    return this.sdk.getStorageStats();
  }

  /**
   * Close all SDK connections
   */
  async close(): Promise<void> {
    return this.sdk.close();
  }
}

/**
 * SDK Module Options
 */
export interface StorageSdkModuleOptions {
  /** SDK Configuration */
  config: Partial<SDKConfig>;
  /** Whether to initialize SDK on module load */
  autoInitialize?: boolean;
  /** Global configuration */
  isGlobal?: boolean;
}

/**
 * NestJS Module for the Decentralized Storage SDK
 */
@Global()
@Module({})
export class StorageSdkModule {
  /**
   * Register the module with options
   * @param options Module options
   * @returns Dynamic module
   */
  static register(options: StorageSdkModuleOptions): DynamicModule {
    const sdkProvider: Provider = {
      provide: DecentralizedStorageSDK,
      useFactory: async () => {
        const sdk = new DecentralizedStorageSDK(options.config);
        
        if (options.autoInitialize !== false) {
          await sdk.initialize();
        }
        
        return sdk;
      }
    };
    
    const serviceProvider: Provider = {
      provide: StorageService,
      useFactory: (sdk: DecentralizedStorageSDK) => {
        return new StorageService(sdk);
      },
      inject: [DecentralizedStorageSDK]
    };

    return {
      module: StorageSdkModule,
      providers: [sdkProvider, serviceProvider],
      exports: [DecentralizedStorageSDK, StorageService],
      global: options.isGlobal !== false
    };
  }
}

/**
 * Usage Example:
 * 
 * // In your app.module.ts:
 * @Module({
 *   imports: [
 *     StorageSdkModule.register({
 *       config: {
 *         storageProvider: StorageProviderType.IPFS,
 *         apiKey: process.env.STORAGE_API_KEY,
 *         enableCDN: true
 *       },
 *       autoInitialize: true,
 *       isGlobal: true
 *     })
 *   ]
 * })
 * export class AppModule {}
 * 
 * // In your service:
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly storageService: StorageService) {}
 * 
 *   async uploadFile(file: Buffer, filename: string): Promise<string> {
 *     const result = await this.storageService.uploadContent({
 *       data: file,
 *       mimeType: 'application/octet-stream',
 *       filename
 *     });
 *     
 *     return result.publicUrl;
 *   }
 * }
 */

/**
 * Controller Decorators
 */
export function StorageController(): ClassDecorator {
  return function(target: any) {
    // Define decorators and metadata for StorageControllers
    Reflect.defineMetadata('storage:controller', true, target);
  };
}

/**
 * Method Decorators
 */
export function UploadContent(): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Add metadata for route handling
    Reflect.defineMetadata('storage:method', 'uploadContent', target, propertyKey);
    return descriptor;
  };
}

export function RetrieveContent(): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('storage:method', 'retrieveContent', target, propertyKey);
    return descriptor;
  };
}

export function DeleteContent(): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('storage:method', 'deleteContent', target, propertyKey);
    return descriptor;
  };
}

/**
 * Parameter Decorators
 */
export function ContentFile(): ParameterDecorator {
  return function(target: any, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata('storage:param:contentFile', parameterIndex, target, propertyKey);
  };
}

export function ContentId(): ParameterDecorator {
  return function(target: any, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata('storage:param:contentId', parameterIndex, target, propertyKey);
  };
}

export function ContentOptions(): ParameterDecorator {
  return function(target: any, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata('storage:param:options', parameterIndex, target, propertyKey);
  };
}

/**
 * Example of a NestJS controller using decorators:
 * 
 * @StorageController()
 * export class FileController {
 *   constructor(private storageService: StorageService) {}
 * 
 *   @UploadContent()
 *   async uploadFile(@ContentFile() file: any, @ContentOptions() options: any): Promise<any> {
 *     return this.storageService.uploadContent({
 *       data: file.buffer,
 *       mimeType: file.mimetype,
 *       filename: file.originalname,
 *       ...options
 *     });
 *   }
 * 
 *   @RetrieveContent()
 *   async getFile(@ContentId() id: string): Promise<any> {
 *     return this.storageService.retrieveContent(id);
 *   }
 * 
 *   @DeleteContent()
 *   async deleteFile(@ContentId() id: string): Promise<boolean> {
 *     return this.storageService.deleteContent(id);
 *   }
 * }
 */ 
import { FrameworkConfig, FrameworkType } from '../core/types';
import { DecentralizedStorageSDK } from '../core/DecentralizedStorageSDK';

/**
 * Framework Manager
 * Handles integration with various frameworks
 */
export class FrameworkManager {
  private config: FrameworkConfig;
  
  /**
   * Creates a new Framework Manager
   * @param config Framework configuration
   */
  constructor(config: FrameworkConfig) {
    this.config = config;
  }
  
  /**
   * Binds the SDK to the specified framework
   * @param sdk The Decentralized Storage SDK instance
   * @param framework Optional framework instance
   * @returns Framework-specific integration
   */
  public bind(sdk: any, frameworkInstance?: any): any {
    if (!this.config) {
      throw new Error('Framework configuration is required');
    }

    switch (this.config.frameworkType) {
      case FrameworkType.REACT:
        const { createReactBindings } = require('./react/ReactBindings');
        return createReactBindings(sdk, this.config.settings);
      case FrameworkType.REACT_NATIVE:
        const { createReactNativeBindings } = require('./react-native/ReactNativeBindings');
        return createReactNativeBindings(sdk, this.config.settings);
      case FrameworkType.ANGULAR:
        const { createAngularBindings } = require('./angular/AngularBindings');
        return createAngularBindings(sdk, frameworkInstance, this.config.settings);
      case FrameworkType.VUE:
        const { createVueBindings } = require('./vue/VueBindings');
        return createVueBindings(sdk, this.config.settings);
      case FrameworkType.SVELTE:
        const { createSvelteBindings } = require('./svelte/SvelteBindings');
        return createSvelteBindings(sdk, this.config.settings);
      case FrameworkType.EXPRESS:
        const { createExpressBindings } = require('./express/ExpressBindings');
        return createExpressBindings(sdk, frameworkInstance, this.config.settings);
      case FrameworkType.NEXT:
        const { createNextBindings } = require('./next/NextBindings');
        return createNextBindings(sdk, this.config.settings);
      case FrameworkType.NUXT:
        const { createNuxtBindings } = require('./nuxt/NuxtBindings');
        return createNuxtBindings(sdk, this.config.settings);
      case FrameworkType.NESTJS:
        const { StorageSdkModule } = require('./NestJSModule');
        return StorageSdkModule.register({
          config: this.config.settings || {},
          autoInitialize: true
        });
      case FrameworkType.REMIX:
        const { createRemixBindings } = require('./remix/RemixBindings');
        return createRemixBindings(sdk, this.config.settings);
      case FrameworkType.ASTRO:
        const { createAstroBindings } = require('./astro/AstroBindings');
        return createAstroBindings(sdk, this.config.settings);
      case FrameworkType.SOLID:
        const { createSolidBindings } = require('./solid/SolidBindings');
        return createSolidBindings(sdk, this.config.settings);
      case FrameworkType.LARAVEL:
        const { createLaravelBindings } = require('./laravel/LaravelBindings');
        return createLaravelBindings(sdk, this.config.settings);
      case FrameworkType.DJANGO:
        const { createDjangoBindings } = require('./django/DjangoBindings');
        return createDjangoBindings(sdk, this.config.settings);
      case FrameworkType.NONE:
        // No framework bindings needed
        return sdk;
      default:
        throw new Error(`Unsupported framework type: ${this.config.frameworkType}`);
    }
  }
  
  /**
   * Updates framework configuration
   * @param config New configuration (partial)
   */
  public updateConfig(config: Partial<FrameworkConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Gets the current framework configuration
   * @returns Current framework configuration
   */
  public getConfig(): FrameworkConfig {
    return this.config;
  }
} 
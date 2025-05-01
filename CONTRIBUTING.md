# Contributing to Decentralized Storage SDK

Thank you for your interest in contributing to Decentralized Storage SDK! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate of others.

## How to Contribute

There are several ways to contribute to this project:

1. **Report Issues**: Submit bugs, suggest new features, or help us improve documentation.
2. **Submit Pull Requests**: Propose code changes or documentation improvements.
3. **Review Pull Requests**: Help review and test submitted pull requests.
4. **Answer Questions**: Help answer questions in issues and discussions.

## Development Setup

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/decentralized-storage-sdk.git
   cd decentralized-storage-sdk
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```

## Development Workflow

1. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes and ensure they follow our coding standards.
3. Write or update tests for your changes.
4. Run the tests:
   ```bash
   npm test
   ```
5. Run the linter:
   ```bash
   npm run lint
   ```
6. Commit your changes with clear, descriptive commit messages.
7. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
8. Submit a pull request to the main repository.

## Pull Request Process

1. Make sure your PR addresses a specific issue or adds a valuable feature.
2. Include a clear description of the changes and why they are needed.
3. Make sure all tests pass and the code is properly linted.
4. Update documentation as needed.
5. A maintainer will review your PR and may request changes.
6. Once approved, your PR will be merged.

## Code Style and Standards

- Follow the existing code style in the project.
- Use TypeScript for all new code.
- Include JSDoc comments for all public APIs.
- Write tests for all new functionality.
- Ensure backward compatibility where possible.

## Adding Support for New Storage Providers

To add support for a new storage provider:

1. Create a new file in `src/storage/` (e.g., `NewProviderStorageProvider.ts`).
2. Implement the `StorageProvider` interface.
3. Add the new provider to the `StorageProviderType` enum in `src/core/types.ts`.
4. Add provider instantiation logic in the SDK's `initializeStorageProvider` method.
5. Add documentation for the new provider.
6. Add tests for the new provider in `tests/storage/`.

## Adding Support for New Databases

To add support for a new database:

1. Create a new file in `src/database/` (e.g., `NewDatabaseProvider.ts`).
2. Implement the required database operations with the following functionality:
   - Connection management (connect, disconnect)
   - Metadata storage (store, retrieve, update, delete)
   - Analytics event storage and querying
   - Version history management
   - User data management (if applicable)
3. Add the new database to the `DatabaseProvider` enum in `src/core/types.ts`.
4. Add database instantiation logic in the SDK's `initializeDatabase` method.
5. Add proper TypeScript typings and interfaces.
6. Implement error handling with detailed error messages.
7. Create unit tests in `tests/database/`.
8. Create an example usage file in the `examples/` directory.
9. Update the README.md to reflect the new database support.

### Database Provider Implementation Example

Here's a basic structure for implementing a new database provider:

```typescript
import { 
  AnalyticsEvent, 
  ContentMetadata, 
  VersionInfo
} from '../core/types';

export class NewDatabaseProvider {
  // Properties for connection management
  private connection: any;
  private connected: boolean = false;
  
  constructor(connectionOptions: {
    // Define connection options specific to this database
  }) {
    // Initialize connection properties
  }
  
  /**
   * Connect to the database
   */
  public async connect(): Promise<void> {
    // Implement connection logic
  }
  
  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    // Implement disconnection logic
  }
  
  /**
   * Store content metadata
   */
  public async storeMetadata(metadata: ContentMetadata): Promise<ContentMetadata> {
    // Implement metadata storage logic
  }
  
  /**
   * Retrieve content metadata
   */
  public async getMetadata(contentId: string): Promise<ContentMetadata | null> {
    // Implement metadata retrieval logic
  }
  
  /**
   * Store analytics event
   */
  public async storeAnalyticsEvent(event: AnalyticsEvent): Promise<string> {
    // Implement event storage logic
  }
  
  /**
   * Store version information
   */
  public async storeVersion(contentId: string, versionInfo: VersionInfo): Promise<string> {
    // Implement version storage logic
  }
  
  // Add other required methods...
}
```

## Adding Framework Integrations

To add support for a new framework:

1. Create appropriate files in `src/frameworks/` (e.g., `NewFrameworkIntegration.ts`).
2. Implement framework-specific components, hooks, or utilities.
3. Add the new framework to the `FrameworkType` enum in `src/core/types.ts`.
4. Add documentation for the new framework integration.
5. Add example usage in the `examples/` directory.

## Documentation

- Update the README.md file for any user-facing changes.
- Update or create relevant examples in the examples directory.
- Add JSDoc comments to all public APIs.
- Run `npm run docs` to generate API documentation.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT license.

## Questions?

If you have any questions or need help, please open an issue or contact the project maintainers.

Thank you for contributing to Decentralized Storage SDK!

---

Maintained by Mahmoud Ashraf (SNO7E) - [@SNO7E-G](https://github.com/SNO7E-G) 
# Advanced Algorithms

The Decentralized Storage SDK features several advanced algorithms to optimize content storage, retrieval, and discovery. This section documents the algorithms available and how to configure them.

## Content Compression

Compression reduces the storage footprint of your content, saving bandwidth and storage costs.

### Supported Compression Algorithms

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| Gzip | General-purpose compression algorithm with good balance between speed and compression ratio | Text files, JSON, HTML, most typical content |
| Brotli | Offers better compression ratio than Gzip but slower | Static content, production environments where compression is done ahead of time |
| Zstd | Fast compression with good ratio | Large files, streaming content |
| Custom | Implement your own compression algorithm | Special use cases requiring domain-specific compression |

### Configuration

```typescript
// Configure during SDK initialization
const sdk = new DecentralizedStorageSDK({
  // ...other options
  algorithmsConfig: {
    compression: {
      enabled: true,
      algorithm: 'gzip', // 'gzip', 'brotli', 'zstd', or 'custom'
      level: 6, // 1-9 for gzip/zstd, 1-11 for brotli (higher = better compression but slower)
      failSafe: true, // Return original data if compression fails
      customHandlers: {
        // Only needed for 'custom' algorithm
        compress: async (data: Buffer) => {
          // Custom compression logic
          return compressedBuffer;
        },
        decompress: async (data: Buffer) => {
          // Custom decompression logic
          return decompressedBuffer;
        }
      }
    }
  }
});
```

### Usage

The compression is automatically applied when uploading content based on your configuration. The SDK handles decompression transparently when retrieving content.

## Content Deduplication

Deduplication prevents storing identical content multiple times, saving storage space and bandwidth.

### Deduplication Methods

1. **Exact Matching**: Uses SHA-256 hashing to identify identical content
2. **Similarity Detection**: Identifies content that is nearly identical using perceptual hashing (configurable)

### Configuration

```typescript
// Configure during SDK initialization
const sdk = new DecentralizedStorageSDK({
  // ...other options
  algorithmsConfig: {
    deduplication: {
      enabled: true,
      detectSimilarContent: true, // Enable similarity detection
      similarityThreshold: 0.95, // 0-1, higher means more strict matching
      chunkSize: 8192 // Chunk size for processing large files
    }
  }
});
```

### Usage

Deduplication happens automatically during content upload. When a duplicate is detected, the SDK returns the existing content details instead of storing a new copy:

```typescript
// Try to upload content
const result = await sdk.uploadContent({
  data: Buffer.from('Hello, World!'),
  mimeType: 'text/plain'
});

// If this exact content was uploaded before, result will contain
// the contentId of the previously uploaded content
console.log('Content ID:', result.contentId);
console.log('Is duplicate:', result.isDuplicate); // true if duplicate was found
```

## Content Recommendation

The SDK includes a recommendation system to suggest related content based on various signals.

### Recommendation Algorithms

| Algorithm | Description | Best For |
|-----------|-------------|----------|
| Collaborative Filtering | Recommends content based on similar users' behaviors | Systems with many users and interactions |
| Content-Based | Recommends content based on content similarity | Systems with rich content metadata |
| Hybrid | Combines collaborative and content-based approaches | Most general use cases |
| Custom | Implement your own recommendation algorithm | Specialized recommendation needs |

### Configuration

```typescript
// Configure during SDK initialization
const sdk = new DecentralizedStorageSDK({
  // ...other options
  algorithmsConfig: {
    contentRecommendation: {
      enabled: true,
      algorithm: 'hybrid', // 'collaborative-filtering', 'content-based', 'hybrid', or 'custom'
      maxRecommendations: 10, // Maximum recommendations to return
      trainingInterval: 3600000, // How often to retrain models (in ms)
      customHandler: async (userId, contentId, limit) => {
        // Custom recommendation logic
        return recommendedContentIds;
      }
    }
  }
});
```

### Usage

```typescript
// Record user views for better recommendations
sdk.recordContentView('user123', 'content456', {
  viewDuration: 120, // seconds
  completionPercentage: 0.75
});

// Get recommendations
const recommendations = await sdk.getContentRecommendations('user123', 'content456', 5);

// Display recommendations
recommendations.forEach(rec => {
  console.log(`${rec.contentId} (Score: ${rec.relevanceScore}): ${rec.reason}`);
});
```

## Content Analysis

The SDK can analyze content to extract metadata and features which can be used for search, filtering, and recommendations.

### Analysis Capabilities

| Content Type | Features Extracted |
|--------------|-------------------|
| Images | Dimensions, color profile, dominant colors, quality score |
| Videos | Duration, resolution, format, bitrate |
| Audio | Duration, format, bitrate, quality |
| Text | Word count, language detection, readability, keyword extraction |
| Generic | Size, basic file format information |

### Usage

```typescript
// Analyze content
const analysis = await sdk.analyzeContent(fileBuffer, 'image/jpeg');

console.log('Content type:', analysis.contentType);
console.log('Quality score:', analysis.qualityScore);
console.log('Features:', analysis.features);
console.log('Tags:', analysis.tags);
```

## Smart Caching

The SDK includes intelligent caching strategies to optimize content delivery.

### Caching Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| Standard | Basic time-based caching | General purpose |
| Aggressive | Long-lived cache with proactive refreshing | Static content, high traffic |
| Minimal | Short-lived cache, frequent validation | Frequently changing content |
| Custom | Implement your own caching rules | Special caching requirements |

### Configuration

```typescript
// Configure during SDK initialization
const sdk = new DecentralizedStorageSDK({
  // ...other options
  cdnConfig: {
    provider: CDNProviderType.CLOUDFLARE,
    cachingStrategy: CachingStrategy.AGGRESSIVE,
    ttl: 86400, // 1 day in seconds
    enableGeoDistribution: true
  }
});
```

## Performance Considerations

- **Compression**: Higher compression levels increase CPU usage during upload but reduce bandwidth and storage costs.
- **Deduplication**: Content similarity detection adds CPU overhead but can save significant storage space.
- **Recommendations**: The quality of recommendations improves as more usage data is collected.
- **Content Analysis**: Adds processing time during upload but enables better search and recommendation capabilities.

## Implementation Details

For more information on the implementation of these algorithms, see the [AlgorithmManager](../../src/algorithms/AlgorithmManager.ts) source code.

```typescript
// Directly access algorithm functions
const { algorithmManager } = sdk;

// Compress data manually
const compressed = await algorithmManager.compressData(buffer);

// Check for duplicates
const dupeCheck = await algorithmManager.checkForDuplicates(buffer);
if (dupeCheck.found) {
  console.log(`Duplicate found: ${dupeCheck.contentId}`);
}

// Analyze content
const analysis = await algorithmManager.analyzeContent(buffer, 'image/png');
``` 
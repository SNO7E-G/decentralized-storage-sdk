import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DecentralizedStorageSDK } from '../core/DecentralizedStorageSDK';
import { 
  SDKConfig, 
  StorageResult, 
  ContentToUpload, 
  RetrievedContent,
  ContentMetadata,
  StorageListing
} from '../core/types';

// Create context for the SDK
const StorageSDKContext = createContext<{
  sdk: DecentralizedStorageSDK | null;
  initialized: boolean;
  error: Error | null;
}>({
  sdk: null,
  initialized: false,
  error: null
});

// Props for the provider component
interface StorageSDKProviderProps {
  config: Partial<SDKConfig>;
  children: React.ReactNode;
}

/**
 * Provider component for the Decentralized Storage SDK
 */
export const StorageSDKProvider: React.FC<StorageSDKProviderProps> = ({ 
  config, 
  children 
}: StorageSDKProviderProps) => {
  const [sdk, setSdk] = useState<DecentralizedStorageSDK | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    try {
      // Initialize the SDK
      const newSdk = new DecentralizedStorageSDK(config);
      setSdk(newSdk);
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [config]);
  
  return (
    <StorageSDKContext.Provider value={{ sdk, initialized, error }}>
      {children}
    </StorageSDKContext.Provider>
  );
};

/**
 * Hook to use the Storage SDK
 */
export const useStorageSDK = () => {
  const context = useContext(StorageSDKContext);
  
  if (!context) {
    throw new Error('useStorageSDK must be used within a StorageSDKProvider');
  }
  
  return context;
};

/**
 * Hook for uploading content
 */
export const useContentUpload = () => {
  const { sdk, initialized } = useStorageSDK();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<StorageResult | null>(null);
  
  const uploadContent = useCallback(async (content: ContentToUpload) => {
    if (!sdk) {
      setError(new Error('SDK not initialized'));
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const uploadResult = await sdk.uploadContent(content);
      setResult(uploadResult);
      return uploadResult;
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error(String(err));
      setError(uploadError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sdk]);
  
  return { uploadContent, loading, error, result };
};

/**
 * Hook for retrieving content
 */
export const useContentRetrieval = () => {
  const { sdk } = useStorageSDK();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [content, setContent] = useState<RetrievedContent | null>(null);
  
  const retrieveContent = useCallback(async (contentId: string) => {
    if (!sdk) {
      setError(new Error('SDK not initialized'));
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const retrievedContent = await sdk.retrieveContent(contentId);
      setContent(retrievedContent);
      return retrievedContent;
    } catch (err) {
      const retrievalError = err instanceof Error ? err : new Error(String(err));
      setError(retrievalError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sdk]);
  
  return { retrieveContent, loading, error, content };
};

/**
 * Hook for listing content
 */
export const useContentListing = (autoLoad: boolean = false) => {
  const { sdk } = useStorageSDK();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [listing, setListing] = useState<StorageListing | null>(null);
  
  const listContent = useCallback(async () => {
    if (!sdk) {
      setError(new Error('SDK not initialized'));
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const contentListing = await sdk.listContent();
      setListing(contentListing);
      return contentListing;
    } catch (err) {
      const listingError = err instanceof Error ? err : new Error(String(err));
      setError(listingError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sdk]);
  
  useEffect(() => {
    if (autoLoad && sdk) {
      listContent();
    }
  }, [autoLoad, sdk, listContent]);
  
  return { listContent, loading, error, listing };
};

/**
 * Hook for deleting content
 */
export const useContentDeletion = () => {
  const { sdk } = useStorageSDK();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  
  const deleteContent = useCallback(async (contentId: string) => {
    if (!sdk) {
      setError(new Error('SDK not initialized'));
      return false;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await sdk.deleteContent(contentId);
      setSuccess(result);
      return result;
    } catch (err) {
      const deletionError = err instanceof Error ? err : new Error(String(err));
      setError(deletionError);
      return false;
    } finally {
      setLoading(false);
    }
  }, [sdk]);
  
  return { deleteContent, loading, error, success };
};

/**
 * Hook for getting content metadata
 */
export const useContentMetadata = (contentId?: string) => {
  const { sdk } = useStorageSDK();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  
  const getMetadata = useCallback(async (id: string) => {
    if (!sdk) {
      setError(new Error('SDK not initialized'));
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const contentMetadata = await sdk.getContentMetadata(id);
      setMetadata(contentMetadata);
      return contentMetadata;
    } catch (err) {
      const metadataError = err instanceof Error ? err : new Error(String(err));
      setError(metadataError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sdk]);
  
  useEffect(() => {
    if (contentId && sdk) {
      getMetadata(contentId);
    }
  }, [contentId, sdk, getMetadata]);
  
  return { getMetadata, loading, error, metadata };
};

// File upload component props
interface FileUploadProps {
  onUploadStart?: () => void;
  onUploadComplete?: (result: StorageResult) => void;
  onUploadError?: (error: Error) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number; // in bytes
  className?: string;
  buttonText?: string;
}

/**
 * File Upload Component
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onUploadStart,
  onUploadComplete,
  onUploadError,
  multiple = false,
  accept,
  maxSize,
  className,
  buttonText = 'Upload File'
}) => {
  const { uploadContent, loading } = useContentUpload();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    
    if (!files || files.length === 0) {
      return;
    }
    
    onUploadStart?.();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size if maxSize is specified
      if (maxSize && file.size > maxSize) {
        const error = new Error(`File size exceeds the maximum allowed size (${maxSize} bytes)`);
        onUploadError?.(error);
        continue;
      }
      
      // Read file as buffer
      const fileData = await readFileAsBuffer(file);
      
      // Create content upload object
      const content: ContentToUpload = {
        data: fileData,
        mimeType: file.type || 'application/octet-stream',
        filename: file.name,
        metadata: {
          lastModified: file.lastModified,
          size: file.size
        }
      };
      
      try {
        const result = await uploadContent(content);
        
        if (result) {
          onUploadComplete?.(result);
        }
      } catch (error) {
        onUploadError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Helper function to read file as buffer
  const readFileAsBuffer = (file: File): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(Buffer.from(reader.result));
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };
      
      reader.onerror = () => {
        reject(reader.error || new Error('Unknown error reading file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  };
  
  return (
    <div className={className}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        multiple={multiple}
        accept={accept}
      />
      <button 
        onClick={handleButtonClick} 
        disabled={loading}
      >
        {loading ? 'Uploading...' : buttonText}
      </button>
    </div>
  );
};

// Content viewer component props
interface ContentViewerProps {
  contentId: string;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: (content: RetrievedContent) => void;
  onError?: (error: Error) => void;
}

/**
 * Content Viewer Component
 */
export const ContentViewer: React.FC<ContentViewerProps> = ({
  contentId,
  fallback = <div>Loading...</div>,
  errorFallback = <div>Error loading content</div>,
  className,
  style,
  onLoad,
  onError
}) => {
  const { retrieveContent, loading, error, content } = useContentRetrieval();
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (contentId) {
      retrieveContent(contentId);
    }
  }, [contentId, retrieveContent]);
  
  useEffect(() => {
    if (content) {
      onLoad?.(content);
      
      // Create object URL for the content
      const blob = new Blob([content.data], { type: content.metadata.mimeType });
      const url = URL.createObjectURL(blob);
      setContentUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [content, onLoad]);
  
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);
  
  if (loading) {
    return <>{fallback}</>;
  }
  
  if (error || !content || !contentUrl) {
    return <>{errorFallback}</>;
  }
  
  // Render based on content type
  const mimeType = content.metadata.mimeType || '';
  
  if (mimeType.startsWith('image/')) {
    return <img src={contentUrl} alt={content.metadata.filename || 'Image'} className={className} style={style} />;
  } else if (mimeType.startsWith('video/')) {
    return (
      <video controls className={className} style={style}>
        <source src={contentUrl} type={mimeType} />
        Your browser does not support the video tag.
      </video>
    );
  } else if (mimeType.startsWith('audio/')) {
    return (
      <audio controls className={className} style={style}>
        <source src={contentUrl} type={mimeType} />
        Your browser does not support the audio tag.
      </audio>
    );
  } else if (mimeType === 'application/pdf') {
    return (
      <iframe 
        src={contentUrl} 
        className={className} 
        style={Object.assign({}, style, { width: '100%', height: '500px' })}
        title={content.metadata.filename || 'PDF Document'}
      />
    );
  } else if (mimeType === 'text/plain' || mimeType === 'text/html' || mimeType.includes('json')) {
    // For text content, display it directly
    const textContent = new TextDecoder().decode(content.data);
    return (
      <pre className={className} style={style}>
        {textContent}
      </pre>
    );
  } else {
    // For other types, provide a download link
    return (
      <div className={className} style={style}>
        <p>Content type: {mimeType}</p>
        <p>Filename: {content.metadata.filename || 'Unknown'}</p>
        <a href={contentUrl} download={content.metadata.filename || undefined}>
          Download File
        </a>
      </div>
    );
  }
}; 
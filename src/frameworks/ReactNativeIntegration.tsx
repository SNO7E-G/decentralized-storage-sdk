import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { DecentralizedStorageSDK } from '../core/DecentralizedStorageSDK';
import { SDKConfig, ContentToUpload, StorageResult, ContentMetadata, RetrievedContent } from '../core/types';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

/**
 * React Native Integration for Decentralized Storage SDK
 * 
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */

// Context for providing SDK instance
interface SDKContextValue {
  sdk: DecentralizedStorageSDK | null;
  initialized: boolean;
  initializing: boolean;
  error: Error | null;
  initializeSDK: () => Promise<void>;
  closeSDK: () => Promise<void>;
}

const SDKContext = createContext<SDKContextValue>({
  sdk: null,
  initialized: false,
  initializing: false,
  error: null,
  initializeSDK: async () => {},
  closeSDK: async () => {}
});

interface SDKProviderProps {
  config: SDKConfig;
  children: ReactNode;
  autoInitialize?: boolean;
}

/**
 * Provider component for SDK context
 */
export const StorageSDKProvider: React.FC<SDKProviderProps> = ({ 
  config, 
  children,
  autoInitialize = true 
}) => {
  const [sdk, setSdk] = useState<DecentralizedStorageSDK | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Initialize SDK function
  const initializeSDK = useCallback(async () => {
    if (initializing || initialized) return;
    
    setInitializing(true);
    setError(null);
    
    try {
      const newSdk = new DecentralizedStorageSDK(config);
      await newSdk.initialize();
      setSdk(newSdk);
      setInitialized(true);
      console.log('Decentralized Storage SDK initialized successfully');
    } catch (err) {
      console.error('Failed to initialize SDK:', err);
      setError(err instanceof Error ? err : new Error('Unknown error initializing SDK'));
    } finally {
      setInitializing(false);
    }
  }, [config, initializing, initialized]);
  
  // Close SDK function
  const closeSDK = useCallback(async () => {
    if (sdk) {
      try {
        await sdk.close();
        setSdk(null);
        setInitialized(false);
        console.log('Decentralized Storage SDK closed successfully');
      } catch (err) {
        console.error('Error closing SDK:', err);
      }
    }
  }, [sdk]);
  
  // Auto-initialize on mount if enabled
  useEffect(() => {
    if (autoInitialize) {
      initializeSDK();
    }
    
    // Cleanup on unmount
    return () => {
      if (sdk) {
        sdk.close().catch(err => console.error('Error closing SDK on unmount:', err));
      }
    };
  }, [autoInitialize, initializeSDK, sdk]);
  
  const contextValue: SDKContextValue = {
    sdk,
    initialized,
    initializing,
    error,
    initializeSDK,
    closeSDK
  };
  
  return (
    <SDKContext.Provider value={contextValue}>
      {children}
    </SDKContext.Provider>
  );
};

/**
 * Hook for using the SDK context
 */
export const useStorageSDK = () => {
  const context = useContext(SDKContext);
  
  if (!context) {
    throw new Error('useStorageSDK must be used within a StorageSDKProvider');
  }
  
  return context;
};

// Content upload hook
interface UseContentUploadResult {
  uploadContent: (content: ContentToUpload) => Promise<StorageResult>;
  uploadFile: (fileUri: string, mimeType?: string, filename?: string) => Promise<StorageResult>;
  loading: boolean;
  result: StorageResult | null;
  error: Error | null;
}

/**
 * Hook for content upload
 */
export const useContentUpload = (): UseContentUploadResult => {
  const { sdk, initialized } = useStorageSDK();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StorageResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const uploadContent = useCallback(async (content: ContentToUpload): Promise<StorageResult> => {
    if (!sdk || !initialized) {
      const err = new Error('SDK not initialized');
      setError(err);
      throw err;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const uploadResult = await sdk.uploadContent(content);
      setResult(uploadResult);
      return uploadResult;
    } catch (err) {
      console.error('Error uploading content:', err);
      const error = err instanceof Error ? err : new Error('Unknown error uploading content');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [sdk, initialized]);
  
  const uploadFile = useCallback(async (
    fileUri: string, 
    mimeType?: string, 
    filename?: string
  ): Promise<StorageResult> => {
    // Get file info
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (!fileInfo.exists) {
        throw new Error(`File does not exist: ${fileUri}`);
      }
      
      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Convert to buffer
      const data = Buffer.from(base64Data, 'base64');
      
      // Get filename if not provided
      const extractedFilename = filename || fileUri.split('/').pop() || 'unknown_file';
      
      // Detect mime type if not provided
      const detectedMimeType = mimeType || getMimeTypeFromFilename(extractedFilename);
      
      // Create content object
      const content: ContentToUpload = {
        data,
        mimeType: detectedMimeType,
        filename: extractedFilename,
        metadata: {
          size: fileInfo.size
        }
      };
      
      return uploadContent(content);
    } catch (err) {
      console.error('Error uploading file:', err);
      const error = err instanceof Error ? err : new Error('Unknown error uploading file');
      setError(error);
      throw error;
    }
  }, [uploadContent]);
  
  return {
    uploadContent,
    uploadFile,
    loading,
    result,
    error
  };
};

// Content retrieval hook
interface UseContentRetrievalResult {
  retrieveContent: (contentId: string) => Promise<RetrievedContent>;
  saveContentToFile: (contentId: string, fileUri?: string) => Promise<string>;
  loading: boolean;
  content: RetrievedContent | null;
  error: Error | null;
}

/**
 * Hook for content retrieval
 */
export const useContentRetrieval = (): UseContentRetrievalResult => {
  const { sdk, initialized } = useStorageSDK();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<RetrievedContent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const retrieveContent = useCallback(async (contentId: string): Promise<RetrievedContent> => {
    if (!sdk || !initialized) {
      const err = new Error('SDK not initialized');
      setError(err);
      throw err;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const retrievedContent = await sdk.retrieveContent(contentId);
      setContent(retrievedContent);
      return retrievedContent;
    } catch (err) {
      console.error('Error retrieving content:', err);
      const error = err instanceof Error ? err : new Error('Unknown error retrieving content');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [sdk, initialized]);
  
  const saveContentToFile = useCallback(async (
    contentId: string, 
    fileUri?: string
  ): Promise<string> => {
    // First retrieve the content
    const retrievedContent = content || await retrieveContent(contentId);
    
    try {
      // Get metadata
      const metadata = retrievedContent.metadata;
      const filename = metadata.filename || `file_${contentId}`;
      
      // Determine file path
      const filePath = fileUri || `${FileSystem.documentDirectory}${filename}`;
      
      // Convert buffer to base64
      const base64Data = Buffer.from(retrievedContent.data).toString('base64');
      
      // Write file
      await FileSystem.writeAsStringAsync(filePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // For images, save to media library
      if (metadata.mimeType.startsWith('image/')) {
        await MediaLibrary.saveToLibraryAsync(filePath);
      }
      
      return filePath;
    } catch (err) {
      console.error('Error saving content to file:', err);
      const error = err instanceof Error ? err : new Error('Unknown error saving content to file');
      setError(error);
      throw error;
    }
  }, [content, retrieveContent]);
  
  return {
    retrieveContent,
    saveContentToFile,
    loading,
    content,
    error
  };
};

/**
 * Component for file upload with document picker
 */
interface FilePickerProps {
  onUploadComplete?: (result: StorageResult) => void;
  onError?: (error: Error) => void;
  buttonStyle?: object;
  buttonTextStyle?: object;
  buttonText?: string;
  showPreview?: boolean;
  multiple?: boolean;
}

export const FilePicker: React.FC<FilePickerProps> = ({
  onUploadComplete,
  onError,
  buttonStyle,
  buttonTextStyle,
  buttonText = 'Select File',
  showPreview = true,
  multiple = false
}) => {
  const { uploadFile, loading, result, error } = useContentUpload();
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  
  // Handle file selection
  const pickFile = async () => {
    try {
      // Request permissions (iOS only)
      if (Platform.OS === 'ios') {
        await DocumentPicker.getDocumentAsync();
      }
      
      const result = multiple
        ? await DocumentPicker.getDocumentAsync({ multiple, copyToCacheDirectory: true })
        : await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      
      if (result.canceled) {
        console.log('Document picker canceled');
        return;
      }
      
      const selectedFiles = multiple ? result.assets : [result.assets[0]];
      setFiles(selectedFiles);
      
      // Upload the first file immediately
      if (selectedFiles.length > 0) {
        const file = selectedFiles[0];
        await uploadFile(file.uri, file.mimeType, file.name);
      }
    } catch (err) {
      console.error('Error picking document:', err);
      const pickerError = err instanceof Error ? err : new Error('Unknown error picking document');
      if (onError) onError(pickerError);
    }
  };
  
  // Call onUploadComplete when result changes
  useEffect(() => {
    if (result && onUploadComplete) {
      onUploadComplete(result);
    }
  }, [result, onUploadComplete]);
  
  // Call onError when error changes
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);
  
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.button, buttonStyle]} 
        onPress={pickFile} 
        disabled={loading}
      >
        <Text style={[styles.buttonText, buttonTextStyle]}>
          {loading ? 'Uploading...' : buttonText}
        </Text>
      </TouchableOpacity>
      
      {loading && (
        <ActivityIndicator style={styles.loader} size="large" color="#2196F3" />
      )}
      
      {showPreview && files.length > 0 && (
        <View style={styles.previewContainer}>
          {files.map((file, index) => (
            <View key={index} style={styles.filePreview}>
              {file.mimeType?.startsWith('image/') ? (
                <Image source={{ uri: file.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.fileIcon}>
                  <Text style={styles.fileIconText}>
                    {file.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                  </Text>
                </View>
              )}
              <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                {file.name}
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>Upload Complete</Text>
          <Text style={styles.resultInfo}>Content ID: {result.contentId}</Text>
          <Text style={styles.resultInfo}>URL: {result.publicUrl}</Text>
        </View>
      )}
    </View>
  );
};

/**
 * Component for image picker from camera or gallery
 */
interface ImagePickerProps {
  onUploadComplete?: (result: StorageResult) => void;
  onError?: (error: Error) => void;
  buttonStyle?: object;
  buttonTextStyle?: object;
  cameraButtonText?: string;
  galleryButtonText?: string;
  showPreview?: boolean;
}

export const ImagePickerComponent: React.FC<ImagePickerProps> = ({
  onUploadComplete,
  onError,
  buttonStyle,
  buttonTextStyle,
  cameraButtonText = 'Take Photo',
  galleryButtonText = 'Pick from Gallery',
  showPreview = true
}) => {
  const { uploadFile, loading, result, error } = useContentUpload();
  const [image, setImage] = useState<string | null>(null);
  
  // Request permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      alert('Camera and media library permissions are required!');
      return false;
    }
    
    return true;
  };
  
  // Take a photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled) {
        const image = result.assets[0];
        setImage(image.uri);
        await uploadFile(image.uri, image.mimeType, `camera_${Date.now()}.jpg`);
      }
    } catch (err) {
      console.error('Error taking photo:', err);
      const pickerError = err instanceof Error ? err : new Error('Unknown error taking photo');
      if (onError) onError(pickerError);
    }
  };
  
  // Pick image from gallery
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled) {
        const image = result.assets[0];
        setImage(image.uri);
        await uploadFile(image.uri, image.mimeType, image.fileName || `gallery_${Date.now()}.jpg`);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      const pickerError = err instanceof Error ? err : new Error('Unknown error picking image');
      if (onError) onError(pickerError);
    }
  };
  
  // Call onUploadComplete when result changes
  useEffect(() => {
    if (result && onUploadComplete) {
      onUploadComplete(result);
    }
  }, [result, onUploadComplete]);
  
  // Call onError when error changes
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);
  
  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.buttonHalf, buttonStyle]} 
          onPress={takePhoto} 
          disabled={loading}
        >
          <Text style={[styles.buttonText, buttonTextStyle]}>
            {loading ? 'Uploading...' : cameraButtonText}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.buttonHalf, buttonStyle]} 
          onPress={pickImage} 
          disabled={loading}
        >
          <Text style={[styles.buttonText, buttonTextStyle]}>
            {loading ? 'Uploading...' : galleryButtonText}
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading && (
        <ActivityIndicator style={styles.loader} size="large" color="#2196F3" />
      )}
      
      {showPreview && image && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: image }} style={styles.fullImagePreview} />
        </View>
      )}
      
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>Upload Complete</Text>
          <Text style={styles.resultInfo}>Content ID: {result.contentId}</Text>
          <Text style={styles.resultInfo}>URL: {result.publicUrl}</Text>
        </View>
      )}
    </View>
  );
};

/**
 * Component for content display
 */
interface ContentViewerProps {
  contentId: string;
  width?: number | string;
  height?: number | string;
  style?: object;
  placeholder?: React.ReactNode;
  onLoad?: (content: RetrievedContent) => void;
  onError?: (error: Error) => void;
}

export const ContentViewer: React.FC<ContentViewerProps> = ({
  contentId,
  width = '100%',
  height = 200,
  style,
  placeholder,
  onLoad,
  onError
}) => {
  const { sdk, initialized } = useStorageSDK();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [content, setContent] = useState<RetrievedContent | null>(null);
  const [contentUri, setContentUri] = useState<string | null>(null);
  
  useEffect(() => {
    let mounted = true;
    
    const loadContent = async () => {
      if (!sdk || !initialized) {
        const err = new Error('SDK not initialized');
        setError(err);
        if (onError) onError(err);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Retrieve content
        const content = await sdk.retrieveContent(contentId);
        if (!mounted) return;
        
        setContent(content);
        if (onLoad) onLoad(content);
        
        // For image content, save to file for display
        if (content.metadata.mimeType.startsWith('image/')) {
          const base64Data = Buffer.from(content.data).toString('base64');
          const tempFilePath = `${FileSystem.cacheDirectory}${contentId}_${content.metadata.filename || 'image'}`;
          
          await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          if (!mounted) return;
          setContentUri(tempFilePath);
        }
      } catch (err) {
        console.error('Error loading content:', err);
        const loadError = err instanceof Error ? err : new Error('Unknown error loading content');
        if (mounted) {
          setError(loadError);
          if (onError) onError(loadError);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    loadContent();
    
    return () => {
      mounted = false;
    };
  }, [sdk, initialized, contentId, onLoad, onError]);
  
  // Determine content display
  const renderContent = () => {
    if (!content) return null;
    
    const { mimeType } = content.metadata;
    
    if (mimeType.startsWith('image/') && contentUri) {
      return <Image source={{ uri: contentUri }} style={[{ width, height }, styles.contentImage, style]} />;
    }
    
    if (mimeType.startsWith('text/')) {
      const text = content.data.toString('utf-8');
      return (
        <View style={[{ width, height }, styles.textContainer, style]}>
          <Text style={styles.textContent}>{text}</Text>
        </View>
      );
    }
    
    return (
      <View style={[{ width, height }, styles.fileContainer, style]}>
        <Text style={styles.fileHeading}>{content.metadata.filename || contentId}</Text>
        <Text style={styles.fileType}>{mimeType}</Text>
        <Text style={styles.fileSize}>{formatBytes(content.metadata.size)}</Text>
      </View>
    );
  };
  
  return (
    <View style={[styles.viewerContainer, { width: width as any, height: height as any }]}>
      {loading && (
        <View style={styles.loaderContainer}>
          {placeholder || <ActivityIndicator size="large" color="#2196F3" />}
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error.message}</Text>
        </View>
      )}
      
      {!loading && !error && renderContent()}
    </View>
  );
};

// Helper function to get MIME type from filename
function getMimeTypeFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

// Helper function to format bytes
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Styles
const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonHalf: {
    flex: 0.48,
  },
  loader: {
    marginVertical: 16,
  },
  previewContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  filePreview: {
    width: '100%',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 12,
  },
  fullImagePreview: {
    width: 300,
    height: 300,
    borderRadius: 8,
  },
  fileIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileIconText: {
    fontWeight: 'bold',
    color: '#757575',
  },
  fileName: {
    flex: 1,
    fontSize: 16,
  },
  resultContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#e1f5fe',
    borderRadius: 8,
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultInfo: {
    fontSize: 14,
    marginBottom: 4,
  },
  viewerContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#ffcdd2',
  },
  errorText: {
    color: '#b71c1c',
    textAlign: 'center',
  },
  contentImage: {
    resizeMode: 'contain',
  },
  textContainer: {
    padding: 16,
    backgroundColor: 'white',
  },
  textContent: {
    fontSize: 14,
  },
  fileContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  fileType: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    color: '#757575',
  },
}); 
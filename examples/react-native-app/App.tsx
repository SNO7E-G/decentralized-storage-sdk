import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  StatusBar, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { 
  StorageSDKProvider, 
  useStorageSDK,
  FilePicker,
  ImagePickerComponent,
  ContentViewer,
  useContentRetrieval
} from 'decentralized-storage-sdk/frameworks/react-native';
import { StorageProviderType, CDNProviderType, CachingStrategy } from 'decentralized-storage-sdk';

/**
 * Example React Native app using Decentralized Storage SDK
 * 
 * @author Mahmoud Ashraf (SNO7E)
 * @github https://github.com/SNO7E-G
 */

// SDK Configuration
const sdkConfig = {
  storageProvider: StorageProviderType.IPFS,
  apiKey: 'your-api-key-here', // Replace with your actual API key
  enableCDN: true,
  enableEncryption: true,
  enableAnalytics: true,
  cdnConfig: {
    provider: CDNProviderType.CLOUDFLARE,
    enableGeoDistribution: true,
    enableDDoSProtection: true,
    cachingStrategy: CachingStrategy.CONTENT_BASED
  },
  versioningConfig: {
    enabled: true,
    maxVersions: 5,
    autoPrune: true
  }
};

// Main App component
export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <StorageSDKProvider config={sdkConfig} autoInitialize={true}>
        <AppContent />
      </StorageSDKProvider>
    </SafeAreaView>
  );
}

// App content component with tabs
function AppContent() {
  const { sdk, initialized, initializing, error } = useStorageSDK();
  const [activeTab, setActiveTab] = useState('upload');
  const [uploads, setUploads] = useState<{ id: string; name: string; cdnUrl?: string }[]>([]);
  
  // If SDK is initializing, show loading state
  if (initializing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Initializing Decentralized Storage SDK...</Text>
      </View>
    );
  }
  
  // If SDK initialization failed, show error
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error initializing SDK:</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
        <TouchableOpacity style={styles.tryAgainButton}>
          <Text style={styles.tryAgainButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Handle upload completion
  const handleUploadComplete = (result: any) => {
    setUploads(prev => [
      { 
        id: result.contentId, 
        name: result.filename || `File ${result.contentId.substring(0, 8)}`,
        cdnUrl: result.cdnUrl
      },
      ...prev
    ]);
    
    Alert.alert(
      'Upload Successful',
      `Your file has been uploaded and is available via CDN.`,
      [{ text: 'OK' }]
    );
  };
  
  // Render the selected tab
  const renderTabContent = () => {
    switch(activeTab) {
      case 'upload':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Upload Files</Text>
            <FilePicker 
              buttonText="Select Document"
              onUploadComplete={handleUploadComplete}
              buttonStyle={styles.uploadButton}
              showPreview={true}
            />
            
            <View style={styles.separator} />
            
            <Text style={styles.sectionTitle}>Upload Images</Text>
            <ImagePickerComponent
              cameraButtonText="Take Photo"
              galleryButtonText="Choose from Gallery"
              onUploadComplete={handleUploadComplete}
              buttonStyle={styles.uploadButton}
              showPreview={true}
            />
          </View>
        );
      case 'gallery':
        return <GalleryTab uploads={uploads} />;
      case 'info':
        return <InfoTab />;
      default:
        return <Text>Unknown tab</Text>;
    }
  };
  
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Decentralized Storage Demo</Text>
        <Text style={styles.headerSubtitle}>
          {initialized ? 'SDK Ready' : 'SDK Not Initialized'}
        </Text>
      </View>
      
      <View style={styles.content}>
        {renderTabContent()}
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'upload' && styles.activeTabButton]} 
          onPress={() => setActiveTab('upload')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'upload' && styles.activeTabButtonText]}>
            Upload
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'gallery' && styles.activeTabButton]} 
          onPress={() => setActiveTab('gallery')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'gallery' && styles.activeTabButtonText]}>
            Gallery
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'info' && styles.activeTabButton]} 
          onPress={() => setActiveTab('info')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'info' && styles.activeTabButtonText]}>
            Info
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Gallery tab for viewing uploaded content
function GalleryTab({ uploads }: { uploads: { id: string; name: string; cdnUrl?: string }[] }) {
  if (uploads.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No uploads yet</Text>
        <Text style={styles.emptyStateSubtext}>Go to the Upload tab to add files</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Your Uploads</Text>
      
      {uploads.map((item, index) => (
        <ContentCard key={index} contentId={item.id} name={item.name} cdnUrl={item.cdnUrl} />
      ))}
    </ScrollView>
  );
}

// Content card component for displaying a single piece of content
function ContentCard({ contentId, name, cdnUrl }: { contentId: string; name: string; cdnUrl?: string }) {
  const { retrieveContent, saveContentToFile, loading, error } = useContentRetrieval();
  const [showOptions, setShowOptions] = useState(false);
  
  const handleDownload = async () => {
    try {
      const filePath = await saveContentToFile(contentId);
      Alert.alert('Success', `File saved to: ${filePath}`);
    } catch (err) {
      console.error('Error downloading file:', err);
      Alert.alert('Download Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };
  
  const handleShare = () => {
    if (cdnUrl) {
      Alert.alert('Share Link', cdnUrl);
    } else {
      Alert.alert('Info', 'CDN URL not available for this content');
    }
  };
  
  return (
    <View style={styles.contentCard}>
      <View style={styles.contentHeader}>
        <Text style={styles.contentName} numberOfLines={1} ellipsizeMode="middle">
          {name}
        </Text>
        <TouchableOpacity 
          style={styles.optionsButton}
          onPress={() => setShowOptions(!showOptions)}
        >
          <Text>⋮</Text>
        </TouchableOpacity>
      </View>
      
      <ContentViewer 
        contentId={contentId} 
        height={120} 
        style={styles.contentPreview}
        placeholder={<Text>Loading content...</Text>}
      />
      
      {showOptions && (
        <View style={styles.optionsPanel}>
          <TouchableOpacity 
            style={styles.optionButton}
            onPress={handleDownload}
            disabled={loading}
          >
            <Text style={styles.optionButtonText}>
              {loading ? 'Downloading...' : 'Download'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.optionButton}
            onPress={handleShare}
          >
            <Text style={styles.optionButtonText}>Share</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.optionButton, styles.dangerButton]}
            onPress={() => Alert.alert('Coming soon', 'Delete functionality not implemented in this demo')}
          >
            <Text style={styles.dangerButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.contentFooter}>
        <Text style={styles.contentId} numberOfLines={1} ellipsizeMode="middle">
          ID: {contentId}
        </Text>
      </View>
    </View>
  );
}

// Info tab for displaying SDK information
function InfoTab() {
  const { sdk } = useStorageSDK();
  const [sdkInfo, setSdkInfo] = useState<any>(null);
  
  useEffect(() => {
    const getProviderInfo = async () => {
      if (sdk) {
        try {
          // Get storage provider information
          const storageInfo = await sdk.getStorageProviderInfo();
          // Get CDN provider information
          const cdnInfo = await sdk.getCDNStatus();
          
          setSdkInfo({
            storageProvider: storageInfo,
            cdnProvider: cdnInfo
          });
        } catch (err) {
          console.error('Error fetching SDK info:', err);
        }
      }
    };
    
    getProviderInfo();
  }, [sdk]);
  
  return (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>SDK Information</Text>
      
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Storage Provider</Text>
        <Text style={styles.infoDetail}>
          {sdk?.config.storageProvider || 'Not configured'}
        </Text>
        
        <Text style={styles.infoTitle}>CDN Enabled</Text>
        <Text style={styles.infoDetail}>
          {sdk?.config.enableCDN ? 'Yes' : 'No'}
        </Text>
        
        <Text style={styles.infoTitle}>Encryption Enabled</Text>
        <Text style={styles.infoDetail}>
          {sdk?.config.enableEncryption ? 'Yes' : 'No'}
        </Text>
        
        <Text style={styles.infoTitle}>Analytics Enabled</Text>
        <Text style={styles.infoDetail}>
          {sdk?.config.enableAnalytics ? 'Yes' : 'No'}
        </Text>
      </View>
      
      {sdkInfo && (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Storage Provider Status</Text>
            <Text style={styles.infoDetail}>
              {JSON.stringify(sdkInfo.storageProvider, null, 2)}
            </Text>
          </View>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>CDN Provider Status</Text>
            <Text style={styles.infoDetail}>
              {JSON.stringify(sdkInfo.cdnProvider, null, 2)}
            </Text>
          </View>
        </>
      )}
      
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Credits</Text>
        <Text style={styles.infoDetail}>
          Created by Mahmoud Ashraf (SNO7E)
        </Text>
        <Text style={styles.infoDetail}>
          GitHub: @SNO7E-G
        </Text>
      </View>
    </ScrollView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  wrapper: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 16,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderTopWidth: 2,
    borderTopColor: '#2196F3',
  },
  tabButtonText: {
    color: '#757575',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: '#2196F3',
    marginBottom: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#d32f2f',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  tryAgainButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  tryAgainButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#757575',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9e9e9e',
    textAlign: 'center',
  },
  contentCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  contentHeader: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  contentName: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  optionsButton: {
    padding: 4,
  },
  contentPreview: {
    backgroundColor: '#f9f9f9',
  },
  contentFooter: {
    padding: 8,
    backgroundColor: '#f5f5f5',
  },
  contentId: {
    fontSize: 12,
    color: '#9e9e9e',
  },
  optionsPanel: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  optionButtonText: {
    fontWeight: '500',
    color: '#333',
    fontSize: 13,
  },
  dangerButton: {
    backgroundColor: '#ffebee',
  },
  dangerButtonText: {
    color: '#d32f2f',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  infoTitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  infoDetail: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
}); 
import { CDNNode } from './CDNManager';

/**
 * GeolocationRouter
 * Routes requests to the nearest CDN node based on geographic proximity
 */
export class GeolocationRouter {
  /**
   * Creates a new GeolocationRouter
   */
  constructor() {
    console.log('Initialized GeolocationRouter for CDN');
  }
  
  /**
   * Finds the closest CDN node to a given client location
   * @param clientLocation The client's geographic coordinates
   * @param availableNodes Array of available CDN nodes
   * @returns The closest CDN node
   */
  public findClosestNode(
    clientLocation: { latitude: number, longitude: number },
    availableNodes: CDNNode[]
  ): CDNNode {
    if (!clientLocation || !availableNodes || availableNodes.length === 0) {
      throw new Error('Invalid client location or no nodes available');
    }
    
    // Calculate distances to all nodes
    const nodesWithDistances = availableNodes.map(node => ({
      node,
      distance: this.calculateDistance(
        clientLocation.latitude,
        clientLocation.longitude,
        node.coordinates.latitude,
        node.coordinates.longitude
      )
    }));
    
    // Sort by distance (ascending)
    nodesWithDistances.sort((a, b) => a.distance - b.distance);
    
    // Return the closest node
    return nodesWithDistances[0].node;
  }
  
  /**
   * Gets all nodes within a specified distance from the client
   * @param clientLocation The client's geographic coordinates
   * @param availableNodes Array of available CDN nodes
   * @param maxDistanceKm Maximum distance in kilometers
   * @returns Array of CDN nodes within the specified distance
   */
  public getNodesWithinDistance(
    clientLocation: { latitude: number, longitude: number },
    availableNodes: CDNNode[],
    maxDistanceKm: number
  ): CDNNode[] {
    if (!clientLocation || !availableNodes || availableNodes.length === 0) {
      return [];
    }
    
    // Filter nodes by distance
    return availableNodes.filter(node => {
      const distance = this.calculateDistance(
        clientLocation.latitude,
        clientLocation.longitude,
        node.coordinates.latitude,
        node.coordinates.longitude
      );
      
      return distance <= maxDistanceKm;
    });
  }
  
  /**
   * Calculates the haversine distance between two points on Earth
   * @param lat1 Latitude of point 1
   * @param lon1 Longitude of point 1
   * @param lat2 Latitude of point 2
   * @param lon2 Longitude of point 2
   * @returns Distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Earth's radius in kilometers
    const earthRadius = 6371;
    
    // Convert latitude and longitude from degrees to radians
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    // Haversine formula
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;
    
    return distance;
  }
  
  /**
   * Converts degrees to radians
   * @param degrees Angle in degrees
   * @returns Angle in radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Gets the client's location from the request
   * @param req HTTP request object (simplified for this example)
   * @returns Client location coordinates or null if not available
   */
  public getClientLocation(req: any): { latitude: number, longitude: number } | null {
    // In a real implementation, this would extract geolocation data from:
    // 1. Client-provided coordinates (if available)
    // 2. IP geolocation lookup
    // 3. Browser geolocation API results (if available)
    
    // For this example, we'll return a default location (New York City)
    return {
      latitude: 40.7128,
      longitude: -74.0060
    };
  }
} 
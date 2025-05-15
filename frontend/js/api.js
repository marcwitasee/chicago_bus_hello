/**
 * API client for interacting with the CTA Bus Tracker backend
 */
class BusTrackerAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    
    /**
     * Make a request to the API
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise} - API response
     */
    async request(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}/${endpoint}`);
        
        // Add query parameters
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                url.searchParams.append(key, value);
            }
        });
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }
    
    /**
     * Get all available bus routes
     * @returns {Promise} - Routes data
     */
    async getRoutes() {
        return this.request('routes');
    }
    
    /**
     * Get vehicles for specified routes
     * @param {Array|string} routeIds - Route IDs to get vehicles for
     * @returns {Promise} - Vehicle data
     */
    async getVehicles(routeIds) {
        const routeParam = Array.isArray(routeIds) ? routeIds.join(',') : routeIds;
        return this.request('vehicles', { routes: routeParam });
    }
    
    /**
     * Get details for a specific route (directions and stops)
     * @param {string} routeId - Route ID to get details for
     * @returns {Promise} - Route details
     */
    async getRouteDetails(routeId) {
        return this.request(`route/${routeId}`);
    }
    
    /**
     * Get predictions for a specific stop
     * @param {string} stopId - Stop ID
     * @param {string} routeId - Route ID
     * @returns {Promise} - Prediction data
     */
    async getPredictions(stopId, routeId) {
        return this.request('predictions', { stop: stopId, route: routeId });
    }
    
    /**
     * Fetch route shape data from Chicago Data Portal
     * @param {string} routeId - Route ID to fetch
     * @returns {Promise} - Promise that resolves with route shape data
     */
    async getRouteShape(routeId) {
        try {
            const url = `${CONFIG.externalAPIs.routeShapes}?route=${routeId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch route shape: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching route shape data for route ${routeId}:`, error);
            return null;
        }
    }
}

// Create API client instance
const busAPI = new BusTrackerAPI(CONFIG.api.baseUrl);

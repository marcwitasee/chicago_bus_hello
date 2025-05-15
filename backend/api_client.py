import os
import requests
import logging
from dotenv import load_dotenv
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
API_KEY = os.getenv('CTA_API_KEY')

# Base URL for CTA Bus Tracker API
BASE_URL = 'http://www.ctabustracker.com/bustime/api/v2'

class CTABusClient:
    """Client for interacting with the CTA Bus Tracker API."""
    
    def __init__(self, api_key=None):
        """Initialize the client with API key."""
        self.api_key = api_key or API_KEY
        if not self.api_key:
            raise ValueError("CTA API key is required")
        
        self.session = requests.Session()
        
    def _make_request(self, endpoint, params=None):
        """Make a request to the CTA API."""
        if params is None:
            params = {}
            
        # Add API key to all requests
        params['key'] = self.api_key
        # Set format to JSON for easier parsing
        params['format'] = 'json'
        
        url = f"{BASE_URL}/{endpoint}"
        
        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()  # Raise exception for 4XX/5XX responses
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            return None
    
    def get_time(self):
        """Get the current system time from the API."""
        return self._make_request('gettime')
    
    def get_vehicles(self, route_ids=None, vehicle_ids=None):
        """
        Get vehicle locations for specified routes or vehicles.
        
        Args:
            route_ids: List of route IDs (e.g., ["22", "36"])
            vehicle_ids: List of vehicle IDs
            
        Returns:
            JSON response with vehicle data
        """
        params = {}
        
        if route_ids:
            if isinstance(route_ids, list):
                route_ids = ','.join(route_ids)
            params['rt'] = route_ids
            
        if vehicle_ids:
            if isinstance(vehicle_ids, list):
                vehicle_ids = ','.join(vehicle_ids)
            params['vid'] = vehicle_ids
            
        return self._make_request('getvehicles', params)
    
    def get_routes(self):
        """Get available routes."""
        return self._make_request('getroutes')
    
    def get_directions(self, route_id):
        """Get available directions for a route."""
        params = {'rt': route_id}
        return self._make_request('getdirections', params)
    
    def get_stops(self, route_id, direction):
        """Get stops for a route and direction."""
        params = {
            'rt': route_id,
            'dir': direction
        }
        return self._make_request('getstops', params)
    
    def get_predictions(self, stop_id=None, route_id=None, vehicle_id=None, max_results=None):
        """Get arrival predictions."""
        params = {}
        
        if stop_id:
            params['stpid'] = stop_id
            
        if route_id:
            params['rt'] = route_id
            
        if vehicle_id:
            params['vid'] = vehicle_id
            
        if max_results:
            params['top'] = max_results
            
        return self._make_request('getpredictions', params)
    
    def get_route_info(self, route_id):
        """Combine route, direction, and stop information into a single object."""
        route_data = {}
        
        # Get directions for this route
        directions_resp = self.get_directions(route_id)
        if not directions_resp or 'bustime-response' not in directions_resp:
            return None
            
        directions = directions_resp.get('bustime-response', {}).get('directions', [])
        if not directions:
            return None
            
        route_data['directions'] = {}
        
        # For each direction, get the stops
        for direction_obj in directions:
            direction = direction_obj.get('dir')
            if not direction:
                continue
                
            stops_resp = self.get_stops(route_id, direction)
            if not stops_resp or 'bustime-response' not in stops_resp:
                continue
                
            stops = stops_resp.get('bustime-response', {}).get('stops', [])
            route_data['directions'][direction] = stops
            
        return route_data

# Example usage
if __name__ == "__main__":
    client = CTABusClient()
    
    # Test API connection
    time_response = client.get_time()
    if time_response:
        server_time = time_response.get('bustime-response', {}).get('tm')
        print(f"CTA API Server Time: {server_time}")
    
    # Get available routes
    routes_response = client.get_routes()
    if routes_response:
        routes = routes_response.get('bustime-response', {}).get('routes', [])
        print(f"Available Routes: {len(routes)}")
        for route in routes[:5]:  # Print first 5 routes
            print(f"Route {route.get('rt')}: {route.get('rtnm')}")
    
    # Get vehicles for a specific route
    vehicles_response = client.get_vehicles(route_ids=["22"])  # Route 22 - Clark
    if vehicles_response:
        vehicles = vehicles_response.get('bustime-response', {}).get('vehicle', [])
        print(f"Vehicles on Route 22: {len(vehicles)}")
        for vehicle in vehicles[:3]:  # Print first 3 vehicles
            print(f"Vehicle {vehicle.get('vid')} is at lat: {vehicle.get('lat')}, lon: {vehicle.get('lon')}")

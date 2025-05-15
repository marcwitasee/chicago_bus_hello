"""
Test script to verify CTA API client functionality.
Usage: python3 test_api.py
"""

import json
from api_client import CTABusClient

def print_json(data):
    """Pretty print JSON data."""
    print(json.dumps(data, indent=2))

def test_api_connection():
    """Test basic API connectivity."""
    client = CTABusClient()
    
    print("Testing API connection...")
    time_response = client.get_time()
    
    if time_response and 'bustime-response' in time_response:
        server_time = time_response.get('bustime-response', {}).get('tm')
        print(f"✅ Connection successful! CTA API Server Time: {server_time}")
        return True
    else:
        print("❌ Connection failed.")
        return False

def test_get_routes():
    """Test retrieving available routes."""
    client = CTABusClient()
    
    print("\nFetching available routes...")
    routes_response = client.get_routes()
    
    if routes_response and 'bustime-response' in routes_response:
        routes = routes_response.get('bustime-response', {}).get('routes', [])
        print(f"✅ Found {len(routes)} routes")
        
        # Print first 5 routes
        for i, route in enumerate(routes[:5]):
            print(f"  {i+1}. Route {route.get('rt')}: {route.get('rtnm')}")
            
        return routes
    else:
        print("❌ Failed to fetch routes")
        return None

def test_vehicle_tracking(route_id):
    """Test tracking vehicles on a specific route."""
    client = CTABusClient()
    
    print(f"\nTracking vehicles on Route {route_id}...")
    vehicles_response = client.get_vehicles(route_ids=[route_id])
    
    if vehicles_response and 'bustime-response' in vehicles_response:
        vehicles = vehicles_response.get('bustime-response', {}).get('vehicle', [])
        print(f"✅ Found {len(vehicles)} vehicles on route {route_id}")
        
        # Print details for first 3 vehicles
        for i, vehicle in enumerate(vehicles[:3]):
            print(f"  {i+1}. Vehicle {vehicle.get('vid')} - Heading: {vehicle.get('hdg')}°")
            print(f"     Location: ({vehicle.get('lat')}, {vehicle.get('lon')})")
            print(f"     Speed: {vehicle.get('spd')} mph, Delay: {vehicle.get('dly') or 'No delay'}")
            
        return vehicles
    else:
        print(f"❌ Failed to fetch vehicles for route {route_id}")
        return None

def test_stops_for_route(route_id):
    """Test retrieving stops for a route."""
    client = CTABusClient()
    
    print(f"\nGetting directions for Route {route_id}...")
    directions_resp = client.get_directions(route_id)
    
    if not directions_resp or 'bustime-response' not in directions_resp:
        print(f"❌ Failed to fetch directions for route {route_id}")
        return None
        
    directions = directions_resp.get('bustime-response', {}).get('directions', [])
    if not directions:
        print(f"❌ No directions found for route {route_id}")
        return None
        
    print(f"✅ Found {len(directions)} directions for route {route_id}")
    
    # Get stops for the first direction
    direction = directions[0].get('dir')
    print(f"\nGetting stops for direction: {direction}")
    
    stops_resp = client.get_stops(route_id, direction)
    if not stops_resp or 'bustime-response' not in stops_resp:
        print(f"❌ Failed to fetch stops for route {route_id}, direction {direction}")
        return None
        
    stops = stops_resp.get('bustime-response', {}).get('stops', [])
    print(f"✅ Found {len(stops)} stops for route {route_id}, direction {direction}")
    
    # Print first 5 stops
    for i, stop in enumerate(stops[:5]):
        print(f"  {i+1}. Stop {stop.get('stpid')}: {stop.get('stpnm')}")
        print(f"     Location: ({stop.get('lat')}, {stop.get('lon')})")
        
    return stops

if __name__ == "__main__":
    # Test basic API connection
    if not test_api_connection():
        print("Exiting due to connection failure.")
        exit(1)
    
    # Test retrieving routes
    routes = test_get_routes()
    if not routes:
        print("Exiting due to route retrieval failure.")
        exit(1)
    
    # Choose a route for testing vehicle tracking
    # Using route 22 (Clark) as an example, but this could be any route
    test_route = "4"
    
    # Test vehicle tracking
    vehicles = test_vehicle_tracking(test_route)
    
    # Test stop retrieval
    stops = test_stops_for_route(test_route)
    
    print("\nAPI tests completed.")

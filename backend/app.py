from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import logging
import os
from api_client import CTABusClient
from pythonjsonlogger import jsonlogger
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger()
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter(
    '%(asctime)s %(name)s %(levelname)s %(message)s'
)
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

# Initialize Flask app
app = Flask(__name__, 
            static_folder='../frontend',  # Point to frontend folder
            static_url_path='')

# Configure CORS
allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8000').split(',')
CORS(app, resources={
    r"/api/*": {
        "origins": allowed_origins
    }
})

# Initialize CTA API client
cta_client = CTABusClient()

# API Routes
@app.route('/api/routes', methods=['GET'])
def get_routes():
    """Get all available bus routes."""
    try:
        response = cta_client.get_routes()
        if response and 'bustime-response' in response:
            routes = response.get('bustime-response', {}).get('routes', [])
            return jsonify(routes)
        else:
            logger.error("Failed to fetch routes: Invalid response format")
            return jsonify({"error": "Failed to fetch routes"}), 500
    except Exception as e:
        logger.error(f"Error getting routes: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/vehicles', methods=['GET'])
def get_vehicles():
    """Get vehicles for specified routes."""
    try:
        route_ids = request.args.get('routes')
        if not route_ids:
            return jsonify({"error": "Route IDs are required"}), 400
            
        # Split comma-separated route IDs
        route_list = route_ids.split(',')
        
        response = cta_client.get_vehicles(route_ids=route_list)
        if response and 'bustime-response' in response:
            vehicles = response.get('bustime-response', {}).get('vehicle', [])
            return jsonify(vehicles)
        else:
            return jsonify({"error": "Failed to fetch vehicles"}), 500
    except Exception as e:
        logger.error(f"Error getting vehicles: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/route/<route_id>', methods=['GET'])
def get_route_details(route_id):
    """Get detailed information for a specific route."""
    try:
        # Get directions for this route
        directions_resp = cta_client.get_directions(route_id)
        if not directions_resp or 'bustime-response' not in directions_resp:
            return jsonify({"error": "Failed to fetch route directions"}), 500
            
        directions = directions_resp.get('bustime-response', {}).get('directions', [])
        
        # Prepare result object
        result = {
            "route_id": route_id,
            "directions": {}
        }
        
        # For each direction, get the stops
        for direction_obj in directions:
            direction = direction_obj.get('dir')
            if not direction:
                continue
                
            stops_resp = cta_client.get_stops(route_id, direction)
            if not stops_resp or 'bustime-response' not in stops_resp:
                continue
                
            stops = stops_resp.get('bustime-response', {}).get('stops', [])
            result['directions'][direction] = stops
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting route details: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/predictions', methods=['GET'])
def get_predictions():
    """Get arrival predictions."""
    try:
        stop_id = request.args.get('stop')
        route_id = request.args.get('route')
        
        if not stop_id or not route_id:
            return jsonify({"error": "Stop ID and Route ID are required"}), 400
            
        response = cta_client.get_predictions(stop_id=stop_id, route_id=route_id)
        if response and 'bustime-response' in response:
            predictions = response.get('bustime-response', {}).get('prd', [])
            return jsonify(predictions)
        else:
            return jsonify({"error": "Failed to fetch predictions"}), 500
    except Exception as e:
        logger.error(f"Error getting predictions: {e}")
        return jsonify({"error": str(e)}), 500

# Health check endpoint
@app.route('/health')
def health_check():
    """Health check endpoint for monitoring."""
    return jsonify({"status": "healthy"}), 200

# Serve frontend
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
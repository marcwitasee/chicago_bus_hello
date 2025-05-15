/**
 * Bus tracker map implementation using Leaflet
 */
class BusMap {
    constructor(mapElementId, config) {
        this.mapElementId = mapElementId;
        this.config = config;
        this.map = null;
        
        // Collections for markers and layers
        this.busMarkers = {};
        this.stopMarkers = {};
        this.routeLayers = {};
        this.routePaths = {};
        
        // Track which routes have shapes loaded
        this.loadedRouteShapes = new Set();
        
        // Color management
        this.routeColors = { ...CONFIG.colors.routes };
        this.usedColors = new Set(Object.values(this.routeColors));
        
        this.initialize();
    }
    
    /**
     * Initialize the map
     */
    initialize() {
        // Create map instance
        this.map = L.map(this.mapElementId).setView(
            this.config.map.center, 
            this.config.map.zoom
        );
        
        // Add tile layer (base map)
        L.tileLayer(this.config.map.tileLayer, {
            attribution: this.config.map.attribution
        }).addTo(this.map);
        
        // Handle zoom events for showing/hiding stops
        this.map.on('zoomend', () => this.updateLayerVisibility());
    }
    
    /**
     * Update layer visibility based on current zoom level
     */
    updateLayerVisibility() {
        const currentZoom = this.map.getZoom();
        const showStops = currentZoom >= this.config.map.stopsVisibleZoom;
        
        // Loop through all route layers
        Object.entries(this.routeLayers).forEach(([routeId, layers]) => {
            if (!layers) return;
            
            // Show/hide stop markers based on zoom level
            if (layers.stops) {
                if (showStops) {
                    layers.stops.addTo(this.map);
                } else if (this.map.hasLayer(layers.stops)) {
                    this.map.removeLayer(layers.stops);
                }
            }
        });
    }
    
    /**
     * Get color for a route, assigning a new one if needed
     * @param {string} routeId - Route ID
     * @returns {string} - Color hex code
     */
    getRouteColor(routeId) {
        // If the route already has an assigned color, return it
        if (this.routeColors[routeId]) {
            return this.routeColors[routeId];
        }
        
        // Find an available color that hasn't been used yet
        const palette = this.config.colors.palette;
        let availableColor = palette.find(color => !this.usedColors.has(color));
        
        // If all colors have been used, just pick one from the palette
        if (!availableColor) {
            const colorIndex = Object.keys(this.routeColors).length % palette.length;
            availableColor = palette[colorIndex];
        }
        
        // Assign this color to the route
        this.routeColors[routeId] = availableColor;
        this.usedColors.add(availableColor);
        
        return availableColor;
    }
    
    /**
     * Create a bus icon with the specified color and heading direction
     * @param {string} color - Hex color code
     * @param {number} heading - Bus heading in degrees (0-360)
     * @returns {L.Icon} - Leaflet icon instance
     */
    createBusIcon(color, heading = 0) {
        // SVG for a directional bus marker (arrow shape)
        const iconSize = [24, 24];
        const iconAnchor = [12, 12];
        const popupAnchor = [0, -16];
        
        // Create SVG with arrow bus icon that can be rotated
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize[0]}" height="${iconSize[1]}"
                style="transform: rotate(${heading}deg);">
                <path fill="${color}" stroke="white" stroke-width="1" 
                    d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" />
                <path fill="${color}" 
                    d="M13.5,8.5h-3C9.67,8.5,9,9.17,9,10v2c0,0.83,0.67,1.5,1.5,1.5h0.5V14h2v-0.5h0.5c0.83,0,1.5-0.67,1.5-1.5v-2 C15,9.17,14.33,8.5,13.5,8.5z M10.5,12c-0.55,0-1-0.45-1-1s0.45-1,1-1s1,0.45,1,1S11.05,12,10.5,12z M13.5,12c-0.55,0-1-0.45-1-1 s0.45-1,1-1s1,0.45,1,1S14.05,12,13.5,12z" />
            </svg>
        `;
        
        return L.divIcon({
            html: svg,
            className: 'bus-marker directional',
            iconSize: iconSize,
            iconAnchor: iconAnchor,
            popupAnchor: popupAnchor
        });
    }
    
    /**
     * Create a stop icon with the specified color
     * @param {string} color - Hex color code
     * @returns {L.Icon} - Leaflet icon instance
     */
    createStopIcon(color) {
        // Create a circular stop icon
        const iconSize = [14, 14];
        const iconAnchor = [7, 7];
        const popupAnchor = [0, -10];
        
        // Create SVG for circular stop marker with a bus stop symbol
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize[0]}" height="${iconSize[1]}">
                <circle cx="12" cy="12" r="11" fill="${color}" stroke="white" stroke-width="1" />
                <rect x="8" y="6" width="8" height="12" fill="white" rx="1" />
                <rect x="10" y="9" width="4" height="2" fill="${color}" />
                <rect x="10" y="13" width="4" height="2" fill="${color}" />
            </svg>
        `;
        
        return L.divIcon({
            html: svg,
            className: 'stop-marker',
            iconSize: iconSize,
            iconAnchor: iconAnchor,
            popupAnchor: popupAnchor
        });
    }
    
    /**
     * Update bus positions on the map
     * @param {Array} buses - Array of bus objects
     * @param {string} routeId - Route ID
     * @param {boolean} fitToBounds - Whether to fit map to bounds (default: false)
     */
    async updateBuses(buses, routeId, fitToBounds = false) {
        // Clear existing buses for this route
        this.clearBuses(routeId);
        
        if (buses.length === 0) return;
        
        const routeColor = this.getRouteColor(routeId);
        
        // Create layer group for this route if it doesn't exist
        if (!this.routeLayers[routeId]) {
            this.routeLayers[routeId] = {
                buses: L.layerGroup().addTo(this.map),
                stops: L.layerGroup(),
                paths: L.layerGroup().addTo(this.map)
            };
        }
        
        // Initialize bus markers collection if needed
        if (!this.busMarkers[routeId]) {
            this.busMarkers[routeId] = {};
        }
        
        // Create bus markers
        buses.forEach(bus => {
            const heading = parseInt(bus.hdg) || 0;
            const busIcon = this.createBusIcon(routeColor, bus.hdg);
            const marker = L.marker([bus.lat, bus.lon], { icon: busIcon });
            
            // Create popup content
            const popupContent = `
                <div class="bus-popup">
                    <div class="bus-id" style="color: ${routeColor}; border-bottom: 2px solid ${routeColor};">
                        Route ${bus.rt} - Bus #${bus.vid}
                    </div>
                    <div class="bus-details">
                        <div>Direction: ${bus.des}</div>
                        <div>Heading: ${this.getHeadingText(bus.hdg)}</div>
                        <div>Delayed: ${bus.dly ? 'Yes' : 'No'}</div>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            marker.addTo(this.routeLayers[routeId].buses);
            this.busMarkers[routeId][bus.vid] = marker;
        });
        
        this.updateLayerVisibility();
        
        // Only fit map to bus bounds if this is a new route being added
        // or explicitly requested
        if (fitToBounds) {
            this.fitMapToBuses(buses);
        }
    }
    
    /**
     * Fit the map to the bounds of bus positions
     * @param {Array} buses - Array of bus objects
     */
    fitMapToBuses(buses) {
        if (buses.length === 0) return;
        
        const bounds = L.latLngBounds();
        buses.forEach(bus => bounds.extend([bus.lat, bus.lon]));
        
        if (bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
    
    /**
     * Fetch and display route shape
     * @param {string} routeId - Route ID
     */
    async fetchAndDisplayRouteShape(routeId) {
        try {
            // Fetch route shape data
            const shapeData = await busAPI.getRouteShape(routeId);
            
            if (!shapeData || shapeData.length === 0) {
                console.warn(`No shape data available for route ${routeId}`);
                return;
            }
            
            const routeColor = this.getRouteColor(routeId);
            const processedData = this.processRouteShapeData(shapeData, routeId);
            
            // Create polylines for each pattern group
            Object.entries(processedData).forEach(([pattern, shapes]) => {
                if (!shapes || shapes.length === 0) {
                    return;
                }
                
                this.createRoutePolyline(shapes, pattern, routeId, routeColor, shapeData[0]);
            });
            
            // Mark route as loaded
            this.loadedRouteShapes.add(routeId);
            
        } catch (error) {
            console.error(`Error loading route shape for route ${routeId}:`, error);
        }
    }
    
    /**
     * Process route shape data into usable format
     * @param {Array} shapeData - Raw shape data from API
     * @param {string} routeId - Route ID
     * @returns {Object} - Processed data grouped by pattern
     */
    processRouteShapeData(shapeData, routeId) {
        const patternGroups = {};
        
        // Check if the data contains GeoJSON geometry
        if (shapeData[0].the_geom) {
            this.processGeoJsonData(shapeData, patternGroups, routeId);
        } 
        // Handle data that already has shape_pt_lat and shape_pt_lon 
        else if (shapeData[0].shape_pt_lat && shapeData[0].shape_pt_lon) {
            this.processStandardShapeData(shapeData, patternGroups);
        } 
        // Handle unexpected data format
        else {
            this.processUnknownDataFormat(shapeData, patternGroups);
        }
        
        return patternGroups;
    }
    
    /**
     * Process GeoJSON data
     * @param {Array} shapeData - Raw shape data
     * @param {Object} patternGroups - Groups to populate
     * @param {string} routeId - Route ID
     */
    processGeoJsonData(shapeData, patternGroups, routeId) {
        let allPoints = [];
        let sequence = 0;
        const geoJson = shapeData[0].the_geom;
        
        // Handle MultiLineString geometry
        if (geoJson.type === 'MultiLineString') {
            const isComplexRoute = geoJson.coordinates.length > 5;
            
            geoJson.coordinates.forEach((lineSegment, segmentIndex) => {
                const patternName = isComplexRoute ? `route-segment-${segmentIndex}` : 'route';
                
                const segmentPoints = lineSegment.map(coord => ({
                    shape_pt_lat: coord[1], // Latitude is the second coordinate in GeoJSON
                    shape_pt_lon: coord[0], // Longitude is the first coordinate in GeoJSON
                    shape_pt_sequence: sequence++,
                    pattern: patternName
                }));
                
                if (isComplexRoute) {
                    if (!patternGroups[patternName]) {
                        patternGroups[patternName] = [];
                    }
                    patternGroups[patternName] = patternGroups[patternName].concat(segmentPoints);
                } else {
                    allPoints = allPoints.concat(segmentPoints);
                }
            });
            
            if (!isComplexRoute) {
                patternGroups['route'] = allPoints;
            }
        } 
        // Handle LineString geometry
        else if (geoJson.type === 'LineString') {
            const segmentPoints = geoJson.coordinates.map(coord => ({
                shape_pt_lat: coord[1],
                shape_pt_lon: coord[0],
                shape_pt_sequence: sequence++,
                pattern: 'route'
            }));
            patternGroups['route'] = segmentPoints;
        }
        // Fallback for any other data with coordinates
        else if (geoJson.coordinates && Array.isArray(geoJson.coordinates)) {
            this.processCoordinatesArray(geoJson.coordinates, patternGroups, sequence);
        }
    }
    
    /**
     * Process standard shape data (with shape_pt_lat/shape_pt_lon)
     * @param {Array} shapeData - Raw shape data
     * @param {Object} patternGroups - Groups to populate
     */
    processStandardShapeData(shapeData, patternGroups) {
        shapeData.forEach(shape => {
            const pattern = shape.pattern || 'route';
            if (!patternGroups[pattern]) {
                patternGroups[pattern] = [];
            }
            patternGroups[pattern].push(shape);
        });
    }
    
    /**
     * Process unknown data format
     * @param {Array} shapeData - Raw shape data
     * @param {Object} patternGroups - Groups to populate
     */
    processUnknownDataFormat(shapeData, patternGroups) {
        const firstItem = shapeData[0];
        
        // Try to identify lat/lon and pattern fields
        const possiblePatterns = Object.keys(firstItem).filter(key => 
            typeof firstItem[key] === 'string' && 
            (key.includes('pattern') || key.includes('dir') || key.includes('direction'))
        );
        
        const possibleLatFields = Object.keys(firstItem).filter(key => 
            (key.includes('lat') || key.includes('latitude')) && 
            !isNaN(parseFloat(firstItem[key]))
        );
        
        const possibleLonFields = Object.keys(firstItem).filter(key => 
            (key.includes('lon') || key.includes('lng') || key.includes('longitude')) && 
            !isNaN(parseFloat(firstItem[key]))
        );
        
        const possibleSeqFields = Object.keys(firstItem).filter(key => 
            (key.includes('seq') || key.includes('sequence') || key.includes('order')) && 
            !isNaN(parseInt(firstItem[key]))
        );
        
        if (possibleLatFields.length > 0 && possibleLonFields.length > 0) {
            const latField = possibleLatFields[0];
            const lonField = possibleLonFields[0];
            const seqField = possibleSeqFields.length > 0 ? possibleSeqFields[0] : null;
            const patternField = possiblePatterns.length > 0 ? possiblePatterns[0] : null;
            
            shapeData.forEach(shape => {
                const pattern = patternField ? shape[patternField] || 'route' : 'route';
                if (!patternGroups[pattern]) {
                    patternGroups[pattern] = [];
                }
                
                patternGroups[pattern].push({
                    shape_pt_lat: shape[latField],
                    shape_pt_lon: shape[lonField],
                    shape_pt_sequence: seqField ? shape[seqField] : 0,
                    pattern: pattern
                });
            });
        }
    }
    
    /**
     * Process array of coordinates
     * @param {Array} coords - Coordinates array
     * @param {Object} patternGroups - Groups to populate
     * @param {number} sequence - Starting sequence number
     */
    processCoordinatesArray(coords, patternGroups, sequence = 0) {
        if (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0])) {
            const points = coords.map(coord => ({
                shape_pt_lat: coord[1],
                shape_pt_lon: coord[0],
                shape_pt_sequence: sequence++,
                pattern: 'route'
            }));
            
            if (!patternGroups['route']) {
                patternGroups['route'] = [];
            }
            patternGroups['route'] = patternGroups['route'].concat(points);
        }
    }
    
    /**
     * Create route polyline for a pattern
     * @param {Array} shapes - Shape points
     * @param {string} pattern - Pattern name
     * @param {string} routeId - Route ID
     * @param {string} routeColor - Route color
     * @param {Object} shapeMetadata - Additional shape metadata
     */
    createRoutePolyline(shapes, pattern, routeId, routeColor, shapeMetadata) {
        // Sort by sequence
        if (shapes[0].shape_pt_sequence !== undefined) {
            shapes.sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence));
        }
        
        // Extract valid coordinates
        const pathCoords = shapes
            .map(shape => {
                const lat = parseFloat(shape.shape_pt_lat);
                const lon = parseFloat(shape.shape_pt_lon);
                return isNaN(lat) || isNaN(lon) ? null : [lat, lon];
            })
            .filter(coord => coord !== null);
        
        // Only create a polyline if we have enough coordinates
        if (pathCoords.length <= 1) {
            console.warn(`Not enough valid coordinates for pattern ${pattern} on route ${routeId}`);
            return;
        }
        
        // Create polyline with improved styling
        const pathLine = L.polyline(pathCoords, {
            color: routeColor,
            weight: 5, // Increased from 4 to make routes more visible
            opacity: 0.8, // Increased from 0.7 for better visibility
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: null, // Solid line
            className: 'route-path' // Add a class for potential CSS styling
        });
        
        // Create popup content
        const popupContent = this.createPathPopupContent(pattern, routeId, shapeMetadata);
        pathLine.bindPopup(popupContent);
        
        // Make route path clickable to select the route
        pathLine.on('click', () => {
            // Dispatch custom event to select this route
            document.dispatchEvent(new CustomEvent('route-path-clicked', {
                detail: { routeId }
            }));
        });
        
        // Add to map
        pathLine.addTo(this.routeLayers[routeId].paths);
        
        // Store reference
        if (!this.routePaths[routeId]) {
            this.routePaths[routeId] = {};
        }
        this.routePaths[routeId][pattern] = pathLine;
    }
    
    /**
     * Create popup content for route path
     * @param {string} pattern - Pattern name
     * @param {string} routeId - Route ID
     * @param {Object} shapeMetadata - Additional shape metadata
     * @returns {string} - HTML content for popup
     */
    createPathPopupContent(pattern, routeId, shapeMetadata) {
        // If it's a segment of a complex route
        if (pattern.startsWith('route-segment-')) {
            const segmentNumber = pattern.split('-').pop();
            
            // For routes with known names, use that
            if (shapeMetadata && shapeMetadata.name) {
                return `<div>Route ${routeId} - ${shapeMetadata.name}</div><div>Segment ${parseInt(segmentNumber) + 1}</div>`;
            } else {
                return `<div>Route ${routeId} - Segment ${parseInt(segmentNumber) + 1}</div>`;
            }
        } else {
            // Determine direction from pattern name
            const direction = pattern.includes('EB') ? 'Eastbound' : 
                            pattern.includes('WB') ? 'Westbound' :
                            pattern.includes('NB') ? 'Northbound' :
                            pattern.includes('SB') ? 'Southbound' : 'Unknown';
                            
            return `<div>Route ${routeId} - ${direction}</div>`;
        }
    }
    
    /**
     * Update stops on the map
     * @param {Object} routeDetails - Route details object with directions and stops
     * @param {string} routeId - Route ID
     */
    updateStops(routeDetails, routeId) {
        this.clearStops(routeId);
        
        const routeColor = this.getRouteColor(routeId);
        const stopIcon = this.createStopIcon(routeColor);
        
        // Create layer group for this route if it doesn't exist
        if (!this.routeLayers[routeId]) {
            this.routeLayers[routeId] = {
                buses: L.layerGroup().addTo(this.map),
                stops: L.layerGroup(),
                paths: L.layerGroup().addTo(this.map)
            };
        }
        
        // Initialize stop markers collection if needed
        if (!this.stopMarkers[routeId]) {
            this.stopMarkers[routeId] = {};
        }
        
        // Process each direction
        Object.entries(routeDetails.directions).forEach(([direction, stops]) => {
            stops.forEach(stop => {
                this.createStopMarker(stop, direction, routeId, routeColor, stopIcon);
            });
        });
        
        this.updateLayerVisibility();
    }
    
    /**
     * Create a stop marker
     * @param {Object} stop - Stop data
     * @param {string} direction - Direction name
     * @param {string} routeId - Route ID
     * @param {string} routeColor - Route color
     * @param {L.Icon} stopIcon - Icon to use
     */
    createStopMarker(stop, direction, routeId, routeColor, stopIcon) {
        const marker = L.marker([stop.lat, stop.lon], { 
            icon: stopIcon,
            zIndexOffset: -1000 // Place below bus markers
        });
        
        // Create popup content
        const popupContent = `
            <div class="stop-info">
                <div class="stop-name" style="color: ${routeColor}; border-bottom: 1px solid ${routeColor};">
                    ${stop.stpnm}
                </div>
                <div>Stop #${stop.stpid}</div>
                <div>Route: ${routeId}</div>
                <div>Direction: ${direction}</div>
                <button class="view-predictions-btn">View Arrivals</button>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Event handlers for predictions
        this.setupStopMarkerEvents(marker, stop, routeId);
        
        // Add marker to layer
        marker.addTo(this.routeLayers[routeId].stops);
        this.stopMarkers[routeId][stop.stpid] = marker;
    }
    
    /**
     * Set up event handlers for stop markers
     * @param {L.Marker} marker - The marker object
     * @param {Object} stop - Stop data
     * @param {string} routeId - Route ID
     */
    setupStopMarkerEvents(marker, stop, routeId) {
        // Click event to show predictions
        marker.on('click', () => {
            document.dispatchEvent(new CustomEvent('stop-clicked', {
                detail: {
                    stopId: stop.stpid,
                    routeId: routeId,
                    stopName: stop.stpnm
                }
            }));
        });
        
        // Handle button click inside popup
        marker.on('popupopen', () => {
            setTimeout(() => {
                const viewBtn = document.querySelector('.view-predictions-btn');
                if (!viewBtn) return;
                
                viewBtn.addEventListener('click', () => {
                    document.dispatchEvent(new CustomEvent('stop-clicked', {
                        detail: {
                            stopId: stop.stpid,
                            routeId: routeId,
                            stopName: stop.stpnm
                        }
                    }));
                    
                    // Close the popup after clicking
                    marker.closePopup();
                });
            }, 10); // Small timeout to ensure the popup is fully rendered
        });
    }
    
    /**
     * Clear all bus markers for a specific route
     * @param {string} routeId - Route ID
     */
    clearBuses(routeId) {
        if (this.routeLayers[routeId]?.buses) {
            this.routeLayers[routeId].buses.clearLayers();
        }
        
        if (this.busMarkers[routeId]) {
            this.busMarkers[routeId] = {};
        }
    }
    
    /**
     * Clear all stop markers for a specific route
     * @param {string} routeId - Route ID
     */
    clearStops(routeId) {
        if (this.routeLayers[routeId]?.stops) {
            this.routeLayers[routeId].stops.clearLayers();
        }
        
        if (this.stopMarkers[routeId]) {
            this.stopMarkers[routeId] = {};
        }
    }
    
    /**
     * Clear all path lines for a specific route
     * @param {string} routeId - Route ID
     */
    clearPaths(routeId) {
        if (this.routeLayers[routeId]?.paths) {
            this.routeLayers[routeId].paths.clearLayers();
        }
        
        if (this.routePaths[routeId]) {
            this.routePaths[routeId] = {};
        }
        
        // Remove from loaded routes set
        this.loadedRouteShapes.delete(routeId);
    }
    
    /**
     * Clear all markers and paths for a specific route
     * @param {string} routeId - Route ID
     */
    clearRoute(routeId) {
        this.clearBuses(routeId);
        this.clearStops(routeId);
        this.clearPaths(routeId);
        
        if (this.routeLayers[routeId]) {
            // Remove layers from map
            ['buses', 'stops', 'paths'].forEach(layerType => {
                const layer = this.routeLayers[routeId][layerType];
                if (layer && this.map.hasLayer(layer)) {
                    this.map.removeLayer(layer);
                }
            });
            
            this.routeLayers[routeId] = null;
        }
    }
    
    /**
     * Clear all markers from the map
     */
    clearAll() {
        Object.keys(this.routeLayers).forEach(routeId => {
            this.clearRoute(routeId);
        });
        
        this.busMarkers = {};
        this.stopMarkers = {};
        this.routePaths = {};
        this.routeLayers = {};
        this.loadedRouteShapes = new Set();
    }
    
    /**
     * Convert heading degrees to cardinal direction
     * @param {number} heading - Heading in degrees
     * @returns {string} - Cardinal direction
     */
    getHeadingText(heading) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
        return directions[Math.round(heading / 45) % 8];
    }
}
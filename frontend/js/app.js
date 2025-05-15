/**
 * Main application for CTA Bus Tracker
 */
class BusTrackerApp {
    constructor() {
        // Initialize state
        this.activeRoutes = new Set();
        this.refreshInterval = null;
        this.predictionsInterval = null;
        this.isAutoRefreshEnabled = true;
        this.selectedStop = null;
        this.routeInfo = {};
        this.firstLoad = true;
        
        // Initialize UI
        this.initializeUI();
        
        // Initialize map
        this.busMap = new BusMap('map', CONFIG);
        
        // Initialize event listeners
        this.bindEvents();
        
        // Start application
        this.initialize();
    }
    
    /**
     * Initialize UI elements
     */
    initializeUI() {
        this.activeRoutesContainer = document.getElementById('active-routes');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.autoRefreshCheckbox = document.getElementById('auto-refresh');
        this.busList = document.getElementById('bus-list');
        this.routeListContainer = document.getElementById('route-list-container');
        this.predictionsContent = document.getElementById('predictions-content');
        this.selectedRouteIndicator = document.getElementById('selected-route-indicator');
        this.selectedStopIndicator = document.getElementById('selected-stop-indicator');
        
        // Selected route for displaying bus info
        this.selectedRouteId = null;
    }
    
    /**
     * Initialize the application
     */
    async initialize() {
        try {
            await this.loadRoutes();
            this.isAutoRefreshEnabled = this.autoRefreshCheckbox.checked;
            
            // Add default routes if configured
            if (CONFIG.defaultRoutes?.length > 0) {
                CONFIG.defaultRoutes.forEach(routeId => this.addRoute(routeId));
            }
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application. Please try again later.');
        }
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Refresh button click
        this.refreshBtn.addEventListener('click', () => this.refreshData());
        
        // Auto-refresh toggle
        this.autoRefreshCheckbox.addEventListener('change', (e) => {
            this.isAutoRefreshEnabled = e.target.checked;
            this.isAutoRefreshEnabled ? this.startAutoRefresh() : this.stopAutoRefresh();
        });
        
        // Stop click events from map
        document.addEventListener('stop-clicked', (e) => {
            this.showPredictions(e.detail.stopId, e.detail.routeId, e.detail.stopName);
        });
        
        // Route path click events from map
        document.addEventListener('route-path-clicked', (e) => {
            // Check if the route is active
            if (this.activeRoutes.has(e.detail.routeId)) {
                // Select the route to show its buses
                
                this.selectRoute(e.detail.routeId);
            }
        });
    }
    
    /**
     * Load available routes from API and create route selection UI
     */
    async loadRoutes() {
        try {
            // Display loading message
            this.routeListContainer.innerHTML = '<div class="route-list-loading">Loading routes...</div>';
            
            const routes = await busAPI.getRoutes();
            
            // Store route info
            routes.forEach(route => {
                this.routeInfo[route.rt] = route;
            });
            
            // Clear container
            this.routeListContainer.innerHTML = '';
            
            // Add search input
            const searchDiv = document.createElement('div');
            searchDiv.className = 'route-search';
            searchDiv.innerHTML = `
                <input type="text" id="route-search" placeholder="Search routes...">
            `;
            this.routeListContainer.appendChild(searchDiv);
            
            // Add route list container
            const routeListDiv = document.createElement('div');
            routeListDiv.className = 'route-list';
            this.routeListContainer.appendChild(routeListDiv);
            
            // Group routes by type or first digit
            const groupedRoutes = await this.groupRoutes(routes);
            
            // Add routes to the container by group
            Object.entries(groupedRoutes).forEach(([group, groupRoutes]) => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'route-list-group';
                
                // Add group header
                const groupHeader = document.createElement('div');
                groupHeader.className = 'route-list-group-header';
                groupHeader.textContent = group;
                groupDiv.appendChild(groupHeader);
                
                // Add routes in this group
                groupRoutes.forEach(route => {
                    const routeColor = this.busMap.getRouteColor(route.rt);
                    
                    const routeItem = document.createElement('div');
                    routeItem.className = 'route-checkbox-item';
                    routeItem.innerHTML = `
                        <input type="checkbox" id="route-${route.rt}" data-route-id="${route.rt}">
                        <span class="route-color" style="background-color: ${routeColor};"></span>
                        <label for="route-${route.rt}">${route.rt} - ${route.rtnm}</label>
                    `;
                    
                    groupDiv.appendChild(routeItem);
                    
                    // Add event listener for checkbox
                    const checkbox = routeItem.querySelector(`input[type="checkbox"]`);
                    checkbox.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            this.firstLoad = true;
                            this.addRoute(route.rt);
                        } else {
                            this.removeRoute(route.rt);
                        }
                    });
                });
                
                routeListDiv.appendChild(groupDiv);
            });
            
            // Setup search functionality
            const searchInput = document.getElementById('route-search');
            searchInput.addEventListener('input', (e) => {
                this.filterRoutes(e.target.value.toLowerCase());
            });
            
        } catch (error) {
            console.error('Error loading routes:', error);
            this.showError('Failed to load routes. Please try again later.');
        }
    }
    
    /**
     * Group routes by type or first digit
     * @param {Array} routes - All routes
     * @returns {Object} - Grouped routes
     */
    async groupRoutes(routes) {
        try {
            // Process routes in batches of 10 to avoid overwhelming the API
            const BATCH_SIZE = 10;
            const activeRouteIds = new Set();
            
            // Process routes in batches
            for (let i = 0; i < routes.length; i += BATCH_SIZE) {
                const batch = routes.slice(i, i + BATCH_SIZE);
                const batchRouteIds = batch.map(route => route.rt);
                
                // Get vehicles for this batch
                const vehicles = await busAPI.getVehicles(batchRouteIds);
                
                // Add active routes from this batch
                if (Array.isArray(vehicles) && vehicles.length > 0) {
                    vehicles.forEach(vehicle => {
                        if (vehicle && vehicle.rt) {
                            activeRouteIds.add(vehicle.rt);
                        }
                    });
                }
            }
            
            // Group routes into active and inactive
            const grouped = {
                'Active Routes': [],
                'Inactive Routes': []
            };
            
            // Sort routes into groups
            routes.forEach(route => {
                const group = activeRouteIds.has(route.rt) ? 'Active Routes' : 'Inactive Routes';
                grouped[group].push(route);
            });
            
            // Sort routes numerically within each group
            Object.keys(grouped).forEach(group => {
                grouped[group].sort((a, b) => {
                    const numA = parseInt(a.rt.replace(/\D/g, ''));
                    const numB = parseInt(b.rt.replace(/\D/g, ''));
                    return numA - numB;
                });
            });
            
            return grouped;
        } catch (error) {
            console.error('Error in groupRoutes:', error);
            // Fallback to all routes in inactive group if there's an error
            return {
                'Active Routes': [],
                'Inactive Routes': routes.sort((a, b) => {
                    const numA = parseInt(a.rt.replace(/\D/g, ''));
                    const numB = parseInt(b.rt.replace(/\D/g, ''));
                    return numA - numB;
                })
            };
        }
    }
    
    /**
     * Filter routes based on search input
     * @param {string} query - Search query
     */
    filterRoutes(query) {
        const routeItems = document.querySelectorAll('.route-checkbox-item');
        const groups = document.querySelectorAll('.route-list-group');
        
        // Then in your JavaScript:
        routeItems.forEach(item => {
            const label = item.innerText.toLowerCase();
            if (label.includes(query)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');  
            }
        });

        groups.forEach(group => {
            const visibleItems = group.querySelectorAll('.route-checkbox-item:not(.hidden)');
            group.style.display = visibleItems.length === 0 ? 'none' : 'block';
        });
    }
    
    /**
     * Add a route to active routes
     * @param {string} routeId - Route ID to add
     */
    addRoute(routeId) {
        if (this.activeRoutes.has(routeId)) return;
        
        this.activeRoutes.add(routeId);
        this.addRouteTag(routeId);
        this.loadRouteData(routeId);
        
        // If this is the first route added or we don't have a selected route yet,
        // automatically select it
        if (this.firstLoad || !this.selectedRouteId) {
            this.selectRoute(routeId);
        }
        
        // Start auto-refresh if this is the first active route
        if (this.isAutoRefreshEnabled && this.firstLoad) {
            this.startAutoRefresh();
        }
    }
    
    /**
     * Add a route tag to the UI
     * @param {string} routeId - Route ID
     */
    addRouteTag(routeId) {
        const routeInfo = this.routeInfo[routeId] || { rtnm: 'Unknown' };
        const routeColor = this.busMap.getRouteColor(routeId);
        
        const routeTag = document.createElement('div');
        routeTag.className = 'route-tag';
        routeTag.dataset.routeId = routeId;
        
        // If this is the selected route, add active class
        if (routeId === this.selectedRouteId) {
            routeTag.classList.add('active');
        }
        
        if (routeColor) {
            routeTag.style.backgroundColor = routeColor;
        }
        
        routeTag.innerHTML = `
            ${routeId} - ${routeInfo.rtnm}
            <button class="remove-route-btn" data-route-id="${routeId}">&times;</button>
        `;
        
        // Button to remove the route
        routeTag.querySelector('.remove-route-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the route tag click
            this.removeRoute(routeId);
        });
        
        // Make the whole tag clickable to show bus info for this route
        routeTag.addEventListener('click', () => {
            this.firstLoad = true;
            this.selectRoute(routeId);
        });
        
        this.activeRoutesContainer.appendChild(routeTag);
        
        // Update corresponding checkbox in the route list
        const checkbox = document.getElementById(`route-${routeId}`);
        if (checkbox) {
            checkbox.checked = true;
        }
    }
    
    /**
     * Select a route to display its bus information
     * @param {string} routeId - Route ID to select
     */
    selectRoute(routeId) {
        // If the route is already selected, do nothing
        if (this.selectedRouteId === routeId) return;
        
        // Remove active class from previous selected route
        const prevSelected = document.querySelector('.route-tag.active');
        if (prevSelected) {
            prevSelected.classList.remove('active');
        }
        
        // Add active class to new selected route
        const newSelected = document.querySelector(`.route-tag[data-route-id="${routeId}"]`);
        if (newSelected) {
            newSelected.classList.add('active');
        }
        
        // Update selected route
        this.selectedRouteId = routeId;
        
        // Update the route indicator
        const routeInfo = this.routeInfo[routeId] || { rtnm: 'Unknown Route' };
        this.selectedRouteIndicator.textContent = `Route ${routeId} - ${routeInfo.rtnm}`;
        
        // Load the route's buses
        this.loadRouteData(routeId).then(buses => {
            // Update the bus info panel
            this.updateBusList(buses, routeId);
        });
    }
    
    /**
     * Remove a route from active routes
     * @param {string} routeId - Route ID to remove
     */
    removeRoute(routeId) {
        if (!this.activeRoutes.has(routeId)) return;
        
        this.activeRoutes.delete(routeId);
        
        // Remove route tag from UI
        const routeTag = this.activeRoutesContainer.querySelector(`.route-tag[data-route-id="${routeId}"]`);
        if (routeTag) routeTag.remove();
        
        // Update corresponding checkbox in the route list
        const checkbox = document.getElementById(`route-${routeId}`);
        if (checkbox) {
            checkbox.checked = false;
        }
        
        // Clear route from map
        this.busMap.clearRoute(routeId);
        
        // If this was the selected route, select another if available
        if (this.selectedRouteId === routeId) {
            if (this.activeRoutes.size > 0) {
                // Select the first active route
                this.selectRoute(Array.from(this.activeRoutes)[0]);
            } else {
                // No routes left, clear bus info
                this.selectedRouteId = null;
                this.selectedRouteIndicator.textContent = '';
                this.updateBusList([]);
            }
        }
        
        // Hide predictions if for this route
        if (this.selectedStop?.routeId === routeId) {
            this.hidePredictions();
        }
        
        // Stop auto-refresh if no active routes
        if (this.activeRoutes.size === 0) {
            this.stopAutoRefresh();
        }
    }
    
    /**
     * Refresh data for all active routes
     */
    async refreshData() {
        if (this.activeRoutes.size === 0) return;
        
        try {
            this.setLoading(true);
            
            // Load data for all active routes in parallel
            const promises = Array.from(this.activeRoutes).map(routeId => 
                this.loadRouteData(routeId)
            );
            
            await Promise.all(promises);
            
            // Refresh predictions if needed
            if (this.selectedStop) {
                this.refreshPredictions();
            }
            
            this.setLoading(false);
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.setLoading(false);
        }
    }
    
    /**
     * Load data for a specific route
     * @param {string} routeId - Route ID
     * @returns {Promise<Array>} - Promise resolving to array of buses
     */
    async loadRouteData(routeId) {
        if (!routeId) return [];
        
        try {
            // Load buses and route details in parallel
            const [buses, routeDetails] = await Promise.all([
                busAPI.getVehicles(routeId),
                busAPI.getRouteDetails(routeId)
            ]);
            
            // Always update stops and fetch route shape to ensure the route is displayed
            // even when no buses are running
            this.busMap.updateStops(routeDetails, routeId);
            
            // Make sure the route shape is always loaded
            if (!this.busMap.loadedRouteShapes.has(routeId)) {
                await this.busMap.fetchAndDisplayRouteShape(routeId);
            }
            
            // Update buses if any exist
            // Only fit to bounds when it's the first route added
            const isFirstRoute = this.firstLoad;
            this.busMap.updateBuses(buses, routeId, isFirstRoute);
            
            // Update bus list if this is the currently selected route
            if (routeId === this.selectedRouteId) {
                this.updateBusList(buses, routeId);
            }
            
            this.firstLoad = false;

            return buses;
        } catch (error) {
            console.error(`Error loading data for route ${routeId}:`, error);
            return [];
        }
    }
    
    /**
     * Update the bus list in the UI
     * @param {Array} buses - Array of bus objects
     * @param {string} routeId - Route ID
     */
    updateBusList(buses, routeId) {
        this.busList.innerHTML = '';
        
        // If no buses, show message
        if (!buses || buses.length === 0) {
            const noSelection = document.createElement('p');
            noSelection.className = 'no-selection';
            noSelection.textContent = routeId 
                ? `No active buses found for route ${routeId}` 
                : 'No route selected';
            this.busList.appendChild(noSelection);
            return;
        }
        
        // Add route header
        this.addRouteHeader(routeId);
        
        // Add bus items
        buses.forEach(bus => this.addBusListItem(bus, routeId));
    }
    
    /**
     * Add route header to bus list
     * @param {string} routeId - Route ID
     */
    addRouteHeader(routeId) {
        const routeColor = this.busMap.getRouteColor(routeId);
        const routeHeader = document.createElement('div');
        routeHeader.className = 'route-header';
        routeHeader.textContent = `Route ${routeId} - ${this.routeInfo[routeId]?.rtnm || ''}`;
        
        if (routeColor) {
            routeHeader.style.borderBottomColor = routeColor;
            routeHeader.style.color = routeColor;
        }
        
        this.busList.appendChild(routeHeader);
    }
    
    /**
     * Add bus item to the bus list
     * @param {Object} bus - Bus data
     * @param {string} routeId - Route ID
     */
    addBusListItem(bus, routeId) {
        const busItem = document.createElement('div');
        busItem.className = 'bus-item';
        
        busItem.innerHTML = `
            <div class="bus-id">Bus #${bus.vid}</div>
            <div class="bus-details">
                <div class="detail-row">
                    <span class="detail-label">Direction:</span>
                    <span>${bus.des}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Heading:</span>
                    <span>${this.getHeadingText(bus.hdg)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Delayed:</span>
                    <span>${bus.dly ? 'Yes' : 'No'}</span>
                </div>
            </div>
        `;
        
        // Click to center map on this bus
        busItem.addEventListener('click', () => {
            const marker = this.busMap.busMarkers[routeId]?.[bus.vid];
            if (marker) {
                this.busMap.map.setView([bus.lat, bus.lon], 16);
                marker.openPopup();
            }
        });
        
        this.busList.appendChild(busItem);
    }
    
    /**
     * Show predictions for a stop
     * @param {string} stopId - Stop ID
     * @param {string} routeId - Route ID
     * @param {string} stopName - Stop name
     */
    async showPredictions(stopId, routeId, stopName) {
        this.selectedStop = { stopId, routeId, stopName };
        
        // Update stop indicator
        this.selectedStopIndicator.textContent = `Stop #${stopId}: ${stopName}`;
        
        // Show loading state
        this.predictionsContent.innerHTML = '<div class="loading">Loading predictions...</div>';
        
        try {
            const predictions = await busAPI.getPredictions(stopId, routeId);
            this.updatePredictionsContent(predictions, stopName, routeId);
            
            // Set up prediction refresh interval
            if (this.isAutoRefreshEnabled && !this.predictionsInterval) {
                this.predictionsInterval = setInterval(() => {
                    this.refreshPredictions();
                }, CONFIG.api.refreshInterval);
            }
            
            // Select the route if it's not the currently selected one
            if (this.selectedRouteId !== routeId) {
                this.selectRoute(routeId);
            }
        } catch (error) {
            console.error('Error fetching predictions:', error);
            this.predictionsContent.innerHTML = `
                <div class="error">Failed to load predictions. Please try again.</div>
            `;
        }
    }
    
    /**
     * Refresh predictions for the currently selected stop
     */
    async refreshPredictions() {
        if (!this.selectedStop) return;
        
        try {
            const { stopId, routeId, stopName } = this.selectedStop;
            const predictions = await busAPI.getPredictions(stopId, routeId);
            this.updatePredictionsContent(predictions, stopName, routeId);
        } catch (error) {
            console.error('Error refreshing predictions:', error);
        }
    }
    
    /**
     * Update the predictions content
     * @param {Array} predictions - Array of prediction objects
     * @param {string} stopName - Stop name
     * @param {string} routeId - Route ID
     */
    updatePredictionsContent(predictions, stopName, routeId) {
        const routeInfo = this.routeInfo[routeId] || { rtnm: 'Unknown Route' };
        const routeColor = this.busMap.getRouteColor(routeId);
        
        // Create header
        let html = this.createPredictionHeader(stopName, routeId, routeInfo, routeColor);
        
        // If no predictions, show message
        if (!predictions || predictions.length === 0) {
            html += `<div class="no-predictions">No upcoming arrivals found for this stop.</div>`;
        } else {
            // Sort predictions by arrival time
            predictions.sort((a, b) => {
                const timeA = this.parsePredictionTime(a.prdtm);
                const timeB = this.parsePredictionTime(b.prdtm);
                return timeA - timeB;
            });
            
            // Add each prediction
            predictions.forEach(prediction => {
                html += this.createPredictionItem(prediction, routeColor);
            });
        }
        
        // Add refresh timestamp
        html += `
            <div style="text-align: center; font-size: 0.8rem; color: #999; margin-top: 1rem;">
                Last updated: ${new Date().toLocaleTimeString()}
            </div>
        `;
        
        // Update content
        this.predictionsContent.innerHTML = html;
    }
    
    /**
     * Create prediction header HTML
     */
    createPredictionHeader(stopName, routeId, routeInfo, routeColor) {
        return `
            <div class="stop-info-header">
                <div style="font-weight: bold; font-size: 1.1rem; color: ${routeColor};">
                    ${stopName}
                </div>
                <div>
                    Route ${routeId} - ${routeInfo.rtnm}
                </div>
            </div>
        `;
    }
    
    /**
     * Create prediction item HTML
     */
    createPredictionItem(prediction, routeColor) {
        const predTime = this.parsePredictionTime(prediction.prdtm);
        const minutesUntil = parseInt(prediction.prdctdn, 10) || 0;
        const arrivalText = minutesUntil <= 0 ? 'Arriving now' : 
            minutesUntil === 1 ? '1 minute' : `${minutesUntil} minutes`;
        
        return `
            <div class="prediction-item" style="border-left-color: ${routeColor};">
                <div class="prediction-time">
                    ${predTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    <span class="prediction-countdown">
                        (${arrivalText})
                    </span>
                </div>
                <div class="prediction-details">
                    <div>Bus #${prediction.vid}</div>
                    <div>Destination: ${prediction.des}</div>
                    <div>${prediction.dly === true ? 'Bus is delayed' : ''}</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Parse prediction time string
     * @param {string} dateStr - Date string from API (yyyyMMdd HH:mm)
     * @returns {Date} - JavaScript Date object
     */
    parsePredictionTime(dateStr) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6) - 1; // JS months are 0-based
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(9, 11);
        const minute = dateStr.substring(12, 14);
        return new Date(year, month, day, hour, minute);
    }
    
    /**
     * Hide predictions panel
     */
    hidePredictions() {
        this.selectedStop = null;
        this.selectedStopIndicator.textContent = '';
        this.predictionsContent.innerHTML = '<p class="no-selection">Click on a stop to see arrival predictions</p>';
        
        // Clear prediction refresh interval
        if (this.predictionsInterval) {
            clearInterval(this.predictionsInterval);
            this.predictionsInterval = null;
        }
    }
    
    /**
     * Start auto-refresh timer
     */
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, CONFIG.api.refreshInterval);
    }
    
    /**
     * Stop auto-refresh timer
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    /**
     * Set loading state
     * @param {boolean} isLoading - Whether the app is loading
     */
    setLoading(isLoading) {
        // Update UI elements
        this.refreshBtn.disabled = isLoading;
        this.refreshBtn.textContent = isLoading ? 'Loading...' : 'Refresh Data';
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        alert(message);
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

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.busTrackerApp = new BusTrackerApp();
});
/**
 * Configuration settings for the CTA Bus Tracker application
 */
const CONFIG = {
    // API Settings
    api: {
        baseUrl: 'https://chicago-bus-hello-3aao3.ondigitalocean.app/api',
        refreshInterval: 30000, // 30 seconds
    },
    
    // Map Settings
    map: {
        center: [41.8781, -87.6298], // Chicago coordinates
        zoom: 13,
        // Using Positron style - a light, minimalist map style
        tileLayer: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        stopsVisibleZoom: 14, // Minimum zoom level to show stops
    },
    
    // Route Settings
    defaultRoutes: ['22'], // Route 22 - Clark
    
    // UI settings
    colors: {
        // Predefined route colors
        routes: {
            '22': '#1E88E5', // Clark - Blue
            '36': '#43A047', // Broadway - Green 
            '151': '#E53935', // Sheridan - Red
            '146': '#FB8C00', // Inner Drive/Michigan Express - Orange
            '66': '#8E24AA', // Chicago - Purple
            '6': '#F9A825', // Jackson Park Express - Yellow
            '4': '#00ACC1', // Cottage Grove - Cyan
            '9': '#5E35B1'  // Ashland - Deep Purple
        },
        // Palette for new routes
        palette: [
            '#1E88E5', // Blue
            '#43A047', // Green
            '#E53935', // Red
            '#FB8C00', // Orange
            '#8E24AA', // Purple
            '#F9A825', // Yellow
            '#00ACC1', // Cyan
            '#5E35B1', // Deep Purple
            '#3949AB', // Indigo
            '#D81B60', // Pink
            '#546E7A', // Blue Grey
            '#6D4C41', // Brown
            '#26A69A', // Teal
            '#7CB342', // Light Green
            '#F4511E', // Deep Orange
            '#757575'  // Grey
        ]
    },
    
    // External data sources
    externalAPIs: {
        routeShapes: 'https://data.cityofchicago.org/resource/6uva-a5ei.json'
    }
};

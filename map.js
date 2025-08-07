// Butterfly Map - Synchronized with Gallery
let butterflyMap;
let markerCluster;

function initMap() {
    // Initialize map
    butterflyMap = L.map('map').setView([39.8283, -98.5795], 4);
    
    // Add base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(butterflyMap);
    
    // Initialize marker cluster
    markerCluster = L.markerClusterGroup();
    butterflyMap.addLayer(markerCluster);
    
    // Connect to gallery updates
    connectToGallery();
}

function connectToGallery() {
    if (!window.infiniteGalleryUpdater) return;
    
    // Store original update function
    const originalUpdate = infiniteGalleryUpdater.updateInfiniteGalleryContainer;
    
    // Override to update map when gallery updates
    infiniteGalleryUpdater.updateInfiniteGalleryContainer = function() {
        updateMapFromGallery();
        return originalUpdate.apply(this, arguments);
    };
}

function updateMapFromGallery() {
    if (!window.infiniteGalleryUpdater || !butterflyMap) return;
    
    // Clear existing markers
    markerCluster.clearLayers();
    
    // Get current filtered images
    const filteredImages = infiniteGalleryUpdater.getFilteredImages();
    
    // Add markers for each image with coordinates
    filteredImages.forEach(img => {
        const coords = parseCoordinates(img.fullTitle);
        if (coords) {
            const popupContent = `
                <div class="popup-species">${img.species}</div>
                <div class="popup-common">${img.commonName}</div>
                <img src="${img.thumbnailUrl}" class="popup-image">
                ${img.location ? `<div>📍 ${img.location}</div>` : ''}
            `;
            
            L.marker(coords)
                .bindPopup(popupContent)
                .addTo(markerCluster);
        }
    });
    
    // Auto-zoom to show markers
    if (markerCluster.getLayers().length > 0) {
        butterflyMap.fitBounds(markerCluster.getBounds());
    }
}

function parseCoordinates(text) {
    if (!text) return null;

    // Decode HTML entities including degree symbol
    const decodedText = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#176;/g, '°');

    // Coordinate patterns (DMS and decimal formats)
    const coordPatterns = [
        /\(([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s*([0-9]+)°([0-9]+)'([0-9]+)''([EW])[^)]*\)/,
        /\(([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+)''([EW])[^)]*\)/,
        /([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+)''([EW])/,
        /([0-9]+)°([0-9]+)'([0-9]+)''([NS])([0-9]+)°([0-9]+)'([0-9]+)''([EW])/,
        /\(([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s*,?\s*([0-9]+)°([0-9]+)'([0-9]+)''([EW])/,
        /\(([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/,
        /([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/
    ];

    for (let pattern of coordPatterns) {
        const match = decodedText.match(pattern);
        if (match) {
            if (match.length >= 8) {
                // DMS format
                const latDeg = parseInt(match[1]);
                const latMin = parseInt(match[2]);
                const latSec = parseInt(match[3]);
                const latDir = match[4];
                
                const lonDeg = parseInt(match[5]);
                const lonMin = parseInt(match[6]);
                const lonSec = parseInt(match[7]);
                const lonDir = match[8];

                let lat = latDeg + latMin/60 + latSec/3600;
                let lon = lonDeg + lonMin/60 + lonSec/3600;

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                return [lat, lon];
            } else if (match.length >= 4) {
                // Decimal format
                let lat = parseFloat(match[1]);
                const latDir = match[2];
                let lon = parseFloat(match[3]);
                const lonDir = match[4];

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                return [lat, lon];
            }
        }
    }
    return null;
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', initMap);

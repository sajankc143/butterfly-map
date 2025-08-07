// Synchronized Butterfly Map
let butterflyMap;
let markerCluster;

function initMap() {
    butterflyMap = L.map('map').setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(butterflyMap);
    
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
    
    // Get current filtered images from gallery
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
    
    // Auto-zoom to show all markers if we have any
    if (markerCluster.getLayers().length > 0) {
        butterflyMap.fitBounds(markerCluster.getBounds());
    }
}

// Your existing parseCoordinates function
function parseCoordinates(text) {
    // ... keep your existing coordinate parsing logic ...
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initMap);

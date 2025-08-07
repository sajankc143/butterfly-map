// Butterfly Map - Fully Synchronized with Gallery
let butterflyMap;
let markerCluster;
let currentObservations = [];

function initMap() {
    butterflyMap = L.map('map').setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(butterflyMap);
    
    markerCluster = L.markerClusterGroup();
    butterflyMap.addLayer(markerCluster);
    
    // Connect to gallery search
    connectGallerySearch();
}

function connectGallerySearch() {
    const speciesFilter = document.getElementById('speciesFilter');
    if (speciesFilter) {
        speciesFilter.addEventListener('input', function() {
            updateMapWithFilter(this.value);
        });
    }
}

function updateMapWithFilter(filterValue) {
    if (!window.infiniteGalleryUpdater) return;
    
    // Get current filtered results from gallery
    const filtered = infiniteGalleryUpdater.filteredImages.filter(img => {
        return img.species.toLowerCase().includes(filterValue.toLowerCase()) || 
               img.commonName.toLowerCase().includes(filterValue.toLowerCase());
    });
    
    // Convert to map observations
    currentObservations = filtered.map(img => ({
        species: img.species,
        commonName: img.commonName,
        coordinates: parseCoordinates(img.fullTitle),
        location: img.location,
        imageUrl: img.thumbnailUrl,
        sourceUrl: img.sourceUrl
    }));
    
    // Update map markers
    updateMapMarkers();
}

function updateMapMarkers() {
    markerCluster.clearLayers();
    
    currentObservations.forEach(obs => {
        if (obs.coordinates) {
            const popupContent = `
                <div class="popup-species">${obs.species}</div>
                <div class="popup-common">${obs.commonName}</div>
                <img src="${obs.imageUrl}" class="popup-image">
                ${obs.location ? `<div>📍 ${obs.location}</div>` : ''}
            `;
            
            L.marker(obs.coordinates)
                .bindPopup(popupContent)
                .addTo(markerCluster);
        }
    });
    
    if (currentObservations.length > 0) {
        butterflyMap.fitBounds(markerCluster.getBounds());
    }
}

// Your existing coordinate parsing function
function parseCoordinates(text) {
    // ... keep your current implementation ...
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initMap);

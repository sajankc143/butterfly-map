let map;
let observations = [];
let markers = [];
let markerGroup;

// Initialize the map
function initMap() {
    map = L.map('map').setView([39.8283, -98.5795], 4); // Center on US

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markerGroup = L.layerGroup().addTo(map);

    // Add species filter functionality
    const speciesFilter = document.getElementById('speciesFilter');
    if (speciesFilter) {
        speciesFilter.addEventListener('input', filterObservations);
    }
}

// Parse coordinates from various formats
function parseCoordinates(text) {
    if (!text) return null;

    // Decode HTML entities first - including degree symbol
    const decodedText = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#176;/g, '°');
    
    // Pattern for coordinates like (36°34'41''N 105°26'26''W, elevation)
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

// Convert gallery images to map observations
function convertGalleryImagesToObservations(galleryImages) {
    const mapObservations = [];
    
    galleryImages.forEach((image) => {
        // Only process images that have fullTitle (data-title) which contains coordinate info
        if (!image.fullTitle || !image.hasDataTitle) {
            return;
        }
        
        // Parse coordinates from the fullTitle
        const coordinates = parseCoordinates(image.fullTitle);
        
        if (coordinates) {
            // Extract photographer from fullTitle
            const photographerMatch = image.fullTitle.match(/©\s*([^&]+(?:&[^&]+)*)/);
            let photographer = '';
            if (photographerMatch) {
                photographer = photographerMatch[1].trim();
            }

            mapObservations.push({
                species: image.species,
                commonName: image.commonName,
                coordinates: coordinates,
                location: image.location || '',
                date: image.date ? (typeof image.date === 'string' ? image.date : image.date.toISOString().split('T')[0]) : '',
                photographer: photographer,
                imageUrl: image.thumbnailUrl,
                fullImageUrl: image.fullImageUrl,
                sourceUrl: image.sourceUrl,
                originalTitle: image.fullTitle
            });
        }
    });

    return mapObservations;
}

// Hook into the gallery's refresh cycle
function hookIntoGallery() {
    // Store original scanAllPages method
    if (window.infiniteGalleryUpdater && typeof window.infiniteGalleryUpdater.scanAllPages === 'function') {
        const originalScanAllPages = window.infiniteGalleryUpdater.scanAllPages.bind(window.infiniteGalleryUpdater);
        
        // Override it to include our map update
        window.infiniteGalleryUpdater.scanAllPages = async function() {
            console.log('Gallery scanning pages - map will update after...');
            
            // Call the original method
            const result = await originalScanAllPages();
            
            // Update map after gallery is done
            setTimeout(() => {
                updateMapFromGallery();
            }, 1000);
            
            return result;
        };
        
        console.log('Successfully hooked into gallery refresh cycle');
        return true;
    }
    
    return false;
}

// Update map from gallery data
function updateMapFromGallery() {
    if (!window.infiniteGalleryUpdater || !window.infiniteGalleryUpdater.allImages) {
        console.log('Gallery data not available yet');
        return false;
    }
    
    console.log('Updating map from gallery data...');
    
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
        loadingDiv.textContent = 'Loading observations from gallery data...';
    }
    
    // Convert gallery images to observations
    const galleryImages = window.infiniteGalleryUpdater.allImages;
    observations = convertGalleryImagesToObservations(galleryImages);
    
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
    
    console.log(`Map updated with ${observations.length} observations from gallery`);
    displayObservations();
    return true;
}

// Original loadObservations function - now redirects to gallery
function loadObservations() {
    console.log('loadObservations called - checking for gallery data...');
    
    if (window.infiniteGalleryUpdater && window.infiniteGalleryUpdater.allImages && window.infiniteGalleryUpdater.allImages.length > 0) {
        return updateMapFromGallery();
    } else {
        // If gallery isn't ready, try to trigger it
        console.log('Gallery not ready, attempting to initialize...');
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
            loadingDiv.textContent = 'Waiting for gallery to load...';
        }
        
        // Try to trigger gallery loading if it exists
        if (window.infiniteGalleryUpdater && typeof window.infiniteGalleryUpdater.scanAllPages === 'function') {
            window.infiniteGalleryUpdater.scanAllPages();
        }
        
        return false;
    }
}

// Display observations on the map
function displayObservations() {
    if (!markerGroup) return;
    
    markerGroup.clearLayers();

    const filteredObs = getCurrentFilteredObservations();

    filteredObs.forEach(obs => {
        const popupContent = `
            <div>
                <div class="popup-species" style="font-style: italic; font-weight: bold;">${obs.species}</div>
                <div class="popup-common" style="font-weight: bold; margin-bottom: 10px;">${obs.commonName}</div>
                ${obs.imageUrl ? `<img src="${obs.imageUrl}" class="popup-image" alt="${obs.species}" style="max-width: 200px; height: auto; margin-bottom: 10px;" onerror="this.style.display='none'">` : ''}
                <div class="popup-location" style="margin-bottom: 5px;">📍 ${obs.location}</div>
                ${obs.date ? `<div class="popup-date" style="margin-bottom: 5px;">📅 ${obs.date}</div>` : ''}
                ${obs.photographer ? `<div class="popup-photographer" style="margin-bottom: 5px;">📷 ${obs.photographer}</div>` : ''}
                <div class="popup-source" style="margin-bottom: 5px;">🔗 ${getPageName(obs.sourceUrl)}</div>
            </div>
        `;

        const marker = L.marker(obs.coordinates)
            .bindPopup(popupContent)
            .addTo(markerGroup);
    });

    // Fit map to show all markers
    if (filteredObs.length > 0) {
        const group = new L.featureGroup(markerGroup.getLayers());
        map.fitBounds(group.getBounds().pad(0.1));
    }

    updateStats();
}

// Filter observations based on species filter
function filterObservations() {
    displayObservations();
}

// Get currently filtered observations
function getCurrentFilteredObservations() {
    const speciesFilterElement = document.getElementById('speciesFilter');
    const speciesFilter = speciesFilterElement ? speciesFilterElement.value.toLowerCase() : '';
    
    if (!speciesFilter) {
        return observations;
    }

    return observations.filter(obs => 
        obs.species.toLowerCase().includes(speciesFilter) ||
        obs.commonName.toLowerCase().includes(speciesFilter)
    );
}

// Clear the map
function clearMap() {
    if (markerGroup) {
        markerGroup.clearLayers();
    }
    observations = [];
    updateStats();
}

// Update statistics
function updateStats() {
    const filteredObs = getCurrentFilteredObservations();
    const uniqueSpecies = new Set(filteredObs.map(obs => obs.species)).size;
    const uniqueLocations = new Set(filteredObs.map(obs => obs.location)).size;
    const sourceCounts = {};

    observations.forEach(obs => {
        const pageName = getPageName(obs.sourceUrl);
        sourceCounts[pageName] = (sourceCounts[pageName] || 0) + 1;
    });

    const statsHtml = `
        <div class="stat-card">
            <div class="stat-number">${filteredObs.length}</div>
            <div class="stat-label">Total Observations</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${uniqueSpecies}</div>
            <div class="stat-label">Unique Species</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${uniqueLocations}</div>
            <div class="stat-label">Unique Locations</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Object.keys(sourceCounts).length}</div>
            <div class="stat-label">Source Pages</div>
        </div>
    `;

    const statsElement = document.getElementById('stats');
    if (statsElement) {
        statsElement.innerHTML = statsHtml;
    }
}

// Get page name from URL
function getPageName(url) {
    const pageNames = {
        'butterflies-of-texas.html': 'Texas',
        'butterflies-of-puerto-rico.html': 'Puerto Rico',
        'butterflies-of-new-mexico.html': 'New Mexico',
        'butterflies-of-arizona.html': 'Arizona',
        'butterflies-of-panama.html': 'Panama',
        'butterflies-of-florida.html': 'Florida',
        'new-butterflies.html': 'New Butterflies',
        'dual-checklist.html': 'Dual Checklist'
    };
    
    for (const [key, name] of Object.entries(pageNames)) {
        if (url.includes(key)) return name;
    }
    return 'Unknown';
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Map script initializing...');
    initMap();
    
    // Try to hook into gallery immediately if it exists
    if (window.infiniteGalleryUpdater) {
        hookIntoGallery();
        // If gallery already has data, use it
        if (window.infiniteGalleryUpdater.allImages && window.infiniteGalleryUpdater.allImages.length > 0) {
            updateMapFromGallery();
        }
    } else {
        // Wait for gallery to be created
        let attempts = 0;
        const maxAttempts = 50; // 10 seconds
        
        const checkForGallery = setInterval(() => {
            attempts++;
            
            if (window.infiniteGalleryUpdater) {
                console.log('Gallery found, hooking in...');
                clearInterval(checkForGallery);
                hookIntoGallery();
                
                // If gallery already has data, use it
                if (window.infiniteGalleryUpdater.allImages && window.infiniteGalleryUpdater.allImages.length > 0) {
                    updateMapFromGallery();
                }
            } else if (attempts >= maxAttempts) {
                console.log('Gallery not found after 10 seconds');
                clearInterval(checkForGallery);
            }
        }, 200);
    }
});

// Make key functions global
window.loadObservations = loadObservations;
window.clearMap = clearMap;
window.updateMapFromGallery = updateMapFromGallery;

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
    document.getElementById('speciesFilter').addEventListener('input', filterObservations);
}

// Parse coordinates from various formats
function parseCoordinates(text) {
    if (!text) return null;

    console.log('Parsing coordinates from:', text); // Debug log

    // Decode HTML entities first - including degree symbol
    const decodedText = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#176;/g, '°');  // Add this line to decode degree symbols
    
    // Pattern for coordinates like (36°34'41''N 105°26'26''W, elevation)
    const coordPatterns = [
        // Most flexible pattern - handles various spacing
        /\(([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s*([0-9]+)°([0-9]+)'([0-9]+)''([EW])[^)]*\)/,
        // Standard format with space: (36°34'41''N 105°26'26''W, 10227 ft.)
        /\(([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+)''([EW])[^)]*\)/,
        // Without parentheses but with space: 36°34'41''N 105°26'26''W
        /([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+)''([EW])/,
        // Without parentheses, no space: 36°34'41''N105°26'26''W
        /([0-9]+)°([0-9]+)'([0-9]+)''([NS])([0-9]+)°([0-9]+)'([0-9]+)''([EW])/,
        // With various spacing and commas
        /\(([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s*,?\s*([0-9]+)°([0-9]+)'([0-9]+)''([EW])/,
        // Decimal degrees in parentheses
        /\(([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/,
        // Simple decimal pattern
        /([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/
    ];

    for (let pattern of coordPatterns) {
        const match = decodedText.match(pattern);
        if (match) {
            console.log('Coordinate match found:', match); // Debug log
            
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

                console.log('Parsed coordinates:', [lat, lon]); // Debug log
                return [lat, lon];
            } else if (match.length >= 4) {
                // Decimal format
                let lat = parseFloat(match[1]);
                const latDir = match[2];
                let lon = parseFloat(match[3]);
                const lonDir = match[4];

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                console.log('Parsed decimal coordinates:', [lat, lon]); // Debug log
                return [lat, lon];
            }
        }
    }

    // Try to find any numbers that look like coordinates
    const numberPattern = /([0-9]+(?:\.[0-9]+)?)[°\s]*[NS]?[,\s]+([0-9]+(?:\.[0-9]+)?)[°\s]*[EW]?/;
    const numberMatch = decodedText.match(numberPattern);
    if (numberMatch) {
        const lat = parseFloat(numberMatch[1]);
        const lon = parseFloat(numberMatch[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            console.log('Fallback coordinate parsing:', [lat, lon]); // Debug log
            return [lat, lon];
        }
    }

    console.log('No coordinates found in:', decodedText); // Debug log
    return null;
}

// Convert gallery images to map observations
function convertGalleryImagesToObservations(galleryImages) {
    const mapObservations = [];
    
    galleryImages.forEach((image, index) => {
        // Only process images that have fullTitle (data-title) which contains coordinate info
        if (!image.fullTitle || !image.hasDataTitle) {
            return;
        }
        
        console.log(`Processing gallery image ${index + 1}: ${image.species}`);
        
        // Parse coordinates from the fullTitle
        const coordinates = parseCoordinates(image.fullTitle);
        
        if (coordinates) {
            console.log(`Found coordinates for ${image.species}: ${coordinates}`);
            
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
            
            console.log(`Added observation: ${image.species} at ${image.location}`);
        } else {
            console.log(`No coordinates found for: ${image.species} - ${image.commonName}`);
        }
    });

    console.log(`Converted ${mapObservations.length} gallery images to map observations`);
    return mapObservations;
}

// Load observations from gallery data
function loadObservationsFromGallery() {
    console.log('Loading observations from gallery data...');
    
    // Check if gallery updater exists and has data
    if (!window.infiniteGalleryUpdater || !window.infiniteGalleryUpdater.allImages) {
        console.warn('Gallery updater not found or no images loaded');
        return false;
    }
    
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
        loadingDiv.textContent = 'Loading observations from gallery data...';
    }
    
    // Clear existing observations
    observations = [];
    clearMap();
    
    // Convert gallery images to observations
    const galleryImages = window.infiniteGalleryUpdater.allImages;
    observations = convertGalleryImagesToObservations(galleryImages);
    
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
    
    console.log(`Total observations loaded from gallery: ${observations.length}`);
    displayObservations();
    return true;
}

// Display observations on the map
function displayObservations() {
    markerGroup.clearLayers();

    const filteredObs = getCurrentFilteredObservations();

    filteredObs.forEach(obs => {
        const popupContent = `
            <div>
                <div class="popup-species">${obs.species}</div>
                <div class="popup-common">${obs.commonName}</div>
                ${obs.imageUrl ? `<img src="${obs.imageUrl}" class="popup-image" alt="${obs.species}" onerror="this.style.display='none'">` : ''}
                <div class="popup-location">📍 ${obs.location}</div>
                ${obs.date ? `<div class="popup-date">📅 ${obs.date}</div>` : ''}
                ${obs.photographer ? `<div class="popup-date">📷 ${obs.photographer}</div>` : ''}
                <div class="popup-date">🔗 ${getPageName(obs.sourceUrl)}</div>
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
    const speciesFilter = document.getElementById('speciesFilter').value.toLowerCase();
    
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

// Auto-refresh observations when gallery data updates
function setupGalleryDataWatcher() {
    // Check for gallery updates every 5 seconds
    const watchInterval = setInterval(() => {
        if (window.infiniteGalleryUpdater && 
            window.infiniteGalleryUpdater.allImages && 
            window.infiniteGalleryUpdater.allImages.length > 0) {
            
            // Check if we need to update (no observations yet, or gallery has more images)
            const galleryImageCount = window.infiniteGalleryUpdater.allImages.length;
            const currentObsCount = observations.length;
            
            if (currentObsCount === 0 || galleryImageCount !== currentObsCount) {
                console.log(`Gallery data updated: ${galleryImageCount} images available, ${currentObsCount} current observations`);
                loadObservationsFromGallery();
            }
        }
    }, 5000);
    
    return watchInterval;
}

// Manual refresh function (can be called from UI)
function refreshMapFromGallery() {
    const success = loadObservationsFromGallery();
    if (success) {
        console.log('Map refreshed from gallery data');
    } else {
        console.warn('Failed to refresh map from gallery data');
    }
    return success;
}

// Test coordinate parsing with your exact examples
function testCoordinateParsing() {
    console.log('=== TESTING COORDINATE PARSING ===');
    
    // Your exact examples
    const testData = [
        "&lt;p4&gt;&lt;i&gt;Pieris marginalis&lt;/i&gt; - Margined White&lt;/p4&gt;&lt;br/&gt;Taos Ski Valley, Taos Co., New Mexico (36°34'41''N 105°26'26''W, 10227 ft.) 2025/07/07 © Sajan K.C. &amp; Anisha Sapkota",
        "<p4><i>Wallengrenia drury</i> - Drury's Broken-dash</p4><br/>El Yunque National Forest, Puerto Rico (18°18'35''N 65°47'38''W, 3400 ft.) 2024/02/21 © Sajan K.C. & Anisha Sapkota"
    ];
    
    testData.forEach((test, index) => {
        console.log(`\nTest ${index + 1}:`);
        console.log('Input:', test);
        const coords = parseCoordinates(test);
        console.log('Parsed coordinates:', coords);
        if (coords) {
            console.log('✅ SUCCESS: Coordinates extracted');
        } else {
            console.log('❌ FAILED: No coordinates found');
        }
    });
    
    console.log('=== END TEST ===\n');
}

// Add a test button to the page
function addTestButton() {
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Coordinate Parsing';
    testButton.onclick = testCoordinateParsing;
    testButton.style.cssText = 'position: fixed; top: 10px; right: 120px; z-index: 1000; padding: 10px; background: #ff6b6b; color: white; border: none; border-radius: 5px; cursor: pointer;';
    document.body.appendChild(testButton);
}

// Add refresh button
function addRefreshButton() {
    const refreshButton = document.createElement('button');
    refreshButton.textContent = 'Refresh Map';
    refreshButton.onclick = refreshMapFromGallery;
    refreshButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 10px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer;';
    document.body.appendChild(refreshButton);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    addTestButton();
    addRefreshButton();
    
    // Automatically run the test
    setTimeout(testCoordinateParsing, 1000);
    
    // Setup watcher for gallery data
    setupGalleryDataWatcher();
    
    // Try initial load in case gallery is already loaded
    setTimeout(() => {
        loadObservationsFromGallery();
    }, 2000);
});

// Make functions available globally for debugging
window.loadObservationsFromGallery = loadObservationsFromGallery;
window.refreshMapFromGallery = refreshMapFromGallery;
window.testCoordinateParsing = testCoordinateParsing;

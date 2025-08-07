let map;
let observations = [];
let markers = [];
let markerGroup;
let isLoading = false; // Prevent multiple simultaneous loads

// Source URLs to load automatically
const sourceUrls = [
    "https://www.butterflyexplorers.com/p/new-butterflies.html",
    "https://www.butterflyexplorers.com/p/dual-checklist.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-arizona.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-florida.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-texas.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-puerto-rico.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-new-mexico.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-panama.html"
];

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

    console.log('Parsing coordinates from:', text.substring(0, 100) + '...'); // Debug log

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

    console.log('No coordinates found in:', decodedText.substring(0, 200)); // Debug log
    return null;
}

// Extract observation data from HTML content
function extractObservations(htmlContent, sourceUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const foundObservations = [];

    // Find all image links with data-title attributes
    const imageLinks = doc.querySelectorAll('a[data-title]');
    console.log(`Found ${imageLinks.length} image links with data-title in ${getPageName(sourceUrl)}`);

    imageLinks.forEach((link, index) => {
        const dataTitle = link.getAttribute('data-title');
        const img = link.querySelector('img');
        
        if (dataTitle && img) {
            console.log(`Processing image ${index + 1}:`, dataTitle.substring(0, 100) + '...'); // Debug log
            
            // Decode HTML entities in data-title
            const decodedTitle = dataTitle.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
            
            // Parse species and common name - handle both <p4><i> and <i> formats
            let speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+)<\/p4>/);
            if (!speciesMatch) {
                speciesMatch = decodedTitle.match(/<i>(.*?)<\/i>\s*[-–]\s*([^<]+?)(?:<br|$)/);
            }
            
            let species = 'Unknown Species';
            let commonName = 'Unknown';

            if (speciesMatch) {
                species = speciesMatch[1].trim();
                commonName = speciesMatch[2].trim();
                console.log(`Parsed species: ${species} - ${commonName}`);
            } else {
                console.log('Could not parse species from title');
            }

            // Parse coordinates
            const coordinates = parseCoordinates(decodedTitle);
            
            if (coordinates) {
                console.log(`Found coordinates: ${coordinates}`);
                
                // Extract location name - everything between <br/> and coordinates
                let location = '';
                const locationPatterns = [
                    /<br\/?>\s*([^(]+?)(?:\s+\([0-9])/,  // Location before coordinates
                    /<br\/?>\s*([^(]+?)$/,               // Location at end
                    /<br\/?>\s*([^<]+?)\s+\d{4}\/\d{2}\/\d{2}/ // Location before date
                ];
                
                for (let pattern of locationPatterns) {
                    const locationMatch = decodedTitle.match(pattern);
                    if (locationMatch) {
                        location = locationMatch[1].trim();
                        break;
                    }
                }

                // Extract date
                const dateMatch = decodedTitle.match(/(\d{4}\/\d{2}\/\d{2})/);
                let date = '';
                if (dateMatch) {
                    date = dateMatch[1];
                }

                // Extract photographer
                const photographerMatch = decodedTitle.match(/©\s*([^&]+(?:&[^&]+)*)/);
                let photographer = '';
                if (photographerMatch) {
                    photographer = photographerMatch[1].trim();
                }

                foundObservations.push({
                    species: species,
                    commonName: commonName,
                    coordinates: coordinates,
                    location: location,
                    date: date,
                    photographer: photographer,
                    imageUrl: img.getAttribute('src'),
                    fullImageUrl: link.getAttribute('href'),
                    sourceUrl: sourceUrl,
                    originalTitle: decodedTitle
                });
                
                console.log(`Added observation: ${species} at ${location}`);
            } else {
                console.log(`No coordinates found for: ${species} - ${commonName}`);
            }
        }
    });

    console.log(`Extracted ${foundObservations.length} observations with coordinates from ${getPageName(sourceUrl)}`);
    return foundObservations;
}

// Load observations from source URLs automatically
async function loadObservations() {
    if (isLoading) {
        console.log('Already loading, skipping duplicate request');
        return;
    }
    
    isLoading = true;
    console.log('=== LOAD OBSERVATIONS FUNCTION CALLED ===');
    console.log('Function started at:', new Date().toLocaleTimeString());
    
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
        console.log('Loading indicator shown');
    } else {
        console.log('WARNING: Loading div not found');
    }
    
    observations = [];
    clearMap();
    console.log('Cleared existing observations and map');

    let totalLoaded = 0;
    const errors = [];
    
    console.log(`Starting to load from ${sourceUrls.length} URLs:`, sourceUrls);

    for (let i = 0; i < sourceUrls.length; i++) {
        const url = sourceUrls[i];
        console.log(`\n--- Processing URL ${i + 1}/${sourceUrls.length}: ${url} ---`);
        
        try {
            if (loadingDiv) {
                loadingDiv.textContent = `Loading from ${getPageName(url)}... (${i + 1}/${sourceUrls.length})`;
            }
            
            // Use CORS proxy for cross-origin requests
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            console.log('Fetching from proxy:', proxyUrl);
            
            const response = await fetch(proxyUrl);
            console.log('Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const htmlContent = await response.text();
            console.log('HTML content length:', htmlContent.length);
            
            const siteObservations = extractObservations(htmlContent, url);
            
            observations.push(...siteObservations);
            totalLoaded += siteObservations.length;
            
            console.log(`✅ Loaded ${siteObservations.length} observations from ${getPageName(url)}`);
            console.log(`Total so far: ${totalLoaded} observations`);
            
        } catch (error) {
            console.error(`❌ Error loading ${url}:`, error);
            errors.push(`${getPageName(url)}: ${error.message}`);
        }

        // Add delay to be respectful to servers
        console.log('Waiting 1 second before next request...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (loadingDiv) {
        loadingDiv.style.display = 'none';
        console.log('Loading indicator hidden');
    }

    if (errors.length > 0) {
        console.log('Errors encountered:', errors);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `<strong>Errors encountered:</strong><br>${errors.join('<br>')}`;
        errorDiv.style.cssText = 'background: #ffebee; border: 1px solid #f44336; color: #c62828; padding: 10px; margin: 10px 0; border-radius: 4px;';
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, document.getElementById('map'));
        }
        
        setTimeout(() => errorDiv.remove(), 10000);
    }

    console.log(`\n=== LOADING COMPLETE ===`);
    console.log(`Total observations loaded: ${observations.length}`);
    console.log('Calling displayObservations...');
    displayObservations();
    console.log('=== LOAD OBSERVATIONS FUNCTION FINISHED ===\n');
    
    isLoading = false;
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

// Initialize the application and AUTO-LOAD data
// GitHub Pages-specific initialization
function initializeMapForGitHub() {
    console.log('=== INITIALIZING FOR GITHUB PAGES ===');
    
    // Ensure all required elements exist
    const mapDiv = document.getElementById('map');
    const loadingDiv = document.getElementById('loading');
    
    if (!mapDiv) {
        console.log('Map div not found, retrying in 500ms...');
        setTimeout(initializeMapForGitHub, 500);
        return;
    }
    
    if (typeof L === 'undefined') {
        console.log('Leaflet not loaded yet, retrying in 500ms...');
        setTimeout(initializeMapForGitHub, 500);
        return;
    }
    
    if (typeof map === 'undefined') {
        console.log('Initializing map...');
        initMap();
    }
    
    if (!isLoading && observations.length === 0) {
        console.log('=== STARTING AUTO-LOAD FOR GITHUB PAGES ===');
        loadObservations();
    }
}

// Immediate execution - no event waiting
console.log('Script executing immediately...');
if (document.readyState === 'loading') {
    console.log('Document still loading, setting up event listeners...');
    document.addEventListener('DOMContentLoaded', initializeMapForGitHub);
} else {
    console.log('Document already loaded, initializing immediately...');
    initializeMapForGitHub();
}

// Additional fallbacks for GitHub Pages
setTimeout(initializeMapForGitHub, 1000);
setTimeout(initializeMapForGitHub, 3000);
setTimeout(initializeMapForGitHub, 6000);

// Window load event as final backup
window.addEventListener('load', () => {
    console.log('Window fully loaded');
    setTimeout(initializeMapForGitHub, 500);
});

// Manual refresh function for the button
function refreshMap() {
    console.log('Manual refresh triggered');
    loadObservations();
}

// Debug function to check environment
function checkEnvironment() {
    console.log('=== ENVIRONMENT CHECK ===');
    console.log('Document ready state:', document.readyState);
    console.log('Leaflet loaded:', typeof L !== 'undefined');
    console.log('Map div exists:', !!document.getElementById('map'));
    console.log('Loading div exists:', !!document.getElementById('loading'));
    console.log('Map initialized:', typeof map !== 'undefined');
    console.log('Observations count:', observations.length);
    console.log('Currently loading:', isLoading);
    console.log('=== END CHECK ===');
}

// Auto-run environment check
setTimeout(checkEnvironment, 2000);

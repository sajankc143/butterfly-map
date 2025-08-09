let map;
let observations = [];
let markers = [];
let markerGroup;
let isLoading = false; // Prevent multiple simultaneous loads
// Simple, foolproof fullscreen functionality
let isFullscreen = false;

// Fullscreen toggle function - make it global immediately
window.toggleFullscreen = function() {
    console.log('toggleFullscreen called, current state:', isFullscreen);
    
    const mapContainer = document.getElementById('mapContainer') || document.querySelector('.map-container');
    const body = document.body;
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    
    if (!mapContainer) {
        console.error('Map container not found!');
        return;
    }

    console.log('Map container found:', mapContainer);
    
    if (!isFullscreen) {
        // Enter fullscreen
        console.log('Entering fullscreen...');
        mapContainer.classList.add('fullscreen');
        body.classList.add('fullscreen-active');
        
        // Change icon to exit fullscreen
        if (fullscreenIcon) {
            fullscreenIcon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
        }
        
        isFullscreen = true;
        const btn = document.getElementById('fullscreenBtn');
        if (btn) btn.title = 'Exit Fullscreen';
        
        console.log('✅ Entered fullscreen mode');
        
    } else {
        // Exit fullscreen
        console.log('Exiting fullscreen...');
        mapContainer.classList.remove('fullscreen');
        body.classList.remove('fullscreen-active');
        
        // Change icon back to enter fullscreen
        if (fullscreenIcon) {
            fullscreenIcon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
        }
        
        isFullscreen = false;
        const btn = document.getElementById('fullscreenBtn');
        if (btn) btn.title = 'Toggle Fullscreen';
        
        console.log('✅ Exited fullscreen mode');
    }
    
    // Invalidate map size after transition
    setTimeout(() => {
        if (window.map && window.map.invalidateSize) {
            window.map.invalidateSize();
            console.log('Map size invalidated');
        }
    }, 350);
};

// ESC key handler
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && isFullscreen) {
        console.log('ESC key pressed, exiting fullscreen');
        toggleFullscreen();
    }
});

// Debug function to check if everything is working
window.debugFullscreen = function() {
    console.log('=== FULLSCREEN DEBUG ===');
    console.log('toggleFullscreen function exists:', typeof window.toggleFullscreen === 'function');
    console.log('mapContainer exists:', !!document.getElementById('mapContainer'));
    console.log('fullscreen button exists:', !!document.getElementById('fullscreenBtn'));
    console.log('fullscreen icon exists:', !!document.getElementById('fullscreenIcon'));
    console.log('Current fullscreen state:', isFullscreen);
    console.log('Map container classes:', document.getElementById('mapContainer')?.className);
    console.log('Body classes:', document.body.className);
    
    // Test the button click
    const btn = document.getElementById('fullscreenBtn');
    if (btn) {
        console.log('Button onclick:', btn.onclick);
        console.log('Button getAttribute onclick:', btn.getAttribute('onclick'));
    }
};

// Make sure the function is available immediately
console.log('Fullscreen script loaded, toggleFullscreen available:', typeof toggleFullscreen === 'function');

// Test after page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, running fullscreen debug...');
    setTimeout(() => {
        debugFullscreen();
    }, 1000);
});

// Backup - ensure function is available
setTimeout(() => {
    if (typeof window.toggleFullscreen !== 'function') {
        console.error('toggleFullscreen not available, creating backup...');
        window.toggleFullscreen = toggleFullscreen;
    }
}, 500);

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

    // Add fullscreen button to map after initialization
    addFullscreenButton();
}

// Add fullscreen functionality
function addFullscreenButton() {
    // Check if button already exists
    if (document.getElementById('fullscreenBtn')) {
        return;
    }

    // Create fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'fullscreenBtn';
    fullscreenBtn.className = 'fullscreen-btn';
    fullscreenBtn.title = 'Toggle Fullscreen';
    fullscreenBtn.onclick = toggleFullscreen;
    
    fullscreenBtn.innerHTML = `
        <svg id="fullscreenIcon" viewBox="0 0 24 24">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        </svg>
    `;

    // Add styles for the button (in case they're not in CSS)
    const style = document.createElement('style');
    style.textContent = `
        .fullscreen-btn {
            position: absolute;
            top: 15px;
            right: 15px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .fullscreen-btn:hover {
            background: rgba(255, 255, 255, 1);
            transform: scale(1.1);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .fullscreen-btn svg {
            width: 20px;
            height: 20px;
            fill: #333;
            transition: fill 0.3s ease;
        }

        .fullscreen-btn:hover svg {
            fill: #2196F3;
        }

        .map-container {
            position: relative;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .map-container.fullscreen {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 9999 !important;
            border-radius: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
        }

        .map-container.fullscreen #map {
            height: 100vh !important;
            width: 100vw !important;
            border-radius: 0 !important;
        }

        body.fullscreen-active {
            overflow: hidden !important;
        }

        .map-container.fullscreen .leaflet-control-container .leaflet-top.leaflet-left,
        .map-container.fullscreen .leaflet-control-container .leaflet-top.leaflet-right {
            top: 70px;
        }

        @media (max-width: 768px) {
            .fullscreen-btn {
                top: 10px;
                right: 10px;
                width: 35px;
                height: 35px;
                padding: 8px;
            }

            .fullscreen-btn svg {
                width: 18px;
                height: 18px;
            }

            .map-container.fullscreen .leaflet-control-container .leaflet-top.leaflet-left,
            .map-container.fullscreen .leaflet-control-container .leaflet-top.leaflet-right {
                top: 60px;
            }
        }
    `;
    
    // Add styles to head if not already there
    if (!document.getElementById('fullscreen-styles')) {
        style.id = 'fullscreen-styles';
        document.head.appendChild(style);
    }

    // Find map container and add button
    let mapContainer = document.querySelector('.map-container');
    if (!mapContainer) {
        // Create map container if it doesn't exist
        const mapDiv = document.getElementById('map');
        if (mapDiv && mapDiv.parentNode) {
            mapContainer = document.createElement('div');
            mapContainer.className = 'map-container';
            mapDiv.parentNode.insertBefore(mapContainer, mapDiv);
            mapContainer.appendChild(mapDiv);
        }
    }

    if (mapContainer) {
        mapContainer.appendChild(fullscreenBtn);
        console.log('Fullscreen button added to map');
    } else {
        console.warn('Could not find map container to add fullscreen button');
    }
}

// Fullscreen toggle function
function toggleFullscreen() {
    const mapContainer = document.querySelector('.map-container');
    const body = document.body;
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Add transition class
    mapContainer.classList.add('transitioning');
    
    if (!isFullscreen) {
        // Enter fullscreen
        mapContainer.classList.add('fullscreen');
        body.classList.add('fullscreen-active');
        
        // Change icon to exit fullscreen
        if (fullscreenIcon) {
            fullscreenIcon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
        }
        
        isFullscreen = true;
        const btn = document.getElementById('fullscreenBtn');
        if (btn) btn.title = 'Exit Fullscreen';
        
        console.log('Entered fullscreen mode');
        
    } else {
        // Exit fullscreen
        mapContainer.classList.remove('fullscreen');
        body.classList.remove('fullscreen-active');
        
        // Change icon back to enter fullscreen
        if (fullscreenIcon) {
            fullscreenIcon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
        }
        
        isFullscreen = false;
        const btn = document.getElementById('fullscreenBtn');
        if (btn) btn.title = 'Toggle Fullscreen';
        
        console.log('Exited fullscreen mode');
    }
    
    // Invalidate map size after transition
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            console.log('Map size invalidated after fullscreen toggle');
        }
        mapContainer.classList.remove('transitioning');
    }, 350);
}

// Handle ESC key to exit fullscreen
function handleEscapeKey(event) {
    if (event.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
    }
}

// Add ESC key listener
document.addEventListener('keydown', handleEscapeKey);

// Updated parseCoordinates function with decimal seconds support
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
    // UPDATED: Changed [0-9]+ to [0-9]+(?:\.[0-9]+)? for decimal seconds support
    const coordPatterns = [
        // Most flexible pattern - handles various spacing AND DECIMAL SECONDS
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s*([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])[^)]*\)/,
        // Standard format with space: (36°34'41.1''N 105°26'26.5''W, 10227 ft.)
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])[^)]*\)/,
        // Without parentheses but with space: 36°34'41.1''N 105°26'26.5''W
        /([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
        // Without parentheses, no space: 36°34'41.1''N105°26'26.5''W
        /([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
        // With various spacing and commas
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s*,?\s*([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
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
                // DMS format with decimal seconds support
                const latDeg = parseInt(match[1]);
                const latMin = parseInt(match[2]);
                const latSec = parseFloat(match[3]); // CHANGED: parseFloat instead of parseInt
                const latDir = match[4];
                
                const lonDeg = parseInt(match[5]);
                const lonMin = parseInt(match[6]);
                const lonSec = parseFloat(match[7]); // CHANGED: parseFloat instead of parseInt
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
            
            // Parse species and common name - handle both <p4><i> and <i> formats, including broken </a> tags
            let speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+?)<\/a><\/p4>/);
            if (!speciesMatch) {
                speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+)<\/p4>/);
            }
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

// Robust loading function with multiple proxy fallbacks and retry logic
async function loadObservations() {
    if (isLoading) {
        console.log('Already loading, skipping duplicate request');
        return;
    }
    
    isLoading = true;
    console.log('=== ROBUST LOAD OBSERVATIONS STARTED ===');
    
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
        loadingDiv.textContent = 'Starting to load butterfly observations...';
    }
    
    observations = [];
    clearMap();

    // Better proxy services with multiple fallbacks
    const proxyServices = [
        {
            url: 'https://corsproxy.io/?',
            type: 'text'
        },
        {
            url: 'https://api.allorigins.win/get?url=',
            type: 'json'
        },
        {
            url: 'https://api.codetabs.com/v1/proxy?quest=',
            type: 'text'
        },
        {
            url: 'https://thingproxy.freeboard.io/fetch/',
            type: 'text'
        }
    ];

    let totalLoaded = 0;
    const errors = [];
    const maxRetries = 2; // Reduced retries to speed up

    async function fetchWithFallbacks(url) {
        for (let proxyIndex = 0; proxyIndex < proxyServices.length; proxyIndex++) {
            const proxy = proxyServices[proxyIndex];
            
            for (let retry = 0; retry < maxRetries; retry++) {
                try {
                    const proxyUrl = proxy.url + encodeURIComponent(url);
                    console.log(`Trying proxy ${proxyIndex + 1}, attempt ${retry + 1}:`, proxy.url);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
                    
                    const response = await fetch(proxyUrl, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; ButterflyBot/1.0)',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        }
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        let content;
                        
                        // Handle different proxy response formats
                        if (proxy.type === 'json') {
                            const data = await response.json();
                            content = data.contents || data.body;
                        } else {
                            content = await response.text();
                        }
                        
                        if (content && content.length > 1000) { // Basic validation
                            console.log(`✅ Success with proxy ${proxyIndex + 1} on attempt ${retry + 1}`);
                            return content;
                        } else {
                            throw new Error('Content too short or empty');
                        }
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                } catch (error) {
                    console.log(`❌ Proxy ${proxyIndex + 1}, attempt ${retry + 1} failed:`, error.message);
                    
                    if (retry < maxRetries - 1) {
                        // Wait before retrying (shorter delays)
                        const delay = 1000 + (retry * 1000);
                        console.log(`Waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
        }
        
        throw new Error('All proxies and retries failed');
    }

    // Process each URL with robust fetching
    for (let i = 0; i < sourceUrls.length; i++) {
        const url = sourceUrls[i];
        const pageName = getPageName(url);
        
        console.log(`\n--- Processing ${i + 1}/${sourceUrls.length}: ${pageName} ---`);
        
        if (loadingDiv) {
            loadingDiv.textContent = `Loading ${pageName}... (${i + 1}/${sourceUrls.length})`;
        }
        
        try {
            const htmlContent = await fetchWithFallbacks(url);
            const siteObservations = extractObservations(htmlContent, url);
            
            observations.push(...siteObservations);
            totalLoaded += siteObservations.length;
            
            console.log(`✅ ${pageName}: ${siteObservations.length} observations (Total: ${totalLoaded})`);
            
            // Update loading status with progress
            if (loadingDiv) {
                loadingDiv.textContent = `Loaded ${pageName} - ${totalLoaded} observations found so far...`;
            }
            
        } catch (error) {
            console.error(`❌ Failed to load ${pageName}:`, error.message);
            errors.push(`${pageName}: ${error.message}`);
            
            // Continue with other URLs even if one fails
            if (loadingDiv) {
                loadingDiv.textContent = `Failed to load ${pageName}, continuing with others...`;
            }
        }

        // Shorter delay between requests
        if (i < sourceUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Finish loading
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }

    // Show results and errors
    console.log(`\n=== LOADING COMPLETE ===`);
    console.log(`Successfully loaded: ${totalLoaded} observations`);
    console.log(`Failed pages: ${errors.length}`);

    if (errors.length > 0) {
        console.log('Errors:', errors);
        
        // Show error notification but don't block the UI
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            color: #856404; 
            padding: 10px; 
            margin: 10px 0; 
            border-radius: 4px;
            position: relative;
        `;
        errorDiv.innerHTML = `
            <strong>Some pages couldn't be loaded:</strong><br>
            ${errors.join('<br>')}
            <br><small>Showing ${totalLoaded} observations from ${sourceUrls.length - errors.length} successful pages.</small>
            <button onclick="this.parentElement.remove()" style="position: absolute; top: 5px; right: 10px; background: none; border: none; font-size: 16px; cursor: pointer;">×</button>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, document.getElementById('map'));
        }
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 15000);
    }

    displayObservations();
    isLoading = false;
    
    // If we got some observations, consider it a success
    if (totalLoaded > 0) {
        console.log(`✅ Successfully loaded butterfly map with ${totalLoaded} observations!`);
    } else {
        console.log('⚠️ No observations loaded - all sources may be down');
        
        // Show retry option
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
            loadingDiv.innerHTML = `
                <div style="color: #856404;">
                    No observations could be loaded from any source. 
                    <button onclick="loadObservations()" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
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
function autoClickLoadButton() {
    console.log('=== ATTEMPTING AUTO-CLICK OF LOAD BUTTON ===');
    
    // Find the load button by its onclick attribute
    const buttons = document.querySelectorAll('button');
    let loadButton = null;
    
    for (let button of buttons) {
        if (button.onclick && button.onclick.toString().includes('loadObservations')) {
            loadButton = button;
            break;
        }
        if (button.getAttribute('onclick') && button.getAttribute('onclick').includes('loadObservations')) {
            loadButton = button;
            break;
        }
        if (button.textContent.includes('Load') || button.textContent.includes('Refresh')) {
            loadButton = button;
            break;
        }
    }
    
    if (loadButton) {
        console.log('Found load button, clicking it...');
        loadButton.click();
        return true;
    } else {
        console.log('Load button not found');
        return false;
    }
}

// Simple initialization
function initializeMapSimple() {
    console.log('=== SIMPLE GITHUB PAGES INITIALIZATION ===');
    
    // Initialize map if not already done
    if (typeof map === 'undefined') {
        const mapDiv = document.getElementById('map');
        if (mapDiv && typeof L !== 'undefined') {
            console.log('Initializing map...');
            initMap();
        } else {
            console.log('Map div or Leaflet not ready, retrying...');
            return false;
        }
    }
    
    // Try auto-clicking the load button
    if (observations.length === 0 && !isLoading) {
        return autoClickLoadButton();
    }
    
    return true;
}

// Handle window resize for fullscreen
function handleWindowResize() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
            console.log('Map size invalidated after window resize');
        }, 100);
    }
}

// Multiple attempts with the simple approach
console.log('Setting up auto-load for GitHub Pages...');

// Try immediately if document is ready
if (document.readyState !== 'loading') {
    setTimeout(initializeMapSimple, 500);
}

// Try after DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, attempting auto-load...');
    setTimeout(initializeMapSimple, 500);
});

// Try after window fully loads
window.addEventListener('load', () => {
    console.log('Window loaded, attempting auto-load...');
    setTimeout(initializeMapSimple, 500);
});

// Add window resize listener for fullscreen support
window.addEventListener('resize', handleWindowResize);

// Backup attempts
setTimeout(() => {
    console.log('Backup attempt 1 (2s)');
    initializeMapSimple();
}, 2000);

setTimeout(() => {
    console.log('Backup attempt 2 (4s)');
    initializeMapSimple();
}, 4000);

setTimeout(() => {
    console.log('Final attempt (7s)');
    initializeMapSimple();
}, 7000);

// Manual refresh function for the button
function refreshMap() {
    console.log('Manual refresh triggered');
    loadObservations();
}

// Debug function
function debugGitHub() {
    console.log('=== GITHUB DEBUG ===');
    console.log('Document ready:', document.readyState);
    console.log('Leaflet available:', typeof L !== 'undefined');
    console.log('Map exists:', !!document.getElementById('map'));
    console.log('Map initialized:', typeof map !== 'undefined');
    console.log('Observations:', observations.length);
    console.log('Load button found:', !!document.querySelector('button[onclick*="loadObservations"]'));
    console.log('Fullscreen state:', isFullscreen);
    console.log('Fullscreen button exists:', !!document.getElementById('fullscreenBtn'));
}

// Run debug after a delay
setTimeout(debugGitHub, 3000);

// Export functions to global scope for HTML onclick handlers
window.toggleFullscreen = toggleFullscreen;
window.loadObservations = loadObservations;
window.clearMap = clearMap;
window.refreshMap = refreshMap;
window.debugGitHub = debugGitHub;

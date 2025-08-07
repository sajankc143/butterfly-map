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

// Enhanced coordinate parsing with more debug info
function parseCoordinates(text) {
    if (!text) return null;

    console.log('🔍 Parsing coordinates from:', text.substring(0, 200) + '...'); // Truncate for readability

    // Decode HTML entities first - including degree symbol
    const decodedText = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#176;/g, '°')  // Decode degree symbols
        .replace(/&deg;/g, '°');   // Alternative degree encoding

    console.log('📝 After decoding:', decodedText.substring(0, 200) + '...');
    
    // Enhanced coordinate patterns - more flexible matching
    const coordPatterns = [
        // Most flexible pattern - handles various spacing and parentheses
        /\(?\s*([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s*([0-9]+)°([0-9]+)'([0-9]+)''([EW])[^)]*\)?/i,
        // Without parentheses but with space: 36°34'41''N 105°26'26''W
        /([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+)''([EW])/i,
        // Without parentheses, no space: 36°34'41''N105°26'26''W
        /([0-9]+)°([0-9]+)'([0-9]+)''([NS])([0-9]+)°([0-9]+)'([0-9]+)''([EW])/i,
        // With various spacing and commas
        /([0-9]+)°([0-9]+)'([0-9]+)''([NS])\s*,?\s*([0-9]+)°([0-9]+)'([0-9]+)''([EW])/i,
        // Decimal degrees in parentheses
        /\(?\s*([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])\s*\)?/i,
        // Simple decimal pattern
        /([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/i
    ];

    for (let i = 0; i < coordPatterns.length; i++) {
        const pattern = coordPatterns[i];
        const match = decodedText.match(pattern);
        if (match) {
            console.log(`✅ Pattern ${i + 1} matched:`, match);
            
            if (match.length >= 8) {
                // DMS format
                const latDeg = parseInt(match[1]);
                const latMin = parseInt(match[2]);
                const latSec = parseInt(match[3]);
                const latDir = match[4].toUpperCase();
                
                const lonDeg = parseInt(match[5]);
                const lonMin = parseInt(match[6]);
                const lonSec = parseInt(match[7]);
                const lonDir = match[8].toUpperCase();

                let lat = latDeg + latMin/60 + latSec/3600;
                let lon = lonDeg + lonMin/60 + lonSec/3600;

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                console.log(`🎯 Parsed DMS coordinates: [${lat}, ${lon}]`);
                
                // Validate coordinates are reasonable
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    return [lat, lon];
                } else {
                    console.log('❌ Coordinates out of valid range');
                }
            } else if (match.length >= 4) {
                // Decimal format
                let lat = parseFloat(match[1]);
                const latDir = match[2].toUpperCase();
                let lon = parseFloat(match[3]);
                const lonDir = match[4].toUpperCase();

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                console.log(`🎯 Parsed decimal coordinates: [${lat}, ${lon}]`);
                
                // Validate coordinates are reasonable
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    return [lat, lon];
                } else {
                    console.log('❌ Coordinates out of valid range');
                }
            }
        }
    }

    console.log('❌ No coordinates found');
    return null;
}

// Enhanced extraction with better error handling and debugging
function extractObservations(htmlContent, sourceUrl) {
    console.log(`🔎 Starting extraction from ${getPageName(sourceUrl)}`);
    console.log(`📄 HTML content length: ${htmlContent.length} characters`);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const foundObservations = [];

    // Enhanced selector - try multiple approaches
    let imageLinks = [];
    
    // Primary approach - look for a[data-title]
    imageLinks = doc.querySelectorAll('a[data-title]');
    console.log(`🔍 Method 1 - Found ${imageLinks.length} a[data-title] elements`);
    
    // If no results, try looking for any elements with data-title
    if (imageLinks.length === 0) {
        imageLinks = doc.querySelectorAll('[data-title]');
        console.log(`🔍 Method 2 - Found ${imageLinks.length} [data-title] elements`);
    }
    
    // If still no results, debug the HTML structure
    if (imageLinks.length === 0) {
        console.log('🚨 No data-title elements found. Debugging HTML structure...');
        
        // Look for any <a> tags
        const allLinks = doc.querySelectorAll('a');
        console.log(`🔗 Total <a> tags found: ${allLinks.length}`);
        
        // Sample first few links to see their attributes
        for (let i = 0; i < Math.min(5, allLinks.length); i++) {
            const link = allLinks[i];
            const attrs = Array.from(link.attributes).map(attr => `${attr.name}="${attr.value.substring(0, 50)}..."`);
            console.log(`🔗 Link ${i + 1} attributes:`, attrs.join(', '));
        }
        
        // Look for any elements with "title" in attribute names
        const elementsWithTitle = doc.querySelectorAll('*[*|*="*title*"], *[title], *[data-title], *[aria-title]');
        console.log(`📝 Elements with title-related attributes: ${elementsWithTitle.length}`);
        
        return foundObservations;
    }

    imageLinks.forEach((link, index) => {
        console.log(`\n📸 Processing element ${index + 1}/${imageLinks.length}`);
        
        const dataTitle = link.getAttribute('data-title');
        const img = link.querySelector('img');
        
        console.log(`🏷️ Has data-title: ${!!dataTitle}`);
        console.log(`🖼️ Has img child: ${!!img}`);
        
        if (dataTitle) {
            console.log(`📝 Data-title preview: ${dataTitle.substring(0, 100)}...`);
            
            // Decode HTML entities in data-title
            const decodedTitle = dataTitle
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#176;/g, '°')
                .replace(/&deg;/g, '°');
            
            // Enhanced species parsing - handle both <p4><i> and <i> formats
            let speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+)<\/p4>/);
            if (!speciesMatch) {
                speciesMatch = decodedTitle.match(/<i>(.*?)<\/i>\s*[-–]\s*([^<]+?)(?:<br|$)/);
            }
            
            let species = 'Unknown Species';
            let commonName = 'Unknown';

            if (speciesMatch) {
                species = speciesMatch[1].trim();
                commonName = speciesMatch[2].trim();
                console.log(`🦋 Species found: ${species} - ${commonName}`);
            } else {
                console.log('⚠️ Could not parse species from title');
                
                // Try simpler italic extraction
                const simpleItalic = decodedTitle.match(/<i>([^<]+)<\/i>/);
                if (simpleItalic) {
                    species = simpleItalic[1].trim();
                    console.log(`🦋 Fallback species: ${species}`);
                }
            }

            // Parse coordinates
            const coordinates = parseCoordinates(decodedTitle);
            
            if (coordinates) {
                console.log(`📍 Coordinates extracted: [${coordinates[0]}, ${coordinates[1]}]`);
                
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

                const observation = {
                    species: species,
                    commonName: commonName,
                    coordinates: coordinates,
                    location: location,
                    date: date,
                    photographer: photographer,
                    imageUrl: img ? img.getAttribute('src') : null,
                    fullImageUrl: link.getAttribute('href'),
                    sourceUrl: sourceUrl,
                    originalTitle: decodedTitle
                };

                foundObservations.push(observation);
                
                console.log(`✅ Added observation: ${species} at ${location}`);
                console.log(`📊 Total observations so far: ${foundObservations.length}`);
            } else {
                console.log(`❌ No coordinates found for: ${species} - ${commonName}`);
                console.log(`📝 Full decoded title: ${decodedTitle}`);
            }
        } else {
            console.log('❌ No data-title attribute found');
        }
    });

    console.log(`\n🎉 Extraction complete for ${getPageName(sourceUrl)}`);
    console.log(`📊 Total observations extracted: ${foundObservations.length}`);
    
    return foundObservations;
}

// Load observations from source URLs with enhanced error handling
async function loadObservations() {
    const loadingDiv = document.getElementById('loading');
    loadingDiv.style.display = 'block';
    
    observations = [];
    clearMap();

    const sourceUrls = document.getElementById('sourceUrls').value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

    console.log(`🚀 Starting to load ${sourceUrls.length} URLs`);

    let totalLoaded = 0;
    const errors = [];

    for (let i = 0; i < sourceUrls.length; i++) {
        const url = sourceUrls[i];
        console.log(`\n🌐 Loading URL ${i + 1}/${sourceUrls.length}: ${url}`);
        
        try {
            loadingDiv.textContent = `Loading ${i + 1}/${sourceUrls.length}: ${getPageName(url)}...`;
            
            // Use CORS proxy for cross-origin requests
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            console.log(`🔗 Proxy URL: ${proxyUrl}`);
            
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const htmlContent = await response.text();
            console.log(`📄 Received ${htmlContent.length} characters of HTML`);
            
            const siteObservations = extractObservations(htmlContent, url);
            
            observations.push(...siteObservations);
            totalLoaded += siteObservations.length;
            
            console.log(`✅ Loaded ${siteObservations.length} observations from ${getPageName(url)}`);
            
        } catch (error) {
            console.error(`❌ Error loading ${url}:`, error);
            errors.push(`${getPageName(url)}: ${error.message}`);
        }

        // Add delay to be respectful to servers
        if (i < sourceUrls.length - 1) {
            console.log('⏳ Waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    loadingDiv.style.display = 'none';

    if (errors.length > 0) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `<strong>Errors encountered:</strong><br>${errors.join('<br>')}`;
        errorDiv.style.cssText = 'background: #ffebee; color: #c62828; padding: 10px; margin: 10px 0; border-radius: 4px;';
        document.querySelector('.container').insertBefore(errorDiv, document.getElementById('map'));
        
        setTimeout(() => errorDiv.remove(), 15000);
    }

    console.log(`\n🎊 FINAL RESULTS:`);
    console.log(`📊 Total observations loaded: ${observations.length}`);
    console.log(`🌐 URLs processed: ${sourceUrls.length}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    displayObservations();
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

    document.getElementById('stats').innerHTML = statsHtml;
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
    
    // Extract filename from URL as fallback
    try {
        const urlObj = new URL(url);
        const filename = urlObj.pathname.split('/').pop();
        return filename || 'Unknown';
    } catch {
        return 'Unknown';
    }
}

// Enhanced test function with your exact HTML
function testCoordinateParsing() {
    console.log('\n🧪 === TESTING COORDINATE PARSING ===');
    
    // Your exact examples from the HTML
    const testData = [
        '<p4><i>Oeneis melissa</i> - Melissa Arctic</p4><br/>Taos Ski Valley, Taos Co., New Mexico (36&#176;33\'34\'\'N 105&#176;24\'54\'\'W, 13063 ft.) 2025/07/08 © Sajan K.C. & Anisha Sapkota',
        '<p4><i>Parnassius smintheus</i> - Rocky Mountain Apollo</p4><br/>Taos Co., New Mexico (36&#176;33\'37\'\'N 105&#176;25\'00\'\'W, 12780 ft.) 2025/07/08 © Sajan K.C. & Anisha Sapkota'
    ];
    
    testData.forEach((test, index) => {
        console.log(`\n🧪 Test ${index + 1}:`);
        console.log('📝 Input:', test);
        const coords = parseCoordinates(test);
        if (coords) {
            console.log(`✅ SUCCESS: [${coords[0]}, ${coords[1]}]`);
        } else {
            console.log('❌ FAILED: No coordinates found');
        }
    });
    
    console.log('\n🧪 === END TEST ===\n');
}

// Add a comprehensive test button
function addTestButton() {
    const testButton = document.createElement('button');
    testButton.textContent = '🧪 Test Parsing';
    testButton.onclick = testCoordinateParsing;
    testButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 10px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
    document.body.appendChild(testButton);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    addTestButton();
    
    // Automatically run the test
    setTimeout(testCoordinateParsing, 1000);
});

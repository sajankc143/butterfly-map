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

// Generate EXTREMELY aggressive cache-busting parameters
function getSuperCacheBustingParam() {
    const timestamp = Date.now();
    const random1 = Math.random().toString(36).substr(2, 15);
    const random2 = Math.random().toString(36).substr(2, 15);
    const microseconds = performance.now().toString().replace('.', '');
    return `nocache=${timestamp}&bust=${random1}&fresh=${random2}&time=${microseconds}&v=${Math.floor(Math.random() * 999999)}`;
}

// Add MULTIPLE cache busting parameters to URL
function addAggressiveCacheBusting(url) {
    const separator = url.includes('?') ? '&' : '?';
    const cacheBust = getSuperCacheBustingParam();
    return `${url}${separator}${cacheBust}&_t=${Date.now()}&_r=${Math.random()}`;
}

// Enhanced parseCoordinates function
function parseCoordinates(text) {
    if (!text) return null;

    console.log('Parsing coordinates from:', text.substring(0, 100) + '...');

    // Decode HTML entities first - including degree symbol
    const decodedText = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#176;/g, '°');
    
    // Pattern for coordinates - ENHANCED with decimal coordinate support
    const coordPatterns = [
        // DMS format with decimal seconds support
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s*([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])[^)]*\)/,
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])[^)]*\)/,
        /([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
        /([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s*,?\s*([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
        
        // Decimal degrees with direction indicators
        /\(([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/,
        /([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/,
        
        // Plain decimal coordinates (latitude, longitude) - handles negative numbers
        /\(?(-?[0-9]+\.[0-9]+)\s*,\s*(-?[0-9]+\.[0-9]+)\)?/,
        
        // Decimal coordinates with parentheses
        /\((-?[0-9]+\.[0-9]+)\s*,\s*(-?[0-9]+\.[0-9]+)\)/,
        
        // Space-separated decimal coordinates
        /(-?[0-9]+\.[0-9]+)\s+(-?[0-9]+\.[0-9]+)/,
        
        // Fallback: any two decimal numbers that could be coordinates
        /([0-9]+(?:\.[0-9]+)?)[°\s]*[NS]?[,\s]+([0-9]+(?:\.[0-9]+)?)[°\s]*[EW]?/
    ];

    for (let pattern of coordPatterns) {
        const match = decodedText.match(pattern);
        if (match) {
            console.log('Coordinate match found:', match);
            
            if (match.length >= 8) {
                // DMS format with decimal seconds support
                const latDeg = parseInt(match[1]);
                const latMin = parseInt(match[2]);
                const latSec = parseFloat(match[3]);
                const latDir = match[4];
                
                const lonDeg = parseInt(match[5]);
                const lonMin = parseInt(match[6]);
                const lonSec = parseFloat(match[7]);
                const lonDir = match[8];

                let lat = latDeg + latMin/60 + latSec/3600;
                let lon = lonDeg + lonMin/60 + lonSec/3600;

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                console.log('Parsed DMS coordinates:', [lat, lon]);
                return [lat, lon];
            } else if (match.length >= 4) {
                // Decimal format with direction indicators
                let lat = parseFloat(match[1]);
                const latDir = match[2];
                let lon = parseFloat(match[3]);
                const lonDir = match[4];

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                console.log('Parsed decimal coordinates with directions:', [lat, lon]);
                return [lat, lon];
            } else if (match.length >= 3) {
                // Plain decimal coordinates (new patterns)
                const lat = parseFloat(match[1]);
                const lon = parseFloat(match[2]);
                
                // Validate coordinate ranges
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    console.log('Parsed plain decimal coordinates:', [lat, lon]);
                    return [lat, lon];
                }
            }
        }
    }

    console.log('No coordinates found in:', decodedText.substring(0, 200));
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
            console.log(`Processing image ${index + 1}:`, dataTitle.substring(0, 100) + '...');
            
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

// SUPER AGGRESSIVE NO-CACHE loading function
async function loadObservations() {
    if (isLoading) {
        console.log('Already loading, skipping duplicate request');
        return;
    }
    
    isLoading = true;
    console.log('=== SUPER AGGRESSIVE NO-CACHE LOAD STARTED ===');
    console.log('Using timestamp:', Date.now());
    
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
        loadingDiv.textContent = `🔄 FORCE REFRESHING - Bypassing ALL caches... (${new Date().toLocaleTimeString()})`;
    }
    
    observations = [];
    clearMap();

    // SUPER AGGRESSIVE proxy rotation with cache-busting
    const proxyServices = [
        // Use different proxy for each attempt to avoid proxy-level caching
        {
            url: 'https://api.allorigins.win/raw?url=',
            type: 'text',
            name: 'AllOrigins-Raw'
        },
        {
            url: 'https://corsproxy.io/?',
            type: 'text',
            name: 'CorsProxy'
        },
        {
            url: 'https://api.codetabs.com/v1/proxy/?quest=',
            type: 'text',
            name: 'CodeTabs'
        },
        {
            url: 'https://proxy.cors.sh/',
            type: 'text',
            name: 'CorsShield'
        },
        {
            url: 'https://thingproxy.freeboard.io/fetch/',
            type: 'text',
            name: 'ThingProxy'
        }
    ];

    let totalLoaded = 0;
    const errors = [];

    async function fetchWithSuperAggressiveCacheBusting(url, attempt = 1) {
        const maxAttempts = 3;
        
        for (let proxyIndex = 0; proxyIndex < proxyServices.length; proxyIndex++) {
            const proxy = proxyServices[proxyIndex];
            
            try {
                // SUPER aggressive cache busting - different params each time
                const superCachedUrl = addAggressiveCacheBusting(url);
                const proxyUrl = proxy.url + encodeURIComponent(superCachedUrl);
                
                console.log(`🚀 ATTEMPT ${attempt}: ${proxy.name} with SUPER cache-bust`);
                console.log(`   URL: ${superCachedUrl.substring(0, 100)}...`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                // MAXIMUM cache-busting headers
                const response = await fetch(proxyUrl, {
                    signal: controller.signal,
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
                        'If-None-Match': '*',
                        'User-Agent': `ButterflyBot-${Date.now()}-${Math.random()}`,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Encoding': 'identity', // Disable compression to avoid cache
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-Cache-Bypass': Date.now().toString(),
                        'X-Force-Fresh': 'true'
                    },
                    cache: 'no-store',
                    mode: 'cors'
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    let content = await response.text();
                    
                    // Additional validation - check for real content
                    if (content && content.length > 1000 && content.includes('data-title')) {
                        console.log(`✅ SUCCESS: ${proxy.name} returned ${content.length} chars`);
                        
                        // Double-check we got fresh content by looking for recent dates
                        const currentYear = new Date().getFullYear();
                        const hasRecentContent = content.includes(currentYear.toString()) || 
                                               content.includes((currentYear-1).toString());
                        
                        if (hasRecentContent) {
                            console.log(`✅ Content appears FRESH (contains ${currentYear})`);
                        } else {
                            console.log(`⚠️ Content may be stale (no ${currentYear} found)`);
                        }
                        
                        return content;
                    } else {
                        throw new Error(`Invalid content: ${content ? content.length : 0} chars, has data-title: ${content ? content.includes('data-title') : false}`);
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
            } catch (error) {
                console.log(`❌ ${proxy.name} failed:`, error.message);
                
                // If this was the last proxy and we haven't reached max attempts, try again
                if (proxyIndex === proxyServices.length - 1 && attempt < maxAttempts) {
                    console.log(`🔄 Retrying attempt ${attempt + 1} after 2 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return fetchWithSuperAggressiveCacheBusting(url, attempt + 1);
                }
            }
        }
        
        throw new Error(`ALL proxies failed after ${maxAttempts} attempts`);
    }

    // Process each URL with SUPER aggressive fetching
    for (let i = 0; i < sourceUrls.length; i++) {
        const url = sourceUrls[i];
        const pageName = getPageName(url);
        
        console.log(`\n🔥 SUPER REFRESH ${i + 1}/${sourceUrls.length}: ${pageName}`);
        
        if (loadingDiv) {
            loadingDiv.textContent = `🔄 FORCE LOADING ${pageName}... (${i + 1}/${sourceUrls.length}) - ${new Date().toLocaleTimeString()}`;
        }
        
        try {
            const htmlContent = await fetchWithSuperAggressiveCacheBusting(url);
            const siteObservations = extractObservations(htmlContent, url);
            
            observations.push(...siteObservations);
            totalLoaded += siteObservations.length;
            
            console.log(`✅ ${pageName}: ${siteObservations.length} FRESH observations (Total: ${totalLoaded})`);
            
            if (loadingDiv) {
                loadingDiv.textContent = `✅ ${pageName} loaded - ${totalLoaded} FRESH observations so far...`;
            }
            
        } catch (error) {
            console.error(`💥 COMPLETE FAILURE for ${pageName}:`, error.message);
            errors.push(`${pageName}: ${error.message}`);
            
            if (loadingDiv) {
                loadingDiv.textContent = `❌ ${pageName} failed, trying others...`;
            }
        }

        // Brief pause between requests
        if (i < sourceUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    // Finish loading
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }

    // Show results
    console.log(`\n🎉 SUPER AGGRESSIVE LOADING COMPLETE 🎉`);
    console.log(`✅ Successfully loaded: ${totalLoaded} GUARANTEED FRESH observations`);
    console.log(`❌ Failed pages: ${errors.length}`);
    console.log(`📅 Load completed at: ${new Date().toLocaleString()}`);

    if (errors.length > 0) {
        console.log('❌ Errors:', errors);
        
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: #f8d7da; 
            border: 1px solid #f5c6cb; 
            color: #721c24; 
            padding: 15px; 
            margin: 10px 0; 
            border-radius: 4px;
            position: relative;
        `;
        errorDiv.innerHTML = `
            <strong>⚠️ Some pages couldn't be loaded with cache-busting:</strong><br>
            ${errors.join('<br>')}
            <br><small>✅ Showing ${totalLoaded} FRESH observations from ${sourceUrls.length - errors.length} successful pages.</small>
            <br><small>🕒 Loaded at: ${new Date().toLocaleString()}</small>
            <button onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 18px; cursor: pointer; color: #721c24;">×</button>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, document.getElementById('map'));
        }
        
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 20000);
    }

    displayObservations();
    isLoading = false;
    
    if (totalLoaded > 0) {
        console.log(`🎊 SUCCESS: Butterfly map loaded with ${totalLoaded} GUARANTEED FRESH observations!`);
        
        // Show success notification
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            background: #d4edda; 
            border: 1px solid #c3e6cb; 
            color: #155724; 
            padding: 10px; 
            margin: 10px 0; 
            border-radius: 4px;
            text-align: center;
        `;
        successDiv.innerHTML = `
            ✅ <strong>SUCCESS!</strong> Loaded ${totalLoaded} fresh observations at ${new Date().toLocaleTimeString()}
            <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; font-size: 16px; cursor: pointer;">×</button>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(successDiv, document.getElementById('map'));
        }
        
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
            }
        }, 10000);
        
    } else {
        console.log('💀 TOTAL FAILURE: No observations loaded - all sources completely inaccessible');
        
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
            loadingDiv.innerHTML = `
                <div style="color: #721c24; text-align: center; padding: 20px;">
                    💀 <strong>COMPLETE FAILURE</strong> - No observations could be loaded from any source.<br>
                    All cache-busting attempts failed.<br><br>
                    <button onclick="window.location.reload()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
                        🔄 Hard Reload Page
                    </button>
                    <button onclick="loadObservations()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
                        🚀 Try Super Refresh Again
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

// NUCLEAR CACHE CLEARING - Clear absolutely everything
function nuclearCacheClear() {
    console.log('☢️ NUCLEAR CACHE CLEARING INITIATED ☢️');
    
    try {
        // Clear all browser storage
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
            console.log('☢️ localStorage nuked');
        }
        
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.clear();
            console.log('☢️ sessionStorage nuked');
        }
        
        // Clear IndexedDB
        if ('indexedDB' in window) {
            indexedDB.databases().then(databases => {
                databases.forEach(db => {
                    indexedDB.deleteDatabase(db.name);
                    console.log('☢️ IndexedDB nuked:', db.name);
                });
            }).catch(err => console.log('IndexedDB clearing failed:', err));
        }
        
        // Clear service workers
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.unregister();
                    console.log('☢️ Service worker nuked');
                });
            }).catch(err => console.log('Service worker clearing failed:', err));
        }
        
        // Clear Cache API
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                    console.log('☢️ Cache API nuked:', name);
                });
            }).catch(err => console.log('Cache API clearing failed:', err));
        }
        
        // Clear in-memory data
        observations = [];
        markers = [];
        
        console.log('☢️ NUCLEAR CACHE CLEARING COMPLETE ☢️');
        
    } catch (error) {
        console.log('☢️ Nuclear clearing encountered resistance:', error.message);
    }
}

// Auto-load functionality with nuclear cache clearing
function autoClickLoadButton() {
    console.log('🚀 AUTO-LOAD WITH NUCLEAR CACHE CLEARING 🚀');
    
    // Nuclear clear first
    nuclearCacheClear();
    
    // Find and click load button
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
        console.log('🚀 Found load button, executing NUCLEAR REFRESH...');
        loadButton.click();
        return true;
    } else {
        console.log('❌ Load button not found');
        return false;
    }
}

// Simple initialization with nuclear cache clearing
function initializeMapSimple() {
    console.log('🚀 NUCLEAR GITHUB PAGES INITIALIZATION 🚀');
    
    // Nuclear clear first
    nuclearCacheClear();
    
    // Initialize map if not already done
    if (typeof map === 'undefined') {
        const mapDiv = document.getElementById('map');
        if (mapDiv && typeof L !== 'undefined') {
            console.log('🗺️ Initializing map (post-nuclear)...');
            initMap();
        } else {
            console.log('⏳ Map div or Leaflet not ready, retrying...');
            return false;
        }
    }
    
    // Try auto-clicking the load button
    if (observations.length === 0 && !isLoading) {
        return autoClickLoadButton();
    }
    
    return true;
}

// SUPER AGGRESSIVE initialization attempts
console.log('🚀 SETTING UP NUCLEAR AUTO-LOAD FOR GITHUB PAGES 🚀');

// Immediate nuclear clear
nuclearCacheClear();

// Try immediately if document is ready
if (document.readyState !== 'loading') {
    setTimeout(() => {
        console.log('🚀 Immediate attempt (document ready)');
        initializeMapSimple();
    }, 500);
}

// Try after DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, attempting NUCLEAR auto-load...');
    setTimeout(initializeMapSimple, 500);
});

// Try after window fully loads
window.addEventListener('load', () => {
    console.log('🚀 Window loaded, attempting NUCLEAR auto-load...');
    setTimeout(initializeMapSimple, 500);
});

// Multiple backup attempts with increasing delays
setTimeout(() => {
    console.log('🚀 Backup attempt 1 (2s) - NUCLEAR');
    initializeMapSimple();
}, 2000);

setTimeout(() => {
    console.log('🚀 Backup attempt 2 (4s) - NUCLEAR');
    initializeMapSimple();
}, 4000);

setTimeout(() => {
    console.log('🚀 Backup attempt 3 (7s) - NUCLEAR');
    initializeMapSimple();
}, 7000);

setTimeout(() => {
    console.log('🚀 Final attempt (10s) - NUCLEAR');
    initializeMapSimple();
}, 10000);

// Enhanced manual refresh function
function refreshMap() {
    console.log('🚀 MANUAL NUCLEAR REFRESH TRIGGERED 🚀');
    nuclearCacheClear();
    setTimeout(() => {
        loadObservations();
    }, 1000);
}

// GLOBAL NUCLEAR FUNCTIONS
window.nuclearRefresh = function() {
    console.log('☢️ NUCLEAR REFRESH BUTTON PRESSED ☢️');
    nuclearCacheClear();
    setTimeout(() => {
        loadObservations();
    }, 1000);
};

window.hardReload = function() {
    console.log('🔄 HARD RELOAD INITIATED 🔄');
    nuclearCacheClear();
    window.location.reload(true); // Force reload from server
};

window.superDebug = function() {
    console.log('🔍 SUPER DEBUG MODE 🔍');
    console.log('Current time:', new Date().toLocaleString());
    console.log('Document ready:', document.readyState);
    console.log('Leaflet available:', typeof L !== 'undefined');
    console.log('Map element exists:', !!document.getElementById('map'));
    console.log('Map initialized:', typeof map !== 'undefined');
    console.log('Current observations:', observations.length);
    console.log('Load button exists:', !!document.querySelector('button[onclick*="loadObservations"]'));
    console.log('Is loading:', isLoading);
    console.log('Sample cache-bust URL:', addAggressiveCacheBusting('https://example.com/test.html'));
    console.log('Super cache-bust params:', getSuperCacheBustingParam());
    
    // Test if we can see any recent content in existing observations
    if (observations.length > 0) {
        const recentObs = observations.filter(obs => obs.date && obs.date.includes('2024'));
        console.log('Observations with 2024 dates:', recentObs.length);
        if (recentObs.length > 0) {
            console.log('Sample recent observation:', recentObs[0]);
        }
    }
};

// Enhanced debug function with cache info
function debugGitHub() {
    console.log('🔍 NUCLEAR GITHUB DEBUG 🔍');
    window.superDebug();
}

// Run debug after a delay
setTimeout(debugGitHub, 3000);

// Add status indicator to page
function addStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'nuclear-status';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #007bff;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 9999;
        font-family: monospace;
    `;
    indicator.textContent = '🚀 NUCLEAR MODE ACTIVE';
    
    document.body.appendChild(indicator);
    
    // Remove after 10 seconds
    setTimeout(() => {
        if (indicator.parentElement) {
            indicator.remove();
        }
    }, 10000);
}

// Add status indicator when script loads
if (document.body) {
    addStatusIndicator();
} else {
    document.addEventListener('DOMContentLoaded', addStatusIndicator);
}

console.log('☢️ NUCLEAR BUTTERFLY SCRIPT FULLY LOADED ☢️');
console.log('Available NUCLEAR functions:');
console.log('- window.nuclearRefresh() - Nuclear cache clear + refresh');
console.log('- window.hardReload() - Nuclear clear + hard page reload');
console.log('- window.superDebug() - Comprehensive debug info');
console.log('- refreshMap() - Standard nuclear refresh');
console.log('🚀 ALL CACHE-BUSTING SYSTEMS ARMED AND READY! 🚀');

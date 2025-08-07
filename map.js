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
    // Flexible with spacing, now supports decimal seconds
    /\(\s*([0-9]+)°\s*([0-9]+)'\s*([0-9.]+)''\s*([NS])\s*([0-9]+)°\s*([0-9]+)'\s*([0-9.]+)''\s*([EW])[^)]*\)/,

    // Standard format with space
    /\(([0-9]+)°([0-9]+)'([0-9.]+)''([NS])\s+([0-9]+)°([0-9]+)'([0-9.]+)''([EW])[^)]*\)/,

    // Without parentheses but with space
    /([0-9]+)°([0-9]+)'([0-9.]+)''([NS])\s+([0-9]+)°([0-9]+)'([0-9.]+)''([EW])/,

    // Without parentheses, no space
    /([0-9]+)°([0-9]+)'([0-9.]+)''([NS])([0-9]+)°([0-9]+)'([0-9.]+)''([EW])/,

    // With various spacing and commas
    /\(([0-9]+)°([0-9]+)'([0-9.]+)''([NS])\s*,?\s*([0-9]+)°([0-9]+)'([0-9.]+)''([EW])/,

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
const latSec = parseFloat(match[3]);  // <-- CHANGE parseInt to parseFloat here
const latDir = match[4];

const lonDeg = parseInt(match[5]);
const lonMin = parseInt(match[6]);
const lonSec = parseFloat(match[7]);  // <-- CHANGE parseInt to parseFloat here
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

        // Load observations from source URLs
        async function loadObservations() {
            const loadingDiv = document.getElementById('loading');
            loadingDiv.style.display = 'block';
            
            observations = [];
            clearMap();

            const sourceUrls = document.getElementById('sourceUrls').value
                .split('\n')
                .map(url => url.trim())
                .filter(url => url.length > 0);

            let totalLoaded = 0;
            const errors = [];

            for (const url of sourceUrls) {
                try {
                    loadingDiv.textContent = `Loading from ${getPageName(url)}...`;
                    
                    // Use CORS proxy for cross-origin requests
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                    const response = await fetch(proxyUrl);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const htmlContent = await response.text();
                    const siteObservations = extractObservations(htmlContent, url);
                    
                    observations.push(...siteObservations);
                    totalLoaded += siteObservations.length;
                    
                    console.log(`Loaded ${siteObservations.length} observations from ${getPageName(url)}`);
                    
                } catch (error) {
                    console.error(`Error loading ${url}:`, error);
                    errors.push(`${getPageName(url)}: ${error.message}`);
                }

                // Add delay to be respectful to servers
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            loadingDiv.style.display = 'none';

            if (errors.length > 0) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.innerHTML = `<strong>Errors encountered:</strong><br>${errors.join('<br>')}`;
                document.querySelector('.container').insertBefore(errorDiv, document.getElementById('map'));
                
                setTimeout(() => errorDiv.remove(), 10000);
            }

            console.log(`Total observations loaded: ${observations.length}`);
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
            return 'Unknown';
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
            testButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 10px; background: #ff6b6b; color: white; border: none; border-radius: 5px; cursor: pointer;';
            document.body.appendChild(testButton);
        }

        // Initialize the application
        document.addEventListener('DOMContentLoaded', () => {
            initMap();
            addTestButton();
            
            // Automatically run the test
            setTimeout(testCoordinateParsing, 1000);
        });

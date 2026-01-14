// homeMap.js - Fixed version for butterfly observation map
// This script loads and displays butterfly observations on the homepage map

var homeMap;
var homeMarkers;

function initHomeMap() {
    // Initialize the map
    homeMap = L.map('homeMap').setView([25.0, -100.0], 4);
    
    // Add satellite and street map layers
    var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18
    });
    
    var street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });
    
    // Add satellite by default
    satellite.addTo(homeMap);
    
    // Add layer control
    L.control.layers({
        'Street Map': street,
        'Satellite': satellite
    }).addTo(homeMap);
    
    // Initialize marker cluster group
    homeMarkers = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50
    });
    
    homeMap.addLayer(homeMarkers);
    
    console.log('Home map initialized');
}

function loadHomeObservations() {
    // Get source URLs from the textarea
    var sourceUrlsElement = document.getElementById('homeSourceUrls');
    if (!sourceUrlsElement) {
        console.error('homeSourceUrls element not found');
        return;
    }
    
    var urls = sourceUrlsElement.value.trim().split('\n').filter(url => url.trim());
    
    if (urls.length === 0) {
        console.error('No source URLs found');
        return;
    }
    
    console.log('Loading observations from', urls.length, 'sources');
    
    var totalObservations = 0;
    var processedUrls = 0;
    
    // Function to process each URL
    urls.forEach(function(url) {
        url = url.trim();
        if (!url) return;
        
        console.log('Fetching:', url);
        
        // Use CORS proxy to fetch the page
        fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url))
            .then(response => response.json())
            .then(data => {
                var parser = new DOMParser();
                var doc = parser.parseFromString(data.contents, 'text/html');
                
                // Parse observations from the page
                var observations = parseObservationsFromPage(doc, url);
                
                console.log('Found', observations.length, 'observations in', url);
                
                // Add markers for each observation
                observations.forEach(function(obs) {
                    if (obs.lat && obs.lng && !isNaN(obs.lat) && !isNaN(obs.lng)) {
                        addHomeMarker(obs);
                        totalObservations++;
                    }
                });
                
                processedUrls++;
                
                // When all URLs are processed, fit the map bounds
                if (processedUrls === urls.length) {
                    console.log('Total observations loaded:', totalObservations);
                    
                    if (totalObservations > 0 && homeMarkers.getBounds().isValid()) {
                        homeMap.fitBounds(homeMarkers.getBounds(), { padding: [50, 50] });
                    }
                    
                    updateHomeStats(totalObservations);
                }
            })
            .catch(error => {
                console.error('Error loading', url, ':', error);
                processedUrls++;
            });
    });
}

function parseObservationsFromPage(doc, sourceUrl) {
    var observations = [];
    
    // Method 1: Look for images with data-lat and data-lng attributes
    var imagesWithData = doc.querySelectorAll('img[data-lat][data-lng]');
    imagesWithData.forEach(function(img) {
        observations.push({
            lat: parseFloat(img.getAttribute('data-lat')),
            lng: parseFloat(img.getAttribute('data-lng')),
            name: img.alt || 'Unknown Butterfly',
            image: img.src,
            source: sourceUrl
        });
    });
    
    // Method 2: Look for links with lat/lng in href
    var linksWithCoords = doc.querySelectorAll('a[href*="lat="][href*="lng="]');
    linksWithCoords.forEach(function(link) {
        var href = link.href;
        var latMatch = href.match(/lat=([-\d.]+)/);
        var lngMatch = href.match(/lng=([-\d.]+)/);
        
        if (latMatch && lngMatch) {
            var img = link.querySelector('img');
            observations.push({
                lat: parseFloat(latMatch[1]),
                lng: parseFloat(lngMatch[1]),
                name: link.textContent.trim() || 'Unknown Butterfly',
                image: img ? img.src : '',
                source: sourceUrl
            });
        }
    });
    
    // Method 3: Look for table cells with coordinates
    var tableCells = doc.querySelectorAll('td[data-lat], td[data-lng]');
    if (tableCells.length > 0) {
        // Group by rows
        var rows = {};
        tableCells.forEach(function(cell) {
            var row = cell.parentElement;
            var rowId = Array.from(row.parentElement.children).indexOf(row);
            
            if (!rows[rowId]) rows[rowId] = {};
            
            if (cell.hasAttribute('data-lat')) {
                rows[rowId].lat = parseFloat(cell.getAttribute('data-lat'));
            }
            if (cell.hasAttribute('data-lng')) {
                rows[rowId].lng = parseFloat(cell.getAttribute('data-lng'));
            }
            
            var img = cell.querySelector('img');
            if (img) {
                rows[rowId].image = img.src;
                rows[rowId].name = img.alt || cell.textContent.trim();
            }
        });
        
        Object.values(rows).forEach(function(row) {
            if (row.lat && row.lng) {
                observations.push({
                    lat: row.lat,
                    lng: row.lng,
                    name: row.name || 'Unknown Butterfly',
                    image: row.image || '',
                    source: sourceUrl
                });
            }
        });
    }
    
    return observations;
}

function addHomeMarker(observation) {
    var marker = L.marker([observation.lat, observation.lng]);
    
    var popupContent = '<div style="text-align: center; max-width: 300px;">';
    popupContent += '<strong>' + observation.name + '</strong><br/>';
    
    if (observation.image) {
        popupContent += '<img src="' + observation.image + '" alt="' + observation.name + '" style="max-width: 280px; margin: 10px 0; border-radius: 8px;"><br/>';
    }
    
    popupContent += '<small>Lat: ' + observation.lat.toFixed(4) + ', Lng: ' + observation.lng.toFixed(4) + '</small><br/>';
    popupContent += '<small style="color: #666;">Source: ' + observation.source.split('/').pop().replace('.html', '') + '</small>';
    popupContent += '</div>';
    
    marker.bindPopup(popupContent);
    homeMarkers.addLayer(marker);
}

function updateHomeStats(count) {
    var statsElement = document.getElementById('homeStats');
    if (statsElement) {
        statsElement.innerHTML = '<p>Loaded ' + count + ' butterfly observations</p>';
    }
}

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeMap);
} else {
    initHomeMap();
}

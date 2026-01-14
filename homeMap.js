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
    
    // Look for links with data-title attribute containing coordinates
    // Format: "Species Name<br/>Location (lat, lng, elevation) Date © Author"
    var links = doc.querySelectorAll('a[data-title]');
    
    links.forEach(function(link) {
        var dataTitle = link.getAttribute('data-title');
        
        // Extract coordinates from format: (9.1253, -79.6935, 27 m)
        var coordMatch = dataTitle.match(/\(([-\d.]+),\s*([-\d.]+),\s*[-\d.]+\s*m\)/);
        
        if (coordMatch) {
            var lat = parseFloat(coordMatch[1]);
            var lng = parseFloat(coordMatch[2]);
            
            // Extract species name from format: <p4><i>Species name</i> - Common Name</p4>
            var speciesMatch = dataTitle.match(/<p4><i>([^<]+)<\/i>\s*-\s*([^<]+)<\/p4>/);
            var scientificName = speciesMatch ? speciesMatch[1] : '';
            var commonName = speciesMatch ? speciesMatch[2] : '';
            
            // Extract location (text before the coordinates)
            var locationMatch = dataTitle.match(/<\/p4><br\/>([^(]+)\(/);
            var location = locationMatch ? locationMatch[1].trim() : '';
            
            // Extract date and photographer
            var dateMatch = dataTitle.match(/\)\s*(\d{4}\/\d{2}\/\d{2})\s*©\s*([^"]+)/);
            var date = dateMatch ? dateMatch[1] : '';
            var photographer = dateMatch ? dateMatch[2].trim() : '';
            
            // Get image source
            var img = link.querySelector('img');
            var imageSrc = img ? img.src : '';
            
            observations.push({
                lat: lat,
                lng: lng,
                scientificName: scientificName,
                commonName: commonName,
                location: location,
                date: date,
                photographer: photographer,
                image: imageSrc,
                source: sourceUrl
            });
        }
    });
    
    return observations;
}

function addHomeMarker(observation) {
    var marker = L.marker([observation.lat, observation.lng]);
    
    var popupContent = '<div style="text-align: center; max-width: 320px;">';
    
    if (observation.image) {
        popupContent += '<img src="' + observation.image + '" alt="' + observation.commonName + '" style="max-width: 300px; margin-bottom: 10px; border-radius: 8px;"><br/>';
    }
    
    popupContent += '<strong style="font-size: 16px;">' + observation.commonName + '</strong><br/>';
    popupContent += '<em style="color: #666; font-size: 13px;">' + observation.scientificName + '</em><br/><br/>';
    
    if (observation.location) {
        popupContent += '<div style="font-size: 12px; text-align: left; margin: 10px 0;">';
        popupContent += '📍 ' + observation.location + '<br/>';
        popupContent += '📅 ' + observation.date + '<br/>';
        popupContent += '📷 ' + observation.photographer + '<br/>';
        popupContent += '<small style="color: #999;">Lat: ' + observation.lat.toFixed(4) + ', Lng: ' + observation.lng.toFixed(4) + '</small>';
        popupContent += '</div>';
    }
    
    popupContent += '</div>';
    
    marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'butterfly-popup'
    });
    
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

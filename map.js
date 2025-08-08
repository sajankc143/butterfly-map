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

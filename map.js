class ButterflyInfiniteGalleryUpdater {
    constructor(options = {}) {
        this.daysThreshold = options.daysThreshold || 365;
        this.imagesPerRow = options.imagesPerRow || 6;
        this.speciesPerPage = options.speciesPerPage || 100;
        this.currentPage = 1;
        this.sourcePages = [
            "https://www.butterflyexplorers.com/p/new-butterflies.html",
            "https://www.butterflyexplorers.com/p/butterflies-of-texas.html",
            "https://www.butterflyexplorers.com/p/butterflies-of-puerto-rico.html", 
            "https://www.butterflyexplorers.com/p/butterflies-of-new-mexico.html",
            "https://www.butterflyexplorers.com/p/butterflies-of-arizona.html",
            "https://www.butterflyexplorers.com/p/butterflies-of-panama.html",
            "https://www.butterflyexplorers.com/p/butterflies-of-florida.html",
            "https://www.butterflyexplorers.com/p/dual-checklist.html"
        ];
        this.allImages = [];
        this.filteredImages = [];
        this.currentSearchParams = null;
        this.cache = new Map();
        this.cacheExpiry = 1000 * 60 * 60 * 24;
        this.isLoading = false;
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.useProxy = options.useProxy || false;
        this.proxyUrl = options.proxyUrl || 'https://api.allorigins.win/raw?url=';
        
        // Map-related properties
        this.map = null;
        this.markerGroup = null;
        this.mapInitialized = false;
    }

    // Parse coordinates from various formats
    parseCoordinates(text) {
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

    extractDateFromTitle(title) {
        if (!title) return null;
        const patterns = [
            /(\d{4})\/(\d{2})\/(\d{2})/,
            /(\d{2})\/(\d{2})\/(\d{4})/,
            /(\d{4})-(\d{2})-(\d{2})/,
            /(\d{2})-(\d{2})-(\d{4})/
        ];
        
        for (const pattern of patterns) {
            const dateMatch = title.match(pattern);
            if (dateMatch) {
                if (pattern.toString().includes('(\\d{4})')) {
                    return new Date(dateMatch[1], dateMatch[2] - 1, dateMatch[3]);
                } else {
                    return new Date(dateMatch[3], dateMatch[1] - 1, dateMatch[2]);
                }
            }
        }
        return null;
    }

    extractLocationFromTitle(title) {
        if (!title) return '';
        
        // Enhanced location extraction that looks for text between <br/> and coordinates
        const locationPatterns = [
            /<br\/?>\s*([^(]+?)(?:\s+\([0-9])/,  // Location before coordinates
            /<br\/?>\s*([^(]+?)$/,               // Location at end
            /<br\/?>\s*([^<]+?)\s+\d{4}\/\d{2}\/\d{2}/,  // Location before date
            /<br\/>([^<]+?)\s*(?:\d|©|$)/        // Original pattern
        ];
        
        for (const pattern of locationPatterns) {
            const locationMatch = title.match(pattern);
            if (locationMatch && locationMatch[1]) {
                return locationMatch[1].trim();
            }
        }
        
        return '';
    }

    isRecentDate(date) {
        if (!date) return true;
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= this.daysThreshold;
    }

    parseImagesFromHTML(htmlContent, sourceUrl = '') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const images = [];

        const selectors = [
            '.img-container a[data-lightbox]',
            'td a[data-lightbox]',
            'a[data-lightbox]',
            'a[href*=".jpg"], a[href*=".jpeg"], a[href*=".png"]'
        ];

        const imgContainers = new Set();
        selectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => imgContainers.add(el));
        });
        
        imgContainers.forEach(link => {
            const img = link.querySelector('img');
            if (!img) return;

            const title = link.getAttribute('data-title') || link.getAttribute('title') || img.getAttribute('alt') || '';
            const date = this.extractDateFromTitle(title);
            const location = this.extractLocationFromTitle(title);
            
            // Parse coordinates for map functionality
            const coordinates = this.parseCoordinates(title);
            
            // Extract photographer
            const photographerMatch = title.match(/©\s*([^&]+(?:&[^&]+)*)/);
            let photographer = '';
            if (photographerMatch) {
                photographer = photographerMatch[1].trim();
            }
            
            let species = '';
            let commonName = '';

            if (title) {
                const titlePatterns = [
                    /<p4><i>(.*?)<\/i>\s*[-–]\s*(.*?)<\/p4>/i,
                    /<i>(.*?)<\/i>\s*[-–]\s*([^<]*?)(?:<br|$)/i,
                    /<i>(.*?)<\/i>\s*[-–]\s*([^<]*?)(?:\s*<|$)/i,
                    /<i>(.*?)<\/i>\s*[-–]\s*([A-Za-z\s\-']+?)(?=\s*[A-Z][a-z]+\s+(?:Co\.|County|Wildlife|Park|Reserve|Area|Forest|Beach)|<br|$)/i,
                    /<i>(.*?)<\/i>\s*[-–]\s*([A-Za-z\s\-']+?)(?=\s*\d)/i,
                    /<i>(.*?)<\/i>\s*[-–]\s*([A-Za-z\s\-']+?)(?=\s*\()/i,
                    /<i>(.*?)<\/i>\s*[-–]\s*([A-Za-z\s\-']+)/
                ];

                for (const pattern of titlePatterns) {
                    const match = title.match(pattern);
                    if (match) {
                        species = match[1].trim();
                        commonName = match[2].trim();
                        commonName = commonName.replace(/\s+(Wildlife|Management|Area|Park|Reserve|County|Co\.|State|National|Forest|Beach).*$/i, '');
                        commonName = commonName.replace(/\s+\d+.*$/, '');
                        commonName = commonName.replace(/\s+\(.*$/, '');
                        commonName = commonName.replace(/\s+[A-Z][a-z]+\s+Co\..*$/, '');
                        commonName = commonName.trim();
                        break;
                    }
                }
            }

            // Fallback extraction methods (from original code)
            if ((!species || !commonName) && img.getAttribute('alt')) {
                const altText = img.getAttribute('alt');
                const altPatterns = [
                    /^(.*?)\s*[-–]\s*(.*?)$/,
                    /^([A-Z][a-z]+\s+[a-z]+)\s*[-–]\s*(.*?)$/
                ];
                
                for (const pattern of altPatterns) {
                    const altMatch = altText.match(pattern);
                    if (altMatch) {
                        if (!species) species = altMatch[1].trim();
                        if (!commonName) commonName = altMatch[2].trim();
                        break;
                    }
                }
            }

            if (!species || species.length < 2) {
                species = 'Unknown Species';
            }
            if (!commonName || commonName.length < 2) {
                commonName = 'Unknown';
            }

            const fullImageUrl = link.getAttribute('href');
            const thumbnailUrl = img.getAttribute('src');
            
            if (fullImageUrl && thumbnailUrl) {
                images.push({
                    species: species,
                    commonName: commonName,
                    fullTitle: title.replace(/"/g, '&quot;'),
                    fullImageUrl: this.resolveUrl(fullImageUrl, sourceUrl),
                    thumbnailUrl: this.resolveUrl(thumbnailUrl, sourceUrl),
                    alt: img.getAttribute('alt') || `${species} - ${commonName}`,
                    date: date,
                    location: location,
                    coordinates: coordinates, // Add coordinates for map
                    photographer: photographer, // Add photographer
                    timestamp: date ? date.getTime() : Date.now(),
                    sourceUrl: sourceUrl,
                    sourcePage: this.getPageName(sourceUrl),
                    hasValidDate: !!date,
                    hasCoordinates: !!coordinates, // Flag for map filtering
                    originalTitle: title,
                    originalAlt: img.getAttribute('alt') || '',
                    extractionMethod: this.getExtractionMethod(title, img.getAttribute('alt'), species, commonName),
                    hasDataTitle: !!link.getAttribute('data-title')
                });
            }
        });

        console.log(`Parsed ${images.length} images from ${this.getPageName(sourceUrl)}`);
        
        const coordCount = images.filter(img => img.hasCoordinates).length;
        console.log(`${coordCount} images have coordinates for mapping`);
        
        return images;
    }

    getExtractionMethod(title, alt, species, commonName) {
        if (title && title.includes('<i>') && species !== 'Unknown Species') {
            return 'title-html';
        } else if (alt && alt.includes('-') && species !== 'Unknown Species') {
            return 'alt-text';
        } else if (species !== 'Unknown Species') {
            return 'table-cell';
        } else {
            return 'fallback-failed';
        }
    }

    resolveUrl(url, baseUrl) {
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) {
            const base = new URL(baseUrl);
            return base.origin + url;
        }
        return new URL(url, baseUrl).href;
    }

    getPageName(url) {
        const pageNames = {
            'new-butterflies.html': 'New Butterflies',
            'butterflies-of-texas.html': 'Texas',
            'butterflies-of-puerto-rico.html': 'Puerto Rico',
            'butterflies-of-new-mexico.html': 'New Mexico',
            'butterflies-of-arizona.html': 'Arizona',
            'butterflies-of-panama.html': 'Panama',
            'butterflies-of-florida.html': 'Florida',
            'dual-checklist.html': 'Dual Checklist'
        };
        
        for (const [key, name] of Object.entries(pageNames)) {
            if (url.includes(key)) return name;
        }
        return 'Unknown';
    }

    removeDuplicates(images) {
        const seen = new Map();
        const unique = [];
        
        for (const image of images) {
            if (image.hasDataTitle) {
                const key = `${image.species}_${image.commonName}_${image.thumbnailUrl}`;
                
                if (!seen.has(key)) {
                    seen.set(key, true);
                    unique.push(image);
                } else {
                    const existingIndex = unique.findIndex(img => 
                        `${img.species}_${img.commonName}_${img.thumbnailUrl}` === key
                    );
                    if (existingIndex !== -1 && image.hasValidDate && !unique[existingIndex].hasValidDate) {
                        unique[existingIndex] = image;
                    }
                }
            } else {
                const relaxedKey = image.thumbnailUrl;
                
                if (!seen.has(relaxedKey)) {
                    seen.set(relaxedKey, true);
                    unique.push(image);
                } else {
                    const existingIndex = unique.findIndex(img => img.thumbnailUrl === relaxedKey);
                    if (existingIndex !== -1) {
                        const existing = unique[existingIndex];
                        if (image.hasValidDate && !existing.hasValidDate) {
                            unique[existingIndex] = image;
                        } else if (image.species !== 'Unknown Species' && existing.species === 'Unknown Species') {
                            unique[existingIndex] = image;
                        } else if (image.commonName !== 'Unknown' && existing.commonName === 'Unknown') {
                            unique[existingIndex] = image;
                        }
                    }
                }
            }
        }
        
        return unique;
    }

    async fetchPageContent(url, retryCount = 0) {
        const cacheKey = url;
        const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.content;
        }

        const fetchUrl = this.useProxy ? this.proxyUrl + encodeURIComponent(url) : url;

        try {
            const response = await fetch(fetchUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (compatible; ButterflyGalleryBot/1.0)'
                },
                mode: this.useProxy ? 'cors' : 'no-cors'
            });
            
            if (!response.ok && retryCount < this.maxRetries) {
                console.log(`Retrying ${url} (attempt ${retryCount + 1})`);
                await this.delay(this.retryDelay * (retryCount + 1));
                return this.fetchPageContent(url, retryCount + 1);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const content = await response.text();
            this.cache.set(cacheKey, { content: content, timestamp: Date.now() });
            return content;
            
        } catch (error) {
            console.error(`Failed to fetch ${url}:`, error);
            
            if (!this.useProxy && retryCount === 0) {
                console.log(`Trying with proxy for ${url}`);
                const proxyUrl = this.proxyUrl + encodeURIComponent(url);
                try {
                    const response = await fetch(proxyUrl);
                    if (response.ok) {
                        const content = await response.text();
                        this.cache.set(cacheKey, { content: content, timestamp: Date.now() });
                        return content;
                    }
                } catch (proxyError) {
                    console.error(`Proxy fetch also failed for ${url}:`, proxyError);
                }
            }
            
            return null;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Initialize map functionality
    initMap() {
        if (this.mapInitialized || !window.L) {
            console.log('Map already initialized or Leaflet not available');
            return;
        }

        const mapContainer = document.getElementById('butterfly-map');
        if (!mapContainer) {
            console.log('Map container not found');
            return;
        }

        this.map = L.map('butterfly-map').setView([39.8283, -98.5795], 4); // Center on US

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.markerGroup = L.layerGroup().addTo(this.map);
        this.mapInitialized = true;

        console.log('Map initialized successfully');
    }

    // Update map with current filtered images
    updateMap() {
        if (!this.mapInitialized || !this.markerGroup) {
            console.log('Map not initialized');
            return;
        }

        this.markerGroup.clearLayers();

        // Get images with coordinates from current filtered set
        const mappableImages = this.filteredImages.filter(img => img.hasCoordinates);

        console.log(`Displaying ${mappableImages.length} observations on map`);

        mappableImages.forEach(img => {
            const popupContent = `
                <div style="min-width: 200px;">
                    <div style="font-style: italic; font-weight: bold; color: #2c3e50; margin-bottom: 5px;">
                        ${img.species}
                    </div>
                    <div style="font-weight: bold; color: #34495e; margin-bottom: 10px;">
                        ${img.commonName}
                    </div>
                    ${img.thumbnailUrl ? `<img src="${img.thumbnailUrl}" style="width: 100%; max-width: 200px; height: auto; border-radius: 5px; margin-bottom: 10px;" alt="${img.species}" onerror="this.style.display='none'">` : ''}
                    <div style="font-size: 12px; color: #666;">
                        📍 ${img.location}<br>
                        ${img.date ? `📅 ${new Date(img.date).toLocaleDateString()}<br>` : ''}
                        ${img.photographer ? `📷 ${img.photographer}<br>` : ''}
                        🔗 ${img.sourcePage}
                    </div>
                </div>
            `;

            const marker = L.marker(img.coordinates)
                .bindPopup(popupContent, { maxWidth: 250 })
                .addTo(this.markerGroup);
        });

        // Fit map to show all markers
        if (mappableImages.length > 0) {
            const group = new L.featureGroup(this.markerGroup.getLayers());
            this.map.fitBounds(group.getBounds().pad(0.1));
        }

        this.updateMapStats(mappableImages);
    }

    // Update map statistics
    updateMapStats(mappableImages) {
        const mapStatsContainer = document.getElementById('map-stats');
        if (!mapStatsContainer) return;

        const uniqueSpecies = new Set(mappableImages.map(img => img.species)).size;
        const uniqueLocations = new Set(mappableImages.map(img => img.location)).size;
        const sourceCounts = {};

        mappableImages.forEach(img => {
            sourceCounts[img.sourcePage] = (sourceCounts[img.sourcePage] || 0) + 1;
        });

        const statsHtml = `
            <div class="stat-card">
                <div class="stat-number">${mappableImages.length}</div>
                <div class="stat-label">Mapped Observations</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueSpecies}</div>
                <div class="stat-label">Species on Map</div>
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

        mapStatsContainer.innerHTML = statsHtml;
    }

    async scanAllPages() {
        this.isLoading = true;
        this.showLoadingIndicator();
        this.allImages = [];
        
        let completedPages = 0;
        const totalPages = this.sourcePages.length;

        for (const url of this.sourcePages) {
            try {
                this.updateProgressIndicator(`Scanning ${this.getPageName(url)}... (${completedPages + 1}/${totalPages})`);
                
                const content = await this.fetchPageContent(url);
                if (content) {
                    const images = this.parseImagesFromHTML(content, url);
                    this.allImages.push(...images);
                    console.log(`Found ${images.length} images from ${this.getPageName(url)}`);
                } else {
                    console.warn(`No content retrieved from ${url}`);
                }
                
                completedPages++;
                await this.delay(500);
                
            } catch (error) {
                console.error(`Error scanning ${url}:`, error);
                completedPages++;
            }
        }

        this.updateProgressIndicator('Processing and sorting images...');
        
        this.allImages = this.removeDuplicates(this.allImages);
        
        this.allImages.sort((a, b) => {
            if (a.hasValidDate && b.hasValidDate) {
                return b.timestamp - a.timestamp;
            } else if (a.hasValidDate && !b.hasValidDate) {
                return -1;
            } else if (!a.hasValidDate && b.hasValidDate) {
                return 1;
            } else {
                return a.species.localeCompare(b.species);
            }
        });
        
        this.filteredImages = [...this.allImages];
        this.hideLoadingIndicator();
        this.isLoading = false;
        this.currentPage = 1;
        
        // Update map after data is loaded
        this.updateMap();
        
        console.log(`Total unique images loaded: ${this.allImages.length}`);
        const mappableCount = this.allImages.filter(img => img.hasCoordinates).length;
        console.log(`${mappableCount} images have coordinates for mapping`);
        
        return this.allImages;
    }

    filterImages(searchParams) {
        const { species, location, dateFrom, dateTo, showOnlyMappable } = searchParams;
        this.currentSearchParams = searchParams;
        
        if (!species && !location && !dateFrom && !dateTo && !showOnlyMappable) {
            this.filteredImages = [...this.allImages];
        } else {
            this.filteredImages = this.allImages.filter(image => {
                // Filter to only mappable if requested
                if (showOnlyMappable && !image.hasCoordinates) {
                    return false;
                }
                
                if ((location || dateFrom || dateTo) && !image.hasDataTitle) {
                    return false;
                }
                
                if (species) {
                    const speciesMatch = image.species.toLowerCase().includes(species.toLowerCase()) || 
                                       image.commonName.toLowerCase().includes(species.toLowerCase());
                    if (!speciesMatch) return false;
                }
                
                if (location) {
                    if (!image.location) return false;

                    const locationLower = location.toLowerCase().trim();
                    const imageLocationLower = image.location.toLowerCase();

                    const stateMappings = {
                        'arizona': ['az', 'arizona'],
                        'florida': ['fl', 'florida'],
                        'texas': ['tx', 'texas'],
                        'new mexico': ['nm', 'new mexico'],
                        'az': ['az', 'arizona'],
                        'fl': ['fl', 'florida'],
                        'tx': ['tx', 'texas'],
                        'nm': ['nm', 'new mexico']
                    };

                    const searchVariations = stateMappings[locationLower] || [locationLower];

                    const isMatch = searchVariations.some(term => {
                        const regex = new RegExp(`(^|\\W)${term}(\\W|$)`, 'i');
                        return regex.test(imageLocationLower);
                    });

                    if (!isMatch) return false;
                }
                
                if (image.date) {
                    const imageDate = new Date(image.date);
                    if (dateFrom && imageDate < new Date(dateFrom)) {
                        return false;
                    }
                    if (dateTo && imageDate > new Date(dateTo)) {
                        return false;
                    }
                }
                
                return true;
            });
        }
        
        this.filteredImages.sort((a, b) => {
            if (a.hasValidDate && b.hasValidDate) {
                return b.timestamp - a.timestamp;
            } else if (a.hasValidDate && !b.hasValidDate) {
                return -1;
            } else if (!a.hasValidDate && b.hasValidDate) {
                return 1;
            } else {
                return a.species.localeCompare(b.species);
            }
        });
        
        this.currentPage = 1;
        
        // Update map with filtered results
        this.updateMap();
        
        return this.filteredImages;
    }

    showLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'infinite-gallery-loading';
        loadingDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; font-size: 18px;">
                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
                <div id="infinite-loading-text">Loading butterfly images and locations...</div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        const targetContainer = document.querySelector('#infinite-gallery-container');
        if (targetContainer) {
            targetContainer.innerHTML = '';
            targetContainer.appendChild(loadingDiv);
        }
    }

    updateProgressIndicator(text) {
        const loadingText = document.querySelector('#infinite-loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    hideLoadingIndicator() {
        const loadingDiv = document.querySelector('#infinite-gallery-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    generateInfiniteGalleryHTML() {
        const imagesToDisplay = this.filteredImages;
        const isSearchActive = this.currentSearchParams && 
                             (this.currentSearchParams.species || 
                              this.currentSearchParams.location || 
                              this.currentSearchParams.dateFrom || 
                              this.currentSearchParams.dateTo ||
                              this.currentSearchParams.showOnlyMappable);
        
        // Show no results message if search is active but no matches found
        if (isSearchActive && imagesToDisplay.length === 0) {
            return `
                <div class="search-container">
                    <form class="search-form" onsubmit="handleSearch(event)">
                        <div class="search-field">
                            <label for="species-search">Species Name</label>
                            <input type="text" id="species-search" placeholder="Search by scientific or common name" 
                                   value="${this.currentSearchParams?.species || ''}">
                        </div>
                        <div class="search-field">
                            <label for="location-search">Location</label>
                            <input type="text" id="location-search" placeholder="Search by location (e.g., Florida)" 
                                   value="${this.currentSearchParams?.location || ''}">
                        </div>
                        <div class="search-field">
                            <label for="date-from">Date From</label>
                            <input type="date" id="date-from" value="${this.currentSearchParams?.dateFrom || ''}">
                        </div>
                        <div class="search-field">
                            <label for="date-to">Date To</label>
                            <input type="date" id="date-to" value="${this.currentSearchParams?.dateTo || ''}">
                        </div>
                        <div class="search-field">
                            <label>
                                <input type="checkbox" id="show-only-mappable" ${this.currentSearchParams?.showOnlyMappable ? 'checked' : ''}>
                                Show only observations with coordinates
                            </label>
                        </div>
                        <div class="search-actions">
                            <button type="submit" class="search-btn">Search</button>
                            <button type="button" class="reset-btn" onclick="resetSearch()">Reset</button>
                        </div>
                    </form>
                    <div class="no-results">
                        <p>No matching images found for your search criteria.</p>
                        <button onclick="resetSearch()" style="padding: 10px 20px; font-size: 16px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Reset Search
                        </button>
                    </div>
                </div>
            `;
        }

        // If no search criteria, use all images
        const displayImages = isSearchActive ? imagesToDisplay : this.allImages;
        const totalPages = Math.ceil(displayImages.length / this.speciesPerPage);
        const startIndex = (this.currentPage - 1) * this.speciesPerPage;
        const endIndex = Math.min(startIndex + this.speciesPerPage, displayImages.length);
        const currentImages = displayImages.slice(startIndex, endIndex);

        const imageChunks = this.chunkArray(currentImages, this.imagesPerRow);
        const mappableCount = displayImages.filter(img => img.hasCoordinates).length;
        
        let html = `
            <div class="search-container">
                <form class="search-form" onsubmit="handleSearch(event)">
                    <div class="search-field">
                        <label for="species-search">Species Name</label>
                        <input type="text" id="species-search" placeholder="Search by scientific or common name" 
                               value="${this.currentSearchParams?.species || ''}">
                    </div>
                    <div class="search-field">
                        <label for="location-search">Location</label>
                        <input type="text" id="location-search" placeholder="Search by location (e.g., Florida)" 
                               value="${this.currentSearchParams?.location || ''}">
                    </div>
                    <div class="search-field">
                        <label for="date-from">Date From</label>
                        <input type="date" id="date-from" value="${this.currentSearchParams?.dateFrom || ''}">
                    </div>
                    <div class="search-field">
                        <label for="date-to">Date To</label>
                        <input type="date" id="date-to" value="${this.currentSearchParams?.dateTo || ''}">
                    </div>
                    <div class="search-field">
                        <label>
                            <input type="checkbox" id="show-only-mappable" ${this.currentSearchParams?.showOnlyMappable ? 'checked' : ''}>
                            Show only observations with coordinates
                        </label>
                    </div>
                    <div class="search-actions">
                        <button type="submit" class="search-btn">Search</button>
                        <button type="button" class="reset-btn" onclick="resetSearch()">Reset</button>
                    </div>
                </form>
                <div class="search-results-info">
                    Showing ${startIndex + 1}-${endIndex} of ${displayImages.length} matching species
                    ${isSearchActive ? '(filtered)' : ''} • ${mappableCount} with coordinates for mapping
                </div>
            </div>
            
            <!-- Map Container -->
            <div class="map-section" style="margin: 20px 0;">
                <div class="map-header" style="text-align: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #2c3e50;">Butterfly Observation Map</h3>
                    <div id="map-stats" style="display: flex; justify-content: center; gap: 20px; margin-top: 10px; flex-wrap: wrap;">
                        <!-- Map stats will be populated here -->
                    </div>
                </div>
                <div id="butterfly-map" style="height: 400px; width: 100%; border: 2px solid #ddd; border-radius: 8px; margin-bottom: 20px;"></div>
                <div style="text-align: center; margin-bottom: 20px;">
                    <button onclick="toggleMapView()" style="padding: 8px 16px; font-size: 14px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        Toggle Map View
                    </button>
                    <button onclick="fitMapToBounds()" style="padding: 8px 16px; font-size: 14px; background: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Fit All Observations
                    </button>
                </div>
            </div>
            
            <div class="infinite-gallery-header" style="text-align: center; margin-bottom: 30px;">
                <div style="margin-bottom: 20px;">
                    <button onclick="refreshInfiniteGallery()" style="padding: 8px 16px; font-size: 14px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        Refresh Gallery
                    </button>
                    <button onclick="toggleInfiniteSortOrder()" style="padding: 8px 16px; font-size: 14px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        Toggle Sort Order
                    </button>
                </div>
                <div class="pagination-controls" style="margin-bottom: 20px;">
                    ${this.generatePaginationControls(totalPages)}
                </div>
            </div>
        `;

        // Image gallery display
        imageChunks.forEach((chunk, chunkIndex) => {
            html += `<table align="center" width="90%" class="infinite-species-table" style="margin-bottom: 30px; border-collapse: separate; border-spacing: 10px;">`;
            
            html += `<tr class="infinite-gallery-row">`;
            chunk.forEach(image => {
                const cellWidth = `${100 / this.imagesPerRow}%`;
                const hasCoords = image.hasCoordinates ? '🗺️' : '';
                html += `
                    <td align="center" style="width: ${cellWidth}; vertical-align: top;">
                        <div class="species-img-container" style="border: 2px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1); transition: transform 0.3s ease;">
                            <a data-lightbox="infinite-butterflies-gallery" 
                               data-title="${image.fullTitle}" 
                               href="${image.fullImageUrl}">
                                <img height="200" 
                                     src="${image.thumbnailUrl}" 
                                     style="display: block; width: 100%; object-fit: cover;" 
                                     alt="${image.alt}"
                                     onmouseover="this.parentElement.parentElement.style.transform='scale(1.05)'"
                                     onmouseout="this.parentElement.parentElement.style.transform='scale(1)'"/>
                            </a>
                            ${hasCoords ? `<div style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; padding: 2px 5px; border-radius: 3px; font-size: 12px;">${hasCoords}</div>` : ''}
                        </div>
                    </td>
                `;
            });
            for (let i = chunk.length; i < this.imagesPerRow; i++) {
                html += `<td style="width: ${100 / this.imagesPerRow}%;"></td>`;
            }
            html += `</tr>`;
            
            html += `<tr class="infinite-species-labels">`;
            chunk.forEach(image => {
                html += `
                    <td style="text-align: center; padding: 10px 5px;">
                        <p style="font-size: 14px; margin: 0; line-height: 1.4;">
                            <i style="color: #2c3e50;">${image.species}</i><br>
                            <strong style="color: #34495e;">${image.commonName}</strong>
                            ${image.location ? `<br><small style="color: #666;">📍 ${image.location}</small>` : ''}
                            ${image.date ? `<br><small style="color: #666;">📅 ${new Date(image.date).toLocaleDateString()}</small>` : ''}
                        </p>
                    </td>
                `;
            });
            for (let i = chunk.length; i < this.imagesPerRow; i++) {
                html += `<td></td>`;
            }
            html += `</tr>`;
            
            html += `</table>`;
        });

        html += `
            <div class="pagination-controls" style="text-align: center; margin-top: 30px;">
                ${this.generatePaginationControls(totalPages)}
            </div>
        `;

        return html;
    }

    generatePaginationControls(totalPages) {
        let html = '';
        
        if (this.currentPage > 1) {
            html += `<button onclick="goToPage(${this.currentPage - 1})" class="pagination-btn">Previous</button>`;
        } else {
            html += `<button disabled class="pagination-btn disabled">Previous</button>`;
        }
        
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            html += `<button onclick="goToPage(1)" class="pagination-btn ${1 === this.currentPage ? 'active' : ''}">1</button>`;
            if (startPage > 2) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button onclick="goToPage(${i})" class="pagination-btn ${i === this.currentPage ? 'active' : ''}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
            html += `<button onclick="goToPage(${totalPages})" class="pagination-btn ${totalPages === this.currentPage ? 'active' : ''}">${totalPages}</button>`;
        }
        
        if (this.currentPage < totalPages) {
            html += `<button onclick="goToPage(${this.currentPage + 1})" class="pagination-btn">Next</button>`;
        } else {
            html += `<button disabled class="pagination-btn disabled">Next</button>`;
        }
        
        return html;
    }

    updateInfiniteGalleryContainer() {
        const container = document.querySelector('#infinite-gallery-container');
        if (!container) {
            console.error('Infinite gallery container not found');
            return false;
        }
        
        container.innerHTML = this.generateInfiniteGalleryHTML();
        
        // Initialize map after container is updated
        setTimeout(() => {
            this.initMap();
            this.updateMap();
        }, 100);
        
        return true;
    }

    goToPage(pageNumber) {
        const totalPages = Math.ceil(this.filteredImages.length / this.speciesPerPage);
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            this.currentPage = pageNumber;
            this.updateInfiniteGalleryContainer();
            const container = document.querySelector('#infinite-gallery-container');
            if (container) {
                container.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    async refreshInfiniteGallery() {
        if (this.isLoading) return false;
        
        try {
            await this.scanAllPages();
            this.updateInfiniteGalleryContainer();
            this.lastRefresh = Date.now();
            console.log(`Infinite gallery refreshed with ${this.allImages.length} images`);
            return true;
        } catch (error) {
            console.error('Error refreshing infinite gallery:', error);
            return false;
        }
    }

    toggleInfiniteSortOrder() {
        if (this.filteredImages.length === 0) return;
        
        this.filteredImages.reverse();
        this.updateInfiniteGalleryContainer();
    }

    async init() {
        await this.refreshInfiniteGallery();
    }

    startAutoRefresh(intervalHours = 24) {
        setInterval(() => this.refreshInfiniteGallery(), intervalHours * 60 * 60 * 1000);
    }
}

let infiniteGalleryUpdater;

document.addEventListener('DOMContentLoaded', async () => {
    infiniteGalleryUpdater = new ButterflyInfiniteGalleryUpdater({
        daysThreshold: 365,
        imagesPerRow: 6,
        speciesPerPage: 100
    });
    await infiniteGalleryUpdater.init();
    infiniteGalleryUpdater.startAutoRefresh(24);
});

function refreshInfiniteGallery() {
    if (infiniteGalleryUpdater) {
        return infiniteGalleryUpdater.refreshInfiniteGallery();
    }
}

function toggleInfiniteSortOrder() {
    if (infiniteGalleryUpdater) {
        infiniteGalleryUpdater.toggleInfiniteSortOrder();
    }
}

function goToPage(pageNumber) {
    if (infiniteGalleryUpdater) {
        infiniteGalleryUpdater.goToPage(pageNumber);
    }
}

function handleSearch(event) {
    event.preventDefault();
    
    if (!infiniteGalleryUpdater) return;
    
    const species = document.getElementById('species-search').value;
    const location = document.getElementById('location-search').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const showOnlyMappable = document.getElementById('show-only-mappable').checked;
    
    infiniteGalleryUpdater.filterImages({ species, location, dateFrom, dateTo, showOnlyMappable });
    infiniteGalleryUpdater.updateInfiniteGalleryContainer();
}

function resetSearch() {
    if (!infiniteGalleryUpdater) return;
    
    document.getElementById('species-search').value = '';
    document.getElementById('location-search').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    document.getElementById('show-only-mappable').checked = false;
    
    infiniteGalleryUpdater.currentSearchParams = null;
    infiniteGalleryUpdater.filteredImages = [...infiniteGalleryUpdater.allImages];
    infiniteGalleryUpdater.currentPage = 1;
    infiniteGalleryUpdater.updateInfiniteGalleryContainer();
}

// Map-specific functions
function toggleMapView() {
    if (!infiniteGalleryUpdater || !infiniteGalleryUpdater.mapInitialized) return;
    
    const mapContainer = document.getElementById('butterfly-map');
    if (mapContainer.style.display === 'none') {
        mapContainer.style.display = 'block';
        infiniteGalleryUpdater.map.invalidateSize();
    } else {
        mapContainer.style.display = 'none';
    }
}

function fitMapToBounds() {
    if (!infiniteGalleryUpdater || !infiniteGalleryUpdater.mapInitialized) return;
    
    const mappableImages = infiniteGalleryUpdater.filteredImages.filter(img => img.hasCoordinates);
    if (mappableImages.length > 0) {
        const group = new L.featureGroup(infiniteGalleryUpdater.markerGroup.getLayers());
        infiniteGalleryUpdater.map.fitBounds(group.getBounds().pad(0.1));
    }
}

function debugInfiniteGallery() {
    if (infiniteGalleryUpdater) {
        console.log('All images:', infiniteGalleryUpdater.allImages);
        console.log('Total images:', infiniteGalleryUpdater.allImages.length);
        
        const mappableCount = infiniteGalleryUpdater.allImages.filter(img => img.hasCoordinates).length;
        console.log(`Images with coordinates: ${mappableCount}/${infiniteGalleryUpdater.allImages.length}`);
        
        console.log('Images by page:', infiniteGalleryUpdater.allImages.reduce((acc, img) => {
            acc[img.sourcePage] = (acc[img.sourcePage] || 0) + 1;
            return acc;
        }, {}));
        
        const methodStats = infiniteGalleryUpdater.allImages.reduce((acc, img) => {
            acc[img.extractionMethod] = (acc[img.extractionMethod] || 0) + 1;
            return acc;
        }, {});
        console.log('Extraction method stats:', methodStats);
        
        const unknownCount = infiniteGalleryUpdater.allImages.filter(img => 
            img.species === 'Unknown Species' || img.commonName === 'Unknown'
        ).length;
        console.log(`Unknown species/names: ${unknownCount}/${infiniteGalleryUpdater.allImages.length}`);
        
        // Sample coordinate data
        const withCoords = infiniteGalleryUpdater.allImages.filter(img => img.hasCoordinates).slice(0, 5);
        console.log('Sample images with coordinates:', withCoords.map(img => ({
            species: img.species,
            location: img.location,
            coordinates: img.coordinates
        })));
    }
}

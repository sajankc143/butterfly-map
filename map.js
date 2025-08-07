 // Shared Butterfly Data Manager
    class ButterflyDataManager {
      constructor() {
        this.allObservations = [];
        this.filteredObservations = [];
        this.map = null;
        this.markerCluster = null;
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
      }

      initMap() {
        this.map = L.map('map').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        this.markerCluster = L.markerClusterGroup();
        this.map.addLayer(this.markerCluster);
      }

      async loadAllData() {
        for (const url of this.sourcePages) {
          const content = await this.fetchPageContent(url);
          if (content) {
            const observations = this.parseObservations(content, url);
            this.allObservations.push(...observations);
          }
        }
        this.filteredObservations = [...this.allObservations];
        this.updateMap();
        this.updateGallery();
      }

      filterData(searchParams) {
        this.filteredObservations = this.allObservations.filter(obs => {
          if (searchParams.species && 
              !obs.species.toLowerCase().includes(searchParams.species.toLowerCase()) {
            return false;
          }
          return true;
        });
        this.updateMap();
      }

      updateMap() {
        this.markerCluster.clearLayers();
        
        this.filteredObservations.forEach(obs => {
          if (obs.coordinates) {
            const popup = L.popup().setContent(`
              <div class="popup-species">${obs.species}</div>
              <div class="popup-common">${obs.commonName}</div>
              <img src="${obs.imageUrl}" class="popup-image">
              <div>${obs.location || ''}</div>
            `);
            
            L.marker(obs.coordinates)
              .bindPopup(popup)
              .addTo(this.markerCluster);
          }
        });
        
        if (this.filteredObservations.length > 0) {
          this.map.fitBounds(this.markerCluster.getBounds());
        }
      }

      updateGallery() {
        // Your existing gallery update code
        // Should use this.filteredObservations
      }

      parseObservations(html, sourceUrl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const observations = [];
        
        doc.querySelectorAll('a[data-title]').forEach(link => {
          const title = link.getAttribute('data-title');
          const img = link.querySelector('img');
          if (!title || !img) return;
          
          const speciesMatch = title.match(/<i>(.*?)<\/i>\s*[-–]\s*([^<]+)/);
          const coords = this.parseCoordinates(title);
          
          if (speciesMatch && coords) {
            observations.push({
              species: speciesMatch[1].trim(),
              commonName: speciesMatch[2].trim(),
              coordinates: coords,
              imageUrl: img.getAttribute('src'),
              sourceUrl: sourceUrl
            });
          }
        });
        
        return observations;
      }

      parseCoordinates(text) {
        // Your existing coordinate parsing logic
      }

      async fetchPageContent(url) {
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          return await response.text();
        } catch (error) {
          console.error('Fetch error:', error);
          return null;
        }
      }
    }

    // Initialize everything
    document.addEventListener('DOMContentLoaded', async () => {
      const butterflyManager = new ButterflyDataManager();
      butterflyManager.initMap();
      await butterflyManager.loadAllData();
      
      // Connect search functionality
      document.getElementById('species-search').addEventListener('input', (e) => {
        butterflyManager.filterData({ species: e.target.value });
      });
    });

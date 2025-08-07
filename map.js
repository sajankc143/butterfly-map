// Enhanced ButterflyDataManager to work with your gallery
class ButterflyDataManager {
  constructor() {
    this.allObservations = [];
    this.filteredObservations = [];
    this.map = null;
    this.markerCluster = null;
  }

  initMap() {
    this.map = L.map('map').setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    
    this.markerCluster = L.markerClusterGroup();
    this.map.addLayer(this.markerCluster);
  }

  // Modified to use gallery's data instead of fetching separately
  syncWithGallery(galleryUpdater) {
    this.allObservations = galleryUpdater.allImages.map(img => this.imageToObservation(img));
    this.filteredObservations = [...this.allObservations];
    this.updateMap();
  }

  imageToObservation(image) {
    return {
      species: image.species,
      commonName: image.commonName,
      coordinates: this.parseCoordinates(image.fullTitle),
      location: image.location,
      date: image.date,
      imageUrl: image.thumbnailUrl,
      fullImageUrl: image.fullImageUrl,
      sourceUrl: image.sourceUrl,
      originalTitle: image.fullTitle
    };
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

  // Your existing coordinate parsing logic
  parseCoordinates(text) {
    // ... keep your current implementation ...
  }
}

// Initialize and connect with gallery
document.addEventListener('DOMContentLoaded', async () => {
  const butterflyManager = new ButterflyDataManager();
  butterflyManager.initMap();
  
  // Wait for gallery to initialize
  setTimeout(() => {
    if (window.infiniteGalleryUpdater) {
      // Sync with gallery data
      butterflyManager.syncWithGallery(window.infiniteGalleryUpdater);
      
      // Update map whenever gallery filters change
      const originalUpdate = window.infiniteGalleryUpdater.updateInfiniteGalleryContainer;
      window.infiniteGalleryUpdater.updateInfiniteGalleryContainer = function() {
        butterflyManager.filteredObservations = 
          this.filteredImages.map(img => butterflyManager.imageToObservation(img));
        butterflyManager.updateMap();
        return originalUpdate.apply(this, arguments);
      };
    }
  }, 500);
});

// Complete Map-Gallery Integration
  let butterflyMap;
  let markerCluster;
  let isLoading = false;

  function initMap() {
    butterflyMap = L.map('map').setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(butterflyMap);
    
    markerCluster = L.markerClusterGroup();
    butterflyMap.addLayer(markerCluster);
    
    initGallery();
  }

  function initGallery() {
    if (typeof ButterflyInfiniteGalleryUpdater === 'undefined') {
      console.error('Gallery class not found');
      return;
    }
    
    window.infiniteGalleryUpdater = new ButterflyInfiniteGalleryUpdater({
      daysThreshold: 365,
      imagesPerRow: 6,
      speciesPerPage: 100,
      useProxy: true
    });

    // Connect gallery updates to map
    const originalUpdate = infiniteGalleryUpdater.updateInfiniteGalleryContainer;
    infiniteGalleryUpdater.updateInfiniteGalleryContainer = function() {
      const result = originalUpdate.apply(this, arguments);
      updateMapFromGallery();
      return result;
    };

    loadData();
  }

  async function loadData() {
    if (isLoading) return;
    isLoading = true;
    
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
      loadingDiv.style.display = 'block';
      loadingDiv.textContent = 'Loading butterfly data...';
    }

    try {
      await infiniteGalleryUpdater.scanAllPages();
      updateMapFromGallery();
    } catch (error) {
      console.error('Loading failed:', error);
      if (loadingDiv) loadingDiv.textContent = 'Error loading data. Please refresh.';
    } finally {
      isLoading = false;
      if (loadingDiv) loadingDiv.style.display = 'none';
    }
  }

  function updateMapFromGallery() {
    if (!window.infiniteGalleryUpdater || !butterflyMap) return;
    
    markerCluster.clearLayers();
    
    const images = infiniteGalleryUpdater.getFilteredImages();
    images.forEach(img => {
      const coords = parseCoordinates(img.fullTitle);
      if (coords) {
        L.marker(coords)
          .bindPopup(createPopupContent(img))
          .addTo(markerCluster);
      }
    });

    if (markerCluster.getLayers().length > 0) {
      butterflyMap.fitBounds(markerCluster.getBounds());
    }
  }

  function createPopupContent(img) {
    return `
      <div class="popup-species">${img.species}</div>
      <div class="popup-common">${img.commonName}</div>
      <img src="${img.thumbnailUrl}" class="popup-image">
      ${img.location ? `<div>📍 ${img.location}</div>` : ''}
    `;
  }

  function parseCoordinates(text) {
    // Your existing coordinate parsing implementation
    // [Keep all your current coordinate parsing logic here]
    // This should return [latitude, longitude] or null
  }

  // Initialize everything
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    console.log('Application initialized');
  });

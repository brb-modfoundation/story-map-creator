// Map Configuration — standalone basemap options for Story Creator
const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN_HERE'; // set your token here (do not commit)

const mapConfig = {
  initialView: {
    center: [0, 20],
    zoom: 2,
  },

  defaultBasemap: 'satellite',

  basemaps: {
    'satellite': {
      tiles: [`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=${MAPBOX_TOKEN}`],
      maxzoom: 20,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    'carto-positron': {
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
      attribution: '© Carto, © OpenStreetMap contributors',
    },
    'carto-dark': {
      tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      attribution: '© Carto, © OpenStreetMap contributors',
    },
    'osm': {
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap contributors',
    },
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = mapConfig;
}

const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN_HERE';

const mapConfig = {
  "initialView": {
    "zoom": 2,
    "center": [
      0,
      20
    ]
  },
  "defaultBasemap": "satellite",
  "basemaps": {
    "osm": {
      "tiles": [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      ],
      "attribution": "© OpenStreetMap contributors"
    },
    "satellite": {
      "tiles": [
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
      ],
      "attribution": "© Google"
    },
    "carto-dark": {
      "tiles": [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
      ],
      "attribution": "© Carto, © OpenStreetMap contributors"
    },
    "carto-positron": {
      "tiles": [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
      ],
      "attribution": "© Carto, © OpenStreetMap contributors"
    }
  },
  "sources": {},
  "layers": [],
  "userLayersMeta": []
};

if (typeof module !== 'undefined' && module.exports) { module.exports = mapConfig; }

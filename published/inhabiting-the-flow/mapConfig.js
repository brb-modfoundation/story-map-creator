// Map Configuration
// Generated on 6/22/2026, 4:36:53 PM

const mapConfig = {
  "initialView": {
    "center": [
      77.58362199999999,
      12.941648999999998
    ],
    "zoom": 11.05
  },
  "defaultBasemap": "carto-dark",
  "basemaps": {
    "satellite": {
      "tiles": [
        "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=pk.eyJ1IjoibW9kLWZvdW5kYXRpb24iLCJhIjoiY21ncnNrcmx4MXdlOTJqc2FjNW85ZnR3NSJ9.0Ha_bpb4AJ-O2pvIumHu7A"
      ],
      "maxzoom": 20,
      "attribution": "© <a href=\"https://www.mapbox.com/about/maps/\">Mapbox</a> © <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
    },
    "carto-positron": {
      "tiles": [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
      ],
      "attribution": "© Carto, © OpenStreetMap contributors"
    },
    "carto-dark": {
      "tiles": [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
      ],
      "attribution": "© Carto, © OpenStreetMap contributors"
    },
    "osm": {
      "tiles": [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      ],
      "attribution": "© OpenStreetMap contributors"
    }
  },
  "sources": {
    "source-dem-3857-cog": {
      "type": "raster",
      "url": "cog://./layers/geotiff/dem_3857_cog.tif",
      "tileSize": 256
    },
    "source-1870-final-cog": {
      "type": "raster",
      "url": "cog://https://mod-foundation.github.io/download_center/data/geotiff/1870_final_cog.tif",
      "tileSize": 256
    },
    "source-gba-boundary": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/gba_boundary.geojson"
    },
    "source-lakes-existing": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/lakes_existing.geojson"
    },
    "source-primarydrains": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/primarydrains.geojson"
    },
    "source-lakes-lost": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/lakes_lost.geojson"
    },
    "source-gba-wards": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/gba_wards.geojson"
    },
    "source-lake-inscription-stones": {
      "type": "geojson",
      "data": "./layers/lake inscription stones.kml"
    }
  },
  "layers": [
    {
      "id": "layer-dem-3857-cog",
      "type": "raster",
      "source": "source-dem-3857-cog",
      "paint": {
        "raster-opacity": 1
      }
    },
    {
      "id": "layer-1870-final-cog",
      "type": "raster",
      "source": "source-1870-final-cog",
      "paint": {
        "raster-opacity": 1
      }
    },
    {
      "id": "layer-gba-boundary-fill",
      "type": "fill",
      "source": "source-gba-boundary",
      "paint": {
        "fill-color": "rgba(0,100,255,0.3)"
      }
    },
    {
      "id": "layer-gba-boundary-outline",
      "type": "line",
      "source": "source-gba-boundary",
      "paint": {
        "line-color": "#0d6aff",
        "line-width": 1
      }
    },
    {
      "id": "layer-lakes-existing-fill",
      "type": "fill",
      "source": "source-lakes-existing",
      "paint": {
        "fill-color": "rgba(0,100,255,0.3)"
      }
    },
    {
      "id": "layer-lakes-existing-outline",
      "type": "line",
      "source": "source-lakes-existing",
      "paint": {
        "line-color": "#0d6aff",
        "line-width": 1
      }
    },
    {
      "id": "layer-primarydrains",
      "type": "line",
      "source": "source-primarydrains",
      "paint": {
        "line-color": "#0d6aff",
        "line-width": 2
      }
    },
    {
      "id": "layer-lakes-lost-fill",
      "type": "fill",
      "source": "source-lakes-lost",
      "paint": {
        "fill-color": "rgba(0,100,255,0.3)"
      }
    },
    {
      "id": "layer-lakes-lost-outline",
      "type": "line",
      "source": "source-lakes-lost",
      "paint": {
        "line-color": "#0d6aff",
        "line-width": 1
      }
    },
    {
      "id": "layer-gba-wards-fill",
      "type": "fill",
      "source": "source-gba-wards",
      "paint": {
        "fill-color": "rgba(0,100,255,0.3)"
      }
    },
    {
      "id": "layer-gba-wards-outline",
      "type": "line",
      "source": "source-gba-wards",
      "paint": {
        "line-color": "#0d6aff",
        "line-width": 1
      }
    },
    {
      "id": "layer-lake-inscription-stones",
      "type": "circle",
      "source": "source-lake-inscription-stones",
      "paint": {
        "circle-color": "#ff6b6b",
        "circle-radius": 6,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1
      }
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = mapConfig;
}
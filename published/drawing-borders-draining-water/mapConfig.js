const MAPBOX_TOKEN = 'pk.eyJ1IjoibW9kLWZvdW5kYXRpb24iLCJhIjoiY21ncnNrcmx4MXdlOTJqc2FjNW85ZnR3NSJ9.0Ha_bpb4AJ-O2pvIumHu7A';

const mapConfig = {
  "initialView": {
    "zoom": 12.42,
    "center": [
      77.61316999999997,
      12.980958000000001
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
        "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=pk.eyJ1IjoibW9kLWZvdW5kYXRpb24iLCJhIjoiY21ncnNrcmx4MXdlOTJqc2FjNW85ZnR3NSJ9.0Ha_bpb4AJ-O2pvIumHu7A"
      ],
      "maxzoom": 20,
      "attribution": "© <a href=\"https://www.mapbox.com/about/maps/\">Mapbox</a> © <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
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
  "sources": {
    "source-dem-cog": {
      "type": "raster",
      "url": "cog://https://mod-foundation.github.io/download_center/data/geotiff/DEM_cog.tif",
      "tileSize": 256
    },
    "source-cantonment-cog": {
      "type": "raster",
      "url": "cog://https://mod-foundation.github.io/download_center/data/geotiff/cantonment_cog.tif",
      "tileSize": 256
    },
    "source-fort-cog": {
      "type": "raster",
      "url": "cog://https://mod-foundation.github.io/download_center/data/geotiff/fort_cog.tif",
      "tileSize": 256
    },
    "source-lakes-existing": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/lakes_existing.geojson"
    },
    "source-viewpoints": {
      "type": "geojson",
      "data": "./layers/viewpoints.geojson"
    },
    "source-labels": {
      "type": "geojson",
      "data": "./layers/labels.geojson"
    },
    "source-lakes-lost": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/lakes_lost.geojson"
    }
  },
  "layers": [
    {
      "id": "layer-dem-cog",
      "type": "raster",
      "source": "source-dem-cog"
    },
    {
      "id": "layer-cantonment-cog",
      "type": "raster",
      "source": "source-cantonment-cog"
    },
    {
      "id": "layer-fort-cog",
      "type": "raster",
      "source": "source-fort-cog"
    },
    {
      "id": "layer-lakes-existing-fill",
      "type": "fill",
      "source": "source-lakes-existing",
      "paint": {
        "fill-color": "#3388ff",
        "fill-opacity": 0.4
      }
    },
    {
      "id": "layer-lakes-existing-outline",
      "type": "line",
      "source": "source-lakes-existing",
      "paint": {
        "line-color": "#3388ff",
        "line-width": 1
      }
    },
    {
      "id": "layer-viewpoints",
      "type": "symbol",
      "source": "source-viewpoints",
      "layout": {
        "icon-image": "viewpoint-icon",
        "icon-size": 0.15,
        "icon-rotation-alignment": "map",
        "icon-rotate": [
          "get",
          "angle"
        ],
        "icon-allow-overlap": true
      },
      "paint": {
        "icon-opacity": 1
      }
    },
    {
      "id": "layer-labels",
      "type": "symbol",
      "source": "source-labels",
      "layout": {
        "text-field": [
          "get",
          "name"
        ],
        "text-font": [
          "Open Sans Bold"
        ],
        "text-size": 15,
        "text-anchor": "left",
        "text-allow-overlap": true,
        "text-transform": "uppercase",
        "text-offset": [
          0.5,
          0
        ]
      },
      "paint": {
        "text-color": "#0d6aff",
        "text-halo-color": "#f9ea46",
        "text-halo-width": 6
      }
    },
    {
      "id": "layer-lakes-lost-fill",
      "type": "fill",
      "source": "source-lakes-lost",
      "paint": {
        "fill-color": "#3388ff",
        "fill-opacity": 0.4
      }
    },
    {
      "id": "layer-lakes-lost-outline",
      "type": "line",
      "source": "source-lakes-lost",
      "paint": {
        "line-color": "#3388ff",
        "line-width": 1
      }
    }
  ],
  "userLayersMeta": [
    {
      "id": "layer-dem-cog",
      "name": "DEM_cog",
      "style": null,
      "category": "raster",
      "filename": "DEM_cog.tif",
      "sourceId": "source-dem-cog",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/geotiff/DEM_cog.tif"
    },
    {
      "id": "layer-cantonment-cog",
      "name": "cantonment_cog",
      "style": null,
      "category": "raster",
      "filename": "cantonment_cog.tif",
      "sourceId": "source-cantonment-cog",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/geotiff/cantonment_cog.tif"
    },
    {
      "id": "layer-fort-cog",
      "name": "fort_cog",
      "style": null,
      "category": "raster",
      "filename": "fort_cog.tif",
      "sourceId": "source-fort-cog",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/geotiff/fort_cog.tif"
    },
    {
      "id": "layer-lakes-existing",
      "name": "lakes_existing",
      "style": {
        "fillColor": "#0064ff",
        "fillOpacity": 0.3,
        "strokeColor": "#0d6aff",
        "strokeWidth": 1
      },
      "category": "polygon",
      "filename": "lakes_existing.geojson",
      "sourceId": "source-lakes-existing",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/json/lakes_existing.geojson"
    },
    {
      "id": "layer-viewpoints",
      "name": "viewpoints",
      "style": null,
      "category": "viewpoints",
      "filename": "viewpoints.geojson",
      "sourceId": "source-viewpoints",
      "remoteUrl": "https://ifwmzmcnozyyavjjyqrn.supabase.co/storage/v1/object/public/datasets/708420c6-89b3-4c4f-8a73-2ee40ffa8b71/1782218249551-viewpoints.geojson"
    },
    {
      "id": "layer-labels",
      "name": "labels",
      "style": null,
      "category": "labels",
      "filename": "labels.geojson",
      "sourceId": "source-labels",
      "remoteUrl": "https://ifwmzmcnozyyavjjyqrn.supabase.co/storage/v1/object/public/datasets/708420c6-89b3-4c4f-8a73-2ee40ffa8b71/1782218233377-labels.geojson"
    },
    {
      "id": "layer-lakes-lost",
      "name": "lakes_lost",
      "style": {
        "fillColor": "#0064ff",
        "fillOpacity": 0.3,
        "strokeColor": "#0d6aff",
        "strokeWidth": 1
      },
      "category": "polygon",
      "filename": "lakes_lost.geojson",
      "sourceId": "source-lakes-lost",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/json/lakes_lost.geojson"
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) { module.exports = mapConfig; }

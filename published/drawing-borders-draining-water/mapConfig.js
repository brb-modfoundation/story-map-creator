const MAPBOX_TOKEN = 'pk.eyJ1IjoibW9kLWZvdW5kYXRpb24iLCJhIjoiY21ncnNrcmx4MXdlOTJqc2FjNW85ZnR3NSJ9.0Ha_bpb4AJ-O2pvIumHu7A';

const mapConfig = {
  "initialView": {
    "zoom": 13.16,
    "center": [
      77.600369,
      12.978869999999972
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
      "tiles": [
        "cog://https://mod-foundation.github.io/download_center/data/geotiff/DEM_cog.tif"
      ],
      "tileSize": 256
    },
    "source-cantonment-cog": {
      "type": "raster",
      "tiles": [
        "cog://https://mod-foundation.github.io/download_center/data/geotiff/cantonment_cog.tif"
      ],
      "tileSize": 256
    },
    "source-fort-cog": {
      "type": "raster",
      "tiles": [
        "cog://https://mod-foundation.github.io/download_center/data/geotiff/fort_cog.tif"
      ],
      "tileSize": 256
    },
    "source-lakes-lost": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/lakes_lost.geojson"
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
      "id": "layer-lakes-lost",
      "type": "circle",
      "source": "source-lakes-lost",
      "paint": {
        "circle-color": "#3388ff",
        "circle-radius": 5
      }
    },
    {
      "id": "layer-lakes-existing",
      "type": "circle",
      "source": "source-lakes-existing",
      "paint": {
        "circle-color": "#3388ff",
        "circle-radius": 5
      }
    },
    {
      "id": "layer-viewpoints",
      "type": "circle",
      "source": "source-viewpoints",
      "paint": {
        "circle-color": "#3388ff",
        "circle-radius": 5
      }
    },
    {
      "id": "layer-labels",
      "type": "circle",
      "source": "source-labels",
      "paint": {
        "circle-color": "#3388ff",
        "circle-radius": 5
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
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) { module.exports = mapConfig; }

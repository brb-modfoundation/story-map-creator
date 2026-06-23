const MAPBOX_TOKEN = 'pk.eyJ1IjoibW9kLWZvdW5kYXRpb24iLCJhIjoiY21ncnNrcmx4MXdlOTJqc2FjNW85ZnR3NSJ9.0Ha_bpb4AJ-O2pvIumHu7A';

const mapConfig = {
  "initialView": {
    "zoom": 10.81,
    "center": [
      77.60921655367656,
      12.989842096861906
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
    "source-1897-cantonment-cog": {
      "type": "raster",
      "tiles": [
        "cog://https://mod-foundation.github.io/download_center/data/geotiff/1897_cantonment_cog.tif"
      ],
      "tileSize": 256
    },
    "source-lakes-existing": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/lakes_existing.geojson"
    },
    "source-lake-inscription-stones": {
      "type": "geojson",
      "data": "./layers/lake inscription stones.kml"
    },
    "source-gba-boundary": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/gba_boundary.geojson"
    }
  },
  "layers": [
    {
      "id": "layer-dem-cog",
      "type": "raster",
      "source": "source-dem-cog"
    },
    {
      "id": "layer-1897-cantonment-cog",
      "type": "raster",
      "source": "source-1897-cantonment-cog"
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
      "id": "layer-lake-inscription-stones",
      "type": "circle",
      "source": "source-lake-inscription-stones",
      "paint": {
        "circle-color": "#3388ff",
        "circle-radius": 5
      }
    },
    {
      "id": "layer-gba-boundary",
      "type": "circle",
      "source": "source-gba-boundary",
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
      "id": "layer-1897-cantonment-cog",
      "name": "1897_cantonment_cog",
      "style": null,
      "category": "raster",
      "filename": "1897_cantonment_cog.tif",
      "sourceId": "source-1897-cantonment-cog",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/geotiff/1897_cantonment_cog.tif"
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
      "id": "layer-lake-inscription-stones",
      "name": "lake inscription stones",
      "style": null,
      "category": "symbol",
      "filename": "lake inscription stones.kml",
      "sourceId": "source-lake-inscription-stones",
      "remoteUrl": "https://ifwmzmcnozyyavjjyqrn.supabase.co/storage/v1/object/public/datasets/708420c6-89b3-4c4f-8a73-2ee40ffa8b71/1782193625878-lake_inscription_stones.geojson"
    },
    {
      "id": "layer-gba-boundary",
      "name": "gba_boundary",
      "style": {
        "fillColor": "#0064ff",
        "fillOpacity": 0.3,
        "strokeColor": "#0d6aff",
        "strokeWidth": 1
      },
      "category": "polygon",
      "filename": "gba_boundary.geojson",
      "sourceId": "source-gba-boundary",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/json/gba_boundary.geojson"
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) { module.exports = mapConfig; }

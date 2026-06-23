const MAPBOX_TOKEN = 'pk.eyJ1IjoibW9kLWZvdW5kYXRpb24iLCJhIjoiY21ncnNrcmx4MXdlOTJqc2FjNW85ZnR3NSJ9.0Ha_bpb4AJ-O2pvIumHu7A';

const mapConfig = {
  "initialView": {
    "zoom": 15.91,
    "center": [
      77.64243399999998,
      12.920303999999987
    ]
  },
  "defaultBasemap": "carto-dark",
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
    "source-1870-final-cog": {
      "type": "raster",
      "tiles": [
        "cog://https://mod-foundation.github.io/download_center/data/geotiff/1870_final_cog.tif"
      ],
      "tileSize": 256
    },
    "source-lakes-existing": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/lakes_existing.geojson"
    },
    "source-primarydrains": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/primarydrains.geojson"
    },
    "source-lake-inscription-stones": {
      "type": "geojson",
      "data": "./layers/lake inscription stones.kml"
    },
    "source-lakes-lost": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/lakes_lost.geojson"
    },
    "source-gba-wards": {
      "type": "geojson",
      "data": "https://mod-foundation.github.io/download_center/data/json/gba_wards.geojson"
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
      "id": "layer-1870-final-cog",
      "type": "raster",
      "source": "source-1870-final-cog"
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
      "id": "layer-primarydrains",
      "type": "circle",
      "source": "source-primarydrains",
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
      "id": "layer-lakes-lost",
      "type": "circle",
      "source": "source-lakes-lost",
      "paint": {
        "circle-color": "#3388ff",
        "circle-radius": 5
      }
    },
    {
      "id": "layer-gba-wards",
      "type": "circle",
      "source": "source-gba-wards",
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
      "id": "layer-1870-final-cog",
      "name": "1870_final_cog",
      "style": null,
      "category": "raster",
      "filename": "1870_final_cog.tif",
      "sourceId": "source-1870-final-cog",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/geotiff/1870_final_cog.tif"
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
      "id": "layer-primarydrains",
      "name": "primarydrains",
      "style": {
        "strokeColor": "#0d6aff",
        "strokeWidth": 2
      },
      "category": "line",
      "filename": "primarydrains.geojson",
      "sourceId": "source-primarydrains",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/json/primarydrains.geojson"
    },
    {
      "id": "layer-lake-inscription-stones",
      "name": "lake inscription stones",
      "style": null,
      "category": "symbol",
      "filename": "lake inscription stones.kml",
      "sourceId": "source-lake-inscription-stones",
      "remoteUrl": "https://ifwmzmcnozyyavjjyqrn.supabase.co/storage/v1/object/public/datasets/04032391-ceb4-41a5-afd8-d9228c76a877/1781784313839-lake_inscription_stones.geojson"
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
      "id": "layer-gba-wards",
      "name": "gba_wards",
      "style": {
        "fillColor": "#0064ff",
        "fillOpacity": 0.3,
        "strokeColor": "#0d6aff",
        "strokeWidth": 1
      },
      "category": "polygon",
      "filename": "gba_wards.geojson",
      "sourceId": "source-gba-wards",
      "remoteUrl": "https://mod-foundation.github.io/download_center/data/json/gba_wards.geojson"
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

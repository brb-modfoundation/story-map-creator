// Story Map Editor

maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);

// ─── State ────────────────────────────────────────────────────────────────────

let chapters = [...storyConfig.chapters];
let activeChapterIndex = null;
let editorMap = null;
let currentBasemap = mapConfig.defaultBasemap;
let userLayers = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    initializeUI();
    renderChaptersList();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
}

// Returns the actual MapLibre layer IDs for a userLayer entry.
// Polygons use two sub-layers; everything else uses entry.id directly.
function getMapLayerIds(entry) {
    return entry.category === 'polygon'
        ? [`${entry.id}-fill`, `${entry.id}-outline`]
        : [entry.id];
}

// ─── Map ──────────────────────────────────────────────────────────────────────

function initializeMap() {
    const bm = mapConfig.basemaps[mapConfig.defaultBasemap];

    editorMap = new maplibregl.Map({
        container: 'editor-map',
        style: {
            version: 8,
            glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            sources: {
                basemap: {
                    type: 'raster',
                    tiles: bm.tiles,
                    tileSize: 256,
                    attribution: bm.attribution,
                },
            },
            layers: [
                { id: 'basemap-layer', type: 'raster', source: 'basemap', paint: { 'raster-opacity': 1 } },
            ],
        },
        center: mapConfig.initialView.center,
        zoom: mapConfig.initialView.zoom,
    });

    editorMap.on('move', updateViewInfo);
    editorMap.on('pitch', updateViewInfo);
    editorMap.on('rotate', updateViewInfo);
    editorMap.on('zoom', updateViewInfo);
}

function updateViewInfo() {
    document.getElementById('current-zoom').textContent = editorMap.getZoom().toFixed(2);
    document.getElementById('current-pitch').textContent = Math.round(editorMap.getPitch());
    document.getElementById('current-bearing').textContent = Math.round(editorMap.getBearing());
}

function switchBasemap(key) {
    currentBasemap = key;
    const bm = mapConfig.basemaps[key];
    if (editorMap && editorMap.getSource('basemap')) {
        editorMap.getSource('basemap').setTiles(bm.tiles);
    }
}

// ─── UI Initialisation ────────────────────────────────────────────────────────

function initializeUI() {
    initSidebarTabs();
    initBasemapButtons();
    initUploadPanel();

    document.getElementById('add-chapter-btn').addEventListener('click', addNewChapter);
    document.getElementById('capture-view-btn').addEventListener('click', captureCurrentView);

    document.getElementById('view-type').addEventListener('change', (e) => {
        const isBounds = e.target.value === 'bounds';
        document.getElementById('center-zoom-inputs').style.display = isBounds ? 'none' : 'block';
        document.getElementById('bounds-inputs').style.display = isBounds ? 'block' : 'none';
    });

    // Viewport overlay helpers
    const overlays = {
        desktop: document.getElementById('viewport-overlay-desktop'),
        ipad: document.getElementById('viewport-overlay-ipad'),
        'ipad-portrait': document.getElementById('viewport-overlay-ipad-portrait'),
        mobile: document.getElementById('viewport-overlay-mobile'),
    };
    const showOverlay = (key) => Object.entries(overlays).forEach(([k, el]) => el.style.display = k === key ? 'block' : 'none');
    const hideOverlays = () => Object.values(overlays).forEach(el => el.style.display = 'none');

    const boundsGroups = [
        { btn: 'get-bounds-button', sw: ['bounds-sw-lng', 'bounds-sw-lat'], ne: ['bounds-ne-lng', 'bounds-ne-lat'], device: 'desktop' },
        { btn: 'get-bounds-ipad-button', sw: ['bounds-ipad-sw-lng', 'bounds-ipad-sw-lat'], ne: ['bounds-ipad-ne-lng', 'bounds-ipad-ne-lat'], device: 'ipad' },
        { btn: 'get-bounds-ipad-portrait-button', sw: ['bounds-ipad-portrait-sw-lng', 'bounds-ipad-portrait-sw-lat'], ne: ['bounds-ipad-portrait-ne-lng', 'bounds-ipad-portrait-ne-lat'], device: 'ipad-portrait' },
        { btn: 'get-bounds-mobile-button', sw: ['bounds-mobile-sw-lng', 'bounds-mobile-sw-lat'], ne: ['bounds-mobile-ne-lng', 'bounds-mobile-ne-lat'], device: 'mobile' },
    ];

    boundsGroups.forEach(({ btn, sw, ne, device }) => {
        const button = document.getElementById(btn);
        button.addEventListener('click', () => {
            const bounds = editorMap.getBounds();
            document.getElementById(sw[0]).value = bounds.getWest().toFixed(6);
            document.getElementById(sw[1]).value = bounds.getSouth().toFixed(6);
            document.getElementById(ne[0]).value = bounds.getEast().toFixed(6);
            document.getElementById(ne[1]).value = bounds.getNorth().toFixed(6);
        });
        button.addEventListener('mouseenter', () => showOverlay(device));
        button.addEventListener('mouseleave', hideOverlays);
        [...sw, ...ne].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('focus', () => showOverlay(device));
            el.addEventListener('blur', hideOverlays);
        });
    });

    document.getElementById('save-chapter-btn').addEventListener('click', saveCurrentChapter);
    document.getElementById('save-all-btn').addEventListener('click', saveAllChanges);
    document.getElementById('delete-chapter-btn').addEventListener('click', deleteChapter);

    document.getElementById('export-btn').addEventListener('click', openExportModal);
    document.getElementById('copy-story-btn').addEventListener('click', () => copyTextarea('export-story-output'));
    document.getElementById('copy-map-btn').addEventListener('click', () => copyTextarea('export-map-output'));
    document.getElementById('download-story-btn').addEventListener('click', () => downloadFile(generateStoryConfigString(), 'storyConfig.js'));
    document.getElementById('download-map-btn').addEventListener('click', () => downloadFile(generateMapConfigString(), 'mapConfig.js'));

    document.querySelector('.close-modal').addEventListener('click', closeExportModal);
    document.getElementById('export-modal').addEventListener('click', (e) => {
        if (e.target.id === 'export-modal') closeExportModal();
    });

    setupCollapsibleSections();
    setupKeyboardShortcuts();
}

function initSidebarTabs() {
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sidebar-tab-content').forEach(c => c.style.display = 'none');
            tab.classList.add('active');
            document.querySelector(`.sidebar-tab-content[data-panel="${tab.dataset.tab}"]`).style.display = 'flex';
        });
    });
}

function initBasemapButtons() {
    document.querySelectorAll('input[name="basemap"]').forEach(radio => {
        radio.addEventListener('change', (e) => switchBasemap(e.target.value));
    });
}

function initUploadPanel() {
    const input = document.getElementById('layer-file-input');
    input.addEventListener('change', (e) => {
        [...e.target.files].forEach(f => handleFileUpload(f));
        input.value = '';
    });

    let mapDragCounter = 0;
    const mapContainer = document.getElementById('map-preview-container');
    const overlay = document.getElementById('map-drop-overlay');

    mapContainer.addEventListener('dragenter', (e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
            mapDragCounter++;
            overlay.style.display = 'flex';
        }
    });
    mapContainer.addEventListener('dragleave', () => {
        mapDragCounter--;
        if (mapDragCounter <= 0) { mapDragCounter = 0; overlay.style.display = 'none'; }
    });
    mapContainer.addEventListener('dragover', (e) => {
        if ([...e.dataTransfer.types].includes('Files')) e.preventDefault();
    });
    mapContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        mapDragCounter = 0;
        overlay.style.display = 'none';
        [...e.dataTransfer.files].forEach(f => handleFileUpload(f));
    });
}

// ─── Layer Upload ─────────────────────────────────────────────────────────────

function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function detectCategory(data) {
    const counts = {};
    (data.features || []).forEach(f => {
        const t = f?.geometry?.type || '';
        const key = t.includes('Polygon') ? 'polygon' : t.includes('LineString') ? 'line' : 'symbol';
        counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'symbol';
}

function handleFileUpload(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'tif' || ext === 'tiff') {
        handleRasterUpload(file);
    } else if (ext === 'kml') {
        handleKmlUpload(file);
    } else if (ext === 'geojson' || ext === 'json') {
        handleGeoJsonUpload(file);
    } else {
        showNotification(`Unsupported file type: .${ext}`, true);
    }
}

function registerLayerInActiveChapter(layerId) {
    if (activeChapterIndex === null) return;
    const ch = chapters[activeChapterIndex];
    if (!ch.layers) ch.layers = {};
    const entry = userLayers.find(l => l.id === layerId);
    ch.layers[layerId] = {
        visible: true,
        opacity: 1,
        color: entry ? defaultLayerColor(entry.category, entry.style) : '#0d6aff',
        strokeWidth: entry?.style?.strokeWidth ?? 2,
    };
    populateLayerToggles(ch);
}

function handleRasterUpload(file) {
    const id = uid();
    const layerId = `ul-${id}`;
    const sourceId = `us-${id}`;
    const name = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = (e) => {
        const blob = new Blob([e.target.result], { type: 'image/tiff' });
        const blobUrl = URL.createObjectURL(blob);
        const entry = { id: layerId, sourceId, name, filename: file.name, category: 'raster', blobUrl };
        userLayers.push(entry);
        withMap(() => addRasterLayerToMap(entry));
        registerLayerInActiveChapter(layerId);
        renderLayerList();
        showNotification(`"${name}" added`);
    };
    reader.readAsArrayBuffer(file);
}

function handleGeoJsonUpload(file) {
    const id = uid();
    const layerId = `ul-${id}`;
    const sourceId = `us-${id}`;
    const name = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = (e) => {
        let data;
        try { data = JSON.parse(e.target.result); } catch {
            showNotification('Invalid GeoJSON — could not parse file', true);
            return;
        }
        addVectorEntry(layerId, sourceId, name, file.name, data);
    };
    reader.readAsText(file);
}

function handleKmlUpload(file) {
    const id = uid();
    const layerId = `ul-${id}`;
    const sourceId = `us-${id}`;
    const name = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = (e) => {
        let data;
        try {
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(e.target.result, 'text/xml');
            data = toGeoJSON.kml(kmlDoc);
        } catch {
            showNotification('Could not parse KML file', true);
            return;
        }
        addVectorEntry(layerId, sourceId, name, file.name, data);
    };
    reader.readAsText(file);
}

function addVectorEntry(layerId, sourceId, name, filename, data) {
    const category = detectCategory(data);
    const defaultStyle = category === 'line'
        ? { strokeColor: '#0d6aff', strokeWidth: 2 }
        : category === 'polygon'
        ? { fillColor: '#0064ff', fillOpacity: 0.3, strokeColor: '#0d6aff', strokeWidth: 1 }
        : null;
    const entry = { id: layerId, sourceId, name, filename, category, data, style: defaultStyle };
    userLayers.push(entry);
    withMap(() => addVectorLayerToMap(entry));
    registerLayerInActiveChapter(layerId);
    renderLayerList();
    showNotification(`"${name}" added`);
}

function withMap(fn) {
    if (editorMap.loaded()) fn();
    else editorMap.once('load', fn);
}

function addRasterLayerToMap(entry) {
    if (!editorMap.getSource(entry.sourceId)) {
        editorMap.addSource(entry.sourceId, {
            type: 'raster',
            url: `cog://${entry.blobUrl}`,
            tileSize: 256,
        });
    }
    if (!editorMap.getLayer(entry.id)) {
        editorMap.addLayer({ id: entry.id, type: 'raster', source: entry.sourceId, paint: { 'raster-opacity': 1 } });
    }
}

function detectTextField(geojsonData) {
    const candidates = ['name', 'label', 'title', 'text', 'Name', 'LABEL', 'TITLE', 'TEXT'];
    const props = (geojsonData.features?.[0]?.properties) ?? {};
    for (const c of candidates) {
        if (props[c] !== undefined) return ['get', c];
    }
    for (const [key, val] of Object.entries(props)) {
        if (typeof val === 'string') return ['get', key];
    }
    return ['get', 'name'];
}

function addVectorLayerToMap(entry) {
    if (!editorMap.getSource(entry.sourceId)) {
        editorMap.addSource(entry.sourceId, { type: 'geojson', data: entry.data });
    }
    if (editorMap.getLayer(entry.id)) return;

    if (entry.category === 'line') {
        editorMap.addLayer({ id: entry.id, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
    } else if (entry.category === 'polygon') {
        const fillColor = hexToRgba(entry.style.fillColor, entry.style.fillOpacity);
        if (!editorMap.getLayer(`${entry.id}-fill`))
            editorMap.addLayer({ id: `${entry.id}-fill`, type: 'fill', source: entry.sourceId, paint: { 'fill-color': fillColor } });
        if (!editorMap.getLayer(`${entry.id}-outline`))
            editorMap.addLayer({ id: `${entry.id}-outline`, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
    } else if (entry.category === 'text') {
        const tf = detectTextField(entry.data);
        editorMap.addLayer({
            id: entry.id, type: 'symbol', source: entry.sourceId,
            layout: { 'text-field': tf, 'text-font': ['Open Sans Regular'], 'text-size': 14 },
            paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
        });
    } else if (entry.category === 'symbol') {
        editorMap.addLayer({ id: entry.id, type: 'circle', source: entry.sourceId, paint: { 'circle-color': '#ff6b6b', 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } });
    }
}

function removeUserLayer(layerId) {
    const index = userLayers.findIndex(l => l.id === layerId);
    if (index === -1) return;
    const entry = userLayers[index];

    getMapLayerIds(entry).forEach(lid => { if (editorMap.getLayer(lid)) editorMap.removeLayer(lid); });
    if (editorMap.getSource(entry.sourceId)) editorMap.removeSource(entry.sourceId);
    if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);

    userLayers.splice(index, 1);
    chapters.forEach(ch => { if (ch.layers) delete ch.layers[layerId]; });

    renderLayerList();
    if (activeChapterIndex !== null) populateLayerToggles(chapters[activeChapterIndex]);
}

function renderLayerList() {
    const container = document.getElementById('layer-list');
    container.innerHTML = '';
    if (userLayers.length === 0) {
        container.innerHTML = '<p class="layer-list-empty">No layers yet. Add a file or drop onto the map.</p>';
        return;
    }
    userLayers.forEach((layer, index) => container.appendChild(buildLayerListItem(layer, index)));
}

function buildLayerListItem(layer, index) {
    const item = document.createElement('div');
    item.className = 'layer-list-item';
    item.draggable = true;
    item.dataset.index = index;

    const handle = document.createElement('span');
    handle.className = 'layer-drag-handle';
    handle.textContent = '⋮⋮';

    const typeTag = document.createElement('span');
    typeTag.className = 'layer-type-tag';
    typeTag.textContent = layer.category[0].toUpperCase();

    const nameEl = document.createElement('span');
    nameEl.className = 'layer-list-name';
    nameEl.textContent = layer.name;
    nameEl.title = layer.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-file-btn';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeUserLayer(layer.id));

    item.append(handle, typeTag, nameEl, removeBtn);
    item.addEventListener('dragstart', handleLayerDragStart);
    item.addEventListener('dragover', handleLayerDragOver);
    item.addEventListener('drop', handleLayerDrop);
    item.addEventListener('dragend', handleLayerDragEnd);
    item.addEventListener('dragenter', handleLayerDragEnter);
    item.addEventListener('dragleave', handleLayerDragLeave);
    return item;
}

// ─── Layer List Drag & Drop ───────────────────────────────────────────────────

let layerDraggedIndex = null;

function handleLayerDragStart(e) {
    layerDraggedIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
}

function handleLayerDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
}

function handleLayerDragEnter(e) {
    e.stopPropagation();
    if (parseInt(e.currentTarget.dataset.index) !== layerDraggedIndex)
        e.currentTarget.classList.add('drag-over');
}

function handleLayerDragLeave(e) {
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

function handleLayerDrop(e) {
    e.stopPropagation();
    const dropIndex = parseInt(e.currentTarget.dataset.index);
    if (layerDraggedIndex !== null && layerDraggedIndex !== dropIndex) {
        const moved = userLayers.splice(layerDraggedIndex, 1)[0];
        userLayers.splice(dropIndex, 0, moved);
        syncLayerOrder();
        renderLayerList();
        if (activeChapterIndex !== null) populateLayerToggles(chapters[activeChapterIndex]);
    }
}

function handleLayerDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.layer-list-item').forEach(el => el.classList.remove('drag-over'));
    layerDraggedIndex = null;
}

function syncLayerOrder() {
    if (!editorMap) return;
    let topAnchor = undefined;
    for (let i = userLayers.length - 1; i >= 0; i--) {
        const ids = getMapLayerIds(userLayers[i]);
        ids.forEach(lid => {
            if (editorMap.getLayer(lid)) editorMap.moveLayer(lid, topAnchor);
        });
        topAnchor = ids[0];
    }
}

// ─── Chapter List ─────────────────────────────────────────────────────────────

function renderChaptersList() {
    const container = document.getElementById('chapters-list');
    container.innerHTML = '';

    chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = 'chapter-item' + (index === activeChapterIndex ? ' active' : '');
        item.draggable = true;
        item.dataset.index = index;
        item.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <div class="chapter-item-content">
                <span class="chapter-number">Chapter ${index + 1}</span>
                <h4>${chapter.title || 'Untitled'}</h4>
                <p>${chapter.description || 'No description'}</p>
            </div>
        `;
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('click', () => selectChapter(index));
        container.appendChild(item);
    });
}

function addNewChapter() {
    const newChapter = {
        id: `chapter-${Date.now()}`,
        title: 'New Chapter',
        description: 'Description for this chapter',
        center: editorMap.getCenter().toArray(),
        zoom: editorMap.getZoom(),
        pitch: editorMap.getPitch(),
        bearing: editorMap.getBearing(),
        duration: 2000,
        layers: {},
        image: null,
        alignment: 'center',
    };
    if (activeChapterIndex !== null) {
        chapters.splice(activeChapterIndex + 1, 0, newChapter);
        renderChaptersList();
        selectChapter(activeChapterIndex + 1);
    } else {
        chapters.push(newChapter);
        renderChaptersList();
        selectChapter(chapters.length - 1);
    }
}

function selectChapter(index) {
    activeChapterIndex = index;
    renderChaptersList();
    populateChapterForm(chapters[index]);

    const ch = chapters[index];
    if (ch.bounds) {
        editorMap.fitBounds(ch.bounds, { padding: 50, pitch: ch.pitch || 0, bearing: ch.bearing || 0, duration: 1000 });
    } else if (ch.center) {
        editorMap.flyTo({ center: ch.center, zoom: ch.zoom, pitch: ch.pitch || 0, bearing: ch.bearing || 0, duration: 1000 });
    }

    userLayers.forEach(layer => {
        const cfg = ch.layers?.[layer.id];
        const visible = cfg != null;
        getMapLayerIds(layer).forEach(lid => {
            if (editorMap.getLayer(lid)) editorMap.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none');
        });
        if (cfg) applyChapterLayerStyle(layer, cfg);
    });
}

function defaultLayerColor(category, style) {
    if (style?.strokeColor) return style.strokeColor;
    if (style?.fillColor) return style.fillColor;
    return { line: '#0d6aff', polygon: '#0064ff', symbol: '#ff6b6b', text: '#333333', raster: '#ffffff' }[category] || '#0d6aff';
}

function applyChapterLayerStyle(entry, cfg) {
    if (!editorMap || !cfg) return;
    const opacity = cfg.opacity ?? 1;
    const color = cfg.color ?? '#0d6aff';
    const strokeWidth = cfg.strokeWidth ?? 2;

    if (entry.category === 'raster') {
        if (editorMap.getLayer(entry.id)) editorMap.setPaintProperty(entry.id, 'raster-opacity', opacity);
    } else if (entry.category === 'line') {
        if (editorMap.getLayer(entry.id)) {
            editorMap.setPaintProperty(entry.id, 'line-color', color);
            editorMap.setPaintProperty(entry.id, 'line-width', strokeWidth);
            editorMap.setPaintProperty(entry.id, 'line-opacity', opacity);
        }
    } else if (entry.category === 'polygon') {
        if (editorMap.getLayer(`${entry.id}-fill`)) {
            editorMap.setPaintProperty(`${entry.id}-fill`, 'fill-color', color);
            editorMap.setPaintProperty(`${entry.id}-fill`, 'fill-opacity', opacity);
        }
        if (editorMap.getLayer(`${entry.id}-outline`)) {
            editorMap.setPaintProperty(`${entry.id}-outline`, 'line-color', color);
            editorMap.setPaintProperty(`${entry.id}-outline`, 'line-width', strokeWidth);
        }
    } else if (entry.category === 'symbol') {
        if (editorMap.getLayer(entry.id)) {
            editorMap.setPaintProperty(entry.id, 'circle-color', color);
            editorMap.setPaintProperty(entry.id, 'circle-opacity', opacity);
        }
    } else if (entry.category === 'text') {
        if (editorMap.getLayer(entry.id)) {
            editorMap.setPaintProperty(entry.id, 'text-color', color);
            editorMap.setPaintProperty(entry.id, 'text-opacity', opacity);
        }
    }
}

// ─── Chapter Form ─────────────────────────────────────────────────────────────

function populateChapterForm(chapter) {
    document.getElementById('no-chapter-selected').style.display = 'none';
    document.getElementById('chapter-form').style.display = 'block';

    const set = (id, val) => { document.getElementById(id).value = val ?? ''; };
    set('chapter-id', chapter.id);
    set('chapter-title', chapter.title);
    set('chapter-description', chapter.description);
    set('chapter-quote', chapter.quote);
    set('chapter-subtitle1', chapter.subtitle);
    set('chapter-subtitle2', chapter.subtitle2);
    set('chapter-year', chapter.year);
    set('chapter-population', chapter.population);
    set('chapter-image', chapter.image);
    set('chapter-image-caption', chapter.imageCaption);
    set('chapter-description-source', chapter.descriptionSource);
    set('chapter-quote-source', chapter.quoteSource);
    document.getElementById('chapter-alignment').value = chapter.alignment || 'center';
    set('chapter-button-text', chapter.buttonText);
    set('chapter-button-url', chapter.buttonUrl);

    if (chapter.bounds) {
        document.getElementById('view-type').value = 'bounds';
        document.getElementById('bounds-sw-lng').value = chapter.bounds[0].toFixed(6);
        document.getElementById('bounds-sw-lat').value = chapter.bounds[1].toFixed(6);
        document.getElementById('bounds-ne-lng').value = chapter.bounds[2].toFixed(6);
        document.getElementById('bounds-ne-lat').value = chapter.bounds[3].toFixed(6);

        const loadBounds = (key, prefix) => {
            if (chapter[key]) {
                document.getElementById(`${prefix}-sw-lng`).value = chapter[key][0].toFixed(6);
                document.getElementById(`${prefix}-sw-lat`).value = chapter[key][1].toFixed(6);
                document.getElementById(`${prefix}-ne-lng`).value = chapter[key][2].toFixed(6);
                document.getElementById(`${prefix}-ne-lat`).value = chapter[key][3].toFixed(6);
            } else {
                ['sw-lng', 'sw-lat', 'ne-lng', 'ne-lat'].forEach(s => { document.getElementById(`${prefix}-${s}`).value = ''; });
            }
        };
        loadBounds('boundsIpad', 'bounds-ipad');
        loadBounds('boundsIpadPortrait', 'bounds-ipad-portrait');
        loadBounds('boundsMobile', 'bounds-mobile');

        document.getElementById('center-zoom-inputs').style.display = 'none';
        document.getElementById('bounds-inputs').style.display = 'block';
    } else {
        document.getElementById('view-type').value = 'center-zoom';
        document.getElementById('chapter-center-lng').value = (chapter.center?.[0] ?? 0).toFixed(6);
        document.getElementById('chapter-center-lat').value = (chapter.center?.[1] ?? 0).toFixed(6);
        document.getElementById('chapter-zoom').value = (chapter.zoom ?? 2).toFixed(2);
        document.getElementById('center-zoom-inputs').style.display = 'block';
        document.getElementById('bounds-inputs').style.display = 'none';
    }

    set('chapter-pitch', chapter.pitch ?? 0);
    set('chapter-bearing', chapter.bearing ?? 0);
    set('chapter-duration', chapter.duration ?? 2000);

    populateLayerToggles(chapter);
}

function populateLayerToggles(chapter) {
    const container = document.getElementById('layer-toggles');
    container.innerHTML = '';

    // ── Add-layer row ───────────────────────────────────────────────────────────
    const available = userLayers.filter(l => !chapter.layers?.[l.id]);
    const addRow = document.createElement('div');
    addRow.className = 'chapter-layer-add-row';

    if (userLayers.length === 0) {
        addRow.innerHTML = '<p class="chapter-layer-empty">No layers uploaded yet — use the Layers tab.</p>';
    } else if (available.length > 0) {
        const sel = document.createElement('select');
        sel.className = 'chapter-layer-select';
        sel.innerHTML = '<option value="">Add a layer…</option>';
        available.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.name;
            sel.appendChild(opt);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-small btn-primary';
        addBtn.textContent = '+ Add';
        addBtn.addEventListener('click', () => {
            const layerId = sel.value;
            if (!layerId) return;
            const entry = userLayers.find(l => l.id === layerId);
            if (!entry) return;
            if (!chapter.layers) chapter.layers = {};
            chapter.layers[layerId] = {
                visible: true,
                opacity: 1,
                color: defaultLayerColor(entry.category, entry.style),
                strokeWidth: entry.style?.strokeWidth ?? 2,
            };
            getMapLayerIds(entry).forEach(lid => {
                if (editorMap.getLayer(lid)) editorMap.setLayoutProperty(lid, 'visibility', 'visible');
            });
            applyChapterLayerStyle(entry, chapter.layers[layerId]);
            populateLayerToggles(chapter);
        });

        addRow.append(sel, addBtn);
    } else {
        addRow.innerHTML = '<p class="chapter-layer-empty" style="color:#555">All uploaded layers are in this chapter.</p>';
    }
    container.appendChild(addRow);

    // ── Layer cards ─────────────────────────────────────────────────────────────
    const layerIds = Object.keys(chapter.layers || {});
    if (layerIds.length === 0) {
        const msg = document.createElement('p');
        msg.className = 'chapter-layer-empty';
        msg.textContent = 'No layers in this chapter yet.';
        container.appendChild(msg);
        return;
    }

    layerIds.forEach(layerId => {
        const entry = userLayers.find(l => l.id === layerId);
        if (!entry) return;
        const cfg = chapter.layers[layerId];

        const card = document.createElement('div');
        card.className = 'chapter-layer-card';

        // Header: name + remove
        const hdr = document.createElement('div');
        hdr.className = 'chapter-layer-card-header';

        const nameEl = document.createElement('span');
        nameEl.className = 'chapter-layer-card-name';
        nameEl.textContent = entry.name;
        nameEl.title = entry.name;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'chapter-layer-remove-btn';
        removeBtn.title = 'Remove from chapter';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            delete chapter.layers[layerId];
            getMapLayerIds(entry).forEach(lid => {
                if (editorMap.getLayer(lid)) editorMap.setLayoutProperty(lid, 'visibility', 'none');
            });
            populateLayerToggles(chapter);
        });

        hdr.append(nameEl, removeBtn);
        card.appendChild(hdr);

        // Controls row
        const ctrl = document.createElement('div');
        ctrl.className = 'chapter-layer-controls';

        // Color (not for raster)
        if (entry.category !== 'raster') {
            const colorBox = document.createElement('div');
            colorBox.className = 'chapter-layer-ctrl-item';
            const colorLbl = document.createElement('span');
            colorLbl.className = 'chapter-layer-ctrl-label';
            colorLbl.textContent = entry.category === 'polygon' ? 'Fill' : 'Color';
            const colorPicker = document.createElement('input');
            colorPicker.type = 'color';
            colorPicker.className = 'chapter-layer-color';
            colorPicker.value = cfg.color || '#0d6aff';
            colorPicker.addEventListener('input', e => {
                cfg.color = e.target.value;
                applyChapterLayerStyle(entry, cfg);
            });
            colorBox.append(colorLbl, colorPicker);
            ctrl.appendChild(colorBox);
        }

        // Opacity
        const opBox = document.createElement('div');
        opBox.className = 'chapter-layer-ctrl-item chapter-layer-opacity-wrap';
        const opLbl = document.createElement('span');
        opLbl.className = 'chapter-layer-ctrl-label';
        opLbl.textContent = 'Opacity';
        const opSlider = document.createElement('input');
        opSlider.type = 'range';
        opSlider.className = 'opacity-slider';
        opSlider.min = '0'; opSlider.max = '1'; opSlider.step = '0.05';
        opSlider.value = cfg.opacity ?? 1;
        const opValEl = document.createElement('span');
        opValEl.className = 'chapter-layer-opacity-val';
        opValEl.textContent = Math.round((cfg.opacity ?? 1) * 100) + '%';
        opSlider.addEventListener('input', e => {
            cfg.opacity = parseFloat(e.target.value);
            opValEl.textContent = Math.round(cfg.opacity * 100) + '%';
            applyChapterLayerStyle(entry, cfg);
        });
        opBox.append(opLbl, opSlider, opValEl);
        ctrl.appendChild(opBox);

        // Stroke width (line + polygon)
        if (entry.category === 'line' || entry.category === 'polygon') {
            const wBox = document.createElement('div');
            wBox.className = 'chapter-layer-ctrl-item';
            const wLbl = document.createElement('span');
            wLbl.className = 'chapter-layer-ctrl-label';
            wLbl.textContent = 'Width';
            const wInput = document.createElement('input');
            wInput.type = 'number';
            wInput.className = 'chapter-layer-width';
            wInput.min = '0.5'; wInput.max = '20'; wInput.step = '0.5';
            wInput.value = cfg.strokeWidth ?? 2;
            const wUnit = document.createElement('span');
            wUnit.className = 'chapter-layer-unit';
            wUnit.textContent = 'px';
            wInput.addEventListener('input', e => {
                cfg.strokeWidth = parseFloat(e.target.value) || 1;
                applyChapterLayerStyle(entry, cfg);
            });
            wBox.append(wLbl, wInput, wUnit);
            ctrl.appendChild(wBox);
        }

        card.appendChild(ctrl);
        container.appendChild(card);
    });
}

function captureCurrentView() {
    if (activeChapterIndex === null) return;
    if (document.getElementById('view-type').value === 'bounds') {
        const b = editorMap.getBounds();
        document.getElementById('bounds-sw-lng').value = b.getWest().toFixed(6);
        document.getElementById('bounds-sw-lat').value = b.getSouth().toFixed(6);
        document.getElementById('bounds-ne-lng').value = b.getEast().toFixed(6);
        document.getElementById('bounds-ne-lat').value = b.getNorth().toFixed(6);
    } else {
        const c = editorMap.getCenter();
        document.getElementById('chapter-center-lng').value = c.lng.toFixed(6);
        document.getElementById('chapter-center-lat').value = c.lat.toFixed(6);
        document.getElementById('chapter-zoom').value = editorMap.getZoom().toFixed(2);
    }
    document.getElementById('chapter-pitch').value = Math.round(editorMap.getPitch());
    document.getElementById('chapter-bearing').value = Math.round(editorMap.getBearing());
}

function saveCurrentChapter() {
    if (activeChapterIndex === null) return;
    const ch = chapters[activeChapterIndex];
    const get = (id) => document.getElementById(id).value;

    ch.id = get('chapter-id');
    ch.title = get('chapter-title');
    ch.description = get('chapter-description');
    ch.quote = get('chapter-quote') || null;
    ch.subtitle = get('chapter-subtitle1') || null;
    ch.subtitle2 = get('chapter-subtitle2') || null;
    ch.year = get('chapter-year') || null;
    ch.population = get('chapter-population') || null;
    ch.image = get('chapter-image') || null;
    ch.imageCaption = get('chapter-image-caption') || null;
    ch.descriptionSource = get('chapter-description-source') || null;
    ch.quoteSource = get('chapter-quote-source') || null;
    ch.alignment = get('chapter-alignment');
    ch.buttonText = get('chapter-button-text') || null;
    ch.buttonUrl = get('chapter-button-url') || null;
    ch.pitch = parseInt(get('chapter-pitch')) || 0;
    ch.bearing = parseInt(get('chapter-bearing')) || 0;
    ch.duration = parseInt(get('chapter-duration')) || 2000;

    if (get('view-type') === 'bounds') {
        ch.bounds = ['bounds-sw-lng', 'bounds-sw-lat', 'bounds-ne-lng', 'bounds-ne-lat'].map(id => parseFloat(get(id)));
        const saveBounds = (key, prefix) => {
            const vals = ['sw-lng', 'sw-lat', 'ne-lng', 'ne-lat'].map(s => get(`${prefix}-${s}`));
            if (vals.every(v => v)) ch[key] = vals.map(parseFloat);
            else delete ch[key];
        };
        saveBounds('boundsIpad', 'bounds-ipad');
        saveBounds('boundsIpadPortrait', 'bounds-ipad-portrait');
        saveBounds('boundsMobile', 'bounds-mobile');
        delete ch.center; delete ch.zoom;
    } else {
        ch.center = [parseFloat(get('chapter-center-lng')), parseFloat(get('chapter-center-lat'))];
        ch.zoom = parseFloat(get('chapter-zoom'));
        delete ch.bounds; delete ch.boundsIpad; delete ch.boundsIpadPortrait; delete ch.boundsMobile;
    }

    // ch.layers is maintained live by the chapter layers UI — no DOM re-read needed

    renderChaptersList();
    showNotification('Chapter saved!');
}

function saveAllChanges() {
    if (activeChapterIndex !== null) saveCurrentChapter();
    // If cloud module is loaded, trigger cloud save; otherwise fall back to local notification
    if (typeof cloudSave === 'function') {
        cloudSave();
    } else {
        showNotification('All changes saved — use Export to download configs.');
    }
}

// Expose config generators so editor-cloud.js can read them
window._getStoryConfigJSON = () => {
    const exportChapters = chapters.map(ch => {
        const expandedLayers = {};
        Object.entries(ch.layers || {}).forEach(([layerId, state]) => {
            const entry = userLayers.find(l => l.id === layerId);
            if (entry?.category === 'polygon') {
                expandedLayers[`${layerId}-fill`] = { visible: state.visible, opacity: state.opacity, color: state.color };
                expandedLayers[`${layerId}-outline`] = { visible: state.visible, opacity: 1, color: state.color, strokeWidth: state.strokeWidth };
            } else {
                expandedLayers[layerId] = state;
            }
        });
        return { ...ch, layers: expandedLayers };
    });
    return { chapters: exportChapters };
};

window._getMapConfigJSON = () => {
    const sources = {};
    const layers = [];
    userLayers.forEach(entry => {
        if (entry.category === 'raster') {
            sources[entry.sourceId] = { type: 'raster', url: `cog://./datasets/geotiff/${entry.filename}`, tileSize: 256 };
            layers.push({ id: entry.id, type: 'raster', source: entry.sourceId, paint: { 'raster-opacity': 1 } });
        } else {
            sources[entry.sourceId] = { type: 'geojson', data: entry.data };
            if (entry.category === 'line') {
                layers.push({ id: entry.id, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
            } else if (entry.category === 'polygon') {
                layers.push({ id: `${entry.id}-fill`, type: 'fill', source: entry.sourceId, paint: { 'fill-color': hexToRgba(entry.style.fillColor, entry.style.fillOpacity) } });
                layers.push({ id: `${entry.id}-outline`, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
            } else if (entry.category === 'text') {
                layers.push({ id: entry.id, type: 'symbol', source: entry.sourceId, layout: { 'text-field': detectTextField(entry.data), 'text-font': ['Open Sans Regular'], 'text-size': 14 }, paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } });
            } else if (entry.category === 'symbol') {
                layers.push({ id: entry.id, type: 'circle', source: entry.sourceId, paint: { 'circle-color': '#ff6b6b', 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } });
            }
        }
    });
    const view = editorMap ? editorMap.getCenter().toArray() : mapConfig.initialView.center;
    const zoom = editorMap ? editorMap.getZoom() : mapConfig.initialView.zoom;
    return { initialView: { center: view, zoom }, defaultBasemap: currentBasemap, basemaps: mapConfig.basemaps, sources, layers };
};

function deleteChapter() {
    if (activeChapterIndex === null) return;
    if (confirm('Delete this chapter?')) {
        chapters.splice(activeChapterIndex, 1);
        activeChapterIndex = null;
        document.getElementById('no-chapter-selected').style.display = 'flex';
        document.getElementById('chapter-form').style.display = 'none';
        renderChaptersList();
    }
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

let draggedElement = null;
let draggedIndex = null;

function handleDragStart(e) {
    draggedElement = e.currentTarget;
    draggedIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (e.currentTarget !== draggedElement) e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

function handleDrop(e) {
    e.stopPropagation();
    const dropIndex = parseInt(e.currentTarget.dataset.index);
    if (draggedIndex !== dropIndex) {
        const moved = chapters.splice(draggedIndex, 1)[0];
        chapters.splice(dropIndex, 0, moved);
        if (activeChapterIndex === draggedIndex) activeChapterIndex = dropIndex;
        else if (draggedIndex < activeChapterIndex && dropIndex >= activeChapterIndex) activeChapterIndex--;
        else if (draggedIndex > activeChapterIndex && dropIndex <= activeChapterIndex) activeChapterIndex++;
        renderChaptersList();
    }
    return false;
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('drag-over'));
}

// ─── Collapsible Sections & Shortcuts ────────────────────────────────────────

function setupCollapsibleSections() {
    document.addEventListener('click', (e) => {
        const header = e.target.classList.contains('editor-section-header') ? e.target
            : e.target.parentElement?.classList.contains('editor-section-header') ? e.target.parentElement : null;
        if (header) header.parentElement.classList.toggle('collapsed');
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveAllChanges();
        }
    });
}

// ─── Export ───────────────────────────────────────────────────────────────────

function openExportModal() {
    if (activeChapterIndex !== null) saveCurrentChapter();
    document.getElementById('export-story-output').value = generateStoryConfigString();
    document.getElementById('export-map-output').value = generateMapConfigString();
    document.getElementById('export-modal').classList.add('active');
}

function closeExportModal() {
    document.getElementById('export-modal').classList.remove('active');
}

function generateStoryConfigString() {
    // Expand polygon entries to their actual sub-layer IDs so the story viewer can use them directly
    const exportChapters = chapters.map(ch => {
        const expandedLayers = {};
        Object.entries(ch.layers || {}).forEach(([layerId, state]) => {
            const entry = userLayers.find(l => l.id === layerId);
            if (entry?.category === 'polygon') {
                expandedLayers[`${layerId}-fill`] = { visible: state.visible, opacity: state.opacity, color: state.color };
                expandedLayers[`${layerId}-outline`] = { visible: state.visible, opacity: 1, color: state.color, strokeWidth: state.strokeWidth };
            } else {
                expandedLayers[layerId] = state;
            }
        });
        return { ...ch, layers: expandedLayers };
    });

    return `// Story Map Configuration
// Generated on ${new Date().toLocaleString()}

const storyConfig = ${JSON.stringify({ chapters: exportChapters }, null, 2)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = storyConfig;
}`;
}

function generateMapConfigString() {
    const sources = {};
    const layers = [];

    userLayers.forEach(entry => {
        if (entry.category === 'raster') {
            sources[entry.sourceId] = { type: 'raster', url: `cog://./datasets/geotiff/${entry.filename}`, tileSize: 256 };
            layers.push({ id: entry.id, type: 'raster', source: entry.sourceId, paint: { 'raster-opacity': 1 } });
        } else {
            sources[entry.sourceId] = { type: 'geojson', data: entry.data };
            if (entry.category === 'line') {
                layers.push({ id: entry.id, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
            } else if (entry.category === 'polygon') {
                layers.push({ id: `${entry.id}-fill`, type: 'fill', source: entry.sourceId, paint: { 'fill-color': hexToRgba(entry.style.fillColor, entry.style.fillOpacity) } });
                layers.push({ id: `${entry.id}-outline`, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
            } else if (entry.category === 'text') {
                layers.push({ id: entry.id, type: 'symbol', source: entry.sourceId, layout: { 'text-field': detectTextField(entry.data), 'text-font': ['Open Sans Regular'], 'text-size': 14 }, paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } });
            } else if (entry.category === 'symbol') {
                layers.push({ id: entry.id, type: 'circle', source: entry.sourceId, paint: { 'circle-color': '#ff6b6b', 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } });
            }
        }
    });

    const view = editorMap ? editorMap.getCenter().toArray() : mapConfig.initialView.center;
    const zoom = editorMap ? editorMap.getZoom() : mapConfig.initialView.zoom;

    const config = {
        initialView: { center: view, zoom },
        defaultBasemap: currentBasemap,
        basemaps: mapConfig.basemaps,
        sources,
        layers,
    };

    return `// Map Configuration
// Generated on ${new Date().toLocaleString()}
// Note: update raster source paths before deploying

const mapConfig = ${JSON.stringify(config, null, 2)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = mapConfig;
}`;
}

function copyTextarea(id) {
    const ta = document.getElementById(id);
    ta.select();
    document.execCommand('copy');
    showNotification('Copied to clipboard!');
}

function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Notifications ────────────────────────────────────────────────────────────

function showNotification(message, isError = false) {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = message;
    el.style.cssText = `position:fixed;top:20px;right:20px;background:${isError ? '#dc3545' : '#28a745'};color:white;padding:1rem 1.5rem;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:10000;font-weight:500;animation:slideIn .3s ease`;
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.animation = 'slideOut .3s ease';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

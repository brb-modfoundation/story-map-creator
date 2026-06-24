// Story Map Editor

maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);

// ─── State ────────────────────────────────────────────────────────────────────

let chapters = [...storyConfig.chapters];
let activeChapterIndex = null;
let editorMap = null;
let currentBasemap = mapConfig.defaultBasemap;
let userLayers = [];
let _layersRestored = false;

document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    initializeUI();
    renderChaptersList();
    // If editor-cloud.js is not present (standalone mode), mark layers restored immediately
    setTimeout(() => { if (!window._cloudActive) window._markLayersRestored?.(); }, 500);
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
            glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
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

    // Hide the map loading overlay once layers are restored AND the map is idle
    editorMap.on('idle', () => {
        if (_layersRestored) hideMapLoadingOverlay();
    });
}

function hideMapLoadingOverlay() {
    const el = document.getElementById('map-loading-overlay');
    if (el) el.style.display = 'none';
}

// Called by editor-cloud.js after all layers are restored and first chapter selected
window._markLayersRestored = () => {
    _layersRestored = true;
    // If the map is already idle, hide immediately
    if (editorMap && !editorMap.isMoving() && !editorMap.isZooming() && !editorMap.isRotating()) {
        hideMapLoadingOverlay();
    }
};

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

    document.querySelectorAll('[data-add-type]').forEach(btn => {
        btn.addEventListener('click', () => addChapter(btn.dataset.addType));
    });
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

    document.getElementById('save-all-btn').addEventListener('click', saveAllChanges);

    document.getElementById('export-btn').addEventListener('click', openExportModal);
    document.getElementById('copy-story-btn')?.addEventListener('click', () => copyTextarea('export-story-output'));
    document.getElementById('copy-map-btn')?.addEventListener('click', () => copyTextarea('export-map-output'));
    document.getElementById('download-story-btn')?.addEventListener('click', () => downloadFile(generateStoryConfigString(), 'storyConfig.js'));
    document.getElementById('download-map-btn')?.addEventListener('click', () => downloadFile(generateMapConfigString(), 'mapConfig.js'));

    document.querySelector('.close-modal').addEventListener('click', closeExportModal);
    document.getElementById('export-modal').addEventListener('click', (e) => {
        if (e.target.id === 'export-modal') closeExportModal();
    });

    setupCollapsibleSections();
    setupKeyboardShortcuts();
    initChapterImageUpload();
    initChapterLegendUpload();
}

function updateImageChapterPreview(url) {
    const img   = document.getElementById('image-chapter-preview-img');
    const empty = document.getElementById('image-chapter-preview-empty');
    if (url) {
        img.src = url;
        img.style.display = 'block';
        empty.style.display = 'none';
    } else {
        img.src = '';
        img.style.display = 'none';
        empty.style.display = '';
    }
}

function initChapterImageUpload() {
    console.log('[initChapterImageUpload] called');
    const fileInput = document.getElementById('chapter-image-file');
    console.log('[initChapterImageUpload] fileInput element:', fileInput);
    const hiddenUrl = document.getElementById('chapter-image');
    const preview   = document.getElementById('chapter-image-preview');
    const thumb     = document.getElementById('chapter-image-thumb');
    const clearBtn  = document.getElementById('chapter-image-clear');

    fileInput.addEventListener('change', (e) => {
        console.log('[imageUpload] file input changed, files:', e.target.files.length);
        const file = e.target.files[0];
        if (!file) { console.log('[imageUpload] no file selected'); return; }
        console.log('[imageUpload] file selected:', file.name, file.type, file.size);
        fileInput.value = '';
        console.log('[imageUpload] opening crop modal');
        openCropModal(file, async (croppedBlob) => {
            console.log('[imageUpload] crop applied, blob size:', croppedBlob.size);
            const croppedFile = new File([croppedBlob], file.name, { type: 'image/jpeg' });
            const localUrl = URL.createObjectURL(croppedBlob);
            thumb.src = localUrl;
            preview.style.display = 'block';
            hiddenUrl.value = localUrl;
            updateImageChapterPreview(localUrl);
            console.log('[imageUpload] local preview set, uploading to cloud…');

            const remoteUrl = await window._cloudUploadDataset?.(croppedFile);
            console.log('[imageUpload] cloud upload result:', remoteUrl);
            if (remoteUrl) {
                hiddenUrl.value = remoteUrl;
                thumb.src = remoteUrl;
                updateImageChapterPreview(remoteUrl);
            }
        });
    });

    clearBtn.addEventListener('click', () => {
        hiddenUrl.value = '';
        thumb.src = '';
        preview.style.display = 'none';
        fileInput.value = '';
        updateImageChapterPreview(null);
    });
}

function initChapterLegendUpload() {
    const fileInput = document.getElementById('chapter-legend-file');
    const hiddenUrl = document.getElementById('chapter-legend');
    const preview   = document.getElementById('chapter-legend-preview');
    const thumb     = document.getElementById('chapter-legend-thumb');
    const clearBtn  = document.getElementById('chapter-legend-clear');

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        fileInput.value = '';
        const localUrl = URL.createObjectURL(file);
        thumb.src = localUrl;
        preview.style.display = 'block';
        hiddenUrl.value = localUrl;

        const remoteUrl = await window._cloudUploadDataset?.(file);
        if (remoteUrl) { hiddenUrl.value = remoteUrl; thumb.src = remoteUrl; }
    });

    clearBtn.addEventListener('click', () => {
        hiddenUrl.value = '';
        thumb.src = '';
        preview.style.display = 'none';
        fileInput.value = '';
    });
}

function openCropModal(file, onApply) {
    console.log('[cropModal] opening for file:', file.name);
    const RATIO = 16 / 9;
    const modal   = document.getElementById('image-crop-modal');
    const canvas  = document.getElementById('image-crop-canvas');
    const box     = document.getElementById('image-crop-box');
    const handle  = document.getElementById('crop-handle-br');
    const applyBtn  = document.getElementById('image-crop-apply');
    const cancelBtn = document.getElementById('image-crop-cancel');
    console.log('[cropModal] elements — modal:', !!modal, 'canvas:', !!canvas, 'box:', !!box, 'applyBtn:', !!applyBtn);
    const ctx = canvas.getContext('2d');

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => { console.log('[cropModal] file read as DataURL, setting img.src'); img.src = ev.target.result; };
    img.onload = () => {
        console.log('[cropModal] image loaded, natural size:', img.naturalWidth, 'x', img.naturalHeight);
        // Scale image to fit within 75vw × 70vh
        const maxW = Math.min(window.innerWidth * 0.75, 1200);
        const maxH = Math.min(window.innerHeight * 0.70, 800);
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        canvas.width  = Math.round(img.naturalWidth  * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Init crop box: max 16:9 that fits the canvas, centered
        let bw = canvas.width;
        let bh = Math.round(bw / RATIO);
        if (bh > canvas.height) { bh = canvas.height; bw = Math.round(bh * RATIO); }
        let bx = Math.round((canvas.width  - bw) / 2);
        let by = Math.round((canvas.height - bh) / 2);

        const rect = canvas.getBoundingClientRect();
        function applyBox() {
            box.style.left   = bx + 'px';
            box.style.top    = by + 'px';
            box.style.width  = bw + 'px';
            box.style.height = bh + 'px';
        }
        applyBox();
        modal.classList.add('open');

        // Drag to move
        let dragging = false, dragOffX = 0, dragOffY = 0;
        box.addEventListener('mousedown', (e) => {
            if (e.target === handle) return;
            dragging = true;
            const r = canvas.getBoundingClientRect();
            dragOffX = e.clientX - r.left - bx;
            dragOffY = e.clientY - r.top  - by;
            e.preventDefault();
        });

        // Drag to resize (BR handle, locked 16:9)
        let resizing = false;
        handle.addEventListener('mousedown', (e) => {
            resizing = true;
            e.preventDefault();
            e.stopPropagation();
        });

        function onMouseMove(e) {
            const r = canvas.getBoundingClientRect();
            const mx = e.clientX - r.left;
            const my = e.clientY - r.top;
            if (dragging) {
                bx = Math.max(0, Math.min(canvas.width  - bw, mx - dragOffX));
                by = Math.max(0, Math.min(canvas.height - bh, my - dragOffY));
                applyBox();
            }
            if (resizing) {
                let nw = Math.max(80, mx - bx);
                let nh = Math.round(nw / RATIO);
                if (bx + nw > canvas.width)  { nw = canvas.width  - bx; nh = Math.round(nw / RATIO); }
                if (by + nh > canvas.height) { nh = canvas.height - by; nw = Math.round(nh * RATIO); }
                bw = Math.round(nw);
                bh = Math.round(nh);
                applyBox();
            }
        }
        function onMouseUp() { dragging = false; resizing = false; }
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup',   onMouseUp);

        function close() {
            modal.classList.remove('open');
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup',   onMouseUp);
            applyBtn.onclick  = null;
            cancelBtn.onclick = null;
        }

        applyBtn.onclick = () => {
            // Crop at original image resolution
            const offscreen = document.createElement('canvas');
            offscreen.width  = 1920;
            offscreen.height = 1080;
            const oc = offscreen.getContext('2d');
            const sx = (bx / canvas.width)  * img.naturalWidth;
            const sy = (by / canvas.height) * img.naturalHeight;
            const sw = (bw / canvas.width)  * img.naturalWidth;
            const sh = (bh / canvas.height) * img.naturalHeight;
            oc.drawImage(img, sx, sy, sw, sh, 0, 0, 1920, 1080);
            offscreen.toBlob((blob) => { close(); onApply(blob); }, 'image/jpeg', 0.92);
        };

        cancelBtn.onclick = close;
    };
    reader.readAsDataURL(file);
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

    const labelsInput = document.getElementById('labels-file-input');
    labelsInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileUpload(file, { forceCategory: 'labels' });
        labelsInput.value = '';
    });

    const viewpointsInput = document.getElementById('viewpoints-file-input');
    viewpointsInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileUpload(file, { forceCategory: 'viewpoints' });
        viewpointsInput.value = '';
    });
}

// ─── Layer Upload ─────────────────────────────────────────────────────────────

function idsFromFilename(filename) {
    const base = (filename || 'file')
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'file';
    let candidate = `layer-${base}`;
    let n = 1;
    while (userLayers.some(l => l.id === candidate)) candidate = `layer-${base}-${n++}`;
    return { layerId: candidate, sourceId: candidate.replace('layer-', 'source-') };
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

function handleFileUpload(file, opts = {}) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'tif' || ext === 'tiff') {
        handleRasterUpload(file);
    } else if (ext === 'kml') {
        handleKmlUpload(file, opts);
    } else if (ext === 'geojson' || ext === 'json') {
        handleGeoJsonUpload(file, opts);
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
        color: entry?.style?.fillColor ?? (entry ? defaultLayerColor(entry.category, entry.style) : '#0d6aff'),
        strokeColor: entry?.style?.strokeColor ?? '#0d6aff',
        strokeWidth: entry?.style?.strokeWidth ?? 2,
    };
    populateLayerToggles(ch);
}

function handleRasterUpload(file) {
    const { layerId, sourceId } = idsFromFilename(file.name);
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

        // Upload original file to cloud storage (if cloud module is active)
        if (window._cloudUploadDataset) {
            showNotification(`Uploading "${name}" to cloud… (large rasters can take a while)`);
            window._cloudUploadDataset(file)
                .then(url => { if (url) { entry.remoteUrl = url; showNotification(`"${name}" stored in cloud ✓`); } })
                .catch(err => showNotification(`Cloud upload failed for "${name}" — raster will NOT appear in the published map`, true));
        }
    };
    reader.readAsArrayBuffer(file);
}

function handleGeoJsonUpload(file, opts = {}) {
    const { layerId, sourceId } = idsFromFilename(file.name);
    const name = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = (e) => {
        let data;
        try { data = JSON.parse(e.target.result); } catch {
            showNotification('Invalid GeoJSON — could not parse file', true);
            return;
        }
        addVectorEntry(layerId, sourceId, name, file.name, data, opts);
    };
    reader.readAsText(file);
}

function handleKmlUpload(file, opts = {}) {
    const { layerId, sourceId } = idsFromFilename(file.name);
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
        addVectorEntry(layerId, sourceId, name, file.name, data, opts);
    };
    reader.readAsText(file);
}

function addVectorEntry(layerId, sourceId, name, filename, data, opts = {}) {
    const category = opts.forceCategory || detectCategory(data);
    const defaultStyle = category === 'line'
        ? { strokeColor: '#0d6aff', strokeWidth: 2 }
        : category === 'polygon'
        ? { fillColor: '#0064ff', fillOpacity: 0.3, strokeColor: '#0d6aff', strokeWidth: 1 }
        : null;
    const entry = { id: layerId, sourceId, name, filename, category, data, style: defaultStyle };
    userLayers.push(entry);
    withMap(() => addVectorLayerToMap(entry));
    if (category !== 'labels' && category !== 'viewpoints') registerLayerInActiveChapter(layerId);
    renderLayerList();
    showNotification(`"${name}" added`);

    // Upload normalised GeoJSON to cloud storage (if cloud module is active)
    if (window._cloudUploadDataset) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/geo+json' });
        const f = new File([blob], filename.replace(/\.[^.]+$/, '') + '.geojson', { type: 'application/geo+json' });
        window._cloudUploadDataset(f)
            .then(url => { if (url) { entry.remoteUrl = url; showNotification(`"${name}" stored in cloud ✓`); } })
            .catch(err => showNotification(`Cloud upload failed for "${name}" — layer will be embedded on save`, true));
    }
}

function withMap(fn) {
    if (editorMap.isStyleLoaded()) {
        console.debug('[withMap] map ready, calling immediately');
        fn();
    } else {
        console.debug('[withMap] map not ready, deferring to load event');
        editorMap.once('load', fn);
    }
}

function addRasterLayerToMap(entry) {
    console.log('[addRasterLayerToMap] entry:', entry.id, '| blobUrl:', entry.blobUrl, '| remoteUrl:', entry.remoteUrl);
    try {
        if (!editorMap.getSource(entry.sourceId)) {
            const url = `cog://${entry.blobUrl || entry.remoteUrl}`;
            console.log('[addRasterLayerToMap] adding source', entry.sourceId, 'with url', url);
            editorMap.addSource(entry.sourceId, { type: 'raster', url, tileSize: 256 });
        } else {
            console.log('[addRasterLayerToMap] source already exists:', entry.sourceId);
        }
        if (!editorMap.getLayer(entry.id)) {
            console.log('[addRasterLayerToMap] adding layer', entry.id);
            editorMap.addLayer({ id: entry.id, type: 'raster', source: entry.sourceId, paint: { 'raster-opacity': 1 } });
            console.log('[addRasterLayerToMap] layer added OK:', entry.id);
        } else {
            console.log('[addRasterLayerToMap] layer already exists:', entry.id);
        }
    } catch (err) {
        console.error('[addRasterLayerToMap] FAILED for', entry.id, err);
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
    console.log('[addVectorLayerToMap] entry:', entry.id, 'category:', entry.category, 'style:', entry.style, 'data features:', entry.data?.features?.length);
    try {
    if (!editorMap.getSource(entry.sourceId)) {
        console.log('[addVectorLayerToMap] adding source', entry.sourceId);
        editorMap.addSource(entry.sourceId, { type: 'geojson', data: entry.data });
    } else {
        console.log('[addVectorLayerToMap] source already exists:', entry.sourceId);
    }
    if (editorMap.getLayer(entry.id)) {
        console.log('[addVectorLayerToMap] base layer already exists, returning:', entry.id);
        return;
    }

    if (entry.category === 'line') {
        console.log('[addVectorLayerToMap] adding line layer', entry.id);
        editorMap.addLayer({ id: entry.id, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
        console.log('[addVectorLayerToMap] line layer added OK:', entry.id);
    } else if (entry.category === 'polygon') {
        const fillColor = hexToRgba(entry.style.fillColor, entry.style.fillOpacity);
        console.log('[addVectorLayerToMap] polygon fillColor:', fillColor, 'style:', entry.style);
        if (!editorMap.getLayer(`${entry.id}-fill`)) {
            console.log('[addVectorLayerToMap] adding fill layer', `${entry.id}-fill`);
            editorMap.addLayer({ id: `${entry.id}-fill`, type: 'fill', source: entry.sourceId, paint: { 'fill-color': fillColor } });
            console.log('[addVectorLayerToMap] fill layer added OK');
        } else {
            console.log('[addVectorLayerToMap] fill layer already exists:', `${entry.id}-fill`);
        }
        if (!editorMap.getLayer(`${entry.id}-outline`)) {
            console.log('[addVectorLayerToMap] adding outline layer', `${entry.id}-outline`);
            editorMap.addLayer({ id: `${entry.id}-outline`, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
            console.log('[addVectorLayerToMap] outline layer added OK');
        } else {
            console.log('[addVectorLayerToMap] outline layer already exists:', `${entry.id}-outline`);
        }
    } else if (entry.category === 'labels') {
        editorMap.addLayer({
            id: entry.id, type: 'symbol', source: entry.sourceId,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Bold'],
                'text-size': 15,
                'text-anchor': 'left',
                'text-allow-overlap': true,
                'text-transform': 'uppercase',
                'text-offset': [0.5, 0]
            },
            paint: { 'text-color': '#0d6aff', 'text-halo-color': '#f9ea46', 'text-halo-width': 6 },
        });
    } else if (entry.category === 'viewpoints') {
        const doAdd = () => {
            if (editorMap.getLayer(entry.id)) return;
            try {
                editorMap.addLayer({
                    id: entry.id, type: 'symbol', source: entry.sourceId,
                    layout: {
                        'icon-image': 'viewpoint-icon',
                        'icon-size': 0.15,
                        'icon-rotation-alignment': 'map',
                        'icon-rotate': ['get', 'angle'],
                        'icon-allow-overlap': true,
                    },
                    paint: { 'icon-opacity': 1 },
                });
            } catch (e) {
                console.error('[addVectorLayerToMap] viewpoints addLayer failed:', e);
            }
        };
        const afterAdd = () => {
            if (activeChapterIndex !== null && editorMap.getLayer(entry.id)) {
                editorMap.setFilter(entry.id, ['==', ['to-number', ['get', 'chapter']], activeChapterIndex]);
                editorMap.setLayoutProperty(entry.id, 'visibility', 'visible');
            }
        };
        if (editorMap.hasImage('viewpoint-icon')) {
            doAdd();
            afterAdd();
        } else {
            const img = new Image();
            img.onload = () => {
                console.log('[addVectorLayerToMap] viewpoint.png loaded, adding image + layer');
                if (!editorMap.hasImage('viewpoint-icon')) editorMap.addImage('viewpoint-icon', img);
                doAdd();
                afterAdd();
            };
            img.onerror = (e) => console.error('[addVectorLayerToMap] viewpoint.png failed to load', e);
            img.src = '../images/viewpoint.png';
        }
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
    } catch (err) {
        console.error('[addVectorLayerToMap] FAILED for', entry.id, 'category:', entry.category, err);
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
    const labelsContainer = document.getElementById('labels-layer-list');
    const viewpointsContainer = document.getElementById('viewpoints-layer-list');

    const regularLayers    = userLayers.filter(l => l.category !== 'labels' && l.category !== 'viewpoints');
    const labelLayers      = userLayers.filter(l => l.category === 'labels');
    const viewpointLayers  = userLayers.filter(l => l.category === 'viewpoints');

    container.innerHTML = '';
    if (regularLayers.length === 0) {
        container.innerHTML = '<p class="layer-list-empty">No layers yet. Add a file or drop onto the map.</p>';
    } else {
        regularLayers.forEach(layer => {
            const index = userLayers.indexOf(layer);
            container.appendChild(buildLayerListItem(layer, index));
        });
    }

    if (labelsContainer) {
        labelsContainer.innerHTML = '';
        if (labelLayers.length === 0) {
            labelsContainer.innerHTML = '<p class="layer-list-empty" style="font-size:0.72rem">No labels uploaded yet.</p>';
        } else {
            labelLayers.forEach(layer => renderLabelsFeatureList(layer, labelsContainer));
        }
    }

    if (viewpointsContainer) {
        viewpointsContainer.innerHTML = '';
        if (viewpointLayers.length === 0) {
            viewpointsContainer.innerHTML = '<p class="layer-list-empty" style="font-size:0.72rem">No viewpoints uploaded yet.</p>';
        } else {
            viewpointLayers.forEach(layer => renderViewpointsFeatureList(layer, viewpointsContainer));
        }
    }
}

function renderLabelsFeatureList(layer, container) {
    const header = document.createElement('div');
    header.className = 'labels-file-header';
    const fname = document.createElement('span');
    fname.textContent = layer.name;
    fname.className = 'labels-file-name';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-file-btn';
    removeBtn.title = 'Remove labels layer';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => removeUserLayer(layer.id));
    header.append(fname, removeBtn);
    container.appendChild(header);

    const features = layer.data?.features ?? [];
    if (features.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'layer-list-empty';
        empty.style.fontSize = '0.72rem';
        empty.textContent = 'No features found.';
        container.appendChild(empty);
        return;
    }

    features.forEach(f => {
        const chapter = f.properties?.chapter;
        const name    = f.properties?.name ?? '(unnamed)';
        const row = document.createElement('div');
        row.className = 'labels-feature-row';
        const nameEl = document.createElement('span');
        nameEl.className = 'labels-feature-name';
        nameEl.textContent = name;
        const badge = document.createElement('span');
        badge.className = 'labels-chapter-badge';
        badge.textContent = chapter != null ? 'Ch ' + chapter : '—';
        row.append(nameEl, badge);
        container.appendChild(row);
    });
}

function renderViewpointsFeatureList(layer, container) {
    const header = document.createElement('div');
    header.className = 'labels-file-header';
    const fname = document.createElement('span');
    fname.textContent = layer.name;
    fname.className = 'labels-file-name';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-file-btn';
    removeBtn.title = 'Remove viewpoints layer';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => removeUserLayer(layer.id));
    header.append(fname, removeBtn);
    container.appendChild(header);

    const features = layer.data?.features ?? [];
    if (features.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'layer-list-empty';
        empty.style.fontSize = '0.72rem';
        empty.textContent = 'No features found.';
        container.appendChild(empty);
        return;
    }

    features.forEach(f => {
        const chapter = f.properties?.chapter;
        const angle   = f.properties?.angle;
        const row = document.createElement('div');
        row.className = 'labels-feature-row';
        const nameEl = document.createElement('span');
        nameEl.className = 'labels-feature-name';
        nameEl.textContent = (angle != null ? angle + '°' : '?');
        const badge = document.createElement('span');
        badge.className = 'labels-chapter-badge';
        badge.textContent = chapter != null ? 'Ch ' + chapter : '—';
        row.append(nameEl, badge);
        container.appendChild(row);
    });
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
        const typeLabel = chapter.chapterType === 'title' ? 'Title' : chapter.chapterType === 'image' ? 'Image' : chapter.isTitleSlide ? 'Title' : 'Map';
        const typeClass = chapter.chapterType === 'title' ? 'chapter-type--title' : chapter.chapterType === 'image' ? 'chapter-type--image' : 'chapter-type--map';
        item.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <div class="chapter-item-content">
                <span class="chapter-number">Ch ${index} &nbsp;<span class="chapter-type-label ${typeClass}">${typeLabel}</span></span>
                <h4>${chapter.title || 'Untitled'}</h4>
                <p>${chapter.description || ''}</p>
            </div>
            <div class="chapter-item-actions">
                <button class="chapter-action-btn duplicate-btn" data-index="${index}" title="Duplicate chapter">⧉</button>
                <button class="chapter-action-btn delete-btn" data-index="${index}" title="Delete chapter">✕</button>
            </div>
        `;
        item.querySelector('.duplicate-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            duplicateChapter(parseInt(e.currentTarget.dataset.index));
        });
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.index);
            if (confirm('Delete this chapter?')) {
                chapters.splice(idx, 1);
                if (activeChapterIndex === idx) {
                    activeChapterIndex = null;
                    document.getElementById('no-chapter-selected').style.display = 'flex';
                    document.getElementById('chapter-form').style.display = 'none';
                } else if (activeChapterIndex !== null && activeChapterIndex > idx) {
                    activeChapterIndex--;
                }
                renderChaptersList();
            }
        });
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

function addChapter(type = 'map') {
    const titles = { title: 'New Title Slide', image: 'New Image Chapter', map: 'New Chapter' };
    const ch = {
        id: String(chapters.length + 1),
        chapterType: type,
        title: titles[type] || 'New Chapter',
        alignment: 'center',
        layers: {},
    };
    if (type !== 'image') {
        ch.center = editorMap.getCenter().toArray();
        ch.zoom = editorMap.getZoom();
        ch.pitch = editorMap.getPitch();
        ch.bearing = editorMap.getBearing();
        ch.duration = 2000;
    }
    if (activeChapterIndex !== null) {
        chapters.splice(activeChapterIndex + 1, 0, ch);
        renderChaptersList();
        selectChapter(activeChapterIndex + 1);
    } else {
        chapters.push(ch);
        renderChaptersList();
        selectChapter(chapters.length - 1);
    }
}

function selectChapter(index) {
    // Auto-save the current chapter before switching
    if (activeChapterIndex !== null && activeChapterIndex !== index) {
        saveCurrentChapter();
    }
    activeChapterIndex = index;
    renderChaptersList();
    populateChapterForm(chapters[index]);

    const ch = chapters[index];

    // Center panel: show image preview for image chapters, map otherwise
    const isImageChapter = ch.chapterType === 'image';
    document.getElementById('editor-map').style.visibility = isImageChapter ? 'hidden' : '';
    const preview = document.getElementById('image-chapter-preview');
    preview.style.display = isImageChapter ? 'flex' : 'none';
    if (isImageChapter) updateImageChapterPreview(ch.image);

    if (!isImageChapter) {
        if (ch.bounds) {
            editorMap.fitBounds(ch.bounds, { padding: 50, pitch: ch.pitch || 0, bearing: ch.bearing || 0, duration: 1000 });
        } else if (ch.center) {
            editorMap.flyTo({ center: ch.center, zoom: ch.zoom, pitch: ch.pitch || 0, bearing: ch.bearing || 0, duration: 1000 });
        }
    }

    const chNum = index;
    userLayers.forEach(layer => {
        if (layer.category === 'labels' || layer.category === 'viewpoints') {
            if (editorMap.getLayer(layer.id)) {
                editorMap.setFilter(layer.id, ['==', ['to-number', ['get', 'chapter']], chNum]);
                editorMap.setLayoutProperty(layer.id, 'visibility', 'visible');
            }
            return;
        }
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
            editorMap.setPaintProperty(`${entry.id}-outline`, 'line-color', cfg.strokeColor ?? color);
            editorMap.setPaintProperty(`${entry.id}-outline`, 'line-width', strokeWidth);
        }
    } else if (entry.category === 'symbol') {
        if (editorMap.getLayer(entry.id)) {
            editorMap.setPaintProperty(entry.id, 'circle-color', color);
            editorMap.setPaintProperty(entry.id, 'circle-opacity', opacity);
            editorMap.setPaintProperty(entry.id, 'circle-stroke-color', cfg.strokeColor ?? '#ffffff');
            editorMap.setPaintProperty(entry.id, 'circle-stroke-width', 1);
            editorMap.setPaintProperty(entry.id, 'circle-radius', cfg.radius ?? 6);
        }
    } else if (entry.category === 'text') {
        if (editorMap.getLayer(entry.id)) {
            editorMap.setPaintProperty(entry.id, 'text-color', color);
            editorMap.setPaintProperty(entry.id, 'text-opacity', opacity);
        }
    }
}

// ─── Chapter Form ─────────────────────────────────────────────────────────────

function setFormType(type) {
    document.getElementById('chapter-type').value = type;
    const show = (id, visible) => { document.getElementById(id).style.display = visible ? '' : 'none'; };
    show('section-subtitles',          type === 'title');
    show('section-map-chapter-fields', type !== 'title');
    show('section-image',              type !== 'title');
    show('section-legend',             type === 'map');
    show('section-alignment',          type !== 'title');
    show('section-map-view',           type !== 'image');
    show('section-layers',             type !== 'image');
}

function populateChapterForm(chapter) {
    document.getElementById('no-chapter-selected').style.display = 'none';
    document.getElementById('chapter-form').style.display = 'block';

    const type = chapter.chapterType || (chapter.isTitleSlide ? 'title' : 'map');
    setFormType(type);

    const set = (id, val) => { document.getElementById(id).value = val ?? ''; };
    set('chapter-id', chapter.id);
    set('chapter-title', chapter.title);
    set('chapter-description', chapter.description);
    set('chapter-quote', chapter.quote);
    set('chapter-subtitle1', chapter.subtitle);
    set('chapter-subtitle2', chapter.subtitle2);
    set('chapter-year', chapter.year);
    set('chapter-population', chapter.population);
    // image: set hidden URL field and show preview if present
    document.getElementById('chapter-image').value = chapter.image ?? '';
    const thumb = document.getElementById('chapter-image-thumb');
    const preview = document.getElementById('chapter-image-preview');
    const fileInput = document.getElementById('chapter-image-file');
    if (chapter.image) {
        thumb.src = chapter.image;
        preview.style.display = 'block';
    } else {
        thumb.src = '';
        preview.style.display = 'none';
    }
    fileInput.value = '';
    set('chapter-image-caption', chapter.imageCaption);
    // legend
    document.getElementById('chapter-legend').value = chapter.legend ?? '';
    const legendThumb = document.getElementById('chapter-legend-thumb');
    const legendPreview = document.getElementById('chapter-legend-preview');
    if (chapter.legend) { legendThumb.src = chapter.legend; legendPreview.style.display = 'block'; }
    else { legendThumb.src = ''; legendPreview.style.display = 'none'; }
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
        addBtn.className = 'upload-btn-label';
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
            colorLbl.textContent = (entry.category === 'polygon' || entry.category === 'symbol') ? 'Fill' : 'Color';
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

            // Stroke color (polygon + symbol)
            if (entry.category === 'polygon' || entry.category === 'symbol') {
                const strokeBox = document.createElement('div');
                strokeBox.className = 'chapter-layer-ctrl-item';
                const strokeLbl = document.createElement('span');
                strokeLbl.className = 'chapter-layer-ctrl-label';
                strokeLbl.textContent = 'Stroke';
                const strokePicker = document.createElement('input');
                strokePicker.type = 'color';
                strokePicker.className = 'chapter-layer-color';
                strokePicker.value = cfg.strokeColor || (entry.category === 'symbol' ? '#ffffff' : cfg.color || '#0d6aff');
                strokePicker.addEventListener('input', e => {
                    cfg.strokeColor = e.target.value;
                    applyChapterLayerStyle(entry, cfg);
                });
                strokeBox.append(strokeLbl, strokePicker);
                ctrl.appendChild(strokeBox);
            }
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

        // Radius (symbol/point layers)
        if (entry.category === 'symbol') {
            const rBox = document.createElement('div');
            rBox.className = 'chapter-layer-ctrl-item';
            const rLbl = document.createElement('span');
            rLbl.className = 'chapter-layer-ctrl-label';
            rLbl.textContent = 'Radius';
            const rInput = document.createElement('input');
            rInput.type = 'number';
            rInput.className = 'chapter-layer-width';
            rInput.min = '1'; rInput.max = '40'; rInput.step = '1';
            rInput.value = cfg.radius ?? 6;
            const rUnit = document.createElement('span');
            rUnit.className = 'chapter-layer-unit';
            rUnit.textContent = 'px';
            rInput.addEventListener('input', e => {
                cfg.radius = parseFloat(e.target.value) || 6;
                applyChapterLayerStyle(entry, cfg);
            });
            rBox.append(rLbl, rInput, rUnit);
            ctrl.appendChild(rBox);
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

    ch.chapterType = get('chapter-type');
    delete ch.isTitleSlide;
    // ch.id is managed by reassignChapterIds() — do not read from form
    ch.title = get('chapter-title');

    const isTitle = ch.chapterType === 'title';
    const isImage = ch.chapterType === 'image';

    ch.subtitle  = isTitle ? (get('chapter-subtitle1') || null) : null;
    ch.subtitle2 = isTitle ? (get('chapter-subtitle2') || null) : null;

    if (!isTitle) {
        ch.description     = get('chapter-description');
        ch.quote           = get('chapter-quote') || null;
        ch.year            = get('chapter-year') || null;
        ch.population      = get('chapter-population') || null;
        ch.descriptionSource = get('chapter-description-source') || null;
        ch.quoteSource     = get('chapter-quote-source') || null;
        ch.buttonText      = get('chapter-button-text') || null;
        ch.buttonUrl       = get('chapter-button-url') || null;
        ch.image           = get('chapter-image') || null;
        ch.imageCaption    = get('chapter-image-caption') || null;
        ch.legend          = get('chapter-legend') || null;
        ch.alignment       = get('chapter-alignment');
    } else {
        ch.description = null; ch.quote = null; ch.year = null; ch.population = null;
        ch.descriptionSource = null; ch.quoteSource = null;
        ch.buttonText = null; ch.buttonUrl = null;
        ch.image = null; ch.imageCaption = null; ch.legend = null;
        ch.alignment = 'center';
    }

    if (!isImage) {
        ch.pitch    = parseInt(get('chapter-pitch')) || 0;
        ch.bearing  = parseInt(get('chapter-bearing')) || 0;
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
    } else {
        delete ch.center; delete ch.zoom; delete ch.bounds;
        delete ch.boundsIpad; delete ch.boundsIpadPortrait; delete ch.boundsMobile;
        delete ch.pitch; delete ch.bearing; delete ch.duration;
        ch.layers = {};
    }

    // ch.layers is maintained live by the chapter layers UI — no DOM re-read needed

    renderChaptersList();
}

function reassignChapterIds() {
    chapters.forEach((ch, i) => { ch.id = String(i); });
}

function saveAllChanges() {
    if (activeChapterIndex !== null) saveCurrentChapter();
    reassignChapterIds();
    renderChaptersList();
    if (typeof cloudSave === 'function') {
        cloudSave();
    } else {
    }
}

// Expose config generators so editor-cloud.js can read them
window._getStoryConfigJSON = () => {
    const exportChapters = chapters.map((ch, i) => {
        const expandedLayers = {};
        Object.entries(ch.layers || {}).forEach(([layerId, state]) => {
            const entry = userLayers.find(l => l.id === layerId);
            if (entry?.category === 'polygon') {
                expandedLayers[`${layerId}-fill`] = { visible: state.visible, opacity: state.opacity, color: state.color };
                expandedLayers[`${layerId}-outline`] = { visible: state.visible, opacity: 1, color: state.strokeColor ?? state.color, strokeWidth: state.strokeWidth };
            } else if (entry?.category === 'labels' || entry?.category === 'viewpoints') {
                if (state.visible) {
                    expandedLayers[layerId] = { visible: true, opacity: state.opacity ?? 1, chapterFilter: i };
                }
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
            const rawUrl = entry.remoteUrl ? entry.remoteUrl.replace(/^https?:\/\//, '') : `./datasets/geotiff/${entry.filename}`;
            const url = `cog://${rawUrl}`;
            sources[entry.sourceId] = { type: 'raster', url, tileSize: 256 };
            layers.push({ id: entry.id, type: 'raster', source: entry.sourceId, paint: { 'raster-opacity': 1 } });
        } else {
            // Prefer the cloud/static URL — MapLibre accepts a URL string as geojson data.
            // Falls back to embedding the full data if no remote URL exists.
            sources[entry.sourceId] = { type: 'geojson', data: entry.remoteUrl || entry.data };
            if (entry.category === 'labels') {
                layers.push(_buildLabelLayer(entry.id, entry.sourceId));
            } else if (entry.category === 'viewpoints') {
                layers.push(_buildViewpointsLayer(entry.id, entry.sourceId));
            } else if (entry.category === 'line') {
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
    return {
        initialView: { center: view, zoom },
        defaultBasemap: currentBasemap,
        basemaps: mapConfig.basemaps,

        sources,
        layers,
        // Metadata used to restore the layer panel when reopening a saved map
        userLayersMeta: userLayers.map(l => ({
            id: l.id, sourceId: l.sourceId, name: l.name, filename: l.filename,
            category: l.category, style: l.style || null, remoteUrl: l.remoteUrl || null,
        })),
    };
};

function _buildLabelLayer(layerId, sourceId) {
    return {
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Bold'],
            'text-size': 15,
            'text-anchor': 'left',
            'text-allow-overlap': true,
            'text-transform': 'uppercase',
            'text-offset': [0.5, 0],
        },
        paint: { 'text-color': '#0d6aff', 'text-halo-color': '#f9ea46', 'text-halo-width': 6 },
    };
}

function _buildViewpointsLayer(layerId, sourceId) {
    return {
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: {
            'icon-image': 'viewpoint-icon',
            'icon-size': 0.15,
            'icon-rotation-alignment': 'map',
            'icon-rotate': ['get', 'angle'],
            'icon-allow-overlap': true,
        },
        paint: { 'icon-opacity': 1 },
    };
}

// ─── Editor API for the cloud module (editor-cloud.js) ───────────────────────

window._editorAPI = {
    setChapters(newChapters) {
        chapters = Array.isArray(newChapters) ? newChapters : [];
        activeChapterIndex = null;
        document.getElementById('no-chapter-selected').style.display = 'flex';
        document.getElementById('chapter-form').style.display = 'none';
        renderChaptersList();
    },

    // Collapse expanded polygon layer IDs (ul-xxx-fill / ul-xxx-outline) back to
    // base IDs so the editor's selectChapter / populateLayerToggles work correctly.
    // Must be called after restoreLayers so userLayers is populated.
    normalizeChapterLayers() {
        chapters = chapters.map(ch => {
            if (!ch.layers) return ch;
            const collapsed = {};
            Object.entries(ch.layers).forEach(([id, state]) => {
                if (id.endsWith('-fill')) {
                    const base = id.slice(0, -5);
                    if (userLayers.some(l => l.id === base && l.category === 'polygon')) {
                        collapsed[base] = collapsed[base]
                            ? { ...collapsed[base], visible: state.visible, opacity: state.opacity, color: state.color }
                            : { ...state };
                        return;
                    }
                } else if (id.endsWith('-outline')) {
                    const base = id.slice(0, -8);
                    if (userLayers.some(l => l.id === base && l.category === 'polygon')) {
                        if (!collapsed[base]) collapsed[base] = {};
                        if (state.strokeWidth != null) collapsed[base].strokeWidth = state.strokeWidth;
                        if (state.color != null) collapsed[base].strokeColor = state.color;
                        return;
                    }
                }
                collapsed[id] = state;
            });
            return { ...ch, layers: collapsed };
        });
        renderChaptersList();
    },

    // Restore layers from saved metadata (cloud-stored layers only)
    async restoreLayers(metaList) {
        console.log('[restoreLayers] restoring', metaList?.length, 'layers:', metaList?.map(m => `${m.id}(${m.category})`));

        // Fetch all vector data in parallel first, before touching the map
        const entries = [];
        await Promise.all((metaList || []).map(async meta => {
            if (!meta.remoteUrl) { console.warn('[restoreLayers] skipping — no remoteUrl:', meta.id); return; }
            if (userLayers.some(l => l.id === meta.id)) { console.log('[restoreLayers] skipping — already in userLayers:', meta.id); return; }
            if (meta.category === 'raster') {
                entries.push({ entry: { ...meta }, addFn: addRasterLayerToMap });
            } else {
                try {
                    console.log('[restoreLayers] fetching vector data for:', meta.id, meta.remoteUrl);
                    const resp = await fetch(meta.remoteUrl);
                    console.log('[restoreLayers] fetch status:', resp.status, 'ok:', resp.ok);
                    const data = await resp.json();
                    console.log('[restoreLayers] parsed data — features:', data.features?.length, 'type:', data.type);
                    entries.push({ entry: { ...meta, data }, addFn: addVectorLayerToMap });
                } catch (e) {
                    console.warn('Could not restore layer:', meta.name, e);
                    showNotification(`Could not restore layer "${meta.name}"`, true);
                }
            }
        }));

        // Wait for the map to be ready once, then add all layers synchronously
        console.log('[restoreLayers] all fetches done, waiting for map to be ready…');
        await new Promise(resolve => {
            const check = () => {
                if (editorMap.isStyleLoaded()) { console.log('[restoreLayers] map ready'); return resolve(); }
                console.log('[restoreLayers] map not ready yet, retrying in 50ms…');
                setTimeout(check, 50);
            };
            check();
        });

        for (const { entry, addFn } of entries) {
            console.log('[restoreLayers] adding to map:', entry.id, '(', entry.category, ')');
            userLayers.push(entry);
            addFn(entry);
        }

        console.log('[restoreLayers] done. userLayers count:', userLayers.length);
        renderLayerList();
        if (activeChapterIndex !== null) populateLayerToggles(chapters[activeChapterIndex]);
    },

    reapplyActiveChapter() {
        if (activeChapterIndex === null) return;
        const ch = chapters[activeChapterIndex];
        userLayers.forEach(layer => {
            const cfg = ch.layers?.[layer.id];
            const visible = cfg != null;
            getMapLayerIds(layer).forEach(lid => {
                if (editorMap.getLayer(lid)) editorMap.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none');
            });
            if (cfg) applyChapterLayerStyle(layer, cfg);
        });
        populateLayerToggles(ch);
    },

    selectFirstChapter() {
        if (chapters.length > 0) selectChapter(0);
    },

    // Add a layer from a known URL (used by the core layers catalog)
    async addCatalogLayer(name, url, filename) {
        const ext = (filename || url).split('.').pop().toLowerCase();
        const { layerId, sourceId } = idsFromFilename(filename || name);

        if (ext === 'tif' || ext === 'tiff') {
            const entry = { id: layerId, sourceId, name, filename: filename || name, category: 'raster', remoteUrl: url };
            userLayers.push(entry);
            withMap(() => addRasterLayerToMap(entry));
            registerLayerInActiveChapter(layerId);
            renderLayerList();
            showNotification(`"${name}" added from catalog`);
            return;
        }

        showNotification(`Loading "${name}"…`);
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            let data;
            if (ext === 'kml') {
                const text = await resp.text();
                const kmlDoc = new DOMParser().parseFromString(text, 'text/xml');
                data = toGeoJSON.kml(kmlDoc);
            } else {
                data = await resp.json();
            }
            const category = detectCategory(data);
            const defaultStyle = category === 'line'
                ? { strokeColor: '#0d6aff', strokeWidth: 2 }
                : category === 'polygon'
                ? { fillColor: '#0064ff', fillOpacity: 0.3, strokeColor: '#0d6aff', strokeWidth: 1 }
                : null;
            // remoteUrl = the static GitHub URL — no re-upload to Supabase needed
            const entry = { id: layerId, sourceId, name, filename: filename || name, category, data, style: defaultStyle, remoteUrl: url };
            userLayers.push(entry);
            withMap(() => addVectorLayerToMap(entry));
            registerLayerInActiveChapter(layerId);
            renderLayerList();
            showNotification(`"${name}" added from catalog`);
        } catch (e) {
            showNotification(`Could not load "${name}": ${e.message}`, true);
        }
    },
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

function duplicateChapter(index) {
    const copy = JSON.parse(JSON.stringify(chapters[index]));
    copy.id = `tmp-${Date.now()}`;
    chapters.splice(index + 1, 0, copy);
    renderChaptersList();
    selectChapter(index + 1);
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
                expandedLayers[`${layerId}-outline`] = { visible: state.visible, opacity: 1, color: state.strokeColor ?? state.color, strokeWidth: state.strokeWidth };
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

function sanitiseTitle(title) {
    return (title || 'story-map').trim()
        .replace(/[^a-zA-Z0-9_\-. ]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase() || 'story-map';
}

async function exportFolder(btn) {
    if (activeChapterIndex !== null) saveCurrentChapter();

    const originalLabel = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Preparing…'; btn.disabled = true; }

    try {
        const zip = new JSZip();
        const title = sanitiseTitle(chapters[0]?.title || document.getElementById('map-title')?.value || '');
        const folder = zip.folder(title);
        // url → local filename map for rewriting
        const urlToLocal = new Map();

        // unique filename helper
        const usedNames = new Set();
        function uniqueName(name) {
            if (!usedNames.has(name)) { usedNames.add(name); return name; }
            const dot = name.lastIndexOf('.');
            const base = dot >= 0 ? name.slice(0, dot) : name;
            const ext  = dot >= 0 ? name.slice(dot) : '';
            let i = 2, candidate;
            do { candidate = `${base}-${i++}${ext}`; } while (usedNames.has(candidate));
            usedNames.add(candidate);
            return candidate;
        }

        const layersFolder = folder.folder('layers');
        const imagesFolder = folder.folder('images');

        // ── 1. User-uploaded layers ───────────────────────────────────────────
        for (const entry of userLayers) {
            // Skip core catalog layers (GitHub Pages) — they stay as remote URLs
            const isCoreLayer = entry.remoteUrl && entry.remoteUrl.includes('mod-foundation.github.io');
            if (isCoreLayer) continue;

            if (entry.category === 'raster') {
                const localName = uniqueName(entry.filename);
                const localPath = `layers/geotiff/${localName}`;
                const src = entry.remoteUrl || entry.blobUrl;
                if (src) {
                    try {
                        const resp = await fetch(src);
                        layersFolder.folder('geotiff').file(localName, await resp.blob());
                        if (entry.remoteUrl) urlToLocal.set(entry.remoteUrl, localPath);
                        if (entry.blobUrl)   urlToLocal.set(entry.blobUrl,   localPath);
                    } catch (e) { console.warn('[exportFolder] raster fetch failed:', src, e); }
                }
            } else {
                const localName = uniqueName(entry.filename || `${entry.id}.geojson`);
                const localPath = `layers/${localName}`;
                layersFolder.file(localName, JSON.stringify(entry.data, null, 2));
                if (entry.remoteUrl) urlToLocal.set(entry.remoteUrl, localPath);
                if (entry.blobUrl)   urlToLocal.set(entry.blobUrl,   localPath);
                entry._localPath = localPath;
            }
        }

        // ── 2. Chapter images ────────────────────────────────────────────────
        const exportChapters = JSON.parse(JSON.stringify(chapters));
        for (const ch of exportChapters) {
            if (!ch.image || ch.image.startsWith('./images/')) continue;
            try {
                const resp = await fetch(ch.image);
                const blob = await resp.blob();
                const ext  = ch.image.split('.').pop().split('?')[0] || 'jpg';
                const localName = uniqueName(`chapter-${ch.id}-image.${ext}`);
                imagesFolder.file(localName, blob);
                urlToLocal.set(ch.image, `images/${localName}`);
                ch.image = `./images/${localName}`;
            } catch (e) { console.warn('[exportFolder] image fetch failed:', ch.image, e); }
        }

        // ── 3. Generate storyConfig.js (with rewritten image URLs) ───────────
        const expandedChapters = exportChapters.map((ch, i) => {
            const expandedLayers = {};
            Object.entries(ch.layers || {}).forEach(([layerId, state]) => {
                const entry = userLayers.find(l => l.id === layerId);
                if (entry?.category === 'polygon') {
                    expandedLayers[`${layerId}-fill`]    = { visible: state.visible, opacity: state.opacity, color: state.color };
                    expandedLayers[`${layerId}-outline`] = { visible: state.visible, opacity: 1, color: state.strokeColor ?? state.color, strokeWidth: state.strokeWidth };
                } else if (entry?.category === 'labels' || entry?.category === 'viewpoints') {
                    if (state.visible) {
                        expandedLayers[layerId] = { visible: true, opacity: state.opacity ?? 1, chapterFilter: i };
                    }
                } else {
                    expandedLayers[layerId] = state;
                }
            });
            return { ...ch, layers: expandedLayers };
        });
        const storyConfigText = `// Story Map Configuration\n// Generated on ${new Date().toLocaleString()}\n\nconst storyConfig = ${JSON.stringify({ chapters: expandedChapters }, null, 2)};\n\nif (typeof module !== 'undefined' && module.exports) {\n  module.exports = storyConfig;\n}`;

        // ── 4. Generate mapConfig.js (vectors → local paths, rasters already local) ──
        const sources = {};
        const layers = [];
        userLayers.forEach(entry => {
            const isCoreLayer = entry.remoteUrl && entry.remoteUrl.includes('mod-foundation.github.io');
            if (entry.category === 'raster') {
                const rasterUrl = isCoreLayer
                    ? `cog://${entry.remoteUrl}`
                    : `cog://./layers/geotiff/${entry.filename}`;
                sources[entry.sourceId] = { type: 'raster', url: rasterUrl, tileSize: 256 };
                layers.push({ id: entry.id, type: 'raster', source: entry.sourceId, paint: { 'raster-opacity': 1 } });
            } else {
                const dataValue = isCoreLayer
                    ? (entry.remoteUrl || entry.data)
                    : (entry._localPath ? `./${entry._localPath}` : entry.data);
                sources[entry.sourceId] = { type: 'geojson', data: dataValue };
                if (entry.category === 'labels') {
                    layers.push(_buildLabelLayer(entry.id, entry.sourceId));
                } else if (entry.category === 'viewpoints') {
                    layers.push(_buildViewpointsLayer(entry.id, entry.sourceId));
                } else if (entry.category === 'line') {
                    layers.push({ id: entry.id, type: 'line', source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
                } else if (entry.category === 'polygon') {
                    layers.push({ id: `${entry.id}-fill`,    type: 'fill',   source: entry.sourceId, paint: { 'fill-color': hexToRgba(entry.style.fillColor, entry.style.fillOpacity) } });
                    layers.push({ id: `${entry.id}-outline`, type: 'line',   source: entry.sourceId, paint: { 'line-color': entry.style.strokeColor, 'line-width': entry.style.strokeWidth } });
                } else if (entry.category === 'text') {
                    layers.push({ id: entry.id, type: 'symbol', source: entry.sourceId, layout: { 'text-field': detectTextField(entry.data), 'text-font': ['Open Sans Regular'], 'text-size': 14 }, paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } });
                } else if (entry.category === 'symbol') {
                    layers.push({ id: entry.id, type: 'circle', source: entry.sourceId, paint: { 'circle-color': '#ff6b6b', 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } });
                }
            }
        });
        const view = editorMap ? editorMap.getCenter().toArray() : mapConfig.initialView.center;
        const zoom = editorMap ? editorMap.getZoom() : mapConfig.initialView.zoom;
        const mapConfigObj = { initialView: { center: view, zoom }, defaultBasemap: currentBasemap, basemaps: mapConfig.basemaps, sources, layers };
        const mapConfigText = `// Map Configuration\n// Generated on ${new Date().toLocaleString()}\n\nconst mapConfig = ${JSON.stringify(mapConfigObj, null, 2)};\n\nif (typeof module !== 'undefined' && module.exports) {\n  module.exports = mapConfig;\n}`;

        // ── 5. Add JS files + standalone viewer ──────────────────────────────
        folder.file('storyConfig.js', storyConfigText);
        folder.file('mapConfig.js',   mapConfigText);

        const [indexHtml, viewerJs, styleCSS, quoteIconBlob, viewpointIconBlob] = await Promise.all([
          fetch('../standalone/index.html').then(r => r.text()),
          fetch('../standalone/viewer.js').then(r => r.text()),
          fetch('../viewer/story-style.css').then(r => r.text()),
          fetch('../images/quote-icon.png').then(r => r.blob()),
          fetch('../images/viewpoint.png').then(r => r.blob()),
        ]);
        folder.file('index.html',      indexHtml);
        folder.file('viewer.js',       viewerJs);
        folder.file('story-style.css', styleCSS);
        folder.file('images/quote-icon.png', quoteIconBlob);
        folder.file('images/viewpoint.png', viewpointIconBlob);

        // clean up temporary _localPath markers
        userLayers.forEach(e => delete e._localPath);

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${title}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);

    } catch (err) {
        console.error('[exportFolder]', err);
        showNotification('Export failed — see console for details.', true);
    } finally {
        if (btn) { btn.textContent = originalLabel; btn.disabled = false; }
    }
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

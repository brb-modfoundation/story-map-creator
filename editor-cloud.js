// editor-cloud.js — Supabase integration for the Story Map Editor
// Handles: load/save/publish, dataset uploads to Storage, MOD core layers catalog

import { supabase, uploadDataset } from './supabase.js';

const params = new URLSearchParams(window.location.search);
const MAP_ID = params.get('mapId');

// MOD Foundation core data folder (GitHub Pages — served with open CORS)
const CORE_DATA_API = 'https://api.github.com/repos/mod-foundation/mod-foundation.github.io/contents/download_center/data';
const CORE_DATA_BASE = 'https://mod-foundation.github.io/download_center/data/';

let currentMap = null;
let currentUser = null;

// ── Dataset upload hook (called by editor.js on every file upload) ──
window._cloudUploadDataset = async (file) => {
  if (!currentUser) return null;          // local/standalone mode — skip cloud
  return await uploadDataset(file, currentUser.id);
};

// ── Boot ──────────────────────────────────────────────────
(async () => {
  if (!MAP_ID) {
    // Standalone use without a map id — still init catalog if logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) currentUser = session.user;
    initCoreCatalog();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'dashboard.html';
    return;
  }
  currentUser = session.user;

  const { data, error } = await supabase
    .from('story_maps')
    .select('*')
    .eq('id', MAP_ID)
    .eq('user_id', currentUser.id)
    .single();

  if (error || !data) {
    alert('Map not found or you do not have access.');
    window.location.href = 'dashboard.html';
    return;
  }

  currentMap = data;

  document.getElementById('cloud-bar').style.display = 'flex';
  document.getElementById('cloud-map-title').textContent = data.title;
  updatePublishButton(data.published);

  // Restore chapters
  if (data.story_config?.chapters && window._editorAPI) {
    window._editorAPI.setChapters(data.story_config.chapters);
  }

  // Restore basemap selection
  const bm = data.map_config?.defaultBasemap;
  if (bm && typeof window.switchBasemap === 'function') {
    window.switchBasemap(bm);
    const radio = document.querySelector(`input[name="basemap"][value="${bm}"]`);
    if (radio) radio.checked = true;
  }

  // Restore cloud-stored layers
  if (data.map_config?.userLayersMeta?.length && window._editorAPI) {
    setStatus('Restoring layers…');
    await window._editorAPI.restoreLayers(data.map_config.userLayersMeta);
  }

  setStatus('Loaded ✓');
  initCoreCatalog();
})();

// ── Cloud Save ────────────────────────────────────────────
window.cloudSave = async () => {
  if (!MAP_ID || !currentUser) {
    if (typeof window.showNotification === 'function') window.showNotification('Not connected to cloud — use Export to download configs.');
    return;
  }

  const btn = document.getElementById('cloud-save-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Saving…';
  setStatus('Saving…');

  const storyConfig = window._getStoryConfigJSON?.() ?? { chapters: [] };
  const mapConfig   = window._getMapConfigJSON?.() ?? {};

  // Warn about layers that never made it to cloud storage
  const embedded = (mapConfig.userLayersMeta || []).filter(m => !m.remoteUrl && m.category !== 'raster');
  const lostRasters = (mapConfig.userLayersMeta || []).filter(m => !m.remoteUrl && m.category === 'raster');

  const { error } = await supabase
    .from('story_maps')
    .update({
      story_config: storyConfig,
      map_config: mapConfig,
      updated_at: new Date().toISOString(),
    })
    .eq('id', MAP_ID);

  btn.disabled = false;
  btn.textContent = '☁ Save';

  if (error) {
    setStatus('Save failed ✗', true);
    if (typeof window.showNotification === 'function') window.showNotification('Cloud save failed: ' + error.message, true);
  } else {
    setStatus('Saved ✓');
    let msg = 'Saved to cloud ✓';
    if (embedded.length) msg += ` (${embedded.length} layer(s) embedded directly — cloud upload had failed)`;
    if (lostRasters.length) msg += ` — WARNING: ${lostRasters.length} raster(s) not in cloud storage and will not appear in the published map`;
    if (typeof window.showNotification === 'function') window.showNotification(msg, lostRasters.length > 0);
  }
};

// ── Publish Toggle ────────────────────────────────────────
window.cloudTogglePublish = async () => {
  if (!currentMap) return;
  const newState = !currentMap.published;

  const { error } = await supabase
    .from('story_maps')
    .update({ published: newState, updated_at: new Date().toISOString() })
    .eq('id', MAP_ID);

  if (error) {
    if (typeof window.showNotification === 'function') window.showNotification('Publish failed: ' + error.message, true);
    return;
  }

  currentMap.published = newState;
  updatePublishButton(newState);

  if (newState) {
    const url = `${window.location.origin}${window.location.pathname.replace('editor.html', 'view.html')}?id=${currentMap.slug}`;
    setTimeout(() => {
      if (confirm(`Map published!\n\nShare URL:\n${url}\n\nCopy to clipboard?`)) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
    }, 200);
  } else if (typeof window.showNotification === 'function') {
    window.showNotification('Map unpublished.');
  }
};

function updatePublishButton(published) {
  const btn = document.getElementById('cloud-publish-btn');
  if (!btn) return;
  btn.textContent = published ? '✓ Published' : 'Publish';
  btn.style.background = published ? '#27ae60' : '#9b59b6';
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('cloud-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#e74c3c' : '#7fb3d3';
  if (!isError) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
}

// ── MOD Core Layers Catalog ───────────────────────────────
// Lists files live from the MOD Foundation GitHub data folder.

function initCoreCatalog() {
  const toolbar = document.querySelector('.layers-panel-toolbar');
  if (!toolbar) return;

  const btn = document.createElement('button');
  btn.textContent = '🗂 Core Layers';
  btn.type = 'button';
  btn.style.cssText = 'padding:0.35rem 0.7rem;border:1px solid #2c3e50;background:white;color:#2c3e50;border-radius:5px;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:inherit';
  btn.addEventListener('click', toggleCatalogPanel);
  toolbar.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'core-catalog-panel';
  panel.style.cssText = 'display:none;flex-direction:column;gap:0.25rem;max-height:240px;overflow-y:auto;border:1px solid #dde3f0;border-radius:6px;padding:0.5rem;background:#f8fbff;flex-shrink:0';
  toolbar.parentElement.insertBefore(panel, toolbar.nextSibling);
}

let catalogLoaded = false;

async function toggleCatalogPanel() {
  const panel = document.getElementById('core-catalog-panel');
  const isOpen = panel.style.display === 'flex';
  panel.style.display = isOpen ? 'none' : 'flex';
  if (isOpen || catalogLoaded) return;

  panel.innerHTML = '<span style="font-size:0.8rem;color:#999">Loading catalog…</span>';

  try {
    const resp = await fetch(CORE_DATA_API);
    if (!resp.ok) throw new Error(`GitHub API: HTTP ${resp.status}`);
    const items = await resp.json();

    const supported = items.filter(it =>
      it.type === 'file' && /\.(geojson|json|kml|tif|tiff)$/i.test(it.name)
    );

    if (!supported.length) {
      panel.innerHTML = '<span style="font-size:0.8rem;color:#999">No supported files found in the core data folder.</span>';
      return;
    }

    panel.innerHTML = '';
    supported.forEach(it => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.4rem;background:white;border-radius:4px;border:1px solid #e8eef8';

      const sizeKb = (it.size / 1024).toFixed(0);
      const nameEl = document.createElement('span');
      nameEl.textContent = it.name;
      nameEl.title = `${it.name} (${sizeKb} KB)`;
      nameEl.style.cssText = 'flex:1;font-size:0.78rem;color:#2c3e50;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';

      const sizeEl = document.createElement('span');
      sizeEl.textContent = sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + ' MB' : sizeKb + ' KB';
      sizeEl.style.cssText = 'font-size:0.68rem;color:#999;flex-shrink:0';

      const addBtn = document.createElement('button');
      addBtn.textContent = '+ Add';
      addBtn.type = 'button';
      addBtn.style.cssText = 'padding:0.15rem 0.5rem;border:none;background:#2196f3;color:white;border-radius:4px;font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0';
      addBtn.addEventListener('click', () => {
        const displayName = it.name.replace(/\.[^.]+$/, '');
        window._editorAPI?.addCatalogLayer(displayName, CORE_DATA_BASE + it.name, it.name);
      });

      row.append(nameEl, sizeEl, addBtn);
      panel.appendChild(row);
    });

    catalogLoaded = true;
  } catch (e) {
    panel.innerHTML = `<span style="font-size:0.8rem;color:#c62828">Could not load catalog: ${e.message}. (GitHub API rate limit? Try again in a few minutes.)</span>`;
  }
}

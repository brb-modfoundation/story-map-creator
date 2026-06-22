// editor-cloud.js — Supabase integration for the Story Map Editor
// Handles: load/save/publish, dataset uploads to Storage, MOD core layers catalog

import { supabase, uploadDataset, SUPABASE_URL } from '../config/supabase.js';

const params = new URLSearchParams(window.location.search);
const MAP_ID = params.get('mapId');

// MOD Foundation core data folder (GitHub Pages — served with open CORS)
// Uses the git trees API (recursive) because files live in subfolders: json/, geotiff/
const CORE_TREE_API = 'https://api.github.com/repos/mod-foundation/mod-foundation.github.io/git/trees/main?recursive=1';
const CORE_DATA_PREFIX = 'download_center/data/';
const CORE_DATA_BASE = 'https://mod-foundation.github.io/download_center/data/';

let currentMap = null;
let currentUser = null;

// ── Dataset upload hook (called by editor.js on every file upload) ──
window._cloudUploadDataset = async (file) => {
  if (!currentUser) return null;          // local/standalone mode — skip cloud
  return await uploadDataset(file, currentUser.id);
};

// ── Boot ──────────────────────────────────────────────────
window._cloudActive = true;   // tells editor.js not to auto-dismiss the loading overlay

(async () => {
  if (!MAP_ID) {
    // Standalone use without a map id — still init catalog if logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) currentUser = session.user;
    initCoreCatalog();
    window._markLayersRestored?.();
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
    window._markLayersRestored?.();
    alert('Map not found or you do not have access.');
    window.location.href = 'dashboard.html';
    return;
  }

  currentMap = data;

  document.getElementById('header-map-title').textContent = data.title;
  document.getElementById('cloud-publish-btn').style.display = '';
  document.getElementById('cloud-view-btn').style.display = '';
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
    const loadingLabel = document.getElementById('map-loading-label');
    if (loadingLabel) loadingLabel.textContent = `Loading ${data.map_config.userLayersMeta.length} layer(s)…`;
    await window._editorAPI.restoreLayers(data.map_config.userLayersMeta);
    // Collapse expanded polygon IDs (ul-xxx-fill/outline → ul-xxx) so the
    // editor's selectChapter and layer toggles can find them by base ID.
    window._editorAPI.normalizeChapterLayers?.();
    window._editorAPI.selectFirstChapter?.();
  }

  setStatus('Loaded ✓');
  window._markLayersRestored?.();
  initCoreCatalog();
})();

// ── Cloud Save ────────────────────────────────────────────
window.cloudSave = async () => {
  if (!MAP_ID || !currentUser) {
    if (typeof window.showNotification === 'function') window.showNotification('Not connected to cloud — use Export to download configs.');
    return;
  }

  const btn = document.getElementById('save-all-btn');
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
  btn.textContent = 'Save';

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
    if (typeof window.showNotification === 'function') window.showNotification('Publishing to GitHub…');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/publish-to-github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mapId: MAP_ID }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error ?? `HTTP ${resp.status}`);
      const ghUrl = result.url;
      setTimeout(() => {
        if (confirm(`Published!\n\nLive at:\n${ghUrl}\n\nCopy link to clipboard?`)) {
          navigator.clipboard.writeText(ghUrl).catch(() => {});
        }
      }, 200);
    } catch (e) {
      if (typeof window.showNotification === 'function') window.showNotification('GitHub publish failed: ' + e.message, true);
    }
  } else if (typeof window.showNotification === 'function') {
    window.showNotification('Map unpublished.');
  }
};

// ── Open viewer (without publishing to GitHub) ────────────
window.cloudOpenView = () => {
  if (!MAP_ID) {
    if (typeof window.showNotification === 'function') window.showNotification('Save the map first to preview it.', true);
    return;
  }
  window.open(`../viewer/view.html?mapId=${MAP_ID}`, '_blank');
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
    const resp = await fetch(CORE_TREE_API);
    if (!resp.ok) throw new Error(`GitHub API: HTTP ${resp.status}`);
    const tree = await resp.json();

    const supported = (tree.tree || []).filter(it => {
      if (it.type !== 'blob') return false;
      if (!it.path.startsWith(CORE_DATA_PREFIX)) return false;
      const rel = it.path.slice(CORE_DATA_PREFIX.length);
      // Skip duplicate/archive folders and junk files
      if (/(^|\/)(copy|Archive)\//i.test(rel)) return false;
      if (/thumbs\.db$/i.test(rel)) return false;
      return /\.(geojson|json|kml|tif|tiff)$/i.test(rel);
    }).map(it => {
      const rel = it.path.slice(CORE_DATA_PREFIX.length);
      return {
        rel,
        name: rel.split('/').pop(),
        folder: rel.includes('/') ? rel.split('/')[0] : '',
        size: it.size || 0,
      };
    }).sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));

    if (!supported.length) {
      panel.innerHTML = '<span style="font-size:0.8rem;color:#999">No supported files found in the core data folder.</span>';
      return;
    }

    panel.innerHTML = '';
    let lastFolder = null;
    supported.forEach(it => {
      if (it.folder !== lastFolder) {
        lastFolder = it.folder;
        const hdr = document.createElement('div');
        hdr.textContent = it.folder === 'geotiff' ? '🗻 ' + it.folder : '📁 ' + (it.folder || 'data');
        hdr.style.cssText = 'font-size:0.7rem;font-weight:700;color:#557;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.3rem;padding:0 0.2rem';
        panel.appendChild(hdr);
      }

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.4rem;background:white;border-radius:4px;border:1px solid #e8eef8';

      const sizeKb = it.size / 1024;
      const nameEl = document.createElement('span');
      nameEl.textContent = it.name;
      nameEl.title = it.rel;
      nameEl.style.cssText = 'flex:1;font-size:0.78rem;color:#2c3e50;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';

      const sizeEl = document.createElement('span');
      sizeEl.textContent = sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + ' MB' : sizeKb.toFixed(0) + ' KB';
      sizeEl.style.cssText = 'font-size:0.68rem;color:#999;flex-shrink:0';

      const addBtn = document.createElement('button');
      addBtn.textContent = '+ Add';
      addBtn.type = 'button';
      addBtn.style.cssText = 'padding:0.15rem 0.5rem;border:none;background:#2196f3;color:white;border-radius:4px;font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0';
      addBtn.addEventListener('click', () => {
        const displayName = it.name.replace(/\.[^.]+$/, '');
        window._editorAPI?.addCatalogLayer(displayName, CORE_DATA_BASE + it.rel, it.name);
      });

      row.append(nameEl, sizeEl, addBtn);
      panel.appendChild(row);
    });

    catalogLoaded = true;
  } catch (e) {
    panel.innerHTML = `<span style="font-size:0.8rem;color:#c62828">Could not load catalog: ${e.message}. (GitHub API rate limit? Try again in a few minutes.)</span>`;
  }
}

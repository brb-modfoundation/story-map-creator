// editor-cloud.js — Supabase integration for the Story Map Editor
// Loaded as a module alongside editor.js

import { supabase } from './supabase.js';

const params = new URLSearchParams(window.location.search);
const MAP_ID = params.get('mapId');

let currentMap = null;   // the full DB row
let currentUser = null;

// ── Boot ──────────────────────────────────────────────────
(async () => {
  if (!MAP_ID) return; // standalone/local use — no cloud bar

  // Check auth
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Not logged in — redirect to dashboard
    window.location.href = 'dashboard.html';
    return;
  }
  currentUser = session.user;

  // Load the map record
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

  // Show cloud bar
  document.getElementById('cloud-bar').style.display = 'flex';
  document.getElementById('cloud-map-title').textContent = data.title;
  updatePublishButton(data.published);
  setStatus('Loaded ✓');

  // Inject the saved configs into the editor's live state
  // The editor already initialised from the static storyConfig.js / mapConfig.js,
  // so we overwrite chapters with the cloud version.
  injectCloudConfig(data.story_config, data.map_config);
})();

function injectCloudConfig(storyConfig, mapCfg) {
  // Overwrite the editor's chapter array with cloud data
  if (storyConfig?.chapters) {
    // chapters is a global in editor.js
    window.chapters.length = 0;
    storyConfig.chapters.forEach(ch => window.chapters.push(ch));
    if (typeof window.renderChaptersList === 'function') window.renderChaptersList();
  }

  // Overwrite basemap defaults if saved
  if (mapCfg?.defaultBasemap && typeof window.switchBasemap === 'function') {
    window.switchBasemap(mapCfg.defaultBasemap);
    // Sync radio
    const radio = document.querySelector(`input[name="basemap"][value="${mapCfg.defaultBasemap}"]`);
    if (radio) radio.checked = true;
  }
}

// ── Cloud Save ────────────────────────────────────────────
window.cloudSave = async () => {
  if (!MAP_ID || !currentUser) return;

  const btn = document.getElementById('cloud-save-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Saving…';
  setStatus('Saving…');

  const storyConfig = window._getStoryConfigJSON?.() ?? { chapters: [] };
  const mapConfig   = window._getMapConfigJSON?.() ?? {};

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
    if (typeof window.showNotification === 'function') window.showNotification('Saved to cloud ✓');
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

  if (!error) {
    currentMap.published = newState;
    updatePublishButton(newState);
    const msg = newState
      ? `Published! Share: ${window.location.origin}/view.html?id=${currentMap.slug}`
      : 'Map unpublished.';
    if (typeof window.showNotification === 'function') window.showNotification(msg);
    if (newState) {
      // Show copyable share URL
      const url = `${window.location.origin}${window.location.pathname.replace('editor.html','view.html')}?id=${currentMap.slug}`;
      setTimeout(() => {
        if (confirm(`Map published!\n\nShare URL:\n${url}\n\nCopy to clipboard?`)) {
          navigator.clipboard.writeText(url).catch(() => {});
        }
      }, 300);
    }
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

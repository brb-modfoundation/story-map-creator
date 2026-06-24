import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!;
const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER')!;
const GITHUB_REPO  = Deno.env.get('GITHUB_REPO')!;
const BRANCH = 'main';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    // ── Load map ─────────────────────────────────────────────
    const { mapId, action } = await req.json();
    const { data: map, error: mapErr } = await supabase
      .from('story_maps')
      .select('slug, title, story_config, map_config')
      .eq('id', mapId)
      .eq('user_id', user.id)
      .single();

    if (mapErr || !map) return json({ error: 'Map not found' }, 404);

    const slug        = map.slug as string;
    const storyConfig = map.story_config as any;
    const mapConfig   = map.map_config   as any;
    const userMeta    = (mapConfig?.userLayersMeta ?? []) as any[];

    // ── Unpublish: remove published/{slug}/ from GitHub ──────
    if (action === 'unpublish') {
      const gh = makeGh();
      const refData    = await gh(`/git/ref/heads/${BRANCH}`);
      const parentSha  = refData.object.sha as string;
      const commitData = await gh(`/git/commits/${parentSha}`);
      const baseTreeSha = commitData.tree.sha as string;

      // Get full recursive tree to find files under published/{slug}/
      const treeData = await gh(`/git/trees/${baseTreeSha}?recursive=1`);
      const prefix = `published/${slug}/`;
      const remaining = (treeData.tree as any[]).filter(
        (item: any) => item.type === 'blob' && !item.path.startsWith(prefix)
      ).map((item: any) => ({ path: item.path, mode: item.mode, type: item.type, sha: item.sha }));

      const newTree = await gh('/git/trees', {
        method: 'POST',
        body: JSON.stringify({ tree: remaining }),
      });
      const newCommit = await gh('/git/commits', {
        method: 'POST',
        body: JSON.stringify({
          message: `Unpublish story map: ${map.title} (${slug})`,
          tree: newTree.sha,
          parents: [parentSha],
        }),
      });
      await gh(`/git/refs/heads/${BRANCH}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: newCommit.sha }),
      });
      return json({ ok: true });
    }

    // ── Download chapter images ───────────────────────────────
    const imageFiles: Record<string, Uint8Array> = {};   // localName → bytes
    const imageUrlMap: Map<string, string> = new Map();  // originalUrl → ./images/localName

    const chapters = JSON.parse(JSON.stringify(storyConfig?.chapters ?? []));
    for (const ch of chapters) {
      if (!ch.image || !ch.image.startsWith('http')) continue;
      const ext = ch.image.split('.').pop()?.split('?')[0] || 'jpg';
      const localName = `chapter-${ch.id}-image.${ext}`;
      try {
        const resp = await fetch(ch.image);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        imageFiles[localName] = new Uint8Array(await resp.arrayBuffer());
        imageUrlMap.set(ch.image, `./images/${localName}`);
        ch.image = `./images/${localName}`;
      } catch (e) {
        console.warn(`[publish] image fetch failed for chapter ${ch.id}:`, e);
      }
    }

    // ── Generate storyConfig.js ──────────────────────────────
    const expandedChapters = chapters.map((ch: any) => {
      const expanded: any = {};
      for (const [layerId, state] of Object.entries(ch.layers ?? {})) {
        const meta = userMeta.find((m: any) => m.id === layerId);
        if (meta?.style === 'polygon' || meta?.category === 'polygon') {
          expanded[`${layerId}-fill`]    = { ...(state as any), opacity: (state as any).opacity };
          expanded[`${layerId}-outline`] = { visible: (state as any).visible, opacity: 1, color: (state as any).strokeColor ?? (state as any).color, strokeWidth: (state as any).strokeWidth };
        } else {
          expanded[layerId] = state;
        }
      }
      return { ...ch, layers: expanded };
    });

    const storyConfigJs = `const storyConfig = ${JSON.stringify({ chapters: expandedChapters }, null, 2)};\n\nif (typeof module !== 'undefined' && module.exports) { module.exports = storyConfig; }\n`;

    // ── Generate mapConfig.js ────────────────────────────────
    // Build sources/layers arrays identical to the editor's generateMapConfigString.
    // Rasters keep their Supabase remoteUrl (too large for GitHub).
    // User-uploaded vectors point to ./layers/{filename}.
    // Core/remote vectors keep their original URL.
    const CORE_DATA_BASE = 'https://mod-foundation.github.io/download_center/data/';

    const sources: any = {};
    const layers: any[] = [];

    for (const m of userMeta) {
      const isCore   = m.remoteUrl?.startsWith(CORE_DATA_BASE);
      const isRaster = m.category === 'raster';

      if (isRaster) {
        // Keep Supabase URL for rasters
        const url = m.remoteUrl ?? m.blobUrl ?? '';
        sources[m.sourceId] = { type: 'raster', url: `cog://${url}`, tileSize: 256 };
        layers.push({ id: m.id, type: 'raster', source: m.sourceId });
      } else {
        // Vector — core layers keep their URL, user layers point local
        const dataUrl = isCore ? (m.remoteUrl ?? '') : `./layers/${m.filename}`;
        sources[m.sourceId] = { type: 'geojson', data: dataUrl };

        if (m.category === 'labels') {
          layers.push({ id: m.id, type: 'symbol', source: m.sourceId,
            layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Bold'], 'text-size': 15, 'text-anchor': 'left', 'text-allow-overlap': true, 'text-transform': 'uppercase', 'text-offset': [0.5, 0] },
            paint: { 'text-color': '#0d6aff', 'text-halo-color': '#f9ea46', 'text-halo-width': 6 },
          });
        } else if (m.category === 'viewpoints') {
          layers.push({ id: m.id, type: 'symbol', source: m.sourceId,
            layout: { 'icon-image': 'viewpoint-icon', 'icon-size': 0.15, 'icon-rotation-alignment': 'map', 'icon-rotate': ['get', 'angle'], 'icon-allow-overlap': true },
            paint: { 'icon-opacity': 1 },
          });
        } else if (m.category === 'polygon') {
          layers.push({ id: `${m.id}-fill`,    type: 'fill', source: m.sourceId, paint: { 'fill-color': m.color ?? '#3388ff', 'fill-opacity': 0.4 } });
          layers.push({ id: `${m.id}-outline`, type: 'line', source: m.sourceId, paint: { 'line-color': m.strokeColor ?? m.color ?? '#3388ff', 'line-width': m.strokeWidth ?? 1 } });
        } else if (m.category === 'line') {
          layers.push({ id: m.id, type: 'line', source: m.sourceId, paint: { 'line-color': m.color ?? '#3388ff', 'line-width': m.strokeWidth ?? 2 } });
        } else {
          layers.push({ id: m.id, type: 'circle', source: m.sourceId, paint: { 'circle-color': m.color ?? '#3388ff', 'circle-radius': 5 } });
        }
      }
    }

    const exportMapConfig = {
      initialView:     mapConfig?.initialView     ?? { center: [0, 20], zoom: 2 },
      defaultBasemap:  mapConfig?.defaultBasemap  ?? 'satellite',
      basemaps:        mapConfig?.basemaps        ?? {},
      sources,
      layers,
      userLayersMeta:  userMeta,
    };

    const mapConfigJs = `const MAPBOX_TOKEN = '${mapConfig?.basemaps?.satellite?.tiles?.[0]?.match(/access_token=([^&]+)/)?.[1] ?? 'YOUR_MAPBOX_TOKEN_HERE'}';\n\nconst mapConfig = ${JSON.stringify(exportMapConfig, null, 2)};\n\nif (typeof module !== 'undefined' && module.exports) { module.exports = mapConfig; }\n`;

    // ── Download user-uploaded vector layers ─────────────────
    const layerFiles: Record<string, Uint8Array> = {};  // filename → bytes
    for (const m of userMeta) {
      const isCore   = m.remoteUrl?.startsWith(CORE_DATA_BASE);
      const isRaster = m.category === 'raster';
      if (isCore || isRaster || !m.remoteUrl || !m.filename) continue;
      try {
        const resp = await fetch(m.remoteUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        layerFiles[m.filename] = new Uint8Array(await resp.arrayBuffer());
      } catch (e) {
        console.warn(`[publish] layer fetch failed for ${m.filename}:`, e);
      }
    }

    // ── Fetch static viewer templates from GitHub ────────────
    const RAW = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${BRANCH}`;
    const [indexHtml, viewerJs, styleCSS, viewpointPng, quoteIconPng] = await Promise.all([
      fetch(`${RAW}/standalone/index.html`).then(r => r.text()),
      fetch(`${RAW}/standalone/viewer.js`).then(r => r.text()),
      fetch(`${RAW}/viewer/story-style.css`).then(r => r.text()),
      fetch(`${RAW}/images/viewpoint.png`).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
      fetch(`${RAW}/images/quote-icon.png`).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    ]);

    // ── Build file list for GitHub commit ────────────────────
    const base = `published/${slug}`;

    interface FileEntry { content: string | Uint8Array; binary: boolean; }
    const filesToPush: Record<string, FileEntry> = {
      [`${base}/index.html`]:       { content: indexHtml,      binary: false },
      [`${base}/viewer.js`]:        { content: viewerJs,       binary: false },
      [`${base}/story-style.css`]:  { content: styleCSS,       binary: false },
      [`${base}/storyConfig.js`]:   { content: storyConfigJs,  binary: false },
      [`${base}/mapConfig.js`]:     { content: mapConfigJs,    binary: false },
    };

    filesToPush[`${base}/images/viewpoint.png`]  = { content: viewpointPng,  binary: true };
    filesToPush[`${base}/images/quote-icon.png`] = { content: quoteIconPng, binary: true };

    for (const [name, bytes] of Object.entries(imageFiles)) {
      filesToPush[`${base}/images/${name}`] = { content: bytes, binary: true };
    }
    for (const [name, bytes] of Object.entries(layerFiles)) {
      filesToPush[`${base}/layers/${name}`] = { content: bytes, binary: true };
    }

    // ── Push via GitHub Git Tree API ─────────────────────────
    const gh = makeGh();

    // 1. Get current branch tip
    const refData   = await gh(`/git/ref/heads/${BRANCH}`);
    const parentSha = refData.object.sha as string;
    const commitData = await gh(`/git/commits/${parentSha}`);
    const baseTreeSha = commitData.tree.sha as string;

    // 2. Create blobs
    const treeItems: any[] = [];
    for (const [filePath, { content, binary }] of Object.entries(filesToPush)) {
      let b64: string;
      if (binary) {
        const bytes = content as Uint8Array;
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        b64 = btoa(bin);
      } else {
        b64 = btoa(unescape(encodeURIComponent(content as string)));
      }
      const blob = await gh('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: b64, encoding: 'base64' }),
      });
      treeItems.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 3. Create tree
    const newTree = await gh('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });

    // 4. Create commit
    const newCommit = await gh('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: `Publish story map: ${map.title} (${slug})`,
        tree: newTree.sha,
        parents: [parentSha],
      }),
    });

    // 5. Advance branch ref
    await gh(`/git/refs/heads/${BRANCH}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    const publishedUrl = `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}/published/${slug}/`;
    return json({ url: publishedUrl });

  } catch (err: any) {
    console.error('[publish-to-github]', err);
    return json({ error: err.message ?? 'Internal error' }, 500);
  }
});

function makeGh() {
  return (path: string, opts?: RequestInit) =>
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...(opts?.headers ?? {}),
      },
    }).then(async r => {
      const body = await r.json();
      if (!r.ok) throw new Error(`GitHub ${r.status}: ${JSON.stringify(body)}`);
      return body;
    });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

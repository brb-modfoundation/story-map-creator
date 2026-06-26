# Story Map Creator — Project Guide

## What is it?

The Story Map Creator is a browser-based tool for building, previewing, and publishing interactive story maps. Each map is a scrollable narrative that flies the user through geographic locations chapter by chapter, with configurable map layers, images, quotes, and descriptions. Maps are edited in the browser, saved to Supabase, and published as self-contained static files on GitHub Pages — no server required to view a published map.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Map rendering | [MapLibre GL JS](https://maplibre.org/) |
| Raster data | [MapLibre COG Protocol](https://github.com/makinacorpus/maplibre-cog-protocol) (Cloud-Optimized GeoTIFF) |
| Auth & database | [Supabase](https://supabase.com/) (Auth + PostgreSQL) |
| File storage | Supabase Storage |
| Serverless functions | Supabase Edge Functions (Deno runtime) |
| Publishing | GitHub API → GitHub Pages |
| Frontend | Plain HTML + JavaScript, no build step |
| Fonts & icons | Google Fonts (Poppins, Roboto Condensed, Open Sans), Material Icons |

---

## Folder & File Reference

```
story-map-creator/
├── dashboard.html                    Sign-in/sign-up screen + map management grid
├── index.html                        Redirects to dashboard.html
│
├── config/
│   ├── mapConfig.js                  Seed map config — basemap definitions, Mapbox token,
│   │                                 empty sources/layers arrays
│   ├── storyConfig.js                Seed story config — empty chapters array
│   └── supabase.js                   Supabase client initialisation, uploadDataset(),
│                                     slugify() utility
│
├── db/
│   ├── supabase-setup.sql            Creates the story_maps table and Row Level Security policies
│   └── storage-setup.sql            Creates the datasets storage bucket and access policies
│
├── editor/
│   ├── editor.html                   Editor UI — split-pane layout: map on the right,
│   │                                 chapter/layer panel on the left
│   ├── editor.js                     Core editor logic — chapter CRUD, layer controls,
│   │                                 map view capture, layer visibility per chapter
│   ├── editor-cloud.js               Supabase integration — save/load map, publish/unpublish,
│   │                                 MOD Foundation data catalog, file uploads
│   └── editor.css                    Editor-specific styles
│
├── viewer/
│   ├── view.html                     Preview viewer — loads map live from Supabase DB
│   ├── view.js                       Viewer logic for preview mode (reads from Supabase)
│   └── story-style.css               Shared styles used by both preview and published viewer
│
├── standalone/
│   ├── index.html                    HTML template copied into every published map folder
│   └── viewer.js                     Standalone viewer — reads mapConfig and storyConfig
│                                     as plain JS globals, no Supabase dependency
│
├── images/
│   ├── viewpoint.png                 Icon rendered on the map for viewpoint markers
│   └── quote-icon.png                Decorative icon used alongside chapter quotes
│
├── supabase/
│   ├── config.toml                   Supabase project configuration
│   └── functions/
│       └── publish-to-github/
│           └── index.ts              Edge Function — bundles the map into static files
│                                     and commits them to the GitHub repo
│
└── published/
    └── {slug}/                       One folder per published map, served via GitHub Pages
        ├── index.html                Viewer entry point (copy of standalone/index.html)
        ├── viewer.js                 Viewer logic (copy of standalone/viewer.js)
        ├── story-style.css           Viewer styles
        ├── mapConfig.js              Complete map config — basemaps, sources, layers,
        │                             userLayersMeta, viewpointIconB64 (PNG embedded as base64)
        ├── storyConfig.js            Complete story — all chapters with content and
        │                             per-chapter layer states
        ├── images/                   Chapter images, viewpoint.png, quote-icon.png
        └── layers/                   User-uploaded GeoJSON files
```

---

## Database & Storage

### story_maps table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| title | text | Map title |
| slug | text | URL-safe identifier (unique) |
| story_config | JSONB | All chapters — content, images, per-chapter layer states |
| map_config | JSONB | Basemaps, sources, layers, userLayersMeta |
| published | boolean | Draft vs published |
| created_at / updated_at | timestamp | Auto-managed |

**Row Level Security:** owners can create/read/update/delete their own maps. Anyone can read rows where `published = true`.

### datasets storage bucket

- Public bucket — no auth required to read
- Path structure: `{userId}/{timestamp}-{filename}`
- Holds user-uploaded GeoJSON, raster files, chapter images, legend images
- Public URL pattern: `https://{supabase-url}/storage/v1/object/public/datasets/{path}`

---

## How to Use It

### Step 1 — Sign in

Open `dashboard.html`. Sign up with email + password on first use, then sign in. The dashboard shows all your maps as cards with their publish status.

### Step 2 — Create a map

Click **New Map**, enter a title. A new record is created in Supabase and the editor opens at `editor/editor.html?mapId={id}`.

### Step 3 — Add layers

In the editor's **Layers** panel:

- Browse the **MOD Foundation data catalog** — preloaded open datasets (DEMs, cantonments, lakes, etc.) available as COG rasters or GeoJSON
- Or click **Upload** to add your own GeoJSON or raster file

Layer categories and what they render as:

| Category | MapLibre layer type |
|----------|-------------------|
| raster | `raster` (COG via protocol) |
| polygon | `fill` + `line` (two sub-layers) |
| line | `line` |
| point | `circle` |
| labels | `symbol` (text) |
| viewpoints | `symbol` (viewpoint icon) |

### Step 4 — Build chapters

Click **Add Chapter**. For each chapter:

- Enter **title**, **description**, **quote**, **year**, **image** (upload or URL)
- Navigate the map to the right position, zoom, bearing, and pitch — then click **Set View**
- In the layers list, toggle each layer **on/off** and set its **opacity** for this chapter
- Repeat for all chapters

The editor auto-saves to Supabase after each change.

### Step 5 — Preview

Click **View** on the dashboard (or in the editor). The preview viewer at `viewer/view.html?mapId={id}` loads your map live from Supabase. Navigate through the chapters, test layer toggles, image zoom, and transitions.

### Step 6 — Publish

Click **Publish** on the dashboard card. The Supabase Edge Function runs and:

1. Bundles all map data into static files
2. Commits them to `published/{slug}/` in the GitHub repo
3. Returns the public URL: `https://{owner}.github.io/{repo}/published/{slug}/`

The map is now publicly accessible — no login required. GitHub Pages serves the static files directly.

### Step 7 — Unpublish

Click **Unpublish**. The Edge Function removes the `published/{slug}/` folder from GitHub. The map reverts to draft status.

---

## How Publishing Works (Technical Detail)

The Edge Function at `supabase/functions/publish-to-github/index.ts` runs the following steps:

1. **Auth** — verifies the Supabase JWT from the request header
2. **Load map** — fetches the map row from `story_maps` (title, slug, story_config, map_config)
3. **Download chapter images** — fetches each `ch.image` URL and saves as `images/chapter-{id}-image.{ext}`; rewrites the path to `./images/...` in storyConfig
4. **Download vector layers** — fetches user-uploaded GeoJSON files from Supabase storage
5. **Fetch viewer templates** — pulls `standalone/index.html`, `standalone/viewer.js`, `viewer/story-style.css`, `images/viewpoint.png`, `images/quote-icon.png` from GitHub raw
6. **Build `mapConfig.js`** — assembles sources and layers from userLayersMeta; embeds viewpoint PNG as base64 (`viewpointIconB64`) so the viewer can load it synchronously without a fetch
7. **Build `storyConfig.js`** — serialises all chapters with resolved local image paths and expanded polygon layer ids (`{id}-fill`, `{id}-outline`)
8. **Commit to GitHub** — uses the Git Tree API to create blobs, a tree, and a commit; advances the branch ref
9. **Return** — sends back the public GitHub Pages URL; dashboard marks the map as published

---

## Color System

| Variable | Hex | Used for |
|----------|-----|---------|
| `--primary-blue` | `#0d6aff` | Links, highlights, active states |
| Dark navy | `#071f78` | Headers, dark backgrounds |
| Bright yellow | `#f9ea46` | CTA buttons, key accents |
| `--mint-green` | `#85fbeb` | Borders, secondary highlights |
| Sky blue | `#68c2fb` | Secondary accents |
| `--text-primary` | `#111827` | Body text |
| `--text-secondary` | `#6b7280` | Labels, captions |

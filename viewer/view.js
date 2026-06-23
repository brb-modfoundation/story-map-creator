import { supabase } from '../config/supabase.js';

// Register COG protocol
maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);

// ── Module-level state (mirrors main.js globals) ──────────────────────────────
let _storyConfig        = null;
let _mapConfig          = null;
let map                 = null;
let currentLayerManager = null;
let activeChapterName   = '';
let activeChapterIndex  = 0;
let previousLayerState  = {};
let savedOpacities      = {};
let isHoldingMap        = false;

// ── Supabase data load ────────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const slug   = params.get('id');
const mapId  = params.get('mapId');  // preview mode — bypasses published check

let query = supabase
  .from('story_maps')
  .select('title, story_config, map_config, published');

if (mapId) {
  query = query.eq('id', mapId);
} else {
  query = query.eq('slug', slug).eq('published', true);
}

const { data, error } = await query.single();

if (error || !data) {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('error-screen').style.display = 'flex';
} else {
  document.title = (data.title || 'Story Map') + ' — Story Map';
  _storyConfig = data.story_config ?? {};
  _mapConfig   = data.map_config   ?? {};
  initMap();
}

// ── Map initialization ────────────────────────────────────────────────────────
function initMap() {
  const bm = _mapConfig.basemaps?.[_mapConfig.defaultBasemap] ?? {
    tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
    tileSize: 256,
    attribution: '© Google'
  };

  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      glyphs: 'https://cdn.jsdelivr.net/gh/openmaptiles/fonts@gh-pages/{fontstack}/{range}.pbf',
      sources: {},
      layers: []
    },
    center:           _mapConfig.initialView?.center ?? [0, 20],
    zoom:             _mapConfig.initialView?.zoom   ?? 5,
    scrollZoom:       false,
    boxZoom:          false,
    doubleClickZoom:  true,
    touchZoomRotate:  false,
    dragRotate:       false,
    touchPitch:       false
  });

  // Preload viewpoint icon
  const viewpointImg = new Image();
  viewpointImg.crossOrigin = 'anonymous';
  viewpointImg.onload = () => {
    if (map.loaded() && !map.hasImage('viewpoint-icon')) {
      map.addImage('viewpoint-icon', viewpointImg);
    }
  };
  viewpointImg.src = '../images/viewpoint.png';

  map.on('styleimagemissing', (e) => {
    if (e.id === 'viewpoint-icon' && viewpointImg.complete && viewpointImg.naturalWidth > 0) {
      if (!map.hasImage(e.id)) map.addImage(e.id, viewpointImg);
    }
  });

  // Navigation control — moved into top-right grid (matches main.js)
  const navControl = new maplibregl.NavigationControl();
  map.addControl(navControl, 'top-right');
  setTimeout(() => {
    const navControlElement = document.querySelector('.maplibregl-ctrl-top-right');
    const instructionsPanel = document.getElementById('instructions-panel');
    if (navControlElement && instructionsPanel) {
      const controlGroup = navControlElement.querySelector('.maplibregl-ctrl-group');
      if (controlGroup) instructionsPanel.insertAdjacentElement('afterend', controlGroup);
    }
  }, 100);

  // Click-and-hold to reveal basemap under raster layers
  function handleMapHoldStart(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    isHoldingMap = true;
    savedOpacities = {};
    map.getStyle().layers.forEach(layer => {
      if (layer.type === 'raster' && layer.id !== 'basemap-layer' && layer.id !== 'satellite-layer' && layer.id !== 'osm-place-labels') {
        const visibility = map.getLayoutProperty(layer.id, 'visibility');
        if (visibility === 'visible' || visibility === undefined) {
          const currentOpacity = map.getPaintProperty(layer.id, 'raster-opacity') || 1;
          savedOpacities[layer.id] = currentOpacity;
          map.setPaintProperty(layer.id, 'raster-opacity', 0.1);
        }
      }
    });
  }
  function handleMapHoldEnd() {
    if (!isHoldingMap) return;
    isHoldingMap = false;
    Object.keys(savedOpacities).forEach(id => map.setPaintProperty(id, 'raster-opacity', savedOpacities[id]));
    savedOpacities = {};
  }
  map.getCanvas().addEventListener('mousedown', handleMapHoldStart);
  map.getCanvas().addEventListener('mouseup', handleMapHoldEnd);
  map.getCanvas().addEventListener('touchstart', handleMapHoldStart, { passive: true });
  map.getCanvas().addEventListener('touchend', handleMapHoldEnd, { passive: true });
  map.getCanvas().addEventListener('mouseleave', handleMapHoldEnd);

  map.on('load', () => {
    map.loadImage('../images/viewpoint.png', (err, img) => {
      if (!err && img) map.addImage('viewpoint-icon', img);
    });
    addAllLayers();
    document.getElementById('loading-screen').style.display = 'none';
    initScrollytelling();
  });
}

// ── Add sources and layers ────────────────────────────────────────────────────
function addAllLayers() {
  const bm = _mapConfig.basemaps?.[_mapConfig.defaultBasemap] ?? {
    tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
    tileSize: 256,
    attribution: '© Google'
  };

  // Basemap as satellite-layer (matches storyConfig layer key convention)
  if (!map.getSource('satellite')) {
    map.addSource('satellite', {
      type: 'raster',
      tiles: bm.tiles ?? ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
      tileSize: bm.tileSize ?? 256,
      attribution: bm.attribution ?? '© Google'
    });
    map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite', paint: { 'raster-opacity': 1 } });
  }

  // Additional sources from map config
  if (_mapConfig.sources) {
    Object.entries(_mapConfig.sources).forEach(([sourceId, sourceConfig]) => {
      if (!map.getSource(sourceId)) map.addSource(sourceId, sourceConfig);
    });
  }

  const labelsMetaIds = new Set(
    (_mapConfig.userLayersMeta ?? []).filter(m => m.category === 'labels').map(m => m.id)
  );
  const labelsSubLayerPattern = /^.+-ch\d+$|^\d+-label$/;

  // Additional layers from map config (skip labels — added last so they render on top)
  if (_mapConfig.layers) {
    _mapConfig.layers.forEach(layerConfig => {
      if (labelsMetaIds.has(layerConfig.id)) return;       // already added as base layer
      if (labelsSubLayerPattern.test(layerConfig.id)) return; // skip old sub-layers
      if (map.getLayer(layerConfig.id)) return;
      const layerWithTransition = { ...layerConfig, paint: { ...(layerConfig.paint ?? {}) } };
      const t = layerWithTransition.type;
      if (t === 'raster') layerWithTransition.paint['raster-opacity-transition'] = { duration: 1500 };
      else if (t === 'line')   layerWithTransition.paint['line-opacity-transition']   = { duration: 1500 };
      else if (t === 'fill')   layerWithTransition.paint['fill-opacity-transition']   = { duration: 1500 };
      else if (t === 'symbol') {
        layerWithTransition.paint['icon-opacity-transition'] = { duration: 1500 };
        layerWithTransition.paint['text-opacity-transition'] = { duration: 1500 };
      }
      map.addLayer(layerWithTransition);
    });
    // Hide all non-labels user layers initially
    _mapConfig.layers.forEach(l => {
      if (labelsSubLayerPattern.test(l.id)) return;
      if (map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
    });
  }

  // Add labels last so they render on top of all other layers
  (_mapConfig.userLayersMeta ?? []).filter(m => m.category === 'labels').forEach(meta => {
    if (map.getSource(meta.sourceId) && !map.getLayer(meta.id)) {
      map.addLayer({
        id: meta.id, type: 'symbol', source: meta.sourceId,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold'],
          'text-size': 17,
          'text-anchor': 'left',
          'text-allow-overlap': true,
          'text-optional': true,
          'text-padding': 8,
          'text-justify': 'left',
          'text-transform': 'uppercase',
          'text-offset': [0.5, 0],
        },
        paint: {
          'text-color': '#0d6aff',
          'text-halo-color': '#f9ea46',
          'text-halo-width': 8,
          'text-halo-blur': 5,
          'text-opacity-transition': { duration: 1500 },
        },
      });
      map.setLayoutProperty(meta.id, 'visibility', 'none');
    }
  });

  // Add viewpoints last (on top of labels)
  (_mapConfig.userLayersMeta ?? []).filter(m => m.category === 'viewpoints').forEach(meta => {
    if (map.getSource(meta.sourceId) && !map.getLayer(meta.id)) {
      map.addLayer({
        id: meta.id, type: 'symbol', source: meta.sourceId,
        layout: {
          'icon-image': 'viewpoint-icon',
          'icon-size': 0.25,
          'icon-rotation-alignment': 'map',
          'icon-rotate': ['get', 'angle'],
          'icon-allow-overlap': true,
        },
        paint: { 'icon-opacity': 1, 'icon-opacity-transition': { duration: 1500 } },
      });
      map.setLayoutProperty(meta.id, 'visibility', 'none');
    }
  });
}

// ── Number animation with slide-up effect ────────────────────────────────────
function animateNumber(element, fromValue, toValue, duration) {
  if (!toValue || toValue === fromValue) {
    element.textContent = toValue;
    element.removeAttribute('data-animating');
    return;
  }
  element.setAttribute('data-animating', 'true');
  const origPosition = element.style.position;
  const origOverflow = element.style.overflow;
  if (!origPosition || origPosition === 'static') element.style.position = 'relative';
  element.style.overflow = 'hidden';

  const oldNum = document.createElement('div');
  oldNum.textContent = fromValue || '';
  oldNum.style.cssText = `position:absolute;top:0;left:0;right:0;text-align:inherit;transition:transform ${duration}ms ease-out,opacity ${duration}ms ease-out;`;

  const newNum = document.createElement('div');
  newNum.textContent = toValue;
  newNum.style.cssText = `text-align:inherit;transform:translateY(100%);opacity:0;transition:transform ${duration}ms ease-out,opacity ${duration}ms ease-out;`;

  element.textContent = '';
  element.appendChild(oldNum);
  element.appendChild(newNum);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    oldNum.style.transform = 'translateY(-100%)';
    oldNum.style.opacity   = '0';
    newNum.style.transform = 'translateY(0)';
    newNum.style.opacity   = '1';
  }));

  setTimeout(() => {
    element.textContent = toValue;
    element.removeAttribute('data-animating');
    if (!origPosition || origPosition === 'static') element.style.position = '';
    element.style.overflow = origOverflow || '';
  }, duration);
}

// ── Image popup (click-and-hold) ──────────────────────────────────────────────
function showImagePopup(imageSrc, imageAlt, imageCaption) {
  const popup = document.createElement('div');
  popup.id = 'image-popup';
  popup.className = 'image-popup';

  const popupContent = document.createElement('div');
  popupContent.className = 'image-popup-content';

  const enlargedImg = document.createElement('img');
  enlargedImg.src = imageSrc;
  enlargedImg.alt = imageAlt;
  enlargedImg.className = 'image-popup-img';
  popupContent.appendChild(enlargedImg);

  if (imageCaption) {
    const caption = document.createElement('div');
    caption.className = 'image-popup-caption';
    caption.textContent = imageCaption;
    popupContent.appendChild(caption);
  }

  popup.appendChild(popupContent);
  document.body.appendChild(popup);

  const closeOnInteraction = () => {
    closeImagePopup();
    document.removeEventListener('mouseup', closeOnInteraction);
    document.removeEventListener('touchend', closeOnInteraction);
  };
  document.addEventListener('mouseup', closeOnInteraction);
  document.addEventListener('touchend', closeOnInteraction, { passive: true });
  document.addEventListener('keydown', handleEscapeKey);

  setTimeout(() => popup.classList.add('active'), 10);
}

function closeImagePopup() {
  const popup = document.getElementById('image-popup');
  if (popup) {
    popup.classList.remove('active');
    setTimeout(() => {
      popup.remove();
      document.removeEventListener('keydown', handleEscapeKey);
    }, 300);
  }
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') closeImagePopup();
}

// ── Layer manager ─────────────────────────────────────────────────────────────
function updateLayerManager(chapter) {
  if (currentLayerManager) {
    map.removeControl(currentLayerManager);
    currentLayerManager = null;
  }

  // Core layer display names (matches main.js)
  const layerNames = {
    "satellite-layer": "Satellite",
    "dem-colored-layer": "Digital Elevation Model",
    "1854-map": "Historical Map (1854)",
    "1870-map": "Historical Map (1870)",
    "1884-map": "Historical Map (1884)",
    "1884-ulsoor-map": "Historical Map (1884)",
    "1884-barracks-map": "Historical Map (1884)",
    "1898-map": "Historical Map (1898)",
    "1897-city-map": "Historical Map (1897)",
    "1897-cantonment-map": "Historical Map (1897)",
    "1937-map": "Historical Map (1937)",
    "1964-map": "Historical Map (1964)",
    "1984-map": "Historical Map (1984)",
    "2004-map": "Historical Map (2004)",
    "1854-boundary-line": "1854 Boundary",
    "cantonment-boundary": "Cantonment Boundary",
    "fort-boundary": "Fort Boundary",
    "1897-boundary": "1897 Boundary",
    "drainage-boundary": "Drainage Boundary",
    "drain-lines": "Drain Lines",
    "tanks-1854": "Traced Lakes",
    "tanks-1870": "Traced Lakes",
    "ulsoor-stormwater": "Stormwater Drain",
  };

  // Also include any user-uploaded layer names from map config metadata
  (_mapConfig.layers ?? []).forEach(l => {
    if (!layerNames[l.id]) {
      layerNames[l.id] = l.metadata?.name ?? l.id;
    }
  });

  const visibleLayers = [];
  if (chapter.layers) {
    Object.keys(chapter.layers).forEach(layerId => {
      const layerConfig = chapter.layers[layerId];
      const isVisible = typeof layerConfig === 'boolean' ? layerConfig : layerConfig.visible;
      if (isVisible && layerNames[layerId]) {
        visibleLayers.push({ id: layerId, name: layerNames[layerId], visible: true });
      }
    });
  }

  if (visibleLayers.length > 0) {
    currentLayerManager = new LayerManager({
      layers: visibleLayers,
      position: "top-left",
      collapsed: true,
    });
    map.addControl(currentLayerManager, 'top-left');
  }
}

// ── Scrollytelling ────────────────────────────────────────────────────────────
function initScrollytelling() {
  const chapters      = _storyConfig.chapters ?? [];
  const storyContainer = document.getElementById('story');

  chapters.forEach((chapter, index) => {
    const chapterDiv = document.createElement('div');
    chapterDiv.id = chapter.id;
    const alignment = chapter.alignment || 'center';
    chapterDiv.className = `chapter align-${alignment}`;
    chapterDiv.dataset.chapterIndex = index;

    const isTitle = chapter.chapterType === 'title' || chapter.isTitleSlide;
    const isImage = chapter.chapterType === 'image';

    if (isTitle) {
      chapterDiv.classList.add('title-slide');

      const titleSlideWrapper = document.createElement('div');
      titleSlideWrapper.className = 'title-slide-wrapper';

      const titlesDiv = document.createElement('div');
      titlesDiv.className = 'title-slide-titles';

      if (chapter.subtitle) {
        const subtitle1 = document.createElement('h1');
        subtitle1.className = 'title-slide-subtitle1';
        subtitle1.textContent = chapter.subtitle;
        titlesDiv.appendChild(subtitle1);
      }

      const title = document.createElement('h1');
      title.className = 'title-slide-title';
      title.textContent = chapter.title;
      titlesDiv.appendChild(title);

      if (chapter.subtitle2) {
        const subtitle2 = document.createElement('h2');
        subtitle2.className = 'title-slide-subtitle2';
        subtitle2.textContent = chapter.subtitle2;
        titlesDiv.appendChild(subtitle2);
      }

      titleSlideWrapper.appendChild(titlesDiv);

      const defaultInstructions = [
        'Click and Hold the Map to view present-day satellite imagery',
        'Click and Hold an image to enlarge it',
      ];
      const instructionLines = (chapter.instructions && chapter.instructions.length > 0)
        ? chapter.instructions
        : defaultInstructions;
      const instructionsDiv = document.createElement('div');
      instructionsDiv.className = 'title-slide-instructions';
      instructionLines.forEach(instruction => {
        const p = document.createElement('p');
        p.textContent = instruction;
        instructionsDiv.appendChild(p);
      });
      titleSlideWrapper.appendChild(instructionsDiv);

      const buttonDiv = document.createElement('div');
      buttonDiv.className = 'title-slide-button-container';
      const diveInButton = document.createElement('button');
      diveInButton.className = 'dive-in-button';
      diveInButton.textContent = 'Dive In';
      diveInButton.addEventListener('click', () => {
        const firstReal = document.getElementById(chapters.find(c => c.chapterType !== 'title' && !c.isTitleSlide)?.id);
        if (firstReal) firstReal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      buttonDiv.appendChild(diveInButton);
      titleSlideWrapper.appendChild(buttonDiv);
      chapterDiv.appendChild(titleSlideWrapper);

    } else {
      const chapterWrapper = document.createElement('div');
      chapterWrapper.className = 'chapter-wrapper';

      // Text content
      const contentDiv = document.createElement('div');
      contentDiv.className = 'chapter-content';

      const title = document.createElement('h2');
      title.innerHTML = chapter.title.replace(/\n/g, '<br>');
      contentDiv.appendChild(title);

      if (chapter.description) {
        const description = document.createElement('p');
        description.innerHTML = chapter.description
          .replace(/\n/g, '<br>')
          .replace(/<light>(.*?)<\/light>/g, '<span class="highlight-text">$1</span>');
        contentDiv.appendChild(description);
      }

      if (chapter.descriptionSource) {
        const descSource = document.createElement('h4');
        descSource.className = 'chapter-source';
        descSource.textContent = chapter.descriptionSource;
        contentDiv.appendChild(descSource);
      }

      if (chapter.quote) {
        const quote = document.createElement('blockquote');
        quote.className = 'chapter-quote';
        quote.innerHTML = chapter.quote
          .replace(/\n/g, '<br>')
          .replace(/<light>(.*?)<\/light>/g, '<span class="highlight-text">$1</span>');
        contentDiv.appendChild(quote);
      }

      if (chapter.quoteSource) {
        const quoteSource = document.createElement('h4');
        quoteSource.className = 'quote-source';
        quoteSource.textContent = chapter.quoteSource;
        contentDiv.appendChild(quoteSource);
      }

      chapterWrapper.appendChild(contentDiv);

      // Image with click-and-hold to enlarge (not shown for image chapters — image fills full canvas)
      if (chapter.image && !isImage) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'chapter-image';

        const img = document.createElement('img');
        img.src = chapter.image;
        img.alt = chapter.title;
        img.style.cursor = 'pointer';

        let holdTimer;
        function startImageHold(e) {
          e.preventDefault();
          holdTimer = setTimeout(() => showImagePopup(chapter.image, chapter.title, chapter.imageCaption), 200);
        }
        function cancelImageHold() { clearTimeout(holdTimer); }
        img.addEventListener('mousedown', startImageHold);
        img.addEventListener('mouseup', cancelImageHold);
        img.addEventListener('mouseleave', cancelImageHold);
        img.addEventListener('touchstart', startImageHold, { passive: false });
        img.addEventListener('touchend', cancelImageHold);
        img.addEventListener('touchcancel', cancelImageHold);

        imageDiv.appendChild(img);

        if (chapter.imageCaption) {
          const caption = document.createElement('h4');
          caption.className = 'chapter-image-caption';
          caption.textContent = chapter.imageCaption;
          imageDiv.appendChild(caption);
        }

        chapterWrapper.appendChild(imageDiv);
      }

      // Button on last chapter
      if (index === chapters.length - 1 && chapter.buttonText) {
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'chapter-button-container';
        const button = document.createElement('a');
        button.className = 'chapter-button';
        button.textContent = chapter.buttonText;
        if (chapter.buttonUrl) {
          button.href = chapter.buttonUrl;
          button.target = '_blank';
          button.rel = 'noopener noreferrer';
        } else {
          button.style.cursor = 'default';
        }
        buttonDiv.appendChild(button);
        chapterWrapper.appendChild(buttonDiv);
      }

      chapterDiv.appendChild(chapterWrapper);
    }

    storyContainer.appendChild(chapterDiv);
  });

  // IntersectionObserver for scroll detection
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const chapterIndex = parseInt(entry.target.dataset.chapterIndex);
        const chapter = chapters[chapterIndex];
        if (activeChapterName !== chapter.id) {
          activeChapterName  = chapter.id;
          activeChapterIndex = chapterIndex;
          setActiveChapter(chapter);
          updateArrowVisibility();
        }
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -20% 0px' });

  document.querySelectorAll('.chapter').forEach(ch => observer.observe(ch));

  // Activate first chapter on load
  if (chapters.length > 0) {
    activeChapterIndex = 0;
    activeChapterName  = chapters[0].id;
    setActiveChapter(chapters[0]);
  }

  setupNextChapterArrow();
}

function setupNextChapterArrow() {
  const chapters = _storyConfig.chapters ?? [];
  const arrow = document.getElementById('scroll-indicator');
  arrow.addEventListener('click', () => {
    const nextIndex = activeChapterIndex + 1;
    if (nextIndex < chapters.length) {
      const next = document.getElementById(chapters[nextIndex].id);
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  updateArrowVisibility();
  initChapterNavigation();
}

function initChapterNavigation() {
  const chapters = _storyConfig.chapters ?? [];
  const navMenu  = document.getElementById('chapter-nav-menu');
  const navButton = document.getElementById('chapter-nav-button');

  chapters.forEach((chapter, index) => {
    const navItem = document.createElement('div');
    navItem.className = 'chapter-nav-item';
    navItem.dataset.chapterIndex = index;

    const number = document.createElement('span');
    number.className = 'chapter-nav-item-number';
    number.textContent = `${chapter.id}.`;

    const title = document.createElement('span');
    title.className = 'chapter-nav-item-title';
    title.textContent = chapter.title;

    navItem.appendChild(number);
    navItem.appendChild(title);
    navMenu.appendChild(navItem);

    navItem.addEventListener('click', () => {
      activeChapterIndex = index;
      activeChapterName  = chapter.id;
      setActiveChapter(chapter);
      updateArrowVisibility();
      const target = document.querySelector(`[data-chapter-index="${index}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      navMenu.classList.add('hidden');
    });
  });

  navButton.addEventListener('click', () => navMenu.classList.toggle('hidden'));
  document.addEventListener('click', (e) => {
    if (!document.getElementById('chapter-nav-widget').contains(e.target)) {
      navMenu.classList.add('hidden');
    }
  });

  updateChapterNavigationCounter();
}

function updateArrowVisibility() {
  const chapters = _storyConfig.chapters ?? [];
  const arrow = document.getElementById('scroll-indicator');
  if (activeChapterIndex >= chapters.length - 1) {
    arrow.classList.add('hidden');
  } else {
    arrow.classList.remove('hidden');
  }
}

// ── setActiveChapter — mirrors main.js exactly ────────────────────────────────
function setActiveChapter(chapter) {
  const chapters = _storyConfig.chapters ?? [];

  // Highlight active chapter card
  document.querySelectorAll('.chapter').forEach(ch => ch.classList.remove('active'));
  const activeElement = document.getElementById(chapter.id);
  if (activeElement) activeElement.classList.add('active');

  // Animate year display
  const yearValue = document.getElementById('year-value');
  const currentYear = yearValue.textContent;
  if (chapter.year && chapter.year !== currentYear) {
    animateNumber(yearValue, currentYear, chapter.year, 1500);
  } else if (!chapter.year) {
    yearValue.textContent = '';
  }

  // Animate population display
  const populationValue = document.getElementById('population-value');
  const currentPopulation = populationValue.textContent;
  if (chapter.population && chapter.population !== currentPopulation) {
    animateNumber(populationValue, currentPopulation, chapter.population, 1500);
  } else if (!chapter.population) {
    populationValue.textContent = '';
  }

  // UI show/hide
  const instructionsPanel = document.getElementById('instructions-panel');
  const infoIcon          = document.getElementById('info-icon');
  const scrollIndicator   = document.getElementById('scroll-indicator');
  const chapterNavWidget  = document.getElementById('chapter-nav-widget');
  const mapLegend         = document.getElementById('map-legend');
  const topLeftInfo       = document.getElementById('top-left-info');
  const topRightControls  = document.getElementById('top-right-controls');

  const chIsTitle = chapter.chapterType === 'title' || chapter.isTitleSlide;
  const chIsImage = chapter.chapterType === 'image';

  // Image canvas: show for image chapters, hide otherwise
  const imageCanvas     = document.getElementById('image-canvas');
  const imageCanvasBack = document.getElementById('image-canvas-back');
  if (imageCanvas) {
    if (chIsImage && chapter.image) {
      const newBg = `url('${chapter.image}')`;
      if (imageCanvas.style.backgroundImage === newBg) {
        // Same image — just ensure it's visible
        imageCanvas.style.opacity = '1';
      } else if (parseFloat(imageCanvas.style.opacity) > 0) {
        // Different image currently visible — true crossfade: old stays solid, new fades in on top
        imageCanvasBack.style.backgroundImage = imageCanvas.style.backgroundImage;
        imageCanvasBack.style.opacity = '1';
        // Set new image on front canvas at opacity 0 first, then fade it in
        imageCanvas.style.backgroundImage = newBg;
        imageCanvas.style.opacity = '0';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          imageCanvas.style.opacity = '1';
          // Once front is fully faded in, clean up back canvas
          setTimeout(() => { imageCanvasBack.style.opacity = '0'; }, 2000);
        }));
      } else {
        // Coming from a non-image chapter — simple fade in
        imageCanvas.style.backgroundImage = newBg;
        imageCanvas.style.opacity = '1';
        imageCanvasBack.style.opacity = '0';
      }
    } else {
      imageCanvas.style.opacity = '0';
      imageCanvasBack.style.opacity = '0';
    }
  }

  if (chIsTitle) {
    if (instructionsPanel) instructionsPanel.classList.add('hidden');
    if (infoIcon)          infoIcon.classList.add('hidden');
    if (scrollIndicator)   scrollIndicator.style.display = 'none';
    if (chapterNavWidget)  chapterNavWidget.style.display = 'none';
    if (topLeftInfo)       topLeftInfo.style.display = 'none';
    if (topRightControls)  topRightControls.style.display = 'none';
  } else {
    if (scrollIndicator)  scrollIndicator.style.display = '';
    if (chapterNavWidget) chapterNavWidget.style.display = '';
    if (topLeftInfo)      topLeftInfo.style.display = '';
    if (topRightControls) topRightControls.style.display = '';

    const isSmallScreen = window.innerWidth <= 600;
    if (activeChapterIndex <= 2 && !isSmallScreen) {
      if (instructionsPanel) instructionsPanel.classList.remove('hidden');
      if (infoIcon)          infoIcon.classList.add('hidden');
    } else {
      if (instructionsPanel) instructionsPanel.classList.add('hidden');
      if (infoIcon)          infoIcon.classList.remove('hidden');
    }
  }

  // Legend visibility (show only for chapter id === '2')
  if (mapLegend) {
    mapLegend.style.display = chapter.id === '2' ? 'block' : 'none';
  }

  // Map animation — skip for image chapters (no map movement)
  if (chIsImage) {
    updateLayerManager(chapter);
    if (chapter.onChapterEnter) chapter.onChapterEnter.forEach(cb => { if (typeof cb === 'function') cb(); });
    updateChapterNavigationCounter();
    return;
  }

  if (chapter.bounds) {
    let boundsToUse = chapter.bounds;
    const w = window.innerWidth;
    if (w <= 400 && chapter.boundsMobile)                       boundsToUse = chapter.boundsMobile;
    else if (w > 400  && w <= 768  && chapter.boundsIpadPortrait) boundsToUse = chapter.boundsIpadPortrait;
    else if (w > 768  && w <= 1024 && chapter.boundsIpad)         boundsToUse = chapter.boundsIpad;

    map.fitBounds(boundsToUse, {
      pitch:    chapter.pitch    || 0,
      bearing:  chapter.bearing  || 0,
      duration: chapter.duration || 2000,
      essential: true,
      padding: 0,
    });
  } else if (chapter.center) {
    map.flyTo({
      center:   chapter.center,
      zoom:     chapter.zoom,
      pitch:    chapter.pitch    || 0,
      bearing:  chapter.bearing  || 0,
      duration: chapter.duration || 2000,
      essential: true
    });
  }

  // Labels + viewpoints: filter to active chapter and show, regardless of chapter.layers config
  const chapterIndex = parseInt(chapter.id);
  (_mapConfig.userLayersMeta ?? []).filter(m => m.category === 'labels' || m.category === 'viewpoints').forEach(meta => {
    if (!map.getLayer(meta.id)) return;
    map.setFilter(meta.id, ['==', ['to-number', ['get', 'chapter']], chapterIndex]);
    map.setLayoutProperty(meta.id, 'visibility', 'visible');
  });

  // Hide layers from previous chapter that are not in this chapter
  Object.keys(previousLayerState).forEach(layerId => {
    if (previousLayerState[layerId] && !chapter.layers?.[layerId]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none');
      previousLayerState[layerId] = false;
    }
  });

  // Layer visibility with smooth opacity transitions
  if (chapter.layers) {
    Object.keys(chapter.layers).forEach(layerId => {
      const layerConfig    = chapter.layers[layerId];
      const shouldBeVisible = typeof layerConfig === 'boolean' ? layerConfig : layerConfig.visible;
      const targetOpacity   = typeof layerConfig === 'object'  ? (layerConfig.opacity ?? 1) : 1;
      const wasVisible      = previousLayerState[layerId] || false;

      if (map.getLayer(layerId)) {
        const layerType = map.getLayer(layerId).type;
        // Apply chapter filter for labels layers
        if (typeof layerConfig === 'object' && 'chapterFilter' in layerConfig) {
          if (layerConfig.chapterFilter != null) {
            map.setFilter(layerId, ['==', ['to-number', ['get', 'chapter']], layerConfig.chapterFilter]);
          } else {
            map.setFilter(layerId, null); // title slide: show all labels
          }
        }
        map.setLayoutProperty(layerId, 'visibility', shouldBeVisible ? 'visible' : 'none');

        let opacityProp;
        if (layerType === 'raster') opacityProp = 'raster-opacity';
        else if (layerType === 'line')   opacityProp = 'line-opacity';
        else if (layerType === 'fill')   opacityProp = 'fill-opacity';
        else if (layerType === 'circle') opacityProp = 'circle-opacity';
        else if (layerType === 'symbol') opacityProp = 'text-opacity';

        if (opacityProp) {
          if (shouldBeVisible && !wasVisible) {
            map.setPaintProperty(layerId, opacityProp, 0);
            setTimeout(() => map.setPaintProperty(layerId, opacityProp, targetOpacity), 50);
          } else if (shouldBeVisible && wasVisible) {
            map.setPaintProperty(layerId, opacityProp, targetOpacity);
          }
        }

        // Apply per-chapter color and strokeWidth overrides
        if (typeof layerConfig === 'object' && shouldBeVisible) {
          if (layerConfig.color) {
            if (layerType === 'line') map.setPaintProperty(layerId, 'line-color', layerConfig.color);
            else if (layerType === 'fill') map.setPaintProperty(layerId, 'fill-color', layerConfig.color);
            else if (layerType === 'circle') map.setPaintProperty(layerId, 'circle-color', layerConfig.color);
          }
          if (layerConfig.strokeWidth && layerType === 'line') {
            map.setPaintProperty(layerId, 'line-width', layerConfig.strokeWidth);
          }
          if (layerType === 'circle') {
            if (layerConfig.strokeColor) map.setPaintProperty(layerId, 'circle-stroke-color', layerConfig.strokeColor);
            if (layerConfig.radius != null) map.setPaintProperty(layerId, 'circle-radius', layerConfig.radius);
            if (targetOpacity != null) map.setPaintProperty(layerId, 'circle-opacity', targetOpacity);
          }
        }
      }

      previousLayerState[layerId] = shouldBeVisible;
    });
  }

  updateLayerManager(chapter);

  // onChapterEnter callbacks
  if (chapter.onChapterEnter) {
    chapter.onChapterEnter.forEach(cb => { if (typeof cb === 'function') cb(); });
  }

  updateChapterNavigationCounter();
}

function updateChapterNavigationCounter() {
  const chapters   = _storyConfig.chapters ?? [];
  const navCounter = document.getElementById('chapter-nav-counter');
  if (!navCounter || activeChapterIndex === null) return;

  const currentChapter = chapters[activeChapterIndex];
  if (currentChapter?.chapterType === 'title' || currentChapter?.isTitleSlide) {
    navCounter.textContent = '';
    return;
  }

  const totalChapters = chapters.filter(ch => ch.chapterType !== 'title' && !ch.isTitleSlide).length;
  navCounter.textContent = `${currentChapter?.id}/${totalChapters}`;

  document.querySelectorAll('.chapter-nav-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.chapterIndex) === activeChapterIndex);
  });
}

// ── Info icon toggle — mirrors main.js exactly ────────────────────────────────
const infoIcon          = document.getElementById('info-icon');
const instructionsPanel = document.getElementById('instructions-panel');

if (infoIcon && instructionsPanel) {
  infoIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    if (instructionsPanel.classList.contains('hidden')) {
      instructionsPanel.classList.remove('hidden');
      instructionsPanel.classList.add('expanded');
    } else {
      instructionsPanel.classList.add('hidden');
      instructionsPanel.classList.remove('expanded');
    }
  });

  document.addEventListener('click', (e) => {
    if (instructionsPanel.classList.contains('expanded') &&
        !instructionsPanel.contains(e.target) &&
        !infoIcon.contains(e.target)) {
      instructionsPanel.classList.add('hidden');
      instructionsPanel.classList.remove('expanded');
    }
  });
}

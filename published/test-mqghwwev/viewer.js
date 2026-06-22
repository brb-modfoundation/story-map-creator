// Standalone viewer — reads from storyConfig and mapConfig globals (no Supabase)

maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);

let _storyConfig        = null;
let _mapConfig          = null;
let map                 = null;
let currentLayerManager = null;
let activeChapterName   = '';
let activeChapterIndex  = 0;
let previousLayerState  = {};
let savedOpacities      = {};
let isHoldingMap        = false;

if (typeof storyConfig === 'undefined' || typeof mapConfig === 'undefined') {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('error-screen').style.display = 'flex';
} else {
  _storyConfig = storyConfig;
  _mapConfig   = mapConfig;
  const titleChapter = _storyConfig.chapters?.find(c => c.chapterType === 'title' || c.isTitleSlide);
  if (titleChapter?.title) document.title = titleChapter.title + ' — Story Map';
  initMap();
}

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
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {},
      layers: []
    },
    center:          _mapConfig.initialView?.center ?? [0, 20],
    zoom:            _mapConfig.initialView?.zoom   ?? 5,
    scrollZoom:      false,
    boxZoom:         false,
    doubleClickZoom: true,
    touchZoomRotate: false,
    dragRotate:      false,
    touchPitch:      false
  });

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
    addAllLayers();
    document.getElementById('loading-screen').style.display = 'none';
    initScrollytelling();
  });
}

function addAllLayers() {
  const bm = _mapConfig.basemaps?.[_mapConfig.defaultBasemap] ?? {
    tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
    tileSize: 256,
    attribution: '© Google'
  };

  if (!map.getSource('satellite')) {
    map.addSource('satellite', {
      type: 'raster',
      tiles: bm.tiles ?? ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
      tileSize: bm.tileSize ?? 256,
      attribution: bm.attribution ?? '© Google'
    });
    map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite', paint: { 'raster-opacity': 1 } });
  }

  if (_mapConfig.sources) {
    Object.entries(_mapConfig.sources).forEach(([sourceId, sourceConfig]) => {
      if (!map.getSource(sourceId)) map.addSource(sourceId, sourceConfig);
    });
  }

  if (_mapConfig.layers) {
    _mapConfig.layers.forEach(layerConfig => {
      if (map.getLayer(layerConfig.id)) return;
      const layerWithTransition = { ...layerConfig, paint: { ...(layerConfig.paint ?? {}) } };
      const t = layerWithTransition.type;
      if (t === 'raster') layerWithTransition.paint['raster-opacity-transition'] = { duration: 1500 };
      else if (t === 'line')   layerWithTransition.paint['line-opacity-transition']   = { duration: 1500 };
      else if (t === 'fill')   layerWithTransition.paint['fill-opacity-transition']   = { duration: 1500 };
      else if (t === 'symbol') layerWithTransition.paint['icon-opacity-transition']   = { duration: 1500 };
      map.addLayer(layerWithTransition);
    });
    _mapConfig.layers.forEach(l => {
      if (map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
    });
  }
}

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

function updateLayerManager(chapter) {
  if (currentLayerManager) {
    map.removeControl(currentLayerManager);
    currentLayerManager = null;
  }

  const layerNames = {};
  (_mapConfig.layers ?? []).forEach(l => {
    layerNames[l.id] = l.metadata?.name ?? l.id;
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
      position: 'top-left',
      collapsed: true,
    });
    map.addControl(currentLayerManager, 'top-left');
  }
}

function initScrollytelling() {
  const chapters = _storyConfig.chapters ?? [];
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

      if (chapter.instructions && chapter.instructions.length > 0) {
        const instructionsDiv = document.createElement('div');
        instructionsDiv.className = 'title-slide-instructions';
        chapter.instructions.forEach(instruction => {
          const p = document.createElement('p');
          p.textContent = instruction;
          instructionsDiv.appendChild(p);
        });
        titleSlideWrapper.appendChild(instructionsDiv);
      }

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
  const chapters  = _storyConfig.chapters ?? [];
  const navMenu   = document.getElementById('chapter-nav-menu');
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
  arrow.classList.toggle('hidden', activeChapterIndex >= chapters.length - 1);
}

function setActiveChapter(chapter) {
  const chapters = _storyConfig.chapters ?? [];

  document.querySelectorAll('.chapter').forEach(ch => ch.classList.remove('active'));
  const activeElement = document.getElementById(chapter.id);
  if (activeElement) activeElement.classList.add('active');

  const yearValue = document.getElementById('year-value');
  const currentYear = yearValue.textContent;
  if (chapter.year && chapter.year !== currentYear) {
    animateNumber(yearValue, currentYear, chapter.year, 1500);
  } else if (!chapter.year) {
    yearValue.textContent = '';
  }

  const populationValue = document.getElementById('population-value');
  const currentPopulation = populationValue.textContent;
  if (chapter.population && chapter.population !== currentPopulation) {
    animateNumber(populationValue, currentPopulation, chapter.population, 1500);
  } else if (!chapter.population) {
    populationValue.textContent = '';
  }

  const instructionsPanel = document.getElementById('instructions-panel');
  const infoIcon          = document.getElementById('info-icon');
  const scrollIndicator   = document.getElementById('scroll-indicator');
  const chapterNavWidget  = document.getElementById('chapter-nav-widget');
  const mapLegend         = document.getElementById('map-legend');
  const topLeftInfo       = document.getElementById('top-left-info');
  const topRightControls  = document.getElementById('top-right-controls');

  const chIsTitle = chapter.chapterType === 'title' || chapter.isTitleSlide;
  const chIsImage = chapter.chapterType === 'image';

  const imageCanvas     = document.getElementById('image-canvas');
  const imageCanvasBack = document.getElementById('image-canvas-back');
  if (imageCanvas) {
    if (chIsImage && chapter.image) {
      const newBg = `url('${chapter.image}')`;
      if (imageCanvas.style.backgroundImage === newBg) {
        imageCanvas.style.opacity = '1';
      } else if (parseFloat(imageCanvas.style.opacity) > 0) {
        imageCanvasBack.style.backgroundImage = imageCanvas.style.backgroundImage;
        imageCanvasBack.style.opacity = '1';
        imageCanvas.style.backgroundImage = newBg;
        imageCanvas.style.opacity = '0';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          imageCanvas.style.opacity = '1';
          setTimeout(() => { imageCanvasBack.style.opacity = '0'; }, 1600);
        }));
      } else {
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

  if (mapLegend) {
    mapLegend.style.display = chapter.id === '2' ? 'block' : 'none';
  }

  if (chIsImage) {
    updateLayerManager(chapter);
    if (chapter.onChapterEnter) chapter.onChapterEnter.forEach(cb => { if (typeof cb === 'function') cb(); });
    updateChapterNavigationCounter();
    return;
  }

  if (chapter.bounds) {
    let boundsToUse = chapter.bounds;
    const w = window.innerWidth;
    if (w <= 400 && chapter.boundsMobile)                        boundsToUse = chapter.boundsMobile;
    else if (w > 400  && w <= 768  && chapter.boundsIpadPortrait) boundsToUse = chapter.boundsIpadPortrait;
    else if (w > 768  && w <= 1024 && chapter.boundsIpad)         boundsToUse = chapter.boundsIpad;

    map.fitBounds(boundsToUse, {
      pitch:    chapter.pitch   || 0,
      bearing:  chapter.bearing || 0,
      duration: chapter.duration || 2000,
      essential: true,
      padding: 0,
    });
  } else if (chapter.center) {
    map.flyTo({
      center:   chapter.center,
      zoom:     chapter.zoom,
      pitch:    chapter.pitch   || 0,
      bearing:  chapter.bearing || 0,
      duration: chapter.duration || 2000,
      essential: true
    });
  }

  Object.keys(previousLayerState).forEach(layerId => {
    if (previousLayerState[layerId] && !chapter.layers?.[layerId]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none');
      previousLayerState[layerId] = false;
    }
  });

  if (chapter.layers) {
    Object.keys(chapter.layers).forEach(layerId => {
      const layerConfig     = chapter.layers[layerId];
      const shouldBeVisible = typeof layerConfig === 'boolean' ? layerConfig : layerConfig.visible;
      const targetOpacity   = typeof layerConfig === 'object'  ? (layerConfig.opacity ?? 1) : 1;
      const wasVisible      = previousLayerState[layerId] || false;

      if (map.getLayer(layerId)) {
        const layerType = map.getLayer(layerId).type;
        map.setLayoutProperty(layerId, 'visibility', shouldBeVisible ? 'visible' : 'none');

        let opacityProp;
        if (layerType === 'raster')      opacityProp = 'raster-opacity';
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

        if (typeof layerConfig === 'object' && shouldBeVisible) {
          if (layerConfig.color) {
            if (layerType === 'line')        map.setPaintProperty(layerId, 'line-color', layerConfig.color);
            else if (layerType === 'fill')   map.setPaintProperty(layerId, 'fill-color', layerConfig.color);
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

/* =================================================================
   main.js — everything the portfolio needs, no dependencies.
   Content comes from site.config.json, media from data/gallery.json.
   ================================================================= */

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  config: {}, items: [], categories: [],
  filter: 'all', visible: [], shown: 0,
  lbIndex: -1, lastFocus: null
};

/* ---------- utilities ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Paths come straight off disk, so they can contain spaces, #, ? and unicode.
   encodeURI handles most of it; # and ? have to be done by hand or the browser
   reads them as a fragment / query. */
const mediaURL = (p) => p ? encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F') : p;

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

async function loadJSON(path, fallback) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    console.warn(`[portfolio] could not load ${path}:`, err.message);
    return fallback;
  }
}

/* ---------- small inline icon set for the highlights grid ---------- */
const ICONS = {
  camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-2h5.4l1.1 2h1.7A2.5 2.5 0 0 1 19 8.5v8A2.5 2.5 0 0 1 16.5 19h-11A2.5 2.5 0 0 1 3 16.5Z"/><circle cx="11" cy="12" r="3.2"/>',
  clock:  '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
  spark:  '<path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6l-1.9-5.8L4.3 10.9 10.1 9Z"/><path d="M18.6 3.4v3M20.1 4.9h-3"/>',
  shield: '<path d="M12 3.4 19 6v5.6c0 4-2.9 7.3-7 8.9-4.1-1.6-7-4.9-7-8.9V6Z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
  gallery:'<rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.4"/><circle cx="8.6" cy="10" r="1.5"/><path d="m4.2 16.4 4.3-4 3.3 3 3-2.6 5 4.4"/>',
  film:   '<rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.4"/><path d="M8 5.4v13.2M16 5.4v13.2M3.4 12h17.2"/>',
  heart:  '<path d="M12 19.5s-7-4.3-7-9a3.9 3.9 0 0 1 7-2.4A3.9 3.9 0 0 1 19 10.5c0 4.7-7 9-7 9Z"/>',
  check:  '<circle cx="12" cy="12" r="8.6"/><path d="m8.6 12 2.3 2.3 4.5-4.8"/>'
};
const iconSVG = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>';

/* Instagram -> IG, Behance -> Be … for the round footer badges */
const SOCIAL_ABBR = {
  instagram:'IG', facebook:'FB', twitter:'X', x:'X', youtube:'YT', vimeo:'VM',
  behance:'Be', linkedin:'in', tiktok:'TT', pinterest:'Pi', dribbble:'Dr',
  flickr:'Fl', threads:'Th', whatsapp:'Wa', '500px':'5P'
};
const socialAbbr = (label) =>
  SOCIAL_ABBR[String(label).toLowerCase().trim()] || String(label).slice(0, 2);

const initials = (name) => String(name || '')
  .split(/[\s&]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* =================================================================
   1. CONFIG -> PAGE
   ================================================================= */
function renderConfig(c) {
  const brand = c.brand || {};
  const setAll = (sel, value) => { if (value != null) $$(sel).forEach(n => n.textContent = value); };

  setAll('[data-brand-name]', brand.name);
  setAll('[data-brand-short]', brand.shortName);
  setAll('[data-brand-role]', brand.role);

  if (c.seo?.title) document.title = c.seo.title;
  if (c.seo?.description) $('meta[name="description"]')?.setAttribute('content', c.seo.description);
  if (c.seo?.themeColor) $('meta[name="theme-color"]')?.setAttribute('content', c.seo.themeColor);

  /* --- hero --- */
  const h = c.hero || {};
  setAll('[data-hero-eyebrow]', h.eyebrow);
  if (Array.isArray(h.titleLines) && h.titleLines.length) {
    $('[data-hero-title]').innerHTML = h.titleLines.map(l => `<span class="reveal">${l}</span>`).join('');
  }
  setAll('[data-hero-sub]', h.subtitle);
  if (h.primaryCta) { const a = $('[data-hero-cta1]'); a.textContent = h.primaryCta.label; a.href = h.primaryCta.href; }
  if (h.secondaryCta) { const a = $('[data-hero-cta2]'); a.textContent = h.secondaryCta.label; a.href = h.secondaryCta.href; }

  /* --- stats strip --- */
  const a = c.about || {};
  if (a.stats) {
    $('[data-about-stats]').innerHTML = a.stats.map(s =>
      `<div class="stat"><dt>${esc(s.value)}</dt><dd>${esc(s.label)}</dd></div>`).join('');
  }

  /* --- about --- */
  setAll('[data-about-eyebrow]', a.eyebrow);
  setAll('[data-about-title]', a.title);
  if (a.paragraphs) $('[data-about-text]').innerHTML = a.paragraphs.map(p => `<p>${esc(p)}</p>`).join('');
  if (a.gear) $('[data-about-gear]').innerHTML = a.gear.map(g => `<li>${esc(g)}</li>`).join('');

  // Float the first stat over the portrait, like the reference's "95% investor trust" card.
  const badge = $('[data-about-badge]');
  if (a.stats?.length && badge) {
    badge.innerHTML = `<strong>${esc(a.stats[0].value)}</strong><span>${esc(a.stats[0].label)}</span>`;
    badge.hidden = false;
  }

  const portrait = $('#aboutPortrait');
  portrait.alt = `${brand.name || 'The photographer'} — portrait`;
  portrait.src = mediaURL(a.portrait) || '';
  portrait.addEventListener('error', () => {
    portrait.closest('.about__frame').classList.add('is-missing');
    portrait.remove();
  }, { once: true });

  /* --- highlights --- */
  const hl = c.highlights || {};
  setAll('[data-highlights-eyebrow]', hl.eyebrow);
  setAll('[data-highlights-title]', hl.title);
  setAll('[data-highlights-intro]', hl.intro);
  if (hl.cta) { const b = $('[data-highlights-cta]'); b.textContent = hl.cta.label; b.href = hl.cta.href; }
  if (hl.items) {
    $('[data-highlights-list]').innerHTML = hl.items.map(it => `
      <article class="hl reveal">
        <span class="hl__icon">${iconSVG(it.icon)}</span>
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.text)}</p>
      </article>`).join('');
  }

  /* --- work --- */
  setAll('[data-work-eyebrow]', c.work?.eyebrow);
  setAll('[data-work-title]', c.work?.title);
  setAll('[data-work-intro]', c.work?.intro);

  /* --- services --- */
  const s = c.services || {};
  setAll('[data-services-eyebrow]', s.eyebrow);
  setAll('[data-services-title]', s.title);
  setAll('[data-services-intro]', s.intro);
  if (s.items) {
    $('[data-services-list]').innerHTML = s.items.map(it => `
      <article class="card reveal">
        <div class="card__top">
          <h3 class="card__name">${esc(it.name)}</h3>
        </div>
        <p class="card__sum">${esc(it.summary || '')}</p>
        <ul class="card__list">${(it.features || []).map(f => `<li>${TICK}<span>${esc(f)}</span></li>`).join('')}</ul>
      </article>`).join('');
  }

  /* --- process --- */
  const p = c.process || {};
  setAll('[data-process-eyebrow]', p.eyebrow);
  setAll('[data-process-title]', p.title);
  setAll('[data-process-intro]', p.intro);
  if (p.steps) {
    $('[data-process-list]').innerHTML = p.steps.map((st, i) => `
      <article class="step reveal">
        <span class="step__n">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(st.title)}</h3>
        <p>${esc(st.text)}</p>
      </article>`).join('');
  }

  /* --- testimonials --- */
  const q = c.testimonials || {};
  setAll('[data-quotes-eyebrow]', q.eyebrow);
  setAll('[data-quotes-title]', q.title);
  buildQuotes(q.items || []);

  /* --- faq --- */
  buildFAQ(c.faq || {});

  /* --- closing cta --- */
  const cta = c.cta || {};
  setAll('[data-cta-title]', cta.title);
  setAll('[data-cta-text]', cta.text);
  if (cta.button) { const b = $('[data-cta-button]'); b.textContent = cta.button.label; b.href = cta.button.href; }

  /* --- contact --- */
  const ct = c.contact || {};
  setAll('[data-contact-eyebrow]', ct.eyebrow);
  setAll('[data-contact-title]', ct.title);
  setAll('[data-contact-text]', ct.intro);

  const rows = [];
  if (ct.email) rows.push(`<li><span>Email</span><a href="mailto:${esc(ct.email)}">${esc(ct.email)}</a></li>`);
  if (ct.phone) rows.push(`<li><span>Phone</span><a href="tel:${esc(ct.phone.replace(/\s/g, ''))}">${esc(ct.phone)}</a></li>`);
  if (brand.location) rows.push(`<li><span>Based in</span><strong>${esc(brand.location)}</strong></li>`);
  if (ct.availability) rows.push(`<li><span>Availability</span><strong>${esc(ct.availability)}</strong></li>`);
  $('[data-contact-list]').innerHTML = rows.join('');

  $$('[data-contact-email]').forEach(n => { if (ct.email) { n.href = `mailto:${ct.email}`; n.textContent = ct.email; } });
  $$('[data-contact-phone]').forEach(n => {
    if (ct.phone) { n.href = `tel:${ct.phone.replace(/\s/g, '')}`; n.textContent = ct.phone; }
    else n.remove();
  });
  $('[data-contact-subjects]').innerHTML =
    (ct.subjects || ['General enquiry']).map(x => `<option>${esc(x)}</option>`).join('');

  /* --- socials + footer --- */
  const socials = c.socials || [];
  const full = socials.map(x =>
    `<a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a>`).join('');
  $$('[data-socials]').forEach(n => n.innerHTML = full);
  $$('[data-socials-short]').forEach(n => n.innerHTML = socials.map(x =>
    `<a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(x.label)}">${esc(socialAbbr(x.label))}</a>`).join(''));

  setAll('[data-footer-note]', c.footer?.note);
  setAll('[data-footer-credit]', c.footer?.credit);
  $('#year').textContent = '© ' + new Date().getFullYear();
}

/* =================================================================
   2. HERO BAND — a drifting strip of featured photographs
   ================================================================= */
function buildHeroBand(items) {
  const track = $('#heroTrack');
  if (!track) return;

  let pool = items.filter(i => i.featured);
  if (pool.length < 4) pool = pool.concat(items.filter(i => !i.featured));
  pool = pool.slice(0, 8);
  if (!pool.length) { $('.hero__band').hidden = true; return; }

  // Duplicated once so the -50% keyframe loops seamlessly.
  const make = (item, clone) => {
    const fig = el('button', 'hero__shot');
    fig.type = 'button';
    if (clone) fig.setAttribute('aria-hidden', 'true');
    fig.tabIndex = clone ? -1 : 0;
    fig.setAttribute('aria-label', `Open ${item.title}`);
    const img = el('img');
    img.src = mediaURL(item.thumb || item.poster || item.src);
    img.alt = clone ? '' : item.title;
    img.loading = 'eager';
    img.decoding = 'async';
    fig.appendChild(img);
    fig.addEventListener('click', () => {
      const idx = state.visible.findIndex(v => v.id === item.id);
      if (idx >= 0) openLightbox(idx);
    });
    return fig;
  };

  const frag = document.createDocumentFragment();
  pool.forEach(i => frag.appendChild(make(i, false)));
  pool.forEach(i => frag.appendChild(make(i, true)));
  track.appendChild(frag);

  if (REDUCED) track.style.animation = 'none';
}

/* =================================================================
   3. WORK GRID — filters, masonry spans, lazy tiles
   ================================================================= */
const ROW = 6; // must match grid-auto-rows in the stylesheet

function buildFilters() {
  const wrap = $('#filters');
  const all = [{ id: 'all', label: 'Everything', count: state.items.length }, ...state.categories];
  const videos = state.items.filter(i => i.type === 'video').length;
  if (videos) all.push({ id: '__video', label: 'Video', count: videos });

  wrap.innerHTML = all.map(c => `
    <button class="chip" type="button" role="tab" data-filter="${esc(c.id)}"
            aria-selected="${c.id === 'all'}">${esc(c.label)} <b>${c.count}</b></button>`).join('');

  wrap.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    $$('.chip', wrap).forEach(c => c.setAttribute('aria-selected', String(c === chip)));
    renderGrid(true);
  });
}

function matchesFilter(item) {
  if (state.filter === 'all') return true;
  if (state.filter === '__video') return item.type === 'video';
  return item.category === state.filter;
}

function tileMarkup(item) {
  const src = mediaURL(item.thumb || item.poster || item.src);
  const cat = state.categories.find(c => c.id === item.category)?.label || item.category;
  const play = item.type === 'video'
    ? `<span class="tile__play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>` : '';
  const year = item.year ? `<span>${esc(item.year)}</span>` : '';
  return `
    <img class="tile__img" src="${esc(src)}" alt="${esc(item.title)}"
         width="${item.width}" height="${item.height}" loading="lazy" decoding="async">
    <span class="tile__veil"></span>
    ${play}
    <span class="tile__info">
      <span class="tile__title">${esc(item.title)}</span>
      <span class="tile__cat">${esc(cat)}${year}</span>
    </span>`;
}

function renderGrid(reset = false) {
  const grid = $('#grid');
  const step = state.config.work?.loadMoreStep || 12;
  const initial = state.config.work?.initialCount || 12;

  if (reset) { state.shown = 0; grid.innerHTML = ''; }

  state.visible = state.items.filter(matchesFilter);
  const target = state.shown === 0 ? initial : state.shown + step;
  const slice = state.visible.slice(state.shown, target);

  const frag = document.createDocumentFragment();
  slice.forEach((item, i) => {
    const tile = el('button', 'tile' + (item.wide ? ' is-wide' : ''));
    tile.type = 'button';
    tile.dataset.index = String(state.shown + i);
    tile.setAttribute('aria-label', `Open ${item.title}`);
    tile.style.setProperty('--ratio', item.ratio);
    tile.innerHTML = tileMarkup(item);
    tile.addEventListener('click', () => openLightbox(Number(tile.dataset.index)));
    frag.appendChild(tile);
  });
  grid.appendChild(frag);
  state.shown = Math.min(target, state.visible.length);

  layoutMasonry();
  revealTiles();

  $('#gridEmpty').hidden = state.visible.length > 0;
  $('#loadMore').hidden = state.shown >= state.visible.length;
  $('#gridCount').textContent = state.visible.length
    ? `Showing ${state.shown} of ${state.visible.length}` : '';
}

/* Each tile spans however many 6px rows its aspect ratio needs.
   Ratios come from the manifest, so this runs before any image loads
   and the layout never jumps. */
function layoutMasonry() {
  const grid = $('#grid');
  const tiles = $$('.tile', grid);
  if (!tiles.length) return;

  const styles = getComputedStyle(grid);
  const gap = parseFloat(styles.rowGap) || 0;
  const cols = styles.gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  const colWidth = (grid.clientWidth - gap * (cols - 1)) / cols;

  for (const tile of tiles) {
    const ratio = parseFloat(tile.style.getPropertyValue('--ratio')) || 1.5;
    const isWide = tile.classList.contains('is-wide') && cols > 1;
    const width = isWide ? colWidth * 2 + gap : colWidth;
    const span = Math.max(1, Math.round((width / ratio + gap) / (ROW + gap)));
    tile.style.gridRowEnd = `span ${span}`;
  }
}

function revealTiles() {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add('is-in'), REDUCED ? 0 : i * 50);
      obs.unobserve(entry.target);
    });
  }, { rootMargin: '80px' });
  $$('.tile:not(.is-in)').forEach(t => io.observe(t));
}

/* =================================================================
   4. LIGHTBOX
   ================================================================= */
const lb = {};

function initLightbox() {
  Object.assign(lb, {
    root: $('#lightbox'), media: $('#lbMedia'), title: $('#lbTitle'), sub: $('#lbSub'),
    counter: $('#lbCounter'), open: $('#lbOpen'), prev: $('#lbPrev'), next: $('#lbNext')
  });

  $('#lbClose').addEventListener('click', closeLightbox);
  $$('[data-lb-close]').forEach(n => n.addEventListener('click', closeLightbox));
  lb.prev.addEventListener('click', () => step(-1));
  lb.next.addEventListener('click', () => step(1));

  document.addEventListener('keydown', (e) => {
    if (lb.root.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') trapFocus(e);
  });

  let x0 = null, y0 = null;
  lb.root.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  lb.root.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    x0 = y0 = null;
  }, { passive: true });
}

function trapFocus(e) {
  const f = $$('button, a[href], [tabindex]:not([tabindex="-1"])', lb.root).filter(n => n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function openLightbox(index) {
  state.lastFocus = document.activeElement;
  lb.root.hidden = false;
  document.body.classList.add('is-locked');
  requestAnimationFrame(() => lb.root.classList.add('is-open'));
  showItem(index);
  $('#lbClose').focus({ preventScroll: true });
}

function closeLightbox() {
  lb.root.classList.remove('is-open');
  lb.media.innerHTML = '';                 // stops any playing video immediately
  document.body.classList.remove('is-locked');
  setTimeout(() => { lb.root.hidden = true; }, 340);
  state.lastFocus?.focus?.({ preventScroll: true });
}

function step(dir) {
  const next = state.lbIndex + dir;
  if (next < 0 || next >= state.visible.length) return;
  showItem(next);
}

function showItem(index) {
  const item = state.visible[index];
  if (!item) return;
  state.lbIndex = index;
  lb.media.innerHTML = '';
  lb.root.classList.add('is-loading');

  if (item.type === 'video' && item.provider === 'youtube') {
    lb.media.appendChild(iframeFor(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.videoId)}?autoplay=1&rel=0&modestbranding=1`, item.title));
    lb.root.classList.remove('is-loading');
  } else if (item.type === 'video' && item.provider === 'vimeo') {
    lb.media.appendChild(iframeFor(`https://player.vimeo.com/video/${encodeURIComponent(item.videoId)}?autoplay=1&title=0&byline=0`, item.title));
    lb.root.classList.remove('is-loading');
  } else if (item.type === 'video') {
    const v = el('video');
    v.src = mediaURL(item.src); v.controls = true; v.autoplay = true; v.playsInline = true;
    if (item.poster) v.poster = mediaURL(item.poster);
    v.addEventListener('loadeddata', () => lb.root.classList.remove('is-loading'), { once: true });
    lb.media.appendChild(v);
  } else {
    const img = el('img');
    img.alt = item.title;
    img.decoding = 'async';
    img.addEventListener('load', () => lb.root.classList.remove('is-loading'), { once: true });
    img.addEventListener('error', () => lb.root.classList.remove('is-loading'), { once: true });
    img.src = mediaURL(item.src);            // always the full-resolution file here
    lb.media.appendChild(img);
    preload(index + 1); preload(index - 1);  // make arrow-key browsing feel instant
  }

  const cat = state.categories.find(c => c.id === item.category)?.label || item.category;
  lb.title.textContent = item.title;
  lb.sub.textContent = [cat, item.year, item.type === 'video' ? 'Film' : null].filter(Boolean).join(' · ');
  lb.counter.textContent = `${index + 1} / ${state.visible.length}`;
  lb.open.href = mediaURL(item.src || item.poster) || '#';
  lb.open.hidden = !(item.src || item.poster);
  lb.prev.disabled = index === 0;
  lb.next.disabled = index === state.visible.length - 1;
}

function iframeFor(src, title) {
  const f = el('iframe');
  f.src = src; f.title = title;
  f.allow = 'autoplay; fullscreen; picture-in-picture';
  f.allowFullscreen = true; f.loading = 'eager';
  return f;
}

function preload(i) {
  const item = state.visible[i];
  if (item && item.type === 'photo') new Image().src = mediaURL(item.src);
}

/* =================================================================
   5. TESTIMONIALS
   ================================================================= */
function buildQuotes(list) {
  const viewport = $('#quotesViewport');
  const dots = $('#quoteDots');
  if (!list.length) { $('#testimonials').hidden = true; return; }

  viewport.innerHTML = list.map((q, i) => `
    <figure class="quote${i === 0 ? ' is-active' : ''}">
      <blockquote>“${esc(q.quote)}”</blockquote>
      <figcaption>
        <span class="quote__avatar" aria-hidden="true">${esc(initials(q.author))}</span>
        <span class="quote__who"><b>${esc(q.author)}</b><span>${esc(q.role || '')}</span></span>
      </figcaption>
    </figure>`).join('');
  dots.innerHTML = list.map((_, i) =>
    `<button type="button" aria-label="Quote ${i + 1}" aria-selected="${i === 0}"></button>`).join('');

  const quotes = $$('.quote', viewport);
  const dotEls = $$('button', dots);
  let i = 0, timer;

  const go = (n) => {
    i = (n + quotes.length) % quotes.length;
    quotes.forEach((q, k) => q.classList.toggle('is-active', k === i));
    dotEls.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
  };
  const auto = () => { clearInterval(timer); if (!REDUCED) timer = setInterval(() => go(i + 1), 7000); };

  $('#quotePrev').addEventListener('click', () => { go(i - 1); auto(); });
  $('#quoteNext').addEventListener('click', () => { go(i + 1); auto(); });
  dotEls.forEach((d, k) => d.addEventListener('click', () => { go(k); auto(); }));
  auto();
}

/* Backdrop for the testimonial card — the widest featured photograph. */
function setQuotesBackdrop(items) {
  const img = $('#quotesBg');
  if (!img) return;
  const pick = items.filter(i => i.ratio >= 1.3).sort((a, b) => (b.featured - a.featured))[0] || items[0];
  if (!pick) { img.remove(); return; }
  img.src = mediaURL(pick.thumb || pick.poster || pick.src);
  img.addEventListener('error', () => img.remove(), { once: true });
}

/* =================================================================
   6. FAQ
   ================================================================= */
function buildFAQ(faq) {
  const list = $('[data-faq-list]');
  const items = faq.items || [];
  if (!list) return;
  if (!items.length) { $('#faq').hidden = true; return; }

  const setAll = (sel, v) => { if (v != null) $$(sel).forEach(n => n.textContent = v); };
  setAll('[data-faq-eyebrow]', faq.eyebrow);
  setAll('[data-faq-title]', faq.title);
  setAll('[data-faq-aside-title]', faq.asideTitle);
  if (faq.asideCta) { const b = $('[data-faq-cta]'); b.textContent = faq.asideCta.label; b.href = faq.asideCta.href; }

  list.innerHTML = items.map((it, i) => `
    <div class="faq__item reveal${i === 0 ? ' is-open' : ''}">
      <button class="faq__q" type="button" aria-expanded="${i === 0}" aria-controls="faq-a-${i}">
        <span>${String(i + 1)}.</span>
        <span>${esc(it.q)}</span>
        <span class="faq__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg></span>
      </button>
      <div class="faq__a" id="faq-a-${i}" role="region"><div><p>${esc(it.a)}</p></div></div>
    </div>`).join('');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.faq__q');
    if (!btn) return;
    const item = btn.closest('.faq__item');
    const open = !item.classList.contains('is-open');
    // one at a time, like the reference
    $$('.faq__item', list).forEach(n => {
      n.classList.remove('is-open');
      $('.faq__q', n).setAttribute('aria-expanded', 'false');
    });
    if (open) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
  });
}

/* The oversized ghosted footer wordmark — scaled so any length of name
   spans the width exactly instead of overflowing. */
function fitWordmark() {
  const mark = $('.footer__mark');
  if (!mark || !mark.textContent.trim()) return;
  mark.style.fontSize = '100px';
  const natural = mark.scrollWidth;
  if (!natural) return;
  mark.style.fontSize = Math.max(28, (mark.clientWidth / natural) * 100 * 0.995) + 'px';
}

/* =================================================================
   7. CHROME — header, menu, theme, reveals, form
   ================================================================= */
function initChrome() {
  const header = $('#header');
  const progress = $('#scrollProgress');
  let last = 0;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-stuck', y > 30);
    header.classList.toggle('is-hidden', y > 400 && y > last && !$('#mobileMenu').classList.contains('is-open'));
    last = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* active section in the nav */
  const links = $$('.nav a');
  const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => spy.observe(s));

  /* mobile menu */
  const burger = $('#burger');
  const menu = $('#mobileMenu');
  const toggleMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('is-locked', open);
  };
  burger.addEventListener('click', () => toggleMenu(!menu.classList.contains('is-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => toggleMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) toggleMenu(false); });

  /* theme */
  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
  });

  /* scroll reveals */
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(n => io.observe(n));
  new MutationObserver(() => $$('.reveal:not(.is-in)').forEach(n => io.observe(n)))
    .observe(document.body, { childList: true, subtree: true });

  $('#loadMore').addEventListener('click', () => renderGrid(false));

  let raf;
  const relayout = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { layoutMasonry(); fitWordmark(); });
  };
  addEventListener('resize', relayout);
  document.fonts?.ready.then(relayout);
  fitWordmark();

  initForm();
}

function initForm() {
  const form = $('#contactForm');
  const note = $('#formNote');
  const cfg = state.config.contact || {};
  const email = cfg.email || '';

  note.innerHTML = email
    ? `${esc(cfg.formNote || 'Prefer email? Write to me directly at')} <a href="mailto:${esc(email)}">${esc(email)}</a>`
    : '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    note.className = 'form__note';

    let valid = true;
    $$('.field', form).forEach(f => {
      const input = $('input, textarea, select', f);
      if (!input) return;
      const bad = input.required && !input.checkValidity();
      f.classList.toggle('is-invalid', bad);
      if (bad) valid = false;
    });
    if (!valid) {
      note.className = 'form__note is-err';
      note.textContent = 'Please fill in your name, a valid email and a message.';
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());

    // Option A — a form endpoint (Formspree, Basin, Getform…) is configured
    if (cfg.formAction) {
      note.textContent = 'Sending…';
      try {
        const res = await fetch(cfg.formAction, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
        if (!res.ok) throw new Error('Request failed');
        form.reset();
        note.className = 'form__note is-ok';
        note.textContent = 'Thank you — your message is on its way. I reply within two days.';
      } catch {
        note.className = 'form__note is-err';
        note.innerHTML = `Something went wrong. Please email <a href="mailto:${esc(email)}">${esc(email)}</a> instead.`;
      }
      return;
    }

    // Option B — no endpoint: hand it to the visitor's own mail app
    const body = [
      `Name: ${data.name}`, `Email: ${data.email}`,
      `Enquiry: ${data.subject || '—'}`, `Date: ${data.date || '—'}`, '', data.message
    ].join('\n');
    location.href = `mailto:${email}?subject=${encodeURIComponent(`${data.subject || 'Enquiry'} — ${data.name}`)}&body=${encodeURIComponent(body)}`;
    note.className = 'form__note is-ok';
    note.textContent = 'Your email app should be opening with the message ready to send.';
  });

  $$('.field input, .field textarea', form).forEach(input => {
    input.addEventListener('input', () => input.closest('.field').classList.remove('is-invalid'));
  });
}

/* =================================================================
   8. BOOT
   ================================================================= */
(async function init() {
  const [config, gallery] = await Promise.all([
    loadJSON('site.config.json', {}),
    loadJSON('data/gallery.json', { items: [], categories: [] })
  ]);

  state.config = config;
  state.items = gallery.items || [];
  state.categories = gallery.categories || [];

  renderConfig(config);
  buildFilters();
  renderGrid(true);
  buildHeroBand(state.items);
  setQuotesBackdrop(state.items);
  initLightbox();
  initChrome();

  requestAnimationFrame(() => {
    setTimeout(() => $('#loader').classList.add('is-done'), REDUCED ? 0 : 380);
  });
})();

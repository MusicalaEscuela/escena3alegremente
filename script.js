/****************************************************
 * ALEGREMENTE 2025 – ESCENA 3
 * script.js (completo y mejorado)
 * - Plegables
 * - Audio robusto con múltiples pistas (data-audio)
 * - Visor de Guion (PDF)
 * - Partituras como carpeta (link único)
 * - Filtros + búsqueda con persistencia
 * - Lista de recursos dinámica
 * - Vista previa de imágenes (overlay)
 ****************************************************/

/* Utilidad corta para seleccionar */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* =====================================================================================
   1) PLEGABLES (cards)
===================================================================================== */
function toggle(h){
  const card = h.parentElement;
  const content = card.querySelector('.content');
  const caret = h.querySelector('.caret');
  const open = content.style.display !== 'none';
  content.style.display = open ? 'none' : 'block';
  if (caret) caret.textContent = open ? 'Expandir' : 'Contraer';
}

/* Mostrar todo abierto por defecto */
document.addEventListener('DOMContentLoaded', () => {
  $$('.card .content').forEach(c => c.style.display = 'block');
});

/* =====================================================================================
   2) AUDIO ROBUSTO (autoplay-friendly, múltiples fuentes)
   - Lee data-audio="a.mp3,b.mp3,c.mp3" del <body id="scene3">
   - Intenta reproducir en DOMContentLoaded; si el navegador bloquea,
     cambia estilo del botón y espera interacción (pointerdown/keydown/touchstart)
===================================================================================== */
(function initAudio(){
  const body = document.body;
  if (!body || body.id !== 'scene3') return;

  const audio = $('#sceneAudio');
  const btn   = $('#btnPlay');
  const label = $('#audioLabel');
  if (!audio || !btn) return;

  // Pistas desde data attribute
  const raw = (body.dataset.audio || '').split(',').map(s => s.trim()).filter(Boolean);
  // Fallback por si no hay data-audio
  const sources = raw.length ? raw : ['Siyahamba.mp3', 'Pueblo Tambor.mp3'];

  let idx = 0;
  function setSrc(i){
    // cache buster para evitar problemas de caché durante desarrollo
    const q = `?v=${Date.now()}`;
    audio.src = encodeURI(sources[i]) + q;
    if (label) label.textContent = `🎶 Audio: ${sources[i].replace(/\.(mp3|wav|m4a)$/i,'')}`;
  }
  setSrc(idx);

  function updateBtn(){ btn.textContent = audio.paused ? '▶ Reproducir' : '⏸️ Pausar'; }
  function markBlocked(){
    btn.style.borderColor = '#f59e0b';
    btn.style.boxShadow = '0 0 0 3px rgba(245,158,11,.25)';
    btn.title = 'Tu navegador bloqueó el autoplay. Haz clic para iniciar.';
  }

  async function tryPlay(){
    try{
      await audio.play();
      updateBtn();
    }catch{
      markBlocked(); updateBtn();
    }
  }

  document.addEventListener('DOMContentLoaded', tryPlay);

  const playOnInteract = () => { audio.play().then(updateBtn).catch(()=>{}); };
  window.addEventListener('pointerdown', playOnInteract, { once:true, capture:true });
  window.addEventListener('keydown',     playOnInteract, { once:true, capture:true });
  window.addEventListener('touchstart',  playOnInteract, { once:true, capture:true });

  btn.addEventListener('click', async () => {
    try{
      if (audio.paused) await audio.play(); else audio.pause();
    }catch(e){}
    updateBtn();
  });

  // Cambiar pista si falla la actual
  audio.addEventListener('error', () => {
    if (idx < sources.length - 1){
      idx++; setSrc(idx); tryPlay();
    }else{
      alert('No se pudo cargar ninguna pista de audio. Verifica los archivos.');
    }
  });

  // Atajo con barra espaciadora
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/input|textarea|select/i.test(e.target.tagName)) {
      e.preventDefault();
      if (audio.paused) audio.play().catch(()=>{}); else audio.pause();
      updateBtn();
    }
  });

  // Pausar al cambiar de pestaña
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !audio.paused) audio.pause();
  });
})();

/* =====================================================================================
   3) GUION (PDF) y PARTITURAS (carpeta)
   - El guion se toma de data-guion del <body>
   - El link de partituras se toma de data-scores-url
===================================================================================== */
(function initDocs(){
  const body = document.body;
  if (!body || body.id !== 'scene3') return;

  const guion = body.dataset.guion ? body.dataset.guion.trim() : 'Guión Escena III.pdf';
  const pdfFrame   = $('.pdf-frame');
  const pdfView    = $('#pdfView');
  const pdfDownload= $('#pdfDownload');

  const encoded = encodeURI(guion);
  if (pdfView)     pdfView.href = encoded;
  if (pdfDownload) pdfDownload.href = encoded;

  if (pdfFrame){
    // Intentar cargar; si no está, ocultar iframe
    fetch(encoded, { method:'HEAD' })
      .then(r => {
        if (!r.ok) throw new Error('No disponible');
        pdfFrame.src = encoded + '#toolbar=1&navpanes=0&statusbar=0&view=FitH';
      })
      .catch(() => {
        pdfFrame.style.display = 'none';
        // Si quieres, aquí podrías añadir un fallback de texto.
      });
  }

  // Partituras (carpeta)
  const scoresUrl = (body.dataset.scoresUrl || '').trim();
  const link = $('#allScoresLink');
  if (link){
    link.href = scoresUrl || '#';
    if (!scoresUrl) {
      link.setAttribute('aria-disabled','true');
      link.classList.add('disabled');
      link.textContent = '📂 Carpeta de partituras (pendiente)';
      link.addEventListener('click', (e)=> e.preventDefault());
    }
  }
})();

/* =====================================================================================
   4) FILTROS + BÚSQUEDA + RECURSOS
   - Filtra .card por data-tags, data-centros, data-log y búsqueda de texto
   - Persiste el estado en localStorage
   - Renderiza recursos según filtros activos
===================================================================================== */
(function initFilters(){
  const chips = $$('.chip');
  const cards = $$('.card');
  const q     = $('#q');
  const LS_KEY = 'escena3_filters_v1';

  // Cargar estado previo (si existe)
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch{}

  if (saved){
    // Restaurar estado visual de chips
    chips.forEach(ch => {
      const t = ch.dataset.type;
      if (t === 'area'   && saved.areas?.includes(ch.dataset.area))   ch.classList.add('active');
      if (t === 'centro' && saved.centros?.includes(ch.dataset.centro)) ch.classList.add('active');
      if (t === 'log'    && saved.logs?.includes(ch.dataset.log))     ch.classList.add('active');
    });
    if (q && typeof saved.query === 'string') q.value = saved.query;
  }

  // Recursos base (personalízalos si lo necesitas)
  const RESOURCES = [
    { title: 'Guión Escena 3 (PDF)', href: encodeURI(document.body.dataset.guion || 'Guión Escena III.pdf'), areas: ['teatro','produccion'], type: 'pdf' },
    { title: 'Carpeta de Partituras', href: (document.body.dataset.scoresUrl || '#'), areas: ['musica'], type: 'link' },
    { title: 'Fondo proyectado (JPG)', href: encodeURI(document.body.dataset.fondo || 'Fondo 3.jpg'), areas: ['plastica','luces'], type: 'link' }
  ];
  const ICON = { pdf:'📄', audio:'🎵', sheet:'📊', doc:'📝', link:'🔗' };

  function getState(){
    const areas = chips.filter(c => c.dataset.type==='area'   && c.classList.contains('active')).map(c => c.dataset.area);
    const centros = chips.filter(c => c.dataset.type==='centro' && c.classList.contains('active')).map(c => c.dataset.centro);
    const logs = chips.filter(c => c.dataset.type==='log'    && c.classList.contains('active')).map(c => c.dataset.log);
    return { areas, centros, logs, query: (q && q.value ? q.value.trim() : '') };
  }

  function cardMatches(card, state){
    const tags = (card.dataset.tags || 'general').split(/\s+/);
    const areaOk = (state.areas.length === 0) || state.areas.some(a => tags.includes(a));

    const centrosCard = (card.dataset.centros || '').split(/\s+/).filter(Boolean);
    const centroOk = (state.centros.length === 0) || state.centros.some(c => centrosCard.includes(c));

    const logsCard = (card.dataset.log || '').split(/\s+/).filter(Boolean);
    const logOk = (state.logs.length === 0) || state.logs.some(l => logsCard.includes(l));

    const textOk = (card.textContent||'').toLowerCase().includes(state.query.toLowerCase());
    return areaOk && centroOk && logOk && textOk;
  }

  function renderResources(state){
    let ul = $('#res-list');
    if (!ul){
      // Si no existe un contenedor en el HTML, creamos uno al final de la sección principal
      const section = document.querySelector('main section');
      if (!section) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-tags','produccion general');
      card.innerHTML = `
        <header onclick="toggle(this)"><h2>🔗 Recursos de esta escena</h2><span class="caret">Contraer</span></header>
        <div class="content"><ul id="res-list"></ul></div>`;
      section.appendChild(card);
      ul = $('#res-list');
    }

    const items = RESOURCES.filter(r =>
      (!state.areas.length || r.areas.some(a => state.areas.includes(a)))
    );

    ul.innerHTML = items.map(r =>
      `<li><a href="${r.href}" target="_blank" rel="noreferrer">${ICON[r.type]||ICON.link} ${r.title}</a>
       <small class="muted"> (${r.areas.join(', ')})</small></li>`
    ).join('') || `<li class="muted">No hay recursos para este filtro.</li>`;
  }

  function applyFilters(){
    const state = getState();
    cards.forEach(card => {
      const show = cardMatches(card, state);
      card.style.display = show ? '' : 'none';
    });
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    renderResources(state);
  }

  chips.forEach(chip => chip.addEventListener('click', () => { chip.classList.toggle('active'); applyFilters(); }));
  if (q) q.addEventListener('input', applyFilters);

  document.addEventListener('DOMContentLoaded', () => {
    applyFilters();
  });
})();

/* =====================================================================================
   5) VISTA PREVIA DE IMÁGENES (overlay)
   - Para enlaces con atributo data-preview
===================================================================================== */
(function initImagePreview(){
  function ensureOverlay(){
    let o = $('#imgPreviewOverlay');
    if (!o){
      o = document.createElement('div');
      o.id = 'imgPreviewOverlay';
      Object.assign(o.style, {
        position:'fixed', inset:'0', display:'none', zIndex:'9999',
        background:'rgba(0,0,0,.85)', alignItems:'center', justifyContent:'center'
      });
      const img = document.createElement('img');
      img.alt = 'Vista previa';
      Object.assign(img.style, {
        maxWidth:'90vw', maxHeight:'90vh', borderRadius:'12px',
        boxShadow:'0 10px 30px rgba(0,0,0,.5)'
      });
      o.appendChild(img);
      document.body.appendChild(o);
      o.addEventListener('click', () => o.style.display='none');
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') o.style.display='none'; });
    }
    return o;
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-preview]');
    if (!a) return;
    e.preventDefault();
    const overlay = ensureOverlay();
    overlay.querySelector('img').src = a.getAttribute('href');
    overlay.style.display = 'flex';
  });
})();

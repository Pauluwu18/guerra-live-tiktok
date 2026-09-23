import { defaults, actionNames, validConfig, Battle, limits, giftKey } from './engine.mjs';
import {giftOptions, filterGifts, giftPage, safeImage} from './catalog-utils.mjs';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = null;
let draft = structuredClone(defaults);
let selected = null;
let screen = 'menu';
let catalog = { gifts: [] };
let toastTimer;
// ── ASSET & URL HELPER PARA COMPATIBILIDAD CON GITHUB PAGES ─────────────────
function assetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  // Si comienza con ./ o sin barra, resolver relativo a la ubicación actual
  if (url.startsWith('./')) return url;
  if (url.startsWith('/')) {
    const base = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '');
    return (base ? base : '') + url;
  }
  return './' + url;
}


const query = new URLSearchParams(location.search);
const overlay = query.has('overlay');
const obs = query.has('obs');

function toast(s) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = s;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

let standaloneMode = false;
let localGame = null;
let hasReceivedServerState = false;

async function api(path, data = {}) {
  if (standaloneMode && localGame) {
    if (path === 'start') {
      localGame.start(['boss', 'duel'].includes(data.mode) ? data.mode : 'teams');
      return { ok: true };
    }
    if (path === 'pause') {
      if (localGame.state === 'running') localGame.state = 'paused';
      else if (localGame.state === 'paused') localGame.state = 'running';
      return { ok: true };
    }
    if (path === 'menu') {
      localGame.state = 'menu';
      return { ok: true };
    }
    if (path === 'event') {
      localGame.event(data);
      return { ok: true };
    }
    if (path === 'simulate-gift') {
      const gift = Number.isInteger(data.giftIndex) ? catalog.gifts[data.giftIndex] : null;
      const customRule = typeof data.customGift === 'string' && localGame.config.rules.find(r => r.gift === data.customGift);
      const name = gift?.name || customRule?.gift;
      if (!name) throw Error('Selecciona un regalo del catálogo o de tus canjes.');
      const user = String(data.user || '').trim().replace(/^@/, '').slice(0, 40) || 'Espectador';
      const count = Number(data.count) || 1;
      localGame.event({ type: 'gift', gift: name, user, count, team: data.team === 1 ? 1 : 0 });
      return { ok: true, message: `${count} × ${name} registrado para ${user}!` };
    }
    if (path === 'settings') {
      localGame.config = validConfig(data);
      return { ok: true };
    }
    if (path === 'control') {
      return { ok: true };
    }
    if (path === 'connect' || path === 'disconnect') {
      toast('Para conectar TikTok Live en tiempo real, ejecuta INICIAR.cmd en tu PC.');
      return { ok: false };
    }
    return { ok: true };
  }

  const r = await fetch(assetUrl('/api/' + path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || 'No se pudo completar la acción');
  return j;
}

function action(el, fn) {
  if (!el) return;
  el.onclick = async () => {
    el.disabled = true;
    try {
      await fn();
    } catch (e) {
      toast(e.message);
    } finally {
      el.disabled = false;
    }
  };
}

function show(name) {
  screen = name;
  $$('.screen').forEach(e => e.classList.toggle('hidden', e.id !== name));
  if (name === 'settings') {
    draft = structuredClone(state?.config || defaults);
    renderSettings();
  }
  window.scrollTo(0, 0);
}

action($('#play'), () => show('modes'));
['#settingsMenu', '#settingsTop'].forEach(s => action($(s), () => show('settings')));
$$('.back').forEach(b => action(b, () => show('menu')));

$$('[data-mode]').forEach(b => action(b, async () => {
  await api('start', { mode: b.dataset.mode });
  show('battle');
}));

action($('#pause'), () => api('pause'));
action($('#exit'), async () => {
  await api('menu');
  show('menu');
});
action($('#again'), () => api('start', { mode: state?.mode || 'teams' }));

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Dirección copiada al portapapeles ✓');
  } catch {
    const a = $('#copyFallback');
    a.value = text;
    a.classList.remove('hidden');
    a.focus();
    a.select();
    toast('Copia la dirección seleccionada con Ctrl+C');
  }
}

action($('#copyOverlay'), () => copy(location.origin + '/?overlay=1'));
action($('#openOverlay'), () => window.open('/?overlay=1', 'overlay', 'width=460,height=850'));
action($('#copyBattle'), () => copy(location.origin + '/?obs=1'));

const progressFields = [
  ['likesStep', 'Likes por bloque (ej: 100)'],
  ['damagePercent', 'Daño adicional por bloque (%)'],
  ['healthGain', 'Vida adicional por bloque de likes'],
  ['maxLikeLevels', 'Máximo de bloques por combatiente']
];

const combatFields = [
  ['baseHealth', 'Vida base del caballero'],
  ['baseDamage', 'Daño espada inicial'],
  ['armorGain', 'Armadura otorgada por canje (+armadura)'],
  ['armorCap', 'Límite máximo de armadura'],
  ['steelDamage', 'Daño Espada de Acero'],
  ['royalDamage', 'Daño Espada Real / Mandoble'],
  ['legendDamage', 'Daño Espada Legendaria'],
  ['magicDamage', 'Daño de Habilidad Mágica'],
  ['magicInterval', 'Intervalo habilidad mágica (segundos)'],
  ['meteorDamage', 'Daño del Meteorito de Galaxia'],
  ['reviveHealth', 'Vida otorgada al revivir'],
  ['bossHealth', 'Vida de la Torre del Jefe'],
  ['bossDamage', 'Daño de la Torre del Jefe'],
  ['roundSeconds', 'Duración de ronda (segundos)'],
  ['shieldSeconds', 'Duración de escudo (s)'],
  ['maxShieldSeconds', 'Máximo de escudo (s; luego 6s de recarga)'],
  ['maxRevives', 'Máximo de vidas en reserva'],
  ['magicSeconds', 'Duración de magia por canje (s)'],
  ['maxMagicSeconds', 'Máximo de magia acumulada (s)'],
  ['frenzySeconds', 'Duración de frenesí por 10 rosas extra (s)'],
  ['maxFrenzySeconds', 'Máximo de frenesí acumulado (s)'],
  ['maxChampionWins', 'Victorias que dan bonus al campeón'],
  ['winScore', 'Puntos para ganar la guerra']
];

function fields(items) {
  return items.map(([k, label]) => `
    <label>
      ${label}
      <input data-setting="${k}" type="number" min="${limits[k][0]}" max="${limits[k][1]}" step="${k === 'damagePercent' || k === 'magicInterval' ? '0.5' : '1'}" value="${draft[k] ?? defaults[k]}">
    </label>
  `).join('');
}

function renderSettings() {
  $('#progressFields').innerHTML = fields(progressFields);
  $('#combatFields').innerHTML = fields(combatFields);
  $('#likeScope').value = draft.likeScope || 'individual';
  $('#autoFill').checked = !!draft.autoFill;
  renderRules();
  renderOverlayPreview();
  $('#saveStatus').textContent = '';
}

function renderRules() {
  $('#rules').innerHTML = draft.rules.map((r, i) => `
    <div class="rule" data-index="${i}">
      <input aria-label="Regalo ${i + 1}" list="giftNames" value="${esc(r.gift)}" data-field="gift" placeholder="Nombre de regalo">
      <input aria-label="Cantidad ${i + 1}" type="number" min="1" value="${r.quantity}" data-field="quantity">
      <select aria-label="Recompensa ${i + 1}" data-field="action">
        ${Object.entries(actionNames).map(([k, v]) => `<option value="${k}" ${k === r.action ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <button aria-label="Eliminar canje ${i + 1}" data-remove="${i}">×</button>
    </div>
  `).join('');

  $$('[data-remove]').forEach(b => {
    b.onclick = () => {
      readDraft();
      draft.rules.splice(Number(b.dataset.remove), 1);
      renderRules();
    };
  });
}

function readDraft() {
  $$('[data-setting]').forEach(e => {
    if (!e.checkValidity()) throw Error('Revisa el valor de ' + e.parentElement.textContent);
    draft[e.dataset.setting] = Number(e.value);
  });
  draft.likeScope = $('#likeScope').value;
  draft.autoFill = $('#autoFill').checked;
  draft.rules = $$('.rule').map(el => ({
    gift: el.querySelector('[data-field=gift]').value.trim(),
    quantity: Number(el.querySelector('[data-field=quantity]').value),
    action: el.querySelector('[data-field=action]').value
  }));

  if (draft.rules.some(r => !r.gift || !Number.isFinite(r.quantity) || r.quantity < 1)) {
    throw Error('Cada canje necesita un regalo y una cantidad mayor que cero.');
  }
  if (new Set(draft.rules.map(r => giftKey(r.gift))).size !== draft.rules.length) {
    throw Error('No repitas el mismo regalo en dos reglas distintas.');
  }
}

action($('#addRule'), () => {
  readDraft();
  draft.rules.push({ gift: 'Rose', quantity: 1, action: 'armor' });
  renderRules();
});

action($('#save'), async () => {
  readDraft();
  draft = validConfig(draft);
  await api('settings', draft);
  renderSettings();
  $('#saveStatus').textContent = 'Ajustes guardados ✓';
  renderOverlayPreview();
  toast('Ajustes guardados con éxito');
});

action($('#reset'), () => {
  draft = structuredClone(defaults);
  renderSettings();
  toast('Valores restaurados. Pulsa Guardar para aplicarlos.');
});

function rewardText(r, c) {
  const map = {
    armor: `+${c.armorGain} armadura (máx. ${c.armorCap})`,
    revive: `✨ Revivir: ${c.reviveHealth} HP (máx. ${c.maxRevives} reservas)`,
    steel: `🗡️ Espada de Acero (${c.steelDamage} daño)`,
    royal: `⚔️ Espada Real (${c.royalDamage} daño)`,
    legend: `🔥 Espada Legendaria (${c.legendDamage} daño)`,
    magic: `🔮 Magia ${c.magicSeconds}s (máx. ${c.maxMagicSeconds}s)`,
    meteor: `☄️ ${c.meteorDamage} daño en área (máx. 3 pendientes/bando)`,
    shield: `🛡️ Escudo ${c.shieldSeconds}s (máx. ${c.maxShieldSeconds}s; recarga 6s)`,
    rose: `🌹 20: nivel 10; cada 10 extra: frenesí ${c.frenzySeconds}s (máx. ${c.maxFrenzySeconds}s)`
  };
  return map[r.action] || actionNames[r.action] || r.action;
}

function likeSummary(c) {
  const factor = c.likeScope === 'team' ? (state?.mode === 'boss' ? 30 : state?.mode === 'duel' ? 1 : 20) : 1;
  return `${c.likesStep * factor} likes = +${c.damagePercent}% daño y +${c.healthGain} vida${factor > 1 ? ' por soldado del bando' : ''}. Máximo ${c.maxLikeLevels} bloques por combatiente.`;
}
function rewardCost(r) {
  const gift = catalog.gifts.find(g => giftKey(g.name) === giftKey(r.gift));
  return gift && Number.isFinite(Number(gift.coins)) ? `${Number(gift.coins) * r.quantity} monedas aprox.` : 'Coste por confirmar en LIVE';
}
function rewardRows(c) {
  return c.rules.map(r => `
    <div class="reward-row">
      <span>${r.quantity > 1 ? r.quantity + ' × ' : ''}<b>${esc(r.gift)}</b><br><small>${esc(rewardCost(r))}</small></span>
      <b>${esc(rewardText(r, c))}</b>
    </div>
  `).join('');
}

function renderOverlayPreview() {
  const mult = (draft.damagePercent / 100).toFixed(1);
  $('#overlayPreview').innerHTML = `
    ${rewardRows(draft)}
    <div class="overlay-note">
      ♥ ${esc(likeSummary(draft))}
    </div>
  `;
}

action($('#connect'), async () => {
  toast('Conectando a @' + $('#liveUser').value + '…');
  await api('connect', { user: $('#liveUser').value });
  toast('LIVE conectado');
});
action($('#disconnect'), () => api('disconnect'));

async function loadCatalog() {
  try {
    catalog = await (await fetch(assetUrl('/gifts.json'))).json();
    $('#giftNames').innerHTML = [...new Set(catalog.gifts.map(g => g.name))].map(n => `<option value="${esc(n)}">`).join('');
    $('#catalogInfo').textContent = `${catalog.gifts.length} regalos registrados · ${catalog.region} · Precios de referencia del catálogo local; confirma en tu LIVE.`;
    renderCatalog();
    renderSimOptions();
    if (state) $('#rewards').innerHTML = rewardRows(state.config);
    renderOverlayPreview();
    configFingerprint = '';
  } catch {
    $('#catalogInfo').textContent = 'No se pudo cargar el catálogo. Reintenta recargando la página.';
    renderSimOptions();
  }
}

let catalogPageIndex = 0;
function giftImage(g, eager = false) {
  return `<img class="gift-image" src="${esc(assetUrl(safeImage(g)))}" alt="${esc(g.name)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="64" height="64" referrerpolicy="no-referrer">`;
}
function bindImageFallback(root) {
  root.querySelectorAll('img').forEach(img => {
    img.onerror = () => { img.onerror = null; img.src = assetUrl('/assets/gifts/unavailable.svg'); img.alt += ' — imagen no disponible'; };
  });
}
function currentOptions() { return giftOptions(catalog.gifts, state?.config.rules || defaults.rules); }
function selectedGift() { return currentOptions().find(g => g.key === $('#simGift').value); }
function mappedRule(g) { return (state?.config.rules || defaults.rules).find(r => giftKey(r.gift) === giftKey(g.name)); }
function renderCatalog() {
  const rules = state?.config.rules || defaults.rules;
  const list = filterGifts(giftOptions(catalog.gifts), $('#searchGift').value, $('#catalogSort').value, $('#catalogMapped').checked, rules);
  const page = giftPage(list, catalogPageIndex); catalogPageIndex = page.page;
  $('#catalogList').innerHTML = page.items.length ? page.items.map(g => `
    <article class="gift-card">
      ${giftImage(g)}
      <div class="gift-card-name">${esc(g.name)}</div>
      <b>${Number(g.coins).toLocaleString()} 🪙</b>
      <small class="gift-mapping ${mappedRule(g) ? 'mapped' : ''}">${mappedRule(g) ? 'Canje activo' : 'Sin canje'}</small>
      <button type="button" data-test-gift="${g.index}" aria-label="Probar ${esc(g.name)} (${g.coins} monedas)">Probar</button>
    </article>`).join('') : '<p class="catalog-empty">No hay regalos que coincidan con estos filtros.</p>';
  bindImageFallback($('#catalogList'));
  $('#catalogPage').textContent = `${page.page + 1} / ${page.pages} · ${page.total} regalos`;
  $('#catalogPrev').disabled = page.page === 0;
  $('#catalogNext').disabled = page.page + 1 >= page.pages;
  $('#catalogList').querySelectorAll('[data-test-gift]').forEach(button => {
    button.onclick = () => {
      $('#simGiftSearch').value = ''; renderSimOptions();
      $('#simGift').value = button.dataset.testGift; renderSimPreview();
      show('battle');
      $('#simFeedback').textContent = 'Regalo seleccionado. Revisa la cantidad y pulsa Simular regalo.';
      $('#simGift').closest('details').open = true;
      $('#simGift').scrollIntoView({block:'center'});
    };
  });
}
function renderSimOptions() {
  const previous = $('#simGift').value;
  const all = currentOptions();
  const list = filterGifts(all, $('#simGiftSearch').value);
  $('#simGift').innerHTML = list.map(g => `<option value="${esc(g.key)}">${esc(g.name)} · ${g.coins === null ? 'canje personalizado' : g.coins + ' monedas'}${mappedRule(g) ? ' · con canje' : ''}</option>`).join('');
  if (list.some(g => g.key === previous)) $('#simGift').value = previous;
  else if (!$('#simGiftSearch').value) $('#simGift').value = list.find(g => g.name === 'Rose')?.key || list[0]?.key || '';
  $('#simGiftCount').textContent = `${list.length} de ${all.length} regalos disponibles`;
  renderSimPreview();
}
function renderSimPreview() {
  const g = selectedGift(); const count = Number($('#simCount').value);
  $('#gift').disabled = !g || !Number.isInteger(count) || count < 1 || count > 100000;
  $('#simConfigure').disabled = !g;
  if (!g) { $('#simGiftPreview').textContent = 'Sin resultados. Prueba otro nombre.'; return; }
  const rule = mappedRule(g);
  const total = Number.isInteger(count) && count > 0 && count <= 100000 && g.coins !== null ? (g.coins * count).toLocaleString() : '—';
  $('#simGiftPreview').innerHTML = `${giftImage(g,true)}<div><strong>${esc(g.name)}</strong>
    <p>${g.coins === null ? 'Precio no disponible' : `${g.coins.toLocaleString()} monedas por unidad · Total: <b>${total} monedas</b>`}</p>
    <p>${rule ? `${rule.quantity} × regalo → ${esc(rewardText(rule,state?.config || defaults))}` : 'Sin canje asignado: la prueba registra el regalo sin añadir poder.'}</p>
    <small>Simulación gratuita · precios de referencia · se respetan los límites de combate</small></div>`;
  bindImageFallback($('#simGiftPreview'));
}
$('#searchGift').oninput = () => { catalogPageIndex = 0; renderCatalog(); };
$('#catalogSort').onchange = $('#catalogMapped').onchange = () => { catalogPageIndex = 0; renderCatalog(); };
$('#catalogPrev').onclick = () => { catalogPageIndex--; renderCatalog(); };
$('#catalogNext').onclick = () => { catalogPageIndex++; renderCatalog(); };
$('#simGiftSearch').oninput = renderSimOptions;
$('#simGift').onchange = $('#simCount').oninput = renderSimPreview;
$$('[data-quantity]').forEach(button => { button.onclick = () => { $('#simCount').value = button.dataset.quantity; renderSimPreview(); }; });
action($('#simStart'), async () => { await api('start',{mode:'teams'}); show('battle'); });
action($('#simConfigure'), () => {
  const gift = selectedGift(); if (!gift) return;
  show('settings');
  let index = draft.rules.findIndex(r => giftKey(r.gift) === giftKey(gift.name));
  if (index < 0) { draft.rules.push({gift:gift.name,quantity:1,action:'armor'}); index = draft.rules.length-1; }
  renderRules(); renderOverlayPreview();
  $('#rules').children[index].scrollIntoView({block:'center'});
  $('#rules').children[index].querySelector('select').focus();
  toast('Elige la recompensa y pulsa Guardar Ajustes para activar el canje.');
});

action($('#refreshCatalog'), async () => {
  toast('Consultando catálogo de la sala LIVE…');
  await api('catalog');
  await loadCatalog();
  toast('Catálogo actualizado con éxito');
});

// Laboratorio de simulación
action($('#join'), () => api('event', {
  type: 'join',
  user: $('#simUser').value,
  team: Number($('#simTeam').value)
}));

action($('#like'), () => api('event', {
  type: 'like',
  user: $('#simUser').value,
  team: Number($('#simTeam').value),
  count: state?.config?.likesStep || 100
}));

action($('#gift'), async () => {
  const gift = selectedGift(); if (!gift) throw Error('Selecciona un regalo.');
  try {
    const result = await api('simulate-gift', {
      giftIndex: gift.index, customGift: gift.index === undefined ? gift.name : undefined,
      user: $('#simUser').value, team: Number($('#simTeam').value), count: Number($('#simCount').value)
    });
    $('#simFeedback').textContent = result.message;
  } catch(e) { $('#simFeedback').textContent = e.message; throw e; }
});

if (overlay) {
  document.body.classList.add('overlay');
  const card = document.createElement('div');
  card.className = 'overlay-card';
  card.id = 'liveOverlay';
  document.body.append(card);
}
if (obs) {
  document.body.classList.add('obs');
  show('battle');
}

// Escuchar Server-Sent Events del motor
let configFingerprint = '';

function handleState(newState) {
  const old = state;
  state = newState;
  const c = state.config;

  $('#status').textContent = state.live.state === 'connected'
    ? '● LIVE CONECTADO'
    : '● ' + (state.live.state === 'connecting' ? 'CONECTANDO' : 'MODO DE PRUEBA');

  $('#liveDetails').textContent = state.live.message;
  $('#connect').disabled = state.live.state === 'connecting';

  if (old && old.mode !== state.mode) {
    animState.clear();
    knownViewers.clear();
    entranceBanners.length = 0;
  } else if (state.players && animState.size > state.players.length + 10) {
    const activeIds = new Set();
    for (let i = 0; i < state.players.length; i++) activeIds.add(state.players[i].id);
    for (const id of animState.keys()) {
      if (!id.startsWith('preview-') && !activeIds.has(id)) animState.delete(id);
    }
  }

  if (!old) {
    draft = structuredClone(c);
    if (!overlay && !obs && state.state !== 'menu') show('battle');
  }

  const nextConfig = JSON.stringify([c, state.live.user, state.mode]);
  if (configFingerprint !== nextConfig) {
    configFingerprint = nextConfig;
    $('#rewards').innerHTML = rewardRows(c);
    renderSimOptions();
    renderCatalog();
    const mult = (c.damagePercent / 100).toFixed(1);
    $('#like').textContent = `♥ +${c.likesStep} likes`;

    if (overlay) {
      $('#liveOverlay').innerHTML = `
        <div class="overlay-header">
          <div class="eyebrow">@${esc(state.live.user)} / BATALLA MEDIEVAL LIVE</div>
          <h2>MEJORAS POR <span class="lime">REGALOS</span></h2>
        </div>
        <div class="overlay-list">${rewardRows(c)}</div>
        <div class="overlay-footer">
          ♥ ${esc(likeSummary(c))}<br>
          Comenta <b>!jugar</b>, <b>!jade</b> o <b>!coral</b> para unirte a la guerra.
        </div>
      `;
    }
  }

  if (overlay) return;
  $('#simStart').hidden = ['running','paused','between'].includes(state.state);

  if (state.mode === 'duel') {
    $('#mission').textContent = 'MISIÓN / DUELO DE CAMPEONES 1 VS 1';
    const pJ = state.players.find(p => p.team === 0);
    const pC = state.players.find(p => p.team === 1);
    const jHp = Math.ceil(pJ?.hp || 0);
    const cHp = Math.ceil(pC?.hp || 0);
    $('#score').innerHTML = `JADE <b>${jHp} HP</b> <span>VS</span> <b>${cHp} HP</b> CORAL`;
  } else if (state.mode === 'boss') {
    $('#mission').textContent = 'MISIÓN / ASALTO A LA TORRE';
    const a = state.players.filter(p => p.team === 0 && p.hp > 0).length;
    $('#score').innerHTML = `JADE <b>${a}</b> <span>VS</span> TORRE <b>${Math.ceil(state.boss?.hp || 0)}</b>`;
  } else {
    $('#mission').textContent = 'MISIÓN / GUERRA 20 VS 20';
    const a = state.players.filter(p => p.team === 0 && p.hp > 0).length;
    const b = state.players.filter(p => p.team === 1 && p.hp > 0).length;
    $('#score').innerHTML = `JADE <b>${a}</b> <span>VS</span> <b>${b}</b> CORAL`;
  }

  const left = Math.max(0, Math.ceil(c.roundSeconds - state.time));
  $('#timer').textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
  $('#pause').textContent = state.state === 'paused' ? '▶ Continuar' : 'Ⅱ Pausar';

  // ── Barra de puntos de guerra ──────────────────────────────────────────
  const score = state.score || [0, 0];
  if (state.mode === 'duel') {
    if ($('#scoreJade'))  $('#scoreJade').textContent  = `${score[0]} victorias`;
    if ($('#scoreCoral')) $('#scoreCoral').textContent = `${score[1]} victorias`;
    const totalWins = (score[0] + score[1]) || 1;
    if ($('#fillJade'))   $('#fillJade').style.width   = `${(score[0] / totalWins) * 100}%`;
    if ($('#fillCoral'))  $('#fillCoral').style.width  = `${(score[1] / totalWins) * 100}%`;
    if ($('#warRound'))   $('#warRound').textContent   = `Duelo #${state.round || 1} · Modo Continuo`;
  } else {
    const winScore = c.winScore || 10000;
    const pctJade  = Math.min(100, (score[0] / winScore) * 100);
    const pctCoral = Math.min(100, (score[1] / winScore) * 100);
    if ($('#scoreJade'))  $('#scoreJade').textContent  = score[0].toLocaleString();
    if ($('#scoreCoral')) $('#scoreCoral').textContent = score[1].toLocaleString();
    if ($('#fillJade'))   $('#fillJade').style.width   = pctJade  + '%';
    if ($('#fillCoral'))  $('#fillCoral').style.width  = pctCoral + '%';
    if ($('#warRound'))   $('#warRound').textContent   = `Ronda ${state.round || 1} · Meta: ${winScore.toLocaleString()} pts`;
  }

  // ── Resultado y estado de ronda/guerra ────────────────────────────────
  const isBetween = state.state === 'between';
  const isEnded   = state.state === 'ended';
  const showResult = isBetween || isEnded;
  $('#result').classList.toggle('hidden', !showResult);
  if (isBetween) {
    $('#result').classList.add('between-state');
    if (state.mode === 'duel') {
      $('#result h2').textContent = state.result || 'Buscando contrincante…';
    } else {
      $('#result h2').textContent = (state.result || '') + ' — Nueva ronda en breve…';
    }
  } else {
    $('#result').classList.remove('between-state');
    $('#result h2').textContent = state.result || '';
  }

  const topLog = state.log[0]?.text || '';
  if (topLog !== prevTopLog) {
    prevTopLog = topLog;
    $('#feed').innerHTML = state.log.slice(0, 6).map(l => `<div>${esc(l.text)}</div>`).join('');
  }

  if (!state.players.some(p => p.id === selected)) {
    selected = state.players.find(p => !p.bot)?.id || state.players[0]?.id;
  }
  renderStats();
}

function enableStandaloneMode() {
  if (standaloneMode) return;
  standaloneMode = true;
  localGame = new Battle(draft || defaults);
  localGame.start('teams');
  try { if (events) events.close(); } catch {}
  $('#status').textContent = '● MODO WEB (GITHUB PAGES)';
  $('#liveDetails').textContent = 'Ejecutando en tu navegador · Simula regalos y chat en la consola inferior';

  setInterval(() => {
    if (!standaloneMode || !localGame) return;
    localGame.update(0.033);
    const snap = {
      state: localGame.state,
      mode: localGame.mode,
      time: localGame.time,
      players: localGame.players,
      effects: localGame.effects,
      boss: localGame.boss,
      log: localGame.log,
      result: localGame.lastResult,
      config: localGame.config,
      live: { state: 'disconnected', user: 'GitHub-Pages', message: 'Modo Web Autónomo (sin servidor)' },
      score: localGame.score,
      round: localGame.round,
      warWinner: localGame.warWinner
    };
    handleState(snap);
  }, 33);
}

let events = null;
const isGitHubPages = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';

if (isGitHubPages) {
  enableStandaloneMode();
} else {
  try {
    events = new EventSource(overlay ? '/events?overlay=1' : '/events');
    events.onmessage = e => {
      hasReceivedServerState = true;
      handleState(JSON.parse(e.data));
    };
    events.onerror = () => {
      if (!hasReceivedServerState) {
        enableStandaloneMode();
      } else {
        $('#status').textContent = '● SERVIDOR EN ESPERA';
      }
    };
  } catch {
    enableStandaloneMode();
  }
}

let prevTopLog = '';
let prevStatsFingerprint = '';

function renderStats() {
  const p = state?.players.find(p => p.id === selected);
  if (!p) return;
  const fp = `${p.classLevel}_${p.roses}_${Math.ceil(p.frenzyTimer)}_${Math.ceil(p.magicRemaining)}_${p.maxHp}_${p.id}_${Math.ceil(p.hp)}_${p.armor}_${p.damageBonus}_${p.weapon}_${p.likes}_${p.revives}_${p.hasMagic}`;
  if (fp === prevStatsFingerprint) return;
  prevStatsFingerprint = fp;

  const c = state.config;
  const base = p.weapon === 'base' ? c.baseDamage : (c[p.weapon + 'Damage'] || c.baseDamage);
  const totalDmg = ((base + (p.flatDamage || 0)) * (1 + (p.damageBonus || 0) / 100)).toFixed(1);
  const mult = ((p.damageBonus || 0) / 100).toFixed(1);
  const isKnight = !!(p.isKnight || (p.classLevel && p.classLevel >= 10));
  const isFrenzy = (p.frenzyTimer || 0) > 0;

  $('#playerStats').innerHTML = `
    <div class="statname">${esc(p.name)} ${p.bot ? '<small>BOT</small>' : '<b style="color:var(--lime)">★ ESPECTADOR</b>'}</div>
    <div class="meter"><div style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></div></div>
    <div class="statline">CLASE <b>${isKnight ? '⭐ Soldado Nivel 10' : 'Soldado (Nv. 1)'}</b></div>
    <div class="statline">ROSAS <b>🌹 ${p.roses || 0} ${!isKnight ? '/ 20 (Para Nv.10)' : (p.frenzyTimer > 0 ? '(Frenesí Activo)' : '+10 para Frenesí')}</b></div>
    ${isFrenzy ? `<div class="statline" style="color:#ff4757">FRENESÍ <b>🔥 ${p.frenzyTimer > 0 ? p.frenzyTimer.toFixed(1) + 's restantes' : 'Activo (Attack03)'}</b></div>` : ''}
    <div class="statline">VIDA <b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div>
    <div class="statline">ARMADURA <b>🛡️ ${Math.round(p.armor)}${p.defense ? ' (+'+p.defense+' def)' : ''}</b></div>
    <div class="statline">DAÑO <b>⚔️ ${totalDmg} (+${mult}x daño / +${p.damageBonus}%${p.flatDamage ? ' / +'+p.flatDamage+' base' : ''})</b></div>
    <div class="statline">ARMA <b>${esc(actionNames[p.weapon] || 'Espada de Hierro')}</b></div>
    <div class="statline">MAGIA <b>${p.hasMagic ? '🔮 Activa (cada ' + (c.magicInterval || 4.5) + 's)' : 'Sin magia'}</b></div>
    <div class="statline">LIKES RECIBIDOS <b>♥ ${p.likes}</b></div>
    <div class="statline">RESERVAS PARA REVIVIR <b>✨ ${p.revives}</b></div>
  `;
}

// ── GESTOR DE EFECTOS DE SONIDO (MyInstants / Web Audio API) ─────────────
let soundEnabled = true;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

const soundFiles = {
  slash:  assetUrl('/assets/sounds/espada-slash.wav'),
  clash:  assetUrl('/assets/sounds/espada-clash.wav'),
  hit:    assetUrl('/assets/sounds/espada-hit.wav'),
  magic:  assetUrl('/assets/sounds/magia.wav'),
  meteor: assetUrl('/assets/sounds/meteorito.wav'),
  horn:   assetUrl('/assets/sounds/cuerno.wav'),
  entrar: assetUrl('/assets/sounds/entrar.wav')
};

const audioBuffers = new Map();
let audioPreloadStarted = false;

function preloadAudioBuffers() {
  if (audioPreloadStarted) return;
  audioPreloadStarted = true;
  const ctx = getAudioContext();
  if (!ctx) return;
  for (const [name, url] of Object.entries(soundFiles)) {
    fetch(url)
      .then(res => (res.ok ? res.arrayBuffer() : null))
      .then(ab => {
        if (ab) return ctx.decodeAudioData(ab);
      })
      .then(buf => {
        if (buf) audioBuffers.set(name, buf);
      })
      .catch(() => {});
  }
}
window.addEventListener('click', preloadAudioBuffers, { once: true });
window.addEventListener('keydown', preloadAudioBuffers, { once: true });

const soundCooldowns = new Map();
let activeSoundCount = 0;

function playSound(name, vol = 0.5) {
  if (!soundEnabled || document.hidden || overlay || screen === 'menu' || state?.state === 'paused') return;
  const now = Date.now();
  const lastTime = soundCooldowns.get(name) || 0;
  const minInterval = (name === 'hit') ? 140 : (name === 'slash') ? 110 : (name === 'clash') ? 160 : 300;
  if (now - lastTime < minInterval) return;
  if (activeSoundCount >= 4) return;
  soundCooldowns.set(name, now);

  const ctx = getAudioContext();
  if (!ctx) return;

  const buf = audioBuffers.get(name);
  if (buf) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.94 + Math.random() * 0.12;
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, vol));
      src.connect(gain);
      gain.connect(ctx.destination);
      activeSoundCount++;
      src.onended = () => { src.disconnect(); gain.disconnect(); activeSoundCount = Math.max(0, activeSoundCount - 1); };
      src.start(0);
      return;
    } catch {}
  }
  // Wait for decoded local audio instead of allocating fallback oscillators every frame.
  return;
}

// Síntesis Web Audio API (garantiza sonido siempre sin depender de red o CORS)
function playSynthSound(name, vol = 0.5) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime;
    if (name === 'slash' || name === 'clash') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === 'clash' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(name === 'clash' ? 2400 + Math.random() * 400 : 1200, t0);
      osc.frequency.exponentialRampToValueAtTime(name === 'clash' ? 750 : 220, t0 + (name === 'clash' ? 0.35 : 0.18));
      gain.gain.setValueAtTime(vol * 0.55, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + (name === 'clash' ? 0.35 : 0.18));
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.36);
    } else if (name === 'hit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, t0);
      osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.16);
      gain.gain.setValueAtTime(vol * 0.5, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.18);
    } else if (name === 'entrar' || name === 'horn') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t0);
      osc.frequency.setValueAtTime(554, t0 + 0.14);
      osc.frequency.setValueAtTime(659, t0 + 0.28);
      gain.gain.setValueAtTime(vol * 0.5, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.68);
    } else if (name === 'magic') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.exponentialRampToValueAtTime(1760, t0 + 0.4);
      gain.gain.setValueAtTime(vol * 0.4, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.46);
    } else if (name === 'meteor') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t0);
      osc.frequency.exponentialRampToValueAtTime(35, t0 + 0.8);
      gain.gain.setValueAtTime(vol * 0.8, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.85);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.86);
    }
  } catch {}
}

// ── GESTIÓN DE SPRITES ANIMADOS (Pack Tiny RPG Soldado Básico) ────────────
const spritePacks = {
  walk:     { url: assetUrl('/assets/soldado-sheet.png'),    frames: 8, jade: null, coral: null, ready: false },
  attack01: { url: assetUrl('/assets/soldado-attack01.png'), frames: 6, jade: null, coral: null, ready: false },
  attack02: { url: assetUrl('/assets/soldado-attack02.png'), frames: 6, jade: null, coral: null, ready: false },
  idle:     { url: assetUrl('/assets/soldado-idle.png'),     frames: 6, jade: null, coral: null, ready: false },
  death:    { url: assetUrl('/assets/soldado-death.png'),    frames: 4, jade: null, coral: null, ready: false }
};

// ── GESTIÓN DE SPRITES ANIMADOS (Pack Tiny RPG Caballero / Soldado Nivel 10) ──
const knightPacks = {
  walk:     { url: assetUrl('/assets/Knight_Walk.png'),     frames: 8,  jade: null, coral: null, ready: false },
  attack01: { url: assetUrl('/assets/Knight_Attack01.png'), frames: 7,  jade: null, coral: null, ready: false },
  attack02: { url: assetUrl('/assets/Knight_Attack02.png'), frames: 10, jade: null, coral: null, ready: false },
  attack03: { url: assetUrl('/assets/Knight_Attack03.png'), frames: 11, jade: null, coral: null, ready: false },
  idle:     { url: assetUrl('/assets/Knight_Idle.png'),     frames: 6,  jade: null, coral: null, ready: false },
  death:    { url: assetUrl('/assets/Knight_Death.png'),    frames: 4,  jade: null, coral: null, ready: false },
  hurt:     { url: assetUrl('/assets/Knight_Hurt.png'),     frames: 4,  jade: null, coral: null, ready: false },
  block:    { url: assetUrl('/assets/Knight_Block.png'),    frames: 4,  jade: null, coral: null, ready: false }
};

function processSheetColors(img) {
  try {
    const w = img.naturalWidth || img.width || 600;
    const h = img.naturalHeight || img.height || 100;

    // Jade (Original / Tonalidades esmeralda y acero)
    const cJade = document.createElement('canvas');
    cJade.width = w; cJade.height = h;
    const ctxJ = cJade.getContext('2d');
    ctxJ.drawImage(img, 0, 0);

    // Coral (Tonalidades carmesí / coral brillante para el ejército rival)
    const cCoral = document.createElement('canvas');
    cCoral.width = w; cCoral.height = h;
    const ctxC = cCoral.getContext('2d');
    ctxC.drawImage(img, 0, 0);
    const imgData = ctxC.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 15) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // Si el píxel tiene tonos azulados/verdosos de la armadura o capa
      if (g > 50 || b > 60) {
        d[i]     = Math.min(255, Math.floor(Math.max(r, g, b) * 1.35 + 25)); // Rojo coral vivo
        d[i + 1] = Math.floor(g * 0.35 + 10);                                 // Verde
        d[i + 2] = Math.floor(b * 0.25);                                      // Azul
      }
    }
    ctxC.putImageData(imgData, 0, 0);
    return { jade: cJade, coral: cCoral, ready: true };
  } catch {
    return { jade: img, coral: img, ready: true };
  }
}

function updateSpriteCredits() {
  const el = $('#spriteCredits');
  if (el) {
    el.textContent = 'Sprites 2D animados activos: Soldado Básico + Soldado Nivel 10 (Caminar, Ataques 01, 02 y 03 Frenesí, Espera, Muerte, Bloqueo).';
  }
}

function loadPack(key, dict = spritePacks) {
  const pack = dict[key];
  if (!pack) return;
  const img = new Image();
  img.onload = () => {
    const res = processSheetColors(img);
    pack.jade = res.jade || img;
    pack.coral = res.coral || img;
    pack.ready = true;
    updateSpriteCredits();
  };
  img.onerror = (e) => {
    console.error('Error cargando sprite:', pack.url, e);
    if (key !== 'walk' && dict.walk?.ready) {
      pack.jade = dict.walk.jade;
      pack.coral = dict.walk.coral;
      pack.ready = true;
    }
  };
  img.src = assetUrl(pack.url);
}

if (!overlay) {
  Object.keys(spritePacks).forEach(k => loadPack(k, spritePacks));
  Object.keys(knightPacks).forEach(k => loadPack(k, knightPacks));
}


function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── Coordenadas del coliseo (en espacio 1200×760) ─────────────────────────
const ARENA = { cx: 600, cy: 380, ax: 510, ay: 300 };

function ellipsePath(ctx, cx, cy, ax, ay) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, ax, ay, 0, 0, Math.PI * 2);
}

// ── SISTEMA DE CACHÉ DE FONDOS DE ARENA (Renderizado ultra rápido a 60 FPS) ──
let cachedColosseumCanvas = null;
let cachedDuelPitCanvas = null;

function renderStaticColosseum(ctx, w, h) {
  const sx = w / 1200, sy = h / 760;
  const { cx, cy, ax, ay } = ARENA;
  const CX = cx * sx, CY = cy * sy, AX = ax * sx, AY = ay * sy;

  // 1. Fondo exterior (fuera del coliseo)
  ctx.fillStyle = '#120e05';
  ctx.fillRect(0, 0, w, h);

  // 2. Gradas exteriores oscuras
  ellipsePath(ctx, CX, CY, AX + 68 * sx, AY + 50 * sy);
  ctx.fillStyle = '#2a1e10'; ctx.fill();

  // 3. Anillos de gradas concéntricos
  for (const [f, col] of [[0.95,'#382a1c'],[0.88,'#4a3828'],[0.81,'#3a2e1e'],[0.74,'#302518']]) {
    ellipsePath(ctx, CX, CY, (AX + 68 * sx) * f, (AY + 50 * sy) * f);
    ctx.fillStyle = col; ctx.fill();
  }
  // Líneas de bancos
  ctx.strokeStyle = 'rgba(20,12,0,0.45)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    const f = 0.74 + i * 0.027;
    ellipsePath(ctx, CX, CY, (AX + 68 * sx) * f, (AY + 50 * sy) * f);
    ctx.stroke();
  }

  // 4. Pared interior del coliseo
  ellipsePath(ctx, CX, CY, AX + 14 * sx, AY + 10 * sy);
  ctx.fillStyle = '#6b4f2e'; ctx.fill();
  ctx.strokeStyle = '#9a7248'; ctx.lineWidth = 4 * sx; ctx.stroke();

  // 5. Clip arena de arena
  ctx.save();
  ellipsePath(ctx, CX, CY, AX, AY);
  ctx.clip();

  // 6. Suelo de arena (gradiente radial cálido)
  const sandGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, AX);
  sandGrad.addColorStop(0,    '#c8a870');
  sandGrad.addColorStop(0.5,  '#b8963c');
  sandGrad.addColorStop(0.82, '#a07828');
  sandGrad.addColorStop(1,    '#8a6018');
  ctx.fillStyle = sandGrad; ctx.fillRect(0, 0, w, h);

  // 7. Textura granulada de arena
  for (let i = 0; i < 160; i++) {
    const rx = CX + ((i * 173 + 17) % (Math.round(AX * 18)) / 9 - AX) * 0.93;
    const ry = CY + ((i * 239 + 53) % (Math.round(AY * 18)) / 9 - AY) * 0.90;
    const nr = ((i * 97 + 31) % 12) + 2;
    const alpha = 0.035 + (i % 5) * 0.012;
    ctx.fillStyle = i % 3 === 0 ? `rgba(70,40,5,${alpha})` : `rgba(220,185,90,${alpha})`;
    ctx.beginPath(); ctx.ellipse(rx, ry, nr, nr * 0.55, (i * 0.8) % Math.PI, 0, Math.PI * 2); ctx.fill();
  }

  // 8. Manchas de sangre/batallas previas
  for (const [rx, ry, rr, alpha] of [
    [-0.32, 0.22, 18, 0.18], [0.36, -0.26, 13, 0.15],
    [0.12,  0.47, 20, 0.14], [-0.52, -0.09, 10, 0.12],
    [0.62,  0.06, 12, 0.13], [-0.18, -0.38, 16, 0.11]
  ]) {
    circle(ctx, CX + rx * AX, CY + ry * AY, rr * sx, `rgba(75,8,4,${alpha})`);
  }

  // 9. Línea divisoria central
  ctx.strokeStyle = 'rgba(100,70,20,0.38)';
  ctx.lineWidth = 2.5 * sx; ctx.setLineDash([18 * sx, 14 * sx]);
  ctx.beginPath(); ctx.moveTo(CX, CY - AY * 0.9); ctx.lineTo(CX, CY + AY * 0.9); ctx.stroke();
  ctx.setLineDash([]);

  // 10. Círculo central de la arena
  ctx.strokeStyle = 'rgba(130,90,30,0.38)'; ctx.lineWidth = 2.5 * sx;
  ctx.beginPath(); ctx.ellipse(CX, CY, 55 * sx, 36 * sy, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(130,90,30,0.2)'; ctx.lineWidth = 1.2 * sx;
  ctx.beginPath(); ctx.ellipse(CX, CY, 25 * sx, 17 * sy, 0, 0, Math.PI * 2); ctx.stroke();

  ctx.restore(); // fin clip arena

  // 11. Sombra interior del muro
  ellipsePath(ctx, CX, CY, AX + 3 * sx, AY + 3 * sy);
  ctx.strokeStyle = 'rgba(20,8,0,0.65)'; ctx.lineWidth = 14 * sx; ctx.stroke();

  // 12. Pilares decorativos
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const px = CX + Math.cos(a) * (AX + 36 * sx);
    const py = CY + Math.sin(a) * (AY + 26 * sy);
    circle(ctx, px + 2 * sx, py + 3 * sy, 8 * sx, 'rgba(0,0,0,0.4)');
    circle(ctx, px, py, 8 * sx, '#7a5c36');
    circle(ctx, px, py, 6 * sx, '#9b7a4e');
    circle(ctx, px, py, 3 * sx, '#c4a068');
  }

  // 13. Puertas de los gladiadores
  for (const [side, team, labelText] of [[-1, 0, '⚔ JADE'], [1, 1, 'CORAL ⚔']]) {
    const gx = CX + side * (AX + 4 * sx), gy = CY;
    ctx.fillStyle = '#2a1608';
    ctx.fillRect(gx - (side > 0 ? 22 : 0) * sx, gy - 22 * sy, 22 * sx, 44 * sy);
    ctx.fillStyle = team === 0 ? '#1a5010' : '#6a1008';
    ctx.fillRect(gx - (side > 0 ? 18 : 0) * sx, gy - 16 * sy, 16 * sx, 32 * sy);
    ctx.save();
    ctx.font = `bold ${Math.round(11 * sx)}px sans-serif`;
    ctx.fillStyle = team === 0 ? '#80ee50' : '#ff9068';
    ctx.textAlign = team === 0 ? 'right' : 'left';
    ctx.fillText(labelText, gx + side * 30 * sx, gy + 4 * sy);
    ctx.textAlign = 'left'; ctx.restore();
  }

  // 14. Muchedumbre en las gradas
  const crowdCols = ['#d4a050','#c48040','#e0c070','#b87030','#e8d090','#f0e0a0'];
  for (let i = 0; i < 300; i++) {
    const a = (i / 300) * Math.PI * 2;
    const rf = 0.79 + (i % 7) * 0.025;
    const px = CX + Math.cos(a) * (AX + 46 * sx) * rf;
    const py = CY + Math.sin(a) * (AY + 36 * sy) * rf;
    ctx.fillStyle = i % 10 === 0 ? '#e02018' : i % 10 === 1 ? '#1890d0' : crowdCols[i % crowdCols.length];
    ctx.beginPath(); ctx.arc(px, py, 2.8 * sx, 0, Math.PI * 2); ctx.fill();
  }
}

function renderStaticDuelPit(ctx, w, h) {
  const sx = w / 1200, sy = h / 760;
  const CX = 600 * sx, CY = 380 * sy;
  const AX = 240 * sx, AY = 160 * sy;

  // 1. Fondo exterior oscuro del foso de honor
  ctx.fillStyle = '#0c0804';
  ctx.fillRect(0, 0, w, h);

  // 2. Gradas de piedra íntimas alrededor del foso
  ellipsePath(ctx, CX, CY, AX + 90 * sx, AY + 65 * sy);
  ctx.fillStyle = '#1c140a'; ctx.fill();
  ellipsePath(ctx, CX, CY, AX + 55 * sx, AY + 40 * sy);
  ctx.fillStyle = '#2b1f11'; ctx.fill();

  // 3. Muro de contención de roca tallada
  ellipsePath(ctx, CX, CY, AX + 18 * sx, AY + 13 * sy);
  ctx.fillStyle = '#4a341e'; ctx.fill();
  ctx.strokeStyle = '#7c5832'; ctx.lineWidth = 5 * sx; ctx.stroke();

  // 4. Clip arena del foso
  ctx.save();
  ellipsePath(ctx, CX, CY, AX, AY);
  ctx.clip();

  // 5. Suelo de arena dorada cálida
  const sandGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, AX);
  sandGrad.addColorStop(0,    '#d6b274');
  sandGrad.addColorStop(0.55, '#c29b46');
  sandGrad.addColorStop(0.85, '#a47e2c');
  sandGrad.addColorStop(1,    '#825e1a');
  ctx.fillStyle = sandGrad; ctx.fillRect(0, 0, w, h);

  // 6. Textura de arena y polvo
  for (let i = 0; i < 90; i++) {
    const rx = CX + ((i * 137 + 11) % (Math.round(AX * 18)) / 9 - AX) * 0.92;
    const ry = CY + ((i * 199 + 47) % (Math.round(AY * 18)) / 9 - AY) * 0.88;
    const nr = ((i * 83 + 19) % 8) + 2;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(70,40,5,0.08)' : 'rgba(240,210,120,0.07)';
    ctx.beginPath(); ctx.ellipse(rx, ry, nr, nr * 0.55, (i * 0.8) % Math.PI, 0, Math.PI * 2); ctx.fill();
  }

  // 7. Manchas de sangre de batallas épicas
  for (const [rx, ry, rr, alpha] of [
    [-0.25, 0.28, 14, 0.22], [0.30, -0.22, 16, 0.25],
    [0.05, 0.35, 12, 0.18], [-0.35, -0.15, 15, 0.20],
    [0.15, -0.32, 10, 0.16]
  ]) {
    circle(ctx, CX + rx * AX, CY + ry * AY, rr * sx, `rgba(80,8,4,${alpha})`);
  }

  // 8. Runa grabada en la arena en el centro
  ctx.strokeStyle = 'rgba(120,80,20,0.35)'; ctx.lineWidth = 2.5 * sx;
  ctx.beginPath(); ctx.ellipse(CX, CY, 45 * sx, 30 * sy, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX - 55 * sx, CY); ctx.lineTo(CX + 55 * sx, CY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX, CY - 36 * sy); ctx.lineTo(CX + 36 * sy, CY); ctx.stroke();

  ctx.restore(); // fin clip foso

  // 9. Postes de madera con cadenas
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const px = CX + Math.cos(a) * (AX + 8 * sx);
    const py = CY + Math.sin(a) * (AY + 6 * sy);
    circle(ctx, px + 2 * sx, py + 2 * sy, 5 * sx, 'rgba(0,0,0,0.5)');
    circle(ctx, px, py, 5 * sx, '#52381e');
    circle(ctx, px, py, 3 * sx, '#805830');
  }

  // 10. Bases fijas de pebeteros
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const bx = CX + Math.cos(a) * (AX + 38 * sx);
    const by = CY + Math.sin(a) * (AY + 26 * sy);
    circle(ctx, bx + 2 * sx, by + 3 * sy, 12 * sx, 'rgba(0,0,0,0.6)');
    circle(ctx, bx, by, 12 * sx, '#2b1c10');
    circle(ctx, bx, by, 9 * sx, '#5a3d24');
  }

  // 11. Banderas heráldicas a los costados
  // Estandarte Jade (Izquierda)
  ctx.save();
  ctx.fillStyle = '#174d1a';
  ctx.fillRect(CX - AX - 50 * sx, CY - 40 * sy, 22 * sx, 80 * sy);
  ctx.strokeStyle = '#c6fc65'; ctx.lineWidth = 1.5 * sx;
  ctx.strokeRect(CX - AX - 50 * sx, CY - 40 * sy, 22 * sx, 80 * sy);
  ctx.font = `bold ${Math.round(10 * sx)}px sans-serif`;
  ctx.fillStyle = '#c6fc65'; ctx.textAlign = 'center';
  ctx.fillText('J', CX - AX - 39 * sx, CY - 15 * sy);
  ctx.fillText('A', CX - AX - 39 * sx, CY);
  ctx.fillText('D', CX - AX - 39 * sx, CY + 15 * sy);
  ctx.fillText('E', CX - AX - 39 * sx, CY + 30 * sy);
  ctx.restore();

  // Estandarte Coral (Derecha)
  ctx.save();
  ctx.fillStyle = '#5c1616';
  ctx.fillRect(CX + AX + 28 * sx, CY - 40 * sy, 22 * sx, 80 * sy);
  ctx.strokeStyle = '#ff816a'; ctx.lineWidth = 1.5 * sx;
  ctx.strokeRect(CX + AX + 28 * sx, CY - 40 * sy, 22 * sx, 80 * sy);
  ctx.font = `bold ${Math.round(10 * sx)}px sans-serif`;
  ctx.fillStyle = '#ff816a'; ctx.textAlign = 'center';
  ctx.fillText('C', CX + AX + 39 * sx, CY - 15 * sy);
  ctx.fillText('O', CX + AX + 39 * sx, CY);
  ctx.fillText('R', CX + AX + 39 * sx, CY + 15 * sy);
  ctx.fillText('A', CX + AX + 39 * sx, CY + 30 * sy);
  ctx.restore();
}

function getCachedColosseum() {
  if (!cachedColosseumCanvas) {
    cachedColosseumCanvas = document.createElement('canvas');
    cachedColosseumCanvas.width = 1200;
    cachedColosseumCanvas.height = 760;
    renderStaticColosseum(cachedColosseumCanvas.getContext('2d'), 1200, 760);
  }
  return cachedColosseumCanvas;
}

function getCachedDuelPit() {
  if (!cachedDuelPitCanvas) {
    cachedDuelPitCanvas = document.createElement('canvas');
    cachedDuelPitCanvas.width = 1200;
    cachedDuelPitCanvas.height = 760;
    renderStaticDuelPit(cachedDuelPitCanvas.getContext('2d'), 1200, 760);
  }
  return cachedDuelPitCanvas;
}

function terrain(ctx, w, h) {
  ctx.drawImage(getCachedColosseum(), 0, 0, w, h);
}

function duelTerrain(ctx, w, h, t = Date.now()) {
  ctx.drawImage(getCachedDuelPit(), 0, 0, w, h);
  // Llamas animadas ligeras en los pebeteros (sin recrear gradientes radiales complejos)
  const sx = w / 1200, sy = h / 760;
  const CX = 600 * sx, CY = 380 * sy;
  const AX = 240 * sx, AY = 160 * sy;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const bx = CX + Math.cos(a) * (AX + 38 * sx);
    const by = CY + Math.sin(a) * (AY + 26 * sy);
    const fPulse = 0.85 + 0.15 * Math.sin(t * 0.01 + i * 2);
    circle(ctx, bx, by - 4 * sy, 14 * sx * fPulse, '#ffaa00');
    circle(ctx, bx, by - 4 * sy, 7 * sx * fPulse, '#ffffcc');
    const sparkY = by - 8 * sy - ((t * 0.03 + i * 37) % 20) * sy;
    const sparkX = bx + Math.sin(t * 0.01 + i) * 6 * sx;
    circle(ctx, sparkX, sparkY, 1.8 * sx, '#ffe070');
  }
}

// ── HUD SUPERIOR ESTILO JUEGO DE PELEAS PARA 1 VS 1 ─────────────────────────
// ── HUD SUPERIOR ESTILO JUEGO DE PELEAS PARA 1 VS 1 ─────────────────────────
function duelHUD(ctx, s) {
  const pJade = s.players.find(p => p.team === 0);
  const pCoral = s.players.find(p => p.team === 1);
  if (!pJade && !pCoral) return;

  const t = Date.now();
  ctx.save();

  // 1. LADO JADE (Izquierda)
  const jHp = Math.max(0, pJade?.hp || 0);
  const jMax = pJade?.maxHp || 250;
  const jPct = Math.min(1, jHp / jMax);
  const jStamina = Math.max(0, pJade?.stamina ?? 100);
  const jFury = Math.min(100, Math.max(0, pJade?.fury ?? 0));
  const jStun = (pJade?.stunTimer || 0) > 0;
  const jCombo = pJade?.comboHits || 0;
  const jIsKnight = !!(pJade?.isKnight || (pJade?.classLevel && pJade?.classLevel >= 10));
  const jKnight = jIsKnight ? ' [⭐ Lv.10]' : '';
  const jName = pJade ? (!pJade.bot ? '👑 @' + pJade.name.replace(/^@/, '') + jKnight : '⚔ ' + pJade.name + jKnight) : 'Vacante';

  // Barra de Vida Jade
  ctx.fillStyle = 'rgba(10, 20, 12, 0.9)';
  ctx.fillRect(40, 22, 420, 26);
  ctx.strokeStyle = jStun ? '#ffd700' : '#4e7c42'; ctx.lineWidth = 2;
  ctx.strokeRect(40, 22, 420, 26);

  const jGrad = ctx.createLinearGradient(42, 24, 42 + 416 * jPct, 24);
  jGrad.addColorStop(0, '#27ae60'); jGrad.addColorStop(1, '#a8e063');
  ctx.fillStyle = jGrad;
  ctx.fillRect(42, 24, 416 * jPct, 22);

  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
  ctx.fillText(`${jName}  [${Math.ceil(jHp)} / ${jMax} HP]`, 48, 39);
  if (pJade?.armor > 0) {
    ctx.fillStyle = '#f5b041';
    ctx.fillText(`+${pJade.armor}🛡`, 380, 39);
  }

  // Barra de Estamina / Postura Jade (y=50..55)
  ctx.fillStyle = 'rgba(8,16,12,0.92)';
  ctx.fillRect(40, 50, 420, 6);
  ctx.fillStyle = jStamina > 30 ? '#00cec9' : '#f39c12';
  ctx.fillRect(40, 50, 420 * (jStamina / 100), 6);

  // Barra de Furia Jade (y=58..62)
  ctx.fillStyle = 'rgba(20,10,6,0.92)';
  ctx.fillRect(40, 58, 420, 5);
  ctx.fillStyle = jFury >= 100 ? (Math.sin(t * 0.01) > 0 ? '#ffea00' : '#ff7675') : '#e17055';
  ctx.fillRect(40, 58, 420 * (jFury / 100), 5);

  // Chips e indicadores de combate Jade
  ctx.font = 'bold 10px sans-serif';
  if (jStun) {
    ctx.fillStyle = '#ffd700';
    ctx.fillText('💫 ¡POSTURA ROTA / ATURDIDO!', 40, 16);
  } else if ((pJade?.frenzyTimer || 0) > 0) {
    ctx.fillStyle = '#ff4757';
    ctx.fillText(`🔥 ¡HABILIDAD FRENESÍ ACTIVA! (${pJade.frenzyTimer.toFixed(1)}s)`, 40, 16);
  } else if (jCombo >= 2) {
    ctx.fillStyle = '#ff9f43';
    ctx.fillText(`🔥 ¡RACHA ${jCombo}x COMBO!`, 40, 16);
  } else {
    ctx.fillStyle = '#81ecec';
    ctx.fillText(`💨 ${Math.round((pJade?.dodgeChance || 0.22)*100)}% Esquivo · ⚔️ ${Math.round((pJade?.parryChance || 0.18)*100)}% Parry · 💥 ${Math.round((pJade?.critChance || 0.18)*100)}% Crítico`, 40, 16);
  }

  // 2. LADO CORAL (Derecha)
  const cHp = Math.max(0, pCoral?.hp || 0);
  const cMax = pCoral?.maxHp || 250;
  const cPct = Math.min(1, cHp / cMax);
  const cStamina = Math.max(0, pCoral?.stamina ?? 100);
  const cFury = Math.min(100, Math.max(0, pCoral?.fury ?? 0));
  const cStun = (pCoral?.stunTimer || 0) > 0;
  const cCombo = pCoral?.comboHits || 0;
  const cIsKnight = !!(pCoral?.isKnight || (pCoral?.classLevel && pCoral?.classLevel >= 10));
  const cKnight = cIsKnight ? ' [⭐ Lv.10]' : '';
  const cName = pCoral ? (!pCoral.bot ? '👑 @' + pCoral.name.replace(/^@/, '') + cKnight : '⚔ ' + pCoral.name + cKnight) : 'Vacante';

  // Barra de Vida Coral
  ctx.fillStyle = 'rgba(20, 10, 10, 0.9)';
  ctx.fillRect(740, 22, 420, 26);
  ctx.strokeStyle = cStun ? '#ffd700' : '#8c3528'; ctx.lineWidth = 2;
  ctx.strokeRect(740, 22, 420, 26);

  const cGrad = ctx.createLinearGradient(742 + 416 * (1 - cPct), 24, 1158, 24);
  cGrad.addColorStop(0, '#e74c3c'); cGrad.addColorStop(1, '#ff7675');
  ctx.fillStyle = cGrad;
  ctx.fillRect(742 + 416 * (1 - cPct), 24, 416 * cPct, 22);

  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'right';
  ctx.fillText(`[${Math.ceil(cHp)} / ${cMax} HP]  ${cName}`, 1152, 39);
  if (pCoral?.armor > 0) {
    ctx.fillStyle = '#f5b041';
    ctx.fillText(`+${pCoral.armor}🛡`, 750, 39);
  }

  // Barra de Estamina / Postura Coral (y=50..55)
  ctx.fillStyle = 'rgba(16,8,8,0.92)';
  ctx.fillRect(740, 50, 420, 6);
  ctx.fillStyle = cStamina > 30 ? '#00cec9' : '#f39c12';
  const cStamW = 420 * (cStamina / 100);
  ctx.fillRect(1160 - cStamW, 50, cStamW, 6);

  // Barra de Furia Coral (y=58..62)
  ctx.fillStyle = 'rgba(20,10,6,0.92)';
  ctx.fillRect(740, 58, 420, 5);
  ctx.fillStyle = cFury >= 100 ? (Math.sin(t * 0.01) > 0 ? '#ffea00' : '#ff7675') : '#e17055';
  const cFuryW = 420 * (cFury / 100);
  ctx.fillRect(1160 - cFuryW, 58, cFuryW, 5);

  // Chips e indicadores de combate Coral
  ctx.font = 'bold 10px sans-serif';
  if (cStun) {
    ctx.fillStyle = '#ffd700';
    ctx.fillText('💫 ¡POSTURA ROTA / ATURDIDO!', 1160, 16);
  } else if ((pCoral?.frenzyTimer || 0) > 0) {
    ctx.fillStyle = '#ff4757';
    ctx.fillText(`🔥 ¡HABILIDAD FRENESÍ ACTIVA! (${pCoral.frenzyTimer.toFixed(1)}s)`, 1160, 16);
  } else if (cCombo >= 2) {
    ctx.fillStyle = '#ff9f43';
    ctx.fillText(`🔥 ¡RACHA ${cCombo}x COMBO!`, 1160, 16);
  } else {
    ctx.fillStyle = '#ff7675';
    ctx.fillText(`💥 ${Math.round((pCoral?.critChance || 0.18)*100)}% Crítico · ⚔️ ${Math.round((pCoral?.parryChance || 0.18)*100)}% Parry · 💨 ${Math.round((pCoral?.dodgeChance || 0.22)*100)}% Esquivo`, 1160, 16);
  }

  // 3. Emblema Central "VS"
  const pulse = 1.0 + Math.sin(t * 0.006) * 0.06;
  ctx.save();
  ctx.translate(600, 35);
  ctx.scale(pulse, pulse);
  circle(ctx, 0, 0, 26, '#1e1408');
  ctx.strokeStyle = '#f5b041'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '900 18px sans-serif';
  ctx.fillStyle = '#f5b041'; ctx.textAlign = 'center';
  ctx.fillText('VS', 0, 6);
  ctx.restore();

  ctx.restore();
}

// ── ESTADO Y ANIMACIÓN DINÁMICA DE CADA GLADIADOR ─────────────────────────
const animState = new Map();
const knownViewers = new Set();
const entranceBanners = [];
let prevRoundNum = 1;
const playedEffects = new Set();
function effectSound(e, name, volume) {
  if (playedEffects.has(e.id)) return;
  if (playedEffects.size >= 320) playedEffects.delete(playedEffects.values().next().value);
  playedEffects.add(e.id);
  playSound(name, volume);
}

// ── GLADIADOR: ANIMADO CON SPRITE 2D DE MEDIBANG (soldado-sheet.png) ───────
function soldier(ctx, p, t = Date.now(), mode = 'teams') {
  let anim = animState.get(p.id);
  if (!anim) {
    anim = {
      rx: p.x, ry: p.y,
      lastServerX: p.x, lastServerY: p.y,
      walkTime: Math.random() * 8,
      isMoving: false,
      lastHp: p.hp,
      hurtTime: 0,
      attackTime: 0,
      lastMoveTime: 0,
      lastFrameTime: t,
      entranceTime: (!p.bot && !knownViewers.has(p.id)) ? t : 0
    };
    animState.set(p.id, anim);
    if (!p.bot && !knownViewers.has(p.id)) {
      if (knownViewers.size >= 100) knownViewers.delete(knownViewers.values().next().value);
      knownViewers.add(p.id);
      if (entranceBanners.length >= 3) entranceBanners.shift();
      entranceBanners.push({ name: p.name, team: p.team, t });
      playSound('entrar', 0.75);
    }
  }

  // 1. Detección de movimiento del servidor (10 FPS SSE)
  const serverDelta = Math.hypot(p.x - anim.lastServerX, p.y - anim.lastServerY);
  if (serverDelta > 0.05) {
    anim.lastMoveTime = t;
    anim.lastServerX = p.x;
    anim.lastServerY = p.y;
  }

  // 2. Interpolar suavemente la posición visual (LERP a 60 FPS fluidos)
  const dtFrame = Math.min(0.08, Math.max(0.001, (t - (anim.lastFrameTime || t)) / 1000));
  anim.lastFrameTime = t;
  const lerpSpeed = Math.min(1, dtFrame * 15);
  anim.rx = anim.rx !== undefined ? anim.rx + (p.x - anim.rx) * lerpSpeed : p.x;
  anim.ry = anim.ry !== undefined ? anim.ry + (p.y - anim.ry) * lerpSpeed : p.y;

  // 3. Determinar si está caminando (con ventana de 350ms para compensar paquetes SSE de 100ms)
  const lagDist = Math.hypot(p.x - anim.rx, p.y - anim.ry);
  const isMoving = (t - (anim.lastMoveTime || 0)) < 350 || lagDist > 0.6;
  anim.isMoving = isMoving;

  if (isMoving) {
    // Ciclo de animación fluido de 8 fotogramas (~8.8 fotogramas/segundo continuos)
    anim.walkTime += dtFrame * 8.8;
  }

  // Reacción a daño
  if (p.hp < anim.lastHp) {
    anim.hurtTime = t;
    anim.lastHp = p.hp;
    playSound('hit', 0.4);
  } else {
    anim.lastHp = p.hp;
  }

  // Gatillo de animación de estocada / tajo cuando ataca
  if (p.cd > 0.65 && (t - anim.attackTime > 380)) {
    anim.attackTime = t;
    anim.attackCombo = (anim.attackCombo === 1) ? 2 : 1;
  }

  ctx.save();
  ctx.translate(anim.rx, anim.ry);

  // ── Animación de entrada celestial para nuevos usuarios ────────────────
  const entranceAge = t - anim.entranceTime;
  let scale = 1.0;
  let altitude = 0;
  if (anim.entranceTime > 0 && entranceAge < 1100) {
    const prog = entranceAge / 1100;
    if (prog < 0.5) {
      const dropP = prog / 0.5;
      scale = 3.0 - (1 - Math.pow(1 - dropP, 3)) * 2.0;
      altitude = (1 - dropP) * 110;
    } else {
      scale = 1.0 + Math.sin((prog - 0.5) * Math.PI * 2) * 0.1;
    }
    // Rayo de luz celestial desde el cielo del coliseo
    ctx.save();
    const beamGrad = ctx.createLinearGradient(0, -600, 0, 0);
    beamGrad.addColorStop(0, 'rgba(255,240,160,0)');
    beamGrad.addColorStop(0.7, p.team ? 'rgba(255,100,70,0.22)' : 'rgba(120,255,90,0.22)');
    beamGrad.addColorStop(1, 'rgba(255,255,220,0.55)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(-20, -600, 40, 600);
    circle(ctx, 0, 0, prog * 44, p.team ? 'rgba(255,80,40,0.28)' : 'rgba(100,255,60,0.28)');
    ctx.restore();
  }

  const isJade = p.team === 0;

  // ── Si está muerto ────────────────────────────────────────────────────
  if (p.hp <= 0) {
    ctx.globalAlpha = 0.55;
    ctx.save();
    const isK = !!(p.isKnight || (p.classLevel && p.classLevel >= 10));
    const deathPack = (isK && knightPacks.death.ready) ? knightPacks.death : (spritePacks.death.ready ? spritePacks.death : null);
    const deathSheet = deathPack ? (isJade ? deathPack.jade : deathPack.coral) : null;
    if (deathSheet) {
      ctx.imageSmoothingEnabled = false;
      if (isK && deathPack === knightPacks.death) {
        ctx.drawImage(deathSheet, 3 * 100, 0, 100, 100, -77, -75, 160, 160);
      } else {
        // Frame 3 de death: caballero caído en el suelo de la arena
        const sx = 3 * 100 + 20;
        const sy = 22;
        const sw = 56;
        const sh = 44;
        const dw = Math.round(56 * 1.6);
        const dh = Math.round(44 * 1.6);
        ctx.drawImage(deathSheet, sx, sy, sw, sh, -46, -43, dw, dh);
      }
    } else {
      ctx.fillStyle = isJade ? '#1a4808' : '#6a1808';
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.restore(); // Restaura el ctx.save() inicial de translate(anim.rx, anim.ry)
    return;
  }

  // Sombra del gladiador
  ctx.save();
  ctx.globalAlpha = Math.max(0.1, 0.34 * (1 - altitude / 140));
  ctx.fillStyle = '#060300';
  ctx.beginPath();
  ctx.ellipse(3, 6 + altitude * 0.1, 16 * (1 - altitude / 180), 8 * (1 - altitude / 180), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Pedestal de Campeón para usuarios reales de TikTok
  if (!p.bot) {
    ctx.save();
    const auraRot = t * 0.002;
    ctx.strokeStyle = p.team ? '#ff6540' : '#85f045';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 24, auraRot, auraRot + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Halo de selección
  if (p.id === selected) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
  }

  // Burbuja de escudo (efecto multicapa ligero sin shadowBlur)
  if (p.shield > 0) {
    const pulse = 0.72 + 0.28 * Math.sin(t / 110);
    ctx.save(); ctx.globalAlpha = pulse;
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#40e8ff'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Orbes mágicos orbitando
  if (p.hasMagic) {
    const rot = t / 380;
    ctx.save(); ctx.globalAlpha = 0.75;
    for (let i = 0; i < 4; i++) {
      const a = rot + (i / 4) * Math.PI * 2;
      circle(ctx, Math.cos(a) * 21, Math.sin(a) * 21, 3.8, ['#c060ff','#8040cc','#e090ff','#a050e0'][i]);
    }
    ctx.strokeStyle = '#8030cc'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(0, 0, 21, rot, rot + Math.PI * 1.6); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }

  // ── Rotación del gladiador hacia su objetivo + vaivén orgánico ──────────
  const tier = p.weapon === 'legend' ? 3 : p.weapon === 'royal' ? 2 : p.weapon === 'steel' ? 1 : 0;
  
  // ── Selección de Estado y Fotograma del Sprite ────────────────────────────
  const isKnight = !!(p.isKnight || (p.classLevel && p.classLevel >= 10));
  const isDuel = mode === 'duel';
  const isFrenzy = (p.frenzyTimer || 0) > 0;

  const attackAge = t - anim.attackTime;
  const isAttacking = attackAge < (isFrenzy ? 400 : 350);
  
  let currentPack = spritePacks.walk;
  let frameIndex = 0;
  let attackLunge = 0;

  if (isKnight) {
    if (isAttacking) {
      if (isFrenzy && knightPacks.attack03.ready) {
        // Modo Ataque Frenesí (Knight_Attack03.png - 11 fotogramas)
        currentPack = knightPacks.attack03;
        const prog = Math.min(0.999, attackAge / 400);
        frameIndex = Math.min(10, Math.floor(prog * 11));
        attackLunge = Math.sin(prog * Math.PI) * 18;
      } else {
        const combo = anim.attackCombo || 1;
        currentPack = (combo === 2 && knightPacks.attack02.ready) ? knightPacks.attack02 : (knightPacks.attack01.ready ? knightPacks.attack01 : knightPacks.walk);
        const prog = Math.min(0.999, attackAge / 350);
        frameIndex = Math.min(currentPack.frames - 1, Math.floor(prog * currentPack.frames));
        attackLunge = Math.sin(prog * Math.PI) * 14;
      }
    } else if (isMoving) {
      currentPack = knightPacks.walk.ready ? knightPacks.walk : knightPacks.attack01;
      frameIndex = Math.floor(anim.walkTime) % (currentPack.frames || 8);
    } else {
      // Si no camina ni ataca:
      // En 20vs20 "solo agrega el atacar y caminar en 20vs20" -> mostramos pose quieta de guardia (frame 0 de walk)
      if (!isDuel) {
        currentPack = knightPacks.walk.ready ? knightPacks.walk : knightPacks.idle;
        frameIndex = 0;
      } else {
        // En 1vs1 tenemos todas las poses (hurt, block, idle)
        if ((t - anim.hurtTime < 180) && knightPacks.hurt.ready) {
          currentPack = knightPacks.hurt;
          frameIndex = Math.min(3, Math.floor(((t - anim.hurtTime) / 180) * 4));
        } else if ((p.stunTimer > 0 || (p.stamina || 100) < 25) && knightPacks.block.ready) {
          currentPack = knightPacks.block;
          frameIndex = Math.floor(t * 0.006) % 4;
        } else {
          currentPack = knightPacks.idle.ready ? knightPacks.idle : knightPacks.walk;
          frameIndex = Math.floor((t * 0.005 + (p.wander?.ox || 0)) % (currentPack.frames || 6));
        }
      }
    }
  } else {
    // Soldado Estándar
    if (isAttacking) {
      const combo = anim.attackCombo || 1;
      currentPack = (combo === 2 && spritePacks.attack02.ready) ? spritePacks.attack02 : (spritePacks.attack01.ready ? spritePacks.attack01 : spritePacks.walk);
      const prog = attackAge / 350;
      frameIndex = Math.min(currentPack.frames - 1, Math.floor(prog * currentPack.frames));
      attackLunge = Math.sin(prog * Math.PI) * 14;
    } else if (isMoving) {
      currentPack = spritePacks.walk.ready ? spritePacks.walk : spritePacks.idle;
      frameIndex = Math.floor(anim.walkTime) % (currentPack.frames || 8);
    } else {
      currentPack = spritePacks.idle.ready ? spritePacks.idle : spritePacks.walk;
      frameIndex = Math.floor((t * 0.005 + (p.wander?.ox || 0)) % (currentPack.frames || 6));
    }
  }

  const sway = isMoving ? Math.sin(anim.walkTime * 0.7) * 0.12 : 0;
  const bob = isMoving ? Math.abs(Math.sin(anim.walkTime * Math.PI)) * 2.2 : Math.sin(t * 0.003 + (p.wander?.ox || 0)) * 0.8;

  // Orientación del caballero: si mira hacia la izquierda, volteamos con scale(-1, 1)
  const facingLeft = Math.cos(p.angle || 0) < 0;

  ctx.save();
  ctx.scale((facingLeft ? -1 : 1) * scale, scale);
  ctx.rotate(sway * 0.45);

  // 1. Capa ondeante para tiers altos (Real y Legendario)
  if (tier >= 2) {
    ctx.save();
    ctx.fillStyle = isJade ? '#165c26' : '#7a1414';
    const capeFlutter = Math.sin(t * 0.008 + anim.walkTime) * 4;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-24 + capeFlutter * 0.5, -8);
    ctx.lineTo(-26 + capeFlutter, 14);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 2. RENDERIZADO DEL SPRITE SHEET ANIMADO (Ataque, Caminar o Espera)
  const currentSheet = isJade ? currentPack.jade : currentPack.coral;
  const imgSource = currentSheet || currentPack.jade;

  if (imgSource) {
    ctx.save();
    ctx.translate(attackLunge, bob);

    ctx.imageSmoothingEnabled = false;

    let sx, sy, sw, sh, dw, dh, dx, dy;
    if (isKnight) {
      sx = frameIndex * 100;
      sy = 0;
      sw = 100;
      sh = 100;
      dw = 160;
      dh = 160;
      dx = -77;
      dy = -75;
    } else {
      // Bounding box en las hojas de sprites de Tiny RPG (100x100 por celda):
      // Ventana óptima que contiene el cuerpo y el rango completo de la espada (x: 20..76, y: 22..66)
      sx = frameIndex * 100 + 20;
      sy = 22;
      sw = 56;
      sh = 44;
      dw = Math.round(56 * 1.6);
      dh = Math.round(44 * 1.6);
      dx = -46;
      dy = -43;
    }

    // Estela de sombra al esquivar (Afterimage)
    if ((p.isDodging || 0) > 0) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.drawImage(imgSource, sx, sy, sw, sh, dx - 20, dy, dw, dh);
      ctx.restore();
    }

    // Aura ardiente de Modo Ataque Frenesí
    if (isFrenzy) {
      ctx.save();
      ctx.globalAlpha = 0.32 + Math.sin(t * 0.015) * 0.12;
      circle(ctx, 0, 0, 26, '#ff3b30');
      circle(ctx, 0, -4, 20, '#ff9500');
      ctx.restore();
    }

    ctx.drawImage(imgSource, sx, sy, sw, sh, dx, dy, dw, dh);

    // Destello de daño ultraligero sin ctx.filter que bloquea la GPU/CPU
    const hurtAge = t - anim.hurtTime;
    if (hurtAge < 150) {
      ctx.save();
      ctx.globalAlpha = (1 - hurtAge / 150) * 0.55;
      circle(ctx, dw * 0.1, dh * 0.2, 15, '#ff2211');
      ctx.restore();
    }

    // Estrellas de aturdimiento / Guardia rota
    if ((p.stunTimer || 0) > 0) {
      const starRot = t * 0.008;
      for (let i = 0; i < 3; i++) {
        const sa = starRot + (i / 3) * Math.PI * 2;
        const stx = Math.cos(sa) * 16;
        const sty = -44 + Math.sin(sa) * 5;
        circle(ctx, stx, sty, 2.8, '#ffd700');
        circle(ctx, stx, sty, 1.2, '#ffffff');
      }
    }

    // ── MEJORAS VISUALES SOBRE EL SPRITE SEGÚN TIER ───────────────────────
    // Hombreras de armadura si p.armor > 0
    if (p.armor > 0) {
      const armorSheen = p.armor > 60 ? '#ffd700' : '#b0c0d0';
      circle(ctx, -5, -4, 3.5, armorSheen);
      circle(ctx, 5, -4, 3.5, armorSheen);
    }

    // Armas mejoradas en la mano derecha del caballero
    if (tier === 3) {
      // Espada Legendaria Dorada con Fuego
      const g = ctx.createLinearGradient(6, isAttacking ? -3 : 2, isAttacking ? 34 : 28, isAttacking ? -3 : 2);
      g.addColorStop(0, '#c08010'); g.addColorStop(0.5, '#ffe060'); g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.fillRect(6, isAttacking ? -3 : 1, isAttacking ? 26 : 22, 4);
      circle(ctx, 7, isAttacking ? -1 : 3, 2.5, '#40ff90');
      circle(ctx, (isAttacking ? 32 : 26) + Math.sin(t * 0.01) * 2, isAttacking ? -1 : 3, 1.8, '#fff');
    } else if (tier === 2) {
      // Mandoble Real Azul
      const rGrad = ctx.createLinearGradient(6, isAttacking ? -2 : 2, isAttacking ? 28 : 24, isAttacking ? -2 : 2);
      rGrad.addColorStop(0, '#2060b0'); rGrad.addColorStop(0.6, '#70b0ff'); rGrad.addColorStop(1, '#e0f0ff');
      ctx.fillStyle = rGrad;
      ctx.fillRect(6, isAttacking ? -2 : 1.5, isAttacking ? 22 : 18, 3.5);
      circle(ctx, 7, isAttacking ? 0 : 3, 2, '#60d0ff');
    } else if (tier === 1) {
      // Espada de Acero brillante
      const sGrad = ctx.createLinearGradient(6, isAttacking ? -1 : 2, isAttacking ? 22 : 18, isAttacking ? -1 : 2);
      sGrad.addColorStop(0, '#506070'); sGrad.addColorStop(1, '#d8e4f0');
      ctx.fillStyle = sGrad;
      ctx.fillRect(6, isAttacking ? -1 : 2, isAttacking ? 16 : 14, 3);
    }

    ctx.restore();
  } else {
    // Fallback provisional mientras carga la imagen
    ctx.fillStyle = isJade ? '#3a6820' : '#7a2818';
    ctx.beginPath(); ctx.ellipse(attackLunge, bob, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    circle(ctx, 6 + attackLunge, bob, 8, '#788890');
  }

  ctx.restore(); // Fin orientación y escala caballero

  // ── BARRAS DE ESTADO (HP, Armadura, Nombre) EN COORDENADAS LOCALES ───────
  const bw = 32, bh = 4;
  const bx = -bw / 2, bhy = -30 - altitude;

  // Barra de Vida
  ctx.fillStyle = '#180400'; ctx.fillRect(bx, bhy, bw, bh);
  const hf = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = hf > 0.5 ? '#50e028' : hf > 0.25 ? '#e8c820' : '#e02020';
  ctx.fillRect(bx, bhy, bw * hf, bh);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.8; ctx.strokeRect(bx, bhy, bw, bh);

  // Barra de Armadura
  if (p.armor > 0) {
    ctx.fillStyle = '#3a2000'; ctx.fillRect(bx, bhy - 5.5, bw, 3.5);
    ctx.fillStyle = '#e0a018'; ctx.fillRect(bx, bhy - 5.5, bw * Math.min(1, p.armor / 300), 3.5);
  }

  // Icono de arma
  if (p.weapon !== 'base') {
    const icons = { steel: '⚔', royal: '🗡️', legend: '✨' };
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(icons[p.weapon] || '', 18, -28 - altitude);
    ctx.textAlign = 'left';
  }

  // Etiqueta de Espectador Real de TikTok
  if (!p.bot) {
    const label = '👑 @' + p.name.replace(/^@/, '');
    ctx.font = 'bold 11px sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = p.team ? '#4a0c04f0' : '#044208f0';
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(-tw / 2 - 7, -48 - altitude, tw + 14, 16, 4); ctx.fill();
    } else ctx.fillRect(-tw / 2 - 7, -48 - altitude, tw + 14, 16);
    ctx.strokeStyle = p.team ? '#ffa080' : '#85ff50'; ctx.lineWidth = 1.2;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-tw / 2 - 7, -48 - altitude, tw + 14, 16, 4); ctx.stroke(); }
    ctx.textAlign = 'center';
    ctx.fillStyle = p.team ? '#ffe0d0' : '#e0ffd0';
    ctx.fillText(label, 0, -36 - altitude);
    ctx.textAlign = 'left';
  }

  // Insignia de Soldado Nivel 10 y Estado Frenesí
  if (isKnight) {
    ctx.save();
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    const tagY = !p.bot ? (-56 - altitude) : (-44 - altitude);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('⭐ NIVEL 10', 0, tagY);
    if (isFrenzy) {
      ctx.fillStyle = '#ff4757';
      const fText = p.frenzyTimer > 0 ? `🔥 FRENESÍ ${p.frenzyTimer.toFixed(1)}s` : '🔥 FRENESÍ';
      ctx.fillText(fText, 0, tagY - 11);
    }
    ctx.restore();
  }

  ctx.restore(); // ¡CRÍTICO! Restaura el ctx.save() inicial de translate(anim.rx, anim.ry)
}

// ── DRAW: RENDERIZA FRAME COMPLETO CON SONIDOS Y EFECTOS ──────────────────
const SLASH_COLS = {
  legend: ['#ffe060', '#fff4a0'],
  royal:  ['#60a0e0', '#a0d0ff'],
  steel:  ['#c0c8d8', '#e8eef8'],
  base:   ['#d0d0d0', '#f0f0f0']
};

function draw(ctx, s, w, h) {
  const t = Date.now();

  // Actualización de número de ronda (sonido de victoria/cuerno deshabilitado)
  if (s.round && s.round !== prevRoundNum) {
    prevRoundNum = s.round;
  }

  // Temblor de pantalla
  let shakeX = 0, shakeY = 0;
  if (s.shake > 0) {
    const mag = s.shake * 14;
    shakeX = (Math.random() - 0.5) * mag;
    shakeY = (Math.random() - 0.5) * mag;
  }
  ctx.save();
  ctx.translate(shakeX, shakeY);
  if (s.mode === 'duel') {
    ctx.fillStyle = '#0c0804';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(w / 1200, h / 760);
    // Cámara de duelo de gladiadores: zoom cinematográfico 1.85x
    ctx.translate(600, 380);
    ctx.scale(1.85, 1.85);
    ctx.translate(-600, -380);
    duelTerrain(ctx, 1200, 760, t);
  } else {
    terrain(ctx, w, h);
    ctx.save();
    ctx.scale(w / 1200, h / 760);
  }

  // Torre del jefe
  if (s.mode === 'boss' && s.boss) {
    const bss = s.boss;
    ctx.save(); ctx.translate(bss.x, bss.y);
    circle(ctx, 0, 8, 70, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = '#4a3820'; ctx.beginPath(); ctx.arc(0,0,64,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#7a5c30'; ctx.lineWidth=5; ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      circle(ctx, Math.cos(a)*44, Math.sin(a)*44, 12, '#3a2810');
      circle(ctx, Math.cos(a)*44, Math.sin(a)*44, 9,  '#5a4020');
    }
    ctx.fillStyle='#2a1c10'; ctx.fillRect(-25,-25,50,50);
    ctx.strokeStyle='#6a4828'; ctx.lineWidth=3; ctx.stroke();
    const pulse2 = 0.85 + 0.15 * Math.sin(t/200);
    ctx.save(); ctx.scale(pulse2,pulse2);
    circle(ctx, 0,0,22,'#8a1a08'); circle(ctx,0,0,14,'#c03020'); circle(ctx,0,0,7,'#ff6050');
    ctx.restore();
    ctx.fillStyle='#1a0808'; ctx.fillRect(-70,-90,140,11);
    ctx.fillStyle='#d03010'; ctx.fillRect(-70,-90,140*Math.max(0,bss.hp/bss.maxHp),11);
    ctx.strokeStyle='#ff6040'; ctx.lineWidth=1.5; ctx.strokeRect(-70,-90,140,11);
    ctx.font='bold 10px sans-serif'; ctx.fillStyle='#fff'; ctx.textAlign='center';
    ctx.fillText('🏰 TORRE DEL JEFE',0,-97); ctx.textAlign='left';
    ctx.restore();
  }

  // Cráteres
  for (const e of s.effects||[]) {
    if (e.kind !== 'crater') continue;
    const alpha = Math.max(0, e.life/e.max);
    ctx.save(); ctx.globalAlpha=alpha;
    circle(ctx,e.x,e.y,50,'#0e0500');
    ctx.strokeStyle='#cc3800'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(e.x,e.y,38,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#ff6000'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(e.x,e.y,28,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // Caídos → luego vivos encima (con animación de sprite protegida)
  for (const p of s.players) {
    if (p.hp <= 0) {
      try { soldier(ctx, p, t, s.mode); } catch (e) { /* fallback seguro */ }
    }
  }
  for (const p of s.players) {
    if (p.hp > 0) {
      try { soldier(ctx, p, t, s.mode); } catch (e) { /* fallback seguro */ }
    }
  }

  // Efectos visuales y de sonido
  let slashesCount = 0;
  for (const e of s.effects||[]) {
    if (e.kind==='crater') continue;
    const alpha = Math.max(0,e.life/e.max);
    ctx.save(); ctx.globalAlpha=alpha;
    if (e.kind==='slash') {
      slashesCount++;
      if (e.life > e.max * 0.85) {
        effectSound(e, slashesCount > 1 ? 'clash' : 'slash', 0.45);
      }
      const angle=Math.atan2(e.ty-e.y,e.tx-e.x);
      const [c1,c2]=SLASH_COLS[e.weapon]||SLASH_COLS.base;
      // Resplandor exterior rápido con alpha (sin shadowBlur pesado)
      ctx.strokeStyle=c1; ctx.lineWidth=e.weapon==='legend'?10:e.weapon==='royal'?7:5;
      ctx.globalAlpha=alpha * 0.35;
      ctx.beginPath(); ctx.arc(e.x,e.y,40,angle-1.0,angle+1.0); ctx.stroke();
      // Núcleo brillante
      ctx.globalAlpha=alpha;
      ctx.strokeStyle=c1; ctx.lineWidth=e.weapon==='legend'?5:e.weapon==='royal'?3.5:2.5;
      ctx.beginPath(); ctx.arc(e.x,e.y,40,angle-0.85,angle+0.85); ctx.stroke();
      ctx.strokeStyle=c2; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(e.x,e.y,40,angle-0.5,angle+0.5); ctx.stroke();
    } else if (e.kind==='meteor') {
      const progress=1-e.life/e.max;
      if (progress >= 0.84 && !e.impacted) {
        effectSound(e, 'meteor', 0.85);
      }
      const cx2=e.startX+(e.targetX-e.startX)*Math.min(1,progress/0.85);
      const cy2=e.startY+(e.targetY-e.startY)*Math.min(1,progress/0.85);
      ctx.save(); ctx.globalAlpha=alpha*0.5;
      circle(ctx,e.targetX,e.targetY,20+progress*44,'rgba(180,20,0,0.35)'); ctx.restore();
      const grad=ctx.createLinearGradient(cx2-60,cy2-90,cx2,cy2);
      grad.addColorStop(0,'rgba(255,80,0,0)'); grad.addColorStop(0.4,'rgba(255,140,0,0.5)'); grad.addColorStop(1,'rgba(255,240,100,1)');
      // Cola de fuego sin shadowBlur
      ctx.strokeStyle=grad; ctx.lineWidth=18;
      ctx.beginPath(); ctx.moveTo(cx2-60,cy2-90); ctx.lineTo(cx2,cy2); ctx.stroke();
      circle(ctx,cx2,cy2,19,'#ff4400'); circle(ctx,cx2,cy2,12,'#ffaa00'); circle(ctx,cx2,cy2,6,'#ffffcc');
    } else if (e.kind==='blast') {
      const rad=(1-e.life/e.max)*(e.radius||220)+12;
      // Anillo expansivo exterior
      ctx.strokeStyle=e.team?'rgba(255,80,48,0.3)':'rgba(255,208,64,0.3)'; ctx.lineWidth=12;
      ctx.beginPath(); ctx.arc(e.x,e.y,rad,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=e.team?'#ff5030':'#ffd040'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(e.x,e.y,rad,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,180,0.3)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(e.x,e.y,rad*0.55,0,Math.PI*2); ctx.stroke();
    } else if (e.kind==='magic_pulse') {
      if (e.life > e.max * 0.85) {
        effectSound(e, 'magic', 0.6);
      }
      const rad=(1-e.life/e.max)*(e.r||110)+10;
      ctx.strokeStyle='rgba(192,80,255,0.35)'; ctx.lineWidth=10;
      ctx.beginPath(); ctx.arc(e.x,e.y,rad,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle='#c050ff'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(e.x,e.y,rad,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle='rgba(190,100,255,0.4)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(e.x,e.y,rad*0.5,0,Math.PI*2); ctx.stroke();
    } else if (e.kind==='combat_text') {
      const rise = (1 - e.life / e.max) * 20;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 2.0;
      ctx.strokeText(e.text, e.x, e.y - rise);
      ctx.fillStyle = e.color || '#ffffff';
      ctx.fillText(e.text, e.x, e.y - rise);
      ctx.textAlign = 'left';
    } else if (e.kind==='clash_spark') {
      const prog = 1 - e.life / e.max;
      for (let j = 0; j < 6; j++) {
        const sa = (j / 6) * Math.PI * 2 + prog * 2.5;
        const sDist = prog * 26;
        circle(ctx, e.x + Math.cos(sa) * sDist, e.y + Math.sin(sa) * sDist, 2.2, '#ffe066');
      }
      circle(ctx, e.x, e.y, Math.max(1, 8 * (1 - prog)), '#ffffff');
    }
    ctx.restore();
  }

  // ── Banners flotantes de entrada de espectadores ───────────────────────
  for (let i = entranceBanners.length - 1; i >= 0; i--) {
    const eb = entranceBanners[i];
    const age = t - eb.t;
    if (age > 2800) {
      entranceBanners.splice(i, 1);
      continue;
    }
    const alpha = age < 300 ? age / 300 : (age > 2300 ? (2800 - age) / 500 : 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bannerY = 55 + i * 36;
    const teamCol = eb.team ? '#ff6040' : '#70f050';
    const text = `⚔️ @${eb.name} ¡SE HA UNIDO AL EJÉRCITO ${eb.team ? 'CORAL' : 'JADE'}!`;
    ctx.font = 'bold 14px sans-serif';
    const btw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(12,18,14,0.92)';
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(600 - btw / 2 - 16, bannerY, btw + 32, 28, 6); ctx.fill();
    } else ctx.fillRect(600 - btw / 2 - 16, bannerY, btw + 32, 28);
    ctx.strokeStyle = teamCol; ctx.lineWidth = 1.5;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(600 - btw / 2 - 16, bannerY, btw + 32, 28, 6); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.fillStyle = teamCol;
    ctx.fillText(text, 600, bannerY + 19);
    ctx.restore();
  }

  ctx.restore(); // fin scale

  // HUD superior estilo juego de peleas para Duelo 1 vs 1
  if (s.mode === 'duel') {
    ctx.save();
    ctx.scale(w / 1200, h / 760);
    duelHUD(ctx, s);
    ctx.restore();
  }

  // ── RETÍCULO DE APUNTADO Y VISIBILIDAD DEL MOUSE ───────────────────────
  if (mouseAim && !obs && screen === 'battle') {
    ctx.save();
    ctx.scale(w / 1200, h / 760);
    const mx = mouseAim.canvasX;
    const my = mouseAim.canvasY;
    const targetPlayer = mouseAim.hoveredId ? s.players.find(p => p.id === mouseAim.hoveredId) : null;

    if (targetPlayer && targetPlayer.hp > 0) {
      // Bloqueo de mira sobre el gladiador
      ctx.strokeStyle = targetPlayer.team ? '#ff6040' : '#70ff50';
      ctx.lineWidth = 2.5;
      const bRad = 28;
      const cLen = 9;
      for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
        const cx = mx + dx * bRad;
        const cy = my + dy * bRad;
        ctx.beginPath();
        ctx.moveTo(cx, cy - dy * cLen);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx - dx * cLen, cy);
        ctx.stroke();
      }
      // Etiqueta flotante con nombre y salud
      const tLabel = `${targetPlayer.bot ? '⚔ ' : '👑 '}${targetPlayer.name} [${Math.ceil(targetPlayer.hp)} HP]`;
      ctx.font = 'bold 11px sans-serif';
      const tw = ctx.measureText(tLabel).width;
      ctx.fillStyle = 'rgba(8,14,8,0.9)';
      ctx.fillRect(mx - tw / 2 - 7, my - bRad - 22, tw + 14, 18);
      ctx.strokeStyle = targetPlayer.team ? '#ff7050' : '#85ff50';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(mx - tw / 2 - 7, my - bRad - 22, tw + 14, 18);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tLabel, mx, my - bRad - 9);
      ctx.textAlign = 'left';
    } else {
      // Retículo de suelo de alta visibilidad: círculo con cruz blanca y borde negro
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#f5b041'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2); ctx.stroke();
      // 4 brazos de cruz
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(mx - 16, my); ctx.lineTo(mx - 4, my);
      ctx.moveTo(mx + 4, my);  ctx.lineTo(mx + 16, my);
      ctx.moveTo(mx, my - 16); ctx.lineTo(mx, my - 4);
      ctx.moveTo(mx, my + 4);  ctx.lineTo(mx, my + 16);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(mx - 16, my); ctx.lineTo(mx - 4, my);
      ctx.moveTo(mx + 4, my);  ctx.lineTo(mx + 16, my);
      ctx.moveTo(mx, my - 16); ctx.lineTo(mx, my - 4);
      ctx.moveTo(mx, my + 4);  ctx.lineTo(mx, my + 16);
      ctx.stroke();
      circle(ctx, mx, my, 2.2, '#ff3300');
    }
    ctx.restore();
  }

  // Overlay pausa
  if (s.state==='paused') {
    ctx.fillStyle='rgba(8,5,0,0.72)'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#e8d090'; ctx.font=`bold ${Math.round(44*w/1200)}px sans-serif`; ctx.textAlign='center';
    ctx.fillText('COMBATE EN PAUSA',w/2,h/2);
    ctx.fillStyle='#b09040'; ctx.font=`${Math.round(16*w/1200)}px sans-serif`;
    ctx.fillText('Pulsa Continuar para reanudar la batalla',w/2,h/2+38);
    ctx.textAlign='left';
  }
  ctx.restore();
}

// Inicialización de animación en canvas (simulación liviana de 3 vs 3 para bajo consumo de memoria/CPU)
const previewGame = new Battle({ ...defaults, teamSize: 3 });
const prefixPreview = () => { for (const p of previewGame.players) if (!p.id.startsWith('preview-')) p.id = 'preview-' + p.id; };
previewGame.start('teams');
prefixPreview();
if (!overlay) for (let i = 0; i < 20; i++) previewGame.update(0.04);

const ac = $('#arena')?.getContext('2d');
const pc = $('#preview')?.getContext('2d');
let last = performance.now();

let frameId = 0;
function frame(now) {
  frameId = 0;
  if (document.hidden || overlay) return;
  const interval = screen === 'menu' ? 1000 / 15 : 1000 / 30;
  if (now - last >= interval) {
    const dt = Math.min(0.05, (now - last) / 1000);
    if (screen === 'menu' && pc) {
      previewGame.update(dt);
      if (previewGame.state === 'ended') {
        previewGame.start('teams');
        prefixPreview();
      }
      if (animState.size > 20) {
        const ids = new Set();
        for (let i = 0; i < previewGame.players.length; i++) ids.add(previewGame.players[i].id);
        for (const id of animState.keys()) if (id.startsWith('preview-') && !ids.has(id)) animState.delete(id);
      }
      draw(pc, previewGame, 700, 540);
    }
    if ((screen === 'battle' || obs) && state && ac) draw(ac, state, 1200, 760);
    last = now;
  }
  frameId = requestAnimationFrame(frame);
}
if (!overlay) frameId = requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; }
  else if (!overlay && !frameId) { last = performance.now(); frameId = requestAnimationFrame(frame); }
});

// ── Interacción por ratón, puntero visible y selección de gladiador ──────────
let mouseAim = null;
if ($('#arena')) {
  $('#arena').onmousemove = e => {
    if (!state) return;
    const r = e.target.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * 1200;
    const cy = ((e.clientY - r.top) / r.height) * 760;
    let worldX = cx;
    let worldY = cy;
    if (state.mode === 'duel') {
      worldX = 600 + (cx - 600) / 1.85;
      worldY = 380 + (cy - 380) / 1.85;
    }
    const hovered = state.players.find(p => p.hp > 0 && Math.hypot(p.x - worldX, p.y - worldY) < 32);
    mouseAim = {
      worldX, worldY,
      canvasX: cx,
      canvasY: cy,
      hoveredId: hovered ? hovered.id : null
    };
  };

  $('#arena').onmouseleave = () => {
    mouseAim = null;
  };

  $('#arena').onclick = e => {
    if (!state) return;
    const r = e.target.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 1200;
    let y = ((e.clientY - r.top) / r.height) * 760;
    if (state.mode === 'duel') {
      x = 600 + (x - 600) / 1.85;
      y = 380 + (y - 380) / 1.85;
    }
    const p = state.players.reduce((a, b) => (!a || Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a), null);
    if (p) {
      selected = p.id;
      if (!p.bot && $('#simUser')) $('#simUser').value = p.name;
      renderStats();
    }
  };
}

const keys = new Set();
window.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    keys.add(e.key);
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key));
window.addEventListener('blur', () => keys.clear());

let controlPending = false;
setInterval(() => {
  if (!controlPending && !document.hidden && screen === 'battle' && keys.size && selected) {
    controlPending = true;
    api('control', {
      id: selected,
      x: (keys.has('d') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('a') || keys.has('ArrowLeft') ? 1 : 0),
      y: (keys.has('s') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('w') || keys.has('ArrowUp') ? 1 : 0)
    }).catch(() => {}).finally(() => { controlPending = false; });
  }
}, 80);

// Control de audio
const toggleSoundBtn = $('#toggleSound');
if (toggleSoundBtn) {
  toggleSoundBtn.onclick = () => {
    soundEnabled = !soundEnabled;
    toggleSoundBtn.textContent = soundEnabled ? '🔊 Sonido: ON' : '🔇 Sonido: OFF';
    toggleSoundBtn.classList.toggle('muted', !soundEnabled);
    if (soundEnabled) playSound('slash', 0.6);
  };
}

// Botones de prueba de sonido en Ajustes
$$('.sound-btn').forEach(btn => {
  btn.onclick = () => {
    const sName = btn.dataset.sound;
    btn.classList.add('playing');
    setTimeout(() => btn.classList.remove('playing'), 300);
    playSound(sName, 0.8);
  };
});

loadCatalog().catch(() => toast('No se pudo cargar el catálogo de regalos'));


export const defaults = {
  likesStep: 50,
  damagePercent: 2,
  healthGain: 2,
  baseHealth: 100,
  baseDamage: 10,
  armorGain: 25,
  armorCap: 100,
  bossHealth: 15000,
  bossDamage: 16,
  roundSeconds: 300,
  reviveHealth: 100,
  steelDamage: 16,
  royalDamage: 22,
  legendDamage: 28,
  magicDamage: 18,
  magicInterval: 4.5,
  meteorDamage: 90,
  shieldSeconds: 3,
  maxLikeLevels: 20,
  maxRevives: 3,
  maxShieldSeconds: 6,
  magicSeconds: 30,
  maxMagicSeconds: 60,
  frenzySeconds: 5,
  maxFrenzySeconds: 10,
  maxChampionWins: 10,
  winScore: 10000,        // Puntos para ganar la guerra
  autoFill: true,
  likeScope: 'individual',
  rules: [
    { gift: 'Rose',         action: 'rose',   actions: ['rose'],   quantity: 1 },
    { gift: 'Finger Heart', action: 'armor',  actions: ['armor'],  quantity: 1 },
    { gift: 'Doughnut',     action: 'revive', actions: ['revive'], quantity: 1 },
    { gift: 'Hand Heart',   action: 'steel',  actions: ['steel'],  quantity: 1 },
    { gift: 'Sunglasses',   action: 'royal',  actions: ['royal'],  quantity: 1 },
    { gift: 'Perfume',      action: 'magic',  actions: ['magic'],  quantity: 1 },
    { gift: 'GG',           action: 'shield', actions: ['shield'], quantity: 10 },
    { gift: 'Galaxy',       action: 'meteor', actions: ['meteor'], quantity: 1 }
  ]
};

export const actionNames = {
  armor:  'Armadura',
  steel:  'Espada de acero',
  royal:  'Espada real',
  legend: 'Espada legendaria',
  heal:   'Curar si está vivo',
  frenzy: 'Frenesí temporal',
  shield: 'Escudo',
  damage: '+2 daño',
  revive: 'Revivir al instante',
  magic:  'Magia temporal',
  meteor: 'Meteorito de Galaxia',
  rose:   'Rosa (+1% vida y salud llena)'
};

export const actionIcons = {
  armor:  '🛡️',
  steel:  '⚔️',
  royal:  '⚔️',
  legend: '🔥',
  heal:   '💚',
  frenzy: '⚡',
  shield: '🛡️',
  damage: '🗡️',
  revive: '✨',
  magic:  '🔮',
  meteor: '☄️',
  rose:   '🌹'
};

export const limits = {
  likesStep: [1, 10000], damagePercent: [0, 10], healthGain: [0, 10],
  baseHealth: [10, 1000], baseDamage: [1, 100], armorGain: [1, 100], armorCap: [1, 300],
  steelDamage: [1, 150], royalDamage: [1, 200], legendDamage: [1, 250],
  bossHealth: [100, 100000], bossDamage: [1, 200], roundSeconds: [15, 1800],
  reviveHealth: [1, 1000], magicDamage: [1, 100], magicInterval: [2, 30],
  meteorDamage: [1, 300], shieldSeconds: [1, 5], maxShieldSeconds: [1, 10],
  maxLikeLevels: [1, 30], maxRevives: [1, 3], magicSeconds: [5, 60],
  maxMagicSeconds: [5, 120], frenzySeconds: [1, 5], maxFrenzySeconds: [1, 10],
  maxChampionWins: [1, 10], winScore: [100, 100000]
};
export function giftKey(name) {
  const key = String(name || '').trim().toLowerCase();
  return ({'hand hearts': 'hand heart'})[key] || key;
}
const boundedCount = (n, fallback = 1) => Number.isFinite(Number(n))
  ? Math.max(0, Math.min(100000, Math.floor(Number(n)))) : fallback;
export const MAX_EFFECTS = 160;
export function validConfig(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const c = structuredClone(defaults);
  for (const k of Object.keys(c)) {
    if (typeof c[k] === 'number') {
      const n = Number(raw[k]);
      if (Number.isFinite(n) && raw[k] !== undefined) {
        c[k] = Math.min(limits[k][1], Math.max(limits[k][0], n));
      }
    }
  }
  c.likesStep = Math.max(1, Math.round(c.likesStep));
  c.autoFill  = typeof raw.autoFill === 'boolean' ? raw.autoFill : c.autoFill;
  c.likeScope = raw.likeScope === 'team' ? 'team' : 'individual';
  if (Array.isArray(raw.rules)) {
    c.rules = raw.rules
      .slice(0, 100)
      .filter(r => r && typeof r.gift === 'string' && r.gift.trim())
      .map(r => {
        let actions = [];
        if (Array.isArray(r.actions)) {
          actions = r.actions.filter(a => actionNames[a]);
        } else if (typeof r.action === 'string' && actionNames[r.action]) {
          actions = [r.action];
        }
        if (!actions.length && r.action && actionNames[r.action]) actions = [r.action];
        if (!actions.length) actions = ['armor'];
        const qty = Math.max(1, Math.min(100000, Math.round(Number(r.quantity) || 1)));
        return {
          gift:     r.gift.trim().slice(0, 100),
          action:   actions[0],
          actions:  actions,
          quantity: qty
        };
      });
  }
  const gifts = new Set();
  c.rules = c.rules.filter(r => {
    const key = giftKey(r.gift) + ':' + r.quantity;
    if (gifts.has(key)) return false;
    gifts.add(key);
    return true;
  });
  c.steelDamage = Math.max(c.baseDamage, c.steelDamage);
  c.royalDamage = Math.max(c.steelDamage, c.royalDamage);
  c.legendDamage = Math.max(c.royalDamage, c.legendDamage);
  c.shieldSeconds = Math.min(c.shieldSeconds, c.maxShieldSeconds);
  c.magicSeconds = Math.min(c.magicSeconds, c.maxMagicSeconds);
  c.frenzySeconds = Math.min(c.frenzySeconds, c.maxFrenzySeconds);
  return c;
}

// ─── Ruido Simplex 2D ligero para vagabundeo orgánico ───────────────────────
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
const perm = (() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return [...p, ...p];
})();
const grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
function noise2(x, y) {
  const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  const dot = (g, x, y) => g[0]*x + g[1]*y;
  const aa = grad2[perm[perm[xi]   + yi  ] & 7];
  const ab = grad2[perm[perm[xi]   + yi+1] & 7];
  const ba = grad2[perm[perm[xi+1] + yi  ] & 7];
  const bb = grad2[perm[perm[xi+1] + yi+1] & 7];
  return lerp(
    lerp(dot(aa, xf,   yf  ), dot(ba, xf-1, yf  ), u),
    lerp(dot(ab, xf,   yf-1), dot(bb, xf-1, yf-1), u), v
  );
}

export class Battle {
  constructor(config = defaults) {
    this.config     = validConfig(config);
    this.players    = [];
    this.effects    = [];
    this.log        = [];
    this.mode       = 'teams';
    this.state      = 'menu';
    this.time       = 0;
    this.seq        = 0;
    this.likeTotals = new Map();
    this.supportTeams = new Map();
    this.nextSupportTeam = 0;
    this.pendingEvents = [];
    this.effectSeq = 0;
    this.seen       = new Set();
    this.seenOrder  = [];
    this._crowdCount = new Map();
    this.lastResult = '';
    this.shake      = 0;
    // ── Guerra en bucle: puntos acumulados entre rondas
    this.score      = [0, 0];   // [jade, coral] o [aventureros, jefe]
    this.round      = 0;
    this.warWinner  = -1;       // -1 = guerra en curso; 0 o 1 = equipo ganador
    this.roundDelay = 0;        // pausa breve entre rondas
  }

  effect(e) {
    if (this.effects.length >= MAX_EFFECTS) {
      const disposable = this.effects.findIndex(f => f.kind !== 'meteor');
      if (disposable < 0) return;
      this.effects.splice(disposable, 1);
    }
    this.effects.push({ ...e, id: ++this.effectSeq });
  }

  note(text) {
    this.log.unshift({ text, time: Date.now() });
    this.log.length = Math.min(25, this.log.length);
  }

  // Respeta los jugadores reales entre rondas; sólo reinicia bots y estados de combate
  _respawnRound() {
    this.round++;
    this.time = 0;
    this.state = 'running';
    this.lastResult = '';
    this.shake = 0;
    this.effects = [];

    // Reposicionar y resetear estado de combate de cada jugador
    const realPlayers = this.players.filter(p => !p.bot);

    if (this.mode === 'duel') {
      const winner = this.duelWinner;
      const winningTeam = winner ? winner.team : (this.score[0] >= this.score[1] ? 0 : 1);
      const losingTeam = 1 - winningTeam;

      this.players = [];

      if (!winner) {
        for (const rp of realPlayers) { rp.hp = rp.maxHp; this.players.push(rp); }
        // Primer arranque del duelo: crear Jade (0) y Coral (1)
        if (this.config.autoFill) {
          this.addPlayer('Campeón Jade', 0, true);
          this.addPlayer('Campeón Coral', 1, true);
        }
      } else {
        // Rondas subsiguientes: mantener al ganador y buscar contrincante
        winner.x = winner.team ? 690 : 510;
        winner.y = 380;
        winner.hp = winner.maxHp;
        winner.armor = 0;
        winner.shield = 0;
        winner.cd = 0.5;
        winner.stamina = winner.maxStamina || 100;
        winner.fury = 0;
        winner.stunTimer = 0;
        winner.comboHits = 0;
        winner.isDodging = 0;
        winner.frenzyTimer = 0;
        this.players.push(winner);

        // Buscar si hay espectador real que quiera desafiar en el bando perdedor
        const realChallenger = realPlayers.find(p => p.team === losingTeam && p !== winner);
        if (realChallenger) {
          realChallenger.x = losingTeam ? 690 : 510;
          realChallenger.y = 380;
          realChallenger.hp = realChallenger.maxHp;
          realChallenger.armor = 0;
          realChallenger.shield = 0;
          realChallenger.cd = 0.5;
          realChallenger.stamina = 100;
          realChallenger.fury = 0;
          realChallenger.stunTimer = 0;
          realChallenger.frenzyTimer = 0;
          this.players.push(realChallenger);
        } else if (this.config.autoFill) {
          const oppName = losingTeam === 0 ? `Campeón Jade #${this.round}` : `Campeón Coral #${this.round}`;
          this.addPlayer(oppName, losingTeam, true);
        }
      }

      this.players.sort((a, b) => a.team - b.team);
    } else {
      // Reposicionar y resetear estado de combate en 20 vs 20 o Boss
      this.players = [];
      const count = this.mode === 'teams' ? 40 : 30;
      if (this.config.autoFill) {
        for (let i = 0; i < count; i++) {
          this.addPlayer('Bot ' + String(i + 1).padStart(2, '0'), this.mode === 'teams' ? (i % 2) : 0, true);
        }
      }

      // Reintegrar jugadores reales (sustituyen bots)
      for (const rp of realPlayers) {
        const old = this.players.find(p => p.bot && p.team === rp.team);
        if (old) {
          this.players.splice(this.players.indexOf(old), 1);
        }
        const i = this.players.filter(p => p.team === rp.team && !p.bot).length;
        if (this.mode === 'boss') {
          const angle = (i / 30) * Math.PI * 2;
          rp.x = 600 + Math.cos(angle) * 350;
          rp.y = 380 + Math.sin(angle) * 270;
        } else {
          // Teams 20 vs 20: distribución en arco táctico a lo largo de toda la arena
          const frac = (i + 0.5) / 20;
          const arcAngle = (frac - 0.5) * (Math.PI * 0.74);
          const depth = (i % 2 === 0) ? 0.78 : 0.92;
          const baseX = 455 * depth, baseY = 260 * depth;
          rp.x = rp.team === 0 ? 600 - Math.cos(arcAngle) * baseX : 600 + Math.cos(arcAngle) * baseX;
          rp.y = 380 + Math.sin(arcAngle) * baseY;
        }
        rp.hp = rp.maxHp;
        rp.armor = 0;
        rp.shield = 0;
        rp.cd = Math.random() * 1.5;
        rp.kills = 0;
        // Preserve incomplete redemptions between rounds.
        rp.wander = { ox: Math.random() * 100, oy: Math.random() * 100, t: Math.random() * 20 };
        this.players.push(rp);
      }
    }

    // Reiniciar jefe Werebear Ancestral
    this.boss = {
      id: 'boss',
      name: 'Werebear Ancestral',
      x: 600, y: 380,
      hp: this.config.bossHealth, maxHp: this.config.bossHealth,
      team: 1,
      angle: Math.PI,
      action: 'idle',
      actionTimer: 0,
      actionSeq: 0,
      cd01: 0.3,
      cd02: 2.0,
      cd03: 0.8,
      hurtTimer: 0,
      hitTriggered: false
    };

    const active = new Set(this.players.map(p => p.id));
    for (const key of this.likeTotals.keys()) if (!active.has(key) && !key.startsWith('team')) this.likeTotals.delete(key);
    for (const event of this.pendingEvents.splice(0)) this.event(event);
    this.note(`⚔ Ronda ${this.round} — ¡Que comience la batalla!`);
  }

  start(mode = 'teams') {
    this.mode       = mode;
    this.players    = [];
    this.effects    = [];
    this.score      = [0, 0];
    this.round      = 0;
    this.duelWinner = null;
    this.warWinner  = -1;
    this.roundDelay = 0;
    this.likeTotals.clear();
    this.supportTeams.clear();
    this.nextSupportTeam = 0;
    this.pendingEvents = [];
    this.seen.clear();
    this.seenOrder  = [];
    this._respawnRound();
    this.note(
      mode === 'duel'
        ? '⚔ ¡DUELO DE CAMPEONES 1 VS 1 — El ganador obtiene +1% vida y daño y busca contrincante!'
        : mode === 'teams'
        ? '⚔ ¡GUERRA DE FACCIONES 20 VS 20 — primer equipo en 10 000 pts gana!'
        : '🏰 Asalto a la Torre del Jefe en bucle'
    );
  }

  addPlayer(name, team, bot = false) {
    name = String(name || 'Aventurero').trim().replace(/^@/, '').slice(0, 40);
    team = team === 0 || team === 1 ? team : undefined;
    const existing = this.players.find(p => p.name === name && !p.bot);
    if (existing) return existing;

    if (team === undefined) {
      if (this.mode === 'boss') team = 0;
      else {
        const t0 = this.players.filter(p => p.team === 0 && !p.bot).length;
        const t1 = this.players.filter(p => p.team === 1 && !p.bot).length;
        team = t0 <= t1 ? 0 : 1;
      }
    }
    if (this.mode === 'boss') team = 0;

    const maxSide = this.mode === 'duel' ? 1 : this.mode === 'boss' ? 30 : 20;
    const side = this.players.filter(p => p.team === team);
    if (side.length >= maxSide) {
      const replace = side.find(p => p.bot);
      if (!bot && replace) {
        // Taking a seat preserves received support and cannot heal a fallen bot.
        replace.name = name;
        replace.bot = false;
        return replace;
      }
      else return null;
    }

    const i = this.players.filter(p => p.team === team).length;
    let spawnX, spawnY;
    if (this.mode === 'duel') {
      spawnX = team ? 690 : 510;
      spawnY = 380;
    } else if (this.mode === 'boss') {
      const angle = (i / 30) * Math.PI * 2;
      spawnX = 600 + Math.cos(angle) * 350;
      spawnY = 380 + Math.sin(angle) * 270;
    } else {
      // 20 vs 20: Despliegue en amplio arco táctico a lo largo de toda la arena
      const frac = (i + 0.5) / 20;
      const arcAngle = (frac - 0.5) * (Math.PI * 0.74);
      const depth = (i % 2 === 0) ? 0.78 : 0.92;
      const baseX = 455 * depth, baseY = 260 * depth;
      spawnX = team === 0 ? 600 - Math.cos(arcAngle) * baseX : 600 + Math.cos(arcAngle) * baseX;
      spawnY = 380 + Math.sin(arcAngle) * baseY;
    }

    const baseHp = this.mode === 'duel' ? this.config.baseHealth * 2.5 : this.config.baseHealth;

    const p = {
      id:         'p' + (++this.seq),
      name, team, bot,
      x:          spawnX,
      y:          spawnY,
      hp:         baseHp,
      maxHp:      baseHp,
      armor:      0,
      damageBonus:0,
      likes:      0,
      weapon:     'base',
      cd:         Math.random() * 1.5,
      shield:     0,
      kills:      0,
      angle:      team ? Math.PI : 0,
      gifts:      Object.create(null),
      likeLevels: 0,
      championBonus: 0,
      magicRemaining: 0,
      shieldCooldown: 0,
      revives:    0,
      hasMagic:   false,
      magicTimer: Math.random() * 2,
      wander:     { ox: Math.random() * 100, oy: Math.random() * 100 + 50, t: Math.random() * 20 },
      // Táctica espacial para 20 vs 20
      lane:       i < 6 ? 'north' : i >= 14 ? 'south' : 'center',
      flankOffset:((i % 3) - 1) * 0.55,
      thinkCd:    Math.random() * 0.25,
      targetId:   null,
      // Mecánicas de combate táctico (esquivo, parry, postura y furia - exclusivas de 1vs1)
      stamina:    100,
      maxStamina: 100,
      fury:       0,
      maxFury:    100,
      dodgeChance:this.mode === 'duel' ? 0.22 : 0,
      parryChance:this.mode === 'duel' ? 0.18 : 0,
      critChance: this.mode === 'duel' ? 0.18 : 0,
      stunTimer:  0,
      comboHits:  0,
      isDodging:  0,
      // Progresión de Clase y Rosas
      classLevel: 1,
      className:  'Soldado',
      isKnight:   false,
      roses:      0,
      flatDamage: 0,
      defense:    0,
      frenzyMode: false,
      frenzyTimer:0
    };
    this.players.push(p);
    return p;
  }

  damageOf(p) {
    const base = p.weapon === 'base'
      ? this.config.baseDamage
      : (this.config[p.weapon + 'Damage'] || this.config.baseDamage);
    return (base + (p.flatDamage || 0)) * (1 + (p.damageBonus || 0) / 100);
  }

  applyRoses(p, count = 1) {
    if (!p) return false;
    count = boundedCount(count);
    if (!count) return false;
    const prevRoses = p.roses || 0;
    p.roses = prevRoses + count;

    // Al dar 1 rosa restableces la vida y la aumentas 1% (por cada rosa)
    p.maxHp = Math.min(50000, Math.round(p.maxHp * Math.pow(1.01, count)));
    if (p.hp > 0) {
      p.hp = p.maxHp;
      this.effect({
        kind: 'combat_text',
        text: count === 1 ? '🌹 +1% HP (Vida llena)' : `🌹 +${count}% HP (Vida llena)`,
        x: p.x,
        y: p.y - 28,
        color: '#2ecc71',
        life: 1.2,
        max: 1.2
      });
      this.effect({
        kind: 'magic_pulse',
        x: p.x,
        y: p.y,
        r: 45,
        life: 0.35,
        max: 0.35,
        team: p.team
      });
    }

    // Ascenso a Soldado Nivel 10 al mandar 20 rosas (+2 daño, +2 defensa, restablecer vida)
    if (!p.isKnight && p.roses >= 20) {
      p.classLevel = 10;
      p.className = 'Soldado Nivel 10';
      p.isKnight = true;
      p.flatDamage = (p.flatDamage || 0) + 2;
      p.defense = (p.defense || 0) + 2;
      if (p.hp > 0) p.hp = p.maxHp; // Ascender no revive a los caídos.
      this.note(`⭐ ¡${p.name} ascendió a Soldado Nivel 10! (+2 daño, +2 def${p.hp > 0 ? ', vida restaurada' : '; necesita revivir'})`);
      this.effect({
        kind: 'combat_text',
        text: '⭐ Soldado Nivel 10',
        x: p.x, y: p.y - 36,
        color: '#ffd700', life: 2.0, max: 2.0
      });
      this.effect({
        kind: 'magic_pulse',
        x: p.x, y: p.y, r: 90, life: 0.5, max: 0.5, team: p.team
      });
    }

    // Al mandar otras 10 rosas en la siguiente clase (Soldado Nivel 10)
    if (p.isKnight || p.roses >= 20) {
      const prevExtra = Math.max(0, prevRoses - 20);
      const currExtra = Math.max(0, p.roses - 20);
      const prevTenths = Math.floor(prevExtra / 10);
      const currTenths = Math.floor(currExtra / 10);
      if (currTenths > prevTenths) {
        const triggers = currTenths - prevTenths;
        p.frenzyMode = false;
        p.frenzyTimer = Math.min(this.config.maxFrenzySeconds, (p.frenzyTimer || 0) + this.config.frenzySeconds * triggers);
        this.note(`🔥 ${p.name}: frenesí ${p.frenzyTimer}s (máximo ${this.config.maxFrenzySeconds}s)`);
        this.effect({ kind: 'combat_text', text: '🔥 FRENESÍ', x: p.x, y: p.y - 36, color: '#ff3b30', life: 1.8, max: 1.8 });
      }
    }
    return true;
  }

  event(e) {
    if (!e || !['join', 'gift', 'like'].includes(e.type)) return false;
    if (this.state === 'between') {
      if (this.pendingEvents.length >= 200) { this.note('Cola llena: evento no aplicado'); return false; }
      this.pendingEvents.push({ ...e }); return true;
    }
    if (this.state !== 'running' && this.state !== 'paused') return false;
    e = { ...e, user: String(e.user || 'Aventurero').trim().replace(/^@/, '').slice(0, 40) };
    if (e.type !== 'join' && !boundedCount(e.count)) return false;
    if (e.type === 'gift' && !this.config.rules.some(r => giftKey(r.gift) === giftKey(e.gift))) return false;
    e.team = e.team === 0 || e.team === 1 ? e.team : this.supportTeams.get(e.user);
    if (e.id) {
      if (this.seen.has(e.id)) return false;
      this.seen.add(e.id);
      this.seenOrder.push(e.id);
      if (this.seenOrder.length > 1000) this.seen.delete(this.seenOrder.shift());
    }

    let p = this.players.find(p => p.name === e.user && !p.bot);
    if (e.type === 'join' || e.type === 'gift' || e.type === 'like') {
      p = p || this.addPlayer(e.user, e.team);
    }
    // En modo duelo o cuando las plazas están completas, los regalos y likes apoyan al campeón de la facción
    if (!p) {
      const targetTeam = this.mode === 'boss' ? 0 : e.team ?? this.nextSupportTeam++ % 2;
      p = this.players.find(q => q.team === targetTeam && q.hp > 0) || this.players.find(q => q.team === targetTeam);
    }
    if (!p) { this.note('Plazas completas: ' + e.user); return false; }

    if (this.supportTeams.size >= 2000 && !this.supportTeams.has(e.user)) this.supportTeams.delete(this.supportTeams.keys().next().value);
    this.supportTeams.set(e.user, p.team);

    if (e.type === 'join') {
      this.note(`${e.user}: ${p.name === e.user ? 'combatiente' : 'apoya a ' + p.name} en ${p.team ? 'Coral' : 'Jade'}`);
      return true;
    }

    if (e.type === 'like') {
      const n = Math.max(0, Math.min(100000, Math.floor(Number(e.count) || 0)));
      if (!n) return false;
      const key  = this.config.likeScope === 'team' ? 'team' + p.team : p.id;
      const prev = this.likeTotals.get(key) || 0;
      const next = prev + n;
      this.likeTotals.set(key, next);
      p.likes += n;
      const step = this.config.likesStep * (this.config.likeScope === 'team' ? (this.mode === 'teams' ? 20 : this.mode === 'boss' ? 30 : 1) : 1);
      const levels = Math.floor(next / step) - Math.floor(prev / step);
      if (levels > 0) {
        const tgts = this.config.likeScope === 'team' ? this.players.filter(q => q.team === p.team) : [p];
        for (const q of tgts) {
          const gain = Math.max(0, Math.min(levels, this.config.maxLikeLevels - q.likeLevels));
          q.likeLevels += gain;
          q.damageBonus += gain * this.config.damagePercent;
          q.maxHp += gain * this.config.healthGain;
          if (q.hp > 0) q.hp = Math.min(q.maxHp, q.hp + gain * this.config.healthGain);
          if (this.mode === 'duel') {
            q.critChance  = Math.min(0.50, (q.critChance || 0.18) + gain * 0.002);
            q.dodgeChance = Math.min(0.40, (q.dodgeChance || 0.22) + gain * 0.0015);
          }
        }
        this.note(`${p.name}: likes aplicados; máximo ${this.config.maxLikeLevels} bloques por combatiente`);
      }
      return true;
    }

    if (e.type === 'gift') {
      const count    = Math.max(1, Math.min(100000, Math.floor(Number(e.count) || 1)));
      const giftName = giftKey(e.gift);
      let applied    = false;

      for (let i = 0; i < this.config.rules.length; i++) {
        const r = this.config.rules[i];
        if (giftKey(r.gift) !== giftName) continue;
        const key   = i + ':' + giftName + ':' + r.quantity;
        const old   = p.gifts[key] || 0;
        const total = old + count;
        p.gifts[key] = total % r.quantity;
        const times  = Math.floor(total / r.quantity);
        if (times > 0) {
          const actList = Array.isArray(r.actions) && r.actions.length ? r.actions : [r.action].filter(Boolean);
          for (const act of actList) {
            this.reward(p, act, times, r.gift);
          }
          applied = true;
        } else {
          this.note(`${p.name}: ${total}/${r.quantity} ${r.gift}`);
        }
      }

      return applied;
    }
    return false;
  }

  reward(p, action, n = 1, giftName = '') {
    const c = this.config;
    n = boundedCount(n);
    if (!p || !n) return;
    if (action === 'rose') this.applyRoses(p, n);
    if (action === 'armor') {
      p.armor = Math.min(c.armorCap, p.armor + c.armorGain * n);
      p.stamina = Math.min(p.maxStamina || 100, (p.stamina || 0) + 35 * n);
    }
    if (action === 'revive') {
      if (p.hp <= 0) {
        p.hp = Math.min(p.maxHp, c.reviveHealth);
        p.shield = 2; p.revives = Math.min(c.maxRevives, p.revives + n - 1);
        p.stamina = p.maxStamina || 100;
        p.stunTimer = 0;
        this.note(`✨ ¡${p.name} revivió con ${giftName || 'regalo'}!`);
      } else p.revives = Math.min(c.maxRevives, p.revives + n);
    }
    if (action === 'heal') {
      if (p.hp > 0) {
        p.hp = p.maxHp;
        this.effect({ kind: 'combat_text', text: '💚 Salud llena', x: p.x, y: p.y - 28, color: '#2ecc71', life: 1.2, max: 1.2 });
        this.effect({ kind: 'magic_pulse', x: p.x, y: p.y, r: 40, life: 0.35, max: 0.35, team: p.team });
        this.note(`💚 ¡${p.name} se curó por completo!`);
      }
    }
    if (action === 'damage') {
      p.flatDamage = (p.flatDamage || 0) + 2 * n;
      this.effect({ kind: 'combat_text', text: `🗡️ +${2 * n} DAÑO`, x: p.x, y: p.y - 32, color: '#ff4757', life: 1.5, max: 1.5 });
      this.note(`🗡️ ${p.name}: +${2 * n} daño`);
    }
    if (action === 'frenzy') {
      p.frenzyMode = false;
      p.frenzyTimer = Math.min(c.maxFrenzySeconds, (p.frenzyTimer || 0) + c.frenzySeconds * n);
      this.effect({ kind: 'combat_text', text: '⚡ FRENESÍ', x: p.x, y: p.y - 36, color: '#ff9f43', life: 1.8, max: 1.8 });
      this.note(`⚡ ${p.name}: frenesí activado (${p.frenzyTimer}s)`);
    }
    if (['steel','royal','legend'].includes(action)) {
      const rank = ['base', 'steel', 'royal', 'legend'];
      if (rank.indexOf(action) > rank.indexOf(p.weapon)) p.weapon = action;
    }
    if (action === 'magic') {
      if (!p.hasMagic) p.magicTimer = 0.5;
      p.hasMagic = true;
      p.magicRemaining = Math.min(c.maxMagicSeconds, p.magicRemaining + c.magicSeconds * n);
      p.fury = Math.min(p.maxFury || 100, (p.fury || 0) + 35 * n);
      this.effect({ kind: 'magic_pulse', x: p.x, y: p.y, r: 80, life: 0.6, max: 0.6, team: p.team });
    }
    if (action === 'shield') {
      if (p.shieldCooldown > 0) { this.note(`${p.name}: escudo en recarga (${Math.ceil(p.shieldCooldown)}s)`); return; }
      p.shield = Math.min(c.maxShieldSeconds, c.shieldSeconds * n);
      p.shieldCooldown = p.shield + 6;
      p.stamina = p.maxStamina || 100;
    }
    if (action === 'meteor') this.triggerMeteor(p, n);
    this.note(`${p.name} · ${actionNames[action] || action} ×${n}`);
  }

  triggerMeteor(src, times = 1) {
    const active = this.effects.filter(e => e.kind === 'meteor' && e.team === src.team).length;
    times = Math.min(boundedCount(times), Math.max(0, 3 - active));
    if (!times) { this.note('Meteoritos: máximo 3 pendientes por bando'); return; }
    let tx = 600, ty = 380;
    if (this.mode === 'boss') { tx = this.boss.x; ty = this.boss.y; }
    else {
      const enemies = this.players.filter(q => q.team !== src.team && q.hp > 0);
      if (enemies.length) { const t = enemies[Math.floor(Math.random() * enemies.length)]; tx = t.x; ty = t.y; }
      else { tx = src.team ? 200 : 1000; ty = 380; }
    }
    for (let i = 0; i < times; i++) {
      const d = i * 0.4, ox = (Math.random() - 0.5) * 60, oy = (Math.random() - 0.5) * 60;
      this.effect({
        kind: 'meteor', startX: tx + ox - 220, startY: -100,
        targetX: tx + ox, targetY: ty + oy,
        life: 0.9 + d, max: 0.9 + d, impacted: false, sourceId: src.id, team: src.team
      });
    }
    this.note(`☄️ ¡${src.name} invocó el METEORITO!`);
  }

  hit(target, damage, source, opts = {}) {
    if (target.hp <= 0 || target.shield > 0) return { result: 'immune' };

    const isDuel = this.mode === 'duel';
    const isSuper = !!opts.isSuper;

    // 1. ESQUIVO (DODGE) — Solo en 1vs1
    if (isDuel && !isSuper && (target.stunTimer || 0) <= 0 && Math.random() < (target.dodgeChance || 0)) {
      const evadeAngle = (target.angle || 0) + (Math.random() < 0.5 ? 1.6 : -1.6);
      target.x += Math.cos(evadeAngle) * 36;
      target.y += Math.sin(evadeAngle) * 36;
      target.isDodging = 0.25;
      if (source) source.comboHits = 0;
      this.effect({
        kind: 'combat_text', text: '💨 Esquivado', x: target.x, y: target.y - 20,
        color: '#40e8ff', life: 0.75, max: 0.75
      });
      return { result: 'dodge' };
    }

    // 2. PARRY / BLOQUEO PERFECTO — Solo en 1vs1
    let isParried = false;
    if (isDuel && !isSuper && (target.stunTimer || 0) <= 0 && (target.stamina || 0) >= 10 && Math.random() < (target.parryChance || 0)) {
      isParried = true;
      target.stamina = Math.max(0, (target.stamina || 100) - 10);
      target.fury = Math.min(target.maxFury || 100, (target.fury || 0) + 25);
      damage *= 0.15; // Bloqueo exitoso reduce 85% de daño
      if (source) {
        source.stunTimer = 0.45; // Atacante desestabilizado
        source.cd = Math.max(source.cd || 0, 0.45);
        source.comboHits = 0;
      }
      this.effect({
        kind: 'combat_text', text: '⚔️ Parry', x: (target.x + (source?.x || target.x)) / 2, y: (target.y + (source?.y || target.y)) / 2 - 20,
        color: '#f5b041', life: 0.75, max: 0.75
      });
      this.effect({
        kind: 'clash_spark', x: (target.x + (source?.x || target.x)) / 2, y: (target.y + (source?.y || target.y)) / 2,
        life: 0.22, max: 0.22
      });
    }

    // 3. GOLPE CRÍTICO & BONIFICACIÓN DE POSTURA ROTA — Solo en 1vs1
    let isCrit = false;
    if (isDuel && !isParried && (isSuper || Math.random() < (source?.critChance || 0))) {
      isCrit = true;
      damage *= 1.75;
      this.shake = Math.max(this.shake, 0.35);
    }
    if (isDuel && (target.stunTimer || 0) > 0) {
      damage *= 1.4; // 40% daño extra a objetivos con guardia rota / aturdidos
    }

    // 4. APLICACIÓN DE DAÑO A ARMADURA Y VIDA
    if ((target.defense || 0) > 0) {
      damage = Math.max(1, damage - target.defense);
    }
    const absorbed = Math.min(target.armor || 0, damage);
    if (target.armor !== undefined) target.armor -= absorbed;
    const finalHpLoss = damage - absorbed;
    target.hp = Math.max(0, target.hp - finalHpLoss);
    if (target === this.boss && this.boss.action !== 'death') {
      if (opts.isSuper || damage >= 100) {
        this.boss.hurtTimer = 0.35;
      }
    }

    // 5. CONSUMO DE ESTAMINA / GUARD BREAK — Solo en 1vs1
    if (isDuel && target.stamina !== undefined) {
      target.stamina = Math.max(0, target.stamina - (isCrit ? 22 : 12));
      if (target.stamina <= 0 && (target.stunTimer || 0) <= 0) {
        target.stunTimer = 1.2;
        this.effect({
          kind: 'combat_text', text: '⚠️ Postura rota', x: target.x, y: target.y - 34,
          color: '#ffd700', life: 1.1, max: 1.1
        });
      }
    }

    // 6. TEXTO DE DAÑO FLOTANTE EN ARENA — Solo en 1vs1 (para no saturar 20vs20)
    if (isDuel && !isParried) {
      this.effect({
        kind: 'combat_text',
        text: isCrit ? `💥 Crit -${Math.ceil(damage)}` : `-${Math.ceil(damage)}`,
        x: target.x, y: target.y - 20,
        color: isCrit ? '#ff3828' : '#ffffff',
        life: isCrit ? 0.8 : 0.65, max: isCrit ? 0.8 : 0.65
      });
    }

    // 7. CARGA DE COMBO Y FURIA DEL ATACANTE — Solo en 1vs1
    if (isDuel && source && !isParried) {
      source.comboHits = (source.comboHits || 0) + 1;
      source.fury = Math.min(source.maxFury || 100, (source.fury || 0) + 18);
    }

    // 8. BAJA O RESURRECCIÓN
    if (target.hp === 0) {
      if (source && source.kills !== undefined) source.kills++;
      if (target.revives > 0) {
        target.revives--;
        target.hp        = Math.min(target.maxHp, this.config.reviveHealth);
        target.shield    = 3.5;
        target.stamina   = target.maxStamina || 100;
        target.stunTimer = 0;
        this.note(`✨ ${target.name} resucitó`);
      }
    }

    return { result: isParried ? 'parry' : isCrit ? 'crit' : 'hit', damage };
  }

  // ─── Puntos por ronda ─────────────────────────────────────────────────────
  _awardRoundPoints(winner /*0 o 1*/) {
    if (this.mode === 'duel') {
      this.score[winner] = Math.min(this.score[winner] + 1000, this.config.winScore);
    } else if (this.mode === 'boss') {
      this.score[winner] = Math.min(this.score[winner] + 1000, this.config.winScore);
    } else {
      const surviving = this.players.filter(p => p.team === winner && p.hp > 0).length;
      const pts = Math.max(250, surviving * 50);
      this.score[winner] = Math.min(this.score[winner] + pts, this.config.winScore);
    }
    if (this.score[winner] >= this.config.winScore) {
      this.warWinner = winner;
    }
  }

  update(dt, control = {}) {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
    // ── Pausa entre rondas (intervalo de 4 s para mostrar resultado)
    if (this.state === 'between') {
      this.roundDelay -= dt;
      if (this.roundDelay <= 0 && this.warWinner < 0) {
        this._respawnRound();
      }
      return;
    }

    if (this.state !== 'running') return;
    dt = Math.min(0.05, dt);
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2);

    // ── Efectos ──────────────────────────────────────────────────────────────
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.effects.splice(i, 1);
        continue;
      }
      if (e.kind === 'meteor') {
        const progress = 1 - e.life / e.max;
        if (progress >= 0.85 && !e.impacted) {
          e.impacted = true;
          this.shake  = 1.0;
          const R = 220, mdmg = this.config.meteorDamage;
          if (this.mode === 'boss' && this.boss.hp > 0 && Math.hypot(this.boss.x - e.targetX, this.boss.y - e.targetY) < R)
            this.hit(this.boss, mdmg, this.players.find(p => p.id === e.sourceId));
          for (let j = 0; j < this.players.length; j++) {
            const en = this.players[j];
            if (en.hp <= 0 || en.team === e.team) continue;
            const d = Math.hypot(en.x - e.targetX, en.y - e.targetY);
            if (d < R) this.hit(en, Math.max(mdmg * 0.4, mdmg * (1 - d / (R * 1.3))), this.players.find(p => p.id === e.sourceId));
          }
          this.effect({ kind: 'crater', x: e.targetX, y: e.targetY, life: 2.5, max: 2.5 });
          this.effect({ kind: 'blast',  x: e.targetX, y: e.targetY, radius: R, life: 0.7, max: 0.7, team: e.team });
        }
      }
    }

    const living = this.players.filter(p => p.hp > 0);
    this._crowdCount.clear();
    const crowdCount = this._crowdCount;
    for (const p of living) {
      if (p.targetId) {
        crowdCount.set(p.targetId, (crowdCount.get(p.targetId) || 0) + 1);
      }
    }

    // ── IA de jugadores ───────────────────────────────────────────────────────
    for (const p of living) {
      if (p.hp <= 0) continue;
      p.shieldCooldown = Math.max(0, (p.shieldCooldown || 0) - dt);
      p.shield     = Math.max(0, p.shield - dt);
      p.cd        -= dt;
      p.isDodging  = Math.max(0, (p.isDodging || 0) - dt);
      p.stunTimer  = Math.max(0, (p.stunTimer || 0) - dt);
      if (p.frenzyTimer > 0) {
        p.frenzyTimer = Math.max(0, p.frenzyTimer - dt);
      }

      // Regeneración de estamina cuando no está aturdido
      if (p.stunTimer <= 0) {
        p.stamina = Math.min(p.maxStamina || 100, (p.stamina || 0) + 20 * dt);
      }
      if (!p.wander) p.wander = { ox: Math.random()*100, oy: Math.random()*100+50, t: Math.random()*20 };
      p.wander.t  += dt * 0.4;

      // Si está aturdido (por rotura de postura o parry), queda inmovilizado
      if (p.stunTimer > 0) {
        continue;
      }

      // ── Magia periódica ─────────────────────────────────────────────────
      if (p.hasMagic) {
        p.magicRemaining = Math.max(0, p.magicRemaining - dt);
        p.hasMagic = p.magicRemaining > 0;
        p.magicTimer -= dt;
        if (p.hasMagic && p.magicTimer <= 0) {
          p.magicTimer = this.config.magicInterval || 4.5;
          const R = 110;
          this.effect({ kind: 'magic_pulse', x: p.x, y: p.y, r: R, life: 0.4, max: 0.4, team: p.team });
          const tgts = this.mode === 'boss' ? [this.boss] : living.filter(q => q.team !== p.team);
          for (const t of tgts) {
            if (t && t.hp > 0 && Math.hypot(t.x - p.x, t.y - p.y) < R) this.hit(t, this.config.magicDamage, p);
          }
        }
      }

      // ── Selección de objetivo inteligente (evita amontonarse sobre el mismo enemigo) ──
      let target = null;
      if (p.targetId) {
        target = living.find(q => q.id === p.targetId && q.hp > 0 && (this.mode === 'boss' ? true : q.team !== p.team));
      }
      p.thinkCd = (p.thinkCd || 0) - dt;
      if (!target || target.hp <= 0 || p.thinkCd <= 0) {
        p.thinkCd = 0.25 + Math.random() * 0.15; // Actualización desfasada para máximo rendimiento
        const tgtPool = this.mode === 'boss' ? [this.boss] : living.filter(q => q.team !== p.team);
        let best = null, bestScore = Infinity;
        for (const candidate of tgtPool) {
          if (!candidate || candidate.hp <= 0) continue;
          const cdx = candidate.x - p.x;
          const cdy = candidate.y - p.y;
          const d2 = cdx * cdx + cdy * cdy;
          let score = d2;
          if (this.mode === 'teams') {
            // Penalización por aglomeración: si un enemigo ya tiene 2+ soldados encima, buscar a otro libre
            const crowd = crowdCount.get(candidate.id) || 0;
            score += crowd * 48000;
            // Afinidad por carril vertical para usar todo el ancho y alto del coliseo (norte, centro, sur)
            score += Math.abs(candidate.y - p.y) * 55;
          }
          if (score < bestScore) {
            bestScore = score;
            best = candidate;
          }
        }
        target = best;
        if (target) {
          p.targetId = target.id;
          crowdCount.set(target.id, (crowdCount.get(target.id) || 0) + 1);
        }
      }

      if (!target || target.hp <= 0) {
        // Sin objetivo enemigo vivo: patrullar hacia el centro de la arena en modo victoria / guardia
        const cx = 600 - p.x;
        const cy = 380 - p.y;
        const cd = Math.hypot(cx, cy) || 1;
        if (cd > 90) {
          p.x += (cx / cd) * 45 * dt;
          p.y += (cy / cd) * 45 * dt;
          p.angle = Math.atan2(cy, cx);
        } else {
          // Órbita suave de victoria alrededor del centro
          p.angle = p.wander.t * 2;
          p.x += Math.cos(p.angle) * 20 * dt;
          p.y += Math.sin(p.angle) * 20 * dt;
        }
        // Aplicar colisión con muro
        const ACX = 600, ACY = 380, AAX = 495, AAY = 285;
        const nx = (p.x - ACX) / AAX, ny = (p.y - ACY) / AAY;
        const d = Math.hypot(nx, ny);
        if (d > 1) {
          p.x = ACX + (nx / d) * AAX * 0.96;
          p.y = ACY + (ny / d) * AAY * 0.96;
        }
        continue;
      }

      const dx   = target.x - p.x;
      const dy   = target.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      p.angle    = Math.atan2(dy, dx);

      // ── Movimiento e IA Táctica ──────────────────────────────────────────
      if (p.id === control.id && (control.x || control.y)) {
        const l = Math.hypot(control.x, control.y) || 1;
        p.x += (control.x / l) * 110 * dt;
        p.y += (control.y / l) * 110 * dt;
      } else {
        const desired = this.mode === 'boss' ? 95 : 46;

        // Retirada táctica / repliegue defensivo si vida es crítica en 20vs20
        const isCriticalHp = this.mode === 'teams' && p.hp < (p.maxHp * 0.24) && p.cd > 0.35;
        if (isCriticalHp && dist < 70) {
          // Retroceder tácticamente para recomponerse
          const retreatAngle = p.angle + Math.PI + (p.flankOffset || 0) * 0.8;
          p.x += Math.cos(retreatAngle) * 42 * dt;
          p.y += Math.sin(retreatAngle) * 42 * dt;
        } else if (dist > desired + 70) {
          // Enfoque hacia el objetivo con ángulo de flanqueo envolvente si hay compañeros
          const crowd = crowdCount.get(target.id) || 0;
          let approachAngle = p.angle;
          if (this.mode === 'teams' && crowd > 1) {
            // Rodear al objetivo por los costados para formar un arco envolvente
            approachAngle += (p.flankOffset || 0.4) * 0.65;
          }
          const wNx = noise2(p.wander.ox + p.wander.t, 0) * 0.22;
          const wNy = noise2(0, p.wander.oy + p.wander.t) * 0.22;
          const nx  = Math.cos(approachAngle) + wNx;
          const ny  = Math.sin(approachAngle) + wNy;
          const nl  = Math.hypot(nx, ny) || 1;
          p.x += (nx / nl) * 85 * dt;
          p.y += (ny / nl) * 85 * dt;
        } else if (dist > desired) {
          // Cerca: avance directo para asestar golpe
          const nx = dx / dist;
          const ny = dy / dist;
          p.x += nx * 55 * dt;
          p.y += ny * 55 * dt;
        } else if (dist < desired - 20) {
          // Demasiado pegado: reajustar distancia de espada
          p.x -= (dx / dist) * 22 * dt;
          p.y -= (dy / dist) * 22 * dt;
        } else {
          // En rango: movimiento dinámico de combate lateral
          const side = (p.id.charCodeAt(p.id.length - 1) % 2 === 0) ? 1 : -1;
          p.x += (-dy / dist) * 30 * dt * side;
          p.y += ( dx / dist) * 30 * dt * side;
        }
      }

      // ── Separación física de espacio personal (evita amontonamiento en 20vs20) ──
      const sepRadius = this.mode === 'duel' ? 24 : 46;
      const sepR2 = sepRadius * sepRadius;
      for (const q of living) {
        if (q === p) continue;
        const sx = p.x - q.x;
        const sy = p.y - q.y;
        const d2 = sx * sx + sy * sy;
        if (d2 > 0 && d2 < sepR2) {
          const d = Math.sqrt(d2);
          const factor = (sepRadius - d) / sepRadius;
          const strength = q.team === p.team ? 65 : 32;
          p.x += (sx / d) * factor * strength * dt;
          p.y += (sy / d) * factor * strength * dt;
        }
      }

      // ── Colisión con el muro elíptico del Coliseo ──────────────────────
      const isDuel = this.mode === 'duel';
      const ACX = 600, ACY = 380;
      const AAX = isDuel ? 240 : 495;
      const AAY = isDuel ? 160 : 285;
      const nx = (p.x - ACX) / AAX;
      const ny = (p.y - ACY) / AAY;
      const wallD2 = nx * nx + ny * ny;
      if (wallD2 > 1) {
        const wd = Math.sqrt(wallD2);
        p.x = ACX + (nx / wd) * AAX * 0.96;
        p.y = ACY + (ny / wd) * AAY * 0.96;
        p.wander.ox += 2.0;
        p.wander.oy += 2.0;
      }

      // ── Ataque cuerpo a cuerpo ─────────────────────────────────────────
      const range = this.mode === 'boss' ? 120 : 65;
      if (dist < range && p.cd <= 0 && (p.stunTimer || 0) <= 0) {
        const isFrenzy = (p.frenzyTimer || 0) > 0;
        p.cd = isFrenzy ? 0.42 : (p.weapon === 'legend' ? 0.7 : p.weapon === 'royal' ? 0.9 : 1.1);
        if (this.mode === 'duel') {
          p.stamina = Math.max(0, (p.stamina || 100) - (isFrenzy ? 8 : 15));
        }

        // Super Remate al alcanzar 100 de furia (exclusivo de 1vs1)
        const isSuper = this.mode === 'duel' && (p.fury || 0) >= 100;
        if (isSuper) {
          p.fury = 0;
          this.effect({
            kind: 'combat_text', text: '🔥 Super', x: p.x, y: p.y - 28,
            color: '#ff7700', life: 1.0, max: 1.0
          });
        }

        const res = this.hit(target, this.damageOf(p) * (isSuper ? 1.5 : isFrenzy ? 1.25 : 1.0), p, { isSuper, isFrenzy });
        if (res.result !== 'dodge') {
          this.effect({
            kind: 'slash', x: p.x, y: p.y, tx: target.x, ty: target.y,
            weapon: (isFrenzy || isSuper) ? 'legend' : p.weapon, life: 0.18, max: 0.18, team: p.team,
            isFrenzy
          });
        }
      }
    }

    // ── Jefe Werebear Ancestral ───────────────────────────────────────────
    if (this.mode === 'boss' && this.boss) {
      if (this.boss.hp <= 0) {
        this.boss.action = 'death';
      } else {
        this.boss.cd01 = (this.boss.cd01 || 0) - dt;
        this.boss.cd02 = (this.boss.cd02 || 0) - dt;
        this.boss.cd03 = (this.boss.cd03 || 0) - dt;
        this.boss.actionTimer = (this.boss.actionTimer || 0) - dt;
        this.boss.hurtTimer = (this.boss.hurtTimer || 0) - dt;

        const livingJade = living.filter(p => p.team === 0);

        if (livingJade.length) {
          let closest = null;
          let minDist = Infinity;
          for (let i = 0; i < livingJade.length; i++) {
            const p = livingJade[i];
            const d = Math.hypot(p.x - this.boss.x, p.y - this.boss.y);
            if (d < minDist) {
              minDist = d;
              closest = p;
            }
          }

          if (closest) {
            this.boss.angle = Math.atan2(closest.y - this.boss.y, closest.x - this.boss.x);

            if (this.boss.actionTimer > 0) {
              if (this.boss.action === 'attack02' && !this.boss.hitTriggered && this.boss.actionTimer < 0.6) {
                this.boss.hitTriggered = true;
                const slamRadius = 220;
                for (let i = 0; i < livingJade.length; i++) {
                  const p = livingJade[i];
                  if (Math.hypot(p.x - this.boss.x, p.y - this.boss.y) < slamRadius) {
                    this.hit(p, this.config.bossDamage * 1.6, this.boss);
                    const pushAngle = Math.atan2(p.y - this.boss.y, p.x - this.boss.x);
                    p.x += Math.cos(pushAngle) * 35;
                    p.y += Math.sin(pushAngle) * 35;
                  }
                }
                this.effect({ kind: 'crater', x: this.boss.x, y: this.boss.y, life: 3.5, max: 3.5 });
                this.effect({ kind: 'blast', x: this.boss.x, y: this.boss.y, radius: slamRadius, life: 0.7, max: 0.7, team: 1 });
                this.shake = Math.max(this.shake, 0.45);
              } else if (this.boss.action === 'attack03' && !this.boss.hitTriggered && this.boss.actionTimer < 0.45) {
                this.boss.hitTriggered = true;
                for (let i = 0; i < livingJade.length; i++) {
                  const p = livingJade[i];
                  if (Math.hypot(p.x - this.boss.x, p.y - this.boss.y) < 140) {
                    this.hit(p, this.config.bossDamage * 1.3, this.boss);
                    this.effect({ kind: 'slash', x: p.x, y: p.y, tx: p.x + 10, ty: p.y + 10, weapon: 'legend', life: 0.35, max: 0.35 });
                  }
                }
              } else if (this.boss.action === 'attack01' && !this.boss.hitTriggered && this.boss.actionTimer < 0.4) {
                this.boss.hitTriggered = true;
                if (Math.hypot(closest.x - this.boss.x, closest.y - this.boss.y) < 125) {
                  this.hit(closest, this.config.bossDamage, this.boss);
                  this.effect({ kind: 'slash', x: closest.x, y: closest.y, tx: closest.x, ty: closest.y + 15, weapon: 'steel', life: 0.3, max: 0.3 });
                }
              }
            } else {
              this.boss.hitTriggered = false;

              if (this.boss.cd02 <= 0 && minDist < 270) {
                this.boss.action = 'attack02';
                this.boss.actionTimer = 1.3;
                this.boss.cd02 = 5.0;
                this.boss.actionSeq = (this.boss.actionSeq || 0) + 1;
              } else if (this.boss.cd03 <= 0 && minDist < 165) {
                this.boss.action = 'attack03';
                this.boss.actionTimer = 0.9;
                this.boss.cd03 = 3.2;
                this.boss.actionSeq = (this.boss.actionSeq || 0) + 1;
              } else if (this.boss.cd01 <= 0 && minDist < 135) {
                this.boss.action = 'attack01';
                this.boss.actionTimer = 0.8;
                this.boss.cd01 = 1.2;
                this.boss.actionSeq = (this.boss.actionSeq || 0) + 1;
              } else if (minDist > 80) {
                this.boss.action = 'walk';
                const bossSpeed = 85;
                this.boss.x += Math.cos(this.boss.angle) * bossSpeed * dt;
                this.boss.y += Math.sin(this.boss.angle) * bossSpeed * dt;

                const nx = (this.boss.x - 600) / 450;
                const ny = (this.boss.y - 380) / 260;
                const distNorm = Math.hypot(nx, ny);
                if (distNorm > 1) {
                  this.boss.x = 600 + (nx / distNorm) * 445;
                  this.boss.y = 380 + (ny / distNorm) * 255;
                }
              } else {
                this.boss.action = 'idle';
              }
            }
          }
        } else {
          this.boss.action = 'idle';
        }

        if (this.boss.hurtTimer > 0 && this.boss.actionTimer <= 0) {
          this.boss.action = 'hurt';
        }
      }
    }

    // ── Condición de fin de ronda ─────────────────────────────────────────
    const t0alive    = this.players.filter(p => p.team === 0 && p.hp > 0);
    const t1alive    = this.players.filter(p => p.team === 1 && p.hp > 0);
    const bothJoined = this.players.some(p => p.team === 0) && this.players.some(p => p.team === 1);
    const timeUp     = this.time >= this.config.roundSeconds;

    let roundOver  = false;
    let roundWinner= -1;

    if (this.mode === 'boss') {
      if (this.boss.hp <= 0) { roundOver = true; roundWinner = 0; }
      else if (!t0alive.length || timeUp) { roundOver = true; roundWinner = 1; }
    } else {
      if (bothJoined && !t0alive.length && !t1alive.length) { roundOver = true; }
      else if (bothJoined && !t0alive.length) { roundOver = true; roundWinner = 1; }
      else if (bothJoined && !t1alive.length) { roundOver = true; roundWinner = 0; }
      else if (timeUp) {
        roundOver = true;
        if (t0alive.length !== t1alive.length) roundWinner = t0alive.length > t1alive.length ? 0 : 1;
        else {
          const hp0 = t0alive.reduce((n, p) => n + p.hp / p.maxHp, 0);
          const hp1 = t1alive.reduce((n, p) => n + p.hp / p.maxHp, 0);
          if (Math.abs(hp0 - hp1) > 0.0001) roundWinner = hp0 > hp1 ? 0 : 1;
        }
      }
    }

    if (roundOver && roundWinner < 0) {
      this.duelWinner = null; this.state = 'between'; this.roundDelay = 4;
      this.lastResult = 'Empate: sin puntos ni bonificaciones'; this.note(this.lastResult); return;
    }
    if (roundOver) {
      if (this.mode === 'duel') {
        // En 1 vs 1: el ganador aumenta vida y daño 1% gratis, y se busca contrincante
        const winner = this.players.find(p => p.team === roundWinner) || this.players[roundWinner];
        if (winner) {
          if (winner.championBonus < this.config.maxChampionWins) {
            winner.maxHp += this.config.baseHealth * 2.5 * 0.01;
            winner.damageBonus += 1;
            winner.championBonus++;
          }
          winner.wins = (winner.wins || 0) + 1;
          winner.hp = winner.maxHp;
          this.duelWinner = winner;
        }
        this.score[roundWinner] = (this.score[roundWinner] || 0) + 1;
        this.state = 'between';
        this.roundDelay = 2.5;
        this.lastResult = 'Buscando contrincante…';
        this.note(`⚔ ¡${winner ? winner.name : (roundWinner === 0 ? 'Jade' : 'Coral')} venció! (+1% vida y daño) — Buscando contrincante…`);
      } else {
        this._awardRoundPoints(roundWinner);
        const names = ['JADE','CORAL'];
        if (this.warWinner >= 0) {
          this.state      = 'ended';
          this.lastResult = `🏆 ¡VICTORIA DE GUERRA — ${this.mode === 'boss' ? (this.warWinner === 0 ? 'AVENTUREROS' : 'LA TORRE') : names[this.warWinner]}! ${this.config.winScore} pts alcanzados`;
        } else {
          this.state       = 'between';
          this.roundDelay  = 4;
          const pts0 = this.score[0], pts1 = this.score[1];
          this.lastResult  = this.mode === 'boss'
            ? (roundWinner === 0 ? '🏰 ¡Torre destruida! +1000 pts Aventureros' : '💀 ¡El jefe resiste! +1000 pts Torre')
            : `Ronda: ${names[roundWinner]} gana — ${names[0]} ${pts0} | ${names[1]} ${pts1} pts`;
        }
        this.note(this.lastResult);
      }
    }
  }
}

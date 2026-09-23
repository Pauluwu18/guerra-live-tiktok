import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Battle, defaults, validConfig, MAX_EFFECTS } from './public/engine.mjs';
let seed = 901;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('OK:', name); }
function setup(mode = 'teams') {
  const b = new Battle(); b.start(mode);
  b.event({ type: 'join', user: 'Alice', team: 0 });
  return [b, b.players.find(p => p.name === 'Alice')];
}
check('Likes, armadura, reservas y magia tienen límites', () => {
  const [b,p] = setup();
  for (let i=0;i<20;i++) {
    b.event({ type:'like', user:p.name, count:100000 });
    for (const gift of ['Finger Heart','Doughnut','Perfume']) b.event({type:'gift',user:p.name,gift,count:100000});
  }
  assert.equal(p.damageBonus,40); assert.equal(p.maxHp,140);
  assert.equal(p.armor,100); assert.equal(p.revives,3); assert.equal(p.magicRemaining,60);
});
check('Rosas sin armadura doble, sin resucitar gratis ni nombres parciales', () => {
  const [b,p]=setup(); p.hp=0;
  b.event({type:'gift',user:p.name,gift:'Rose',count:20});
  assert.equal(p.hp,0); assert.equal(p.armor,0); assert.equal(p.flatDamage,2);
  assert.equal(b.event({type:'gift',user:p.name,gift:'Rose Nebula',count:100}),false);
  assert.equal(p.roses,20);
});
check('Frenesí expira en todos los modos y no supera 10 segundos', () => {
  for (const mode of ['teams','duel','boss']) {
    const [b,p]=setup(mode); b.applyRoses(p,100000);
    assert.equal(p.frenzyTimer,10); assert.equal(p.frenzyMode,false);
    b.hit=()=>({result:'immune'});
    for(let i=0;i<220;i++) b.update(.05);
    assert.equal(p.frenzyTimer,0);
  }
});
check('Escudo no permite invulnerabilidad continua por spam', () => {
  const [b,p]=setup(); b.reward(p,'shield',100000); assert.equal(p.shield,6);
  b.hit=()=>({result:'immune'});
  for(let i=0;i<140;i++) { b.update(.05); b.reward(p,'shield'); }
  assert.equal(p.shield,0); assert.ok(p.shieldCooldown>0);
});
check('Armas repetidas no apilan críticos ni degradan espada', () => {
  const [b,p]=setup('duel'); const crit=p.critChance;
  b.reward(p,'royal'); b.reward(p,'steel',100000);
  assert.equal(p.weapon,'royal'); assert.equal(p.critChance,crit);
});
check('Magia expira y repetir regalo no adelanta su siguiente golpe', () => {
  const [b,p]=setup(); b.reward(p,'magic'); p.magicTimer=3;
  b.reward(p,'magic'); assert.equal(p.magicTimer,3);
  p.magicRemaining=.02; b.update(.05); assert.equal(p.hasMagic,false);
});
check('Empate auténtico sin premio automático a Jade', () => {
  for(const mode of ['teams','duel']) {
    const [b]=setup(mode); b.time=b.config.roundSeconds; b.update(0);
    assert.equal(b.state,'between'); assert.deepEqual(b.score,[0,0]);
    assert.match(b.lastResult,/Empate/);
    b.roundDelay=0; b.update(.01); assert.ok(b.players.some(p=>p.name==='Alice'));
  }
});
check('Al terminar el tiempo gana el porcentaje de vida restante', () => {
  const [b]=setup('duel'); b.players[0].hp=1;
  b.time=b.config.roundSeconds; b.update(0); assert.deepEqual(b.score,[0,1]);
});
check('Bonus de campeón limitado a 10 victorias', () => {
  const [b,p]=setup('duel');
  for(let i=0;i<50;i++) {
    b.players.find(q=>q.team===1).hp=0; b.update(.01);
    b.roundDelay=0; b.update(.01);
  }
  assert.equal(p.championBonus,10); assert.equal(p.maxHp,275); assert.equal(p.damageBonus,10);
});
check('Apoyos sin plaza equilibrados y elección Coral recordada', () => {
  const [b]=setup('duel'); b.event({type:'join',user:'Bob',team:1});
  b.event({type:'join',user:'Fan',team:1});
  b.event({type:'like',user:'Fan',count:50}); assert.equal(b.players[1].damageBonus,2);
  for(let i=0;i<20;i++) b.event({type:'like',user:'Support'+i,count:50});
  assert.equal(b.players[0].damageBonus,20); assert.equal(b.players[1].damageBonus,22);
});
check('Eventos durante cambio de ronda se aplican una vez al iniciar', () => {
  const [b,p]=setup(); b.state='between'; b.roundDelay=0;
  const e={id:'queued',type:'gift',user:p.name,gift:'Rose',count:10};
  b.event(e); b.event(e); assert.equal(p.roses,0);
  b.update(.05); assert.equal(p.roses,10); assert.equal(b.pendingEvents.length,0);
});
check('Canjes parciales y posiciones sobreviven cambio de ronda', () => {
  const [b,p]=setup(); b.event({type:'join',user:'Second',team:0});
  b.event({type:'gift',user:p.name,gift:'GG',count:9});
  b._respawnRound(); b.event({type:'gift',user:p.name,gift:'GG',count:1});
  assert.equal(p.shield,3);
  const q=b.players.find(q=>q.name==='Second'); assert.notEqual(p.y,q.y);
});
check('Ocupar bot no cura ni elimina apoyo acumulado', () => {
  const b=new Battle();b.start('duel');const p=b.players[0]; p.hp=0;p.armor=25;
  b.event({type:'join',user:'New',team:0}); assert.equal(b.players[0],p);assert.equal(p.hp,0);assert.equal(p.armor,25);
});
check('Sin ataques de soldados muertos durante el mismo paso', () => {
  const [b]=setup('duel'); const [a,z]=b.players;
  a.x=580;z.x=620;a.cd=z.cd=0;a.damageBonus=10000;
  a.critChance=z.critChance=a.dodgeChance=z.dodgeChance=a.parryChance=z.parryChance=0;
  const before=a.hp; b.update(.01); assert.equal(z.hp,0); assert.ok(a.hp>=before);
});
check('Datos malformados y reglas duplicadas no rompen motor', () => {
  assert.doesNotThrow(()=>validConfig(null));
  const c=validConfig({rules:[null,{gift:'Rose',action:'rose',quantity:1},{gift:' ROSE ',action:'armor',quantity:1}],magicInterval:-99,shieldSeconds:999});
  assert.equal(c.rules.length,1);assert.equal(c.magicInterval,2);assert.equal(c.shieldSeconds,5);
  const [b,p]=setup(); assert.equal(b.event(null),false);
  b.addPlayer('Invalid',99); assert.ok(b.players.every(p=>p.team===0||p.team===1));
  b.update(NaN); assert.ok(Number.isFinite(b.time));
  assert.equal(b.event({type:'gift',user:p.name,gift:'Rose',count:-100}),false);
});
check('Ráfaga de 100 000 meteoritos tiene trabajo y memoria acotados', () => {
  const [b,p]=setup(); const started=performance.now();
  b.reward(p,'meteor',100000);
  assert.equal(b.effects.filter(e=>e.kind==='meteor').length,3);
  for(let i=0;i<1000;i++) b.reward(p,'magic');
  assert.ok(b.effects.length<=MAX_EFFECTS);
  assert.ok(b.effects.filter(e=>e.kind==='meteor').every(e=>!('source' in e)));
  for(let i=0;i<300;i++) b.update(.033);
  assert.ok(b.effects.length<=MAX_EFFECTS);
  assert.ok(JSON.stringify(b.effects).length<100000);
  console.log('  Ráfaga y 300 pasos:',Math.round(performance.now()-started),'ms');
});
check('Sesión prolongada conserva capacidades y números finitos', () => {
  const [b]=setup();
  for(let i=0;i<18000;i++) {
    if(b.state==='ended')b.start('teams');
    b.update(.033);
    if(i%100===0) {
      assert.equal(b.players.length,40); assert.ok(b.effects.length<=MAX_EFFECTS);
      assert.ok(b.players.every(p=>[p.hp,p.maxHp,p.x,p.y].every(Number.isFinite)));
    }
  }
});
console.log(`✅ ${checks} pruebas de regresión superadas`);

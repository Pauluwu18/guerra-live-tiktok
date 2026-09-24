import assert from 'node:assert/strict';
import {Battle,BOSS_BODY_RADIUS,BOSS_PLAYER_RANGE} from './public/engine.mjs';

let seed=42;
Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const make=()=>{const b=new Battle();b.start('boss');return b;};

{
  const b=make();
  const hero=b.players[0];
  b.players.forEach(p=>{if(p!==hero)p.hp=0;});
  hero.x=b.boss.x;hero.y=b.boss.y;hero.cd=999;
  b.update(.05);
  const distance=Math.hypot(hero.x-b.boss.x,hero.y-b.boss.y);
  assert.ok(distance>=BOSS_BODY_RADIUS-0.01,'El cuerpo expulsa jugadores solapados');
  assert.equal(BOSS_PLAYER_RANGE,70,'El alcance del jugador coincide con el cuerpo visible');
}

{
  const b=make();
  const hero=b.players[0];
  b.players.forEach(p=>{if(p!==hero)p.hp=0;});
  hero.x=850;hero.y=380;hero.cd=999;
  const x=b.boss.x;
  b.update(.05);
  assert.ok(b.boss.x>x,'El jefe persigue al jugador en vez de permanecer estático');
  assert.equal(b.boss.action,'walk');
}

{
  const b=make();
  const [near,attacker]=b.players;
  b.players.forEach(p=>{if(p!==near&&p!==attacker)p.hp=0;});
  near.x=650;near.y=380;attacker.x=820;attacker.y=380;
  b.hit(b.boss,5,attacker);
  b.update(.05);
  assert.equal(b.boss.aggroId,attacker.id,'El jefe recuerda quién lo golpeó');
  assert.ok(Math.abs(b.boss.angle)<0.01,'El jefe mira al atacante aunque exista otro jugador cerca');
}

{
  const b=make();
  b.boss.hp=b.boss.maxHp*.3;
  b.update(.05);
  assert.equal(b.boss.phase,3,'El jefe entra en fase 3 con poca vida');
}

{
  const b=make();
  b.players.forEach((p,i)=>{p.x=600+35*Math.cos(i);p.y=380+35*Math.sin(i);p.cd=999;});
  b.boss.cd02=0;b.update(.05);
  assert.equal(b.boss.action,'attack02');
  assert.ok(b.effects.some(e=>e.kind==='warning_ring'&&e.radius===145),'El ataque de área avisa su alcance real');
}

console.log('OK: cuerpo, alcance, persecución, aggro, fases y aviso del jefe.');

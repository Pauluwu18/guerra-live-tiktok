import assert from 'node:assert/strict';
import { Battle, defaults, validConfig, MAX_EFFECTS } from './public/engine.mjs';

let seed = 12345;
Math.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);

console.log('--- Pruebas RPG Medieval TikTok Live (movimiento orgánico + bucle de guerra) ---');

// 1. Capacidad 20 vs 20 (40 jugadores)
const b = new Battle();
b.start('teams');
assert.equal(b.players.length, 40, 'Capacidad 20 vs 20 = 40 jugadores');
assert.equal(b.round, 1, 'Ronda inicial = 1');
b.event({ type: 'join', user: 'ReyArturo', team: 0 });
assert.equal(b.players.length, 40);
const p = b.players.find(x => x.name === 'ReyArturo');
assert.ok(p && !p.bot);
assert.ok(p.wander, 'Jugador debe tener objeto wander para movimiento orgánico');

// 2. Likes +2% por 50, con límite
b.event({ type: 'like', user: 'ReyArturo', count: 49 });
assert.equal(p.damageBonus, 0);
b.event({ type: 'like', user: 'ReyArturo', count: 1, id: 'l1' });
assert.equal(p.damageBonus, 2);
assert.equal(b.damageOf(p), 10 * 1.02);
b.event({ type: 'like', user: 'ReyArturo', count: 100, id: 'l1' });
assert.equal(p.damageBonus, 2, 'Sin duplicar evento');
b.event({ type: 'like', user: 'ReyArturo', count: 200 }); // total 300 → 3 bloques
assert.equal(p.damageBonus, 10);

// 3. Armadura y escudo
b.event({ type: 'gift', user: 'ReyArturo', gift: 'Finger Heart', count: 2 });
assert.equal(p.armor, 50);
b.event({ type: 'gift', user: 'ReyArturo', gift: 'GG', count: 9 });
assert.equal(p.shield, 0);
b.event({ type: 'gift', user: 'ReyArturo', gift: 'GG', count: 1 });
assert.equal(p.shield, 3);

// 4. Revivir
b.event({ type: 'gift', user: 'ReyArturo', gift: 'Doughnut', count: 3 });
assert.equal(p.revives, 3);
p.shield = 0;
b.hit(p, 100000);
assert.equal(p.revives, 2);
assert.ok(p.hp > 0);
p.hp = 0; p.revives = 0;
b.event({ type: 'gift', user: 'ReyArturo', gift: 'Doughnut', count: 1 });
assert.equal(p.hp, 100);

// 5. Armas
b.event({ type: 'gift', user: 'ReyArturo', gift: 'Hand Heart', count: 1 });
assert.equal(p.weapon, 'steel');

// 6. Magia periódica
b.event({ type: 'gift', user: 'ReyArturo', gift: 'Perfume', count: 1 });
assert.equal(p.hasMagic, true);

// 7. Meteorito
const effectsBefore = b.effects.length;
b.event({ type: 'gift', user: 'ReyArturo', gift: 'Galaxy', count: 1 });
assert.ok(b.effects.find(e => e.kind === 'meteor'));

// 8. Torre del jefe y bucle
const boss = new Battle();
boss.start('boss');
assert.equal(boss.round, 1);
boss.boss.hp = 0;
boss.update(0.05);
assert.equal(boss.state, 'between', 'Después de ganar ronda pasa a between');
assert.equal(boss.score[0], 1000, '+1000 pts a aventureros al destruir la torre');
assert.equal(boss.warWinner, -1, 'Sin ganador todavía');
boss.roundDelay = 0.001;
boss.update(0.05);
assert.equal(boss.state, 'running', 'Vuelve a running después del delay');
assert.equal(boss.round, 2, 'Round 2 inicia');

// 9. Victoria de guerra al llegar a winScore
const war = new Battle({ ...defaults, winScore: 200, roundSeconds: 999 });
war.start('teams');
war.score[0] = 160;
// Matar todos los jugadores del equipo 1 para que gane equipo 0
war.players.filter(p => p.team === 1).forEach(p => { p.hp = 0; });
war.update(0.05);
assert.equal(war.state, 'ended', 'Estado ended al alcanzar winScore');
assert.equal(war.warWinner, 0, 'JADE gana la guerra');
assert.ok(war.lastResult.includes('VICTORIA DE GUERRA'));

// 10. Pausa
const paused = new Battle();
paused.start('teams');
paused.state = 'paused';
paused.update(0.05);
assert.equal(paused.time, 0);

// 11. validConfig
assert.equal(validConfig({ likesStep: 0 }).likesStep, 1);

// 12. Separación solo entre compañeros (los enemigos no se repelen por separación de equipo)
{
  const testBattle = new Battle();
  testBattle.start('teams');
  const jade = testBattle.players.find(p => p.team === 0);
  const coral = testBattle.players.find(p => p.team === 1);
  // Colocar a Jade a la izquierda (420) y Coral a la derecha (500)
  jade.x = 420; jade.y = 380;
  coral.x = 500; coral.y = 380;
  // Matar a todos los demás para aislar la prueba
  testBattle.players.forEach(p => { if (p !== jade && p !== coral) p.hp = 0; });
  const oldJadeX = jade.x;
  testBattle.update(0.04);
  // Jade debe avanzar hacia Coral (hacia la derecha, x > oldJadeX)
  assert.ok(jade.x > oldJadeX, 'El caballero Jade debe avanzar hacia el enemigo');
}

// 13. Supervivientes sin enemigos se mueven hacia el centro (sin congelarse)
{
  const testBattle = new Battle();
  testBattle.start('teams');
  // Matar a todo el equipo 1
  testBattle.players.forEach(p => { if (p.team === 1) p.hp = 0; });
  const survivor = testBattle.players.find(p => p.team === 0);
  survivor.x = 200; survivor.y = 380; // lejos a la izquierda
  const prevX = survivor.x;
  testBattle.update(0.1);
  // Debe moverse hacia el centro (600, 380), por lo que x debe aumentar
  assert.ok(survivor.x > prevX, 'El sobreviviente debe patrullar hacia el centro de la arena');
}

// 14. Modo Duelo 1 vs 1 (Duelo de Campeones)
{
  const duel = new Battle();
  duel.start('duel');
  assert.equal(duel.mode, 'duel');
  assert.equal(duel.players.length, 2, 'Duelo debe iniciar con exactamente 2 combatientes');
  const [jadeChamp, coralChamp] = duel.players;
  assert.equal(jadeChamp.team, 0, 'Campeón 1 es Jade');
  assert.equal(coralChamp.team, 1, 'Campeón 2 es Coral');
  assert.equal(jadeChamp.maxHp, 250, 'HP de gladiador aumentado para combate dramático');
  assert.equal(coralChamp.maxHp, 250);

  // El primer espectador que interactúa se corona como Campeón Jade
  duel.event({ type: 'like', user: 'FanJade', team: 0, count: 100 });
  const activeJade = duel.players.find(p => p.team === 0);
  assert.equal(activeJade.name, 'FanJade', 'Espectador real toma el puesto de campeón Jade');
  assert.ok(activeJade.damageBonus >= 4, 'Like potencia al nuevo campeón Jade');

  // El resto de la audiencia que apoya a Jade sin ser el campeón buffea al campeón activo
  duel.event({ type: 'like', user: 'OtroFanJade', team: 0, count: 100 });
  assert.ok(activeJade.damageBonus >= 8, 'Audiencia adicional buffea al campeón activo');

  // Audiencia apoya con regalos al campeón Coral
  duel.event({ type: 'gift', user: 'FanCoral', team: 1, gift: 'Finger Heart', count: 2 });
  const activeCoral = duel.players.find(p => p.team === 1);
  assert.equal(activeCoral.armor, 50, 'Regalo equipa armadura al campeón Coral');

  // Movimiento lateral sobre el suelo de la arena independiente
  duel.update(0.04);
  assert.ok(activeJade.x > 340, 'Campeón Jade avanza desde el extremo izquierdo');
  assert.ok(activeCoral.x < 860, 'Campeón Coral avanza desde el extremo derecho');
  assert.equal(activeJade.y, 590, 'Campeón Jade permanece sobre la línea del suelo');
  assert.equal(activeCoral.y, 590, 'Campeón Coral permanece sobre la línea del suelo');
}

// 15. Mecánicas Complejas de Combate 1 vs 1 (Esquivo, Parry, Crítico, Estamina y Guard Break)
{
  const b = new Battle();
  b.start('duel');
  const [p1, p2] = b.players;
  assert.equal(p1.stamina, 100, 'Estamina inicial = 100');
  assert.equal(p1.fury, 0, 'Furia inicial = 0');
  assert.ok(p1.dodgeChance >= 0.20, 'Probabilidad base de esquivo >= 20%');
  assert.ok(p1.parryChance >= 0.18, 'Probabilidad base de parry >= 18%');

  // A. Prueba de Esquivo (Dodge garantizado)
  p2.dodgeChance = 1.0;
  const hpBeforeDodge = p2.hp;
  const dodgeRes = b.hit(p2, 50, p1);
  assert.equal(dodgeRes.result, 'dodge', 'Debe esquivar el golpe');
  assert.equal(p2.hp, hpBeforeDodge, 'No debe sufrir daño al esquivar');
  assert.equal(p2.y, 590, 'El esquivo lateral no separa al campeón del suelo');
  assert.ok(b.effects.some(e => e.kind === 'combat_text' && /esquivad/i.test(e.text)), 'Emite texto flotante de esquivo');

  // B. Prueba de Parry / Bloqueo (Parry garantizado)
  p2.dodgeChance = 0;
  p2.parryChance = 1.0;
  p2.stamina = 100;
  p2.fury = 0;
  const parryRes = b.hit(p2, 100, p1);
  assert.equal(parryRes.result, 'parry', 'Debe ejecutar parry');
  assert.ok(p1.stunTimer > 0, 'Atacante debe quedar desestabilizado/aturdido tras ser parreado');
  assert.ok(p2.fury >= 25, 'Defensor debe ganar furia con el parry');
  assert.ok(b.effects.some(e => e.kind === 'combat_text' && /parry/i.test(e.text)), 'Emite texto flotante de parry');

  // C. Prueba de Golpe Crítico (Crítico garantizado)
  p2.dodgeChance = 0;
  p2.parryChance = 0;
  p1.critChance = 1.0;
  const critHpBefore = p2.hp;
  const critRes = b.hit(p2, 20, p1);
  assert.equal(critRes.result, 'crit', 'Debe asestar golpe crítico');
  assert.equal(critHpBefore - p2.hp, 20 * 1.75, 'Crítico debe multiplicar daño por 1.75x');
  assert.ok(b.effects.some(e => e.kind === 'combat_text' && /crit/i.test(e.text)), 'Emite texto flotante de crítico');

  // D. Prueba de Guard Break / Postura Rota
  p2.stamina = 5;
  p2.stunTimer = 0;
  b.hit(p2, 10, p1);
  assert.equal(p2.stamina, 0, 'Estamina reducida a 0');
  assert.ok(p2.stunTimer > 0, 'Debe sufrir Guard Break y quedar aturdido');
  assert.ok(b.effects.some(e => e.kind === 'combat_text' && /postura rota/i.test(e.text)), 'Emite texto flotante de postura rota');
}

// 16. Validación de aislamiento de 20 vs 20 y progresión continua en 1 vs 1
{
  // A. En 20 vs 20 no hay esquivo, parry ni críticos
  const army = new Battle();
  army.start('teams');
  assert.equal(army.players.length, 40);
  assert.equal(army.players[0].dodgeChance, 0, '20v20 tiene 0 esquivo');
  assert.equal(army.players[0].parryChance, 0, '20v20 tiene 0 parry');
  assert.equal(army.players[0].critChance, 0, '20v20 tiene 0 crítico');

  // B. En 1 vs 1: victoria otorga +1% vida, +1% daño y pasa a 'Buscando contrincante…'
  const duelGame = new Battle();
  duelGame.start('duel');
  const [j, c] = duelGame.players;
  const prevMaxHp = j.maxHp;
  const prevBonus = j.damageBonus;

  // Derrotar al rival Coral
  c.hp = 0;
  duelGame.update(0.04);
  assert.equal(duelGame.state, 'between');
  assert.equal(duelGame.lastResult, 'Buscando contrincante…');
  assert.equal(j.maxHp, prevMaxHp + 2.5, 'Ganador aumenta 1% de vida máxima');
  assert.equal(j.damageBonus, prevBonus + 1, 'Ganador aumenta 1% de daño adicional');

  // Siguiente ronda mantiene al ganador con sus mejoras y busca contrincante
  duelGame.roundDelay = 0;
  duelGame.update(0.04);
  assert.equal(duelGame.state, 'running');
  assert.equal(duelGame.players.length, 2);
  const maintainedWinner = duelGame.players.find(p => p.team === 0);
  assert.equal(maintainedWinner.maxHp, prevMaxHp + 2.5, 'Mantiene vida mejorada');
  assert.equal(maintainedWinner.damageBonus, prevBonus + 1, 'Mantiene daño mejorado');
}

// 17. Validación de dispersión espacial y uso de toda la arena en 20 vs 20
{
  const war = new Battle();
  war.start('teams');
  assert.equal(war.players.length, 40);

  const team0 = war.players.filter(p => p.team === 0);
  const team1 = war.players.filter(p => p.team === 1);

  // A. Verificación de despliegue en arco: ocupa norte, centro y sur
  const minY0 = Math.min(...team0.map(p => p.y));
  const maxY0 = Math.max(...team0.map(p => p.y));
  assert.ok(minY0 < 250, `Tropas Jade abarcan el flanco norte (minY: ${minY0} < 250)`);
  assert.ok(maxY0 > 500, `Tropas Jade abarcan el flanco sur (maxY: ${maxY0} > 500)`);
  assert.ok(maxY0 - minY0 > 300, `Tropas desplegadas a lo largo de más de 300px verticales`);

  // B. Simular combate durante varios segundos y comprobar que no colapsan en 1 solo punto
  for (let i = 0; i < 60; i++) war.update(0.04);
  const living0 = war.players.filter(p => p.team === 0 && p.hp > 0);
  if (living0.length >= 2) {
    const minLivingY = Math.min(...living0.map(p => p.y));
    const maxLivingY = Math.max(...living0.map(p => p.y));
    assert.ok(maxLivingY - minLivingY > 150, `El combate sigue distribuido verticalmente (span: ${maxLivingY - minLivingY}px)`);
  }
}

// 18. Validación de Nueva Clase Soldado Nivel 10 al mandar 20 rosas (+2 daño, +2 defensa, restablece vida)
{
  const b = new Battle();
  b.start('teams');
  b.event({ type: 'join', user: 'Lancelot', team: 0 });
  const p = b.players.find(x => x.name === 'Lancelot');
  assert.ok(p);
  assert.equal(p.classLevel, 1, 'Clase inicial nivel 1');
  assert.equal(p.isKnight, false, 'No es caballero inicialmente');

  // Reducir vida para comprobar el restablecimiento
  p.hp = 25;
  const prevDamage = b.damageOf(p);

  // Enviar 19 rosas (aún no llega a 20)
  b.event({ type: 'gift', user: 'Lancelot', gift: 'Rose', count: 19 });
  assert.equal(p.roses, 19);
  assert.equal(p.classLevel, 1);
  assert.equal(p.isKnight, false);

  // Enviar la 20ª rosa -> Sube a Soldado Nivel 10
  b.event({ type: 'gift', user: 'Lancelot', gift: 'Rose', count: 1 });
  assert.equal(p.roses, 20);
  assert.equal(p.classLevel, 10, 'Sube de clase a Soldado Nivel 10');
  assert.equal(p.className, 'Soldado Nivel 10');
  assert.equal(p.isKnight, true, 'isKnight activado');
  assert.equal(p.defense, 2, '+2 de defensa');
  assert.equal(p.flatDamage, 2, '+2 de daño base');
  assert.equal(p.hp, p.maxHp, 'Restablece vida al 100%');
  assert.ok(b.damageOf(p) > prevDamage, 'El daño aumentó');
}

// 19. Validación de Modo Ataque Frenesí con 10 rosas extra (habilidad 5s en todos los modos)
{
  // A. En 20 vs 20: Modo Ataque Frenesí temporal al mandar 10 rosas extra
  const war = new Battle();
  war.start('teams');
  war.event({ type: 'join', user: 'Gawain', team: 0 });
  const pWar = war.players.find(x => x.name === 'Gawain');
  // 20 rosas para subir a Soldado Nivel 10
  war.event({ type: 'gift', user: 'Gawain', gift: 'Rose', count: 20 });
  assert.equal(pWar.isKnight, true);
  assert.equal(pWar.frenzyMode, false, 'Aún sin frenesí');

  // 10 rosas extra en la siguiente clase
  war.event({ type: 'gift', user: 'Gawain', gift: 'Rose', count: 10 });
  assert.equal(pWar.roses, 30);
  assert.equal(pWar.frenzyMode, false);
  assert.equal(pWar.frenzyTimer, 5, 'El frenesí es temporal también en equipos');

  // B. En 1 vs 1: Habilidad Frenesí que dura 5 segundos
  const duel = new Battle();
  duel.start('duel');
  const pDuel = duel.players.find(x => x.team === 0);
  // 20 rosas para subir a Soldado Nivel 10
  duel.applyRoses(pDuel, 20);
  assert.equal(pDuel.isKnight, true);
  assert.equal(pDuel.frenzyTimer, 0);

  // 10 rosas extra -> Activa habilidad por 5 segundos
  duel.applyRoses(pDuel, 10);
  assert.equal(pDuel.frenzyTimer, 5.0, 'Habilidad activa por 5 segundos en 1vs1');

  // Comprobar decremento del temporizador en update(dt) con pasos de 0.05s
  for (let i = 0; i < 20; i++) duel.update(0.05); // 20 * 0.05 = 1.0s
  assert.ok(Math.abs(pDuel.frenzyTimer - 4.0) < 0.05, 'Temporizador disminuye 1s');

  for (let i = 0; i < 90; i++) duel.update(0.05); // 90 * 0.05 = 4.5s
  assert.equal(pDuel.frenzyTimer, 0, 'Expira a los 5 segundos');
}

// 20. Combinar múltiples acciones por regalo (Tags) y múltiples niveles por regalo
{
  const customConfig = validConfig({
    rules: [
      { gift: 'Rose', actions: ['armor', 'steel', 'heal', 'frenzy'], quantity: 20 },
      { gift: 'Rose', actions: ['shield', 'damage'], quantity: 10 }
    ]
  });
  assert.equal(customConfig.rules.length, 2, 'Admite 2 reglas con el mismo regalo y distinta cantidad');
  const bTag = new Battle(customConfig);
  bTag.start('teams');
  bTag.event({ type: 'join', user: 'Lancelot', team: 0 });
  const pL = bTag.players.find(x => x.name === 'Lancelot');
  assert.ok(pL);

  // 10 rosas activan escudo y daño
  bTag.event({ type: 'gift', user: 'Lancelot', gift: 'Rose', count: 10 });
  assert.equal(pL.shield, 3, 'Escudo activado por la regla de 10 rosas');
  assert.equal(pL.flatDamage, 2, 'Daño +2 activado por la regla de 10 rosas');

  // 20 rosas activan armadura, espada de acero, curar y frenesí
  bTag.event({ type: 'gift', user: 'Lancelot', gift: 'Rose', count: 20 });
  assert.equal(pL.weapon, 'steel', 'Espada de acero equipada');
  assert.equal(pL.armor, 25, 'Armadura +25');
  assert.equal(pL.frenzyTimer, 5, 'Frenesí activado por 5s');
}

console.log('✅ Pruebas base actualizadas: 20 grupos superados');
console.log('   Despliegue táctico 20 vs 20, 1v1 táctico, Soldado Nivel 10 (+2 daño, +2 def, vida restablecida) y Ataque Frenesí');





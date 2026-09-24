import {giftKey} from './public/engine.mjs';

// Local laboratory only: unmatched gifts are receipts, never invented rewards.
export function simulateGift(game, catalog, data) {
  if (!data || typeof data !== 'object') throw Error('Solicitud no válida');
  if (!['running','paused','between'].includes(game.state)) throw Error('Inicia una partida de prueba primero.');
  const count=Number(data.count);
  if (!Number.isInteger(count) || count<1 || count>100000) throw Error('La cantidad debe ser un entero entre 1 y 100000.');
  const gift=Number.isInteger(data.giftIndex) ? catalog.gifts[data.giftIndex] : null;
  const customRule=typeof data.customGift==='string' && game.config.rules.find(r=>r.gift===data.customGift);
  const name=gift?.name || customRule?.gift;
  if (!name) throw Error('Selecciona un regalo del catálogo o de tus canjes.');
  const user=String(data.user || '').trim().replace(/^@/,'').slice(0,40);
  if (!user) throw Error('Escribe el nombre del jugador de prueba.');
  const rule=game.config.rules.find(r=>giftKey(r.gift)===giftKey(name));
  if (!rule) {
    game.note(`Prueba offline: ${user} envió ${count} × ${name} · sin canje asignado`);
    return {mapped:false,message:`${count} × ${name} registrado. Sin canje asignado: no modifica el combate.`};
  }
  if (game.state==='between' && game.pendingEvents.length>=200) throw Error('Cola de pruebas llena. Espera a la siguiente ronda.');
  game.event({type:'gift',gift:name,user,count,team:data.team===1?1:0});
  return {mapped:true,message:game.state==='between' ? 'Regalo en cola para la siguiente ronda.' : `${count} × ${name} registrado. Revisa el progreso y los límites en la crónica.`};
}

export function normalizeLiveGifts(data, previous=[]) {
  const list=Array.isArray(data)?data:data?.gifts || [];
  return list.filter(g=>g && typeof g.name==='string').map(g=>{
    const coins=Number(g.diamond_count ?? g.diamondCount ?? g.coins);
    const old=previous.find(p=>String(p.id)===String(g.id) && g.id!=null)
      || previous.find(p=>(p.name===g.name || (p.nameEn && p.nameEn===g.name) || giftKey(p.name)===giftKey(g.name)) && Number(p.coins)===coins);
    const candidates=[...(g.image?.url_list || []),...(g.image?.urlList || []),g.image?.url,g.imageUrl,old?.imageUrl];
    const imageUrl=candidates.find(url=>typeof url==='string' && /^https:\/\//i.test(url)) || '';
    return {id:g.id,name:g.name,coins:Number.isFinite(coins)?coins:0,imageUrl,
      image:old?.image?.startsWith('/assets/gifts/') ? old.image : imageUrl};
  });
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Battle} from './public/engine.mjs';
import {giftOptions,filterGifts,giftPage,safeImage,PAGE_SIZE} from './public/catalog-utils.mjs';
import {simulateGift,normalizeLiveGifts} from './simulation.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./public/gifts.json',import.meta.url)));
const options=giftOptions(catalog.gifts);
assert.equal(options.length,catalog.gifts.length);
assert.equal(new Set(options.map(g=>g.key)).size,options.length);
const visited=[];
for(let i=0;i<Math.ceil(options.length/PAGE_SIZE);i++){
  const page=giftPage(options,i);assert.ok(page.items.length<=24);visited.push(...page.items.map(g=>g.key));
}
assert.deepEqual(visited,options.map(g=>g.key),'Every catalog variant is reachable');
assert.equal(giftPage([],30).page,0);
assert.equal(giftPage(options,9999).page,Math.ceil(options.length/PAGE_SIZE)-1);
assert.ok(filterGifts(options,'GALAXY').every(g=>g.name.toLowerCase().includes('galaxy')));
const custom=giftOptions(catalog.gifts,[{gift:'Mi regalo privado'}]);
assert.equal(custom.at(-1).key,'custom:Mi regalo privado');
assert.equal(safeImage({image:'javascript:alert(1)'}),'/assets/gifts/unavailable.svg');
for(const gift of catalog.gifts){
  assert.ok(gift.image.startsWith('/assets/gifts/'));
  assert.ok(fs.statSync(new URL('./public'+gift.image,import.meta.url)).size>0,'Cached image: '+gift.name);
}
const b=new Battle();b.start('teams');
const roses=catalog.gifts.findIndex(g=>g.name==='Rose');
const unknown=catalog.gifts.findIndex(g=>!b.config.rules.some(r=>r.gift===g.name));
const before=b.players.map(p=>p.hp);
const result=simulateGift(b,catalog,{giftIndex:unknown,user:'Tester',team:0,count:100});
assert.equal(result.mapped,false);assert.match(result.message,/Sin canje/);assert.deepEqual(b.players.map(p=>p.hp),before);
simulateGift(b,catalog,{giftIndex:roses,user:'Tester',team:0,count:20});
assert.equal(b.players.find(p=>p.name==='Tester').classLevel,10);
const gg=catalog.gifts.findIndex(g=>g.name==='GG');
assert.equal(simulateGift(b,catalog,{giftIndex:gg,user:'Tester',team:0,count:1}).mapped,true,'Partial redemption accepted');
assert.throws(()=>simulateGift(b,catalog,{giftIndex:roses,user:'Tester',count:1.5}));
assert.throws(()=>simulateGift(b,catalog,{giftIndex:99999,user:'Tester',count:1}));
b.state='menu';assert.throws(()=>simulateGift(b,catalog,{giftIndex:roses,user:'Tester',count:1}));
const normalized=normalizeLiveGifts({gifts:[{id:1,name:'Rose',diamond_count:1,image:{url_list:['https://example.test/rose.webp']}},{id:2,name:'New',diamond_count:5,image:{url_list:['https://example.test/new.webp']}}]},catalog.gifts);
assert.equal(normalized[0].image,catalog.gifts[roses].image,'Refresh preserves local thumbnail');
assert.equal(normalized[1].image,'https://example.test/new.webp');
assert.equal(filterGifts(options,'','coins',true,b.config.rules).length,8);
console.log(`OK: ${options.length} regalos, ${Math.ceil(options.length/PAGE_SIZE)} páginas, imágenes locales, filtros, canjes y simulación sin efecto.`);

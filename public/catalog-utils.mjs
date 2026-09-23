import {giftKey} from './engine.mjs';
export const PAGE_SIZE=24;
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function giftOptions(gifts,rules=[]) {
  const result=gifts.map((g,index)=>({...g,key:String(index),index}));
  const names=new Set(gifts.map(g=>giftKey(g.name)));
  for(const r of rules)if(!names.has(giftKey(r.gift))){result.push({name:r.gift,key:'custom:'+r.gift,coins:null});names.add(giftKey(r.gift));}
  return result;
}
export function filterGifts(options,query='',sort='coins',mappedOnly=false,rules=[]) {
  const q=normalize(query.trim());const mapped=new Set(rules.map(r=>giftKey(r.gift)));
  return options.filter(g=>normalize(g.name).includes(q) && (!mappedOnly || mapped.has(giftKey(g.name))))
    .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='expensive'?(b.coins??-1)-(a.coins??-1): (a.coins??Infinity)-(b.coins??Infinity));
}
export function giftPage(list,page=0) {
  const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
  const current=Math.max(0,Math.min(pages-1,page));
  return {items:list.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE),page:current,pages,total:list.length};
}
export function safeImage(gift) {
  const image=gift?.image || gift?.imageUrl || '';
  return /^\/assets\/gifts\/[a-zA-Z0-9_.-]+$/.test(image) || /^https:\/\//i.test(image) ? image : '/assets/gifts/unavailable.svg';
}

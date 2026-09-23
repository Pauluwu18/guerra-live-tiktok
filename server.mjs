import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Battle,defaults,validConfig} from './public/engine.mjs';
import {simulateGift,normalizeLiveGifts} from './simulation.mjs';
import {TikTokLiveConnection,WebcastEvent,ControlEvent} from 'tiktok-live-connector';
const root=path.dirname(fileURLToPath(import.meta.url));const publicDir=path.join(root,'public');
let config=defaults;try{config=validConfig(JSON.parse(fs.readFileSync(path.join(root,'settings.json'))));}catch{}
const game=new Battle(config),clients=new Set();let connector=null,connecting=false;let live={state:'disconnected',user:'pandamiuk01',message:'Modo de prueba · sin conexión LIVE'};let controller={};let catalog=JSON.parse(fs.readFileSync(path.join(publicDir,'gifts.json')));
function snapshot(overlay=false){if(overlay)return {state:game.state,mode:game.mode,config:game.config,live,players:[],log:[]};return {state:game.state,mode:game.mode,time:game.time,players:game.players,effects:game.effects,boss:game.boss,log:game.log,result:game.lastResult,config:game.config,live,score:game.score,round:game.round,warWinner:game.warWinner};}
let lastBroadcast=0, lastOverlay='';
function broadcast(force=false){
 if(!clients.size)return;
 const now=Date.now();
 if(!force && now-lastBroadcast<(game.state==='running'?100:1000))return;
 lastBroadcast=now;
 let message, overlayMessage;
 for(const r of clients){
  if(r.destroyed || r.writableEnded || r.writableLength>256000){
    try { r.destroy(); } catch {}
    clients.delete(r);
    continue;
  }
  try {
    if(r.overlay){
      overlayMessage ??= 'data: ' + JSON.stringify(snapshot(true)) + '\n\n';
      if(force || overlayMessage!==lastOverlay) r.write(overlayMessage);
    } else {
      message ??= 'data: ' + JSON.stringify(snapshot()) + '\n\n';
      r.write(message);
    }
  } catch {
    try { r.destroy(); } catch {}
    clients.delete(r);
  }
 }
 if(overlayMessage) lastOverlay=overlayMessage;
}
function safeMessage(e){let msg=String(e?.message||e?.exception?.message||e?.error?.message||e?.info||'No se pudo completar la conexión.');if(/isn't online|not live|offline/i.test(msg))return 'El usuario no está en directo. Inicia tu LIVE y vuelve a conectar.';return msg.replace(/https?:\/\/\S+/g,'[servicio externo]').slice(0,240);}
async function connect(user){if(connecting)throw new Error('Ya hay una conexión en curso');connecting=true;if(connector)connector.disconnect();live={state:'connecting',user,message:'Conectando al LIVE…'};const c=new TikTokLiveConnection(user,{enableExtendedGiftInfo:true,processInitialData:false,...(process.env.EULER_API_KEY?{signApiKey:process.env.EULER_API_KEY}:{})});connector=c;
 const ident=d=>d.user?.uniqueId||d.uniqueId||d.user?.nickname;const eventId=d=>d.common?.msgId||d.msgId;
 c.on(WebcastEvent.CHAT,d=>{const name=ident(d);if(!name)return;const cmd=String(d.comment||'').trim().toLowerCase();if(['!jugar','!jade','!coral'].includes(cmd))game.event({type:'join',user:name,team:cmd==='!jade'?0:cmd==='!coral'?1:undefined,id:eventId(d)});});
 c.on(WebcastEvent.LIKE,d=>{if(ident(d))game.event({type:'like',user:ident(d),count:d.likeCount,id:eventId(d)});});
 c.on(WebcastEvent.GIFT,d=>{const type=d.giftDetails?.giftType??d.giftType;if(type===1&&!d.repeatEnd)return;const gift=d.giftDetails?.giftName||d.extendedGiftInfo?.name||d.giftName||catalog.gifts.find(g=>String(g.id)===String(d.giftId))?.name;if(ident(d)&&gift)game.event({type:'gift',user:ident(d),gift,count:d.repeatCount||1,id:eventId(d)});});
 c.on(ControlEvent.DISCONNECTED,()=>{if(connector===c)live={...live,state:'disconnected',message:'LIVE desconectado. Pulsa Conectar para reintentar.'};});
 c.on(ControlEvent.ERROR,e=>{if(connector===c)live={...live,message:safeMessage(e)};});
 try{await c.connect();if(connector!==c){c.disconnect();return;}live={state:'connected',user,message:'Conectado a @'+user};}catch(e){if(connector===c)live={state:'error',user,message:safeMessage(e)};throw e;}finally{connecting=false;}}
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let s='';for await(const b of req){s+=b;if(s.length>100000)throw new Error('Solicitud demasiado grande');}return JSON.parse(s||'{}');}
const server=http.createServer(async(req,res)=>{try{if(!['127.0.0.1:4173','localhost:4173'].includes(req.headers.host)){send(res,403,{error:'Host no permitido'});return;}const url=new URL(req.url,'http://127.0.0.1:4173');if(req.method==='POST'){const origin=req.headers.origin;if(origin&&!['http://127.0.0.1:4173','http://localhost:4173'].includes(origin)){send(res,403,{error:'Origen no permitido'});return;}if(!String(req.headers['content-type']).startsWith('application/json')){send(res,415,{error:'Se requiere JSON'});return;}const d=await body(req);
 if(url.pathname==='/api/simulate-gift'){const result=simulateGift(game,catalog,d);send(res,200,{ok:true,...result});broadcast(true);return;}
 switch(url.pathname){case '/api/start':game.start(['boss','duel'].includes(d.mode)?d.mode:'teams');controller={};break;case '/api/pause':if(game.state==='running')game.state='paused';else if(game.state==='paused')game.state='running';break;case '/api/menu':game.state='menu';break;case '/api/event':if(!game.event(d))throw new Error('Evento no aplicado: inicia una partida, revisa el regalo y su cantidad.');break;case '/api/control':controller={id:String(d.id),x:Math.sign(Number(d.x)||0),y:Math.sign(Number(d.y)||0),at:Date.now()};break;case '/api/settings':game.config=validConfig(d);fs.writeFileSync(path.join(root,'settings.json'),JSON.stringify(game.config,null,2));break;
 case '/api/connect':{const user=String(d.user||'pandamiuk01').replace(/^@/,'');if(!/^[a-zA-Z0-9_.]{1,30}$/.test(user))throw new Error('Usuario no válido');await connect(user);break;}
 case '/api/disconnect':if(connector){const old=connector;connector=null;old.disconnect();}live={...live,state:'disconnected',message:'Desconectado'};break;
 case '/api/catalog':{const c=connector||new TikTokLiveConnection(live.user);if(!c.roomId)await c.fetchRoomId();const data=await c.fetchAvailableGifts();const gifts=normalizeLiveGifts(data,catalog.gifts);if(!gifts.length)throw new Error('TikTok no devolvió regalos');catalog={source:'TikTok LIVE mediante conector no oficial',region:'Sala de @'+live.user,checked:new Date().toISOString(),gifts};fs.writeFileSync(path.join(publicDir,'gifts.json'),JSON.stringify(catalog,null,2));break;}
 default:send(res,404,{error:'Ruta desconocida'});return;}send(res,200,{ok:true,...(url.pathname==='/api/catalog'?{catalog}:{})});if(url.pathname!=='/api/control')broadcast(true);return;}
 if(url.pathname==='/events'){if(clients.size>=12){send(res,429,{error:'Demasiadas vistas abiertas (máximo 12)'});return;}res.overlay=url.searchParams.has('overlay');res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});clients.add(res);res.on('error',()=>clients.delete(res));req.on('close',()=>clients.delete(res));try{res.write('data: '+JSON.stringify(snapshot(res.overlay))+'\n\n');}catch{clients.delete(res);}return;}
 if(url.pathname==='/api/state'){send(res,200,snapshot());return;}if(url.pathname==='/gifts.json'){send(res,200,catalog);return;}
 const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const file=path.resolve(publicDir,name);if(!file.startsWith(publicDir+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('No encontrado');return;}const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});const st=fs.createReadStream(file);st.on('error',()=>{if(!res.headersSent)res.writeHead(404);res.end();});res.on('error',()=>st.destroy());st.pipe(res);
 }catch(e){send(res,400,{error:safeMessage(e)});}});
setInterval(()=>{try{game.update(.033,Date.now()-(controller.at||0)<300?controller:{});}catch(e){console.error('Update error:',e);}},33);
setInterval(()=>broadcast(),100);
server.on('error',e=>console.error('Server error:',e));
process.on('uncaughtException',e=>console.error('Uncaught:',e?.message||e));
process.on('unhandledRejection',e=>console.error('Unhandled:',e?.message||e));
server.listen(4173,'127.0.0.1',()=>console.log('GUERRA LIVE · http://127.0.0.1:4173'));


const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const QRCode = require("qrcode");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e5
});
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const ROUND_SECONDS = 60;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const RECONNECT_GRACE_MS = 10 * 60 * 1000;
const rooms = new Map();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const HISTORY_FILE = path.join(DATA_DIR, "games.json");

const challenges = [
 {category:"Produto",title:"A garrafa que precisa evoluir",scenario:"Uma empresa fabrica garrafas de água tradicionais. As vendas começaram a cair porque os consumidores estão buscando produtos mais sustentáveis.",question:"Como a empresa poderia inovar seu produto para voltar a ser competitiva?",strategies:["Material reciclado","Sistema reutilizável","Design modular","Tecnologia inteligente"]},
 {category:"Serviço",title:"Atendimento sem espera",scenario:"Uma empresa possui um serviço de atendimento ao cliente que demora muito para responder às solicitações. As reclamações estão aumentando.",question:"Como utilizar a inovação para tornar o atendimento mais rápido e melhor?",strategies:["Chatbot + humano","Fila inteligente","Autoatendimento","Atendimento por vídeo"]},
 {category:"Tecnologia",title:"A loja que perdeu espaço",scenario:"Uma loja física está perdendo clientes para concorrentes que vendem pela internet.",question:"Que inovação poderia ser implementada para melhorar a experiência do cliente e competir com o digital?",strategies:["Loja + app","Provador inteligente","Retire na loja","QR Code"]},
 {category:"Experiência do cliente",title:"O restaurante da espera",scenario:"Um restaurante possui boa comida, mas os clientes reclamam do tempo de espera.",question:"Como inovar no serviço sem necessariamente mudar o produto?",strategies:["Fila virtual","Reserva inteligente","Pedido antecipado","Painel de espera"]},
 {category:"Sustentabilidade",title:"Menos plástico, mais valor",scenario:"Uma empresa utiliza grande quantidade de plástico em suas embalagens e quer reduzir os impactos ambientais.",question:"Como inovar para reduzir o plástico e, ao mesmo tempo, criar valor para o consumidor?",strategies:["Embalagem retornável","Refil","Material reciclado","Logística reversa"]}
];
const avatars=["🚀","💡","🌱","⚡","🎯","🧠","🔧","🌎","🔥","⭐","🛠️","🎨","📱","🏆","🧩"];

function rand(n=8){return crypto.randomBytes(n).toString("hex")}
function roomCode(){return crypto.randomBytes(3).toString("hex").toUpperCase()}
function playerToken(){return rand(18)}
function cleanName(n){return String(n||"Jogador").trim().slice(0,18)||"Jogador"}
function cleanAvatar(a){return avatars.includes(a)?a:avatars[Math.floor(Math.random()*avatars.length)]}
function loadHistory(){try{return JSON.parse(fs.readFileSync(HISTORY_FILE,"utf8"))}catch{return []}}
function saveHistory(item){
  try{
    fs.mkdirSync(DATA_DIR,{recursive:true});
    const h=loadHistory();h.unshift(item);
    fs.writeFileSync(HISTORY_FILE,JSON.stringify(h.slice(0,100),null,2));
  }catch(e){console.error("Histórico não pôde ser salvo:",e.message)}
}
function publicPlayers(room){
  return [...room.players.values()].map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,submitted:p.submitted,connected:!!p.socketId}))
    .sort((a,b)=>b.score-a.score);
}
function state(room){
  return {code:room.code,hostId:room.hostId,status:room.status,round:room.round,totalRounds:challenges.length,
    endsAt:room.endsAt,pausedAt:room.pausedAt,pausedRemaining:room.pausedRemaining,
    challenge:room.status==="playing"?challenges[room.round]:null,players:publicPlayers(room)};
}
function broadcast(room){io.to(room.code).emit("state",state(room))}
function clearTimer(room){if(room.timer){clearTimeout(room.timer);room.timer=null}}
function publicJoinUrl(req,code){return `${req.protocol}://${req.get("host")}/?room=${encodeURIComponent(code)}`}
function finish(room){
  clearTimer(room);room.endsAt=null;room.pausedAt=null;room.pausedRemaining=null;room.status="finished";
  saveHistory({date:new Date().toISOString(),code:room.code,players:publicPlayers(room),rounds:challenges.length});
  broadcast(room);
}
function endRound(room,reason="time"){
  if(room.status!=="playing")return;
  clearTimer(room);room.endsAt=null;room.pausedAt=null;room.pausedRemaining=null;
  room.roundReason=reason;room.status=room.round>=challenges.length-1?"finished":"roundEnded";
  if(room.status==="finished")saveHistory({date:new Date().toISOString(),code:room.code,players:publicPlayers(room),rounds:challenges.length});
  broadcast(room);
}
function startRound(room,round){
  if(round>=challenges.length)return finish(room);
  clearTimer(room);room.round=round;room.status="playing";room.roundReason=null;
  room.endsAt=Date.now()+ROUND_SECONDS*1000;room.pausedAt=null;room.pausedRemaining=null;
  for(const p of room.players.values())p.submitted=false;
  room.timer=setTimeout(()=>endRound(room,"time"),ROUND_SECONDS*1000);
  broadcast(room);
}
function resumeRound(room){
  if(room.status!=="paused")return;
  room.status="playing";room.endsAt=Date.now()+room.pausedRemaining;room.pausedAt=null;room.pausedRemaining=null;
  room.timer=setTimeout(()=>endRound(room,"time"),Math.max(1,room.endsAt-Date.now()));broadcast(room);
}
function pauseRound(room){
  if(room.status!=="playing")return;
  room.pausedRemaining=Math.max(0,room.endsAt-Date.now());room.pausedAt=Date.now();room.endsAt=null;
  clearTimer(room);room.status="paused";broadcast(room);
}
function roomFromSocket(socket){return rooms.get(socket.data.room)}
function host(socket,room){return room && room.hostId===socket.id}
function removeDisconnected(){
  const now=Date.now();
  for(const room of rooms.values()){
    for(const p of room.players.values()){
      if(!p.socketId && p.disconnectedAt && now-p.disconnectedAt>RECONNECT_GRACE_MS)room.players.delete(p.token);
    }
    if(room.players.size===0 && now-room.lastActivity>ROOM_TTL_MS){clearTimer(room);rooms.delete(room.code)}
  }
}
setInterval(removeDisconnected,60*1000).unref();

app.get("/api/challenges",(req,res)=>res.json(challenges.map(({category,title,scenario,question,strategies})=>({category,title,scenario,question,strategies}))));
app.get("/api/qr/:code",async(req,res)=>{
  const c=String(req.params.code||"").toUpperCase();
  if(!rooms.has(c))return res.status(404).end();
  try{
    const data=await QRCode.toDataURL(publicJoinUrl(req,c),{width:520,margin:2,errorCorrectionLevel:"M"});
    res.json({dataUrl:data,url:publicJoinUrl(req,c)});
  }catch{res.status(500).json({error:"QR indisponível"})}
});
app.get("/api/history",(_,res)=>res.json(loadHistory().slice(0,20)));

io.on("connection",socket=>{
  socket.on("createRoom",({name,avatar},cb)=>{
    let c;do c=roomCode();while(rooms.has(c));
    const token=playerToken();
    const p={id:rand(8),token,name:cleanName(name),avatar:cleanAvatar(avatar),score:0,submitted:false,socketId:socket.id,disconnectedAt:null};
    const room={code:c,hostId:socket.id,hostToken:token,status:"lobby",round:0,endsAt:null,pausedAt:null,pausedRemaining:null,timer:null,lastActivity:Date.now(),players:new Map([[token,p]])};
    rooms.set(c,room);socket.join(c);socket.data.room=c;socket.data.token=token;
    cb({ok:true,code:c,token,playerId:p.id,isHost:true,joinUrl:publicJoinUrl({protocol:"http",get:()=>""},c)});
    broadcast(room);
  });

  socket.on("joinRoom",({code,name,avatar,token},cb)=>{
    const c=String(code||"").trim().toUpperCase(),room=rooms.get(c);
    if(!room)return cb({ok:false,error:"Sala não encontrada ou encerrada."});
    room.lastActivity=Date.now();
    if(token && room.players.has(token)){
      const p=room.players.get(token);p.socketId=socket.id;p.disconnectedAt=null;
      if(room.hostToken===token) room.hostId=socket.id;
      socket.join(c);socket.data.room=c;socket.data.token=token;
      cb({ok:true,code:c,token,playerId:p.id,isHost:room.hostToken===token});broadcast(room);return;
    }
    if(room.status!=="lobby")return cb({ok:false,error:"Essa partida já começou. Entre novamente usando o mesmo dispositivo/nome."});
    if(room.players.size>=30)return cb({ok:false,error:"A sala está cheia (máximo de 30 jogadores)."});
    const names=new Set([...room.players.values()].map(p=>p.name.toLowerCase()));
    let n=cleanName(name);if(names.has(n.toLowerCase()))n=n.slice(0,14)+"-"+Math.floor(Math.random()*90+10);
    const t=playerToken(),p={id:rand(8),token:t,name:n,avatar:cleanAvatar(avatar),score:0,submitted:false,socketId:socket.id,disconnectedAt:null};
    room.players.set(t,p);socket.join(c);socket.data.room=c;socket.data.token=t;
    cb({ok:true,code:c,token:t,playerId:p.id,isHost:false});broadcast(room);
  });

  socket.on("startGame",()=>{
    const r=roomFromSocket(socket);if(!host(socket,r)||r.status!=="lobby")return;startRound(r,0);
  });
  socket.on("teacherNext",()=>{
    const r=roomFromSocket(socket);if(!host(socket,r))return;
    if(r.status==="roundEnded")startRound(r,r.round+1);
    else if(r.status==="playing"||r.status==="paused")endRound(r,"teacher");
  });
  socket.on("pause",()=>{const r=roomFromSocket(socket);if(host(socket,r))pauseRound(r)});
  socket.on("resume",()=>{const r=roomFromSocket(socket);if(host(socket,r))resumeRound(r)});
  socket.on("teacherFinish",()=>{const r=roomFromSocket(socket);if(host(socket,r))finish(r)});
  socket.on("kickPlayer",({playerId})=>{
    const r=roomFromSocket(socket);if(!host(socket,r))return;
    for(const [t,p] of r.players){if(p.id===playerId){const s=p.socketId;if(s)io.sockets.sockets.get(s)?.emit("kicked");r.players.delete(t);break}}
    broadcast(r);
  });

  socket.on("submitAnswer",({answer,strategies},cb)=>{
    const r=roomFromSocket(socket),p=r&&r.players.get(socket.data.token);
    if(!r||!p||p.socketId!==socket.id||r.status!=="playing"||p.submitted)return cb?.({ok:false,error:"Envio não permitido."});
    const text=String(answer||"").trim();if(text.length<20)return cb?.({ok:false,error:"Escreva uma solução com pelo menos 20 caracteres."});
    const chosen=Array.isArray(strategies)?strategies.slice(0,4):[];
    const elapsed=Math.max(0,Date.now()-(r.endsAt-ROUND_SECONDS*1000));
    const speed=Math.max(0,20-Math.floor(elapsed/10000)*3);
    const detail=Math.min(20,5+Math.floor(text.length/45));
    const concrete=/(como|implementar|app|sistema|equipe|teste|piloto|custo|parceria|etapa|treinar)/i.test(text)?15:7;
    const creativity=Math.min(25,8+Math.min(10,new Set(text.toLowerCase().split(/\W+/).filter(Boolean)).size/3)+Math.min(7,chosen.length*2));
    const strategy=Math.min(15,chosen.length*4);
    const score=Math.min(100,Math.round(speed+detail+concrete+creativity+strategy));
    p.score+=score;p.submitted=true;r.lastActivity=Date.now();
    cb?.({ok:true,roundScore:score,totalScore:p.score});
    io.to(r.code).emit("point",{playerId:p.id,name:p.name,avatar:p.avatar,roundScore:score,totalScore:p.score});
    broadcast(r);
    if([...r.players.values()].filter(x=>x.socketId).every(x=>x.submitted))endRound(r,"everyone");
  });

  socket.on("disconnect",()=>{
    const r=roomFromSocket(socket);if(!r)return;
    const p=r.players.get(socket.data.token);if(p&&p.socketId===socket.id){p.socketId=null;p.disconnectedAt=Date.now()}
    r.lastActivity=Date.now();broadcast(r);
  });
});

server.listen(PORT,"0.0.0.0",()=>console.log(`Desafio da Inovação: http://localhost:${PORT}`));

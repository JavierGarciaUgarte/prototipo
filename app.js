const COLORS=[
 {id:"red",name:"Rojo",shape:"●",cls:"color-red"},
 {id:"green",name:"Verde",shape:"★",cls:"color-green"},
 {id:"blue",name:"Azul",shape:"■",cls:"color-blue"},
 {id:"yellow",name:"Amarillo",shape:"▲",cls:"color-yellow"}
];
const MODES=["normal","protanopia","deuteranopia","tritanopia"];
const MODE_NAMES={normal:"Vista normal",protanopia:"Protanopía",deuteranopia:"Deuteranopía",tritanopia:"Tritanopía"};
let hands=[],deck=[],discard=[],activeColor="red",turn=0,direction=1,ended=false,perceptionMode="normal",cpuTimer=null,pendingHumanWild=null,pendingPerception=null;
const $=id=>document.getElementById(id);

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function buildDeck(){
 const d=[];
 COLORS.forEach(c=>{
  d.push({color:c.id,value:"0"});
  for(let i=0;i<2;i++)["1","2","3","4","5","6","7","8","9","+2","SALTO","REV"].forEach(v=>d.push({color:c.id,value:v}));
 });
 for(let i=0;i<4;i++){d.push({color:"wild",value:"CAMBIO"},{color:"wild",value:"ROBA4"});}
 for(let i=0;i<4;i++)d.push({color:"wild",value:"PERCEPCION"});
 return shuffle(d);
}
function draw(){
 if(!deck.length){const top=discard.pop();deck=shuffle(discard);discard=[top];}
 return deck.pop();
}
function colorInfo(id){return COLORS.find(c=>c.id===id);}
function symbol(c){if(c.value==="PERCEPCION")return "◉";if(c.color==="wild")return c.value==="ROBA4"?"✚":"↻";return colorInfo(c.color).shape;}
function shown(v){return ({SALTO:"⊘",REV:"⇄",CAMBIO:"↻",ROBA4:"+4",PERCEPCION:"◉"}[v]||v);}
function cardHTML(c,center=false,index=-1){
 const cls=(c.color==="wild"?"wild":colorInfo(c.color).cls)+(c.value==="PERCEPCION"?" perception":"");
 const name=c.value==="PERCEPCION"?"Cambio de percepción":c.color==="wild"?"Comodín":colorInfo(c.color).name;
 return `<div class="${center?"playing-card":"game-card"} ${cls}" ${center?'id="topCard"':`data-index="${index}"`} role="button" tabindex="0" aria-label="${name}, ${c.value}">
 <span class="corner">${symbol(c)}</span><span class="big">${shown(c.value)}</span><span class="mark">${symbol(c)}</span></div>`;
}
function canPlay(c){
 const top=discard[discard.length-1];
 return c.color==="wild"||c.color===activeColor||c.value===top.value;
}
function setMode(mode){perceptionMode=mode;document.body.dataset.mode=mode;$("activeMode").textContent=MODE_NAMES[mode];}
function say(s){$("feedback").textContent=s;if(!ended)$("statusText").textContent=s;}
function newGame(){
 if(cpuTimer)clearTimeout(cpuTimer);
 deck=buildDeck();hands=[[],[],[],[]];
 for(let i=0;i<7;i++)hands.forEach(h=>h.push(draw()));
 let first=draw();while(first.color==="wild")first=draw();
 discard=[first];activeColor=first.color;turn=0;direction=1;ended=false;pendingHumanWild=null;pendingPerception=null;
 setMode("normal");$("winnerOverlay").classList.add("hidden");$("colorOverlay").classList.add("hidden");$("perceptionOverlay").classList.add("hidden");
 $("drawBtn").disabled=false;say("Partida nueva: cuatro jugadores, siete cartas cada uno.");render();
}
function render(){
 const top=discard[discard.length-1];
 $("topCard").outerHTML=cardHTML(top,true).replace('class="playing-card','id="topCard" class="playing-card');
 $("activeColorLabel").textContent=`Color activo: ${colorInfo(activeColor).name} ${colorInfo(activeColor).shape}`;
 $("playerHand").innerHTML=hands[0].map((c,i)=>cardHTML(c,false,i)).join("");
 $("handCount").textContent=`${hands[0].length} cartas`;
 $("turnText").textContent=ended?"Partida terminada":turn===0?"Tu turno":`Turno del jugador ${turn+1}`;
 for(let p=1;p<4;p++){
  $(`count${p}`).textContent=`${hands[p].length} cartas`;
  $(`msg${p}`).textContent=ended?"Partida terminada":turn===p?"¡Está jugando!":"Esperando su turno";
 }
 $("playerHand").querySelectorAll(".game-card").forEach(el=>{
  const i=Number(el.dataset.index);
  if(!canPlay(hands[0][i]))el.classList.add("unplayable");
  el.addEventListener("click",()=>playHuman(i));
  el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();playHuman(i);}});
 });
 $("drawBtn").disabled=turn!==0||ended||!$("colorOverlay").classList.contains("hidden");
}
function finishGame(winner){
 if(ended)return;
 ended=true;if(cpuTimer)clearTimeout(cpuTimer);pendingHumanWild=null;pendingPerception=null;$("perceptionOverlay").classList.add("hidden");
 $("colorOverlay").classList.add("hidden");
 $("statusText").textContent=winner===0?"¡Ganaste!":`Ganó el jugador ${winner+1}`;
 $("turnText").textContent="Partida terminada";
 $("feedback").textContent="La partida terminó. Inicia una nueva para volver a jugar.";
 render();
 $("winnerTitle").textContent=winner===0?"¡Ganaste la partida!":`¡Ganó el jugador ${winner+1}!`;
 $("winnerMessage").textContent=winner===0?"Te quedaste sin cartas antes que los demás.":`El jugador ${winner+1} se quedó sin cartas antes que los demás.`;
 $("winnerOverlay").classList.remove("hidden");
}
function applyCardEffect(c,p,chosenColor=null){
 if(c.value==="PERCEPCION"){
  const idx=MODES.indexOf(perceptionMode);setMode(MODES[(idx+1)%MODES.length]);
  say(`¡Cambio de percepción! Ahora se muestra ${MODE_NAMES[perceptionMode]}.`);
 }else if(c.value==="CAMBIO"||c.value==="ROBA4"){
  activeColor=chosenColor;
  if(c.value==="ROBA4"){
   const victim=(p+direction+4)%4;
   for(let n=0;n<4;n++)hands[victim].push(draw());
   say(`Jugador ${p+1} eligió ${colorInfo(activeColor).name}. El jugador ${victim+1} roba cuatro y pierde su turno.`);
   return {skipNext:true};
  }
  say(`Jugador ${p+1} eligió ${colorInfo(activeColor).name} como color activo.`);
 }else{
  activeColor=c.color;
  if(c.value==="+2"){
   const victim=(p+direction+4)%4;
   hands[victim].push(draw(),draw());
   say(`Jugador ${p+1} jugó +2. El jugador ${victim+1} roba dos y pierde su turno.`);
   return {skipNext:true};
  }
  if(c.value==="SALTO"){say(`Jugador ${p+1} jugó Salto.`);return {skipNext:true};}
  if(c.value==="REV"){direction*=-1;say(`Jugador ${p+1} jugó Reversa.`);}
  else say(`Jugador ${p+1} jugó ${c.value}.`);
 }
 return {skipNext:false};
}
function playHuman(i){
 if(ended||turn!==0||!$("colorOverlay").classList.contains("hidden"))return;
 const c=hands[0][i];
 if(!canPlay(c)){say("Esa carta no coincide por color, número o símbolo.");return;}
 if(c.value==="CAMBIO"||c.value==="ROBA4"){
  pendingHumanWild={index:i,card:c};
  $("colorTitle").textContent=c.value==="ROBA4"?"Elige color para Roba 4":"Elige el color del comodín";
  $("colorMessage").textContent=c.value==="ROBA4"?"El siguiente jugador robará cuatro cartas y perderá su turno. Elige el color que continúa.":"Elige el color que continúa en juego.";
  $("colorOverlay").classList.remove("hidden");$("drawBtn").disabled=true;return;
 }
 if(c.value==="PERCEPCION"){
  const nextMode=MODES[(MODES.indexOf(perceptionMode)+1)%MODES.length];
  pendingPerception={index:i,nextMode};
  $("currentModePreview").textContent=MODE_NAMES[perceptionMode];
  $("nextModePreview").textContent=MODE_NAMES[nextMode];
  $("perceptionMessage").textContent=`La carta cambiará la representación visual de ${MODE_NAMES[perceptionMode]} a ${MODE_NAMES[nextMode]}. El color activo de la partida no cambiará.`;
  $("perceptionOverlay").classList.remove("hidden");$("drawBtn").disabled=true;return;
 }
 hands[0].splice(i,1);discard.push(c);
 const effect=applyCardEffect(c,0);
 if(hands[0].length===0){finishGame(0);return;}
 advanceAfterPlay(effect.skipNext);
}
function commitHumanWild(color){
 if(!pendingHumanWild||ended)return;
 const {index,card}=pendingHumanWild;pendingHumanWild=null;$("colorOverlay").classList.add("hidden");
 hands[0].splice(index,1);discard.push(card);
 const effect=applyCardEffect(card,0,color);
 if(hands[0].length===0){finishGame(0);return;}
 advanceAfterPlay(effect.skipNext);
}
function advanceAfterPlay(skipNext){
 if(ended)return;
 let next=(turn+direction+4)%4;
 if(skipNext)next=(next+direction+4)%4;
 turn=next;render();
 if(turn!==0)cpuTimer=setTimeout(cpuTurn,600);
}
function cpuTurn(){
 if(ended||turn===0)return;
 const p=turn;const idx=hands[p].findIndex(canPlay);
 if(idx<0){
  hands[p].push(draw());say(`Jugador ${p+1} robó una carta.`);
  turn=(turn+direction+4)%4;render();
  if(turn!==0)cpuTimer=setTimeout(cpuTurn,600);
  return;
 }
 const c=hands[p].splice(idx,1)[0];discard.push(c);
 let chosenColor=null;
 if(c.value==="CAMBIO"||c.value==="ROBA4"){
  const counts={red:0,green:0,blue:0,yellow:0};
  hands[p].forEach(card=>{if(counts[card.color]!==undefined)counts[card.color]++;});
  chosenColor=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 }
 const effect=applyCardEffect(c,p,chosenColor);
 if(hands[p].length===0){finishGame(p);return;}
 advanceAfterPlay(effect.skipNext);
}
function confirmPerception(){
 if(!pendingPerception||ended)return;
 const {index,nextMode}=pendingPerception;pendingPerception=null;
 $("perceptionOverlay").classList.add("hidden");
 const card=hands[0][index];hands[0].splice(index,1);discard.push(card);
 setMode(nextMode);
 say(`¡Cambio de percepción! Ahora se muestra ${MODE_NAMES[perceptionMode]}. El color activo no cambió.`);
 if(hands[0].length===0){finishGame(0);return;}
 advanceAfterPlay(false);
}
function cancelPerception(){
 if(!pendingPerception)return;
 pendingPerception=null;$("perceptionOverlay").classList.add("hidden");
 $("drawBtn").disabled=false;
 say("Cambio cancelado. La carta sigue en tu mano y conservas tu turno.");
 render();
}
$("drawBtn").addEventListener("click",()=>{
 if(ended||turn!==0||!$("colorOverlay").classList.contains("hidden"))return;
 hands[0].push(draw());say("Robaste una carta; en esta versión el turno termina al robar.");
 turn=(turn+1+4)%4;render();if(turn!==0)cpuTimer=setTimeout(cpuTurn,600);
});
$("newGame").addEventListener("click",newGame);$("playAgain").addEventListener("click",newGame);
$("confirmPerception").addEventListener("click",confirmPerception);
$("cancelPerception").addEventListener("click",cancelPerception);
document.querySelectorAll(".color-choice").forEach(btn=>btn.addEventListener("click",()=>commitHumanWild(btn.dataset.color)));
newGame();

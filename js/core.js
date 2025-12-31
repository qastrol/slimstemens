/* ===== CORE GAME LOGIC (herwerkte versie) =====
   - Centrale spelsturing en algemene UI / timer / geluid functies
   - Alle ronde-specifieke logica is verplaatst naar aparte bestanden (bv. round-3-6-9.js)
*/

// ===== Globale variabelen =====
let players = [];
let startSeconds = 60;
let currentRoundIndex = 0;
let roundsSequence = ["threeSixNine","opendeur","puzzel","galerij","collectief","finale"];
let roundRunning = false;
let currentQuestionIndex = 0;
let perRoundState = {};
let globalTimerInterval = null;
let thinkingTimerInterval = null;
let activePlayerIndex = 0;
let loopTimerAudio = null;

// Globale variabele voor galerij-foto-aantal (default 10)
let galerijPhotoCount = 10;

// Probeer de waarde uit de UI te lezen bij het laden (indien aanwezig)
window.addEventListener('DOMContentLoaded', function() {
  const el = document.getElementById('galerijPhotoCount');
  if (el) {
    galerijPhotoCount = parseInt(el.value, 10) || 10;
    el.addEventListener('change', function() {
      galerijPhotoCount = parseInt(el.value, 10) || 10;
    });
  }
});

// core.js - Aangepaste WebSocket-connectie voor de nieuwe server

let streamerBotWS = null; // Kan hernoemd worden naar quizWS

const WS_ADDRESS = 'ws://localhost:8081/'; 

function connectToQuizServer() {
  if (streamerBotWS && streamerBotWS.readyState === WebSocket.OPEN) return;
  
  try {
    // Maak de WebSocket verbinding
    streamerBotWS = new WebSocket(WS_ADDRESS);

    streamerBotWS.onopen = () => {
      console.log('Verbonden met Lokale Quiz Server.');
      // Stuur de initiële staat zodra de verbinding open is
      sendDisplayUpdate({ type: 'init', players, active: activePlayerIndex, round: perRoundState?.round || '-' });
    };

    streamerBotWS.onerror = (error) => {
      console.error('WebSocket Fout:', error.message);
    };

    streamerBotWS.onclose = (event) => {
      console.warn('WebSocket Verbinding gesloten.', event.reason);
      streamerBotWS = null;
      // Probeer opnieuw te verbinden na een korte vertraging
      setTimeout(connectToQuizServer, 3000); 
    };

    // De host hoeft geen berichten van de server te ontvangen, maar we vangen ze op
    streamerBotWS.onmessage = (event) => {
      // Optioneel: log hier berichten om te debuggen, maar de Host is de zender
      // console.log("Host ontving bericht (negeer):", event.data);
    };

  } catch (e) {
    console.error('Kon geen WebSocket object aanmaken:', e.message);
  }
}

// NIEUWE SYNCHRONISATIE functie (stuurt de ruwe JSON direct naar de server)
function sendDisplayUpdate(data) {
  if (streamerBotWS && streamerBotWS.readyState === WebSocket.OPEN) {
    // Stuur de JSON-string direct
    streamerBotWS.send(JSON.stringify(data));
  } else {
    // console.warn('Kan geen display update sturen: WebSocket is niet open. Probeer opnieuw te verbinden...');
    if (!streamerBotWS || streamerBotWS.readyState === WebSocket.CLOSED) {
        connectToQuizServer(); // Probeer opnieuw te verbinden
    }
  }
}

// Roep de connectiefunctie op bij de start van core.js
connectToQuizServer();

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


let introAudio = new Audio('SFX/generiek.mp3');
let bumperAudio = new Audio('SFX/snd_bumper.mp3');

// Preloaden zodat play() zeker werkt
introAudio.preload = 'auto';
bumperAudio.preload = 'auto';

// Geen loop
introAudio.loop = false;
bumperAudio.loop = false;


// ===== Geluid =====
function playSFX(file) {
  // Stuur naar display om af te spelen (geen lokaal geluid meer op host)
  try { sendDisplayUpdate({ type: 'audio', action: 'play', src: file }); } catch(e) {}
}

// ===== Vraagdata placeholders =====
const Q_3_6_9 = (typeof quizQuestions!=='undefined'?quizQuestions.slice(0,30):[]).map(q=>({
  text: q.question || 'Placeholdervraag',
  answers: q.answers || [],
  type: 'classic'
}));
const Q_OPEN_DEUR = [];
const Q_PUZZEL = [];
const Q_GALERIJ = [];
const Q_COLLECTIEF = [];
const Q_FINALE = [];

// ===== Helpers =====
function fmtS(s) {
  // Toon enkel seconden, zonder minutenberekening
  return Math.max(0, Math.floor(s));
}


// ===== UI references (moeten behouden blijven voor de host-UI) =====
const playersArea = document.getElementById('playersArea');
const playerCountEl = document.getElementById('playerCount');
const currentRoundEl = document.getElementById('currentRound');
const currentQuestionEl = document.getElementById('currentQuestion');

// ===== UI functies (hieronder staan de functies die sendDisplayUpdate aanroepen) =====
function renderPlayers(){
  playersArea.innerHTML = '';
  players.forEach((p,i)=>{
    const el = document.createElement('div');
    el.className = 'player-card';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><span class="player-token ${i===0?'left':i===1?'center':'rightTok'}"></span><strong>${p.name}</strong></div>
      <div><div class="small">Seconden</div><div class="big timer">${fmtS(p.seconds)}</div></div>
    </div>`;
    playersArea.appendChild(el);
  });
    // NIEUWE toevoeging — stuur update naar display via WebSocket
  sendDisplayUpdate({
    type: 'players',
    players,
    active: activePlayerIndex,
    round: perRoundState?.round || '-'
  });
}

function flash(text){
  const f = document.createElement('div');
  f.className = 'flash';
  f.textContent = text;
  document.body.appendChild(f);
  setTimeout(()=>f.remove(),2200);

  // NIEUWE toevoeging — stuur update naar display via WebSocket
  sendDisplayUpdate({ type: 'flash', text });
}

function highlightActive(){
  flash('Beurt: ' + (players[activePlayerIndex]?players[activePlayerIndex].name:'-'));
}

function stopLoopTimerSFX() {
  // Lokale audio-object mag weg (speelt niet meer af op host)
  if (loopTimerAudio) {
    loopTimerAudio = null;
  }
  // Informeer display om de loop te stoppen
  try { sendDisplayUpdate({ type: 'audio', action: 'loopStop' }); } catch(e) {}
}

function stopAllTimers(){
  if(globalTimerInterval){ clearInterval(globalTimerInterval); globalTimerInterval=null; }
  if(thinkingTimerInterval){ clearInterval(thinkingTimerInterval); thinkingTimerInterval=null; }
  // NIEUW: Stop de loopende klok
  stopLoopTimerSFX();
}



// ===== Ronde management =====
function niceRoundName(key){
  const map = {
    threeSixNine:'3-6-9',
    opendeur:'Open Deur',
    puzzel:'Puzzel',
    galerij:'Galerij',
    collectief:'Collectief Geheugen',
    finale:'Finale'
  };
  return map[key] || key;
}

function startRound(roundKey) {
  roundRunning = true;
  perRoundState = { round: roundKey };
  currentQuestionIndex = 0;
  activePlayerIndex = 0;
  currentRoundEl.textContent = niceRoundName(roundKey);
  currentQuestionEl.innerHTML = '<em>Ronde gestart — druk op Volgende vraag om te beginnen.</em>';
  stopAllTimers();

  if (roundKey === 'threeSixNine') setupThreeSixNineRound();
  else if (roundKey === 'opendeur') {
    if(typeof setupOpenDeurRound==='function') setupOpenDeurRound();
  }

  else if (roundKey === 'puzzel') setupPuzzelRound && setupPuzzelRound();
  else if (roundKey === 'galerij') setupGalerijRound && setupGalerijRound();
  else if (roundKey === 'collectief') setupCollectiefRound && setupCollectiefRound();
  else if (roundKey === 'finale') setupFinaleRound && setupFinaleRound();

  renderPlayers();
  
  // Stuur ronde-update naar display
  sendDisplayUpdate({
      type: 'round_start',
      name: niceRoundName(roundKey),
      key: roundKey
  });
}

function nextQuestion() {
  if (!roundRunning) { flash('Start eerst een ronde'); return; }
  const r = perRoundState.round;
  if (r === 'threeSixNine') nextThreeSixNineQuestion();
  else if (r==='opendeur' && typeof nextOpenDeurTurn==='function') nextOpenDeurTurn();

  else if (r === 'puzzel' && typeof nextPuzzelQuestion==='function') nextPuzzelQuestion();
  else if (r === 'galerij' && typeof nextGalerijQuestion==='function') nextGalerijQuestion();
  else if (r === 'collectief' && typeof nextCollectiefQuestion==='function') nextCollectiefQuestion();
  else if (r === 'finale' && typeof nextFinaleQuestion==='function') nextFinaleQuestion();
}

function markAnswer(isRight) {
  const r = perRoundState.round;
  if (r === 'threeSixNine') markThreeSixNineAnswer(isRight);
  else if (r === 'opendeur' && typeof markOpenDeurAnswer==='function') markOpenDeurAnswer(isRight);
  else if (r === 'puzzel' && typeof markPuzzelAnswer==='function') markPuzzelAnswer(isRight);
  else if (r === 'galerij' && typeof markGalerijAnswer==='function') markGalerijAnswer(isRight);
  else if (r === 'collectief' && typeof markCollectiefAnswer==='function') markCollectiefAnswer(isRight);
  else if (r === 'finale' && typeof markFinaleAnswer==='function') markFinaleAnswer(isRight);
  renderPlayers();
}

document.getElementById('applyBtn').addEventListener('click', async ()=>{
  const nameInputs = Array.from(document.querySelectorAll('.playerName'));
  const photoInputs = Array.from(document.querySelectorAll('.playerPhoto'));
  
  startSeconds = parseInt(document.getElementById('startSeconds').value)||60;

  // Lees alle spelers uit, inclusief foto's
  players = await Promise.all(nameInputs.map(async (nameInput, i) => {
    const name = nameInput.value.trim() || nameInput.placeholder || `Kandidaat ${i+1}`;
    const photoInput = photoInputs[i];
    let photoUrl = 'assets/avatar.png'; // standaard

    // Indien een foto gekozen is → converteer naar base64 URL
    if (photoInput && photoInput.files && photoInput.files[0]) {
      photoUrl = await readFileAsDataURL(photoInput.files[0]);
    }

    return { name, seconds: startSeconds, index: i, position: i, photoUrl };
  }));

  playerCountEl.textContent = players.length;
  renderPlayers();

  sendDisplayUpdate({
      type: 'scene_change',
      scene: 'lobby',
      players: players // Zorg ervoor dat de display de nieuwste spelers heeft
  });
  
  flash('Spel aangemaakt — klaar om te starten');
});


document.getElementById('resetBtn').addEventListener('click', ()=>{
  players = [];
  renderPlayers();
  currentRoundIndex = 0;
  currentRoundEl.textContent = '—';
  currentQuestionEl.innerHTML = '<em>Spel gereset</em>';
  stopAllTimers();
  flash('Spel gereset');
});

// ===== Navigatieknoppen =====
document.getElementById('startRound').addEventListener('click', ()=>{
  if(players.length!==3){ flash('Maak eerst het spel aan met 3 kandidaten'); return; }
  currentRoundIndex = currentRoundIndex % roundsSequence.length;
  startRound(roundsSequence[currentRoundIndex]);
});

document.getElementById('nextRound').addEventListener('click', ()=>{
  currentRoundIndex++;
  if(currentRoundIndex>=roundsSequence.length) currentRoundIndex = roundsSequence.length-1;
  startRound(roundsSequence[currentRoundIndex]);
});

function toggleAudio(audioObj) {
  if (!audioObj) return;
  // Alleen afspelen als het bestand geladen is
  audioObj.pause(); // stop eventueel al spelend geluid
  audioObj.currentTime = 0;
  audioObj.play()
    .then(() => console.log('Audio gestart:', audioObj.src))
    .catch(err => console.warn('Audio kon niet starten:', err));
}

document.getElementById('playSting').addEventListener('click', () => {
  // Speel op display (generiek)
  sendDisplayUpdate({ type: 'audio', action: 'play', src: 'SFX/generiek.mp3' });
});
document.getElementById('playBumper').addEventListener('click', () => {
  sendDisplayUpdate({ type: 'audio', action: 'play', src: 'SFX/snd_bumper.mp3' });
});

// De "Stop Klok" knop zorgt ervoor dat het klokgeluid stopt, en het geluid "fout.mp3" wordt afgespeeld
document.getElementById('playKlok').addEventListener('click', () => {
  // Start klok op display en start de host-side timer UI
  sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' });
  startLoopTimer();
});

document.getElementById('stopKlokFout').addEventListener('click', () => {
  stopLoopTimerSFX(); // stuurt ook loopStop naar display
  playSFX('SFX/fout.mp3'); // stuurt play naar display

  // Stop de losstaande timer ook
  if(loopTimerInterval){
    clearInterval(loopTimerInterval);
    loopTimerInterval = null;
  }
});

document.getElementById('playFinaleBumper').addEventListener('click', () => {
  playSFX('SFX/finale.mp3');
});

document.getElementById('collectiefEndOption').addEventListener('change', (e)=>{
    collectiefEndOption = e.target.value;
    flash(`Collectief Geheugen eindinstelling aangepast: ${e.target.selectedOptions[0].text}`);
});

let loopTimerInterval = null;   // Voor de tick van de klok-timer
let loopTimerSeconds = 0;       // Houdt de tijd bij sinds de knop werd ingedrukt

function startLoopTimer() {
    // Stop eerst bestaande timer indien actief
    if(loopTimerInterval){
        clearInterval(loopTimerInterval);
    }

    // Reset seconden
    loopTimerSeconds = 0;

    // Voeg (indien nog niet aanwezig) een element toe onder de knop
    let timerDisplay = document.getElementById('loopTimerDisplay');
    if(!timerDisplay){
        const btn = document.getElementById('playKlok');
        timerDisplay = document.createElement('div');
        timerDisplay.id = 'loopTimerDisplay';
        timerDisplay.style.fontSize = '14px';
        timerDisplay.style.color = '#c084fc';
        timerDisplay.style.marginTop = '4px';
        btn.parentNode.insertBefore(timerDisplay, btn.nextSibling);
    }

    // Update display meteen
    timerDisplay.textContent = fmtS(loopTimerSeconds) + 's';

loopTimerInterval = setInterval(() => {
        loopTimerSeconds++;
        timerDisplay.textContent = fmtS(loopTimerSeconds) + 's';

        // NIEUW: Stuur de timer update naar de display, inclusief de actieve speler
        sendDisplayUpdate({ 
            type: 'timer_update', 
            seconds: loopTimerSeconds, 
            activeIndex: activePlayerIndex // activePlayerIndex is een globale variabele 
        }); 
        
    }, 1000);
}

renderPlayers();
console.log('Core.js geladen — basisfunctionaliteit actief');
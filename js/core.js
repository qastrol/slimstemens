
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
let loopTimerSeconds = 0;       


let galerijPhotoCount = 10;


window.addEventListener('DOMContentLoaded', function() {
  const el = document.getElementById('galerijPhotoCount');
  if (el) {
    // Check eerst of er een config setting is voor photoCount
    const configPhotoCount = typeof getRoundSetting === 'function' ? getRoundSetting('galerij', 'photoCount', null) : null;
    if (configPhotoCount !== null && !isNaN(configPhotoCount) && configPhotoCount > 0) {
      galerijPhotoCount = configPhotoCount;
      el.value = configPhotoCount;
      console.log(`Galerij: Aantal foto's uit config: ${configPhotoCount}`);
    } else {
      galerijPhotoCount = parseInt(el.value, 10) || 10;
    }
    
    el.addEventListener('change', function() {
      galerijPhotoCount = parseInt(el.value, 10) || 10;
    });
  }
});



let streamerBotWS = null; 

const WS_ADDRESS = 'ws://127.0.0.1:8081/';

function connectToQuizServer() {
  if (streamerBotWS && streamerBotWS.readyState === WebSocket.OPEN) return;
  
  try {
    
    streamerBotWS = new WebSocket(WS_ADDRESS);

    streamerBotWS.onopen = () => {
      console.log('Verbonden met Lokale Quiz Server.');
      
      sendDisplayUpdate({ type: 'init', players, active: activePlayerIndex, round: perRoundState?.round || '-' });
    };

    streamerBotWS.onerror = (error) => {
      console.error('WebSocket Fout:', error.message);
    };

    streamerBotWS.onclose = (event) => {
      console.warn('WebSocket Verbinding gesloten.', event.reason);
      streamerBotWS = null;
      
      setTimeout(connectToQuizServer, 3000); 
    };

    
    streamerBotWS.onmessage = (event) => {
      
      
    };

  } catch (e) {
    console.error('Kon geen WebSocket object aanmaken:', e.message);
  }
}


function sendDisplayUpdate(data) {
  if (streamerBotWS && streamerBotWS.readyState === WebSocket.OPEN) {
    
    streamerBotWS.send(JSON.stringify(data));
  } else {
    
    if (!streamerBotWS || streamerBotWS.readyState === WebSocket.CLOSED) {
        connectToQuizServer(); 
    }
  }
}


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


introAudio.preload = 'auto';
bumperAudio.preload = 'auto';


introAudio.loop = false;
bumperAudio.loop = false;



function playSFX(file) {
  
  try { sendDisplayUpdate({ type: 'audio', action: 'play', src: file }); } catch(e) {}
}


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


function fmtS(s) {
  
  return Math.max(0, Math.floor(s));
}



const playersArea = document.getElementById('playersArea');
const playerCountEl = document.getElementById('playerCount');
const currentRoundEl = document.getElementById('currentRound');
const currentQuestionEl = document.getElementById('currentQuestion');


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

  
  sendDisplayUpdate({ type: 'flash', text });
}

function highlightActive(){
  flash('Beurt: ' + (players[activePlayerIndex]?players[activePlayerIndex].name:'-'));
}

function stopLoopTimerSFX() {
  
  if (loopTimerAudio) {
    loopTimerAudio = null;
  }
  
  try { sendDisplayUpdate({ type: 'audio', action: 'loopStop' }); } catch(e) {}
}

function stopAllTimers(){
  if(globalTimerInterval){ clearInterval(globalTimerInterval); globalTimerInterval=null; }
  if(thinkingTimerInterval){ clearInterval(thinkingTimerInterval); thinkingTimerInterval=null; }
  
  stopLoopTimerSFX();
}




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

  
  players = await Promise.all(nameInputs.map(async (nameInput, i) => {
    const name = nameInput.value.trim() || nameInput.placeholder || `Kandidaat ${i+1}`;
    const photoInput = photoInputs[i];
    let photoUrl = 'assets/avatar.png'; 

    
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
      players: players 
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
  
  audioObj.pause(); 
  audioObj.currentTime = 0;
  audioObj.play()
    .then(() => console.log('Audio gestart:', audioObj.src))
    .catch(err => console.warn('Audio kon niet starten:', err));
}

document.getElementById('playSting').addEventListener('click', () => {
  
  sendDisplayUpdate({ type: 'audio', action: 'play', src: 'SFX/generiek.mp3' });
});
document.getElementById('playBumper').addEventListener('click', () => {
  sendDisplayUpdate({ type: 'audio', action: 'play', src: 'SFX/snd_bumper.mp3' });
});


document.getElementById('playKlok').addEventListener('click', () => {
  
  sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' });
  startLoopTimer();
});

document.getElementById('stopKlokFout').addEventListener('click', () => {
  stopLoopTimerSFX(); 
  playSFX('SFX/fout.mp3'); 

  
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

let loopTimerInterval = null;   

function startLoopTimer() {
    
    if(loopTimerInterval){
        clearInterval(loopTimerInterval);
    }

    
    loopTimerSeconds = 0;

    
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

    
    timerDisplay.textContent = fmtS(loopTimerSeconds) + 's';

loopTimerInterval = setInterval(() => {
        loopTimerSeconds++;
        timerDisplay.textContent = fmtS(loopTimerSeconds) + 's';

        
        sendDisplayUpdate({ 
            type: 'timer_update', 
            seconds: loopTimerSeconds, 
            activeIndex: activePlayerIndex 
        }); 
        
    }, 1000);
}

renderPlayers();
console.log('Core.js geladen — basisfunctionaliteit actief');
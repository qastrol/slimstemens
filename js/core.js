
let players = [];
let originalPlayersOrder = []; // Bewaar originele volgorde voor finale-stoelen herstellen
let startSeconds = 60;
let currentRoundIndex = 0;
let roundsSequence = ["threeSixNine","opendeur","puzzel","galerij","collectief","finale"];
let playerModeSettings = { playerCount: 3, questionsPerRound: 1 };
let bumpersEnabled = true;
let introEnabled = false;
let outroEnabled = false;
let introText = '';
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

  const activeDisplayIndex = players.findIndex(p => p.index === activePlayerIndex);
  const safeActiveIndex = activeDisplayIndex !== -1 ? activeDisplayIndex : activePlayerIndex;

  sendDisplayUpdate({
    type: 'players',
    players,
    active: safeActiveIndex,
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

function clearPreFinaleBonusControls() {
  const area = document.getElementById('preFinaleBonusControls');
  if (area) area.innerHTML = '';
}

function grantPreFinaleBonus(seconds = 30) {
  if (perRoundState?.round === 'finale') {
    flash('Bonus is niet beschikbaar tijdens de finale.');
    return;
  }

  players.forEach(p => {
    p.seconds += seconds;
  });

  renderPlayers();
  sendDisplayUpdate({
    type: 'players',
    players,
    active: activePlayerIndex,
    round: perRoundState?.round || '-'
  });
  flash(`Quizmaster bonus: iedereen +${seconds}s.`);
  clearPreFinaleBonusControls();
}

function showPreFinaleBonusControls(seconds = 30) {
  if (perRoundState?.round === 'finale') return;

  const area = document.getElementById('preFinaleBonusControls');
  if (!area) return;
  if (area.querySelector('#preFinaleBonusBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'preFinaleBonusBtn';
  btn.className = 'secondary';
  btn.textContent = `Geef iedereen +${seconds}s`;
  btn.addEventListener('click', () => grantPreFinaleBonus(seconds));
  area.appendChild(btn);
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

function updateRoundsSequence() {
  const playerCount = playerModeSettings.playerCount;
  
  if (playerCount === 1) {
    // Bij 1 speler: finale overslaan
    roundsSequence = ["threeSixNine","opendeur","puzzel","galerij","collectief"];
    console.log(`Rounds aangepast voor ${playerCount} speler: Finale overgeslagen`);
  } else {
    // Bij 2-3 spelers: inclusief finale
    roundsSequence = ["threeSixNine","opendeur","puzzel","galerij","collectief","finale"];
  }
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
  // Als bumpers enabled zijn, toon eerst de bumper
  if (bumpersEnabled) {
    showRoundBumper(roundKey, () => {
      startRoundAfterBumper(roundKey);
    });
  } else {
    startRoundAfterBumper(roundKey);
  }
}

function startRoundAfterBumper(roundKey) {
  roundRunning = true;
  perRoundState = { round: roundKey };
  currentQuestionIndex = 0;
  activePlayerIndex = 0;
  currentRoundEl.textContent = niceRoundName(roundKey);
  currentQuestionEl.innerHTML = '<em>Ronde gestart — druk op Volgende vraag om te beginnen.</em>';
  stopAllTimers();
  clearPreFinaleBonusControls();

  // Verberg intro controls wanneer ronde start
  const introControlArea = document.getElementById('introControlArea');
  if (introControlArea) {
    introControlArea.style.display = 'none';
  }

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

function showRoundBumper(roundKey, callback) {
  const roundTitle = niceRoundName(roundKey);
  
  // Stuur bumper naar display
  sendDisplayUpdate({
    type: 'show_bumper',
    roundTitle: roundTitle
  });
  
  // Wacht 4.5 seconden en ga dan verder
  setTimeout(() => {
    if (callback) callback();
  }, 4500);
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
  const playerCountSelect = parseInt(document.getElementById('playerCountSelect').value) || 3;
  const questionsPerRound = parseInt(document.getElementById('questionsPerRoundSelect').value) || 1;
  
  // Lees bumpers setting
  bumpersEnabled = document.getElementById('bumpersEnabledCheckbox').checked;
  
  // Lees intro setting
  introEnabled = document.getElementById('introEnabledCheckbox').checked;
  introText = document.getElementById('introText').value.trim();
  
  // Sla player mode settings op
  playerModeSettings = {
    playerCount: playerCountSelect,
    questionsPerRound: questionsPerRound
  };
  
  // Sla ook op in config manager
  if (typeof setPlayerModeSettings === 'function') {
    setPlayerModeSettings(playerCountSelect, questionsPerRound);
  }
  
  // Update rounds sequence op basis van player count
  updateRoundsSequence();
  
  const nameInputs = Array.from(document.querySelectorAll('.playerName')).filter((_, i) => i < playerCountSelect);
  const photoInputs = Array.from(document.querySelectorAll('.playerPhoto')).filter((_, i) => i < playerCountSelect);
  
  startSeconds = parseInt(document.getElementById('startSeconds').value)||60;

  
  players = await Promise.all(nameInputs.map(async (nameInput, i) => {
    const name = nameInput.value.trim() || nameInput.placeholder || `Kandidaat ${i+1}`;
    const photoInput = photoInputs[i];
    let photoUrl = 'assets/avatar.png'; 

    // Controleer eerst of foto van config beschikbaar is
    if (window.playerPhotosFromConfig && window.playerPhotosFromConfig[i]) {
      photoUrl = window.playerPhotosFromConfig[i];
      console.log(`✅ Speler ${i} "${name}": foto van config`);
    }
    // Anders: gebruik foto van file input als aanwezig
    else if (photoInput && photoInput.files && photoInput.files[0]) {
      photoUrl = await readFileAsDataURL(photoInput.files[0]);
      console.log(`✅ Speler ${i} "${name}": foto van file input`);
    } else {
      console.log(`⚠️ Speler ${i} "${name}": standaard avatar`);
    }

    return { name, seconds: startSeconds, index: i, position: i, photoUrl };
  }));

  // Sla originele volgorde op voor later herstellen in finale
  originalPlayersOrder = JSON.parse(JSON.stringify(players));

  playerCountEl.textContent = players.length;
  renderPlayers();

  sendDisplayUpdate({
      type: 'scene_change',
      scene: 'lobby',
      players: players 
  });
  
  const modeText = playerCountSelect === 1 ? `${questionsPerRound} vraag/vragen per ronde` : '';
  flash(`Spel aangemaakt met ${playerCountSelect} speler(s) ${modeText} — klaar om te starten`);
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
  const expectedCount = playerModeSettings.playerCount;
  if(players.length !== expectedCount){ 
    flash(`Maak eerst het spel aan met ${expectedCount} kandidaat/kandidaten`); 
    return; 
  }
  currentRoundIndex = currentRoundIndex % roundsSequence.length;
  startRound(roundsSequence[currentRoundIndex]);
});

document.getElementById('nextRound').addEventListener('click', ()=>{
  // Bij 1 speler en einde van collectief: toon eindstand
  if (playerModeSettings.playerCount === 1 && 
      currentRoundIndex < roundsSequence.length && 
      roundsSequence[currentRoundIndex] === 'collectief') {
    // Toon solo eindscherm op display
    const player = players[0];
    
    // Speel finale geluid af
    if (typeof playSFX === 'function') playSFX('SFX/finale.mp3');
    
    sendDisplayUpdate({
      type: 'game_end',
      key: 'solo_end',
      scene: 'solo-game-end',
      player: player,
      finalSeconds: Math.floor(player.seconds)
    });
    flash('Solo spel afgelopen! Eindstand wordt getoond op display.');
    return;
  }
  
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

// Audio Buttons - met null checks
const stingBtn = document.getElementById('playSting');
if (stingBtn) {
  stingBtn.addEventListener('click', () => {
    sendDisplayUpdate({ type: 'audio', action: 'play', src: 'SFX/generiek.mp3' });
  });
}

const bumperBtn = document.getElementById('playBumper');
if (bumperBtn) {
  bumperBtn.addEventListener('click', () => {
    sendDisplayUpdate({ type: 'audio', action: 'play', src: 'SFX/snd_bumper.mp3' });
  });
}

const applauseBtn = document.getElementById('playApplause');
if (applauseBtn) {
  applauseBtn.addEventListener('click', () => {
    sendDisplayUpdate({ type: 'audio', action: 'play', src: 'SFX/applause.ogg' });
  });
}

const klokBtn = document.getElementById('playKlok');
if (klokBtn) {
  klokBtn.addEventListener('click', () => {
    sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' });
    startLoopTimer();
  });
}

const stopKlokBtn = document.getElementById('stopKlokFout');
if (stopKlokBtn) {
  stopKlokBtn.addEventListener('click', () => {
    stopLoopTimerSFX(); 
    playSFX('SFX/fout.mp3');
    if(loopTimerInterval){
      clearInterval(loopTimerInterval);
      loopTimerInterval = null;
    }
  });
}

const finalBumperBtn = document.getElementById('playFinaleBumper');
if (finalBumperBtn) {
  finalBumperBtn.addEventListener('click', () => {
    playSFX('SFX/finale.mp3');
  });
}

const collectiefEndSelect = document.getElementById('collectiefEndOption');
if (collectiefEndSelect) {
  collectiefEndSelect.addEventListener('change', (e)=>{
    collectiefEndOption = e.target.value;
    flash(`Collectief Geheugen eindinstelling aangepast: ${e.target.selectedOptions[0].text}`);
  });
}

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

// Intro Start knop
document.addEventListener('DOMContentLoaded', () => {
  const startIntroBtn = document.getElementById('startIntroBtn');
  if (startIntroBtn) {
    startIntroBtn.addEventListener('click', function() {
      console.log('🎬 Start Intro knop geklikt');
      
      if (!introEnabled) {
        console.warn('⚠️ Intro niet ingeschakeld');
        alert('Intro is niet ingeschakeld!');
        return;
      }
      
      // Lees intro-tekst rechtstreeks uit input element
      const introTextInput = document.getElementById('introText');
      const finalIntroText = introTextInput ? introTextInput.value.trim() : '';
      
      console.log('📤 Stuur intro_start bericht');
      console.log('- ingeschakeld:', introEnabled);
      console.log('- tekst:', finalIntroText || '(leeg)');
      
      // Stuur WebSocket bericht naar display
      sendDisplayUpdate({
        type: 'intro_start',
        text: finalIntroText || ''
      });
      
      // Toon intro script voor presentator
      const introScriptArea = document.getElementById('introScriptArea');
      const introScriptText = document.getElementById('introScriptText');
      if (introScriptArea && introScriptText) {
        if (finalIntroText) {
          introScriptText.textContent = finalIntroText;
          introScriptArea.style.display = 'block';
        } else {
          introScriptArea.style.display = 'none';
        }
      }
      
      // Toon video controls
      document.getElementById('playIntroVideo').style.display = 'inline-block';
      document.getElementById('introPerspectiveFull').style.display = 'inline-block';
      document.getElementById('introPerspectiveCand1').style.display = 'inline-block';
      document.getElementById('introPerspectiveCand2').style.display = 'inline-block';
      document.getElementById('introPerspectiveCand3').style.display = 'inline-block';
      document.getElementById('stopIntroBtn').style.display = 'inline-block';
      
      // Verberg Start Intro knop
      startIntroBtn.style.display = 'none';
    });
  } else {
    console.error('❌ Start Intro knop niet gevonden in HTML');
  }
  
  // Play Video knop
  const playIntroVideo = document.getElementById('playIntroVideo');
  if (playIntroVideo) {
    playIntroVideo.addEventListener('click', function() {
      console.log('▶️ Speel Video knop geklikt');
      sendDisplayUpdate({ type: 'intro_play_video' });
    });
  }
  
  // Perspectief knoppen
  const introPerspectives = {
    'introPerspectiveFull': 'full',
    'introPerspectiveCand1': 'cand1',
    'introPerspectiveCand2': 'cand2',
    'introPerspectiveCand3': 'cand3'
  };
  
  for (const [btnId, perspective] of Object.entries(introPerspectives)) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', function() {
        console.log(`🔄 Perspectief wissel naar: ${perspective}`);
        sendDisplayUpdate({ 
          type: 'intro_perspective',
          perspective: perspective
        });
      });
    }
  }
  
  // Stop Intro knop
  const stopIntroBtn = document.getElementById('stopIntroBtn');
  if (stopIntroBtn) {
    stopIntroBtn.addEventListener('click', function() {
      console.log('⏹️ Stop Intro knop geklikt');
      sendDisplayUpdate({ type: 'intro_stop' });
      
      // Verberg intro script
      const introScriptArea = document.getElementById('introScriptArea');
      if (introScriptArea) {
        introScriptArea.style.display = 'none';
      }
      
      // Reset button visibility
      startIntroBtn.style.display = 'inline-block';
      playIntroVideo.style.display = 'none';
      document.getElementById('introPerspectiveFull').style.display = 'none';
      document.getElementById('introPerspectiveCand1').style.display = 'none';
      document.getElementById('introPerspectiveCand2').style.display = 'none';
      document.getElementById('introPerspectiveCand3').style.display = 'none';
      stopIntroBtn.style.display = 'none';
    });
  }
});

renderPlayers();
console.log('Core.js geladen — basisfunctionaliteit actief');

function shouldIgnoreHotkeys(event) {
  if (event.ctrlKey || event.altKey || event.metaKey) return true;
  const target = event.target;
  if (!target) return false;
  const tag = target.tagName ? target.tagName.toLowerCase() : '';
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function handleRoundHotkey(key) {
  if (!perRoundState || !perRoundState.round) return false;

  const round = perRoundState.round;
  const numberIndex = /^[1-9]$/.test(key) ? parseInt(key, 10) - 1 : null;

  if (key === 'n' && typeof nextQuestion === 'function') {
    nextQuestion();
    return true;
  }

  if (key === 't') {
    if (round === 'opendeur' && typeof startOpenDeurTimer === 'function') { startOpenDeurTimer(); return true; }
    if (round === 'puzzel' && typeof startPuzzelTimer === 'function') { startPuzzelTimer(); return true; }
    if (round === 'galerij' && typeof startGalerijTimer === 'function') { startGalerijTimer(); return true; }
    if (round === 'collectief' && typeof startCollectiefTimer === 'function') { startCollectiefTimer(); return true; }
    if (round === 'finale' && typeof startFinaleTimer === 'function') { startFinaleTimer(); return true; }
  }

  if (key === 'g') {
    if (round === 'threeSixNine' && typeof markThreeSixNineAnswer === 'function') {
      markThreeSixNineAnswer(true);
      if (typeof playSFX === 'function') playSFX('SFX/goed.mp3');
      return true;
    }
    if (round === 'galerij' && typeof markGalerijAnswer === 'function' && galleryPhase === 'main') {
      const img = galleryImages[galleryIndex];
      if (img) {
        markGalerijAnswer(true, img.answer);
        return true;
      }
    }
  }

  if (key === 'f') {
    if (round === 'threeSixNine' && typeof markThreeSixNineAnswer === 'function') {
      markThreeSixNineAnswer(false);
      if (typeof playSFX === 'function') playSFX('SFX/fout.mp3');
      return true;
    }
  }

  if (key === 'p') {
    if (round === 'opendeur' && typeof passOpenDeur === 'function') { passOpenDeur(); return true; }
    if (round === 'puzzel' && typeof passPuzzel === 'function') { passPuzzel(); return true; }
    if (round === 'galerij') {
      if (galleryPhase === 'aanvul' && typeof nextAanvulTurn === 'function') { nextAanvulTurn(); return true; }
      if (typeof markGalerijAnswer === 'function' && galleryPhase === 'main') {
        const img = galleryImages[galleryIndex];
        if (img) { markGalerijAnswer(false, img.answer); return true; }
      }
    }
    if (round === 'collectief' && typeof passCollectief === 'function') { passCollectief(); return true; }
    if (round === 'finale' && typeof passFinale === 'function') { passFinale(); return true; }
  }

  if (numberIndex !== null) {
    if (round === 'opendeur' && typeof markOpenDeurAnswer === 'function') {
      const answers = perRoundState?.currentQuestion?.answersDisplay || [];
      if (numberIndex < answers.length) {
        markOpenDeurAnswer(numberIndex);
        return true;
      }
    }

    if (round === 'collectief' && typeof markCollectiefAnswer === 'function') {
      const currentQuestion = perRoundState?.collectief?.questions?.[perRoundState?.collectief?.currentQuestionIndex] || null;
      const answers = currentQuestion?.answers || [];
      if (numberIndex < answers.length) {
        markCollectiefAnswer(numberIndex);
        return true;
      }
    }

    if (round === 'finale' && typeof markFinaleAnswer === 'function') {
      const currentQuestion = perRoundState?.finale?.currentQuestion || null;
      const answers = currentQuestion?.answers || [];
      if (numberIndex < answers.length) {
        markFinaleAnswer(numberIndex);
        return true;
      }
    }

    if (round === 'puzzel' && typeof markPuzzelLink === 'function') {
      const puzzel = perRoundState?.currentPuzzel || null;
      const links = puzzel?.links || [];
      if (numberIndex < links.length) {
        markPuzzelLink(links[numberIndex].link);
        return true;
      }
    }

    if (round === 'galerij' && galleryPhase === 'aanvul' && typeof markAanvulAnswer === 'function') {
      if (numberIndex < passedImages.length) {
        markAanvulAnswer(passedImages[numberIndex]);
        return true;
      }
    }
  }

  return false;
}

document.addEventListener('keydown', (event) => {
  if (shouldIgnoreHotkeys(event)) return;
  const key = event.key.toLowerCase();
  if (handleRoundHotkey(key)) {
    event.preventDefault();
  }
});
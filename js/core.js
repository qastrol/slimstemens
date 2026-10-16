
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
let safeRoundNavigationEnabled = false;
let roundRunning = false;
let currentQuestionIndex = 0;
let perRoundState = {};
let globalTimerInterval = null;
let thinkingTimerInterval = null;
let activePlayerIndex = 0;
let hostCheatsEnabled = false;
let hostTimerSpeed = 1;
let thinkingTimerTickProgress = 0;
let thinkingTimerPlayer = null;
const pendingHostTimerSpeeds = new Map();
const pendingHostAnswerMultipliers = new Map();
const activeHostAnswerMultipliers = new Map();
const hostCheatActions = new Map();
let loopTimerAudio = null;
let loopTimerSeconds = 0;       
let presenterScriptsEnabled = false;
let presenterScriptsPhases = {};
let activePresenterScriptPhase = null;

const PRESENTER_SCRIPT_LABELS = {
  lobbyBeforeThreeSixNine: 'Presentatorscript - Lobby (voor 3-6-9)',
  threeSixNineFirstQuestion: 'Presentatorscript - 3-6-9 (eerste vraag)',
  openDeurFirstQuestion: 'Presentatorscript - Open Deur (eerste vraag)',
  puzzelFirstQuestion: 'Presentatorscript - Puzzel (eerste vraag)',
  galerijFirstQuestion: 'Presentatorscript - Galerij (eerste vraag)',
  collectiefFirstQuestion: 'Presentatorscript - Collectief Geheugen (eerste vraag)',
  finaleFirstQuestion: 'Presentatorscript - Finale (eerste vraag)'
};

function normalizePresenterScriptsSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const phasesSource = source.phases && typeof source.phases === 'object' ? source.phases : {};

  const normalizedPhases = {};
  Object.keys(PRESENTER_SCRIPT_LABELS).forEach((phaseKey) => {
    const value = phasesSource[phaseKey];
    normalizedPhases[phaseKey] = typeof value === 'string' ? value.trim() : '';
  });

  return {
    enabled: !!source.enabled,
    phases: normalizedPhases
  };
}

function hidePresenterScript() {
  const area = document.getElementById('introScriptArea');
  if (area) {
    area.style.display = 'none';
  }
  activePresenterScriptPhase = null;
}

function showPresenterScriptForPhase(phaseKey) {
  const text = presenterScriptsPhases[phaseKey];
  if (!presenterScriptsEnabled || !text) {
    return false;
  }

  const area = document.getElementById('introScriptArea');
  const title = document.getElementById('introScriptTitle');
  const textEl = document.getElementById('introScriptText');
  if (!area || !textEl) {
    return false;
  }

  if (title) {
    title.textContent = PRESENTER_SCRIPT_LABELS[phaseKey] || 'Presentator script:';
  }

  textEl.textContent = text;
  area.style.display = 'block';
  activePresenterScriptPhase = phaseKey;
  return true;
}

function applyPresenterScriptsSettings(settings) {
  const normalized = normalizePresenterScriptsSettings(settings);
  presenterScriptsEnabled = normalized.enabled;
  presenterScriptsPhases = normalized.phases;

  if (!presenterScriptsEnabled) {
    hidePresenterScript();
  }
}

window.applyPresenterScriptsSettings = applyPresenterScriptsSettings;


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
const desktopBridge = typeof window !== 'undefined' ? window.slimstemensDesktopBridge : null;

const WS_ADDRESS = 'ws://127.0.0.1:8081/';

function connectToQuizServer() {
  if (desktopBridge && typeof desktopBridge.send === 'function') {
    if (!streamerBotWS || streamerBotWS.__transport !== 'electron') {
      streamerBotWS = {
        __transport: 'electron',
        readyState: WebSocket.OPEN,
        send(message) {
          desktopBridge.send(message);
        }
      };
      console.log('Verbonden met lokale Electron-bridge.');
      sendDisplayUpdate({ type: 'init', players, active: activePlayerIndex, round: perRoundState?.round || '-' });
    }

    return;
  }

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


let pendingScoreboardDismissal = false;
let scoreboardDismissalFallbackTimeout = null;

function deferScoreboardDismissal() {
  pendingScoreboardDismissal = true;
  clearTimeout(scoreboardDismissalFallbackTimeout);
  scoreboardDismissalFallbackTimeout = setTimeout(() => {
    if (!pendingScoreboardDismissal) return;
    sendDisplayUpdate({ type: 'scoreboard_toggle', showing: false });
  }, 0);
}

function sendDisplayUpdate(data) {
  const fallbackBranding = {
    titlePrefix: 'de slimste mens',
    titleSuffix: '',
    logoPath: 'assets/slimstemens.png'
  };
  const branding = typeof getBrandingSettings === 'function' ? getBrandingSettings() : fallbackBranding;
  const dismissScoreboard = pendingScoreboardDismissal && data?.type !== 'audio';
  if (dismissScoreboard) {
    pendingScoreboardDismissal = false;
    clearTimeout(scoreboardDismissalFallbackTimeout);
  }
  const payload = {
    ...data,
    ...(dismissScoreboard ? { dismissScoreboard: true } : {}),
    branding: data?.branding || branding
  };

  if (streamerBotWS && streamerBotWS.readyState === WebSocket.OPEN) {
    streamerBotWS.send(JSON.stringify(payload));
  } else {
    
    if (!streamerBotWS || streamerBotWS.readyState === WebSocket.CLOSED) {
        connectToQuizServer(); 
    }
  }
}

function sendRoundDisplayUpdate({
  type = 'update',
  key,
  scene,
  activeIndex = activePlayerIndex,
  playersData = players,
  extraData = {}
} = {}) {
  if (!key) {
    console.warn('sendRoundDisplayUpdate: key ontbreekt.');
    return;
  }

  sendDisplayUpdate({
    type,
    key,
    scene,
    activeIndex,
    players: playersData,
    ...extraData
  });
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

function playLoopSFX(file, channel = 'default', playbackRate = 1) {
  try { sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: file, channel, playbackRate }); } catch(e) {}
}

function setLoopSFXPlaybackRate(channel = 'default', playbackRate = 1) {
  try { sendDisplayUpdate({ type: 'audio', action: 'loopRate', channel, playbackRate }); } catch(e) {}
}

function stopLoopSFX(channel = 'default') {
  try { sendDisplayUpdate({ type: 'audio', action: 'loopStop', channel }); } catch(e) {}
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
  const value = Math.max(0, Number(s) || 0);
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? rounded : String(rounded).replace('.', ',');
}



const playersArea = document.getElementById('playersArea');
const playerCountEl = document.getElementById('playerCount');
const currentRoundEl = document.getElementById('currentRound');
const currentQuestionEl = document.getElementById('currentQuestion');


function renderPlayers(updateDisplay = true){
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
  renderHostCheatControls();

  // Zoek de speler eerst op ID/index, anders val terug op de actieve index als geldige array-index
  let safeActiveIndex = players.findIndex(p => p.index === activePlayerIndex);
  
  if (safeActiveIndex === -1) {
    // Als er geen matchende p.index is, controleer of activePlayerIndex rechtstreeks binnen de array-grenzen valt
    if (activePlayerIndex >= 0 && activePlayerIndex < players.length) {
      safeActiveIndex = activePlayerIndex;
    } else {
      safeActiveIndex = 0;
    }
  }

  const scoreboardIsVisible = typeof window.shouldSyncPlayersToScoreboard === 'function' &&
    window.shouldSyncPlayersToScoreboard();
  if (updateDisplay || scoreboardIsVisible) {
    sendDisplayUpdate({
      type: 'players',
      players,
      active: safeActiveIndex,
      round: perRoundState?.round || 'lobby'
    });
  }
}

function getHostCheatSelectedPlayer() {
  const playerSelect = document.getElementById('hostCheatPlayer');
  if (!playerSelect) return null;
  return players.find(player => String(player.index) === playerSelect.value) || null;
}

function getHostTimerActivePlayer() {
  return players.find(player => player.index === activePlayerIndex) || players[activePlayerIndex] || null;
}

function getHostQuestionReference() {
  switch (perRoundState?.round) {
    case 'threeSixNine':
    case 'opendeur':
      return perRoundState.currentQuestion || null;
    case 'puzzel':
      return perRoundState.currentPuzzel || null;
    case 'galerij':
      return galleryImages?.[galleryIndex] || null;
    case 'collectief':
      return perRoundState.collectief?.questions?.[perRoundState.collectief.currentQuestionIndex] || null;
    case 'finale':
      return perRoundState.finale?.currentQuestion || null;
    default:
      return null;
  }
}

function getSelectedHostAnswerMultiplier(player) {
  const active = activeHostAnswerMultipliers.get(player);
  if (active && active.question === getHostQuestionReference()) {
    return active.multiplier;
  }
  const pending = pendingHostAnswerMultipliers.get(player);
  return pending?.multiplier || pending || 1;
}

function setHostAnswerMultiplier(player, multiplier) {
  if (!hostCheatsEnabled || !players.includes(player)) {
    flash('Deze hostfunctie is niet beschikbaar.');
    return false;
  }
  if (![0.5, 2].includes(multiplier)) {
    throw new RangeError('Antwoordvermenigvuldiger moet 0,5× of 2× zijn.');
  }

  const question = getHostQuestionReference();
  const isCurrentPlayer = getHostTimerActivePlayer() === player;
  const isThreeSixNineDouble = multiplier === 2 && perRoundState?.round === 'threeSixNine';
  if (!isThreeSixNineDouble && isCurrentPlayer && question) {
    activeHostAnswerMultipliers.set(player, {
      multiplier,
      question,
      mode: null
    });
    pendingHostAnswerMultipliers.delete(player);
  } else {
    activeHostAnswerMultipliers.delete(player);
    pendingHostAnswerMultipliers.set(player, {
      multiplier,
      mode: isThreeSixNineDouble ? 'threeSixNineBonus' : null
    });
  }

  renderHostCheatControls();
  flash(isThreeSixNineDouble
    ? `Dubbele punten ingesteld voor de eerstvolgende derde vraag van ${player.name}; anders diens eerstvolgende beurt in Open Deur.`
    : isCurrentPlayer && question
    ? `Goede antwoorden van ${player.name} leveren op deze vraag ${multiplier === 2 ? 'dubbel' : 'de helft'} van de punten op.`
    : `Puntenmodifier ingesteld voor de eerstvolgende beurt van ${player.name}.`);
  return true;
}

function activateHostAnswerMultiplier(player, question = getHostQuestionReference(), forAnswer = false) {
  if (!question) return;
  const active = activeHostAnswerMultipliers.get(player);
  if (active && active.question !== question) {
    activeHostAnswerMultipliers.delete(player);
  }

  const pendingMultiplier = pendingHostAnswerMultipliers.get(player);
  if (!pendingMultiplier) return;

  const isThreeSixNineBonus = perRoundState?.round === 'threeSixNine' &&
    perRoundState.currentIsBonus === true &&
    question === getHostQuestionReference();
  const isOpenDeurAnswer = perRoundState?.round === 'opendeur' &&
    question === getHostQuestionReference();
  const canActivate = pendingMultiplier.mode !== 'threeSixNineBonus' ||
    (forAnswer && (isThreeSixNineBonus || isOpenDeurAnswer));
  if (canActivate) {
    const multiplier = pendingMultiplier.multiplier ?? pendingMultiplier;
    activeHostAnswerMultipliers.set(player, {
      multiplier,
      question,
      mode: pendingMultiplier.mode || null
    });
    pendingHostAnswerMultipliers.delete(player);
  }
}

function applyHostAnswerPoints(player, points, question = getHostQuestionReference()) {
  if (!question || !player) return points;
  activateHostAnswerMultiplier(player, question, true);
  const active = activeHostAnswerMultipliers.get(player);
  if (active?.question !== question) return points;

  const adjustedPoints = Math.round(points * active.multiplier * 2) / 2;
  if (active.mode === 'threeSixNineBonus') {
    activeHostAnswerMultipliers.delete(player);
  }
  return adjustedPoints;
}

function getHostRevealChoices() {
  switch (perRoundState?.round) {
    case 'opendeur': {
      const question = perRoundState.currentQuestion;
      if (!question) return [];
      question.hostRevealedAnswerIndexes ||= [];
      return (question.answersDisplay || question.answers || [])
        .map((answer, index) => ({ answer, index }))
        .filter(({ index }) => !question.answered?.[index] && !question.hostRevealedAnswerIndexes.includes(index))
        .map(({ answer, index }) => ({
          answer,
          reveal: () => question.hostRevealedAnswerIndexes.push(index)
        }));
    }
    case 'puzzel': {
      const question = perRoundState.currentPuzzel;
      if (!question) return [];
      question.hostRevealedLinks ||= [];
      return (question.links || [])
        .filter(link => !question.foundLinks?.includes(link) && !question.hostRevealedLinks.includes(link.link))
        .map(link => ({
          answer: `${link.link}: ${link.answers.join(', ')}`,
          reveal: () => question.hostRevealedLinks.push(link.link)
        }));
    }
    case 'collectief': {
      const question = getHostQuestionReference();
      if (!question) return [];
      question.hostRevealedAnswers ||= [];
      return (question.answers || [])
        .filter(answer =>
          !question.foundAnswers?.some(found => found.answer === answer) &&
          !question.hostRevealedAnswers.includes(answer))
        .map(answer => ({
          answer,
          reveal: () => question.hostRevealedAnswers.push(answer)
        }));
    }
    case 'finale': {
      const question = getHostQuestionReference();
      if (!question) return [];
      question.hostRevealedAnswers ||= [];
      return (question.answers || [])
        .filter(answer =>
          !question.foundAnswers?.some(found => found.answer === answer) &&
          !question.hostRevealedAnswers.includes(answer))
        .map(answer => ({
          answer,
          reveal: () => question.hostRevealedAnswers.push(answer)
        }));
    }
    default:
      return [];
  }
}

function revealRandomHostAnswer() {
  if (!hostCheatsEnabled) return false;
  if (perRoundState?.round === 'threeSixNine' || perRoundState?.round === 'galerij') {
    flash('Willekeurig antwoord onthullen is niet beschikbaar in deze ronde.');
    return false;
  }
  const choices = getHostRevealChoices();
  if (choices.length === 0) {
    flash('Er zijn geen antwoorden meer om te onthullen.');
    return false;
  }
  const choice = choices[Math.floor(Math.random() * choices.length)];
  choice.reveal();
  sendDisplayUpdate({ type: 'host_answer_reveal', answer: choice.answer });
  renderHostCheatControls();
  flash(`Onthuld antwoord: ${choice.answer}`);
  return true;
}

function renderHostCheatControls() {
  const panel = document.getElementById('hostCheatPanel');
  const playerSelect = document.getElementById('hostCheatPlayer');
  const doubleTimerButton = document.getElementById('hostCheatDoubleTimer');
  const halfTimerButton = document.getElementById('hostCheatHalfTimer');
  const normalTimerButton = document.getElementById('hostCheatNormalTimer');
  const timerStatus = document.getElementById('hostCheatTimerStatus');
  const doubleAnswerButton = document.getElementById('hostCheatDoubleAnswerPoints');
  const halfAnswerButton = document.getElementById('hostCheatHalfAnswerPoints');
  const revealAnswerButton = document.getElementById('hostCheatRevealAnswer');
  const answerStatus = document.getElementById('hostCheatAnswerStatus');
  const swapPlayerA = document.getElementById('hostCheatSwapPlayerA');
  const swapPlayerB = document.getElementById('hostCheatSwapPlayerB');
  const extensionActions = document.getElementById('hostCheatExtensionActions');
  if (!panel || !playerSelect) return;

  panel.hidden = !hostCheatsEnabled || players.length === 0;
  const selectedPlayerIndex = playerSelect.value;
  playerSelect.replaceChildren();
  players.forEach(player => {
    const option = document.createElement('option');
    option.value = String(player.index);
    option.textContent = player.name;
    playerSelect.appendChild(option);
  });
  if (players.some(player => String(player.index) === selectedPlayerIndex)) {
    playerSelect.value = selectedPlayerIndex;
  }
  [swapPlayerA, swapPlayerB].forEach((select, selectIndex) => {
    if (!select) return;
    const selectedIndex = select.value;
    select.replaceChildren();
    players.forEach((player, playerIndex) => {
      const option = document.createElement('option');
      option.value = String(player.index);
      option.textContent = player.name;
      select.appendChild(option);
      if (!selectedIndex && playerIndex === selectIndex) option.selected = true;
    });
    if (players.some(player => String(player.index) === selectedIndex)) {
      select.value = selectedIndex;
    }
  });

  const selectedPlayer = getHostCheatSelectedPlayer();
  const selectedPlayerIsOnClock = !!selectedPlayer &&
    !!thinkingTimerInterval &&
    thinkingTimerPlayer === selectedPlayer &&
    getHostTimerActivePlayer() === selectedPlayer;
  const selectedSpeed = selectedPlayerIsOnClock
    ? hostTimerSpeed
    : (selectedPlayer && pendingHostTimerSpeeds.has(selectedPlayer)
      ? pendingHostTimerSpeeds.get(selectedPlayer)
      : 1);

  if (doubleTimerButton) {
    doubleTimerButton.disabled = !hostCheatsEnabled || !selectedPlayer;
    doubleTimerButton.setAttribute('aria-pressed', String(selectedSpeed === 2));
  }

  if (halfTimerButton) {
    halfTimerButton.disabled = !hostCheatsEnabled || !selectedPlayer;
    halfTimerButton.setAttribute('aria-pressed', String(selectedSpeed === 0.5));
  }

  if (normalTimerButton) {
    normalTimerButton.hidden = !hostCheatsEnabled || !selectedPlayerIsOnClock || selectedSpeed === 1;
    normalTimerButton.disabled = !hostCheatsEnabled;
  }

  if (timerStatus) {
    const status = selectedPlayerIsOnClock
      ? 'Actief voor deze beurt'
      : selectedPlayer && pendingHostTimerSpeeds.has(selectedPlayer)
          ? getHostTimerActivePlayer() === selectedPlayer
            ? 'Ingesteld voor de huidige beurt'
            : 'Ingesteld voor de volgende beurt'
          : 'Normale snelheid';
    const speedDescription = selectedSpeed === 2
      ? '2× zo snel'
      : selectedSpeed === 0.5
        ? '2× zo langzaam'
        : 'normaal';
    timerStatus.textContent = selectedPlayer
      ? `Timer voor ${selectedPlayer.name}: ${speedDescription} (${status.toLowerCase()}).`
      : 'Selecteer een kandidaat om een timersnelheid in te stellen.';
  }

  const answerMultiplier = selectedPlayer ? getSelectedHostAnswerMultiplier(selectedPlayer) : 1;
  if (doubleAnswerButton) {
    doubleAnswerButton.disabled = !hostCheatsEnabled || !selectedPlayer;
    doubleAnswerButton.setAttribute('aria-pressed', String(answerMultiplier === 2));
  }
  if (halfAnswerButton) {
    halfAnswerButton.disabled = !hostCheatsEnabled || !selectedPlayer;
    halfAnswerButton.setAttribute('aria-pressed', String(answerMultiplier === 0.5));
  }
  if (answerStatus) {
    const activeMultiplier = selectedPlayer && activeHostAnswerMultipliers.get(selectedPlayer);
    const pendingMultiplier = selectedPlayer && pendingHostAnswerMultipliers.get(selectedPlayer);
    const hasActiveMultiplier = activeMultiplier?.question === getHostQuestionReference();
    answerStatus.textContent = !selectedPlayer
      ? 'Selecteer een kandidaat om een puntenmodifier in te stellen.'
      : pendingMultiplier?.mode === 'threeSixNineBonus'
        ? `Dubbele punten: eerstvolgende derde vraag van ${selectedPlayer.name}; als die niet meer komt, diens eerste goede antwoord in Open Deur.`
        : answerMultiplier !== 1
          ? `Goede antwoorden: ${answerMultiplier === 2 ? 'dubbele' : 'halve'} punten (${hasActiveMultiplier ? 'deze vraag' : 'bij de eerstvolgende beurt'}).`
          : 'Goede antwoorden leveren de normale punten op.';
  }
  if (revealAnswerButton) {
    revealAnswerButton.disabled = !hostCheatsEnabled || getHostRevealChoices().length === 0;
  }

  if (extensionActions) {
    extensionActions.replaceChildren();
    hostCheatActions.forEach(action => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = action.label;
      button.addEventListener('click', () => {
        const player = getHostCheatSelectedPlayer();
        if (!player) {
          flash('Selecteer eerst een kandidaat.');
          return;
        }
        try {
          action.handler({
            player,
            playerIndex: player.index,
            amount: document.getElementById('hostCheatAmount')?.valueAsNumber,
            adjustScore: (operation, amount) => applyHostScoreChange(player, operation, amount),
            setActivePlayer: () => setHostActivePlayer(player),
            setTimerSpeed: speed => setHostTimerSpeed(player, speed),
            setAnswerMultiplier: multiplier => setHostAnswerMultiplier(player, multiplier),
            flash
          });
        } catch (error) {
          console.error(`Hostactie "${action.id}" mislukt:`, error);
          flash(`Hostactie mislukt: ${error.message || error}`);
        }
      });
      extensionActions.appendChild(button);
    });
  }
}

function applyHostScoreChange(player, operation, amount) {
  if (!hostCheatsEnabled || !players.includes(player)) {
    flash('Deze hostfunctie is niet beschikbaar.');
    return false;
  }
  if (!Number.isSafeInteger(amount) || amount < 0) {
    flash('Voer een geldig, niet-negatief geheel aantal punten/seconden in.');
    return false;
  }

  if (operation === 'add') {
    player.seconds += amount;
    playSFX('SFX/goed.mp3');
  } else if (operation === 'subtract') {
    player.seconds = Math.max(0, player.seconds - amount);
    playSFX('SFX/fout.mp3');
  }
  else if (operation === 'set') player.seconds = amount;
  else throw new Error(`Onbekende scorebewerking: ${operation}`);

  renderPlayers();
  flash(`${player.name}: score aangepast naar ${fmtS(player.seconds)} seconden.`);
  return true;
}

function setHostActivePlayer(player) {
  if (!hostCheatsEnabled || !players.includes(player)) {
    flash('Deze hostfunctie is niet beschikbaar.');
    return false;
  }

  const playerIndex = players.indexOf(player);
  if (perRoundState?.round === 'galerij') {
    if (galleryPhase === 'aanvul') {
      if (currentAanvulPlayer && currentAanvulPlayer !== player && !aanvulQueue.includes(currentAanvulPlayer)) {
        aanvulQueue.unshift(currentAanvulPlayer);
      }
      aanvulQueue = aanvulQueue.filter(candidate => candidate !== player);
      currentAanvulPlayer = player;
    } else {
      galleryPlayerIndex = playerIndex;
    }
    syncGalerijActivePlayerIndex();
    renderGalerijHostUI();
    sendGalerijDisplayUpdate();
  } else {
    activePlayerIndex = player.index;
  }

  renderPlayers();
  highlightActive();
  return true;
}

function setHostTimerSpeed(player, speed) {
  if (!hostCheatsEnabled || !players.includes(player)) {
    flash('Deze hostfunctie is niet beschikbaar.');
    return false;
  }
  if (![0.5, 1, 2].includes(speed)) {
    throw new RangeError('Timersnelheid moet 0,5×, 1× of 2× zijn.');
  }

  const isCurrentTurn = getHostTimerActivePlayer() === player;
  if (thinkingTimerInterval && thinkingTimerPlayer === player && isCurrentTurn) {
    hostTimerSpeed = speed;
    thinkingTimerTickProgress = 0;
    setLoopSFXPlaybackRate('timer', speed);
    pendingHostTimerSpeeds.delete(player);
  } else if (speed === 1) {
    pendingHostTimerSpeeds.delete(player);
  } else {
    pendingHostTimerSpeeds.set(player, speed);
  }

  renderHostCheatControls();
  const speedDescription = speed === 2
    ? 'twee keer zo snel'
    : speed === 0.5
      ? 'twee keer zo langzaam'
      : 'normale snelheid';
  flash(isCurrentTurn && thinkingTimerInterval && thinkingTimerPlayer === player
    ? `Timer en klok lopen nu ${speedDescription} voor ${player.name}.`
    : `${speedDescription[0].toUpperCase()}${speedDescription.slice(1)} ingesteld voor de ${
      isCurrentTurn ? 'huidige' : 'volgende'
    } beurt van ${player.name}.`);
  return true;
}

window.executeStreamerBotHostRequest = function executeStreamerBotHostRequest(request) {
  if (!desktopBridge || !hostCheatsEnabled) {
    throw new Error('Streamer.bot-opdrachten zijn alleen beschikbaar met Electron en uitgebreide hostmodus.');
  }
  if (!request || typeof request !== 'object' || typeof request.name !== 'string') {
    throw new TypeError('Ongeldige Streamer.bot-opdracht.');
  }

  const args = request.arguments && typeof request.arguments === 'object'
    ? request.arguments
    : {};
  const getPlayer = (index) => players.find(player => player.index === Number(index));
  const getRequiredPlayer = () => {
    const player = getPlayer(args.playerIndex);
    if (!player) throw new Error('Kandidaat niet gevonden; geef een geldige playerIndex mee.');
    return player;
  };
  const amount = Number(args.amount);

  switch (request.name) {
    case 'HostCheat':
      switch (args.operation) {
        case 'addScore':
          return applyHostScoreChange(getRequiredPlayer(), 'add', amount);
        case 'subtractScore':
          return applyHostScoreChange(getRequiredPlayer(), 'subtract', amount);
        case 'setScore':
          return applyHostScoreChange(getRequiredPlayer(), 'set', amount);
        case 'giveTurn':
          return setHostActivePlayer(getRequiredPlayer());
        case 'setTimerSpeed':
          return setHostTimerSpeed(getRequiredPlayer(), Number(args.speed));
        case 'setAnswerMultiplier':
          return setHostAnswerMultiplier(getRequiredPlayer(), Number(args.multiplier));
        case 'revealAnswer':
          return revealRandomHostAnswer();
        case 'setQuizName': {
          const titlePrefix = typeof args.titlePrefix === 'string' ? args.titlePrefix.trim() : '';
          const titleSuffix = typeof args.titleSuffix === 'string' ? args.titleSuffix.trim() : '';
          if (!titlePrefix) throw new Error('titlePrefix mag niet leeg zijn.');
          const branding = {
            ...(typeof getBrandingSettings === 'function' ? getBrandingSettings() : {}),
            titlePrefix: titlePrefix.slice(0, 80),
            titleSuffix: titleSuffix.slice(0, 80)
          };
          if (typeof gameConfig !== 'undefined') {
            gameConfig ||= {};
            gameConfig.settings ||= {};
            gameConfig.settings.branding = branding;
          }
          sendDisplayUpdate({ type: 'branding_update', branding });
          flash('Quiztekst vóór en ná het logo gewijzigd via Streamer.bot.');
          return true;
        }
        case 'swapPlayers': {
          const playerA = getRequiredPlayer();
          const playerB = getPlayer(args.otherPlayerIndex);
          if (!playerB) throw new Error('Tweede kandidaat niet gevonden; geef een geldige otherPlayerIndex mee.');
          if (playerA === playerB) throw new Error('Kies twee verschillende kandidaten om te wisselen.');
          [playerA.name, playerB.name] = [playerB.name, playerA.name];
          [playerA.photoUrl, playerB.photoUrl] = [playerB.photoUrl, playerA.photoUrl];
          renderPlayers();
          flash(`${playerA.name} en ${playerB.name} wisselen van stoel en score.`);
          return true;
        }
        case 'extension': {
          const action = hostCheatActions.get(String(args.actionId || ''));
          if (!action) throw new Error(`Niet-geregistreerde hostuitbreiding: ${String(args.actionId)}`);
          const player = args.playerIndex === undefined
            ? getHostCheatSelectedPlayer()
            : getRequiredPlayer();
          if (!player) throw new Error('Selecteer een kandidaat voor deze hostuitbreiding.');
          action.handler({
            player,
            playerIndex: player.index,
            amount: args.amount === undefined ? undefined : Number(args.amount),
            adjustScore: (operation, value) => applyHostScoreChange(player, operation, value),
            setActivePlayer: () => setHostActivePlayer(player),
            setTimerSpeed: speed => setHostTimerSpeed(player, speed),
            setAnswerMultiplier: multiplier => setHostAnswerMultiplier(player, multiplier),
            flash
          });
          return true;
        }
        default:
          throw new Error(`Onbekende Streamer.bot-hostactie: ${String(args.operation)}`);
      }
    default:
      throw new Error(`Onbekende Streamer.bot-opdracht: ${request.name}`);
  }
};

window.registerHostCheatAction = function registerHostCheatAction(action) {
  if (!action || typeof action.id !== 'string' || !action.id.trim() ||
      typeof action.label !== 'string' || !action.label.trim() ||
      typeof action.handler !== 'function') {
    throw new TypeError('Een hostactie vereist een id, label en handlerfunctie.');
  }
  const id = action.id.trim();
  if (hostCheatActions.has(id)) {
    throw new Error(`Hostactie "${id}" is al geregistreerd.`);
  }
  hostCheatActions.set(id, {
    id,
    label: action.label.trim(),
    handler: action.handler
  });
  renderHostCheatControls();
};

document.getElementById('hostCheatsEnabledCheckbox')?.addEventListener('change', event => {
  hostCheatsEnabled = event.currentTarget.checked;
  if (!hostCheatsEnabled) {
    pendingHostTimerSpeeds.clear();
    pendingHostAnswerMultipliers.clear();
    activeHostAnswerMultipliers.clear();
    resetHostTimerSpeed();
  } else {
    const branding = typeof getBrandingSettings === 'function' ? getBrandingSettings() : null;
    const titlePrefixInput = document.getElementById('hostCheatQuizTitlePrefix');
    const titleSuffixInput = document.getElementById('hostCheatQuizTitleSuffix');
    if (branding && titlePrefixInput && titleSuffixInput) {
      titlePrefixInput.value = branding.titlePrefix;
      titleSuffixInput.value = branding.titleSuffix;
    }
    renderHostCheatControls();
  }
  flash(hostCheatsEnabled
    ? 'Uitgebreide hostmodus ingeschakeld.'
    : 'Uitgebreide hostmodus uitgeschakeld.');
});

document.getElementById('hostCheatAddScore')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (!player) return flash('Selecteer eerst een kandidaat.');
  applyHostScoreChange(player, 'add', document.getElementById('hostCheatAmount').valueAsNumber);
});

document.getElementById('hostCheatSubtractScore')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (!player) return flash('Selecteer eerst een kandidaat.');
  applyHostScoreChange(player, 'subtract', document.getElementById('hostCheatAmount').valueAsNumber);
});

document.getElementById('hostCheatSetScore')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (!player) return flash('Selecteer eerst een kandidaat.');
  applyHostScoreChange(player, 'set', document.getElementById('hostCheatAmount').valueAsNumber);
});

document.getElementById('hostCheatGiveTurn')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (!player) return flash('Selecteer eerst een kandidaat.');
  setHostActivePlayer(player);
});

document.getElementById('hostCheatDoubleTimer')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (!player) return flash('Selecteer eerst een kandidaat.');
  const isCurrentTurn = thinkingTimerInterval &&
    thinkingTimerPlayer === player &&
    getHostTimerActivePlayer() === player;
  const currentSpeed = isCurrentTurn
    ? hostTimerSpeed
    : (pendingHostTimerSpeeds.get(player) || 1);
  setHostTimerSpeed(player, currentSpeed === 2 ? 1 : 2);
});

document.getElementById('hostCheatHalfTimer')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (!player) return flash('Selecteer eerst een kandidaat.');
  const isCurrentTurn = thinkingTimerInterval &&
    thinkingTimerPlayer === player &&
    getHostTimerActivePlayer() === player;
  const currentSpeed = isCurrentTurn
    ? hostTimerSpeed
    : (pendingHostTimerSpeeds.get(player) || 1);
  setHostTimerSpeed(player, currentSpeed === 0.5 ? 1 : 0.5);
});

document.getElementById('hostCheatNormalTimer')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (!player) return flash('Selecteer eerst een kandidaat.');
  const isCurrentTurn = thinkingTimerInterval &&
    thinkingTimerPlayer === player &&
    getHostTimerActivePlayer() === player;
  const currentSpeed = isCurrentTurn
    ? hostTimerSpeed
    : (pendingHostTimerSpeeds.get(player) ?? 1);
  if (currentSpeed === 1) return;
  setHostTimerSpeed(player, 1);
});

document.getElementById('hostCheatPlayer')?.addEventListener('change', renderHostCheatControls);

document.getElementById('hostCheatDoubleAnswerPoints')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (player) setHostAnswerMultiplier(player, 2);
});

document.getElementById('hostCheatHalfAnswerPoints')?.addEventListener('click', () => {
  const player = getHostCheatSelectedPlayer();
  if (player) setHostAnswerMultiplier(player, 0.5);
});

document.getElementById('hostCheatRevealAnswer')?.addEventListener('click', revealRandomHostAnswer);

document.getElementById('hostCheatSetQuizName')?.addEventListener('click', () => {
  if (!hostCheatsEnabled) return;
  const titlePrefix = document.getElementById('hostCheatQuizTitlePrefix')?.value.trim();
  const titleSuffix = document.getElementById('hostCheatQuizTitleSuffix')?.value.trim();
  if (!titlePrefix) {
    flash('Voer tekst in voor het logo.');
    return;
  }

  const branding = {
    ...(typeof getBrandingSettings === 'function' ? getBrandingSettings() : {}),
    titlePrefix,
    titleSuffix
  };
  if (typeof gameConfig !== 'undefined') {
    gameConfig ||= {};
    gameConfig.settings ||= {};
    gameConfig.settings.branding = branding;
  }
  sendDisplayUpdate({ type: 'branding_update', branding });
  flash('Quiztekst vóór en ná het logo gewijzigd.');
});

document.getElementById('hostCheatSwapPlayers')?.addEventListener('click', () => {
  if (!hostCheatsEnabled) return;
  const playerA = players.find(player =>
    String(player.index) === document.getElementById('hostCheatSwapPlayerA')?.value);
  const playerB = players.find(player =>
    String(player.index) === document.getElementById('hostCheatSwapPlayerB')?.value);
  if (!playerA || !playerB) return flash('Selecteer twee kandidaten om te wisselen.');
  if (playerA === playerB) return flash('Kies twee verschillende kandidaten.');
  [playerA.name, playerB.name] = [playerB.name, playerA.name];
  [playerA.photoUrl, playerB.photoUrl] = [playerB.photoUrl, playerA.photoUrl];

  renderPlayers();
  flash(`${playerA.name} en ${playerB.name} wisselen van stoel en score.`);
});

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
  if (typeof playSFX === 'function') playSFX('SFX/30.mp3');
  flash(`Quizmaster bonus: iedereen +${seconds} seconden.`);
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
  btn.textContent = `Geef iedereen ${seconds} seconden`;
  btn.addEventListener('click', () => grantPreFinaleBonus(seconds));
  area.appendChild(btn);
  renderPlayers();
}

function highlightActive(){
  flash('Beurt: ' + (players[activePlayerIndex]?players[activePlayerIndex].name:'-'));
}

function stopLoopTimerSFX() {
  
  if (loopTimerAudio) {
    loopTimerAudio = null;
  }
  
  stopLoopSFX('timer');
}

function resetHostTimerSpeed(nextPlayer = null) {
  hostTimerSpeed = 1;
  thinkingTimerTickProgress = 0;
  thinkingTimerPlayer = nextPlayer;
  setLoopSFXPlaybackRate('timer', 1);
  renderHostCheatControls();
}

function activateHostTimerSpeed(player) {
  hostTimerSpeed = pendingHostTimerSpeeds.get(player) ?? 1;
  pendingHostTimerSpeeds.delete(player);
  thinkingTimerTickProgress = 0;
  thinkingTimerPlayer = player;
  setLoopSFXPlaybackRate('timer', hostTimerSpeed);
  renderHostCheatControls();
}

function stopThinkingCountdownTimer(playEndSound = false) {
  if (thinkingTimerInterval) {
    clearInterval(thinkingTimerInterval);
    thinkingTimerInterval = null;
  }

  resetHostTimerSpeed();
  stopLoopTimerSFX();

  if (playEndSound && typeof playSFX === 'function') {
    playSFX('SFX/klokeind.mp3');
  }
}

function startThinkingCountdownTimer(options = {}) {
  const {
    getActivePlayer,
    onTick,
    onTimeout,
    onStartMessage = null,
    startAudio = true
  } = options;

  if (typeof getActivePlayer !== 'function') {
    console.warn('startThinkingCountdownTimer: getActivePlayer ontbreekt of is geen functie.');
    return false;
  }

  stopThinkingCountdownTimer(false);

  const initialPlayer = getActivePlayer();
  if (!initialPlayer) {
    return false;
  }

  activateHostTimerSpeed(initialPlayer);
  activateHostAnswerMultiplier(initialPlayer, getHostQuestionReference());
  if (startAudio) {
    playLoopSFX('SFX/klok2.mp3', 'timer', hostTimerSpeed);
  }

  if (onStartMessage) {
    flash(onStartMessage);
  }

  thinkingTimerInterval = setInterval(() => {
    const activePlayer = getActivePlayer();
    if (!activePlayer) {
      stopThinkingCountdownTimer(false);
      return;
    }

    if (activePlayer !== thinkingTimerPlayer) {
      activateHostTimerSpeed(activePlayer);
      activateHostAnswerMultiplier(activePlayer, getHostQuestionReference());
    }
    thinkingTimerTickProgress += hostTimerSpeed;
    if (thinkingTimerTickProgress < 2) return;
    thinkingTimerTickProgress -= 2;

    activePlayer.seconds = Math.max(0, activePlayer.seconds - 1);

    if (typeof onTick === 'function') {
      onTick(activePlayer);
    }

    if (activePlayer.seconds <= 0) {
      stopThinkingCountdownTimer(false);

      if (typeof onTimeout === 'function') {
        onTimeout(activePlayer);
      }
    }
  }, 500);

  renderHostCheatControls();
  return true;
}

function getStarterOrderByLowestSeconds(maxCount = null) {
  const ordered = players
    .map((p, i) => ({ i, seconds: p.seconds }))
    .sort((a, b) => a.seconds - b.seconds || a.i - b.i)
    .map(p => p.i);

  if (typeof maxCount === 'number' && maxCount > 0) {
    return ordered.slice(0, maxCount);
  }

  return ordered;
}

function shuffleArrayShared(array) {
  const arr = Array.isArray(array) ? array.slice() : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function stopAllTimers(){
  if(globalTimerInterval){ clearInterval(globalTimerInterval); globalTimerInterval=null; }
  stopThinkingCountdownTimer(false);
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
  if (
    roundKey === 'opendeur' &&
    typeof validateOpenDeurVideoThumbnails === 'function' &&
    !validateOpenDeurVideoThumbnails()
  ) {
    return;
  }

  if (typeof window.resetPerspectiveMenuSelection === 'function') {
    window.resetPerspectiveMenuSelection();
  }

  const roundControls = document.getElementById('roundControls');
  if (roundControls) {
    roundControls.innerHTML = '';
  }

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
  perRoundState = { round: roundKey, roundComplete: false };
  currentQuestionIndex = 0;
  activePlayerIndex = 0;
  currentRoundEl.textContent = niceRoundName(roundKey);
  if (typeof window.updatePerspectiveMenu === 'function') {
    window.updatePerspectiveMenu();
  }
  currentQuestionEl.innerHTML = '<em>Ronde gestart — druk op Volgende vraag om te beginnen.</em>';
  hidePresenterScript();
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
  updateRoundNavigationButtons();
  
  
  sendDisplayUpdate({
      type: 'round_start',
      name: niceRoundName(roundKey),
      key: roundKey,
      players,
      activeIndex: activePlayerIndex,
      scene: roundKey === 'puzzel' ? 'scene-round-puzzel-waiting' : undefined
  });
}

function canAdvanceToNextRound() {
  if (!Array.isArray(roundsSequence) || roundsSequence.length === 0) return false;

  const currentKey = roundsSequence[currentRoundIndex];
  const hasNextRound = currentRoundIndex < roundsSequence.length - 1;
  const allowSoloEndScreen = playerModeSettings.playerCount === 1 && currentKey === 'collectief';

  return hasNextRound || allowSoloEndScreen;
}

function updateRoundNavigationButtons() {
  const startRoundBtn = document.getElementById('startRound');
  const nextRoundBtn = document.getElementById('nextRound');
  if (!startRoundBtn || !nextRoundBtn) return;

  const expectedCount = playerModeSettings.playerCount;
  const hasValidPlayers = players.length === expectedCount && players.length > 0;
  const hasStartedRound = !!(perRoundState && perRoundState.round);

  if (!safeRoundNavigationEnabled) {
    startRoundBtn.style.display = '';
    nextRoundBtn.style.display = '';
    startRoundBtn.disabled = !hasValidPlayers;
    nextRoundBtn.disabled = !hasValidPlayers;
    return;
  }

  const canStartFirstRound = hasValidPlayers && !hasStartedRound;
  const hasPendingCollectiefTieBreak = perRoundState?.collectief?.tieBreakPending === true;
  const canGoNext = hasValidPlayers && hasStartedRound && perRoundState.roundComplete === true &&
    !hasPendingCollectiefTieBreak && canAdvanceToNextRound();

  startRoundBtn.style.display = canStartFirstRound ? '' : 'none';
  nextRoundBtn.style.display = canGoNext ? '' : 'none';
  startRoundBtn.disabled = !canStartFirstRound;
  nextRoundBtn.disabled = !canGoNext;
}

function markCurrentRoundComplete() {
  if (!perRoundState || !perRoundState.round) return;
  perRoundState.roundComplete = true;
  roundRunning = false;
  updateRoundNavigationButtons();
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
  if (!roundRunning) {
    flash('Er loopt geen actieve ronde.');
    return;
  }
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
  pendingHostTimerSpeeds.clear();
  pendingHostAnswerMultipliers.clear();
  activeHostAnswerMultipliers.clear();

  
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
  perRoundState = {};
  roundRunning = false;
  currentRoundIndex = 0;
  currentRoundEl.textContent = '—';
  updateRoundNavigationButtons();
  if (typeof window.resetPerspectiveMenuSelection === 'function') {
    window.resetPerspectiveMenuSelection();
  }

  sendDisplayUpdate({
      type: 'scene_change',
      scene: 'lobby',
      players: players 
  });
  sendDisplayUpdate({ type: 'universal_perspective', fullscreenLobby: false, playerIndex: null });

  if (!showPresenterScriptForPhase('lobbyBeforeThreeSixNine')) {
    hidePresenterScript();
  }
  
  window.dispatchEvent(new Event('slimstemens:game-started'));
  const modeText = playerCountSelect === 1 ? `${questionsPerRound} vraag/vragen per ronde` : '';
  flash(`Spel aangemaakt met ${playerCountSelect} speler(s) ${modeText} — klaar om te starten`);
});


document.getElementById('resetBtn').addEventListener('click', ()=>{
  window.dispatchEvent(new Event('slimstemens:game-reset'));
  pendingHostTimerSpeeds.clear();
  pendingHostAnswerMultipliers.clear();
  activeHostAnswerMultipliers.clear();
  players = [];
  renderPlayers();
  currentRoundIndex = 0;
  perRoundState = {};
  roundRunning = false;
  currentRoundEl.textContent = '—';
  currentQuestionEl.innerHTML = '<em>Spel gereset</em>';
  if (typeof window.resetPerspectiveMenuSelection === 'function') {
    window.resetPerspectiveMenuSelection();
  }
  sendDisplayUpdate({ type: 'universal_perspective', fullscreenLobby: false, playerIndex: null });
  hidePresenterScript();
  stopAllTimers();
  updateRoundNavigationButtons();
  flash('Spel gereset');
});


document.getElementById('startRound').addEventListener('click', ()=>{
  const expectedCount = playerModeSettings.playerCount;
  if(players.length !== expectedCount){ 
    flash(`Maak eerst het spel aan met ${expectedCount} kandidaat/kandidaten`); 
    return; 
  }
  if (safeRoundNavigationEnabled && perRoundState?.round) {
    flash('Veilige modus: gebruik pas "Volgende ronde" nadat de huidige ronde is afgerond.');
    return;
  }
  currentRoundIndex = currentRoundIndex % roundsSequence.length;
  startRound(roundsSequence[currentRoundIndex]);
});

document.getElementById('nextRound').addEventListener('click', ()=>{
  const expectedCount = playerModeSettings.playerCount;
  if (players.length !== expectedCount || players.length === 0) {
    flash(`Maak eerst het spel aan met ${expectedCount} kandidaat/kandidaten`);
    updateRoundNavigationButtons();
    return;
  }

  if (perRoundState?.collectief?.tieBreakPending === true) {
    flash('Bepaal eerst de afvaller of de Slimste van de Dag.');
    return;
  }

  if (safeRoundNavigationEnabled && (!perRoundState?.round || perRoundState.roundComplete !== true)) {
    flash('Veilige modus: deze ronde is nog niet klaar om door te gaan.');
    return;
  }

  // Bij 1 speler en einde van collectief: toon eindstand
  if (playerModeSettings.playerCount === 1 && 
      currentRoundIndex < roundsSequence.length && 
      roundsSequence[currentRoundIndex] === 'collectief') {
    if (typeof window.resetPerspectiveMenuSelection === 'function') {
      window.resetPerspectiveMenuSelection();
    }

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

const safeRoundNavigationCheckbox = document.getElementById('safeRoundNavigationCheckbox');
if (safeRoundNavigationCheckbox) {
  safeRoundNavigationCheckbox.addEventListener('change', (event) => {
    safeRoundNavigationEnabled = !!event.target.checked;
    updateRoundNavigationButtons();
    flash(
      safeRoundNavigationEnabled
        ? 'Veilige rondeknoppen ingeschakeld.'
        : 'Veilige rondeknoppen uitgeschakeld.'
    );
  });
}

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

const goedBtn = document.getElementById('playGoed');
if (goedBtn) {
  goedBtn.addEventListener('click', () => {
    sendDisplayUpdate({ type: 'audio', action: 'play', src: 'SFX/goed.mp3' });
  });
}

const klokBtn = document.getElementById('playKlok');
if (klokBtn) {
  klokBtn.addEventListener('click', () => {
    playLoopSFX('SFX/klok2.mp3', 'timer');
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

const klokEindBtn = document.getElementById('playKlokEind');
if (klokEindBtn) {
  klokEindBtn.addEventListener('click', () => {
    playSFX('SFX/klokeind.mp3');
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
  const introPerspectives = {
    'introPerspectiveFull': 'full',
    'introPerspectiveCand1': 'cand1',
    'introPerspectiveCand2': 'cand2',
    'introPerspectiveCand3': 'cand3'
  };
  let activeIntroPerspective = 'full';
  const updateIntroPerspectiveButtons = () => {
    for (const [btnId, perspective] of Object.entries(introPerspectives)) {
      document.getElementById(btnId)?.setAttribute(
        'aria-pressed',
        String(activeIntroPerspective === perspective)
      );
    }
  };

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
      activeIntroPerspective = 'full';
      updateIntroPerspectiveButtons();
      
      // Toon intro script voor presentator
      const introScriptArea = document.getElementById('introScriptArea');
      const introScriptTitle = document.getElementById('introScriptTitle');
      const introScriptText = document.getElementById('introScriptText');
      if (introScriptArea && introScriptText) {
        if (finalIntroText) {
          if (introScriptTitle) {
            introScriptTitle.textContent = 'Presentatorscript - Intro';
          }
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
  for (const [btnId, perspective] of Object.entries(introPerspectives)) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', function() {
        activeIntroPerspective =
          activeIntroPerspective === perspective && perspective !== 'full'
            ? 'full'
            : perspective;
        updateIntroPerspectiveButtons();
        console.log(`🔄 Perspectief wissel naar: ${activeIntroPerspective}`);
        sendDisplayUpdate({ 
          type: 'intro_perspective',
          perspective: activeIntroPerspective
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
      activeIntroPerspective = 'full';
      updateIntroPerspectiveButtons();
      
      // Verberg intro script
      const introScriptArea = document.getElementById('introScriptArea');
      if (introScriptArea) {
        introScriptArea.style.display = 'none';
      }

      showPresenterScriptForPhase('lobbyBeforeThreeSixNine');
      
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
updateRoundNavigationButtons();
console.log('Core.js geladen — basisfunctionaliteit actief');

function shouldIgnoreHotkeys(event) {
  if (event.ctrlKey || event.altKey || event.metaKey) return true;
  const target = event.target;
  if (!target) return false;
  const tag = target.tagName ? target.tagName.toLowerCase() : '';
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function handleRoundHotkey(key) {
  if (!roundRunning) return false;
  if (!perRoundState || !perRoundState.round) return false;

  const round = perRoundState.round;
  const numberIndex = /^[1-9]$/.test(key) ? parseInt(key, 10) - 1 : null;

  if (key === 'n' && typeof nextQuestion === 'function') {
    nextQuestion();
    return true;
  }

  if (key === 't') {
    if (round === 'opendeur') {
      if (perRoundState?.openDeurAwaitingReturn || !perRoundState?.currentQuestion) return false;
      if (typeof startOpenDeurTimer === 'function') { startOpenDeurTimer(); return true; }
      return false;
    }
    if (round === 'puzzel' && typeof startPuzzelTimer === 'function') { startPuzzelTimer(); return true; }
    if (round === 'galerij' && typeof startGalerijTimer === 'function') { startGalerijTimer(); return true; }
    if (round === 'collectief' && typeof startCollectiefTimer === 'function') { startCollectiefTimer(); return true; }
    if (round === 'finale' && typeof startFinaleTimer === 'function') { startFinaleTimer(); return true; }
  }

  if (key === 'k' && round === 'threeSixNine' && typeof klok369_toggleLoop === 'function') {
    klok369_toggleLoop();
    return true;
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
    if (round === 'opendeur') {
      if (perRoundState?.openDeurAwaitingReturn || !perRoundState?.currentQuestion) return false;
      if (typeof passOpenDeur === 'function') { passOpenDeur(); return true; }
      return false;
    }
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

  if (round === 'threeSixNine' && perRoundState.currentQuestion && typeof getThreeSixNineMediaUrls === 'function') {
    const questionMedia = getThreeSixNineMediaUrls(perRoundState.currentQuestion, 'question');
    const afterMedia = getThreeSixNineMediaUrls(perRoundState.currentQuestion, 'after');

    if (key === 'q' && questionMedia?.photoUrl && typeof toggleThreeSixNinePhoto === 'function') {
      toggleThreeSixNinePhoto('question');
      return true;
    }
    if (key === 'w' && questionMedia?.audioUrl && typeof playThreeSixNineAudio === 'function') {
      playThreeSixNineAudio('question');
      return true;
    }
    if (key === 'e' && questionMedia?.videoUrl && typeof playThreeSixNineVideo === 'function') {
      playThreeSixNineVideo('question');
      return true;
    }
    if (key === 'a' && afterMedia?.photoUrl && typeof toggleThreeSixNinePhoto === 'function') {
      toggleThreeSixNinePhoto('after');
      return true;
    }
    if (key === 's' && afterMedia?.audioUrl && typeof playThreeSixNineAudio === 'function') {
      playThreeSixNineAudio('after');
      return true;
    }
    if (key === 'd' && afterMedia?.videoUrl && typeof playThreeSixNineVideo === 'function') {
      playThreeSixNineVideo('after');
      return true;
    }
  }

  if (round === 'galerij') {
    if (key === 'arrowleft' && galleryPhase === 'slideshow' && typeof showPreviousSlideshow === 'function') {
      showPreviousSlideshow();
      return true;
    }

    if (key === 'arrowright' && galleryPhase === 'slideshow' && typeof showNextSlideshow === 'function') {
      showNextSlideshow();
      return true;
    }

    if (key === 'b' && galleryPhase === 'slideshow' && typeof forceSlideshowPhaseOnDisplay === 'function') {
      forceSlideshowPhaseOnDisplay();
      return true;
    }

    if (key === 's') {
      if (galleryPhase === 'pre' && typeof startGalerijForPlayer === 'function') {
        startGalerijForPlayer(galleryPlayerIndex);
        return true;
      }

      const hasNextGalerijStarter = Array.isArray(galerijStarterOrder) && (galerijStarterTurn + 1) < galerijStarterOrder.length;
      if ((galleryPhase === 'slideshow' || galleryPhase === 'done') && hasNextGalerijStarter && typeof startNextGalerijStarter === 'function') {
        startNextGalerijStarter();
        return true;
      }
    }
  }

  if (key === 'r' && round === 'opendeur' && typeof returnToOpenDeurQuestioners === 'function') {
    const hasReturnButton = !!document.querySelector('#roundControls .highlight-return');
    if (hasReturnButton) {
      returnToOpenDeurQuestioners();
      return true;
    }
  }

  if (key === 'v' && round === 'collectief' && typeof startCollectiefVideo === 'function') {
    if (perRoundState?.collectief?.hostPhase === 'pre') {
      startCollectiefVideo();
      return true;
    }
  }

  if (numberIndex !== null) {
    if (round === 'opendeur') {
      if (perRoundState?.openDeurAwaitingReturn) return false;
      if (!perRoundState?.currentQuestion && typeof chooseOpenDeurQuestion === 'function') {
        const remainingQuestions = (perRoundState?.questions || []).filter((q) => !q.played);
        if (numberIndex < remainingQuestions.length) {
          const chosenQuestion = remainingQuestions[numberIndex];
          const questionIndex = perRoundState.questions.indexOf(chosenQuestion);
          if (questionIndex !== -1) {
            chooseOpenDeurQuestion(questionIndex);
            return true;
          }
        }
      }

      if (typeof markOpenDeurAnswer === 'function') {
        const answers = perRoundState?.currentQuestion?.answersDisplay || [];
        if (numberIndex < answers.length) {
          markOpenDeurAnswer(numberIndex);
          return true;
        }
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
    if (typeof window.dismissScoreboard === 'function') window.dismissScoreboard();
  }
});
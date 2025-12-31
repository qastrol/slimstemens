let currentScene = null;
let players = [];
let defaultThreeSixNineMax = 12;
let perRoundState = { max: defaultThreeSixNineMax };
let allGalleryAnswers = []; // Bevat { text, found } voor huidige galerij

function updateScene(sceneName) {
    document.querySelectorAll('.scene').forEach(s => {
        s.style.display = (s.id === `scene-${sceneName}`) ? 'flex' : 'none';
    });
    currentScene = sceneName;
}

/* === WebSocket logic === */
const WS_ADDRESS = 'ws://127.0.0.1:8081/';
let ws = null;
// Audio gate voor autoplay policies
let __displayLoopAudio = null;
let __audioUnlocked = false;
let __lastAudioCmd = null; // Onthoud laatste audio-opdracht om opnieuw te proberen na unlock

function __showAudioUnlockBanner() {
  if (__audioUnlocked) return;
  if (document.getElementById('audioUnlockBanner')) return;
  const el = document.createElement('div');
  el.id = 'audioUnlockBanner';
  el.textContent = 'Klik hier of ergens op het scherm om audio te activeren';
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.top = '10px';
  el.style.transform = 'translateX(-50%)';
  el.style.background = 'rgba(0,0,0,0.7)';
  el.style.color = '#fff';
  el.style.padding = '8px 12px';
  el.style.borderRadius = '6px';
  el.style.zIndex = '9999';
  el.style.cursor = 'pointer';
  el.addEventListener('click', __unlockAudio, { once: true });
  document.body.appendChild(el);
}

function __unlockAudio() {
  __audioUnlocked = true;
  const el = document.getElementById('audioUnlockBanner');
  if (el) el.remove();
  // Probeer laatste audio-opdracht te herhalen
  if (__lastAudioCmd) {
    const cmd = __lastAudioCmd;
    __lastAudioCmd = null;
    handleAudioMessage(cmd);
  }
}

// Elke interactie kan de audio ontgrendelen
document.addEventListener('click', __unlockAudio, { once: true });
document.addEventListener('keydown', __unlockAudio, { once: true });

function connectWebSocket() {
  updateScene('no-connection');
  ws = new WebSocket(WS_ADDRESS);

  ws.onopen = () => updateScene('waiting-host');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      /* === AUDIO CONTROLES VAN HOST === */
      case 'audio':
        handleAudioMessage(data);
        break;
      /* === INIT / LOBBY === */
      case 'init':
        updateScene('waiting-game');
        break;

      case 'scene_change':
        if (data.scene === 'lobby') {
          if (data.players) players = data.players;
          updateScene('lobby');
          renderLobby(players);
        }
        break;

      case 'players':
        players = data.players;
        if (data.round && data.round !== 'lobby') break;
        updateScene('lobby');
        renderLobby(players);
        break;

      /* === RONDE START === */
      case 'round_start':
        // 3-6-9 ronde
        if (data.key === 'threeSixNine') {
          updateScene('round-369');
          perRoundState.max = data.maxQuestions;
          renderMiniLobby(players, 'miniLobbyPlayers');
          renderPlayersBarUniversal();
          document.getElementById('roundName').textContent = data.name;
          document.getElementById('roundStatus').textContent = 'Druk op “Volgende vraag” om te beginnen.';
          document.getElementById('roundQuestion').textContent = '—';
          break;
        }

        // Open Deur ronde
        if (data.key === 'opendeur') {
          if (data.scene === 'scene-round-opendeur-lobby') {
            updateScene('round-opendeur-lobby');
            renderOpenDeurLobby(data);
          } else if (data.scene === 'scene-round-opendeur-vragensteller') {
            updateScene('round-opendeur-vragensteller');
            renderOpenDeurVragensteller(data);
          }
          break;
        }

        // 🧩 Puzzelronde
        if (data.key === 'puzzel') {
          handlePuzzelDisplayUpdate(data);
          break;
        }

        // 🖼️ Galerijronde
if (data.key === 'galerij') {
    // Als de ronde nog niet gestart is door de host, toon pre-scherm
    if (!data.started) { 
        data.scene = 'scene-round-galerij-pre';
    } else {
        data.scene = 'scene-round-galerij-main';
    }
    handleGalerijDisplayUpdate(data);
    break;
}

/* === Audio afhandeling op display === */
function handleAudioMessage(data) {
  try {
    if (data.action === 'play' && data.src) {
      const a = new Audio(data.src);
      a.currentTime = 0;
      a.play().catch((err) => {
        __lastAudioCmd = data;
        __showAudioUnlockBanner();
      });
      return;
    }
    if (data.action === 'loopStart' && data.src) {
      if (__displayLoopAudio) {
        try { __displayLoopAudio.pause(); } catch(e) {}
      }
      __displayLoopAudio = new Audio(data.src);
      __displayLoopAudio.loop = true;
      __displayLoopAudio.currentTime = 0;
      __displayLoopAudio.play().catch((err) => {
        __lastAudioCmd = data;
        __showAudioUnlockBanner();
      });
      return;
    }
    if (data.action === 'loopStop') {
      if (__displayLoopAudio) {
        try {
          __displayLoopAudio.pause();
          __displayLoopAudio.currentTime = 0;
        } catch(e) {}
        __displayLoopAudio = null;
      }
      return;
    }
  } catch (e) {
    // zwijgzaam falen om stream niet te storen
  }
}

      // 🧠 Collectief Geheugen
      if (data.key === 'collectief') {
        data.scene = 'scene-round-collectief-pre';
        handleCollectiefDisplayUpdate(data);
        break;
      }

      // 🏆 Finale
      if (data.key === 'finale') {
        handleFinaleDisplayUpdate(data);
        break;
      }

        break;

      /* === ALGEMENE UPDATES === */
      case 'update':
        if (data.players) players = data.players;

        // 3-6-9 ronde
        if (data.currentRoundName === 'threeSixNine' || data.scene === 'round-369') {
          if (currentScene !== 'round-369') updateScene('round-369');
          if (data.maxQuestions) perRoundState.max = data.maxQuestions;
          renderThreeSixNine(data);
          if (data.action === 'answer') {
            const msg = data.isRight ? 'GOED!' : 'FOUT!';
            flashDisplayMessage(msg, data.isRight ? 'good' : 'wrong');
          }
          break;
        }

        // Open Deur ronde
        if (data.key === 'opendeur') {
          if (data.scene === 'scene-round-opendeur-lobby') {
            updateScene('round-opendeur-lobby');
            renderOpenDeurLobby(data);
          } else if (data.scene === 'scene-round-opendeur-vragensteller') {
            updateScene('round-opendeur-vragensteller');
            renderOpenDeurVragensteller(data);
          } else if (data.scene === 'scene-round-opendeur-vraag') {
            updateScene('round-opendeur-vraag');
            renderOpenDeurVraag(data);
            if (data.questionCompleted) {
              flashDisplayMessage('Vraag volledig opgelost!', 'good');
            }
          }
          renderPlayersBarUniversal(players, data.activeIndex);
          break;
        }

        // 🧩 Puzzelronde updates
        if (data.key === 'puzzel') {
          handlePuzzelDisplayUpdate(data);
          break;
        }

        // 🖼️ Galerijronde updates
        if (data.key === 'galerij') {
          handleGalerijDisplayUpdate(data);
          break;
        }

          // 🧠 Collectief Geheugen updates
          if (data.key === 'collectief') {
            handleCollectiefDisplayUpdate(data);
            break;
          }

          // 🏆 Finale updates
          if (data.key === 'finale') {
            handleFinaleDisplayUpdate(data);
            break;
          }

        // Terug naar lobby (veilig fallback)
        if (data.scene === 'lobby') {
          updateScene('lobby');
          renderLobby(players);
        }
        break;

      /* === EINDE RONDE === */
      case 'round_end':
        // Check of dit de Finale is (dan speciale afhandeling)
        if (data.key === 'finale') {
          handleFinaleDisplayUpdate(data);
        } else {
          // Voor alle andere rondes: terug naar wachtscherm
          updateScene('waiting-game');
        }
        break;
    }
  };

  ws.onclose = () => {
    updateScene('no-connection');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => updateScene('no-connection');
}




function renderMiniLobby(players, containerId){
    const el = document.getElementById(containerId);
    if(!el) return;
    el.innerHTML = players.map(p => `<div class="player"><img src="${p.photoUrl || 'assets/avatar.png'}"></div>`).join('');
}

function renderLobby(players){
    const container = document.getElementById('lobbyPlayerImages');
    if(!container) return;
    container.innerHTML = players.map(p => `<div class="lobby-photo"><img src="${p.photoUrl || 'assets/avatar.png'}"><div>${p.name}</div></div>`).join('');
}

// === UNIVERSELE FUNCTIE VOOR SPELERSBALK EN VRAAGNUMMERS (voor 3-6-9) ===
// Deze functie is universeel, maar is geoptimaliseerd voor 3-6-9
function renderPlayersBarUniversal(currentQuestionIndex = null, activeIndex = null, containerId = 'playersBarContainer'){
    const container = document.getElementById(containerId);
    if(!container || !players) return;

    container.innerHTML = players.map((p,i)=>`
        <div class="player-card${activeIndex!==null && i===activeIndex ? ' active-player' : ''}">
            <div class="player-name">${p.name}</div>
            <div class="player-seconds"><div class="big-timer">${p.seconds}</div></div>
        </div>
    `).join('');

    // Vraagnummers (alleen voor 3-6-9, dus alleen de default container updaten)
    if(containerId === 'playersBarContainer'){
        const qContainer = document.getElementById('questionNumbersContainer');
        // Gebruik perRoundState.max, die in de update en round_start wordt gezet
        if(qContainer && perRoundState.max){ 
            qContainer.innerHTML = Array.from({length: perRoundState.max}, (_, i) => `
                <div class="${currentQuestionIndex===i?'current':''}">${i+1}</div>
            `).join('');
        }
    }
}


function renderThreeSixNine(data){
    const roundStatusEl = document.getElementById('roundStatus');
    const roundQuestionEl = document.getElementById('roundQuestion');
    const questionNumbersContainer = document.getElementById('questionNumbersContainer');

    // Controleer of de ronde voorbij is
    const rondeEinde = !data.currentQuestionDisplay || data.currentQuestionIndex > data.maxQuestions;

    if (rondeEinde) {
        // ✅ Ronde is afgelopen
        roundStatusEl.textContent = "Einde van deze ronde";
        roundQuestionEl.textContent = ""; // Vraag verdwijnt
        if (questionNumbersContainer) questionNumbersContainer.innerHTML = ""; // Vraagnummers verdwijnen
    } else {
        // Normale weergave tijdens de ronde
        const qText = data.currentQuestionDisplay || "—";
        const activePlayerName = data.activePlayer || '-';

        roundStatusEl.textContent = `Beurt: ${activePlayerName} | Vraag ${data.currentQuestionIndex} van ${data.maxQuestions}`;
        roundQuestionEl.innerHTML = `<div>${qText}</div>`;

        // Vraagnummers blijven zichtbaar
        renderPlayersBarUniversal(data.currentQuestionIndex - 1, data.activeIndex);
    }

    // Mini-lobby altijd zichtbaar
    renderMiniLobby(data.players, 'miniLobbyPlayers');
}


// ===== OPEN DEUR RONDE RENDERING =====

// Scène 1: Open Deur Lobby (Wachten op start)
function renderOpenDeurLobby(data) {
    // Update de status tekst.
    if (data.statusText) {
        document.getElementById('opendeurLobbyStatus').textContent = data.statusText;
    }
    // Hergebruik van de algemene lobby rendering voor de foto's.
    renderLobby(data.players, 'lobbyPlayerImagesOd'); 
}

function renderOpenDeurVragensteller(data) {
    const container = document.getElementById('vragenstellersContainer');
    if (!container || !data.questioners) return;

    // 1️⃣ Mini-lobby met highlight
    renderMiniLobby(data.players, 'odVragenstellerMiniLobby');
    const miniLobby = document.getElementById('odVragenstellerMiniLobby');
    if (miniLobby && data.activeChoosingPlayerIndex !== undefined) {
        const playerEls = miniLobby.querySelectorAll('.player');
        playerEls[data.activeChoosingPlayerIndex]?.classList.add('active-player');
    }

    // 2️⃣ Status tekst rechtsboven
    const statusEl = document.querySelector('#scene-round-opendeur-vragensteller .round-status');
    if (data.activeChoosingPlayer) {
        statusEl.textContent = `Beurt: ${data.activeChoosingPlayer}`;
    } else {
        statusEl.textContent = `Kiest nu...`;
    }

    // 3️⃣ Lijst van vragenstellers tonen
    container.innerHTML = data.questioners.map(q => `
        <div class="vragensteller-box${q.isChosen ? ' gespeeld' : ' beschikbaar'}">
            <div class="vragensteller-name">${q.name}</div>
            ${q.isChosen ? '<div class="status-label">GESPEELD</div>' : ''}
        </div>
    `).join('');

    renderPlayersBarCompact(data.players, data.activeChoosingPlayerIndex, 'od-vragensteller-scores');
}




/**
 * Rendert Scène 3: Vraag en Antwoorden voor de Open Deur-ronde.
 * Implementeert de compacte timers in het vlak rechtsonder.
 */
function renderOpenDeurVraag(data) {
    if (!data.currentQuestion) return;

    const { from, answers } = data.currentQuestion;
    const container = document.getElementById('odAnswerContainer');
    if (!container) return;

    // 1. Antwoorden (Linkerhelft)
    container.innerHTML = answers.map(a => {
        // Vervang letters door blokken om lengte af te leiden voor niet-geraden antwoorden.
        const displayText = a.isAnswered ? a.text : a.text.replace(/./g, '█');
        const points = data.currentQuestion.timeGain || 20;
        
        return `
            <div class="od-answer-line${!a.isAnswered ? ' unguessed' : ''}">
                <div class="od-answer-text${!a.isAnswered ? ' blurred' : ''}">
                    ${displayText}
                </div>
                ${a.isAnswered ? `<div class="od-answer-points"><span>${points}</span></div>` : ''}
            </div>
        `;
    }).join('');

    // 2. Statusbalk (Rechteronderkwart - Vragensteller Info)
document.getElementById('od-beurt-info').textContent = `Beurt: ${data.activeAnsweringPlayer}`;
document.getElementById('od-vragensteller-vraag').textContent = `Vraag van ${from}: "${data.currentQuestion.questionText}"`;
document.getElementById('od-antwoord-teller').textContent = `Geraden Antwoorden: ${data.guessedAnswers} van ${data.totalAnswers}`;

    // 3. Mini Lobby (Rechterbovenkwart)
    // Mini lobby toont de actieve speler die NU aan het antwoorden is.
    renderMiniLobby(data.players, 'odVraagMiniLobby', data.activeAnsweringPlayerIndex);

    // 4. Spelersbalk/Timers onderaan rechterhelft (NIEUWE LOGICA)
    const timerBarContainer = document.getElementById('od-vraag-scores'); // <- juiste container
    if (timerBarContainer) {
        timerBarContainer.innerHTML = data.players.map(p => {
            const isActive = p.isActive ? ' active-player' : '';
            return `
                <div class="player-card${isActive}">
                    <div class="player-name">${p.name}</div>
                    <div class="player-seconds"><div class="big-timer">${p.seconds}</div></div>
                </div>
            `;
        }).join('');
    }
}


function flashDisplayMessage(text, type){
    const msg = document.getElementById('flashMessage');
    if(!msg) return;
    msg.textContent = text;
    msg.className = type; // CSS class good/wrong
    msg.style.display = 'block';
    setTimeout(()=>{ msg.style.display='none'; }, 1200);
}

function renderPlayersBarCompact(players, activeIndex, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !players) return;

    container.innerHTML = players.map((p, i) => `
        <div class="player-card${i === activeIndex ? ' active-player' : ''}">
            <div class="player-name">${p.name}</div>
            <div class="player-seconds">${p.seconds}</div>
        </div>
    `).join('');
}

// Zoek en VERVANG de *gehele* functie 'handlePuzzelDisplayUpdate'

// Zoek en VERVANG de *gehele* functie 'handlePuzzelDisplayUpdate'

function handlePuzzelDisplayUpdate(data) {
    const playersData = data.players || [];
    const activeIndex = data.activeIndex ?? -1;

    if (data.scene === 'scene-round-puzzel-active') {
        updateScene('round-puzzel-active');

        // --- Rechterkant (geen wijziging) ---
        renderMiniLobby(playersData, 'puzzelActiveMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelActivePlayersBar');

        const puzzelRoundInfoEl = document.getElementById('puzzelRoundInfo');
        if (data.statusText) {
            puzzelRoundInfoEl.innerHTML = `
                <div class="round-name">Puzzelronde</div>
                <div class="round-status" style="color: #ffd17a; font-size: 1.2em;">${data.statusText}</div>
            `;
        } else {
            puzzelRoundInfoEl.innerHTML = `
                <div class="round-name">Puzzel ${data.currentPuzzelIndex} van ${data.maxPuzzles}</div>
                <div class="round-status">Beurt: ${data.currentTurnPlayer}</div>
            `;
        }
        
        // --- Linkerkant (AANGEPAST) ---

        // 1. Woordenlijst in tabel tonen (met kleurcodering)
        const puzzelTableEl = document.getElementById('puzzelTable');
        if (data.puzzelWords && data.puzzelWords.length > 0) {
            puzzelTableEl.innerHTML = data.puzzelWords
                .map(w => {
                    // w is nu {text: '...', found: true/false, linkIndex: 0/1/2/null}
                    let classes = 'puzzel-word';
                    if (w.found) {
                        classes += ' found';
                        if (w.linkIndex !== null) {
                            classes += ` found-link-${w.linkIndex}`; // bv: found-link-0
                        }
                    }
                    return `<div class="${classes}">${w.text}</div>`;
                })
                .join('');
            puzzelTableEl.style.transition = 'opacity 0.3s ease';
            puzzelTableEl.style.opacity = 1;
        } else {
            // Geen woorden (tussen puzzels in) -> fade uit
            // puzzelTableEl.style.opacity = 0;
            // setTimeout(() => { puzzelTableEl.innerHTML = ''; }, 300);
        }

        // 2. Gevonden links tonen (onder de tabel)
        const puzzelLinksEl = document.getElementById('puzzelLinksContainer');
        if (puzzelLinksEl) {
            // data.puzzelLinks is een nieuwe array die we meesturen vanuit de host
            if (data.puzzelLinks && data.puzzelLinks.length > 0) {
                puzzelLinksEl.innerHTML = data.puzzelLinks
                    .map(link => {
                        // link is {link: '...', found: true/false, timeGain: 30}
                        const displayText = link.found ? link.link : link.link.replace(/./g, '█');
                        const points = link.timeGain || 30;

                        return `
                            <div class="puzzel-link-line${!link.found ? ' unguessed' : ''}">
                                <div class="puzzel-link-text${!link.found ? ' blurred' : ''}">
                                    ${displayText}
                                </div>
                                ${link.found ? `<div class="puzzel-link-points"><span>${points}</span></div>` : ''}
                            </div>
                        `;
                    })
                    .join('');
                puzzelLinksEl.style.transition = 'opacity 0.3s ease';
                puzzelLinksEl.style.opacity = 1;
            } else {
                // Geen links (tussen puzzels in) -> fade ook uit
                // puzzelLinksEl.style.opacity = 0;
                //setTimeout(() => { puzzelLinksEl.innerHTML = ''; }, 300);
            }
        }

    } else if (data.scene === 'scene-round-puzzel-waiting') {
        updateScene('round-puzzel-waiting');
        renderMiniLobby(playersData, 'puzzelWaitingMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelWaitingPlayersBar');
    } 
    else if (data.scene === 'scene-round-puzzel-done') {
        updateScene('scene-round-puzzel-done');
        renderMiniLobby(playersData, 'puzzelDoneMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelDonePlayersBar');
    }
}

function handleGalerijDisplayUpdate(data) {
  const playersData = data.players || [];
  const activeIndex = data.activeIndex ?? -1;

  // Scene bepalen
  let sceneToShow = data.scene;
  if (!sceneToShow && data.keyPhase) {
    const phaseMap = {
      pre: 'scene-round-galerij-pre',
      main: 'scene-round-galerij-main',
      aanvul: 'scene-round-galerij-aanvul',
      slideshow: 'scene-round-galerij-slideshow',
      done: 'scene-round-galerij-done'
    };
    sceneToShow = phaseMap[data.keyPhase] || 'scene-round-galerij-pre';
  }
  if (!sceneToShow) sceneToShow = 'scene-round-galerij-pre';

  // Strip "scene-" prefix
  const sceneId = sceneToShow.replace(/^scene-/, '');
  updateScene(sceneId);

  switch (sceneToShow) {
    /* === PRE === */
    case 'scene-round-galerij-pre': {
      // Zorg dat we altijd players hebben, gebruik global players als fallback
      const displayPlayers = playersData.length > 0 ? playersData : players;
      
      renderMiniLobby(displayPlayers, 'galerijPreMiniLobby');
      renderPlayersBarCompact(displayPlayers, activeIndex, 'galerijPrePlayersBar');

      break;
    }

    /* === MAIN === */
    case 'scene-round-galerij-main': {
      const imgContainer = document.getElementById('galerijMainImageContainer');
      if (imgContainer) {
        imgContainer.innerHTML = data.imageSrc
          ? `<img src="${data.imageSrc}" alt="Galerijfoto" style="max-width:100%;border-radius:12px;">`
          : '<div style="padding:2rem;">Geen afbeelding beschikbaar</div>';
      }
      renderMiniLobby(playersData, 'galerijMainMiniLobby');
      const infoContainer = document.getElementById('galerijMainInfoContainer');
      if (infoContainer) {
        infoContainer.innerHTML = `
          <div class="round-name">Galerij</div>
          <div class="round-image">Afbeelding ${data.imageIndex + 1 || 1} van ${data.totalImages || 0}</div>
          <div class="round-status">Beurt van ${data.activePlayer?.name || '-'}</div>
          <div id="galerijMainPlayersBar" class="players-bar-compact"></div>
        `;
      }
      renderPlayersBarCompact(playersData, activeIndex, 'galerijMainPlayersBar');

      break;
    }

    /* === AANVUL === */
    case 'scene-round-galerij-aanvul': {
      updateScene('round-galerij-aanvul');
      const answersContainer = document.getElementById('galerijAanvulAnswers');
      const maxPoints = 15;

      if (answersContainer && data.answers) {
        answersContainer.innerHTML = data.answers.map(a => {
          const revealed = a.found || a.isFound || false;
          const displayText = revealed ? a.text : a.text.replace(/./g, '█');
          const points = a.points || maxPoints;

          return `
            <div class="answer-line ${revealed ? 'found' : 'unfound'}">
              <div class="answer-points">
                  ${revealed ? `<span>${points}</span>` : ''}
              </div>
              <div class="answer-text ${revealed ? '' : 'blurred'}">
                ${displayText}
              </div>
            </div>
          `;
        }).join('');
      }

      renderMiniLobby(playersData, 'galerijAanvulMiniLobby');
      renderPlayersBarCompact(playersData, activeIndex, 'galerijAanvulPlayersBar');


      const infoEl = document.getElementById('galerijAanvulInfo');
      if (infoEl) {
        // Tel hoeveel antwoorden nog niet gevonden zijn
        const totalAnswers = data.answers ? data.answers.length : 0;
        const foundAnswers = data.answers ? data.answers.filter(a => a.found || a.isFound).length : 0;
        const remainingAnswers = totalAnswers - foundAnswers;
        
        infoEl.innerHTML = `
          <div class="round-status">Aanvulbeurt: ${data.activePlayer?.name || '-'}</div>
          <div class="round-status" style="font-size: 1.8em; margin-top: 15px; color: #ffd17a;">
            Nog ${remainingAnswers} van ${totalAnswers} antwoorden te vinden
          </div>
        `;
      }
      break;
    }

    /* === SLIDESHOW === */
    case 'scene-round-galerij-slideshow': {
      const imgContainer = document.getElementById('galerijSlideshowImageContainer');
      if (imgContainer) {
        imgContainer.innerHTML = data.imageSrc
          ? `<img src="${data.imageSrc}" alt="Bespreekafbeelding" style="max-width:100%;border-radius:12px;">`
          : '<div style="padding:2rem;">Geen afbeelding beschikbaar</div>';
      }
      
      // Toon het antwoord onder de afbeelding
      const answerContainer = document.getElementById('galerijSlideshowAnswerContainer');
      if (answerContainer && data.imageAnswer) {
        answerContainer.innerHTML = `<div class="galerij-slideshow-answer-text">${data.imageAnswer}</div>`;
      }
      
      renderMiniLobby(playersData, 'galerijSlideshowMiniLobby');
      
      const infoEl = document.getElementById('galerijSlideshowInfo');
      if (infoEl) {
        infoEl.innerHTML = `
          <div class="round-name">Thema: ${data.galleryTheme || 'Galerij'}</div>
          ${data.imageAnswer ? `<div class="round-status" style="font-size: 2.5em; margin-top: 20px; color: #ffd17a;">Antwoord: ${data.imageAnswer}</div>` : ''}
        `;
      }
      renderPlayersBarCompact(playersData, activeIndex, 'galerijSlideshowPlayersBar');
      break;
    }

    /* === DONE === */
    case 'scene-round-galerij-done': {
      // Zorg dat we altijd players hebben, gebruik global players als fallback
      const displayPlayers = playersData.length > 0 ? playersData : players;
      
      renderMiniLobby(displayPlayers, 'galerijDoneMiniLobby');
      renderPlayersBarCompact(displayPlayers, activeIndex, 'galerijDonePlayersBar');

      break;
    }
  }
}


  /* === COLLECTIEF GEHEUGEN HANDLER === */
  function handleCollectiefDisplayUpdate(data) {
    const playersData = data.players || [];
    const activeIndex = data.activeIndex ?? -1;

    // Scene bepalen
    let sceneToShow = data.scene;
    if (!sceneToShow) sceneToShow = 'scene-round-collectief-pre';
    // Host kan expliciet vragen om klok te starten -> meteen naar MAIN
    if (data.action === 'start_clock') {
      sceneToShow = 'scene-round-collectief-main';
    }

    // Strip "scene-" prefix voor updateScene
    const sceneId = sceneToShow.replace(/^scene-/, '');
    updateScene(sceneId);

    // Gebruik global players als fallback
    const displayPlayers = playersData.length > 0 ? playersData : players;

    switch (sceneToShow) {
      /* === PRE === */
      case 'scene-round-collectief-pre': {
        renderMiniLobby(displayPlayers, 'collectiefPreMiniLobby');
        renderPlayersBarCompact(displayPlayers, activeIndex, 'collectiefPrePlayersBar');
        break;
      }

      /* === VIDEO === */
      case 'scene-round-collectief-video': {
        const videoPlayer = document.getElementById('collectiefVideoPlayer');
        const videoSource = document.getElementById('collectiefVideoSource');
      
        if (videoSource && data.videoSrc) {
          videoSource.src = data.videoSrc;
          if (videoPlayer) {
            videoPlayer.load();
            videoPlayer.play().catch(err => console.warn('Video autoplay geblokkeerd:', err));
          }
        }
        // Als de video klaar is -> automatisch naar MAIN
        if (videoPlayer) {
          // Gebruik onended zodat we niet stapelen
          videoPlayer.onended = () => {
            handleCollectiefDisplayUpdate({
              ...data,
              scene: 'scene-round-collectief-main'
            });
          };
        }
        break;
      }

      /* === MAIN === */
      case 'scene-round-collectief-main': {
        renderMiniLobby(displayPlayers, 'collectiefMainMiniLobby');
      
        // Render antwoorden (5 opties) met punten eerst, dan tekst
        const answersContainer = document.getElementById('collectiefMainAnswers');
        if (answersContainer && data.answers) {
          answersContainer.innerHTML = data.answers.map((answer, i) => {
            // Parse answer data
            const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
            const found = typeof answer === 'object' 
              ? !!(answer.isFound || answer.found || answer.answered || answer.isAnswered)
              : false;
            const points = typeof answer === 'object' ? (answer.points || 0) : 0;
            
            // Blur niet-gevonden antwoorden
            const displayText = found ? text : text.replace(/./g, '█');
            
            return `
              <div class="collectief-answer-line${found ? ' found' : ''}" data-index="${i}">
                <div class="collectief-answer-points"><span>${points}</span></div>
                <div class="collectief-answer-text${found ? '' : ' blurred'}">${displayText}</div>
              </div>
            `;
          }).join('');
        }
      
        // Info sectie
        const infoEl = document.getElementById('collectiefMainInfo');
        if (infoEl) {
          infoEl.innerHTML = `
            <div class="round-name">Het Collectief Geheugen</div>
            <div class="round-status">Beurt van ${data.activePlayer || '-'}</div>
            ${data.questionText ? `<div class="round-status" style="font-size: 1.8em; margin-top: 15px;">${data.questionText}</div>` : ''}
          `;
        }
      
        renderPlayersBarCompact(displayPlayers, activeIndex, 'collectiefMainPlayersBar');
        break;
      }

      /* === TUSSENSTAND === */
      case 'scene-round-collectief-tussenstand': {
        renderMiniLobby(displayPlayers, 'collectiefTussenstandMiniLobby');
      
        // Toon alle antwoorden met gevonden status
        const answersContainer = document.getElementById('collectiefTussenstandAnswers');
        if (answersContainer && data.answers) {
          answersContainer.innerHTML = data.answers.map((answer, i) => {
            const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
            const found = typeof answer === 'object' 
              ? !!(answer.isFound || answer.found)
              : false;
            const points = typeof answer === 'object' ? (answer.points || 0) : 0;
            const finderName = typeof answer === 'object' ? (answer.finderName || '') : '';
            
            return `
              <div class="collectief-answer-line found" style="justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 20px; flex: 1;">
                  <div class="collectief-answer-points"><span>${points}</span></div>
                  <div class="collectief-answer-text">${text}</div>
                </div>
                ${finderName ? `<div style="font-size: 1.5em; color: #ffd17a; padding-right: 20px;">✓ ${finderName}</div>` : ''}
              </div>
            `;
          }).join('');
        }
      
        renderPlayersBarCompact(displayPlayers, activeIndex, 'collectiefTussenstandPlayersBar');
        break;
      }

      /* === DONE === */
      case 'scene-round-collectief-done': {
        renderMiniLobby(displayPlayers, 'collectiefDoneMiniLobby');
      
        // Toon de slimste van de dag
        const slimsteEl = document.getElementById('collectiefSlimsteVanDeDag');
        if (slimsteEl && data.slimsteVanDeDag) {
          slimsteEl.textContent = `Slimste van de dag: ${data.slimsteVanDeDag}`;
        }
      
        // Toon de finalisten
        const finalistenEl = document.getElementById('collectiefFinalisten');
        if (finalistenEl && data.finalisten) {
          finalistenEl.textContent = data.finalisten.join(', ');
        }
      
        renderPlayersBarCompact(displayPlayers, activeIndex, 'collectiefDonePlayersBar');
        break;
      }
    }
  }

  /* === FINALE HANDLER === */
  function handleFinaleDisplayUpdate(data) {
    const playersData = data.players || [];
    const activeIndex = data.activeIndex ?? -1;

    // Scene bepalen
    let sceneToShow = data.scene;
    if (!sceneToShow) sceneToShow = 'scene-round-finale-pre';

    // Strip "scene-" prefix voor updateScene
    const sceneId = sceneToShow.replace(/^scene-/, '');
    updateScene(sceneId);

    // Gebruik global players als fallback
    const displayPlayers = playersData.length > 0 ? playersData : players;

    switch (sceneToShow) {
      /* === PRE (Finalisten bekendmaking) === */
      case 'scene-round-finale-pre': {
        renderMiniLobby(displayPlayers, 'finalePreMiniLobby');
        
        // Bepaal wie finalisten zijn en wie afvaller
        const finalisten = displayPlayers.filter(p => !p.isOut);
        const afvaller = displayPlayers.find(p => p.isOut);
        const isHighestWinner = data.collectiefEndOption === 'highestWinner';
        
        // Toon finalisten tekst (aangepast op basis van optie)
        const finalistenTextEl = document.getElementById('finaleFinalistenText');
        if (finalistenTextEl) {
          if (isHighestWinner) {
            // highestWinner: Finalisten spelen voor tweede en derde plaats
            finalistenTextEl.textContent = `De finalisten: ${finalisten.map(p => p.name).join(' en ')}`;
          } else {
            // lowestOut: Finalisten spelen voor de titel
            finalistenTextEl.textContent = `De finalisten: ${finalisten.map(p => p.name).join(' en ')}`;
          }
        }
        
        // Toon afvaller tekst (aangepast op basis van optie)
        const afvallerTextEl = document.getElementById('finaleAfvallerText');
        if (afvallerTextEl && afvaller) {
          if (isHighestWinner) {
            // highestWinner: Afvaller is de Slimste van de Dag
            afvallerTextEl.textContent = `${afvaller.name} is de Slimste van de Dag!`;
          } else {
            // lowestOut: Afvaller is gewoon afgevallen
            afvallerTextEl.textContent = `${afvaller.name} is afgevallen`;
          }
        }
        
        renderPlayersBarCompact(displayPlayers, activeIndex, 'finalePrePlayersBar');
        break;
      }

      /* === MAIN (Vraag actief) === */
      case 'scene-round-finale-main': {
        renderMiniLobby(displayPlayers, 'finaleMainMiniLobby');
      
        // Render antwoorden (5 opties) met punten eerst, dan tekst
        const answersContainer = document.getElementById('finaleMainAnswers');
        if (answersContainer && data.answers) {
          answersContainer.innerHTML = data.answers.map((answer, i) => {
            // Parse answer data
            const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
            const found = typeof answer === 'object' 
              ? !!(answer.isFound || answer.found)
              : false;
            const finderName = typeof answer === 'object' ? (answer.finderName || '') : '';
            
            // Blur niet-gevonden antwoorden
            const displayText = found ? text : text.replace(/./g, '█');
            
            return `
              <div class="collectief-answer-line${found ? ' found' : ''}" data-index="${i}">
                <div class="collectief-answer-text${found ? '' : ' blurred'}">
                  ${displayText}
                  ${finderName ? `<span style="font-size: 0.7em; margin-left: 15px; color: #ffd17a;">(${finderName})</span>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }
      
        // Info sectie
        const infoEl = document.getElementById('finaleMainInfo');
        if (infoEl) {
          infoEl.innerHTML = `
            <div class="round-name">DE FINALE</div>
            <div class="round-status">Beurt van ${data.activePlayer || '-'}</div>
            ${data.question ? `<div class="round-status" style="font-size: 1.8em; margin-top: 15px;">${data.question}</div>` : ''}
          `;
        }
      
        renderPlayersBarCompact(displayPlayers, activeIndex, 'finaleMainPlayersBar');
        break;
      }

      /* === END (Winnaar) === */
      case 'scene-round-finale-end': {
        renderMiniLobby(displayPlayers, 'finaleEndMiniLobby');
        
        // Vind winnaar en verliezer
        const winnaar = displayPlayers.find(p => p.seconds > 0);
        const verliezer = displayPlayers.find(p => p.seconds <= 0);
        const isHighestWinner = data.collectiefEndOption === 'highestWinner';
        
        // Toon winnaar naam
        const winnerNameEl = document.getElementById('finaleWinnerName');
        if (winnerNameEl && winnaar) {
          winnerNameEl.textContent = winnaar.name.toUpperCase();
        }
        
        // Toon winnaar titel (aangepast op basis van optie)
        const winnerTitleEl = document.getElementById('finaleWinnerTitle');
        if (winnerTitleEl) {
          if (isHighestWinner) {
            // highestWinner: Winnaar gaat door (samen met de Slimste van de Dag)
            winnerTitleEl.textContent = 'GAAT DOOR NAAR DE VOLGENDE AFLEVERING!';
          } else {
            // lowestOut: Toon in dezelfde stijl als initial-title-bar
            winnerTitleEl.innerHTML = `
              is
              <div class="initial-title-bar-2">
                de slimste mens
                <img src="assets/slimstemens.png" alt="Het Slimste Mens logo">
                van twitch
              </div>
            `;
          }
        }
        
        // Toon verliezer tekst + pre-finale info (aangepast op basis van optie)
        const loserTextEl = document.getElementById('finaleLoserText');
        if (loserTextEl && verliezer) {
          let loserText = '';
          
          if (isHighestWinner) {
            // highestWinner: Verliezer valt af, dagwinnaar gaat ook door
            loserText = `${verliezer.name} valt af.`;
            if (data.preFinaleAfvallerName) {
              loserText += `<br>${data.preFinaleAfvallerName} gaat ook door naar de volgende aflevering!`;
            }
          } else {
            // lowestOut: Verliezer valt af in finale, pre-finale afvaller vermelden
            loserText = `${verliezer.name} is afgevallen in de finale.`;
            if (data.preFinaleAfvallerName) {
              loserText += `<br>${data.preFinaleAfvallerName} viel af voor de finale.`;
            }
          }
          
          loserTextEl.innerHTML = loserText;
        }
        
        renderPlayersBarCompact(displayPlayers, activeIndex, 'finaleEndPlayersBar');
        break;
      }
    }
  }

connectWebSocket();
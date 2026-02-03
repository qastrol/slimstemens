let currentScene = null;
let players = [];
let defaultThreeSixNineMax = 12;
let perRoundState = { max: defaultThreeSixNineMax };
let allGalleryAnswers = []; 

function updateScene(sceneName) {
    document.querySelectorAll('.scene').forEach(s => {
        s.style.display = (s.id === `scene-${sceneName}`) ? 'flex' : 'none';
    });
    currentScene = sceneName;
}

const WS_ADDRESS = 'ws://127.0.0.1:8081/';
let ws = null;
let __displayLoopAudio = null;
let __audioUnlocked = false;
let __lastAudioCmd = null;

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
  if (__lastAudioCmd) {
    const cmd = __lastAudioCmd;
    __lastAudioCmd = null;
    handleAudioMessage(cmd);
  }
}

document.addEventListener('click', __unlockAudio, { once: true });
document.addEventListener('keydown', __unlockAudio, { once: true });

function connectWebSocket() {
  updateScene('no-connection');
  ws = new WebSocket(WS_ADDRESS);

  ws.onopen = () => updateScene('waiting-host');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'audio':
        handleAudioMessage(data);
        break;
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

      case 'round_start':
        
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

        
        if (data.key === 'puzzel') {
          handlePuzzelDisplayUpdate(data);
          break;
        }

        
if (data.key === 'galerij') {
    
    if (!data.started) { 
        data.scene = 'scene-round-galerij-pre';
    } else {
        data.scene = 'scene-round-galerij-main';
    }
    handleGalerijDisplayUpdate(data);
    break;
}

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
    
  }
}

      
      if (data.key === 'collectief') {
        data.scene = 'scene-round-collectief-pre';
        handleCollectiefDisplayUpdate(data);
        break;
      }

      
      if (data.key === 'finale') {
        handleFinaleDisplayUpdate(data);
        break;
      }

        break;

      case 'update':
        if (data.players) players = data.players;

        
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

        
        if (data.key === 'puzzel') {
          handlePuzzelDisplayUpdate(data);
          break;
        }

        
        if (data.key === 'galerij') {
          handleGalerijDisplayUpdate(data);
          break;
        }

          
          if (data.key === 'collectief') {
            handleCollectiefDisplayUpdate(data);
            break;
          }

          
          if (data.key === 'finale') {
            handleFinaleDisplayUpdate(data);
            break;
          }

        
        if (data.scene === 'lobby') {
          updateScene('lobby');
          renderLobby(players);
        }
        break;

      case 'round_end':
        
        if (data.key === 'finale') {
          handleFinaleDisplayUpdate(data);
        } else {
          
          updateScene('waiting-game');
        }
        break;

      case 'game_end':
        
        if (data.scene === 'solo-game-end') {
          updateScene('solo-game-end');
          renderSoloGameEnd(data);
        }
        break;

      case 'show_bumper':
        // Toon bumper met rondetitel
        updateScene('round-bumper');
        const bumperTitle = document.getElementById('bumperRoundTitle');
        if (bumperTitle) {
          bumperTitle.textContent = data.roundTitle || 'RONDE';
        }
        
        // Speel bumper geluid af
        try {
          const bumperAudio = new Audio('SFX/snd_bumper.mp3');
          bumperAudio.volume = 0.7;
          bumperAudio.play().catch(e => console.warn('Bumper audio kon niet worden afgespeeld:', e));
        } catch (e) {
          console.warn('Bumper audio error:', e);
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



function renderPlayersBarUniversal(currentQuestionIndex = null, activeIndex = null, containerId = 'playersBarContainer'){
    const container = document.getElementById(containerId);
    if(!container || !players) return;

    container.innerHTML = players.map((p,i)=>`
        <div class="player-card${activeIndex!==null && i===activeIndex ? ' active-player' : ''}">
            <div class="player-name">${p.name}</div>
            <div class="player-seconds"><div class="big-timer">${p.seconds}</div></div>
        </div>
    `).join('');

    
    if(containerId === 'playersBarContainer'){
        const qContainer = document.getElementById('questionNumbersContainer');
        
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

    
    const rondeEinde = !data.currentQuestionDisplay || data.currentQuestionIndex > data.maxQuestions;

    if (rondeEinde) {
        
        roundStatusEl.textContent = "Einde van deze ronde";
        roundQuestionEl.textContent = ""; 
        if (questionNumbersContainer) questionNumbersContainer.innerHTML = ""; 
    } else {
        
        const qText = data.currentQuestionDisplay || "—";
        const activePlayerName = data.activePlayer || '-';
        const qType = data.questionType || 'classic';

        roundStatusEl.textContent = `Beurt: ${activePlayerName} | Vraag ${data.currentQuestionIndex} van ${data.maxQuestions}`;
        
        // Render vraag op basis van type
        let questionHTML = '';
        
        // Type badge voor speciale vraag types
        if (qType !== 'classic' && qType !== 'multiple-choice') {
            const typeLabels = {
                'photo': '📷 FOTOVRAAG',
                'audio': '🔊 AUDIOVRAAG',
                'doe': '🎭 DOE-VRAAG',
                'estimation': '🔢 INSCHATTING'
            };
            questionHTML += `<div class="question-type-badge">${typeLabels[qType] || qType.toUpperCase()}</div>`;
        }
        
        // Vraag tekst
        questionHTML += `<div>${qText}</div>`;
        
        // Multiple choice opties
        if (qType === 'multiple-choice' && data.options) {
            questionHTML += '<div class="multiple-choice-options">';
            for (const [key, value] of Object.entries(data.options)) {
                questionHTML += `<div><strong>${key}:</strong> ${value}</div>`;
            }
            questionHTML += '</div>';
        }
        
        // Foto weergave - toon indicator in vraag, foto zelf in linkervlak
        if (qType === 'photo') {
            if (data.photoVisible) {
                questionHTML += '<div class="audio-indicator">📷 (Foto wordt getoond linksboven)</div>';
                // Toon foto in linkervlak
                setTimeout(() => {
                    const photoContainer = document.getElementById('threeSixNinePhotoContainer');
                    if (photoContainer && data.photoUrl) {
                        photoContainer.innerHTML = `<img src="${data.photoUrl}" alt="Vraagfoto" />`;
                        photoContainer.style.display = 'block';
                    }
                }, 0);
            } else {
                questionHTML += '<div class="audio-indicator">📷 (Foto verborgen)</div>';
                // Verberg foto
                setTimeout(() => {
                    const photoContainer = document.getElementById('threeSixNinePhotoContainer');
                    if (photoContainer) {
                        photoContainer.style.display = 'none';
                    }
                }, 0);
            }
        }
        
        // Audio indicator
        if (qType === 'audio' && data.audioUrl) {
            questionHTML += '<div class="audio-indicator">🎵 (Audio wordt afgespeeld)</div>';
        }
        
        roundQuestionEl.innerHTML = questionHTML;

        
        renderPlayersBarUniversal(data.currentQuestionIndex - 1, data.activeIndex);
    }

    
    renderMiniLobby(data.players, 'miniLobbyPlayers');
    
    // Toggle photo action - toon foto in linkerbovenvlak
    if (data.action === 'togglePhoto' && data.photoUrl) {
        const photoContainer = document.getElementById('threeSixNinePhotoContainer');
        
        if (data.photoVisible) {
            photoContainer.innerHTML = `<img src="${data.photoUrl}" alt="Vraagfoto" />`;
            photoContainer.style.display = 'block';
        } else {
            photoContainer.style.display = 'none';
            photoContainer.innerHTML = '';
        }
    }
    
    // Play audio action
    if (data.action === 'playAudio' && data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play();
    }
}





function renderOpenDeurLobby(data) {
    
    if (data.statusText) {
        document.getElementById('opendeurLobbyStatus').textContent = data.statusText;
    }
    
    renderLobby(data.players, 'lobbyPlayerImagesOd'); 
}

function renderOpenDeurVragensteller(data) {
    const container = document.getElementById('vragenstellersContainer');
    if (!container || !data.questioners) return;

    
    renderMiniLobby(data.players, 'odVragenstellerMiniLobby');
    const miniLobby = document.getElementById('odVragenstellerMiniLobby');
    if (miniLobby && data.activeChoosingPlayerIndex !== undefined) {
        const playerEls = miniLobby.querySelectorAll('.player');
        playerEls[data.activeChoosingPlayerIndex]?.classList.add('active-player');
    }

    
    const statusEl = document.querySelector('#scene-round-opendeur-vragensteller .round-status');
    if (data.activeChoosingPlayer) {
        statusEl.textContent = `Beurt: ${data.activeChoosingPlayer}`;
    } else {
        statusEl.textContent = `Kiest nu...`;
    }

    
    container.innerHTML = data.questioners.map(q => `
        <div class="vragensteller-box${q.isChosen ? ' gespeeld' : ' beschikbaar'}">
            <div class="vragensteller-name">${q.name}</div>
            ${q.isChosen ? '<div class="status-label">GESPEELD</div>' : ''}
        </div>
    `).join('');

    renderPlayersBarCompact(data.players, data.activeChoosingPlayerIndex, 'od-vragensteller-scores');
}


function renderOpenDeurVraag(data) {
    if (!data.currentQuestion) return;

    const { from, answers } = data.currentQuestion;
    const container = document.getElementById('odAnswerContainer');
    if (!container) return;

    
    container.innerHTML = answers.map(a => {
        
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

    
document.getElementById('od-beurt-info').textContent = `Beurt: ${data.activeAnsweringPlayer}`;
document.getElementById('od-vragensteller-vraag').textContent = `Vraag van ${from}: "${data.currentQuestion.questionText}"`;
document.getElementById('od-antwoord-teller').textContent = `Geraden Antwoorden: ${data.guessedAnswers} van ${data.totalAnswers}`;

    
    
    renderMiniLobby(data.players, 'odVraagMiniLobby', data.activeAnsweringPlayerIndex);

    
    const timerBarContainer = document.getElementById('od-vraag-scores'); 
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
    msg.className = type; 
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





function handlePuzzelDisplayUpdate(data) {
    const playersData = data.players || [];
    const activeIndex = data.activeIndex ?? -1;

    if (data.scene === 'scene-round-puzzel-active') {
        updateScene('round-puzzel-active');

        
        renderMiniLobby(playersData, 'puzzelActiveMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelActivePlayersBar');

        const puzzelRoundInfoEl = document.getElementById('puzzelRoundInfo');
        if (data.statusText) {
            puzzelRoundInfoEl.innerHTML = `
                <div class="round-name">Puzzel</div>
                <div class="round-status" style="color: #ffd17a; font-size: 1.2em;">${data.statusText}</div>
            `;
        } else {
            puzzelRoundInfoEl.innerHTML = `
                <div class="round-name">Puzzel ${data.currentPuzzelIndex} van ${data.maxPuzzles}</div>
                <div class="round-status">Beurt: ${data.currentTurnPlayer}</div>
            `;
        }
        
        

        
        const puzzelTableEl = document.getElementById('puzzelTable');
        if (data.puzzelWords && data.puzzelWords.length > 0) {
            puzzelTableEl.innerHTML = data.puzzelWords
                .map(w => {
                    
                    let classes = 'puzzel-word';
                    if (w.found) {
                        classes += ' found';
                        if (w.linkIndex !== null) {
                            classes += ` found-link-${w.linkIndex}`; 
                        }
                    }
                    return `<div class="${classes}">${w.text}</div>`;
                })
                .join('');
            puzzelTableEl.style.transition = 'opacity 0.3s ease';
            puzzelTableEl.style.opacity = 1;
        } else {
            
            
            
        }

        
        const puzzelLinksEl = document.getElementById('puzzelLinksContainer');
        if (puzzelLinksEl) {
            
            if (data.puzzelLinks && data.puzzelLinks.length > 0) {
                puzzelLinksEl.innerHTML = data.puzzelLinks
                    .map(link => {
                        
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

  
  const sceneId = sceneToShow.replace(/^scene-/, '');
  updateScene(sceneId);

  switch (sceneToShow) {
    case 'scene-round-galerij-pre': {
      
      const displayPlayers = playersData.length > 0 ? playersData : players;
      
      renderMiniLobby(displayPlayers, 'galerijPreMiniLobby');
      renderPlayersBarCompact(displayPlayers, activeIndex, 'galerijPrePlayersBar');

      break;
    }

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

    case 'scene-round-galerij-slideshow': {
      const imgContainer = document.getElementById('galerijSlideshowImageContainer');
      if (imgContainer) {
        imgContainer.innerHTML = data.imageSrc
          ? `<img src="${data.imageSrc}" alt="Bespreekafbeelding" style="max-width:100%;border-radius:12px;">`
          : '<div style="padding:2rem;">Geen afbeelding beschikbaar</div>';
      }
      
      
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

    case 'scene-round-galerij-done': {
      
      const displayPlayers = playersData.length > 0 ? playersData : players;
      
      renderMiniLobby(displayPlayers, 'galerijDoneMiniLobby');
      renderPlayersBarCompact(displayPlayers, activeIndex, 'galerijDonePlayersBar');

      break;
    }
  }
}


  function handleCollectiefDisplayUpdate(data) {
    const playersData = data.players || [];
    const activeIndex = data.activeIndex ?? -1;

    
    let sceneToShow = data.scene;
    if (!sceneToShow) sceneToShow = 'scene-round-collectief-pre';
    
    if (data.action === 'start_clock') {
      sceneToShow = 'scene-round-collectief-main';
    }

    
    const sceneId = sceneToShow.replace(/^scene-/, '');
    updateScene(sceneId);

    
    const displayPlayers = playersData.length > 0 ? playersData : players;

    switch (sceneToShow) {
      case 'scene-round-collectief-pre': {
        renderMiniLobby(displayPlayers, 'collectiefPreMiniLobby');
        renderPlayersBarCompact(displayPlayers, activeIndex, 'collectiefPrePlayersBar');
        break;
      }

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
        
        if (videoPlayer) {
          
          videoPlayer.onended = () => {
            handleCollectiefDisplayUpdate({
              ...data,
              scene: 'scene-round-collectief-main'
            });
          };
        }
        break;
      }

      case 'scene-round-collectief-main': {
        renderMiniLobby(displayPlayers, 'collectiefMainMiniLobby');
      
        
        const answersContainer = document.getElementById('collectiefMainAnswers');
        if (answersContainer && data.answers) {
          answersContainer.innerHTML = data.answers.map((answer, i) => {
            
            const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
            const found = typeof answer === 'object' 
              ? !!(answer.isFound || answer.found || answer.answered || answer.isAnswered)
              : false;
            const points = typeof answer === 'object' ? (answer.points || 0) : 0;
            
            
            const displayText = found ? text : text.replace(/./g, '█');
            
            return `
              <div class="collectief-answer-line${found ? ' found' : ''}" data-index="${i}">
                <div class="collectief-answer-points"><span>${points}</span></div>
                <div class="collectief-answer-text${found ? '' : ' blurred'}">${displayText}</div>
              </div>
            `;
          }).join('');
        }
      
        
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

      case 'scene-round-collectief-tussenstand': {
        renderMiniLobby(displayPlayers, 'collectiefTussenstandMiniLobby');
      
        
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

      case 'scene-round-collectief-done': {
        renderMiniLobby(displayPlayers, 'collectiefDoneMiniLobby');
      
        
        const slimsteEl = document.getElementById('collectiefSlimsteVanDeDag');
        if (slimsteEl && data.slimsteVanDeDag) {
          slimsteEl.textContent = `Slimste van de dag: ${data.slimsteVanDeDag}`;
        }
      
        
        const finalistenEl = document.getElementById('collectiefFinalisten');
        if (finalistenEl && data.finalisten) {
          finalistenEl.textContent = data.finalisten.join(', ');
        }
      
        renderPlayersBarCompact(displayPlayers, activeIndex, 'collectiefDonePlayersBar');
        break;
      }
    }
  }

  function handleFinaleDisplayUpdate(data) {
    const playersData = data.players || [];
    const activeIndex = data.activeIndex ?? -1;

    
    let sceneToShow = data.scene;
    if (!sceneToShow) sceneToShow = 'scene-round-finale-pre';

    
    const sceneId = sceneToShow.replace(/^scene-/, '');
    updateScene(sceneId);

    
    const displayPlayers = playersData.length > 0 ? playersData : players;

    switch (sceneToShow) {
      case 'scene-round-finale-pre': {
        renderMiniLobby(displayPlayers, 'finalePreMiniLobby');
        
        
        const finalisten = displayPlayers.filter(p => !p.isOut);
        const afvaller = displayPlayers.find(p => p.isOut);
        const isHighestWinner = data.collectiefEndOption === 'highestWinner';
        
        
        const finalistenTextEl = document.getElementById('finaleFinalistenText');
        if (finalistenTextEl) {
          if (isHighestWinner) {
            
            finalistenTextEl.textContent = `De finalisten: ${finalisten.map(p => p.name).join(' en ')}`;
          } else {
            
            finalistenTextEl.textContent = `De finalisten: ${finalisten.map(p => p.name).join(' en ')}`;
          }
        }
        
        
        const afvallerTextEl = document.getElementById('finaleAfvallerText');
        if (afvallerTextEl && afvaller) {
          if (isHighestWinner) {
            
            afvallerTextEl.textContent = `${afvaller.name} is de Slimste van de Dag!`;
          } else {
            
            afvallerTextEl.textContent = `${afvaller.name} is afgevallen`;
          }
        }
        
        renderPlayersBarCompact(displayPlayers, activeIndex, 'finalePrePlayersBar');
        break;
      }

      case 'scene-round-finale-main': {
        renderMiniLobby(displayPlayers, 'finaleMainMiniLobby');
      
        
        const answersContainer = document.getElementById('finaleMainAnswers');
        if (answersContainer && data.answers) {
          answersContainer.innerHTML = data.answers.map((answer, i) => {
            
            const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
            const found = typeof answer === 'object' 
              ? !!(answer.isFound || answer.found)
              : false;
            const finderName = typeof answer === 'object' ? (answer.finderName || '') : '';
            
            
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

      case 'scene-round-finale-end': {
        renderMiniLobby(displayPlayers, 'finaleEndMiniLobby');
        
        
        const winnaar = displayPlayers.find(p => p.seconds > 0);
        const verliezer = displayPlayers.find(p => p.seconds <= 0);
        const isHighestWinner = data.collectiefEndOption === 'highestWinner';
        
        
        const winnerNameEl = document.getElementById('finaleWinnerName');
        if (winnerNameEl && winnaar) {
          winnerNameEl.textContent = winnaar.name.toUpperCase();
        }
        
        
        const winnerTitleEl = document.getElementById('finaleWinnerTitle');
        if (winnerTitleEl) {
          if (isHighestWinner) {
            
            winnerTitleEl.textContent = 'GAAT DOOR NAAR DE VOLGENDE AFLEVERING!';
          } else {
            
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
        
        
        const loserTextEl = document.getElementById('finaleLoserText');
        if (loserTextEl && verliezer) {
          let loserText = '';
          
          if (isHighestWinner) {
            
            loserText = `${verliezer.name} valt af.`;
            if (data.preFinaleAfvallerName) {
              loserText += `<br>${data.preFinaleAfvallerName} gaat ook door naar de volgende aflevering!`;
            }
          } else {
            
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

function renderSoloGameEnd(data) {
    
    const playerNameEl = document.getElementById('soloPlayerName');
    if (playerNameEl && data.player) {
        playerNameEl.textContent = data.player.name;
    }

    
    const finalSecondsEl = document.getElementById('soloFinalSeconds');
    if (finalSecondsEl && data.finalSeconds !== undefined) {
        finalSecondsEl.textContent = data.finalSeconds;
    }

    
    if (data.player) {
        renderMiniLobby([data.player], 'soloEndMiniLobby');
        renderPlayersBarCompact([data.player], -1, 'soloEndPlayersBar');
    }
}

connectWebSocket();
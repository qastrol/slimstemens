let currentScene = null;
let players = [];
let defaultThreeSixNineMax = 12;
let perRoundState = { max: defaultThreeSixNineMax };
let allGalleryAnswers = []; 
let openDeurIntroVideoActive = false;
let openDeurPendingVraagData = null;

function updateScene(sceneName) {
    document.querySelectorAll('.scene').forEach(s => {
        s.style.display = (s.id === `scene-${sceneName}`) ? 'flex' : 'none';
    });
    currentScene = sceneName;
}

function applyOverlayPosition(overlayEl) {
  if (!overlayEl) return;

  const isLobbyScene = currentScene === 'lobby' ||
                      currentScene === 'waiting-game' ||
                      currentScene === 'round-opendeur-lobby' ||
                      currentScene === 'round-opendeur-video';

  const is369Scene = currentScene === 'round-369';

  const rightSideScenes = [
    'round-opendeur-vraag',
    'round-puzzel-waiting',
    'round-puzzel-active',
    'scene-round-puzzel-done',
    'scene-round-galerij-pre',
    'scene-round-galerij-main',
    'scene-round-galerij-aanvul',
    'scene-round-galerij-slideshow',
    'scene-round-galerij-done',
    'scene-round-collectief-pre',
    'scene-round-collectief-main',
    'scene-round-collectief-tussenstand',
    'scene-round-collectief-done',
    'scene-round-finale-pre',
    'scene-round-finale-main',
    'scene-round-finale-end',
    'solo-game-end'
  ];

  const isRightSide = rightSideScenes.includes(currentScene);

  if (isLobbyScene) {
    overlayEl.classList.add('fullscreen');
    overlayEl.classList.remove('mini-lobby-mode', 'mini-right', 'mini-369');
  } else {
    overlayEl.classList.add('mini-lobby-mode');
    overlayEl.classList.remove('fullscreen');

    if (is369Scene) {
      overlayEl.classList.add('mini-369');
    } else {
      overlayEl.classList.remove('mini-369');
    }

    if (isRightSide) {
      overlayEl.classList.add('mini-right');
    } else {
      overlayEl.classList.remove('mini-right');
    }
  }
}

const WS_ADDRESS = 'ws://127.0.0.1:8081/';
let ws = null;
let __displayLoopAudio = null;
// Audio is altijd enabled voor OBS Studio - geen unlock nodig

function connectWebSocket() {
  updateScene('no-connection');
  ws = new WebSocket(WS_ADDRESS);

  ws.onopen = () => updateScene('waiting-host');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('📨 WebSocket bericht ontvangen:', data.type, data);

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
        if (data.round && data.round !== 'lobby') {
          updatePlayersBarsFromGeneric(players, data.active ?? data.activeIndex ?? -1);
          break;
        }
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
            stopOpenDeurIntroVideoPlayback();
            updateScene('round-opendeur-lobby');
            renderOpenDeurLobby(data);
          } else if (data.scene === 'scene-round-opendeur-vragensteller') {
            stopOpenDeurIntroVideoPlayback();
            updateScene('round-opendeur-vragensteller');
            renderOpenDeurVragensteller(data);
          } else if (data.scene === 'scene-round-opendeur-vraag') {
            if (tryHandleOpenDeurIntroVideo(data)) {
              break;
            }
            updateScene('round-opendeur-vraag');
            renderOpenDeurVraag(data);
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
        console.warn('Audio afspelen mislukt:', err);
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
        console.warn('Loop audio afspelen mislukt:', err);
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
            stopOpenDeurIntroVideoPlayback();
            updateScene('round-opendeur-lobby');
            renderOpenDeurLobby(data);
          } else if (data.scene === 'scene-round-opendeur-vragensteller') {
            stopOpenDeurIntroVideoPlayback();
            updateScene('round-opendeur-vragensteller');
            renderOpenDeurVragensteller(data);
          } else if (data.scene === 'scene-round-opendeur-vraag') {
            if (tryHandleOpenDeurIntroVideo(data)) {
              break;
            }
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

      case 'presenter_toggle':
        // Toon of verberg presentator overlay
        const presenterOverlay = document.getElementById('presenterOverlay');
        const presenterPhoto = document.getElementById('presenterPhoto');
        const juryOverlay = document.getElementById('juryOverlay');
        
        if (data.showing && data.photoData) {
          if (juryOverlay) juryOverlay.style.display = 'none';
          applyOverlayPosition(presenterOverlay);
          
          // Toon presentator
          presenterPhoto.src = data.photoData;
          presenterOverlay.style.display = 'flex';
        } else {
          // Verberg presentator, toon kandidaten
          presenterOverlay.style.display = 'none';
        }
        break;

      case 'jury_toggle': {
        const juryOverlay = document.getElementById('juryOverlay');
        const presenterOverlay = document.getElementById('presenterOverlay');
        if (data.showing) {
          if (presenterOverlay) presenterOverlay.style.display = 'none';
          applyOverlayPosition(juryOverlay);
          if (juryOverlay) juryOverlay.style.display = 'flex';
        } else if (juryOverlay) {
          juryOverlay.style.display = 'none';
        }
        break;
      }

      case 'intro_start':
        handleIntroStart(data);
        break;

      case 'intro_play_video':
        handleIntroPlayVideo();
        break;

      case 'intro_perspective':
        handleIntroPerspectiveChange(data.perspective);
        break;

      case 'intro_stop':
        handleIntroStop();
        break;

      case 'outro_start':
        handleOutroStart(data);
        break;

      case 'finale_view_change':
        handleFinaleViewChange(data);
        break;

      case 'restore_scenery':
        handleRestoreScenery(data.scene);
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

function renderLobby(players, containerId = 'lobbyPlayerImages'){
    const container = document.getElementById(containerId);
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


function adjustQuestionFontSize(questionElement, text) {
    // Dynamische font-size aanpassing gebaseerd op tekstlengte
    // Basisgrootte: 3.0em voor korte vragen
    const textLength = text.length;
    let fontSize;
    
    if (textLength <= 80) {
        fontSize = 3.0; // Korte vragen
    } else if (textLength <= 120) {
        fontSize = 2.6; // Middellange vragen
    } else if (textLength <= 170) {
        fontSize = 2.2; // Lange vragen
    } else if (textLength <= 230) {
        fontSize = 1.9; // Zeer lange vragen
    } else {
        fontSize = 1.6; // Extreem lange vragen
    }
    
    questionElement.style.fontSize = `${fontSize}em`;
}

  function adjustQuestionFontSizeMultipleChoice(questionElement, text) {
    // Strenger voor multiple-choice: minder ruimte door antwoordopties
    const textLength = text.length;
    let fontSize;

    if (textLength <= 60) {
      fontSize = 2.2;
    } else if (textLength <= 90) {
      fontSize = 1.9;
    } else if (textLength <= 130) {
      fontSize = 1.6;
    } else if (textLength <= 170) {
      fontSize = 1.4;
    } else {
      fontSize = 1.2;
    }

    questionElement.style.fontSize = `${fontSize}em`;
  }

function renderThreeSixNine(data){
    console.log('🎵 renderThreeSixNine aangeroepen met data.action:', data.action, 'audioUrl:', data.audioUrl);
    
    // Audio afspelen EERST checken voordat we andere dingen doen
    if (data.action === 'playAudio' && data.audioUrl) {
        console.log('🔊 Poging audio af te spelen:', data.audioUrl);
        const audio = new Audio(data.audioUrl);
        
        // Event listeners voor betere debugging
        audio.addEventListener('error', (e) => {
            console.error('❌ Audio load error voor:', data.audioUrl);
            console.error('Error details:', e);
            console.error('Audio error code:', audio.error?.code, 'message:', audio.error?.message);
        });
        
        audio.addEventListener('loadedmetadata', () => {
            console.log('✅ Audio metadata geladen voor:', data.audioUrl);
        });
        
        audio.play().then(() => {
            console.log('✅ Audio succesvol gestart:', data.audioUrl);
        }).catch(err => {
            console.error('❌ Audio play() mislukt voor:', data.audioUrl);
            console.error('Error:', err);
        });
    }
    
    const roundStatusEl = document.getElementById('roundStatus');
    const roundQuestionEl = document.getElementById('roundQuestion');
    const questionNumbersContainer = document.getElementById('questionNumbersContainer');

    
    const rondeEinde = !data.currentQuestionDisplay || data.currentQuestionIndex > data.maxQuestions;

    if (rondeEinde) {
        
        roundStatusEl.textContent = "Einde van deze ronde";
        roundQuestionEl.textContent = ""; 
        if (questionNumbersContainer) questionNumbersContainer.innerHTML = ""; 
        const photoContainer = document.getElementById('threeSixNinePhotoContainer');
        if (photoContainer) {
          photoContainer.style.display = 'none';
          photoContainer.innerHTML = '';
        }
    } else {
        
        const qText = data.currentQuestionDisplay || "—";
        const activePlayerName = data.activePlayer || '-';
        const qType = data.questionType || 'classic';

        roundStatusEl.textContent = `Beurt: ${activePlayerName} | Vraag ${data.currentQuestionIndex} van ${data.maxQuestions}`;
        
        // Render vraag op basis van type
        let questionHTML = '';
        
        // Vraag tekst
        questionHTML += `<div>${qText}</div>`;
        
        // Multiple choice opties
        if ((qType === 'multiple-choice' || qType === 'photo-multiple-choice') && data.options) {
            questionHTML += '<div class="multiple-choice-options">';
            for (const [key, value] of Object.entries(data.options)) {
                questionHTML += `<div><strong>${key}:</strong> ${value}</div>`;
            }
            questionHTML += '</div>';
        }
        
        // Foto weergave - toon indicator in vraag, foto zelf in linkervlak
        if (qType === 'photo' || qType === 'photo-multiple-choice') {
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
        else {
          setTimeout(() => {
            const photoContainer = document.getElementById('threeSixNinePhotoContainer');
            if (photoContainer) {
              photoContainer.style.display = 'none';
              photoContainer.innerHTML = '';
            }
          }, 0);
        }
        
        // Audio indicator
        if (qType === 'audio' && data.audioUrl) {
            questionHTML += '<div class="audio-indicator">🎵 (Audio wordt afgespeeld)</div>';
        }
        
        roundQuestionEl.innerHTML = questionHTML;
        
        // Pas font-size aan op basis van vraaglengte
        if (qType === 'multiple-choice' || qType === 'photo-multiple-choice') {
          adjustQuestionFontSizeMultipleChoice(roundQuestionEl, qText);
        } else {
          adjustQuestionFontSize(roundQuestionEl, qText);
        }

        const normalizedActiveIndex = normalizeActiveIndex(players, data.activeIndex);
        perRoundState.currentQuestionIndex = Number.isFinite(data.currentQuestionIndex)
          ? Math.max(0, data.currentQuestionIndex - 1)
          : null;
        if (Number.isFinite(data.maxQuestions)) {
          perRoundState.max = data.maxQuestions;
        }

        renderPlayersBarUniversal(perRoundState.currentQuestionIndex, normalizedActiveIndex);
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
}

function normalizeActiveIndex(playersData, activeIndex) {
  if (!Array.isArray(playersData) || activeIndex === null || activeIndex === undefined) {
    return activeIndex;
  }
  if (activeIndex >= 0 && activeIndex < playersData.length) {
    return activeIndex;
  }
  const resolvedIndex = playersData.findIndex(p => p.index === activeIndex);
  return resolvedIndex !== -1 ? resolvedIndex : activeIndex;
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
        </div>
    `).join('');

    renderPlayersBarCompact(data.players, data.activeChoosingPlayerIndex, 'od-vragensteller-scores');
}

  function stopOpenDeurIntroVideoPlayback() {
    const videoPlayer = document.getElementById('openDeurIntroVideoPlayer');
    const videoSource = document.getElementById('openDeurIntroVideoSource');

    openDeurIntroVideoActive = false;
    openDeurPendingVraagData = null;

    if (!videoPlayer) return;

    try {
      videoPlayer.pause();
      videoPlayer.currentTime = 0;
    } catch (e) {}

    videoPlayer.onended = null;
    videoPlayer.onerror = null;

    if (videoSource) {
      videoSource.src = '';
      videoPlayer.load();
    }
  }

  function tryHandleOpenDeurIntroVideo(data) {
    const introVideoUrl = data.introVideoUrl || data.currentQuestion?.introVideoUrl || '';

    if (openDeurIntroVideoActive) {
      openDeurPendingVraagData = { ...data, showIntroVideo: false };
      return true;
    }

    if (!data.showIntroVideo || !introVideoUrl) {
      return false;
    }

    const videoPlayer = document.getElementById('openDeurIntroVideoPlayer');
    const videoSource = document.getElementById('openDeurIntroVideoSource');
    if (!videoPlayer || !videoSource) {
      return false;
    }

    openDeurIntroVideoActive = true;
    openDeurPendingVraagData = { ...data, showIntroVideo: false };

    const finishIntroVideo = () => {
      if (!openDeurIntroVideoActive) return;

      openDeurIntroVideoActive = false;
      videoPlayer.onended = null;
      videoPlayer.onerror = null;

      const vraagData = openDeurPendingVraagData || { ...data, showIntroVideo: false };
      openDeurPendingVraagData = null;

      updateScene('round-opendeur-vraag');
      renderOpenDeurVraag(vraagData);
      renderPlayersBarUniversal(players, vraagData.activeIndex);
    };

    updateScene('round-opendeur-video');

    videoSource.src = introVideoUrl;
    videoPlayer.load();
    videoPlayer.onended = finishIntroVideo;
    videoPlayer.onerror = finishIntroVideo;

    videoPlayer.play().catch(() => {
      finishIntroVideo();
    });

    return true;
  }


function renderOpenDeurVraag(data) {
    if (!data.currentQuestion) return;

    const { from, answers } = data.currentQuestion;
    const container = document.getElementById('odAnswerContainer');
    if (!container) return;

    
    container.innerHTML = answers.map(a => {
        
        const displayText = (a.isAnswered || data.isAllAnswersVisible) ? a.text : a.text.replace(/./g, '█');
        const points = data.currentQuestion.timeGain || 20;
        const isBlurred = !a.isAnswered && !data.isAllAnswersVisible;
        
        return `
            <div class="od-answer-line${!a.isAnswered ? ' unguessed' : ''}">
            ${a.isAnswered ? `<div class="od-answer-points"><span>${points}</span></div>` : ''}
                <div class="od-answer-text${isBlurred ? ' blurred' : ''}">
                    ${displayText}
                </div>
            </div>
        `;
    }).join('');

    
document.getElementById('od-beurt-info').textContent = `Beurt: ${data.activeAnsweringPlayer}`;
const odVraagEl = document.getElementById('od-vragensteller-vraag');
odVraagEl.textContent = `Vraag van ${from}: "${data.currentQuestion.questionText}"`;
adjustQuestionFontSize(odVraagEl, data.currentQuestion.questionText);
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

  const normalizedActiveIndex = normalizeActiveIndex(players, activeIndex);

    container.innerHTML = players.map((p, i) => `
    <div class="player-card${i === normalizedActiveIndex ? ' active-player' : ''}">
            <div class="player-name">${p.name}</div>
            <div class="player-seconds">${p.seconds}</div>
        </div>
    `).join('');
}

  function updatePlayersBarsFromGeneric(playersData, activeIndex) {
    if (!playersData || !playersData.length) return;

    const normalizedActiveIndex = normalizeActiveIndex(playersData, activeIndex);
    const questionIndex = currentScene === 'round-369' ? perRoundState.currentQuestionIndex : null;
    renderPlayersBarUniversal(questionIndex, normalizedActiveIndex);

    const compactBars = [
      'od-vragensteller-scores',
      'od-vraag-scores',
      'puzzelPrePlayersBar',
      'puzzelActivePlayersBar',
      'puzzelDonePlayersBar',
      'galerijPrePlayersBar',
      'galerijMainPlayersBar',
      'galerijAanvulPlayersBar',
      'galerijSlideshowPlayersBar',
      'galerijDonePlayersBar',
      'collectiefPrePlayersBar',
      'collectiefMainPlayersBar',
      'collectiefTussenstandPlayersBar',
      'collectiefDonePlayersBar',
      'finalePrePlayersBar',
      'finaleMainPlayersBar',
      'finaleEndPlayersBar',
      'soloEndPlayersBar'
    ];

    compactBars.forEach(id => {
      if (document.getElementById(id)) {
        renderPlayersBarCompact(playersData, activeIndex, id);
      }
    });
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
                    .map((link, index) => {
                        
                        const displayText = link.found ? link.link : link.link.replace(/./g, '█');
                        const points = link.timeGain || 30;

                        return `
                            <div class="puzzel-link-line${!link.found ? ' unguessed' : ''} ${link.found ? `found-link-${index}` : ''}">
                            ${link.found ? `<div class="puzzel-link-points"><span>${points}</span></div>` : ''}
                                <div class="puzzel-link-text${!link.found ? ' blurred' : ''}">
                                    ${displayText}
                                </div>
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
        renderMiniLobby(playersData, 'puzzelPreMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelPrePlayersBar');
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
        const revealAllAnswers = !!data.revealAllAnswers;
        const bothPlayersPassed = Array.isArray(data.playersWhoPassed) && data.playersWhoPassed.length >= 2;
        const showFinderNames = revealAllAnswers && bothPlayersPassed;
        const deductionSeconds = Number(data.deductionSeconds) > 0 ? Number(data.deductionSeconds) : 20;
      
        
        const answersContainer = document.getElementById('finaleMainAnswers');
        if (answersContainer && data.answers) {
          answersContainer.innerHTML = data.answers.map((answer, i) => {
            
            const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
            const found = typeof answer === 'object' 
              ? !!(answer.isFound || answer.found)
              : false;
            const finderName = typeof answer === 'object' ? (answer.finderName || '') : '';
            const isVisible = found || revealAllAnswers;
            const showPointsBadge = found || revealAllAnswers;
            const pointsText = found ? `${deductionSeconds}` : '';
            const revealClass = revealAllAnswers && !found ? ' revealed-unfound' : '';
            
            
            const displayText = isVisible ? text : text.replace(/./g, '█');
            
            return `
              <div class="collectief-answer-line${found ? ' found' : ''}${revealClass}" data-index="${i}">
                ${showPointsBadge ? `<div class="collectief-answer-points"><span>${pointsText}</span></div>` : ''}
                <div class="collectief-answer-text${isVisible ? '' : ' blurred'}">
                  ${displayText}
                </div>
                ${showFinderNames && found && finderName ? `<div class="finale-finder-name">✓ ${finderName}</div>` : ''}
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
        
        // Sla huidige spelers op voor finale lobby view
        finaleEndViewState.allPlayers = displayPlayers;
        
        
        const winnaar = displayPlayers.find(p => p.seconds > 0);
        const verliezer = displayPlayers.find(p => p.seconds <= 0);
        const isHighestWinner = data.collectiefEndOption === 'highestWinner';
        
        // Sla winner data op in state voor latere rendering
        finaleEndViewState.winner = winnaar;
        finaleEndViewState.loser = verliezer;
        finaleEndViewState.isHighestWinner = isHighestWinner;
        finaleEndViewState.preFinaleAfvallerName = data.preFinaleAfvallerName;
        
        
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

// ===== INTRO SCENE HANDLING =====
let introState = {
  playing: false,
  audioPlaying: null,
  currentPerspective: 'full'
};

function handleIntroStart(data) {
  console.log('🎬 Intro start ontvangen:', data);
  updateScene('intro');
  initializeIntroScene(data.text || '');
}

function initializeIntroScene(introText) {
  console.log('🎬 Intro scene initialiseren, tekst:', introText);
  
  const videoPlayer = document.getElementById('introVideoPlayer');
  const firstFrame = document.getElementById('introFirstFrame');
  const textBox = document.getElementById('introTextBox');
  
  // Controleer of alle elementen bestaan
  if (!videoPlayer) {
    console.error('❌ Intro video element niet gevonden in HTML');
    return;
  }
  
  // Verberg textBox en firstFrame img (tekst wordt getoond in index.html)
  if (textBox) {
    textBox.style.display = 'none';
  }
  if (firstFrame) {
    firstFrame.style.display = 'none';
  }
  
  // Laad video en pauzeer op allereerste frame
  try {
    videoPlayer.onloadedmetadata = () => {
      console.log('✅ Video metadata geladen');
      videoPlayer.currentTime = 0;
      videoPlayer.pause();
      console.log('⏸️ Video gepauzeerd op eerste frame');
    };
    
    videoPlayer.muted = true;
    videoPlayer.load();
    videoPlayer.style.display = 'block';
    console.log('✅ Video geladen en klaar');
  } catch (e) {
    console.error('❌ Fout bij laden video:', e);
  }
}

// WebSocket handlers voor intro controls (vanuit index.html)
function handleIntroPlayVideo() {
  console.log('▶️ Play video ontvangen via WebSocket');
  const videoPlayer = document.getElementById('introVideoPlayer');
  const firstFrame = document.getElementById('introFirstFrame');
  const lobbyView = document.getElementById('introLobbyView');
  
  if (!videoPlayer) return;
  
  // Verberg eerste frame img en lobby, toon video
  if (firstFrame) {
    firstFrame.style.display = 'none';
  }
  if (lobbyView) {
    lobbyView.style.display = 'none';
  }
  videoPlayer.style.display = 'block';
  videoPlayer.style.transform = 'none'; // Reset transform
  
  // Herstart video vanaf het begin (muted)
  videoPlayer.currentTime = 0;
  videoPlayer.muted = true;
  videoPlayer.play().catch(e => console.warn('Video could not play:', e));
  console.log('✅ Video hervat vanaf begin');
  
  // Start audio (generiek.mp3)
  introState.audioPlaying = new Audio('SFX/generiek.mp3');
  introState.audioPlaying.play().catch(e => {
    console.warn('Intro audio afspelen mislukt:', e);
  });
  
  introState.playing = true;
}

function handleIntroPerspectiveChange(perspective) {
  console.log('🔄 Perspectief wissel naar:', perspective);
  introState.currentPerspective = perspective;
  
  const videoPlayer = document.getElementById('introVideoPlayer');
  const firstFrame = document.getElementById('introFirstFrame');
  const lobbyView = document.getElementById('introLobbyView');
  const textBox = document.getElementById('introTextBox');
  
  if (!lobbyView) return;
  
  // Stop video en verberg video/eerste frame
  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.style.display = 'none';
  }
  if (firstFrame) {
    firstFrame.style.display = 'none';
  }
  
  // Verberg tekst overlay
  if (textBox) {
    textBox.style.display = 'none';
  }
  
  // Toon lobby
  lobbyView.style.display = 'flex';
  
  // Render kandidaten in lobby
  renderIntroLobby();
  
  // Pas zoom toe voor kandidaat perspectieven
  let transform = 'none';
  
if (perspective === 'cand1') {
  transform = 'scale(3) translateX(22.22%) translateY(-13%)';
} else if (perspective === 'cand2') {
  transform = 'scale(3) translateY(-13%)';
} else if (perspective === 'cand3') {
  transform = 'scale(3) translateX(-22.22%) translateY(-13%)';
} else {
    // Volledig lobby: geen zoom
    transform = 'none';
  }
  
  lobbyView.style.transform = transform;
  
  console.log(`✅ Lobby perspectief ingesteld: ${perspective}, transform: ${transform}`);
}

function renderIntroLobby() {
  const container = document.getElementById('introLobbyPlayerImages');
  if (!container || !players) return;
  
  container.innerHTML = players.map(p => `
    <div class="lobby-photo">
      <img src="${p.photoUrl || 'assets/avatar.png'}">
      <div>${p.name}</div>
    </div>
  `).join('');
  
  console.log('✅ Intro lobby gerenderd met', players.length, 'kandidaten');
}

function handleIntroStop() {
  console.log('⏹️ Stop intro ontvangen via WebSocket');
  const videoPlayer = document.getElementById('introVideoPlayer');
  const firstFrame = document.getElementById('introFirstFrame');
  const lobbyView = document.getElementById('introLobbyView');
  const introTitleBar = document.getElementById('introTitleBar');
  
  // Stop video
  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
    videoPlayer.style.display = 'none';
  }
  
  // Verberg eerste frame
  if (firstFrame) {
    firstFrame.style.display = 'none';
  }
  
  // Stop audio
  if (introState.audioPlaying) {
    introState.audioPlaying.pause();
    introState.audioPlaying = null;
  }
  
  introState.playing = false;
  
  // Play outro audio (intro.wav)
  const outroAudio = new Audio('SFX/intro.wav');
  outroAudio.play().catch(e => console.warn('Outro audio could not play:', e));
  
  // Check of we ingezoomd zijn
  const isZoomedIn = introState.currentPerspective !== 'full';
  
  if (isZoomedIn && lobbyView) {
    // Toon lobby als die niet zichtbaar is
    lobbyView.style.display = 'flex';
    
    // Zoom uit naar volledig lobby
    console.log('🔍 Zoom uit naar volledig lobby');
    lobbyView.style.transform = 'none';
    
    // Wacht op zoom-out animatie (300ms) + extra tijd
    setTimeout(() => {
      // Toon logo met fade-in
      if (introTitleBar) {
        introTitleBar.style.opacity = '1';
      }
      
      // Ga naar normale lobby scene
      setTimeout(() => {
        updateScene('lobby');
        renderLobby(players);
        
        // Reset intro state
        if (lobbyView) lobbyView.style.display = 'none';
        if (introTitleBar) {
          introTitleBar.style.opacity = '0';
        }
        introState.currentPerspective = 'full';
      }, 1500);
    }, 500);
  } else {
    // Als al volledig lobby of geen lobby view: direct naar logo fade-in
    if (lobbyView) {
      lobbyView.style.display = 'flex';
      lobbyView.style.transform = 'none';
    }
    
    // Render kandidaten als ze er nog niet zijn
    if (lobbyView) {
      renderIntroLobby();
    }
    
    // Toon logo met fade-in
    if (introTitleBar) {
      introTitleBar.style.opacity = '1';
    }
    
    // Ga naar normale lobby scene
    setTimeout(() => {
      updateScene('lobby');
      renderLobby(players);
      
      // Reset intro state
      if (lobbyView) lobbyView.style.display = 'none';
      if (introTitleBar) {
        introTitleBar.style.opacity = '0';
      }
      introState.currentPerspective = 'full';
    }, 1500);
  }
}

// ===== OUTRO SCENE HANDLING =====
let outroState = {
  playing: false,
  audioPlaying: null,
  allPlayers: [] // Bewaar alle spelers inclusief afvaller
};

function handleOutroStart(data) {
  console.log('🎬 Outro start ontvangen!', data);
  
  // Sla alle spelers op (inclusief afvaller)
  if (data.allPlayers && data.allPlayers.length > 0) {
    outroState.allPlayers = data.allPlayers;
    console.log('📋 Outro spelers opgeslagen:', outroState.allPlayers.map(p => p.name));
  }
  
  updateScene('outro');
  initializeOutroScene();
}

function initializeOutroScene() {
  console.log('🎬 Outro scene initialiseren...');
  
  const outroLobbyView = document.getElementById('outroLobbyView');
  const outroVideo = document.getElementById('outroVideoPlayer');
  const outroTitleBar = document.getElementById('outroTitleBar');
  
  // Render lobby spelers in outro scene (alle spelers inclusief afvaller)
  renderOutroLobby();
  
  // Toon lobbyview
  if (outroLobbyView) {
    outroLobbyView.style.display = 'flex';
    outroLobbyView.classList.remove('fade-out');
    outroLobbyView.style.opacity = '1';
    outroLobbyView.style.pointerEvents = 'auto';
  }
  
  // Zorg dat video verborgen is
  if (outroVideo) {
    outroVideo.style.display = 'none';
    outroVideo.style.opacity = '0';
  }
  
  // Start intro audio (intro.wav)
  outroState.audioPlaying = new Audio('SFX/intro.wav');
  outroState.audioPlaying.play().catch(e => {
    console.warn('Outro audio afspelen mislukt:', e);
  });
  
  console.log('✅ Outro scene klaar, audio speelt, fade start over 6s');
  
  // Start fade-out animatie na korte delay
  setTimeout(() => {
    startOutroFadeSequence();
  }, 500);
}

function renderOutroLobby() {
  const container = document.getElementById('outroLobbyPlayerImages');
  if (!container) return;
  
  // Gebruik all players uit outroState
  const playersToRender = outroState.allPlayers.length > 0 ? outroState.allPlayers : players;
  
  container.innerHTML = playersToRender.map(p => 
    `<div class="lobby-photo">
      <img src="${p.photoUrl || 'assets/avatar.png'}" alt="${p.name}">
      <div>${p.name}</div>
    </div>`
  ).join('');
  
  console.log('✅ Outro lobby gerenderd met', playersToRender.length, 'kandidaten');
}

function startOutroFadeSequence() {
  console.log('🎬 Outro fade sequence gestart...');
  
  const outroLobbyView = document.getElementById('outroLobbyView');
  const fadeOverlay = document.getElementById('outroFadeOut');
  const outroVideo = document.getElementById('outroVideoPlayer');
  
  // Fade lobby weg (opacity naar 0 over 6 seconden)
  if (outroLobbyView) {
    outroLobbyView.style.transition = 'opacity 6s ease-out';
    outroLobbyView.style.opacity = '0';
    outroLobbyView.style.pointerEvents = 'none';
  }
  
  // Na fade lobby, start video faden (na ~6 seconden)
  setTimeout(() => {
    // Laad video
    if (outroVideo) {
      outroVideo.style.display = 'block';
      outroVideo.style.transition = 'opacity 0.5s ease-in';
      outroVideo.muted = true;
      outroVideo.currentTime = 0;
      outroVideo.style.opacity = '1';
      outroVideo.play().catch(e => console.warn('Outro video could not play:', e));
      console.log('▶️ Outro video start afspelen');
    }
    
    // Verberg lobby view en fade overlay volledig
    if (outroLobbyView) {
      outroLobbyView.style.display = 'none';
    }
    
    if (fadeOverlay) {
      fadeOverlay.style.display = 'none';
    }
  }, 6000);
}

// ===== FINALE END GAME VIEW HANDLING =====
let finaleEndViewState = {
  currentView: 'winner' // 'winner' of 'lobby'
};

function handleFinaleViewChange(data) {
  console.log('🎬 Finale view wisselen naar:', data.view, data);
  finaleEndViewState.currentView = data.view;
  
  // Als spelers meekomen (bijv. van restore), update finaleEndViewState
  if (data.players && data.players.length > 0) {
    finaleEndViewState.allPlayers = data.players;
    console.log('📋 Finale spelers updated:', data.players.map(p => p.name));
  }
  
  if (data.view === 'lastquestion') {
    // Toon laatste vraag (scene-round-finale-main)
    updateScene('round-finale-main');
    
    const finaleMainScene = document.getElementById('scene-round-finale-main');
    
    // Update de content van de finale main scene
    if (finaleMainScene) {
      // Render mini lobby als players data beschikbaar is
      if (data.players) {
        renderMiniLobby(data.players, 'finaleMainMiniLobby');
      }
      
      // Render antwoorden
      const answersContainer = document.getElementById('finaleMainAnswers');
      if (answersContainer && data.answers) {
        const deductionSeconds = Number(data.deductionSeconds) > 0 ? Number(data.deductionSeconds) : 20;
        answersContainer.innerHTML = data.answers.map((answer, i) => {
          const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
          const found = true; // Altijd als gevonden tonen bij laatste vraag perspectief
          
          return `
            <div class="collectief-answer-line found" data-index="${i}">
              <div class="collectief-answer-points"><span>${deductionSeconds}</span></div>
              <div class="collectief-answer-text">
                ${text}
              </div>
            </div>
          `;
        }).join('');
      }
      
      // Update info
      const infoEl = document.getElementById('finaleMainInfo');
      if (infoEl && data.question) {
        infoEl.innerHTML = `
          <div class="round-name">DE FINALE</div>
          <div class="round-status">Laatste vraag (alle antwoorden onthuld)</div>
          ${data.question ? `<div class="round-status" style="font-size: 1.8em; margin-top: 15px;">${data.question}</div>` : ''}
        `;
      }
      
      // Render players bar als data beschikbaar is
      if (data.players && data.activeIndex !== undefined) {
        renderPlayersBarCompact(data.players, data.activeIndex, 'finaleMainPlayersBar');
      }
      
      console.log('✅ Laatste vraag met alle antwoorden weergegeven');
    }
  } else if (data.view === 'lobby') {
    // Switch naar finale end scene
    updateScene('round-finale-end');
    
    // Get content divs NA updateScene
    const finaleEndScene = document.getElementById('scene-round-finale-end');
    const winnerContent = finaleEndScene?.querySelector('.finale-winner-content');
    const lobbyContent = finaleEndScene?.querySelector('.finale-lobby-content');
    
    if (finaleEndViewState.allPlayers && finaleEndViewState.allPlayers.length > 0) {
      console.log('🎬 Rendering finale lobby met spelers:', finaleEndViewState.allPlayers.map(p => p.name));
      renderLobby(finaleEndViewState.allPlayers, 'finaleEndLobbyPlayerImages');
    } else {
      console.warn('⚠️ Geen spelers beschikbaar voor finale lobby');
    }
    
    // Toon fullscreen lobby, verberg winnaarscherm
    if (lobbyContent) {
      lobbyContent.style.display = 'block';
      lobbyContent.style.opacity = '1';
      console.log('✅ Lobby content zichtbaar gemaakt');
    } else {
      console.error('❌ Lobby content element niet gevonden!');
    }
    if (winnerContent) {
      winnerContent.style.display = 'none';
    }
  } else {
    // Switch naar finale end scene
    updateScene('round-finale-end');
    
    // Get content divs NA updateScene  
    const finaleEndScene = document.getElementById('scene-round-finale-end');
    const winnerContent = finaleEndScene?.querySelector('.finale-winner-content');
    const lobbyContent = finaleEndScene?.querySelector('.finale-lobby-content');
    
    // Re-render winnaarscherm content vanuit opgeslagen state
    if (finaleEndViewState.winner) {
      const winnaar = finaleEndViewState.winner;
      const verliezer = finaleEndViewState.loser;
      const isHighestWinner = finaleEndViewState.isHighestWinner;
      const preFinaleAfvallerName = finaleEndViewState.preFinaleAfvallerName;
      
      // Update mini lobby
      if (finaleEndViewState.allPlayers) {
        renderMiniLobby(finaleEndViewState.allPlayers, 'finaleEndMiniLobby');
      }
      
      // Update winnaar naam
      const winnerNameEl = document.getElementById('finaleWinnerName');
      if (winnerNameEl) {
        winnerNameEl.textContent = winnaar.name.toUpperCase();
      }
      
      // Update titel
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
      
      // Update loser text
      const loserTextEl = document.getElementById('finaleLoserText');
      if (loserTextEl && verliezer) {
        let loserText = '';
        if (isHighestWinner) {
          loserText = `${verliezer.name} valt af.`;
          if (preFinaleAfvallerName) {
            loserText += `<br>${preFinaleAfvallerName} gaat ook door naar de volgende aflevering!`;
          }
        } else {
          loserText = `${verliezer.name} is afgevallen in de finale.`;
          if (preFinaleAfvallerName) {
            loserText += `<br>${preFinaleAfvallerName} viel af voor de finale.`;
          }
        }
        loserTextEl.innerHTML = loserText;
      }
      
      // Update spelers bar
      if (finaleEndViewState.allPlayers) {
        renderPlayersBarCompact(finaleEndViewState.allPlayers, 0, 'finaleEndPlayersBar');
      }
      
      console.log('✅ Winnaarscherm opnieuw gerenderd');
    } else {
      console.warn('⚠️ Geen winner data beschikbaar in finaleEndViewState');
    }
    
    // Toon winnaarscherm, verberg fullscreen lobby
    if (winnerContent) {
      winnerContent.style.display = 'block';
      winnerContent.style.opacity = '1';
      console.log('✅ Winner content zichtbaar gemaakt');
    } else {
      console.error('❌ Winner content element niet gevonden!');
    }
    if (lobbyContent) {
      lobbyContent.style.display = 'none';
    }
  }
}

function handleRestoreScenery(scene) {
  console.log('🔧 Scène herstellen:', scene);
  
  // Reset scene elementen
  if (scene === 'scene-round-finale-end') {
    const finaleScene = document.getElementById('scene-round-finale-end');
    if (finaleScene) {
      // Reset CSS classes en stijlen
      finaleScene.style.filter = 'none';
      finaleScene.style.opacity = '1';
      
      // Reset outline content
      const lobbyContent = finaleScene.querySelector('.finale-lobby-content');
      if (lobbyContent) {
        lobbyContent.style.opacity = '1';
        lobbyContent.style.filter = 'none';
      }
      
      console.log('✅ Scène hersteld');
    }
  }
}

connectWebSocket();
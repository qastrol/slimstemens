let currentScene = null;
let players = [];
let defaultThreeSixNineMax = 12;
let perRoundState = { max: defaultThreeSixNineMax };
let allGalleryAnswers = []; 
let openDeurIntroVideoActive = false;
let openDeurPendingVraagData = null;
const openDeurPreparedThumbUrls = new Set();
const openDeurPreloadedIntroUrls = new Set();
let threeSixNineVideoActive = false;
let lastThreeSixNineData = null;
let threeSixNineActiveAudio = null;
const DEFAULT_DISPLAY_BRANDING = {
  titlePrefix: 'de slimste mens',
  titleSuffix: 'van twitch',
  logoPath: 'assets/slimstemens.png'
};
const DISPLAY_DEBUG_WS = false;
let displayBranding = { ...DEFAULT_DISPLAY_BRANDING };

function normalizeDisplayBranding(branding) {
  const merged = {
    ...DEFAULT_DISPLAY_BRANDING,
    ...(branding || {})
  };

  return {
    titlePrefix: String(merged.titlePrefix || DEFAULT_DISPLAY_BRANDING.titlePrefix).trim() || DEFAULT_DISPLAY_BRANDING.titlePrefix,
    titleSuffix: String(merged.titleSuffix || DEFAULT_DISPLAY_BRANDING.titleSuffix).trim() || DEFAULT_DISPLAY_BRANDING.titleSuffix,
    logoPath: String(merged.logoPath || DEFAULT_DISPLAY_BRANDING.logoPath).trim() || DEFAULT_DISPLAY_BRANDING.logoPath
  };
}

function setBrandingBarContent(barEl) {
  if (!barEl) {
    return;
  }

  const brandingMode = barEl.dataset.brandingMode || 'full';
  const existingLogo = barEl.querySelector('img');
  const logoSrc = brandingMode === 'minimal'
    ? (existingLogo?.getAttribute('src') || DEFAULT_DISPLAY_BRANDING.logoPath)
    : (displayBranding.logoPath || existingLogo?.getAttribute('src') || DEFAULT_DISPLAY_BRANDING.logoPath);
  const logoAlt = existingLogo?.getAttribute('alt') || 'Het Slimste Mens logo';

  barEl.textContent = '';
  barEl.appendChild(document.createTextNode(`${displayBranding.titlePrefix} `));

  const logo = document.createElement('img');
  logo.src = logoSrc;
  logo.alt = logoAlt;
  barEl.appendChild(logo);

  if (brandingMode !== 'minimal') {
    barEl.appendChild(document.createTextNode(` ${displayBranding.titleSuffix}`));
  }
}

function createBrandingBarElement(className = 'initial-title-bar') {
  const bar = document.createElement('div');
  bar.className = className;
  setBrandingBarContent(bar);
  return bar;
}

function applyBrandingToTitleBars(root = document) {
  if (!root) {
    return;
  }

  const titleBars = root.querySelectorAll('.initial-title-bar, .bumper-title-bar, .initial-title-bar-2');
  titleBars.forEach(setBrandingBarContent);
}

function setDisplayBranding(branding) {
  displayBranding = normalizeDisplayBranding(branding);
  applyBrandingToTitleBars(document);
}

function applyUiSettingsFromConfig(config) {
  setDisplayBranding(config?.settings?.branding);
}

window.applyUiSettingsFromConfig = applyUiSettingsFromConfig;

if (window.pendingUiConfig) {
  applyUiSettingsFromConfig(window.pendingUiConfig);
} else if (typeof getBrandingSettings === 'function') {
  setDisplayBranding(getBrandingSettings());
} else {
  applyBrandingToTitleBars(document);
}

function updateScene(sceneName) {
    document.querySelectorAll('.scene').forEach(s => {
        s.style.display = (s.id === `scene-${sceneName}`) ? 'flex' : 'none';
    });
    currentScene = sceneName;
  refreshVisibleOverlaysPosition();
}

function decodeEncodedOpenDeurVideoUrl(videoUrl) {
  const value = String(videoUrl || '').trim();
  const match = value.match(/^media\/opendeur\/((?:https?|http)___.+)\.mp4$/i);
  if (!match) {
    return '';
  }

  let decoded = match[1]
    .replace(/^https?___/i, (m) => m.toLowerCase().startsWith('https') ? 'https://' : 'http://')
    .replace(/__+/g, '/')
    .replace(/_/g, '/');

  if (!/^https?:\/\//i.test(decoded)) {
    return '';
  }

  return `${decoded}.mp4`;
}

function getOpenDeurIntroThumbnailUrl(questioner) {
  if (!questioner) {
    return '';
  }

  return String(
    questioner.introThumbnailUrl || questioner.thumbnailUrl || questioner.introImageUrl || questioner.posterUrl || ''
  ).trim();
}

function preloadOpenDeurIntroVideo(videoUrl) {
  const candidate = String(videoUrl || '').trim();
  if (!candidate || openDeurPreloadedIntroUrls.has(candidate)) {
    return;
  }

  openDeurPreloadedIntroUrls.add(candidate);
  const preloader = document.createElement('video');
  preloader.preload = 'auto';
  preloader.muted = true;
  preloader.playsInline = true;
  preloader.src = candidate;
  preloader.load();
}

function prepareOpenDeurQuestionerVideo(videoEl, videoUrl) {
  if (!videoEl || !videoUrl) {
    return;
  }

  const container = videoEl.closest('.vragensteller-box');
  const candidates = [String(videoUrl).trim()];
  const fallbackUrl = decodeEncodedOpenDeurVideoUrl(videoUrl);
  if (fallbackUrl && fallbackUrl !== candidates[0]) {
    candidates.push(fallbackUrl);
  }

  if (videoEl.dataset.preparedFor === candidates[0]) {
    if (container) {
      container.classList.remove('loading-video-thumb');
    }
    return;
  }

  videoEl.preload = 'metadata';
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('muted', '');
  videoEl.setAttribute('preload', 'metadata');

  const showFallbackState = () => {
    if (container) {
      container.classList.remove('has-video-thumb', 'loading-video-thumb');
    }
    videoEl.removeAttribute('src');
    try {
      videoEl.pause();
    } catch (error) {
      // Niets te doen.
    }
  };

  let candidateIndex = 0;

  const loadCandidate = () => {
    const candidate = candidates[candidateIndex];
    if (!candidate) {
      showFallbackState();
      return;
    }

    videoEl.onloadeddata = null;
    videoEl.onloadedmetadata = null;
    videoEl.onerror = () => {
      candidateIndex += 1;
      loadCandidate();
    };

    videoEl.onloadedmetadata = () => {
      if (container) {
        container.classList.remove('loading-video-thumb');
      }
    };

    videoEl.onloadeddata = () => {
      if (container) {
        container.classList.remove('loading-video-thumb');
      }
    };

    videoEl.dataset.preparedFor = candidate;
    videoEl.src = candidate;
    videoEl.load();
  };

  loadCandidate();
}

function getAbsoluteLayoutBox(el) {
  if (!el) {
    return null;
  }

  let left = 0;
  let top = 0;
  let current = el;

  while (current && current !== document.body) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent;
  }

  return {
    left,
    top,
    width: el.offsetWidth,
    height: el.offsetHeight
  };
}

function findMiniLobbyAnchorBounds() {
  if (!currentScene) {
    return null;
  }

  const activeScene = document.getElementById(`scene-${currentScene}`);
  if (!activeScene) {
    return null;
  }

  const miniLobby = activeScene.querySelector('.mini-lobby');
  if (!miniLobby) {
    return null;
  }

  const anchor = miniLobby.closest('.grid-part') || miniLobby;
  const bounds = getAbsoluteLayoutBox(anchor);

  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  return bounds;
}

function applyOverlayBounds(overlayEl, bounds) {
  overlayEl.style.left = `${bounds.left}px`;
  overlayEl.style.top = `${bounds.top}px`;
  overlayEl.style.width = `${bounds.width}px`;
  overlayEl.style.height = `${bounds.height}px`;
}

function applyOverlayPosition(overlayEl) {
  if (!overlayEl) return;

  const fullscreenScenes = new Set([
    'lobby',
    'waiting-game',
    'round-opendeur-lobby',
    'round-opendeur-video'
  ]);
  const isThreeSixNineScene = currentScene === 'round-369';

  overlayEl.classList.remove('mini-lobby-mode', 'mini-right', 'mini-369');
  if (isThreeSixNineScene) {
    overlayEl.classList.add('mini-369');
  }

  if (fullscreenScenes.has(currentScene)) {
    overlayEl.classList.add('fullscreen');
    applyOverlayBounds(overlayEl, { left: 0, top: 0, width: 1920, height: 1080 });
    return;
  }

  const miniLobbyBounds = findMiniLobbyAnchorBounds();
  if (miniLobbyBounds) {
    overlayEl.classList.remove('fullscreen');
    applyOverlayBounds(overlayEl, miniLobbyBounds);
    return;
  }

  // Fallback: veilige standaard in de linkerbovenhelft als er geen mini-lobby bekend is.
  overlayEl.classList.remove('fullscreen');
  applyOverlayBounds(overlayEl, { left: 0, top: 0, width: 960, height: 540 });
}

function refreshVisibleOverlaysPosition() {
  const presenterOverlay = document.getElementById('presenterOverlay');
  const juryOverlay = document.getElementById('juryOverlay');

  if (presenterOverlay && presenterOverlay.style.display !== 'none') {
    applyOverlayPosition(presenterOverlay);
  }

  if (juryOverlay && juryOverlay.style.display !== 'none') {
    applyOverlayPosition(juryOverlay);
  }
}

const WS_ADDRESS = 'ws://127.0.0.1:8081/';
let ws = null;
let __displayLoopAudioChannels = {};
const desktopBridge = typeof window !== 'undefined' ? window.slimstemensDesktopBridge : null;
let desktopBridgeUnsubscribe = null;
// Audio is altijd enabled voor OBS Studio - geen unlock nodig

function connectWebSocket() {
  if (desktopBridge && typeof desktopBridge.onMessage === 'function') {
    updateScene('waiting-host');
    ws = {
      readyState: WebSocket.OPEN
    };
  } else {
    updateScene('no-connection');
    ws = new WebSocket(WS_ADDRESS);
  }

  ws.onopen = () => updateScene('waiting-host');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (DISPLAY_DEBUG_WS) {
      const introVideoLength = typeof data.introVideoUrl === 'string' ? data.introVideoUrl.length : 0;
      console.log('📨 WS:', {
        type: data.type,
        key: data.key,
        scene: data.scene,
        introVideoLength
      });
    }
    if (data.branding) {
      setDisplayBranding(data.branding);
    }

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
          if (!data.scene) {
            data.scene = 'scene-round-puzzel-waiting';
          }
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
    const loopChannel = data.channel || 'default';

    if (data.action === 'play' && data.src) {
      const a = new Audio(data.src);
      a.currentTime = 0;
      a.play().catch((err) => {
        console.warn('Audio afspelen mislukt:', err);
      });
      return;
    }
    if (data.action === 'loopStart' && data.src) {
      if (__displayLoopAudioChannels[loopChannel]) {
        try {
          __displayLoopAudioChannels[loopChannel].pause();
        } catch(e) {}
      }
      const loopAudio = new Audio(data.src);
      loopAudio.loop = true;
      loopAudio.currentTime = 0;
      __displayLoopAudioChannels[loopChannel] = loopAudio;
      loopAudio.play().catch((err) => {
        console.warn('Loop audio afspelen mislukt:', err);
      });
      return;
    }
    if (data.action === 'loopStop') {
      if (__displayLoopAudioChannels[loopChannel]) {
        try {
          __displayLoopAudioChannels[loopChannel].pause();
          __displayLoopAudioChannels[loopChannel].currentTime = 0;
        } catch(e) {}
        delete __displayLoopAudioChannels[loopChannel];
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
          if (data.action !== 'playVideo' && currentScene !== 'round-369') updateScene('round-369');
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

  if (desktopBridge && typeof desktopBridge.onMessage === 'function') {
    if (desktopBridgeUnsubscribe) {
      desktopBridgeUnsubscribe();
    }

    desktopBridgeUnsubscribe = desktopBridge.onMessage((message) => {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      if (ws && typeof ws.onmessage === 'function') {
        ws.onmessage({ data: payload });
      }
    });
  }

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
    lastThreeSixNineData = { ...(lastThreeSixNineData || {}), ...data };

    console.log('🎵 renderThreeSixNine aangeroepen met data.action:', data.action, 'audioUrl:', data.audioUrl);

    const resolveMedia = (payload, phase = 'question') => {
      if (phase === 'after') {
        return {
          photoUrl: payload.afterPhotoUrl || payload.revealPhotoUrl || null,
          audioUrl: payload.afterAudioUrl || payload.revealAudioUrl || null,
          videoUrl: payload.afterVideoUrl || payload.revealVideoUrl || null
        };
      }

      return {
        photoUrl: payload.questionPhotoUrl || payload.photoUrl || null,
        audioUrl: payload.questionAudioUrl || payload.audioUrl || null,
        videoUrl: payload.questionVideoUrl || payload.videoUrl || null
      };
    };

    const playThreeSixNineFullscreenVideo = (videoUrl) => {
      if (!videoUrl) return;

      const videoPlayer = document.getElementById('threeSixNineVideoPlayer');
      const videoSource = document.getElementById('threeSixNineVideoSource');
      if (!videoPlayer || !videoSource) return;

      threeSixNineVideoActive = true;
      updateScene('round-369-video');

      const finish = () => {
        if (!threeSixNineVideoActive) return;
        threeSixNineVideoActive = false;

        videoPlayer.onended = null;
        videoPlayer.onerror = null;
        try {
          videoPlayer.pause();
          videoPlayer.currentTime = 0;
        } catch (e) {}

        if (videoSource) {
          videoSource.src = '';
          videoPlayer.load();
        }

        updateScene('round-369');
        if (lastThreeSixNineData) {
          renderThreeSixNine({ ...lastThreeSixNineData, action: null });
        }
      };

      videoSource.src = videoUrl;
      videoPlayer.load();
      videoPlayer.onended = finish;
      videoPlayer.onerror = finish;
      videoPlayer.play().catch(() => finish());
    };

    const stopThreeSixNineFullscreenVideo = () => {
      const videoPlayer = document.getElementById('threeSixNineVideoPlayer');
      const videoSource = document.getElementById('threeSixNineVideoSource');
      if (!videoPlayer || !videoSource) return;

      threeSixNineVideoActive = false;
      videoPlayer.onended = null;
      videoPlayer.onerror = null;

      try {
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
      } catch (e) {}

      videoSource.src = '';
      videoPlayer.load();

      updateScene('round-369');
      if (lastThreeSixNineData) {
        renderThreeSixNine({ ...lastThreeSixNineData, action: null });
      }
    };

    const stopThreeSixNineAudio = () => {
      if (!threeSixNineActiveAudio) return;

      try {
        threeSixNineActiveAudio.pause();
        threeSixNineActiveAudio.currentTime = 0;
      } catch (e) {}

      threeSixNineActiveAudio = null;
    };
    
    // Audio afspelen EERST checken voordat we andere dingen doen
    if (data.action === 'playAudio' && data.audioUrl) {
        console.log('🔊 Poging audio af te spelen:', data.audioUrl);
      stopThreeSixNineAudio();
      const audio = new Audio(data.audioUrl);
      threeSixNineActiveAudio = audio;
        
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
          if (threeSixNineActiveAudio === audio) {
            threeSixNineActiveAudio = null;
          }
        });
    }

      if (data.action === 'stopAudio') {
        stopThreeSixNineAudio();
        return;
      }

      if (data.action === 'playVideo' && data.videoUrl) {
        playThreeSixNineFullscreenVideo(data.videoUrl);
        return;
      }

      if (data.action === 'stopVideo') {
        stopThreeSixNineFullscreenVideo();
        return;
      }
    
    if (data.action === 'togglePhoto' && data.photoUrl) {
      const photoContainer = document.getElementById('threeSixNinePhotoContainer');
      if (photoContainer) {
        if (data.photoVisible) {
          photoContainer.innerHTML = `<img src="${data.photoUrl}" alt="Vraagfoto" />`;
          photoContainer.style.display = 'block';
        } else {
          photoContainer.style.display = 'none';
          photoContainer.innerHTML = '';
        }
      }
      return;
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
        const activeMediaPhase = data.activeMediaPhase || 'question';
        const phaseMedia = resolveMedia(data, activeMediaPhase);

        roundStatusEl.textContent = `Beurt: ${activePlayerName} | Vraag ${data.currentQuestionIndex} van ${data.maxQuestions}`;
        
        // Render vraag op basis van type
        let questionHTML = '';
        
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
        
        // Foto weergave in linkervlak (zonder extra status-tekst in de vraag).
        if (phaseMedia.photoUrl) {
            if (data.photoVisible) {
                // Toon foto in linkervlak
                setTimeout(() => {
                    const photoContainer = document.getElementById('threeSixNinePhotoContainer');
              if (photoContainer && phaseMedia.photoUrl) {
                photoContainer.innerHTML = `<img src="${phaseMedia.photoUrl}" alt="Vraagfoto" />`;
                        photoContainer.style.display = 'block';
                    }
                }, 0);
            } else {
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

        roundQuestionEl.innerHTML = questionHTML;
        
        // Pas font-size aan op basis van vraaglengte
        if (qType === 'multiple-choice') {
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

    
    container.innerHTML = data.questioners.map(q => {
      const introThumbnailUrl = getOpenDeurIntroThumbnailUrl(q);
      const hasVideoThumb = !!q.introVideoUrl && !introThumbnailUrl;
      const mediaMarkup = introThumbnailUrl
        ? `<img class="vragensteller-thumb" src="${introThumbnailUrl}" alt="Thumbnail voor ${q.name}" loading="eager" decoding="async" aria-hidden="true">`
        : (hasVideoThumb
          ? `<video class="vragensteller-thumb" muted playsinline preload="metadata" aria-hidden="true"></video>`
          : '');
      const videoOverlayMarkup = (introThumbnailUrl || hasVideoThumb)
        ? `<div class="vragensteller-thumb-overlay" aria-hidden="true"></div>`
        : '';

      return `
        <div class="vragensteller-box${q.isChosen ? ' gespeeld' : ' beschikbaar'}${(introThumbnailUrl || hasVideoThumb) ? ' has-video-thumb' : ''}" data-questioner-index="${q.index}" data-video-url="${q.introVideoUrl || ''}" data-thumb-url="${introThumbnailUrl}">
          ${mediaMarkup}
          ${videoOverlayMarkup}
          <div class="vragensteller-name">${q.name}</div>
        </div>
      `;
    }).join('');

    data.questioners.forEach((questioner) => {
      if (questioner.introVideoUrl) {
        preloadOpenDeurIntroVideo(questioner.introVideoUrl);
      }

      const introThumbnailUrl = getOpenDeurIntroThumbnailUrl(questioner);
      if (introThumbnailUrl) {
        return;
      }

      if (!questioner.introVideoUrl) {
        return;
      }

      const videoEl = container.querySelector(`.vragensteller-box[data-questioner-index="${questioner.index}"] .vragensteller-thumb`);
      const box = videoEl?.closest('.vragensteller-box');
      if (box && !openDeurPreparedThumbUrls.has(questioner.introVideoUrl)) {
        box.classList.add('loading-video-thumb');
      }
      prepareOpenDeurQuestionerVideo(videoEl, questioner.introVideoUrl);
      openDeurPreparedThumbUrls.add(questioner.introVideoUrl);
    });

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
    const introThumbnailUrl = getOpenDeurIntroThumbnailUrl(data.currentQuestion) || getOpenDeurIntroThumbnailUrl(data);

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

    preloadOpenDeurIntroVideo(introVideoUrl);

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
      renderPlayersBarUniversal(null, vraagData.activeIndex);
    };

    updateScene('round-opendeur-video');
    if (introThumbnailUrl) {
      videoPlayer.poster = introThumbnailUrl;
    } else {
      videoPlayer.removeAttribute('poster');
    }

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
    const incomingPlayers = Array.isArray(data.players)
      ? data.players
      : (Array.isArray(data.playersData) ? data.playersData : []);
    if (incomingPlayers.length > 0) {
      players = incomingPlayers;
    }
    const playersData = incomingPlayers.length > 0 ? incomingPlayers : players;
    const activeIndex = data.activeIndex ?? -1;
  const scene = data.scene || (Array.isArray(data.puzzelWords) ? 'scene-round-puzzel-active' : 'scene-round-puzzel-waiting');

  if (scene === 'scene-round-puzzel-active') {
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
              requestAnimationFrame(() => adjustPuzzelWordFontSizes(puzzelTableEl));
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

    } else if (scene === 'scene-round-puzzel-waiting') {
        updateScene('round-puzzel-waiting');
        renderMiniLobby(playersData, 'puzzelPreMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelPrePlayersBar');
    } 
    else if (scene === 'scene-round-puzzel-done') {
      updateScene('round-puzzel-done');
        renderMiniLobby(playersData, 'puzzelDoneMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelDonePlayersBar');
    }
}

function adjustPuzzelWordFontSizes(puzzelTableEl) {
  if (!puzzelTableEl) return;

  const wordEls = Array.from(puzzelTableEl.querySelectorAll('.puzzel-word'));
  if (!wordEls.length) return;

  const measurer = document.createElement('span');
  measurer.style.position = 'absolute';
  measurer.style.visibility = 'hidden';
  measurer.style.whiteSpace = 'nowrap';
  measurer.style.pointerEvents = 'none';
  measurer.style.left = '-99999px';
  measurer.style.top = '-99999px';
  document.body.appendChild(measurer);

  wordEls.forEach((wordEl) => {
    wordEl.style.fontSize = '';
    wordEl.classList.remove('puzzel-word-compact');

    const fullText = (wordEl.textContent || '').trim();
    if (!fullText) return;

    const tokens = fullText.split(/\s+/).filter(Boolean);
    if (!tokens.length) return;

    const longestToken = tokens.reduce((longest, token) => (
      token.length > longest.length ? token : longest
    ), tokens[0]);

    const computed = window.getComputedStyle(wordEl);
    const baseFontSize = parseFloat(computed.fontSize) || 32;

    measurer.style.fontFamily = computed.fontFamily;
    measurer.style.fontWeight = computed.fontWeight;
    measurer.style.fontSize = `${baseFontSize}px`;
    measurer.style.letterSpacing = computed.letterSpacing;
    measurer.textContent = longestToken;

    const tokenWidth = measurer.getBoundingClientRect().width;
    const horizontalPadding = (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
    const horizontalBorder = (parseFloat(computed.borderLeftWidth) || 0) + (parseFloat(computed.borderRightWidth) || 0);
    const availableWidth = Math.max(0, wordEl.clientWidth - horizontalPadding - horizontalBorder - 6);

    if (tokenWidth <= availableWidth || availableWidth <= 0) return;

    const scale = Math.max(0.62, Math.min(1, availableWidth / tokenWidth));
    const resizedFont = Math.max(18, Math.floor(baseFontSize * scale));

    if (resizedFont < baseFontSize) {
      wordEl.style.fontSize = `${resizedFont}px`;
      wordEl.classList.add('puzzel-word-compact');
    }
  });

  document.body.removeChild(measurer);
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
            
            winnerTitleEl.textContent = '';
            winnerTitleEl.appendChild(document.createTextNode('is'));
            winnerTitleEl.appendChild(createBrandingBarElement('initial-title-bar-2'));
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
  introState.audioPlaying = new Audio('SFX/generiek-lang.mp3');
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
          winnerTitleEl.textContent = '';
          winnerTitleEl.appendChild(document.createTextNode('is'));
          winnerTitleEl.appendChild(createBrandingBarElement('initial-title-bar-2'));
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
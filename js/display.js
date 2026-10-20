let currentScene = null;
let roundBumperState = null;
let players = [];
const universalPerspectiveStyles = new Map();
let universalPerspectivePreviousScene = null;
let universalPerspectivePreviousStandings = null;
let activeUniversalPerspectiveData = null;
const UNIVERSAL_PERSPECTIVE_ZOOM_SCALE = 2.6;
const UNIVERSAL_PERSPECTIVE_FULLSCREEN_ZOOM_SCALE = 4.2;
const UNIVERSAL_PERSPECTIVE_VERTICAL_OFFSET = -55; // Pas dit getal aan om de kandidaat hoger of lager te plaatsen.
const CANDIDATE_SCORE_ROTATION_DURATION_MS = 10000;
const candidateScoreRotationStates = new Map();
let scoreCirclePlayerAssignments = new WeakMap();
const detachedScoreCircleParents = new Map();
let showingStandings = false;
let showingLobbyStandings = false;
let lobbyStandingsRevealed = false;
let showingThreeSixNineLobbyPerspective = false;
let threeSixNineImagePerspectiveMode = 'mini-lobby';
let threeSixNinePerspectivePhotoVisible = null;
let threeSixNineOptionsPerspectiveMode = 'together';
let questionQuarterPerspective = null;
let questionQuarterPerspectiveViewport = null;
let questionQuarterPerspectiveTarget = null;
let questionQuarterTargetPreviousPosition = '';
let questionQuarterHiddenMiniLobby = null;
let openDeurActiveScoreData = null;
let puzzelActiveScoreData = null;
let galerijActiveScoreData = null;
let collectiefMainScoreData = null;
let galerijAutomaticPerspectivesEnabled = false;
const questionQuarterTransformedElements = new Set();
const canonicalRoundDisplayNames = {
  '369': '3-6-9',
  threesixnine: '3-6-9',
  opendeur: 'Open Deur',
  puzzel: 'Puzzel',
  galerij: 'Galerij',
  collectief: 'Collectief Geheugen',
  collectiefgeheugen: 'Collectief Geheugen',
  finale: 'Finale'
};

function getCanonicalRoundDisplayName(value) {
  const normalized = String(value || '').replace(/^(het|de)\s+/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return canonicalRoundDisplayNames[normalized] || String(value || '').trim();
}

function showHostAnswerReveal(answer) {
  const overlay = document.getElementById('hostAnswerRevealOverlay');
  const answerText = document.getElementById('hostAnswerRevealText');
  if (!overlay || !answerText || typeof answer !== 'string' || !answer.trim()) {
    console.warn('Antwoordonthulling niet weergegeven: overlay of antwoord ontbreekt.');
    return;
  }

  answerText.textContent = answer;
  overlay.hidden = false;
  clearTimeout(hostAnswerRevealTimeout);
  hostAnswerRevealTimeout = setTimeout(() => {
    overlay.hidden = true;
    answerText.textContent = '';
  }, 7000);
}

let currentRoundDisplayName = '';
let currentRoundDisplayKey = '';
let finaleGameComplete = false;
let defaultThreeSixNineMax = 12;
let perRoundState = { max: defaultThreeSixNineMax };
let allGalleryAnswers = []; 
const answerRevealStates = new WeakMap();
let openDeurIntroVideoActive = false;
let openDeurPendingVraagData = null;
let collectiefPreloadedVideoUrl = '';
let threeSixNineVideoActive = false;
let lastThreeSixNineData = null;
let threeSixNineActiveAudio = null;
let hostAnswerRevealTimeout = null;
const DEFAULT_DISPLAY_BRANDING = {
  titlePrefix: 'de slimste mens',
  titleSuffix: '',
  logoPath: 'assets/slimstemens.png'
};
const DISPLAY_DEBUG_WS = false;
let displayBranding = { ...DEFAULT_DISPLAY_BRANDING };

function hideFinaleCandidatePerspective() {
  const overlay = document.getElementById('finaleCandidatePerspectiveOverlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
}

function updatePresenterOverlayTheme() {
  const overlay = document.getElementById('presenterOverlay');
  if (!overlay) return;
  const finaleInProgress = currentRoundDisplayKey === 'finale' && !finaleGameComplete;
  const background = overlay.querySelector('.presenter-background');
  const desk = overlay.querySelector('.presenter-desk');
  if (background) {
    background.src = finaleInProgress
      ? 'assets/finale/achtergrondpresentator.png'
      : 'assets/presentator.png';
    background.alt = finaleInProgress ? 'Finale presentatorachtergrond' : 'Presentator achtergrond';
  }
  if (desk) desk.style.display = finaleInProgress ? 'none' : '';
}

function showFinaleCandidatePerspective(data) {
  const overlay = document.getElementById('finaleCandidatePerspectiveOverlay');
  const photo = document.getElementById('finaleCandidatePerspectivePhoto');
  if (!overlay || !photo) return;
  if (!data.showing) {
    hideFinaleCandidatePerspective();
    return;
  }
  if (currentRoundDisplayKey !== 'finale' || finaleGameComplete) {
    console.warn('Finalistperspectief niet toegepast buiten de actieve finale.');
    hideFinaleCandidatePerspective();
    return;
  }

  photo.src = data.photoUrl || 'assets/avatar.png';
  photo.alt = data.playerName || 'Finalist';
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
}

function animateNewlyFoundAnswers(container, stateKey) {
  if (!container) return;

  const previousState = answerRevealStates.get(container);
  const currentKey = String(stateKey ?? '');
  const foundAnswers = Array.from(container.children)
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.classList.contains('found'));
  const foundIndexes = new Set(foundAnswers.map(({ index }) => String(index)));

  if (previousState?.key === currentKey) {
    foundAnswers.forEach(({ element, index }) => {
      if (!previousState.foundIndexes.has(String(index))) {
        element.classList.add('answer-correct');
      }
    });
  }

  answerRevealStates.set(container, { key: currentKey, foundIndexes });
}

function getAnswerRevealKey(data, fallback = '') {
  return [
    data.key || data.scene || fallback,
    data.currentQuestion?.id || data.currentQuestion?.questionText || '',
    data.questionText || data.question || '',
    data.currentPuzzelIndex ?? '',
    data.imageIndex ?? ''
  ].join(':');
}

function normalizeDisplayBranding(branding) {
  const merged = {
    ...DEFAULT_DISPLAY_BRANDING,
    ...(branding || {})
  };

  return {
    titlePrefix: String(merged.titlePrefix || DEFAULT_DISPLAY_BRANDING.titlePrefix).trim() || DEFAULT_DISPLAY_BRANDING.titlePrefix,
    titleSuffix: String(merged.titleSuffix ?? DEFAULT_DISPLAY_BRANDING.titleSuffix).trim(),
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
    if (currentScene !== sceneName) {
      clearQuestionQuarterPerspective();
      if (sceneName !== 'round-369') {
        showingThreeSixNineLobbyPerspective = false;
      }
      clearUniversalPerspective();
      if (universalPerspectivePreviousScene && sceneName !== 'lobby') {
        universalPerspectivePreviousScene = null;
      }
    }
    document.querySelectorAll('.scene').forEach(s => {
  const isStandingsScene = showingStandings && (
    (currentRoundDisplayKey === 'finale' && s.id === 'scene-finale-standings') ||
    (currentRoundDisplayKey !== 'finale' && s.id === 'scene-standings')
  );
  const isLobbyStandingsScene = showingLobbyStandings && s.id === 'scene-lobby-standings';
  s.style.display = (s.id === `scene-${sceneName}` || isStandingsScene || isLobbyStandingsScene) ? 'flex' : 'none';
    });
    const wideLobby = document.getElementById('threeSixNineWideLobby');
    if (wideLobby) {
      wideLobby.style.display = sceneName === 'round-369' && showingThreeSixNineLobbyPerspective ? 'block' : 'none';
    }
    currentScene = sceneName;
  if (roundBumperState?.phase === 'covered') {
    startRoundBumperExit();
  }
  renderQuestionQuarterPerspective();
  refreshVisibleOverlaysPosition();
}

function sendRoundBumperCovered(bumperId) {
  if (!bumperId) return;

  const message = JSON.stringify({ type: 'bumper_covered', bumperId });
  if (desktopBridge && typeof desktopBridge.send === 'function') {
    desktopBridge.send(message);
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(message);
    return;
  }

  console.warn('De rondebumper is niet aan de host bevestigd; de host valt terug op de time-out.');
}

function startRoundBumperExit() {
  if (!roundBumperState || roundBumperState.phase === 'exiting') return;

  const overlay = document.getElementById('roundBumperOverlay');
  const oval = document.getElementById('roundBumperOval');
  if (!overlay || !oval) {
    console.error('De rondebumper kan niet worden afgesloten: de overlay ontbreekt.');
    roundBumperState = null;
    return;
  }

  roundBumperState.phase = 'exiting';
  overlay.classList.remove('is-entering');
  overlay.classList.add('is-exiting');
}

function handleRoundBumperAnimationEnd(event) {
  if (event.target.id !== 'roundBumperOval' || !roundBumperState) return;

  const overlay = document.getElementById('roundBumperOverlay');
  if (!overlay) {
    console.error('De rondebumper kan niet worden afgerond: de overlay ontbreekt.');
    roundBumperState = null;
    return;
  }

  if (event.animationName === 'roundBumperEnter' && roundBumperState.phase === 'entering') {
    roundBumperState.phase = 'covered';
    overlay.classList.remove('is-entering');
    sendRoundBumperCovered(roundBumperState.id);
    return;
  }

  if (event.animationName === 'roundBumperExit' && roundBumperState.phase === 'exiting') {
    overlay.classList.remove('is-active', 'is-exiting');
    overlay.setAttribute('aria-hidden', 'true');
    roundBumperState = null;
  }
}

function getOpenDeurIntroThumbnailUrl(questioner) {
  if (!questioner) {
    return '';
  }

  return String(
    questioner.introThumbnailUrl || questioner.thumbnailUrl || questioner.introImageUrl || questioner.posterUrl || ''
  ).trim();
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

function applyOverlayPosition(overlayEl, forceFullscreen = false) {
  if (!overlayEl) return;

  const fullscreenScenes = new Set([
    'lobby',
    'waiting-game',
    'waiting-host',
    'round-opendeur-lobby',
    'round-opendeur-video'
  ]);
  const isThreeSixNineScene = currentScene === 'round-369';
  const finaleLobby = currentScene === 'round-finale-end'
    ? document.querySelector('#scene-round-finale-end .finale-lobby-content')
    : null;
  const isFinaleLobbyFullscreen = !!finaleLobby && getComputedStyle(finaleLobby).display !== 'none';

  overlayEl.classList.remove('mini-lobby-mode', 'mini-right', 'mini-369');
  if (isThreeSixNineScene) {
    overlayEl.classList.add('mini-369');
  }

  if (forceFullscreen || fullscreenScenes.has(currentScene) || isFinaleLobbyFullscreen) {
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
    applyOverlayPosition(presenterOverlay, presenterOverlay.dataset.forceFullscreen === 'true');
  }

  if (juryOverlay && juryOverlay.style.display !== 'none') {
    applyOverlayPosition(juryOverlay, juryOverlay.dataset.forceFullscreen === 'true');
  }
}

const WS_ADDRESS = 'ws://127.0.0.1:8081/';
let ws = null;
let __displayLoopAudioChannels = {};
const desktopBridge = typeof window !== 'undefined' ? window.slimstemensDesktopBridge : null;
let desktopBridgeUnsubscribe = null;
// Audio is altijd enabled voor OBS Studio - geen unlock nodig

function disableElectronRoundVideoAutoplay() {
  if (!desktopBridge) {
    return;
  }

  ['openDeurIntroVideoPlayer', 'collectiefVideoPlayer'].forEach((id) => {
    const videoPlayer = document.getElementById(id);
    if (!videoPlayer) {
      return;
    }

    videoPlayer.autoplay = false;
    videoPlayer.removeAttribute('autoplay');
    videoPlayer.pause();
  });
}

function connectWebSocket() {
  disableElectronRoundVideoAutoplay();

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

    if (data.dismissScoreboard) {
      showingStandings = false;
      showingLobbyStandings = false;
    }

    switch (data.type) {
      case 'audio':
        handleAudioMessage(data);
        break;
      case 'host_answer_reveal':
        showHostAnswerReveal(data.answer);
        break;
      case 'init':
        updateScene('waiting-game');
        break;

      case 'scene_change':
        if (data.scene === 'lobby') {
          resetCandidateScoreRotations();
          universalPerspectivePreviousScene = null;
          clearUniversalPerspective();
          if (data.players) players = data.players;
          updateScene('lobby');
          renderLobby(players);
        }
        break;

      case 'players':
        if (Array.isArray(data.players)) players = data.players;
        if (showingLobbyStandings) {
          renderLobbyStandings(players, lobbyStandingsRevealed);
          break;
        }
        if (showingStandings) {
          renderStandings(players);
          break;
        }
        if (data.round && data.round !== 'lobby') {
          updatePlayersBarsFromGeneric(players, data.active ?? data.activeIndex ?? -1);
          if (currentScene === 'round-collectief-main' && collectiefMainScoreData) {
            collectiefMainScoreData.players = players;
            collectiefMainScoreData.activeIndex =
              data.active ?? data.activeIndex ?? collectiefMainScoreData.activeIndex;
            renderCollectiefMainScores(collectiefMainScoreData);
          }
          if (
            galerijActiveScoreData &&
            (currentScene === 'round-galerij-main' || currentScene === 'round-galerij-aanvul')
          ) {
            galerijActiveScoreData.players = players;
            renderGalerijActiveScore(galerijActiveScoreData);
          }
          break;
        }
        updateScene('lobby');
        renderLobby(players);
        break;

      case 'round_start':
        currentRoundDisplayName = getCanonicalRoundDisplayName(data.name || data.key);
        currentRoundDisplayKey = data.key || '';
        if (data.key !== 'threeSixNine') {
          if (threeSixNineVideoActive) {
            threeSixNineVideoActive = false;
            const videoPlayer = document.getElementById('threeSixNineVideoPlayer');
            const videoSource = document.getElementById('threeSixNineVideoSource');
            if (videoPlayer) {
              videoPlayer.onended = null;
              videoPlayer.onerror = null;
              videoPlayer.pause();
              if (videoPlayer.readyState > 0) {
                videoPlayer.currentTime = 0;
              }
            }
            if (videoSource && videoPlayer) {
              videoSource.src = '';
              videoPlayer.load();
            }
          }
          lastThreeSixNineData = null;
        }
        finaleGameComplete = false;
        document.querySelectorAll(
          '#finale-main-grid, #finale-pre-grid, #scene-finale-standings .finale-standings-grid'
        ).forEach(grid => grid.classList.remove('finale-faceoff-wide'));
        hideFinaleCandidatePerspective();
        updatePresenterOverlayTheme();
        
        if (data.key === 'threeSixNine') {
          lastThreeSixNineData = null;
          threeSixNineImagePerspectiveMode = 'mini-lobby';
          threeSixNinePerspectivePhotoVisible = null;
          threeSixNineOptionsPerspectiveMode = 'together';
          const photoContainer = document.getElementById('threeSixNinePhotoContainer');
          const answersContainer = document.getElementById('threeSixNineAnswersContainer');
          const scene = document.getElementById('scene-round-369');
          if (scene) scene.dataset.photoPerspective = threeSixNineImagePerspectiveMode;
          if (scene) scene.dataset.optionsPerspective = threeSixNineOptionsPerspectiveMode;
          if (photoContainer) {
            photoContainer.style.display = 'none';
            photoContainer.replaceChildren();
          }
          if (answersContainer) {
            answersContainer.style.display = 'none';
            answersContainer.replaceChildren();
          }
          if (data.players) players = data.players;
          updateScene('round-369');
          if (Number.isFinite(data.maxQuestions)) perRoundState.max = data.maxQuestions;
          perRoundState.currentQuestionIndex = null;
          renderMiniLobby(players, 'miniLobbyPlayers');
          renderPlayersBarUniversal(null, normalizeActiveIndex(players, data.activeIndex));
          document.getElementById('roundName').textContent = currentRoundDisplayName;
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
      if (Number.isFinite(data.playbackRate) && data.playbackRate > 0) {
        loopAudio.playbackRate = data.playbackRate;
      }
      __displayLoopAudioChannels[loopChannel] = loopAudio;
      loopAudio.play().catch((err) => {
        console.warn('Loop audio afspelen mislukt:', err);
      });
      return;
    }
    if (data.action === 'loopRate') {
      const loopAudio = __displayLoopAudioChannels[loopChannel];
      if (loopAudio && Number.isFinite(data.playbackRate) && data.playbackRate > 0) {
        loopAudio.playbackRate = data.playbackRate;
      }
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
        if (Array.isArray(data.players)) players = data.players;

        
        if (
          currentRoundDisplayKey === 'threeSixNine' &&
          (data.currentRoundName === 'threeSixNine' || data.scene === 'round-369')
        ) {
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
        const bumperOverlay = document.getElementById('roundBumperOverlay');
        const bumperOval = document.getElementById('roundBumperOval');
        const bumperTitle = document.getElementById('bumperRoundTitle');
        if (!bumperOverlay || !bumperOval || !bumperTitle) {
          console.error('De rondebumper kan niet worden getoond: de overlay ontbreekt.');
          break;
        }

        roundBumperState = {
          id: typeof data.bumperId === 'string' ? data.bumperId : null,
          phase: 'entering'
        };
        bumperTitle.textContent = data.roundTitle || 'RONDE';
        bumperOval.onanimationend = handleRoundBumperAnimationEnd;
        bumperOverlay.classList.remove('is-entering', 'is-exiting');
        bumperOverlay.classList.add('is-active');
        bumperOverlay.setAttribute('aria-hidden', 'false');
        void bumperOval.offsetWidth;
        bumperOverlay.classList.add('is-entering');
        
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
        updatePresenterOverlayTheme();
        if (data.showing) hideFinaleCandidatePerspective();

        if (data.showing && (showingStandings || showingLobbyStandings)) {
          showingStandings = false;
          showingLobbyStandings = false;
          updateScene(currentScene || 'lobby');
        }
        
        if (data.showing && data.photoData) {
          if (juryOverlay) juryOverlay.style.display = 'none';
          presenterOverlay.dataset.forceFullscreen = String(!!data.fullscreen);
          applyOverlayPosition(presenterOverlay, !!data.fullscreen);
          
          // Toon presentator
          presenterPhoto.src = data.photoData;
          presenterOverlay.style.display = 'flex';
        } else {
          // Verberg presentator, toon kandidaten
          presenterOverlay.style.display = 'none';
          presenterOverlay.dataset.forceFullscreen = 'false';
        }
        break;

      case 'finale_candidate_perspective': {
        if (data.showing) {
          const presenterOverlay = document.getElementById('presenterOverlay');
          const juryOverlay = document.getElementById('juryOverlay');
          if (presenterOverlay) presenterOverlay.style.display = 'none';
          if (juryOverlay) juryOverlay.style.display = 'none';
        }
        showFinaleCandidatePerspective(data);
        break;
      }

      case 'finale_faceoff_perspective':
        document.querySelectorAll(
          '#finale-main-grid, #finale-pre-grid, #scene-finale-standings .finale-standings-grid'
        ).forEach(grid => grid.classList.toggle('finale-faceoff-wide', !!data.showing));
        break;

      case 'jury_toggle': {
        const juryOverlay = document.getElementById('juryOverlay');
        const presenterOverlay = document.getElementById('presenterOverlay');
        const juryImage = document.getElementById('juryImage');
        const juryMemberPhoto = document.getElementById('juryMemberPhoto');
        if (data.showing && (showingStandings || showingLobbyStandings)) {
          showingStandings = false;
          showingLobbyStandings = false;
          updateScene(currentScene || 'lobby');
        }
        if (data.showing) {
          if (presenterOverlay) presenterOverlay.style.display = 'none';
          hideFinaleCandidatePerspective();
          const customJury = data.mode === 'custom' && data.photoData;
          if (juryImage) juryImage.src = customJury ? 'assets/jurystoel.png' : 'assets/jury.png';
          if (juryMemberPhoto) {
            juryMemberPhoto.src = customJury ? data.photoData : '';
            juryMemberPhoto.style.display = customJury ? 'block' : 'none';
          }
          juryOverlay.dataset.forceFullscreen = String(!!data.fullscreen);
          applyOverlayPosition(juryOverlay, !!data.fullscreen);
          if (juryOverlay) juryOverlay.style.display = 'flex';
        } else if (juryOverlay) {
          juryOverlay.style.display = 'none';
          juryOverlay.dataset.forceFullscreen = 'false';
        }
        break;
      }

      case 'scoreboard_toggle': {
        showingThreeSixNineLobbyPerspective = false;
        showingLobbyStandings = !!data.showing && !!data.lobbyStandings;
        showingStandings = !!data.showing && !showingLobbyStandings;
        lobbyStandingsRevealed = false;
        if (Array.isArray(data.players)) players = data.players;
        if (showingStandings) {
          const standingsRoundName = document.getElementById('standingsRoundName');
          if (standingsRoundName) {
            standingsRoundName.textContent = getCanonicalRoundDisplayName(data.roundName || currentRoundDisplayName) || '—';
          }
          const presenterOverlay = document.getElementById('presenterOverlay');
          const juryOverlay = document.getElementById('juryOverlay');
          if (presenterOverlay) presenterOverlay.style.display = 'none';
          if (juryOverlay) juryOverlay.style.display = 'none';
          renderStandings(players);
        }
        if (showingLobbyStandings) renderLobbyStandings(players, lobbyStandingsRevealed);
        updateScene(currentScene || 'lobby');
        break;
      }

      case 'three_six_nine_lobby_perspective': {
        showingThreeSixNineLobbyPerspective =
          !!data.showing && currentScene === 'round-369';
        if (showingThreeSixNineLobbyPerspective) {
          const presenterOverlay = document.getElementById('presenterOverlay');
          const juryOverlay = document.getElementById('juryOverlay');
          if (presenterOverlay) presenterOverlay.style.display = 'none';
          if (juryOverlay) juryOverlay.style.display = 'none';
          renderThreeSixNineLobbyPerspective(players);
        }
        updateScene(currentScene || 'lobby');
        break;
      }

      case 'three_six_nine_image_perspective': {
        const allowedModes = new Set(['mini-lobby', 'question-quarter', 'near-fullscreen']);
        if (allowedModes.has(data.mode)) {
          threeSixNineImagePerspectiveMode = data.mode;
          if (typeof data.showing === 'boolean') {
            threeSixNinePerspectivePhotoVisible = data.showing;
          }
          const scene = document.getElementById('scene-round-369');
          if (scene) scene.dataset.photoPerspective = threeSixNineImagePerspectiveMode;
          if (lastThreeSixNineData && typeof data.showing === 'boolean') {
            renderThreeSixNine({
              ...lastThreeSixNineData,
              action: null,
              photoVisible: data.showing
            });
          }
        }
        break;
      }

      case 'three_six_nine_options_perspective': {
        const allowedModes = new Set(['together', 'question-quarter', 'mini-lobby']);
        if (allowedModes.has(data.mode)) {
          threeSixNineOptionsPerspectiveMode = data.mode;
          const scene = document.getElementById('scene-round-369');
          if (scene) scene.dataset.optionsPerspective = threeSixNineOptionsPerspectiveMode;
          if (lastThreeSixNineData) {
            renderThreeSixNine({ ...lastThreeSixNineData, action: null });
          }
        }
        break;
      }

      case 'lobby_standings_reveal': {
        if (Array.isArray(data.players)) players = data.players;
        lobbyStandingsRevealed = true;
        const scorePanel = document.getElementById('lobbyStandingsScorePanel');
        if (showingLobbyStandings && scorePanel) {
          renderLobbyStandings(players, lobbyStandingsRevealed);
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

      case 'universal_perspective':
        handleUniversalPerspectiveChange(data);
        break;

      case 'question_quarter_perspective':
        questionQuarterPerspective = data.perspective || null;
        if (typeof data.automaticSceneChangesEnabled === 'boolean') {
          galerijAutomaticPerspectivesEnabled = data.automaticSceneChangesEnabled;
        }
        if (
          openDeurActiveScoreData &&
          typeof data.automaticSceneChangesEnabled === 'boolean'
        ) {
          openDeurActiveScoreData.automaticSceneChangesEnabled =
            data.automaticSceneChangesEnabled;
        }
        if (
          puzzelActiveScoreData &&
          typeof data.automaticSceneChangesEnabled === 'boolean'
        ) {
          puzzelActiveScoreData.automaticSceneChangesEnabled =
            data.automaticSceneChangesEnabled;
        }
        renderQuestionQuarterPerspective();
        renderOpenDeurActiveScore(openDeurActiveScoreData);
        renderPuzzelActiveScore(puzzelActiveScoreData);
        if (
          galerijActiveScoreData &&
          typeof data.automaticSceneChangesEnabled === 'boolean'
        ) {
          galerijActiveScoreData.automaticSceneChangesEnabled =
            data.automaticSceneChangesEnabled;
        }
        renderGalerijActiveScore(galerijActiveScoreData);
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
    const playersToRender = Array.isArray(players) ? players : [];
    el.innerHTML = playersToRender.map(p => `<div class="player" data-player-index="${p.index}"><img src="${p.photoUrl || 'assets/avatar.png'}"></div>`).join('');
    renderQuestionQuarterPerspective();
}

function updateVisibleMiniLobbyPlayers(playersData) {
  if (!Array.isArray(playersData) || !currentScene) return;

  const scene = document.getElementById(`scene-${currentScene}`);
  if (!scene) return;

  const playersByIndex = new Map(playersData.map(player => [String(player.index), player]));
  scene.querySelectorAll('.mini-lobby .player[data-player-index]').forEach(playerElement => {
    const player = playersByIndex.get(playerElement.dataset.playerIndex);
    const image = playerElement.querySelector('img');
    if (!player || !image) return;

    image.src = player.photoUrl || 'assets/avatar.png';
    image.alt = player.name || 'Kandidaat';
  });
}

function renderFinaleCandidatePhotos(
  players,
  activeIndex = null,
  photoIds = ['finaleCandidatePhotoLeft', 'finaleCandidatePhotoRight'],
  scoreIds = ['finaleCandidateScoreLeft', 'finaleCandidateScoreRight'],
  timerRunning = false
) {
  const finalists = (players || []).filter(player => !player.isOut).slice(0, 2);
  const normalizedActiveIndex = normalizeActiveIndex(finalists, activeIndex);
  finalists.forEach((finalist, index) => {
    const photo = document.getElementById(photoIds[index]);
    const score = scoreIds[index] ? document.getElementById(scoreIds[index]) : null;
    if (photo && finalist) {
      photo.src = finalist.photoUrl || 'assets/avatar.png';
      photo.alt = finalist.name || 'Kandidaat';
    }
    if (score && finalist) {
      const isActive = !!finalist.isActive || index === normalizedActiveIndex;
      let scoreFace = score.querySelector('.score-oval-face');
      if (!scoreFace) {
        scoreFace = document.createElement('span');
        scoreFace.className = 'score-oval-face';
        score.replaceChildren(scoreFace);
        score.classList.add('score-oval-reveal');
      }
      scoreFace.textContent = finalist.seconds ?? '';
      updateCandidateScoreRotation(
        score,
        finalist.index ?? index,
        timerRunning && isActive
      );
      score.classList.toggle('active-player', isActive);
      score.classList.toggle('timer-running', timerRunning && isActive);
    } else if (score) {
      updateCandidateScoreRotation(score, null, false);
      score.classList.remove('active-player', 'timer-running');
    }
  });

  for (let index = finalists.length; index < scoreIds.length; index += 1) {
    const score = document.getElementById(scoreIds[index]);
    if (!score) continue;
    updateCandidateScoreRotation(score, null, false);
    score.classList.remove('active-player', 'timer-running');
  }
}

function normalizeScoreRotation(phase) {
  return ((phase % CANDIDATE_SCORE_ROTATION_DURATION_MS) +
    CANDIDATE_SCORE_ROTATION_DURATION_MS) %
    CANDIDATE_SCORE_ROTATION_DURATION_MS;
}

function getCandidateScoreRotationAnimation(score) {
  const animationName = getComputedStyle(score, '::before').animationName;
  if (animationName !== 'finale-score-clockwise') return null;
  return document.getAnimations().find(animation =>
    animation.effect?.target === score &&
    animation.effect?.pseudoElement === '::before' &&
    animation.animationName === animationName
  ) || null;
}

function readCandidateScoreRotation(state, now) {
  if (!state.running) return state.phase;
  return normalizeScoreRotation(state.phase + now - state.updatedAt);
}

function updateCandidateScoreRotation(score, playerIndex, timerRunning) {
  const nextPlayerKey = playerIndex === null || playerIndex === undefined
    ? null
    : String(playerIndex);
  const previousPlayerKey = scoreCirclePlayerAssignments.get(score) ?? null;
  const animation = getCandidateScoreRotationAnimation(score);
  const now = performance.now();

  if (previousPlayerKey !== nextPlayerKey && previousPlayerKey !== null) {
    const previousState = candidateScoreRotationStates.get(previousPlayerKey);
    if (previousState) {
      previousState.phase = readCandidateScoreRotation(previousState, now);
      previousState.updatedAt = now;
      previousState.running = false;
      if (animation) animation.currentTime = previousState.phase;
    }
  }

  if (nextPlayerKey === null) {
    scoreCirclePlayerAssignments.delete(score);
    return;
  }

  scoreCirclePlayerAssignments.set(score, nextPlayerKey);
  const state = candidateScoreRotationStates.get(nextPlayerKey) || {
    phase: 0,
    updatedAt: now,
    running: false
  };
  state.phase = readCandidateScoreRotation(state, now);
  state.updatedAt = now;
  state.running = !!timerRunning;
  candidateScoreRotationStates.set(nextPlayerKey, state);

  if (animation) animation.currentTime = state.phase;
}

function resetCandidateScoreRotations() {
  candidateScoreRotationStates.clear();
  scoreCirclePlayerAssignments = new WeakMap();
  document.querySelectorAll('.finale-candidate-score').forEach(score => {
    score.classList.remove('timer-running');
    const animation = getCandidateScoreRotationAnimation(score);
    if (animation) animation.currentTime = 0;
  });
}

function renderLobby(players, containerId = 'lobbyPlayerImages'){
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = players.map(p => `<div class="lobby-photo" data-player-index="${p.index}"><img src="${p.photoUrl || 'assets/avatar.png'}"><div>${p.name}</div></div>`).join('');
}



function fitThreeSixNinePlayerNames(container) {
    if (!container.matches('#scene-round-369 .players-bar, #scene-standings .players-bar')) return;

    const playerCards = Array.from(container.children);
    const playerNames = playerCards.map(card => card.querySelector('.player-name')).filter(Boolean);
    if (!playerNames.length) return;

    playerNames.forEach(name => name.style.removeProperty('font-size'));

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    context.font = getComputedStyle(playerNames[0]).font;
    const referenceWidth = context.measureText('Kandidaat A').width;
    const nameWidths = playerNames.map(name => {
        context.font = getComputedStyle(name).font;
        return context.measureText(name.textContent).width;
    });

    const scoreCenters = playerCards.map(card => {
        const score = card.querySelector('.player-seconds');
        const bounds = score.getBoundingClientRect();
        return bounds.left + bounds.width / 2;
    });
    const measuredGaps = scoreCenters.slice(1)
        .map((center, index) => center - scoreCenters[index])
        .filter(gap => gap > 0);
    const fallbackWidth = parseFloat(getComputedStyle(container)
        .getPropertyValue('--player-name-available-width'));
    const availableWidth = measuredGaps.length
        ? Math.min(...measuredGaps) - 12
        : fallbackWidth;
    const maxNameWidth = Math.max(availableWidth, referenceWidth);
    const widestName = Math.max(...nameWidths);
    const scale = Math.min(1, maxNameWidth / widestName);

    if (scale < 1) {
        const fontSize = parseFloat(getComputedStyle(playerNames[0]).fontSize);
        playerNames.forEach(name => {
            name.style.fontSize = `${fontSize * scale}px`;
        });
    }
}

function renderPlayersBarUniversal(currentQuestionIndex = null, activeIndex = null, containerId = 'playersBarContainer'){
    const container = document.getElementById(containerId);
    if(!container || !players) return;

    container.innerHTML = players.map((p,i)=>`
        <div class="player-card${activeIndex!==null && i===activeIndex ? ' active-player' : ''}">
            <div class="player-name">${p.name}</div>
            <div class="player-seconds"><div class="big-timer score-oval-face">${p.seconds}</div></div>
        </div>
    `).join('');

    fitThreeSixNinePlayerNames(container);
    document.fonts.ready.then(() => fitThreeSixNinePlayerNames(container));

    
    if(containerId === 'playersBarContainer'){
        const qContainer = document.getElementById('questionNumbersContainer');
        
        if(qContainer && perRoundState.max){ 
          let questionMarkers = Array.from(qContainer.querySelectorAll('.question-number'));
          let currentIndicator = qContainer.querySelector('.question-current-indicator');

          if (questionMarkers.length !== perRoundState.max || !currentIndicator) {
            qContainer.innerHTML = Array.from({length: perRoundState.max}, (_, i) =>
              `<div class="question-number future">${i + 1}</div>`
            ).join('') + '<span class="question-current-indicator" aria-hidden="true"></span>';
            delete qContainer.dataset.currentQuestionIndex;
            questionMarkers = Array.from(qContainer.querySelectorAll('.question-number'));
            currentIndicator = qContainer.querySelector('.question-current-indicator');
          }

          questionMarkers.forEach((marker, i) => {
            const questionState = currentQuestionIndex === i
              ? 'current'
              : Number.isInteger(currentQuestionIndex) && i < currentQuestionIndex
                ? 'past'
                : 'future';
            marker.className = `question-number ${questionState}`;
          });

          if (Number.isInteger(currentQuestionIndex) && questionMarkers[currentQuestionIndex]) {
            const previousIndex = Number(qContainer.dataset.currentQuestionIndex);
            const hasPreviousIndex = qContainer.dataset.currentQuestionIndex !== undefined;

            if (!hasPreviousIndex || currentQuestionIndex !== previousIndex) {
              const shouldAnimate = hasPreviousIndex && currentQuestionIndex === previousIndex + 1;
              currentIndicator.classList.toggle('no-transition', !shouldAnimate);
              const currentMarker = questionMarkers[currentQuestionIndex];
              currentIndicator.style.left = `${currentMarker.offsetLeft + (currentMarker.offsetWidth - currentIndicator.offsetWidth) / 2}px`;
              currentIndicator.style.top = `${currentMarker.offsetTop + (currentMarker.offsetHeight - currentIndicator.offsetHeight) / 2}px`;
              currentIndicator.classList.add('is-visible');
              qContainer.dataset.currentQuestionIndex = `${currentQuestionIndex}`;

              if (!shouldAnimate) {
                requestAnimationFrame(() => currentIndicator.classList.remove('no-transition'));
              }
            }
          } else {
            currentIndicator.classList.remove('is-visible');
            delete qContainer.dataset.currentQuestionIndex;
          }
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
    const playersForRender = Array.isArray(data.players) ? data.players : players;
    if (Array.isArray(data.players)) {
      players = data.players;
    }
    const previousQuestionIndex = lastThreeSixNineData?.currentQuestionIndex;
    const isNewQuestion = Number.isFinite(data.currentQuestionIndex) &&
      data.currentQuestionIndex !== previousQuestionIndex;
    if (isNewQuestion && data.questionType !== 'multiple-choice') {
      threeSixNineOptionsPerspectiveMode = 'together';
    }
    lastThreeSixNineData = { ...(lastThreeSixNineData || {}), ...data, players: playersForRender };

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
    const photoContainer = document.getElementById('threeSixNinePhotoContainer');
    const answersContainer = document.getElementById('threeSixNineAnswersContainer');
    const scene = document.getElementById('scene-round-369');
    if (scene) scene.dataset.optionsPerspective = threeSixNineOptionsPerspectiveMode;
    if (photoContainer) {
      if (scene) scene.dataset.photoPerspective = threeSixNineImagePerspectiveMode;
      if (isNewQuestion) {
        threeSixNineImagePerspectiveMode = 'mini-lobby';
        threeSixNinePerspectivePhotoVisible = null;
        if (scene) scene.dataset.photoPerspective = threeSixNineImagePerspectiveMode;
        photoContainer.style.display = 'none';
        photoContainer.replaceChildren();
      }
    }
    if (isNewQuestion && answersContainer) {
      answersContainer.style.display = 'none';
      answersContainer.replaceChildren();
    }

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
      threeSixNinePerspectivePhotoVisible = null;
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
        if (questionNumbersContainer) {
          questionNumbersContainer.innerHTML = "";
          delete questionNumbersContainer.dataset.currentQuestionIndex;
        }
        if (photoContainer) {
          photoContainer.style.display = 'none';
          photoContainer.innerHTML = '';
        }
        if (answersContainer) {
          answersContainer.style.display = 'none';
          answersContainer.replaceChildren();
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
            for (const key of ['A', 'B', 'C', 'D']) {
                questionHTML += `<div>${key}) ${data.options[key] || '-'}</div>`;
            }
            questionHTML += '</div>';
        }
        if (answersContainer) {
          answersContainer.replaceChildren();
          if (qType === 'multiple-choice' && data.options) {
            const optionsList = document.createElement('div');
            optionsList.className = 'multiple-choice-options';
            for (const key of ['A', 'B', 'C', 'D']) {
              const option = document.createElement('div');
              option.textContent = `${key}) ${data.options[key] || '-'}`;
              optionsList.appendChild(option);
            }
            answersContainer.appendChild(optionsList);
            answersContainer.style.display =
              threeSixNineOptionsPerspectiveMode === 'together' ? 'none' : 'flex';
          } else {
            answersContainer.style.display = 'none';
          }
        }
        
        // Foto weergave in linkervlak (zonder extra status-tekst in de vraag).
        if (phaseMedia.photoUrl) {
            if (threeSixNinePerspectivePhotoVisible ?? data.photoVisible) {
                // Toon foto in linkervlak
                setTimeout(() => {
              if (photoContainer && phaseMedia.photoUrl) {
                photoContainer.innerHTML = `<img src="${phaseMedia.photoUrl}" alt="Vraagfoto" />`;
                        photoContainer.style.display = 'block';
                    }
                }, 0);
            } else {
                // Verberg foto
                setTimeout(() => {
                    if (photoContainer) {
                        photoContainer.style.display = 'none';
                    }
                }, 0);
            }
        }
        else {
          setTimeout(() => {
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

        const normalizedActiveIndex = normalizeActiveIndex(playersForRender, data.activeIndex);
        perRoundState.currentQuestionIndex = Number.isFinite(data.currentQuestionIndex)
          ? Math.max(0, data.currentQuestionIndex - 1)
          : null;
        if (Number.isFinite(data.maxQuestions)) {
          perRoundState.max = data.maxQuestions;
        }

        renderPlayersBarUniversal(perRoundState.currentQuestionIndex, normalizedActiveIndex);
    }

    
    renderMiniLobby(playersForRender, 'miniLobbyPlayers');
    
}

function normalizeActiveIndex(playersData, activeIndex) {
  if (!Array.isArray(playersData) || activeIndex === null || activeIndex === undefined) {
    return activeIndex;
  }
  
  // 1. Zoek eerst of activeIndex overeenkomt met de unieke speler-index (p.index)
  const resolvedIndex = playersData.findIndex(p => p && p.index === activeIndex);
  if (resolvedIndex !== -1) {
    return resolvedIndex;
  }

  // 2. Fallback: als p.index niet gevonden is, controleer of activeIndex al een geldige array-index is
  if (activeIndex >= 0 && activeIndex < playersData.length) {
    return activeIndex;
  }

  return activeIndex;
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
      const mediaMarkup = introThumbnailUrl
        ? `<img class="vragensteller-thumb" src="${introThumbnailUrl}" alt="Thumbnail voor ${q.name}" loading="eager" decoding="async" aria-hidden="true">`
        : '';
      const videoOverlayMarkup = introThumbnailUrl
        ? `<div class="vragensteller-thumb-overlay" aria-hidden="true"></div>`
        : '';

      return `
        <div class="vragensteller-box${q.isChosen ? ' gespeeld' : ' beschikbaar'}${q.isPreviewDimmed ? ' preview-dimmed-pending' : ''}${introThumbnailUrl ? ' has-video-thumb' : ''}${q.hideNameDuringSelection && introThumbnailUrl ? ' hide-name-during-selection' : ''}" data-questioner-index="${q.index}" data-thumb-url="${introThumbnailUrl}">
          ${mediaMarkup}
          ${videoOverlayMarkup}
          <div class="vragensteller-name">${q.name}</div>
        </div>
      `;
    }).join('');

    const previewDimmedBoxes = container.querySelectorAll('.vragensteller-box.preview-dimmed-pending');
    if (previewDimmedBoxes.length > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          previewDimmedBoxes.forEach((box) => {
            box.classList.remove('preview-dimmed-pending');
            box.classList.add('preview-dimmed');
          });
        });
      });
    }

    renderPlayersBarCompact(data.players, data.activeChoosingPlayerIndex, 'od-vragensteller-scores');
    renderQuestionQuarterPerspective();
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

    openDeurIntroVideoActive = true;
    openDeurPendingVraagData = { ...data, showIntroVideo: false };

    const finishIntroVideo = () => {
      if (!openDeurIntroVideoActive) return;

      openDeurIntroVideoActive = false;
      videoPlayer.onended = null;
      videoPlayer.onerror = null;

      const vraagData = openDeurPendingVraagData || { ...data, showIntroVideo: false };
      openDeurPendingVraagData = null;

      if (activeUniversalPerspectiveData?.fullscreenLobby === true) {
        universalPerspectivePreviousScene = 'round-opendeur-vraag';
        return;
      }

      updateScene('round-opendeur-vraag');
      renderOpenDeurVraag(vraagData);
      renderPlayersBarUniversal(null, vraagData.activeIndex);
      if (
        activeUniversalPerspectiveData &&
        activeUniversalPerspectiveData.playerIndex !== null &&
        activeUniversalPerspectiveData.playerIndex !== undefined
      ) {
        handleUniversalPerspectiveChange(activeUniversalPerspectiveData);
      }
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
    openDeurActiveScoreData = data;

    const { from, answers } = data.currentQuestion;
    const container = document.getElementById('odAnswerContainer');
    if (!container) return;

    
    container.innerHTML = answers.map(a => {
        const points = data.currentQuestion.timeGain || 20;
        const isBlurred = !a.isAnswered && !data.isAllAnswersVisible;
        
        return `
            <div class="od-answer-line${a.isAnswered ? ' found' : ' unguessed'}">
            <div class="od-answer-points">${a.isAnswered ? `<span class="score-oval-face">${points}</span>` : ''}</div>
                <div class="od-answer-text${isBlurred ? ' blurred' : ''}">
              ${a.text}
                </div>
            </div>
        `;
    }).join('');
    animateNewlyFoundAnswers(container, getAnswerRevealKey(data, 'opendeur'));

    
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
    renderOpenDeurActiveScore(data);
    renderQuestionQuarterPerspective();
}

function renderOpenDeurActiveScore(data) {
  const score = document.getElementById('odActiveScoreCircle');
  const scoreBar = document.getElementById('od-vraag-scores');
  const automaticPerspectiveActive =
    currentScene === 'round-opendeur-vraag' &&
    data?.automaticSceneChangesEnabled === true;
  scoreBar?.classList.toggle('automatic-perspectives-enabled', automaticPerspectiveActive);
  if (!score) return;

  const activeIndex = Number(data?.activeAnsweringPlayerIndex);
  const activePlayer = data?.players?.find(player => player.index === activeIndex);
  updateCandidateScoreRotation(
    score,
    activePlayer?.index ?? null,
    !!data?.isTimerRunning && !!activePlayer
  );
  const isActivePerspective =
    automaticPerspectiveActive &&
    activeUniversalPerspectiveData?.automaticScenePerspective === true &&
    Number(activeUniversalPerspectiveData.playerIndex) === activeIndex;
  const shouldShow = isActivePerspective &&
    !data.isActiveAnsweringPlayerPassed &&
    !data.isAllAnswersVisible &&
    !data.questionCompleted &&
    !!activePlayer;

  score.querySelector('.score-oval-face').textContent = shouldShow
    ? String(activePlayer.seconds ?? '')
    : '';
  score.classList.toggle('timer-running', shouldShow && !!data.isTimerRunning);
  score.classList.toggle('is-visible', shouldShow);
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

function renderFinaleStandingsPlayers(playersData, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const finalists = playersData.filter(player => !player.isOut).slice(0, 2);
  container.innerHTML = finalists.map((player, index) => `
    <div class="finale-standings-player${index === 1 ? ' right-score-first' : ''}">
      <div class="finale-standings-name">${player.name}</div>
      <div class="finale-standings-score">${player.seconds}</div>
    </div>
  `).join('');
}

function renderStandings(playersData) {
  if (!Array.isArray(playersData)) return;

  players = playersData;
  if (currentRoundDisplayKey === 'finale') {
    const finalists = playersData.filter(player => !player.isOut).slice(0, 2);
    renderFinaleCandidatePhotos(
      finalists,
      null,
      ['finaleStandingsPhotoLeft', 'finaleStandingsPhotoRight'],
      []
    );
    renderFinaleStandingsPlayers(finalists, 'finaleStandingsPlayers');
    return;
  }

  renderMiniLobby(playersData, 'standingsMiniLobby');
  renderPlayersBarUniversal(null, null, 'standingsPlayersBar');
}

function renderLobbyStandings(playersData, revealScores = false) {
  if (!Array.isArray(playersData)) return;

  renderLobby(playersData, 'lobbyStandingsPlayerImages');
  renderPlayersBarUniversal(null, null, 'lobbyStandingsPlayersBar');
  document.getElementById('lobbyStandingsScorePanel')
    ?.classList.toggle('lobby-standings-scores-hidden', !revealScores);
}

function renderThreeSixNineLobbyPerspective(playersData) {
  if (!Array.isArray(playersData)) return;

  renderLobby(playersData, 'threeSixNineLobbyPlayerImages');
}

  function updatePlayersBarsFromGeneric(playersData, activeIndex) {
    if (!playersData || !playersData.length) return;

    updateVisibleMiniLobbyPlayers(playersData);
    const normalizedActiveIndex = normalizeActiveIndex(playersData, activeIndex);
    const questionIndex = currentScene === 'round-369' ? perRoundState.currentQuestionIndex : null;
    renderPlayersBarUniversal(questionIndex, normalizedActiveIndex);
    if (currentScene === 'round-369' && showingThreeSixNineLobbyPerspective) {
      renderThreeSixNineLobbyPerspective(playersData);
    }

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
      'finalePrePlayersBar',
      'soloEndPlayersBar'
    ];

    compactBars.forEach(id => {
      if (document.getElementById(id)) {
        renderPlayersBarCompact(playersData, activeIndex, id);
      }
    });

    if (showingStandings) renderStandings(playersData);
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
        puzzelActiveScoreData = data;

        
        renderMiniLobby(playersData, 'puzzelActiveMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelActivePlayersBar');
        renderPuzzelActiveScore(data);

        const puzzelRoundInfoEl = document.getElementById('puzzelRoundInfo');
        if (data.statusText) {
            puzzelRoundInfoEl.innerHTML = `
                <div class="round-name round-title-badge">Puzzel</div>
                <div class="round-status" style="color: #ffd17a; font-size: 1.2em;">${data.statusText}</div>
            `;
        } else {
            puzzelRoundInfoEl.innerHTML = `
                <div class="round-name round-title-badge">Puzzel</div>
                <div class="round-status">Puzzel ${data.currentPuzzelIndex} van ${data.maxPuzzles}</div>
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
              animateNewlyFoundAnswers(puzzelTableEl, getAnswerRevealKey(data, 'puzzel'));
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
                        
                        const displayText = link.link;
                        const points = link.timeGain || 30;

                        return `
                          <div class="puzzel-link-line${link.found ? ' found' : ' unguessed'} ${link.found ? `found-link-${index}` : ''}">
                            <div class="puzzel-link-points">${link.found ? `<span class="score-oval-face">${points}</span>` : ''}</div>
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
          animateNewlyFoundAnswers(puzzelLinksEl, getAnswerRevealKey(data, 'puzzel-links'));

    } else if (scene === 'scene-round-puzzel-waiting') {
        updateScene('round-puzzel-waiting');
        renderPuzzelActiveScore(null);
        renderMiniLobby(playersData, 'puzzelPreMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelPrePlayersBar');
    } 
    else if (scene === 'scene-round-puzzel-done') {
      updateScene('round-puzzel-done');
        renderPuzzelActiveScore(null);
        renderMiniLobby(playersData, 'puzzelDoneMiniLobby');
        renderPlayersBarCompact(playersData, activeIndex, 'puzzelDonePlayersBar');
    }
}

function renderPuzzelActiveScore(data) {
  const score = document.getElementById('puzzelActiveScoreCircle');
  const scoreBar = document.getElementById('puzzelActivePlayersBar');
  const automaticPerspectiveActive =
    currentScene === 'round-puzzel-active' &&
    data?.automaticSceneChangesEnabled === true &&
    data.showScoreboard !== true;
  scoreBar?.classList.toggle('automatic-perspectives-enabled', automaticPerspectiveActive);
  if (!score) return;

  const activeIndex = Number(data?.activeIndex);
  const activePlayer = data?.players?.find(player => player.index === activeIndex);
  updateCandidateScoreRotation(
    score,
    activePlayer?.index ?? null,
    !!data?.timerRunning && !!activePlayer
  );
  const shouldShow = automaticPerspectiveActive &&
    activeUniversalPerspectiveData?.automaticScenePerspective === true &&
    Number(activeUniversalPerspectiveData.playerIndex) === activeIndex &&
    !data.activePlayerPassed &&
    !!activePlayer;

  score.querySelector('.score-oval-face').textContent = shouldShow
    ? String(activePlayer.seconds ?? '')
    : '';
  score.classList.toggle('timer-running', shouldShow && !!data.timerRunning);
  score.classList.toggle('is-visible', shouldShow);
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

const preloadedGalerijImages = new Map();

function preloadGalerijImages(imageSources) {
  if (!desktopBridge || !Array.isArray(imageSources)) return;

  imageSources.forEach((src) => {
    if (typeof src !== 'string' || !src || preloadedGalerijImages.has(src)) return;

    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.addEventListener('error', () => {
      console.error(`Galerijafbeelding vooraf laden mislukt: ${src}`);
    }, { once: true });
    preloadedGalerijImages.set(src, image);
    image.src = src;
  });
}

function renderGalerijImage(container, imageSrc, alt) {
  if (!desktopBridge) {
    container.innerHTML = imageSrc
      ? `<img src="${imageSrc}" alt="${alt}" style="max-width:100%;border-radius:12px;">`
      : '<div style="padding:2rem;">Geen afbeelding beschikbaar</div>';
    return;
  }

  if (!imageSrc) {
    container.innerHTML = '<div style="padding:2rem;">Geen afbeelding beschikbaar</div>';
    delete container.dataset.galerijImageSrc;
    return;
  }

  if (container.dataset.galerijImageSrc === imageSrc) return;
  container.dataset.galerijImageSrc = imageSrc;

  const preloadedImage = preloadedGalerijImages.get(imageSrc);
  const showImage = () => {
    if (container.dataset.galerijImageSrc !== imageSrc) return;
    if (!preloadedImage || preloadedImage.naturalWidth === 0) {
      container.textContent = 'Afbeelding kon niet worden geladen.';
      return;
    }

    preloadedImage.alt = alt;
    preloadedImage.style.maxWidth = '100%';
    preloadedImage.style.borderRadius = '12px';
    container.replaceChildren(preloadedImage);
  };

  if (!preloadedImage) {
    const image = new Image();
    image.src = imageSrc;
    image.alt = alt;
    image.style.maxWidth = '100%';
    image.style.borderRadius = '12px';
    container.replaceChildren(image);
  } else if (preloadedImage.complete) {
    showImage();
  } else {
    preloadedImage.addEventListener('load', showImage, { once: true });
    preloadedImage.addEventListener('error', showImage, { once: true });
  }
}

function handleGalerijDisplayUpdate(data) {
  preloadGalerijImages(data.galleryImageSources);
  const playersData = data.players || [];
  if (playersData.length > 0) {
    players = playersData;
  }
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
  const previousScene = currentScene;
  updateScene(sceneId);
  const isGalerijTurnScene =
    sceneToShow === 'scene-round-galerij-main' ||
    sceneToShow === 'scene-round-galerij-aanvul';
  if (!isGalerijTurnScene) {
    galerijAutomaticPerspectivesEnabled = false;
  } else if (
    previousScene !== 'round-galerij-main' &&
    previousScene !== 'round-galerij-aanvul'
  ) {
    galerijAutomaticPerspectivesEnabled =
      data.automaticSceneChangesEnabled === true;
  }
  galerijActiveScoreData = data;

  switch (sceneToShow) {
    case 'scene-round-galerij-pre': {
      
      const displayPlayers = playersData.length > 0 ? playersData : players;
      
      renderMiniLobby(displayPlayers, 'galerijPreMiniLobby');
      renderPlayersBarCompact(displayPlayers, activeIndex, 'galerijPrePlayersBar');
      renderGalerijActiveScore(null);

      break;
    }

    case 'scene-round-galerij-main': {
      const imgContainer = document.getElementById('galerijMainImageContainer');
      if (imgContainer) {
        renderGalerijImage(imgContainer, data.imageSrc, 'Galerijfoto');
      }
      renderMiniLobby(playersData, 'galerijMainMiniLobby');
      const infoContainer = document.getElementById('galerijMainInfoContainer');
      if (infoContainer) {
        infoContainer.innerHTML = `
          <div class="round-name round-title-badge">Galerij</div>
          <div class="round-image">Afbeelding ${data.imageIndex + 1 || 1} van ${data.totalImages || 0}</div>
          <div class="round-status">Beurt van ${data.activePlayer?.name || '-'}</div>
          <div id="galerijMainPlayersBar" class="players-bar-compact"></div>
        `;
      }
      renderPlayersBarCompact(playersData, activeIndex, 'galerijMainPlayersBar');
      renderGalerijActiveScore(data);

      break;
    }

    case 'scene-round-galerij-aanvul': {
      updateScene('round-galerij-aanvul');
      const answersContainer = document.getElementById('galerijAanvulAnswers');
      const maxPoints = 15;

      if (answersContainer && data.answers) {
        answersContainer.innerHTML = data.answers.map(a => {
          const revealed = a.found || a.isFound || false;
          const displayText = a.text;
          const points = a.points || maxPoints;

          return `
            <div class="answer-line ${revealed ? 'found' : 'unfound'}">
              <div class="answer-points">
                  ${revealed ? `<span class="score-oval-face">${points}</span>` : ''}
              </div>
              <div class="answer-text ${revealed ? '' : 'blurred'}">
                ${displayText}
              </div>
            </div>
          `;
        }).join('');
        animateNewlyFoundAnswers(answersContainer, getAnswerRevealKey(data, 'galerij-aanvul'));
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
      renderGalerijActiveScore(data);
      break;
    }

    case 'scene-round-galerij-slideshow': {
      const imgContainer = document.getElementById('galerijSlideshowImageContainer');
      if (imgContainer) {
        renderGalerijImage(imgContainer, data.imageSrc, 'Bespreekafbeelding');
      }
      
      
      renderMiniLobby(playersData, 'galerijSlideshowMiniLobby');
      
      const infoEl = document.getElementById('galerijSlideshowInfo');
      if (infoEl) {
        infoEl.innerHTML = `
          <div class="round-name round-title-badge">Galerij</div>
          ${data.galleryTheme ? `<div class="round-status">Thema: ${data.galleryTheme}</div>` : ''}
          ${data.imageAnswer ? `<div class="round-status" style="font-size: 2.5em; margin-top: 20px; color: #ffd17a;">Antwoord: ${data.imageAnswer}</div>` : ''}
        `;
      }
      renderPlayersBarCompact(playersData, activeIndex, 'galerijSlideshowPlayersBar');
      renderGalerijActiveScore(null);
      break;
    }

    case 'scene-round-galerij-done': {
      
      const displayPlayers = playersData.length > 0 ? playersData : players;
      
      renderMiniLobby(displayPlayers, 'galerijDoneMiniLobby');
      renderPlayersBarCompact(displayPlayers, activeIndex, 'galerijDonePlayersBar');
      renderGalerijActiveScore(null);

      break;
    }
  }
}

function renderGalerijActiveScore(data) {
  const mainScore = document.getElementById('galerijMainScoreCircle');
  const aanvulScore = document.getElementById('galerijAanvulScoreCircle');
  const mainScoreBar = document.getElementById('galerijMainPlayersBar');
  const aanvulScoreBar = document.getElementById('galerijAanvulPlayersBar');
  const mainScene = document.getElementById('scene-round-galerij-main');
  const aanvulScene = document.getElementById('scene-round-galerij-aanvul');
  const isMainTurn = currentScene === 'round-galerij-main';
  const isAanvulTurn = currentScene === 'round-galerij-aanvul';
  const automaticPerspectiveActive =
    galerijAutomaticPerspectivesEnabled && (isMainTurn || isAanvulTurn);

  mainScoreBar?.classList.toggle(
    'automatic-perspectives-enabled',
    automaticPerspectiveActive && isMainTurn
  );
  aanvulScoreBar?.classList.toggle(
    'automatic-perspectives-enabled',
    automaticPerspectiveActive && isAanvulTurn
  );
  mainScene?.classList.toggle(
    'automatic-perspectives-enabled',
    automaticPerspectiveActive && isMainTurn
  );
  aanvulScene?.classList.toggle(
    'automatic-perspectives-enabled',
    automaticPerspectiveActive && isAanvulTurn
  );

  const activeIndex = Number(data?.activeIndex);
  const activePlayer = data?.players?.find(player => player.index === activeIndex);
  const isMatchingPlayerPerspective =
    activeUniversalPerspectiveData?.automaticScenePerspective === true &&
    Number(activeUniversalPerspectiveData.playerIndex) === activeIndex;

  const shouldShow = automaticPerspectiveActive &&
    !!activePlayer &&
    isMatchingPlayerPerspective;

  [mainScore, aanvulScore].forEach((score, index) => {
    if (!score) return;
    const isThisScene = index === 0 ? isMainTurn : isAanvulTurn;
    const scorePlayer = isThisScene ? activePlayer : null;
    updateCandidateScoreRotation(
      score,
      scorePlayer?.index ?? null,
      !!scorePlayer && !!data?.timerRunning
    );
    score.querySelector('.score-oval-face').textContent =
      shouldShow && isThisScene ? String(activePlayer.seconds ?? '') : '';
    score.classList.toggle(
      'timer-running',
      shouldShow && isThisScene && !!data.timerRunning
    );
    score.classList.toggle('is-visible', shouldShow && isThisScene);
  });
}


  function handleCollectiefDisplayUpdate(data) {
    const playersData = data.players || [];
    const activeIndex = data.activeIndex ?? -1;

    
    let sceneToShow = data.scene;
    if (!sceneToShow) sceneToShow = 'scene-round-collectief-pre';

    if (sceneToShow === 'scene-round-collectief-tussenstand') {
      sceneToShow = 'scene-round-collectief-main';
      data.revealAllAnswers = true;
    }
    
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
        if (desktopBridge && data.preloadVideoSrc) {
          const videoPlayer = document.getElementById('collectiefVideoPlayer');
          const videoSource = document.getElementById('collectiefVideoSource');
          if (videoPlayer && videoSource && collectiefPreloadedVideoUrl !== data.preloadVideoSrc) {
            videoPlayer.pause();
            videoPlayer.preload = 'auto';
            videoSource.setAttribute('src', data.preloadVideoSrc);
            videoPlayer.load();
            collectiefPreloadedVideoUrl = data.preloadVideoSrc;
          }
        }
        break;
      }

      case 'scene-round-collectief-video': {
        const videoPlayer = document.getElementById('collectiefVideoPlayer');
        const videoSource = document.getElementById('collectiefVideoSource');
      
        if (videoSource && data.videoSrc) {
          if (videoPlayer) {
            const sourceAlreadyPrepared = desktopBridge &&
              videoSource.getAttribute('src') === data.videoSrc;
            if (!sourceAlreadyPrepared) {
              videoSource.src = data.videoSrc;
              videoPlayer.load();
            }
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
        collectiefMainScoreData = {
          ...data,
          players: displayPlayers,
          activeIndex
        };
        renderMiniLobby(displayPlayers, 'collectiefMainMiniLobby');
      
        
        const answersContainer = document.getElementById('collectiefMainAnswers');
        if (answersContainer && data.answers) {
          const revealAllAnswers = !!(data.revealAllAnswers || data.allAnswersFound || data.allPlayersAnswered);
          answersContainer.innerHTML = data.answers.map((answer, i) => {
            
            const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
            const found = typeof answer === 'object' 
              ? !!(answer.isFound || answer.found || answer.answered || answer.isAnswered)
              : false;
            const points = typeof answer === 'object' ? (answer.points || 0) : 0;
            const isVisible = found || revealAllAnswers;
            
            return `
              <div class="collectief-answer-line${found ? ' found' : ''}" data-index="${i}">
                <div class="collectief-answer-points">${found ? `<span class="score-oval-face">${points}</span>` : ''}</div>
                <div class="collectief-answer-text${isVisible ? '' : ' blurred'}">${text}</div>
              </div>
            `;
          }).join('');
          animateNewlyFoundAnswers(answersContainer, getAnswerRevealKey(data, 'collectief'));
        }
      
        
        const infoEl = document.getElementById('collectiefMainInfo');
        if (infoEl) {
          infoEl.innerHTML = `
            <div class="round-name round-title-badge">Collectief Geheugen</div>
            <div class="round-status">Beurt van ${data.activePlayer || '-'}</div>
            ${data.questionText ? `<div class="round-status" style="font-size: 1.8em; margin-top: 15px;">${data.questionText}</div>` : ''}
          `;
        }

        renderPlayersBarCompact(displayPlayers, activeIndex, 'collectiefMainPlayersBar');
        renderCollectiefMainScores(collectiefMainScoreData);
        break;
      }

    }
  }

  function renderCollectiefMainScores(data) {
    const scoreIds = [
      'collectiefMainScoreLeft',
      'collectiefMainScoreCenter',
      'collectiefMainScoreRight'
    ];
    const scorePlayers = Array.isArray(data?.players) ? data.players : [];
    const activeIndex = normalizeActiveIndex(scorePlayers, data?.activeIndex);

    scoreIds.forEach((id, index) => {
      const score = document.getElementById(id);
      if (!score) return;

      const player = scorePlayers[index];
      const isActive = index === activeIndex;
      const face = score.querySelector('.score-oval-face');
      if (face) face.textContent = player ? String(player.seconds ?? '') : '';
      updateCandidateScoreRotation(
        score,
        player ? (player.index ?? index) : null,
        isActive && !!data?.timerRunning && !!player
      );
      score.classList.toggle('active-player', isActive);
      score.classList.toggle('timer-running', isActive && !!data?.timerRunning);
    });
  }

  function handleFinaleDisplayUpdate(data) {
    currentRoundDisplayKey = 'finale';
    currentRoundDisplayName = 'Finale';
    const playersData = data.players || [];
    const activeIndex = data.activeIndex ?? -1;

    
    let sceneToShow = data.scene;
    if (!sceneToShow) sceneToShow = 'scene-round-finale-pre';
    if (sceneToShow === 'scene-round-finale-end') {
      finaleGameComplete = true;
      hideFinaleCandidatePerspective();
      updatePresenterOverlayTheme();
    }

    
    const sceneId = sceneToShow.replace(/^scene-/, '');

    
    const displayPlayers = playersData.length > 0 ? playersData : players;

    switch (sceneToShow) {
      case 'scene-round-finale-pre': {
        renderFinaleCandidatePhotos(
          displayPlayers,
          null,
          ['finalePrePhotoLeft', 'finalePrePhotoRight'],
          []
        );
        
        
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
        
        renderFinaleStandingsPlayers(displayPlayers, 'finalePrePlayersBar');
        break;
      }

      case 'scene-round-finale-main': {
        renderFinaleCandidatePhotos(
          displayPlayers,
          activeIndex,
          undefined,
          undefined,
          data.timerRunning
        );
        const revealAllAnswers = !!data.revealAllAnswers;
        const deductionSeconds = Number(data.deductionSeconds) > 0 ? Number(data.deductionSeconds) : 20;
      
        
        const answersContainer = document.getElementById('finaleMainAnswers');
        if (answersContainer && data.answers) {
          answersContainer.innerHTML = data.answers.map((answer, i) => {
            
            const text = typeof answer === 'string' ? answer : (answer.answer || answer.text || '');
            const found = typeof answer === 'object' 
              ? !!(answer.isFound || answer.found)
              : false;
            const isVisible = found || revealAllAnswers;
            const pointsText = found ? `${deductionSeconds}` : '';
            
            
            return `
              <div class="collectief-answer-line${found ? ' found' : ''}" data-index="${i}">
                <div class="collectief-answer-points"><span class="score-oval-face">${pointsText}</span></div>
                <div class="collectief-answer-text${isVisible ? '' : ' blurred'}">
                  ${text}
                </div>
              </div>
            `;
          }).join('');
          animateNewlyFoundAnswers(answersContainer, getAnswerRevealKey(data, 'finale'));
        }
      
        
        const infoEl = document.getElementById('finaleMainInfo');
        if (infoEl) {
          infoEl.innerHTML = `
            <div class="round-name round-title-badge">Finale</div>
            <div class="round-status">Beurt van ${data.activePlayer || '-'}</div>
            ${data.question ? `<div class="round-status" style="font-size: 1.8em; margin-top: 15px;">${data.question}</div>` : ''}
          `;
        }
      
        break;
      }

      case 'scene-round-finale-end': {
        renderFinaleCandidatePhotos(
          displayPlayers,
          activeIndex,
          ['finaleEndPhotoLeft', 'finaleEndPhotoRight'],
          ['finaleEndScoreLeft', 'finaleEndScoreRight']
        );
        
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
        
        break;
      }
    }

    updateScene(sceneId);
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

function clearUniversalPerspective() {
  universalPerspectiveStyles.forEach((styles, element) => {
    element.style.transform = styles.transform;
    element.style.transformOrigin = styles.transformOrigin;
    element.style.transition = styles.transition;
    if (styles.overflow !== undefined) element.style.overflow = styles.overflow;
  });
  universalPerspectiveStyles.clear();

  detachedScoreCircleParents.forEach(({ parent, nextSibling }, score) => {
    if (nextSibling?.parentElement === parent) {
      parent.insertBefore(score, nextSibling);
    } else {
      parent.appendChild(score);
    }
  });
  detachedScoreCircleParents.clear();
}

function detachScoreCirclesFromMiniLobby(miniLobby) {
  [
    '#puzzelActiveScoreCircle',
    '#galerijMainScoreCircle',
    '#galerijAanvulScoreCircle'
  ].forEach(selector => {
    const score = miniLobby.querySelector(selector);
    const parent = score?.parentElement;
    const overlayParent = parent?.parentElement;
    if (!score || parent !== miniLobby || !overlayParent) return;

    detachedScoreCircleParents.set(score, {
      parent,
      nextSibling: score.nextSibling
    });
    overlayParent.appendChild(score);
  });
}

function clearQuestionQuarterPerspective() {
  questionQuarterTransformedElements.forEach(element => {
    const styles = universalPerspectiveStyles.get(element);
    if (!styles) return;
    element.style.transform = styles.transform;
    element.style.transformOrigin = styles.transformOrigin;
    element.style.transition = styles.transition;
    if (styles.overflow !== undefined) element.style.overflow = styles.overflow;
    universalPerspectiveStyles.delete(element);
  });
  questionQuarterTransformedElements.clear();

  if (questionQuarterHiddenMiniLobby) {
    questionQuarterHiddenMiniLobby.element.style.display =
      questionQuarterHiddenMiniLobby.display;
    questionQuarterHiddenMiniLobby = null;
  }

  if (questionQuarterPerspectiveTarget) {
    questionQuarterPerspectiveTarget.style.position = questionQuarterTargetPreviousPosition;
    questionQuarterPerspectiveTarget = null;
  }

  questionQuarterPerspectiveViewport?.remove();
  questionQuarterPerspectiveViewport = null;
}

function renderQuestionQuarterPerspective() {
  clearQuestionQuarterPerspective();
  const perspective = questionQuarterPerspective;
  if (!perspective || !currentScene) return;

  const questionQuarterTargetSelectors = {
    'round-369': '.round-grid > .grid-part.part2',
    'round-opendeur-vragensteller': '#opendeur-vragensteller-grid .grid-part.part2',
    'round-opendeur-vraag': '#opendeur-vraag-grid .part4-status',
    'round-puzzel-waiting': '#puzzel-pre-grid .part4-status',
    'round-puzzel-active': '.grid-part.part3',
    'round-galerij-pre': '#galerij-pre-grid .part4-status',
    'round-galerij-main': '#galerij-main-grid .part4-status',
    'round-galerij-slideshow': '#galerij-slideshow-grid .part4-status',
    'round-galerij-aanvul': '#galerij-aanvul-grid .part4-status',
    'round-galerij-done': '#galerij-done-grid .part4-status',
    'round-collectief-pre': '#collectief-pre-grid .part4-status',
    'round-collectief-main': '#collectief-main-grid .part4-status'
  };
  const isFullscreenLobby = currentScene === 'lobby' && !!universalPerspectivePreviousScene;
  const perspectiveSceneName = isFullscreenLobby ? universalPerspectivePreviousScene : currentScene;
  const perspectiveScene = document.getElementById(`scene-${perspectiveSceneName}`);
  const scene = document.getElementById(`scene-${currentScene}`);
  const targetSelector = questionQuarterTargetSelectors[perspectiveSceneName];
  const perspectiveTarget = targetSelector
    ? perspectiveScene?.querySelector(targetSelector)
    : null;
  const target = isFullscreenLobby ? scene : perspectiveTarget;
  let fullscreenLobbyPerspectiveBounds = null;
  if (isFullscreenLobby) {
    if (perspectiveScene && perspectiveTarget) {
      const previousDisplay = perspectiveScene.style.display;
      const previousVisibility = perspectiveScene.style.visibility;
      perspectiveScene.style.display = 'flex';
      perspectiveScene.style.visibility = 'hidden';
      try {
        const sceneBounds = perspectiveScene.getBoundingClientRect();
        const targetBounds = perspectiveTarget.getBoundingClientRect();
        if (sceneBounds.width && sceneBounds.height && targetBounds.width && targetBounds.height) {
          fullscreenLobbyPerspectiveBounds = {
            left: (targetBounds.left - sceneBounds.left) *
              (perspectiveScene.offsetWidth / sceneBounds.width),
            top: (targetBounds.top - sceneBounds.top) *
              (perspectiveScene.offsetHeight / sceneBounds.height),
            width: targetBounds.width * (perspectiveScene.offsetWidth / sceneBounds.width),
            height: targetBounds.height * (perspectiveScene.offsetHeight / sceneBounds.height)
          };
        }
      } finally {
        perspectiveScene.style.display = previousDisplay;
        perspectiveScene.style.visibility = previousVisibility;
      }
    }
    if (!fullscreenLobbyPerspectiveBounds) {
      console.warn(
        'Vraagkwartier niet geplaatst: doelvlak ontbreekt of heeft geen afmetingen.',
        perspectiveSceneName
      );
      return;
    }
  } else if (!target) {
    console.warn(
      'Vraagkwartier niet geplaatst: doelvlak ontbreekt.',
      perspectiveSceneName
    );
    return;
  }

  questionQuarterPerspectiveTarget = target;
  questionQuarterTargetPreviousPosition = target.style.position;
  if (getComputedStyle(target).position === 'static') {
    target.style.position = 'relative';
  }

  const viewport = document.createElement('div');
  viewport.className = 'question-quarter-perspective-viewport grid-part part2';
  viewport.style.position = 'absolute';
  viewport.style.display = 'block';
  viewport.style.padding = '0';
  if (fullscreenLobbyPerspectiveBounds) {
    viewport.style.inset = 'auto';
    viewport.style.left = `${fullscreenLobbyPerspectiveBounds.left}px`;
    viewport.style.top = `${fullscreenLobbyPerspectiveBounds.top}px`;
    viewport.style.width = `${fullscreenLobbyPerspectiveBounds.width}px`;
    viewport.style.height = `${fullscreenLobbyPerspectiveBounds.height}px`;
  }
  questionQuarterPerspectiveViewport = viewport;
  target.appendChild(viewport);

  const removeIds = element => {
    if (element.id) element.removeAttribute('id');
    element.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
  };

  if (perspective.type === 'lobby' || perspective.type === 'player') {
    const sourceMiniLobby = perspectiveScene?.querySelector('.mini-lobby');
    if (!sourceMiniLobby) {
      console.warn('Vraagkwartierperspectief niet toegepast: mini-lobby ontbreekt.', currentScene);
      clearQuestionQuarterPerspective();
      return;
    }
    const miniLobby = sourceMiniLobby.cloneNode(true);
    [
      '#odActiveScoreCircle',
      '#puzzelActiveScoreCircle',
      '#galerijMainScoreCircle',
      '#galerijAanvulScoreCircle',
      '#collectiefMainScoreCircles'
    ].forEach(selector => miniLobby.querySelector(selector)?.remove());
    removeIds(miniLobby);
    miniLobby.classList.add('question-quarter-mini-lobby');
    viewport.appendChild(miniLobby);
    Array.from(miniLobby.children)
      .filter(element => !element.matches('.mini-bg'))
      .forEach(element => {
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.width = '100%';
        element.style.height = '100%';
      });

    const sourceBounds = sourceMiniLobby.getBoundingClientRect();
    if (sourceBounds.width && sourceBounds.height) {
      const sourcePlayers = new Map(
        Array.from(sourceMiniLobby.querySelectorAll('.player[data-player-index]'))
          .map(player => [player.dataset.playerIndex, player])
      );
      miniLobby.querySelectorAll('.player[data-player-index]').forEach(player => {
        const sourcePlayer = sourcePlayers.get(player.dataset.playerIndex);
        if (!sourcePlayer) return;

        const bounds = sourcePlayer.getBoundingClientRect();
        player.style.position = 'absolute';
        player.style.left =
          `${((bounds.left - sourceBounds.left) / sourceBounds.width) * 100}%`;
        player.style.top =
          `${((bounds.top - sourceBounds.top) / sourceBounds.height) * 100}%`;
        player.style.right = 'auto';
        player.style.bottom = 'auto';
      });
    }

    if (perspective.type === 'lobby') {
      const sourceBounds = isFullscreenLobby
        ? null
        : sourceMiniLobby.getBoundingClientRect();
      const targetBounds = isFullscreenLobby
        ? null
        : perspectiveTarget?.getBoundingClientRect();
      const overlapWidth = targetBounds
        ? Math.max(0, Math.min(sourceBounds.right, targetBounds.right) -
          Math.max(sourceBounds.left, targetBounds.left))
        : 0;
      const overlapHeight = targetBounds
        ? Math.max(0, Math.min(sourceBounds.bottom, targetBounds.bottom) -
          Math.max(sourceBounds.top, targetBounds.top))
        : 0;
      const overlapArea = overlapWidth * overlapHeight;
      const sourceArea = sourceBounds
        ? sourceBounds.width * sourceBounds.height
        : 0;
      if (sourceArea > 0 && overlapArea / sourceArea > 0.9) {
        questionQuarterHiddenMiniLobby = {
          element: sourceMiniLobby,
          display: sourceMiniLobby.style.display
        };
        sourceMiniLobby.style.display = 'none';
      }
      return;
    }

    const player = Array.from(miniLobby.querySelectorAll('.player[data-player-index]'))
      .find(candidate => Number(candidate.dataset.playerIndex) === Number(perspective.playerIndex));
    if (!player) {
      console.warn('Vraagkwartierperspectief niet toegepast: kandidaat niet gevonden.', perspective.playerIndex);
      clearQuestionQuarterPerspective();
      return;
    }

    miniLobby.style.overflow = 'hidden';
    Array.from(miniLobby.children).forEach(element => {
      if (element.id === 'collectiefMainScoreCircles') return;
      if (applyUniversalPerspectiveZoom(
        element,
        player,
        miniLobby,
        UNIVERSAL_PERSPECTIVE_ZOOM_SCALE
      )) {
        questionQuarterTransformedElements.add(element);
      }
    });
    return;
  }

  if (perspective.type === 'presenter') {
    const source = document.getElementById('presenterOverlay');
    if (!source || !perspective.photoData) {
      console.warn('Vraagkwartierperspectief niet toegepast: presentatorfoto ontbreekt.');
      clearQuestionQuarterPerspective();
      return;
    }
    const presenter = source.cloneNode(true);
    removeIds(presenter);
    presenter.className = 'question-quarter-presenter-overlay';
    presenter.style.display = 'flex';
    presenter.style.position = 'absolute';
    presenter.style.inset = '0';
    presenter.style.width = '100%';
    presenter.style.height = '100%';
    presenter.querySelector('.presenter-photo').src = perspective.photoData;
    viewport.appendChild(presenter);
    return;
  }

  if (perspective.type === 'jury') {
    const source = document.getElementById('juryOverlay');
    if (!source) return;
    const jury = source.cloneNode(true);
    removeIds(jury);
    jury.className = 'question-quarter-jury-overlay';
    jury.style.display = 'flex';
    jury.style.position = 'absolute';
    jury.style.inset = '0';
    jury.style.width = '100%';
    jury.style.height = '100%';
    const customJury = perspective.mode === 'custom' && perspective.photoData;
    const juryImage = jury.querySelector('.jury-image');
    const juryMemberPhoto = jury.querySelector('.jury-member-photo');
    if (juryImage) juryImage.src = customJury ? 'assets/jurystoel.png' : 'assets/jury.png';
    if (juryMemberPhoto) {
      juryMemberPhoto.src = customJury ? perspective.photoData : '';
      juryMemberPhoto.style.display = customJury ? 'block' : 'none';
    }
    viewport.appendChild(jury);
  }
}

function applyUniversalPerspectiveZoom(element, target, frame, zoom) {
  const frameRect = frame.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (!frameRect.width || !frameRect.height || !targetRect.width || !targetRect.height) return false;

  const frameScaleX = frame.offsetWidth / frameRect.width;
  const frameScaleY = frame.offsetHeight / frameRect.height;
  const targetX = (targetRect.left + targetRect.width / 2 - frameRect.left) * frameScaleX;
  const targetY = (targetRect.top + targetRect.height / 2 - frameRect.top) * frameScaleY;
  const elementRect = element.getBoundingClientRect();
  if (!elementRect.width || !elementRect.height) return false;

  universalPerspectiveStyles.set(element, {
    transform: element.style.transform,
    transformOrigin: element.style.transformOrigin,
    transition: element.style.transition,
    overflow: element.style.overflow
  });
  element.style.transformOrigin = `${(targetRect.left + targetRect.width / 2 - elementRect.left) * (element.offsetWidth / elementRect.width)}px ${(targetRect.top + targetRect.height / 2 - elementRect.top) * (element.offsetHeight / elementRect.height)}px`;
  element.style.transition = 'none';
  element.style.transform = `translate(${frame.offsetWidth / 2 - targetX}px, ${frame.offsetHeight / 2 - targetY + UNIVERSAL_PERSPECTIVE_VERTICAL_OFFSET}px) scale(${zoom})`;
  return true;
}

function handleUniversalPerspectiveChange(data) {
  activeUniversalPerspectiveData = data;
  if (typeof data.fullscreenLobby === 'boolean') {
    if (data.fullscreenLobby) {
      if (!universalPerspectivePreviousScene) {
        universalPerspectivePreviousScene = currentScene;
        universalPerspectivePreviousStandings = {
          showingStandings,
          showingLobbyStandings
        };
      }
      showingStandings = false;
      showingLobbyStandings = false;
      renderLobby(players);
      updateScene('lobby');
    } else if (universalPerspectivePreviousScene) {
      const previousScene = universalPerspectivePreviousScene;
      universalPerspectivePreviousScene = null;
      const previousStandings = universalPerspectivePreviousStandings;
      universalPerspectivePreviousStandings = null;
      showingStandings = previousStandings?.showingStandings || false;
      showingLobbyStandings = previousStandings?.showingLobbyStandings || false;
      updateScene(previousScene);
    }
  }

  clearUniversalPerspective();
  renderOpenDeurActiveScore(openDeurActiveScoreData);
  renderPuzzelActiveScore(puzzelActiveScoreData);
  renderGalerijActiveScore(galerijActiveScoreData);
  if (data.playerIndex === null || data.playerIndex === undefined) {
    return;
  }

  const player = players.find(candidate => candidate.index === data.playerIndex);
  const playerName = data.playerName || player?.name;
  if (!playerName) {
    console.warn('Universeel perspectief niet toegepast: kandidaat niet gevonden.', data.playerIndex);
    return;
  }

  const scene = document.getElementById(
    showingLobbyStandings
      ? 'scene-lobby-standings'
      : showingStandings
        ? 'scene-standings'
        : `scene-${currentScene}`
  );
  if (!scene) return;

  const playerPosition = players.findIndex(candidate => candidate.index === data.playerIndex);
  const miniLobby = scene.querySelector('.mini-lobby');
  let target = Array.from(miniLobby?.querySelectorAll('.player[data-player-index]') || [])
    .find(candidate => Number(candidate.dataset.playerIndex) === Number(data.playerIndex)) || null;
  if (!target && miniLobby) {
    target = miniLobby.querySelectorAll('.player')[playerPosition] || null;
  }
  if (!target) {
    target = Array.from(scene.querySelectorAll('.lobby-photo[data-player-index]'))
      .find(candidate => Number(candidate.dataset.playerIndex) === Number(data.playerIndex)) || null;
  }
  if (!target) {
    target = scene.querySelectorAll('.lobby-photo')[playerPosition] || null;
  }
  if (!target) {
    console.warn(`Universeel perspectief niet toegepast: "${playerName}" staat niet in de huidige scène.`);
    return;
  }

  if (data.fullscreenPlayer) {
    applyUniversalPerspectiveZoom(
      scene,
      target,
      scene,
      UNIVERSAL_PERSPECTIVE_FULLSCREEN_ZOOM_SCALE
    );
    return;
  }

  if (miniLobby && miniLobby.contains(target)) {
    detachScoreCirclesFromMiniLobby(miniLobby);
    applyUniversalPerspectiveZoom(
      miniLobby,
      target,
      miniLobby,
      UNIVERSAL_PERSPECTIVE_ZOOM_SCALE
    );
    miniLobby.style.overflow = 'hidden';
    return;
  }

  applyUniversalPerspectiveZoom(
    scene,
    target,
    scene,
    UNIVERSAL_PERSPECTIVE_ZOOM_SCALE
  );
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
  finaleGameComplete = true;
  hideFinaleCandidatePerspective();
  updatePresenterOverlayTheme();
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
      // Render de finalistfoto's als players data beschikbaar is
      if (data.players) {
        renderFinaleCandidatePhotos(data.players, data.activeIndex, undefined, undefined, data.timerRunning);
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
              <div class="collectief-answer-points"><span class="score-oval-face">${deductionSeconds}</span></div>
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
          <div class="round-name round-title-badge">Finale</div>
          <div class="round-status">Laatste vraag</div>
          ${data.question ? `<div class="round-status" style="font-size: 1.8em; margin-top: 15px;">${data.question}</div>` : ''}
        `;
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
    refreshVisibleOverlaysPosition();
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
      
      // Update de finalistfoto's en scores
      if (finaleEndViewState.allPlayers) {
        renderFinaleCandidatePhotos(
          finaleEndViewState.allPlayers,
          data.winnerIndex ?? finaleEndViewState.winner?.index ?? 0,
          ['finaleEndPhotoLeft', 'finaleEndPhotoRight'],
          ['finaleEndScoreLeft', 'finaleEndScoreRight']
        );
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
    refreshVisibleOverlaysPosition();
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
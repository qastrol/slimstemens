let defaultThreeSixNineMax = 12;

// ===== STANDALONE KLOK2.MP3 LOOP FUNCTIONALITEIT =====
// Deze functies zijn volledig standalone en onafhankelijk van andere code
// Audio speelt alleen af op display.html, niet op index.html
let klok369TimerInterval = null;
let klok369ElapsedSeconds = 0;
let klok369IsPlaying = false;
let klok369ErrorCount = 0;

function klok369_startLoop() {
  // Stop bestaande loop eerst
  klok369_stopLoop();
  
  klok369IsPlaying = true;
  klok369ElapsedSeconds = 0;
  klok369_updateTimerDisplay();
  
  // Start timer interval (elke seconde)
  klok369TimerInterval = setInterval(() => {
    klok369ElapsedSeconds++;
    klok369_updateTimerDisplay();
  }, 1000);
  
  // Stuur display update voor loop start (audio speelt alleen op display.html)
  try {
    if (typeof sendDisplayUpdate === 'function') {
      sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' });
    }
  } catch(e) {}
}

function klok369_stopLoop() {
  // Stop timer
  if (klok369TimerInterval) {
    clearInterval(klok369TimerInterval);
    klok369TimerInterval = null;
  }
  
  klok369IsPlaying = false;
  
  // Stuur display update voor loop stop (audio speelt alleen op display.html)
  try {
    if (typeof sendDisplayUpdate === 'function') {
      sendDisplayUpdate({ type: 'audio', action: 'loopStop' });
    }
  } catch(e) {}
}

function klok369_resetTimer() {
  klok369ElapsedSeconds = 0;
  klok369_updateTimerDisplay();
}

function klok369_updateTimerDisplay() {
  const timerEl = document.getElementById('klok369Timer');
  if (timerEl) {
    timerEl.textContent = `${klok369ElapsedSeconds}s`;
  }
}

function klok369_toggleLoop() {
  if (klok369IsPlaying) {
    klok369_stopLoop();
    klok369_resetTimer();
  } else {
    klok369_startLoop();
  }
}

function klok369_handleCorrectAnswer() {
  klok369_stopLoop();
  klok369_resetTimer();
  klok369ErrorCount = 0;
}

function klok369_handleWrongAnswer() {
  klok369_resetTimer();
  klok369ErrorCount++;
  
  // Als 3 fouten, stop de loop
  if (klok369ErrorCount >= 3) {
    klok369_stopLoop();
    klok369ErrorCount = 0;
  }
}

function klok369_resetErrorCount() {
  klok369ErrorCount = 0;
}
// ===== EINDE STANDALONE KLOK FUNCTIONALITEIT =====


function setupThreeSixNineRound() {
  // Reset klok state bij start van ronde
  klok369_stopLoop();
  klok369_resetTimer();
  klok369_resetErrorCount();
  
  // Haal vragen op met fallback naar standaard vragen
  const questionsToUse = getQuestionsForRound('threeSixNine', Q_3_6_9);
  
  // Check of shuffle aan of uit staat
  const shouldShuffle = shouldShuffleRound('threeSixNine');
  perRoundState.questions = shouldShuffle
    ? (typeof shuffleArrayShared === 'function' ? shuffleArrayShared(questionsToUse) : questionsToUse.slice())
    : questionsToUse.slice();
  
  // Haal maxQuestions uit config, of gebruik standaard waarde
  const configMaxQuestions = getRoundSetting('threeSixNine', 'maxQuestions', null);
  if (configMaxQuestions !== null && !isNaN(configMaxQuestions) && configMaxQuestions > 0) {
    perRoundState.max = Math.min(configMaxQuestions, perRoundState.questions.length);
    console.log(`3-6-9: Aantal vragen uit config: ${perRoundState.max}`);
  } else {
    perRoundState.max = defaultThreeSixNineMax;
  }

  currentQuestionIndex = 0;
  perRoundState.currentQuestion = null;
  
currentQuestionEl.innerHTML = `<em>3-6-9 ronde: ${perRoundState.max} vragen. Druk op Volgende vraag om te starten.</em>`;

  if (typeof showPresenterScriptForPhase === 'function') {
    showPresenterScriptForPhase('threeSixNineFirstQuestion');
  }

  renderThreeSixNineControls();

  
sendDisplayUpdate({
    type: 'round_start',
    name: '3-6-9 Ronde',
    key: 'threeSixNine',
    currentQuestionDisplay: null,
    currentQuestionIndex: 0,
    maxQuestions: perRoundState.max,
    activePlayer: players[activePlayerIndex]?.name || '-',
    activeIndex: activePlayerIndex,
    players
});

}


function setThreeSixNineMax(num) {
  const n = parseInt(num);
  if (!isNaN(n) && n > 0 && n <= Q_3_6_9.length) {
    defaultThreeSixNineMax = n;
    flash(`Aantal vragen voor 3-6-9 ingesteld op ${n}`);
  } else {
    flash(`Ongeldig aantal vragen. Maximaal: ${Q_3_6_9.length}`);
  }
}

function getThreeSixNineMediaUrls(question) {
  const q = question || {};
  return getThreeSixNineMediaItems(q).reduce((urls, media) => {
    urls[`${media.type}Url`] = urls[`${media.type}Url`] || media.url;
    return urls;
  }, { photoUrl: null, audioUrl: null, videoUrl: null });
}

function getThreeSixNineMediaItems(question) {
  const q = question || {};
  if (Array.isArray(q.media) && q.media.length > 0) {
    return q.media
      .filter((media) => media && ['photo', 'audio', 'video'].includes(media.type) && typeof media.url === 'string' && media.url.trim())
      .map((media) => ({
        type: media.type,
        url: media.url.trim(),
        note: typeof media.note === 'string' ? media.note.trim() : (typeof media.remarks === 'string' ? media.remarks.trim() : '')
      }));
  }

  const legacyUrls = {
    photo: [q.questionPhotoUrl || q.photoUrl, q.afterPhotoUrl || q.revealPhotoUrl],
    audio: [q.questionAudioUrl || q.audioUrl, q.afterAudioUrl || q.revealAudioUrl],
    video: [q.questionVideoUrl || q.videoUrl || q.clip, q.afterVideoUrl || q.revealVideoUrl]
  };
  return Object.entries(legacyUrls).flatMap(([type, urls]) => (
    [...new Set(urls.filter((url) => typeof url === 'string' && url.trim()))]
      .map((url) => ({ type, url: url.trim(), note: '' }))
  ));
}

function getThreeSixNineMediaItem(question, index = 0) {
  const media = getThreeSixNineMediaItems(question)[index];
  if (!media) {
    return null;
  }
  return {
    photoUrl: media.type === 'photo' ? media.url : null,
    audioUrl: media.type === 'audio' ? media.url : null,
    videoUrl: media.type === 'video' ? media.url : null
  };
}

function resetThreeSixNineMediaState() {
  perRoundState.mediaQuestionPhotoVisible = false;
  perRoundState.mediaQuestionPhotoIndex = 0;
  perRoundState.mediaQuestionAudioPlaying = false;
  perRoundState.mediaQuestionAudioIndex = -1;
  perRoundState.mediaQuestionVideoPlaying = false;
  perRoundState.mediaQuestionVideoIndex = -1;
}

function nextThreeSixNineQuestion() {
  if (!players.length) {
    flash('Maak eerst het spel aan met spelers');
    return;
  }

  if(currentQuestionIndex >= perRoundState.max){
    flash('Einde van de 3-6-9 ronde!');
    currentQuestionEl.innerHTML = '<em>Ronde afgelopen.</em>';
    perRoundState.currentQuestion = null;
    const controlsEl = document.getElementById('roundControls');
    if (controlsEl) {
      controlsEl.innerHTML = '';
    }
    window.updatePerspectiveMenu?.();
    if (typeof markCurrentRoundComplete === 'function') {
      markCurrentRoundComplete();
    }

    sendDisplayUpdate({
      type: 'update',
      currentRoundName: 'threeSixNine',
      currentQuestionDisplay: null
    });
    return;
  }

  const q = perRoundState.questions[currentQuestionIndex] || { text: 'Placeholdervraag', answers: [], type: 'classic' };
  perRoundState.currentQuestion = q; 
  currentQuestionIndex++;

  if (currentQuestionIndex === 1 && typeof hidePresenterScript === 'function') {
    hidePresenterScript();
  }

  const activePlayerName = players[activePlayerIndex]?.name || '-';
  const questionMedia = getThreeSixNineMediaUrls(q);

  // Render vraag gebaseerd op type
  let questionHTML = `<strong>Vraag ${currentQuestionIndex} (3-6-9)</strong>`;
  const qType = q.type || 'classic';

  questionHTML += `<div>${q.text}</div>`;

  if (qType === 'multiple-choice' && q.options) {
    const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      .filter((key) => q.options[key] !== undefined && q.options[key] !== null && String(q.options[key]).trim());
    questionHTML += `
      <div class="multiple-choice-options">
        ${optionKeys.map((key) => `<div><strong>${key}:</strong> ${q.options[key]}</div>`).join('')}
      </div>
      <div class="muted small">Juiste antwoord: ${q.correctAnswer || 'Onbekend'}</div>`;
  }

  if (qType === 'doe') {
    questionHTML += `<div class="small" style="color:#f90">⚡ DOE-VRAAG: Kies welke kandidaat wint</div>`;
    if (q.description) {
      questionHTML += `<div class="muted small">${q.description}</div>`;
    }
  }

  if (qType === 'estimation') {
    questionHTML += `
      <div class="small" style="color:#09f">📊 INSCHATTINGSVRAAG: elke kandidaat geeft een antwoord</div>
      <div class="muted small">Juiste antwoord: ${q.correctAnswer || 'Onbekend'} ${q.unit || ''}</div>`;
  }

  if (qType === 'classic') {
    questionHTML += `<div class="muted small">Antwoord: ${q.answers ? q.answers.join(', ') : 'Onbekend'}</div>`;
  }

  const questionMediaCount = getThreeSixNineMediaItems(q).length;
  if (questionMediaCount > 0) {
    questionHTML += `<div class="small">${questionMediaCount} vraagmediabestand(en) beschikbaar</div>`;
  }

  if (q.remarks) {
    questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
  }

  currentQuestionEl.innerHTML = questionHTML;

  perRoundState.currentIsBonus = (currentQuestionIndex % 3 === 0);
  perRoundState.originalPlayer = activePlayerIndex;
  perRoundState.currentQuestionTried = [];
  
  // Reset error count voor nieuwe vraag
  klok369_resetErrorCount();
  
  // Reset media-visibility bij elke nieuwe vraag.
  resetThreeSixNineMediaState();
  window.resetThreeSixNineImagePerspective?.();
  if (qType !== 'multiple-choice') {
    window.resetThreeSixNineOptionsPerspective?.();
  }
  
  highlightActive();
  
  // Render controls voor dit vraagtype
  renderThreeSixNineControls();

  sendDisplayUpdate({
    type: 'update',
    currentRoundName: 'threeSixNine',
    questionType: qType,
    currentQuestionDisplay: q.text,
    currentQuestionIndex: currentQuestionIndex,
    maxQuestions: perRoundState.max,
    activePlayer: activePlayerName,
    activeIndex: activePlayerIndex,
    hasQuestionPhoto: !!questionMedia.photoUrl,
    hasQuestionAudio: !!questionMedia.audioUrl,
    hasQuestionVideo: !!questionMedia.videoUrl,
    questionPhotoUrl: questionMedia.photoUrl,
    questionAudioUrl: questionMedia.audioUrl,
    questionVideoUrl: questionMedia.videoUrl,
    media: getThreeSixNineMediaItems(q),
    activeMediaIndex: 0,
    photoMediaIndex: 0,
    photoVisible: false,
    options: q.options,
    players
  });

}

function markThreeSixNineAnswer(isRight) {
  if (!roundRunning || !perRoundState.currentQuestion) return;

  const currentPlayer = players[activePlayerIndex];
  const currentQuestion = perRoundState.currentQuestion;
  const questionMedia = getThreeSixNineMediaUrls(currentQuestion);

  if (isRight) {
    // KLOK RESET: Goed antwoord
    klok369_handleCorrectAnswer();
    
    if (currentQuestionIndex % 3 === 0) {
      const gained = applyHostAnswerPoints(currentPlayer, 10, currentQuestion);
      currentPlayer.seconds += gained;
      flash(`GOED! +${gained}s bonus voor ${currentPlayer.name}!`, 'good');
    } else {
      flash(`GOED! Geen tijd, ${currentPlayer.name} blijft aan de beurt.`, 'good');
    }

    

  } else {
    // KLOK RESET: Fout antwoord
    klok369_handleWrongAnswer();
    
    activePlayerIndex = (activePlayerIndex + 1) % players.length;
    flash(`FOUT! Beurt naar ${players[activePlayerIndex].name} voor dezelfde vraag.`, 'wrong');
  }

  
  currentPlayer.seconds = Math.max(0, currentPlayer.seconds);

  
  sendDisplayUpdate({
    type: 'update',
    action: 'answer',
    isRight,
    currentRoundName: 'threeSixNine',
    scene: 'round-369',
    questionType: currentQuestion.type || 'classic',
    currentQuestionDisplay: currentQuestion.text || "—",
    currentQuestionIndex,
    maxQuestions: perRoundState.max,
    activePlayer: players[activePlayerIndex]?.name || '-',
    activeIndex: activePlayerIndex,
    options: currentQuestion.options,
    hasQuestionPhoto: !!questionMedia.photoUrl,
    hasQuestionAudio: !!questionMedia.audioUrl,
    hasQuestionVideo: !!questionMedia.videoUrl,
    photoVisible: !!perRoundState.mediaQuestionPhotoVisible,
    media: getThreeSixNineMediaItems(currentQuestion),
    activeMediaIndex: perRoundState.mediaQuestionPhotoIndex,
    photoMediaIndex: perRoundState.mediaQuestionPhotoIndex,
    players
  });

  renderPlayers();
}



function renderThreeSixNineControls() {
    const controlsEl = document.getElementById('roundControls');

    if (!controlsEl) {
        console.warn('renderThreeSixNineControls: roundControls element niet gevonden. Overslaan.');
        return;
    }

    const q = perRoundState.currentQuestion;
    const qType = q?.type || 'classic';
    let controlsHTML = `
      <button onclick="nextThreeSixNineQuestion()" id="roundNextQuestionBtn">Volgende vraag (N)</button>
        <button onclick="klok369_toggleLoop()" id="playKlok369" class="secondary" style="background:#E2904A">
            Klok (K) <span id="klok369Timer" style="margin-left:8px;font-weight:bold">${klok369ElapsedSeconds}s</span>
        </button>
    `;
    
    const renderMediaButtons = (mediaItems) => {
      const typeCounts = { photo: 0, audio: 0, video: 0 };
      return mediaItems.map((media, index) => {
        typeCounts[media.type] += 1;
        const typeLabel = media.type === 'photo' ? 'Foto' : media.type === 'audio' ? 'Audio' : 'Video';
        const label = media.note || `${typeLabel} ${typeCounts[media.type]}`;
        const safeLabel = String(label).replace(/[&<>"']/g, (character) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[character]);
        if (media.type === 'photo') {
          return `<button onclick="toggleThreeSixNinePhoto(${index})" class="secondary" style="background:#4A90E2">📷 ${safeLabel} ${perRoundState.mediaQuestionPhotoVisible && perRoundState.mediaQuestionPhotoIndex === index ? 'verbergen' : 'tonen'}</button>`;
        }
        if (media.type === 'audio') {
          const isPlaying = perRoundState.mediaQuestionAudioPlaying && perRoundState.mediaQuestionAudioIndex === index;
          return `<button onclick="playThreeSixNineAudio(${index})" class="secondary" style="background:#E24A90">${isPlaying ? '⏹️' : '🔊'} ${safeLabel} ${isPlaying ? 'stoppen' : 'afspelen'}</button>`;
        }
        const isPlaying = perRoundState.mediaQuestionVideoPlaying && perRoundState.mediaQuestionVideoIndex === index;
        return `<button onclick="playThreeSixNineVideo(${index})" class="secondary" style="background:#6b4ae2">${isPlaying ? '⏹️' : '🎬'} ${safeLabel} ${isPlaying ? 'stoppen' : 'fullscreen'}</button>`;
      }).join('');
    };

    controlsHTML += renderMediaButtons(getThreeSixNineMediaItems(q));
    
    // Goed/Fout knoppen voor alle types behalve doe en estimation
    if (qType !== 'doe' && qType !== 'estimation') {
        controlsHTML += `
        <button onclick="markThreeSixNineAnswer(true); playSFX('SFX/goed.mp3');" id="roundMarkRightBtn">Goed (G)</button>
        <button onclick="markThreeSixNineAnswer(false); playSFX('SFX/fout.mp3');" id="roundMarkWrongBtn">Fout (F)</button>
        `;
    }
    
    if (qType === 'doe') {
        controlsHTML += `
            <div style="margin-top:10px">
                <div class="small">Kies winnaar:</div>
                ${players.map((p, i) => `
                    <button onclick="selectDoeWinner(${i})" class="secondary" style="margin:2px">
                        ${p.name}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    if (qType === 'estimation') {
        controlsHTML += `
            <div style="margin-top:10px">
                <div class="small">Wie zat het dichtst bij?</div>
                ${players.map((p, i) => `
                    <button onclick="selectEstimationWinner(${i})" class="secondary" style="margin:2px">
                        ${p.name}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    controlsEl.innerHTML = controlsHTML;
    window.updatePerspectiveMenu?.();
}

// Foto tonen/verbergen
function toggleThreeSixNinePhoto(index = null) {
    const q = perRoundState.currentQuestion;
  if (!q) return;

  const mediaItems = getThreeSixNineMediaItems(q);
  const photoIndex = typeof index === 'number'
    ? index
    : mediaItems.findIndex((item) => item.type === 'photo');
  const media = getThreeSixNineMediaItem(q, photoIndex);
  if (!media?.photoUrl) return;

  const visibilityKey = 'mediaQuestionPhotoVisible';
  const currentPhotoIndexKey = 'mediaQuestionPhotoIndex';
  const nextVisibleState = !perRoundState[visibilityKey] || perRoundState[currentPhotoIndexKey] !== photoIndex;

  perRoundState[visibilityKey] = nextVisibleState;
  perRoundState[currentPhotoIndexKey] = photoIndex;
    
    const activePlayerName = players[activePlayerIndex]?.name || '-';
    
    sendDisplayUpdate({
        type: 'update',
        currentRoundName: 'threeSixNine',
        action: 'togglePhoto',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: activePlayerName,
        activeIndex: activePlayerIndex,
    photoMediaIndex: photoIndex,
    activeMediaIndex: photoIndex,
    photoUrl: media.photoUrl,
    media: getThreeSixNineMediaItems(q),
        photoVisible: !!perRoundState[visibilityKey],
        players
    });
    
  flash(perRoundState[visibilityKey] ? 'Foto getoond' : 'Foto verborgen');
}

// Audio afspelen
function playThreeSixNineAudio(index = null) {
    const q = perRoundState.currentQuestion;
  console.log('🎵 playThreeSixNineAudio aangeroepen met vraag:', q);
    
  const mediaItems = getThreeSixNineMediaItems(q);
  const mediaIndex = typeof index === 'number'
    ? index
    : mediaItems.findIndex((item) => item.type === 'audio');
  const media = getThreeSixNineMediaItem(q, mediaIndex);
  if (!q || !media?.audioUrl) {
    console.warn('❌ Geen vraag of audioUrl gevonden:', { q, audioUrl: media?.audioUrl });
        return;
    }
    
    const activePlayerName = players[activePlayerIndex]?.name || '-';

    const playingKey = 'mediaQuestionAudioPlaying';
    const playingIndexKey = 'mediaQuestionAudioIndex';
    const isAlreadyPlaying = !!perRoundState[playingKey] && perRoundState[playingIndexKey] === mediaIndex;

    if (isAlreadyPlaying) {
      perRoundState.mediaQuestionAudioPlaying = false;
      perRoundState.mediaQuestionAudioIndex = -1;

      sendDisplayUpdate({
        type: 'update',
        currentRoundName: 'threeSixNine',
        action: 'stopAudio',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: activePlayerName,
        activeIndex: activePlayerIndex,
        activeMediaIndex: mediaIndex,
        players
      });

      renderThreeSixNineControls();
      flash('Audio gestopt.');
      return;
    }

    perRoundState.mediaQuestionAudioPlaying = false;
    perRoundState.mediaQuestionAudioIndex = -1;
    perRoundState[playingKey] = true;
    perRoundState[playingIndexKey] = mediaIndex;
    
    console.log('📤 Versturen audio update naar display:', media.audioUrl);
    
    // Stuur alleen naar display - audio speelt ALLEEN op display.html
    sendDisplayUpdate({
        type: 'update',
        currentRoundName: 'threeSixNine',
        action: 'playAudio',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: activePlayerName,
        activeIndex: activePlayerIndex,
        activeMediaIndex: mediaIndex,
        audioUrl: media.audioUrl,
        players
    });
    
      renderThreeSixNineControls();
    flash('Audio wordt afgespeeld op display...');
    // NIET op host afspelen: playSFX() verwijderd
}

function playThreeSixNineVideo(index = null) {
    const q = perRoundState.currentQuestion;
    const mediaItems = getThreeSixNineMediaItems(q);
    const mediaIndex = typeof index === 'number'
      ? index
      : mediaItems.findIndex((item) => item.type === 'video');
    const media = getThreeSixNineMediaItem(q, mediaIndex);
    if (!q || !media?.videoUrl) {
      return;
    }

    const activePlayerName = players[activePlayerIndex]?.name || '-';

    const playingKey = 'mediaQuestionVideoPlaying';
    const playingIndexKey = 'mediaQuestionVideoIndex';
    const isAlreadyPlaying = !!perRoundState[playingKey] && perRoundState[playingIndexKey] === mediaIndex;

    if (isAlreadyPlaying) {
      perRoundState.mediaQuestionVideoPlaying = false;
      perRoundState.mediaQuestionVideoIndex = -1;

      sendDisplayUpdate({
        type: 'update',
        currentRoundName: 'threeSixNine',
        action: 'stopVideo',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: activePlayerName,
        activeIndex: activePlayerIndex,
        activeMediaIndex: mediaIndex,
        players
      });

      renderThreeSixNineControls();
      flash('Video gestopt.');
      return;
    }

    perRoundState.mediaQuestionVideoPlaying = false;
    perRoundState.mediaQuestionVideoIndex = -1;
    perRoundState[playingKey] = true;
    perRoundState[playingIndexKey] = mediaIndex;

    sendDisplayUpdate({
      type: 'update',
      currentRoundName: 'threeSixNine',
      action: 'playVideo',
      questionType: q.type || 'classic',
      currentQuestionDisplay: q.text,
      currentQuestionIndex: currentQuestionIndex,
      maxQuestions: perRoundState.max,
      activePlayer: activePlayerName,
      activeIndex: activePlayerIndex,
      activeMediaIndex: mediaIndex,
      videoUrl: media.videoUrl,
      players
    });

    renderThreeSixNineControls();
    flash('Video wordt fullscreen afgespeeld op display...');
}

// DOE-vraag winnaar selecteren
function selectDoeWinner(playerIndex) {
    if (!roundRunning || !perRoundState.currentQuestion) return;
    
    activePlayerIndex = playerIndex;
    const winner = players[playerIndex];
    const q = perRoundState.currentQuestion;
    
    if (currentQuestionIndex % 3 === 0) {
        const gained = applyHostAnswerPoints(winner, 10, q);
        winner.seconds += gained;
        playSFX('SFX/goed.mp3');
        flash(`${winner.name} wint! +${gained}s bonus!`, 'good');
    } else {
        flash(`${winner.name} wint en blijft aan de beurt!`, 'good');
    }
    
    sendDisplayUpdate({
        type: 'update',
        action: 'doeWinner',
        currentRoundName: 'threeSixNine',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: winner.name,
        activeIndex: playerIndex,
        players
    });
    
    renderPlayers();
}
// Inschattingsvraag winnaar selecteren
function selectEstimationWinner(playerIndex) {
    if (!roundRunning || !perRoundState.currentQuestion) return;
    
    activePlayerIndex = playerIndex;
    const winner = players[playerIndex];
    const q = perRoundState.currentQuestion;
    
    if (currentQuestionIndex % 3 === 0) {
        const gained = applyHostAnswerPoints(winner, 10, q);
        winner.seconds += gained;
        playSFX('SFX/goed.mp3');
        flash(`${winner.name} zat het dichtst bij! +${gained}s bonus!`, 'good');
    } else {
        flash(`${winner.name} zat het dichtst bij en blijft aan de beurt!`, 'good');
    }
    
    sendDisplayUpdate({
        type: 'update',
        action: 'estimationWinner',
        currentRoundName: 'threeSixNine',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: winner.name,
        activeIndex: playerIndex,
        players
    });
    
    renderPlayers();
}

let currentGallery = null;
let galleryImages = [];
let galleryIndex = 0;
let passedImages = [];
let galleryPhase = 'pre'; 
let galleryPlayerIndex = 0;




let galerijTimerId = null; 
let isGalerijTimerRunning = false; 


let galleryTimerRunning = false;

let galerijRoundOrder = []; 

function sendGalerijDisplayUpdate() {
  const baseData = {
    type: 'update',
    key: 'galerij',
    players: players,
    activeIndex: galleryPlayerIndex
  };

  if (galleryPhase === 'pre') {
    sendDisplayUpdate({
      ...baseData,
      scene: 'scene-round-galerij-pre'
    });
  } else if (galleryPhase === 'main') {
    const img = galleryImages[galleryIndex];
    sendDisplayUpdate({
      ...baseData,
      scene: 'scene-round-galerij-main',
      galleryTheme: currentGallery.theme,
      imageSrc: img?.src,
      activePlayer: players[galleryPlayerIndex],
      imageIndex: galleryIndex,
      totalImages: galleryImages.length
    });
  } else if (galleryPhase === 'aanvul') {
    const aanvulPlayerIndex = currentAanvulPlayer ? players.findIndex(p => p.name === currentAanvulPlayer.name) : -1;
    sendDisplayUpdate({
      ...baseData,
      scene: 'scene-round-galerij-aanvul',
      galleryTheme: currentGallery.theme,
      answers: galleryImages.map(img => ({
        text: img.answer,
        found: img.found || false,
        points: 15
      })),
      activePlayer: currentAanvulPlayer,
      activeIndex: aanvulPlayerIndex
    });
  } else if (galleryPhase === 'slideshow') {
    const img = galleryImages[galleryIndex];
    sendDisplayUpdate({
      ...baseData,
      scene: 'scene-round-galerij-slideshow',
      galleryTheme: currentGallery.theme,
      imageSrc: img?.src,
      activePlayer: players[galleryPlayerIndex]
    });
  }
}


function setupGalerijRound() {
  galleryPhase = 'pre';
  galleryPlayerIndex = 0;
  currentGallery = null;
  galleryImages = [];
  galleryIndex = 0;
  passedImages = [];
  aanvulQueue = [];
  currentAanvulPlayer = null;
  stopGalerijTimer(false); 
  galerijRoundOrder = shuffleArray(galerijQuestions).slice(0, 3);

  renderGalerijHostUI();
  flash('Galerijronde klaar om te starten.');
  
  sendDisplayUpdate({
    type: 'update',
    key: 'galerij',
    scene: 'scene-round-galerij-pre',
    players: players,
    activeIndex: 0
  });
}

function shuffleArray(array) {
  const arr = array.slice(); 
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]; 
  }
  return arr;
}


function startGalerijTimer() {
  const activePlayer = galleryPhase === 'aanvul' ? currentAanvulPlayer : players[galleryPlayerIndex];
  if (!activePlayer) return flash('Fout: Geen actieve speler om de tijd voor te starten.');

  
  stopGalerijTimer(false); 

  
  if (typeof playSFX === 'function') {
    try { sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' }); } catch(e) {}
  }

  flash(`Tijd gestart voor ${activePlayer.name}`);

  
  thinkingTimerInterval = setInterval(() => {
    activePlayer.seconds = Math.max(0, activePlayer.seconds - 1);
    renderPlayers();
    
    sendGalerijDisplayUpdate();
    
    if (activePlayer.seconds <= 0) {
      clearInterval(thinkingTimerInterval);
      stopGalerijTimer(true); 
      flash(`${activePlayer.name} is door zijn tijd heen! Pas/Ga verder.`);
    }
  }, 1000);

  galleryTimerRunning = true;
}

function stopGalerijTimerSound() {
  if (typeof stopLoopTimerSFX === 'function') stopLoopTimerSFX();
  if (typeof playSFX === 'function') playSFX('SFX/klokeind.mp3');
}

function stopGalerijTimer(playEndSound = false) { 
  if (typeof thinkingTimerInterval !== 'undefined') clearInterval(thinkingTimerInterval);
  
  
  if (typeof stopLoopTimerSFX === 'function') stopLoopTimerSFX(); 
  
  if (playEndSound) {
    
    if (typeof playSFX === 'function') playSFX('SFX/klokeind.mp3'); 
  }
  
  galleryTimerRunning = false;
}


function renderGalerijHostUI() {
  const area = document.getElementById('currentQuestion');
  if (!area) return;

  
  const activePlayer = galleryPhase === 'aanvul' ? currentAanvulPlayer : players[galleryPlayerIndex];
  const playerName = activePlayer ? activePlayer.name : '—';
  const nextPlayer = players[galleryPlayerIndex + 1];
  const isLastGallery = galleryPlayerIndex === players.length - 1; 
  const currentAnswerStatus = galleryPhase === 'main' 
    ? (galleryIndex < galleryImages.length ? galleryImages[galleryIndex].answer : '—') 
    : '—';


  if (galleryPhase === 'pre') {
    area.innerHTML = `
      <h3>Galerijronde</h3>
      <p>Kandidaat aan de beurt: <strong>${playerName}</strong></p>
      <button onclick="startGalerijForPlayer(${galleryPlayerIndex})">
        ▶️ Start galerij (${playerName})
      </button>
    `;
  }
  else if (galleryPhase === 'main') {
    const img = galleryImages[galleryIndex];
    
    
    area.innerHTML = `
      <div class="small muted">Kandidaat: ${playerName}</div>
      <div style="width:480px;height:320px;background:#000;display:flex;align-items:center;justify-content:center;border-radius:8px;margin:8px 0;">
        ${img.src.endsWith('.webm')
          ? `<video src="${img.src}" autoplay loop muted style="max-width:100%;max-height:100%;object-fit:contain;"></video>`
          : `<img src="${img.src}" style="max-width:100%;max-height:100%;object-fit:contain;">`}
      </div>
      <div style="margin-top:4px;"><strong>Antwoord:</strong> ${img.answer}</div>
      <div>Afbeelding ${galleryIndex + 1} / ${galleryImages.length}</div>
      <div style="margin-top:8px;">
        <button class="good" onclick="markGalerijAnswer(true, '${img.answer}')">✅ Goed</button>
        <button class="wrong" onclick="markGalerijAnswer(false, '${img.answer}')">⏩ Pas</button>
        <button class="secondary" onclick="nextGalerijQuestion()">Volgende</button>
        ${!galleryTimerRunning ? '<button onclick="startGalerijTimer()" class="secondary" style="margin-left:8px;">Start Timer (Herstart)</button>' : ''}
      </div>
    `;
  }
  else if (galleryPhase === 'aanvul') {
    
    area.innerHTML = `
      <div class="small muted">Beurt: ${playerName}</div>
      <p>Beantwoord de nog openstaande afbeeldingen:</p>
      <button onclick="startGalerijTimer()" class="bank" style="margin-bottom: 10px;" ${galleryTimerRunning ? 'disabled' : ''}>Start tijd</button>
      <div id="aanvul-buttons" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>
      <div style="margin-top:8px;">
        <button class="secondary" onclick="nextAanvulTurn()">Pas op alle overblijvende antwoorden</button>
      </div>
    `;
    const btnContainer = document.getElementById('aanvul-buttons');
    passedImages.forEach(img => {
      const btn = document.createElement('button');
      btn.textContent = img.answer;
      btn.className = 'good';
      btn.onclick = () => markAanvulAnswer(img);
      btnContainer.appendChild(btn);
    });
  }
else if (galleryPhase === 'slideshow') {
    const img = galleryImages[galleryIndex];
    area.innerHTML = `
      <h3>Bespreekfase: ${currentGallery.theme}</h3>
      <div style="width:480px;height:320px;background:#000;display:flex;align-items:center;justify-content:center;border-radius:8px;margin:8px 0;">
        ${img.src.endsWith('.webm')
          ? `<video src="${img.src}" autoplay loop muted style="max-width:100%;max-height:100%;object-fit:contain;"></video>`
          : `<img src="${img.src}" style="max-width:100%;max-height:100%;object-fit:contain;">`}
      </div>
      <div style="margin-top:4px;"><strong>Antwoord:</strong> ${img.answer}</div>
      <div>Afbeelding ${galleryIndex + 1} / ${galleryImages.length}</div>
      <div style="margin-top:8px;">
        <button class="secondary" onclick="showNextSlideshow()">Volgende afbeelding</button>
        ${isLastGallery 
          ? `<button onclick="endGalerijRound()" style="margin-left:8px;">Einde ronde scherm</button>` 
          : `<button onclick="startGalerijForPlayer(${galleryPlayerIndex + 1})" style="margin-left:8px;">Start volgende galerij (${nextPlayer.name})</button>`}
        <!-- ✅ Knop om display handmatig naar bespreekfase te sturen -->
        <button onclick="forceSlideshowPhaseOnDisplay()" class="secondary" style="margin-left:8px;">➡️ Forceer bespreekfase op display</button>
      </div>
    `;
}

else if (galleryPhase === 'slideshow') {
    const img = galleryImages[galleryIndex];
    area.innerHTML = `
      <h3>Bespreekfase: ${currentGallery.theme}</h3>
      <div style="width:480px;height:320px;background:#000;display:flex;align-items:center;justify-content:center;border-radius:8px;margin:8px 0;">
        ${img.src.endsWith('.webm')
          ? `<video src="${img.src}" autoplay loop muted style="max-width:100%;max-height:100%;object-fit:contain;"></video>`
          : `<img src="${img.src}" style="max-width:100%;max-height:100%;object-fit:contain;">`}
      </div>
      <div style="margin-top:4px;"><strong>Antwoord:</strong> ${img.answer}</div>
      <div>Afbeelding ${galleryIndex + 1} / ${galleryImages.length}</div>
      <div style="margin-top:8px;">
        <button class="secondary" onclick="showNextSlideshow()">Volgende afbeelding</button>
        
        ${isLastGallery 
          ? `<button onclick="endGalerijRound()" style="margin-left:8px;">Einde ronde scherm</button>` 
          : `<button onclick="startGalerijForPlayer(${galleryPlayerIndex + 1})" style="margin-left:8px;">Start volgende galerij (${nextPlayer.name})</button>`}
      </div>
    `;
  }
  else if (galleryPhase === 'done') {
    
    area.innerHTML = `
      <h3>✅ Galerijronde afgerond</h3>
      <p>Alle kandidaten hebben hun galerij gehad.</p>
    `;
    
    document.getElementById('nextRound').disabled = false;
  }
}

function forceSlideshowPhaseOnDisplay() {
    if (!currentGallery) return;

    const img = galleryImages[galleryIndex];

    sendDisplayUpdate({
        type: 'update',
        key: 'galerij',
        scene: 'scene-round-galerij-slideshow',
        galleryTheme: currentGallery.theme,
        imageSrc: img?.src,
        imageAnswer: img?.answer, 
        answers: galleryImages.map(p => ({
            text: p.answer,
            found: p.found || false,
            points: 15
        })),
        players: players,
        activePlayer: players[galleryPlayerIndex],
        activeIndex: galleryPlayerIndex,
        imageIndex: galleryIndex, 
        totalImages: galleryImages.length 
    });

    flash('Display handmatig naar bespreekfase gestuurd.');
}


function startGalerijForPlayer(playerIndex) {
  stopGalerijTimer(false);

  galleryPlayerIndex = playerIndex;
  const selectedGallery = galerijRoundOrder[playerIndex % galerijRoundOrder.length];
  currentGallery = { theme: selectedGallery.theme, folder: selectedGallery.folder };
  
  let count = 10;
  if (typeof galerijPhotoCount !== 'undefined' && !isNaN(galerijPhotoCount)) {
    count = galerijPhotoCount;
  }
  galleryImages = selectedGallery.images.slice(0, count);
  galleryIndex = 0;
  passedImages = [];
  galleryPhase = 'main';

  flash(`Start galerij: ${currentGallery.theme}`);

  sendDisplayUpdate({
    type: 'update',
    key: 'galerij',
    scene: 'scene-round-galerij-main',
    galleryTheme: currentGallery.theme,
    imageSrc: galleryImages[0]?.src,
    players: players,
    activePlayer: players[playerIndex],
    activeIndex: galleryPlayerIndex,
    imageIndex: 0,
    totalImages: galleryImages.length
  });

  startGalerijTimer();
  renderGalerijHostUI();
}

function nextGalerijQuestion() {
    galleryIndex++;
    if (galleryIndex >= galleryImages.length) {
        stopGalerijTimer(true);
        if (passedImages.length > 0) {
            startAanvulPhase();
        } else {
            startSlideshowPhase();
        }
    } else {
        renderGalerijHostUI();
        sendDisplayUpdate({
            type: 'update',
            key: 'galerij',
            scene: 'scene-round-galerij-main',
            galleryTheme: currentGallery.theme,
            imageSrc: galleryImages[galleryIndex]?.src,
            players: players,
            activePlayer: players[galleryPlayerIndex],
            activeIndex: galleryPlayerIndex,
            imageIndex: galleryIndex, 
            totalImages: galleryImages.length 
        });
    }
}

function markGalerijAnswer(isRight, answer) {
  const currentPlayer = players[galleryPlayerIndex];
  if (!currentPlayer) return;

  const currentImage = galleryImages[galleryIndex];

  if (isRight) {
    currentPlayer.seconds += 15;
    flash(`Goed! ${answer} levert +15s op voor ${currentPlayer.name}`);
    playSFX('SFX/goed.mp3');
    currentImage.found = true; 
  } else {
    flash(`Pas op ${answer}`);
    if (!passedImages.some(img => img.answer === currentImage.answer)) {
      passedImages.push(currentImage);
    }
  }

  renderPlayers();
  
  
  sendGalerijDisplayUpdate();
  
  
  nextGalerijQuestion();
}



function startAanvulPhase() {
    stopGalerijTimer(false);
    galleryPhase = 'aanvul';
    aanvulQueue = players.filter((p,i)=>i!==galleryPlayerIndex).sort((a,b)=>a.seconds-b.seconds);
    nextAanvulTurn();
}

function nextAanvulTurn() {
    stopGalerijTimer(true);
    if (aanvulQueue.length === 0) {
        startSlideshowPhase();
        return;
    }

    currentAanvulPlayer = aanvulQueue.shift();
    renderGalerijHostUI();

    
    const aanvulPlayerIndex = currentAanvulPlayer ? players.findIndex(p => p.name === currentAanvulPlayer.name) : -1;

    
    sendDisplayUpdate({
        type: 'update',
        key: 'galerij',
        scene: 'scene-round-galerij-aanvul',
        galleryTheme: currentGallery.theme,
        answers: galleryImages.map(img => ({
            text: img.answer,
            found: img.found || false,
            points: 15
        })),
        players: players,
        activePlayer: currentAanvulPlayer,
        activeIndex: aanvulPlayerIndex 
    });
}

function markAanvulAnswer(img) {
    if (!currentAanvulPlayer) return;

    currentAanvulPlayer.seconds += 15;
    flash(`${currentAanvulPlayer.name} correct: ${img.answer} (+15s)`);
    playSFX('SFX/goed.mp3');

    
    img.found = true;

    
    passedImages = passedImages.filter(p => p !== img);

    renderPlayers();

    
    if (galleryImages.every(p => p.found)) {
        stopGalerijTimer(false);
        startSlideshowPhase();
    } else {
        renderGalerijHostUI(); 
    }

    
    sendGalerijDisplayUpdate();
}

function startSlideshowPhase() {
    stopGalerijTimer(false);
    galleryPhase = 'slideshow';
    galleryIndex = 0;
    renderGalerijHostUI();

    sendDisplayUpdate({
        type: 'update',
        key: 'galerij',
        scene: 'scene-round-galerij-slideshow',
        galleryTheme: currentGallery.theme,
        imageSrc: galleryImages[galleryIndex]?.src,
        imageAnswer: galleryImages[galleryIndex]?.answer, 
        players: players,
        activePlayer: players[galleryPlayerIndex],
        activeIndex: galleryPlayerIndex,
        imageIndex: galleryIndex, 
        totalImages: galleryImages.length 
    });
}

function showNextSlideshow() {
    galleryIndex++;
    const isLastImage = galleryIndex >= galleryImages.length;
    const isLastGallery = galleryPlayerIndex === players.length - 1;

    if (isLastImage) {
        if (isLastGallery) {
            endGalerijRound();
            return;
        } else {
            galleryPhase = 'done';
            flash(`Galerij van ${players[galleryPlayerIndex].name} besproken. Start volgende.`);
        }
  } else {
        const currentImage = galleryImages[galleryIndex]; 

        sendDisplayUpdate({
            type: 'update',
            key: 'galerij',
            scene: 'scene-round-galerij-slideshow',
            galleryTheme: currentGallery.theme,
            imageSrc: currentImage?.src,
            imageAnswer: currentImage?.answer, 
            players: players,
            activePlayer: players[galleryPlayerIndex],
            activeIndex: galleryPlayerIndex,
            imageIndex: galleryIndex, 
            totalImages: galleryImages.length 
        });
    }

    renderGalerijHostUI();
}


function endGalerijRound() {
    galleryPhase = 'done';
    flash('Galerijronde compleet. Ga naar het eindscherm.');
    renderGalerijHostUI();

    sendDisplayUpdate({
        type: 'round_end',
        key: 'galerij',
        scene: 'scene-round-galerij-done',
        name: 'Galerijronde',
        players: players.map(p => ({ name: p.name, seconds: p.seconds }))
    });
}
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function getOpenDeurIntroVideoUrl(question) {
  if (!question) return '';
  return question.introVideoUrl || question.videoUrl || question.introVideo || question.video || '';
}

function setupOpenDeurRound() {
  // Stop klok als deze loopt (exclusief voor 3-6-9)
  if (typeof klok369_stopLoop === 'function') {
    klok369_stopLoop();
    klok369_resetTimer();
  }
  
  // Haal vragen op met fallback naar standaard vragen
  const questionsToUse = getQuestionsForRound('opendeur', openDeurQuestions);
  
  // Bepaal aantal vragen op basis van player mode
  const questionsCount = (typeof playerModeSettings !== 'undefined' && playerModeSettings.playerCount === 1) 
    ? playerModeSettings.questionsPerRound 
    : Math.min(3, players.length);
  
  if (typeof questionsToUse === 'undefined' || questionsToUse.length < questionsCount) {
      flash(`Fout: Onvoldoende Open Deur-vragen beschikbaar (minstens ${questionsCount} nodig).`);
      return;
  }

  // Check of shuffle aan of uit staat
  const shouldShuffle = shouldShuffleRound('opendeur');
  const orderedQuestions = shouldShuffle ? shuffle(questionsToUse) : questionsToUse;
  perRoundState.questions = orderedQuestions.slice(0, questionsCount).map((q, index) => ({
      ...q,
      
      fromPlayerIndex: index, 
      played: false 
  }));

  perRoundState.remainingPlayers = players
    .map((p, i) => ({ i, seconds: p.seconds }))
    .sort((a, b) => a.seconds - b.seconds || a.i - b.i)
    .map(p => p.i);
  perRoundState.openDeurStarterOrder = [...perRoundState.remainingPlayers];
  perRoundState.playersWhoChoseQuestion = []; 
  perRoundState.currentQuestion = null;
  currentQuestionIndex = 0;


activePlayerIndex = perRoundState.remainingPlayers[0];
highlightActive();

currentQuestionEl.innerHTML = `
  <em>Open Deur: kies een vraag van een van de drie vraagstellers.</em><br>
  <em><strong>${players[activePlayerIndex].name}</strong> is aan de beurt om een vraagsteller te kiezen.</em>
  <div id="opendeurChoices" style="margin-top:1em"></div>
`;

renderOpenDeurChoices();


  
  sendOpenDeurDisplayUpdate('round_start', 'scene-round-opendeur-vragensteller');
}

function renderOpenDeurChoices() {
  const cont = document.getElementById('opendeurChoices');
  if (!cont) return; 
  cont.innerHTML = '';

  
  const remainingQuestions = perRoundState.questions.filter(q => !q.played);
  if (remainingQuestions.length === 0) {
    cont.innerHTML = '<em>Geen vragen meer over.</em>';
    return;
  }

  remainingQuestions.forEach((q,i)=>{
    const btn = document.createElement('button');
    btn.textContent = `Vraag van ${q.from}`;
    btn.className = 'secondary';
    btn.addEventListener('click', ()=>chooseOpenDeurQuestion(perRoundState.questions.indexOf(q)));
    cont.appendChild(btn);
  });
}

function chooseOpenDeurQuestion(index){
  const q = perRoundState.questions[index];
  if(q.played) return;

  q.played = true;
  q.introVideoPlayed = false;
  perRoundState.currentQuestion = q;
  
  q.answersDisplay = q.answers.slice(0, 4); 
  q.answered = Array(q.answersDisplay.length).fill(false);
  q.passedPlayers = [];
  perRoundState.allPlayersHavePassed = false;

  
  if(!perRoundState.playersWhoChoseQuestion.includes(activePlayerIndex)){
    perRoundState.playersWhoChoseQuestion.push(activePlayerIndex);
  }

  
  perRoundState.currentAnswerPlayers = [...perRoundState.remainingPlayers]
    .filter(idx => !q.passedPlayers.includes(idx))
    .sort((a,b)=>players[a].seconds - players[b].seconds || a - b);
  
  
  currentQuestionEl.innerHTML = `
    <div class="small muted">Beurt: <strong>${players[activePlayerIndex].name}</strong></div>
    <strong>Vraag van ${q.from}</strong>
    <div class="small">"${q.question}"</div>
    <div id="openDeurAnswerArea" style="margin-top:1em"></div>
    <div class="muted small">Antwoorden: ${q.answersDisplay.join(', ')}</div>
    ${q.remarks ? `<div class="host-remarks">💬 ${q.remarks}</div>` : ''}
  `;

  showOpenDeurAnswerControls();
  flash(`${players[activePlayerIndex].name} mag antwoorden...`);

  
  sendOpenDeurDisplayUpdate('update', 'scene-round-opendeur-vraag');
}


function showOpenDeurAnswerControls(){
  const rc = document.getElementById('roundControls');
  rc.innerHTML = '';

  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start tijd (T)';
  startBtn.className = 'right';
  startBtn.addEventListener('click', ()=>startOpenDeurTimer());
  rc.appendChild(startBtn);

  perRoundState.currentQuestion.answers.forEach((ans,i)=>{
    const ansBtn = document.createElement('button');
    ansBtn.textContent = `(${i + 1}) "${ans}" goed`;
    ansBtn.className = 'right';
    ansBtn.addEventListener('click', ()=>{
      if(!perRoundState.currentQuestion.answered[i]){
        markOpenDeurAnswer(i);
        ansBtn.disabled = true;
        ansBtn.style.filter = 'grayscale(80%)';
      }
    });
    rc.appendChild(ansBtn);
  });

  const passBtn = document.createElement('button');
  passBtn.textContent = 'Pas (P)';
  passBtn.className = 'secondary';
  passBtn.addEventListener('click', ()=>passOpenDeur());
  rc.appendChild(passBtn);
}

function startOpenDeurTimer(){
  
  if (typeof stopLoopTimerSFX !== 'function') return flash('Error: stopLoopTimerSFX not found'); 
  
  stopLoopTimerSFX(); 

  
  try { sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' }); } catch(e) {}
  
  flash(`Tijd gestart voor ${players[activePlayerIndex].name}`);
  if(thinkingTimerInterval) clearInterval(thinkingTimerInterval);
thinkingTimerInterval = setInterval(()=>{
    players[activePlayerIndex].seconds = Math.max(0, players[activePlayerIndex].seconds - 1);

    renderPlayers(); 
    sendOpenDeurDisplayUpdate('update', 'scene-round-opendeur-vraag'); 

    if (players[activePlayerIndex].seconds <= 0) {
        clearInterval(thinkingTimerInterval);
      flash(`${players[activePlayerIndex].name} is door zijn tijd heen!`);
      if (typeof showPreFinaleBonusControls === 'function') showPreFinaleBonusControls();
      if (typeof passOpenDeur === 'function') passOpenDeur();
      return;
    }
}, 1000);

}

function markOpenDeurAnswer(ansIndex){
  const q = perRoundState.currentQuestion;
  if(!q || q.answered[ansIndex]) return;
  if(ansIndex >= q.answersDisplay.length) return;

  q.answered[ansIndex] = true;
  const gained = 20;
  players[activePlayerIndex].seconds += gained;
  flash(`${players[activePlayerIndex].name} correct antwoord (+${gained}s)`);
  playSFX('SFX/goed.mp3');
  renderPlayers();

  
  sendOpenDeurDisplayUpdate('update', 'scene-round-opendeur-vraag');

  
  if(q.answered.every(a => a)){
    clearInterval(thinkingTimerInterval);
    if (typeof stopLoopTimerSFX === 'function') stopLoopTimerSFX();
    flash(`Vraag "${q.from}" volledig opgelost!`);
    playSFX('SFX/goed.mp3');

    
    sendOpenDeurDisplayUpdate('vraag_voltooid', 'scene-round-opendeur-vraag');

    
    
    showReturnToQuestionerButton();

    
    perRoundState.currentQuestion = null;
    return;
  }
}




function showRemainingQuestionsForNextPlayer(){
  
  highlightActive();

  const remainingQuestions = perRoundState.questions.filter(q => !q.played);
  if(remainingQuestions.length === 0){
    
    flash('Open Deur-ronde afgerond!');
    currentQuestionEl.innerHTML = '<em>Einde van de Open Deur-ronde.</em>';
    const cont = document.getElementById('opendeurChoices');
    if(cont) cont.innerHTML = '';
    const rc = document.getElementById('roundControls');
    if(rc) rc.innerHTML = '';
    return;
  }

  
  currentQuestionEl.innerHTML = `
    <em>${players[activePlayerIndex].name} mag een vraag kiezen van de overgebleven vraagstellers.</em>
    <div id="opendeurChoices" style="margin-top:1em"></div>
  `;
  renderOpenDeurChoices();
}

function nextOpenDeurTurn() {
  
  const candidates = (perRoundState.openDeurStarterOrder || perRoundState.remainingPlayers || [])
    .filter(idx => !perRoundState.playersWhoChoseQuestion.includes(idx));

  if(candidates.length === 0){
    
    flash('Open Deur-ronde afgerond!');
    currentQuestionEl.innerHTML = '<em>Einde van de Open Deur-ronde.</em>';
    document.getElementById('opendeurChoices').innerHTML = '';
    document.getElementById('roundControls').innerHTML = '';
    perRoundState.currentQuestion = null;
    return;
  }

  
  activePlayerIndex = candidates[0];
  highlightActive();
  perRoundState.currentQuestion = null;

  const remainingQuestions = perRoundState.questions.filter(q => !q.played);
  if(remainingQuestions.length > 0){
    currentQuestionEl.innerHTML = `
      <em>${players[activePlayerIndex].name} mag een vraag kiezen van de overgebleven vraagstellers.</em>
      <div id="opendeurChoices" style="margin-top:1em"></div>
    `;
    renderOpenDeurChoices();
  } else {
    currentQuestionEl.innerHTML = '<em>Alle vragen zijn gespeeld.</em>';
    const cont = document.getElementById('opendeurChoices');
    if(cont) cont.innerHTML = '';
  }
}


function passOpenDeur(){
  clearInterval(thinkingTimerInterval);
  if (typeof stopLoopTimerSFX === 'function') stopLoopTimerSFX();
  sendOpenDeurDisplayUpdate('update', 'scene-round-opendeur-vraag');
  playSFX('SFX/klokeind.mp3');
  const q = perRoundState.currentQuestion;
  if(!q) return;

  flash(`${players[activePlayerIndex].name} heeft gepast`);

  
  if(!q.passedPlayers.includes(activePlayerIndex)){
    q.passedPlayers.push(activePlayerIndex);
  }

  
  perRoundState.currentAnswerPlayers = perRoundState.currentAnswerPlayers
    .filter(idx => !q.passedPlayers.includes(idx));

  perRoundState.currentAnswerPlayers.sort((a,b) => players[a].seconds - players[b].seconds || a - b);

  if(perRoundState.currentAnswerPlayers.length > 0){
    
    activePlayerIndex = perRoundState.currentAnswerPlayers[0];
    highlightActive();
    flash(`${players[activePlayerIndex].name} mag antwoorden of passen...`);
    
    
    sendOpenDeurDisplayUpdate('update', 'scene-round-opendeur-vraag');
  } else {
    
    // Alle kandidaten hebben gepast - toon alle antwoorden en voeg knop toe
    perRoundState.allPlayersHavePassed = true;
    flash('Alle kandidaten hebben gepast - alle antwoorden worden zichtbaar.');
    sendOpenDeurDisplayUpdate('update', 'scene-round-opendeur-vraag');
    showReturnToQuestionerButton();
  }
}

function sendOpenDeurDisplayUpdate(type, scene) {
    const data = {
        type: type,
        name: 'Open Deur',
        key: 'opendeur',
        scene: scene,
        activeIndex: activePlayerIndex,
        players: players.map(p => ({
            index: p.index,
            name: p.name,
            seconds: p.seconds,
            isActive: p.index === activePlayerIndex
        }))
    };

    if (scene === 'scene-round-opendeur-lobby') {
        data.statusText = 'Wacht op de host om de ronde te starten.';
    }

if (scene === 'scene-round-opendeur-vragensteller') {
    data.questioners = perRoundState.questions.map((q, idx) => ({
        index: idx,
        name: q.from,
        isChosen: q.played
    }));

    data.activeChoosingPlayerIndex = activePlayerIndex;
    data.activeChoosingPlayer = players[activePlayerIndex]?.name || '—';
}


    if (scene === 'scene-round-opendeur-vraag' && perRoundState.currentQuestion) {
        const q = perRoundState.currentQuestion;
        const introVideoUrl = getOpenDeurIntroVideoUrl(q);
        const showIntroVideo = !!introVideoUrl && !q.introVideoPlayed;
        if (showIntroVideo) {
          q.introVideoPlayed = true;
        }
        const currentAnswerPlayerIndex = perRoundState.currentAnswerPlayers 
              ? perRoundState.currentAnswerPlayers[0] 
              : activePlayerIndex;

        data.currentQuestion = {
            from: q.from,
            questionText: q.question,
            answers: q.answersDisplay.map((text, i) => ({
                text: text,
                isAnswered: q.answered[i]
            })),
          timeGain: 20,
          introVideoUrl: introVideoUrl || null
        };

        data.introVideoUrl = introVideoUrl || null;
        data.showIntroVideo = showIntroVideo;

        data.activeAnsweringPlayer = currentAnswerPlayerIndex !== undefined ? players[currentAnswerPlayerIndex].name : '—';
        data.activeAnsweringPlayerIndex = currentAnswerPlayerIndex;
        data.totalAnswers = q.answersDisplay.length;
        data.guessedAnswers = q.answered.filter(a => a).length;
        data.isTimerRunning = !!thinkingTimerInterval;
        data.isAllAnswersVisible = perRoundState.allPlayersHavePassed || false;
    }

    
    if (type === 'vraag_voltooid') {
        data.questionCompleted = true;
    }

    sendDisplayUpdate(data);
}
function showReturnToQuestionerButton() {
  const rc = document.getElementById('roundControls');
  if (!rc) return;

  
  rc.innerHTML = '';

  
  const returnBtn = document.createElement('button');
  returnBtn.textContent = 'Terug naar vragenstellers';
  returnBtn.className = 'secondary highlight-return';
  returnBtn.style.marginTop = '1em';
  returnBtn.style.padding = '0.5em 1em';
  returnBtn.style.fontWeight = 'bold';

  
returnBtn.addEventListener('click', () => {
    flash('Terug naar vragensteller-keuze');

    // Reset de state voor alle kandidaten gepast
    perRoundState.allPlayersHavePassed = false;
    
    // Haal volgende beschikbare kandidaat
    const remainingCandidates = (perRoundState.openDeurStarterOrder || perRoundState.remainingPlayers || [])
      .filter(idx => !perRoundState.playersWhoChoseQuestion.includes(idx));

    if (remainingCandidates.length > 0) {
        activePlayerIndex = remainingCandidates[0]; 
    }

    const currentPlayer = players[activePlayerIndex];

    currentQuestionEl.innerHTML = `
      <em>Open Deur: kies een vraag van een van de drie vraagstellers.</em><br>
      <em><strong>${currentPlayer.name}</strong> is aan de beurt om een vraagsteller te kiezen.</em>
      <div id="opendeurChoices" style="margin-top:1em"></div>
    `;

    renderOpenDeurChoices();
    resetRoundControls();

    sendOpenDeurDisplayUpdate('update', 'scene-round-opendeur-vragensteller');
});



  rc.appendChild(returnBtn);
}


function resetRoundControls() {
  const rc = document.getElementById('roundControls');
  if (!rc) return;
  rc.innerHTML = '';
}

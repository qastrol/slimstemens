







const FINALE_POINTS_DEDUCTION = 20;

perRoundState.finale = perRoundState.finale || {};
let finaleTimerInterval = null;
let finaleTimerRunning = false;
let finaleLoopTimerSeconds = 0; 


function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}



function getOpponentIndex(currentPlayerOriginalIndex) {
    
    const currentPlayerIndexInFinalsArray = players.findIndex(p => p.index === currentPlayerOriginalIndex);
    if (currentPlayerIndexInFinalsArray === -1) return -1;

    
    const opponentIndexInFinalsArray = 1 - currentPlayerIndexInFinalsArray; 
    
    
    return players[opponentIndexInFinalsArray].index;
}

function determineFinalistsAndSetupPreRound() {
    
    if (players.length !== 3 && players.length !== 2) {
        flash(`Fout: Finale moet starten met 2 of 3 spelers. Huidig aantal: ${players.length}.`, 'error');
        return false;
    }

    // Bij 2 spelers valt niemand af - beide zijn al finalisten
    if (players.length === 2) {
        const sortedPlayers = [...players].sort((a, b) => a.seconds - b.seconds);
        players = [...sortedPlayers]; // Zorg dat spelers gesorteerd zijn op tijd
        activePlayerIndex = players[0].index; // Laagste tijd begint
        
        perRoundState.finale.lastActivePlayerIndex = activePlayerIndex;
        perRoundState.finale.afvallerOriginalIndex = -1; // Geen afvaller
        perRoundState.finale.afvallerName = null;
        
        flash(`Finale start met 2 spelers: ${players[0].name} en ${players[1].name}. ${players[0].name} begint (laagste tijd).`);
        renderPlayers();
        
        // Render de pre-start UI met de knop "Start Eerste Vraag"
        renderFinaleHostUI('pre_start', -1);
        
        // Stuur display update
        sendFinaleDisplayUpdate('round_start', 'scene-round-finale-pre', {
            afvallerIndex: -1,
            allPlayers: players,
            collectiefEndOption: null
        });
        
        return true;
    }
    
    
    const collectiefEndOption = document.getElementById('collectiefEndOption')?.value || 'lowestOut';
    
    
    const sortedPlayers = [...players].sort((a, b) => b.seconds - a.seconds);

    let afvallerOriginalIndex = -1;
    let finalistNames = [];
    
    if (collectiefEndOption === 'highestWinner') {
        
        afvallerOriginalIndex = sortedPlayers[0].index; 
        finalistNames = sortedPlayers.slice(1).map(p => p.name); 
    } else { 
        
        afvallerOriginalIndex = sortedPlayers[sortedPlayers.length - 1].index; 
        finalistNames = sortedPlayers.slice(0, 2).map(p => p.name);
    }
    
    
    const originalPlayers = [...players]; 
    
    
    players = players.filter(p => finalistNames.includes(p.name));
    
    
    players.sort((a, b) => a.seconds - b.seconds); 
    activePlayerIndex = players[0].index; 
    
    perRoundState.finale.lastActivePlayerIndex = activePlayerIndex; 
    perRoundState.finale.afvallerOriginalIndex = afvallerOriginalIndex; 
    perRoundState.finale.afvallerName = originalPlayers.find(p => p.index === afvallerOriginalIndex)?.name || 'Onbekend';

    
    renderPlayers(); 

    
    renderFinaleHostUI('pre_start', afvallerOriginalIndex);
    
    
    sendFinaleDisplayUpdate('round_start', 'scene-round-finale-pre', {
        afvallerIndex: afvallerOriginalIndex,
        allPlayers: originalPlayers,
        collectiefEndOption: collectiefEndOption 
    });
    
    flash(`Finale vastgesteld: ${players.map(p => p.name).join(' en ')} spelen de finale.`, 'info');
    
    return true;
}


function startFinaleGame() {
    
    if (players.length !== 2) {
        flash('Fout: Kan Finale niet starten. Er zijn geen 2 finalisten bepaald.', 'error');
        return;
    }
    
    
    nextFinaleQuestion(); 
}


function setupFinaleRound() {
    // Stop klok als deze loopt (exclusief voor 3-6-9)
    if (typeof klok369_stopLoop === 'function') {
      klok369_stopLoop();
      klok369_resetTimer();
    }
    
    perRoundState.finale = perRoundState.finale || {};

    // Haal vragen op met fallback naar standaard vragen
    const questionsToUse = getQuestionsForRound('finale', finaleVragen);
    
    if (typeof questionsToUse === 'undefined' || !Array.isArray(questionsToUse) || questionsToUse.length === 0) {
        flash('Fout: Kon geen finaleVragen vinden of de array is leeg. Controleer vragen-finale.js en de HTML laadvolgorde.');
        console.error('FINALE FOUT: finaleVragen niet gedefinieerd of leeg.');
        return; 
    }
    
    perRoundState.finale.currentQuestionIndex = 0;
    // Check of shuffle aan of uit staat
    const shouldShuffle = shouldShuffleRound('finale');
    const orderedQuestions = shouldShuffle ? shuffleArray(questionsToUse.slice()) : questionsToUse.slice();
    perRoundState.finale.questions = orderedQuestions.slice(0, 10).map(q => ({
        ...q,
        foundAnswers: [],
        playersWhoPassed: []
    }));
    perRoundState.finale.finalists = [];
    
    
    determineFinalistsAndSetupPreRound(); 


    if (!determineFinalistsAndSetupPreRound()) {
        roundRunning = false;
        return;
    }
    
    perRoundState.finale.currentQuestionIndex = -1; 

    
    roundRunning = true;
}


function nextFinaleQuestion() {
    stopAllTimers();
    stopFinaleTimer(false); 
    
    perRoundState.finale.currentQuestionIndex++;
    const qIndex = perRoundState.finale.currentQuestionIndex;
    
    if (qIndex >= perRoundState.finale.questions.length) {
        
        return;
    }

    const currentQuestion = perRoundState.finale.questions[qIndex];
    
    
    perRoundState.finale.currentQuestion = currentQuestion; 

    
    currentQuestion.foundAnswers = currentQuestion.foundAnswers || []; 
    currentQuestion.playersWhoPassed = []; 

    
    const [p1, p2] = players; 
    
    let startingPlayer = null;

    if (p1.seconds < p2.seconds) {
        startingPlayer = p1;
    } else if (p2.seconds < p1.seconds) {
        startingPlayer = p2;
    } else {
        
        const prevStarterIndex = perRoundState.finale.lastActivePlayerIndex; 
        const otherPlayer = players.find(p => p.index !== prevStarterIndex);
        startingPlayer = otherPlayer || p1; 
        flash(`Gelijke stand! Beurt naar ${startingPlayer.name} (wissel).`, 'info');
    }
    
    activePlayerIndex = startingPlayer.index; 
    perRoundState.finale.lastActivePlayerIndex = activePlayerIndex; 
    
    highlightActive(); 
    renderFinaleHostUI('main'); 
    
    sendFinaleDisplayUpdate('update', 'scene-round-finale-main');
}




function startFinaleTimer() {
    const activePlayer = players.find(p => p.index === activePlayerIndex);
    if (!activePlayer) {
        flash('Fout: Geen actieve speler voor timer.');
        return;
    }

    stopFinaleTimer(false); 

    
    finaleLoopTimerSeconds = 0;

    
    if (typeof playSFX === 'function') {
        try { sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' }); } catch(e) {}
    }

    flash(`Klok gestart voor ${activePlayer.name}.`);

    finaleTimerInterval = setInterval(() => {
        finaleLoopTimerSeconds++;
        
        
        activePlayer.seconds = Math.max(0, activePlayer.seconds - 1);
        
        renderPlayers();
        
        
        sendFinaleDisplayUpdate('update', 'scene-round-finale-main');
        
        
        if (activePlayer.seconds <= 0) {
            clearInterval(finaleTimerInterval);
            stopFinaleTimer(true);
            flash(`${activePlayer.name} is door zijn tijd heen!`);
            const winner = checkFinaleEnd();
            if (winner) {
                endFinaleGame(winner);
            }
        }
    }, 1000);

    finaleTimerRunning = true;
    renderFinaleHostUI('main');
}


function stopFinaleTimer(playEndSound = false) {
    if (finaleTimerInterval) {
        clearInterval(finaleTimerInterval);
        finaleTimerInterval = null;
    }

    
    if (typeof stopLoopTimerSFX === 'function') {
        stopLoopTimerSFX();
    }

    if (playEndSound && typeof playSFX === 'function') {
        playSFX('SFX/klokeind.mp3');
    }

    finaleTimerRunning = false;
}


function resetFinaleTimer() {
    finaleLoopTimerSeconds = 0;
}




function markFinaleAnswer(answerIndex) {
    const currentQuestion = perRoundState.finale.currentQuestion;
    
    if (currentQuestion.foundAnswers.length >= currentQuestion.answers.length) {
        flash("Fout: Alle antwoorden zijn reeds gevonden!", 'wrong');
        return;
    }

    const activePlayer = players.find(p => p.index === activePlayerIndex);
    const opponentIndex = getOpponentIndex(activePlayerIndex);
    const opponent = players.find(p => p.index === opponentIndex);
    
    
    const answerText = currentQuestion.answers[answerIndex];

    const alreadyFound = (currentQuestion?.foundAnswers || []).some(a => a.answer === answerText);

    if (alreadyFound) {
        flash(`Fout: Antwoord "${answerText}" is al gegeven!`, 'wrong');
        return;
    }

    
    const timeGained = finaleLoopTimerSeconds;
    playSFX('SFX/goed.mp3');

    
    

    
    opponent.seconds = Math.max(0, opponent.seconds - FINALE_POINTS_DEDUCTION);
    
    
    currentQuestion.foundAnswers.push({
        answer: answerText,
        finderIndex: activePlayerIndex
    });

    flash(`GOED! ${activePlayer.name} heeft ${timeGained}s gebruikt. ${opponent.name}: -${FINALE_POINTS_DEDUCTION}s.`, 'right');

    
    resetFinaleTimer(); 
    
    
    renderPlayers();

    
    const winner = checkFinaleEnd();
    if (winner) {
        stopFinaleTimer(false); 
        endFinaleGame(winner);
        return;
    }
    
    
    if (currentQuestion.foundAnswers.length === currentQuestion.answers.length) {
        
        stopFinaleTimer(false); 
        nextFinaleQuestion();
        return;
    }
    
    
    sendFinaleDisplayUpdate('update', 'scene-round-finale-main');
    renderFinaleHostUI('main');
}




function passFinale() {
    const currentQuestion = perRoundState.finale.currentQuestion;
    const activePlayer = players.find(p => p.index === activePlayerIndex);
    
    
    stopFinaleTimer(true); 

    
    
    const timeUsed = finaleLoopTimerSeconds;
    
    
    if (!currentQuestion.playersWhoPassed.includes(activePlayerIndex)) {
        currentQuestion.playersWhoPassed.push(activePlayerIndex);
    }
    
    flash(`${activePlayer.name} past! ${timeUsed}s gebruikt.`, 'warning');
    
    
    resetFinaleTimer();
    
    renderPlayers();

    
    const winner = checkFinaleEnd();
    if (winner) {
        endFinaleGame(winner);
        return;
    }
    
    
    const opponentIndex = getOpponentIndex(activePlayerIndex);
    const opponent = players.find(p => p.index === opponentIndex);
    
    
    if (currentQuestion.playersWhoPassed.includes(opponentIndex)) {
        flash(`Beide spelers hebben gepast. Volgende vraag.`, 'info');
        nextFinaleQuestion();
    } else {
        
        activePlayerIndex = opponentIndex;
        flash(`Beurt naar ${opponent.name}.`, 'info');
        
        
        sendFinaleDisplayUpdate('update', 'scene-round-finale-main');
        renderFinaleHostUI('main');
    }
}

function checkFinaleEnd() {
    
    const afvaller = players.find(p => p.seconds <= 0);

    if (afvaller) {
        
        const winnaarIndex = getOpponentIndex(afvaller.index);
        return players.find(p => p.index === winnaarIndex);
    }

    return null;
}



function endFinaleGame(winner) {
    
    stopFinaleTimer(false); 

    playSFX('SFX/finale.mp3');

    
    const loser = players.find(p => p.index !== winner.index);
    const collectiefEndOption = document.getElementById('collectiefEndOption')?.value || 'lowestOut';
    const preFinaleAfvallerName = perRoundState.finale?.afvallerName || null;

    
    const controlsEl = document.getElementById('roundControls');
    controlsEl.innerHTML = `
        <div style="text-align:center;">
            <h1>FINALE VOORBIJ!</h1>
            <h2>De winnaar is: ${winner.name}</h2>
            <p><strong>Gefeliciteerd!</strong></p>
        </div>
    `;

    
    sendFinaleDisplayUpdate('round_end', 'scene-round-finale-end', {
        winnerIndex: winner.index,
        loserIndex: loser ? loser.index : null,
        loserName: loser ? loser.name : null,
        preFinaleAfvallerName: preFinaleAfvallerName,
        lowestOut: collectiefEndOption === 'lowestOut',
        collectiefEndOption: collectiefEndOption 
    });
    
    
    roundRunning = false;
    currentRoundIndex++;
}

function endFinaleRound() {
    roundRunning = false;
    stopAllTimers();
    stopFinaleTimer(false); 
    playSFX('SFX/finale.mp3');
    
    
    const loser = players.find(p => p.seconds <= 0);
    const winner = players.find(p => p.index !== loser?.index);

    let title = 'Finale Voorbij';
    let winnerText = '';
    let loserText = '';
    
    const collectiefEndOption = document.getElementById('collectiefEndOption')?.value || 'lowestOut';

    if (winner && loser) {
        if (collectiefEndOption === 'lowestOut') {
            title = 'De Slimste Mens van Twitch';
            winnerText = `${winner.name} is de nieuwe Slimste Mens van Twitch!`;
            loserText = `${loser.name} valt af.`;
        } else { 
            title = 'Winnaar Finale';
            winnerText = `${winner.name} wint de finale en gaat door naar de volgende aflevering!`;
            loserText = `${loser.name} is de afvaller.`;
        }
    } else {
        title = 'Einde Ronde (Fout)';
        winnerText = 'Kon de winnaar/verliezer niet bepalen.';
    }

    
    currentQuestionEl.innerHTML = `
        <h3>${title}</h3>
        <p><strong>Winnaar:</strong> ${winnerText}</p>
        <p><strong>Verliezer:</strong> ${loserText}</p>
    `;

    document.getElementById('roundControls').innerHTML = `
        <button onclick="flash('Spel is afgelopen, reset om opnieuw te beginnen.')" class="secondary">Einde Spel</button>
    `;
    
    
    sendDisplayUpdate({
        type: 'round_end',
        key: 'finale',
        scene: 'scene-round-finale-done',
        winner: winner ? winner.name : null,
        loser: loser ? loser.name : null,
        lowestOut: collectiefEndOption === 'lowestOut',
        players: players
    });

    flash(title, 'success');
}


function renderFinaleHostUI(phase = 'main', afvallerIndex = -1) {
    const currentQuestion = perRoundState.finale.currentQuestion;
    const answers = currentQuestion?.answers || [];
    const foundAnswers = currentQuestion?.foundAnswers || []; 
    const allFound = currentQuestion && (currentQuestion.foundAnswers.length === currentQuestion.answers.length);
    const activePlayer = players[activePlayerIndex];
    const controlsEl = document.getElementById('roundControls');
    const currentQuestionEl = document.getElementById('currentQuestion');
    const qIndex = perRoundState.finale.currentQuestionIndex;

    
    const opponentIndex = getOpponentIndex(activePlayerIndex);
    const opponent = players.find(p => p.index === opponentIndex);
    
    if (!controlsEl || !currentQuestionEl) return;
    
    let html = '';
    
    if (phase === 'pre_start') {
        const afvaller = afvallerIndex !== -1 ? 
            players.find(p => p.index === afvallerIndex) || {name: 'Onbekend', index: afvallerIndex} : 
            null;
        
        // Bij 2 spelers is er geen afvaller    
        if (afvallerIndex === -1) {
            currentQuestionEl.innerHTML = `
                <h3>Finale met 2 Spelers</h3>
                <p><strong>Finalisten:</strong> ${players.map(p => p.name).join(' en ')}.</p>
                <p><em>Bij 2 spelers valt er niemand af - beide spelers spelen de finale.</em></p>
                <p><strong>Startspeler:</strong> ${players.find(p => p.index === activePlayerIndex)?.name || players[0].name} (laagste tijd).</p>
            `;
        } else {
            currentQuestionEl.innerHTML = `
                <h3>Kandidaten voor de Finale</h3>
                ${afvaller ? 
                    `<p><strong>Afvaller:</strong> ${afvaller.name}.</p>` : 
                    `<p><strong>Slimste van de dag:</strong> ${players.find(p => !players.map(f => f.index).includes(p.index))?.name}.</p>`}
                <p><strong>Finalisten:</strong> ${players.map(p => p.name).join(' en ')}.</p>
                <p><strong>Startspeler:</strong> ${players.find(p => p.index === activePlayerIndex)?.name || players[0].name} (laagste tijd).</p>
            `;
        }

        controlsEl.innerHTML = `
            <button onclick="startFinaleGame()" class="primary">Start Eerste Vraag</button>
        `;
        return; 
    }
    
    
    currentQuestionEl.innerHTML = `
        <em>Vraag ${qIndex + 1}/${perRoundState.finale.questions.length}: ${currentQuestion.question}</em>
        ${currentQuestion.remarks ? `<div class="host-remarks">💬 ${currentQuestion.remarks}</div>` : ''}
        
        <div id="finaleAnswerList" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:10px; flex-direction: column;">
            ${answers.map((ans, i) => {
                const found = foundAnswers.find(fa => fa.answer === ans);
                const finderName = found ? players.find(p=>p.index===found.finderIndex).name : '';
                const display = found ? 
                    `✅ ${ans} (gevonden door ${finderName})` : 
                    `${ans}`;
                const className = found ? 'secondary' : 'primary';
                const disabled = found || phase !== 'main' ? 'disabled' : ''; 
                return `<button onclick="markFinaleAnswer(${i})" class="${className}" ${disabled}>${display}</button>`;
            }).join('')}
        </div>
    `;


    if (phase === 'main') {
        
        html = `
            <h4>Beurt: ${activePlayer.name}</h4>
            <div style="display:flex;gap:10px;margin-top:10px;">
                <button onclick="startFinaleTimer()" id="finaleStartTimer" class="primary">Start Klok / Vervolg Beurt</button>
                <button onclick="passFinale()" class="secondary" ${allFound ? 'disabled' : ''}>Pas (${activePlayer.name})</button>
            </div>
        `;
    } 
    else if (phase === 'answered') {
        
        const btnText = qIndex + 1 < perRoundState.finale.questions.length ? 
            `Start Volgende Vraag (${qIndex + 2})` : 'Einde Ronde (Vragen Op)';
            
        html = `
            <div style="margin-top:10px; padding:10px; border:1px solid #c084fc; font-weight:bold;">
                Vraag ${qIndex + 1} Afgerond.
            </div>
            <button onclick="nextFinaleQuestion()">${btnText}</button>
        `;
    }

    controlsEl.innerHTML = html;
}


function sendFinaleDisplayUpdate(action, scene, extraData = {}) {
    const qIndex = perRoundState.finale.currentQuestionIndex;
    const currentQuestion = perRoundState.finale.currentQuestion;
    
    let activePlayer = players.find(p => p.index === activePlayerIndex);
    let opponentIndex = getOpponentIndex(activePlayerIndex);

    
    const playersToSend = players.map(p => ({
        name: p.name,
        seconds: p.seconds,
        photoUrl: p.photoUrl,
        isActive: p.index === activePlayerIndex,
        isFinalist: true, 
        isOut: false
    }));
    
    let allPlayersForDisplay = playersToSend;

    
    if (scene === 'scene-round-finale-pre' && extraData.allPlayers && extraData.afvallerIndex !== -1) {
        const afvallerData = extraData.allPlayers.find(p => p.index === extraData.afvallerIndex);
        
        
        allPlayersForDisplay = extraData.allPlayers.map(p => {
            const finalist = playersToSend.find(fp => fp.name === p.name);
            if (finalist) {
                return finalist; 
            } else if (p.index === extraData.afvallerIndex) {
                
                return {
                    name: p.name,
                    seconds: p.seconds,
                    photoUrl: p.photoUrl,
                    isActive: false,
                    isFinalist: false,
                    isOut: true 
                };
            }
            return p; 
        });
    }

    
    const finalPlayersArray = (scene === 'scene-round-finale-pre') ? allPlayersForDisplay : playersToSend;
    
    
    const answersData = currentQuestion ? currentQuestion.answers.map(ans => {
        const found = currentQuestion.foundAnswers.find(fa => fa.answer === ans);
        const finderName = found ? players.find(p=>p.index===found.finderIndex).name : null;
        return {
            answer: ans,
            isFound: !!found,
            finderName: finderName
        };
    }) : [];

    sendDisplayUpdate({
        type: action,
        key: 'finale',
        scene: scene,
        currentQuestionIndex: qIndex + 1,
        maxQuestions: perRoundState.finale.questions.length,
        activePlayer: activePlayer?.name || '-',
        activeIndex: activePlayerIndex,
        players: finalPlayersArray, 
        question: currentQuestion?.question || 'Bepalen finalisten...',
        answers: answersData,
        allAnswersFound: currentQuestion?.foundAnswers.length === currentQuestion?.answers.length,
        playersWhoPassed: currentQuestion?.playersWhoPassed || [],
        opponentIndex: opponentIndex,
        timerSeconds: finaleLoopTimerSeconds, 
        timerRunning: finaleTimerRunning, 
        ...extraData 
    });
}

console.log('Round-Finale.js geladen met Finale logica.');
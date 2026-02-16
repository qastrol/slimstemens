const COLLECTIEF_POINTS = [10, 20, 30, 40, 50];

let collectiefEndOption = 'lowestOut'; 



let collectiefTimerInterval = null;
let collectiefTimerRunning = false;


function startLoopTimer() {
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer) return flash('Fout: Geen actieve speler voor timer.');

    stopLoopTimer(); 

    
    if (typeof playSFX === 'function') {
        try { sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' }); } catch(e) {}
    }

    collectiefTimerInterval = setInterval(() => {
        activePlayer.seconds = Math.max(0, activePlayer.seconds - 1);
        renderPlayers();
        
        
        sendCollectiefDisplayUpdate('update', 'scene-round-collectief-main');

        if (activePlayer.seconds <= 0) {
            clearInterval(collectiefTimerInterval);
            flash(`${activePlayer.name} is door zijn tijd heen!`);
            if (typeof showPreFinaleBonusControls === 'function') showPreFinaleBonusControls();
            passCollectief(); 
        }
    }, 1000);

    collectiefTimerRunning = true;
}


function stopLoopTimer(playEndSound = false) {
    if (collectiefTimerInterval) clearInterval(collectiefTimerInterval);
    collectiefTimerInterval = null;

    
    if (typeof stopLoopTimerSFX === 'function') stopLoopTimerSFX();

    if (playEndSound && typeof playSFX === 'function') {
        playSFX('SFX/klokeind.mp3');
    }

    collectiefTimerRunning = false;
}


function stopGlobalTimer() {
    stopLoopTimer(false);
}



function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


perRoundState.collectief = perRoundState.collectief || {};

function setupCollectiefRound() {
    // Stop klok als deze loopt (exclusief voor 3-6-9)
    if (typeof klok369_stopLoop === 'function') {
      klok369_stopLoop();
      klok369_resetTimer();
    }
    
    perRoundState.collectief = perRoundState.collectief || {};
    
    // Haal vragen op met fallback naar standaard vragen
    const questionsToUse = getQuestionsForRound('collectief', collectiefVragen);
    
    // Bepaal aantal vragen op basis van player mode
    const questionsCount = (typeof playerModeSettings !== 'undefined' && playerModeSettings.playerCount === 1) 
        ? playerModeSettings.questionsPerRound 
        : Math.min(players.length, 3);
    
    if (typeof questionsToUse === 'undefined' || questionsToUse.length < questionsCount) {
        flash(`Fout: Onvoldoende Collectief Geheugen-vragen beschikbaar (minstens ${questionsCount} nodig).`, 'error');
        return;
    }
    
    
    // Check of shuffle aan of uit staat
    const shouldShuffle = shouldShuffleRound('collectief');
    const orderedQuestions = shouldShuffle ? shuffleArray(questionsToUse.slice()) : questionsToUse.slice();
    perRoundState.collectief.questions = orderedQuestions.slice(0, questionsCount).map(q => ({
        ...q,
        foundAnswers: [],        
        playersWhoAnswered: []   
    }));
    
    perRoundState.collectief.currentQuestionIndex = 0;
    
    
    const sortedPlayers = [...players].sort((a, b) => a.seconds - b.seconds);
    activePlayerIndex = sortedPlayers[0].index;
    highlightActive();

    
    renderCollectiefHostUI('pre');

    
    sendCollectiefDisplayUpdate('round_start', 'scene-round-collectief-pre');

    flash(`Collectief Geheugen klaar. Speler ${players[activePlayerIndex].name} start met fragment 1.`);
}



function startCollectiefVideo() {
    stopGlobalTimer(); 
    stopLoopTimer(); 

    const currentQuestion = perRoundState.collectief.questions[perRoundState.collectief.currentQuestionIndex];
    
    flash(`Video gestart voor ${players[activePlayerIndex].name}. Druk op 'Start Klok' als de video voorbij is.`, 'info');
    renderCollectiefHostUI('video');

    
    const videoEl = document.getElementById('collectiefHostVideo');
    if (videoEl) {
        videoEl.play().catch(err => console.warn('Video kon niet starten:', err));
        videoEl.addEventListener('ended', () => {
            videoEl.style.display = 'none'; 
        });
    }

    
    const audioBtn = document.getElementById('toggleAudioBtn');
    if (audioBtn && videoEl) {
        audioBtn.addEventListener('click', () => {
            videoEl.muted = !videoEl.muted;
            audioBtn.textContent = videoEl.muted ? 'Audio Aan' : 'Audio Uit';
        });
    }

    
    sendCollectiefDisplayUpdate('update', 'scene-round-collectief-video');
}




function startCollectiefTimer() {
    
    const videoEl = document.getElementById('collectiefHostVideo');
    if (videoEl) {
        videoEl.pause();
        videoEl.style.display = 'none';
    }

    startLoopTimer(); 
    renderCollectiefHostUI('main');
    flash(`Klok gestart voor ${players[activePlayerIndex].name}.`);
}


function markCollectiefAnswer(answerIndex) {
    
    
    playSFX('SFX/goed.mp3'); 

    const currentQuestion = perRoundState.collectief.questions[perRoundState.collectief.currentQuestionIndex];
    const answerText = currentQuestion.answers[answerIndex];
    
    
    const alreadyFound = currentQuestion.foundAnswers.some(a => a.answer === answerText);
    if (alreadyFound) {
        flash(`Fout: Antwoord "${answerText}" is al gevonden. De beurt gaat naar de volgende kandidaat.`, 'wrong');
        passCollectief(true); 
        return; 
    }

    
    const pointsIndex = currentQuestion.foundAnswers.length; 
    const points = COLLECTIEF_POINTS[pointsIndex];
    
    

const newAnswer = {
    answer: answerText,
    points: points,
    finderIndex: activePlayerIndex,
    order: pointsIndex + 1
};
currentQuestion.foundAnswers.push(newAnswer);


updateAnswerButton(answerIndex);


    
    const currentPlayer = players[activePlayerIndex];
    currentPlayer.seconds += points;
    currentPlayer.seconds = Math.max(0, currentPlayer.seconds); 
    renderPlayers();
    
    flash(`Antwoord "${answerText}" goed! +${points} seconden gewonnen door ${currentPlayer.name}.`, 'right');

    
    sendCollectiefDisplayUpdate('update', 'scene-round-collectief-main');

    
    if (currentQuestion.foundAnswers.length === currentQuestion.answers.length) {
        
        stopLoopTimer(); 
        flash(`Alle antwoorden gevonden. ${currentPlayer.name} was de laatste vinder.`, 'success');
        sendCollectiefDisplayUpdate('update', 'scene-round-collectief-tussenstand');
        renderCollectiefHostUI('answered'); 
    } 
    
}



function passCollectief(isScoreAnnounced = false) {
    stopLoopTimer();
    if (!isScoreAnnounced) playSFX('SFX/klokeind.mp3');

    const currentQuestion = perRoundState.collectief.questions[perRoundState.collectief.currentQuestionIndex];
    
    
    if (!currentQuestion.playersWhoAnswered.includes(activePlayerIndex)) {
        currentQuestion.playersWhoAnswered.push(activePlayerIndex);
    }

    
    const allPlayerIndices = players.map((_, i) => i);
    const availablePlayersIndices = allPlayerIndices.filter(index => 
        !currentQuestion.playersWhoAnswered.includes(index)
    );

    if (availablePlayersIndices.length > 0) {
        
        const nextPlayer = availablePlayersIndices
            .map(index => players[index])
            .sort((a, b) => a.seconds - b.seconds)[0]; 

        activePlayerIndex = nextPlayer.index;
        highlightActive(); 

        flash(`${players[activePlayerIndex].name} mag aanvullen.`, 'info');
        
        
        renderCollectiefHostUI('main');
        
        
        sendCollectiefDisplayUpdate('update', 'scene-round-collectief-main');

    } else {
        
        flash('Iedereen is geweest. Einde van dit fragment.', 'info');
        
        
        sendCollectiefDisplayUpdate('update', 'scene-round-collectief-tussenstand');
        
        
        renderCollectiefHostUI('answered');
    }
}

function updateAnswerButton(answerIndex) {
    const currentQuestion = perRoundState.collectief.questions[perRoundState.collectief.currentQuestionIndex];
    const answerText = currentQuestion.answers[answerIndex];
    const foundAnswer = currentQuestion.foundAnswers.find(fa => fa.answer === answerText);
    if (!foundAnswer) return;

    const btn = document.querySelector(`#collectiefAnswerList button:nth-child(${answerIndex + 1})`);
    if (!btn) return;

    btn.innerHTML = `✅ ${foundAnswer.answer} (${foundAnswer.points}s)`;
    btn.classList.remove('primary');
    btn.classList.add('secondary');
    btn.disabled = true;
}



function nextCollectiefQuestion() {
    stopLoopTimer();
    
    perRoundState.collectief.currentQuestionIndex++;
    
    if (perRoundState.collectief.currentQuestionIndex < perRoundState.collectief.questions.length) {
        
        
        
        const sortedPlayers = [...players].sort((a, b) => a.seconds - b.seconds);
        activePlayerIndex = sortedPlayers[0].index; 
        
        highlightActive();

        flash(`Start Fragment ${perRoundState.collectief.currentQuestionIndex + 1} voor ${players[activePlayerIndex].name}.`);
        
        startCollectiefVideo(); 
        
    } else {
        
        endCollectiefRound();
    }
}

function endCollectiefRound() {
    roundRunning = false;
    stopAllTimers();

    
    const sortedPlayers = [...players].sort((a, b) => b.seconds - a.seconds);

    let slimsteVanDeDag = null;
    let afvaller = null;
    let finalistNames = [];
    
    // Check voor 1 speler: toon eindstand, geen finale
    if (players.length === 1) {
        const player = players[0];
        
        document.getElementById('roundControls').innerHTML = `
            <div style="margin-bottom: 10px;">
                <p><strong>Het Collectief Geheugen - Solo Modus</strong></p>
                <p><strong>Kandidaat:</strong> ${player.name}</p>
                <p><strong>Eindstand:</strong> ${Math.floor(player.seconds)} seconden</p>
            </div>
        `;
        
        currentQuestionEl.innerHTML = `
            <em>Spel afgelopen! ${player.name} heeft ${Math.floor(player.seconds)} seconden behaald.</em>
        `;
        
        // Speel finale geluid af
        if (typeof playSFX === 'function') playSFX('SFX/finale.mp3');
        
        sendDisplayUpdate({
            type: 'game_end',
            key: 'solo_end',
            scene: 'solo-game-end',
            player: player,
            finalSeconds: Math.floor(player.seconds)
        });
        return;
    }

    // Check voor 2 spelers: niemand valt af
    if (players.length === 2) {
        finalistNames = sortedPlayers.map(p => p.name);
        
        document.getElementById('roundControls').innerHTML = `
            <div style="margin-bottom: 10px;">
                <p><strong>Het Collectief Geheugen</strong></p>
                <p><strong>Bij 2 spelers:</strong> Beide spelers gaan door naar de finale!</p>
                <p><strong>Finalisten:</strong> ${finalistNames.join(' en ')}.</p>
            </div>
            <button onclick="document.getElementById('nextRound').click()" class="primary">Start Finale</button>
        `;
        
        currentQuestionEl.innerHTML = `
            <em>Het Collectief Geheugen afgelopen. Bij 2 spelers valt er niemand af! Beide spelers spelen de finale.</em>
        `;
        
        sendDisplayUpdate({
            type: 'round_end',
            key: 'collectief',
            scene: 'scene-round-collectief-done',
            slimsteVanDeDag: null,
            afvaller: null,
            finalists: finalistNames, 
            players: players 
        });
        return;
    }
    
    const collectiefEndOption = document.getElementById('collectiefEndOption')?.value || 'lowestOut';

    if (collectiefEndOption === 'highestWinner') {
        
        slimsteVanDeDag = sortedPlayers[0];
        finalistNames = sortedPlayers.slice(1).map(p => p.name);
    } else { 
        
        afvaller = sortedPlayers[sortedPlayers.length - 1];
        finalistNames = sortedPlayers.slice(0, 2).map(p => p.name);
    }
    
    
    activePlayerIndex = -1; 
    highlightActive();
    renderPlayers();

    
    document.getElementById('roundControls').innerHTML = `
        <div style="margin-bottom: 10px;">
            <p><strong>Het Collectief Geheugen</strong></p>
            ${afvaller ? `<p><strong>Afvaller:</strong> ${afvaller.name}</p>` : ''}
            ${slimsteVanDeDag ? `<p><strong>Slimste van de Dag:</strong> ${slimsteVanDeDag.name}</p>` : ''}
            <p><strong>Finalisten:</strong> ${finalistNames.join(' en ')}.</p>
        </div>
        <button onclick="document.getElementById('nextRound').click()" class="primary">Start Finale</button>
    `;

    currentQuestionEl.innerHTML = `
        <em>Het Collectief Geheugen afgelopen. Druk op 'Start Finale' om de Finalisten vast te stellen.</em>
    `;

    
    sendDisplayUpdate({
        type: 'round_end',
        key: 'collectief',
        scene: 'scene-round-collectief-done',
        slimsteVanDeDag: slimsteVanDeDag ? slimsteVanDeDag.name : null,
        afvaller: afvaller ? afvaller.name : null,
        finalists: finalistNames, 
        players: players 
    });
}





function renderCollectiefHostUI(phase = 'pre') {
    const controlsEl = document.getElementById('roundControls');
    const qIndex = perRoundState.collectief.currentQuestionIndex;
    const currentQuestion = perRoundState.collectief.questions[qIndex];
    
    if (!controlsEl || !currentQuestion) return;
    
    let html = '';
    const activePlayerName = players[activePlayerIndex].name;
    const answers = currentQuestion.answers;
    const foundAnswers = currentQuestion.foundAnswers;
    const allFound = foundAnswers.length === answers.length;

    

currentQuestionEl.innerHTML = `
    <em>Fragment ${qIndex + 1}/${perRoundState.collectief.questions.length}: ${activePlayerName} is aan de beurt.</em>
    
    <div style="margin-top:10px;">
        <strong>Video:</strong>
        <div style="margin-top:5px;">
            <button id="toggleAudioBtn">Audio Aan/Uit</button>
        </div>
    </div>
    ${currentQuestion.remarks ? `<div class="host-remarks">💬 ${currentQuestion.remarks}</div>` : ''}
    <div id="collectiefAnswerList" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:10px;">
        ${answers.map((ans, i) => {
            const found = foundAnswers.find(fa => fa.answer === ans);
            const display = found ? 
                `✅ (${i + 1}) ${ans} (${found.points}s)` : 
                `❓ (${i + 1}) ${ans}`;
            const className = found ? 'secondary' : 'primary';
            const disabled = found || phase !== 'main' ? 'disabled' : ''; 
            return `<button onclick="markCollectiefAnswer(${i})" class="${className}" ${disabled}>${display}</button>`;
        }).join('')}
    </div>

    <video id="collectiefHostVideo" src="${currentQuestion.video}" muted playsinline style="max-width:100%; border:1px solid #ccc;"></video>

`;



    if (phase === 'pre') {
        
        html = `<button onclick="startCollectiefVideo()">Start Fragment ${qIndex + 1} Video</button>`;
    } 
    else if (phase === 'video') {
        
        html = `
            <button onclick="startCollectiefTimer()" id="collectiefStartTimer">Start Klok (T) voor ${activePlayerName}</button>
        `;
    } 
    else if (phase === 'main') {
        
        const passDisabled = allFound ? 'disabled' : ''; 
        html = `
            <button onclick="startCollectiefTimer()" id="collectiefRestartTimer">Start Klok (T)</button>
            <button onclick="passCollectief()" ${passDisabled} class="secondary">Passen (P) (${activePlayerName} is klaar)</button>
        `;
    } 
    else if (phase === 'answered') {
        
        const btnText = qIndex + 1 < perRoundState.collectief.questions.length ? 
            `Start Volgende Fragment (${qIndex + 2})` : 'Einde Ronde';
            
        html = `
            <div style="margin-top:10px; padding:10px; border:1px solid #c084fc; font-weight:bold;">
                Fragment ${qIndex + 1} Afgerond. Tussenstand bekendgemaakt.
            </div>
            <button onclick="nextCollectiefQuestion()">${btnText} (N)</button>
        `;
    }

    controlsEl.innerHTML = html;
}


function sendCollectiefDisplayUpdate(action, scene) {
    const qIndex = perRoundState.collectief.currentQuestionIndex;
    const currentQuestion = perRoundState.collectief.questions[qIndex];
    
    
    const answersData = currentQuestion.answers.map(ans => {
        const found = currentQuestion.foundAnswers.find(fa => fa.answer === ans);
        return {
            answer: ans,
            isFound: !!found,
            points: found ? found.points : 0,
            finderName: found ? players[found.finderIndex].name : null,
            order: found ? found.order : null 
        };
    });

    sendDisplayUpdate({
        type: action,
        key: 'collectief',
        scene: scene,
        currentQuestionIndex: qIndex + 1,
        maxQuestions: perRoundState.collectief.questions.length,
        activePlayer: players[activePlayerIndex]?.name || '-',
        activeIndex: activePlayerIndex,
        players: players,
        answers: answersData,
        videoSrc: currentQuestion.video,
        allAnswersFound: currentQuestion.foundAnswers.length === currentQuestion.answers.length,
        allPlayersAnswered: currentQuestion.playersWhoAnswered.length === players.length
    });
}

console.log('Round-CollectiefGeheugen.js geladen met Collectief Geheugen logica.');
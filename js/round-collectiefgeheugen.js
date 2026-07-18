const COLLECTIEF_POINTS = [10, 20, 30, 40, 50];

let collectiefEndOption = 'lowestOut'; 



let collectiefTimerRunning = false;
let collectiefManualAssignmentEnabled = false;
let collectiefAvailableQuestions = [];
let collectiefAssignedQuestionsByTurn = {};

function getCollectiefFragmentLabel(question, fallbackIndex = 0) {
    if (!question || typeof question !== 'object') {
        return `Fragment ${fallbackIndex + 1}`;
    }

    if (typeof question.title === 'string' && question.title.trim()) {
        return question.title.trim();
    }

    if (typeof question.label === 'string' && question.label.trim()) {
        return question.label.trim();
    }

    const videoPath = (question.video || question.videoUrl || question.clip || '').toString();
    if (videoPath.trim()) {
        const fileName = videoPath.split('/').pop() || videoPath;
        return fileName;
    }

    return `Fragment ${fallbackIndex + 1}`;
}

function isManualCollectiefAssignmentEnabled(questionsToUse) {
    const hasCustomCollectief = typeof gameConfig !== 'undefined' && Array.isArray(gameConfig?.collectief) && gameConfig.collectief.length > 0;
    const manualEnabled = typeof getRoundSetting === 'function'
        ? getRoundSetting('collectief', 'manualAssignment', false) === true
        : false;
    const hasQuestions = Array.isArray(questionsToUse) && questionsToUse.length > 0;

    return manualEnabled && hasCustomCollectief && hasQuestions;
}

function buildCollectiefSelectOptions() {
    if (!collectiefAvailableQuestions.length) {
        return '<option value="">Geen fragmenten beschikbaar</option>';
    }

    return collectiefAvailableQuestions.map((question, index) => {
        const label = getCollectiefFragmentLabel(question, index);
        return `<option value="${index}">${label}</option>`;
    }).join('');
}

function assignCollectiefQuestionForTurn(turnIndex) {
    const select = document.getElementById('collectief-select');
    if (!select) return null;

    const selectedIndex = parseInt(select.value, 10);
    if (Number.isNaN(selectedIndex)) return null;

    const selectedQuestion = collectiefAvailableQuestions[selectedIndex];
    if (!selectedQuestion) return null;

    collectiefAssignedQuestionsByTurn[turnIndex] = selectedQuestion;
    collectiefAvailableQuestions.splice(selectedIndex, 1);

    return selectedQuestion;
}

function renderCollectiefAssignmentControls(playerIndex, turnIndex) {
    if (!collectiefManualAssignmentEnabled) return '';

    const playerName = players[playerIndex] ? players[playerIndex].name : 'kandidaat';
    const alreadyAssigned = collectiefAssignedQuestionsByTurn[turnIndex];

    if (alreadyAssigned) {
        return `
            <div style="margin-top:8px;">
                <div class="small muted">Geselecteerd fragment voor ${playerName}: <strong>${getCollectiefFragmentLabel(alreadyAssigned, turnIndex)}</strong></div>
            </div>
        `;
    }

    const selectOptions = buildCollectiefSelectOptions();
    const disabled = collectiefAvailableQuestions.length === 0 ? 'disabled' : '';

    return `
        <div style="margin-top:8px;">
            <div class="small muted">Kies Collectief Geheugen-fragment voor ${playerName}</div>
            <select id="collectief-select" ${disabled}>
                ${selectOptions}
            </select>
        </div>
    `;
}

function ensureCollectiefQuestionForCurrentTurn() {
    if (!collectiefManualAssignmentEnabled) {
        return true;
    }

    const qIndex = perRoundState.collectief.currentQuestionIndex;
    if (perRoundState.collectief.questions[qIndex]) {
        return true;
    }

    const turnIndex = perRoundState.collectief.currentStarterTurn || 0;
    let selectedQuestion = collectiefAssignedQuestionsByTurn[turnIndex] || null;

    if (!selectedQuestion) {
        selectedQuestion = assignCollectiefQuestionForTurn(turnIndex);
    }

    if (!selectedQuestion) {
        flash('Kies eerst een Collectief Geheugen-fragment voor deze kandidaat.', 'error');
        return false;
    }

    perRoundState.collectief.questions[qIndex] = {
        ...selectedQuestion,
        foundAnswers: [],
        playersWhoAnswered: []
    };

    return true;
}


function startLoopTimer() {
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer) return flash('Fout: Geen actieve speler voor timer.');

    if (typeof startThinkingCountdownTimer !== 'function') {
        flash('Fout: startThinkingCountdownTimer niet gevonden in core.js.');
        return;
    }

    startThinkingCountdownTimer({
        getActivePlayer: () => players[activePlayerIndex],
        onTick: () => {
            renderPlayers();
            sendCollectiefDisplayUpdate('update', 'scene-round-collectief-main');
        },
        onTimeout: (player) => {
            flash(`${player.name} is door zijn tijd heen!`);
            if (typeof showPreFinaleBonusControls === 'function') showPreFinaleBonusControls();
            passCollectief();
        }
    });

    collectiefTimerRunning = true;
}


function stopLoopTimer(playEndSound = false) {
    if (typeof stopThinkingCountdownTimer === 'function') {
        stopThinkingCountdownTimer(playEndSound);
    }

    collectiefTimerRunning = false;
}


function stopGlobalTimer() {
    stopLoopTimer(false);
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
    const questionPool = shouldShuffle
        ? (typeof shuffleArrayShared === 'function' ? shuffleArrayShared(questionsToUse) : questionsToUse.slice())
        : questionsToUse.slice();

    collectiefManualAssignmentEnabled = isManualCollectiefAssignmentEnabled(questionsToUse);
    collectiefAssignedQuestionsByTurn = {};

    if (collectiefManualAssignmentEnabled) {
        collectiefAvailableQuestions = questionPool.slice();
        perRoundState.collectief.questions = Array.from({ length: questionsCount }, () => null);

        if (collectiefAvailableQuestions.length < questionsCount) {
            flash('Let op: te weinig Collectief Geheugen-fragmenten beschikbaar voor alle beurten.');
        }
    } else {
        collectiefAvailableQuestions = [];
        perRoundState.collectief.questions = questionPool.slice(0, questionsCount).map(q => ({
            ...q,
            foundAnswers: [],
            playersWhoAnswered: []
        }));
    }
    
    perRoundState.collectief.currentQuestionIndex = 0;
    perRoundState.collectief.starterOrder = (typeof getStarterOrderByLowestSeconds === 'function')
        ? getStarterOrderByLowestSeconds(questionsCount)
        : players
            .map((p, i) => ({ i, seconds: p.seconds }))
            .sort((a, b) => a.seconds - b.seconds || a.i - b.i)
            .map(p => p.i)
            .slice(0, questionsCount);
    perRoundState.collectief.currentStarterTurn = 0;
    
    
    activePlayerIndex = perRoundState.collectief.starterOrder[0];
    highlightActive();

    
    renderCollectiefHostUI('pre');

    
    sendCollectiefDisplayUpdate('round_start', 'scene-round-collectief-pre');

    flash(`Collectief Geheugen klaar. Speler ${players[activePlayerIndex].name} start met fragment 1.`);
}



function startCollectiefVideo() {
    stopGlobalTimer(); 
    stopLoopTimer(); 

    if (!ensureCollectiefQuestionForCurrentTurn()) {
        renderCollectiefHostUI('pre');
        return;
    }

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
        
        const nextPlayerIndex = availablePlayersIndices
            .sort((a, b) => players[a].seconds - players[b].seconds || a - b)[0]; 

        activePlayerIndex = nextPlayerIndex;
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
        perRoundState.collectief.currentStarterTurn = (perRoundState.collectief.currentStarterTurn || 0) + 1;

        if (perRoundState.collectief.currentStarterTurn < perRoundState.collectief.starterOrder.length) {
            activePlayerIndex = perRoundState.collectief.starterOrder[perRoundState.collectief.currentStarterTurn];
        } else {
            activePlayerIndex = perRoundState.collectief.starterOrder[perRoundState.collectief.starterOrder.length - 1];
        }
        
        highlightActive();

        flash(`Start Fragment ${perRoundState.collectief.currentQuestionIndex + 1} voor ${players[activePlayerIndex].name}.`);

        if (collectiefManualAssignmentEnabled) {
            renderCollectiefHostUI('pre');
            sendCollectiefDisplayUpdate('update', 'scene-round-collectief-pre');
        } else {
            startCollectiefVideo();
        }
        
    } else {
        
        endCollectiefRound();
    }
}

function endCollectiefRound() {
    roundRunning = false;
    if (typeof markCurrentRoundComplete === 'function') {
        markCurrentRoundComplete();
    }
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
    perRoundState.collectief.hostPhase = phase;

    const controlsEl = document.getElementById('roundControls');
    const qIndex = perRoundState.collectief.currentQuestionIndex;
    const currentQuestion = perRoundState.collectief.questions[qIndex];

    if (!controlsEl) return;
    
    let html = '';
    const activePlayerName = players[activePlayerIndex]?.name || '-';

    if (phase === 'pre') {
        const turnIndex = perRoundState.collectief.currentStarterTurn || 0;
        const assignmentControls = renderCollectiefAssignmentControls(activePlayerIndex, turnIndex);
        const assignedQuestion = currentQuestion || collectiefAssignedQuestionsByTurn[turnIndex] || null;
        const assignedLabel = assignedQuestion ? getCollectiefFragmentLabel(assignedQuestion, qIndex) : 'Nog niet gekozen';

        currentQuestionEl.innerHTML = `
            <em>Fragment ${qIndex + 1}/${perRoundState.collectief.questions.length}: ${activePlayerName} is aan de beurt.</em>
            ${assignmentControls}
            <div class="small muted" style="margin-top:8px;">Gekozen fragment: <strong>${assignedLabel}</strong></div>
            ${assignedQuestion?.remarks ? `<div class="host-remarks">💬 ${assignedQuestion.remarks}</div>` : ''}
        `;

        html = `<button onclick="startCollectiefVideo()">Start Fragment ${qIndex + 1} Video (V)</button>`;
        controlsEl.innerHTML = html;
        return;
    }

    if (!currentQuestion) {
        currentQuestionEl.innerHTML = `<em>Geen Collectief Geheugen-fragment geselecteerd.</em>`;
        controlsEl.innerHTML = '';
        return;
    }

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

    if (phase === 'video') {
        
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

    const hasCurrentQuestion = !!currentQuestion;
    const answersData = hasCurrentQuestion
        ? currentQuestion.answers.map(ans => {
            const found = currentQuestion.foundAnswers.find(fa => fa.answer === ans);
            return {
                answer: ans,
                isFound: !!found,
                points: found ? found.points : 0,
                finderName: found && players[found.finderIndex] ? players[found.finderIndex].name : null,
                order: found ? found.order : null
            };
        })
        : [];

    const extraData = {
        currentQuestionIndex: qIndex + 1,
        maxQuestions: perRoundState.collectief.questions.length,
        activePlayer: players[activePlayerIndex]?.name || '-',
        answers: answersData,
        videoSrc: hasCurrentQuestion ? currentQuestion.video : null,
        allAnswersFound: hasCurrentQuestion ? currentQuestion.foundAnswers.length === currentQuestion.answers.length : false,
        allPlayersAnswered: hasCurrentQuestion ? currentQuestion.playersWhoAnswered.length === players.length : false
    };

    if (typeof sendRoundDisplayUpdate === 'function') {
        sendRoundDisplayUpdate({
            type: action,
            key: 'collectief',
            scene,
            activeIndex: activePlayerIndex,
            playersData: players,
            extraData
        });
    } else {
        sendDisplayUpdate({
            type: action,
            key: 'collectief',
            scene,
            activeIndex: activePlayerIndex,
            players,
            ...extraData
        });
    }
}

console.log('Round-CollectiefGeheugen.js geladen met Collectief Geheugen logica.');
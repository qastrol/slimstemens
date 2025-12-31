// Collectief Geheugen
// Iedere kandidaat krijgt een filmpje te zien en moet hieruit vervolgens vijf kernwoorden trachten te determineren.
// Als de kandidaat past, dan mag de kandidaat met de op dat moment laagste score proberen de lijst te vervolledigen. 
// Indien er dan nog kernwoorden overblijven, krijgt wederom de derde kandidaat nog een kans.
// De volgorde waarin de antwoorden zijn gevonden bepaalt hoeveel punten ze opleveren:
// 1e antwoord: 10 punten
// 2e antwoord: 20 punten
// 3e antwoord: 30 punten
// 4e antwoord: 40 punten
// 5e antwoord: 50 punten
// De punten zijn niet gekoppeld aan een vast antwoord, waardoor een simpel antwoord soms nog 50 seconden kan opleveren voor een kandidaat die mag aanvullen

// Afhankelijk van de instellingen kan er gekozen worden om:
// - De speler met de hoogste score te laten uitroepen tot Slimste van de Dag en de finale te spelen met de andere twee spelers
// - De speler met de laagste score af te laten vallen en de andere twee spelers de finale te laten spelen

const COLLECTIEF_POINTS = [10, 20, 30, 40, 50];

let collectiefEndOption = 'lowestOut'; // standaard


// ===== TIMER FUNCTIES voor Collectief Geheugen =====
let collectiefTimerInterval = null;
let collectiefTimerRunning = false;

// Start de timer voor de huidige speler
function startLoopTimer() {
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer) return flash('Fout: Geen actieve speler voor timer.');

    stopLoopTimer(); // stop oude timer

    // Stuur display aan om klok te loopen (geen lokaal geluid op host)
    if (typeof playSFX === 'function') {
        try { sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' }); } catch(e) {}
    }

    collectiefTimerInterval = setInterval(() => {
        activePlayer.seconds = Math.max(0, activePlayer.seconds - 1);
        renderPlayers();
        
        // 🔄 Stuur real-time update naar display voor secondeweergave
        sendCollectiefDisplayUpdate('update', 'scene-round-collectief-main');

        if (activePlayer.seconds <= 0) {
            clearInterval(collectiefTimerInterval);
            stopLoopTimer(true); // Speel klokeind-geluid
            flash(`${activePlayer.name} is door zijn tijd heen!`);
            passCollectief(); // automatisch passen
        }
    }, 1000);

    collectiefTimerRunning = true;
}

// Stop de timer voor de huidige speler
function stopLoopTimer(playEndSound = false) {
    if (collectiefTimerInterval) clearInterval(collectiefTimerInterval);
    collectiefTimerInterval = null;

    // Stop klokgeluid
    if (typeof stopLoopTimerSFX === 'function') stopLoopTimerSFX();

    if (playEndSound && typeof playSFX === 'function') {
        playSFX('SFX/klokeind.mp3');
    }

    collectiefTimerRunning = false;
}

// Stop eventuele globale timers (alias voor stopLoopTimer)
function stopGlobalTimer() {
    stopLoopTimer(false);
}


// Hulpfunctie voor het schudden van arrays (aangenomen dat deze niet globaal is)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Initialiseer de status voor deze ronde (perRoundState is gedefinieerd in core.js)
perRoundState.collectief = perRoundState.collectief || {};

/* Status voor perRoundState.collectief:
- questions: [3 geselecteerde vragen, elk met 'foundAnswers']
- currentQuestionIndex: Huidig fragment
*/


function setupCollectiefRound() {
    perRoundState.collectief = perRoundState.collectief || {};
    // Controleer voldoende vragen
    if (typeof collectiefVragen === 'undefined' || collectiefVragen.length < 3) {
        flash('Fout: Onvoldoende Collectief Geheugen-vragen beschikbaar (minstens 3 nodig).', 'error');
        return;
    }
    
    // Selecteer 3 unieke vragen
    perRoundState.collectief.questions = shuffleArray(collectiefVragen.slice()).slice(0, 3).map(q => ({
        ...q,
        foundAnswers: [],        // gevonden antwoorden
        playersWhoAnswered: []   // spelers die al aan de beurt waren
    }));
    
    perRoundState.collectief.currentQuestionIndex = 0;
    
    // Bepaal startspeler (laagste score)
    const sortedPlayers = [...players].sort((a, b) => a.seconds - b.seconds);
    activePlayerIndex = sortedPlayers[0].index;
    highlightActive();

    // Bouw host UI op vóór het starten van een fragment
    renderCollectiefHostUI('pre');

    // Stuur initiele scene naar display
    sendCollectiefDisplayUpdate('round_start', 'scene-round-collectief-pre');

    flash(`Collectief Geheugen klaar. Speler ${players[activePlayerIndex].name} start met fragment 1.`);
}



function startCollectiefVideo() {
    stopGlobalTimer(); 
    stopLoopTimer(); 

    const currentQuestion = perRoundState.collectief.questions[perRoundState.collectief.currentQuestionIndex];
    
    flash(`Video gestart voor ${players[activePlayerIndex].name}. Druk op 'Start Klok' als de video voorbij is.`, 'info');
    renderCollectiefHostUI('video');

    // Video starten
    const videoEl = document.getElementById('collectiefHostVideo');
    if (videoEl) {
        videoEl.play().catch(err => console.warn('Video kon niet starten:', err));
        videoEl.addEventListener('ended', () => {
            videoEl.style.display = 'none'; // Video verdwijnt als hij klaar is
        });
    }

    // Audio knop event listener toevoegen **na renderen**
    const audioBtn = document.getElementById('toggleAudioBtn');
    if (audioBtn && videoEl) {
        audioBtn.addEventListener('click', () => {
            videoEl.muted = !videoEl.muted;
            audioBtn.textContent = videoEl.muted ? 'Audio Aan' : 'Audio Uit';
        });
    }

    // STUUR VIDEO START NAAR DISPLAY
    sendCollectiefDisplayUpdate('update', 'scene-round-collectief-video');
}



// ===== 3. Starten van de timer (Host klikt op 'Start Klok') =====
function startCollectiefTimer() {
    // Verberg de video zodra de klok start
    const videoEl = document.getElementById('collectiefHostVideo');
    if (videoEl) {
        videoEl.pause();
        videoEl.style.display = 'none';
    }

    startLoopTimer(); // Gebruik de globale loopTimer (klok)
    renderCollectiefHostUI('main');
    flash(`Klok gestart voor ${players[activePlayerIndex].name}.`);
}


function markCollectiefAnswer(answerIndex) {
    // **Stop de timer niet**
    // stopLoopTimer();  // ← verwijder dit, timer blijft lopen
    playSFX('SFX/goed.mp3'); 

    const currentQuestion = perRoundState.collectief.questions[perRoundState.collectief.currentQuestionIndex];
    const answerText = currentQuestion.answers[answerIndex];
    
    // Check of dit antwoord al gevonden is
    const alreadyFound = currentQuestion.foundAnswers.some(a => a.answer === answerText);
    if (alreadyFound) {
        flash(`Fout: Antwoord "${answerText}" is al gevonden. De beurt gaat naar de volgende kandidaat.`, 'wrong');
        passCollectief(true); 
        return; 
    }

    // 1. Bepaal de oplopende punten
    const pointsIndex = currentQuestion.foundAnswers.length; 
    const points = COLLECTIEF_POINTS[pointsIndex];
    
    // 2. Registreer het antwoord
// 2. Registreer het antwoord
const newAnswer = {
    answer: answerText,
    points: points,
    finderIndex: activePlayerIndex,
    order: pointsIndex + 1
};
currentQuestion.foundAnswers.push(newAnswer);

// **Update alleen de knop**
updateAnswerButton(answerIndex);


    // 3. Update de score
    const currentPlayer = players[activePlayerIndex];
    currentPlayer.seconds += points;
    currentPlayer.seconds = Math.max(0, currentPlayer.seconds); 
    renderPlayers();
    
    flash(`Antwoord "${answerText}" goed! +${points} seconden gewonnen door ${currentPlayer.name}.`, 'right');

    // 4. Update display
    sendCollectiefDisplayUpdate('update', 'scene-round-collectief-main');

    // 5. Controleer of alle antwoorden gevonden zijn
    if (currentQuestion.foundAnswers.length === currentQuestion.answers.length) {
        // Alle antwoorden gevonden → stop timer pas nu
        stopLoopTimer(); // timer stopt nu pas
        flash(`Alle antwoorden gevonden. ${currentPlayer.name} was de laatste vinder.`, 'success');
        sendCollectiefDisplayUpdate('update', 'scene-round-collectief-tussenstand');
        renderCollectiefHostUI('answered'); // Knop voor volgende vraag
    } 
    // **Geen else** → timer blijft lopen bij volgende antwoorden
}


// ===== 5. Passen (Host klikt op 'Passen' of fout antwoord) =====
function passCollectief(isScoreAnnounced = false) {
    stopLoopTimer();
    if (!isScoreAnnounced) playSFX('SFX/klokeind.mp3');

    const currentQuestion = perRoundState.collectief.questions[perRoundState.collectief.currentQuestionIndex];
    
    // Voeg de huidige speler toe aan de lijst van degenen die hun beurt hebben gehad
    if (!currentQuestion.playersWhoAnswered.includes(activePlayerIndex)) {
        currentQuestion.playersWhoAnswered.push(activePlayerIndex);
    }

    // 1. Bepaal de volgende speler (laagste score van de overgebleven kandidaten)
    const allPlayerIndices = players.map((_, i) => i);
    const availablePlayersIndices = allPlayerIndices.filter(index => 
        !currentQuestion.playersWhoAnswered.includes(index)
    );

    if (availablePlayersIndices.length > 0) {
        // De volgende speler is degene met de laagste score van de overgebleven
        const nextPlayer = availablePlayersIndices
            .map(index => players[index])
            .sort((a, b) => a.seconds - b.seconds)[0]; // Laagste score eerst

        activePlayerIndex = nextPlayer.index;
        highlightActive(); 

        flash(`${players[activePlayerIndex].name} mag aanvullen.`, 'info');
        
        // Render knoppen voor de nieuwe speler (Start Klok / Pass)
        renderCollectiefHostUI('main');
        
        // Update display
        sendCollectiefDisplayUpdate('update', 'scene-round-collectief-main');

    } else {
        // Iedereen is geweest. Einde van dit fragment.
        flash('Iedereen is geweest. Einde van dit fragment.', 'info');
        
        // Toon de tussenstand (de gevonden antwoorden, dan de niet gevonden antwoorden)
        sendCollectiefDisplayUpdate('update', 'scene-round-collectief-tussenstand');
        
        // Render de knop om naar de volgende vraag te gaan
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


// ===== 6. Volgende vraag (of einde van de ronde) =====
function nextCollectiefQuestion() {
    stopLoopTimer();
    
    perRoundState.collectief.currentQuestionIndex++;
    
    if (perRoundState.collectief.currentQuestionIndex < perRoundState.collectief.questions.length) {
        // Ga naar de volgende vraag
        
        // Reset de beurtvolgorde en startspeler voor de nieuwe vraag (laagste score)
        const sortedPlayers = [...players].sort((a, b) => a.seconds - b.seconds);
        activePlayerIndex = sortedPlayers[0].index; // Laagste score speler start de volgende
        
        highlightActive();

        flash(`Start Fragment ${perRoundState.collectief.currentQuestionIndex + 1} voor ${players[activePlayerIndex].name}.`);
        
        startCollectiefVideo(); // Start met de video
        
    } else {
        // Einde van de ronde
        endCollectiefRound();
    }
}

function endCollectiefRound() {
    roundRunning = false;
    stopAllTimers();

    // Sorteer spelers op score (hoog naar laag)
    const sortedPlayers = [...players].sort((a, b) => b.seconds - a.seconds);

    let slimsteVanDeDag = null;
    let afvaller = null;
    let finalistNames = []; 

    // Haal de gekozen optie op (standaard: lowestOut)
    const collectiefEndOption = document.getElementById('collectiefEndOption')?.value || 'lowestOut';

    if (collectiefEndOption === 'highestWinner') {
        // Hoogste score is Slimste van de Dag, finale met de 2 laagste
        slimsteVanDeDag = sortedPlayers[0];
        finalistNames = sortedPlayers.slice(1).map(p => p.name);
    } else { // 'lowestOut' (standaard)
        // Laagste score valt af, finale met de 2 hoogste
        afvaller = sortedPlayers[sortedPlayers.length - 1];
        finalistNames = sortedPlayers.slice(0, 2).map(p => p.name);
    }
    
    // De 'players' array wordt HIER NIET AANGEPAST. De 3 spelers blijven bestaan.
    activePlayerIndex = -1; // Deselecteer de actieve speler
    highlightActive();
    renderPlayers();

    // Host UI voor de overgang naar de finale
    document.getElementById('roundControls').innerHTML = `
        <div style="margin-bottom: 10px;">
            <p><strong>Einde Collectief Geheugen</strong></p>
            ${afvaller ? `<p><strong>Afvaller:</strong> ${afvaller.name}</p>` : ''}
            ${slimsteVanDeDag ? `<p><strong>Slimste van de Dag:</strong> ${slimsteVanDeDag.name}</p>` : ''}
            <p><strong>Finalisten:</strong> ${finalistNames.join(' en ')}.</p>
        </div>
        <button onclick="nextRound()" class="primary">Start Finale</button>
    `;

    currentQuestionEl.innerHTML = `
        <em>Collectief Geheugen afgerond. Druk op 'Start Finale' om de Finalisten vast te stellen.</em>
    `;

    // Stuur update naar display
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




// ===== 8. Host UI Rendering & Display Update Payload =====
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

    // Toon de video en antwoorden in het hoofdtekstvak van de host-tool
// In renderCollectiefHostUI('video') of waar je de video injecteert
currentQuestionEl.innerHTML = `
    <em>Fragment ${qIndex + 1}/${perRoundState.collectief.questions.length}: ${activePlayerName} is aan de beurt.</em>
    
    <div style="margin-top:10px;">
        <strong>Video:</strong>
        <div style="margin-top:5px;">
            <button id="toggleAudioBtn">Audio Aan/Uit</button>
        </div>
    </div>
    <div id="collectiefAnswerList" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:10px;">
        ${answers.map((ans, i) => {
            const found = foundAnswers.find(fa => fa.answer === ans);
            const display = found ? 
                `✅ ${ans} (${found.points}s)` : 
                `❓ ${ans}`;
            const className = found ? 'secondary' : 'primary';
            const disabled = found || phase !== 'main' ? 'disabled' : ''; 
            return `<button onclick="markCollectiefAnswer(${i})" class="${className}" ${disabled}>${display}</button>`;
        }).join('')}
    </div>

    <video id="collectiefHostVideo" src="${currentQuestion.video}" muted playsinline style="max-width:100%; border:1px solid #ccc;"></video>

`;



    if (phase === 'pre') {
        // Voor de start van een fragment
        html = `<button onclick="startCollectiefVideo()">Start Fragment ${qIndex + 1} Video</button>`;
    } 
    else if (phase === 'video') {
        // Na video, voor de klok
        html = `
            <button onclick="startCollectiefTimer()" id="collectiefStartTimer">Start Klok voor ${activePlayerName}</button>
        `;
    } 
    else if (phase === 'main') {
        // Tijdens de beurt van een speler
        const passDisabled = allFound ? 'disabled' : ''; // Niet passen als alles al gevonden is
        html = `
            <button onclick="startCollectiefTimer()" id="collectiefRestartTimer">Start Klok</button>
            <button onclick="passCollectief()" ${passDisabled} class="secondary">Passen (${activePlayerName} is klaar)</button>
        `;
    } 
    else if (phase === 'answered') {
        // Na afloop van een fragment (alle antwoorden gevonden of alle spelers geweest)
        const btnText = qIndex + 1 < perRoundState.collectief.questions.length ? 
            `Start Volgende Fragment (${qIndex + 2})` : 'Einde Ronde';
            
        html = `
            <div style="margin-top:10px; padding:10px; border:1px solid #c084fc; font-weight:bold;">
                Fragment ${qIndex + 1} Afgerond. Tussenstand bekendgemaakt.
            </div>
            <button onclick="nextCollectiefQuestion()">${btnText}</button>
        `;
    }

    controlsEl.innerHTML = html;
}

// Hulpmethode om de display update te sturen
function sendCollectiefDisplayUpdate(action, scene) {
    const qIndex = perRoundState.collectief.currentQuestionIndex;
    const currentQuestion = perRoundState.collectief.questions[qIndex];
    
    // De array van antwoorden moet de gevonden status en de behaalde punten bevatten
    const answersData = currentQuestion.answers.map(ans => {
        const found = currentQuestion.foundAnswers.find(fa => fa.answer === ans);
        return {
            answer: ans,
            isFound: !!found,
            points: found ? found.points : 0,
            finderName: found ? players[found.finderIndex].name : null,
            order: found ? found.order : null // Volgorde 1 t/m 5
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
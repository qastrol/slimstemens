// Finale ronde
// De vorige ronde zijn twee kandidaten overgebleven afhankelijk van de gekozen instellingen voor de Collectief Geheugen ronde.
// De twee kandidaten met de hoogste score aan het eind van de Collectief Geheugen ronde, of de twee kandidaten met de laagste score (afhankelijk van de ingestelde optie) gaan door naar de finale ronde.
// De twee overgebleven kandidaten krijgen vragen met 5 mogelijke antwoorden. 
// De kandidaat die dan de laagste score heeft, krijgt als eerste de vraag, daarna mag de andere kandidaat aanvullen.
// Voor elk goed antwoord worden er 20 seconden afgetrokken bij de score van de andere kandidaat.
// Als een kandidaat op/onder 0 seconden komt, is die kandidaat af en wint de andere speler de finale.

const FINALE_POINTS_DEDUCTION = 20;

perRoundState.finale = perRoundState.finale || {};
let finaleTimerInterval = null;
let finaleTimerRunning = false;
let finaleLoopTimerSeconds = 0; // Lokale timer teller voor finale

// Voeg deze helper-functie toe als deze nog niet globaal beschikbaar is via core.js
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Hulpmethode om de index van de tegenstander in de globale 'players' array te vinden.
// (De 'players' array bevat nu slechts 2 elementen)
function getOpponentIndex(currentPlayerOriginalIndex) {
    // Zoek de index in de (nu 2-elementen) 'players' array
    const currentPlayerIndexInFinalsArray = players.findIndex(p => p.index === currentPlayerOriginalIndex);
    if (currentPlayerIndexInFinalsArray === -1) return -1;

    // De tegenstander is de andere speler in de 2-elementen array
    const opponentIndexInFinalsArray = 1 - currentPlayerIndexInFinalsArray; 
    
    // Retourneer de originele index (0, 1, of 2) van de tegenstander
    return players[opponentIndexInFinalsArray].index;
}

function determineFinalistsAndSetupPreRound() {
    // 1. Controleer of er 3 spelers zijn. Dit is de staat na Collectief Geheugen.
    if (players.length !== 3) {
        flash(`Fout: Finale moet starten met 3 spelers. Huidig aantal: ${players.length}.`, 'error');
        return false;
    }

    // 2. Bepaal de finalisten op basis van de instelling
    const collectiefEndOption = document.getElementById('collectiefEndOption')?.value || 'lowestOut';
    
    // Sorteer spelers op score (hoog naar laag)
    const sortedPlayers = [...players].sort((a, b) => b.seconds - a.seconds);

    let afvallerOriginalIndex = -1;
    let finalistNames = [];
    
    if (collectiefEndOption === 'highestWinner') {
        // Hoogste score is Slimste van de Dag. De twee laagste scores spelen de finale.
        afvallerOriginalIndex = sortedPlayers[0].index; // Hoogste score eruit
        finalistNames = sortedPlayers.slice(1).map(p => p.name); 
    } else { // 'lowestOut' (standaard, laagste valt af)
        // Laagste score valt af. De twee hoogste spelen de finale.
        afvallerOriginalIndex = sortedPlayers[sortedPlayers.length - 1].index; // Laagste score eruit
        finalistNames = sortedPlayers.slice(0, 2).map(p => p.name);
    }
    
    // 3. Filter de globale 'players' array. Dit is de cruciale stap.
    const originalPlayers = [...players]; // Bewaar de volledige lijst voor de display
    
    // Filter op de namen van de finalisten
    players = players.filter(p => finalistNames.includes(p.name));
    
    // 4. Sorteer de finalisten op tijd (laagste score eerst) en bepaal de startspeler.
    players.sort((a, b) => a.seconds - b.seconds); 
    activePlayerIndex = players[0].index; 
    
    perRoundState.finale.lastActivePlayerIndex = activePlayerIndex; // Initieel de eerste speler
    perRoundState.finale.afvallerOriginalIndex = afvallerOriginalIndex; // Bewaar afvaller voor end-screen
    perRoundState.finale.afvallerName = originalPlayers.find(p => p.index === afvallerOriginalIndex)?.name || 'Onbekend';

    // 5. Update de UI
    renderPlayers(); // Belangrijk om de afvaller's kaart te verbergen/donker te maken

    // 6. Render de Host UI voor de pre-start fase
    renderFinaleHostUI('pre_start', afvallerOriginalIndex);
    
    // 7. Stuur de pre-finale status naar de display (gebruik de originele lijst om de afvaller te tonen)
    sendFinaleDisplayUpdate('round_start', 'scene-round-finale-pre', {
        afvallerIndex: afvallerOriginalIndex,
        allPlayers: originalPlayers,
        collectiefEndOption: collectiefEndOption // Stuur de optie mee voor correcte teksten
    });
    
    flash(`Finale vastgesteld: ${players.map(p => p.name).join(' en ')} spelen de finale.`, 'info');
    
    return true;
}

// NIEUWE FUNCTIE: Start de game (roept de eerste vraag op)
function startFinaleGame() {
    // Zorg ervoor dat er 2 finalisten zijn
    if (players.length !== 2) {
        flash('Fout: Kan Finale niet starten. Er zijn geen 2 finalisten bepaald.', 'error');
        return;
    }
    
    // Roep de bestaande logica aan om de eerste vraag te starten
    nextFinaleQuestion(); 
}


function setupFinaleRound() {
    // 1. Fase 1: Bepaal finalisten en toon pre-finale scherm
    perRoundState.finale = perRoundState.finale || {};

    // Initialiseer de basis finale staat als het leeg is
    perRoundState.finale.currentQuestionIndex = 0;
perRoundState.finale.questions = shuffleArray(finaleVragen.slice());
    perRoundState.finale.finalists = [];
    
    // De functie die de error veroorzaakte:
    determineFinalistsAndSetupPreRound(); // Deze roept nu line 63 aan.


    if (!determineFinalistsAndSetupPreRound()) {
        roundRunning = false;
        return;
    }
    
    // 2. Vragen selecteren (kan alvast gebeuren)
if (typeof finaleVragen === 'undefined' || !Array.isArray(finaleVragen) || finaleVragen.length === 0) {
        flash('Fout: Kon geen finaleVragen vinden of de array is leeg. Controleer vragen-finale.js en de HTML laadvolgorde.');
        console.error('FINALE FOUT: finaleVragen niet gedefinieerd of leeg.');
        return; // Stop de setup als er geen vragen zijn
    }
    
    perRoundState.finale.questions = shuffleArray(finaleVragen.slice()).slice(0, 10).map(q => ({
        ...q,
        foundAnswers: [],
        playersWhoPassed: []
    }));
    
    perRoundState.finale.currentQuestionIndex = -1; // Start op -1, 'nextQuestion' zal naar 0 gaan

    // De ronde is gestart (in de pre-fase)
    roundRunning = true;
}


function nextFinaleQuestion() {
    stopAllTimers();
    stopFinaleTimer(false); // Stop ook de finale timer
    
    perRoundState.finale.currentQuestionIndex++;
    const qIndex = perRoundState.finale.currentQuestionIndex;
    
    if (qIndex >= perRoundState.finale.questions.length) {
        // ... (end of round logic)
        return;
    }

    const currentQuestion = perRoundState.finale.questions[qIndex];
    
    // 💡 FIX 2B: Use this object, and ensure it has the required state properties
    perRoundState.finale.currentQuestion = currentQuestion; 

    // Initialize/Reset the required state properties on the question object itself
    currentQuestion.foundAnswers = currentQuestion.foundAnswers || []; 
    currentQuestion.playersWhoPassed = []; // Always reset for a new question

    // Bepaal de startspeler: Speler met de laagste seconden, bij gelijkspel wissel van beurt
    const [p1, p2] = players; // De twee finalisten
    
    let startingPlayer = null;

    if (p1.seconds < p2.seconds) {
        startingPlayer = p1;
    } else if (p2.seconds < p1.seconds) {
        startingPlayer = p2;
    } else {
        // Gelijkspel - beurt naar de speler die bij de vorige vraag HET LAATST aan bod kwam (wissel)
        const prevStarterIndex = perRoundState.finale.lastActivePlayerIndex; 
        const otherPlayer = players.find(p => p.index !== prevStarterIndex);
        startingPlayer = otherPlayer || p1; 
        flash(`Gelijke stand! Beurt naar ${startingPlayer.name} (wissel).`, 'info');
    }
    
    activePlayerIndex = startingPlayer.index; 
    perRoundState.finale.lastActivePlayerIndex = activePlayerIndex; // Update wie er start
    
    highlightActive(); 
    renderFinaleHostUI('main'); 
    
    sendFinaleDisplayUpdate('update', 'scene-round-finale-main');
}

// ===== TIMER FUNCTIES voor Finale =====

// Start de timer voor de huidige speler
function startFinaleTimer() {
    const activePlayer = players.find(p => p.index === activePlayerIndex);
    if (!activePlayer) {
        flash('Fout: Geen actieve speler voor timer.');
        return;
    }

    stopFinaleTimer(false); // stop oude timer

    // Reset de timer seconden
    finaleLoopTimerSeconds = 0;

    // Stuur display aan om klok te loopen (geen lokaal geluid op host)
    if (typeof playSFX === 'function') {
        try { sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' }); } catch(e) {}
    }

    flash(`Klok gestart voor ${activePlayer.name}.`);

    finaleTimerInterval = setInterval(() => {
        finaleLoopTimerSeconds++;
        
        // 🔄 Trek elke seconde 1 seconde af van de actieve speler
        activePlayer.seconds = Math.max(0, activePlayer.seconds - 1);
        
        renderPlayers();
        
        // 🔄 Stuur real-time update naar display voor secondeweergave
        sendFinaleDisplayUpdate('update', 'scene-round-finale-main');
        
        // ⚠️ Check of de speler op 0 staat
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

// Stop de timer voor de huidige speler
function stopFinaleTimer(playEndSound = false) {
    if (finaleTimerInterval) {
        clearInterval(finaleTimerInterval);
        finaleTimerInterval = null;
    }

    // Stop klokgeluid
    if (typeof stopLoopTimerSFX === 'function') {
        stopLoopTimerSFX();
    }

    if (playEndSound && typeof playSFX === 'function') {
        playSFX('SFX/klokeind.mp3');
    }

    finaleTimerRunning = false;
}

// Reset de timer seconden naar 0
function resetFinaleTimer() {
    finaleLoopTimerSeconds = 0;
}


// round-finale.js

function markFinaleAnswer(answerIndex) {
    const currentQuestion = perRoundState.finale.currentQuestion;
    
    if (currentQuestion.foundAnswers.length >= currentQuestion.answers.length) {
        flash("Fout: Alle antwoorden zijn reeds gevonden!", 'wrong');
        return;
    }

    const activePlayer = players.find(p => p.index === activePlayerIndex);
    const opponentIndex = getOpponentIndex(activePlayerIndex);
    const opponent = players.find(p => p.index === opponentIndex);
    
    // De fix voor de 'answerText' ReferenceError
    const answerText = currentQuestion.answers[answerIndex];

    const alreadyFound = (currentQuestion?.foundAnswers || []).some(a => a.answer === answerText);

    if (alreadyFound) {
        flash(`Fout: Antwoord "${answerText}" is al gegeven!`, 'wrong');
        return;
    }

    // Goed antwoord!
    const timeGained = finaleLoopTimerSeconds;
    playSFX('SFX/goed.mp3');

    // 1. De actieve speler heeft al tijd verloren tijdens het denken (via de timer)
    //    We hoeven hier GEEN extra tijd af te trekken

    // 2. Trek FINALE_POINTS_DEDUCTION seconden af van de tegenstander
    opponent.seconds = Math.max(0, opponent.seconds - FINALE_POINTS_DEDUCTION);
    
    // 3. Markeer antwoord als gevonden
    currentQuestion.foundAnswers.push({
        answer: answerText,
        finderIndex: activePlayerIndex
    });

    flash(`GOED! ${activePlayer.name} heeft ${timeGained}s gebruikt. ${opponent.name}: -${FINALE_POINTS_DEDUCTION}s.`, 'right');

    // 4. Reset en herstart de timer
    resetFinaleTimer(); // Reset de tijd die op de klok tikt naar 0
    
    // 5. Update UI en Display
    renderPlayers();

    // 💡 CHECK: Controleer of de finale ten einde is na de aftrek van seconden
    const winner = checkFinaleEnd();
    if (winner) {
        stopFinaleTimer(false); // Stop de timer loop ZONDER klokeind.mp3
        endFinaleGame(winner);
        return;
    }
    
    // Check of alle antwoorden gevonden zijn
    if (currentQuestion.foundAnswers.length === currentQuestion.answers.length) {
        // Indien alle antwoorden gevonden, ga naar volgende vraag
        stopFinaleTimer(false); // Stop de timer loop ZONDER klokeind.mp3
        nextFinaleQuestion();
        return;
    }
    
    // Ga verder met de beurt (laat de timer doorlopen)
    sendFinaleDisplayUpdate('update', 'scene-round-finale-main');
    renderFinaleHostUI('main');
}


// round-finale.js

function passFinale() {
    const currentQuestion = perRoundState.finale.currentQuestion;
    const activePlayer = players.find(p => p.index === activePlayerIndex);
    
    // 1. Stop de timer MET eindgeluid
    stopFinaleTimer(true); // Stopt de timer en speelt klokeind.mp3

    // 2. De actieve speler heeft al tijd verloren tijdens het denken (via de timer)
    //    We hoeven hier GEEN extra tijd af te trekken
    const timeUsed = finaleLoopTimerSeconds;
    
    // 3. Markeer speler als gepast voor deze vraag
    if (!currentQuestion.playersWhoPassed.includes(activePlayerIndex)) {
        currentQuestion.playersWhoPassed.push(activePlayerIndex);
    }
    
    flash(`${activePlayer.name} past! ${timeUsed}s gebruikt.`, 'warning');
    
    // Reset klok voor de volgende speler
    resetFinaleTimer();
    
    renderPlayers();

    // 💡 CHECK: Controleer of de finale ten einde is na de aftrek van seconden
    const winner = checkFinaleEnd();
    if (winner) {
        endFinaleGame(winner);
        return;
    }
    
    // Bepaal de volgende actieve speler
    const opponentIndex = getOpponentIndex(activePlayerIndex);
    const opponent = players.find(p => p.index === opponentIndex);
    
    // Als de tegenstander ook al gepast heeft, is de vraag voorbij
    if (currentQuestion.playersWhoPassed.includes(opponentIndex)) {
        flash(`Beide spelers hebben gepast. Volgende vraag.`, 'info');
        nextFinaleQuestion();
    } else {
        // De beurt gaat naar de tegenstander
        activePlayerIndex = opponentIndex;
        flash(`Beurt naar ${opponent.name}.`, 'info');
        
        // Update UI/Display voor de nieuwe speler
        sendFinaleDisplayUpdate('update', 'scene-round-finale-main');
        renderFinaleHostUI('main');
    }
}

function checkFinaleEnd() {
    // Vind de afgevallen speler (seconds <= 0)
    const afvaller = players.find(p => p.seconds <= 0);

    if (afvaller) {
        // De finale is voorbij! De afvaller's tegenstander is de winnaar.
        const winnaarIndex = getOpponentIndex(afvaller.index);
        return players.find(p => p.index === winnaarIndex);
    }

    return null;
}

// round-finale.js

function endFinaleGame(winner) {
    // 1. Stop de timer met 'false' om klokeind.mp3 te onderdrukken (volgens uw wens).
    stopFinaleTimer(false); 

    playSFX('SFX/finale.mp3');

    // Bepaal verliezer en de afvaller van de pre-finale
    const loser = players.find(p => p.index !== winner.index);
    const collectiefEndOption = document.getElementById('collectiefEndOption')?.value || 'lowestOut';
    const preFinaleAfvallerName = perRoundState.finale?.afvallerName || null;

    // 2. Toon de winnaar in de Host UI
    const controlsEl = document.getElementById('roundControls');
    controlsEl.innerHTML = `
        <div style="text-align:center;">
            <h1>FINALE VOORBIJ!</h1>
            <h2>De winnaar is: ${winner.name}</h2>
            <p><strong>Gefeliciteerd!</strong></p>
        </div>
    `;

    // 3. Toon de winnaar op de Display
    sendFinaleDisplayUpdate('round_end', 'scene-round-finale-end', {
        winnerIndex: winner.index,
        loserIndex: loser ? loser.index : null,
        loserName: loser ? loser.name : null,
        preFinaleAfvallerName: preFinaleAfvallerName,
        lowestOut: collectiefEndOption === 'lowestOut',
        collectiefEndOption: collectiefEndOption // Stuur de optie mee voor correcte teksten
    });
    
    // 4. Logica om de ronde officieel te beëindigen
    roundRunning = false;
    currentRoundIndex++;
}

function endFinaleRound() {
    roundRunning = false;
    stopAllTimers();
    stopFinaleTimer(false); // Stop ook de finale timer
    playSFX('SFX/finale.mp3');
    
    // Bepaal de winnaar en de verliezer. Degene met <= 0 seconden verliest.
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
        } else { // 'highestWinner' (gaat door)
            title = 'Winnaar Finale';
            winnerText = `${winner.name} wint de finale en gaat door naar de volgende aflevering!`;
            loserText = `${loser.name} is de afvaller.`;
        }
    } else {
        title = 'Einde Ronde (Fout)';
        winnerText = 'Kon de winnaar/verliezer niet bepalen.';
    }

    // Bouw HTML voor de host
    currentQuestionEl.innerHTML = `
        <h3>${title}</h3>
        <p><strong>Winnaar:</strong> ${winnerText}</p>
        <p><strong>Verliezer:</strong> ${loserText}</p>
    `;

    document.getElementById('roundControls').innerHTML = `
        <button onclick="flash('Spel is afgelopen, reset om opnieuw te beginnen.')" class="secondary">Einde Spel</button>
    `;
    
    // Stuur update naar display
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

// ===== Host UI Rendering & Display Update Payload =====
function renderFinaleHostUI(phase = 'main', afvallerIndex = -1) {
    const currentQuestion = perRoundState.finale.currentQuestion;
    const answers = currentQuestion?.answers || [];
    const foundAnswers = currentQuestion?.foundAnswers || []; // NIEUWE OPLOSSING
    const allFound = currentQuestion && (currentQuestion.foundAnswers.length === currentQuestion.answers.length);
    const activePlayer = players[activePlayerIndex];
    const controlsEl = document.getElementById('roundControls');
    const currentQuestionEl = document.getElementById('currentQuestion');
    const qIndex = perRoundState.finale.currentQuestionIndex;

    // 💡 NEW FIX: Define the opponent object
    const opponentIndex = getOpponentIndex(activePlayerIndex);
    const opponent = players.find(p => p.index === opponentIndex);
    
    if (!controlsEl || !currentQuestionEl) return;
    
    let html = '';
    
    if (phase === 'pre_start') {
        const afvaller = afvallerIndex !== -1 ? 
            players.find(p => p.index === afvallerIndex) || {name: 'Onbekend', index: afvallerIndex} : 
            null;
            
        currentQuestionEl.innerHTML = `
            <h3>Kandidaten voor de Finale</h3>
            ${afvaller ? 
                `<p><strong>Afvaller:</strong> ${afvaller.name}.</p>` : 
                `<p><strong>Slimste van de dag:</strong> ${players.find(p => !players.map(f => f.index).includes(p.index))?.name}.</p>`}
            <p><strong>Finalisten:</strong> ${players.map(p => p.name).join(' en ')}.</p>
            <p><strong>Startspeler:</strong> ${players.find(p => p.index === activePlayerIndex).name} (laagste tijd).</p>
        `;

        controlsEl.innerHTML = `
            <button onclick="startFinaleGame()" class="primary">Start Eerste Vraag</button>
        `;
        return; // Stop hier
    }
    
    // Toon de vraag en de antwoordknoppen in de main area
    currentQuestionEl.innerHTML = `
        <em>Vraag ${qIndex + 1}/${perRoundState.finale.questions.length}: ${currentQuestion.question}</em>
        
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
        // Tijdens de beurt van een speler
        html = `
            <h4>Beurt: ${activePlayer.name}</h4>
            <div style="display:flex;gap:10px;margin-top:10px;">
                <button onclick="startFinaleTimer()" id="finaleStartTimer" class="primary">Start Klok / Vervolg Beurt</button>
                <button onclick="passFinale()" class="secondary" ${allFound ? 'disabled' : ''}>Pas (${activePlayer.name})</button>
            </div>
            <div style="margin-top:10px; font-style:italic;">
                Kloktijd wordt van ${activePlayer.name}'s score afgetrokken bij pas/goed antwoord.
                Bij een goed antwoord wordt ook ${FINALE_POINTS_DEDUCTION}s van ${opponent.name}'s score afgetrokken.
            </div>
        `;
    } 
    else if (phase === 'answered') {
        // Na afloop van een vraag (alle antwoorden gevonden of beide gepast)
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

// Hulpmethode om de display update te sturen
function sendFinaleDisplayUpdate(action, scene, extraData = {}) {
    const qIndex = perRoundState.finale.currentQuestionIndex;
    const currentQuestion = perRoundState.finale.currentQuestion;
    
    let activePlayer = players.find(p => p.index === activePlayerIndex);
    let opponentIndex = getOpponentIndex(activePlayerIndex);

    // Bepaal de spelers om te tonen in de display: de 2 finalisten
    const playersToSend = players.map(p => ({
        name: p.name,
        seconds: p.seconds,
        photoUrl: p.photoUrl,
        isActive: p.index === activePlayerIndex,
        isFinalist: true, 
        isOut: false
    }));
    
    let allPlayersForDisplay = playersToSend;

    // Als we in de pre-start fase zitten, verstuur de volledige lijst (3 spelers)
    if (scene === 'scene-round-finale-pre' && extraData.allPlayers && extraData.afvallerIndex !== -1) {
        const afvallerData = extraData.allPlayers.find(p => p.index === extraData.afvallerIndex);
        
        // Creëer een nieuwe array op basis van de originele 3, maar update de finalisten.
        allPlayersForDisplay = extraData.allPlayers.map(p => {
            const finalist = playersToSend.find(fp => fp.name === p.name);
            if (finalist) {
                return finalist; // Finalist data (2 overgebleven)
            } else if (p.index === extraData.afvallerIndex) {
                // Afvaller data (1 verwijderde)
                return {
                    name: p.name,
                    seconds: p.seconds,
                    photoUrl: p.photoUrl,
                    isActive: false,
                    isFinalist: false,
                    isOut: true // Markering voor de display om donkerder te maken
                };
            }
            return p; // Dit zou niet moeten gebeuren, maar als fallback
        });
    }

    // De array om te versturen is de volledige array in de pre-fase, anders de 2 finalisten.
    const finalPlayersArray = (scene === 'scene-round-finale-pre') ? allPlayersForDisplay : playersToSend;
    
    // ... (De rest van de answersData logica)
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
        players: finalPlayersArray, // Gebruik de correcte array hier
        question: currentQuestion?.question || 'Bepalen finalisten...',
        answers: answersData,
        allAnswersFound: currentQuestion?.foundAnswers.length === currentQuestion?.answers.length,
        playersWhoPassed: currentQuestion?.playersWhoPassed || [],
        opponentIndex: opponentIndex,
        timerSeconds: finaleLoopTimerSeconds, // 🔄 Timer seconden voor display
        timerRunning: finaleTimerRunning, // 🔄 Timer status
        ...extraData // Voeg extra data toe (voor end scene: winnerIndex, loserName, preFinaleAfvallerName, etc.)
    });
}

console.log('Round-Finale.js geladen met Finale logica.');
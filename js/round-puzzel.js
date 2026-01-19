

let puzzelTimerActive = false;
let puzzelTimerInterval = null;

function sendPuzzelDisplayUpdate(scene, extraData = {}) {
  if (!streamerBotWS || streamerBotWS.readyState !== WebSocket.OPEN) {
    console.warn('Display update kon niet worden verzonden (WebSocket niet verbonden).');
    connectToQuizServer();
    return;
  }

  
  const currentLoopTime = (typeof loopTimerSeconds !== 'undefined') ? loopTimerSeconds : 0;

  const payload = {
    type: 'update',
    key: 'puzzel',
    scene,
    players: players.map((p, i) => ({
      name: p.name,
      seconds: p.seconds,
      photoUrl: p.photoUrl,
      isActive: i === activePlayerIndex,
      
      loopTimerSeconds: (i === activePlayerIndex && puzzelTimerActive) ? currentLoopTime : 0
    })),
    activeIndex: activePlayerIndex,
    currentPuzzelIndex: (perRoundState.currentPuzzelIndex ?? 0) + 1,
    maxPuzzles: perRoundState?.puzzles?.length ?? 3,
    currentTurnPlayer: players[activePlayerIndex]?.name || '-',
    ...extraData
  };

  streamerBotWS.send(JSON.stringify(payload));
}




function setupPuzzelRound() {
  if (typeof puzzelQuestions === 'undefined' || puzzelQuestions.length < 9) {
    flash('Fout: Onvoldoende puzzelvragen beschikbaar. Zorg voor minstens 9 unieke links.');
    return;
  }
  
  
  const pool = shuffle(puzzelQuestions.slice());
  const puzzles = [];

  
  function linksHaveUniqueAnswers(links) {
    const seen = new Set();
    for (const l of links) {
      if (!Array.isArray(l.answers)) return false;
      for (const a of l.answers) {
        const key = String(a).toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
      }
    }
    return true;
  }

  
  function pickUniqueGroup(available) {
    const tries = 300;
    for (let t = 0; t < tries; t++) {
      const cand = shuffle(available).slice(0, 3);
      if (cand.length < 3) return null;
      if (linksHaveUniqueAnswers(cand)) return cand;
    }
    
    return available.slice(0, 3);
  }

  let available = pool.slice();
  for (let i = 0; i < 3; i++) {
    if (available.length < 3) break;
    const group = pickUniqueGroup(available);
    if (!group || group.length < 3) break;
    puzzles.push({ links: group, played: false, currentWords: [] });
    
    available = available.filter(l => !group.includes(l));
  }

  
  if (puzzles.length < 3) {
    const remaining = pool.filter(l => !puzzles.flatMap(p => p.links).includes(l));
    while (puzzles.length < 3 && remaining.length >= 3) {
      puzzles.push({ links: remaining.splice(0, 3), played: false, currentWords: [] });
    }
  }

  
  if (puzzles.length !== 3) {
    const fallback = shuffle(puzzelQuestions.slice()).slice(0, 9);
    perRoundState.puzzles = [
      { links: fallback.slice(0, 3), played: false, currentWords: [] },
      { links: fallback.slice(3, 6), played: false, currentWords: [] },
      { links: fallback.slice(6, 9), played: false, currentWords: [] },
    ];
  } else {
    perRoundState.puzzles = puzzles;
  }

  
  perRoundState.puzzles.forEach(puzzel => {
    
    const seen = new Set();
    const allWords = [];
    puzzel.links.forEach(link => {
      link.answers.forEach(a => {
        const key = String(a).toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          allWords.push(String(a));
        }
      });
    });
    puzzel.currentWords = shuffle(allWords);
    puzzel.foundLinks = [];
    puzzel.remainingWords = [...puzzel.currentWords];
  });

  perRoundState.currentPuzzelIndex = 0;
  perRoundState.currentPuzzel = perRoundState.puzzles[0];
  perRoundState.playerOrder = [];
  perRoundState.originalPlayer = null; 
  perRoundState.timerRunning = false; 

  
  const sortedPlayers = [...players].sort((a, b) => a.seconds - b.seconds);
  activePlayerIndex = sortedPlayers[0].index;

  currentQuestionEl.innerHTML = `
    <em>Puzzelronde: 3 puzzels. De kandidaat met de **laagste tijd** start de eerste puzzel.</em><br>
    <div class="muted small">Startspeler: <strong>${players[activePlayerIndex].name}</strong></div>
    <div class="muted small">Puntentelling: **30 seconden** per gevonden verband.</div>
  `;
  highlightActive();
  document.getElementById('roundControls').innerHTML = '<button id="startPuzzelBtn" onclick="nextPuzzelQuestion()">Start Eerste Puzzel</button>';
  sendPuzzelDisplayUpdate('scene-round-puzzel-waiting');
}

function nextPuzzelQuestion() {
  if (typeof thinkingTimerInterval !== 'undefined') clearInterval(thinkingTimerInterval);
  perRoundState.timerRunning = false;

  if (perRoundState.currentPuzzelIndex >= perRoundState.puzzles.length) {
    flash('Einde van de Puzzelronde!');
    currentQuestionEl.innerHTML = '<em>Ronde afgelopen.</em>';
    document.getElementById('nextRound').disabled = false;
    document.getElementById('roundControls').innerHTML = '';
    return;
  }

  const puzzel = perRoundState.puzzles[perRoundState.currentPuzzelIndex];

  
  if (!puzzel.played) {
    puzzel.played = true;
    perRoundState.currentPuzzel = puzzel;
    perRoundState.originalPlayer = activePlayerIndex; 
    perRoundState.playerOrder = [activePlayerIndex]; 
    perRoundState.passCount = 0;

    
    puzzel.remainingWords = [...puzzel.currentWords];
  }

highlightActive();
  renderPuzzelDisplay(puzzel); 

  
  sendPuzzelDisplayUpdate('scene-round-puzzel-active', {
    puzzelWords: puzzel.currentWords.map(w => ({ 
        text: w, 
        found: false, 
        linkIndex: null 
    })),
    puzzelLinks: puzzel.links.map(link => ({
        link: link.link,
        found: false,
        timeGain: 30 
    }))
  });
}

function sendLoopTimerUpdate(seconds) {
    if (!streamerBotWS || streamerBotWS.readyState !== WebSocket.OPEN) {
        
        
        return;
    }
    
    const payload = {
        type: 'timer_update',
        seconds: seconds,
    };
    
    streamerBotWS.send(JSON.stringify(payload));
}

function stopPuzzelTimerAndSound() {
  if (typeof thinkingTimerInterval !== 'undefined') clearInterval(thinkingTimerInterval);
  if (typeof stopLoopTimerSFX === 'function') stopLoopTimerSFX(); 
  if (typeof playSFX === 'function') playSFX('SFX/klokeind.mp3'); 
  perRoundState.timerRunning = false;

  document.getElementById('startTimerBtn').disabled = false;
  document.getElementById('puzzelPassBtn').disabled = true;
  document.querySelectorAll('#checkLinks button').forEach(btn => btn.disabled = true);

  if (typeof loopTimerInterval !== 'undefined') clearInterval(loopTimerInterval);
}

function getPuzzelStarterIndex() {
    
    const sortedPlayers = [...players].sort((a, b) => a.seconds - b.seconds);
    
    
    const availablePlayers = sortedPlayers
        .filter(p => !perRoundState.playersWhoStartedPuzzel.includes(p.index));

    if (availablePlayers.length > 0) {
        
        return availablePlayers[0].index;
    }

    
    
    return sortedPlayers[0].index;
}


function startPuzzelTimer() {
  
  if (typeof stopLoopTimerSFX !== 'function' || typeof flash !== 'function' || typeof renderPlayers !== 'function') {
    flash('Fout: Benodigde kernfuncties (timer/UI) niet gevonden in core.js.');
    return;
  }
  
  stopLoopTimerSFX(); 

  
  try { sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' }); } catch(e) {}
  
  flash(`Tijd gestart voor ${players[activePlayerIndex].name}`);

  
  if(thinkingTimerInterval) clearInterval(thinkingTimerInterval); 

  
  thinkingTimerInterval = setInterval(()=>{
    players[activePlayerIndex].seconds = Math.max(0, players[activePlayerIndex].seconds - 1);
    renderPlayers();
    
    
    sendPuzzelDisplayUpdate('scene-round-puzzel-active'); 
    
    
    if (players[activePlayerIndex].seconds <= 0) {
      clearInterval(thinkingTimerInterval);
      stopLoopTimerSFX();
      if (typeof playSFX === 'function') playSFX('SFX/klokeind.mp3'); 
      flash(`${players[activePlayerIndex].name} is door zijn tijd heen! Moet nu passen.`);
      
      perRoundState.timerRunning = false;
      document.getElementById('startTimerBtn').disabled = true;
      document.getElementById('puzzelPassBtn').disabled = true;
      document.querySelectorAll('#checkLinks button').forEach(btn => btn.disabled = true);

      
      if (typeof passPuzzel === 'function') passPuzzel();
    }
  }, 1000);

  perRoundState.timerRunning = true;
  
  
  document.getElementById('startTimerBtn').disabled = true;
  document.getElementById('puzzelPassBtn').disabled = false;
  document.querySelectorAll('#checkLinks button').forEach(btn => btn.disabled = false);
}


function renderPuzzelDisplay(puzzel) {
  const puzzelNumber = perRoundState.currentPuzzelIndex + 1;
  const allWords = puzzel.currentWords;
  let tableHtml = '<table style="border-collapse: collapse; width: 100%; max-width: 600px; margin: 15px auto;"><tr>';

  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i];
    const isFound = !puzzel.remainingWords.includes(word);

    if (i > 0 && i % 3 === 0) {
      tableHtml += '</tr><tr>';
    }

    
    const linkIndices = puzzel.links.reduce((acc, link, idx) => {
      try {
        if (Array.isArray(link.answers) && link.answers.some(a => String(a) === String(word))) acc.push(idx);
      } catch (e) {}
      return acc;
    }, []);

    
    const classes = ['puzzel-word'];
    if (isFound) classes.push('found');
    if (linkIndices.length) {
      classes.push(...linkIndices.map(idx => `link-${idx}`));
      const anyLinkedFound = puzzel.foundLinks.some(fl => linkIndices.includes(puzzel.links.indexOf(fl)));
      classes.push(anyLinkedFound ? 'linked-found' : 'linked-unfound');
    }

    const classAttr = classes.join(' ');
    const dataLinks = linkIndices.join(',');

    const cellStyle = 'border: 1px solid #444; padding: 15px 10px; text-align: center; height: 40px; font-size: 1.1em; font-weight: bold;';

    tableHtml += `<td data-word="${escapeHtml(word)}" data-links="${dataLinks}" class="${classAttr}" style="${cellStyle}">${escapeHtml(word)}</td>`;
  }

  tableHtml += '</tr></table>';

  
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const foundLinksDisplay = puzzel.foundLinks.map(link =>
    `<div class="found-link">${link.link} (${link.answers.join(', ')})</div>`
  ).join('');

  currentQuestionEl.innerHTML = `
    <div class="small muted">Beurt: <strong>${players[activePlayerIndex].name}</strong></div>
    <strong>Puzzel ${puzzelNumber}</strong>
    <div id="puzzelGrid" style="margin-top: 1em;">${tableHtml}</div>
    <div style="margin-top: 1em; border-top: 1px solid #ccc; padding-top: 1em;">
      <strong>Gevonden Verbanden:</strong>
      <div id="foundLinks">${foundLinksDisplay || '<em>Nog geen verbanden gevonden.</em>'}</div>
    </div>
    <div class="muted small">De kandidaat noemt de link. De host klikt op de knop om de link goed te keuren.</div>
  `;

  
  const rc = document.getElementById('roundControls');
  
  const disabledAttr = (perRoundState.timerRunning) ? '' : 'disabled';
  const checkLinkButtons = puzzel.links
    .filter(link => !puzzel.foundLinks.includes(link))
    .map(link => {
      
      return `<button onclick="markPuzzelLink('${link.link.replace(/'/g, "\\'")}')" class="right" ${disabledAttr}>${link.link} goed (${link.answers.join(', ')})</button>`;
    })
    .join('');

  rc.innerHTML = `
    <button id="startTimerBtn" onclick="startPuzzelTimer()" class="bank">Start Timer</button>
    <div id="checkLinks" class="button-row" style="flex-wrap: wrap;">${checkLinkButtons}</div>
    <button id="puzzelPassBtn" onclick="passPuzzel()" class="secondary" style="margin-top: 10px;" disabled>Pas</button>
  `;

sendPuzzelDisplayUpdate('scene-round-puzzel-active', {
  puzzelWords: puzzel.currentWords.map(w => ({
    text: w,
    found: !puzzel.remainingWords.includes(w),
    linkIndex: (() => {
      const idxs = puzzel.links.reduce((acc, l, idx) => { if (l.answers.includes(w)) acc.push(idx); return acc; }, []);
      return idxs.length ? idxs[0] : null;
    })()
  })),
  puzzelLinks: puzzel.links.map(link => ({
    link: link.link,
    found: puzzel.foundLinks.includes(link),
    timeGain: 30
  }))
});

}

function markPuzzelLink(linkName) {
  const puzzel = perRoundState.currentPuzzel;
  const foundLink = puzzel.links.find(link => link.link === linkName && !puzzel.foundLinks.includes(link));

  if (!foundLink) {
    flash(`Fout: Link "${linkName}" is niet gevonden of is al opgelost.`);
    return;
  }

  const gained = 30;
  players[activePlayerIndex].seconds += gained;
  flash(`${players[activePlayerIndex].name} juist! Verband gevonden: "${linkName}" (+${gained}s)`);
  if (typeof playSFX === 'function') playSFX('SFX/goed.mp3');

  
puzzel.foundLinks.push(foundLink);
  puzzel.remainingWords = puzzel.remainingWords.filter(word => !foundLink.answers.includes(word));
  renderPlayers(); 

  const payloadWords = puzzel.currentWords.map(word => {
      let foundState = { text: word, found: false, linkIndex: null };
      
      
      puzzel.foundLinks.forEach(fl => {
          if (fl.answers.includes(word)) {
              const fl_index = puzzel.links.indexOf(fl); 
              foundState.found = true;
              foundState.linkIndex = fl_index; 
          }
      });
      return foundState;
  });

  const payloadLinks = puzzel.links.map(link => ({
      link: link.link,
      found: puzzel.foundLinks.includes(link),
      timeGain: 30 
  }));

  sendPuzzelDisplayUpdate('scene-round-puzzel-active', {
      puzzelWords: payloadWords,
      puzzelLinks: payloadLinks
  });

  
  renderPuzzelDisplay(puzzel);

  
if (puzzel.foundLinks.length === puzzel.links.length) {
    stopPuzzelTimerAndSound();
    flash(`Puzzel ${perRoundState.currentPuzzelIndex + 1} volledig opgelost!`);

    
    const isLastPuzzle = (perRoundState.currentPuzzelIndex + 1) >= perRoundState.puzzles.length;

    if (isLastPuzzle) {
        
        perRoundState.currentPuzzelIndex++; 
        
        
        sendPuzzelDisplayUpdate('scene-round-puzzel-active', {
            puzzelWords: [], 
            statusText: "Alle puzzels voltooid. Wacht op host."
        });
        
        
        document.getElementById('roundControls').innerHTML = '';
        document.getElementById('nextRound').disabled = false; 

    } else {
        
        determineNextPuzzleStarter(); 
        
        perRoundState.currentPuzzelIndex++; 
        
        if(perRoundState.currentPuzzelIndex < perRoundState.puzzles.length){
            const nextPuzzel = perRoundState.puzzles[perRoundState.currentPuzzelIndex];
            nextPuzzel.played = false; 
        }

        
        sendPuzzelDisplayUpdate('scene-round-puzzel-active', {
            puzzelWords: [], 
            
            statusText: `Puzzel voltooid. ${players[activePlayerIndex].name} start Puzzel ${perRoundState.currentPuzzelIndex + 1}.`
        });

        
        document.getElementById('roundControls').innerHTML = '<button onclick="nextPuzzelQuestion()">Start Volgende Puzzel</button>';
    }
  }
}



function passPuzzel() {
  stopPuzzelTimerAndSound();

  const puzzel = perRoundState.currentPuzzel;
  if (!puzzel) return;

  flash(`${players[activePlayerIndex].name} past/fout. Beurt naar de volgende kandidaat.`);

  if (!perRoundState.playerOrder.includes(activePlayerIndex)) {
    perRoundState.playerOrder.push(activePlayerIndex);
  }

  const allPlayersIndices = players.map((p,i) => i);
  const remainingCandidates = allPlayersIndices
    .filter(idx => !perRoundState.playerOrder.includes(idx))
    .sort((a,b) => players[a].seconds - players[b].seconds);

  if (remainingCandidates.length > 0) {
    activePlayerIndex = remainingCandidates[0];
    perRoundState.playerOrder.push(activePlayerIndex);
    highlightActive();
    renderPuzzelDisplay(puzzel);
    flash(`Beurt naar ${players[activePlayerIndex].name} (volgende laagste tijd).`);
      sendPuzzelDisplayUpdate('scene-round-puzzel-active', {
    puzzelWords: puzzel.currentWords.map(w => ({
      text: w,
      found: !puzzel.remainingWords.includes(w),
      linkIndex: null
    })),
    puzzelLinks: puzzel.links.map(link => ({
      link: link.link,
      found: puzzel.foundLinks.includes(link),
      timeGain: 30
    }))
  });
  } else {
    
    showPuzzelSolution(puzzel);
  }
}



function determineNextPuzzleStarter() {
  
  if (!perRoundState.playersWhoStartedPuzzel) perRoundState.playersWhoStartedPuzzel = [];

  
  const availablePlayers = players
    .map((p, i) => ({ ...p, index: i }))
    .filter(p => !perRoundState.playersWhoStartedPuzzel.includes(p.index));

  
  availablePlayers.sort((a, b) => a.seconds - b.seconds);

  if (availablePlayers.length > 0) {
    
    activePlayerIndex = availablePlayers[0].index;
    perRoundState.playersWhoStartedPuzzel.push(activePlayerIndex);
  } else {
    
    const highestScorer = [...players].sort((a, b) => b.seconds - a.seconds)[0];
    activePlayerIndex = highestScorer.index;
  }

  perRoundState.originalPlayer = activePlayerIndex; 
  highlightActive();
  flash(`Volgende puzzel start door ${players[activePlayerIndex].name}`);

}




function showPuzzelSolution(puzzel) {
  if (typeof thinkingTimerInterval !== 'undefined') clearInterval(thinkingTimerInterval);
  perRoundState.timerRunning = false;

  flash(`Oplossing van Puzzel ${perRoundState.currentPuzzelIndex + 1} wordt getoond.`);
  document.getElementById('roundControls').innerHTML = '';

  const solutionDisplay = puzzel.links.map(link => {
    const isFound = puzzel.foundLinks.includes(link);
    const status = isFound ? 'gevonden' : 'NIET gevonden';
    return `
      <div style="margin-bottom: 0.5em;">
        <strong>${link.link}</strong> (${status}): ${link.answers.join(', ')}
      </div>
    `;
  }).join('');

  currentQuestionEl.innerHTML = `
    <strong>Oplossing Puzzel ${perRoundState.currentPuzzelIndex + 1}</strong>
    <div style="margin-top: 1em;">${solutionDisplay}</div>
  `;

  
  sendPuzzelDisplayUpdate('scene-round-puzzel-active', {
    puzzelWords: puzzel.currentWords.map(w => ({
      text: w,
      found: true, 
      linkIndex: (() => {
        const fl = puzzel.links.find(fl => fl.answers.includes(w));
        return fl ? puzzel.links.indexOf(fl) : null;
      })()
    })),
    puzzelLinks: puzzel.links.map(link => ({
      link: link.link,
      answers: link.answers,
      found: true,
      timeGain: 30
    })),
    statusText: "Alle kandidaten hebben gepast. Volledige puzzel wordt getoond."
  });

  
  perRoundState.currentPuzzelIndex++;

  if (perRoundState.currentPuzzelIndex < perRoundState.puzzles.length) {
    
    if (perRoundState.currentPuzzelIndex === 2 && perRoundState.puzzles.length > 2) {
      const highestScorer = [...players].sort((a, b) => b.seconds - a.seconds)[0];
      activePlayerIndex = highestScorer.index;
      flash(`Hoogste tijd: ${players[activePlayerIndex].name} start Puzzel 3.`);
    } else {
      activePlayerIndex = perRoundState.originalPlayer; 
      flash(`Puzzel gestart door ${players[activePlayerIndex].name} start Puzzel ${perRoundState.currentPuzzelIndex + 1}.`);
    }

    document.getElementById('roundControls').innerHTML =
      '<button onclick="nextPuzzelQuestion()">Start Volgende Puzzel</button>';
  } else {
    
    document.getElementById('roundControls').innerHTML = '';
    flash('Einde van de Puzzelronde! Druk op "Volgende ronde" om verder te gaan.');
    document.getElementById('nextRound').disabled = false;
  }
}


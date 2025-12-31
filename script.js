    /* ======= CORE GAME LOGIC =======
       - Volledige implementatie van ronde-mechanieken (zonder daadwerkelijke vragen)
       - Vragen arrays zijn leeg en voorzien van commentaar: vul later in
       - UI knoppen om spel te simuleren: start, next question, goed/fout, bank
       - Tijdsbeheer per kandidaat (seconden) en rondetimers
    */

    // Spelermodel: naam, seconden, positie (0 links nieuwkomer, 2 rechts langst aanwezig)
    let players = []
    let startSeconds = 60
    let currentRoundIndex = 0
    let roundsSequence = ["threeSixNine","opendeur","puzzel","galerij","collectief","finale"]
    let roundRunning = false
    let currentQuestionIndex = 0
    let perRoundState = {} // houdt ronde-specifieke staat bij
    let globalTimerInterval = null
    let thinkingTimerInterval = null
    let activePlayerIndex = 0 // wie aan de beurt is (index in players array)

    function playSFX(file) {
        const audio = new Audio(file);
        audio.currentTime = 0;
        audio.play().catch(err => console.warn('Geluid kon niet worden afgespeeld:', err));
        }


    // Placeholder voor vragen — vul later. Elke ronde heeft zijn eigen array.
    // TODO: Vragen en media toevoegen in onderstaande arrays/structuren.
    const Q_3_6_9 = quizQuestions.slice(0,12).map(q => ({
      text: q.question,
      answers: q.answers,
      type: 'classic'
    }));
    const Q_OPEN_DEUR = [] // objecten {videoUrl, askBy, options:[..], correctIndex}
    const Q_PUZZEL = [] // objecten {words:[12], groups:[[4],[4],[4]], hints:[3]}
    const Q_GALERIJ = [] // objecten per kandidaat: {images:[10], theme}
    const Q_COLLECTIEF = [] // objecten {videoUrl, keywords:[5]}
    const Q_FINALE = [] // objecten {topic, keywords:[5]}

    // Helper: format time mm:ss
    function fmtS(s){ s = Math.max(0,Math.round(s)); let m=Math.floor(s/60); let sec=s%60; return (m<10?"0"+m:m)+":"+(sec<10?"0"+sec:sec)}

    // UI references
    const playersArea = document.getElementById('playersArea')
    const playerCountEl = document.getElementById('playerCount')
    const currentRoundEl = document.getElementById('currentRound')
    const roundTimerEl = document.getElementById('roundTimer')
    const currentQuestionEl = document.getElementById('currentQuestion')

    // Init / apply
    document.getElementById('applyBtn').addEventListener('click', ()=>{
      const names = Array.from(document.querySelectorAll('.playerName')).map(i=>i.value.trim()||i.placeholder||'Kandidaat')
      startSeconds = parseInt(document.getElementById('startSeconds').value)||60
      players = names.map((n,i)=>({name:n,seconds:startSeconds,index:i,position:i}))
      playerCountEl.textContent = players.length
      renderPlayers()
      flash('Spel aangemaakt — klaar om te starten')
    })

    document.getElementById('resetBtn').addEventListener('click', ()=>{
      players = []
      renderPlayers()
      currentRoundIndex = 0
      currentRoundEl.textContent = '—'
      currentQuestionEl.innerHTML = '<em>Spel gereset</em>'
      stopAllTimers()
      flash('Spel gereset')
    })

    function renderPlayers(){
      playersArea.innerHTML = ''
      players.forEach((p,i)=>{
        const el = document.createElement('div')
        el.className = 'player-card'
        el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
          <div><span class="player-token ${i===0?'left':i===1?'center':'rightTok'}"></span><strong>${p.name}</strong></div>
          <div><div class="small">Seconden</div><div class="big timer">${fmtS(p.seconds)}</div></div>
        </div>`
        playersArea.appendChild(el)
      })
    }

    function flash(text){
      const f = document.createElement('div'); f.className='flash'; f.textContent=text; document.body.appendChild(f)
      setTimeout(()=>f.remove(),2200)
    }

    // Round flow controls
    document.getElementById('startRound').addEventListener('click', ()=>{
      if(players.length!==3){ flash('Maak eerst het spel aan met 3 kandidaten'); return }
      currentRoundIndex = currentRoundIndex % roundsSequence.length
      startRound(roundsSequence[currentRoundIndex])
    })

    document.getElementById('nextRound').addEventListener('click', ()=>{
      currentRoundIndex++
      if(currentRoundIndex>=roundsSequence.length) currentRoundIndex = roundsSequence.length-1
      startRound(roundsSequence[currentRoundIndex])
    })

    // Buttons voor vraag acties
    document.getElementById('nextQuestion').addEventListener('click', ()=> nextQuestion())
    document.getElementById('markRight').addEventListener('click', () => {
        playSFX('SFX/goed.mp3');
        markAnswer(true);
        });

    document.getElementById('markWrong').addEventListener('click', () => {
        playSFX('SFX/fout.mp3');
        markAnswer(false);
    });

    document.getElementById('passBtn').addEventListener('click', () => {
      flash('Pas knop (placeholder) — functie nog te implementeren')
      playSFX('SFX/klokeind.mp3');
    })


    function startRound(roundKey){
      roundRunning = true
      perRoundState = {round:roundKey}
      currentQuestionIndex = 0
      activePlayerIndex = 0 // standaard links begint
      currentRoundEl.textContent = niceRoundName(roundKey)
      currentQuestionEl.innerHTML = '<em>Ronde gestart — druk op Volgende vraag om de eerste vraag te tonen.</em>'
      stopAllTimers()

      // ronde-specifieke initialisatie
      if(roundKey==='threeSixNine'){
        perRoundState.questions = Q_3_6_9.slice() // kopie
        perRoundState.max = 12
        currentQuestionEl.innerHTML = '<em>3-6-9 ronde: 12 vragen. Druk op Volgende vraag om te starten.</em>'
      } else if(roundKey==='opendeur'){
        perRoundState.questions = Q_OPEN_DEUR.slice()
        currentQuestionEl.innerHTML = '<em>Open Deur: elke vraag geeft 4 antwoorden van 20s. Denkuren kosten seconden.</em>'
      } else if(roundKey==='puzzel'){
        perRoundState.puzzles = Q_PUZZEL.slice()
        currentQuestionEl.innerHTML = '<em>Puzzel: 3 puzzels. Markeer oplossingen met de UI.</em>'
      } else if(roundKey==='galerij'){
        perRoundState.gallery = Q_GALERIJ.slice()
        let count = 10;
        if (typeof galerijPhotoCount !== 'undefined' && !isNaN(galerijPhotoCount)) {
          count = galerijPhotoCount;
        }
        currentQuestionEl.innerHTML = `<em>Galerij: per kandidaat ${count} beelden, 15s per goed antwoord.</em>`
      } else if(roundKey==='collectief'){
        perRoundState.questions = Q_COLLECTIEF.slice()
        currentQuestionEl.innerHTML = '<em>Collectief Geheugen: film toont thema, zoek 5 kernwoorden (10-50s).</em>'
      } else if(roundKey==='finale'){
        perRoundState.questions = Q_FINALE.slice()
        currentQuestionEl.innerHTML = '<em>Finale: head-to-head, trefwoorden trekken seconden van tegenstander.</em>'
      }

      renderPlayers()
    }

    function niceRoundName(key){
      const map = {threeSixNine:'3-6-9',opendeur:'Open Deur',puzzel:'Puzzel',galerij:'Galerij',collectief:'Collectief Geheugen',finale:'Finale'}
      return map[key]||key
    }

    // NEXT QUESTION: toont een (placeholder) vraag afhankelijk van ronde
    function nextQuestion(){
      if(!roundRunning){ flash('Start eerst een ronde'); return }
      const r = perRoundState.round
      currentQuestionIndex++
      if(r==='threeSixNine'){
        const q = perRoundState.questions[currentQuestionIndex - 1];
        currentQuestionEl.innerHTML = `
          <strong>Vraag ${currentQuestionIndex} (3-6-9)</strong>
          <div>${q.text}</div>
          <div class="small">(Druk op Goed of Fout. Elke derde vraag levert 10s extra op bij correct antwoord.)</div>
        `;
        perRoundState.currentIsBonus = (currentQuestionIndex % 3 === 0);
        // activePlayerIndex blijft wie aan de beurt is
        perRoundState.originalPlayer = activePlayerIndex;
        perRoundState.currentQuestionTried = [];
        highlightActive();

      } else if(r==='opendeur'){
        // show a placeholder open deur question with 4 options
        currentQuestionEl.innerHTML = `<strong>Open Deur — vraag ${currentQuestionIndex}</strong>
          <div class="small">(Video: nog niet toegevoegd)</div>
          <ol>
            <li>A (20s)</li>
            <li>B (20s)</li>
            <li>C (20s)</li>
            <li>D (20s)</li>
          </ol>
          <div class="small">De speler kan denken — tijdens het denken lopen de seconden weg.</div>`
        // start thinking timer simulation if desired (not auto)
        activePlayerIndex = selectOpenDeurStarter()
        highlightActive()
        // provide a control to toggle thinking timer
        showOpenDeurControls()
      } else if(r==='puzzel'){
        currentQuestionEl.innerHTML = `<strong>Puzzel ${currentQuestionIndex}</strong><div class="small">Toewijzing en interacties voor puzzel oplossen — (nog te vullen met woorden).</div>`
        showPuzzelControls()
      } else if(r==='galerij'){
        currentQuestionEl.innerHTML = `<strong>Galerij voor ${players[activePlayerIndex]?players[activePlayerIndex].name:'kandidaat'}</strong><div class="small">10 plaatjes (nog leeg). 15s per goed antwoord.</div>`
        showGalerijControls()
      } else if(r==='collectief'){
        currentQuestionEl.innerHTML = `<strong>Collectief Geheugen — item ${currentQuestionIndex}</strong><div class="small">Film en 5 kernwoorden (nog niet geladen). Eerste goed:10s, then 20,30,40,50</div>`
        showCollectiefControls()
      } else if(r==='finale'){
        currentQuestionEl.innerHTML = `<strong>Finale — head-to-head vraag ${currentQuestionIndex}</strong><div class="small">5 trefwoorden. Elk juist antwoord trekt 20s van tegenstander af. Tijd tikt tijdens antwoord.</div>`
        showFinaleControls()
      }
    }

    function highlightActive(){
      // Visueel benadrukken wie actief is: simple flash
      flash('Beurt: ' + (players[activePlayerIndex]?players[activePlayerIndex].name:'-'))
    }

    // MARK ANSWER correct / incorrect
    function markAnswer(isRight){
      const r = perRoundState.round
      if(!players[activePlayerIndex]){ flash('Geen actieve speler'); return }

      if(r==='threeSixNine'){
    if (isRight) {
      const bonus = perRoundState.currentIsBonus ? 10 : 0;
      players[activePlayerIndex].seconds += bonus;
      flash(`${players[activePlayerIndex].name} antwoord correct${bonus ? ' (+' + bonus + 's)' : ''}`);
      renderPlayers();
      // speler blijft aan de beurt, knop "Volgende vraag" kan pas naar nieuwe vraag
      perRoundState.currentQuestionTried = [];
    } else {
      // fout: voeg speler toe aan lijst van wie geprobeerd heeft
      if (!perRoundState.currentQuestionTried.includes(activePlayerIndex)) {
        perRoundState.currentQuestionTried.push(activePlayerIndex);
      }
      // zoek volgende speler die nog niet geprobeerd heeft
      const nextPlayer = [0, 1, 2].find(i => !perRoundState.currentQuestionTried.includes(i));
      if (nextPlayer !== undefined) {
        activePlayerIndex = nextPlayer;
        flash(`Fout — beurt gaat naar ${players[activePlayerIndex].name}`);
      } else {
        // alle spelers hebben geprobeerd, vraag verloren, originele speler terug
        flash(`Alle spelers fout — ${players[perRoundState.originalPlayer].name} krijgt de beurt terug`);
        activePlayerIndex = perRoundState.originalPlayer;
        perRoundState.currentQuestionTried = [];
      }
    }

      } else if(r==='puzzel'){
        if(isRight){ players[activePlayerIndex].seconds += 30; flash('Puzzel correct: +30s') }
        else { flash('Geen correct verband — volgende kandidaat') ; activePlayerIndex=(activePlayerIndex+1)%3 }
      } else if(r==='galerij'){
        if(isRight){ players[activePlayerIndex].seconds += 15; flash('+15s') }
        else { activePlayerIndex=(activePlayerIndex+1)%3; flash('Fout — volgende kandidaat probeert aan te vullen') }
      } else if(r==='collectief'){
        // find how many already correct this question
        perRoundState.collectiefCount = (perRoundState.collectiefCount||0) + (isRight?1:0)
        if(isRight){
          const awarded = [10,20,30,40,50][(perRoundState.collectiefCount-1)]||50
          players[activePlayerIndex].seconds += awarded
          flash(`${players[activePlayerIndex].name} +${awarded}s`)
        } else {
          activePlayerIndex=(activePlayerIndex+1)%3
          flash('Fout — volgende mag aanvullen')
        }
      } else if(r==='finale'){
        if(isRight){
          // subtract 20s from opponent
          const opponent = activePlayerIndex===0?1:0 // in finale we assume two players remain; here simplified: subtract from other highest-second player
          // pick opponent as the other with highest seconds (not the active one)
          const opponents = players.map((p,i)=>i).filter(i=>i!==activePlayerIndex)
          let target = opponents.reduce((best,i)=>players[i].seconds>players[best].seconds?i:best,opponents[0])
          players[target].seconds = Math.max(0, players[target].seconds - 20)
          flash(players[activePlayerIndex].name + ' juist — -20s bij ' + players[target].name)
        } else {
          // pass the turn
          activePlayerIndex = (activePlayerIndex+1)%3
          flash('Fout — beurt naar ' + players[activePlayerIndex].name)
        }
      }
      renderPlayers()
      checkEliminationOrFinale()
    }

    function checkEliminationOrFinale(){
      // simpele check: als iemand op 0 seconden komt -> uit
      players.forEach((p,i)=>{
        if(p.seconds<=0){ flash(p.name + ' heeft 0 seconden bereikt en valt af (uit simulatie).') }
      })
    }


    function stopAllTimers(){ if(globalTimerInterval){ clearInterval(globalTimerInterval); globalTimerInterval=null } if(thinkingTimerInterval){ clearInterval(thinkingTimerInterval); thinkingTimerInterval=null } }

    // OPEN DEUR helpers
    function selectOpenDeurStarter(){
      // de laatste in de tussenstand (laagste seconden) mag kiezen — return index
      const min = players.reduce((mi,p,i)=>p.seconds<players[mi].seconds?i:mi,0)
      return min
    }

    function showOpenDeurControls(){
      const rc = document.getElementById('roundControls')
      rc.innerHTML = ''
      const thinkBtn = document.createElement('button'); thinkBtn.textContent='Start/Denk (loopt seconden)'; thinkBtn.className='secondary'
      thinkBtn.addEventListener('click', ()=>{
        if(thinkingTimerInterval){ clearInterval(thinkingTimerInterval); thinkingTimerInterval=null; thinkBtn.textContent='Start/Denk (loopt seconden)'; flash('Denktimer gepauzeerd') }
        else { thinkingTimerInterval = setInterval(()=>{
          players[activePlayerIndex].seconds = Math.max(0, players[activePlayerIndex].seconds-1)
          renderPlayers();
          if(players[activePlayerIndex].seconds<=0){ clearInterval(thinkingTimerInterval); thinkingTimerInterval=null; flash(players[activePlayerIndex].name + ' liep op 0'); }
        },1000); thinkBtn.textContent='Stop denken'; flash('Denktimer gestart') }
      })
      rc.appendChild(thinkBtn)
      const passBtn = document.createElement('button'); passBtn.textContent='Pas / Stop'; passBtn.addEventListener('click', ()=>{ activePlayerIndex=(activePlayerIndex+1)%3; flash('Speler paste — beurt naar ' + players[activePlayerIndex].name); renderPlayers() })
      rc.appendChild(passBtn)
    }

    // PUZZEL controls
    function showPuzzelControls(){
      const rc = document.getElementById('roundControls'); rc.innerHTML=''
      const foundBtn = document.createElement('button'); foundBtn.textContent='Markeer verband gevonden'; foundBtn.addEventListener('click', ()=>{ players[activePlayerIndex].seconds +=30; flash('Verband gevonden: +30s'); renderPlayers() })
      rc.appendChild(foundBtn)
      const passBtn = document.createElement('button'); passBtn.textContent='Pas'; passBtn.addEventListener('click', ()=>{ activePlayerIndex=(activePlayerIndex+1)%3; flash('Geprobeerd en gepast — volgende kandidaat'); renderPlayers() })
      rc.appendChild(passBtn)
    }

    // GALERIJ controls
    function showGalerijControls(){
      const rc = document.getElementById('roundControls'); rc.innerHTML=''
      const rightBtn = document.createElement('button'); rightBtn.textContent='Herkenning: Goed (15s)'; rightBtn.className='right'; rightBtn.addEventListener('click', ()=>{ players[activePlayerIndex].seconds +=15; flash('+15s'); renderPlayers() })
      rc.appendChild(rightBtn)
      const passBtn = document.createElement('button'); passBtn.textContent='Pas / Laat aanvullen'; passBtn.addEventListener('click', ()=>{ activePlayerIndex=(activePlayerIndex+1)%3; flash('Laat anderen aanvullen'); renderPlayers() })
      rc.appendChild(passBtn)
    }

    // COLLECTIEF controls
    function showCollectiefControls(){
      const rc = document.getElementById('roundControls'); rc.innerHTML=''
      const input = document.createElement('input'); input.placeholder='Voer kernwoord in (submit)'; rc.appendChild(input)
      const submit = document.createElement('button'); submit.textContent='Submit'; submit.addEventListener('click', ()=>{
        // For simulation we treat everything as correct for demo — award escalating
        perRoundState.collectiefCount = (perRoundState.collectiefCount||0)+1
        const awarded = [10,20,30,40,50][perRoundState.collectiefCount-1]||50
        players[activePlayerIndex].seconds += awarded
        flash(players[activePlayerIndex].name + ' +'+awarded+'s (collectief)')
        renderPlayers()
      })
      rc.appendChild(submit)
      const passBtn = document.createElement('button'); passBtn.textContent='Pas'; passBtn.addEventListener('click', ()=>{ activePlayerIndex=(activePlayerIndex+1)%3; flash('Pas — volgende probeert'); renderPlayers() })
      rc.appendChild(passBtn)
    }

    // FINALE controls
    function showFinaleControls(){
      const rc = document.getElementById('roundControls'); rc.innerHTML=''
      const answerBtn = document.createElement('button'); answerBtn.textContent='Gok juist (trek 20s vd tegenstander)'; answerBtn.className='right'; answerBtn.addEventListener('click', ()=>{ markAnswer(true) })
      rc.appendChild(answerBtn)
      const passBtn = document.createElement('button'); passBtn.textContent='Stop / Pas beurt'; passBtn.addEventListener('click', ()=>{ activePlayerIndex=(activePlayerIndex+1)%3; flash('Beurt gepasst'); renderPlayers() })
      rc.appendChild(passBtn)
      // Simulate ticking while a candidate is answering
      const thinkBtn = document.createElement('button'); thinkBtn.textContent='Start/stop antwoordtimer (loopt seconden)'; thinkBtn.className='secondary'; thinkBtn.addEventListener('click', ()=>{
        if(globalTimerInterval){ clearInterval(globalTimerInterval); globalTimerInterval=null; thinkBtn.textContent='Start/stop antwoordtimer (loopt seconden)'; flash('Finale timer gepauzeerd') }
        else { globalTimerInterval = setInterval(()=>{
            // decrement active player seconds
            players[activePlayerIndex].seconds = Math.max(0, players[activePlayerIndex].seconds-1)
            renderPlayers()
            // if someone hits 0, announce
            if(players[activePlayerIndex].seconds<=0){ clearInterval(globalTimerInterval); globalTimerInterval=null; flash(players[activePlayerIndex].name + ' op 0 — verliest (finale).') }
        },1000); thinkBtn.textContent='Stop antwoordtimer'; flash('Finale timer gestart') }
      })
      rc.appendChild(thinkBtn)
    }

    // Utility to load sample media or play stings
    document.getElementById('playBumper').addEventListener('click', ()=> flash('Bumper geluid (simulatie)'))
    document.getElementById('playSting').addEventListener('click', ()=> flash('Sting geluid (simulatie)'))

    // Init at load
    renderPlayers()

    // Notes for host / developer
    console.log('De Slimste Mens — Host Tool (simulatie) klaar. \nVul arrays Q_... met echte vragen/media om het spel operationeel te maken.\nRonde-mechanica (3-6-9, Open Deur, Puzzel, Galerij, Collectief, Finale) zijn geïmplementeerd als interacties.');

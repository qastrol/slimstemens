/**
 * Config Manager - Beheert aangepaste quizdata per ronde
 * Laadt game-config.json en voorziet fallback naar standaard vragen
 */

let gameConfig = null;
let configLoaded = false;

function setPendingUiConfig(config) {
  if (typeof window === 'undefined') {
    return;
  }

  window.pendingUiConfig = config;
  
  // Pas config instellingen toe
  if (typeof window.applyUiSettingsFromConfig === 'function') {
    window.applyUiSettingsFromConfig(config);
  }
}

/**
 * Laadt het configuratiebestand
 */
async function loadGameConfig() {
  try {
    const response = await fetch('game-config.json');
    if (!response.ok) {
      console.warn('game-config.json niet gevonden of fout bij laden');
      gameConfig = getDefaultConfig();
      return;
    }
    
    const config = await response.json();
    gameConfig = config;
    configLoaded = true;
    console.log('Game configuratie geladen:', config);
    setPendingUiConfig(config);
  } catch (error) {
    console.warn('Fout bij laden van game-config.json:', error.message);
    gameConfig = getDefaultConfig();
  }
}

/**
 * Geeft standaard (lege) configuratie terug
 */
function getDefaultConfig() {
  return {
    metadata: {
      name: "Standaard Config",
      description: "Standaard configuratie (geen aangepaste vragen)"
    },
    threeSixNine: [],
    opendeur: [],
    puzzel: [],
    galerij: [],
    collectief: [],
    finale: []
  };
}

/**
 * Haalt vragen op voor een ronde
 * @param {string} roundKey - Identifier van de ronde (bijv. 'threeSixNine', 'puzzel')
 * @param {array} defaultQuestions - Standaard vragen als fallback
 * @returns {array} - Custom vragen aangevuld met standaard vragen
 */
function getQuestionsForRound(roundKey, defaultQuestions = []) {
  if (!gameConfig) {
    return defaultQuestions;
  }
  
  const configQuestions = gameConfig[roundKey];
  
  // Als config vragen bevat en niet leeg is, begin daarmee
  if (Array.isArray(configQuestions) && configQuestions.length > 0) {
    console.log(`Gebruiken aangepaste vragen voor ${roundKey} (${configQuestions.length} vragen)`);
    
    // Normaliseer 3-6-9 vragen: zorg dat 'text' property bestaat
    let normalizedQuestions = configQuestions;
    if (roundKey === 'threeSixNine') {
      normalizedQuestions = configQuestions.map(q => ({
        ...q, // Behoud alle originele properties
        text: q.text || q.question || 'Placeholdervraag',
        answers: q.answers || [],
        type: q.type || 'classic'
      }));

      // Optioneel: shuffle multiple-choice opties (alleen voor JSON config)
      const shuffleMcOptions = !!(gameConfig.settings && gameConfig.settings.threeSixNine && gameConfig.settings.threeSixNine.shuffleMultipleChoiceOptions);
      if (shuffleMcOptions) {
        normalizedQuestions = normalizedQuestions.map(q => {
          if ((q.type !== 'multiple-choice' && q.type !== 'photo-multiple-choice') || !q.options) {
            return q;
          }

          const shuffled = shuffleMultipleChoiceOptions(q.options, q.correctAnswer);
          return {
            ...q,
            options: shuffled.options,
            correctAnswer: shuffled.correctAnswer
          };
        });
      }
    }
    
    // Normaliseer galerij vragen: zorg dat 'images' array bestaat
    if (roundKey === 'galerij') {
      normalizedQuestions = configQuestions.map(gallery => {
        // Valideer dat images array bestaat
        if (!gallery.images || !Array.isArray(gallery.images)) {
          console.warn(`⚠️ Galerij "${gallery.theme || 'onbekend'}" heeft geen images array - wordt overgeslagen`);
          return null;
        }
        
        return {
          theme: gallery.theme || 'Galerij',
          folder: gallery.folder || '', // Optioneel veld
          images: gallery.images.map(img => ({
            src: img.src,
            answer: img.answer,
            remarks: img.remarks || undefined
          }))
        };
      }).filter(g => g !== null); // Verwijder ongeldige galerijen
      
      console.log(`✅ Galerij genormaliseerd: ${normalizedQuestions.length} galerijen met images`);
    }
    
    // Bepaal minimaal benodigde vragen per ronde (geen limiet voor finale)
    let minRequired = 0;
    if (roundKey === 'puzzel') minRequired = 9;
    else if (roundKey === 'galerij') minRequired = 3;
    else if (roundKey === 'collectief') minRequired = 3;
    else if (roundKey === 'opendeur') minRequired = 3;
    // FINALE: geen minRequired limiet meer
    
    // Controleer of config voldoende vragen heeft
    if (minRequired > 0 && normalizedQuestions.length < minRequired) {
      console.log(`Config heeft onvoldoende vragen voor ${roundKey}: ${normalizedQuestions.length}/${minRequired}. Aanvullen met standaard.`);
      // Voeg standaard vragen toe tot we minimaal genoeg hebben
      const combined = [...normalizedQuestions];
      const needed = minRequired - normalizedQuestions.length;
      combined.push(...defaultQuestions.slice(0, needed));
      return combined;
    }
    
    // Voor finale: altijd alle custom vragen + alle standaard vragen
    if (roundKey === 'finale' && defaultQuestions.length > 0) {
      console.log(`Finale: ${normalizedQuestions.length} custom vragen + ${defaultQuestions.length} standaard vragen`);
      // Beide arrays samenvoegen: custom EERST, dan standaard
      return [...normalizedQuestions, ...defaultQuestions];
    }
    
    // Voor andere rondes: gebruik alleen custom als genoeg
    return normalizedQuestions;
  }
  
  // Geen custom vragen: fallback naar standaard
  console.log(`Fallback naar standaard vragen voor ${roundKey}`);
  return defaultQuestions;
}

// Shuffle helper for multiple-choice options (A/B/C/D) while keeping correctAnswer aligned.
function shuffleMultipleChoiceOptions(options, correctAnswerKey) {
  const entries = Object.entries(options);
  shuffleArray(entries);

  const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F'];
  const shuffledOptions = {};
  let newCorrectKey = null;

  entries.forEach((entry, index) => {
    const originalKey = entry[0];
    const label = entry[1];
    const newKey = optionKeys[index] || originalKey;
    shuffledOptions[newKey] = label;
    if (originalKey === correctAnswerKey) {
      newCorrectKey = newKey;
    }
  });

  return {
    options: shuffledOptions,
    correctAnswer: newCorrectKey || correctAnswerKey
  };
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Controleert of een ronde geshuffled moet worden
 * @param {string} roundKey - Identifier van de ronde
 * @returns {boolean} - true als shuffle aan staat (standaard), false voor sequentiële volgorde
 */
function shouldShuffleRound(roundKey) {
  if (!gameConfig || !gameConfig.settings) {
    return true; // Standaard: shuffle aan
  }
  
  const roundSettings = gameConfig.settings[roundKey];
  if (!roundSettings) {
    return true; // Geen settings: shuffle aan
  }
  
  // Als shuffle expliciet false is, dan niet shufflen
  if (roundSettings.shuffle === false) {
    console.log(`${roundKey}: Sequentiële volgorde (shuffle uit)`);
    return false;
  }
  
  // Anders wel shufflen
  return true;
}

/**
 * Haalt een specifieke setting op voor een ronde
 * @param {string} roundKey - Identifier van de ronde
 * @param {string} settingKey - De naam van de setting (bijv. 'maxQuestions', 'photoCount')
 * @param {*} defaultValue - Standaardwaarde als setting niet bestaat
 * @returns {*} - De waarde van de setting of de defaultValue
 */
function getRoundSetting(roundKey, settingKey, defaultValue = null) {
  if (!gameConfig || !gameConfig.settings || !gameConfig.settings[roundKey]) {
    return defaultValue;
  }
  
  const roundSettings = gameConfig.settings[roundKey];
  
  if (roundSettings.hasOwnProperty(settingKey)) {
    console.log(`${roundKey}.${settingKey}: ${roundSettings[settingKey]}`);
    return roundSettings[settingKey];
  }
  
  return defaultValue;
}

/**
 * Haalt player mode instellingen op
 * @returns {object} - Object met playerCount, questionsPerRound en optionele players array
 */
function getPlayerModeSettings() {
  const defaults = {
    playerCount: 3,
    questionsPerRound: 1,
    players: null
  };
  
  if (!gameConfig || !gameConfig.settings || !gameConfig.settings.playerMode) {
    return defaults;
  }
  
  const playerMode = gameConfig.settings.playerMode;
  return {
    playerCount: playerMode.playerCount || defaults.playerCount,
    questionsPerRound: playerMode.questionsPerRound || defaults.questionsPerRound,
    players: Array.isArray(playerMode.players) ? playerMode.players : null
  };
}

/**
 * Stelt player mode instellingen in
 * @param {number} playerCount - Aantal spelers (1, 2, of 3)
 * @param {number} questionsPerRound - Vragen per ronde voor 1-speler modus (1 of 3)
 */
function setPlayerModeSettings(playerCount, questionsPerRound = 1) {
  if (!gameConfig) {
    gameConfig = getDefaultConfig();
  }
  
  if (!gameConfig.settings) {
    gameConfig.settings = {};
  }
  
  if (!gameConfig.settings.playerMode) {
    gameConfig.settings.playerMode = {};
  }
  
  gameConfig.settings.playerMode.playerCount = playerCount;
  gameConfig.settings.playerMode.questionsPerRound = questionsPerRound;
  
  console.log(`Player mode ingesteld: ${playerCount} speler(s), ${questionsPerRound} vraag/vragen per ronde`);
}


/**
 * Stelt vragen voor een ronde in via config
 * Nuttig voor dynamische updates
 * @param {string} roundKey - Identifier van de ronde
 * @param {array} questions - Nieuwe vragen
 */
function setQuestionsForRound(roundKey, questions) {
  if (!gameConfig) {
    gameConfig = getDefaultConfig();
  }
  
  if (gameConfig.hasOwnProperty(roundKey)) {
    gameConfig[roundKey] = questions;
    console.log(`Vragen voor ${roundKey} geüpdatet`);
  }
}

/**
 * Uploadt en laadt een aangepast config bestand
 * @param {File} file - Het geuploadde JSON bestand
 */
async function uploadConfigFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        gameConfig = config;
        configLoaded = true;
        console.log('Configuratie succesvol geupload:', config);
        
        // Update UI elementen a.d.h.v. config settings
        if (config.settings?.bumpers?.enabled !== undefined) {
          const bumperCheckbox = document.getElementById('bumpersEnabledCheckbox');
          if (bumperCheckbox) {
            bumperCheckbox.checked = config.settings.bumpers.enabled;
          }
        }
        
        if (config.settings?.intro?.enabled !== undefined) {
          const introCheckbox = document.getElementById('introEnabledCheckbox');
          if (introCheckbox) {
            introCheckbox.checked = config.settings.intro.enabled;
            const introOptions = document.getElementById('introOptions');
            if (introOptions) {
              introOptions.style.display = config.settings.intro.enabled ? 'block' : 'none';
            }
          }
        }
        
        if (config.settings?.intro?.text) {
          const introText = document.getElementById('introText');
          if (introText) {
            introText.value = config.settings.intro.text;
          }
        }

        setPendingUiConfig(config);
        
        resolve(config);
      } catch (error) {
        console.error('Fout bij parsen van config bestand:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Fout bij lezen van bestand'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Downloadt de huidige configuratie als JSON bestand
 */
function downloadConfigFile() {
  if (!gameConfig) {
    alert('Geen configuratie beschikbaar');
    return;
  }
  
  const dataStr = JSON.stringify(gameConfig, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `game-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporteert de huidige vragen van een ronde naar config format
 * Handig om standaard vragen in te voeren
 * @param {string} roundKey - Identifier van de ronde
 * @param {array} currentQuestions - De huidige vragen om te exporteren
 */
function exportRoundToConfig(roundKey, currentQuestions) {
  if (!gameConfig) {
    gameConfig = getDefaultConfig();
  }
  
  gameConfig[roundKey] = currentQuestions;
  console.log(`Ronde '${roundKey}' geëxporteerd naar configuratie`);
}

/**
 * Haalt bumpers instelling op uit configuratie
 * @returns {boolean} - true als bumpers enabled zijn, false anders
 */
function getBumpersEnabled() {
  if (!gameConfig || !gameConfig.settings || !gameConfig.settings.bumpers) {
    return true; // Standaard aan
  }
  return gameConfig.settings.bumpers.enabled !== false;
}

// Laadt configuratie bij het laden van het script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadGameConfig().then(() => {
      // Zet bumpers checkbox op basis van config
      const checkbox = document.getElementById('bumpersEnabledCheckbox');
      if (checkbox) {
        checkbox.checked = getBumpersEnabled();
      }
    });
  });
} else {
  loadGameConfig().then(() => {
    const checkbox = document.getElementById('bumpersEnabledCheckbox');
    if (checkbox) {
      checkbox.checked = getBumpersEnabled();
    }
  });
}

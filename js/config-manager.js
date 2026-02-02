/**
 * Config Manager - Beheert aangepaste quizdata per ronde
 * Laadt game-config.json en voorziet fallback naar standaard vragen
 */

let gameConfig = null;
let configLoaded = false;

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
    }
    
    // Bepaal minimaal benodigde vragen per ronde
    let minRequired = 0;
    if (roundKey === 'puzzel') minRequired = 9;
    else if (roundKey === 'galerij') minRequired = 3;
    else if (roundKey === 'collectief') minRequired = 3;
    else if (roundKey === 'finale') minRequired = 10;
    else if (roundKey === 'opendeur') minRequired = 3;
    
    // Controleer of config voldoende vragen heeft
    if (minRequired > 0 && normalizedQuestions.length < minRequired) {
      console.log(`Config heeft onvoldoende vragen voor ${roundKey}: ${normalizedQuestions.length}/${minRequired}. Aanvullen met standaard.`);
      // Voeg standaard vragen toe tot we minimaal genoeg hebben
      const combined = [...normalizedQuestions];
      const needed = minRequired - normalizedQuestions.length;
      combined.push(...defaultQuestions.slice(0, needed));
      return combined;
    }
    
    // Genoeg vragen: gebruik alleen custom
    return normalizedQuestions;
  }
  
  // Geen custom vragen: fallback naar standaard
  console.log(`Fallback naar standaard vragen voor ${roundKey}`);
  return defaultQuestions;
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

// Laadt configuratie bij het laden van het script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadGameConfig);
} else {
  loadGameConfig();
}

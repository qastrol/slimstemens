/**
 * Config Manager - Beheert aangepaste quizdata per ronde
 * Laadt game-config.json en voorziet fallback naar standaard vragen
 */

let gameConfig = null;
let configLoaded = false;
let activeConfigBlobUrls = [];

const DEFAULT_BRANDING_SETTINGS = Object.freeze({
  titlePrefix: 'de slimste mens',
  titleSuffix: 'van twitch',
  logoPath: 'assets/slimstemens.png'
});

function normalizeBrandingSettings(branding) {
  const merged = {
    ...DEFAULT_BRANDING_SETTINGS,
    ...(branding || {})
  };

  return {
    titlePrefix: String(merged.titlePrefix || DEFAULT_BRANDING_SETTINGS.titlePrefix).trim() || DEFAULT_BRANDING_SETTINGS.titlePrefix,
    titleSuffix: String(merged.titleSuffix || DEFAULT_BRANDING_SETTINGS.titleSuffix).trim() || DEFAULT_BRANDING_SETTINGS.titleSuffix,
    logoPath: String(merged.logoPath || DEFAULT_BRANDING_SETTINGS.logoPath).trim() || DEFAULT_BRANDING_SETTINGS.logoPath
  };
}

function getBrandingSettings() {
  const branding = gameConfig?.settings?.branding;
  return normalizeBrandingSettings(branding);
}

function getBrandingFullTitle() {
  const branding = getBrandingSettings();
  const combined = `${branding.titlePrefix} ${branding.titleSuffix}`.replace(/\s+/g, ' ').trim();
  if (!combined) {
    return 'De Slimste Mens van Twitch';
  }
  return combined.charAt(0).toUpperCase() + combined.slice(1);
}

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

function clearActiveConfigBlobUrls() {
  if (!Array.isArray(activeConfigBlobUrls) || activeConfigBlobUrls.length === 0) {
    activeConfigBlobUrls = [];
    return;
  }

  activeConfigBlobUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      // Negeer ongeldige of al vrijgegeven blob-URL's.
    }
  });

  activeConfigBlobUrls = [];
}

function setActiveConfigBlobUrls(urls) {
  clearActiveConfigBlobUrls();
  activeConfigBlobUrls = Array.isArray(urls) ? urls.slice() : [];
}

function normalizeZipPath(path) {
  if (typeof path !== 'string') {
    return '';
  }

  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function pickFirstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeAnswerList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeRemarksValue(...values) {
  const remark = pickFirstNonEmptyString(...values);
  return remark || undefined;
}

function guessMimeType(filePath) {
  const normalized = normalizeZipPath(filePath).toLowerCase();

  if (/(\.mp4)$/i.test(normalized)) return 'video/mp4';
  if (/(\.webm)$/i.test(normalized)) return 'video/webm';
  if (/(\.ogg)$/i.test(normalized)) return 'video/ogg';
  if (/(\.mov)$/i.test(normalized)) return 'video/quicktime';
  if (/(\.m4v)$/i.test(normalized)) return 'video/x-m4v';
  if (/(\.mkv)$/i.test(normalized)) return 'video/x-matroska';
  if (/(\.avi)$/i.test(normalized)) return 'video/x-msvideo';
  if (/(\.jpg|\.jpeg)$/i.test(normalized)) return 'image/jpeg';
  if (/(\.png)$/i.test(normalized)) return 'image/png';
  if (/(\.gif)$/i.test(normalized)) return 'image/gif';
  if (/(\.webp)$/i.test(normalized)) return 'image/webp';
  if (/(\.svg)$/i.test(normalized)) return 'image/svg+xml';

  return 'application/octet-stream';
}

function buildZipLookup(zip) {
  const byLowerExactPath = new Map();
  const byLowerBasename = new Map();

  Object.values(zip.files).forEach((zipEntry) => {
    if (!zipEntry || zipEntry.dir) {
      return;
    }

    const normalizedPath = normalizeZipPath(zipEntry.name);
    if (!normalizedPath) {
      return;
    }

    const lowerPath = normalizedPath.toLowerCase();
    byLowerExactPath.set(lowerPath, { path: normalizedPath, entry: zipEntry });

    const basename = normalizedPath.split('/').pop();
    if (!basename) {
      return;
    }

    const lowerBasename = basename.toLowerCase();
    const list = byLowerBasename.get(lowerBasename) || [];
    list.push({ path: normalizedPath, entry: zipEntry });
    byLowerBasename.set(lowerBasename, list);
  });

  return { byLowerExactPath, byLowerBasename };
}

function resolveZipMediaEntry(lookup, originalPath) {
  const normalizedOriginal = normalizeZipPath(originalPath);
  if (!normalizedOriginal) {
    return null;
  }

  const candidates = new Set();
  const basename = normalizedOriginal.split('/').pop();
  const withoutMediaPrefix = normalizedOriginal.replace(/^(media|galerij|collectief_geheugen|opendeur)\//i, '');

  candidates.add(normalizedOriginal);
  candidates.add(withoutMediaPrefix);

  if (basename) {
    candidates.add(basename);
    candidates.add(`media/${basename}`);
    candidates.add(`galerij/${basename}`);
    candidates.add(`collectief_geheugen/${basename}`);
    candidates.add(`opendeur/${basename}`);
  }

  candidates.add(`media/${withoutMediaPrefix}`);
  candidates.add(`galerij/${withoutMediaPrefix}`);
  candidates.add(`collectief_geheugen/${withoutMediaPrefix}`);
  candidates.add(`opendeur/${withoutMediaPrefix}`);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeZipPath(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    const match = lookup.byLowerExactPath.get(normalizedCandidate.toLowerCase());
    if (match) {
      return match;
    }
  }

  if (!basename) {
    return null;
  }

  const basenameMatches = lookup.byLowerBasename.get(basename.toLowerCase()) || [];
  if (basenameMatches.length === 0) {
    return null;
  }

  // Kies de kortste match om onnodige diepe paden te vermijden.
  return basenameMatches
    .slice()
    .sort((a, b) => a.path.length - b.path.length)[0];
}

function findConfigEntryInZip(zip) {
  const files = Object.values(zip.files).filter(entry => entry && !entry.dir);
  if (files.length === 0) {
    return null;
  }

  const exact = files.find(entry => normalizeZipPath(entry.name).toLowerCase() === 'game-config.json');
  if (exact) {
    return exact;
  }

  const byName = files.find(entry => normalizeZipPath(entry.name).toLowerCase().endsWith('/game-config.json'));
  if (byName) {
    return byName;
  }

  return files.find(entry => normalizeZipPath(entry.name).toLowerCase().endsWith('.json')) || null;
}

async function remapConfigMediaFromZip(config, zip) {
  const lookup = buildZipLookup(zip);
  const mediaUrlByZipPath = new Map();
  const generatedBlobUrls = [];
  const unresolvedPaths = [];

  const getMediaUrlForMatch = async (match) => {
    if (!match || !match.path || !match.entry) {
      return null;
    }

    if (mediaUrlByZipPath.has(match.path)) {
      return mediaUrlByZipPath.get(match.path);
    }

    // Gebruik data-URL's i.p.v. blob-URL's zodat media ook in display.html werkt
    // wanneer host en display als losse file:// documenten draaien.
    const mimeType = guessMimeType(match.path);
    const base64Data = await match.entry.async('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    mediaUrlByZipPath.set(match.path, dataUrl);
    return dataUrl;
  };

  const tryMapPath = async (rawPath, label) => {
    const path = typeof rawPath === 'string' ? rawPath.trim() : '';
    if (!path || shouldSkipRemoteMediaPath(path)) {
      return { mapped: path, found: true };
    }

    const match = resolveZipMediaEntry(lookup, path);
    if (!match) {
      unresolvedPaths.push(`${label}: ${path}`);
      return { mapped: path, found: false };
    }

    const mediaUrl = await getMediaUrlForMatch(match);
    return { mapped: mediaUrl, found: true };
  };

  if (Array.isArray(config?.galerij)) {
    for (let galleryIndex = 0; galleryIndex < config.galerij.length; galleryIndex += 1) {
      const gallery = config.galerij[galleryIndex];
      if (!Array.isArray(gallery?.images)) {
        continue;
      }

      for (let imageIndex = 0; imageIndex < gallery.images.length; imageIndex += 1) {
        const image = gallery.images[imageIndex];
        if (!image || typeof image !== 'object') {
          continue;
        }

        const result = await tryMapPath(
          image.src,
          `Galerij \"${gallery.theme || `#${galleryIndex + 1}`}\" foto ${imageIndex + 1}`
        );

        if (result.found && result.mapped) {
          image.src = result.mapped;
        }
      }
    }
  }

  if (Array.isArray(config?.threeSixNine)) {
    for (let questionIndex = 0; questionIndex < config.threeSixNine.length; questionIndex += 1) {
      const question = config.threeSixNine[questionIndex];
      if (!question || typeof question !== 'object') {
        continue;
      }

      const questionPhotoResult = await tryMapPath(
        question.questionPhotoUrl || question.photoUrl,
        `3-6-9 vraag ${questionIndex + 1} vraagfoto`
      );
      if (questionPhotoResult.found && questionPhotoResult.mapped) {
        question.questionPhotoUrl = questionPhotoResult.mapped;
        question.photoUrl = questionPhotoResult.mapped;
      }

      const questionAudioResult = await tryMapPath(
        question.questionAudioUrl || question.audioUrl,
        `3-6-9 vraag ${questionIndex + 1} vraagaudio`
      );
      if (questionAudioResult.found && questionAudioResult.mapped) {
        question.questionAudioUrl = questionAudioResult.mapped;
        question.audioUrl = questionAudioResult.mapped;
      }

      const questionVideoResult = await tryMapPath(
        question.questionVideoUrl || question.videoUrl || question.clip,
        `3-6-9 vraag ${questionIndex + 1} vraagvideo`
      );
      if (questionVideoResult.found && questionVideoResult.mapped) {
        question.questionVideoUrl = questionVideoResult.mapped;
        question.videoUrl = questionVideoResult.mapped;
      }

      const afterPhotoResult = await tryMapPath(
        question.afterPhotoUrl || question.revealPhotoUrl,
        `3-6-9 vraag ${questionIndex + 1} na-vraag foto`
      );
      if (afterPhotoResult.found && afterPhotoResult.mapped) {
        question.afterPhotoUrl = afterPhotoResult.mapped;
      }

      const afterAudioResult = await tryMapPath(
        question.afterAudioUrl || question.revealAudioUrl,
        `3-6-9 vraag ${questionIndex + 1} na-vraag audio`
      );
      if (afterAudioResult.found && afterAudioResult.mapped) {
        question.afterAudioUrl = afterAudioResult.mapped;
      }

      const afterVideoResult = await tryMapPath(
        question.afterVideoUrl || question.revealVideoUrl,
        `3-6-9 vraag ${questionIndex + 1} na-vraag video`
      );
      if (afterVideoResult.found && afterVideoResult.mapped) {
        question.afterVideoUrl = afterVideoResult.mapped;
      }
    }
  }

  if (Array.isArray(config?.opendeur)) {
    for (let questionIndex = 0; questionIndex < config.opendeur.length; questionIndex += 1) {
      const question = config.opendeur[questionIndex];
      if (!question || typeof question !== 'object') {
        continue;
      }

      const introVideoResult = await tryMapPath(
        question.introVideoUrl || question.videoUrl || question.introVideo || question.video,
        `Open Deur vraag ${questionIndex + 1} introvideo`
      );

      if (introVideoResult.found && introVideoResult.mapped) {
        question.introVideoUrl = introVideoResult.mapped;
        if (typeof question.videoUrl === 'string') {
          question.videoUrl = introVideoResult.mapped;
        }
        if (typeof question.introVideo === 'string') {
          question.introVideo = introVideoResult.mapped;
        }
        if (typeof question.video === 'string') {
          question.video = introVideoResult.mapped;
        }
      }

      const introThumbnailResult = await tryMapPath(
        question.introThumbnailUrl || question.thumbnailUrl || question.introImageUrl || question.posterUrl,
        `Open Deur vraag ${questionIndex + 1} thumbnail`
      );

      if (introThumbnailResult.found && introThumbnailResult.mapped) {
        question.introThumbnailUrl = introThumbnailResult.mapped;
        if (typeof question.thumbnailUrl === 'string') {
          question.thumbnailUrl = introThumbnailResult.mapped;
        }
        if (typeof question.introImageUrl === 'string') {
          question.introImageUrl = introThumbnailResult.mapped;
        }
        if (typeof question.posterUrl === 'string') {
          question.posterUrl = introThumbnailResult.mapped;
        }
      }
    }
  }

  if (Array.isArray(config?.collectief)) {
    for (let entryIndex = 0; entryIndex < config.collectief.length; entryIndex += 1) {
      const entry = config.collectief[entryIndex];
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const currentVideoPath = entry.video || entry.videoUrl || entry.clip;
      const result = await tryMapPath(currentVideoPath, `Collectief Geheugen fragment ${entryIndex + 1}`);

      if (result.found && result.mapped) {
        if (typeof entry.video === 'string') entry.video = result.mapped;
        if (typeof entry.videoUrl === 'string') entry.videoUrl = result.mapped;
        if (typeof entry.clip === 'string') entry.clip = result.mapped;
        if (!entry.video && !entry.videoUrl && !entry.clip) {
          entry.video = result.mapped;
        }
      }
    }
  }

  if (Array.isArray(config?.settings?.playerMode?.players)) {
    for (let playerIndex = 0; playerIndex < config.settings.playerMode.players.length; playerIndex += 1) {
      const player = config.settings.playerMode.players[playerIndex];
      if (!player || typeof player !== 'object') {
        continue;
      }

      const result = await tryMapPath(player.photoUrl, `Spelerfoto ${playerIndex + 1}`);
      if (result.found && result.mapped) {
        player.photoUrl = result.mapped;
      }
    }
  }

  if (config?.settings?.presenter && typeof config.settings.presenter === 'object') {
    const presenterPhotoResult = await tryMapPath(
      config.settings.presenter.photoUrl || config.settings.presenter.photoData,
      'Presentatorfoto'
    );

    if (presenterPhotoResult.found && presenterPhotoResult.mapped) {
      config.settings.presenter.photoUrl = presenterPhotoResult.mapped;
      config.settings.presenter.photoData = presenterPhotoResult.mapped;
    }
  }

  config._generatedBlobUrls = generatedBlobUrls;
  config._zipUnresolvedPaths = unresolvedPaths;

  return config;
}

async function parseConfigFromZip(file) {
  if (typeof JSZip === 'undefined') {
    throw new Error('ZIP ondersteuning is niet beschikbaar (JSZip ontbreekt).');
  }

  const zip = await JSZip.loadAsync(file);
  const configEntry = findConfigEntryInZip(zip);
  if (!configEntry) {
    throw new Error('Geen game-config.json gevonden in het ZIP bestand.');
  }

  const rawConfig = await configEntry.async('string');
  const parsedConfig = JSON.parse(rawConfig);
  return remapConfigMediaFromZip(parsedConfig, zip);
}

async function applyLoadedConfig(config) {
  const mediaWarnings = await validateConfigMediaPaths(config);
  if (mediaWarnings.length > 0) {
    console.warn('⚠️ Config media-waarschuwingen:', mediaWarnings);
  }

  config._mediaWarnings = mediaWarnings;
  setActiveConfigBlobUrls(config._generatedBlobUrls || []);
  gameConfig = config;
  configLoaded = true;
  console.log('Configuratie succesvol geladen:', config);

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
  storeConfigMediaWarnings(mediaWarnings);

  return config;
}

function collectMediaPathChecks(config) {
  const checks = [];

  if (Array.isArray(config?.threeSixNine)) {
    config.threeSixNine.forEach((question, questionIndex) => {
      const questionMedia = [
        { label: 'vraagfoto', path: question?.questionPhotoUrl || question?.photoUrl },
        { label: 'vraagaudio', path: question?.questionAudioUrl || question?.audioUrl },
        { label: 'vraagvideo', path: question?.questionVideoUrl || question?.videoUrl || question?.clip },
        { label: 'na-vraag foto', path: question?.afterPhotoUrl || question?.revealPhotoUrl },
        { label: 'na-vraag audio', path: question?.afterAudioUrl || question?.revealAudioUrl },
        { label: 'na-vraag video', path: question?.afterVideoUrl || question?.revealVideoUrl }
      ];

      questionMedia.forEach((entry) => {
        const path = typeof entry.path === 'string' ? entry.path.trim() : '';
        if (!path) {
          return;
        }

        checks.push({
          round: 'threeSixNine',
          label: `3-6-9 vraag ${questionIndex + 1} ${entry.label}`,
          path
        });
      });
    });
  }

  if (Array.isArray(config?.opendeur)) {
    config.opendeur.forEach((question, questionIndex) => {
      const introVideoPath = typeof (question?.introVideoUrl || question?.videoUrl || question?.introVideo || question?.video) === 'string'
        ? (question.introVideoUrl || question.videoUrl || question.introVideo || question.video).trim()
        : '';

      const introThumbnailPath = typeof (question?.introThumbnailUrl || question?.thumbnailUrl || question?.introImageUrl || question?.posterUrl) === 'string'
        ? (question.introThumbnailUrl || question.thumbnailUrl || question.introImageUrl || question.posterUrl).trim()
        : '';

      if (introVideoPath) {
        checks.push({
          round: 'opendeur',
          label: `Open Deur vraag ${questionIndex + 1} introvideo`,
          path: introVideoPath
        });
      }

      if (introThumbnailPath) {
        checks.push({
          round: 'opendeur',
          label: `Open Deur vraag ${questionIndex + 1} thumbnail`,
          path: introThumbnailPath
        });
      }
    });
  }

  if (Array.isArray(config?.galerij)) {
    config.galerij.forEach((gallery, galleryIndex) => {
      if (!Array.isArray(gallery?.images)) {
        return;
      }

      gallery.images.forEach((img, imageIndex) => {
        const path = typeof img?.src === 'string' ? img.src.trim() : '';
        if (!path) {
          return;
        }

        checks.push({
          round: 'galerij',
          label: `Galerij \"${gallery?.theme || `#${galleryIndex + 1}`}\" foto ${imageIndex + 1}`,
          path
        });
      });
    });
  }

  if (Array.isArray(config?.collectief)) {
    config.collectief.forEach((entry, entryIndex) => {
      const rawPath = entry?.video || entry?.videoUrl || entry?.clip;
      const path = typeof rawPath === 'string' ? rawPath.trim() : '';
      if (!path) {
        return;
      }

      checks.push({
        round: 'collectief',
        label: `Collectief Geheugen fragment ${entryIndex + 1}`,
        path
      });
    });
  }

  return checks;
}

function shouldSkipRemoteMediaPath(path) {
  return /^(https?:|data:|blob:)/i.test(path);
}

async function checkMediaPathExists(path) {
  if (!path || shouldSkipRemoteMediaPath(path)) {
    return true;
  }

  try {
    const headResponse = await fetch(path, {
      method: 'HEAD',
      cache: 'no-store'
    });

    if (headResponse.ok) {
      return true;
    }

    if (headResponse.status !== 405 && headResponse.status !== 501) {
      return false;
    }
  } catch (error) {
    // Fallback naar GET voor servers die HEAD niet ondersteunen.
  }

  try {
    const getResponse = await fetch(path, {
      method: 'GET',
      cache: 'no-store'
    });
    return getResponse.ok;
  } catch (error) {
    return false;
  }
}

async function validateConfigMediaPaths(config) {
  const checks = collectMediaPathChecks(config);
  if (checks.length === 0) {
    return [];
  }

  const availabilityByPath = new Map();
  const uniquePaths = [...new Set(checks.map(item => item.path))];

  await Promise.all(uniquePaths.map(async (path) => {
    const exists = await checkMediaPathExists(path);
    availabilityByPath.set(path, exists);
  }));

  const warnings = [];
  checks.forEach((item) => {
    if (!availabilityByPath.get(item.path)) {
      warnings.push(`${item.label}: pad niet gevonden (${item.path})`);
    }
  });

  return warnings;
}

function storeConfigMediaWarnings(warnings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.configMediaWarnings = Array.isArray(warnings) ? warnings : [];
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
    const mediaWarnings = await validateConfigMediaPaths(config);
    if (mediaWarnings.length > 0) {
      console.warn('⚠️ Config media-waarschuwingen:', mediaWarnings);
    }

    config._mediaWarnings = mediaWarnings;
    gameConfig = config;
    configLoaded = true;
    console.log('Game configuratie geladen:', config);
    storeConfigMediaWarnings(mediaWarnings);
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
    settings: {
      branding: {
        titlePrefix: DEFAULT_BRANDING_SETTINGS.titlePrefix,
        titleSuffix: DEFAULT_BRANDING_SETTINGS.titleSuffix,
        logoPath: DEFAULT_BRANDING_SETTINGS.logoPath
      }
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
      normalizedQuestions = configQuestions.map((q) => {
        const rawType = q.type || 'classic';
        const normalizedType = rawType === 'photo' || rawType === 'audio'
          ? 'classic'
          : rawType === 'photo-multiple-choice'
            ? 'multiple-choice'
            : rawType;

        return {
          ...q,
          text: q.text || q.question || 'Placeholdervraag',
          answers: normalizeAnswerList(q.answers),
          type: normalizedType || 'classic',
          remarks: normalizeRemarksValue(q.remarks, q.opmerking, q.comment, q.note),
          questionPhotoUrl: q.questionPhotoUrl || q.photoUrl || undefined,
          questionAudioUrl: q.questionAudioUrl || q.audioUrl || undefined,
          questionVideoUrl: q.questionVideoUrl || q.videoUrl || q.clip || undefined,
          afterPhotoUrl: q.afterPhotoUrl || q.revealPhotoUrl || undefined,
          afterAudioUrl: q.afterAudioUrl || q.revealAudioUrl || undefined,
          afterVideoUrl: q.afterVideoUrl || q.revealVideoUrl || undefined,
          // Backward compatibility velden behouden voor oudere codepaden.
          photoUrl: q.questionPhotoUrl || q.photoUrl || undefined,
          audioUrl: q.questionAudioUrl || q.audioUrl || undefined,
          videoUrl: q.questionVideoUrl || q.videoUrl || q.clip || undefined
        };
      });

      // Optioneel: shuffle multiple-choice opties (alleen voor JSON config)
      const shuffleMcOptions = !!(gameConfig.settings && gameConfig.settings.threeSixNine && gameConfig.settings.threeSixNine.shuffleMultipleChoiceOptions);
      if (shuffleMcOptions) {
        normalizedQuestions = normalizedQuestions.map(q => {
          if (q.type !== 'multiple-choice' || !q.options) {
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

    // Normaliseer Open Deur vragen
    if (roundKey === 'opendeur') {
      normalizedQuestions = configQuestions.map((q, index) => ({
        ...q,
        from: q.from || q.questioner || q.vragensteller || `Vragensteller ${index + 1}`,
        question: q.question || q.text || 'Open Deur vraag',
        answers: normalizeAnswerList(q.answers),
        introVideoUrl: q.introVideoUrl || q.videoUrl || q.introVideo || q.video || null,
        introThumbnailUrl: q.introThumbnailUrl || q.thumbnailUrl || q.introImageUrl || q.posterUrl || null,
        remarks: normalizeRemarksValue(q.remarks, q.opmerking, q.comment, q.note)
      }));
    }

    if (roundKey === 'puzzel') {
      normalizedQuestions = configQuestions.map((q, index) => ({
        ...q,
        link: pickFirstNonEmptyString(q.link, q.answer, q.question, q.text) || `Puzzel ${index + 1}`,
        answers: normalizeAnswerList(q.answers),
        remarks: normalizeRemarksValue(q.remarks, q.opmerking, q.comment, q.note)
      }));
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
            remarks: normalizeRemarksValue(img.remarks, img.opmerking, img.comment, img.note)
          }))
        };
      }).filter(g => g !== null); // Verwijder ongeldige galerijen
      
      console.log(`✅ Galerij genormaliseerd: ${normalizedQuestions.length} galerijen met images`);
    }

    if (roundKey === 'collectief') {
      normalizedQuestions = configQuestions.map((q) => ({
        ...q,
        video: pickFirstNonEmptyString(q.video, q.videoUrl, q.clip),
        answers: normalizeAnswerList(q.answers),
        remarks: normalizeRemarksValue(q.remarks, q.opmerking, q.comment, q.note)
      }));
    }

    if (roundKey === 'finale') {
      normalizedQuestions = configQuestions.map((q) => ({
        ...q,
        question: pickFirstNonEmptyString(q.question, q.text),
        answers: normalizeAnswerList(q.answers),
        remarks: normalizeRemarksValue(q.remarks, q.opmerking, q.comment, q.note)
      })).filter((q) => q.question);
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
    const fileName = String(file?.name || '').toLowerCase();
    const isZip = fileName.endsWith('.zip') || file?.type === 'application/zip' || file?.type === 'application/x-zip-compressed';

    if (isZip) {
      parseConfigFromZip(file)
        .then(config => applyLoadedConfig(config))
        .then(resolve)
        .catch((error) => {
          console.error('Fout bij verwerken van ZIP configuratie:', error);
          reject(error);
        });
      return;
    }

    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target.result);
        const loadedConfig = await applyLoadedConfig(config);
        resolve(loadedConfig);
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

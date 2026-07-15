(function () {
  const threeSixNineList = document.getElementById('threeSixNineList');
  const openDeurList = document.getElementById('openDeurList');
  const puzzelList = document.getElementById('puzzelList');
  const galerijList = document.getElementById('galerijList');
  const collectiefList = document.getElementById('collectiefList');
  const finaleList = document.getElementById('finaleList');
  const prefillPlayersList = document.getElementById('prefillPlayersList');

  const addThreeSixNineBtn = document.getElementById('addThreeSixNineBtn');
  const addOpenDeurBtn = document.getElementById('addOpenDeurBtn');
  const addPuzzelBtn = document.getElementById('addPuzzelBtn');
  const addGalerijBtn = document.getElementById('addGalerijBtn');
  const addCollectiefBtn = document.getElementById('addCollectiefBtn');
  const addFinaleBtn = document.getElementById('addFinaleBtn');

  const downloadBuilderJsonBtn = document.getElementById('downloadBuilderJsonBtn');
  const downloadBuilderZipBtn = document.getElementById('downloadBuilderZipBtn');
  const builderImportInput = document.getElementById('builderImportInput');
  const builderStatus = document.getElementById('builderStatus');
  const introTextOptions = document.getElementById('introTextOptions');
  const presenterPhotoOptions = document.getElementById('presenterPhotoOptions');
  const prefillOptions = document.getElementById('prefillOptions');
  const settingPresenterPhotoPath = document.getElementById('settingPresenterPhotoPath');
  const settingPresenterPhotoUpload = document.getElementById('settingPresenterPhotoUpload');

  let uid = 0;

  function nextId(prefix) {
    uid += 1;
    return `${prefix}-${uid}`;
  }

  function setStatus(message, isError = false) {
    builderStatus.textContent = message;
    builderStatus.style.color = isError ? '#a73333' : '#59685f';
  }

  function todayDate() {
    return new Date().toISOString().split('T')[0];
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'media';
  }

  function normalizePath(value) {
    return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  }

  function splitAnswers(value) {
    return String(value || '')
      .split(/\r?\n|,|;/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  function stringifyAnswers(answers) {
    if (!Array.isArray(answers)) {
      return '';
    }
    return answers.join('\n');
  }

  function getGalerijPhotoCount() {
    return Math.max(1, parseInt(document.getElementById('photoCountGalerij')?.value, 10) || 10);
  }

  function createFixedAnswerGroup(groupLabel, count, values = [], classPrefix) {
    const wrapper = document.createElement('div');
    wrapper.className = 'compact-grid';

    for (let index = 0; index < count; index += 1) {
      const field = createTextField(`${groupLabel} ${index + 1}`, values[index] || '');
      field.input.classList.add(`${classPrefix}-${index + 1}`);
      wrapper.appendChild(field.label);
    }

    return wrapper;
  }

  function readFixedAnswers(item, classPrefix, count, label) {
    const answers = [];

    for (let index = 0; index < count; index += 1) {
      const input = item.querySelector(`.${classPrefix}-${index + 1}`);
      if (!input) {
        throw new Error(`${label}: veld ${index + 1} ontbreekt.`);
      }

      const value = input.value.trim();
      if (!value) {
        throw new Error(`${label}: antwoord ${index + 1} is verplicht.`);
      }

      answers.push(value);
    }

    return answers;
  }

  function getFixedAnswerValues(item, classPrefix, count) {
    return Array.from({ length: count }, (_, index) => {
      const input = item.querySelector(`.${classPrefix}-${index + 1}`);
      return input ? input.value.trim() : '';
    });
  }

  function hasAnyValue(values) {
    return values.some(value => String(value || '').trim() !== '');
  }

  function createGalleryImageItem(imageData = {}, themeSlug = 'thema', imageIndex = 1) {
    const imageItem = document.createElement('div');
    imageItem.className = 'item';

    const title = document.createElement('div');
    title.className = 'item-title';
    const strong = document.createElement('strong');
    strong.textContent = `Galerij foto ${imageIndex}`;
    title.appendChild(strong);

    const answerField = createTextField('Antwoord', imageData.answer || '');
    answerField.input.classList.add('field-galerij-answer');

    const mediaField = createMediaInput(
      'Afbeelding pad',
      imageData.src || '',
      `galerij/${themeSlug}`,
      {
        placeholder: `galerij/${themeSlug}/foto-${imageIndex}`,
        helperText: 'Verplicht voor Galerij: elke foto moet een vast pad hebben zodat dit altijd geladen kan worden.',
        required: true,
        uploadAccept: 'image/*',
        uploadTitle: 'Kies een galerijafbeelding'
      }
    );
    mediaField.pathInput.classList.add('field-galerij-src');

    imageItem.append(title, answerField.label, mediaField.wrapper);
    return imageItem;
  }

  function getGalleryImageValues(themeItem) {
    return Array.from(themeItem.querySelectorAll(':scope .list > .item')).map((imageItem) => ({
      answer: imageItem.querySelector('.field-galerij-answer')?.value?.trim() || '',
      src: imageItem.querySelector('.field-galerij-src')?.value?.trim() || ''
    }));
  }

  function syncGalerijThemeImages(themeItem, sourceImages = []) {
    const imageList = themeItem.querySelector('.field-galerij-images');
    const themeField = themeItem.querySelector('.field-galerij-theme');
    if (!imageList || !themeField) {
      return;
    }

    const targetCount = getGalerijPhotoCount();
    const themeSlug = slugify(themeField.value || 'thema');
    const currentImages = Array.isArray(sourceImages) && sourceImages.length > 0 ? sourceImages : getGalleryImageValues(themeItem);

    imageList.innerHTML = '';
    for (let index = 0; index < targetCount; index += 1) {
      imageList.appendChild(createGalleryImageItem(currentImages[index] || {}, themeSlug, index + 1));
    }
  }

  function syncAllGalerijThemes() {
    galerijList.querySelectorAll(':scope > .item').forEach((themeItem) => {
      syncGalerijThemeImages(themeItem);
    });
  }

  function updatePrefillVisibility() {
    const enabled = !!document.getElementById('prefillPlayersEnabled')?.checked;
    if (prefillOptions) {
      prefillOptions.style.display = enabled ? '' : 'none';
    }

    if (!enabled) {
      return;
    }

    const playerCount = Math.max(1, Math.min(3, parseInt(document.getElementById('prefillPlayerCount')?.value, 10) || 3));
    const questionsPerRoundField = document.getElementById('prefillQuestionsPerRound');
    const questionsPerRoundLabel = questionsPerRoundField?.closest('label');

    if (questionsPerRoundLabel) {
      questionsPerRoundLabel.style.display = playerCount === 1 ? '' : 'none';
    }

    prefillPlayersList.querySelectorAll('.prefill-player-item').forEach((item, index) => {
      item.style.display = index < playerCount ? '' : 'none';
    });
  }

  function updateSettingsVisibility() {
    if (introTextOptions) {
      introTextOptions.style.display = document.getElementById('settingIntroEnabled')?.checked ? '' : 'none';
    }

    if (presenterPhotoOptions) {
      presenterPhotoOptions.style.display = document.getElementById('settingPresenterEnabled')?.checked ? '' : 'none';
    }

    updatePrefillVisibility();
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function clearImportedMediaInputs() {
    document.querySelectorAll('input[type="file"][data-path-input-id]').forEach((fileInput) => {
      fileInput.value = '';
    });
  }

  function setCheckboxValue(id, value) {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked = !!value;
    }
  }

  function setFileInputFiles(fileInput, files) {
    if (!fileInput || !Array.isArray(files) || files.length === 0) {
      return false;
    }

    if (typeof DataTransfer === 'undefined') {
      return false;
    }

    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));

    try {
      fileInput.files = dataTransfer.files;
      return true;
    } catch (error) {
      return false;
    }
  }

  function findZipEntryByTargetPath(zip, targetPath) {
    const normalized = normalizePath(targetPath);
    if (!normalized) {
      return null;
    }

    const exact = zip.file(normalized);
    if (exact) {
      return exact;
    }

    const matches = zip.file(new RegExp(`(^|/)${escapeRegExp(normalized)}$`, 'i'));
    return Array.isArray(matches) && matches.length > 0 ? matches[0] : null;
  }

  async function hydrateMediaInputsFromZip(zip) {
    const importedFiles = new Map();

    const fileInputs = Array.from(document.querySelectorAll('input[type="file"][data-path-input-id]'));
    for (const fileInput of fileInputs) {
      const pathInput = document.getElementById(fileInput.dataset.pathInputId);
      const targetPath = normalizePath(pathInput?.value || '');
      if (!targetPath) {
        continue;
      }

      const zipEntry = findZipEntryByTargetPath(zip, targetPath);
      if (!zipEntry) {
        continue;
      }

      const blob = await zipEntry.async('blob');
      const fileName = targetPath.split('/').pop() || zipEntry.name.split('/').pop() || 'media';
      const file = new File([blob], fileName, {
        type: blob.type || 'application/octet-stream',
        lastModified: Date.now()
      });

      if (setFileInputFiles(fileInput, [file])) {
        importedFiles.set(targetPath, file);
      }
    }

    return importedFiles;
  }

  function renumberItemShells(list) {
    list.querySelectorAll(':scope > .item[data-title-base]').forEach((item, index) => {
      const title = item.querySelector('.item-title strong');
      const baseLabel = item.dataset.titleBase || '';

      if (title && baseLabel) {
        title.textContent = `${baseLabel} #${index + 1}`;
      }
    });
  }

  function createItemShell(list, titleText, options = {}) {
    const { indexed = false } = options;
    const item = document.createElement('article');
    item.className = 'item';

    const title = document.createElement('div');
    title.className = 'item-title';

    const strong = document.createElement('strong');
    strong.textContent = titleText;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'secondary remove';
    removeBtn.type = 'button';
    removeBtn.textContent = 'Verwijder';
    removeBtn.addEventListener('click', () => {
      item.remove();
      if (indexed) {
        renumberItemShells(list);
      }
    });

    title.appendChild(strong);
    title.appendChild(removeBtn);

    if (indexed) {
      item.dataset.titleBase = titleText;
    }

    item.appendChild(title);
    list.appendChild(item);

    if (indexed) {
      renumberItemShells(list);
    }

    return item;
  }

  function createTextField(labelText, defaultValue = '', placeholder = '') {
    const label = document.createElement('label');
    label.textContent = labelText;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.placeholder = placeholder;

    label.appendChild(input);
    return { label, input };
  }

  function createTextAreaField(labelText, defaultValue = '', placeholder = '') {
    const label = document.createElement('label');
    label.textContent = labelText;

    const textarea = document.createElement('textarea');
    textarea.value = defaultValue;
    textarea.placeholder = placeholder;

    label.appendChild(textarea);
    return { label, textarea };
  }

  function createMediaInput(labelText, defaultPath = '', autoPrefix = 'media', options = {}) {
    const {
      placeholder = `${autoPrefix}/bestandsnaam`,
      helperText = 'Voeg een media-pad toe als dit veld media gebruikt.',
      required = false,
      uploadAccept = '',
      uploadTitle = 'Selecteer bestand'
    } = options;

    const wrapper = document.createElement('div');

    const pathField = createTextField(labelText, defaultPath, placeholder);
    pathField.input.id = nextId('media-path');
    pathField.input.required = required;

    const mediaRow = document.createElement('div');
    mediaRow.className = 'media-row';

    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.dataset.pathInputId = pathField.input.id;
    if (uploadAccept) {
      uploadInput.accept = uploadAccept;
    }
    uploadInput.title = uploadTitle;

    const helper = document.createElement('p');
    helper.className = 'helper';
    helper.textContent = helperText;

    uploadInput.addEventListener('change', () => {
      const file = uploadInput.files && uploadInput.files[0];
      if (!file) {
        return;
      }

      const safeName = file.name.replace(/\s+/g, '_');
      pathField.input.value = `${autoPrefix}/${safeName}`;
    });

    mediaRow.appendChild(pathField.label);
    mediaRow.appendChild(uploadInput);

    wrapper.appendChild(mediaRow);
    wrapper.appendChild(helper);

    return { wrapper, pathInput: pathField.input, fileInput: uploadInput, helper };
  }

  function wirePresenterPhotoUpload() {
    if (!settingPresenterPhotoPath || !settingPresenterPhotoUpload) {
      return;
    }

    settingPresenterPhotoUpload.addEventListener('change', () => {
      const file = settingPresenterPhotoUpload.files && settingPresenterPhotoUpload.files[0];
      if (!file) {
        return;
      }

      const safeName = file.name.replace(/\s+/g, '_');
      settingPresenterPhotoPath.value = `media/presenter/${safeName}`;
    });
  }

  function addThreeSixNineItem(data = {}) {
    const item = createItemShell(threeSixNineList, '3-6-9 vraag', { indexed: true });

    const normalizedType = (() => {
      const rawType = data.type || 'classic';
      if (rawType === 'photo' || rawType === 'audio') return 'classic';
      if (rawType === 'photo-multiple-choice') return 'multiple-choice';
      if (rawType === 'multiple-choice' || rawType === 'doe' || rawType === 'estimation') return rawType;
      return 'classic';
    })();

    const questionPhotoUrl = data.questionPhotoUrl || data.photoUrl || '';
    const questionAudioUrl = data.questionAudioUrl || data.audioUrl || '';
    const questionVideoUrl = data.questionVideoUrl || data.videoUrl || data.clip || '';
    const afterPhotoUrl = data.afterPhotoUrl || data.revealPhotoUrl || '';
    const afterAudioUrl = data.afterAudioUrl || data.revealAudioUrl || '';
    const afterVideoUrl = data.afterVideoUrl || data.revealVideoUrl || '';

    const questionField = createTextField('Vraag', data.text || data.question || '');
    questionField.input.classList.add('field-369-question');

    const mediaEnabled = Boolean(
      data.mediaEnabled ||
      data.questionPhotoUrl || data.photoUrl ||
      data.questionAudioUrl || data.audioUrl ||
      data.questionVideoUrl || data.videoUrl || data.clip ||
      data.afterPhotoUrl || data.revealPhotoUrl ||
      data.afterAudioUrl || data.revealAudioUrl ||
      data.afterVideoUrl || data.revealVideoUrl
    );

    const mediaToggleLabel = document.createElement('label');
    mediaToggleLabel.className = 'checkbox-label-align';
    const mediaToggle = document.createElement('input');
    mediaToggle.type = 'checkbox';
    mediaToggle.checked = mediaEnabled;
    mediaToggle.classList.add('field-369-media-enabled');
    mediaToggleLabel.append(mediaToggle, document.createTextNode(' Vraag bevat media'));

    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type';
    const typeSelect = document.createElement('select');
    ['classic', 'multiple-choice', 'doe', 'estimation'].forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      if (normalizedType === type) {
        option.selected = true;
      }
      typeSelect.appendChild(option);
    });
    typeSelect.classList.add('field-369-type');
    typeLabel.appendChild(typeSelect);

    const typeHelp = document.createElement('p');
    typeHelp.className = 'helper type-help field-369-type-help';

    const answersField = createTextAreaField('Antwoorden (1 per regel)', stringifyAnswers(data.answers), 'bijv. Parijs');
    answersField.textarea.classList.add('field-369-answers');

    const mcWrapper = document.createElement('div');
    mcWrapper.className = 'compact-grid';
    const optionA = createTextField('Optie A', data.options?.A || '');
    const optionB = createTextField('Optie B', data.options?.B || '');
    const optionC = createTextField('Optie C', data.options?.C || '');
    const optionD = createTextField('Optie D', data.options?.D || '');
    optionA.input.classList.add('field-369-option-a');
    optionB.input.classList.add('field-369-option-b');
    optionC.input.classList.add('field-369-option-c');
    optionD.input.classList.add('field-369-option-d');

    const correctLabel = document.createElement('label');
    correctLabel.textContent = 'Correct antwoord';
    const correctSelect = document.createElement('select');
    ['A', 'B', 'C', 'D'].forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      if ((data.correctAnswer || 'A') === key) {
        option.selected = true;
      }
      correctSelect.appendChild(option);
    });
    correctSelect.classList.add('field-369-correct');
    correctLabel.appendChild(correctSelect);

    mcWrapper.append(optionA.label, optionB.label, optionC.label, optionD.label, correctLabel);

    const questionPhotoField = createMediaInput(
      'Vraag: foto pad',
      questionPhotoUrl,
      'media/369',
      {
        placeholder: 'media/369/vraag-foto',
        helperText: 'Optioneel: foto die je tijdens de vraag kan tonen.',
        uploadAccept: 'image/*',
        uploadTitle: 'Kies een vraagfoto'
      }
    );
    questionPhotoField.pathInput.classList.add('field-369-question-photo');

    const questionAudioField = createMediaInput(
      'Vraag: audio pad',
      questionAudioUrl,
      'media/369',
      {
        placeholder: 'media/369/vraag-audio',
        helperText: 'Optioneel: audiofragment dat je tijdens de vraag kan afspelen.',
        uploadAccept: 'audio/*',
        uploadTitle: 'Kies een vraagaudio'
      }
    );
    questionAudioField.pathInput.classList.add('field-369-question-audio');

    const questionVideoField = createMediaInput(
      'Vraag: video pad',
      questionVideoUrl,
      'media/369',
      {
        placeholder: 'media/369/vraag-video',
        helperText: 'Optioneel: videofragment dat je tijdens de vraag kan afspelen.',
        uploadAccept: 'video/*',
        uploadTitle: 'Kies een vraagvideo'
      }
    );
    questionVideoField.pathInput.classList.add('field-369-question-video');

    const afterPhotoField = createMediaInput(
      'Na vraag: foto pad',
      afterPhotoUrl,
      'media/369',
      {
        placeholder: 'media/369/na-vraag-foto',
        helperText: 'Optioneel: extra foto die je na de vraag kan tonen.',
        uploadAccept: 'image/*',
        uploadTitle: 'Kies een na-vraagfoto'
      }
    );
    afterPhotoField.pathInput.classList.add('field-369-after-photo');

    const afterAudioField = createMediaInput(
      'Na vraag: audio pad',
      afterAudioUrl,
      'media/369',
      {
        placeholder: 'media/369/na-vraag-audio',
        helperText: 'Optioneel: extra audiofragment na de vraag.',
        uploadAccept: 'audio/*',
        uploadTitle: 'Kies een na-vraagaudio'
      }
    );
    afterAudioField.pathInput.classList.add('field-369-after-audio');

    const afterVideoField = createMediaInput(
      'Na vraag: video pad',
      afterVideoUrl,
      'media/369',
      {
        placeholder: 'media/369/na-vraag-video',
        helperText: 'Optioneel: extra fullscreen video na de vraag.',
        uploadAccept: 'video/*',
        uploadTitle: 'Kies een na-vraagvideo'
      }
    );
    afterVideoField.pathInput.classList.add('field-369-after-video');

    const questionMediaGroup = document.createElement('div');
    questionMediaGroup.className = 'compact-grid';
    questionMediaGroup.append(questionPhotoField.wrapper, questionAudioField.wrapper, questionVideoField.wrapper);

    const afterMediaGroup = document.createElement('div');
    afterMediaGroup.className = 'compact-grid';
    afterMediaGroup.append(afterPhotoField.wrapper, afterAudioField.wrapper, afterVideoField.wrapper);

    const doeDescriptionField = createTextField('Omschrijving (voor type doe)', data.description || '');
    const estimationAnswerField = createTextField('Schatting correct antwoord', data.correctAnswer || '');
    const estimationUnitField = createTextField('Schatting eenheid', data.unit || '');
    doeDescriptionField.input.classList.add('field-369-doe-description');
    estimationAnswerField.input.classList.add('field-369-estimation-answer');
    estimationUnitField.input.classList.add('field-369-estimation-unit');

    const advancedWrapper = document.createElement('div');
    advancedWrapper.className = 'compact-grid';
    advancedWrapper.append(doeDescriptionField.label, estimationAnswerField.label, estimationUnitField.label);

    function updateMediaVisibility() {
      const showMedia = mediaToggle.checked;
      questionMediaGroup.style.display = showMedia ? 'grid' : 'none';
      afterMediaGroup.style.display = showMedia ? 'grid' : 'none';
    }

    function updateByType() {
      const type = typeSelect.value;
      mcWrapper.style.display = type === 'multiple-choice' ? 'grid' : 'none';
      doeDescriptionField.label.style.display = type === 'doe' ? 'grid' : 'none';
      estimationAnswerField.label.style.display = type === 'estimation' ? 'grid' : 'none';
      estimationUnitField.label.style.display = type === 'estimation' ? 'grid' : 'none';

      answersField.label.style.display = type === 'classic' ? 'grid' : 'none';

      const typeDescriptions = {
        classic: 'classic: standaard open vraag.',
        'multiple-choice': 'multiple-choice: gesloten vraag met vier opties (ABCD). Optioneel met foto/audio/video.',
        doe: 'doe: Een doevraag, de kandidaten krijgen een opdracht en er wordt bepaald wie de opdracht het beste heeft uitgevoerd (bijvoorbeeld door een jury of chat).',
        estimation: 'estimation: Schattingsvraag, de kandidaat die het dichtste bij het juiste antwoord zit wint de vraag.'
      };
      typeHelp.textContent = typeDescriptions[type] || '';
      updateMediaVisibility();
    }

    typeSelect.addEventListener('change', updateByType);
    mediaToggle.addEventListener('change', updateMediaVisibility);

    item.append(
      questionField.label,
      mediaToggleLabel,
      typeLabel,
      typeHelp,
      answersField.label,
      mcWrapper,
      questionMediaGroup,
      afterMediaGroup,
      advancedWrapper
    );
    updateByType();
  }

  function addOpenDeurItem(data = {}) {
    const item = createItemShell(openDeurList, 'Open Deur vraag', { indexed: true });

    const fromField = createTextField('Van (vragensteller)', data.from || data.questioner || '');
    const questionField = createTextField('Vraag', data.question || data.text || '');
    const answersField = createFixedAnswerGroup('Antwoord', 4, Array.isArray(data.answers) ? data.answers : splitAnswers(data.answers), 'field-open-answer');
    const mediaField = createMediaInput(
      'Intro video pad',
      data.introVideoUrl || data.videoUrl || data.video || '',
      'media/opendeur',
      {
        placeholder: 'opendeur/intro-video',
        helperText: 'Optioneel voor Open Deur: gebruik een video per vraagsteller (waarin bijvoorbeeld de vraagsteller een vraag stelt).',
        uploadAccept: 'video/*',
        uploadTitle: 'Kies een video'
      }
    );
    fromField.input.classList.add('field-open-from');
    questionField.input.classList.add('field-open-question');
    mediaField.pathInput.classList.add('field-open-video');

    item.append(fromField.label, questionField.label, answersField, mediaField.wrapper);
  }

  function addPuzzelItem(data = {}) {
    const item = createItemShell(puzzelList, 'Puzzel link', { indexed: true });

    const linkField = createTextField('Linkwoord', data.link || '');
    const answersField = createTextAreaField('Antwoorden (1 per regel)', stringifyAnswers(data.answers));
    linkField.input.classList.add('field-puzzel-link');
    answersField.textarea.classList.add('field-puzzel-answers');

    item.append(linkField.label, answersField.label);
  }

  function addGalerijTheme(data = {}) {
    const item = createItemShell(galerijList, 'Galerij thema', { indexed: true });

    const themeField = createTextField('Thema', data.theme || '');
    themeField.input.classList.add('field-galerij-theme');

    const imageList = document.createElement('div');
    imageList.className = 'list field-galerij-images';

    item.append(themeField.label, imageList);
    syncGalerijThemeImages(item, Array.isArray(data.images) ? data.images : []);
  }

  function addCollectiefItem(data = {}) {
    const item = createItemShell(collectiefList, 'Collectief Geheugen vraag', { indexed: true });

    const answersField = createFixedAnswerGroup('Antwoord', 5, Array.isArray(data.answers) ? data.answers : splitAnswers(data.answers), 'field-collectief-answer');
    const mediaField = createMediaInput(
      'Video pad',
      data.video || data.videoUrl || data.clip || '',
      'collectief_geheugen',
      {
        placeholder: 'collectief_geheugen/fragment-1',
        helperText: 'Verplicht voor Collectief Geheugen: elk fragment moet een vast videopad hebben.',
        required: true,
        uploadAccept: 'video/*',
        uploadTitle: 'Kies een collectief-videofragment'
      }
    );
    mediaField.pathInput.classList.add('field-collectief-video');

    item.append(answersField, mediaField.wrapper);
  }

  function addFinaleItem(data = {}) {
    const item = createItemShell(finaleList, 'Finale vraag', { indexed: true });

    const questionField = createTextField('Vraag', data.question || data.text || '');
    const answersField = createFixedAnswerGroup('Antwoord', 5, Array.isArray(data.answers) ? data.answers : splitAnswers(data.answers), 'field-finale-answer');
    questionField.input.classList.add('field-finale-question');

    item.append(questionField.label, answersField);
  }

  function addPrefillPlayerItem(index, data = {}) {
    const item = createItemShell(prefillPlayersList, `Speler ${index + 1}`);
    item.classList.add('prefill-player-item');
    item.dataset.playerIndex = String(index);

    // In deze sectie houden we exact 3 vaste spelers-slots aan; verwijderen verbergt het slot niet.
    const removeBtn = item.querySelector('.remove');
    if (removeBtn) {
      removeBtn.style.display = 'none';
    }

    const nameField = createTextField('Naam', data.name || '', `Kandidaat ${String.fromCharCode(65 + index)}`);
    nameField.input.classList.add('field-prefill-name');

    const defaultPhotoPath = typeof data.photoUrl === 'string' ? data.photoUrl : '';
    const mediaField = createMediaInput(
      'Profielfoto pad',
      defaultPhotoPath,
      'media/players',
      {
        placeholder: 'Foto kandidaat',
        helperText: 'Optioneel: wordt gebruikt om spelers automatisch in te vullen bij het laden van de config.',
        uploadAccept: 'image/*',
        uploadTitle: 'Kies een profielfoto'
      }
    );
    mediaField.pathInput.classList.add('field-prefill-photo');

    item.append(nameField.label, mediaField.wrapper);
  }

  function getMetadata() {
    return {
      name: document.getElementById('metaName')?.value?.trim() || 'Custom Game',
      description: document.getElementById('metaDescription')?.value?.trim() || 'Aangepaste configuratie',
      created: todayDate(),
      author: document.getElementById('metaAuthor')?.value?.trim() || undefined
    };
  }

  function getSettings() {
    const settings = {
      branding: {
        titlePrefix: document.getElementById('brandingPrefix').value.trim() || 'de slimste mens',
        titleSuffix: document.getElementById('brandingSuffix').value.trim() || 'van twitch',
        logoPath: 'assets/slimstemens.png'
      },
      bumpers: {
        enabled: !!document.getElementById('settingBumpersEnabled')?.checked
      },
      safeRoundNavigation: {
        enabled: !!document.getElementById('settingSafeRoundNavigation')?.checked
      },
      game: {
        startSeconds: Math.max(10, parseInt(document.getElementById('settingStartSeconds')?.value, 10) || 60)
      },
      presenter: {
        enabled: !!document.getElementById('settingPresenterEnabled')?.checked
      },
      jury: {
        enabled: !!document.getElementById('settingJuryEnabled')?.checked
      },
      intro: {
        enabled: !!document.getElementById('settingIntroEnabled')?.checked,
        text: document.getElementById('settingIntroText')?.value?.trim() || ''
      },
      outro: {
        enabled: !!document.getElementById('settingIntroEnabled')?.checked
      },
      threeSixNine: {
        shuffle: !!document.getElementById('shuffle369').checked,
        maxQuestions: Math.max(1, parseInt(document.getElementById('maxQuestions369').value, 10) || 12)
      },
      opendeur: {
        shuffle: !!document.getElementById('shuffleOpenDeur').checked
      },
      puzzel: {
        shuffle: !!document.getElementById('shufflePuzzel').checked
      },
      galerij: {
        shuffle: !!document.getElementById('shuffleGalerij').checked,
        photoCount: Math.max(1, parseInt(document.getElementById('photoCountGalerij').value, 10) || 10),
        manualAssignment: !!document.getElementById('manualAssignmentGalerij').checked
      },
      collectief: {
        shuffle: !!document.getElementById('shuffleCollectief').checked,
        endOption: document.getElementById('settingCollectiefEndOption')?.value || 'lowestOut'
      },
      finale: {
        shuffle: !!document.getElementById('shuffleFinale').checked
      }
    };

    const presenterPhotoPath = settingPresenterPhotoPath?.value?.trim() || '';
    if (presenterPhotoPath) {
      settings.presenter.photoUrl = normalizePath(presenterPhotoPath);
    }

    if (!settings.intro.text) {
      delete settings.intro.text;
    }

    const playerMode = buildPlayerModeSettings();
    if (playerMode) {
      settings.playerMode = playerMode;
    }

    return settings;
  }

  function buildPlayerModeSettings() {
    const enabled = !!document.getElementById('prefillPlayersEnabled')?.checked;
    if (!enabled) {
      return null;
    }

    const playerCount = Math.max(1, Math.min(3, parseInt(document.getElementById('prefillPlayerCount')?.value, 10) || 3));
    const questionsPerRound = Math.max(1, parseInt(document.getElementById('prefillQuestionsPerRound')?.value, 10) || 1);

    const playerSlots = [];
    prefillPlayersList.querySelectorAll('.prefill-player-item').forEach((item, listIndex) => {
      if (listIndex >= playerCount) {
        return;
      }

      const name = item.querySelector('.field-prefill-name')?.value?.trim() || undefined;
      const photoPathRaw = item.querySelector('.field-prefill-photo')?.value?.trim() || '';
      const photoUrl = photoPathRaw ? normalizePath(photoPathRaw) : undefined;

      playerSlots.push({
        name,
        photoUrl
      });
    });

    return {
      playerCount,
      questionsPerRound,
      players: playerSlots
    };
  }

  function buildThreeSixNine() {
    const items = [];
    threeSixNineList.querySelectorAll('.item').forEach((item, index) => {
      const question = item.querySelector('.field-369-question')?.value?.trim() || '';
      const type = item.querySelector('.field-369-type')?.value || 'classic';
      if (!question) {
        return;
      }

      const q = { text: question, type };

      if (type === 'multiple-choice') {
        const options = {
          A: item.querySelector('.field-369-option-a')?.value?.trim() || '',
          B: item.querySelector('.field-369-option-b')?.value?.trim() || '',
          C: item.querySelector('.field-369-option-c')?.value?.trim() || '',
          D: item.querySelector('.field-369-option-d')?.value?.trim() || ''
        };
        q.options = options;
        q.correctAnswer = item.querySelector('.field-369-correct')?.value || 'A';
      }

      if (type === 'classic') {
        q.answers = splitAnswers(item.querySelector('.field-369-answers')?.value || '');
      }

      const questionPhotoPath = item.querySelector('.field-369-question-photo')?.value?.trim() || '';
      const questionAudioPath = item.querySelector('.field-369-question-audio')?.value?.trim() || '';
      const questionVideoPath = item.querySelector('.field-369-question-video')?.value?.trim() || '';
      const afterPhotoPath = item.querySelector('.field-369-after-photo')?.value?.trim() || '';
      const afterAudioPath = item.querySelector('.field-369-after-audio')?.value?.trim() || '';
      const afterVideoPath = item.querySelector('.field-369-after-video')?.value?.trim() || '';

      if (questionPhotoPath) q.questionPhotoUrl = normalizePath(questionPhotoPath);
      if (questionAudioPath) q.questionAudioUrl = normalizePath(questionAudioPath);
      if (questionVideoPath) q.questionVideoUrl = normalizePath(questionVideoPath);
      if (afterPhotoPath) q.afterPhotoUrl = normalizePath(afterPhotoPath);
      if (afterAudioPath) q.afterAudioUrl = normalizePath(afterAudioPath);
      if (afterVideoPath) q.afterVideoUrl = normalizePath(afterVideoPath);

      // Backward compatibility velden voor oudere spelversies.
      if (q.questionPhotoUrl) q.photoUrl = q.questionPhotoUrl;
      if (q.questionAudioUrl) q.audioUrl = q.questionAudioUrl;
      if (q.questionVideoUrl) q.videoUrl = q.questionVideoUrl;

      const doeDescription = item.querySelector('.field-369-doe-description')?.value?.trim();
      const estimationAnswer = item.querySelector('.field-369-estimation-answer')?.value?.trim();
      const estimationUnit = item.querySelector('.field-369-estimation-unit')?.value?.trim();

      if (type === 'doe' && doeDescription) {
        q.description = doeDescription;
      }

      if (type === 'estimation') {
        if (estimationAnswer) {
          q.correctAnswer = estimationAnswer;
        }
        if (estimationUnit) {
          q.unit = estimationUnit;
        }
      }

      items.push(q);
    });

    return items;
  }

  function buildOpenDeur() {
    const items = [];
    openDeurList.querySelectorAll('.item').forEach((item) => {
      const from = item.querySelector('.field-open-from')?.value?.trim() || '';
      const question = item.querySelector('.field-open-question')?.value?.trim() || '';
      const answerValues = getFixedAnswerValues(item, 'field-open-answer', 4);
      const introVideo = item.querySelector('.field-open-video')?.value?.trim() || '';

      if (!from && !question && !introVideo && !hasAnyValue(answerValues)) {
        return;
      }

      if (!question) {
        throw new Error('Open Deur: vraagtekst is verplicht zodra dit item wordt gebruikt.');
      }

      const entry = {
        from: from || undefined,
        question,
        answers: readFixedAnswers(item, 'field-open-answer', 4, 'Open Deur')
      };

      if (introVideo) {
        entry.introVideoUrl = normalizePath(introVideo);
      }

      items.push(entry);
    });

    return items;
  }

  function buildPuzzel() {
    const items = [];
    puzzelList.querySelectorAll('.item').forEach((item) => {
      const link = item.querySelector('.field-puzzel-link')?.value?.trim() || '';
      if (!link) {
        return;
      }

      const answers = splitAnswers(item.querySelector('.field-puzzel-answers')?.value || '');
      items.push({ link, answers });
    });

    return items;
  }

  function buildGalerij() {
    const themes = [];
    const targetCount = getGalerijPhotoCount();

    galerijList.querySelectorAll(':scope > .item').forEach((themeItem, themeIndex) => {
      const theme = themeItem.querySelector('.field-galerij-theme')?.value?.trim() || 'Galerij';
      const images = [];
      const imageItems = themeItem.querySelectorAll(':scope .list > .item');

      if (imageItems.length !== targetCount) {
        throw new Error(`Galerij "${theme || `#${themeIndex + 1}`}": verwacht ${targetCount} foto('s), maar vond ${imageItems.length}.`);
      }

      imageItems.forEach((imgItem, imageIndex) => {
        const answer = imgItem.querySelector('.field-galerij-answer')?.value?.trim() || '';
        const src = imgItem.querySelector('.field-galerij-src')?.value?.trim() || '';

        if (!answer && !src) {
          return;
        }

        if (!src) {
          throw new Error(`Galerij \"${theme || `#${themeIndex + 1}`}\" foto ${imageIndex + 1}: afbeelding-pad is verplicht.`);
        }

        images.push({
          src: normalizePath(src),
          answer: answer || 'Onbekend'
        });
      });

      if (images.length > 0) {
        themes.push({ theme, images });
      }
    });

    return themes;
  }

  function buildCollectief() {
    const items = [];
    collectiefList.querySelectorAll('.item').forEach((item, index) => {
      const video = item.querySelector('.field-collectief-video')?.value?.trim() || '';
      const answerValues = getFixedAnswerValues(item, 'field-collectief-answer', 5);

      if (!video && !hasAnyValue(answerValues)) {
        return;
      }

      if (!video) {
        throw new Error(`Collectief fragment ${index + 1}: video-pad is verplicht.`);
      }

      const answers = readFixedAnswers(item, 'field-collectief-answer', 5, 'Collectief Geheugen');

      const entry = {
        video: video ? normalizePath(video) : undefined,
        answers
      };

      items.push(entry);
    });

    return items;
  }

  function buildFinale() {
    const items = [];
    finaleList.querySelectorAll('.item').forEach((item) => {
      const question = item.querySelector('.field-finale-question')?.value?.trim() || '';
      if (!question) {
        return;
      }

      items.push({
        question,
        answers: readFixedAnswers(item, 'field-finale-answer', 5, 'Finale')
      });
    });

    return items;
  }

  function buildConfig() {
    const metadata = getMetadata();
    const settings = getSettings();

    if (!metadata.author) {
      delete metadata.author;
    }

    return {
      metadata,
      settings,
      threeSixNine: buildThreeSixNine(),
      opendeur: buildOpenDeur(),
      puzzel: buildPuzzel(),
      galerij: buildGalerij(),
      collectief: buildCollectief(),
      finale: buildFinale()
    };
  }

  function collectMediaFilesForZip() {
    const entries = [];
    document.querySelectorAll('input[type="file"][data-path-input-id]').forEach((fileInput) => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        return;
      }

      const pathInput = document.getElementById(fileInput.dataset.pathInputId);
      const targetPath = normalizePath(pathInput?.value || '');
      if (!targetPath) {
        return;
      }

      entries.push({ file, targetPath });
    });

    return entries;
  }

  function withUniquePaths(entries) {
    const used = new Set();

    return entries.map((entry) => {
      let targetPath = entry.targetPath;
      let counter = 1;

      while (used.has(targetPath.toLowerCase())) {
        const dotIndex = targetPath.lastIndexOf('.');
        if (dotIndex === -1) {
          targetPath = `${entry.targetPath}_${counter}`;
        } else {
          const base = entry.targetPath.slice(0, dotIndex);
          const ext = entry.targetPath.slice(dotIndex);
          targetPath = `${base}_${counter}${ext}`;
        }
        counter += 1;
      }

      used.add(targetPath.toLowerCase());
      return { ...entry, targetPath };
    });
  }

  function importConfig(config) {
    if (document.getElementById('metaName')) document.getElementById('metaName').value = config?.metadata?.name || 'Mijn custom game';
    if (document.getElementById('metaAuthor')) document.getElementById('metaAuthor').value = config?.metadata?.author || '';
    if (document.getElementById('metaDescription')) document.getElementById('metaDescription').value = config?.metadata?.description || '';

    document.getElementById('brandingPrefix').value = config?.settings?.branding?.titlePrefix || 'de slimste mens';
    document.getElementById('brandingSuffix').value = config?.settings?.branding?.titleSuffix || 'van twitch';

    setCheckboxValue('settingBumpersEnabled', config?.settings?.bumpers?.enabled !== false);
    setCheckboxValue('settingSafeRoundNavigation', !!config?.settings?.safeRoundNavigation?.enabled);
    const startSecondsInput = document.getElementById('settingStartSeconds');
    if (startSecondsInput) {
      startSecondsInput.value = config?.settings?.game?.startSeconds || 60;
    }
    setCheckboxValue('settingPresenterEnabled', !!config?.settings?.presenter?.enabled);
    setCheckboxValue('settingJuryEnabled', !!config?.settings?.jury?.enabled);
    const combinedIntroOutroEnabled = !!config?.settings?.intro?.enabled || !!config?.settings?.outro?.enabled;
    setCheckboxValue('settingIntroEnabled', combinedIntroOutroEnabled);
    const introTextInput = document.getElementById('settingIntroText');
    if (introTextInput) {
      introTextInput.value = config?.settings?.intro?.text || '';
    }
    const collectiefEndOption = document.getElementById('settingCollectiefEndOption');
    if (collectiefEndOption) {
      collectiefEndOption.value = config?.settings?.collectief?.endOption || 'lowestOut';
    }
    if (settingPresenterPhotoPath) {
      settingPresenterPhotoPath.value = config?.settings?.presenter?.photoUrl || config?.settings?.presenter?.photoData || '';
    }

    setCheckboxValue('shuffle369', config?.settings?.threeSixNine?.shuffle !== false);
    setCheckboxValue('shuffleOpenDeur', config?.settings?.opendeur?.shuffle !== false);
    setCheckboxValue('shufflePuzzel', config?.settings?.puzzel?.shuffle !== false);
    setCheckboxValue('shuffleGalerij', config?.settings?.galerij?.shuffle !== false);
    setCheckboxValue('shuffleCollectief', config?.settings?.collectief?.shuffle !== false);
    setCheckboxValue('shuffleFinale', config?.settings?.finale?.shuffle !== false);

    const maxQuestionsInput = document.getElementById('maxQuestions369');
    if (maxQuestionsInput) {
      maxQuestionsInput.value = config?.settings?.threeSixNine?.maxQuestions || 12;
    }
    const photoCountInput = document.getElementById('photoCountGalerij');
    if (photoCountInput) {
      photoCountInput.value = config?.settings?.galerij?.photoCount || 10;
    }
    setCheckboxValue('manualAssignmentGalerij', !!config?.settings?.galerij?.manualAssignment);

    const importedPlayerMode = config?.settings?.playerMode || {};
    const importedPlayers = Array.isArray(importedPlayerMode.players) ? importedPlayerMode.players : [];
    setCheckboxValue('prefillPlayersEnabled', !!config?.settings?.playerMode);
    const prefillPlayerCountInput = document.getElementById('prefillPlayerCount');
    if (prefillPlayerCountInput) {
      prefillPlayerCountInput.value = String(importedPlayerMode.playerCount || 3);
    }
    const prefillQuestionsPerRoundInput = document.getElementById('prefillQuestionsPerRound');
    if (prefillQuestionsPerRoundInput) {
      prefillQuestionsPerRoundInput.value = String(importedPlayerMode.questionsPerRound || 1);
    }

    prefillPlayersList.innerHTML = '';
    for (let i = 0; i < 3; i += 1) {
      addPrefillPlayerItem(i, importedPlayers[i] || {});
    }

    threeSixNineList.innerHTML = '';
    openDeurList.innerHTML = '';
    puzzelList.innerHTML = '';
    galerijList.innerHTML = '';
    collectiefList.innerHTML = '';
    finaleList.innerHTML = '';

    (config?.threeSixNine || []).forEach(addThreeSixNineItem);
    (config?.opendeur || []).forEach(addOpenDeurItem);
    (config?.puzzel || []).forEach(addPuzzelItem);
    (config?.galerij || []).forEach(addGalerijTheme);
    (config?.collectief || []).forEach(addCollectiefItem);
    (config?.finale || []).forEach(addFinaleItem);

    if (threeSixNineList.children.length === 0) addThreeSixNineItem();
    if (openDeurList.children.length === 0) addOpenDeurItem();
    if (puzzelList.children.length === 0) addPuzzelItem();
    if (galerijList.children.length === 0) addGalerijTheme();
    if (collectiefList.children.length === 0) addCollectiefItem();
    if (finaleList.children.length === 0) addFinaleItem();

    syncAllGalerijThemes();
    updateSettingsVisibility();

    setStatus('Config geimporteerd.');
  }

  addThreeSixNineBtn.addEventListener('click', () => addThreeSixNineItem());
  addOpenDeurBtn.addEventListener('click', () => addOpenDeurItem());
  addPuzzelBtn.addEventListener('click', () => addPuzzelItem());
  addGalerijBtn.addEventListener('click', () => addGalerijTheme());
  addCollectiefBtn.addEventListener('click', () => addCollectiefItem());
  addFinaleBtn.addEventListener('click', () => addFinaleItem());

  document.getElementById('photoCountGalerij')?.addEventListener('change', syncAllGalerijThemes);
  document.getElementById('settingIntroEnabled')?.addEventListener('change', updateSettingsVisibility);
  document.getElementById('settingPresenterEnabled')?.addEventListener('change', updateSettingsVisibility);
  document.getElementById('prefillPlayersEnabled')?.addEventListener('change', updateSettingsVisibility);
  document.getElementById('prefillPlayerCount')?.addEventListener('change', updateSettingsVisibility);

  downloadBuilderJsonBtn.addEventListener('click', () => {
    try {
      const config = buildConfig();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const safeName = slugify(config.metadata.name || 'custom-game');
      downloadBlob(blob, `${safeName}.json`);
      setStatus('JSON gedownload.');
    } catch (error) {
      setStatus(`Fout bij exporteren: ${error.message}`, true);
    }
  });

  downloadBuilderZipBtn.addEventListener('click', async () => {
    try {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip ontbreekt.');
      }

      const config = buildConfig();
      const zip = new JSZip();
      zip.file('game-config.json', JSON.stringify(config, null, 2));

      const mediaFiles = withUniquePaths(collectMediaFilesForZip());
      mediaFiles.forEach(({ file, targetPath }) => {
        zip.file(targetPath, file);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const safeName = slugify(config.metadata.name || 'custom-game');
      downloadBlob(blob, `${safeName}.zip`);

      setStatus(`ZIP gedownload met ${mediaFiles.length} mediabestand(en).`);
    } catch (error) {
      setStatus(`Fout bij ZIP export: ${error.message}`, true);
    }
  });

  builderImportInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      clearImportedMediaInputs();

      if (file.name.toLowerCase().endsWith('.zip') || /zip/i.test(file.type)) {
        if (typeof JSZip === 'undefined') {
          throw new Error('JSZip ontbreekt.');
        }

        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const configEntry = zip.file(/(^|\/)game-config\.json$/i)?.[0] || zip.file('game-config.json');
        if (!configEntry) {
          throw new Error('ZIP bevat geen game-config.json.');
        }

        const raw = await configEntry.async('string');
        const config = JSON.parse(raw);
        importConfig(config);
        await hydrateMediaInputsFromZip(zip);
        setStatus('ZIP geimporteerd, inclusief media.');
      } else {
        const raw = await file.text();
        const config = JSON.parse(raw);
        importConfig(config);
      }
    } catch (error) {
      setStatus(`Import mislukt: ${error.message}`, true);
    }
  });

  addThreeSixNineItem();
  addOpenDeurItem();
  addPuzzelItem();
  addGalerijTheme();
  addCollectiefItem();
  addFinaleItem();
  wirePresenterPhotoUpload();
  for (let i = 0; i < 3; i += 1) {
    addPrefillPlayerItem(i);
  }
  syncAllGalerijThemes();
  updateSettingsVisibility();
})();

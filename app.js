/* HNJ issuance scene. No dependencies or network requests; browser-local storage only.
   Observe issuance with `investigator:issued`; enter the next scene with `investigation:enter`. */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const scene = $('#issuance-scene');
  const form = $('#id-form');
  const nameInput = $('#investigator-name');
  const codeName = $('#code-name');
  const statusText = $('#status-text');
  const photoButton = $('#photo-button');
  const photoFrame = $('#photo-frame');
  const photoToolbar = $('#photo-toolbar');
  const photoZoom = $('#photo-zoom');
  const zoomOut = $('#photo-zoom-out');
  const zoomIn = $('#photo-zoom-in');
  const photoInput = $('#photo-input');
  const portrait = $('#portrait-image');
  const issueButton = $('#issue-button');
  const enterButton = $('#enter-button');
  const resetButton = $('#reset-button');
  const caption = $('#action-caption');
  const message = $('#form-message');
  const soundButton = $('#sound-button');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const defaultCaption = caption.textContent;
  const defaultButton = issueButton.innerHTML;
  const storageKey = 'hnj-investigator-sound';
  let audioContext;
  let soundEnabled = true;
  let photoUrl = null;
  let photoFile = null;
  let photoSize = null;
  let photoFraming = { zoom: 1, x: .5, y: .42 };
  let photoDrag = null;
  let photoRevision = 0;
  let soundAt = 0;
  let compositionActive = false;
  let issuedCard = null;

  // The whole issued record (including the optional photo Blob) stays in this browser.
  // IndexedDB avoids the small string-storage quota for photos up to 15MB.
  const database = new Promise((resolve) => {
    try {
      const request = indexedDB.open('hnj-investigator-id', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('cards');
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });

  async function storedCard(mode, value) {
    const db = await database;
    if (!db) return null; // Restricted storage still permits issuance in memory.
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction('cards', mode);
        const store = transaction.objectStore('cards');
        const request = mode === 'readonly' ? store.get('issued')
          : value ? store.put(value, 'issued') : store.delete('issued');
        transaction.oncomplete = () => resolve(request.result ?? null);
        transaction.onerror = transaction.onabort = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  try { soundEnabled = localStorage.getItem(storageKey) !== 'off'; } catch { /* File and private modes can disable storage. */ }

  function updateSoundButton() {
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.setAttribute('aria-label', soundEnabled ? '효과음 끄기' : '효과음 켜기');
    $('#sound-label').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  }

  function getAudio() {
    if (!soundEnabled) return null;
    try {
      const AudioAPI = window.AudioContext || window.webkitAudioContext;
      if (!AudioAPI) return null;
      audioContext ||= new AudioAPI();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return audioContext;
    } catch { return null; }
  }

  // Short, low-volume synthesized mechanics. No sound asset downloads needed.
  function noiseBurst(context, time, duration, volume, frequency, type = 'highpass') {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.value = frequency;
    envelope.gain.setValueAtTime(volume, time);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter).connect(envelope).connect(context.destination);
    source.start(time);
    source.stop(time + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  function playKey() {
    const now = performance.now();
    if (now - soundAt < 38) return;
    soundAt = now;
    const audio = getAudio();
    if (!audio) return;
    noiseBurst(audio, audio.currentTime, .025, .045, 1700 + Math.random() * 1100);
    noiseBurst(audio, audio.currentTime + .018, .018, .018, 800, 'bandpass');
  }

  function playStamp() {
    const audio = getAudio();
    if (!audio) return;
    const time = audio.currentTime;
    noiseBurst(audio, time, .11, .23, 1050, 'lowpass');
    noiseBurst(audio, time + .015, .045, .08, 2500, 'bandpass');
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(140, time);
    oscillator.frequency.exponentialRampToValueAtTime(45, time + .11);
    envelope.gain.setValueAtTime(.15, time);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + .16);
    oscillator.connect(envelope).connect(audio.destination);
    oscillator.start(time);
    oscillator.stop(time + .16);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  function notify(text = '') { message.textContent = text; }

  function makeSerial() {
    const random = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(random);
    else random[0] = Math.floor(Math.random() * 4294967296);
    return `HNJ — ${String(random[0] % 1000000).padStart(6, '0')}`;
  }

  function makeCodeName() {
    return `AGENT H-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
  }

  function drawBarcode(serial) {
    const barcode = $('#barcode');
    barcode.replaceChildren();
    let seed = [...serial].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) >>> 0;
    for (let i = 0; i < 33; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const bar = document.createElement('i');
      bar.style.width = `${1 + seed % 3}px`;
      barcode.append(bar);
    }
  }

  function setSerial(value) {
    $('#serial-number').textContent = value;
    drawBarcode(value);
  }

  function fitText(input) {
    const base = 21;
    input.style.fontSize = `${base}px`;
    // Long names and nicknames stay on the printed line.
    let size = base;
    while (input.scrollWidth > input.clientWidth + 1 && size > 12) {
      input.style.fontSize = `${--size}px`;
    }
  }

  [nameInput].forEach((input) => {
    input.addEventListener('compositionstart', () => { compositionActive = true; });
    input.addEventListener('compositionend', () => { compositionActive = false; fitText(input); });
    input.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Process' || event.keyCode === 229) playKey();
      // Enter moves to the issue control; issuance remains an explicit action.
      if (event.key === 'Enter' && !event.isComposing && !compositionActive && event.keyCode !== 229) {
        event.preventDefault();
        issueButton.focus();
      }
    });
    input.addEventListener('input', (event) => {
      input.parentElement.classList.remove('invalid');
      input.removeAttribute('aria-invalid');
      notify();
      fitText(input);
      if (event.inputType === 'insertText' && !event.isComposing) playKey();
    });
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;

  function photoGeometry(zoom = photoFraming.zoom) {
    if (!photoSize || !photoFrame.clientWidth || !photoFrame.clientHeight) return null;
    const frameWidth = photoFrame.clientWidth;
    const frameHeight = photoFrame.clientHeight;
    const cover = Math.max(frameWidth / photoSize.width, frameHeight / photoSize.height);
    const contain = Math.min(frameWidth / photoSize.width, frameHeight / photoSize.height);
    const minZoom = contain / cover;
    const actualZoom = clamp(zoom, minZoom, 3);
    const width = photoSize.width * cover * actualZoom;
    const height = photoSize.height * cover * actualZoom;
    return { frameWidth, frameHeight, width, height, minZoom, zoom: actualZoom,
      left: (frameWidth - width) * photoFraming.x,
      top: (frameHeight - height) * photoFraming.y };
  }

  function renderPhoto() {
    const geometry = photoGeometry();
    if (!geometry) return;
    photoFraming.zoom = geometry.zoom;
    portrait.style.width = `${geometry.width}px`;
    portrait.style.height = `${geometry.height}px`;
    portrait.style.left = `${geometry.left}px`;
    portrait.style.top = `${geometry.top}px`;
    photoZoom.value = String((geometry.zoom - geometry.minZoom) / (3 - geometry.minZoom) * 100);
    photoZoom.setAttribute('aria-valuetext', `${Math.round(geometry.zoom * 100)}%`);
  }

  function canEditPhoto() { return scene.dataset.state === 'editing' && !!photoSize; }

  function finishPhotoDrag() {
    const pointerId = photoDrag?.id;
    photoDrag = null;
    photoFrame.classList.remove('is-dragging');
    if (pointerId !== undefined && photoFrame.hasPointerCapture(pointerId)) photoFrame.releasePointerCapture(pointerId);
  }

  function setPhotoEditable(enabled) {
    photoButton.disabled = !enabled;
    photoFrame.tabIndex = enabled && photoSize ? 0 : -1;
    photoZoom.disabled = zoomOut.disabled = zoomIn.disabled = !enabled || !photoSize;
    $('#photo-position-label').textContent = enabled && photoSize ? 'DRAG TO POSITION' : 'PORTRAIT / 01';
    photoFrame.setAttribute('aria-label', enabled && photoSize ? '프로필 사진 위치 조정. 드래그 또는 방향키로 이동' : '프로필 사진');
    if (!enabled) finishPhotoDrag();
  }

  function setPhotoPosition(left, top, geometry) {
    // Signed space also supports fitting the whole portrait inside the existing frame.
    const horizontalSpace = geometry.frameWidth - geometry.width;
    const verticalSpace = geometry.frameHeight - geometry.height;
    if (Math.abs(horizontalSpace) > .01) photoFraming.x = clamp(left / horizontalSpace, 0, 1);
    if (Math.abs(verticalSpace) > .01) photoFraming.y = clamp(top / verticalSpace, 0, 1);
    renderPhoto();
  }

  function setPhotoZoom(value) {
    if (!canEditPhoto()) return;
    const before = photoGeometry();
    const after = photoGeometry(value);
    if (!before || !after) return;
    // Keep the image point at the frame's centre stable while zooming.
    const centreX = (before.frameWidth / 2 - before.left) / before.width;
    const centreY = (before.frameHeight / 2 - before.top) / before.height;
    photoFraming.zoom = after.zoom;
    setPhotoPosition(after.frameWidth / 2 - centreX * after.width,
      after.frameHeight / 2 - centreY * after.height, after);
  }

  photoFrame.addEventListener('pointerdown', (event) => {
    if (!canEditPhoto() || event.button !== 0 || photoDrag || event.target.closest('button, input')) return;
    event.preventDefault();
    photoFrame.focus({ preventScroll: true });
    photoDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    photoFrame.setPointerCapture(event.pointerId);
    photoFrame.classList.add('is-dragging');
  });
  photoFrame.addEventListener('pointermove', (event) => {
    if (!photoDrag || photoDrag.id !== event.pointerId || !canEditPhoto()) return;
    const geometry = photoGeometry();
    const inverse = new DOMMatrix(getComputedStyle($('.card-rig')).transform).inverse();
    const dx = event.clientX - photoDrag.x;
    const dy = event.clientY - photoDrag.y;
    // The physical card is tilted: convert the screen movement to its local axes.
    setPhotoPosition(geometry.left + inverse.a * dx + inverse.c * dy,
      geometry.top + inverse.b * dx + inverse.d * dy, geometry);
    photoDrag.x = event.clientX;
    photoDrag.y = event.clientY;
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => photoFrame.addEventListener(type, (event) => {
    if (photoDrag?.id === event.pointerId) finishPhotoDrag();
  }));
  photoFrame.addEventListener('keydown', (event) => {
    if (event.target !== photoFrame || !canEditPhoto() || event.ctrlKey || event.metaKey || event.altKey) return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (directions[event.key]) {
      event.preventDefault();
      const geometry = photoGeometry();
      const [dx, dy] = directions[event.key];
      const step = event.shiftKey ? 20 : 6;
      setPhotoPosition(geometry.left + dx * step, geometry.top + dy * step, geometry);
    } else if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      setPhotoZoom(photoFraming.zoom + (event.key === '-' ? -.1 : .1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      photoFraming = { zoom: 1, x: .5, y: .42 };
      renderPhoto();
    }
  });
  photoFrame.addEventListener('wheel', (event) => {
    if (!canEditPhoto() || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? photoFrame.clientHeight : 1;
    setPhotoZoom(photoFraming.zoom - event.deltaY * unit * .002);
  }, { passive: false });
  zoomOut.addEventListener('click', () => setPhotoZoom(photoFraming.zoom - .1));
  zoomIn.addEventListener('click', () => setPhotoZoom(photoFraming.zoom + .1));
  photoZoom.addEventListener('input', () => {
    const geometry = photoGeometry();
    if (geometry) setPhotoZoom(geometry.minZoom + Number(photoZoom.value) / 100 * (3 - geometry.minZoom));
  });
  if (window.ResizeObserver) new ResizeObserver(renderPhoto).observe(photoFrame);

  function showPhoto(url, image, framing = {}) {
    photoSize = { width: image.naturalWidth, height: image.naturalHeight };
    photoFraming = { zoom: finiteOr(framing.zoom, 1),
      x: clamp(finiteOr(framing.x, .5), 0, 1), y: clamp(finiteOr(framing.y, .42), 0, 1) };
    portrait.src = url;
    portrait.hidden = false;
    photoFrame.classList.add('has-photo');
    photoToolbar.hidden = false;
    photoButton.setAttribute('aria-label', '프로필 사진 변경');
    $('#photo-help').textContent = '사진 변경';
    setPhotoEditable(scene.dataset.state === 'editing');
    renderPhoto();
  }

  function showIssuedCard(identity) {
    issuedCard = Object.freeze(identity);
    nameInput.value = identity.name;
    codeName.textContent = identity.codeName;
    statusText.textContent = identity.status;
    setSerial(identity.serial);
    nameInput.readOnly = true;
    setPhotoEditable(false);
    issueButton.disabled = true;
    issueButton.hidden = true;
    enterButton.hidden = false;
    scene.dataset.state = 'issued';
    caption.textContent = '환영합니다, 조사관님.';
    resetButton.hidden = false;
    fitText(nameInput);
  }

  function enterInvestigationRoom() {
    if (scene.dataset.state !== 'issued' || !issuedCard) return;
    // opening.js listens here and starts the same-page corridor opening.
    // The issued identity and all card editing code stay in this module.
    window.dispatchEvent(new CustomEvent('investigation:enter', { detail: issuedCard }));
  }

  enterButton.addEventListener('click', enterInvestigationRoom);

  async function restoreIssuedCard() {
    scene.dataset.state = 'restoring';
    nameInput.readOnly = true;
    setPhotoEditable(false);
    issueButton.disabled = true;
    const saved = await storedCard('readonly');
    if (saved && typeof saved.name === 'string' && saved.name.trim() && saved.name.length <= 24
      && /^AGENT H-(?!000)\d{3}$/.test(saved.codeName)
      && saved.status === 'AUTHORIZED' && /^HNJ — \d{6}$/.test(saved.serial)) {
      if (saved.photo instanceof Blob) {
        const url = URL.createObjectURL(saved.photo);
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          photoUrl = url;
          photoFile = saved.photo;
          showPhoto(url, image, saved.photoFraming || {});
        } catch { URL.revokeObjectURL(url); }
      }
      showIssuedCard({ name: saved.name, codeName: saved.codeName, status: 'AUTHORIZED',
        title: 'INVESTIGATOR', serial: saved.serial, photoUrl,
        photoFraming: Object.freeze({ ...photoFraming }), issuedAt: saved.issuedAt });
    } else {
      scene.dataset.state = 'editing';
      nameInput.readOnly = false;
      setPhotoEditable(true);
      issueButton.disabled = false;
    }
  }

  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(storageKey, soundEnabled ? 'on' : 'off'); } catch { /* Optional preference only. */ }
    updateSoundButton();
    if (soundEnabled) playKey();
  });

  photoButton.addEventListener('click', () => {
    if (scene.dataset.state === 'editing') { getAudio(); photoInput.click(); }
  });

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    photoInput.value = '';
    if (!file || scene.dataset.state !== 'editing') return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
    if (!allowed.includes(file.type) || file.size > 15 * 1024 * 1024) {
      notify('15MB 이하의 JPG · PNG · WEBP · AVIF · GIF 사진을 골라주세요.');
      return;
    }
    const revision = ++photoRevision;
    const url = URL.createObjectURL(file);
    photoButton.setAttribute('aria-busy', 'true');
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (revision !== photoRevision || scene.dataset.state !== 'editing') { URL.revokeObjectURL(url); return; }
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = url;
      photoFile = file;
      showPhoto(url, image);
      notify();
    } catch {
      URL.revokeObjectURL(url);
      if (revision === photoRevision) notify('사진을 읽을 수 없어요. 다른 사진을 골라주세요.');
    } finally {
      if (revision === photoRevision) photoButton.removeAttribute('aria-busy');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (scene.dataset.state !== 'editing' || compositionActive) return;
    if (!nameInput.value.trim()) {
      nameInput.parentElement.classList.add('invalid');
      nameInput.setAttribute('aria-invalid', 'true');
      notify('이름 또는 닉네임을 남겨주세요.');
      nameInput.focus();
      return;
    }
    if (photoButton.getAttribute('aria-busy') === 'true') { notify('사진을 현상하고 있어요. 잠시만요.'); return; }
    nameInput.value = nameInput.value.trim();
    nameInput.blur();
    nameInput.readOnly = true;
    setPhotoEditable(false);
    issueButton.disabled = true;
    notify();
    getAudio();
    codeName.textContent = makeCodeName();
    statusText.textContent = 'AUTHORIZED';
    scene.dataset.state = 'stamping';
    caption.textContent = '신원 확인 중';
    $('.button-label').textContent = '발급 중';
    const serial = makeSerial();
    setSerial(serial);
    window.setTimeout(playStamp, reducedMotion.matches ? 0 : 225);
    window.setTimeout(() => {
      showIssuedCard({
        name: nameInput.value, codeName: codeName.textContent, status: 'AUTHORIZED',
        title: 'INVESTIGATOR', serial,
        photoUrl, photoFraming: Object.freeze({ ...photoFraming }), issuedAt: new Date().toISOString()
      });
      const { photoUrl: sessionPhotoUrl, ...record } = issuedCard;
      void storedCard('readwrite', { ...record, photo: photoFile });
      // Issuance remains observable; entering the room is a separate button action.
      window.dispatchEvent(new CustomEvent('investigator:issued', { detail: issuedCard }));
    }, reducedMotion.matches ? 120 : 780);
  });

  resetButton.addEventListener('click', () => {
    scene.dataset.state = 'editing';
    issuedCard = null;
    void storedCard('readwrite', null);
    codeName.textContent = '—';
    statusText.textContent = 'PENDING';
    nameInput.readOnly = false;
    setPhotoEditable(true);
    issueButton.disabled = false;
    issueButton.hidden = false;
    enterButton.hidden = true;
    issueButton.innerHTML = defaultButton;
    caption.textContent = defaultCaption;
    resetButton.hidden = true;
    setSerial('HNJ — 000000');
    notify();
    nameInput.focus();
    nameInput.select();
  });

  // Public, read-only handoff for the next scene. Storage never leaves the browser.
  window.HNJ = Object.freeze({ getIdentity: () => issuedCard, enterInvestigationRoom,
    audio: Object.freeze({ getContext: getAudio, isEnabled: () => soundEnabled }) });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted && photoUrl) URL.revokeObjectURL(photoUrl);
  });
  window.addEventListener('resize', () => { fitText(nameInput); renderPhoto(); });
  updateSoundButton();
  setSerial('HNJ — 000000');
  void restoreIssuedCard();
})();

const ASSETS = {
  characters: {
    impCrew: '/assets/characters/imp-crew.png',
    impEvil: '/assets/characters/imp-evil.png',
    trivia: '/assets/characters/trivia.png',
    hottakeA: '/assets/characters/hottake-a.png',
    hottakeB: '/assets/characters/hottake-b.png',
    mafia: '/assets/characters/mafia.png',
    millionaire: '/assets/characters/millionaire.png',
    feud: '/assets/characters/feud.png',
    wavelength: '/assets/characters/wavelength.png',
    alias: '/assets/characters/alias.png',
    drawing: '/assets/characters/drawing.png',
    win: '/assets/characters/win.png',
    lose: '/assets/characters/lose.png',
    impCrewLarge: '/assets/characters/imp-crew-large.png',
    impEvilLarge: '/assets/characters/imp-evil-large.png',
    hostScreen: '/assets/characters/host-screen.png',
  },
  scenes: {
    homeBg: '/assets/scenes/home-bg.png',
    impSetup: '/assets/scenes/imp-setup.png',
    impCrewBg: '/assets/scenes/imp-crew-bg.png',
    impImposterBg: '/assets/scenes/imp-imposter-bg.png',
    impDiscuss: '/assets/scenes/imp-discuss-bg.png',
    impCaught: '/assets/scenes/imp-caught.png',
    impEscaped: '/assets/scenes/imp-escaped.png',
    triviaSetup: '/assets/scenes/trivia-setup.png',
    triviaQuestion: '/assets/scenes/trivia-question-bg.png',
    triviaCorrect: '/assets/scenes/trivia-correct-bg.png',
    triviaWrong: '/assets/scenes/trivia-wrong-bg.png',
    hottakeSetup: '/assets/scenes/hottake-setup.png',
    hottakeQuestion: '/assets/scenes/hottake-question-bg.png',
    hottakeResults: '/assets/scenes/hottake-results-bg.png',
    mafianight: '/assets/scenes/mafia-night.png',
    mafiaDay: '/assets/scenes/mafia-day.png',
    millionaireSetup: '/assets/scenes/millionaire-setup.png',
    millionaireQuestion: '/assets/scenes/millionaire-question-bg.png',
    feudSetup: '/assets/scenes/feud-setup.png',
    wavelengthSetup: '/assets/scenes/wavelength-setup.png',
    aliasSetup: '/assets/scenes/alias-setup.png',
    drawingSetup: '/assets/scenes/drawing-setup.png',
    winBg: '/assets/scenes/win-bg.png',
    loseBg: '/assets/scenes/lose-bg.png',
    scoreboardBg: '/assets/scenes/scoreboard-bg.png',
    loadingBg: '/assets/scenes/loading-bg.png',
    sessionBg: '/assets/scenes/session-bg.png',
    votingBg: '/assets/scenes/voting-bg.png',
    /* Light theme scenes */
    homeBgLight: '/assets/scenes/home-bg-light.png',
    impPassLight: '/assets/scenes/imp-pass-light.png',
    discussBgLight: '/assets/scenes/discuss-bg-light.png',
    voteBgLight: '/assets/scenes/vote-bg-light.png',
    resultsCaughtLight: '/assets/scenes/results-caught-light.png',
    triviaBgLight: '/assets/scenes/trivia-bg-light.png',
    hottakeBgLight: '/assets/scenes/hottake-bg-light.png',
  },
  lottie: {
    confetti: '/assets/lottie/confetti-partyyy.json',
    countdown: '/assets/lottie/321-go.json',
    correct: '/assets/lottie/checkmark-animation.json',
    wrong: '/assets/lottie/cross.json',
    stars: '/assets/lottie/star-burst-animation.json',
    trophy: '/assets/lottie/trophy.json',
    thinking: '/assets/lottie/questions.json',
    loading: '/assets/lottie/loading-animation.json',
    vote: '/assets/lottie/click.json',
    heart: '/assets/lottie/heart-burst.json',
    crown: '/assets/lottie/crown.json',
    thumbsUp: '/assets/lottie/thumbs-up.json',
    timer: '/assets/lottie/time-animation.json',
    fire: '/assets/lottie/fire-animation.json',
    brain: '/assets/lottie/ai-brain.json',
    magnifying: '/assets/lottie/magnifying-glass.json',
    money: '/assets/lottie/making-money.json',
    wave: '/assets/lottie/wave-wave.json',
    chat: '/assets/lottie/chat-bubble.json',
    paint: '/assets/lottie/green-splash.json',
    ghost: '/assets/lottie/empty-ghost.json',
    lock: '/assets/lottie/lock-opens-and-turns-into-a-green-tick.json',
    loadingDots: '/assets/lottie/loading-dots.json',
    process: '/assets/lottie/process.json',
  },
  ui: {
    bannerGold: '/assets/ui/banner-gold.png',
    cardFrameGold: '/assets/ui/card-frame-gold.png',
    cardFrameRed: '/assets/ui/card-frame-red.png',
    cardFrameTeal: '/assets/ui/card-frame-teal.png',
    crownLarge: '/assets/ui/crown-large.png',
    dividerStars: '/assets/ui/divider-stars.png',
    packCardDecoration: '/assets/ui/pack-card-decoration.png',
    scoreBadge: '/assets/ui/score-badge.png',
    speechBubble1: '/assets/ui/speech-bubble-1.png',
    speechBubble2: '/assets/ui/speech-bubble-2.png',
    timerFrame: '/assets/ui/timer-frame.png',
    voteBadge: '/assets/ui/vote-badge.png',
    gameNightTitle: '/assets/ui/game-night-title.png',
    playerCardFrame: '/assets/ui/player-card-frame.png',
    roomCodeFrame: '/assets/ui/room-code-frame.png',
  },
  backgrounds: {
    darkStars: '/assets/backgrounds/bg-dark-stars.png',
    warmCozy: '/assets/backgrounds/bg-warm-cozy.png',
    celebration: '/assets/backgrounds/bg-celebration.png',
    mystery: '/assets/backgrounds/bg-mystery.png',
    patternGold: '/assets/backgrounds/bg-pattern-gold.png',
  },
  doodles: {
    sheet1: '/assets/doodles/doodles-sheet-1.png',
    sheet2: '/assets/doodles/doodles-sheet-2.png',
  }
};

// Asset helper functions
function assetUrl(category, key) {
  return ASSETS[category] && ASSETS[category][key]
    ? ASSETS[category][key] : null;
}

function createCharacterImg(key, size) {
  size = size || 'normal';
  var path = ASSETS.characters[key];
  if (!path) return null;
  var img = document.createElement('img');
  img.src = path + '?v=' + Date.now();
  img.alt = key;
  img.className = 'character-img' +
    (size === 'large' ? ' large' : size === 'small' ? ' small' : '');
  img.onerror = function() { img.style.display = 'none'; };
  return img;
}

function setSceneBg(screenId, sceneKey, category) {
  category = category || 'scenes';
  var screen = document.getElementById(screenId);
  if (!screen) return;
  var old = screen.querySelector('.scene-bg-img');
  if (old) old.remove();
  var path = ASSETS[category] && ASSETS[category][sceneKey];
  if (!path) return;
  var img = document.createElement('img');
  img.src = path;
  img.className = 'scene-bg-img';
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.onerror = function() { img.remove(); };
  screen.insertBefore(img, screen.firstChild);
}

function playLottie(containerId, lottieKey, loop) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (typeof customElements === 'undefined' || !customElements.get('lottie-player')) return;
  var path = ASSETS.lottie[lottieKey];
  if (!path) return;
  el.innerHTML = '<lottie-player src="' + path + '" background="transparent" speed="1" style="width:100%;height:100%" ' + (loop ? 'loop ' : '') + 'autoplay></lottie-player>';
}

function playLottieOverlay(lottieKey, duration) {
  duration = duration || 3000;
  if (typeof customElements === 'undefined' || !customElements.get('lottie-player')) return;
  var path = ASSETS.lottie[lottieKey];
  if (!path) return;
  var overlay = document.createElement('div');
  overlay.className = 'lottie-overlay';
  overlay.innerHTML = '<lottie-player src="' + path + '" background="transparent" speed="1" style="width:300px;height:300px" autoplay></lottie-player>';
  document.body.appendChild(overlay);
  setTimeout(function() { overlay.remove(); }, duration);
}

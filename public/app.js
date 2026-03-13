(function () {
/* ══════════════════════════════
   PARTICLES
   ══════════════════════════════ */
const cvs = document.getElementById('bg-particles');
const ctx = cvs.getContext('2d');
let particles = [], particlesPaused = false, particleRaf = null;

function resizeCanvas() { cvs.width = window.innerWidth; cvs.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function initParticles() {
  particles = [];
  const count = window.innerWidth < 600 ? 12 : 18;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * cvs.width, y: Math.random() * cvs.height,
      size: Math.random() * 4 + 2, speedX: (Math.random() - 0.5) * 0.3, speedY: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.05 + 0.02, color: Math.random() > 0.5 ? '#FFD166' : '#EF6351',
      shape: Math.random() > 0.6 ? 'triangle' : 'circle'
    });
  }
}
initParticles();

function drawParticles() {
  if (particlesPaused) { particleRaf = null; return; }
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  particles.forEach(p => {
    p.x += p.speedX; p.y += p.speedY;
    if (p.x < -20) p.x = cvs.width + 20; if (p.x > cvs.width + 20) p.x = -20;
    if (p.y < -20) p.y = cvs.height + 20; if (p.y > cvs.height + 20) p.y = -20;
    ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
    if (p.shape === 'circle') {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(p.x, p.y - p.size); ctx.lineTo(p.x - p.size, p.y + p.size); ctx.lineTo(p.x + p.size, p.y + p.size); ctx.closePath(); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
  particleRaf = requestAnimationFrame(drawParticles);
}
function pauseParticles() { particlesPaused = true; if (particleRaf) { cancelAnimationFrame(particleRaf); particleRaf = null; } }
function resumeParticles() { if (particlesPaused) { particlesPaused = false; drawParticles(); } }
drawParticles();

/* ══════════════════════════════
   UTILITIES
   ══════════════════════════════ */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
// DOM cache for frequently accessed elements
const _domCache = {};
function $c(selector) { if (!_domCache[selector]) _domCache[selector] = $(selector); return _domCache[selector]; }
const _activeTimers = new Set();
function safeInterval(fn, ms) { const id = setInterval(fn, ms); _activeTimers.add(id); return id; }
function safeTimeout(fn, ms) { const id = setTimeout(() => { _activeTimers.delete(id); fn(); }, ms); _activeTimers.add(id); return id; }
function clearAllTimers() { _activeTimers.forEach(id => { clearInterval(id); clearTimeout(id); }); _activeTimers.clear(); }
const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function deepMerge(target, source) { for (const key of Object.keys(source)) { if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) { deepMerge(target[key], source[key]); } else { target[key] = source[key]; } } }

const PLAYER_COLORS = ['#FFD166','#EF6351','#06D6A0','#C1121F','#7c3aed','#06b6d4','#ec4899','#f97316','#22c55e','#eab308'];
function playerColor(idx) { return PLAYER_COLORS[idx % PLAYER_COLORS.length]; }

/* ══════════════════════════════
   GAME STATE & PUB/SUB
   ══════════════════════════════ */
let nextPlayerId = 1;
const gameState = {
  session: { players: [], settings: {
    global: { pointsToWin: 0, roundLimit: 0, showScoresBetweenRounds: true, animationSpeed: 'normal', sound: true, soundVolume: 70, theme: 'dark' },
    imposter: { imposterCount: 1, discussionTimer: 0, imposterMode: 'hint', blankScreen: false, anonymousVoting: false, votePts: 1, survivalPts: 3, unanimousBonus: 1 },
    trivia: { questionsPerRound: 5, timeLimit: 0, showAnswerAfter: true, allowSkip: false, answerMode: 'choice', questionMode: 'same', wagerMode: false, eliminationMode: false, streakMultiplier: true, negativeMarking: false, correctPts: 2, onlyCorrectBonus: 1, streakBonus: 1 },
    hottake: { questionsPerRound: 5, revealStyle: 'all', allowPass: false, debateTimer: 0, minorityPts: 2, splitPts: 1 }
  }},
  scores: { byPlayer: {}, byGame: {}, history: [], streaks: {} },
  currentGame: null, currentScreen: 'screen-home',
  playlist: [], playlistIdx: -1, packs: {},
  imposter: { rounds: [], word: '', hint: '', imposterIndices: [], clueIdx: 0, votes: {}, individualVotes: {}, voterIdx: 0, roundNum: 0 },
  trivia: { questions: [], qIdx: 0, playerIdx: 0, answers: {}, roundNum: 0 },
  hottake: { questions: [], question: '', optA: '', optB: '', choices: {}, playerIdx: 0, roundNum: 0, htRoundCount: 0 },
  mafia: { phase: '', players: [], nightActions: {}, eliminatedPlayers: [], round: 0 },
  millionaire: { currentPlayer: '', questionIdx: 0, bankedPts: 0, lifelines: {}, hotSeat: 0 },
  feud: { teams: [], currentTeam: 0, board: [], strikes: 0, round: 0, teamScores: [] },
  wavelength: { spectrums: [], currentSpectrum: null, teamTurn: 0, clue: '', position: 0, round: 0 },
  alias: { cards: [], currentCard: null, teamTurn: 0, correct: 0, skipped: 0, round: 0 },
  drawing: { words: [], currentWord: null, drawerIdx: 0, scores: {}, round: 0 }
};

const stateListeners = [];
function updateState(changes) { deepMerge(gameState, changes); stateListeners.forEach(fn => fn(gameState, changes)); }
function syncToPlayers(changes) { if (isMultiDevice && socket) sendMsg('host_update', { gameState: changes }); }
function onStateChange(fn) { stateListeners.push(fn); return () => { const i = stateListeners.indexOf(fn); if (i >= 0) stateListeners.splice(i, 1); }; }

/* GameState class wrapper — provides structured API for future multi-device refactor */
class GameState {
  constructor(state) { this._state = state; this._listeners = stateListeners; }
  getState() { return this._state; }
  setState(changes) { updateState(changes); }
  subscribe(fn) { return onStateChange(fn); }
  serialize() { return JSON.parse(JSON.stringify(this._state)); }
  deserialize(data) { deepMerge(this._state, data); this._listeners.forEach(fn => fn(this._state, data)); }
}
const gameStateManager = new GameState(gameState);

/* ══════════════════════════════
   PLAYER MANAGEMENT
   ══════════════════════════════ */
function createPlayer(name) { return { id: 'p' + (nextPlayerId++), name }; }
function playerNames() { return gameState.session.players.map(p => p.name); }
function playerById(id) { return gameState.session.players.find(p => p.id === id); }
function allPlayers() { return gameState.session.players; }
function nonHostPlayers() { return isMultiDevice ? allPlayers().filter(p => !p.isHost) : allPlayers(); }

/* ══════════════════════════════
   SCREEN MANAGEMENT
   ══════════════════════════════ */
const gameScreenPrefixes = ['screen-imp-clue','screen-imp-discuss','screen-imp-vote','screen-imp-results',
  'screen-triv-pass','screen-triv-question','screen-triv-reveal','screen-triv-results',
  'screen-ht-question','screen-ht-pass','screen-ht-results',
  'screen-mafia-night','screen-mafia-day','screen-mafia-vote','screen-mafia-results',
  'screen-mill-question','screen-mill-result','screen-mill-final',
  'screen-feud-board','screen-feud-results',
  'screen-wave-clue','screen-wave-guess','screen-wave-reveal',
  'screen-alias-play','screen-alias-results',
  'screen-draw-play','screen-draw-results'];
let screenBeforeSaves = null;
const screenHistory = [];

const BREADCRUMB_MAP = {
  'screen-session': ['Session Setup'],
  'screen-home': ['Home'],
  'screen-loading': ['Loading'],
  'screen-playlist': ['Home', 'Playlist'],
  'screen-imp-setup': ['Home', 'Imposter', 'Setup'],
  'screen-imp-clue': ['Home', 'Imposter', 'Clues'],
  'screen-imp-discuss': ['Home', 'Imposter', 'Discussion'],
  'screen-imp-vote': ['Home', 'Imposter', 'Voting'],
  'screen-imp-results': ['Home', 'Imposter', 'Results'],
  'screen-triv-setup': ['Home', 'Trivia', 'Setup'],
  'screen-triv-pass': ['Home', 'Trivia', 'Pass'],
  'screen-triv-question': ['Home', 'Trivia', 'Question'],
  'screen-triv-reveal': ['Home', 'Trivia', 'Reveal'],
  'screen-triv-results': ['Home', 'Trivia', 'Results'],
  'screen-ht-setup': ['Home', 'Hot Take', 'Setup'],
  'screen-ht-question': ['Home', 'Hot Take', 'Question'],
  'screen-ht-pass': ['Home', 'Hot Take', 'Voting'],
  'screen-ht-results': ['Home', 'Hot Take', 'Results'],
  'screen-content-mgr': ['Home', 'Content Manager'],
  'screen-saves': ['Home', 'Saves'],
  'screen-round-summary': ['Home', 'Round Summary'],
  'screen-playlist-complete': ['Home', 'Playlist', 'Complete'],
  'screen-session-stats': ['Home', 'Session Stats'],
  'screen-mafia-setup': ['Home', 'Mafia', 'Setup'],
  'screen-mafia-night': ['Home', 'Mafia', 'Night'],
  'screen-mafia-day': ['Home', 'Mafia', 'Day'],
  'screen-mafia-vote': ['Home', 'Mafia', 'Vote'],
  'screen-mafia-results': ['Home', 'Mafia', 'Results'],
  'screen-mill-setup': ['Home', 'Millionaire', 'Setup'],
  'screen-mill-question': ['Home', 'Millionaire', 'Question'],
  'screen-mill-result': ['Home', 'Millionaire', 'Result'],
  'screen-mill-final': ['Home', 'Millionaire', 'Final'],
  'screen-feud-setup': ['Home', 'Family Feud', 'Setup'],
  'screen-feud-board': ['Home', 'Family Feud', 'Board'],
  'screen-feud-results': ['Home', 'Family Feud', 'Results'],
  'screen-wave-setup': ['Home', 'Wavelength', 'Setup'],
  'screen-wave-clue': ['Home', 'Wavelength', 'Clue'],
  'screen-wave-guess': ['Home', 'Wavelength', 'Guess'],
  'screen-wave-reveal': ['Home', 'Wavelength', 'Reveal'],
  'screen-alias-setup': ['Home', 'Alias', 'Setup'],
  'screen-alias-play': ['Home', 'Alias', 'Play'],
  'screen-alias-results': ['Home', 'Alias', 'Results'],
  'screen-draw-setup': ['Home', 'Drawing', 'Setup'],
  'screen-draw-play': ['Home', 'Drawing', 'Play'],
  'screen-draw-results': ['Home', 'Drawing', 'Results'],
};

function updateBreadcrumb(id) {
  const bc = $('#breadcrumb'), parts = BREADCRUMB_MAP[id];
  // Hide during active gameplay screens and session screen
  const isActiveGame = gameScreenPrefixes.some(p => id === p || id.startsWith(p));
  if (!parts || id === 'screen-session' || isActiveGame) { bc.classList.remove('visible'); return; }
  bc.classList.add('visible');
  bc.innerHTML = parts.map((label, i) => {
    if (i === parts.length - 1) return '<span class="bc-current">' + label + '</span>';
    return '<span data-nav="' + label + '">' + label + '</span><span class="bc-sep">›</span>';
  }).join('');
}

function showScreen(id, direction) {
  const prev = gameState.currentScreen;
  const dir = direction || 'forward';
  $$('.screen').forEach(s => {
    if (s.classList.contains('active')) {
      s.classList.remove('active');
      if (gameState.session.settings.global.animationSpeed !== 'off') {
        s.classList.add(dir === 'back' ? 'slide-out-right' : 'slide-out');
        setTimeout(() => s.classList.remove('slide-out', 'slide-out-right'), 400);
      }
    }
  });
  document.getElementById(id).classList.add('active');
  if (id === 'screen-saves') screenBeforeSaves = prev;
  if (dir === 'forward' && prev && prev !== id) screenHistory.push(prev);
  gameState.currentScreen = id;
  const isGameScreen = gameScreenPrefixes.some(p => id.startsWith(p));
  $('#game-menu-btn').classList.toggle('visible', isGameScreen);
  // During active game: hide FAB (scoreboard accessible via menu). Otherwise show FAB.
  const fab = $('#scoreboard-fab');
  if (fab.classList.contains('visible') || isGameScreen) fab.classList.toggle('visible', !isGameScreen && gameState.session.players.length > 0);
  updateBreadcrumb(id);
  // Pause particles during active game screens for performance
  if (isGameScreen) pauseParticles(); else resumeParticles();
}

function goBack() {
  const prev = screenHistory.pop();
  if (prev) showScreen(prev, 'back');
  else goHome();
}

function goHome() {
  clearAllTimers();
  const flash = $('#answer-flash'); if (flash) { flash.classList.remove('visible', 'correct', 'wrong'); flash.textContent = ''; }
  gameState.currentGame = null; screenHistory.length = 0; showScreen('screen-home');
  const sub = $('#home-subtitle'); if (sub) sub.textContent = HOME_SUBTITLES[Math.floor(Math.random() * HOME_SUBTITLES.length)];
  updatePlayersCard(); if (typeof updateHomePlayerStrip === 'function') updateHomePlayerStrip(); releaseWakeLock();
  // Clean up game-specific state
  gameState.imposter.votes = {}; gameState.imposter.individualVotes = {};
  gameState.trivia.answers = {}; gameState.hottake.choices = {};
  // Remove floating elements
  document.querySelectorAll('.floating-emoji, .points-float, .confetti-piece').forEach(el => el.remove());
}
function updatePlayersCard() { const desc = $('#players-card-desc'); if (!desc) return; const n = allPlayers().length; desc.textContent = n > 0 ? n + ' player' + (n !== 1 ? 's' : '') + ' ready' : 'Add or manage players'; }

/* ══════════════════════════════
   SCORING ENGINE
   ══════════════════════════════ */
function addPoints(playerId, pts, game, reason) {
  if (pts <= 0) return;
  gameState.scores.byPlayer[playerId] = (gameState.scores.byPlayer[playerId] || 0) + pts;
  if (!gameState.scores.byGame[playerId]) gameState.scores.byGame[playerId] = {};
  gameState.scores.byGame[playerId][game] = (gameState.scores.byGame[playerId][game] || 0) + pts;
  gameState.scores.history.push({ game, playerId, points: pts, reason, timestamp: Date.now() });
  if (gameState.session.settings.global.animationSpeed !== 'off') animatePoints(pts);
}

function animatePoints(pts) {
  const el = document.createElement('div'); el.className = 'points-float'; el.textContent = '+' + pts;
  document.body.appendChild(el); el.addEventListener('animationend', () => el.remove());
  playSound('coinCollect');
}

function scoreImposterRound() { // MULTIPLAYER_HOOK: scoring runs on host only, results broadcast to players
  const imp = gameState.imposter, players = nonHostPlayers(), cfg = gameState.session.settings.imposter;
  const votePts = cfg.votePts ?? 1, survPts = cfg.survivalPts ?? 3, unanBonus = cfg.unanimousBonus ?? 1;
  const imposterPlayers = imp.imposterIndices.map(i => players[i]);
  const imposterIds = imposterPlayers.map(p => p.id);
  const sorted = Object.entries(imp.votes).filter(([,c]) => c > 0).sort((a, b) => b[1] - a[1]);
  const maxV = sorted.length > 0 ? sorted[0][1] : 0;
  const topVoted = sorted.filter(([,c]) => c === maxV);
  let caught = false;
  if (imposterIds.length === 1) caught = topVoted.length === 1 && topVoted[0][0] === imposterIds[0];
  else { const topNames = topVoted.map(([id]) => id); caught = imposterIds.every(id => topNames.includes(id)); }
  const breakdown = [];
  if (caught) {
    const eligible = players.filter(p => !imposterIds.includes(p.id));
    let correctCount = 0;
    eligible.forEach(p => {
      if (imposterIds.includes(imp.individualVotes[p.id])) { addPoints(p.id, votePts, 'imposter', 'Correct vote'); correctCount++; breakdown.push({ id: p.id, pts: votePts, reasons: ['Correct vote +' + votePts] }); }
      else breakdown.push({ id: p.id, pts: 0, reasons: ['Wrong vote'] });
    });
    if (correctCount === eligible.length && eligible.length > 0 && unanBonus > 0) {
      eligible.forEach(p => { if (imposterIds.includes(imp.individualVotes[p.id])) { addPoints(p.id, unanBonus, 'imposter', 'Unanimous bonus'); const e = breakdown.find(b => b.id === p.id); if (e) { e.pts += unanBonus; e.reasons.push('Unanimous bonus +' + unanBonus); } } });
    }
    imposterPlayers.forEach(p => breakdown.push({ id: p.id, pts: 0, reasons: ['Caught!'] }));
  } else {
    imposterPlayers.forEach(p => { addPoints(p.id, survPts, 'imposter', 'Imposter survived'); breakdown.push({ id: p.id, pts: survPts, reasons: ['Survived +' + survPts] }); });
    players.filter(p => !imposterIds.includes(p.id)).forEach(p => breakdown.push({ id: p.id, pts: 0, reasons: ['Imposter escaped'] }));
  }
  return { caught, breakdown };
}

function scoreTriviaQuestion(question, qIdx) {
  const players = allPlayers(), answers = gameState.trivia.answers, cfg = gameState.session.settings.trivia;
  const basePts = cfg.correctPts ?? 2, onlyBonus = cfg.onlyCorrectBonus ?? 1, streakBonus = cfg.streakBonus ?? 1;
  const correctPlayers = players.filter(p => answers[p.id] && answers[p.id][qIdx] === question.correct);
  const breakdown = [];
  correctPlayers.forEach(p => {
    let pts = basePts; const reasons = ['Correct +' + basePts];
    if (correctPlayers.length === 1 && onlyBonus > 0) { pts += onlyBonus; reasons.push('Only one correct +' + onlyBonus); }
    if (cfg.streakMultiplier !== false) {
      const streak = (gameState.scores.streaks[p.id] || 0) + 1; gameState.scores.streaks[p.id] = streak;
      if (streak >= 3 && streakBonus > 0) { pts += streakBonus; reasons.push('Streak ' + streak + ' +' + streakBonus); }
    }
    addPoints(p.id, pts, 'trivia', reasons.join(', ')); breakdown.push({ id: p.id, pts, reasons });
  });
  players.forEach(p => {
    if (!correctPlayers.includes(p)) {
      gameState.scores.streaks[p.id] = 0;
      if (cfg.negativeMarking && answers[p.id] && answers[p.id][qIdx] >= 0) { addPoints(p.id, -1, 'trivia', 'Wrong -1'); breakdown.push({ id: p.id, pts: -1, reasons: ['Wrong -1'] }); }
      else breakdown.push({ id: p.id, pts: 0, reasons: ['Wrong'] });
    }
  });
  return breakdown;
}

function scoreHotTakeQuestion() {
  const players = allPlayers(), choices = gameState.hottake.choices, cfg = gameState.session.settings.hottake;
  const minPts = cfg.minorityPts ?? 2, splPts = cfg.splitPts ?? 1;
  const aP = players.filter(p => choices[p.id] === 'A'), bP = players.filter(p => choices[p.id] === 'B');
  const breakdown = [];
  if (aP.length === bP.length) {
    players.forEach(p => { if (choices[p.id]) { addPoints(p.id, splPts, 'hottake', 'Perfect split'); breakdown.push({ id: p.id, pts: splPts, reasons: ['Perfect split +' + splPts] }); } });
    return { type: 'split', breakdown };
  }
  const minority = aP.length < bP.length ? aP : bP, majority = aP.length < bP.length ? bP : aP;
  minority.forEach(p => { addPoints(p.id, minPts, 'hottake', 'Minority opinion'); breakdown.push({ id: p.id, pts: minPts, reasons: ['Minority +' + minPts] }); });
  majority.forEach(p => breakdown.push({ id: p.id, pts: 0, reasons: ['Majority'] }));
  return { type: 'minority', minority: minority.map(p => p.name), breakdown };
}

function renderBreakdown(containerId, breakdown) {
  const el = $(containerId); if (!el) return;
  el.innerHTML = breakdown.map(b => {
    const p = playerById(b.id), name = p ? esc(p.name) : '?', pIdx = allPlayers().indexOf(p), color = playerColor(pIdx);
    return '<div class="rb-row"><div class="rb-name" style="color:' + color + '">' + name + '</div><div class="rb-reasons">' + b.reasons.join(', ') + '</div><div class="rb-total">' + (b.pts > 0 ? '+' + b.pts : '0') + '</div></div>';
  }).join('');
}

/* ══════════════════════════════
   SAVE/LOAD SYSTEM
   ══════════════════════════════ */
function serializeState() { return JSON.parse(JSON.stringify(gameState)); }
function saveToSlot(idx) { const s = serializeState(); if (screenBeforeSaves) s.currentScreen = screenBeforeSaves; localStorage.setItem('partyGames_save_' + idx, JSON.stringify({ state: s, timestamp: Date.now(), label: buildSaveLabel(), nextPlayerId })); }
function autoSave() { const s = serializeState(); localStorage.setItem('partyGames_autosave', JSON.stringify({ state: s, timestamp: Date.now(), label: buildSaveLabel(), nextPlayerId })); }
function loadFromSlot(idx) { const key = idx === 'auto' ? 'partyGames_autosave' : 'partyGames_save_' + idx; const r = localStorage.getItem(key); if (!r) return false; const d = JSON.parse(r); deepMerge(gameState, d.state); nextPlayerId = d.nextPlayerId || gameState.session.players.length + 1; return true; }
function deleteSaveSlot(idx) { localStorage.removeItem(idx === 'auto' ? 'partyGames_autosave' : 'partyGames_save_' + idx); }
function buildSaveLabel() { const g = gameState.currentGame || 'Home', n = gameState.session.players.length, t = Math.max(0, ...Object.values(gameState.scores.byPlayer)); return g.charAt(0).toUpperCase() + g.slice(1) + ' - ' + n + ' players - Top: ' + t + 'pts'; }
function getSaveSlotInfo(idx) { const key = idx === 'auto' ? 'partyGames_autosave' : 'partyGames_save_' + idx; const r = localStorage.getItem(key); if (!r) return null; const d = JSON.parse(r); return { label: d.label, timestamp: d.timestamp, players: d.state.session.players.map(p => p.name), scores: d.state.scores?.byPlayer || {} }; }

// Used question tracking
function markQuestionsUsed(packFile, indices) {
  const key = 'partyGames_used_' + packFile; const used = JSON.parse(localStorage.getItem(key) || '[]');
  indices.forEach(i => { if (!used.includes(i)) used.push(i); }); localStorage.setItem(key, JSON.stringify(used));
}
function getUsedQuestions(packFile) { return JSON.parse(localStorage.getItem('partyGames_used_' + packFile) || '[]'); }
function filterUnusedQuestions(questions, packFile) { const used = getUsedQuestions(packFile); const unused = questions.filter((_, i) => !used.includes(i)); return unused.length > 0 ? unused : questions; }

function renderSaveSlots(mode) {
  const c = $('#save-slots'); c.innerHTML = '';
  // Auto-save slot
  const autoInfo = getSaveSlotInfo('auto');
  if (autoInfo) {
    const autoSlot = document.createElement('div'); autoSlot.className = 'save-slot autosave'; autoSlot.dataset.idx = 'auto';
    const d = new Date(autoInfo.timestamp);
    autoSlot.innerHTML = '<div class="save-slot-title">🔄 Auto-Save</div><div class="save-slot-players">' + autoInfo.players.map((n, i) => '<span class="save-avatar" style="background:' + playerColor(i) + '">' + esc(n[0]) + '</span>').join('') + '</div><div class="save-slot-meta">' + esc(autoInfo.label) + ' · ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</div>';
    autoSlot.addEventListener('click', () => { if (mode === 'load' && loadFromSlot('auto')) rebuildAfterLoad(); });
    c.appendChild(autoSlot);
  }
  for (let i = 0; i < 3; i++) {
    const info = getSaveSlotInfo(i), slot = document.createElement('div');
    slot.className = 'save-slot' + (info ? '' : ' empty'); slot.dataset.idx = i;
    if (info) {
      const d = new Date(info.timestamp);
      slot.innerHTML = '<div class="save-slot-title">Slot ' + (i+1) + '</div><div class="save-slot-players">' + info.players.map((n, j) => '<span class="save-avatar" style="background:' + playerColor(j) + '">' + esc(n[0]) + '</span>').join('') + '</div><div class="save-slot-meta">' + esc(info.label) + ' · ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</div>';
      if (mode === 'load') {
        const delBtn = document.createElement('button'); delBtn.className = 'save-delete'; delBtn.textContent = '×'; delBtn.addEventListener('click', e => { e.stopPropagation(); deleteSaveSlot(i); renderSaveSlots(mode); });
        slot.appendChild(delBtn);
      }
    } else slot.innerHTML = '<div class="save-slot-title">Slot ' + (i+1) + '</div><div class="save-slot-meta">-- Empty --</div>';
    slot.addEventListener('click', () => { if (mode === 'save') { saveToSlot(i); goHome(); } else if (mode === 'load' && info && loadFromSlot(i)) rebuildAfterLoad(); });
    c.appendChild(slot);
  }
  // Export/Import buttons
  const actions = document.createElement('div'); actions.className = 'save-actions'; actions.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
  actions.innerHTML = '<button class="btn sm outline" id="btn-export-save">Export Saves</button><button class="btn sm outline" id="btn-import-save">Import Saves</button><input type="file" id="import-save-file" accept=".json" style="display:none">';
  c.appendChild(actions);
  $('#btn-export-save').addEventListener('click', exportSaves);
  $('#btn-import-save').addEventListener('click', () => $('#import-save-file').click());
  $('#import-save-file').addEventListener('change', importSaves);
}

function exportSaves() {
  const data = {}; for (let i = 0; i < 3; i++) { const r = localStorage.getItem('partyGames_save_' + i); if (r) data['slot_' + i] = JSON.parse(r); }
  const auto = localStorage.getItem('partyGames_autosave'); if (auto) data.autosave = JSON.parse(auto);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'partygames_saves.json'; a.click();
}
function importSaves(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader(); reader.onload = () => {
    try { const data = JSON.parse(reader.result); for (let i = 0; i < 3; i++) { if (data['slot_' + i]) localStorage.setItem('partyGames_save_' + i, JSON.stringify(data['slot_' + i])); }
    if (data.autosave) localStorage.setItem('partyGames_autosave', JSON.stringify(data.autosave));
    renderSaveSlots('load'); } catch { alert('Invalid save file'); }
  }; reader.readAsText(file); e.target.value = '';
}

async function rebuildAfterLoad() {
  await loadPacks(); renderAllPackCards(); $('#scoreboard-fab').classList.add('visible');
  renderSessionChips();
  // Restore the screen that was active when saved, or fall back to home
  const savedScreen = gameState.currentScreen;
  if (savedScreen && document.getElementById(savedScreen) && savedScreen !== 'screen-session') {
    showScreen(savedScreen);
  } else {
    gameState.currentGame = null; showScreen('screen-home');
  }
}
function checkForSaves() {
  const auto = getSaveSlotInfo('auto');
  if (auto) { $('#continue-banner').classList.remove('hidden'); $('#continue-meta').textContent = auto.label + ' - ' + auto.players.join(', '); return; }
  for (let i = 0; i < 3; i++) { const info = getSaveSlotInfo(i); if (info) { $('#continue-banner').classList.remove('hidden'); $('#continue-meta').textContent = info.label + ' - ' + info.players.join(', '); return; } }
}

/* ══════════════════════════════
   SETTINGS
   ══════════════════════════════ */
function saveSettings() { localStorage.setItem('partyGames_settings', JSON.stringify(gameState.session.settings)); }
function loadSettings() { const r = localStorage.getItem('partyGames_settings'); if (r) try { deepMerge(gameState.session.settings, JSON.parse(r)); } catch {} }

function openSettings(gameType) {
  const s = gameState.session.settings;
  let html = '<div class="setting-group"><div class="setting-group-title">Global</div>';
  html += segSetting('Points to win', 'global.pointsToWin', [['10',10],['20',20],['30',30],['∞',0]], s.global.pointsToWin);
  html += segSetting('Round limit', 'global.roundLimit', [['3',3],['5',5],['10',10],['∞',0]], s.global.roundLimit);
  html += toggleSetting('Show scores between rounds', 'global.showScoresBetweenRounds', s.global.showScoresBetweenRounds);
  html += segSetting('Animation speed', 'global.animationSpeed', [['Normal','normal'],['Fast','fast'],['Off','off']], s.global.animationSpeed);
  html += toggleSetting('Sound effects', 'global.sound', s.global.sound);
  html += rangeSetting('Volume', 'global.soundVolume', s.global.soundVolume ?? 70, 0, 100);
  html += segSetting('Theme', 'global.theme', [['Dark','dark'],['Light','light'],['Hi-Con','high-contrast']], s.global.theme || 'dark');
  html += '</div>';
  if (gameType === 'imposter') {
    html += '<div class="setting-group"><div class="setting-group-title">Imposter</div>';
    html += segSetting('Imposters', 'imposter.imposterCount', [['1',1],['2',2]], s.imposter.imposterCount);
    html += segSetting('Discussion timer', 'imposter.discussionTimer', [['Off',0],['1m',60],['2m',120],['3m',180]], s.imposter.discussionTimer);
    html += segSetting('Imposter mode', 'imposter.imposterMode', [['Hint','hint'],['Just told','told']], s.imposter.imposterMode);
    html += toggleSetting('Blank screen for imposter', 'imposter.blankScreen', s.imposter.blankScreen);
    html += toggleSetting('Anonymous voting', 'imposter.anonymousVoting', s.imposter.anonymousVoting);
    html += rangeSetting('Vote points', 'imposter.votePts', s.imposter.votePts ?? 1, 0, 5);
    html += rangeSetting('Survival points', 'imposter.survivalPts', s.imposter.survivalPts ?? 3, 0, 10);
    html += rangeSetting('Unanimous bonus', 'imposter.unanimousBonus', s.imposter.unanimousBonus ?? 1, 0, 5);
    html += '</div>';
  }
  if (gameType === 'trivia') {
    html += '<div class="setting-group"><div class="setting-group-title">Trivia</div>';
    html += segSetting('Questions', 'trivia.questionsPerRound', [['3',3],['5',5],['10',10],['15',15]], s.trivia.questionsPerRound);
    html += segSetting('Time limit', 'trivia.timeLimit', [['Off',0],['15s',15],['30s',30],['60s',60]], s.trivia.timeLimit);
    html += toggleSetting('Show answer after question', 'trivia.showAnswerAfter', s.trivia.showAnswerAfter);
    html += segSetting('Answer mode', 'trivia.answerMode', [['Multiple Choice','choice'],['Write Answer','write']], s.trivia.answerMode || 'choice');
    html += segSetting('Question mode', 'trivia.questionMode', [['Same Question','same'],['Different Questions','different']], s.trivia.questionMode || 'same');
    html += toggleSetting('Allow skipping', 'trivia.allowSkip', s.trivia.allowSkip);
    html += toggleSetting('Wager mode', 'trivia.wagerMode', s.trivia.wagerMode);
    html += toggleSetting('Elimination mode', 'trivia.eliminationMode', s.trivia.eliminationMode);
    html += toggleSetting('Streak multiplier', 'trivia.streakMultiplier', s.trivia.streakMultiplier !== false);
    html += toggleSetting('Negative marking', 'trivia.negativeMarking', s.trivia.negativeMarking);
    html += rangeSetting('Correct pts', 'trivia.correctPts', s.trivia.correctPts ?? 2, 1, 5);
    html += rangeSetting('Only correct bonus', 'trivia.onlyCorrectBonus', s.trivia.onlyCorrectBonus ?? 1, 0, 3);
    html += rangeSetting('Streak bonus', 'trivia.streakBonus', s.trivia.streakBonus ?? 1, 0, 3);
    html += '</div>';
  }
  if (gameType === 'hottake') {
    html += '<div class="setting-group"><div class="setting-group-title">Hot Take</div>';
    html += segSetting('Questions per round', 'hottake.questionsPerRound', [['3',3],['5',5],['10',10]], s.hottake.questionsPerRound);
    html += segSetting('Reveal style', 'hottake.revealStyle', [['All at once','all'],['One by one','one']], s.hottake.revealStyle);
    html += toggleSetting('Allow pass', 'hottake.allowPass', s.hottake.allowPass);
    html += rangeSetting('Minority pts', 'hottake.minorityPts', s.hottake.minorityPts ?? 2, 1, 5);
    html += rangeSetting('Split pts', 'hottake.splitPts', s.hottake.splitPts ?? 1, 0, 3);
    html += '</div>';
  }
  // Reset & About
  html += '<div class="setting-group"><div class="setting-group-title">Data</div>';
  html += '<div class="setting-row"><div class="setting-label">Reset all data</div><button class="btn sm outline" id="btn-settings-reset" style="margin-left:auto;">Reset</button></div>';
  html += '</div>';
  html += '<div class="settings-about"><div class="version">Party Games v1.0</div><div>Built for game nights everywhere.</div></div>';
  $('#settings-content').innerHTML = html;
  $('#settings-title').textContent = gameType ? (gameType.charAt(0).toUpperCase() + gameType.slice(1) + ' Settings') : 'Settings';
  $('#settings-content').querySelectorAll('.seg-btn').forEach(btn => { btn.addEventListener('click', () => { btn.closest('.setting-row').querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); setSettingByPath(btn.dataset.path, btn.dataset.val); saveSettings(); if (btn.dataset.path === 'global.theme') applyTheme(btn.dataset.val); }); });
  $('#settings-content').querySelectorAll('.toggle input').forEach(tog => { tog.addEventListener('change', () => { setSettingByPath(tog.dataset.path, tog.checked); saveSettings(); }); });
  $('#settings-content').querySelectorAll('input[type="range"]').forEach(rng => { rng.addEventListener('input', () => { rng.nextElementSibling.textContent = rng.value; setSettingByPath(rng.dataset.path, rng.value); saveSettings(); }); });
  const resetBtn = $('#btn-settings-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => { showConfirm('Reset All Data?', 'This will clear all saves, settings, and custom packs.', () => { localStorage.clear(); location.reload(); }); });
  $('#settings-overlay').classList.add('open');
}

function rangeSetting(label, path, current, min, max) {
  return '<div class="setting-row"><div class="setting-label">' + label + '</div><div class="setting-range"><input type="range" min="' + min + '" max="' + max + '" value="' + current + '" data-path="' + path + '"><span class="range-val">' + current + '</span></div></div>';
}

function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme || 'dark'); }

/* ══════════════════════════════
   STRINGS (i18n prep)
   ══════════════════════════════ */
const STRINGS = {
  home: { title: 'Party Games', pick: 'Pick a game' },
  session: { addPlayer: 'Add Player', start: 'Start Session', minPlayers: 'Need at least 3 players', maxPlayers: 'Maximum 10 players', nameTaken: 'Name already taken' },
  imposter: { title: 'Imposter', caught: 'Imposter caught!', escaped: 'Imposter escaped!', yourWord: 'Your word is:', yourHint: 'Your hint is:', youAre: 'You are the IMPOSTER!', dontSay: "Don't say it out loud!", discuss: 'Discuss!', vote: 'Vote' },
  trivia: { title: 'Trivia', correct: 'Correct!', wrong: 'Wrong!', finalQ: 'Final Question!', streak: 'Streak' },
  hottake: { title: 'Hot Take', split: 'Perfect Split!', results: 'Results!' },
  common: { home: 'Home', back: 'Back', next: 'Next', close: 'Close', save: 'Save', load: 'Load', settings: 'Settings', confirm: 'Confirm', cancel: 'Cancel', yes: 'Yes', no: 'No' }
};

function segSetting(label, path, options, current) {
  return '<div class="setting-row"><div><div class="setting-label">' + label + '</div></div><div class="seg-btns">' + options.map(([lbl, val]) => '<button class="seg-btn' + (String(val) === String(current) ? ' active' : '') + '" data-path="' + path + '" data-val="' + val + '">' + lbl + '</button>').join('') + '</div></div>';
}
function toggleSetting(label, path, current) {
  return '<div class="setting-row"><div class="setting-label">' + label + '</div><label class="toggle"><input type="checkbox" data-path="' + path + '" ' + (current ? 'checked' : '') + '><span class="toggle-track"></span><span class="toggle-thumb"></span></label></div>';
}
function setSettingByPath(path, val) { const parts = path.split('.'); let obj = gameState.session.settings; for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]]; if (val === 'true') val = true; else if (val === 'false') val = false; else if (!isNaN(val) && val !== '' && typeof val === 'string') val = Number(val); obj[parts[parts.length - 1]] = val; }

/* ══════════════════════════════
   SCOREBOARD
   ══════════════════════════════ */
function renderScoreboard() {
  const players = allPlayers(), sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  $('#scoreboard-rows').innerHTML = sorted.map((p, i) => {
    const total = gameState.scores.byPlayer[p.id] || 0, bg = gameState.scores.byGame[p.id] || {}, color = playerColor(allPlayers().indexOf(p));
    const parts = []; if (bg.imposter) parts.push('Imp:' + bg.imposter); if (bg.trivia) parts.push('Triv:' + bg.trivia); if (bg.hottake) parts.push('HT:' + bg.hottake);
    return '<div class="sb-row"><span class="sb-rank">' + (i === 0 ? '👑' : i + 1) + '</span><div style="flex:1"><span class="sb-name" style="color:' + color + '">' + esc(p.name) + '</span>' + (parts.length ? '<div class="sb-breakdown">' + parts.join(' | ') + '</div>' : '') + '</div><span class="sb-score">' + total + '</span></div>';
  }).join('');
}

/* ══════════════════════════════
   WEB AUDIO SOUND EFFECTS
   ══════════════════════════════ */
let audioCtx = null;
function getAudioCtx() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }

function playSound(type) {
  const s = gameState.session.settings.global;
  if (s.sound === false) return;
  const vol = (s.soundVolume ?? 70) / 100;
  try {
    const ctx = getAudioCtx(), g = ctx.createGain();
    g.connect(ctx.destination); g.gain.value = vol * 0.3;
    if (type === 'correct') {
      [523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(ctx.currentTime + i * 0.1); o.stop(ctx.currentTime + i * 0.1 + 0.15); });
    } else if (type === 'wrong') {
      [400, 300].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(g); o.start(ctx.currentTime + i * 0.15); o.stop(ctx.currentTime + i * 0.15 + 0.2); });
    } else if (type === 'imposterReveal') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(200, ctx.currentTime); o.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.5); o.connect(g); g.gain.value = vol * 0.2; o.start(); o.stop(ctx.currentTime + 0.6);
    } else if (type === 'coinCollect') {
      [1047, 1319].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(ctx.currentTime + i * 0.08); o.stop(ctx.currentTime + i * 0.08 + 0.1); });
    } else if (type === 'timerTick') {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 800; o.connect(g); g.gain.value = vol * 0.1; o.start(); o.stop(ctx.currentTime + 0.03);
    } else if (type === 'fanfare') {
      [523, 659, 784, 1047].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(ctx.currentTime + i * 0.15); o.stop(ctx.currentTime + i * 0.15 + 0.3); });
    } else if (type === 'buttonClick') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 600; o.connect(g); g.gain.value = vol * 0.08; o.start(); o.stop(ctx.currentTime + 0.04);
    }
  } catch {}
}

/* ══════════════════════════════
   CONFETTI
   ══════════════════════════════ */
function launchConfetti() {
  const container = document.createElement('div'); container.className = 'confetti-container';
  const colors = ['#FFD166','#EF6351','#06D6A0','#C1121F','#7c3aed','#06b6d4','#ec4899','#f97316'];
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div'); piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = (Math.random() * 1.5) + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = (6 + Math.random() * 8) + 'px';
    piece.style.height = piece.style.width;
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 5000);
}

/* ══════════════════════════════
   WAKE LOCK
   ══════════════════════════════ */
let wakeLock = null;
async function requestWakeLock() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {} }
function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

/* ══════════════════════════════
   ORIENTATION NUDGE
   ══════════════════════════════ */
function checkOrientation() {
  const banner = $('#orientation-banner');
  if (!banner) return;
  if (window.innerWidth > window.innerHeight && window.innerWidth < 900) {
    banner.classList.add('visible');
    safeTimeout(() => banner.classList.remove('visible'), 3000);
  }
}
window.addEventListener('resize', checkOrientation);

/* ══════════════════════════════
   PHASE TRANSITION OVERLAY
   ══════════════════════════════ */
function showPhaseOverlay(text) {
  const overlay = $('#phase-overlay'), label = $('#phase-label');
  if (!overlay || !label) return;
  label.textContent = text;
  overlay.classList.add('visible');
  safeTimeout(() => overlay.classList.remove('visible'), 800);
}

/* ══════════════════════════════
   FLAVOR TEXT
   ══════════════════════════════ */
const HOME_SUBTITLES = ['Trust no one.', 'Friendships will be tested.', 'May the best bluffer win.', 'Who will crack first?', 'Party time!', 'Knowledge is power.', 'Pick your side wisely.', 'The truth always comes out... eventually.', 'Someone in this room is lying. Probably.', 'Warning: may cause trust issues.', 'Your friends are not who you think they are.', 'Side effects include: paranoia, laughter, and broken friendships.'];
const RESULT_FLAVORS = {
  imposterCaught: ['The crew prevails!', 'Busted!', 'Nothing gets past this group!', 'The truth always comes out!', 'Detective work at its finest!', 'That poker face needed work.', 'The lies crumbled under pressure!', 'Justice is served!', 'Not today, imposter!', 'Elementary, my dear Watson.'],
  imposterEscaped: ['The imposter walks free...', 'Better luck next time!', 'Fooled everyone!', 'The perfect crime.', 'Oscar-worthy performance!', 'The greatest con of all time.', 'They never saw it coming.', 'Trust nobody — especially that one.', 'Living among you this whole time...', 'A masterclass in deception.'],
  triviaClose: ['That was a close one!', 'Photo finish!', 'Down to the wire!'],
  triviaLandslide: ['Absolute domination!', 'Not even close!', 'A true trivia master!'],
  htSplit: ['Perfectly balanced!', 'Great minds think... differently!', 'Split right down the middle!', 'The ultimate stalemate!', 'Agree to disagree!'],
  htLoneWolf: ['One brave soul stands alone!', 'Against all odds!', 'A truly unique opinion!', 'Bold and fearless!', 'Marching to their own beat!', 'A rebel with a cause!'],
  htMajority: ['The people have spoken!', 'Clear winner here!', 'Overwhelming consensus!', 'The crowd follows!', 'Herd mentality at its finest!']
};
function randomFlavor(key) { const arr = RESULT_FLAVORS[key]; return arr ? arr[Math.floor(Math.random() * arr.length)] : ''; }

function typewriterReveal(el, text, speed) {
  speed = speed || 60; el.textContent = ''; let i = 0;
  const cursor = document.createElement('span'); cursor.className = 'typewriter-cursor'; el.appendChild(cursor);
  function tick() { if (i < text.length) { el.insertBefore(document.createTextNode(text[i]), cursor); i++; setTimeout(tick, speed); } else cursor.remove(); }
  tick();
}

function numberRoll(el, target, duration) {
  duration = duration || 500; const start = parseInt(el.textContent) || 0; const diff = target - start; if (diff === 0) { el.textContent = target; return; }
  const startTime = performance.now();
  function step(now) { const elapsed = now - startTime, progress = Math.min(elapsed / duration, 1); el.textContent = Math.round(start + diff * progress); if (progress < 1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}

/* ══════════════════════════════
   SESSION STATS & AWARDS
   ══════════════════════════════ */
function showSessionStats() {
  const players = allPlayers(), scores = gameState.scores, history = scores.history;
  const awards = [];
  // MVP
  const sorted = [...players].sort((a, b) => (scores.byPlayer[b.id] || 0) - (scores.byPlayer[a.id] || 0));
  if (sorted.length > 0) awards.push({ emoji: '👑', title: 'MVP', player: sorted[0].name, value: (scores.byPlayer[sorted[0].id] || 0) + ' pts' });
  // Best Detective (most correct imposter votes)
  const detectiveVotes = {};
  history.filter(h => h.game === 'imposter' && h.reason === 'Correct vote').forEach(h => { detectiveVotes[h.playerId] = (detectiveVotes[h.playerId] || 0) + 1; });
  const bestDet = Object.entries(detectiveVotes).sort((a, b) => b[1] - a[1])[0];
  if (bestDet) { const p = playerById(bestDet[0]); if (p) awards.push({ emoji: '🔍', title: 'Best Detective', player: p.name, value: bestDet[1] + ' correct votes' }); }
  // Contrarian (most minority picks)
  const contrarianPts = {};
  history.filter(h => h.game === 'hottake' && h.reason === 'Minority opinion').forEach(h => { contrarianPts[h.playerId] = (contrarianPts[h.playerId] || 0) + 1; });
  const topContr = Object.entries(contrarianPts).sort((a, b) => b[1] - a[1])[0];
  if (topContr) { const p = playerById(topContr[0]); if (p) awards.push({ emoji: '🦄', title: 'Contrarian', player: p.name, value: topContr[1] + ' minority picks' }); }
  // Lucky Streak
  let maxStreak = 0, streakPlayer = null;
  history.filter(h => h.game === 'trivia').forEach(h => {
    if (h.reason.includes('Streak')) { const m = h.reason.match(/Streak (\d+)/); if (m) { const s = Number(m[1]); if (s > maxStreak) { maxStreak = s; streakPlayer = h.playerId; } } }
  });
  if (streakPlayer && maxStreak >= 3) { const p = playerById(streakPlayer); if (p) awards.push({ emoji: '🔥', title: 'Lucky Streak', player: p.name, value: maxStreak + ' in a row' }); }

  const awardsEl = $('#stats-awards');
  awardsEl.innerHTML = awards.map((a, i) => '<div class="award-card" style="animation-delay:' + (i * 0.15) + 's"><div class="award-emoji">' + a.emoji + '</div><div class="award-title">' + a.title + '</div><div class="award-player">' + esc(a.player) + '</div><div class="award-value">' + a.value + '</div></div>').join('');

  const totalGames = new Set(history.map(h => h.game)).size;
  const totalRounds = history.length;
  $('#stats-summary').textContent = totalGames + ' game type' + (totalGames !== 1 ? 's' : '') + ' played · ' + totalRounds + ' scoring events';

  const container = $('#stats-final-scores'); container.innerHTML = '';
  const maxPts = scores.byPlayer[sorted[0]?.id] || 1;
  sorted.forEach((p, i) => { const pts = scores.byPlayer[p.id] || 0; const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = '<span class="result-name">' + (i === 0 ? '👑 ' : i === sorted.length - 1 && sorted.length > 2 ? '💀 ' : '') + esc(p.name) + '</span><div class="result-bar-track"><div class="result-bar' + (i === 0 ? ' top' : '') + '" style="width:0%"></div></div><span class="result-count">' + pts + '</span>'; container.appendChild(row); });

  showScreen('screen-session-stats');
  playSound('fanfare'); launchConfetti();
  requestAnimationFrame(() => setTimeout(() => { container.querySelectorAll('.result-bar').forEach((bar, i) => { const pts = scores.byPlayer[sorted[i].id] || 0; bar.style.width = maxPts > 0 ? Math.max((pts / maxPts) * 100, 8) + '%' : '0%'; }); }, 100));
}
$('#btn-stats-home').addEventListener('click', goHome);

/* ══════════════════════════════
   SCOREBOARD WITH TRENDS
   ══════════════════════════════ */
let previousScores = {};

function renderScoreboardWithTrends() {
  const players = allPlayers(), sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  $('#scoreboard-rows').innerHTML = sorted.map((p, i) => {
    const total = gameState.scores.byPlayer[p.id] || 0, bg = gameState.scores.byGame[p.id] || {}, color = playerColor(allPlayers().indexOf(p));
    const prev = previousScores[p.id] || 0;
    let trend = '', trendClass = 'same';
    if (total > prev) { trend = '▲'; trendClass = 'up'; } else if (total < prev) { trend = '▼'; trendClass = 'down'; } else { trend = '—'; }
    const parts = []; if (bg.imposter) parts.push('Imp:' + bg.imposter); if (bg.trivia) parts.push('Triv:' + bg.trivia); if (bg.hottake) parts.push('HT:' + bg.hottake);
    const rankIcon = i === 0 ? '👑' : i === sorted.length - 1 && sorted.length > 2 ? '💀' : (i + 1);
    return '<div class="sb-row"><span class="sb-rank">' + rankIcon + '</span><div style="flex:1"><span class="sb-name" style="color:' + color + '">' + esc(p.name) + '</span><span class="sb-trend ' + trendClass + '">' + trend + '</span>' + (parts.length ? '<div class="sb-breakdown">' + parts.join(' | ') + '</div>' : '') + '</div><span class="sb-score">' + total + '</span></div>';
  }).join('');
}

function snapshotScores() { previousScores = {}; allPlayers().forEach(p => { previousScores[p.id] = gameState.scores.byPlayer[p.id] || 0; }); }

function checkWinCondition() {
  const ptw = gameState.session.settings.global.pointsToWin;
  if (!ptw || ptw <= 0) return false;
  const winner = allPlayers().find(p => (gameState.scores.byPlayer[p.id] || 0) >= ptw);
  if (winner) {
    showToast('🏆 ' + winner.name + ' wins with ' + gameState.scores.byPlayer[winner.id] + ' points!', 'success');
    playSound('fanfare'); launchConfetti();
    safeTimeout(() => goHome(), 4000);
    return true;
  }
  return false;
}

function showScoringInfo(game) {
  const s = gameState.session.settings;
  const rules = {
    imposter: '<h3>Imposter Scoring</h3><ul><li>Correct vote: <b>+' + (s.imposter.votePts ?? 1) + '</b></li><li>Unanimous bonus: <b>+' + (s.imposter.unanimousBonus ?? 1) + '</b></li><li>Imposter survives: <b>+' + (s.imposter.survivalPts ?? 3) + '</b></li></ul>',
    trivia: '<h3>Trivia Scoring</h3><ul><li>Correct: <b>+' + (s.trivia.correctPts ?? 2) + '</b></li><li>Only correct: <b>+' + (s.trivia.onlyCorrectBonus ?? 1) + '</b></li><li>Streak 3+: <b>+' + (s.trivia.streakBonus ?? 1) + '</b></li>' + (s.trivia.negativeMarking ? '<li>Wrong: <b>-1</b></li>' : '') + '</ul>',
    hottake: '<h3>Hot Take Scoring</h3><ul><li>Minority: <b>+' + (s.hottake.minorityPts ?? 2) + '</b></li><li>50/50 split: <b>+' + (s.hottake.splitPts ?? 1) + '</b> all</li></ul>'
  };
  $('#info-title').textContent = 'How to Score'; $('#info-content').innerHTML = rules[game] || ''; $('#info-overlay').classList.add('open');
}

/* ══════════════════════════════
   PACK LOADING
   ══════════════════════════════ */
async function loadPacks() {
  // Show shimmer placeholders while loading
  document.querySelectorAll('.pack-cards').forEach(c => { c.innerHTML = '<div class="shimmer" style="height:60px;border-radius:12px;margin-bottom:8px"></div><div class="shimmer" style="height:60px;border-radius:12px;margin-bottom:8px"></div>'; });
  try { const r = await fetch('/api/packs'); gameState.packs = await r.json(); } catch { gameState.packs = {}; }
}

function renderPackCards(containerId, gameType, btnId) {
  const container = $(containerId), btn = $(btnId), list = gameState.packs[gameType] || [];
  if (!list.length) { container.innerHTML = '<div class="empty-state">No packs available. Create one in Content Manager!</div>'; btn.disabled = true; return () => null; }
  container.innerHTML = list.map((p, i) => '<div class="pack-card" data-idx="' + i + '" data-file="' + p.file + '"><span class="pack-card-emoji">' + p.emoji + '</span><div class="pack-card-info"><div class="pack-card-name">' + esc(p.pack) + '</div>' + (gameType !== 'imposter' ? '<div class="pack-card-count">' + p.count + ' questions</div>' : '') + '</div></div>').join('');
  btn.disabled = true; let selectedFile = null;
  container.querySelectorAll('.pack-card').forEach(card => { card.addEventListener('click', () => { container.querySelectorAll('.pack-card').forEach(c => c.classList.remove('selected')); card.classList.add('selected'); selectedFile = card.dataset.file; btn.disabled = false; }); });
  return () => selectedFile;
}

let impGetFile, trivGetFile, htGetFile, mafiaGetFile, millGetFile, feudGetFile, waveGetFile, aliasGetFile, drawGetFile;
function renderAllPackCards() {
  impGetFile = renderPackCards('#imp-packs', 'imposter', '#btn-imp-start');
  trivGetFile = renderPackCards('#triv-packs', 'trivia', '#btn-triv-start');
  htGetFile = renderPackCards('#ht-packs', 'hottake', '#btn-ht-start');
  if ($('#mafia-packs')) mafiaGetFile = renderPackCards('#mafia-packs', 'mafia', '#btn-mafia-start');
  if ($('#mill-packs')) millGetFile = renderPackCards('#mill-packs', 'millionaire', '#btn-mill-start');
  if ($('#feud-packs')) feudGetFile = renderPackCards('#feud-packs', 'feud', '#btn-feud-start');
  if ($('#wave-packs')) waveGetFile = renderPackCards('#wave-packs', 'wavelength', '#btn-wave-start');
  if ($('#alias-packs')) aliasGetFile = renderPackCards('#alias-packs', 'alias', '#btn-alias-start');
  if ($('#draw-packs')) drawGetFile = renderPackCards('#draw-packs', 'drawing', '#btn-draw-start');
}
async function fetchPack(gameType, file) {
  try {
    const res = await fetch('/api/packs/' + gameType + '/' + file);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || typeof data !== 'object') throw new Error('Invalid data');
    return data;
  } catch (e) { showToast('Failed to load pack — it may be corrupted', 'error'); throw e; }
}

/* ══════════════════════════════
   SESSION SETUP
   ══════════════════════════════ */
const sessInput = $('#session-player-input'), sessChips = $('#session-chips'), sessCount = $('#session-count'), sessError = $('#session-player-error'), btnSessStart = $('#btn-session-start');

function renderSessionChips() {
  const names = playerNames();
  sessChips.innerHTML = names.map((n, i) => '<div class="chip" style="background:' + playerColor(i) + '22;border-color:' + playerColor(i) + '44;color:' + playerColor(i) + '">' + esc(n) + '<span class="remove" data-i="' + i + '">&times;</span></div>').join('');
  sessCount.textContent = names.length > 0 ? names.length + ' player' + (names.length !== 1 ? 's' : '') : '';
  sessCount.classList.toggle('hidden', names.length === 0);
  const minRequired = (pendingGame && MIN_PLAYERS[pendingGame]) || 2;
  btnSessStart.disabled = names.length < minRequired;
  initTeamSection();
}

function addSessionPlayer() { // MULTIPLAYER_HOOK: in remote mode, players join via socket, not this function
  const name = sessInput.value.trim(); sessError.classList.add('hidden');
  if (!name) { const funnyErrors = ['You need a name! Even "The Imposter" works...', 'Ghosts don\'t play party games. Enter a name!', 'A name! We need a name! Any name!', 'Even "Player McPlayerface" counts. Try again.']; sessError.textContent = funnyErrors[Math.floor(Math.random() * funnyErrors.length)]; sessError.classList.remove('hidden'); return; }
  if (gameState.session.players.length >= 10) { sessError.textContent = 'Maximum 10 players'; sessError.classList.remove('hidden'); return; }
  if (gameState.session.players.some(p => p.name.toLowerCase() === name.toLowerCase())) { sessError.textContent = 'Name already taken'; sessError.classList.remove('hidden'); return; }
  const player = createPlayer(name); gameState.session.players.push(player); gameState.scores.byPlayer[player.id] = 0;
  sessInput.value = ''; sessInput.focus(); renderSessionChips(); playSound('buttonClick');
  // Animate newest chip
  const chips = sessChips.querySelectorAll('.chip'); if (chips.length > 0) { const last = chips[chips.length - 1]; last.classList.add('chip-new'); last.addEventListener('animationend', () => last.classList.remove('chip-new')); }
}

$('#btn-session-add').addEventListener('click', addSessionPlayer);
sessInput.addEventListener('keydown', e => { if (e.key === 'Enter') addSessionPlayer(); });
sessChips.addEventListener('click', e => { if (e.target.classList.contains('remove')) { const idx = Number(e.target.dataset.i), player = gameState.session.players[idx]; gameState.session.players.splice(idx, 1); delete gameState.scores.byPlayer[player.id]; delete gameState.scores.byGame[player.id]; renderSessionChips(); } });
btnSessStart.addEventListener('click', () => {
  if (pendingGame && GAME_SETUP_SCREENS[pendingGame]) {
    const target = GAME_SETUP_SCREENS[pendingGame];
    pendingGame = null;
    showScreen(target);
  } else { goHome(); }
});
$('#btn-session-back').addEventListener('click', () => { pendingGame = null; goHome(); });
$('#btn-edit-players').addEventListener('click', () => { pendingGame = null; $('#session-subtitle').textContent = 'Add or remove players'; showScreen('screen-session'); });

/* ══════════════════════════════
   MULTI-DEVICE MODE (Unified msg protocol)
   ══════════════════════════════ */
let isMultiDevice = false, socket = null, roomCode = null, hostPlayerId = null;
const deviceId = localStorage.getItem('pg_device_id') || (() => { const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); localStorage.setItem('pg_device_id', id); return id; })();

function sendMsg(type, payload) {
  if (socket) socket.emit('msg', { type, payload, roomCode });
}

// Multiplayer mode button — navigate to multiplayer screen
$('#btn-multiplayer-mode').addEventListener('click', () => {
  isMultiDevice = true;
  showScreen('screen-multiplayer');
});
$('#btn-mp-back').addEventListener('click', () => { isMultiDevice = false; goHome(); });
$('#btn-mp-start').addEventListener('click', () => {
  showToast('Pick a game to play!');
  goHome();
});

$('#btn-create-room').addEventListener('click', () => {
  const hostName = $('#host-name-input').value.trim(); if (!hostName) return;
  if (!socket && typeof io !== 'undefined') socket = io();
  if (!socket) return;
  sendMsg('create_room', { hostName, deviceId, avatar: '🎮' });
  // Listen for all server messages via unified "msg" channel
  socket.on('msg', handleServerMsg);
});

function handleServerMsg(data) {
  if (!data || !data.type) return;
  const { type, payload } = data;
  switch (type) {
    case 'room_created': {
      roomCode = payload.roomCode;
      $('#room-code-display').textContent = payload.roomCode;
      const baseUrl = payload.hostUrl || payload.joinUrl?.split('/join')[0] || '';
      $('#room-url-display').textContent = baseUrl + '/join.html';
      $('#room-display').classList.remove('hidden');
      $('#btn-create-room').disabled = true; $('#host-name-input').disabled = true;
      // Host is first player from server
      gameState.session.players = [];
      renderLobbyPlayers();
      // QR code
      const qrUrl = payload.joinUrl || payload.qrData;
      try {
        if (typeof qrcode !== 'undefined' && qrUrl) {
          const qr = qrcode(0, 'M'); qr.addData(qrUrl); qr.make();
          const canvas = $('#room-qr'), qrCtx = canvas.getContext('2d'), cs = Math.floor(160 / qr.getModuleCount());
          canvas.width = cs * qr.getModuleCount(); canvas.height = canvas.width;
          qrCtx.fillStyle = '#FFF8EE'; qrCtx.fillRect(0, 0, canvas.width, canvas.height);
          qrCtx.fillStyle = '#0a0e27';
          for (let r = 0; r < qr.getModuleCount(); r++) for (let c = 0; c < qr.getModuleCount(); c++) if (qr.isDark(r, c)) qrCtx.fillRect(c * cs, r * cs, cs, cs);
        }
      } catch (e) { console.log('QR not available'); }
      break;
    }
    case 'room_update': {
      const prevCount = gameState.session.players.length;
      gameState.session.players = payload.players.map(p => {
        const existing = playerById(p.id);
        if (existing) { existing.name = p.name; existing.isConnected = p.isConnected; existing.avatar = p.avatar; existing.teamId = p.teamId; existing.ready = p.ready; return existing; }
        gameState.scores.byPlayer[p.id] = gameState.scores.byPlayer[p.id] || 0;
        return { id: p.id, name: p.name, isConnected: p.isConnected, avatar: p.avatar || '🦊', teamId: p.teamId, isHost: p.isHost, ready: p.ready };
      });
      // Set hostPlayerId
      const host = gameState.session.players.find(p => p.isHost);
      if (host) hostPlayerId = host.id;
      renderLobbyPlayers();
      const minPlayers = 2;
      const enoughPlayers = gameState.session.players.filter(p => p.isConnected).length >= minPlayers;
      btnSessStart.disabled = !enoughPlayers;
      const mpStart = $('#btn-mp-start');
      if (mpStart) mpStart.disabled = !enoughPlayers;
      // Play sound on new player join
      if (gameState.session.players.length > prevCount) playSound('coinCollect');
      break;
    }
    case 'player_joined': {
      // Notification toast
      showToast(payload.player.avatar + ' ' + payload.player.name + ' joined!');
      break;
    }
    case 'player_disconnected': {
      showToast(payload.name + ' disconnected');
      break;
    }
    case 'player_reconnected': {
      showToast(payload.name + ' reconnected!');
      break;
    }
    case 'host_disconnected': {
      showToast('Host disconnected — waiting for reconnection...');
      break;
    }
    case 'host_promoted': {
      showToast(payload.name + ' is the new host!');
      break;
    }
    // ── Game action responses from players ──
    case 'player_vote': {
      if (gameState.currentGame === 'mafia') {
        mafiaVotes[payload.playerId] = payload.targetId;
        mafiaVoteCount++;
        const alive = mafiaState.alive;
        const el = $('#host-waiting-count');
        if (el) el.textContent = mafiaVoteCount + '/' + alive.length + ' voted';
        if (mafiaVoteCount >= alive.length) {
          // Tally votes
          const tally = {};
          Object.values(mafiaVotes).forEach(tid => { tally[tid] = (tally[tid] || 0) + 1; });
          const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0 || sorted[0][0] === 'skip') { mafiaStartNight(); }
          else {
            const eliminated = sorted[0][0], ep = playerById(eliminated);
            mafiaState.alive = mafiaState.alive.filter(id => id !== eliminated); mafiaState.eliminated.push(eliminated);
            const aliveMafia = mafiaState.alive.filter(id => mafiaState.roles[id] === 'mafia');
            const aliveTown = mafiaState.alive.filter(id => mafiaState.roles[id] !== 'mafia');
            if (mafiaState.roles[eliminated] === 'jester') { mafiaShowResults('jester', eliminated); }
            else if (aliveMafia.length === 0) { mafiaShowResults('town'); }
            else if (aliveMafia.length >= aliveTown.length) { mafiaShowResults('mafia'); }
            else { mafiaState.dayMsg = (ep?.name || '?') + ' was voted out! They were a ' + mafiaState.roles[eliminated] + '.'; mafiaStartNight(); }
          }
        }
      } else {
        const imp = gameState.imposter;
        imp.votes[payload.targetId] = (imp.votes[payload.targetId] || 0) + 1;
        imp.individualVotes[payload.playerId] = payload.targetId;
        imp.voterIdx++;
        updateHostWaitingCount('imp');
        if (imp.voterIdx >= nonHostPlayers().length) impShowResults();
      }
      break;
    }
    case 'player_answer': {
      if (gameState.currentGame === 'millionaire') {
        // Millionaire: simulate click on the host screen answer
        const idx = payload.answerIdx;
        const btn = $('#mill-answers')?.querySelector('[data-idx="' + idx + '"]');
        if (btn) btn.click();
      } else {
        const triv = gameState.trivia;
        if (!triv.answers[payload.playerId]) triv.answers[payload.playerId] = [];
        triv.answers[payload.playerId].push(payload.answerIdx);
        triv.playerIdx++;
        updateHostWaitingCount('triv');
        if (triv.playerIdx >= nonHostPlayers().length) trivRevealQuestion();
      }
      break;
    }
    case 'player_choice': {
      gameState.hottake.choices[payload.playerId] = payload.choice;
      gameState.hottake.playerIdx++;
      updateHostWaitingCount('ht');
      if (gameState.hottake.playerIdx >= allPlayers().filter(p => !p.isHost || gameState.session.players.length <= 3).length) htShowResults();
      break;
    }
    case 'player_buzz': {
      // Feud face-off buzz
      if (typeof handleFeudBuzz === 'function') handleFeudBuzz(payload);
      break;
    }
    case 'player_slider': {
      // Wavelength guess
      if (typeof handleWaveSlider === 'function') handleWaveSlider(payload);
      break;
    }
    case 'night_action': {
      // Mafia night action
      if (typeof handleMafiaNightAction === 'function') handleMafiaNightAction(payload);
      break;
    }
    case 'player_guess': {
      // Drawing/Alias guess
      if (typeof handlePlayerGuess === 'function') handlePlayerGuess(payload);
      break;
    }
    case 'player_confirmed_clue': {
      handleClueConfirmed(payload);
      break;
    }
    case 'clue_confirm_count': {
      const el = $('#imp-clue-pass-label');
      if (el) el.textContent = 'Clues sent! Waiting for players...\n' + payload.confirmed + '/' + payload.total + ' confirmed';
      break;
    }
    case 'all_clues_confirmed': {
      // Auto-transition host to discussion
      const players = nonHostPlayers();
      $('#btn-imp-show').style.display = '';
      showScreen('screen-imp-discuss');
      $('#imp-discuss-players').innerHTML = players.map((p, i) => '<div class="chip" style="background:' + playerColor(i) + '22;color:' + playerColor(i) + '">' + esc(p.name) + '</div>').join('');
      handleDiscussionTimer();
      sendMsg('next_phase', { phase: 'discussion', data: { players: players.map(p => ({ id: p.id, name: p.name })) } });
      break;
    }
    case 'vote_count_update': {
      const el = $('#host-waiting-count');
      if (el) el.textContent = payload.count + '/' + payload.total + ' voted';
      break;
    }
    case 'all_votes_in': {
      // Server confirms all votes are in — dramatic countdown then reveal
      if (gameState.currentGame === 'imposter') {
        const el = $('#host-waiting-count');
        if (el) {
          let count = 3;
          el.textContent = count + '...';
          const iv = safeInterval(() => {
            count--;
            if (count > 0) el.textContent = count + '...';
            else { clearInterval(iv); _activeTimers.delete(iv); impShowResults(); }
          }, 1000);
        } else impShowResults();
      }
      break;
    }
    case 'chat_message': {
      renderChatMessage(payload);
      break;
    }
    case 'emoji_reaction': {
      showFloatingEmoji(payload.emoji);
      break;
    }
    case 'error': {
      showToast('Error: ' + (payload.message || 'Unknown error'));
      break;
    }
    case 'room_expired': case 'server_closing': {
      showToast(payload.message || 'Room closed');
      isMultiDevice = false; socket = null; roomCode = null;
      goHome();
      break;
    }
  }
}

function updateHostWaitingCount(game) {
  const el = $('#host-waiting-count');
  if (!el) return;
  let answered = 0, total = nonHostPlayers().length;
  if (game === 'imp') answered = gameState.imposter.voterIdx;
  else if (game === 'triv') answered = gameState.trivia.playerIdx;
  else if (game === 'ht') answered = gameState.hottake.playerIdx;
  el.textContent = answered + '/' + total + ' answered';
}

function showToast(msg, type) {
  const ICONS = { success: '✅ ', warning: '⚠️ ', error: '❌ ', info: 'ℹ️ ' };
  // Stack toasts — limit to 3 visible
  const existing = document.querySelectorAll('.toast-notification');
  if (existing.length >= 3) existing[0].remove();
  const toast = document.createElement('div');
  toast.className = 'toast-notification' + (type ? ' ' + type : '');
  toast.textContent = (type && ICONS[type] ? ICONS[type] : '') + msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function showFloatingEmoji(emoji) {
  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  el.style.left = (20 + Math.random() * 60) + '%';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function renderChatMessage(msg) {
  const chatEl = $('#lobby-chat-messages');
  if (!chatEl) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = '<span class="chat-name">' + esc(msg.avatar || '🦊') + ' ' + esc(msg.name) + ':</span> ' + esc(msg.text);
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function renderLobbyPlayers() {
  const el = $('#lobby-players');
  if (!el) return;
  const players = gameState.session.players;
  el.innerHTML = players.map((p, i) => {
    const connected = p.isConnected !== false;
    const tIdx = getPlayerTeam(p.id);
    const teamBadge = teamMode && tIdx >= 0 ? ' <span style="font-size:0.7rem;opacity:0.8;background:' + TEAM_COLORS[tIdx] + '33;padding:1px 5px;border-radius:4px;">' + TEAM_EMOJIS[tIdx] + '</span>' : '';
    return '<div class="lobby-chip' + (!connected ? ' disconnected' : '') + '" style="background:' + playerColor(i) + '22;color:' + playerColor(i) + '">' +
      (p.avatar || '🦊') + ' ' + esc(p.name) +
      (p.isHost ? ' <span class="host-badge">HOST</span>' : '') +
      teamBadge +
      (p.ready ? ' ✓' : '') +
      (!connected ? ' <span style="opacity:0.5">(offline)</span>' : '') +
    '</div>';
  }).join('');
  const countEl = $('#lobby-player-count');
  if (countEl) countEl.textContent = players.length + ' player' + (players.length !== 1 ? 's' : '');
  const hostCtrl = $('#host-controls');
  if (hostCtrl && players.length > 1) hostCtrl.style.display = '';
  // Update team section visibility
  initTeamSection();
}

/* ── Lobby Chat & Emoji ── */
$('#btn-lobby-chat-send')?.addEventListener('click', () => {
  const input = $('#lobby-chat-input'), text = input.value.trim();
  if (!text || !isMultiDevice) return;
  sendMsg('chat_message', { text });
  input.value = '';
});
$('#lobby-chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-lobby-chat-send')?.click(); });
$$('#emoji-bar button').forEach(btn => btn.addEventListener('click', () => {
  if (!isMultiDevice) return;
  sendMsg('emoji_reaction', { emoji: btn.dataset.emoji });
  showFloatingEmoji(btn.dataset.emoji);
}));

/* ── Host Controls ── */
let roomLocked = false;
$('#btn-host-lock')?.addEventListener('click', () => {
  if (!isMultiDevice) return;
  roomLocked = !roomLocked;
  sendMsg('lock_room', { locked: roomLocked });
  $('#btn-host-lock').textContent = roomLocked ? '🔒 Unlock' : '🔓 Lock';
});
$('#btn-host-kick')?.addEventListener('click', () => {
  if (!isMultiDevice) return;
  const players = gameState.session.players.filter(p => !p.isHost);
  if (players.length === 0) return showToast('No players to kick');
  const name = prompt('Enter player name to kick:');
  if (!name) return;
  const target = players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!target) return showToast('Player not found');
  sendMsg('kick_player', { targetId: target.id });
});

/* ══════════════════════════════
   TEAM SYSTEM
   ══════════════════════════════ */
const TEAM_COLORS = ['#FFD166', '#06D6A0', '#EF6351', '#7c3aed'];
const TEAM_NAMES = ['Gold', 'Green', 'Red', 'Purple'];
const TEAM_EMOJIS = ['⭐', '🌿', '🔥', '💜'];
let teamMode = false, teamCount = 2, teams = {}; // teams: { 0: [playerId,...], 1: [...] }

function initTeamSection() {
  const section = $('#team-section');
  if (!section) return;
  const players = allPlayers();
  // Show team section when 4+ players
  if (players.length >= 4) section.classList.remove('hidden');
  else { section.classList.add('hidden'); teamMode = false; return; }
  renderTeamPools();
}

$('#team-toggle')?.addEventListener('change', e => {
  teamMode = e.target.checked;
  $('#team-config').classList.toggle('hidden', !teamMode);
  if (teamMode) renderTeamPools();
  else clearTeams();
});

$$('.team-count-btn').forEach(btn => btn.addEventListener('click', () => {
  $$('.team-count-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  teamCount = Number(btn.dataset.teams);
  clearTeams();
  renderTeamPools();
}));

$('#btn-team-random')?.addEventListener('click', () => {
  const players = shuffle(allPlayers());
  teams = {};
  for (let t = 0; t < teamCount; t++) teams[t] = [];
  players.forEach((p, i) => teams[i % teamCount].push(p.id));
  renderTeamPools();
  syncTeamsToServer();
  playSound('buttonClick');
});

$('#btn-team-balanced')?.addEventListener('click', () => {
  // Balanced: sort by score descending, snake-draft
  const players = [...allPlayers()].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  teams = {};
  for (let t = 0; t < teamCount; t++) teams[t] = [];
  let forward = true;
  let teamIdx = 0;
  players.forEach(p => {
    teams[teamIdx].push(p.id);
    if (forward) { teamIdx++; if (teamIdx >= teamCount) { teamIdx = teamCount - 1; forward = false; } }
    else { teamIdx--; if (teamIdx < 0) { teamIdx = 0; forward = true; } }
  });
  renderTeamPools();
  syncTeamsToServer();
  playSound('buttonClick');
});

$('#btn-team-clear')?.addEventListener('click', () => { clearTeams(); renderTeamPools(); syncTeamsToServer(); });

function clearTeams() {
  teams = {};
  for (let t = 0; t < teamCount; t++) teams[t] = [];
  allPlayers().forEach(p => { p.teamId = null; });
}

function syncTeamsToServer() {
  if (!isMultiDevice || !socket) return;
  const teamDefs = [];
  for (let t = 0; t < teamCount; t++) {
    teamDefs.push({ id: String(t), name: TEAM_NAMES[t], color: TEAM_COLORS[t], emoji: TEAM_EMOJIS[t] });
  }
  const assignments = {};
  for (const [tid, pids] of Object.entries(teams)) assignments[tid] = pids;
  sendMsg('assign_teams', { teams: teamDefs, assignments });
  // Also update local player teamIds
  for (const [tid, pids] of Object.entries(teams)) {
    pids.forEach(pid => { const p = playerById(pid); if (p) p.teamId = String(tid); });
  }
}

function renderTeamPools() {
  const container = $('#team-pools');
  if (!container) return;
  const players = allPlayers();
  const assigned = new Set();
  Object.values(teams).forEach(arr => arr.forEach(id => assigned.add(id)));

  container.innerHTML = '';
  for (let t = 0; t < teamCount; t++) {
    if (!teams[t]) teams[t] = [];
    const pool = document.createElement('div');
    pool.className = 'team-pool';
    pool.dataset.team = t;
    pool.innerHTML = '<div class="team-pool-header"><span class="team-pool-color" style="background:' + TEAM_COLORS[t] + '"></span>' + TEAM_EMOJIS[t] + ' ' + TEAM_NAMES[t] + ' <span style="opacity:0.5;font-weight:400;">(' + teams[t].length + ')</span></div><div class="team-pool-chips" data-team="' + t + '"></div>';
    const chipContainer = pool.querySelector('.team-pool-chips');
    teams[t].forEach(pid => {
      const p = playerById(pid);
      if (!p) return;
      const chip = document.createElement('div');
      chip.className = 'team-pool-chip';
      chip.style.background = TEAM_COLORS[t] + '22';
      chip.style.color = TEAM_COLORS[t];
      chip.textContent = (p.avatar || '🦊') + ' ' + p.name;
      chip.draggable = true;
      chip.dataset.pid = pid;
      chip.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', pid); chip.classList.add('dragging'); });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
      chipContainer.appendChild(chip);
    });
    // Drop zone
    pool.addEventListener('dragover', e => { e.preventDefault(); pool.classList.add('drag-over'); });
    pool.addEventListener('dragleave', () => pool.classList.remove('drag-over'));
    pool.addEventListener('drop', e => {
      e.preventDefault(); pool.classList.remove('drag-over');
      const pid = e.dataTransfer.getData('text/plain');
      // Remove from all teams
      for (const arr of Object.values(teams)) { const idx = arr.indexOf(pid); if (idx >= 0) arr.splice(idx, 1); }
      teams[t].push(pid);
      renderTeamPools();
      syncTeamsToServer();
    });
    container.appendChild(pool);
  }

  // Unassigned players
  const unassigned = players.filter(p => !assigned.has(p.id));
  const unEl = $('#team-unassigned'), unChips = $('#team-unassigned-chips');
  if (unassigned.length > 0 && unEl && unChips) {
    unEl.classList.remove('hidden');
    unChips.innerHTML = '';
    unassigned.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'team-pool-chip';
      chip.style.background = 'var(--surface2)';
      chip.style.color = 'var(--text)';
      chip.textContent = (p.avatar || '🦊') + ' ' + p.name;
      chip.draggable = true;
      chip.dataset.pid = p.id;
      chip.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', p.id); chip.classList.add('dragging'); });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
      unChips.appendChild(chip);
    });
  } else if (unEl) unEl.classList.add('hidden');
}

// Helper: get a player's team index (0-based), or -1
function getPlayerTeam(pid) {
  for (const [tid, pids] of Object.entries(teams)) { if (pids.includes(pid)) return Number(tid); }
  return -1;
}

// Helper: get team members
function getTeamPlayers(teamIdx) {
  const pids = teams[teamIdx] || [];
  return pids.map(pid => playerById(pid)).filter(Boolean);
}

// Helper: get team scores
function getTeamScores() {
  const scores = {};
  for (let t = 0; t < teamCount; t++) {
    scores[t] = (teams[t] || []).reduce((sum, pid) => sum + (gameState.scores.byPlayer[pid] || 0), 0);
  }
  return scores;
}

// Render team score cards (for use during games)
function renderTeamScores(containerId) {
  const el = $(containerId || '#team-score-display');
  if (!el || !teamMode) { if (el) el.innerHTML = ''; return; }
  const scores = getTeamScores();
  el.innerHTML = '';
  for (let t = 0; t < teamCount; t++) {
    el.innerHTML += '<div class="team-score-card" style="border-color:' + TEAM_COLORS[t] + ';"><div class="team-name" style="color:' + TEAM_COLORS[t] + ';">' + TEAM_EMOJIS[t] + ' ' + TEAM_NAMES[t] + '</div><div class="team-pts" style="color:' + TEAM_COLORS[t] + ';">' + (scores[t] || 0) + '</div></div>';
  }
}

// Update team section when player list changes
onStateChange((state, changes) => {
  if (changes && (changes.session || changes.scores)) initTeamSection();
});

/* ══════════════════════════════
   NAVIGATION
   ══════════════════════════════ */
const MIN_PLAYERS = { mafia: 5, feud: 4, imposter: 3, trivia: 2, hottake: 3, millionaire: 2, wavelength: 4, alias: 4, drawing: 3 };
const GAME_SETUP_SCREENS = { imposter: 'screen-imp-setup', trivia: 'screen-triv-setup', hottake: 'screen-ht-setup', playlist: 'screen-playlist', mafia: 'screen-mafia-setup', millionaire: 'screen-mill-setup', feud: 'screen-feud-setup', wavelength: 'screen-wave-setup', alias: 'screen-alias-setup', drawing: 'screen-draw-setup' };
let pendingGame = null;
$$('.game-card').forEach(card => {
  card.addEventListener('click', () => {
    const g = card.dataset.game;
    if (g === 'multiplayer') return; // handled separately
    if (!g || !GAME_SETUP_SCREENS[g]) return;
    // If no players added yet (and not multiplayer mode), go to session screen first
    if (!isMultiDevice && allPlayers().length === 0) {
      pendingGame = g;
      const min = MIN_PLAYERS[g];
      if (min) { btnSessStart.disabled = true; $('#session-subtitle').textContent = 'Add ' + min + '+ players for ' + g.charAt(0).toUpperCase() + g.slice(1); }
      showScreen('screen-session');
      return;
    }
    const min = MIN_PLAYERS[g];
    if (min && allPlayers().length < min) {
      showToast('Need at least ' + min + ' players for ' + g.charAt(0).toUpperCase() + g.slice(1) + '!');
      return;
    }
    showScreen(GAME_SETUP_SCREENS[g]);
  });
});
['btn-imp-home','btn-triv-home','btn-ht-home','btn-pl-home','btn-mafia-home','btn-mill-home','btn-feud-home','btn-alias-home','btn-draw-home'].forEach(id => { const el = $('#' + id); if (el) el.addEventListener('click', goHome); });

// Generic back buttons
$$('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.back;
    if (target === 'confirm') {
      showConfirm('Go Back?', btn.dataset.msg || 'Progress may be lost.', () => goBack());
    } else if (target) {
      showScreen(target, 'back');
    } else {
      goBack();
    }
  });
});

// Breadcrumb click navigation
$('#breadcrumb').addEventListener('click', e => {
  const nav = e.target.dataset.nav;
  if (!nav) return;
  if (nav === 'Home') { goHome(); }
});

/* ══════════════════════════════
   PLAYLIST
   ══════════════════════════════ */
const playlistContainer = $('#playlist-items'), btnPlStart = $('#btn-pl-start');

function renderPlaylist() {
  const pl = gameState.playlist;
  if (pl.length === 0) { playlistContainer.innerHTML = '<div class="playlist-empty">Add games above to build your playlist</div>'; btnPlStart.disabled = true; return; }
  const emojis = { imposter: '🕵️', trivia: '🧠', hottake: '🔥' }, names = { imposter: 'Imposter', trivia: 'Trivia', hottake: 'Hot Take' };
  playlistContainer.innerHTML = pl.map((item, i) => '<div class="playlist-item" draggable="true" data-idx="' + i + '"><span class="drag-handle">☰</span><span style="font-size:1.3rem">' + (emojis[item.gameType] || '?') + '</span><span class="pl-name">' + (names[item.gameType] || item.gameType) + '</span><span class="pl-remove" data-idx="' + i + '">&times;</span></div>').join('');
  btnPlStart.disabled = false; initPlaylistDrag();
}

$$('.playlist-add-btns .btn').forEach(btn => btn.addEventListener('click', () => { gameState.playlist.push({ gameType: btn.dataset.add }); renderPlaylist(); }));

function initPlaylistDrag() {
  let dragIdx = null;
  playlistContainer.querySelectorAll('.playlist-item').forEach(item => {
    item.addEventListener('dragstart', e => { dragIdx = Number(item.dataset.idx); item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend', () => { item.classList.remove('dragging'); dragIdx = null; });
    item.addEventListener('dragover', e => e.preventDefault());
    item.addEventListener('drop', e => { e.preventDefault(); const dropIdx = Number(item.dataset.idx); if (dragIdx !== null && dragIdx !== dropIdx) { const [moved] = gameState.playlist.splice(dragIdx, 1); gameState.playlist.splice(dropIdx, 0, moved); renderPlaylist(); } });
  });
  playlistContainer.querySelectorAll('.pl-remove').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); gameState.playlist.splice(Number(btn.dataset.idx), 1); renderPlaylist(); }));
}

btnPlStart.addEventListener('click', () => { if (gameState.playlist.length === 0) return; gameState.playlistIdx = 0; startPlaylistGame(); });
function startPlaylistGame() {
  const item = gameState.playlist[gameState.playlistIdx]; if (!item) { showPlaylistComplete(); return; }
  gameState.currentGame = item.gameType;
  const screenMap = { imposter: 'screen-imp-setup', trivia: 'screen-triv-setup', hottake: 'screen-ht-setup', mafia: 'screen-mafia-setup', millionaire: 'screen-mill-setup', feud: 'screen-feud-setup', wavelength: 'screen-wave-setup', alias: 'screen-alias-setup', drawing: 'screen-draw-setup' };
  showScreen(screenMap[item.gameType] || 'screen-home');
}
function advancePlaylist() { gameState.playlistIdx++; if (gameState.playlistIdx >= gameState.playlist.length) showPlaylistComplete(); else startPlaylistGame(); }

function showPlaylistComplete() {
  const players = allPlayers(), sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  const maxPts = gameState.scores.byPlayer[sorted[0]?.id] || 1, container = $('#pl-final-scores'); container.innerHTML = '';
  sorted.forEach((p, i) => { const pts = gameState.scores.byPlayer[p.id] || 0; const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = '<span class="result-name">' + (i === 0 ? '👑 ' : '') + esc(p.name) + '</span><div class="result-bar-track"><div class="result-bar' + (i === 0 ? ' top' : '') + '" style="width:0%"></div></div><span class="result-count">' + pts + '</span>'; container.appendChild(row); });
  showScreen('screen-playlist-complete'); playSound('fanfare'); launchConfetti();
  requestAnimationFrame(() => setTimeout(() => { container.querySelectorAll('.result-bar').forEach((bar, i) => { const pts = gameState.scores.byPlayer[sorted[i].id] || 0; bar.style.width = maxPts > 0 ? Math.max((pts / maxPts) * 100, 8) + '%' : '0%'; }); }, 100));
}

$('#btn-pl-complete-home').addEventListener('click', () => { gameState.playlist = []; gameState.playlistIdx = -1; goHome(); });
$('#btn-pl-complete-stats').addEventListener('click', () => { gameState.playlist = []; gameState.playlistIdx = -1; showSessionStats(); });
function isInPlaylist() { return gameState.playlistIdx >= 0 && gameState.playlist.length > 0; }

function setupResultButtons(homeBtnId, againBtnId, setupScreenId) {
  const homeBtn = $(homeBtnId), againBtn = $(againBtnId);
  if (isInPlaylist()) { const isLast = gameState.playlistIdx >= gameState.playlist.length - 1; homeBtn.textContent = isLast ? 'Finish' : 'Next Game'; homeBtn.onclick = () => advancePlaylist(); if (againBtn) againBtn.classList.add('hidden'); }
  else { homeBtn.textContent = 'Home'; homeBtn.onclick = () => goHome(); if (againBtn) againBtn.classList.remove('hidden'); }
}

/* ════════════════════════════
   IMPOSTER GAME
   ════════════════════════════ */
let clueConfirmCount = 0;
function handleClueConfirmed(payload) {
  clueConfirmCount++;
  const total = nonHostPlayers().length;
  const el = $('#imp-clue-pass-label');
  if (el) el.textContent = 'Clues sent! Waiting for players...\n' + clueConfirmCount + '/' + total + ' confirmed';
}
$('#btn-imp-start').addEventListener('click', async () => {
  const file = impGetFile(); if (!file) return;
  requestWakeLock(); checkOrientation();
  const data = await fetchPack('imposter', file).catch(() => null); if (!data || !data.rounds || !data.rounds.length) return;
  const imp = gameState.imposter;
  imp.rounds = shuffle(data.rounds); const round = imp.rounds[0]; imp.word = round.word; imp.hint = round.hint; imp.rounds.push(imp.rounds.shift()); imp.roundNum++;
  gameState.currentGame = 'imposter';
  const playerPool = nonHostPlayers(), count = gameState.session.settings.imposter.imposterCount, indices = [];
  while (indices.length < Math.min(count, playerPool.length - 1)) { const r = Math.floor(Math.random() * playerPool.length); if (!indices.includes(r)) indices.push(r); }
  imp.imposterIndices = indices; imp.clueIdx = 0; imp.votes = {}; imp.individualVotes = {};
  playerPool.forEach(p => { imp.votes[p.id] = 0; imp.individualVotes[p.id] = ''; }); imp.voterIdx = 0;
  if (isMultiDevice && socket) sendMsg('start_game', { gameType: 'imposter', settings: gameState.session.settings, gameState: { imposter: gameState.imposter } });
  impShowPass();
});

const impScreen = $('#screen-imp-clue');

function impShowPass() {
  if (isMultiDevice && socket) {
    // Host screen shows waiting UI while players get clues on their devices
    showScreen('screen-imp-clue');
    $('#imp-clue-pass').classList.remove('hidden'); $('#imp-clue-show').classList.add('hidden'); $('#imp-clue-hidden').classList.add('hidden');
    impScreen.classList.remove('showing-clue', 'crew', 'imposter');
    $('#imp-clue-name').textContent = '📱';
    $('#btn-imp-show').style.display = 'none';
    // Send clues only to non-host players
    const players = nonHostPlayers(), imp = gameState.imposter, mode = gameState.session.settings.imposter.imposterMode;
    clueConfirmCount = 0;
    $('#imp-clue-pass-label').textContent = 'Clues sent! Waiting for players...\n0/' + players.length + ' confirmed';
    players.forEach((player, idx) => {
      const isImp = imp.imposterIndices.includes(idx);
      let clueData;
      if (isImp) clueData = mode === 'told' ? { role: 'imposter', text: 'Blend in!', sub: 'You do NOT know the word' } : mode === 'none' ? { role: 'imposter', text: 'No hints!', sub: 'Figure it out on your own...' } : { role: 'imposter', text: imp.hint, sub: 'You might be the imposter...' };
      else clueData = { role: 'crew', text: imp.word.toUpperCase(), sub: "Don't say it out loud!" };
      sendMsg('send_to_player', { playerId: player.id, event: 'your_clue', data: clueData });
    });
    // Wait for all_clues_confirmed from server (no auto-advance)
    return;
  }
  showScreen('screen-imp-clue');
  $('#imp-clue-pass').classList.remove('hidden'); $('#imp-clue-show').classList.add('hidden'); $('#imp-clue-hidden').classList.add('hidden');
  impScreen.classList.remove('showing-clue', 'crew', 'imposter');
  const pIdx = gameState.imposter.clueIdx; $('#imp-clue-name').textContent = allPlayers()[pIdx].name;
  $('#imp-clue-pass-label').textContent = pIdx === 0 ? 'Hand the device to' : 'Pass the device to';
}

$('#btn-imp-show').addEventListener('click', () => {
  const imp = gameState.imposter, isImp = imp.imposterIndices.includes(imp.clueIdx);
  $('#imp-clue-pass').classList.add('hidden'); $('#imp-clue-show').classList.remove('hidden');
  const display = $('#imp-clue-display'); display.classList.remove('visible');
  const mode = gameState.session.settings.imposter.imposterMode;
  const blank = gameState.session.settings.imposter.blankScreen;
  if (isImp && blank) {
    impScreen.classList.add('showing-clue'); impScreen.classList.remove('crew', 'imposter');
    $('#imp-clue-icon').textContent = ''; $('#imp-clue-main').textContent = ''; $('#imp-clue-main').style.fontSize = ''; $('#imp-clue-sub').textContent = '';
  } else if (isImp) {
    impScreen.classList.add('showing-clue'); impScreen.classList.remove('crew'); impScreen.classList.add('imposter');
    if (mode === 'told') { $('#imp-clue-icon').textContent = '🔴 You are the IMPOSTER!'; $('#imp-clue-main').textContent = 'Blend in!'; $('#imp-clue-main').style.fontSize = 'clamp(1.3rem,5vw,2.5rem)'; $('#imp-clue-sub').textContent = 'You do NOT know the word'; }
    else { $('#imp-clue-icon').textContent = '🔴 Your hint is:'; $('#imp-clue-main').textContent = imp.hint; $('#imp-clue-main').style.fontSize = 'clamp(1.3rem,5vw,2.5rem)'; $('#imp-clue-sub').textContent = 'You might be the imposter...'; }
  } else {
    impScreen.classList.add('showing-clue'); impScreen.classList.add('crew'); impScreen.classList.remove('imposter');
    $('#imp-clue-icon').textContent = '🟢 Your word is:'; typewriterReveal($('#imp-clue-main'), imp.word.toUpperCase(), 80); $('#imp-clue-main').style.fontSize = ''; $('#imp-clue-sub').textContent = "Don't say it out loud!";
  }
  requestAnimationFrame(() => display.classList.add('visible'));
});
$('#btn-imp-hide-pass').addEventListener('click', () => impShowHidden());

function impShowHidden() {
  const imp = gameState.imposter, players = allPlayers();
  $('#imp-clue-show').classList.add('hidden'); $('#imp-clue-hidden').classList.remove('hidden');
  impScreen.classList.remove('showing-clue', 'crew', 'imposter');
  const isLast = imp.clueIdx >= players.length - 1;
  $('#imp-clue-next-label').textContent = isLast ? "Everyone has seen their clue!" : 'Pass to ' + players[imp.clueIdx + 1].name;
  $('#btn-imp-next').textContent = isLast ? 'Start Discussion' : 'Next Player';
}

$('#btn-imp-next').addEventListener('click', () => {
  gameState.imposter.clueIdx++; const players = allPlayers();
  if (gameState.imposter.clueIdx >= players.length) {
    $('#imp-discuss-players').innerHTML = players.map((p, i) => '<div class="chip" style="background:' + playerColor(i) + '22;color:' + playerColor(i) + '">' + esc(p.name) + '</div>').join('');
    handleDiscussionTimer(); showScreen('screen-imp-discuss');
  } else impShowPass();
});

function handleDiscussionTimer() {
  showPhaseOverlay('🗣️ DISCUSSION');
  const roundBadge = $('#imp-discuss-round');
  if (roundBadge) roundBadge.textContent = 'Round ' + gameState.imposter.roundNum;
  const timerSec = gameState.session.settings.imposter.discussionTimer, timerEl = $('#imp-discuss-timer');
  const barTrack = $('#imp-discuss-bar-track'), bar = $('#imp-discuss-bar');
  if (timerSec > 0) {
    timerEl.classList.remove('hidden'); barTrack.classList.remove('hidden');
    let rem = timerSec; const fmt = s => Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
    timerEl.textContent = fmt(rem); bar.style.width = '100%'; bar.className = 'timer-bar';
    const iv = safeInterval(() => {
      rem--; timerEl.textContent = fmt(rem);
      const pct = (rem / timerSec) * 100; bar.style.width = pct + '%';
      if (pct < 25) bar.className = 'timer-bar danger';
      else if (pct < 50) bar.className = 'timer-bar warn';
      if (rem <= 0) { clearInterval(iv); timerEl.textContent = "Time's up!"; bar.style.width = '0%'; }
    }, 1000);
  } else { timerEl.classList.add('hidden'); barTrack.classList.add('hidden'); }
}

// Safe player toggle during discussion
$('#imp-discuss-players').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (chip) chip.classList.toggle('safe');
});

// Confidence slider
$('#imp-confidence-slider').addEventListener('input', e => { $('#imp-confidence-val').textContent = e.target.value; });

$('#btn-imp-vote').addEventListener('click', () => {
  showPhaseOverlay('🗳️ VOTING');
  gameState.imposter.voterIdx = 0;
  if (isMultiDevice && socket) { const np = nonHostPlayers(); sendMsg('host_update', { event: 'voting_open', players: np.map(p => ({ id: p.id, name: p.name })) }); showScreen('screen-imp-vote'); $('#imp-vote-label').textContent = '🗳️ Players are voting...'; $('#imp-vote-name').textContent = ''; $('#imp-vote-grid').innerHTML = '<div id="host-waiting-count" class="host-waiting">0/' + np.length + ' voted</div>'; return; }
  impShowVoter();
});

function impShowVoter() { // MULTIPLAYER_HOOK: in remote mode, voting happens on player devices via socket
  showScreen('screen-imp-vote'); const imp = gameState.imposter, players = nonHostPlayers(), voter = players[imp.voterIdx];
  $('#imp-vote-label').textContent = '👆 ' + voter.name + "'s turn"; $('#imp-vote-name').textContent = 'Tap who you think is the IMPOSTER';
  const progress = $('#imp-vote-progress'); if (progress) progress.textContent = 'Vote ' + (imp.voterIdx + 1) + ' of ' + players.length;
  const confirm = $('#imp-vote-confirm'); if (confirm) confirm.classList.add('hidden');
  const grid = $('#imp-vote-grid');
  grid.innerHTML = players.filter(p => p.id !== voter.id).map(p => '<button class="vote-btn" data-id="' + p.id + '">' + esc(p.name) + '</button>').join('');
  grid.querySelectorAll('.vote-btn').forEach(btn => { btn.addEventListener('click', () => {
    const targetName = btn.textContent;
    imp.votes[btn.dataset.id] = (imp.votes[btn.dataset.id] || 0) + 1; imp.individualVotes[voter.id] = btn.dataset.id;
    // Disable all buttons and show confirmation
    grid.querySelectorAll('.vote-btn').forEach(b => b.disabled = true);
    if (confirm) { confirm.textContent = '✓ ' + voter.name + ' voted for ' + targetName; confirm.classList.remove('hidden'); }
    safeTimeout(() => { imp.voterIdx++; if (imp.voterIdx >= players.length) impShowResults(); else impShowVoter(); }, 1000);
  }); });
}

function impShowResults() {
  const imp = gameState.imposter, players = nonHostPlayers(), imposterPlayers = imp.imposterIndices.map(i => players[i]), impNames = imposterPlayers.map(p => p.name).join(' & ');
  snapshotScores();
  const { caught, breakdown } = scoreImposterRound();
  playSound('imposterReveal');
  const sorted = Object.entries(imp.votes).filter(([,c]) => c > 0).sort((a, b) => b[1] - a[1]);
  const maxV = sorted.length > 0 ? sorted[0][1] : 0;
  const emojiEl = $('#imp-res-emoji'), textEl = $('#imp-res-text');
  emojiEl.textContent = caught ? '🎉' : '😈'; textEl.textContent = (caught ? 'Imposter caught!' : 'Imposter escaped!') + ' ' + randomFlavor(caught ? 'imposterCaught' : 'imposterEscaped');
  emojiEl.classList.remove('dramatic-reveal'); textEl.classList.remove('dramatic-reveal');
  void emojiEl.offsetWidth; emojiEl.classList.add('dramatic-reveal'); textEl.classList.add('dramatic-reveal');
  $('#imp-res-imposter').textContent = 'The imposter' + (imposterPlayers.length > 1 ? 's were' : ' was') + ': ' + impNames;
  const wordEl = $('#imp-res-word'); wordEl.textContent = '';
  typewriterReveal(wordEl, 'The secret word was: ' + imp.word.toUpperCase(), 50);
  const tally = $('#imp-res-tally'); tally.innerHTML = '';
  const allEntries = players.map(p => [p, imp.votes[p.id] || 0]);
  allEntries.forEach(([p, count]) => { const isTop = count === maxV && count > 0, isImp = imp.imposterIndices.includes(players.indexOf(p)); const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = '<span class="result-name">' + esc(p.name) + (isImp ? ' 🔴' : '') + '</span><div class="result-bar-track"><div class="result-bar' + (isTop ? ' top' : '') + '" style="width:0%"></div></div><span class="result-count">' + count + '</span>'; tally.appendChild(row); });
  // Show who voted for whom
  const voteEntries = Object.entries(imp.individualVotes).filter(([,t]) => t);
  if (voteEntries.length > 0) {
    const voteDiv = document.createElement('div'); voteDiv.className = 'vote-map';
    voteDiv.innerHTML = '<div class="vote-map-title">Who voted for whom</div>' +
      voteEntries.map(([voterId, targetId]) => {
        const v = players.find(p => p.id === voterId), t = players.find(p => p.id === targetId);
        if (!v || !t) return '';
        const isImpTarget = imp.imposterIndices.includes(players.indexOf(t));
        return '<div class="vote-map-row"><span>' + esc(v.name) + '</span><span>→</span><span' + (isImpTarget ? ' style="color:var(--red)"' : '') + '>' + esc(t.name) + (isImpTarget ? ' 🔴' : '') + '</span></div>';
      }).filter(Boolean).join('');
    tally.after(voteDiv);
  }
  renderBreakdown('#imp-res-breakdown', breakdown); setupResultButtons('#btn-imp-home2', '#btn-imp-again', 'screen-imp-setup');
  showScreen('screen-imp-results'); autoSave(); checkWinCondition();
  requestAnimationFrame(() => { tally.querySelectorAll('.result-bar').forEach((bar, i) => { const count = allEntries[i][1], pct = maxV > 0 ? (count / maxV) * 100 : 0; safeTimeout(() => { bar.style.width = pct > 0 ? Math.max(pct, 8) + '%' : '0%'; }, 200 + i * 200); }); });
  if (isMultiDevice && socket) sendMsg('host_update', { event: 'round_result', data: { caught, breakdown, impNames, word: imp.word } });
}

$('#btn-imp-again').addEventListener('click', () => showScreen('screen-imp-setup'));

/* ════════════════════════════
   TRIVIA GAME
   ════════════════════════════ */
let trivTimerInterval = null;

$('#btn-triv-start').addEventListener('click', async () => {
  const file = trivGetFile(); if (!file) return;
  requestWakeLock(); checkOrientation();
  const triv = gameState.trivia, settings = gameState.session.settings.trivia, qCount = settings.questionsPerRound;
  let questions;
  if (file === '__custom__' && triv.customQuestions && triv.customQuestions.length > 0) {
    questions = shuffle([...triv.customQuestions]);
  } else {
    const data = await fetchPack('trivia', file);
    questions = shuffle(data.questions);
  }
  // For 'different' mode, need more questions (qCount * numPlayers)
  const needCount = settings.questionMode === 'different' ? Math.min(qCount * allPlayers().length, questions.length) : qCount;
  triv.questions = questions.slice(0, needCount); triv.qIdx = 0; triv.answers = {}; triv.roundNum++;
  gameState.currentGame = 'trivia'; allPlayers().forEach(p => triv.answers[p.id] = []); gameState.scores.streaks = {};
  trivStartQuestion();
});

function trivStartQuestion() {
  gameState.trivia.playerIdx = 0;
  const flash = $('#answer-flash'); if (flash) { flash.classList.remove('visible', 'correct', 'wrong'); flash.textContent = ''; }
  if (isMultiDevice && socket) {
    // Show question on host screen (Kahoot-style) + send to player devices
    const triv = gameState.trivia, q = triv.questions[triv.qIdx];
    const isFinal = triv.qIdx === triv.questions.length - 1;
    sendMsg('start_game', { gameType: 'trivia', settings: gameState.session.settings });
    allPlayers().forEach(p => {
      sendMsg('send_to_player', { playerId: p.id, event: 'trivia_question', data: { question: q.question, answers: q.answers, qNum: triv.qIdx + 1, total: triv.questions.length, timeLimit: gameState.session.settings.trivia.timeLimit } });
    });
    // Show question on host screen with all answers visible
    showScreen('screen-triv-question');
    $('#triv-final-banner').classList.toggle('hidden', !isFinal);
    $('#triv-q-num').textContent = 'Question ' + (triv.qIdx + 1) + ' of ' + triv.questions.length;
    $('#triv-q-text').textContent = q.question;
    const grid = $('#triv-answers');
    grid.innerHTML = q.answers.map((opt, i) => '<button class="answer-btn" data-idx="' + i + '" disabled>' + esc(opt) + '</button>').join('') +
      '<div id="host-waiting-count" class="host-waiting" style="margin-top:16px;">0/' + allPlayers().length + ' answered</div>';
    // Timer
    const settings = gameState.session.settings.trivia;
    const timerEl = $('#triv-timer'), barTrack = $('#triv-timer-bar-track'), bar = $('#triv-timer-bar');
    if (trivTimerInterval) clearInterval(trivTimerInterval);
    if (settings.timeLimit > 0) {
      timerEl.classList.remove('hidden'); barTrack.classList.remove('hidden');
      let rem = settings.timeLimit; const total = settings.timeLimit;
      timerEl.textContent = rem + 's'; bar.style.width = '100%'; bar.className = 'timer-bar';
      trivTimerInterval = safeInterval(() => {
        rem--; timerEl.textContent = rem + 's';
        const pct = (rem / total) * 100; bar.style.width = pct + '%';
        if (pct < 25) bar.className = 'timer-bar danger'; else if (pct < 50) bar.className = 'timer-bar warn';
        if (rem <= 0) { clearInterval(trivTimerInterval); trivTimerInterval = null; trivRevealQuestion(); }
      }, 1000);
    } else { timerEl.classList.add('hidden'); barTrack.classList.add('hidden'); }
    return;
  }
  trivShowPass();
}
function trivShowPass() {
  showScreen('screen-triv-pass'); const triv = gameState.trivia, settings = gameState.session.settings.trivia;
  $('#triv-pass-name').textContent = allPlayers()[triv.playerIdx].name;
  if (settings.questionMode === 'different') {
    $('#triv-q-preview').textContent = 'Your question (' + (triv.playerIdx + 1) + ' of ' + allPlayers().length + ')';
  } else {
    $('#triv-q-preview').textContent = 'Question ' + (triv.qIdx + 1) + ' of ' + triv.questions.length;
  }
}

$('#btn-triv-ready').addEventListener('click', () => {
  showScreen('screen-triv-question'); const triv = gameState.trivia, players = allPlayers(), q = triv.questions[triv.qIdx], settings = gameState.session.settings.trivia;
  const isFinal = triv.qIdx === triv.questions.length - 1;
  $('#triv-final-banner').classList.toggle('hidden', !isFinal);
  $('#triv-q-num').textContent = 'Question ' + (triv.qIdx + 1) + ' of ' + triv.questions.length + ' — ' + players[triv.playerIdx].name + "'s turn";
  $('#triv-q-text').textContent = q.question;
  if (settings.allowSkip) $('#btn-triv-skip').classList.remove('hidden'); else $('#btn-triv-skip').classList.add('hidden');
  const timerEl = $('#triv-timer'), barTrack = $('#triv-timer-bar-track'), bar = $('#triv-timer-bar');
  if (trivTimerInterval) clearInterval(trivTimerInterval);
  if (settings.timeLimit > 0) {
    timerEl.classList.remove('hidden'); barTrack.classList.remove('hidden');
    let rem = settings.timeLimit; const total = settings.timeLimit;
    timerEl.textContent = rem + 's'; bar.style.width = '100%'; bar.className = 'timer-bar';
    trivTimerInterval = safeInterval(() => {
      rem--; timerEl.textContent = rem + 's';
      const pct = (rem / total) * 100; bar.style.width = pct + '%';
      if (pct < 25) bar.className = 'timer-bar danger';
      else if (pct < 50) bar.className = 'timer-bar warn';
      if (rem <= 0) { clearInterval(trivTimerInterval); trivTimerInterval = null; trivSubmitAnswer(-1); }
    }, 1000);
  } else { timerEl.classList.add('hidden'); barTrack.classList.add('hidden'); }
  const grid = $('#triv-answers');
  if (settings.answerMode === 'write') {
    grid.innerHTML = '<input class="input-full" id="triv-write-input" placeholder="Type your answer..." autocomplete="off"><button class="btn big" id="btn-triv-submit-write" style="margin-top:12px">Submit</button>';
    const submitWrite = () => {
      if (trivTimerInterval) { clearInterval(trivTimerInterval); trivTimerInterval = null; }
      const input = $('#triv-write-input'), val = (input.value || '').trim().toLowerCase(), correctText = q.answers[q.correct].toLowerCase();
      const isCorrect = val === correctText || (val.length > 2 && correctText.includes(val));
      input.disabled = true; $('#btn-triv-submit-write').disabled = true;
      if (isCorrect) { input.style.borderColor = 'var(--green)'; playSound('correct'); } else { input.style.borderColor = 'var(--red)'; playSound('wrong'); }
      grid.innerHTML += '<div style="margin-top:8px;font-weight:700;color:var(--green)">✓ ' + esc(q.answers[q.correct]) + '</div>';
      setTimeout(() => trivSubmitAnswer(isCorrect ? q.correct : -1), 1000);
    };
    $('#btn-triv-submit-write').addEventListener('click', submitWrite);
    $('#triv-write-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitWrite(); });
    safeTimeout(() => { const inp = $('#triv-write-input'); if (inp) inp.focus(); }, 100);
  } else {
    grid.innerHTML = q.answers.map((opt, i) => '<button class="answer-btn" data-idx="' + i + '">' + esc(opt) + '</button>').join('');
    grid.querySelectorAll('.answer-btn').forEach(btn => { btn.addEventListener('click', () => {
      if (trivTimerInterval) { clearInterval(trivTimerInterval); trivTimerInterval = null; }
      const idx = Number(btn.dataset.idx), correct = q.correct;
      grid.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);
      if (idx === correct) { btn.classList.add('correct'); playSound('correct'); } else { btn.classList.add('wrong'); playSound('wrong'); grid.querySelector('.answer-btn[data-idx="' + correct + '"]').classList.add('correct'); }
      setTimeout(() => trivSubmitAnswer(idx), 600);
    }); });
  }
});

$('#btn-triv-skip').addEventListener('click', () => { if (trivTimerInterval) { clearInterval(trivTimerInterval); trivTimerInterval = null; } trivSubmitAnswer(-1); });

function trivSubmitAnswer(ansIdx) { // MULTIPLAYER_HOOK: in remote mode, answers come via socket player_answer events
  const triv = gameState.trivia, players = allPlayers(), settings = gameState.session.settings.trivia;
  triv.answers[players[triv.playerIdx].id].push(ansIdx);
  if (settings.questionMode === 'different') {
    // In 'different' mode, each player gets a unique question — score immediately and advance
    const q = triv.questions[triv.qIdx];
    snapshotScores(); scoreTriviaQuestion(q, triv.qIdx);
    triv.playerIdx++; triv.qIdx++;
    if (triv.playerIdx >= players.length) trivShowFinalResults();
    else if (triv.qIdx >= triv.questions.length) trivShowFinalResults();
    else trivShowPass();
  } else {
    triv.playerIdx++; if (triv.playerIdx >= players.length) trivRevealQuestion(); else trivShowPass();
  }
}

function trivRevealQuestion() {
  const triv = gameState.trivia, q = triv.questions[triv.qIdx], settings = gameState.session.settings.trivia;
  if (!settings.showAnswerAfter) { snapshotScores(); scoreTriviaQuestion(q, triv.qIdx); triv.qIdx++; if (triv.qIdx >= triv.questions.length) trivShowFinalResults(); else trivStartQuestion(); return; }
  const correct = q.correct, players = allPlayers();
  $('#triv-reveal-q-num').textContent = 'Question ' + (triv.qIdx + 1) + ' of ' + triv.questions.length;
  $('#triv-reveal-q').textContent = q.question; $('#triv-reveal-answer').textContent = '✓ ' + q.answers[correct];
  // Show explanation if available
  const explEl = $('#triv-explanation');
  if (q.explanation) { explEl.textContent = q.explanation; explEl.classList.remove('hidden'); }
  else explEl.classList.add('hidden');
  snapshotScores(); scoreTriviaQuestion(q, triv.qIdx);
  const container = $('#triv-reveal-results'); container.innerHTML = '';
  players.forEach((p, i) => { const ans = triv.answers[p.id][triv.qIdx], isCorrect = ans === correct, color = playerColor(i); const row = document.createElement('div'); row.className = 'result-row'; const ansText = ans >= 0 ? q.answers[ans] : 'Skipped'; row.innerHTML = '<span class="result-name" style="color:' + color + '">' + esc(p.name) + '</span><div style="flex:1;font-weight:700;color:' + (isCorrect ? 'var(--green)' : 'var(--red)') + ';">' + (isCorrect ? '✓ Correct' : '✗ ' + esc(ansText)) + '</div>'; container.appendChild(row); });
  // Mini scoreboard
  const miniScores = $('#triv-mini-scores');
  const sortedPlayers = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  miniScores.innerHTML = sortedPlayers.map((p, i) => {
    const pts = gameState.scores.byPlayer[p.id] || 0, color = playerColor(players.indexOf(p));
    return '<div class="mini-score-chip" style="background:' + color + '22;color:' + color + '">' + esc(p.name) + ' ' + pts + '</div>';
  }).join('');
  // Flash correct answer
  const flash = $('#answer-flash');
  if (flash) { flash.textContent = '✓ ' + q.answers[correct]; flash.className = 'answer-flash correct visible'; safeTimeout(() => flash.classList.remove('visible'), 800); }
  showScreen('screen-triv-reveal'); $('#triv-reveal-answer').classList.add('card-flip'); setTimeout(() => $('#triv-reveal-answer').classList.remove('card-flip'), 600);
  // Check for lead change → confetti
  const leader = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0))[0];
  const prevLeader = Object.entries(previousScores).sort((a, b) => b[1] - a[1])[0];
  if (prevLeader && leader && prevLeader[0] !== leader.id && (gameState.scores.byPlayer[leader.id] || 0) > 0) launchConfetti();
  $('#btn-triv-next-q').textContent = triv.qIdx >= triv.questions.length - 1 ? 'See Final Results' : 'Next Question';
}

$('#btn-triv-next-q').addEventListener('click', () => { gameState.trivia.qIdx++; if (gameState.trivia.qIdx >= gameState.trivia.questions.length) trivShowFinalResults(); else trivStartQuestion(); });

function trivShowFinalResults() {
  const players = allPlayers(), sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  const topPts = gameState.scores.byPlayer[sorted[0]?.id] || 0, secondPts = gameState.scores.byPlayer[sorted[1]?.id] || 0;
  const flavorKey = (topPts - secondPts) > 3 ? 'triviaLandslide' : 'triviaClose';
  $('#triv-res-summary').textContent = sorted[0].name + ' leads with ' + topPts + ' total points! ' + randomFlavor(flavorKey);
  playSound('fanfare'); launchConfetti();
  const container = $('#triv-res-list'); container.innerHTML = ''; const maxPts = topPts || 1;
  sorted.forEach(p => { const pts = gameState.scores.byPlayer[p.id] || 0; const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = '<span class="result-name">' + esc(p.name) + '</span><div class="result-bar-track"><div class="result-bar' + (pts === topPts ? ' top' : '') + '" style="width:0%"></div></div><span class="result-count">' + pts + '</span>'; container.appendChild(row); });
  setupResultButtons('#btn-triv-home2', '#btn-triv-again', 'screen-triv-setup');
  showScreen('screen-triv-results'); autoSave(); checkWinCondition();
  requestAnimationFrame(() => setTimeout(() => { container.querySelectorAll('.result-bar').forEach((bar, i) => { const pts = gameState.scores.byPlayer[sorted[i].id] || 0; bar.style.width = maxPts > 0 ? Math.max((pts / maxPts) * 100, 8) + '%' : '0%'; }); }, 100));
}
$('#btn-triv-again').addEventListener('click', () => showScreen('screen-triv-setup'));

/* ════════════════════════════
   HOT TAKE GAME
   ════════════════════════════ */
$('#btn-ht-start').addEventListener('click', async () => { const file = htGetFile(); if (!file) return; requestWakeLock(); checkOrientation(); const data = await fetchPack('hottake', file); gameState.hottake.questions = shuffle(data.questions); gameState.hottake.roundNum++; gameState.hottake.htRoundCount = 0; gameState.currentGame = 'hottake'; htNextQuestion(); });

function htNextQuestion() { // MULTIPLAYER_HOOK: broadcast question to all player devices
  const ht = gameState.hottake, q = ht.questions[0]; ht.questions.push(ht.questions.shift()); ht.question = q.question; ht.optA = q.optionA; ht.optB = q.optionB; ht.htRoundCount++;
  const qNum = $('#ht-q-number'); if (qNum) qNum.textContent = 'Question ' + ht.htRoundCount + ' of ' + gameState.session.settings.hottake.questionsPerRound;
  $('#ht-question-text').textContent = ht.question; $('#ht-preview-a').textContent = '🅰️ ' + ht.optA; $('#ht-preview-b').textContent = '🅱️ ' + ht.optB; showScreen('screen-ht-question'); }

$('#btn-ht-begin-vote').addEventListener('click', () => {
  gameState.hottake.choices = {};
  gameState.hottake.playerIdx = 0;
  if (isMultiDevice && socket) {
    const ht = gameState.hottake;
    allPlayers().forEach(p => {
      sendMsg('send_to_player', { playerId: p.id, event: 'hottake_question', data: { question: ht.question, optionA: ht.optA, optionB: ht.optB } });
    });
    // Host screen: show question with choices + waiting count
    showScreen('screen-ht-question');
    $('#ht-question-text').textContent = ht.question;
    $('#ht-preview-a').textContent = '🅰️ ' + ht.optA;
    $('#ht-preview-b').textContent = '🅱️ ' + ht.optB;
    const waitEl = document.createElement('div');
    waitEl.id = 'host-waiting-count';
    waitEl.className = 'host-waiting';
    waitEl.textContent = '0/' + allPlayers().length + ' voted';
    const btn = $('#btn-ht-begin-vote');
    btn.style.display = 'none';
    btn.parentNode.insertBefore(waitEl, btn);
    return;
  }
  htShowPass();
});

const htPassScreen = $('#screen-ht-pass');
function htShowPass() { showScreen('screen-ht-pass'); $('#ht-pass-view').classList.remove('hidden'); $('#ht-choice-view').classList.add('hidden'); $('#ht-chosen-view').classList.add('hidden'); $('#ht-pass-next').classList.add('hidden'); htPassScreen.classList.remove('showing-clue', 'optA', 'optB'); $('#ht-pass-name').textContent = allPlayers()[gameState.hottake.playerIdx].name; }

$('#btn-ht-show-choice').addEventListener('click', () => { const ht = gameState.hottake; $('#ht-pass-view').classList.add('hidden'); $('#ht-choice-view').classList.remove('hidden'); const d = $('#ht-choice-display'); d.classList.remove('visible'); $('#ht-btn-a').textContent = '🅰️ ' + ht.optA; $('#ht-btn-b').textContent = '🅱️ ' + ht.optB; requestAnimationFrame(() => d.classList.add('visible')); });

function htPickChoice(choice) {
  const ht = gameState.hottake; ht.choices[allPlayers()[ht.playerIdx].id] = choice;
  $('#ht-choice-view').classList.add('hidden'); $('#ht-chosen-view').classList.remove('hidden');
  htPassScreen.classList.add('showing-clue'); htPassScreen.classList.toggle('optA', choice === 'A'); htPassScreen.classList.toggle('optB', choice === 'B');
  $('#ht-chosen-label').textContent = choice === 'A' ? '🅰️ You picked:' : '🅱️ You picked:';
  $('#ht-chosen-text').textContent = choice === 'A' ? ht.optA : ht.optB;
}
$('#btn-ht-chosen-next').addEventListener('click', () => htShowPassNext());

$('#ht-btn-a').addEventListener('click', () => htPickChoice('A'));
$('#ht-btn-b').addEventListener('click', () => htPickChoice('B'));

function htShowPassNext() { const ht = gameState.hottake, players = allPlayers(); $('#ht-chosen-view').classList.add('hidden'); $('#ht-pass-next').classList.remove('hidden'); htPassScreen.classList.remove('showing-clue', 'optA', 'optB'); const isLast = ht.playerIdx >= players.length - 1; $('#ht-pass-next-label').textContent = isLast ? 'All votes are in!' : 'Pass to ' + players[ht.playerIdx + 1].name; $('#btn-ht-next-player').textContent = isLast ? 'Reveal Results' : 'Next Player'; }

$('#btn-ht-next-player').addEventListener('click', () => { gameState.hottake.playerIdx++; if (gameState.hottake.playerIdx >= allPlayers().length) htShowResults(); else htShowPass(); });

function htShowResults() {
  showPhaseOverlay('🔥 REVEALING...');
  safeTimeout(() => htShowResultsInner(), 1200);
}
function htShowResultsInner() {
  const ht = gameState.hottake, players = allPlayers(), aP = players.filter(p => ht.choices[p.id] === 'A'), bP = players.filter(p => ht.choices[p.id] === 'B');
  $('#ht-res-question').textContent = ht.question; $('#ht-res-a-label').textContent = '🅰️ ' + ht.optA; $('#ht-res-b-label').textContent = '🅱️ ' + ht.optB;
  $('#ht-res-a-count').textContent = aP.length; $('#ht-res-b-count').textContent = bP.length;
  $('#ht-res-a-names').textContent = aP.map(p => p.name).join(', ') || 'Nobody'; $('#ht-res-b-names').textContent = bP.map(p => p.name).join(', ') || 'Nobody';
  // Split bar
  const total = aP.length + bP.length || 1;
  const aPct = Math.round((aP.length / total) * 100), bPct = 100 - aPct;
  $('#ht-split-a').style.width = aPct + '%'; $('#ht-split-a').textContent = aPct + '%';
  $('#ht-split-b').style.width = bPct + '%'; $('#ht-split-b').textContent = bPct + '%';
  // Opinion labels
  const labelsEl = $('#ht-opinion-labels'); let labelsHtml = '';
  const allVoters = players.filter(p => ht.choices[p.id]);
  allVoters.forEach(p => {
    const side = ht.choices[p.id], sideArr = side === 'A' ? aP : bP, otherArr = side === 'A' ? bP : aP;
    let label = '', cls = '';
    if (sideArr.length === 1) { label = '🐺 Lone Wolf'; cls = 'lonewolf'; }
    else if (sideArr.length < otherArr.length) { label = '💎 Unique'; cls = 'unique'; }
    else if (sideArr.length > otherArr.length && sideArr.length >= total * 0.75) { label = '📋 Basic'; cls = 'basic'; }
    if (label) labelsHtml += '<span class="ht-opinion-label ' + cls + '">' + esc(p.name) + ': ' + label + '</span> ';
  });
  labelsEl.innerHTML = labelsHtml;
  snapshotScores();
  const { type, breakdown } = scoreHotTakeQuestion();
  if (type === 'split') {
    $('#ht-res-title').textContent = '⚔️ PERFECTLY DIVIDED!';
    $('#ht-res-points').textContent = 'Everyone gets +1 point. ' + randomFlavor('htSplit');
  } else {
    const minSide = aP.length < bP.length ? ht.optA : ht.optB;
    const hasLoneWolf = (aP.length === 1 || bP.length === 1);
    if (hasLoneWolf) {
      const lonePlayer = (aP.length === 1 ? aP : bP)[0];
      $('#ht-res-title').textContent = '🐺 ' + lonePlayer.name + ' is the Lone Wolf!';
      $('#ht-res-points').textContent = 'Minority (' + minSide + ') gets +2 points each! ' + randomFlavor('htLoneWolf');
    } else {
      $('#ht-res-title').textContent = '🔥 Results!';
      $('#ht-res-points').textContent = 'Minority (' + minSide + ') gets +2 points each! ' + randomFlavor('htMajority');
    }
  }
  // Mini leaderboard
  const lbEl = $('#ht-mini-leaderboard');
  if (lbEl) {
    const sorted = [...players].sort((a, b) => (gameState.session.scores[b.id] || 0) - (gameState.session.scores[a.id] || 0));
    lbEl.innerHTML = '<div class="vote-map-title">Leaderboard</div>' + sorted.map((p, i) => '<div class="vote-map-row"><span>' + (i === 0 ? '👑 ' : '') + esc(p.name) + '</span><span>' + (gameState.session.scores[p.id] || 0) + ' pts</span></div>').join('');
  }
  renderBreakdown('#ht-res-breakdown', breakdown); autoSave();
  const maxQ = gameState.session.settings.hottake.questionsPerRound, againBtn = $('#btn-ht-again');
  if (ht.htRoundCount >= maxQ) { againBtn.textContent = 'Finish'; againBtn.onclick = () => { if (isInPlaylist()) advancePlaylist(); else goHome(); }; }
  else { againBtn.textContent = 'Next Question →'; againBtn.onclick = () => htNextQuestion(); }
  setupResultButtons('#btn-ht-home2', null, 'screen-ht-setup'); showScreen('screen-ht-results'); autoSave(); checkWinCondition();
}

/* ════════════════════════════
   MAFIA GAME
   ════════════════════════════ */
const mafiaState = { roles: {}, alive: [], phase: 'night', nightNum: 0, mafiaTarget: null, doctorTarget: null, detectiveTarget: null, dayMsg: '', eliminated: [] };

$('#btn-mafia-start').addEventListener('click', async () => {
  const file = mafiaGetFile && mafiaGetFile(); if (!file) return;
  gameState.currentGame = 'mafia'; const players = allPlayers();
  if (players.length < 5) { alert('Mafia needs at least 5 players'); return; }
  // Assign roles
  const shuffled = shuffle([...players]); mafiaState.roles = {}; mafiaState.alive = players.map(p => p.id); mafiaState.eliminated = []; mafiaState.nightNum = 0;
  const numMafia = players.length >= 8 ? 2 : 1; const roleList = [];
  for (let i = 0; i < numMafia; i++) roleList.push('mafia');
  roleList.push('doctor', 'detective');
  while (roleList.length < players.length) roleList.push('civilian');
  const shuffledRoles = shuffle(roleList);
  shuffled.forEach((p, i) => { mafiaState.roles[p.id] = shuffledRoles[i]; });
  if (isMultiDevice && socket) {
    sendMsg('start_game', { gameType: 'mafia', settings: gameState.session.settings });
    // Send role assignments to each player
    players.forEach(p => {
      sendMsg('send_to_player', { playerId: p.id, event: 'your_clue', data: { role: mafiaState.roles[p.id], text: mafiaState.roles[p.id].toUpperCase(), sub: mafiaState.roles[p.id] === 'mafia' ? 'Eliminate the town!' : mafiaState.roles[p.id] === 'doctor' ? 'Save someone each night' : mafiaState.roles[p.id] === 'detective' ? 'Investigate one player per night' : 'Find the mafia!' } });
    });
  }
  mafiaStartNight();
});

// Track night actions received from players
let mafiaExpectedActions = 0, mafiaReceivedActions = 0;
function handleMafiaNightAction(payload) {
  if (payload.role === 'mafia') mafiaState.mafiaTarget = payload.targetId;
  else if (payload.role === 'doctor') mafiaState.doctorTarget = payload.targetId;
  else if (payload.role === 'detective') mafiaState.detectiveTarget = payload.targetId;
  mafiaReceivedActions++;
  if ($('#mafia-night-msg')) $('#mafia-night-msg').textContent = mafiaReceivedActions + '/' + mafiaExpectedActions + ' actions received...';
  if (mafiaReceivedActions >= mafiaExpectedActions) $('#btn-mafia-night-next').click();
}

function mafiaStartNight() {
  mafiaState.nightNum++; mafiaState.mafiaTarget = null; mafiaState.doctorTarget = null; mafiaState.detectiveTarget = null;
  mafiaState.phase = 'night';
  const msgs = ['The town falls silent...', 'Darkness descends...', 'A chill runs through the air...'];
  $('#mafia-night-title').textContent = '🌙 Night ' + mafiaState.nightNum;
  $('#mafia-night-msg').textContent = msgs[Math.floor(Math.random() * msgs.length)];

  if (isMultiDevice && socket) {
    // Send night action requests to special role players
    const alive = mafiaState.alive.map(id => playerById(id)).filter(Boolean);
    const targets = alive.map(p => ({ id: p.id, name: p.name }));
    mafiaExpectedActions = 0; mafiaReceivedActions = 0;
    alive.forEach(p => {
      const role = mafiaState.roles[p.id];
      if (role === 'mafia') {
        sendMsg('send_to_player', { playerId: p.id, event: 'night_action_request', data: { role: 'mafia', instruction: 'Choose a target to eliminate', targets: targets.filter(t => mafiaState.roles[t.id] !== 'mafia') } });
        mafiaExpectedActions++;
      } else if (role === 'doctor') {
        sendMsg('send_to_player', { playerId: p.id, event: 'night_action_request', data: { role: 'doctor', instruction: 'Choose someone to save', targets } });
        mafiaExpectedActions++;
      } else if (role === 'detective') {
        sendMsg('send_to_player', { playerId: p.id, event: 'night_action_request', data: { role: 'detective', instruction: 'Investigate someone', targets: targets.filter(t => t.id !== p.id) } });
        mafiaExpectedActions++;
      } else {
        sendMsg('send_to_player', { playerId: p.id, event: 'host_update', data: { event: 'show_idle', title: '🌙 Night ' + mafiaState.nightNum, subtitle: 'Close your eyes... The night is dark.' } });
      }
    });
    // Show waiting UI on host
    $('#mafia-night-action').innerHTML = '<div class="host-waiting">Waiting for night actions... 0/' + mafiaExpectedActions + '</div>';
    showScreen('screen-mafia-night');
    return;
  }

  // Local pass-and-play night UI
  const actionArea = $('#mafia-night-action');
  const alive = mafiaState.alive.map(id => playerById(id)).filter(Boolean);
  let html = '<div class="setting-group"><div class="setting-group-title">Mafia — Choose a target to eliminate</div>';
  html += alive.filter(p => mafiaState.roles[p.id] !== 'mafia').map(p => '<button class="btn outline mafia-night-btn" data-role="mafia" data-id="' + p.id + '">' + esc(p.name) + '</button>').join('');
  html += '</div>';
  const doctorAlive = alive.find(p => mafiaState.roles[p.id] === 'doctor');
  if (doctorAlive) { html += '<div class="setting-group"><div class="setting-group-title">Doctor — Choose someone to save</div>'; html += alive.map(p => '<button class="btn outline mafia-night-btn" data-role="doctor" data-id="' + p.id + '">' + esc(p.name) + '</button>').join(''); html += '</div>'; }
  const detAlive = alive.find(p => mafiaState.roles[p.id] === 'detective');
  if (detAlive) { html += '<div class="setting-group"><div class="setting-group-title">Detective — Investigate someone</div>'; html += alive.map(p => p.id !== detAlive.id ? '<button class="btn outline mafia-night-btn" data-role="detective" data-id="' + p.id + '">' + esc(p.name) + '</button>' : '').join(''); html += '</div>'; }
  actionArea.innerHTML = html;
  actionArea.querySelectorAll('.mafia-night-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.dataset.role; btn.closest('.setting-group').querySelectorAll('.mafia-night-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected');
      if (role === 'mafia') mafiaState.mafiaTarget = btn.dataset.id;
      else if (role === 'doctor') mafiaState.doctorTarget = btn.dataset.id;
      else if (role === 'detective') mafiaState.detectiveTarget = btn.dataset.id;
    });
  });
  showScreen('screen-mafia-night');
}

$('#btn-mafia-night-next').addEventListener('click', () => {
  if (!mafiaState.mafiaTarget) return;
  // Resolve night
  let killed = mafiaState.mafiaTarget;
  const saved = mafiaState.doctorTarget === killed;
  let dayMsg = '';
  if (saved) { dayMsg = 'The doctor saved ' + (playerById(killed)?.name || '?') + '! No one was eliminated.'; killed = null; }
  else { const victim = playerById(killed); dayMsg = (victim?.name || '?') + ' was eliminated during the night! They were a ' + mafiaState.roles[killed] + '.'; mafiaState.alive = mafiaState.alive.filter(id => id !== killed); mafiaState.eliminated.push(killed); }
  if (mafiaState.detectiveTarget) {
    const target = playerById(mafiaState.detectiveTarget); const isMafia = mafiaState.roles[mafiaState.detectiveTarget] === 'mafia';
    dayMsg += '\n\nDetective learned: ' + (target?.name || '?') + ' is ' + (isMafia ? '🔴 MAFIA!' : '🟢 not mafia.');
  }
  // Check win conditions
  const aliveMafia = mafiaState.alive.filter(id => mafiaState.roles[id] === 'mafia');
  const aliveTown = mafiaState.alive.filter(id => mafiaState.roles[id] !== 'mafia');
  if (aliveMafia.length === 0) { mafiaShowResults('town'); return; }
  if (aliveMafia.length >= aliveTown.length) { mafiaShowResults('mafia'); return; }
  mafiaState.dayMsg = dayMsg; mafiaStartDay();
});

function mafiaStartDay() {
  mafiaState.phase = 'day';
  $('#mafia-day-msg').textContent = mafiaState.dayMsg;
  const alive = mafiaState.alive.map(id => playerById(id)).filter(Boolean);
  $('#mafia-alive-players').innerHTML = alive.map((p, i) => { const color = playerColor(allPlayers().indexOf(p)); return '<div class="chip" style="background:' + color + '22;color:' + color + '">' + esc(p.name) + '</div>'; }).join('');
  showScreen('screen-mafia-day');
  if (isMultiDevice && socket) {
    // Tell players it's day
    alive.forEach(p => {
      sendMsg('send_to_player', { playerId: p.id, event: 'host_update', data: { event: 'show_idle', title: '☀️ Day Phase', subtitle: mafiaState.dayMsg.split('\n')[0] } });
    });
    // Also inform eliminated players
    sendMsg('next_phase', { phase: 'day', data: { msg: mafiaState.dayMsg, alive: alive.map(p => ({ id: p.id, name: p.name })) } });
  }
}

let mafiaVotes = {}, mafiaVoteCount = 0;
$('#btn-mafia-nominate').addEventListener('click', () => {
  const alive = mafiaState.alive.map(id => playerById(id)).filter(Boolean);

  if (isMultiDevice && socket) {
    // Send vote request to all alive players
    mafiaVotes = {}; mafiaVoteCount = 0;
    alive.forEach(p => {
      sendMsg('send_to_player', { playerId: p.id, event: 'voting_open', data: { players: alive.map(a => ({ id: a.id, name: a.name })) } });
    });
    showScreen('screen-mafia-vote');
    $('#mafia-vote-grid').innerHTML = '<div id="host-waiting-count" class="host-waiting">0/' + alive.length + ' voted</div>';
    return;
  }

  const grid = $('#mafia-vote-grid');
  grid.innerHTML = alive.map(p => '<button class="vote-btn" data-id="' + p.id + '">' + esc(p.name) + '</button>').join('') + '<button class="vote-btn" data-id="skip" style="opacity:0.6">Skip Vote</button>';
  grid.querySelectorAll('.vote-btn').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.id === 'skip') { mafiaStartNight(); return; }
    const eliminated = btn.dataset.id; const ep = playerById(eliminated);
    mafiaState.alive = mafiaState.alive.filter(id => id !== eliminated); mafiaState.eliminated.push(eliminated);
    // Check win
    const aliveMafia = mafiaState.alive.filter(id => mafiaState.roles[id] === 'mafia');
    const aliveTown = mafiaState.alive.filter(id => mafiaState.roles[id] !== 'mafia');
    if (mafiaState.roles[eliminated] === 'jester') { mafiaShowResults('jester', eliminated); return; }
    if (aliveMafia.length === 0) { mafiaShowResults('town'); return; }
    if (aliveMafia.length >= aliveTown.length) { mafiaShowResults('mafia'); return; }
    mafiaState.dayMsg = (ep?.name || '?') + ' was voted out! They were a ' + mafiaState.roles[eliminated] + '.';
    mafiaStartNight();
  }));
  showScreen('screen-mafia-vote');
});

function notifyPlayersGameEnd(title) {
  if (!isMultiDevice || !socket) return;
  allPlayers().forEach(p => {
    sendMsg('send_to_player', { playerId: p.id, event: 'game_ended', data: { title: title || 'Game Over!' } });
  });
}

function mafiaShowResults(winner, jesterId) {
  const emoji = winner === 'town' ? '🎉' : winner === 'mafia' ? '😈' : '🃏';
  const titles = { town: 'Town Wins!', mafia: 'Mafia Wins!', jester: 'Jester Wins!' };
  $('#mafia-res-emoji').textContent = emoji; $('#mafia-res-title').textContent = titles[winner];
  $('#mafia-res-detail').textContent = winner === 'town' ? 'All mafia members were eliminated!' : winner === 'mafia' ? 'The mafia has taken over!' : (playerById(jesterId)?.name || '?') + ' fooled everyone!';
  // Show all roles
  const players = allPlayers();
  $('#mafia-res-roles').innerHTML = '<div class="setting-group-title" style="margin-top:12px;">All Roles</div>' + players.map(p => {
    const role = mafiaState.roles[p.id] || 'civilian'; const alive = mafiaState.alive.includes(p.id);
    return '<div class="result-row"><span class="result-name" style="' + (!alive ? 'text-decoration:line-through;opacity:0.5;' : '') + '">' + esc(p.name) + '</span><span>' + role.charAt(0).toUpperCase() + role.slice(1) + '</span></div>';
  }).join('');
  // Score: alive town +2, mafia if they won +3
  if (winner === 'town') { mafiaState.alive.forEach(id => { if (mafiaState.roles[id] !== 'mafia') addPoints(id, 2, 'mafia', 'Survived'); }); }
  else if (winner === 'mafia') { mafiaState.alive.filter(id => mafiaState.roles[id] === 'mafia').forEach(id => addPoints(id, 3, 'mafia', 'Mafia won')); }
  else if (jesterId) addPoints(jesterId, 5, 'mafia', 'Jester win');
  playSound('fanfare'); launchConfetti(); showScreen('screen-mafia-results'); autoSave();
  notifyPlayersGameEnd(titles[winner]);
}
$('#btn-mafia-again').addEventListener('click', () => showScreen('screen-mafia-setup'));

/* ════════════════════════════
   MILLIONAIRE GAME
   ════════════════════════════ */
const MONEY_LADDER = ['$100','$200','$300','$500','$1K','$2K','$4K','$8K','$16K','$32K','$64K','$125K','$250K','$500K','$1M'];
const SAFE_HAVENS = [4, 9]; // indices 4 ($1K) and 9 ($32K)
const millState = { questions: [], qIdx: 0, playerIdx: 0, lifelines: { fiftyFifty: false, phoneFriend: false, audiencePoll: false }, winnings: {} };

$('#btn-mill-start').addEventListener('click', async () => {
  const file = millGetFile && millGetFile(); if (!file) return;
  const data = await fetchPack('millionaire', file); gameState.currentGame = 'millionaire';
  // Sort by difficulty
  const easy = shuffle(data.questions.filter(q => q.difficulty === 'easy'));
  const med = shuffle(data.questions.filter(q => q.difficulty === 'medium'));
  const hard = shuffle(data.questions.filter(q => q.difficulty === 'hard'));
  millState.questions = [...easy, ...med, ...hard].slice(0, 15);
  if (millState.questions.length < 5) { millState.questions = shuffle(data.questions).slice(0, 15); }
  millState.playerIdx = 0; millState.winnings = {};
  allPlayers().forEach(p => { millState.winnings[p.id] = 0; });
  millStartTurn();
});

function millStartTurn() {
  millState.qIdx = 0; millState.lifelines = { fiftyFifty: false, phoneFriend: false, audiencePoll: false };
  if (isMultiDevice && socket) {
    const player = allPlayers()[millState.playerIdx];
    sendMsg('start_game', { gameType: 'millionaire', settings: gameState.session.settings });
    // Tell other players to watch the host screen
    allPlayers().forEach(p => {
      if (p.id !== player.id) sendMsg('send_to_player', { playerId: p.id, event: 'host_update', data: { event: 'show_idle', title: '💰 ' + player.name + "'s Turn", subtitle: 'Watch the host screen!' } });
    });
    // Current player gets trivia questions on their phone
    millSendQuestionToPlayer(player);
  }
  millRenderQuestion();
}

function millSendQuestionToPlayer(player) {
  if (!isMultiDevice || !socket) return;
  const q = millState.questions[millState.qIdx]; if (!q) return;
  sendMsg('send_to_player', { playerId: player.id, event: 'trivia_question', data: { question: 'Q' + (millState.qIdx + 1) + ' for ' + MONEY_LADDER[millState.qIdx] + ': ' + q.question, answers: q.answers, qNum: millState.qIdx + 1, total: 15, timeLimit: 0 } });
}

function millRenderQuestion() {
  const q = millState.questions[millState.qIdx]; if (!q) { millEndTurn('$1M'); return; }
  // Ladder
  $('#mill-ladder').innerHTML = MONEY_LADDER.map((m, i) => {
    let cls = 'mill-ladder-step'; if (i === millState.qIdx) cls += ' current'; if (i < millState.qIdx) cls += ' done'; if (SAFE_HAVENS.includes(i)) cls += ' safe';
    return '<div class="' + cls + '"><span>Q' + (i + 1) + '</span><span>' + m + '</span></div>';
  }).join('');
  // Lifelines
  const ll = millState.lifelines;
  $('#mill-lifelines').innerHTML = '<button class="mill-lifeline' + (ll.fiftyFifty ? ' used' : '') + '" id="ll-5050">50:50</button><button class="mill-lifeline' + (ll.phoneFriend ? ' used' : '') + '" id="ll-phone">Phone</button><button class="mill-lifeline' + (ll.audiencePoll ? ' used' : '') + '" id="ll-audience">Poll</button>';
  $('#ll-5050').addEventListener('click', () => { if (ll.fiftyFifty) return; ll.fiftyFifty = true; const wrong = [0,1,2,3].filter(i => i !== q.correct); const toRemove = shuffle(wrong).slice(0, 2); toRemove.forEach(i => { const btn = $('#mill-answers').querySelector('[data-idx="' + i + '"]'); if (btn) btn.classList.add('dimmed'); }); $('#ll-5050').classList.add('used'); });
  $('#ll-phone').addEventListener('click', () => { if (ll.phoneFriend) return; ll.phoneFriend = true; alert('Your friend thinks the answer is: ' + q.answers[q.correct]); $('#ll-phone').classList.add('used'); });
  $('#ll-audience').addEventListener('click', () => { if (ll.audiencePoll) return; ll.audiencePoll = true; const pcts = [0,0,0,0]; pcts[q.correct] = 40 + Math.floor(Math.random() * 30); let rem = 100 - pcts[q.correct]; [0,1,2,3].forEach(i => { if (i !== q.correct) { const p = Math.floor(Math.random() * rem); pcts[i] = p; rem -= p; } }); alert('Audience: A:' + pcts[0] + '% B:' + pcts[1] + '% C:' + pcts[2] + '% D:' + pcts[3] + '%'); $('#ll-audience').classList.add('used'); });
  const player = allPlayers()[millState.playerIdx];
  $('#mill-q-text').textContent = (player ? player.name + ': ' : '') + q.question;
  const labels = ['A', 'B', 'C', 'D'];
  $('#mill-answers').innerHTML = q.answers.map((a, i) => '<button class="mill-answer-btn" data-idx="' + i + '">' + labels[i] + ': ' + esc(a) + '</button>').join('');
  $('#mill-answers').querySelectorAll('.mill-answer-btn').forEach(btn => btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.idx);
    $('#mill-answers').querySelectorAll('.mill-answer-btn').forEach(b => b.style.pointerEvents = 'none');
    if (idx === q.correct) { btn.classList.add('correct'); playSound('correct'); setTimeout(() => { millState.qIdx++; if (millState.qIdx >= 15) millEndTurn('$1M'); else millRenderQuestion(); }, 1000); }
    else { btn.classList.add('wrong'); playSound('wrong'); $('#mill-answers').querySelector('[data-idx="' + q.correct + '"]').classList.add('correct'); const safeMoney = millGetSafeMoney(); setTimeout(() => millEndTurn(safeMoney), 1500); }
  }));
  $('#btn-mill-walk').onclick = () => { const money = millState.qIdx > 0 ? MONEY_LADDER[millState.qIdx - 1] : '$0'; millEndTurn(money); };
  showScreen('screen-mill-question');
}

function millGetSafeMoney() { for (let i = SAFE_HAVENS.length - 1; i >= 0; i--) { if (millState.qIdx > SAFE_HAVENS[i]) return MONEY_LADDER[SAFE_HAVENS[i]]; } return '$0'; }

function millEndTurn(money) {
  const player = allPlayers()[millState.playerIdx];
  const pts = MONEY_LADDER.indexOf(money) + 1;
  if (pts > 0 && player) { addPoints(player.id, pts, 'millionaire', 'Won ' + money); millState.winnings[player.id] = money; }
  $('#mill-res-emoji').textContent = pts >= 10 ? '🤑' : pts > 0 ? '💰' : '😢';
  $('#mill-res-text').textContent = (player?.name || '') + ' walks away with ' + money + '!';
  $('#mill-res-detail').textContent = pts > 0 ? '+' + pts + ' points' : 'Better luck next time!';
  playSound(pts > 0 ? 'fanfare' : 'wrong');
  showScreen('screen-mill-result');
  $('#btn-mill-next').textContent = millState.playerIdx >= allPlayers().length - 1 ? 'See Final Results' : 'Next Player';
}

$('#btn-mill-next').addEventListener('click', () => { millState.playerIdx++; if (millState.playerIdx >= allPlayers().length) millShowFinal(); else millStartTurn(); });

function millShowFinal() {
  const players = allPlayers(), sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  const maxPts = gameState.scores.byPlayer[sorted[0]?.id] || 1, container = $('#mill-final-scores'); container.innerHTML = '';
  sorted.forEach((p, i) => { const pts = gameState.scores.byPlayer[p.id] || 0; const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = '<span class="result-name">' + (i === 0 ? '👑 ' : '') + esc(p.name) + ' (' + (millState.winnings[p.id] || '$0') + ')</span><div class="result-bar-track"><div class="result-bar' + (i === 0 ? ' top' : '') + '" style="width:0%"></div></div><span class="result-count">' + pts + '</span>'; container.appendChild(row); });
  setupResultButtons('#btn-mill-home', '#btn-mill-again', 'screen-mill-setup');
  showScreen('screen-mill-final'); playSound('fanfare'); launchConfetti(); autoSave();
  requestAnimationFrame(() => setTimeout(() => { container.querySelectorAll('.result-bar').forEach((bar, i) => { const pts = gameState.scores.byPlayer[sorted[i].id] || 0; bar.style.width = maxPts > 0 ? Math.max((pts / maxPts) * 100, 8) + '%' : '0%'; }); }, 100));
}
$('#btn-mill-again').addEventListener('click', () => showScreen('screen-mill-setup'));

/* ════════════════════════════
   FAMILY FEUD GAME
   ════════════════════════════ */
const feudState = { questions: [], qIdx: 0, strikes: 0, revealedAnswers: [], currentQ: null, teamScores: [0, 0], currentTeam: 0 };

$('#btn-feud-start').addEventListener('click', async () => {
  const file = feudGetFile && feudGetFile(); if (!file) return;
  const data = await fetchPack('feud', file); gameState.currentGame = 'feud';
  feudState.questions = shuffle(data.questions); feudState.qIdx = 0; feudState.teamScores = [0, 0]; feudState.currentTeam = 0;
  feudStartRound();
});

let feudBuzzer = null;
function handleFeudBuzz(payload) {
  if (feudBuzzer) return; // First buzz wins
  feudBuzzer = payload;
  showToast((payload.playerName || '?') + ' buzzed in first!');
  playSound('correct');
}

function feudStartRound() {
  const q = feudState.questions[feudState.qIdx]; if (!q) { feudShowResults(); return; }
  feudState.currentQ = q; feudState.strikes = 0; feudState.revealedAnswers = []; feudBuzzer = null;
  $('#feud-question').textContent = q.question;
  feudRenderBoard();
  feudState.currentTeam = feudState.qIdx % 2;
  const feudTeamLabel = teamMode ? TEAM_EMOJIS[feudState.currentTeam] + ' ' + TEAM_NAMES[feudState.currentTeam] : 'Team ' + (feudState.currentTeam + 1);
  $('#feud-team-info').textContent = feudTeamLabel + ' is playing! (Strikes: 0/3)';
  showScreen('screen-feud-board');
  if (isMultiDevice && socket) {
    // Send the question and buzz prompt to all players
    allPlayers().forEach(p => {
      sendMsg('send_to_player', { playerId: p.id, event: 'feud_faceoff', data: { question: q.question } });
    });
  }
}

function feudRenderBoard() {
  const q = feudState.currentQ;
  $('#feud-board').innerHTML = q.answers.map((a, i) => {
    const revealed = feudState.revealedAnswers.includes(i);
    return '<div class="feud-answer' + (revealed ? ' revealed' : '') + '">' + (revealed ? '<span>' + esc(a.text) + '</span><span class="feud-pts">' + a.points + '</span>' : '<span>' + (i + 1) + '</span><span>???</span>') + '</div>';
  }).join('');
  $('#feud-strikes').innerHTML = '✗'.repeat(feudState.strikes) + '○'.repeat(3 - feudState.strikes);
}

$('#btn-feud-guess').addEventListener('click', () => {
  // Reveal next unrevealed answer
  const q = feudState.currentQ; if (!q) return;
  for (let i = 0; i < q.answers.length; i++) {
    if (!feudState.revealedAnswers.includes(i)) { feudState.revealedAnswers.push(i); feudState.teamScores[feudState.currentTeam] += q.answers[i].points; playSound('correct'); feudRenderBoard(); return; }
  }
  // All revealed — next question
  feudState.qIdx++; feudStartRound();
});

$('#btn-feud-strike').addEventListener('click', () => {
  feudState.strikes++; playSound('wrong');
  if (feudState.strikes >= 3) {
    // Other team gets to steal — for simplicity, reveal all remaining and move on
    const q = feudState.currentQ; if (q) { q.answers.forEach((a, i) => { if (!feudState.revealedAnswers.includes(i)) { feudState.revealedAnswers.push(i); feudState.teamScores[1 - feudState.currentTeam] += a.points; } }); feudRenderBoard(); }
    setTimeout(() => { feudState.qIdx++; feudStartRound(); }, 1500);
  } else {
    const fStrikeLabel = teamMode ? TEAM_EMOJIS[feudState.currentTeam] + ' ' + TEAM_NAMES[feudState.currentTeam] : 'Team ' + (feudState.currentTeam + 1);
    $('#feud-team-info').textContent = fStrikeLabel + ' is playing! (Strikes: ' + feudState.strikes + '/3)';
    feudRenderBoard();
  }
});

function feudShowResults() {
  const players = allPlayers();
  let team1, team2;
  if (teamMode && teams[0] && teams[1]) {
    team1 = getTeamPlayers(0); team2 = getTeamPlayers(1);
  } else {
    const half = Math.ceil(players.length / 2);
    team1 = players.slice(0, half); team2 = players.slice(half);
  }
  const pts1 = Math.round(feudState.teamScores[0] / 10), pts2 = Math.round(feudState.teamScores[1] / 10);
  team1.forEach(p => addPoints(p.id, pts1, 'feud', (teamMode ? TEAM_NAMES[0] : 'Team 1')));
  team2.forEach(p => addPoints(p.id, pts2, 'feud', (teamMode ? TEAM_NAMES[1] : 'Team 2')));
  const sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  const maxPts = gameState.scores.byPlayer[sorted[0]?.id] || 1, container = $('#feud-final-scores'); container.innerHTML = '';
  sorted.forEach((p, i) => { const pts = gameState.scores.byPlayer[p.id] || 0; const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = '<span class="result-name">' + (i === 0 ? '👑 ' : '') + esc(p.name) + '</span><div class="result-bar-track"><div class="result-bar' + (i === 0 ? ' top' : '') + '" style="width:0%"></div></div><span class="result-count">' + pts + '</span>'; container.appendChild(row); });
  setupResultButtons('#btn-feud-home', '#btn-feud-again', 'screen-feud-setup');
  showScreen('screen-feud-results'); playSound('fanfare'); launchConfetti(); autoSave();
  requestAnimationFrame(() => setTimeout(() => { container.querySelectorAll('.result-bar').forEach((bar, i) => { const pts = gameState.scores.byPlayer[sorted[i].id] || 0; bar.style.width = maxPts > 0 ? Math.max((pts / maxPts) * 100, 8) + '%' : '0%'; }); }, 100));
}
$('#btn-feud-again').addEventListener('click', () => showScreen('screen-feud-setup'));

/* ════════════════════════════
   WAVELENGTH GAME
   ════════════════════════════ */
const waveState = { spectrums: [], sIdx: 0, target: 50, clue: '', psychicIdx: 0, roundScores: {} };

$('#btn-wave-start').addEventListener('click', async () => {
  const file = waveGetFile && waveGetFile(); if (!file) return;
  const data = await fetchPack('wavelength', file); gameState.currentGame = 'wavelength';
  waveState.spectrums = shuffle(data.spectrums); waveState.sIdx = 0; waveState.psychicIdx = 0; waveState.roundScores = {};
  allPlayers().forEach(p => { waveState.roundScores[p.id] = 0; });
  waveStartRound();
});

function waveStartRound() {
  const spec = waveState.spectrums[waveState.sIdx]; if (!spec || waveState.sIdx >= 10) { waveShowResults(); return; }
  waveState.target = Math.floor(Math.random() * 80) + 10; // 10-90
  const psychic = allPlayers()[waveState.psychicIdx % allPlayers().length];
  $('#wave-psychic-name').textContent = psychic.name + ' is the psychic!';
  $('#wave-left').textContent = spec.left; $('#wave-right').textContent = spec.right;
  $('#wave-target').style.left = waveState.target + '%';
  $('#wave-clue-input').value = '';
  showScreen('screen-wave-clue');
}

let waveSliderValues = {}, waveSliderCount = 0;
function handleWaveSlider(payload) {
  waveSliderValues[payload.playerId] = payload.value;
  waveSliderCount++;
  const el = $('#host-waiting-count');
  const total = allPlayers().length - 1; // exclude psychic
  if (el) el.textContent = waveSliderCount + '/' + total + ' guessed';
  if (waveSliderCount >= total) {
    // Average the guesses
    const vals = Object.values(waveSliderValues);
    const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    $('#wave-slider').value = avg;
    $('#btn-wave-guess-done').click();
  }
}

$('#btn-wave-clue-done').addEventListener('click', () => {
  waveState.clue = $('#wave-clue-input').value.trim(); if (!waveState.clue) return;
  const spec = waveState.spectrums[waveState.sIdx];
  $('#wave-clue-display').textContent = '"' + waveState.clue + '"';
  $('#wave-guess-left').textContent = spec.left; $('#wave-guess-right').textContent = spec.right;
  $('#wave-slider').value = 50;

  if (isMultiDevice && socket) {
    // Send clue to all players except psychic, ask them to guess on slider
    waveSliderValues = {}; waveSliderCount = 0;
    const psychic = allPlayers()[waveState.psychicIdx % allPlayers().length];
    allPlayers().forEach(p => {
      if (p.id === psychic.id) {
        sendMsg('send_to_player', { playerId: p.id, event: 'host_update', data: { event: 'show_idle', title: 'Your clue: "' + waveState.clue + '"', subtitle: 'Waiting for team to guess...' } });
      } else {
        sendMsg('send_to_player', { playerId: p.id, event: 'wavelength_guess', data: { clue: waveState.clue, left: spec.left, right: spec.right } });
      }
    });
    // Host shows waiting screen
    showScreen('screen-wave-guess');
    const guessArea = document.createElement('div');
    guessArea.id = 'host-waiting-count';
    guessArea.className = 'host-waiting';
    guessArea.textContent = '0/' + (allPlayers().length - 1) + ' guessed';
    $('#wave-slider').parentNode.parentNode.appendChild(guessArea);
    return;
  }

  showScreen('screen-wave-guess');
});

$('#btn-wave-guess-done').addEventListener('click', () => {
  const guess = Number($('#wave-slider').value), target = waveState.target;
  const diff = Math.abs(guess - target), spec = waveState.spectrums[waveState.sIdx];
  let pts = 0, msg = '';
  if (diff <= 5) { pts = 4; msg = 'Bullseye! +4'; }
  else if (diff <= 15) { pts = 3; msg = 'Close! +3'; }
  else if (diff <= 25) { pts = 2; msg = 'Not bad! +2'; }
  else { pts = 0; msg = 'Way off!'; }
  // Award to psychic + all guessers
  if (pts > 0) { allPlayers().forEach(p => addPoints(p.id, pts, 'wavelength', msg)); }
  $('#wave-rev-left').textContent = spec.left; $('#wave-rev-right').textContent = spec.right;
  $('#wave-rev-target').style.left = target + '%'; $('#wave-rev-guess').style.left = guess + '%';
  $('#wave-rev-score').textContent = msg + (pts > 0 ? ' (Target: ' + target + '%, Guess: ' + guess + '%)' : ' (Target: ' + target + '%, Guess: ' + guess + '%)');
  playSound(pts >= 3 ? 'correct' : pts > 0 ? 'coinCollect' : 'wrong');
  showScreen('screen-wave-reveal'); autoSave();
});

$('#btn-wave-next').addEventListener('click', () => { waveState.sIdx++; waveState.psychicIdx++; waveStartRound(); });

function waveShowResults() {
  const players = allPlayers(), sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  // Reuse the session stats or just go home
  setupResultButtons('#btn-wave-next', null, 'screen-wave-setup');
  playSound('fanfare'); autoSave(); goHome();
}

/* ════════════════════════════
   ALIAS (TABOO) GAME
   ════════════════════════════ */
const aliasState = { words: [], wIdx: 0, playerIdx: 0, roundScore: 0, timer: null, timeLeft: 60, totalRounds: 0 };

$('#btn-alias-start').addEventListener('click', async () => {
  const file = aliasGetFile && aliasGetFile(); if (!file) return;
  const data = await fetchPack('alias', file); gameState.currentGame = 'alias';
  aliasState.words = shuffle(data.words); aliasState.wIdx = 0; aliasState.playerIdx = 0; aliasState.totalRounds = 0;
  aliasStartTurn();
});

function aliasStartTurn() {
  if (aliasState.totalRounds >= allPlayers().length * 2) { aliasShowResults(); return; }
  aliasState.roundScore = 0; aliasState.timeLeft = 60;
  const player = allPlayers()[aliasState.playerIdx % allPlayers().length];
  $('#alias-describer').textContent = player.name + ' is describing!';

  if (isMultiDevice && socket) {
    // Send word to describer's phone, others get idle
    const w = aliasState.words[aliasState.wIdx % aliasState.words.length];
    sendMsg('send_to_player', { playerId: player.id, event: 'host_update', data: { event: 'show_idle', title: '🗣️ Describe: ' + w.word, subtitle: 'Forbidden: ' + (w.forbidden || []).join(', ') } });
    allPlayers().filter(p => p.id !== player.id).forEach(p => {
      sendMsg('send_to_player', { playerId: p.id, event: 'host_update', data: { event: 'show_idle', title: '🗣️ ' + player.name + ' is describing!', subtitle: 'Listen and guess!' } });
    });
  }

  aliasShowWord();
  if (aliasState.timer) clearInterval(aliasState.timer);
  aliasState.timer = setInterval(() => {
    aliasState.timeLeft--; $('#alias-timer').textContent = aliasState.timeLeft;
    if (aliasState.timeLeft <= 10) playSound('timerTick');
    if (aliasState.timeLeft <= 0) { clearInterval(aliasState.timer); aliasEndTurn(); }
  }, 1000);
  $('#alias-timer').textContent = '60';
  $('#alias-score-display').textContent = 'Score: 0';
  showScreen('screen-alias-play');
}

function aliasShowWord() {
  const w = aliasState.words[aliasState.wIdx % aliasState.words.length];
  $('#alias-main-word').textContent = w.word;
  $('#alias-forbidden').innerHTML = (w.forbidden || []).map(f => '<span>' + esc(f) + '</span>').join('');
}

$('#btn-alias-correct').addEventListener('click', () => {
  aliasState.roundScore++; playSound('correct');
  $('#alias-score-display').textContent = 'Score: ' + aliasState.roundScore;
  aliasState.wIdx++; aliasShowWord();
});

$('#btn-alias-skip').addEventListener('click', () => {
  aliasState.roundScore--; playSound('wrong');
  $('#alias-score-display').textContent = 'Score: ' + aliasState.roundScore;
  aliasState.wIdx++; aliasShowWord();
});

function aliasEndTurn() {
  const player = allPlayers()[aliasState.playerIdx % allPlayers().length];
  if (aliasState.roundScore > 0) addPoints(player.id, aliasState.roundScore, 'alias', aliasState.roundScore + ' words');
  aliasState.playerIdx++; aliasState.totalRounds++;
  if (aliasState.totalRounds >= allPlayers().length * 2) { aliasShowResults(); return; }
  aliasStartTurn();
}

function aliasShowResults() {
  if (aliasState.timer) { clearInterval(aliasState.timer); aliasState.timer = null; }
  const players = allPlayers(), sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  const maxPts = gameState.scores.byPlayer[sorted[0]?.id] || 1, container = $('#alias-final-scores'); container.innerHTML = '';
  sorted.forEach((p, i) => { const pts = gameState.scores.byPlayer[p.id] || 0; const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = '<span class="result-name">' + (i === 0 ? '👑 ' : '') + esc(p.name) + '</span><div class="result-bar-track"><div class="result-bar' + (i === 0 ? ' top' : '') + '" style="width:0%"></div></div><span class="result-count">' + pts + '</span>'; container.appendChild(row); });
  setupResultButtons('#btn-alias-home', '#btn-alias-again', 'screen-alias-setup');
  showScreen('screen-alias-results'); playSound('fanfare'); launchConfetti(); autoSave();
  requestAnimationFrame(() => setTimeout(() => { container.querySelectorAll('.result-bar').forEach((bar, i) => { const pts = gameState.scores.byPlayer[sorted[i].id] || 0; bar.style.width = maxPts > 0 ? Math.max((pts / maxPts) * 100, 8) + '%' : '0%'; }); }, 100));
}
$('#btn-alias-again').addEventListener('click', () => showScreen('screen-alias-setup'));

/* ════════════════════════════
   DRAWING GAME
   ════════════════════════════ */
const drawState = { words: [], wIdx: 0, playerIdx: 0, timer: null, timeLeft: 90, totalRounds: 0, drawing: false, tool: 'pen', color: '#000000', size: 4 };

$('#btn-draw-start').addEventListener('click', async () => {
  const file = drawGetFile && drawGetFile(); if (!file) return;
  const data = await fetchPack('drawing', file); gameState.currentGame = 'drawing';
  drawState.words = shuffle(data.words); drawState.wIdx = 0; drawState.playerIdx = 0; drawState.totalRounds = 0;
  drawStartTurn();
});

let drawGuessHandled = false;
function handlePlayerGuess(payload) {
  if (drawGuessHandled) return; // only count first correct guess
  const w = drawState.words[drawState.wIdx % drawState.words.length];
  if (payload.guess && payload.guess.toLowerCase().trim() === w.word.toLowerCase().trim()) {
    drawGuessHandled = true;
    showToast((payload.playerName || '?') + ' guessed it! "' + w.word + '"');
    addPoints(payload.playerId, 1, 'drawing', 'Guessed correctly');
    drawEndTurn(true);
  } else {
    showToast((payload.playerName || '?') + ': ' + payload.guess);
  }
}

function drawStartTurn() {
  if (drawState.totalRounds >= allPlayers().length * 2) { drawShowResults(); return; }
  drawState.timeLeft = 90; drawGuessHandled = false;
  const player = allPlayers()[drawState.playerIdx % allPlayers().length];
  const w = drawState.words[drawState.wIdx % drawState.words.length];
  $('#draw-player-name').textContent = player.name + ' is drawing!';
  $('#draw-word-display').textContent = 'Draw: ' + w.word;

  if (isMultiDevice && socket) {
    const hint = w.word.split('').map((c, i) => c === ' ' ? ' ' : (i === 0 ? c : '_')).join(' ');
    // Tell drawer the word on their phone
    sendMsg('send_to_player', { playerId: player.id, event: 'host_update', data: { event: 'show_idle', title: '🎨 Draw: ' + w.word, subtitle: 'Draw on the host screen!' } });
    // Tell others to guess
    allPlayers().filter(p => p.id !== player.id).forEach(p => {
      sendMsg('send_to_player', { playerId: p.id, event: 'guess_prompt', data: { title: '🎨 Guess what ' + player.name + ' is drawing!', hint: 'Hint: ' + hint } });
    });
  }
  const hint = w.word.split('').map((c, i) => c === ' ' ? ' ' : (i === 0 ? c : '_')).join(' ');
  $('#draw-hint').textContent = 'Hint: ' + hint;
  // Clear canvas
  const canvas = $('#draw-canvas'), dctx = canvas.getContext('2d');
  dctx.fillStyle = '#fff'; dctx.fillRect(0, 0, canvas.width, canvas.height);
  drawState.tool = 'pen'; drawState.color = '#000000'; drawState.size = 4;
  // Drawing handlers
  drawState.drawing = false;
  canvas.onpointerdown = e => { drawState.drawing = true; dctx.beginPath(); const r = canvas.getBoundingClientRect(); dctx.moveTo((e.clientX - r.left) * (canvas.width / r.width), (e.clientY - r.top) * (canvas.height / r.height)); };
  canvas.onpointermove = e => { if (!drawState.drawing) return; const r = canvas.getBoundingClientRect(); const x = (e.clientX - r.left) * (canvas.width / r.width), y = (e.clientY - r.top) * (canvas.height / r.height); dctx.strokeStyle = drawState.tool === 'eraser' ? '#ffffff' : drawState.color; dctx.lineWidth = drawState.tool === 'eraser' ? drawState.size * 3 : drawState.size; dctx.lineCap = 'round'; dctx.lineTo(x, y); dctx.stroke(); };
  canvas.onpointerup = () => { drawState.drawing = false; };
  canvas.onpointerleave = () => { drawState.drawing = false; };
  // Tools
  $$('.draw-tool').forEach(t => { t.classList.remove('active'); if (t.dataset.tool === 'pen') t.classList.add('active'); });
  $$('.draw-tool').forEach(t => t.addEventListener('click', () => {
    if (t.dataset.tool === 'clear') { dctx.fillStyle = '#fff'; dctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    drawState.tool = t.dataset.tool; $$('.draw-tool').forEach(b => b.classList.remove('active')); t.classList.add('active');
  }));
  $('#draw-color').onchange = e => { drawState.color = e.target.value; };
  $('#draw-size').oninput = e => { drawState.size = Number(e.target.value); };
  // Timer
  if (drawState.timer) clearInterval(drawState.timer);
  drawState.timer = setInterval(() => {
    drawState.timeLeft--; $('#draw-timer').textContent = drawState.timeLeft;
    if (drawState.timeLeft <= 10) playSound('timerTick');
    if (drawState.timeLeft <= 0) { clearInterval(drawState.timer); drawEndTurn(false); }
  }, 1000);
  $('#draw-timer').textContent = '90';
  showScreen('screen-draw-play');
}

$('#btn-draw-correct').addEventListener('click', () => drawEndTurn(true));
$('#btn-draw-skip').addEventListener('click', () => drawEndTurn(false));

function drawEndTurn(guessed) {
  if (drawState.timer) { clearInterval(drawState.timer); drawState.timer = null; }
  const player = allPlayers()[drawState.playerIdx % allPlayers().length];
  if (guessed) { addPoints(player.id, 2, 'drawing', 'Drew correctly'); playSound('correct'); }
  else playSound('wrong');
  drawState.wIdx++; drawState.playerIdx++; drawState.totalRounds++;
  if (drawState.totalRounds >= allPlayers().length * 2) { drawShowResults(); return; }
  drawStartTurn();
}

function drawShowResults() {
  const players = allPlayers(), sorted = [...players].sort((a, b) => (gameState.scores.byPlayer[b.id] || 0) - (gameState.scores.byPlayer[a.id] || 0));
  const maxPts = gameState.scores.byPlayer[sorted[0]?.id] || 1, container = $('#draw-final-scores'); container.innerHTML = '';
  sorted.forEach((p, i) => { const pts = gameState.scores.byPlayer[p.id] || 0; const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = '<span class="result-name">' + (i === 0 ? '👑 ' : '') + esc(p.name) + '</span><div class="result-bar-track"><div class="result-bar' + (i === 0 ? ' top' : '') + '" style="width:0%"></div></div><span class="result-count">' + pts + '</span>'; container.appendChild(row); });
  setupResultButtons('#btn-draw-home', '#btn-draw-again', 'screen-draw-setup');
  showScreen('screen-draw-results'); playSound('fanfare'); launchConfetti(); autoSave();
  requestAnimationFrame(() => setTimeout(() => { container.querySelectorAll('.result-bar').forEach((bar, i) => { const pts = gameState.scores.byPlayer[sorted[i].id] || 0; bar.style.width = maxPts > 0 ? Math.max((pts / maxPts) * 100, 8) + '%' : '0%'; }); }, 100));
}
$('#btn-draw-again').addEventListener('click', () => showScreen('screen-draw-setup'));

/* ════════════════════════════
   CONTENT MANAGER
   ════════════════════════════ */
let cmActiveTab = 'all';
$('#btn-content-mgr').addEventListener('click', () => { showScreen('screen-content-mgr'); renderContentManager(); });
$('#btn-cm-home').addEventListener('click', goHome);
$$('.cm-tab').forEach(tab => tab.addEventListener('click', () => { $$('.cm-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); cmActiveTab = tab.dataset.tab; renderContentManager(); }));
$('#cm-search').addEventListener('input', renderContentManager);
$('#cm-sort').addEventListener('change', renderContentManager);

function getAllPacksFlat() {
  const all = [];
  for (const [gameType, packs] of Object.entries(gameState.packs)) {
    packs.forEach((p, i) => all.push({ ...p, gameType, idx: i }));
  }
  return all;
}

function renderContentManager() {
  const grid = $('#cm-pack-grid'), search = ($('#cm-search').value || '').toLowerCase(), sort = $('#cm-sort').value;
  let packs = getAllPacksFlat();
  if (cmActiveTab !== 'all') packs = packs.filter(p => p.gameType === cmActiveTab);
  if (search) packs = packs.filter(p => p.pack.toLowerCase().includes(search) || p.gameType.toLowerCase().includes(search));
  if (sort === 'name') packs.sort((a, b) => a.pack.localeCompare(b.pack));
  else if (sort === 'count') packs.sort((a, b) => b.count - a.count);
  else if (sort === 'type') packs.sort((a, b) => a.gameType.localeCompare(b.gameType));

  if (packs.length === 0) { grid.innerHTML = '<div class="cm-no-results">No packs found</div>'; return; }
  const typeLabels = { imposter: 'Imp', trivia: 'Triv', hottake: 'HT', feud: 'Feud', wavelength: 'Wave', alias: 'Alias', drawing: 'Draw', millionaire: 'Mill', mafia: 'Mafia' };
  const unitLabels = { imposter: 'words', trivia: 'questions', hottake: 'questions', feud: 'surveys', wavelength: 'spectrums', alias: 'words', drawing: 'words', millionaire: 'questions', mafia: 'scenarios' };
  grid.innerHTML = packs.map(p => {
    const isCustom = p.custom || false;
    return '<div class="cm-grid-card" data-game-type="' + p.gameType + '" data-file="' + p.file + '">' +
      '<span class="cm-grid-badge ' + p.gameType + '">' + typeLabels[p.gameType] + '</span>' +
      (isCustom ? '<span class="cm-grid-badge custom" style="left:8px;right:auto;">Custom</span>' : '') +
      '<div class="cm-grid-emoji">' + (p.emoji || '📦') + '</div>' +
      '<div class="cm-grid-name">' + esc(p.pack) + '</div>' +
      '<div class="cm-grid-meta">' + p.count + ' ' + (unitLabels[p.gameType] || 'items') + '</div>' +
      '<div class="cm-grid-actions">' +
        '<button class="cm-pack-btn" data-action="preview">Preview</button>' +
        '<button class="cm-pack-btn" data-action="export">Export</button>' +
        '<button class="cm-pack-btn" data-action="duplicate">Duplicate</button>' +
        (isCustom ? '<button class="cm-pack-btn" data-action="edit">Edit</button><button class="cm-pack-btn delete" data-action="delete">Delete</button>' : '') +
      '</div></div>';
  }).join('');
  grid.querySelectorAll('.cm-pack-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const card = btn.closest('.cm-grid-card'), gameType = card.dataset.gameType, file = card.dataset.file;
      const action = btn.dataset.action;
      if (action === 'preview') { const data = await fetchPack(gameType, file); showPackPreview(data, gameType); }
      else if (action === 'export') { const data = await fetchPack(gameType, file); exportPackJSON(data, data.pack); }
      else if (action === 'duplicate') { const data = await fetchPack(gameType, file); data.pack = 'Copy of ' + data.pack; await fetch('/api/custom-packs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameType, ...data }) }); await loadPacks(); renderAllPackCards(); renderContentManager(); }
      else if (action === 'edit') { const data = await fetchPack(gameType, file); openPackEditor(gameType, data, file); }
      else if (action === 'delete') { showConfirm('Delete Pack?', 'Delete this custom pack?', async () => { await fetch('/api/custom-packs/' + gameType + '/' + file, { method: 'DELETE' }); await loadPacks(); renderAllPackCards(); renderContentManager(); }); }
    });
  });
}

function showPackPreview(data, gameType) {
  const items = (data.rounds || data.questions || []).slice(0, 5);
  let html = '<div style="font-size:1.2rem;margin-bottom:12px;">' + (data.emoji || '') + ' ' + esc(data.pack) + '</div>';
  if (gameType === 'imposter') html += items.map(r => '<div style="padding:8px 0;border-bottom:1px solid var(--surface2);"><b>' + esc(r.word) + '</b> — ' + esc(r.hint) + '</div>').join('');
  else if (gameType === 'trivia') html += items.map(r => '<div style="padding:8px 0;border-bottom:1px solid var(--surface2);"><b>' + esc(r.question) + '</b><div style="font-size:0.85rem;color:var(--green);">✓ ' + esc(r.answers[r.correct]) + '</div></div>').join('');
  else html += items.map(r => '<div style="padding:8px 0;border-bottom:1px solid var(--surface2);"><b>' + esc(r.question) + '</b><div style="font-size:0.85rem;color:var(--text-dim);">' + esc(r.optionA) + ' vs ' + esc(r.optionB) + '</div></div>').join('');
  const total = (data.rounds || data.questions || []).length; if (total > 5) html += '<div style="margin-top:8px;color:var(--text-dim);">...and ' + (total - 5) + ' more</div>';
  $('#preview-title').textContent = 'Pack Preview'; $('#preview-content').innerHTML = html; $('#pack-preview-overlay').classList.add('open');
}

function exportPackJSON(data, name) { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = (name || 'pack').replace(/[^a-zA-Z0-9]/g, '_') + '.json'; a.click(); URL.revokeObjectURL(url); }

const EMOJIS = ['🎮','🎯','🧠','🔥','🕵️','🎲','🎪','🎭','🏆','⭐','🎵','🌍','📚','🍕','🎬','💡','🦁','🚀','💎','🎉'];

/* ── PACK WIZARD ── */
let wizardStep = 1, wizardData = { gameType: '', name: '', emoji: '🎮', entries: [] };

$('#btn-cm-create').addEventListener('click', () => { wizardStep = 1; wizardData = { gameType: cmActiveTab !== 'all' ? cmActiveTab : '', name: '', emoji: '🎮', entries: [] }; renderWizard(); $('#pack-wizard-overlay').classList.add('open'); });

function renderWizard() {
  $$('#wizard-progress .wizard-step').forEach(s => { const n = Number(s.dataset.step); s.classList.toggle('active', n === wizardStep); s.classList.toggle('done', n < wizardStep); });
  const body = $('#wizard-body'), backBtn = $('#btn-wizard-back'), nextBtn = $('#btn-wizard-next');
  backBtn.style.display = wizardStep === 1 ? 'none' : '';
  if (wizardStep === 1) {
    nextBtn.textContent = 'Next';
    body.innerHTML = '<h3 style="margin-bottom:12px;">Choose game type</h3><div class="wizard-type-cards">' +
      [['imposter','🕵️','Imposter','Word + hint pairs'],['trivia','🧠','Trivia','Questions with 4 answers'],['hottake','🔥','Hot Take','A vs B opinion questions'],['feud','👨‍👩‍👧‍👦','Family Feud','Survey question + ranked answers'],['wavelength','〰️','Wavelength','Spectrum pairs (left vs right)'],['alias','🗣️','Alias','Word + forbidden words'],['drawing','🎨','Drawing','Words with difficulty'],['millionaire','💰','Millionaire','Trivia with difficulty levels'],['mafia','🎭','Mafia','Role descriptions & scenarios']].map(([t,e,n,d]) =>
        '<div class="wizard-type-card' + (wizardData.gameType === t ? ' selected' : '') + '" data-type="' + t + '"><span class="wt-emoji">' + e + '</span><div><div class="wt-name">' + n + '</div><div class="wt-desc">' + d + '</div></div></div>'
      ).join('') + '</div>';
    body.querySelectorAll('.wizard-type-card').forEach(c => c.addEventListener('click', () => { body.querySelectorAll('.wizard-type-card').forEach(x => x.classList.remove('selected')); c.classList.add('selected'); wizardData.gameType = c.dataset.type; }));
  } else if (wizardStep === 2) {
    nextBtn.textContent = 'Next';
    body.innerHTML = '<div class="editor-field"><label>Pack Name</label><input type="text" id="wiz-name" value="' + esc(wizardData.name) + '" placeholder="My Awesome Pack..." style="max-width:100%;"></div>' +
      '<div class="editor-field"><label>Emoji</label><div class="emoji-grid">' + EMOJIS.map(e => '<button class="emoji-pick' + (wizardData.emoji === e ? ' selected' : '') + '" data-emoji="' + e + '">' + e + '</button>').join('') + '</div></div>';
    body.querySelectorAll('.emoji-pick').forEach(btn => btn.addEventListener('click', () => { body.querySelectorAll('.emoji-pick').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); wizardData.emoji = btn.dataset.emoji; }));
  } else if (wizardStep === 3) {
    nextBtn.textContent = 'Review';
    const gt = wizardData.gameType;
    let html = '<div style="margin-bottom:12px;"><b>Add entries</b> or use bulk import below</div>';
    html += '<div class="editor-entries" id="wiz-entries" style="max-height:30vh;"></div>';
    html += '<button class="btn sm" id="btn-wiz-add" style="margin:8px 0;">+ Add Entry</button>';
    html += '<div class="divider"></div>';
    html += '<div style="font-size:0.85rem;font-weight:600;margin-bottom:4px;">Bulk Import</div>';
    const bulkHints = { imposter: 'One per line: word | hint', trivia: 'One per line: question | answer1 | answer2 | answer3 | answer4 | correct(0-3)', hottake: 'One per line: question | option A | option B', feud: 'One per line: question | answer1:pts | answer2:pts | ...', wavelength: 'One per line: left | right', alias: 'One per line: word | forbidden1, forbidden2, forbidden3', drawing: 'One per line: word | difficulty(easy/medium/hard)', millionaire: 'One per line: question | answer1 | answer2 | answer3 | answer4 | correct(0-3) | difficulty', mafia: 'One per line: scenario name | description' };
    html += '<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:4px;">' + (bulkHints[gt] || bulkHints.hottake) + '</div>';
    html += '<textarea class="bulk-import-area" id="wiz-bulk" placeholder="Paste entries here..."></textarea>';
    html += '<button class="btn sm" id="btn-wiz-bulk-import">Import Lines</button>';
    body.innerHTML = html;
    const entriesEl = $('#wiz-entries');
    function renderWizEntries() {
      entriesEl.innerHTML = wizardData.entries.map((item, i) => buildEntryHTML(gt, item, i)).join('');
      entriesEl.querySelectorAll('.entry-remove').forEach(btn => btn.addEventListener('click', () => { wizardData.entries.splice(Number(btn.dataset.idx), 1); renderWizEntries(); }));
      entriesEl.querySelectorAll('.btn-add-feud-answer').forEach(btn => btn.addEventListener('click', () => { const i = Number(btn.dataset.idx); if (wizardData.entries[i]) { wizardData.entries[i].answers = wizardData.entries[i].answers || []; wizardData.entries[i].answers.push({ text: '', points: 0 }); renderWizEntries(); } }));
    }
    renderWizEntries();
    $('#btn-wiz-add').addEventListener('click', () => {
      if (gt === 'imposter') wizardData.entries.push({ word: '', hint: '' });
      else if (gt === 'trivia') wizardData.entries.push({ question: '', answers: ['','','',''], correct: 0 });
      else if (gt === 'hottake') wizardData.entries.push({ question: '', optionA: '', optionB: '' });
      else if (gt === 'feud') wizardData.entries.push({ question: '', answers: [{ text: '', points: 0 }, { text: '', points: 0 }, { text: '', points: 0 }] });
      else if (gt === 'wavelength') wizardData.entries.push({ left: '', right: '' });
      else if (gt === 'alias') wizardData.entries.push({ word: '', forbidden: [] });
      else if (gt === 'drawing') wizardData.entries.push({ word: '', difficulty: 'medium' });
      else if (gt === 'millionaire') wizardData.entries.push({ question: '', answers: ['','','',''], correct: 0, difficulty: 'medium' });
      else if (gt === 'mafia') wizardData.entries.push({ name: '', description: '' });
      else wizardData.entries.push({ question: '', optionA: '', optionB: '' });
      renderWizEntries(); entriesEl.scrollTop = entriesEl.scrollHeight;
    });
    $('#btn-wiz-bulk-import').addEventListener('click', () => {
      const lines = $('#wiz-bulk').value.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const parts = line.split('|').map(s => s.trim());
        if (!parts[0]) return;
        if (gt === 'imposter') wizardData.entries.push({ word: parts[0], hint: parts[1] || '' });
        else if (gt === 'trivia' && parts.length >= 5) wizardData.entries.push({ question: parts[0], answers: [parts[1]||'', parts[2]||'', parts[3]||'', parts[4]||''], correct: Number(parts[5]) || 0 });
        else if (gt === 'hottake') wizardData.entries.push({ question: parts[0], optionA: parts[1] || '', optionB: parts[2] || '' });
        else if (gt === 'feud') { const answers = parts.slice(1).map(p => { const m = p.match(/^(.+):(\d+)$/); return m ? { text: m[1].trim(), points: Number(m[2]) } : { text: p, points: 0 }; }); wizardData.entries.push({ question: parts[0], answers }); }
        else if (gt === 'wavelength') wizardData.entries.push({ left: parts[0], right: parts[1] || '' });
        else if (gt === 'alias') { const forbidden = (parts[1] || '').split(',').map(s => s.trim()).filter(Boolean); wizardData.entries.push({ word: parts[0], forbidden }); }
        else if (gt === 'drawing') wizardData.entries.push({ word: parts[0], difficulty: parts[1] || 'medium' });
        else if (gt === 'millionaire' && parts.length >= 5) wizardData.entries.push({ question: parts[0], answers: [parts[1]||'', parts[2]||'', parts[3]||'', parts[4]||''], correct: Number(parts[5]) || 0, difficulty: parts[6] || 'medium' });
        else if (gt === 'mafia') wizardData.entries.push({ name: parts[0], description: parts[1] || '' });
      });
      $('#wiz-bulk').value = ''; renderWizEntries();
    });
  } else if (wizardStep === 4) {
    nextBtn.textContent = 'Save Pack';
    // Collect entries from step 3 DOM before rendering review
    collectWizardEntries();
    const gt = wizardData.gameType, typeNames = { imposter: 'Imposter', trivia: 'Trivia', hottake: 'Hot Take', feud: 'Family Feud', wavelength: 'Wavelength', alias: 'Alias', drawing: 'Drawing', millionaire: 'Millionaire', mafia: 'Mafia' };
    let html = '<div style="text-align:center;font-size:2rem;margin-bottom:8px;">' + wizardData.emoji + '</div>';
    html += '<div style="text-align:center;font-weight:800;font-size:1.2rem;margin-bottom:4px;">' + esc(wizardData.name || 'Untitled') + '</div>';
    html += '<div style="text-align:center;font-size:0.85rem;color:var(--text-dim);margin-bottom:16px;">' + (typeNames[gt] || gt) + ' · ' + wizardData.entries.length + ' entries</div>';
    html += '<div style="max-height:30vh;overflow-y:auto;">';
    wizardData.entries.slice(0, 10).forEach((e, i) => {
      if (gt === 'imposter') html += '<div class="wizard-review-item"><b>' + esc(e.word) + '</b> — ' + esc(e.hint) + '</div>';
      else if (gt === 'trivia') html += '<div class="wizard-review-item"><b>' + esc(e.question) + '</b> → ' + esc(e.answers[e.correct]) + '</div>';
      else if (gt === 'hottake') html += '<div class="wizard-review-item"><b>' + esc(e.question) + '</b>: ' + esc(e.optionA) + ' vs ' + esc(e.optionB) + '</div>';
      else if (gt === 'feud') html += '<div class="wizard-review-item"><b>' + esc(e.question) + '</b> — ' + (e.answers || []).map(a => esc(a.text) + ' (' + a.points + ')').join(', ') + '</div>';
      else if (gt === 'wavelength') html += '<div class="wizard-review-item">' + esc(e.left) + ' ↔ ' + esc(e.right) + '</div>';
      else if (gt === 'alias') html += '<div class="wizard-review-item"><b>' + esc(e.word) + '</b> — 🚫 ' + (e.forbidden || []).map(f => esc(f)).join(', ') + '</div>';
      else if (gt === 'drawing') html += '<div class="wizard-review-item"><b>' + esc(e.word) + '</b> [' + esc(e.difficulty || 'medium') + ']</div>';
      else if (gt === 'millionaire') html += '<div class="wizard-review-item"><b>' + esc(e.question) + '</b> → ' + esc(e.answers[e.correct]) + ' [' + esc(e.difficulty || 'medium') + ']</div>';
      else if (gt === 'mafia') html += '<div class="wizard-review-item"><b>' + esc(e.name) + '</b> — ' + esc(e.description) + '</div>';
      else html += '<div class="wizard-review-item"><b>' + esc(e.question || e.word || '') + '</b></div>';
    });
    if (wizardData.entries.length > 10) html += '<div class="wizard-review-item" style="color:var(--text-dim);">...and ' + (wizardData.entries.length - 10) + ' more</div>';
    html += '</div>';
    body.innerHTML = html;
  }
}

function collectWizardEntries() {
  const entriesEl = $('#wiz-entries');
  if (!entriesEl) return;
  const gt = wizardData.gameType, collected = [];
  entriesEl.querySelectorAll('.editor-entry').forEach(row => {
    if (gt === 'imposter') { const w = row.querySelector('.entry-word')?.value?.trim(), h = row.querySelector('.entry-hint')?.value?.trim(); if (w) collected.push({ word: w, hint: h || '' }); }
    else if (gt === 'trivia') { const q = row.querySelector('.entry-question')?.value?.trim(), ans = []; row.querySelectorAll('.entry-answer').forEach(a => ans.push(a.value.trim())); const c = Number(row.querySelector('input[type="radio"]:checked')?.value || 0); if (q) collected.push({ question: q, answers: ans, correct: c }); }
    else if (gt === 'hottake') { const q = row.querySelector('.entry-question')?.value?.trim(), a = row.querySelector('.entry-optA')?.value?.trim(), b = row.querySelector('.entry-optB')?.value?.trim(); if (q) collected.push({ question: q, optionA: a || '', optionB: b || '' }); }
    else if (gt === 'feud') { const q = row.querySelector('.entry-question')?.value?.trim(); const answers = []; row.querySelectorAll('.entry-feud-answer').forEach((a, i) => { const pts = row.querySelectorAll('.entry-feud-points')[i]; answers.push({ text: a.value.trim(), points: Number(pts?.value) || 0 }); }); if (q) collected.push({ question: q, answers: answers.filter(a => a.text) }); }
    else if (gt === 'wavelength') { const l = row.querySelector('.entry-left')?.value?.trim(), r = row.querySelector('.entry-right')?.value?.trim(); if (l && r) collected.push({ left: l, right: r }); }
    else if (gt === 'alias') { const w = row.querySelector('.entry-word')?.value?.trim(), f = row.querySelector('.entry-forbidden')?.value?.trim(); if (w) collected.push({ word: w, forbidden: f ? f.split(',').map(s => s.trim()).filter(Boolean) : [] }); }
    else if (gt === 'drawing') { const w = row.querySelector('.entry-word')?.value?.trim(), d = row.querySelector('.entry-difficulty')?.value || 'medium'; if (w) collected.push({ word: w, difficulty: d }); }
    else if (gt === 'millionaire') { const q = row.querySelector('.entry-question')?.value?.trim(), ans = []; row.querySelectorAll('.entry-answer').forEach(a => ans.push(a.value.trim())); const c = Number(row.querySelector('input[type="radio"]:checked')?.value || 0), d = row.querySelector('.entry-difficulty')?.value || 'medium'; if (q) collected.push({ question: q, answers: ans, correct: c, difficulty: d }); }
    else if (gt === 'mafia') { const n = row.querySelector('.entry-name')?.value?.trim(), d = row.querySelector('.entry-desc')?.value?.trim(); if (n) collected.push({ name: n, description: d || '' }); }
    else { const q = row.querySelector('.entry-question')?.value?.trim(), a = row.querySelector('.entry-optA')?.value?.trim(), b = row.querySelector('.entry-optB')?.value?.trim(); if (q) collected.push({ question: q, optionA: a || '', optionB: b || '' }); }
  });
  if (collected.length > 0) wizardData.entries = collected;
}

$('#btn-wizard-next').addEventListener('click', async () => {
  if (wizardStep === 1 && !wizardData.gameType) return;
  if (wizardStep === 2) { wizardData.name = ($('#wiz-name')?.value || '').trim(); if (!wizardData.name) return; }
  if (wizardStep === 3) { collectWizardEntries(); if (wizardData.entries.length === 0) return; }
  if (wizardStep === 4) {
    // Save
    const gt = wizardData.gameType, packData = { pack: wizardData.name, emoji: wizardData.emoji };
    if (gt === 'imposter') packData.rounds = wizardData.entries;
    else if (gt === 'wavelength') packData.spectrums = wizardData.entries;
    else if (gt === 'alias' || gt === 'drawing') packData.words = wizardData.entries;
    else if (gt === 'mafia') packData.scenarios = wizardData.entries;
    else packData.questions = wizardData.entries;
    try { await fetch('/api/custom-packs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameType: gt, ...packData }) }); await loadPacks(); renderAllPackCards(); renderContentManager(); $('#pack-wizard-overlay').classList.remove('open'); } catch { alert('Failed to save'); }
    return;
  }
  wizardStep++; renderWizard();
});
$('#btn-wizard-back').addEventListener('click', () => {
  if (wizardStep === 3) { collectWizardEntries(); wizardData.name = ($('#wiz-name')?.value || wizardData.name).trim(); }
  if (wizardStep > 1) { wizardStep--; renderWizard(); }
  else $('#pack-wizard-overlay').classList.remove('open');
});

/* ── PACK EDITOR (for editing existing packs) ── */
let editorGameType = null, editorFile = null;

function openPackEditor(gameType, existingData, file) {
  editorGameType = gameType; editorFile = file; const data = existingData || {};
  $('#editor-title').textContent = 'Edit Pack';
  let html = '<div class="editor-field"><label>Pack Name</label><input type="text" id="editor-name" value="' + esc(data.pack || '') + '" placeholder="My Pack..." style="max-width:100%;"></div>';
  html += '<div class="editor-field"><label>Emoji</label><div class="emoji-grid" id="editor-emoji-grid">' + EMOJIS.map(e => '<button class="emoji-pick' + (data.emoji === e ? ' selected' : '') + '" data-emoji="' + e + '">' + e + '</button>').join('') + '</div></div>';
  html += '<div class="editor-field"><label>Entries</label><div class="editor-entries" id="editor-entries"></div><button class="btn sm" id="btn-editor-add" style="margin-top:8px;">+ Add Entry</button></div>';
  $('#editor-content').innerHTML = html;
  let selectedEmoji = data.emoji || '🎮';
  $('#editor-content').querySelectorAll('.emoji-pick').forEach(btn => btn.addEventListener('click', () => { $('#editor-content').querySelectorAll('.emoji-pick').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); selectedEmoji = btn.dataset.emoji; }));
  const editorEntries = [...(data.rounds || data.questions || data.spectrums || data.words || data.scenarios || [])];
  const entriesContainer = $('#editor-entries');
  function renderEntries(items) {
    entriesContainer.innerHTML = items.map((item, i) => buildEntryHTML(gameType, item, i)).join('');
    entriesContainer.querySelectorAll('.entry-remove').forEach(btn => btn.addEventListener('click', () => { items.splice(Number(btn.dataset.idx), 1); renderEntries(items); }));
    entriesContainer.querySelectorAll('.btn-add-feud-answer').forEach(btn => btn.addEventListener('click', () => { const i = Number(btn.dataset.idx); if (items[i]) { items[i].answers = items[i].answers || []; items[i].answers.push({ text: '', points: 0 }); renderEntries(items); } }));
  }
  renderEntries(editorEntries);
  $('#btn-editor-add').addEventListener('click', () => {
    if (gameType === 'imposter') editorEntries.push({ word: '', hint: '' });
    else if (gameType === 'trivia') editorEntries.push({ question: '', answers: ['','','',''], correct: 0 });
    else if (gameType === 'hottake') editorEntries.push({ question: '', optionA: '', optionB: '' });
    else if (gameType === 'feud') editorEntries.push({ question: '', answers: [{ text: '', points: 0 }, { text: '', points: 0 }, { text: '', points: 0 }] });
    else if (gameType === 'wavelength') editorEntries.push({ left: '', right: '' });
    else if (gameType === 'alias') editorEntries.push({ word: '', forbidden: [] });
    else if (gameType === 'drawing') editorEntries.push({ word: '', difficulty: 'medium' });
    else if (gameType === 'millionaire') editorEntries.push({ question: '', answers: ['','','',''], correct: 0, difficulty: 'medium' });
    else if (gameType === 'mafia') editorEntries.push({ name: '', description: '' });
    else editorEntries.push({ question: '', optionA: '', optionB: '' });
    renderEntries(editorEntries); entriesContainer.scrollTop = entriesContainer.scrollHeight;
  });
  $('#btn-editor-save').onclick = async () => {
    const name = $('#editor-name').value.trim(); if (!name) return alert('Pack name required');
    const finalEntries = [];
    entriesContainer.querySelectorAll('.editor-entry').forEach(row => {
      if (gameType === 'imposter') { const w = row.querySelector('.entry-word')?.value?.trim(), h = row.querySelector('.entry-hint')?.value?.trim(); if (w) finalEntries.push({ word: w, hint: h || '' }); }
      else if (gameType === 'trivia') { const q = row.querySelector('.entry-question')?.value?.trim(), ans = []; row.querySelectorAll('.entry-answer').forEach(a => ans.push(a.value.trim())); const c = Number(row.querySelector('input[type="radio"]:checked')?.value || 0); if (q) finalEntries.push({ question: q, answers: ans, correct: c }); }
      else if (gameType === 'hottake') { const q = row.querySelector('.entry-question')?.value?.trim(), a = row.querySelector('.entry-optA')?.value?.trim(), b = row.querySelector('.entry-optB')?.value?.trim(); if (q) finalEntries.push({ question: q, optionA: a || '', optionB: b || '' }); }
      else if (gameType === 'feud') { const q = row.querySelector('.entry-question')?.value?.trim(); const answers = []; row.querySelectorAll('.entry-feud-answer').forEach((a, i) => { const pts = row.querySelectorAll('.entry-feud-points')[i]; answers.push({ text: a.value.trim(), points: Number(pts?.value) || 0 }); }); if (q) finalEntries.push({ question: q, answers: answers.filter(a => a.text) }); }
      else if (gameType === 'wavelength') { const l = row.querySelector('.entry-left')?.value?.trim(), r = row.querySelector('.entry-right')?.value?.trim(); if (l && r) finalEntries.push({ left: l, right: r }); }
      else if (gameType === 'alias') { const w = row.querySelector('.entry-word')?.value?.trim(), f = row.querySelector('.entry-forbidden')?.value?.trim(); if (w) finalEntries.push({ word: w, forbidden: f ? f.split(',').map(s => s.trim()).filter(Boolean) : [] }); }
      else if (gameType === 'drawing') { const w = row.querySelector('.entry-word')?.value?.trim(), d = row.querySelector('.entry-difficulty')?.value || 'medium'; if (w) finalEntries.push({ word: w, difficulty: d }); }
      else if (gameType === 'millionaire') { const q = row.querySelector('.entry-question')?.value?.trim(), ans = []; row.querySelectorAll('.entry-answer').forEach(a => ans.push(a.value.trim())); const c = Number(row.querySelector('input[type="radio"]:checked')?.value || 0), d = row.querySelector('.entry-difficulty')?.value || 'medium'; if (q) finalEntries.push({ question: q, answers: ans, correct: c, difficulty: d }); }
      else if (gameType === 'mafia') { const n = row.querySelector('.entry-name')?.value?.trim(), d = row.querySelector('.entry-desc')?.value?.trim(); if (n) finalEntries.push({ name: n, description: d || '' }); }
      else { const q = row.querySelector('.entry-question')?.value?.trim(), a = row.querySelector('.entry-optA')?.value?.trim(), b = row.querySelector('.entry-optB')?.value?.trim(); if (q) finalEntries.push({ question: q, optionA: a || '', optionB: b || '' }); }
    });
    if (!finalEntries.length) return alert('Add at least one entry');
    const packData = { pack: name, emoji: selectedEmoji };
    if (gameType === 'imposter') packData.rounds = finalEntries;
    else if (gameType === 'wavelength') packData.spectrums = finalEntries;
    else if (gameType === 'alias' || gameType === 'drawing') packData.words = finalEntries;
    else if (gameType === 'mafia') packData.scenarios = finalEntries;
    else packData.questions = finalEntries;
    try { await fetch('/api/custom-packs/' + gameType + '/' + editorFile, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(packData) }); await loadPacks(); renderAllPackCards(); renderContentManager(); $('#pack-editor-overlay').classList.remove('open'); } catch { alert('Failed to save'); }
  };
  $('#btn-editor-cancel').onclick = () => $('#pack-editor-overlay').classList.remove('open');
  $('#pack-editor-overlay').classList.add('open');
}

function buildEntryHTML(gameType, item, idx) {
  let html = '<div class="editor-entry">';
  if (gameType === 'imposter') html += '<input class="entry-word" type="text" placeholder="Word" value="' + esc(item.word || '') + '" style="flex:1;"><input class="entry-hint" type="text" placeholder="Hint" value="' + esc(item.hint || '') + '" style="flex:1;">';
  else if (gameType === 'trivia') { html += '<div style="flex:1;display:flex;flex-direction:column;gap:4px;"><input class="entry-question" type="text" placeholder="Question" value="' + esc(item.question || '') + '">'; (item.answers || ['','','','']).forEach((a, ai) => { html += '<div style="display:flex;gap:4px;align-items:center;"><input class="entry-answer" type="text" placeholder="Answer ' + (ai+1) + '" value="' + esc(a) + '" style="flex:1;"><label class="correct-radio"><input type="radio" name="correct-' + idx + '" value="' + ai + '" ' + (item.correct === ai ? 'checked' : '') + '>✓</label></div>'; }); html += '</div>'; }
  else if (gameType === 'hottake') html += '<input class="entry-question" type="text" placeholder="Question" value="' + esc(item.question || '') + '" style="flex:1;"><input class="entry-optA" type="text" placeholder="Option A" value="' + esc(item.optionA || '') + '" style="flex:0.7;"><input class="entry-optB" type="text" placeholder="Option B" value="' + esc(item.optionB || '') + '" style="flex:0.7;">';
  else if (gameType === 'feud') { html += '<div style="flex:1;display:flex;flex-direction:column;gap:4px;"><input class="entry-question" type="text" placeholder="Survey question" value="' + esc(item.question || '') + '">'; const answers = item.answers || [{ text: '', points: 0 }]; answers.forEach((a, ai) => { html += '<div style="display:flex;gap:4px;align-items:center;"><input class="entry-feud-answer" type="text" placeholder="Answer ' + (ai+1) + '" value="' + esc(a.text || '') + '" style="flex:1;"><input class="entry-feud-points" type="number" placeholder="Pts" value="' + (a.points || 0) + '" style="width:50px;" min="0"></div>'; }); html += '<button class="btn-add-feud-answer" data-idx="' + idx + '" style="font-size:0.7rem;padding:2px 6px;align-self:flex-start;cursor:pointer;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text);">+ Answer</button></div>'; }
  else if (gameType === 'wavelength') html += '<input class="entry-left" type="text" placeholder="Left end (e.g. Hot)" value="' + esc(item.left || '') + '" style="flex:1;"><input class="entry-right" type="text" placeholder="Right end (e.g. Cold)" value="' + esc(item.right || '') + '" style="flex:1;">';
  else if (gameType === 'alias') { html += '<div style="flex:1;display:flex;flex-direction:column;gap:4px;"><input class="entry-word" type="text" placeholder="Word to describe" value="' + esc(item.word || '') + '"><input class="entry-forbidden" type="text" placeholder="Forbidden words (comma-separated)" value="' + esc((item.forbidden || []).join(', ')) + '"></div>'; }
  else if (gameType === 'drawing') html += '<input class="entry-word" type="text" placeholder="Word to draw" value="' + esc(item.word || '') + '" style="flex:1;"><select class="entry-difficulty" style="width:90px;"><option value="easy"' + (item.difficulty === 'easy' ? ' selected' : '') + '>Easy</option><option value="medium"' + (item.difficulty === 'medium' || !item.difficulty ? ' selected' : '') + '>Medium</option><option value="hard"' + (item.difficulty === 'hard' ? ' selected' : '') + '>Hard</option></select>';
  else if (gameType === 'millionaire') { html += '<div style="flex:1;display:flex;flex-direction:column;gap:4px;"><input class="entry-question" type="text" placeholder="Question" value="' + esc(item.question || '') + '">'; (item.answers || ['','','','']).forEach((a, ai) => { html += '<div style="display:flex;gap:4px;align-items:center;"><input class="entry-answer" type="text" placeholder="Answer ' + (ai+1) + '" value="' + esc(a) + '" style="flex:1;"><label class="correct-radio"><input type="radio" name="correct-' + idx + '" value="' + ai + '" ' + (item.correct === ai ? 'checked' : '') + '>✓</label></div>'; }); html += '<select class="entry-difficulty" style="width:100px;margin-top:2px;"><option value="easy"' + (item.difficulty === 'easy' ? ' selected' : '') + '>Easy</option><option value="medium"' + (item.difficulty === 'medium' || !item.difficulty ? ' selected' : '') + '>Medium</option><option value="hard"' + (item.difficulty === 'hard' ? ' selected' : '') + '>Hard</option></select></div>'; }
  else if (gameType === 'mafia') html += '<input class="entry-name" type="text" placeholder="Scenario name" value="' + esc(item.name || '') + '" style="flex:1;"><input class="entry-desc" type="text" placeholder="Description" value="' + esc(item.description || '') + '" style="flex:1.5;">';
  else html += '<input class="entry-question" type="text" placeholder="Question" value="' + esc(item.question || '') + '" style="flex:1;"><input class="entry-optA" type="text" placeholder="Option A" value="' + esc(item.optionA || '') + '" style="flex:0.7;"><input class="entry-optB" type="text" placeholder="Option B" value="' + esc(item.optionB || '') + '" style="flex:0.7;">';
  return html + '<button class="entry-remove" data-idx="' + idx + '">&times;</button></div>';
}

$('#btn-cm-import').addEventListener('click', () => $('#cm-import-file').click());
$('#cm-import-file').addEventListener('change', async e => { const file = e.target.files[0]; if (!file) return; try { const data = JSON.parse(await file.text()); await fetch('/api/custom-packs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameType: cmActiveTab, data }) }); await loadPacks(); renderAllPackCards(); renderContentManager(); } catch { alert('Invalid pack file'); } e.target.value = ''; });

/* ════════════════════════════
   GAME MENU
   ════════════════════════════ */
$('#game-menu-btn').addEventListener('click', () => $('#menu-overlay').classList.add('open'));
$('#gm-resume').addEventListener('click', () => $('#menu-overlay').classList.remove('open'));
$('#gm-scoreboard').addEventListener('click', () => { $('#menu-overlay').classList.remove('open'); renderScoreboard(); $('#scoreboard-overlay').classList.add('open'); });
$('#gm-settings').addEventListener('click', () => { $('#menu-overlay').classList.remove('open'); openSettings(gameState.currentGame); });
$('#gm-save').addEventListener('click', () => { $('#menu-overlay').classList.remove('open'); $('#saves-subtitle').textContent = 'Pick a slot to save'; renderSaveSlots('save'); showScreen('screen-saves'); });
$('#gm-abandon').addEventListener('click', () => { $('#menu-overlay').classList.remove('open'); showConfirm('Abandon Game?', 'All progress in this round will be lost.', () => { gameState.currentGame = null; gameState.playlist = []; gameState.playlistIdx = -1; goHome(); }); });
$('#gm-home').addEventListener('click', () => { $('#menu-overlay').classList.remove('open'); showConfirm('Back to Game Selector?', 'Current round progress will be lost.', () => goHome()); });

/* ════════════════════════════
   CONFIRM DIALOG
   ════════════════════════════ */
let confirmCallback = null;
function showConfirm(title, msg, onYes) { $('#confirm-title').textContent = title; $('#confirm-msg').textContent = msg; confirmCallback = onYes; $('#confirm-overlay').classList.add('open'); }
$('#btn-confirm-yes').addEventListener('click', () => { $('#confirm-overlay').classList.remove('open'); if (confirmCallback) { confirmCallback(); confirmCallback = null; } });
$('#btn-confirm-no').addEventListener('click', () => { $('#confirm-overlay').classList.remove('open'); confirmCallback = null; });

/* ════════════════════════════
   OVERLAY CLOSE HANDLERS
   ════════════════════════════ */
['scoreboard-overlay','settings-overlay','info-overlay','menu-overlay','confirm-overlay','pack-preview-overlay','pack-editor-overlay','pack-wizard-overlay'].forEach(id => { const el = $('#' + id); if (el) el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); }); });
$('#scoreboard-fab').addEventListener('click', () => { renderScoreboardWithTrends(); $('#scoreboard-overlay').classList.add('open'); });
$('#btn-sb-close').addEventListener('click', () => $('#scoreboard-overlay').classList.remove('open'));
$('#btn-settings-close').addEventListener('click', () => $('#settings-overlay').classList.remove('open'));
$('#btn-info-close').addEventListener('click', () => $('#info-overlay').classList.remove('open'));
$('#btn-preview-close').addEventListener('click', () => $('#pack-preview-overlay').classList.remove('open'));
$('#btn-imp-settings').addEventListener('click', () => openSettings('imposter'));
$('#btn-triv-settings').addEventListener('click', () => openSettings('trivia'));
$('#btn-ht-settings').addEventListener('click', () => openSettings('hottake'));
$('#btn-global-settings').addEventListener('click', () => openSettings(null));
$('#btn-imp-info').addEventListener('click', e => { e.stopPropagation(); showScoringInfo('imposter'); });
$('#btn-triv-info').addEventListener('click', e => { e.stopPropagation(); showScoringInfo('trivia'); });
$('#btn-ht-info').addEventListener('click', e => { e.stopPropagation(); showScoringInfo('hottake'); });
$('#btn-saves-back').addEventListener('click', () => showScreen(gameState.currentScreen === 'screen-saves' ? 'screen-home' : gameState.currentScreen));
$('#continue-banner').addEventListener('click', () => {
  // Auto-load most recent save directly
  const auto = getSaveSlotInfo('auto');
  if (auto && loadFromSlot('auto')) { rebuildAfterLoad(); return; }
  for (let i = 0; i < 3; i++) { if (getSaveSlotInfo(i) && loadFromSlot(i)) { rebuildAfterLoad(); return; } }
});

/* ════════════════════════════
   IMPORT/CREATE PACK SHORTCUTS
   ════════════════════════════ */
['imp', 'triv'].forEach(prefix => {
  const gt = prefix === 'imp' ? 'imposter' : 'trivia';
  const importBtn = $('#btn-' + prefix + '-import');
  const createBtn = $('#btn-' + prefix + '-create');
  if (importBtn) importBtn.addEventListener('click', () => { cmActiveTab = gt; $('#cm-import-file').click(); });
  if (createBtn) createBtn.addEventListener('click', () => { cmActiveTab = gt; wizardStep = 1; wizardData = { gameType: gt, name: '', emoji: '🎮', entries: [] }; renderWizard(); $('#pack-wizard-overlay').classList.add('open'); });
});

/* ════════════════════════════
   SESSION MANAGEMENT
   ════════════════════════════ */
function updateHomePlayerStrip() {
  const strip = $('#home-player-strip'), btns = $('#home-session-btns'), players = allPlayers();
  if (!strip || !btns) return;
  if (players.length === 0) { strip.classList.add('hidden'); btns.classList.add('hidden'); return; }
  strip.classList.remove('hidden'); btns.classList.remove('hidden');
  strip.innerHTML = players.map((p, i) => '<span class="player-pip" style="background:' + playerColor(i) + '">' + esc(p.name) + '</span>').join('');
}
const resetBtn = $('#btn-reset-scores');
if (resetBtn) resetBtn.addEventListener('click', () => {
  showConfirm('Reset Scoreboard?', 'All player scores will be set to zero.', () => {
    Object.keys(gameState.scores.byPlayer).forEach(id => { gameState.scores.byPlayer[id] = 0; });
    gameState.scores.byGame = {}; gameState.scores.history = [];
    showToast('Scores reset!', 'success');
  });
});
const endBtn = $('#btn-end-session');
if (endBtn) endBtn.addEventListener('click', () => {
  showConfirm('End Session?', 'This will remove all players and scores.', () => {
    gameState.session.players = []; gameState.scores = { byPlayer: {}, byGame: {}, history: [], streaks: {} };
    updateHomePlayerStrip(); updatePlayersCard();
    showToast('Session ended', 'info');
  });
});

/* ════════════════════════════
   TRIVIA QUICK ADD
   ════════════════════════════ */
const qaPanel = $('#triv-quick-add-panel');
if ($('#btn-triv-quick-add')) $('#btn-triv-quick-add').addEventListener('click', () => { if (qaPanel) qaPanel.classList.toggle('hidden'); });
gameState.trivia.customQuestions = [];
if ($('#btn-qa-add')) $('#btn-qa-add').addEventListener('click', () => {
  const q = $('#qa-question').value.trim(), a1 = $('#qa-ans-1').value.trim(), a2 = $('#qa-ans-2').value.trim(), a3 = $('#qa-ans-3').value.trim(), a4 = $('#qa-ans-4').value.trim();
  if (!q || !a1 || !a2) { showToast('Need question + at least 2 answers', 'warning'); return; }
  const answers = [a1, a2]; if (a3) answers.push(a3); if (a4) answers.push(a4);
  gameState.trivia.customQuestions.push({ question: q, answers, correct: 0 });
  $('#qa-question').value = ''; $('#qa-ans-1').value = ''; $('#qa-ans-2').value = ''; $('#qa-ans-3').value = ''; $('#qa-ans-4').value = '';
  const count = $('#qa-count'); if (count) count.textContent = gameState.trivia.customQuestions.length + ' custom question' + (gameState.trivia.customQuestions.length !== 1 ? 's' : '') + ' added';
  showToast('Question added!', 'success');
});
if ($('#btn-qa-done')) $('#btn-qa-done').addEventListener('click', () => {
  const cq = gameState.trivia.customQuestions;
  if (cq.length === 0) { if (qaPanel) qaPanel.classList.add('hidden'); return; }
  // Add as virtual pack
  if (!gameState.packs.trivia) gameState.packs.trivia = [];
  const existing = gameState.packs.trivia.findIndex(p => p.pack === 'Custom Questions');
  if (existing >= 0) gameState.packs.trivia.splice(existing, 1);
  gameState.packs.trivia.unshift({ pack: 'Custom Questions', emoji: '⚡', count: cq.length, file: '__custom__' });
  renderAllPackCards();
  if (qaPanel) qaPanel.classList.add('hidden');
  showToast(cq.length + ' custom questions ready!', 'success');
});

/* ════════════════════════════
   INIT
   ════════════════════════════ */
loadSettings();
applyTheme(gameState.session.settings.global.theme);
checkForSaves();
// Load packs on app init since home screen is now the first screen
(async () => { await loadPacks(); renderAllPackCards(); })();

})();

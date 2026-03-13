const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ── Config from env ──
const PORT = process.env.PORT || 3000;
const HOST_URL = process.env.HOST_URL || null; // auto-detect if not set
const SESSION_CLEANUP_HOURS = Number(process.env.SESSION_CLEANUP_HOURS) || 2;
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 100;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS_PER_ROOM) || 10;

// ── CORS for deployed environments ──
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 30000,
  pingTimeout: 10000,
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "1mb" }));

// ── Helpers ──
const CONTENT_DIR = path.join(__dirname, "content");
const CUSTOM_DIR = path.join(CONTENT_DIR, "custom");

function ensureCustomDir(gameType) {
  const dir = path.join(CUSTOM_DIR, gameType);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function scanPacks(baseDir, custom) {
  const packs = {};
  try {
    for (const gameType of fs.readdirSync(baseDir)) {
      if (gameType === "custom") continue;
      const gameDir = path.join(baseDir, gameType);
      if (!fs.statSync(gameDir).isDirectory()) continue;
      if (!packs[gameType]) packs[gameType] = [];
      for (const file of fs.readdirSync(gameDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(gameDir, file), "utf-8"));
          const count = data.rounds ? data.rounds.length : data.questions ? data.questions.length : data.spectrums ? data.spectrums.length : data.words ? data.words.length : data.scenarios ? data.scenarios.length : data.roles ? Object.keys(data.roles).length + (data.nightMessages || []).length : 0;
          packs[gameType].push({ file, pack: data.pack, emoji: data.emoji || "", count, custom: !!custom });
        } catch (_) {}
      }
    }
  } catch (_) {}
  return packs;
}

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function getHostURL() {
  if (HOST_URL) return HOST_URL.replace(/\/$/, "");
  const ip = getLanIP();
  return "http://" + ip + ":" + PORT;
}

function sanitize(str, maxLen) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen || 20);
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
}

// ── Health endpoint ──
app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", rooms: rooms.size, uptime: process.uptime() });
});

// ── Pack API ──
app.get("/api/packs", (req, res) => {
  const builtIn = scanPacks(CONTENT_DIR, false);
  const custom = scanPacks(CUSTOM_DIR, true);
  const result = { ...builtIn };
  for (const [gameType, packs] of Object.entries(custom)) {
    if (!result[gameType]) result[gameType] = [];
    result[gameType].push(...packs);
  }
  res.json(result);
});

app.get("/api/packs/:gameType/:file", (req, res) => {
  const { gameType, file } = req.params;
  if (!file.endsWith(".json")) return res.status(400).json({ error: "Invalid file" });
  let filePath = path.join(CONTENT_DIR, gameType, file);
  if (!fs.existsSync(filePath)) filePath = path.join(CUSTOM_DIR, gameType, file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Pack not found" });
  try { res.json(JSON.parse(fs.readFileSync(filePath, "utf-8"))); }
  catch { res.status(500).json({ error: "Failed to read pack" }); }
});

// ── Custom Pack CRUD ──
const VALID_TYPES = ["imposter", "trivia", "hottake", "mafia", "millionaire", "feud", "wavelength", "alias", "drawing"];

function validatePack(gameType, data) {
  if (!data.pack || typeof data.pack !== "string") return "Pack name required";
  if (gameType === "imposter") {
    if (!Array.isArray(data.rounds) || data.rounds.length === 0) return "Rounds array required";
    for (const r of data.rounds) { if (!r.word) return "Each round needs a word"; }
  } else if (gameType === "trivia") {
    if (!Array.isArray(data.questions) || data.questions.length === 0) return "Questions array required";
    for (const q of data.questions) {
      if (!q.question || !Array.isArray(q.answers) || q.answers.length !== 4) return "Each question needs text and 4 answers";
      if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) return "Each question needs a correct index 0-3";
    }
  } else if (gameType === "hottake") {
    if (!Array.isArray(data.questions) || data.questions.length === 0) return "Questions array required";
    for (const q of data.questions) { if (!q.question || !q.optionA || !q.optionB) return "Each question needs question, optionA, optionB"; }
  } else if (gameType === "wavelength") {
    if (!Array.isArray(data.spectrums) || data.spectrums.length === 0) return "Spectrums array required";
    for (const s of data.spectrums) { if (!s.left || !s.right) return "Each spectrum needs left and right"; }
  } else if (gameType === "alias") {
    if (!Array.isArray(data.words) || data.words.length === 0) return "Words array required";
    for (const w of data.words) { if (!w.word) return "Each entry needs a word"; }
  } else if (gameType === "drawing") {
    if (!Array.isArray(data.words) || data.words.length === 0) return "Words array required";
    for (const w of data.words) { if (!w.word) return "Each entry needs a word"; }
  } else if (gameType === "feud") {
    if (!Array.isArray(data.questions) || data.questions.length === 0) return "Questions array required";
    for (const q of data.questions) { if (!q.question || !Array.isArray(q.answers)) return "Each question needs question and answers"; }
  } else if (gameType === "millionaire") {
    if (!Array.isArray(data.questions) || data.questions.length === 0) return "Questions array required";
  } else if (gameType === "mafia") {
    if (!data.roles && !data.scenarios) return "Mafia pack needs roles object or scenarios array";
    if (data.scenarios && !Array.isArray(data.scenarios)) return "Scenarios must be an array";
  }
  return null;
}

app.post("/api/custom-packs", (req, res) => {
  const { gameType, ...packData } = req.body;
  if (!VALID_TYPES.includes(gameType)) return res.status(400).json({ error: "Invalid game type" });
  const err = validatePack(gameType, packData);
  if (err) return res.status(400).json({ error: err });
  const dir = ensureCustomDir(gameType);
  const id = "custom_" + Date.now();
  const filename = id + ".json";
  const toWrite = { ...packData };
  if (!toWrite.emoji) toWrite.emoji = "";
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(toWrite, null, 2));
  res.json({ file: filename, id });
});

app.put("/api/custom-packs/:gameType/:file", (req, res) => {
  const { gameType, file } = req.params;
  if (!VALID_TYPES.includes(gameType)) return res.status(400).json({ error: "Invalid game type" });
  if (!file.endsWith(".json")) return res.status(400).json({ error: "Invalid file" });
  const filePath = path.join(CUSTOM_DIR, gameType, file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Pack not found" });
  const packData = req.body;
  const err = validatePack(gameType, packData);
  if (err) return res.status(400).json({ error: err });
  if (!packData.emoji) packData.emoji = "";
  fs.writeFileSync(filePath, JSON.stringify(packData, null, 2));
  res.json({ ok: true });
});

app.delete("/api/custom-packs/:gameType/:file", (req, res) => {
  const { gameType, file } = req.params;
  const filePath = path.join(CUSTOM_DIR, gameType, file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Pack not found" });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// ── Server Info ──
app.get("/api/server-info", (req, res) => {
  res.json({ ip: getLanIP(), port: PORT, hostUrl: getHostURL() });
});

// ══════════════════════════════════════════
// MULTIPLAYER ROOM MANAGEMENT
// ══════════════════════════════════════════

const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

// Cleanup stale rooms
setInterval(() => {
  const now = Date.now();
  const maxAge = SESSION_CLEANUP_HOURS * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > maxAge) {
      io.to(code).emit("msg", { type: "room_expired", payload: { message: "Room expired due to inactivity" } });
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

function getRoom(code) { return rooms.get(code?.toUpperCase()); }

function broadcastRoomUpdate(code) {
  const room = getRoom(code);
  if (!room) return;
  const playerList = room.players.map(p => ({
    id: p.id, name: p.name, avatar: p.avatar, isHost: p.isHost,
    isConnected: p.isConnected, teamId: p.teamId, score: p.score, ready: p.ready,
  }));
  io.to(code).emit("msg", {
    type: "room_update",
    payload: { players: playerList, phase: room.phase, settings: room.settings, teams: room.teams || null },
  });
}

function sendToPlayer(wsId, type, payload) {
  io.to(wsId).emit("msg", { type, payload });
}

function sendToHost(room, type, payload) {
  if (room.hostWsId) io.to(room.hostWsId).emit("msg", { type, payload });
}

function broadcastToRoom(code, type, payload) {
  io.to(code).emit("msg", { type, payload });
}

function broadcastToPlayersOnly(room, code, type, payload) {
  room.players.filter(p => !p.isHost && p.isConnected).forEach(p => {
    sendToPlayer(p.wsId, type, payload);
  });
}

// ── Rate limiter ──
const rateLimits = new Map();
function checkRateLimit(socketId) {
  const now = Date.now();
  const entry = rateLimits.get(socketId) || { count: 0, window: now };
  if (now - entry.window > 1000) { entry.count = 0; entry.window = now; }
  entry.count++;
  rateLimits.set(socketId, entry);
  return entry.count <= 10;
}

// ── Message queue for reconnection ──
function queueMessage(room, playerId, type, payload) {
  if (!room._messageQueues) room._messageQueues = {};
  if (!room._messageQueues[playerId]) room._messageQueues[playerId] = [];
  const q = room._messageQueues[playerId];
  q.push({ type, payload, ts: Date.now() });
  if (q.length > 10) q.shift();
}

function flushMessageQueue(room, playerId, wsId) {
  if (!room._messageQueues || !room._messageQueues[playerId]) return;
  const q = room._messageQueues[playerId];
  q.forEach(m => sendToPlayer(wsId, m.type, m.payload));
  room._messageQueues[playerId] = [];
}

// ══════════════════════════════════════════
// SOCKET.IO CONNECTION HANDLER
// ══════════════════════════════════════════

io.on("connection", (socket) => {
  let currentRoom = null;
  let currentPlayerId = null;

  socket.on("msg", (data) => {
    if (!data || !data.type) return;
    if (!checkRateLimit(socket.id)) return;

    const { type, payload, roomCode } = data;

    switch (type) {
      // ────────────────────────
      // HOST ACTIONS
      // ────────────────────────
      case "create_room": {
        if (rooms.size >= MAX_ROOMS) {
          return sendToPlayer(socket.id, "error", { message: "Server full — max rooms reached" });
        }
        const code = generateRoomCode();
        const hostName = sanitize(payload.hostName, 20) || "Host";
        const hostAvatar = payload.hostAvatar || "🎮";
        const hostId = uuid();
        const room = {
          code,
          hostWsId: socket.id,
          hostId: hostId,
          hostDeviceId: payload.deviceId || uuid(),
          players: [{
            id: hostId, name: hostName, deviceId: payload.deviceId || uuid(),
            wsId: socket.id, isHost: true, isConnected: true,
            teamId: null, avatar: hostAvatar, score: 0, ready: true,
          }],
          gameType: null,
          gameState: {},
          settings: payload.settings || {},
          phase: "lobby",
          teams: null,
          locked: false,
          paused: false,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          chat: [],
          clueConfirmations: new Set(),
          roundVotes: {},
          votingOpen: false,
        };
        rooms.set(code, room);
        currentRoom = code;
        currentPlayerId = hostId;
        socket.join(code);
        const hostUrl = getHostURL();
        sendToPlayer(socket.id, "room_created", {
          roomCode: code, hostUrl, joinUrl: hostUrl + "/join.html?code=" + code,
          qrData: hostUrl + "/join.html?code=" + code,
        });
        broadcastRoomUpdate(code);
        break;
      }

      case "join_room": {
        const code = (payload.roomCode || "").toUpperCase();
        const room = getRoom(code);
        if (!room) return sendToPlayer(socket.id, "error", { message: "Room not found" });
        if (room.locked && room.phase !== "lobby") return sendToPlayer(socket.id, "error", { message: "Room is locked" });
        if (room.players.length >= MAX_PLAYERS) return sendToPlayer(socket.id, "error", { message: "Room is full" });

        const name = sanitize(payload.name, 20) || "Player";
        const avatar = payload.avatar || "🦊";
        const deviceId = payload.deviceId || uuid();

        // Check for rejoin by deviceId
        const existing = room.players.find(p => p.deviceId === deviceId);
        if (existing) {
          existing.wsId = socket.id;
          existing.isConnected = true;
          existing.name = name;
          existing.avatar = avatar;
          currentRoom = code;
          currentPlayerId = existing.id;
          socket.join(code);
          room.lastActivity = Date.now();
          sendToPlayer(socket.id, "rejoin_success", {
            playerId: existing.id, roomCode: code,
            gameState: room.gameState, phase: room.phase, yourPlayer: existing,
          });
          flushMessageQueue(room, existing.id, socket.id);
          broadcastRoomUpdate(code);
          sendToHost(room, "player_reconnected", { playerId: existing.id, name: existing.name });
          break;
        }

        // Check duplicate name
        if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
          return sendToPlayer(socket.id, "error", { message: "Name already taken" });
        }

        const player = {
          id: uuid(), name, deviceId, wsId: socket.id,
          isHost: false, isConnected: true, teamId: null,
          avatar, score: 0, ready: false,
        };
        room.players.push(player);
        currentRoom = code;
        currentPlayerId = player.id;
        socket.join(code);
        room.lastActivity = Date.now();

        sendToPlayer(socket.id, "join_success", {
          playerId: player.id, roomCode: code, hostName: room.players.find(p => p.isHost)?.name,
          players: room.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isHost: p.isHost, isConnected: p.isConnected, teamId: p.teamId, ready: p.ready })),
          phase: room.phase, settings: room.settings, gameState: room.gameState,
        });
        broadcastRoomUpdate(code);
        broadcastToRoom(code, "player_joined", { player: { id: player.id, name: player.name, avatar: player.avatar } });
        sendToHost(room, "player_joined_host", { player });
        break;
      }

      case "player_ready": {
        const room = getRoom(currentRoom);
        if (!room) return;
        const player = room.players.find(p => p.id === currentPlayerId);
        if (player) { player.ready = !player.ready; broadcastRoomUpdate(currentRoom); }
        break;
      }

      case "chat_message": {
        const room = getRoom(currentRoom);
        if (!room || room.phase !== "lobby") return;
        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) return;
        const text = sanitize(payload.text, 50);
        if (!text) return;
        const msg = { playerId: player.id, name: player.name, avatar: player.avatar, text, ts: Date.now() };
        room.chat.push(msg);
        if (room.chat.length > 20) room.chat.shift();
        broadcastToRoom(currentRoom, "chat_message", msg);
        break;
      }

      case "emoji_reaction": {
        const room = getRoom(currentRoom);
        if (!room) return;
        const player = room.players.find(p => p.id === currentPlayerId);
        if (!player) return;
        if (player._lastReaction && Date.now() - player._lastReaction < 3000) return;
        player._lastReaction = Date.now();
        broadcastToRoom(currentRoom, "emoji_reaction", { playerId: player.id, emoji: sanitize(payload.emoji, 4) });
        break;
      }

      // ────────────────────────
      // HOST GAME CONTROLS
      // ────────────────────────
      case "start_game": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        room.phase = "playing";
        room.gameType = payload.gameType || room.gameType;
        room.settings = payload.settings || room.settings;
        room.gameState = payload.gameState || {};
        room.lastActivity = Date.now();
        room.clueConfirmations = new Set();
        room.roundVotes = {};
        room.votingOpen = false;
        broadcastToRoom(currentRoom, "game_started", { gameType: room.gameType, settings: room.settings });
        broadcastRoomUpdate(currentRoom);
        break;
      }

      case "next_phase": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        room.phase = payload.phase || room.phase;
        if (payload.gameState) Object.assign(room.gameState, payload.gameState);
        room.lastActivity = Date.now();
        broadcastToRoom(currentRoom, "phase_change", { phase: payload.phase, data: payload.data });
        break;
      }

      case "host_update": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        if (payload.gameState) Object.assign(room.gameState, payload.gameState);
        room.lastActivity = Date.now();
        // Track voting_open state server-side
        if (payload.event === "voting_open") {
          room.votingOpen = true;
          room.roundVotes = {};
        }
        // Forward to all players
        broadcastToPlayersOnly(room, currentRoom, "host_update", payload);
        break;
      }

      case "send_to_player": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        const target = room.players.find(p => p.id === payload.playerId);
        if (target && target.isConnected) {
          sendToPlayer(target.wsId, payload.event, payload.data);
        } else if (target) {
          queueMessage(room, target.id, payload.event, payload.data);
        }
        break;
      }

      case "kick_player": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        const target = room.players.find(p => p.id === payload.targetId);
        if (target && !target.isHost) {
          if (target.isConnected) sendToPlayer(target.wsId, "kicked", { message: "You were removed from the room" });
          room.players = room.players.filter(p => p.id !== payload.targetId);
          broadcastRoomUpdate(currentRoom);
        }
        break;
      }

      case "pause_game": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        room.paused = !room.paused;
        broadcastToRoom(currentRoom, "game_paused", { paused: room.paused });
        break;
      }

      case "skip_round": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        broadcastToRoom(currentRoom, "round_skipped", payload);
        break;
      }

      case "adjust_score": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        const target = room.players.find(p => p.id === payload.playerId);
        if (target) {
          target.score += (payload.delta || 0);
          broadcastToRoom(currentRoom, "score_update", {
            scores: Object.fromEntries(room.players.map(p => [p.id, p.score])),
          });
        }
        break;
      }

      case "extend_timer": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        broadcastToRoom(currentRoom, "timer_extended", { seconds: payload.seconds || 30 });
        break;
      }

      case "lock_room": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        room.locked = !!payload.locked;
        broadcastToRoom(currentRoom, "room_locked", { locked: room.locked });
        break;
      }

      case "end_game": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        room.phase = "results";
        broadcastToRoom(currentRoom, "game_ended", { finalScores: payload.finalScores, stats: payload.stats });
        break;
      }

      case "update_settings": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        room.settings = { ...room.settings, ...payload.settings };
        broadcastRoomUpdate(currentRoom);
        break;
      }

      case "assign_teams": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        room.teams = payload.teams;
        if (payload.assignments) {
          for (const [teamId, playerIds] of Object.entries(payload.assignments)) {
            playerIds.forEach(pid => {
              const p = room.players.find(pl => pl.id === pid);
              if (p) p.teamId = teamId;
            });
          }
        }
        broadcastRoomUpdate(currentRoom);
        break;
      }

      case "return_to_lobby": {
        const room = getRoom(currentRoom);
        if (!room || socket.id !== room.hostWsId) return;
        room.phase = "lobby";
        room.gameState = {};
        room.players.forEach(p => { p.ready = p.isHost; });
        broadcastRoomUpdate(currentRoom);
        broadcastToRoom(currentRoom, "return_to_lobby", {});
        break;
      }

      // ────────────────────────
      // PLAYER GAME ACTIONS
      // ────────────────────────
      case "submit_answer": {
        const room = getRoom(currentRoom);
        if (!room) return;
        // Validate answer index is a number 0-3
        if (typeof payload.answer === 'number' && (payload.answer < 0 || payload.answer > 3)) return;
        if (typeof payload.answerIdx === 'number' && (payload.answerIdx < 0 || payload.answerIdx > 3)) return;
        // Dedup: reject duplicate answers from the same player for the same question
        if (!room._answeredQuestions) room._answeredQuestions = {};
        const qIdx = payload.questionIndex != null ? payload.questionIndex : (payload.qIdx != null ? payload.qIdx : null);
        if (qIdx != null) {
          const key = currentPlayerId + ':' + qIdx;
          if (room._answeredQuestions[key]) return;
          room._answeredQuestions[key] = true;
        }
        room.lastActivity = Date.now();
        sendToHost(room, "player_answer", {
          playerId: currentPlayerId,
          playerName: room.players.find(p => p.id === currentPlayerId)?.name,
          answer: payload.answer, answerIdx: payload.answerIdx,
          questionIndex: payload.questionIndex, timeRemaining: payload.timeRemaining,
        });
        // Tell all players someone answered (no answer content)
        broadcastToRoom(currentRoom, "answer_received", { playerId: currentPlayerId, questionIndex: payload.questionIndex });
        break;
      }

      case "submit_vote": {
        const room = getRoom(currentRoom);
        if (!room) return;
        // Validate vote target is a valid player ID string
        if (payload.targetId && typeof payload.targetId !== 'string') return;
        if (payload.targetId && !room.players.some(p => p.id === payload.targetId)) return;
        room.lastActivity = Date.now();
        sendToHost(room, "player_vote", {
          playerId: currentPlayerId,
          playerName: room.players.find(p => p.id === currentPlayerId)?.name,
          targetId: payload.targetId, target: payload.target,
        });
        // Server-side vote tracking for live counters
        if (room.votingOpen && !room.roundVotes[currentPlayerId]) {
          room.roundVotes[currentPlayerId] = payload.targetId;
          const nonHostCount = room.players.filter(p => !p.isHost && p.isConnected).length;
          const voteCount = Object.keys(room.roundVotes).length;
          broadcastToRoom(currentRoom, "vote_count_update", { count: voteCount, total: nonHostCount });
          if (voteCount >= nonHostCount) {
            room.votingOpen = false;
            broadcastToRoom(currentRoom, "all_votes_in", { votes: room.roundVotes });
            room.roundVotes = {};
          }
        }
        break;
      }

      case "submit_choice": {
        const room = getRoom(currentRoom);
        if (!room) return;
        room.lastActivity = Date.now();
        sendToHost(room, "player_choice", {
          playerId: currentPlayerId,
          playerName: room.players.find(p => p.id === currentPlayerId)?.name,
          choice: payload.choice,
        });
        break;
      }

      case "submit_guess": {
        const room = getRoom(currentRoom);
        if (!room) return;
        room.lastActivity = Date.now();
        sendToHost(room, "player_guess", {
          playerId: currentPlayerId,
          playerName: room.players.find(p => p.id === currentPlayerId)?.name,
          guess: sanitize(payload.guess, 50),
        });
        broadcastToRoom(currentRoom, "guess_submitted", {
          playerId: currentPlayerId,
          playerName: room.players.find(p => p.id === currentPlayerId)?.name,
          guess: sanitize(payload.guess, 50),
        });
        break;
      }

      case "submit_night_action": {
        const room = getRoom(currentRoom);
        if (!room) return;
        room.lastActivity = Date.now();
        sendToHost(room, "night_action", {
          playerId: currentPlayerId,
          role: payload.role, targetId: payload.targetId,
        });
        break;
      }

      case "submit_slider": {
        const room = getRoom(currentRoom);
        if (!room) return;
        room.lastActivity = Date.now();
        sendToHost(room, "player_slider", {
          playerId: currentPlayerId,
          value: payload.value,
        });
        break;
      }

      case "submit_buzz": {
        const room = getRoom(currentRoom);
        if (!room) return;
        room.lastActivity = Date.now();
        sendToHost(room, "player_buzz", {
          playerId: currentPlayerId,
          playerName: room.players.find(p => p.id === currentPlayerId)?.name,
          ts: Date.now(),
        });
        break;
      }

      case "drawing_stroke": {
        const room = getRoom(currentRoom);
        if (!room) return;
        // Relay drawing data to host (and all players for live view)
        broadcastToRoom(currentRoom, "drawing_stroke", { playerId: currentPlayerId, stroke: payload.stroke });
        break;
      }

      case "drawing_clear": {
        const room = getRoom(currentRoom);
        if (!room) return;
        broadcastToRoom(currentRoom, "drawing_clear", { playerId: currentPlayerId });
        break;
      }

      case "confirm_clue": {
        const room = getRoom(currentRoom);
        if (!room) return;
        sendToHost(room, "player_confirmed_clue", { playerId: currentPlayerId });
        // Server-side clue confirmation tracking
        room.clueConfirmations.add(currentPlayerId);
        const nonHostConnected = room.players.filter(p => !p.isHost && p.isConnected).length;
        broadcastToRoom(currentRoom, "clue_confirm_count", { confirmed: room.clueConfirmations.size, total: nonHostConnected });
        if (room.clueConfirmations.size >= nonHostConnected) {
          broadcastToRoom(currentRoom, "all_clues_confirmed", {});
          room.clueConfirmations = new Set();
        }
        break;
      }

      // ────────────────────────
      // RECONNECTION
      // ────────────────────────
      case "request_rejoin": {
        const code = (payload.roomCode || "").toUpperCase();
        const room = getRoom(code);
        if (!room) return sendToPlayer(socket.id, "error", { message: "Room not found" });
        const player = room.players.find(p => p.deviceId === payload.deviceId);
        if (!player) return sendToPlayer(socket.id, "error", { message: "Player not found in room" });
        player.wsId = socket.id;
        player.isConnected = true;
        currentRoom = code;
        currentPlayerId = player.id;
        socket.join(code);
        sendToPlayer(socket.id, "rejoin_success", {
          playerId: player.id, roomCode: code,
          gameState: room.gameState, phase: room.phase, yourPlayer: player,
        });
        flushMessageQueue(room, player.id, socket.id);
        broadcastRoomUpdate(code);
        sendToHost(room, "player_reconnected", { playerId: player.id, name: player.name });
        break;
      }
    }
  });

  // ── Legacy event support (backwards compatibility with old join.html) ──
  socket.on("create_room", (data) => {
    socket.emit("msg", { type: "create_room", payload: data });
  });
  socket.on("join_room", (data) => {
    const code = data.code || data.roomCode;
    socket.emit("msg", { type: "join_room", payload: { ...data, roomCode: code } });
  });
  socket.on("start_game", (data) => {
    socket.emit("msg", { type: "start_game", payload: data || {} });
  });
  socket.on("send_to_player", (msg) => {
    socket.emit("msg", { type: "send_to_player", payload: msg });
  });
  socket.on("host_update", (data) => {
    socket.emit("msg", { type: "host_update", payload: data });
  });
  socket.on("submit_vote", (data) => {
    socket.emit("msg", { type: "submit_vote", payload: data });
  });
  socket.on("submit_answer", (data) => {
    socket.emit("msg", { type: "submit_answer", payload: data });
  });
  socket.on("submit_choice", (data) => {
    socket.emit("msg", { type: "submit_choice", payload: data });
  });

  // ── Disconnect handler ──
  socket.on("disconnect", () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    if (socket.id === room.hostWsId) {
      // Host disconnected — mark disconnected, don't delete room
      const host = room.players.find(p => p.isHost);
      if (host) host.isConnected = false;
      room.hostWsId = null;
      broadcastToRoom(currentRoom, "host_disconnected", {});

      // Auto-promote after 60 seconds if host doesn't return
      room._hostTimeout = setTimeout(() => {
        const r = getRoom(currentRoom);
        if (!r || r.hostWsId) return; // host reconnected
        const newHost = r.players.find(p => p.isConnected && !p.isHost);
        if (newHost) {
          const oldHost = r.players.find(p => p.isHost);
          if (oldHost) oldHost.isHost = false;
          newHost.isHost = true;
          r.hostWsId = newHost.wsId;
          r.hostId = newHost.id;
          broadcastToRoom(currentRoom, "host_promoted", { playerId: newHost.id, name: newHost.name });
          broadcastRoomUpdate(currentRoom);
        } else {
          // No connected players — delete room
          rooms.delete(currentRoom);
        }
      }, 60000);
    } else {
      // Player disconnected
      const player = room.players.find(p => p.wsId === socket.id);
      if (player) {
        player.isConnected = false;
        broadcastRoomUpdate(currentRoom);
        sendToHost(room, "player_disconnected", { playerId: player.id, name: player.name });
      }
    }
  });
});

// ── Graceful shutdown ──
function gracefulShutdown() {
  console.log("Shutting down gracefully...");
  for (const [code] of rooms) {
    io.to(code).emit("msg", { type: "server_closing", payload: { message: "Server is restarting" } });
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ── Start ──
server.listen(PORT, () => {
  const hostUrl = getHostURL();
  console.log("");
  console.log("=== Party Games v1.0 ===");
  console.log("Server running at http://localhost:" + PORT);
  if (!HOST_URL) {
    const ip = getLanIP();
    console.log("LAN access:        http://" + ip + ":" + PORT);
    console.log("Join page:         http://" + ip + ":" + PORT + "/join.html");
  } else {
    console.log("Host URL:          " + hostUrl);
    console.log("Join page:         " + hostUrl + "/join.html");
  }
  console.log("");
});

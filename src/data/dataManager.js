import defaultData from './defaultData.json';

const STORAGE_KEY = 'svs_rally_data';
const CURRENT_VERSION = '2.1.0';

// ── Load / Save ────────────────────────────────────────────────
export function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migrateIfNeeded(parsed);
    }
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
  }
  return structuredClone(defaultData);
}

export function saveData(data) {
  try {
    const toSave = { ...data, lastUpdated: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    return toSave;
  } catch (e) {
    console.error('Failed to save', e);
    return data;
  }
}

// ── Export / Import ────────────────────────────────────────────
export function exportData(data, allianceTag) {
  const exportObj = {
    _version: CURRENT_VERSION,
    _exported: new Date().toISOString(),
    _note: 'Exported from Sunfire Castle Rally Planner.',
    ...data,
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `svs-${allianceTag || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        resolve(migrateIfNeeded(parsed));
      } catch (err) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function mergeData(current, incoming) {
  const playerMap = new Map();
  current.players.forEach(p => playerMap.set(p.id, p));
  (incoming.players || []).forEach(p => {
    if (playerMap.has(p.id)) {
      playerMap.set(p.id, mergePlayerObjects(playerMap.get(p.id), p));
    } else {
      const normIncoming = normalizeName(p.username || p.alias || '');
      const byName = [...playerMap.values()].find(ep =>
        normalizeName(ep.username || ep.alias || '') === normIncoming && normIncoming !== ''
      );
      if (byName) {
        playerMap.set(byName.id, mergePlayerObjects(byName, p));
      } else {
        playerMap.set(p.id, p);
      }
    }
  });

  const eventMap = new Map((current.events || []).map(e => [e.id, e]));
  (incoming.events || []).forEach(e => {
    eventMap.set(e.id, eventMap.has(e.id) ? { ...eventMap.get(e.id), ...e } : e);
  });

  return {
    ...current,
    ...incoming,
    players: Array.from(playerMap.values()),
    events: Array.from(eventMap.values()),
    lastUpdated: new Date().toISOString(),
  };
}

// ── Name normalization ─────────────────────────────────────────
export function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')                          // collapse multiple spaces
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ''); // strip invisible chars
}

// Similarity score 0-1 (for fuzzy duplicate detection)
export function nameSimilarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  // Simple: check if one contains the other or share prefix
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.85;
  // Levenshtein-lite: check edit distance / length
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  const dist = levenshtein(longer, shorter);
  return 1 - dist / longer.length;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ── Batch resolution ───────────────────────────────────────────
// Resolves a list of raw name strings against existing players.
// Returns { exact: [], fuzzy: [], fresh: [] }
export function resolveBatchNames(rawNames, existingPlayers) {
  const exact   = []; // { name, existingPlayer } — will update
  const fuzzy   = []; // { name, existingPlayer, score } — needs review
  const fresh   = []; // { name } — will create new

  rawNames.forEach(name => {
    const norm = normalizeName(name);
    if (!norm) return;

    // Try FID match (if name is numeric)
    if (/^\d+$/.test(norm)) {
      const byFid = existingPlayers.find(p => p.fid && p.fid.toString() === norm);
      if (byFid) { exact.push({ name, existingPlayer: byFid }); return; }
    }

    // Exact normalized username match
    const byExact = existingPlayers.find(p =>
      normalizeName(p.username || p.alias || '') === norm
    );
    if (byExact) { exact.push({ name, existingPlayer: byExact }); return; }

    // Fuzzy match — score > 0.75 and < 1.0
    let bestMatch = null, bestScore = 0;
    existingPlayers.forEach(p => {
      const score = nameSimilarity(name, p.username || p.alias || '');
      if (score > bestScore && score > 0.75 && score < 1.0) {
        bestScore = score; bestMatch = p;
      }
    });

    if (bestMatch) {
      fuzzy.push({ name, existingPlayer: bestMatch, score: bestScore });
    } else {
      fresh.push({ name });
    }
  });

  return { exact, fuzzy, fresh };
}

// Merge two player objects — never overwrite existing value with blank
export function mergePlayerObjects(existing, incoming) {
  const merged = { ...existing };
  Object.entries(incoming).forEach(([key, val]) => {
    if (key === 'eventHistory') {
      const histMap = new Map((existing.eventHistory || []).map(s => [s.snapshotId, s]));
      (incoming.eventHistory || []).forEach(s => {
        if (!histMap.has(s.snapshotId)) histMap.set(s.snapshotId, s);
      });
      merged.eventHistory = Array.from(histMap.values());
    } else if (val !== null && val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0)) {
      merged[key] = val;
    }
  });
  merged.profileLastUpdated = new Date().toISOString();
  return merged;
}

// ── Event helpers ──────────────────────────────────────────────
export const EVENT_TYPES = [
  'SvS', 'Foundry', 'Canyon Clash', 'Bear Trap',
  'Sunfire Castle', 'Transfer Season', 'Custom',
];

export function newEvent(overrides = {}) {
  return {
    id: uid(),
    type: 'SvS',
    name: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'upcoming',
    notes: '',
    createdAt: new Date().toISOString(),
    snapshots: [],
    ...overrides,
  };
}

export function newSnapshot(playerId, playerProfile, eventId) {
  return {
    snapshotId: uid(),
    eventId,
    playerId,
    createdAt: new Date().toISOString(),
    profileSnapshot: {
      username:     playerProfile.username     || '',
      alias:        playerProfile.alias        || '',
      allianceTag:  playerProfile.allianceTag  || '',
      furnaceLevel: playerProfile.furnaceLevel || null,
      troops:       { ...(playerProfile.troops || { infantry: null, lancer: null, marksman: null }) },
      roles:        [...(playerProfile.roles   || [])],
      heroes:       [...(playerProfile.heroes  || [])],
    },
    attendance: { registered:false, attended:null, late:false, leftEarly:false, noShow:false, stayedFull:false, prepPhase:false, battlePhase:false },
    voice:      { joined:null, onTime:false, leftEarly:false, joinedLate:false, qualityNote:'' },
    combat:     { joinedRallies:false, ledRallies:false, defendedStructures:false, followedOrders:null, wentRogue:false },
    notes: '',
    performanceTag: null,
  };
}

// ── SvS Prep Score ─────────────────────────────────────────────
export function newPrepEntry(overrides = {}) {
  return {
    id: uid(),
    playerId: null,       // link to player if exists
    playerName: '',
    allianceTag: '',
    prepScore: null,
    targetScore: null,
    lastUpdated: new Date().toISOString(),
    notes: '',
    history: [],          // [{ score, timestamp }]
    ...overrides,
  };
}

// ── Metrics ────────────────────────────────────────────────────
export function calcMetrics(player, events) {
  const snapshots = events.flatMap(ev =>
    (ev.snapshots || []).filter(s => s.playerId === player.id)
  );
  if (!snapshots.length) return null;

  const attended  = snapshots.filter(s => s.attendance.attended === true);
  const noShows   = snapshots.filter(s => s.attendance.noShow);
  const late      = snapshots.filter(s => s.attendance.late);
  const voiceOn   = snapshots.filter(s => s.voice.joined === true);
  const wentRogue = snapshots.filter(s => s.combat.wentRogue);

  const attendancePct = Math.round((attended.length / snapshots.length) * 100);
  const voicePct      = Math.round((voiceOn.length  / snapshots.length) * 100);

  const sorted = [...snapshots].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let streak = 0;
  for (const s of sorted) { if (s.attendance.attended === true) streak++; else break; }
  let consecutiveMisses = 0;
  for (const s of sorted) { if (s.attendance.attended === false || s.attendance.noShow) consecutiveMisses++; else break; }

  const reliabilityScore = Math.round(
    attendancePct * 0.5 +
    voicePct      * 0.2 +
    Math.max(0, 100 - (wentRogue.length * 20)) * 0.2 +
    Math.max(0, 100 - (noShows.length   * 10)) * 0.1
  );

  return { totalEvents:snapshots.length, attended:attended.length, noShows:noShows.length, late:late.length, voiceCount:voiceOn.length, attendancePct, voicePct, streak, consecutiveMisses, reliabilityScore, wentRogue:wentRogue.length };
}

// ── Migration ──────────────────────────────────────────────────
function migrateIfNeeded(data) {
  let migrated = { ...structuredClone(defaultData), ...data };
  if (!migrated.events)   migrated.events   = [];
  if (!migrated.prepScores) migrated.prepScores = [];
  migrated.players = (migrated.players || []).map(p => ({
    ...p,
    eventHistory: p.eventHistory || [],
  }));
  migrated._version = CURRENT_VERSION;
  return migrated;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

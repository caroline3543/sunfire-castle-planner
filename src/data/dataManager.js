import defaultData from './defaultData.json';

const STORAGE_KEY = 'svs_rally_data';
const CURRENT_VERSION = '2.0.0';

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
  // Merge players — match by id first, then normalized username
  const playerMap = new Map();
  current.players.forEach(p => playerMap.set(p.id, p));
  (incoming.players || []).forEach(p => {
    if (playerMap.has(p.id)) {
      // Merge: never overwrite existing fields with blanks
      const existing = playerMap.get(p.id);
      playerMap.set(p.id, mergePlayer(existing, p));
    } else {
      // Check normalized username match
      const normIncoming = normalizeName(p.username || p.alias || '');
      const byName = [...playerMap.values()].find(ep =>
        normalizeName(ep.username || ep.alias || '') === normIncoming && normIncoming !== ''
      );
      if (byName) {
        playerMap.set(byName.id, mergePlayer(byName, p));
      } else {
        playerMap.set(p.id, p);
      }
    }
  });

  // Merge events by id
  const eventMap = new Map(current.events.map(e => [e.id, e]));
  (incoming.events || []).forEach(e => {
    if (eventMap.has(e.id)) {
      eventMap.set(e.id, { ...eventMap.get(e.id), ...e });
    } else {
      eventMap.set(e.id, e);
    }
  });

  return {
    ...current,
    ...incoming,
    players: Array.from(playerMap.values()),
    events: Array.from(eventMap.values()),
    lastUpdated: new Date().toISOString(),
  };
}

// ── Player helpers ─────────────────────────────────────────────
export function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ''); // strip invisible chars
}

// Merge two player objects — never overwrite existing value with blank
function mergePlayer(existing, incoming) {
  const merged = { ...existing };
  Object.entries(incoming).forEach(([key, val]) => {
    if (key === 'eventHistory') {
      // Merge event history by snapshotId
      const histMap = new Map((existing.eventHistory || []).map(s => [s.snapshotId, s]));
      (incoming.eventHistory || []).forEach(s => {
        if (!histMap.has(s.snapshotId)) histMap.set(s.snapshotId, s);
        // Snapshots are immutable — never overwrite existing
      });
      merged.eventHistory = Array.from(histMap.values());
    } else if (val !== null && val !== undefined && val !== '') {
      merged[key] = val;
    }
  });
  return merged;
}

// ── Event helpers ──────────────────────────────────────────────

export const EVENT_TYPES = [
  'SvS',
  'Foundry',
  'Canyon Clash',
  'Bear Trap',
  'Sunfire Castle',
  'Transfer Season',
  'Custom',
];

// Create a new event template
export function newEvent(overrides = {}) {
  return {
    id: uid(),
    type: 'SvS',
    name: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'upcoming', // upcoming | active | completed
    notes: '',
    createdAt: new Date().toISOString(),
    // Snapshots: array of player snapshot objects, keyed by playerId
    // Snapshots are written once and never mutated
    snapshots: [],
    ...overrides,
  };
}

// Create a blank snapshot for a player in an event
export function newSnapshot(playerId, playerProfile, eventId) {
  return {
    snapshotId: uid(),
    eventId,
    playerId,
    createdAt: new Date().toISOString(),

    // Frozen profile at time of snapshot
    profileSnapshot: {
      username:      playerProfile.username      || '',
      alias:         playerProfile.alias         || '',
      allianceTag:   playerProfile.allianceTag   || '',
      furnaceLevel:  playerProfile.furnaceLevel  || null,
      troops:        { ...(playerProfile.troops || { infantry: null, lancer: null, marksman: null }) },
      roles:         [...(playerProfile.roles    || [])],
      heroes:        [...(playerProfile.heroes   || [])],
    },

    // Attendance
    attendance: {
      registered:    false,
      attended:      null,  // null | true | false
      late:          false,
      leftEarly:     false,
      noShow:        false,
      stayedFull:    false,
      prepPhase:     false,
      battlePhase:   false,
    },

    // Voice
    voice: {
      joined:       null,  // null | true | false
      onTime:       false,
      leftEarly:    false,
      joinedLate:   false,
      qualityNote:  '',
    },

    // Combat
    combat: {
      joinedRallies:      false,
      ledRallies:         false,
      defendedStructures: false,
      followedOrders:     null, // null | true | false
      wentRogue:          false,
    },

    // Officer notes — append only
    notes: '',
    performanceTag: null, // null | 'strong' | 'reliable' | 'improving' | 'issue' | 'noshow'
  };
}

// ── Metrics ────────────────────────────────────────────────────

// Calculate reliability metrics for a player across all events
export function calcMetrics(player, events) {
  // Collect all snapshots for this player across all events
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

  // Streak: consecutive attended events (most recent first)
  const sorted = [...snapshots].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let streak = 0;
  for (const s of sorted) {
    if (s.attendance.attended === true) streak++;
    else break;
  }

  // Consecutive misses
  let consecutiveMisses = 0;
  for (const s of sorted) {
    if (s.attendance.attended === false || s.attendance.noShow) consecutiveMisses++;
    else break;
  }

  // Reliability score 0–100
  const reliabilityScore = Math.round(
    attendancePct * 0.5 +
    voicePct      * 0.2 +
    Math.max(0, 100 - (wentRogue.length * 20)) * 0.2 +
    Math.max(0, 100 - (noShows.length  * 10)) * 0.1
  );

  return {
    totalEvents:       snapshots.length,
    attended:          attended.length,
    noShows:           noShows.length,
    late:              late.length,
    voiceCount:        voiceOn.length,
    attendancePct,
    voicePct,
    streak,
    consecutiveMisses,
    reliabilityScore,
    wentRogue:         wentRogue.length,
  };
}

// ── Schema migration ───────────────────────────────────────────
function migrateIfNeeded(data) {
  const version = data._version || '1.0.0';

  let migrated = { ...structuredClone(defaultData), ...data };

  // v1 → v2: ensure events array exists, ensure players have no lookupStatus
  if (version === '1.0.0') {
    migrated.events = migrated.events || [];
    migrated.players = (migrated.players || []).map(p => ({
      ...p,
      eventHistory: p.eventHistory || [],
    }));
    migrated._version = '2.0.0';
  }

  migrated._version = CURRENT_VERSION;
  return migrated;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

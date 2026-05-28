import defaultData from './defaultData.json';

const STORAGE_KEY = 'svs_rally_data';
const CURRENT_VERSION = '3.0.0';

// ── Load / Save ────────────────────────────────────────────────
export function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return migrateIfNeeded(JSON.parse(stored));
  } catch (e) { console.warn('Load failed', e); }
  return structuredClone(defaultData);
}

export function saveData(data) {
  try {
    const s = { ...data, lastUpdated: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  } catch (e) { return data; }
}

export function exportData(data, tag) {
  const obj = { _version: CURRENT_VERSION, _exported: new Date().toISOString(), ...data };
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `svs-${tag || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => { try { resolve(migrateIfNeeded(JSON.parse(e.target.result))); } catch { reject(new Error('Invalid JSON')); } };
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsText(file);
  });
}

export function mergeData(current, incoming) {
  const pm = new Map(current.players.map(p => [p.id, p]));
  (incoming.players || []).forEach(p => {
    if (pm.has(p.id)) pm.set(p.id, mergePlayerObjects(pm.get(p.id), p));
    else {
      const norm = normalizeName(p.username || p.alias || '');
      const byName = [...pm.values()].find(ep => normalizeName(ep.username || ep.alias || '') === norm && norm);
      byName ? pm.set(byName.id, mergePlayerObjects(byName, p)) : pm.set(p.id, p);
    }
  });
  const em = new Map((current.events || []).map(e => [e.id, e]));
  (incoming.events || []).forEach(e => em.set(e.id, em.has(e.id) ? { ...em.get(e.id), ...e } : e));
  const pm2 = new Map((current.svsPlans || []).map(p => [p.id, p]));
  (incoming.svsPlans || []).forEach(p => pm2.set(p.id, p));
  return { ...current, ...incoming, players: [...pm.values()], events: [...em.values()], svsPlans: [...pm2.values()], lastUpdated: new Date().toISOString() };
}

// ── Name helpers ───────────────────────────────────────────────
export function normalizeName(n) {
  return (n || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
}
export function nameSimilarity(a, b) {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.85;
  const lo = na.length > nb.length ? na : nb, sh = na.length > nb.length ? nb : na;
  return 1 - levenshtein(lo, sh) / lo.length;
}
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}
export function resolveBatchNames(rawNames, existing) {
  const exact = [], fuzzy = [], fresh = [];
  rawNames.forEach(name => {
    const norm = normalizeName(name);
    if (!norm) return;
    if (/^\d+$/.test(norm)) {
      const f = existing.find(p => p.fid?.toString() === norm);
      if (f) { exact.push({ name, existingPlayer: f }); return; }
    }
    const ex = existing.find(p => normalizeName(p.username || p.alias || '') === norm);
    if (ex) { exact.push({ name, existingPlayer: ex }); return; }
    let bm = null, bs = 0;
    existing.forEach(p => { const s = nameSimilarity(name, p.username || p.alias || ''); if (s > bs && s > 0.75 && s < 1) { bs = s; bm = p; } });
    bm ? fuzzy.push({ name, existingPlayer: bm, score: bs }) : fresh.push({ name });
  });
  return { exact, fuzzy, fresh };
}
export function mergePlayerObjects(existing, incoming) {
  const merged = { ...existing };
  Object.entries(incoming).forEach(([k, v]) => {
    if (k === 'eventHistory') {
      const hm = new Map((existing.eventHistory || []).map(s => [s.snapshotId, s]));
      (incoming.eventHistory || []).forEach(s => { if (!hm.has(s.snapshotId)) hm.set(s.snapshotId, s); });
      merged.eventHistory = [...hm.values()];
    } else if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
      merged[k] = v;
    }
  });
  merged.profileLastUpdated = new Date().toISOString();
  return merged;
}

// ── Event types ────────────────────────────────────────────────
export const EVENT_TYPES = ['SvS', 'Foundry', 'Canyon Clash', 'Bear Trap', 'Sunfire Castle', 'Transfer Season', 'Custom'];

export function newEvent(o = {}) {
  return { id: uid(), type: 'SvS', name: '', allianceTag: '', date: new Date().toISOString().slice(0, 10), time: '12:00', status: 'upcoming', participantIds: [], notes: '', createdAt: new Date().toISOString(), snapshots: [], ...o };
}
export function newSnapshot(playerId, profile, eventId) {
  return {
    snapshotId: uid(), eventId, playerId, createdAt: new Date().toISOString(),
    profileSnapshot: { username: profile.username || '', alias: profile.alias || '', allianceTag: profile.allianceTag || '', furnaceLevel: profile.furnaceLevel || null, troops: { ...(profile.troops || {}) }, roles: [...(profile.roles || [])], heroes: [...(profile.heroes || [])] },
    attendance: { registered: false, attended: null, late: false, leftEarly: false, noShow: false, stayedFull: false, prepPhase: false, battlePhase: false },
    voice: { joined: null, onTime: false, leftEarly: false, joinedLate: false, qualityNote: '' },
    combat: { joinedRallies: false, ledRallies: false, defendedStructures: false, followedOrders: null, wentRogue: false },
    notes: '', performanceTag: null,
  };
}

// ── SvS Plan ───────────────────────────────────────────────────
export const STRATEGY_TYPES = ['Solo Rush', 'Double Rally', 'Multi Rally', 'Counter Rally', 'Castle Switching', 'Decoy Garrison Lead', 'Defensive Hold', 'Reinforcement Wall', 'Hybrid', 'Custom'];

export const TEAM_ROLES = ['Solo Attack', 'Counter Rally', 'Reinforcement', 'Castle Fill', 'Exit Team', 'Backup', 'Voice Required', 'Garrison Lead', 'Decoy Lead'];

export function newSvsPlan(o = {}) {
  return {
    id: uid(),
    name: '',
    strategy: 'Counter Rally',
    allianceTag: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'draft', // draft | active | completed
    notes: '',
    postBattleNotes: '',
    // Timing
    targetImpactTime: '', // HH:MM:SS
    // Sub-plans
    rallies: [],         // Rally objects
    reinforcements: [],  // Reinforcement objects
    assignments: [],     // Assignment objects
    timelineEvents: [],  // Manual timeline events
    marchDb: [],         // Player march times
    // Template flag
    isTemplate: false,
    templateName: '',
    createdAt: new Date().toISOString(),
    ...o,
  };
}

export function newRally(o = {}) {
  return {
    id: uid(),
    label: '',
    leadPlayerId: null,
    leadName: '',
    allianceTag: '',
    launchTime: '',       // HH:MM:SS
    marchDuration: 0,     // seconds
    impactTime: '',       // calculated
    isStrong: true,
    isCounter: false,
    isDecoy: false,
    order: 1,
    notes: '',
    status: 'planned',   // planned | launched | impacted | failed
    ...o,
  };
}

export function newReinforcement(o = {}) {
  return {
    id: uid(),
    playerId: null,
    playerName: '',
    allianceTag: '',
    targetArrivalTime: '', // HH:MM:SS
    marchDuration: 0,      // seconds
    sendTime: '',          // calculated
    arrivalWindow: 5,      // ±seconds
    status: 'pending',     // pending | sent | arrived | failed
    notes: '',
    ...o,
  };
}

export function newAssignment(o = {}) {
  return {
    id: uid(),
    playerId: null,
    playerName: '',
    allianceTag: '',
    teamRole: '',
    marchTime: null,
    confirmed: false,
    notes: '',
    ...o,
  };
}

export function newMarchEntry(o = {}) {
  return {
    id: uid(),
    playerId: null,
    playerName: '',
    castleMarch: null,    // seconds
    turretMarch: null,
    centerMarch: null,
    usesSpeedup: false,
    teleportRow: null,
    notes: '',
    ...o,
  };
}

// ── Timing calculations ────────────────────────────────────────
export function calcSendTime(targetArrivalHMS, marchSeconds) {
  const secs = parseHMS(targetArrivalHMS) - marchSeconds;
  return formatHMS(Math.max(0, secs));
}
export function calcImpactTime(launchHMS, marchSeconds) {
  return formatHMS(parseHMS(launchHMS) + marchSeconds);
}
export function parseHMS(hms) {
  if (!hms) return 0;
  const parts = hms.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(hms) || 0;
}
export function formatHMS(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
export function secsToHuman(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

// ── Rally warnings ─────────────────────────────────────────────
export function getRallyWarnings(rallies) {
  const warnings = [];
  if (rallies.length < 2) return warnings;
  const impacts = rallies.filter(r => r.impactTime).map(r => ({ ...r, secs: parseHMS(r.impactTime) })).sort((a, b) => a.secs - b.secs);
  if (impacts.length > 1) {
    const spread = impacts[impacts.length - 1].secs - impacts[0].secs;
    if (spread > 10) warnings.push(`Rallies spread ${spread}s apart — may not land together`);
    if (spread > 30) warnings.push('⚠️ Severe sync issue — rallies >30s apart');
  }
  const strong = impacts.find(r => r.isStrong);
  if (strong && impacts[0].id !== strong.id) warnings.push('⚠️ Strongest rally not arriving last — enemy may reinforce');
  return warnings;
}

// ── Counter rally warnings ─────────────────────────────────────
export function getCounterWarnings(enemyImpactHMS, counterImpactHMS) {
  const warnings = [];
  if (!enemyImpactHMS || !counterImpactHMS) return warnings;
  const diff = parseHMS(counterImpactHMS) - parseHMS(enemyImpactHMS);
  if (diff < 0) warnings.push('⚠️ Counter arrives BEFORE enemy impact — will be blocked');
  if (diff > 0 && diff < 3) warnings.push(`Counter arrives ${diff}s after enemy — very tight`);
  if (diff > 10) warnings.push(`⚠️ Counter arrives ${diff}s late — enemy may reinforce castle`);
  return warnings;
}

// ── Auto-suggest players ───────────────────────────────────────
export function autoSuggestPlayers(players, events, requirements = {}) {
  const { heroes = [], minFurnace = 0, requireDiscord = false, requireAvailable = false, minReliability = 0, roles = [], allianceTags = [] } = requirements;

  return players.map(player => {
    const metrics = calcMetrics(player, events);
    let score = 0;
    const reasons = [], missing = [];

    // Hero match
    if (heroes.length > 0) {
      const owned = heroes.filter(h => player.heroes?.includes(h));
      if (owned.length === heroes.length) { score += 30; reasons.push(`Has ${owned.join(', ')} at Skill 5`); }
      else if (owned.length > 0) { score += 10; reasons.push(`Has ${owned.join(', ')}`); missing.push(`Missing: ${heroes.filter(h => !player.heroes?.includes(h)).join(', ')}`); }
      else missing.push(`Missing heroes: ${heroes.join(', ')}`);
    }

    // Availability
    if (player.availability?.present === 'available') { score += 20; reasons.push('Available'); }
    else if (requireAvailable) missing.push('Not available');

    // Discord
    if (player.availability?.discord === 'yes') { score += 15; reasons.push('On Discord'); }
    else if (requireDiscord) missing.push('Discord not confirmed');

    // Furnace
    if (player.furnaceLevel >= minFurnace && minFurnace > 0) { score += 10; reasons.push(`FC${player.furnaceLevel}`); }
    else if (minFurnace > 0) missing.push(`FC${minFurnace}+ required (has FC${player.furnaceLevel || '?'})`);

    // Roles
    if (roles.length > 0) {
      const hasRole = roles.some(r => player.roles?.includes(r));
      if (hasRole) { score += 15; reasons.push(`Role: ${player.roles?.filter(r => roles.includes(r)).join(', ')}`); }
      else missing.push(`Role not set (needs ${roles.join(' or ')})`);
    }

    // Alliance filter
    if (allianceTags.length > 0 && !allianceTags.includes(player.allianceTag)) return null;

    // Reliability
    if (metrics) {
      if (metrics.reliabilityScore >= minReliability) { score += Math.round(metrics.reliabilityScore / 10); reasons.push(`Reliability: ${metrics.reliabilityScore}`); }
      else missing.push(`Reliability ${metrics.reliabilityScore} < ${minReliability} required`);
      if (metrics.streak >= 3) { score += 5; reasons.push(`${metrics.streak} event streak`); }
    } else {
      missing.push('No event history');
    }

    const matchPct = Math.min(100, Math.round(score));
    return { player, score: matchPct, reasons, missing };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}

// ── Metrics ────────────────────────────────────────────────────
export function calcMetrics(player, events) {
  const snaps = (events || []).flatMap(ev => (ev.snapshots || []).filter(s => s.playerId === player.id));
  if (!snaps.length) return null;
  const attended = snaps.filter(s => s.attendance.attended === true);
  const noShows  = snaps.filter(s => s.attendance.noShow);
  const voiceOn  = snaps.filter(s => s.voice.joined === true);
  const rogue    = snaps.filter(s => s.combat.wentRogue);
  const ap = Math.round((attended.length / snaps.length) * 100);
  const vp = Math.round((voiceOn.length  / snaps.length) * 100);
  const sorted = [...snaps].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let streak = 0; for (const s of sorted) { if (s.attendance.attended === true) streak++; else break; }
  let cm = 0; for (const s of sorted) { if (s.attendance.attended === false || s.attendance.noShow) cm++; else break; }
  const reliability = Math.round(ap * 0.5 + vp * 0.2 + Math.max(0, 100 - rogue.length * 20) * 0.2 + Math.max(0, 100 - noShows.length * 10) * 0.1);
  return { totalEvents: snaps.length, attended: attended.length, noShows: noShows.length, late: snaps.filter(s => s.attendance.late).length, voiceCount: voiceOn.length, attendancePct: ap, voicePct: vp, streak, consecutiveMisses: cm, reliabilityScore: reliability, wentRogue: rogue.length };
}

// ── Prep scores ────────────────────────────────────────────────
export function newPrepEntry(o = {}) {
  return { id: uid(), playerId: null, playerName: '', allianceTag: '', prepScore: null, targetScore: null, lastUpdated: new Date().toISOString(), notes: '', history: [], ...o };
}

// ── Migration ──────────────────────────────────────────────────
function migrateIfNeeded(data) {
  const m = { ...structuredClone(defaultData), ...data };
  if (!m.events)     m.events     = [];
  if (!m.prepScores) m.prepScores = [];
  if (!m.svsPlans)   m.svsPlans   = [];
  m.players = (m.players || []).map(p => ({ ...p, eventHistory: p.eventHistory || [] }));
  m._version = CURRENT_VERSION;
  return m;
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

const CURRENT_VERSION = '3.1.0';
const STORAGE_KEY = 'svs_rally_data';

export function saveToStorage(data) {
  try {
    const toSave = { ...data, lastUpdated: new Date().toISOString() };
    const serialized = JSON.stringify(toSave);

    // Warn if approaching 4MB (browser limit is ~5MB)
    if (serialized.length > 4_000_000) {
      console.warn(`[Sunfire] localStorage approaching limit: ${(serialized.length / 1_000_000).toFixed(1)}MB`);
    }

    localStorage.setItem(STORAGE_KEY, serialized);
    return toSave;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // Surface to UI via a custom event that useAppState can listen to
      window.dispatchEvent(new CustomEvent('sunfire:storage-full'));
      console.error('[Sunfire] localStorage full — data not saved');
    } else {
      console.error('[Sunfire] Failed to save', e);
    }
    return data;
  }
}

export function loadFromStorage(defaultData) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return migrateIfNeeded(JSON.parse(stored));
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
  }
  return structuredClone(defaultData);
}

export function exportToFile(data, allianceTag) {
  const obj = {
    _version: CURRENT_VERSION,
    _exported: new Date().toISOString(),
    _note: 'Exported from Sunfire Command.',
    ...data,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `sunfire-${allianceTag || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try { resolve(migrateIfNeeded(JSON.parse(e.target.result))); }
      catch { reject(new Error('Invalid JSON file')); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function mergeImportedData(current, incoming) {
  const pm = new Map(current.players.map(p => [p.id, p]));
  (incoming.players || []).forEach(p => {
    if (pm.has(p.id)) {
      pm.set(p.id, deepMergePlayer(pm.get(p.id), p));
    } else {
      pm.set(p.id, p);
    }
  });

  const em = new Map((current.events || []).map(e => [e.id, e]));
  (incoming.events || []).forEach(e =>
    em.set(e.id, em.has(e.id) ? { ...em.get(e.id), ...e } : e)
  );

  const sm = new Map((current.svsPlans || []).map(p => [p.id, p]));
  (incoming.svsPlans || []).forEach(p => sm.set(p.id, p));

  return {
    ...current,
    ...incoming,
    players:   [...pm.values()],
    events:    [...em.values()],
    svsPlans:  [...sm.values()],
    lastUpdated: new Date().toISOString(),
  };
}

function deepMergePlayer(existing, incoming) {
  const merged = { ...existing };
  Object.entries(incoming).forEach(([k, v]) => {
    if (k === 'joinerHeroes') {
      const jm = new Map((existing.joinerHeroes || []).map(jh => [jh.hero, jh]));
      (incoming.joinerHeroes || []).forEach(jh => {
        const ex = jm.get(jh.hero);
        if (!ex || jh.skillLevel >= ex.skillLevel) jm.set(jh.hero, jh);
      });
      merged.joinerHeroes = [...jm.values()];
    } else if (k === 'eventHistory') {
      const hm = new Map((existing.eventHistory || []).map(s => [s.snapshotId, s]));
      (incoming.eventHistory || []).forEach(s => {
        if (!hm.has(s.snapshotId)) hm.set(s.snapshotId, s);
      });
      merged.eventHistory = [...hm.values()];
    } else if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
      merged[k] = v;
    }
  });
  merged.profileLastUpdated = new Date().toISOString();
  return merged;
}

function migrateIfNeeded(data) {
  const m = { ...data };
  if (!m.events)     m.events     = [];
  if (!m.prepScores) m.prepScores = [];
  if (!m.svsPlans)   m.svsPlans   = [];
  if (!m.settings)   m.settings   = { allianceName:'', allianceTag:'', stateId:'3543' };

  m.players = (m.players || []).map(p => ({
    ...p,
    joinerHeroes:  p.joinerHeroes  || [],
    eventHistory:  p.eventHistory  || [],
  }));

  m._version = CURRENT_VERSION;
  return m;
}

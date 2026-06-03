import { useState, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage, mergeImportedData } from '../services/exportImportService.js';
import { newPlayer } from '../data/playerSchema.js';

import defaultData from '../data/defaultData.json';

const TOAST_DURATION = 2800;

/**
 * useAppState
 *
 * Central state hook for Sunfire Command.
 * App.jsx stays a thin coordinator — all state lives here.
 */
export function useAppState() {
  const [data, setData]   = useState(() => loadFromStorage(defaultData));
  const [toast, setToast] = useState(null);

  // Auto-save on every data change
  useEffect(() => { saveToStorage(data); }, [data]);

  // ── Toast ─────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  // Warn user if localStorage is full
  useEffect(() => {
    function handler() {
      showToast('⚠️ Storage full — export your data now to avoid losing changes', 'error');
    }
    window.addEventListener('sunfire:storage-full', handler);
    return () => window.removeEventListener('sunfire:storage-full', handler);
  }, [showToast]);

  // ── Player operations ─────────────────────────────────────
  const savePlayer = useCallback((player) => {
    setData(prev => {
      const isEdit = prev.players.some(p => p.id === player.id);
      return {
        ...prev,
        players: isEdit
          ? prev.players.map(p => p.id === player.id ? player : p)
          : [...prev.players, player],
        lastUpdated: new Date().toISOString(),
      };
    });
    showToast('Player saved ✓');
  }, [showToast]);

  const addPlayers = useCallback((newPlayers) => {
    setData(prev => ({
      ...prev,
      players: [...prev.players, ...newPlayers],
      lastUpdated: new Date().toISOString(),
    }));
    if (newPlayers.length) showToast(`${newPlayers.length} player${newPlayers.length !== 1 ? 's' : ''} added ✓`);
  }, [showToast]);

  const updatePlayers = useCallback((updatedPlayers) => {
    setData(prev => ({
      ...prev,
      players: prev.players.map(p => {
        const u = updatedPlayers.find(u => u.id === p.id);
        return u ? u : p;
      }),
      lastUpdated: new Date().toISOString(),
    }));
    if (updatedPlayers.length) showToast(`${updatedPlayers.length} updated ✓`);
  }, [showToast]);

  const deletePlayer = useCallback((id) => {
    setData(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Player removed');
  }, [showToast]);

  // ── Event operations ──────────────────────────────────────
  const createEvent = useCallback((ev) => {
    setData(prev => ({
      ...prev,
      events: [...(prev.events || []), ev],
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Event created ✓');
  }, [showToast]);

  const updateEvent = useCallback((ev) => {
    setData(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === ev.id ? ev : e),
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const deleteEvent = useCallback((id) => {
    setData(prev => ({
      ...prev,
      events: (prev.events || []).filter(e => e.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Event deleted');
  }, [showToast]);

  // ── SvS plan operations ───────────────────────────────────
  const saveSvsPlans = useCallback((plans) => {
    setData(prev => ({ ...prev, svsPlans: plans, lastUpdated: new Date().toISOString() }));
  }, []);

  const deleteSvsPlan = useCallback((id) => {
    setData(prev => ({
      ...prev,
      svsPlans: (prev.svsPlans || []).filter(p => p.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    showToast('Plan deleted');
  }, [showToast]);

  // ── Prep scores ───────────────────────────────────────────
  const updatePrepScores = useCallback((scores) => {
    setData(prev => ({ ...prev, prepScores: scores, lastUpdated: new Date().toISOString() }));
  }, []);

  // ── Settings ──────────────────────────────────────────────
  const saveSettings = useCallback((settings) => {
    setData(prev => ({ ...prev, settings, lastUpdated: new Date().toISOString() }));
  }, []);

  // ── Import ────────────────────────────────────────────────
  const applyImport = useCallback((imported, mode) => {
    setData(prev => {
      if (mode === 'merge') return { ...mergeImportedData(prev, imported), lastUpdated: new Date().toISOString() };
      return { ...prev, ...imported, lastUpdated: new Date().toISOString() };
    });
    showToast(`Imported (${mode}) ✓`);
  }, [showToast]);

  // ── Derived state (computed, not stored) ──────────────────
  const players    = data.players    || [];
  const events     = data.events     || [];
  const svsPlans   = data.svsPlans   || [];
  const prepScores = data.prepScores || [];
  const settings   = data.settings   || {};

  return {
    // Raw data
    data,

    // Derived arrays
    players,
    events,
    svsPlans,
    prepScores,
    settings,

    // Toast
    toast,
    showToast,

    // Player ops
    savePlayer,
    addPlayers,
    updatePlayers,
    deletePlayer,

    // Event ops
    createEvent,
    updateEvent,
    deleteEvent,

    // SvS plan ops
    saveSvsPlans,
    deleteSvsPlan,

    // Prep scores
    updatePrepScores,

    // Settings
    saveSettings,

    // Import
    applyImport,
  };
}

import { useState, useEffect, useRef } from "react";
import {
  loadData, saveData,
  exportPlayers, importPlayers, mergePlayers,
  lookupWosPlayer,
} from "./data/dataManager.js";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg: "#0A1628", card: "#1E3A52", section: "#152236",
  gold: "#F5A623", white: "#FFFFFF", icy: "#A8C4D8",
  muted: "#5A7A94", inf: "#6B8CAE", lan: "#7BAE8C",
  mar: "#B8859A", red: "#FF453A", green: "#30D158",
  border: "#2A4A64",
};

const TIER_OPTIONS = ["T10","FC1","FC2","FC3","FC4","FC5","T11","T12"];
const ROLES = ["Rally Lead","Attack Team","Joiner","Garrison","Flexible","Reserve"];
const ROLE_COLORS = {
  "Rally Lead": C.gold, "Attack Team": C.red, "Joiner": C.mar,
  "Garrison": C.inf, "Flexible": C.lan, "Reserve": C.muted,
};
const ROLE_ICONS = {
  "Rally Lead":"👑","Attack Team":"⚔️","Joiner":"🏹",
  "Garrison":"🛡️","Flexible":"🔄","Reserve":"⏸️",
};

const HEROES_BY_GEN = [
  { gen:"Gen 1",  heroes:["Jessie","Jasser","Jeronimo","Seo-Yoon","Patrick","Bahiti","Ling Xue","Lumak Bokan"] },
  { gen:"Gen 2",  heroes:["Philly","Alonso"] },
  { gen:"Gen 3",  heroes:["Mia","Logan","Greg"] },
  { gen:"Gen 4",  heroes:["Reina","Ahmose","Lynn"] },
  { gen:"Gen 5",  heroes:["Norah","Hector","Gwen"] },
  { gen:"Gen 6",  heroes:["Wu Ming","Renee","Wayne"] },
  { gen:"Gen 7",  heroes:["Edith","Gordon","Bradley"] },
  { gen:"Gen 8",  heroes:["Gatot","Sonya","Hendrik"] },
  { gen:"Gen 9",  heroes:["Magnus","Fred","Xura"] },
  { gen:"Gen 10", heroes:["Gregory","Freya","Blanchette"] },
  { gen:"Gen 11", heroes:["Eleonora","Lloyd","Rufus"] },
];

const TIMEZONES = [
  "UTC-12","UTC-11","UTC-10","UTC-9","UTC-8 (PST)","UTC-7 (MST)",
  "UTC-6 (CST)","UTC-5 (EST)","UTC-4","UTC-3","UTC-2","UTC-1",
  "UTC+0 (GMT)","UTC+1 (CET)","UTC+2 (EET)","UTC+3","UTC+4","UTC+5",
  "UTC+5:30 (IST)","UTC+6","UTC+7 (ICT)","UTC+8 (CST/SGT)",
  "UTC+9 (JST/KST)","UTC+10 (AEST)","UTC+11","UTC+12 (NZST)","UTC+13",
];

const LANGUAGES = [
  "English","Mandarin","Spanish","Portuguese","Russian","Arabic",
  "Turkish","German","French","Indonesian","Vietnamese","Thai",
  "Korean","Japanese","Polish","Italian","Dutch","Hindi","Malay","Other",
];

const COUNTRIES = [
  "Australia","Brazil","Canada","China","France","Germany","India",
  "Indonesia","Italy","Japan","Malaysia","Mexico","Netherlands",
  "New Zealand","Nigeria","Pakistan","Philippines","Poland","Portugal",
  "Romania","Russia","Saudi Arabia","Singapore","South Africa",
  "South Korea","Spain","Sweden","Taiwan","Thailand","Turkey","Ukraine",
  "United Arab Emirates","United Kingdom","United States","Vietnam","Other",
];

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function vibe(p) { try { navigator.vibrate(p); } catch(e) {} }
function initials(name) {
  return (name||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "?";
}
function fmtDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch { return null; }
}

// Detect if a string is a FID (numeric) or a name ← NEW
function parseEntry(raw) {
  const str = raw.trim();
  if (!str) return null;
  const isNumeric = /^\d+$/.test(str);
  return { raw: str, isFid: isNumeric, fid: isNumeric ? str : "", name: isNumeric ? "" : str };
}

function newPlayer(overrides = {}) {
  return {
    id: uid(),
    // Identity ← NEW fields
    fid: "",
    username: "",
    name: "",
    country: "",
    timezone: "",
    languages: [],
    stateId: "",
    allianceName: "",
    allianceTag: "",
    furnaceLevel: null,
    infantryCampLevel: null,
    lancerCampLevel: null,
    marksmanCampLevel: null,
    avatarUrl: "",
    // Lookup metadata ← NEW
    lookupStatus: null,        // null | "fetched" | "failed" | "manual"
    lookupLastUpdated: null,
    profileLastUpdated: null,
    // Battle data
    fcLevel: null,
    troops: { infantry: null, lancer: null, marksman: null },
    heroes: [],
    hasNoneChecked: false,
    roles: [],
    availability: {
      present: "available",
      timing: "unknown",
      lateBy: null,
      earlyBy: null,
      discord: "unknown",
    },
    teamAssignment: null,
    notes: "",
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Shared UI primitives ───────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 12, fontWeight: 700, color: C.muted,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
      }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", inputMode, style = {} }) {
  return (
    <input
      type={type} inputMode={inputMode} value={value || ""}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: "100%", background: C.section, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "12px 14px", fontSize: 16, color: C.white,
        boxSizing: "border-box", fontFamily: "inherit", ...style,
      }}
    />
  );
}

function Sel({ value, onChange, options, placeholder }) {
  return (
    <select value={value || ""} onChange={e => onChange(e.target.value)} style={{
      width: "100%", background: C.section, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "12px 14px", fontSize: 16,
      color: value ? C.white : C.muted, boxSizing: "border-box", fontFamily: "inherit",
    }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function TierRow({ label, color, value, onChange }) {
  return

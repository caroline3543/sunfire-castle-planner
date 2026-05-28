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
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {TIER_OPTIONS.map(t => (
          <button key={t} onClick={() => onChange(value === t ? null : t)} style={{
            padding: "6px 12px", borderRadius: 16, flexShrink: 0,
            border: `1px solid ${value === t ? color : C.border}`,
            background: value === t ? color + "22" : C.section,
            color: value === t ? color : C.muted,
            fontWeight: 600, fontSize: 13, cursor: "pointer", minHeight: 36,
          }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    fetched: [C.green, "● Auto-fetched"],
    failed:  [C.red,   "● Lookup failed"],
    manual:  [C.icy,   "● Manual entry"],
  };
  if (!status || !map[status]) return null;
  const [color, label] = map[status];
  return <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>;
}

function Toast({ msg, type = "success" }) {
  if (!msg) return null;
  const color = type === "error" ? C.red : type === "warning" ? C.gold : C.green;
  return (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
      background: C.card + "ee", backdropFilter: "blur(12px)",
      border: `1px solid ${color}44`, borderRadius: 20,
      padding: "10px 20px", fontSize: 15, fontWeight: 600, color,
      zIndex: 500, whiteSpace: "nowrap", maxWidth: "90vw",
    }}>{msg}</div>
  );
}

// ── Player Profile Sheet ───────────────────────────────────────
// Three tabs: Identity (FID + profile fields), Combat (tiers/heroes/roles),
// Availability. LookupBanner fires automatically if FID is present on open.
// Every field is editable regardless of lookup status.

function PlayerSheet({ player, open, onClose, onSave }) {
  const [p, setP] = useState(newPlayer());
  const [tab, setTab] = useState("identity");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(false);

  useEffect(() => {
    if (open) {
      const base = player || newPlayer();
      setP(base);
      setTab("identity");
      // Auto-show lookup banner for new players
      setShowLookup(!player);
    }
  }, [open, player]);

  function update(key, val) {
    setP(prev => ({ ...prev, [key]: val, profileLastUpdated: new Date().toISOString() }));
  }
  function updateTroop(key, val) {
    setP(prev => ({
      ...prev,
      troops: { ...prev.troops, [key]: val },
      profileLastUpdated: new Date().toISOString(),
    }));
  }
  function updateAvail(patch) {
    setP(prev => ({
      ...prev,
      availability: { ...prev.availability, ...patch },
      profileLastUpdated: new Date().toISOString(),
    }));
  }

  // ← NEW: FID changes trigger lookup banner appearance
  function handleFidChange(val) {
    update("fid", val);
    setShowLookup(!!val.trim());
  }

  async function doLookup() {
    if (!p.fid?.trim()) return;
    setLookupLoading(true);
    const result = await lookupWosPlayer(p.fid.trim());
    setLookupLoading(false);
    if (result.success) {
      setP(prev => ({
        ...prev,
        username:     result.username     || prev.username,
        furnaceLevel: result.furnaceLevel || prev.furnaceLevel,
        stateId:      result.stateId      || prev.stateId,
        avatarUrl:    result.avatarUrl    || prev.avatarUrl,
        allianceName: result.allianceName || prev.allianceName,
        lookupStatus: "fetched",
        lookupLastUpdated: new Date().toISOString(),
        profileLastUpdated: new Date().toISOString(),
      }));
      setShowLookup(false);
    } else {
      setP(prev => ({
        ...prev,
        lookupStatus: "failed",
        lookupLastUpdated: new Date().toISOString(),
      }));
    }
  }

  function handleSave() {
    const final = {
      ...p,
      profileLastUpdated: p.profileLastUpdated || new Date().toISOString(),
      lookupStatus: p.lookupStatus || "manual",
    };
    onSave(final);
    onClose();
    vibe(8);
  }

  const TABS = [
    { id: "identity",     label: "👤 Identity" },
    { id: "combat",       label: "⚔️ Combat" },
    { id: "availability", label: "📅 Availability" },
  ];

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{
        background: C.card, borderRadius: "20px 20px 0 0", width: "100%",
        maxHeight: "92vh", overflowY: "auto", padding: "16px 20px 100px",
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 16px" }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>
            {player ? "Edit Player" : "Add Player"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={p.lookupStatus} />
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 14px", borderRadius: 20, whiteSpace: "nowrap",
              background: tab === t.id ? C.gold + "22" : C.section,
              border: `1px solid ${tab === t.id ? C.gold : C.border}`,
              color: tab === t.id ? C.gold : C.muted,
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── IDENTITY TAB ── */}
        {tab === "identity" && (
          <div>
            {/* FID field + lookup ← NEW */}
            <Field label="WOS User ID / FID" hint="Enter FID to enable profile auto-fetch">
              <Input
                value={p.fid}
                onChange={handleFidChange}
                placeholder="e.g. 12345678"
                inputMode="numeric"
              />
            </Field>

            {/* Lookup banner */}
            {showLookup && p.fid?.trim() && (
              <div style={{
                background: C.section, border: `1px solid ${C.gold}33`,
                borderRadius: 12, padding: 14, marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 4 }}>⚡ WOS Profile Lookup</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                  Unofficial — may not always work. All fetched data stays editable.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={doLookup} disabled={lookupLoading} style={{
                    flex: 1, height: 40, borderRadius: 10, background: C.gold,
                    color: C.bg, fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
                  }}>{lookupLoading ? "Fetching…" : "Fetch Profile"}</button>
                  <button onClick={() => setShowLookup(false)} style={{
                    height: 40, padding: "0 14px", borderRadius: 10,
                    background: "none", border: `1px solid ${C.border}`,
                    color: C.muted, fontSize: 14, cursor: "pointer",
                  }}>Skip</button>
                </div>
              </div>
            )}

            {/* Re-fetch link shown after lookup attempt */}
            {!showLookup && p.fid?.trim() && (
              <button onClick={() => setShowLookup(true)} style={{
                background: "none", border: "none", color: C.gold,
                fontSize: 13, cursor: "pointer", marginBottom: 12, padding: 0,
              }}>⚡ Re-fetch WOS profile</button>
            )}

            {p.lookupLastUpdated && (
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                Last fetched: {fmtDate(p.lookupLastUpdated)}
              </div>
            )}

            <Field label="Username (in-game)">
              <Input value={p.username} onChange={v => update("username", v)} placeholder="WOS username" />
            </Field>

            <Field label="Real Name / Alias">
              <Input value={p.name} onChange={v => update("name", v)} placeholder="Optional" />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Field label="State ID">
                <Input value={p.stateId} onChange={v => update("stateId", v)} placeholder="3543" inputMode="numeric" />
              </Field>
              <Field label="Furnace Level">
                <Input
                  value={p.furnaceLevel}
                  onChange={v => update("furnaceLevel", v ? parseInt(v) : null)}
                  placeholder="28" inputMode="numeric" type="number"
                />
              </Field>
            </div>

            <Field label="Country">
              <Sel value={p.country} onChange={v => update("country", v)} options={COUNTRIES} placeholder="Select country…" />
            </Field>

            <Field label="Timezone">
              <Sel value={p.timezone} onChange={v => update("timezone", v)} options={TIMEZONES} placeholder="Select timezone…" />
            </Field>

            <Field label="Languages">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LANGUAGES.map(lang => {
                  const sel = p.languages?.includes(lang);
                  return (
                    <button key={lang} onClick={() => {
                      const cur = p.languages || [];
                      update("languages", sel ? cur.filter(l => l !== lang) : [...cur, lang]);
                    }} style={{
                      padding: "6px 12px", borderRadius: 16, minHeight: 36,
                      border: `1px solid ${sel ? C.icy : C.border}`,
                      background: sel ? C.icy + "22" : C.section,
                      color: sel ? C.icy : C.muted,
                      fontWeight: 600, fontSize: 13, cursor: "pointer",
                    }}>{lang}</button>
                  );
                })}
              </div>
            </Field>

            <Field label="Alliance">
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                <Input value={p.allianceName} onChange={v => update("allianceName", v)} placeholder="Alliance name" />
                <Input value={p.allianceTag} onChange={v => update("allianceTag", v)} placeholder="[TAG]" />
              </div>
            </Field>

            {/* Camp levels ← NEW */}
            <Field label="Camp Levels">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["🛡️ Inf", "infantryCampLevel", C.inf],
                  ["⚔️ Lan", "lancerCampLevel",   C.lan],
                  ["🏹 Mar", "marksmanCampLevel",  C.mar],
                ].map(([label, key, color]) => (
                  <div key={key} style={{ background: C.section, borderRadius: 10, padding: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 6 }}>{label}</div>
                    <input
                      type="number" inputMode="numeric" value={p[key] || ""}
                      onChange={e => update(key, e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="–"
                      style={{
                        width: "100%", background: C.card, border: `1px solid ${color}44`,
                        borderRadius: 8, padding: "8px 0", fontSize: 18, fontWeight: 700,
                        color, textAlign: "center", boxSizing: "border-box", fontFamily: "inherit",
                      }}
                    />
                  </div>
                ))}
              </div>
            </Field>

            <Field label="Notes">
              <textarea
                value={p.notes || ""} onChange={e => update("notes", e.target.value)}
                placeholder="Any notes about this player…"
                style={{
                  width: "100%", minHeight: 80, background: C.section,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "12px 14px", fontSize: 16, color: C.white,
                  resize: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </Field>

            {p.profileLastUpdated && (
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
                Profile last updated: {fmtDate(p.profileLastUpdated)}
              </div>
            )}
          </div>
        )}

        {/* ── COMBAT TAB ── */}
        {tab === "combat" && (
          <div>
            <TierRow label="🛡️ Infantry Troop Tier" color={C.inf} value={p.troops.infantry} onChange={v => updateTroop("infantry", v)} />
            <TierRow label="⚔️ Lancer Troop Tier"   color={C.lan} value={p.troops.lancer}   onChange={v => updateTroop("lancer", v)} />
            <TierRow label="🏹 Marksman Troop Tier" color={C.mar} value={p.troops.marksman} onChange={v => updateTroop("marksman", v)} />

            <Field label="Battle Roles" hint="Select all that apply">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ROLES.map(role => {
                  const sel = p.roles?.includes(role);
                  const color = ROLE_COLORS[role];
                  return (
                    <button key={role} onClick={() => {
                      const cur = p.roles || [];
                      update("roles", sel ? cur.filter(r => r !== role) : [...cur, role]);
                    }} style={{
                      padding: "12px 14px", borderRadius: 12, minHeight: 48,
                      textAlign: "left", position: "relative",
                      border: `1px solid ${sel ? color : C.border}`,
                      background: sel ? color + "18" : C.section,
                      color: sel ? color : C.muted,
                      fontWeight: 600, fontSize: 14, cursor: "pointer",
                    }}>
                      {sel && <span style={{ position: "absolute", top: 8, right: 10, fontSize: 12 }}>✓</span>}
                      {ROLE_ICONS[role]} {role}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Joiner Heroes at Skill 5" hint="Only Skill 5 heroes count for rally planning">
              <button onClick={() => {
                const next = !p.hasNoneChecked;
                update("hasNoneChecked", next);
                if (next) update("heroes", []);
              }} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", width: "100%", marginBottom: 12,
                background: p.hasNoneChecked ? C.red + "18" : C.section,
                border: `1px solid ${p.hasNoneChecked ? C.red : C.border}`,
                borderRadius: 10, color: p.hasNoneChecked ? C.red : C.muted,
                fontSize: 14, fontWeight: 600, cursor: "pointer", boxSizing: "border-box",
              }}>
                {p.hasNoneChecked ? "✓" : "○"} Has none at Skill 5
              </button>

              {!p.hasNoneChecked && HEROES_BY_GEN.map(({ gen, heroes }) => (
                <div key={gen}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: "12px 0 8px" }}>{gen}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {heroes.map(h => {
                      const owned = p.heroes?.includes(h);
                      return (
                        <button key={h} onClick={() => {
                          const cur = p.heroes || [];
                          update("heroes", owned ? cur.filter(x => x !== h) : [...cur, h]);
                        }} style={{
                          padding: "6px 12px", borderRadius: 16, minHeight: 36,
                          border: `1px solid ${owned ? C.gold : C.border}`,
                          background: owned ? C.gold + "18" : C.section,
                          color: owned ? C.gold : C.muted,
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                        }}>{owned ? "✓ " : ""}{h}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Field>
          </div>
        )}

        {/* ── AVAILABILITY TAB ── */}
        {tab === "availability" && (
          <div>
            <Field label="SvS Availability">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["✅ Available","available",C.green],["❌ Unavailable","unavailable",C.red]].map(([label,val,color]) => (
                  <button key={val} onClick={() => updateAvail({ present: val })} style={{
                    height: 52, borderRadius: 12,
                    border: `1px solid ${p.availability.present === val ? color : C.border}`,
                    background: p.availability.present === val ? color + "18" : C.section,
                    color: p.availability.present === val ? color : C.muted,
                    fontWeight: 600, fontSize: 15, cursor: "pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>

            <Field label="Timing">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["⏰ On Time","on-time"],["🕐 Late","late"],["🚪 Early","early"],["❓ Unknown","unknown"]].map(([label,val]) => (
                  <button key={val} onClick={() => updateAvail({ timing: val })} style={{
                    padding: "8px 14px", borderRadius: 20, minHeight: 40,
                    border: `1px solid ${p.availability.timing === val ? C.gold : C.border}`,
                    background: p.availability.timing === val ? C.gold + "18" : C.section,
                    color: p.availability.timing === val ? C.gold : C.muted,
                    fontWeight: 600, fontSize: 14, cursor: "pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>

            <Field label="Discord During SvS">
              <div style={{ display: "flex", gap: 8 }}>
                {[["🎙️ On Discord","yes"],["🔇 Not on Discord","no"],["❓ Unknown","unknown"]].map(([label,val]) => (
                  <button key={val} onClick={() => updateAvail({ discord: val })} style={{
                    flex: 1, height: 44, borderRadius: 12,
                    border: `1px solid ${p.availability.discord === val ? C.icy : C.border}`,
                    background: p.availability.discord === val ? C.icy + "18" : C.section,
                    color: p.availability.discord === val ? C.icy : C.muted,
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>
          </div>
        )}

        <button onClick={handleSave} style={{
          width: "100%", height: 54, borderRadius: 12, background: C.gold,
          color: C.bg, fontWeight: 700, fontSize: 17, border: "none",
          cursor: "pointer", marginTop: 8,
        }}>Save Player</button>
      </div>
    </div>
  );
}

// ── Batch Add Sheet ────────────────────────────────────────────
// Phase 1: Names OR FIDs — mixed input supported.
//   Numeric entries → treated as FIDs, WOS lookup attempted automatically.
//   Text entries → treated as names, added directly.
// Phases 2–4 unchanged from previous version.

function BatchAddSheet({ open, onClose, members, onAdd }) {
  const [phase, setPhase] = useState(0);
  const [raw, setRaw] = useState("");
  const [fcAll, setFcAll] = useState("");
  const [tagAll, setTagAll] = useState("");
  const [tzAll, setTzAll] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  // ← NEW: parsed entries with fid/name distinction
  const [entries, setEntries] = useState([]);
  const [lookupResults, setLookupResults] = useState({});
  const [lookingUp, setLookingUp] = useState(false);

  // Availability
  const [voiceSet, setVoiceSet] = useState(new Set());
  const [lateSet, setLateSet] = useState(new Set());
  const [lateBy, setLateBy] = useState("unknown");
  const [earlySet, setEarlySet] = useState(new Set());
  const [earlyBy, setEarlyBy] = useState("unknown");
  const [unavailSet, setUnavailSet] = useState(new Set());

  // Tiers
  const [groupTierSel, setGroupTierSel] = useState(new Set());
  const [groupTroops, setGroupTroops] = useState({ infantry: null, lancer: null, marksman: null });
  const [memberTroops, setMemberTroops] = useState({});
  const [tierIdx, setTierIdx] = useState(0);

  // Heroes
  const [groupHeroSel, setGroupHeroSel] = useState(new Set());
  const [groupHeroes, setGroupHeroes] = useState([]);
  const [memberHeroes, setMemberHeroes] = useState({});
  const [memberHasNone, setMemberHasNone] = useState({});
  const [heroIdx, setHeroIdx] = useState(0);

  const existingKeys = new Set([
    ...members.map(m => m.name?.toLowerCase()),
    ...members.map(m => m.fid).filter(Boolean),
  ]);

  // Parse raw input into entries ← UPDATED
  useEffect(() => {
    const parsed = raw
      .split(/[\n,]/)
      .map(parseEntry)
      .filter(Boolean)
      .filter(e => !existingKeys.has(e.isFid ? e.fid : e.raw.toLowerCase()));
    setEntries(parsed);
  }, [raw]);

  // Display key: use fid for fid entries, name for name entries
  function entryKey(e) { return e.isFid ? e.fid : e.raw; }

  // Chip label: fid entries show FID + fetched username if available
  function entryLabel(e) {
    if (!e.isFid) return e.raw;
    const result = lookupResults[e.fid];
    if (result?.success && result.username) return `${result.username} (${e.fid})`;
    if (result && !result.success) return `FID ${e.fid} ✗`;
    return `FID ${e.fid}`;
  }

  const newEntries = entries;
  const dupCount = raw.split(/[\n,]/).map(parseEntry).filter(Boolean).filter(e => existingKeys.has(e.isFid ? e.fid : e.raw.toLowerCase())).length;

  // ← NEW: auto-lookup all FID entries when advancing from Phase 0
  async function runFidLookups() {
    const fidEntries = newEntries.filter(e => e.isFid);
    if (!fidEntries.length) return;
    setLookingUp(true);
    const results = { ...lookupResults };
    await Promise.all(fidEntries.map(async e => {
      if (results[e.fid]) return; // already looked up
      results[e.fid] = await lookupWosPlayer(e.fid);
    }));
    setLookupResults(results);
    setLookingUp(false);
  }

  function resetAll() {
    setPhase(0); setRaw(""); setFcAll(""); setTagAll(""); setTzAll("");
    setShowOptional(false); setEntries([]); setLookupResults({});
    setLookingUp(false); setVoiceSet(new Set()); setLateSet(new Set());
    setLateBy("unknown"); setEarlySet(new Set()); setEarlyBy("unknown");
    setUnavailSet(new Set()); setGroupTierSel(new Set());
    setGroupTroops({ infantry: null, lancer: null, marksman: null });
    setMemberTroops({}); setTierIdx(0); setGroupHeroSel(new Set());
    setGroupHeroes([]); setMemberHeroes({}); setMemberHasNone({});
    setHeroIdx(0);
  }

  function handleClose() { resetAll(); onClose(); }

  function toggleSet(set, setFn, key) {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setFn(next);
  }

  function buildAndAdd() {
    const built = newEntries.map(entry => {
      const key = entryKey(entry);
      const lookup = entry.isFid ? lookupResults[entry.fid] : null;
      const troops = groupTierSel.has(key)
        ? { ...groupTroops }
        : (memberTroops[key] || { infantry: null, lancer: null, marksman: null });
      const heroes = groupHeroSel.has(key) ? [...groupHeroes] : (memberHeroes[key] || []);
      const hasNone = memberHasNone[key] || false;

      return newPlayer({
        fid:         entry.isFid ? entry.fid : "",
        name:        entry.isFid ? "" : entry.raw,
        // Pre-fill from lookup if successful ← NEW
        username:     lookup?.success ? (lookup.username || "") : "",
        furnaceLevel: lookup?.success ? (lookup.furnaceLevel || null) : null,
        stateId:      lookup?.success ? (lookup.stateId || "") : "",
        avatarUrl:    lookup?.success ? (lookup.avatarUrl || "") : "",
        allianceName: lookup?.success ? (lookup.allianceName || "") : "",
        lookupStatus: entry.isFid
          ? (lookup?.success ? "fetched" : lookup ? "failed" : null)
          : "manual",
        lookupLastUpdated: entry.isFid && lookup ? new Date().toISOString() : null,
        fcLevel: fcAll ? parseInt(fcAll) : null,
        allianceTag: tagAll,
        timezone: tzAll,
        troops,
        heroes: hasNone ? [] : heroes,
        hasNoneChecked: hasNone,
        availability: {
          present: unavailSet.has(key) ? "unavailable" : "available",
          timing: lateSet.has(key) ? "late" : earlySet.has(key) ? "early" : "unknown",
          lateBy: lateSet.has(key) ? lateBy : null,
          earlyBy: earlySet.has(key) ? earlyBy : null,
          discord: voiceSet.has(key) ? "yes" : "unknown",
        },
      });
    });
    onAdd(built);
    vibe([10, 50, 10]);
    handleClose();
  }

  const PHASES = ["Names / IDs", "Availability", "Troop Tiers", "Heroes"];
  const tierStack = newEntries.filter(e => !groupTierSel.has(entryKey(e)));
  const heroStack  = newEntries.filter(e => !groupHeroSel.has(entryKey(e)));

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{
        background: C.card, borderRadius: "20px 20px 0 0", width: "100%",
        maxHeight: "92vh", overflowY: "auto", padding: "16px 20px 80px",
      }}>
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 16px" }} />

        {/* Phase indicator */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          {PHASES.map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: i < phase ? C.green : i === phase ? C.gold : C.border,
                  color: i <= phase ? C.bg : C.muted, fontWeight: 700, fontSize: 13,
                }}>{i < phase ? "✓" : i + 1}</div>
                <div style={{ fontSize: 9, color: i === phase ? C.gold : C.muted, marginTop: 4, textAlign: "center" }}>{label}</div>
              </div>
              {i < PHASES.length - 1 && (
                <div style={{ height: 2, flex: 0.4, background: i < phase ? C.green : C.border, marginBottom: 16 }} />
              )}
            </div>
          ))}
        </div>

        {/* ── PHASE 0: NAMES / FIDS ── */}
        {phase === 0 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6 }}>Who's joining?</div>

            {/* ← NEW hint about mixed input */}
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 16, lineHeight: 1.6 }}>
              Enter names, FID numbers, or both — one per line or comma-separated.
              FIDs will be looked up automatically.
            </div>

            <textarea
              value={raw} onChange={e => setRaw(e.target.value)}
              placeholder={"Marcus, Caroline\n12345678\nZhang Wei, 87654321"}
              style={{
                width: "100%", minHeight: 140, background: C.section,
                border: `1px solid ${C.border}`, borderRadius: 12, padding: 14,
                fontSize: 18, color: C.white, lineHeight: 1.8,
                resize: "none", boxSizing: "border-box", fontFamily: "inherit",
              }}
            />

            {/* Live chip preview ← UPDATED: FID chips styled differently */}
            {newEntries.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
                {newEntries.map((e, i) => (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: e.isFid ? C.gold + "18" : C.section,
                    border: `1px solid ${e.isFid ? C.gold + "55" : C.border}`,
                    borderRadius: 20, padding: "6px 12px", fontSize: 13,
                    color: e.isFid ? C.gold : C.white,
                  }}>
                    {e.isFid ? "🔍 " : ""}{entryLabel(e)}
                  </span>
                ))}
              </div>
            )}

            <div style={{ fontSize: 13, color: C.icy, marginBottom: 16 }}>
              {newEntries.length > 0 && (
                <>
                  <span style={{ color: C.white, fontWeight: 600 }}>{newEntries.length}</span> new
                  {" · "}
                  <span style={{ color: C.gold }}>{newEntries.filter(e => e.isFid).length} FIDs will be looked up</span>
                  {dupCount > 0 && <span style={{ color: C.red }}> · {dupCount} duplicate{dupCount !== 1 ? "s" : ""} skipped</span>}
                </>
              )}
            </div>

            {/* Optional fields */}
            <button onClick={() => setShowOptional(!showOptional)} style={{
              background: "none", border: "none", color: C.gold,
              fontSize: 14, cursor: "pointer", padding: "4px 0", marginBottom: 12,
            }}>{showOptional ? "▾" : "▸"} Set for all members (optional)</button>

            {showOptional && (
              <div style={{ background: C.section, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>FC LEVEL</label>
                  <Input type="number" inputMode="numeric" value={fcAll} onChange={setFcAll} placeholder="e.g. 28" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>ALLIANCE TAG</label>
                  <Input value={tagAll} onChange={setTagAll} placeholder="[R3K]" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>TIMEZONE</label>
                  <Sel value={tzAll} onChange={setTzAll} options={TIMEZONES} placeholder="Select timezone…" />
                </div>
              </div>
            )}

            <button
              disabled={newEntries.length === 0 || lookingUp}
              onClick={async () => {
                await runFidLookups(); // ← NEW: look up FIDs before advancing
                setPhase(1);
                vibe(8);
              }}
              style={{
                width: "100%", height: 54, borderRadius: 12,
                background: newEntries.length > 0 ? C.gold : C.border,
                color: C.bg, fontWeight: 700, fontSize: 17, border: "none",
                cursor: newEntries.length > 0 ? "pointer" : "default",
              }}
            >
              {lookingUp
                ? `Looking up ${newEntries.filter(e => e.isFid).length} FID${newEntries.filter(e => e.isFid).length !== 1 ? "s" : ""}…`
                : `Continue with ${newEntries.length} member${newEntries.length !== 1 ? "s" : ""} →`}
            </button>
          </div>
        )}

        {/* ── PHASE 1: AVAILABILITY ── */}
        {phase === 1 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6 }}>Before the battle</div>
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 24 }}>Tap members to set their status.</div>

            {[
              { label: "🎙️ Who's on Discord voice?", set: voiceSet, setFn: setVoiceSet, color: C.gold },
              { label: "🕐 Who's arriving late?",    set: lateSet,  setFn: setLateSet,  color: C.icy,
                extra: lateSet.size > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>How late?</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["15 min","30 min","1 hr","Unknown"].map(opt => (
                        <button key={opt} onClick={() => setLateBy(opt)} style={{
                          padding: "6px 14px", borderRadius: 20, minHeight: 36,
                          border: `1px solid ${lateBy === opt ? C.icy : C.border}`,
                          background: lateBy === opt ? C.icy + "22" : C.section,
                          color: lateBy === opt ? C.icy : C.muted,
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                        }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ),
              },
              { label: "🚪 Who's leaving early?",   set: earlySet, setFn: setEarlySet, color: C.mar,
                extra: earlySet.size > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>How early?</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["30 min","1 hr","Unknown"].map(opt => (
                        <button key={opt} onClick={() => setEarlyBy(opt)} style={{
                          padding: "6px 14px", borderRadius: 20, minHeight: 36,
                          border: `1px solid ${earlyBy === opt ? C.mar : C.border}`,
                          background: earlyBy === opt ? C.mar + "22" : C.section,
                          color: earlyBy === opt ? C.mar : C.muted,
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                        }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ),
              },
              { label: "❌ Who won't make it?",     set: unavailSet, setFn: setUnavailSet, color: C.red },
            ].map(({ label, set, setFn, color, extra }) => (
              <div key={label} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>{label}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setFn(new Set(newEntries.map(entryKey)))} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Select all</button>
                  <span style={{ color: C.muted }}>·</span>
                  <button onClick={() => setFn(new Set())} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {newEntries.map(e => {
                    const key = entryKey(e);
                    const sel = set.has(key);
                    return (
                      <button key={key} onClick={() => { toggleSet(set, setFn, key); vibe(8); }} style={{
                        padding: "8px 14px", borderRadius: 20, minHeight: 44,
                        border: `1px solid ${sel ? color : C.border}`,
                        background: sel ? color + "18" : C.section,
                        color: sel ? color : C.icy,
                        fontWeight: 600, fontSize: 14, cursor: "pointer",
                      }}>{entryLabel(e)}</button>
                    );
                  })}
                </div>
                {extra}
              </div>
            ))}

            <button onClick={() => { setPhase(2); vibe(8); }} style={{
              width: "100%", height: 54, borderRadius: 12, background: C.gold,
              color: C.bg, fontWeight: 700, fontSize: 17, border: "none", cursor: "pointer", marginBottom: 12,
            }}>Continue →</button>
            <button onClick={() => { setPhase(2); }} style={{
              display: "block", margin: "0 auto", background: "none", border: "none",
              color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0",
            }}>I'll update availability during SvS →</button>
          </div>
        )}

        {/* ── PHASE 2: TROOP TIERS ── */}
        {phase === 2 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6 }}>Troop tiers</div>
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 20 }}>Set the highest tier each member has unlocked.</div>

            {/* Group shortcut */}
            <div style={{ background: C.section, borderRadius: 12, borderLeft: `3px solid ${C.gold}`, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 4 }}>⚡ Does a group share the same tiers?</div>
              <div style={{ fontSize: 13, color: C.icy, marginBottom: 12 }}>Select members, set once.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {newEntries.map(e => {
                  const key = entryKey(e);
                  const sel = groupTierSel.has(key);
                  return (
                    <button key={key} onClick={() => { toggleSet(groupTierSel, setGroupTierSel, key); vibe(8); }} style={{
                      padding: "8px 14px", borderRadius: 20, minHeight: 40,
                      border: `1px solid ${sel ? C.gold : C.border}`,
                      background: sel ? C.gold + "22" : C.card,
                      color: sel ? C.gold : C.icy, fontWeight: 600, fontSize: 14, cursor: "pointer",
                    }}>{entryLabel(e)}</button>
                  );
                })}
              </div>
              <TierRow label="🛡️ Infantry" color={C.inf} value={groupTroops.infantry} onChange={v => setGroupTroops(t => ({ ...t, infantry: v }))} />
              <TierRow label="⚔️ Lancer"   color={C.lan} value={groupTroops.lancer}   onChange={v => setGroupTroops(t => ({ ...t, lancer: v }))} />
              <TierRow label="🏹 Marksman" color={C.mar} value={groupTroops.marksman} onChange={v => setGroupTroops(t => ({ ...t, marksman: v }))} />
              {groupTierSel.size > 0 && (
                <div style={{ fontSize: 13, color: C.green, marginTop: 8 }}>✓ Applied to {groupTierSel.size} member{groupTierSel.size !== 1 ? "s" : ""}</div>
              )}
            </div>

            {/* Individual stack */}
            {tierStack.length > 0 && (() => {
              const cur = tierStack[tierIdx];
              const key = entryKey(cur);
              const mt = memberTroops[key] || { infantry: null, lancer: null, marksman: null };
              function setMT(field, val) {
                setMemberTroops(prev => ({ ...prev, [key]: { ...(prev[key] || { infantry: null, lancer: null, marksman: null }), [field]: val } }));
              }
              return (
                <div>
                  <div style={{ fontSize: 13, color: C.icy, marginBottom: 12 }}>{tierStack.length} remaining individually</div>
                  <div style={{ background: C.section, borderRadius: 14, padding: 18, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>{entryLabel(cur)}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>{tierIdx + 1} / {tierStack.length}</div>
                    </div>
                    <TierRow label="🛡️ Infantry" color={C.inf} value={mt.infantry} onChange={v => setMT("infantry", v)} />
                    <TierRow label="⚔️ Lancer"   color={C.lan} value={mt.lancer}   onChange={v => setMT("lancer", v)} />
                    <TierRow label="🏹 Marksman" color={C.mar} value={mt.marksman} onChange={v => setMT("marksman", v)} />
                    {mt.infantry && (
                      <button onClick={() => { setMT("lancer", mt.infantry); setMT("marksman", mt.infantry); vibe(8); }} style={{
                        fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer", padding: "4px 0",
                      }}>↳ Same for all three</button>
                    )}
                    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
                      {tierStack.map((_, i) => (
                        <button key={i} onClick={() => setTierIdx(i)} style={{
                          width: i === tierIdx ? 20 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", padding: 0,
                          background: i < tierIdx ? C.green : i === tierIdx ? C.gold : C.border, transition: "all 200ms",
                        }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    {tierIdx > 0 && (
                      <button onClick={() => setTierIdx(i => i - 1)} style={{
                        flex: 1, height: 48, borderRadius: 12, background: C.section,
                        border: `1px solid ${C.border}`, color: C.icy, fontWeight: 600, fontSize: 15, cursor: "pointer",
                      }}>← Back</button>
                    )}
                    {tierIdx < tierStack.length - 1 && (
                      <button onClick={() => { setTierIdx(i => i + 1); vibe(8); }} style={{
                        flex: 2, height: 48, borderRadius: 12, background: C.gold,
                        color: C.bg, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
                      }}>Next →</button>
                    )}
                  </div>
                </div>
              );
            })()}

            <button onClick={() => { setPhase(3); setHeroIdx(0); vibe(8); }} style={{
              width: "100%", height: 54, borderRadius: 12, background: C.gold,
              color: C.bg, fontWeight: 700, fontSize: 17, border: "none", cursor: "pointer", marginBottom: 12,
            }}>Continue →</button>
            <button onClick={() => { setPhase(3); }} style={{
              display: "block", margin: "0 auto", background: "none", border: "none",
              color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0",
            }}>I'll add tiers later →</button>
          </div>
        )}

        {/* ── PHASE 3: HEROES ── */}
        {phase === 3 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6 }}>Joiner heroes at Skill 5</div>
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 20 }}>Only Skill 5 heroes count. Tap to mark owned.</div>

            {/* Group shortcut */}
            <div style={{ background: C.section, borderRadius: 12, borderLeft: `3px solid ${C.gold}`, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 4 }}>⚡ Does a group share the same heroes?</div>
              <div style={{ fontSize: 13, color: C.icy, marginBottom: 12 }}>Select members and heroes together.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {newEntries.map(e => {
                  const key = entryKey(e);
                  const sel = groupHeroSel.has(key);
                  return (
                    <button key={key} onClick={() => { toggleSet(groupHeroSel, setGroupHeroSel, key); vibe(8); }} style={{
                      padding: "8px 14px", borderRadius: 20, minHeight: 40,
                      border: `1px solid ${sel ? C.gold : C.border}`,
                      background: sel ? C.gold + "22" : C.card,
                      color: sel ? C.gold : C.icy, fontWeight: 600, fontSize: 14, cursor: "pointer",
                    }}>{entryLabel(e)}</button>
                  );
                })}
              </div>
              {HEROES_BY_GEN.map(({ gen, heroes }) => (
                <div key={gen}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: "10px 0 6px" }}>{gen}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {heroes.map(h => {
                      const owned = groupHeroes.includes(h);
                      return (
                        <button key={h} onClick={() => setGroupHeroes(prev => owned ? prev.filter(x => x !== h) : [...prev, h])} style={{
                          padding: "6px 12px", borderRadius: 16, minHeight: 36,
                          border: `1px solid ${owned ? C.gold : C.border}`,
                          background: owned ? C.gold + "18" : C.section,
                          color: owned ? C.gold : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer",
                        }}>{owned ? "✓ " : ""}{h}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groupHeroSel.size > 0 && (
                <div style={{ fontSize: 13, color: C.green, marginTop: 10 }}>✓ Applied to {groupHeroSel.size} member{groupHeroSel.size !== 1 ? "s" : ""}</div>
              )}
            </div>

            {/* Individual stack */}
            {heroStack.length > 0 && (() => {
              const cur = heroStack[heroIdx];
              const key = entryKey(cur);
              const curHeroes = memberHeroes[key] || [];
              const curNone = memberHasNone[key] || false;
              return (
                <div>
                  <div style={{ fontSize: 13, color: C.icy, marginBottom: 12 }}>{heroStack.length} remaining individually</div>
                  <div style={{ background: C.section, borderRadius: 14, padding: 18, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>{entryLabel(cur)}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>{heroIdx + 1} / {heroStack.length}</div>
                    </div>
                    <button onClick={() => {
                      setMemberHasNone(prev => ({ ...prev, [key]: !curNone }));
                      if (!curNone) setMemberHeroes(prev => ({ ...prev, [key]: [] }));
                    }} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", width: "100%",
                      background: curNone ? C.red + "18" : C.card, border: `1px solid ${curNone ? C.red : C.border}`,
                      borderRadius: 10, color: curNone ? C.red : C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12, boxSizing: "border-box",
                    }}>{curNone ? "✓" : "○"} Has none at Skill 5</button>

                    {!curNone && HEROES_BY_GEN.map(({ gen, heroes }) => (
                      <div key={gen}>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: "10px 0 6px" }}>{gen}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {heroes.map(h => {
                            const owned = curHeroes.includes(h);
                            return (
                              <button key={h} onClick={() => setMemberHeroes(prev => ({ ...prev, [key]: owned ? curHeroes.filter(x => x !== h) : [...curHeroes, h] }))} style={{
                                padding: "6px 12px", borderRadius: 16, minHeight: 36,
                                border: `1px solid ${owned ? C.gold : C.border}`,
                                background: owned ? C.gold + "18" : C.card,
                                color: owned ? C.gold : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer",
                              }}>{owned ? "✓ " : ""}{h}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
                      {heroStack.map((_, i) => (
                        <button key={i} onClick={() => setHeroIdx(i)} style={{
                          width: i === heroIdx ? 20 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", padding: 0,
                          background: i < heroIdx ? C.green : i === heroIdx ? C.gold : C.border, transition: "all 200ms",
                        }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    {heroIdx > 0 && (
                      <button onClick={() => setHeroIdx(i => i - 1)} style={{
                        flex: 1, height: 48, borderRadius: 12, background: C.section,
                        border: `1px solid ${C.border}`, color: C.icy, fontWeight: 600, fontSize: 15, cursor: "pointer",
                      }}>← Back</button>
                    )}
                    {heroIdx < heroStack.length - 1 && (
                      <button onClick={() => { setHeroIdx(i => i + 1); vibe(8); }} style={{
                        flex: 2, height: 48, borderRadius: 12, background: C.gold,
                        color: C.bg, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
                      }}>Next →</button>
                    )}
                  </div>
                </div>
              );
            })()}

            <button onClick={buildAndAdd} style={{
              width: "100%", height: 54, borderRadius: 12, background: C.gold,
              color: C.bg, fontWeight: 700, fontSize: 17, border: "none", cursor: "pointer", marginBottom: 12,
            }}>Finish & Add {newEntries.length} Member{newEntries.length !== 1 ? "s" : ""}</button>
            <button onClick={buildAndAdd} style={{
              display: "block", margin: "0 auto", background: "none", border: "none",
              color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0",
            }}>I'll add heroes later →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Player Card ────────────────────────────────────────────────
function PlayerCard({ player, onClick, onDelete }) {
  const { username, name, fid, stateId, furnaceLevel, country, troops, heroes, roles, availability, profileLastUpdated, lookupStatus } = player;
  const displayName = username || name || (fid ? `FID ${fid}` : "Unknown");
  const primaryRole = roles?.[0];
  const roleColor = primaryRole ? ROLE_COLORS[primaryRole] : C.muted;

  const glyphs = [];
  if (availability?.discord === "yes") glyphs.push("🎙️");
  if (availability?.timing === "late") glyphs.push("🕐");
  if (availability?.timing === "early") glyphs.push("🚪");
  if (availability?.present === "unavailable") glyphs.push("❌");

  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        background: roleColor + "33", border: `2px solid ${roleColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 17, color: C.white,
      }}>
        {player.avatarUrl
          ? <img src={player.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
          : initials(displayName)
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }} onClick={onClick}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </div>
          {glyphs.map((g, i) => <span key={i} style={{ fontSize: 13 }}>{g}</span>)}
        </div>
        <div style={{ fontSize: 12, color: C.icy, marginBottom: 4 }}>
          {[fid && `FID ${fid}`, stateId && `S${stateId}`, furnaceLevel && `FC${furnaceLevel}`, country].filter(Boolean).join(" · ")}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[["🛡️", troops?.infantry, C.inf], ["⚔️", troops?.lancer, C.lan], ["🏹", troops?.marksman, C.mar]].map(([icon, tier, color], i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 8,
              background: (tier ? color : C.muted) + "22",
              border: `1px solid ${(tier ? color : C.muted)}33`,
              color: tier ? color : C.muted,
            }}>{icon} {tier || "?"}</span>
          ))}
          {heroes?.slice(0, 3).map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: C.gold + "18", border: `1px solid ${C.gold}33`, color: C.gold }}>✓ {h}</span>
          ))}
          {heroes?.length > 3 && <span style={{ fontSize: 11, color: C.muted }}>+{heroes.length - 3}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
          {profileLastUpdated && <div style={{ fontSize: 11, color: C.muted }}>Updated {fmtDate(profileLastUpdated)}</div>}
          <StatusBadge status={lookupStatus} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={onClick} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>›</button>
        <button onClick={e => { e.stopPropagation(); onDelete(player.id); }} style={{ background: "none", border: "none", color: C.red + "88", fontSize: 16, cursor: "pointer", padding: "4px 8px" }}>✕</button>
      </div>
    </div>
  );
}

// ── Data Panel ─────────────────────────────────────────────────
// Export/import scoped to player profiles only.

function DataPanel({ players, settings, onImport, onClose }) {
  const fileRef = useRef();
  const [mode, setMode] = useState("replace");
  const [msg, setMsg] = useState(null);

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const incoming = await importPlayers(file);
      onImport(incoming, mode);
      setMsg({ text: `✓ ${incoming.length} players imported`, type: "success" });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({ text: `Import failed: ${err.message}`, type: "error" });
      setTimeout(() => setMsg(null), 4000);
    }
    e.target.value = "";
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: C.card, borderRadius: "20px 20px 0 0", width: "100%", padding: "16px 20px 60px", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>📦 Player Data</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {msg && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: msg.type === "error" ? C.red + "18" : C.green + "18",
            color: msg.type === "error" ? C.red : C.green, fontSize: 14, fontWeight: 600,
          }}>{msg.text}</div>
        )}

        <div style={{ background: C.section, borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.gold }}>{players.length}</div>
          <div style={{ fontSize: 13, color: C.muted }}>players in roster</div>
        </div>

        {/* Export */}
        <div style={{ background: C.section, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6 }}>Export Players</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
            Downloads all player profiles as JSON. Paste into{" "}
            <code style={{ color: C.icy, fontSize: 12 }}>/src/data/defaultData.json</code>{" "}
            under the <code style={{ color: C.icy, fontSize: 12 }}>"players"</code> key to hardcode your roster.
          </div>
          <button onClick={() => exportPlayers(players, settings?.allianceTag)} style={{
            width: "100%", height: 48, borderRadius: 10, background: C.gold,
            color: C.bg, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
          }}>⬇️ Download JSON</button>
        </div>

        {/* Import */}
        <div style={{ background: C.section, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6 }}>Import Players</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Upload a previously exported player JSON.</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[["replace", "Replace all"], ["merge", "Merge"]].map(([val, label]) => (
              <button key={val} onClick={() => setMode(val)} style={{
                flex: 1, height: 40, borderRadius: 10,
                border: `1px solid ${mode === val ? C.gold : C.border}`,
                background: mode === val ? C.gold + "22" : C.card,
                color: mode === val ? C.gold : C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            {mode === "replace" ? "⚠️ Replaces all current players." : "Merges by player ID — incoming wins on conflict."}
          </div>
          <input type="file" accept=".json" ref={fileRef} onChange={handleImport} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} style={{
            width: "100%", height: 48, borderRadius: 10, background: C.section,
            border: `1px solid ${C.border}`, color: C.icy, fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}>⬆️ Choose JSON File</button>
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel ─────────────────────────────────────────────
function SettingsPanel({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings || {});
  function upd(k, v) { setS(prev => ({ ...prev, [k]: v })); }
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: C.card, borderRadius: "20px 20px 0 0", width: "100%", padding: "16px 20px 60px", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>⚙️ Settings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <Field label="Alliance Name"><Input value={s.allianceName} onChange={v => upd("allianceName", v)} placeholder="Alliance name" /></Field>
        <Field label="Alliance Tag"><Input value={s.allianceTag} onChange={v => upd("allianceTag", v)} placeholder="[TAG]" /></Field>
        <Field label="State ID"><Input value={s.stateId} onChange={v => upd("stateId", v)} placeholder="3543" inputMode="numeric" /></Field>
        <button onClick={() => { onSave(s); onClose(); vibe(8); }} style={{
          width: "100%", height: 54, borderRadius: 12, background: C.gold,
          color: C.bg, fontWeight: 700, fontSize: 17, border: "none", cursor: "pointer",
        }}>Save</button>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(() => loadData());
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [dataPanel, setDataPanel] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Auto-save on every data change
  useEffect(() => { saveData(data); }, [data]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  function savePlayer(player) {
    setData(prev => {
      const exists = prev.players.find(p => p.id === player.id);
      const players = exists
        ? prev.players.map(p => p.id === player.id ? player : p)
        : [...prev.players, player];
      return { ...prev, players, lastUpdated: new Date().toISOString() };
    });
    showToast(editingPlayer ? "Player updated" : "Player added");
  }

  function addPlayers(newPlayers) {
    setData(prev => ({ ...prev, players: [...prev.players, ...newPlayers], lastUpdated: new Date().toISOString() }));
    showToast(`${newPlayers.length} player${newPlayers.length !== 1 ? "s" : ""} added`);
  }

  function deletePlayer(id) {
    setData(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id), lastUpdated: new Date().toISOString() }));
    showToast("Player removed");
    setDeleteConfirm(null);
  }

  function handleImportPlayers(incoming, mode) {
    setData(prev => ({
      ...prev,
      players: mode === "merge" ? mergePlayers(prev.players, incoming) : incoming,
      lastUpdated: new Date().toISOString(),
    }));
    showToast(`Players imported (${mode})`);
    setDataPanel(false);
  }

  const players = data.players || [];
  const filteredPlayers = players.filter(p => {
    const name = (p.username || p.name || p.fid || "").toLowerCase();
    const matchSearch = !search
      || name.includes(search.toLowerCase())
      || (p.fid || "").includes(search)
      || (p.stateId || "").includes(search);
    const matchRole = filterRole === "All" || p.roles?.includes(filterRole);
    return matchSearch && matchRole;
  });

  const TABS = [
    { icon: "👥", label: "Roster" },
    { icon: "⚔️", label: "Teams" },
    { icon: "📋", label: "Plan" },
    { icon: "📊", label: "Stats" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.white, fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 80, maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 14px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.bg, zIndex: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.white }}>🏰 {data.settings?.allianceName || "Rally Planner"}</div>
            <div style={{ fontSize: 13, color: C.muted }}>
              {data.settings?.allianceTag ? `[${data.settings.allianceTag}] · ` : ""}
              State {data.settings?.stateId || "3543"} · {players.length} players
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setDataPanel(true)} style={{
              height: 36, padding: "0 12px", borderRadius: 20, background: C.section,
              border: `1px solid ${C.border}`, color: C.icy, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>📦</button>
            <button onClick={() => setSettingsPanel(true)} style={{
              height: 36, padding: "0 12px", borderRadius: 20, background: C.section,
              border: `1px solid ${C.border}`, color: C.icy, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>⚙️</button>
          </div>
        </div>
      </div>

      {/* ── ROSTER TAB ── */}
      {tab === 0 && (
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, FID, state…"
              style={{
                flex: 1, height: 48, background: C.section, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "0 14px", fontSize: 16, color: C.white, fontFamily: "inherit",
              }} />
            <button onClick={() => setBatchOpen(true)} style={{
              height: 48, padding: "0 12px", borderRadius: 10, background: "none",
              border: `1px solid ${C.gold}`, color: C.gold, fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>⚡ Batch</button>
            <button onClick={() => { setEditingPlayer(null); setSheetOpen(true); }} style={{
              height: 48, padding: "0 14px", borderRadius: 10, background: C.gold,
              color: C.bg, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
            }}>＋</button>
          </div>

          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 4 }}>
            {["All", ...ROLES].map(r => (
              <button key={r} onClick={() => setFilterRole(r)} style={{
                padding: "7px 14px", borderRadius: 20, whiteSpace: "nowrap",
                background: filterRole === r ? C.gold + "22" : C.section,
                border: `1px solid ${filterRole === r ? C.gold : C.border}`,
                color: filterRole === r ? C.gold : C.muted,
                fontWeight: 600, fontSize: 13, cursor: "pointer", minHeight: 36,
              }}>{r}</button>
            ))}
          </div>

          {players.length > 0 && (
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
              {filteredPlayers.length} of {players.length} player{players.length !== 1 ? "s" : ""}
            </div>
          )}

          {players.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👥</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 8 }}>No players yet</div>
              <div style={{ fontSize: 15, color: C.muted, marginBottom: 28 }}>Add players by name, FID, or import a JSON file</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setBatchOpen(true)} style={{
                  height: 52, padding: "0 24px", borderRadius: 12, background: C.gold,
                  color: C.bg, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
                }}>⚡ Batch Add</button>
                <button onClick={() => { setEditingPlayer(null); setSheetOpen(true); }} style={{
                  height: 52, padding: "0 24px", borderRadius: 12, background: C.section,
                  border: `1px solid ${C.border}`, color: C.icy, fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}>＋ Add One</button>
                <button onClick={() => setDataPanel(true)} style={{
                  height: 52, padding: "0 24px", borderRadius: 12, background: C.section,
                  border: `1px solid ${C.border}`, color: C.icy, fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}>⬆️ Import</button>
              </div>
            </div>
          )}

          {players.length > 0 && filteredPlayers.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>No results for "{search || filterRole}"</div>
          )}

          {filteredPlayers.map(p => (
            <PlayerCard key={p.id} player={p}
              onClick={() => { setEditingPlayer(p); setSheetOpen(true); }}
              onDelete={id => setDeleteConfirm(id)}
            />
          ))}
        </div>
      )}

      {/* ── TEAMS TAB ── */}
      {tab === 1 && (
        <div style={{ padding: "16px 20px" }}>
          {(() => {
            const avail = players.filter(p => p.availability?.present === "available");
            const byRole = ROLES.map(role => ({ role, members: avail.filter(p => p.roles?.includes(role)) })).filter(g => g.members.length > 0);
            return (
              <>
                <div style={{ background: C.section, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: C.icy, marginBottom: 4 }}>Available for SvS</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.white }}>
                    {avail.length} <span style={{ fontSize: 16, color: C.muted }}>of {players.length}</span>
                  </div>
                </div>
                {byRole.map(({ role, members }) => (
                  <div key={role} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ROLE_COLORS[role], textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      {ROLE_ICONS[role]} {role} · {members.length}
                    </div>
                    {members.map(m => (
                      <div key={m.id} style={{ background: C.card, borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: C.white, fontSize: 15 }}>{m.username || m.name || `FID ${m.fid}`}</div>
                          <div style={{ fontSize: 12, color: C.icy }}>
                            {[m.furnaceLevel && `FC${m.furnaceLevel}`, m.stateId && `S${m.stateId}`].filter(Boolean).join(" · ")}
                            {m.availability?.timing === "late" ? " · 🕐" : ""}
                            {m.availability?.discord === "yes" ? " · 🎙️" : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[m.troops?.infantry, m.troops?.lancer, m.troops?.marksman].map((t, i) => (
                            <span key={i} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, background: [C.inf, C.lan, C.mar][i] + "22", color: [C.inf, C.lan, C.mar][i] }}>{t || "?"}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {players.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>Add players in the Roster tab first</div>}
              </>
            );
          })()}
        </div>
      )}

      {/* ── PLAN TAB ── */}
      {tab === 2 && (
        <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          Plan tab — coming next iteration
        </div>
      )}

      {/* ── STATS TAB ── */}
      {tab === 3 && (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              ["👥", "Total Players",   players.length],
              ["👑", "Rally Leads",     players.filter(p => p.roles?.includes("Rally Lead")).length],
              ["✅", "Available",       players.filter(p => p.availability?.present === "available").length],
              ["⚔️", "Skill 5 Heroes", players.filter(p => p.heroes?.length > 0).length],
              ["🎙️", "On Discord",     players.filter(p => p.availability?.discord === "yes").length],
              ["🔍", "Auto-fetched",   players.filter(p => p.lookupStatus === "fetched").length],
            ].map(([icon, label, val]) => (
              <div key={label} style={{ background: C.card, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 22 }}>{icon}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.gold }}>{val}</div>
                <div style={{ fontSize: 13, color: C.icy }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Country breakdown */}
          {(() => {
            const counts = {};
            players.forEach(p => { if (p.country) counts[p.country] = (counts[p.country] || 0) + 1; });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
            if (!sorted.length) return null;
            return (
              <div style={{ background: C.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 12 }}>🌏 Countries</div>
                {sorted.map(([country, count]) => (
                  <div key={country} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, color: C.icy }}>{country}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 80, height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
                        <div style={{ width: `${(count / players.length) * 100}%`, height: "100%", background: C.gold, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.gold, width: 20, textAlign: "right" }}>{count}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Top heroes */}
          {(() => {
            const counts = {};
            players.forEach(p => p.heroes?.forEach(h => { counts[h] = (counts[h] || 0) + 1; }));
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
            if (!top.length) return null;
            return (
              <div style={{ background: C.card, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 12 }}>🏅 Top Heroes (Skill 5)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {top.map(([hero, count]) => (
                    <div key={hero} style={{ padding: "8px 12px", borderRadius: 20, background: C.gold + "18", border: `1px solid ${C.gold}33` }}>
                      <span style={{ color: C.gold, fontWeight: 600, fontSize: 13 }}>✓ {hero}</span>
                      <span style={{ color: C.muted, fontSize: 12, marginLeft: 6 }}>×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {players.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>Add players to see stats</div>}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#000b", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>Remove player?</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 20 }}>Export first if you want a backup.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: 48, borderRadius: 10, background: C.section, border: `1px solid ${C.border}`, color: C.icy, fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deletePlayer(deleteConfirm)} style={{ flex: 1, height: 48, borderRadius: 10, background: C.red, color: C.white, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Sheets */}
      <PlayerSheet open={sheetOpen} player={editingPlayer} onClose={() => setSheetOpen(false)} onSave={savePlayer} />
      <BatchAddSheet open={batchOpen} onClose={() => setBatchOpen(false)} members={players} onAdd={addPlayers} />
      {dataPanel && <DataPanel players={players} settings={data.settings} onImport={handleImportPlayers} onClose={() => setDataPanel(false)} />}
      {settingsPanel && <SettingsPanel settings={data.settings} onSave={s => setData(prev => ({ ...prev, settings: s }))} onClose={() => setSettingsPanel(false)} />}

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Tab bar */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        display: "grid", gridTemplateColumns: "repeat(4,1fr)",
        background: C.bg, borderTop: `1px solid ${C.border}`, height: 60, zIndex: 100,
      }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => { setTab(i); vibe(8); }} style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", cursor: "pointer",
            color: tab === i ? C.gold : C.muted,
            gap: 3, fontSize: 10, fontWeight: 600, transition: "color 150ms ease",
          }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

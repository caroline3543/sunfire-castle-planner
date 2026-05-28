import { useState, useEffect, useCallback, useRef } from "react";
import { loadData, saveData, exportData, importData, mergeData, lookupWosPlayer } from "./data/dataManager.js";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg: "#0A1628", card: "#1E3A52", section: "#152236",
  gold: "#F5A623", white: "#FFFFFF", icy: "#A8C4D8",
  muted: "#5A7A94", inf: "#6B8CAE", lan: "#7BAE8C",
  mar: "#B8859A", red: "#FF453A", green: "#30D158",
  border: "#2A4A64", overlay: "#0A1628ee",
};

const TIER_OPTIONS = ["T10","FC1","FC2","FC3","FC4","FC5","T11","T12"];
const ROLES = ["Rally Lead","Attack Team","Joiner","Garrison","Flexible","Reserve"];
const ROLE_COLORS = { "Rally Lead":C.gold,"Attack Team":C.red,"Joiner":C.mar,"Garrison":C.inf,"Flexible":C.lan,"Reserve":C.muted };

const HEROES_BY_GEN = [
  { gen:"Gen 1", heroes:["Jessie","Jasser","Jeronimo","Seo-Yoon","Patrick","Bahiti","Ling Xue","Lumak Bokan"] },
  { gen:"Gen 2", heroes:["Philly","Alonso"] },
  { gen:"Gen 3", heroes:["Mia","Logan","Greg"] },
  { gen:"Gen 4", heroes:["Reina","Ahmose","Lynn"] },
  { gen:"Gen 5", heroes:["Norah","Hector","Gwen"] },
  { gen:"Gen 6", heroes:["Wu Ming","Renee","Wayne"] },
  { gen:"Gen 7", heroes:["Edith","Gordon","Bradley"] },
  { gen:"Gen 8", heroes:["Gatot","Sonya","Hendrik"] },
  { gen:"Gen 9", heroes:["Magnus","Fred","Xura"] },
  { gen:"Gen 10", heroes:["Gregory","Freya","Blanchette"] },
  { gen:"Gen 11", heroes:["Eleonora","Lloyd","Rufus"] },
];

const TIMEZONES = ["UTC-12","UTC-11","UTC-10","UTC-9","UTC-8 (PST)","UTC-7 (MST)","UTC-6 (CST)","UTC-5 (EST)","UTC-4","UTC-3","UTC-2","UTC-1","UTC+0 (GMT)","UTC+1 (CET)","UTC+2 (EET)","UTC+3","UTC+4","UTC+5","UTC+5:30 (IST)","UTC+6","UTC+7 (ICT)","UTC+8 (CST/SGT)","UTC+9 (JST/KST)","UTC+10 (AEST)","UTC+11","UTC+12 (NZST)","UTC+13"];

const LANGUAGES = ["English","Mandarin","Spanish","Portuguese","Russian","Arabic","Turkish","German","French","Indonesian","Vietnamese","Thai","Korean","Japanese","Polish","Italian","Dutch","Hindi","Malay","Other"];

const COUNTRIES = ["Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bangladesh","Belgium","Brazil","Cambodia","Canada","Chile","China","Colombia","Czech Republic","Denmark","Egypt","Ethiopia","Finland","France","Germany","Ghana","Greece","Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Japan","Jordan","Kazakhstan","Kenya","Malaysia","Mexico","Morocco","Myanmar","Nepal","Netherlands","New Zealand","Nigeria","Norway","Pakistan","Peru","Philippines","Poland","Portugal","Romania","Russia","Saudi Arabia","Serbia","Singapore","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland","Taiwan","Thailand","Turkey","Ukraine","United Arab Emirates","United Kingdom","United States","Venezuela","Vietnam","Other"];

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function vibe(p) { try { navigator.vibrate(p); } catch(e) {} }
function initials(name) { return (name||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "?"; }
function fmtDate(iso) { if (!iso) return null; try { return new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); } catch { return null; } }
function newPlayer(overrides={}) {
  return {
    id: uid(),
    // WOS identity
    fid: "", username: "", name: "",
    country: "", timezone: "", languages: [],
    stateId: "", allianceName: "", allianceTag: "",
    furnaceLevel: null,
    infantryCampLevel: null, lancerCampLevel: null, marksmanCampLevel: null,
    avatarUrl: "",
    // Battle data
    fcLevel: null,
    troops: { infantry: null, lancer: null, marksman: null },
    heroes: [], hasNoneChecked: false,
    roles: [],
    availability: { present:"available", timing:"unknown", lateBy:null, earlyBy:null, discord:"unknown" },
    teamAssignment: null,
    notes: "",
    // Meta
    lookupStatus: null, // null | "fetched" | "failed" | "manual"
    lookupLastUpdated: null,
    profileLastUpdated: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Reusable UI ────────────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type="text", inputMode, style={} }) {
  return (
    <input type={type} inputMode={inputMode} value={value||""} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} style={{
        width:"100%", background:C.section, border:`1px solid ${C.border}`,
        borderRadius:10, padding:"12px 14px", fontSize:16, color:C.white,
        boxSizing:"border-box", fontFamily:"inherit", ...style,
      }} />
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value||""} onChange={e=>onChange(e.target.value)} style={{
      width:"100%", background:C.section, border:`1px solid ${C.border}`,
      borderRadius:10, padding:"12px 14px", fontSize:16,
      color: value ? C.white : C.muted, boxSizing:"border-box", fontFamily:"inherit",
    }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function TierPill({ value, onChange, color }) {
  return (
    <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
      {TIER_OPTIONS.map(t => (
        <button key={t} onClick={()=>onChange(value===t?null:t)} style={{
          padding:"6px 12px", borderRadius:16, border:`1px solid ${value===t?color:C.border}`,
          background: value===t ? color+"22" : C.section, color: value===t ? color : C.muted,
          fontWeight:600, fontSize:13, cursor:"pointer", whiteSpace:"nowrap", minHeight:36, flexShrink:0,
        }}>{t}</button>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { fetched:[C.green,"● Auto-fetched"], failed:[C.red,"● Lookup failed"], manual:[C.icy,"● Manual entry"] };
  if (!status || !map[status]) return null;
  const [color, label] = map[status];
  return <span style={{ fontSize:11, color, fontWeight:600 }}>{label}</span>;
}

function Toast({ message, type="success" }) {
  if (!message) return null;
  const color = type==="error" ? C.red : type==="warning" ? C.gold : C.green;
  return (
    <div style={{
      position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
      background:C.card+"ee", backdropFilter:"blur(12px)",
      border:`1px solid ${color}44`, borderRadius:20,
      padding:"10px 20px", fontSize:15, fontWeight:600, color,
      zIndex:500, whiteSpace:"nowrap", maxWidth:"90vw",
    }}>{message}</div>
  );
}

// ── WOS Lookup Banner ──────────────────────────────────────────
function LookupBanner({ fid, onResult, onSkip }) {
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);

  async function doLookup() {
    if (!fid?.trim()) return;
    setLoading(true);
    const result = await lookupWosPlayer(fid.trim());
    setLoading(false);
    setTried(true);
    onResult(result);
  }

  return (
    <div style={{
      background: C.section, border:`1px solid ${C.gold}33`, borderRadius:12,
      padding:14, marginBottom:16,
    }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.gold, marginBottom:4 }}>⚡ WOS Profile Lookup</div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:10, lineHeight:1.5 }}>
        Unofficial — may not always work. All fetched data is editable.
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={doLookup} disabled={loading || !fid?.trim()} style={{
          flex:1, height:40, borderRadius:10, background: fid?.trim() ? C.gold : C.border,
          color:C.bg, fontWeight:700, fontSize:14, border:"none",
          cursor: fid?.trim() ? "pointer" : "default",
        }}>{loading ? "Looking up…" : tried ? "Retry Lookup" : "Fetch Profile"}</button>
        <button onClick={onSkip} style={{
          height:40, padding:"0 14px", borderRadius:10, background:"none",
          border:`1px solid ${C.border}`, color:C.muted, fontSize:14, cursor:"pointer",
        }}>Skip</button>
      </div>
    </div>
  );
}

// ── Player Profile Sheet ───────────────────────────────────────
function PlayerSheet({ player, open, onClose, onSave }) {
  const [p, setP] = useState(player || newPlayer());
  const [tab, setTab] = useState("identity");
  const [showLookup, setShowLookup] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setP(player || newPlayer());
      setTab("identity");
      setShowLookup(!player); // show lookup for new players
    }
  }, [open, player]);

  function update(key, val) {
    setP(prev => ({ ...prev, [key]: val, profileLastUpdated: new Date().toISOString() }));
  }
  function updateTroop(key, val) {
    setP(prev => ({ ...prev, troops: { ...prev.troops, [key]: val }, profileLastUpdated: new Date().toISOString() }));
  }

  function handleLookupResult(result) {
    if (result.success) {
      setP(prev => ({
        ...prev,
        username: result.username || prev.username,
        furnaceLevel: result.furnaceLevel || prev.furnaceLevel,
        stateId: result.stateId || prev.stateId,
        avatarUrl: result.avatarUrl || prev.avatarUrl,
        allianceName: result.allianceName || prev.allianceName,
        lookupStatus: "fetched",
        lookupLastUpdated: new Date().toISOString(),
        profileLastUpdated: new Date().toISOString(),
      }));
    } else {
      setP(prev => ({ ...prev, lookupStatus: "failed", lookupLastUpdated: new Date().toISOString() }));
    }
  }

  function handleSave() {
    const final = { ...p, profileLastUpdated: p.profileLastUpdated || new Date().toISOString() };
    if (!final.lookupStatus) final.lookupStatus = "manual";
    onSave(final);
    onClose();
    vibe(8);
  }

  const TABS = [
    { id:"identity", label:"👤 Identity" },
    { id:"combat", label:"⚔️ Combat" },
    { id:"availability", label:"📅 Availability" },
  ];

  if (!open) return null;

  return (
    <div style={{ position:"fixed", inset:0, background:"#000c", zIndex:300, display:"flex", alignItems:"flex-end" }}>
      <div style={{
        background:C.card, borderRadius:"20px 20px 0 0", width:"100%",
        maxHeight:"92vh", overflowY:"auto", padding:"16px 20px 100px",
      }}>
        {/* Handle */}
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:"0 auto 16px" }} />

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>
            {player ? "Edit Player" : "Add Player"}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <StatusBadge status={p.lookupStatus} />
            <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, fontSize:22, cursor:"pointer" }}>✕</button>
          </div>
        </div>

        {/* WOS lookup — shown for new players or on demand */}
        {showLookup && (
          <LookupBanner fid={p.fid} onResult={handleLookupResult} onSkip={() => setShowLookup(false)} />
        )}
        {!showLookup && p.fid && (
          <button onClick={() => setShowLookup(true)} style={{
            background:"none", border:"none", color:C.gold, fontSize:13, cursor:"pointer",
            marginBottom:12, padding:0,
          }}>⚡ Re-fetch WOS profile</button>
        )}

        {/* Tab strip */}
        <div style={{ display:"flex", gap:6, marginBottom:20, overflowX:"auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:"8px 14px", borderRadius:20, whiteSpace:"nowrap",
              background: tab===t.id ? C.gold+"22" : C.section,
              border:`1px solid ${tab===t.id ? C.gold : C.border}`,
              color: tab===t.id ? C.gold : C.muted,
              fontWeight:600, fontSize:13, cursor:"pointer",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── IDENTITY TAB ── */}
        {tab === "identity" && (
          <div>
            <Field label="WOS User ID / FID" hint="Enter FID first to enable profile lookup">
              <div style={{ display:"flex", gap:8 }}>
                <Input value={p.fid} onChange={v => { update("fid", v); setShowLookup(!!v); }}
                  placeholder="e.g. 12345678" inputMode="numeric" style={{ flex:1 }} />
              </div>
            </Field>

            <Field label="Username (WOS)">
              <Input value={p.username} onChange={v => update("username", v)} placeholder="In-game username" />
            </Field>

            <Field label="Real Name / Alias">
              <Input value={p.name} onChange={v => update("name", v)} placeholder="Optional real name or alias" />
            </Field>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <Field label="State ID">
                <Input value={p.stateId} onChange={v => update("stateId", v)} placeholder="e.g. 3543" inputMode="numeric" />
              </Field>
              <Field label="Furnace Level">
                <Input value={p.furnaceLevel} onChange={v => update("furnaceLevel", v ? parseInt(v) : null)} placeholder="e.g. 28" inputMode="numeric" type="number" />
              </Field>
            </div>

            <Field label="Country">
              <Select value={p.country} onChange={v => update("country", v)} options={COUNTRIES} placeholder="Select country…" />
            </Field>

            <Field label="Timezone">
              <Select value={p.timezone} onChange={v => update("timezone", v)} options={TIMEZONES} placeholder="Select timezone…" />
            </Field>

            <Field label="Languages">
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {LANGUAGES.map(lang => {
                  const sel = p.languages?.includes(lang);
                  return (
                    <button key={lang} onClick={() => {
                      const cur = p.languages || [];
                      update("languages", sel ? cur.filter(l=>l!==lang) : [...cur, lang]);
                    }} style={{
                      padding:"6px 12px", borderRadius:16, minHeight:36,
                      border:`1px solid ${sel ? C.icy : C.border}`,
                      background: sel ? C.icy+"22" : C.section,
                      color: sel ? C.icy : C.muted, fontWeight:600, fontSize:13, cursor:"pointer",
                    }}>{lang}</button>
                  );
                })}
              </div>
            </Field>

            <Field label="Alliance">
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:8 }}>
                <Input value={p.allianceName} onChange={v => update("allianceName", v)} placeholder="Alliance name" />
                <Input value={p.allianceTag} onChange={v => update("allianceTag", v)} placeholder="[TAG]" />
              </div>
            </Field>

            {p.lookupLastUpdated && (
              <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
                Profile data last fetched: {fmtDate(p.lookupLastUpdated)}
              </div>
            )}

            <Field label="Notes">
              <textarea value={p.notes||""} onChange={e => update("notes", e.target.value)}
                placeholder="Any notes about this player…"
                style={{
                  width:"100%", minHeight:80, background:C.section, border:`1px solid ${C.border}`,
                  borderRadius:10, padding:"12px 14px", fontSize:16, color:C.white,
                  resize:"none", boxSizing:"border-box", fontFamily:"inherit",
                }} />
            </Field>
          </div>
        )}

        {/* ── COMBAT TAB ── */}
        {tab === "combat" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
              {[["🛡️ Infantry Camp","infantryCampLevel",C.inf],["⚔️ Lancer Camp","lancerCampLevel",C.lan],["🏹 Marksman Camp","marksmanCampLevel",C.mar]].map(([label, key, color]) => (
                <div key={key} style={{ background:C.section, borderRadius:12, padding:12, textAlign:"center" }}>
                  <div style={{ fontSize:11, color, fontWeight:700, marginBottom:8 }}>{label}</div>
                  <input type="number" inputMode="numeric" value={p[key]||""}
                    onChange={e => update(key, e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="–" style={{
                      width:"100%", background:C.card, border:`1px solid ${color}44`,
                      borderRadius:8, padding:"8px 0", fontSize:20, fontWeight:700,
                      color, textAlign:"center", boxSizing:"border-box", fontFamily:"inherit",
                    }} />
                </div>
              ))}
            </div>

            <Field label="🛡️ Infantry Troop Tier">
              <TierPill value={p.troops.infantry} onChange={v=>updateTroop("infantry",v)} color={C.inf} />
            </Field>
            <Field label="⚔️ Lancer Troop Tier">
              <TierPill value={p.troops.lancer} onChange={v=>updateTroop("lancer",v)} color={C.lan} />
            </Field>
            <Field label="🏹 Marksman Troop Tier">
              <TierPill value={p.troops.marksman} onChange={v=>updateTroop("marksman",v)} color={C.mar} />
            </Field>

            <Field label="Battle Roles" hint="Select all that apply">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {ROLES.map(role => {
                  const sel = p.roles?.includes(role);
                  const color = ROLE_COLORS[role];
                  return (
                    <button key={role} onClick={() => {
                      const cur = p.roles || [];
                      update("roles", sel ? cur.filter(r=>r!==role) : [...cur, role]);
                    }} style={{
                      padding:"12px 14px", borderRadius:12, minHeight:48, textAlign:"left",
                      border:`1px solid ${sel ? color : C.border}`,
                      background: sel ? color+"18" : C.section,
                      color: sel ? color : C.muted, fontWeight:600, fontSize:14, cursor:"pointer",
                      position:"relative",
                    }}>
                      {sel && <span style={{ position:"absolute", top:8, right:10, fontSize:12 }}>✓</span>}
                      {role}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Joiner Heroes at Skill 5" hint="Only Skill 5 heroes count for rally planning">
              <button onClick={() => {
                update("hasNoneChecked", !p.hasNoneChecked);
                if (!p.hasNoneChecked) update("heroes", []);
              }} style={{
                display:"flex", alignItems:"center", gap:10, padding:"10px 14px", width:"100%",
                background: p.hasNoneChecked ? C.red+"18" : C.section,
                border:`1px solid ${p.hasNoneChecked ? C.red : C.border}`,
                borderRadius:10, color: p.hasNoneChecked ? C.red : C.muted,
                fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:12, boxSizing:"border-box",
              }}>{p.hasNoneChecked ? "✓" : "○"} Has none at Skill 5</button>

              {!p.hasNoneChecked && HEROES_BY_GEN.map(({ gen, heroes }) => (
                <div key={gen}>
                  <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", margin:"12px 0 8px" }}>{gen}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {heroes.map(h => {
                      const owned = p.heroes?.includes(h);
                      return (
                        <button key={h} onClick={() => {
                          const cur = p.heroes || [];
                          update("heroes", owned ? cur.filter(x=>x!==h) : [...cur, h]);
                        }} style={{
                          padding:"6px 12px", borderRadius:16, minHeight:36,
                          border:`1px solid ${owned ? C.gold : C.border}`,
                          background: owned ? C.gold+"18" : C.section,
                          color: owned ? C.gold : C.muted, fontWeight:600, fontSize:13, cursor:"pointer",
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
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[["✅ Available","available",C.green],["❌ Unavailable","unavailable",C.red]].map(([label,val,color]) => (
                  <button key={val} onClick={()=>update("availability",{...p.availability,present:val})} style={{
                    height:52, borderRadius:12, border:`1px solid ${p.availability.present===val ? color : C.border}`,
                    background: p.availability.present===val ? color+"18" : C.section,
                    color: p.availability.present===val ? color : C.muted,
                    fontWeight:600, fontSize:15, cursor:"pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>

            <Field label="Timing">
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[["⏰ On Time","on-time"],["🕐 Late","late"],["🚪 Leaving Early","early"],["❓ Unknown","unknown"]].map(([label,val]) => (
                  <button key={val} onClick={()=>update("availability",{...p.availability,timing:val})} style={{
                    padding:"8px 14px", borderRadius:20, minHeight:40,
                    border:`1px solid ${p.availability.timing===val ? C.gold : C.border}`,
                    background: p.availability.timing===val ? C.gold+"18" : C.section,
                    color: p.availability.timing===val ? C.gold : C.muted,
                    fontWeight:600, fontSize:14, cursor:"pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>

            <Field label="Discord During SvS">
              <div style={{ display:"flex", gap:8 }}>
                {[["🎙️ On Discord","yes"],["🔇 Not on Discord","no"],["❓ Unknown","unknown"]].map(([label,val]) => (
                  <button key={val} onClick={()=>update("availability",{...p.availability,discord:val})} style={{
                    flex:1, height:44, borderRadius:12,
                    border:`1px solid ${p.availability.discord===val ? C.icy : C.border}`,
                    background: p.availability.discord===val ? C.icy+"18" : C.section,
                    color: p.availability.discord===val ? C.icy : C.muted,
                    fontWeight:600, fontSize:13, cursor:"pointer",
                  }}>{label}</button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* Last updated */}
        {p.profileLastUpdated && (
          <div style={{ fontSize:12, color:C.muted, marginTop:8, marginBottom:16 }}>
            Last updated: {fmtDate(p.profileLastUpdated)}
          </div>
        )}

        {/* Save */}
        <button onClick={handleSave} style={{
          width:"100%", height:54, borderRadius:12, background:C.gold,
          color:C.bg, fontWeight:700, fontSize:17, border:"none", cursor:"pointer",
          position:"sticky", bottom:0,
        }}>Save Player</button>
      </div>
    </div>
  );
}

// ── Player Card ────────────────────────────────────────────────
function PlayerCard({ player, onClick, onDelete }) {
  const { username, name, fid, stateId, furnaceLevel, country, troops, heroes, roles, availability, lookupStatus, profileLastUpdated } = player;
  const displayName = username || name || `FID ${fid}` || "Unknown";
  const primaryRole = roles?.[0];
  const roleColor = primaryRole ? ROLE_COLORS[primaryRole] : C.muted;

  function glyphs() {
    const g = [];
    if (availability?.discord === "yes") g.push("🎙️");
    if (availability?.timing === "late") g.push("🕐");
    if (availability?.timing === "early") g.push("🚪");
    if (availability?.present === "unavailable") g.push("❌");
    return g;
  }

  return (
    <div style={{
      background:C.card, borderRadius:12, padding:"14px 16px", marginBottom:10,
      display:"flex", alignItems:"center", gap:12,
    }}>
      {/* Avatar */}
      <div style={{
        width:48, height:48, borderRadius:"50%",
        background: roleColor+"33", border:`2px solid ${roleColor}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontWeight:700, fontSize:17, color:C.white, flexShrink:0, overflow:"hidden",
      }}>
        {player.avatarUrl
          ? <img src={player.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{e.target.style.display="none"}} />
          : initials(displayName)
        }
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }} onClick={onClick}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {displayName}
          </div>
          {glyphs().map((g,i) => <span key={i} style={{ fontSize:13 }}>{g}</span>)}
        </div>
        <div style={{ fontSize:12, color:C.icy, marginBottom:4 }}>
          {[fid && `FID ${fid}`, stateId && `S${stateId}`, furnaceLevel && `FC${furnaceLevel}`, country].filter(Boolean).join(" · ")}
        </div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {[["🛡️", troops?.infantry, C.inf],["⚔️", troops?.lancer, C.lan],["🏹", troops?.marksman, C.mar]].map(([icon,tier,color],i) => (
            <span key={i} style={{
              fontSize:11, fontWeight:600, padding:"2px 7px", borderRadius:8,
              background:(tier?color:C.muted)+"22", border:`1px solid ${(tier?color:C.muted)}33`,
              color: tier?color:C.muted,
            }}>{icon} {tier||"?"}</span>
          ))}
          {heroes?.slice(0,3).map(h => (
            <span key={h} style={{ fontSize:11, fontWeight:600, padding:"2px 7px", borderRadius:8, background:C.gold+"18", border:`1px solid ${C.gold}33`, color:C.gold }}>✓ {h}</span>
          ))}
          {heroes?.length > 3 && <span style={{ fontSize:11, color:C.muted }}>+{heroes.length-3}</span>}
        </div>
        {profileLastUpdated && (
          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Updated {fmtDate(profileLastUpdated)}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        <button onClick={onClick} style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", padding:"4px 8px" }}>›</button>
        <button onClick={e=>{e.stopPropagation();onDelete(player.id);}} style={{ background:"none", border:"none", color:C.red+"88", fontSize:16, cursor:"pointer", padding:"4px 8px" }}>✕</button>
      </div>
    </div>
  );
}

// ── Export / Import Panel ──────────────────────────────────────
function DataPanel({ data, onImport, onClose }) {
  const fileRef = useRef();
  const [mode, setMode] = useState("replace");
  const [msg, setMsg] = useState(null);

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      onImport(imported, mode);
      setMsg({ text:"✓ Data imported", type:"success" });
      setTimeout(() => setMsg(null), 3000);
    } catch(err) {
      setMsg({ text:`Import failed: ${err.message}`, type:"error" });
      setTimeout(() => setMsg(null), 4000);
    }
    e.target.value = "";
  }

  const stats = [
    ["Players", data.players?.length || 0],
    ["Events", data.events?.length || 0],
    ["Notes", data.notes?.length || 0],
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"#000c", zIndex:300, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:C.card, borderRadius:"20px 20px 0 0", width:"100%", padding:"16px 20px 60px", maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:"0 auto 20px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>📦 Export / Import</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, fontSize:22, cursor:"pointer" }}>✕</button>
        </div>

        {msg && <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:16, background: msg.type==="error" ? C.red+"18" : C.green+"18", color: msg.type==="error" ? C.red : C.green, fontSize:14, fontWeight:600 }}>{msg.text}</div>}

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
          {stats.map(([label, val]) => (
            <div key={label} style={{ background:C.section, borderRadius:10, padding:12, textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{val}</div>
              <div style={{ fontSize:12, color:C.muted }}>{label}</div>
            </div>
          ))}
        </div>

        {data.lastUpdated && (
          <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>Last saved: {fmtDate(data.lastUpdated)}</div>
        )}

        {/* Export */}
        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>Export</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12, lineHeight:1.5 }}>
            Downloads all your data as a JSON file. Paste it into <code style={{ color:C.icy }}>/src/data/defaultData.json</code> to hardcode it as seed data.
          </div>
          <button onClick={() => exportData(data)} style={{
            width:"100%", height:48, borderRadius:10, background:C.gold,
            color:C.bg, fontWeight:700, fontSize:15, border:"none", cursor:"pointer",
          }}>⬇️ Download JSON</button>
        </div>

        {/* Import */}
        <div style={{ background:C.section, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>Import</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12, lineHeight:1.5 }}>
            Upload a previously exported JSON file to restore or merge data.
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            {[["replace","Replace all"],["merge","Merge"]].map(([val,label]) => (
              <button key={val} onClick={()=>setMode(val)} style={{
                flex:1, height:40, borderRadius:10,
                border:`1px solid ${mode===val ? C.gold : C.border}`,
                background: mode===val ? C.gold+"22" : C.card,
                color: mode===val ? C.gold : C.muted, fontWeight:600, fontSize:14, cursor:"pointer",
              }}>{label}</button>
            ))}
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
            {mode === "replace" ? "⚠️ Replaces all current data." : "Merges players by ID — incoming wins on conflict."}
          </div>
          <input type="file" accept=".json" ref={fileRef} onChange={handleImport} style={{ display:"none" }} />
          <button onClick={()=>fileRef.current?.click()} style={{
            width:"100%", height:48, borderRadius:10, background:C.section,
            border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:15, cursor:"pointer",
          }}>⬆️ Choose JSON File</button>
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel ─────────────────────────────────────────────
function SettingsPanel({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings || {});
  function update(k,v) { setS(prev => ({...prev,[k]:v})); }
  return (
    <div style={{ position:"fixed", inset:0, background:"#000c", zIndex:300, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:C.card, borderRadius:"20px 20px 0 0", width:"100%", padding:"16px 20px 60px", maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:"0 auto 20px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>⚙️ Alliance Settings</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <Field label="Alliance Name"><Input value={s.allianceName} onChange={v=>update("allianceName",v)} placeholder="Your alliance name" /></Field>
        <Field label="Alliance Tag"><Input value={s.allianceTag} onChange={v=>update("allianceTag",v)} placeholder="[TAG]" /></Field>
        <Field label="State ID"><Input value={s.stateId} onChange={v=>update("stateId",v)} placeholder="e.g. 3543" inputMode="numeric" /></Field>
        <button onClick={()=>{onSave(s);onClose();vibe(8);}} style={{
          width:"100%", height:54, borderRadius:12, background:C.gold,
          color:C.bg, fontWeight:700, fontSize:17, border:"none", cursor:"pointer",
        }}>Save Settings</button>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(() => loadData());
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dataPanel, setDataPanel] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Auto-save on data change
  useEffect(() => {
    const saved = saveData(data);
    // keep lastUpdated in sync without infinite loop
  }, [data]);

  function showToast(msg, type="success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  function updateData(patch) {
    setData(prev => ({ ...prev, ...patch, lastUpdated: new Date().toISOString() }));
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

  function deletePlayer(id) {
    setData(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id), lastUpdated: new Date().toISOString() }));
    showToast("Player removed");
    setDeleteConfirm(null);
  }

  function handleImport(imported, mode) {
    if (mode === "merge") {
      setData(prev => mergeData(prev, imported));
    } else {
      setData(imported);
    }
    showToast(`Data imported (${mode})`);
    setDataPanel(false);
  }

  const players = data.players || [];
  const filteredPlayers = players.filter(p => {
    const name = (p.username || p.name || p.fid || "").toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || (p.fid||"").includes(search) || (p.stateId||"").includes(search);
    const matchRole = filterRole === "All" || p.roles?.includes(filterRole);
    return matchSearch && matchRole;
  });

  const TABS = [
    { icon:"👥", label:"Players" },
    { icon:"⚔️", label:"Teams" },
    { icon:"📊", label:"Stats" },
    { icon:"⚙️", label:"More" },
  ];

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.white, fontFamily:"system-ui,-apple-system,sans-serif", paddingBottom:80, maxWidth:480, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ padding:"20px 20px 14px", borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, background:C.bg, zIndex:50 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.white }}>🏰 {data.settings?.allianceName || "Alliance Manager"}</div>
            <div style={{ fontSize:13, color:C.muted }}>
              {data.settings?.allianceTag ? `[${data.settings.allianceTag}] · ` : ""}
              State {data.settings?.stateId || "3543"} · {players.length} players
            </div>
          </div>
          <button onClick={()=>setDataPanel(true)} style={{
            height:36, padding:"0 12px", borderRadius:20, background:C.section,
            border:`1px solid ${C.border}`, color:C.icy, fontSize:13, fontWeight:600, cursor:"pointer",
          }}>📦 Data</button>
        </div>
      </div>

      {/* ── PLAYERS TAB ── */}
      {tab === 0 && (
        <div style={{ padding:"16px 20px 0" }}>
          {/* Search + Add */}
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, FID, state…"
              style={{
                flex:1, height:48, background:C.section, border:`1px solid ${C.border}`,
                borderRadius:10, padding:"0 14px", fontSize:16, color:C.white, fontFamily:"inherit",
              }} />
            <button onClick={()=>{setEditingPlayer(null);setSheetOpen(true);}} style={{
              height:48, padding:"0 16px", borderRadius:10, background:C.gold,
              color:C.bg, fontWeight:700, fontSize:15, border:"none", cursor:"pointer",
            }}>＋ Add</button>
          </div>

          {/* Role filter */}
          <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:10, marginBottom:4 }}>
            {["All",...ROLES].map(r => (
              <button key={r} onClick={()=>setFilterRole(r)} style={{
                padding:"7px 14px", borderRadius:20, whiteSpace:"nowrap",
                background: filterRole===r ? C.gold+"22" : C.section,
                border:`1px solid ${filterRole===r ? C.gold : C.border}`,
                color: filterRole===r ? C.gold : C.muted,
                fontWeight:600, fontSize:13, cursor:"pointer", minHeight:36,
              }}>{r}</button>
            ))}
          </div>

          {/* Count */}
          {players.length > 0 && (
            <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>
              {filteredPlayers.length} of {players.length} player{players.length!==1?"s":""}
            </div>
          )}

          {/* Empty state */}
          {players.length === 0 && (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ fontSize:52, marginBottom:16 }}>👥</div>
              <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>No players yet</div>
              <div style={{ fontSize:15, color:C.muted, marginBottom:28 }}>Add players one by one, or import a JSON file</div>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={()=>{setEditingPlayer(null);setSheetOpen(true);}} style={{
                  height:52, padding:"0 24px", borderRadius:12, background:C.gold,
                  color:C.bg, fontWeight:700, fontSize:15, border:"none", cursor:"pointer",
                }}>＋ Add Player</button>
                <button onClick={()=>setDataPanel(true)} style={{
                  height:52, padding:"0 24px", borderRadius:12, background:C.section,
                  border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:15, cursor:"pointer",
                }}>⬆️ Import</button>
              </div>
            </div>
          )}

          {/* No results */}
          {players.length > 0 && filteredPlayers.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
              No results for "{search || filterRole}"
            </div>
          )}

          {/* Player list */}
          {filteredPlayers.map(p => (
            <PlayerCard key={p.id} player={p}
              onClick={()=>{setEditingPlayer(p);setSheetOpen(true);}}
              onDelete={(id)=>setDeleteConfirm(id)}
            />
          ))}
        </div>
      )}

      {/* ── TEAMS TAB ── */}
      {tab === 1 && (
        <div style={{ padding:"16px 20px" }}>
          {(() => {
            const avail = players.filter(p => p.availability?.present === "available");
            const unavail = players.filter(p => p.availability?.present === "unavailable");
            const byRole = ROLES.map(role => ({ role, members: avail.filter(p => p.roles?.includes(role)) })).filter(g => g.members.length > 0);
            return (
              <>
                <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
                  <div style={{ fontSize:13, color:C.icy, marginBottom:4 }}>Available for SvS</div>
                  <div style={{ fontSize:28, fontWeight:700, color:C.white }}>{avail.length} <span style={{ fontSize:16, color:C.muted }}>of {players.length}</span></div>
                </div>
                {byRole.map(({ role, members }) => (
                  <div key={role} style={{ marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:ROLE_COLORS[role], textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{role} · {members.length}</div>
                    {members.map(m => (
                      <div key={m.id} style={{ background:C.card, borderRadius:10, padding:"10px 14px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <div style={{ fontWeight:700, color:C.white, fontSize:15 }}>{m.username || m.name || `FID ${m.fid}`}</div>
                          <div style={{ fontSize:12, color:C.icy }}>
                            {[m.furnaceLevel && `FC${m.furnaceLevel}`, m.stateId && `S${m.stateId}`].filter(Boolean).join(" · ")}
                            {m.availability?.timing === "late" ? " · 🕐" : ""}
                            {m.availability?.discord === "yes" ? " · 🎙️" : ""}
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:4 }}>
                          {[m.troops?.infantry, m.troops?.lancer, m.troops?.marksman].map((t,i) => (
                            <span key={i} style={{ fontSize:11, padding:"2px 6px", borderRadius:6, background:[C.inf,C.lan,C.mar][i]+"22", color:[C.inf,C.lan,C.mar][i] }}>{t||"?"}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {players.length === 0 && <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>Add players in the Players tab first</div>}
              </>
            );
          })()}
        </div>
      )}

      {/* ── STATS TAB ── */}
      {tab === 2 && (
        <div style={{ padding:"16px 20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              ["👥","Total Players", players.length],
              ["👑","Rally Leads", players.filter(p=>p.roles?.includes("Rally Lead")).length],
              ["✅","Available", players.filter(p=>p.availability?.present==="available").length],
              ["⚔️","Skill 5 Heroes", players.filter(p=>p.heroes?.length>0).length],
              ["🎙️","On Discord", players.filter(p=>p.availability?.discord==="yes").length],
              ["🔍","Auto-fetched", players.filter(p=>p.lookupStatus==="fetched").length],
            ].map(([icon,label,val]) => (
              <div key={label} style={{ background:C.card, borderRadius:12, padding:16 }}>
                <div style={{ fontSize:22 }}>{icon}</div>
                <div style={{ fontSize:28, fontWeight:700, color:C.gold }}>{val}</div>
                <div style={{ fontSize:13, color:C.icy }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Countries */}
          {(() => {
            const counts = {};
            players.forEach(p => { if (p.country) counts[p.country] = (counts[p.country]||0)+1; });
            const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
            if (!sorted.length) return null;
            return (
              <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:12 }}>🌏 Countries</div>
                {sorted.map(([country, count]) => (
                  <div key={country} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontSize:14, color:C.icy }}>{country}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:80, height:6, borderRadius:3, background:C.border, overflow:"hidden" }}>
                        <div style={{ width:`${(count/players.length)*100}%`, height:"100%", background:C.gold, borderRadius:3 }} />
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.gold, width:20, textAlign:"right" }}>{count}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Top heroes */}
          {(() => {
            const counts = {};
            players.forEach(p => p.heroes?.forEach(h => { counts[h]=(counts[h]||0)+1; }));
            const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
            if (!top.length) return null;
            return (
              <div style={{ background:C.card, borderRadius:12, padding:16 }}>
                <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:12 }}>🏅 Top Heroes (Skill 5)</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {top.map(([hero, count]) => (
                    <div key={hero} style={{ padding:"8px 12px", borderRadius:20, background:C.gold+"18", border:`1px solid ${C.gold}33` }}>
                      <span style={{ color:C.gold, fontWeight:600, fontSize:13 }}>✓ {hero}</span>
                      <span style={{ color:C.muted, fontSize:12, marginLeft:6 }}>×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {players.length === 0 && <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>Add players to see stats</div>}
        </div>
      )}

      {/* ── MORE TAB ── */}
      {tab === 3 && (
        <div style={{ padding:"16px 20px" }}>
          {[
            { icon:"⚙️", label:"Alliance Settings", sub:"Name, tag, state ID", action:()=>setSettingsPanel(true) },
            { icon:"📦", label:"Export / Import Data", sub:"Download or restore your roster", action:()=>setDataPanel(true) },
          ].map(({ icon, label, sub, action }) => (
            <button key={label} onClick={action} style={{
              display:"flex", alignItems:"center", gap:14, width:"100%",
              background:C.card, borderRadius:12, padding:"16px 18px", marginBottom:10,
              border:`1px solid ${C.border}`, cursor:"pointer", textAlign:"left",
            }}>
              <span style={{ fontSize:24 }}>{icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:600, color:C.white }}>{label}</div>
                <div style={{ fontSize:13, color:C.muted }}>{sub}</div>
              </div>
              <span style={{ fontSize:20, color:C.muted }}>›</span>
            </button>
          ))}
          <div style={{ fontSize:12, color:C.muted, textAlign:"center", marginTop:24 }}>
            WOS Alliance Manager · State {data.settings?.stateId||"3543"}
            {data.lastUpdated && <><br />Last saved {fmtDate(data.lastUpdated)}</>}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position:"fixed", inset:0, background:"#000b", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.card, borderRadius:16, padding:24, width:"100%", maxWidth:320 }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:8 }}>Remove player?</div>
            <div style={{ fontSize:14, color:C.muted, marginBottom:20 }}>This can't be undone.</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setDeleteConfirm(null)} style={{ flex:1, height:48, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:"pointer" }}>Cancel</button>
              <button onClick={()=>deletePlayer(deleteConfirm)} style={{ flex:1, height:48, borderRadius:10, background:C.red, color:C.white, fontWeight:700, fontSize:15, border:"none", cursor:"pointer" }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <PlayerSheet open={sheetOpen} player={editingPlayer} onClose={()=>setSheetOpen(false)} onSave={savePlayer} />
      {dataPanel && <DataPanel data={data} onImport={handleImport} onClose={()=>setDataPanel(false)} />}
      {settingsPanel && <SettingsPanel settings={data.settings} onSave={s=>updateData({settings:s})} onClose={()=>setSettingsPanel(false)} />}

      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* Tab bar */}
      <div style={{
        position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:480,
        display:"grid", gridTemplateColumns:"repeat(4,1fr)",
        background:C.bg, borderTop:`1px solid ${C.border}`, height:60, zIndex:100,
      }}>
        {TABS.map((t,i) => (
          <button key={i} onClick={()=>{setTab(i);vibe(8);}} style={{
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            background:"none", border:"none", cursor:"pointer",
            color: tab===i ? C.gold : C.muted,
            gap:3, fontSize:10, fontWeight:600, transition:"color 150ms ease",
          }}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg: "#0A1628", card: "#1E3A52", section: "#152236",
  gold: "#F5A623", white: "#FFFFFF", icy: "#A8C4D8",
  muted: "#5A7A94", inf: "#6B8CAE", lan: "#7BAE8C",
  mar: "#B8859A", red: "#FF453A", green: "#30D158",
  border: "#2A4A64",
};

const TIER_OPTIONS = ["T10","FC1","FC2","FC3","FC4","FC5","T11","T12"];
const TIER_COLORS = { T10: C.muted, FC1: C.gold, FC2: C.gold, FC3: C.gold, FC4: C.gold, FC5: C.gold, T11: C.icy, T12: C.white };
const ROLES = ["Rally Lead","Attack Team","Joiner","Garrison","Flexible","Reserve"];
const ROLE_COLORS = { "Rally Lead": C.gold, "Attack Team": C.red, "Joiner": C.mar, "Garrison": C.inf, "Flexible": C.lan, "Reserve": C.muted };
const ROLE_ICONS = { "Rally Lead":"👑","Attack Team":"⚔️","Joiner":"🏹","Garrison":"🛡️","Flexible":"🔄","Reserve":"⏸️" };

const HEROES_BY_GEN = [
  { gen: "Gen 1", heroes: ["Jessie","Jasser","Jeronimo","Seo-Yoon","Patrick","Bahiti","Ling Xue","Lumak Bokan"] },
  { gen: "Gen 2", heroes: ["Philly","Alonso"] },
  { gen: "Gen 3", heroes: ["Mia","Logan","Greg"] },
  { gen: "Gen 4", heroes: ["Reina","Ahmose","Lynn"] },
  { gen: "Gen 5", heroes: ["Norah","Hector","Gwen"] },
  { gen: "Gen 6", heroes: ["Wu Ming","Renee","Wayne"] },
  { gen: "Gen 7", heroes: ["Edith","Gordon","Bradley"] },
  { gen: "Gen 8", heroes: ["Gatot","Sonya","Hendrik"] },
  { gen: "Gen 9", heroes: ["Magnus","Fred","Xura"] },
  { gen: "Gen 10", heroes: ["Gregory","Freya","Blanchette"] },
  { gen: "Gen 11", heroes: ["Eleonora","Lloyd","Rufus"] },
];
const ALL_HEROES = HEROES_BY_GEN.flatMap(g => g.heroes);

const TIMEZONES = ["UTC-12","UTC-11","UTC-10","UTC-9","UTC-8 (PST)","UTC-7 (MST)","UTC-6 (CST)","UTC-5 (EST)","UTC-4","UTC-3","UTC-2","UTC-1","UTC+0 (GMT)","UTC+1 (CET)","UTC+2 (EET)","UTC+3","UTC+4","UTC+5","UTC+5:30 (IST)","UTC+6","UTC+7 (ICT)","UTC+8 (CST/SGT)","UTC+9 (JST/KST)","UTC+10 (AEST)","UTC+11","UTC+12 (NZST)","UTC+13"];

function newMember(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    name: "", fcLevel: null, allianceTag: "", timezone: "",
    troops: { infantry: null, lancer: null, marksman: null },
    heroes: [], hasNoneChecked: false,
    roles: [],
    availability: { present: "available", timing: "unknown", lateBy: null, earlyBy: null, discord: "unknown" },
    teamAssignment: null, notes: "", createdAt: Date.now(),
    ...overrides,
  };
}

function vibe(pattern) { try { navigator.vibrate(pattern); } catch(e) {} }
function fmtNum(n) { return n == null ? "?" : Number(n).toLocaleString(); }
function initials(name) { return name.split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "?"; }

function useLocalStorage(key, def) {
  const [val, setVal] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } });
  const set = useCallback(v => { const next = typeof v === "function" ? v(val) : v; setVal(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch{} }, [key, val]);
  return [val, set];
}

// ── Pill ───────────────────────────────────────────────────────
function Pill({ label, color, bg, onClick, selected, style = {} }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, border: `1px solid ${selected ? color : C.border}`,
      background: selected ? (bg || color + "22") : C.section, color: selected ? color : C.muted,
      fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
      minHeight: 36, transition: "all 150ms ease", ...style,
    }}>{label}</button>
  );
}

// ── TierPillRow ────────────────────────────────────────────────
function TierPillRow({ label, color, value, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 13, color, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {TIER_OPTIONS.map(t => (
          <button key={t} onClick={() => onChange(value === t ? null : t)} style={{
            padding: "6px 12px", borderRadius: 16, border: `1px solid ${value === t ? color : C.border}`,
            background: value === t ? color + "22" : C.section, color: value === t ? color : C.muted,
            fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", minHeight: 36, flexShrink: 0,
          }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

// ── HeroGrid ───────────────────────────────────────────────────
function HeroGrid({ selected, onChange, hasNone, onHasNone }) {
  return (
    <div>
      <button onClick={() => onHasNone(!hasNone)} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", width: "100%",
        background: hasNone ? C.red + "18" : C.section, border: `1px solid ${hasNone ? C.red : C.border}`,
        borderRadius: 10, color: hasNone ? C.red : C.muted, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 14,
      }}>
        <span>{hasNone ? "✓" : "○"}</span> Has none of these heroes
      </button>
      {HEROES_BY_GEN.map(({ gen, heroes }) => (
        <div key={gen}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, marginTop: 12 }}>{gen}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {heroes.map(h => {
              const owned = !hasNone && selected.includes(h);
              return (
                <button key={h} disabled={hasNone} onClick={() => {
                  if (hasNone) return;
                  onChange(owned ? selected.filter(x => x !== h) : [...selected, h]);
                }} style={{
                  padding: "8px 14px", borderRadius: 20, border: `1px solid ${owned ? C.gold : C.border}`,
                  background: owned ? C.gold + "22" : C.section, color: owned ? C.gold : C.muted,
                  fontWeight: 600, fontSize: 14, cursor: hasNone ? "default" : "pointer", minHeight: 40,
                  opacity: hasNone ? 0.4 : 1, transition: "all 150ms ease",
                }}>{owned ? "✓ " : ""}{h}</button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AvailChip ──────────────────────────────────────────────────
function AvailChip({ name, selected, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 20, minHeight: 44,
      border: `1px solid ${selected ? color : C.border}`,
      background: selected ? color + "18" : C.section,
      color: selected ? color : C.icy, fontWeight: 600, fontSize: 14,
      cursor: "pointer", transition: "all 150ms ease",
    }}>{name}</button>
  );
}

// ── BatchAddSheet ──────────────────────────────────────────────
function BatchAddSheet({ open, onClose, members, onAdd }) {
  const [phase, setPhase] = useState(0);
  const [rawNames, setRawNames] = useState("");
  const [fcAll, setFcAll] = useState("");
  const [tagAll, setTagAll] = useState("");
  const [tzAll, setTzAll] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  // availability
  const [voiceSet, setVoiceSet] = useState(new Set());
  const [lateSet, setLateSet] = useState(new Set());
  const [lateBy, setLateBy] = useState("unknown");
  const [earlySet, setEarlySet] = useState(new Set());
  const [earlyBy, setEarlyBy] = useState("unknown");
  const [unavailSet, setUnavailSet] = useState(new Set());

  // troop tiers
  const [groupTierSel, setGroupTierSel] = useState(new Set());
  const [groupTroops, setGroupTroops] = useState({ infantry: null, lancer: null, marksman: null });
  const [memberTroops, setMemberTroops] = useState({});
  const [tierIdx, setTierIdx] = useState(0);

  // heroes
  const [groupHeroSel, setGroupHeroSel] = useState(new Set());
  const [groupHeroes, setGroupHeroes] = useState([]);
  const [memberHeroes, setMemberHeroes] = useState({});
  const [memberHasNone, setMemberHasNone] = useState({});
  const [heroIdx, setHeroIdx] = useState(0);

  const parsedNames = rawNames.split(/[\n,]/).map(n => n.trim()).filter(Boolean);
  const existingNames = new Set(members.map(m => m.name.toLowerCase()));
  const newNames = parsedNames.filter(n => !existingNames.has(n.toLowerCase()));
  const dupNames = parsedNames.filter(n => existingNames.has(n.toLowerCase()));

  // tier stack = names not covered by group shortcut
  const tierStack = newNames.filter(n => !groupTierSel.has(n));
  const heroStack = newNames.filter(n => !groupHeroSel.has(n));

  function resetAll() {
    setPhase(0); setRawNames(""); setFcAll(""); setTagAll(""); setTzAll("");
    setShowOptional(false); setVoiceSet(new Set()); setLateSet(new Set());
    setLateBy("unknown"); setEarlySet(new Set()); setEarlyBy("unknown");
    setUnavailSet(new Set()); setGroupTierSel(new Set());
    setGroupTroops({ infantry: null, lancer: null, marksman: null });
    setMemberTroops({}); setTierIdx(0); setGroupHeroSel(new Set());
    setGroupHeroes([]); setMemberHeroes({}); setMemberHasNone({});
    setHeroIdx(0);
  }

  function handleClose() { resetAll(); onClose(); }

  function buildAndAdd() {
    const built = newNames.map(name => {
      const troops = groupTierSel.has(name) ? { ...groupTroops } : (memberTroops[name] || { infantry: null, lancer: null, marksman: null });
      const heroes = groupHeroSel.has(name) ? [...groupHeroes] : (memberHeroes[name] || []);
      const hasNone = memberHasNone[name] || false;
      return newMember({
        name,
        fcLevel: fcAll ? parseInt(fcAll) : null,
        allianceTag: tagAll,
        timezone: tzAll,
        troops,
        heroes: hasNone ? [] : heroes,
        hasNoneChecked: hasNone,
        availability: {
          present: unavailSet.has(name) ? "unavailable" : "available",
          timing: lateSet.has(name) ? "late" : earlySet.has(name) ? "early" : "unknown",
          lateBy: lateSet.has(name) ? lateBy : null,
          earlyBy: earlySet.has(name) ? earlyBy : null,
          discord: voiceSet.has(name) ? "yes" : "unknown",
        },
      });
    });
    onAdd(built);
    vibe([10, 50, 10]);
    handleClose();
  }

  function toggleSet(set, setFn, name) {
    const next = new Set(set);
    next.has(name) ? next.delete(name) : next.add(name);
    setFn(next);
  }

  const PHASES = ["Names","Availability","Troop Tiers","Heroes"];

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{
        background: C.card, borderRadius: "20px 20px 0 0", width: "100%",
        maxHeight: "92vh", overflowY: "auto", padding: "16px 20px 80px",
      }}>
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 16px" }} />

        {/* Phase indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
          {PHASES.map((p, i) => (
            <div key={p} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: i < phase ? C.green : i === phase ? C.gold : C.border,
                  color: i <= phase ? C.bg : C.muted, fontWeight: 700, fontSize: 13,
                }}>{i < phase ? "✓" : i + 1}</div>
                <div style={{ fontSize: 10, color: i === phase ? C.gold : C.muted, marginTop: 4, textAlign: "center" }}>{p}</div>
              </div>
              {i < PHASES.length - 1 && <div style={{ height: 2, flex: 0.5, background: i < phase ? C.green : C.border, marginBottom: 16 }} />}
            </div>
          ))}
        </div>

        {/* ── PHASE 0: NAMES ── */}
        {phase === 0 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6 }}>Who's joining?</div>
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 16, lineHeight: 1.5 }}>Type or paste names — one per line or comma-separated</div>
            <textarea value={rawNames} onChange={e => setRawNames(e.target.value)}
              placeholder={"e.g. Marcus, Caroline\nZhang Wei\nKira_R3K"}
              style={{
                width: "100%", minHeight: 140, background: C.section, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: 14, fontSize: 18, color: C.white, lineHeight: 1.8,
                resize: "none", boxSizing: "border-box", fontFamily: "inherit",
              }} />

            {/* Live chip preview */}
            {parsedNames.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
                {parsedNames.map((n, i) => {
                  const dup = existingNames.has(n.toLowerCase());
                  return (
                    <span key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: dup ? C.red + "18" : C.section,
                      border: `1px solid ${dup ? C.red : C.border}`,
                      borderRadius: 20, padding: "6px 12px", fontSize: 14,
                      color: dup ? C.red : C.white,
                    }}>{n}{dup && <span style={{ fontSize: 11 }}>· exists</span>}</span>
                  );
                })}
              </div>
            )}

            {/* Count */}
            {parsedNames.length > 0 && (
              <div style={{ fontSize: 14, color: C.icy, marginBottom: 16 }}>
                {newNames.length} new member{newNames.length !== 1 ? "s" : ""}
                {dupNames.length > 0 && <span style={{ color: C.red }}> · {dupNames.length} duplicate{dupNames.length !== 1 ? "s" : ""} skipped</span>}
              </div>
            )}

            {/* Optional fields */}
            <button onClick={() => setShowOptional(!showOptional)} style={{
              background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", padding: "4px 0", marginBottom: 12,
            }}>{showOptional ? "▾" : "▸"} Set for all members (optional)</button>

            {showOptional && (
              <div style={{ background: C.section, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: C.icy, display: "block", marginBottom: 6 }}>FC Level</label>
                  <input type="number" inputMode="numeric" value={fcAll} onChange={e => setFcAll(e.target.value)}
                    placeholder="e.g. 28" style={{
                      width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                      padding: "12px 14px", fontSize: 18, color: C.white, boxSizing: "border-box",
                    }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: C.icy, display: "block", marginBottom: 6 }}>Alliance Tag</label>
                  <input type="text" value={tagAll} onChange={e => setTagAll(e.target.value)}
                    placeholder="[R3K]" style={{
                      width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                      padding: "12px 14px", fontSize: 18, color: C.white, boxSizing: "border-box",
                    }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: C.icy, display: "block", marginBottom: 6 }}>Timezone</label>
                  <select value={tzAll} onChange={e => setTzAll(e.target.value)} style={{
                    width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "12px 14px", fontSize: 16, color: tzAll ? C.white : C.muted, boxSizing: "border-box",
                  }}>
                    <option value="">Select timezone…</option>
                    {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}

            <button disabled={newNames.length === 0} onClick={() => setPhase(1)} style={{
              width: "100%", height: 54, borderRadius: 12, background: newNames.length > 0 ? C.gold : C.border,
              color: C.bg, fontWeight: 700, fontSize: 17, border: "none", cursor: newNames.length > 0 ? "pointer" : "default",
              transition: "background 200ms",
            }}>Continue with {newNames.length} member{newNames.length !== 1 ? "s" : ""} →</button>
          </div>
        )}

        {/* ── PHASE 1: AVAILABILITY ── */}
        {phase === 1 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6 }}>Before the battle</div>
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 24, lineHeight: 1.5 }}>Tap members to set their status. You can update this later.</div>

            {/* Q1: Discord */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>🎙️ Who's on Discord voice?</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => setVoiceSet(new Set(newNames))} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Select all</button>
                <span style={{ color: C.muted }}>·</span>
                <button onClick={() => setVoiceSet(new Set())} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {newNames.map(n => <AvailChip key={n} name={n} selected={voiceSet.has(n)} color={C.gold} onClick={() => { toggleSet(voiceSet, setVoiceSet, n); vibe(8); }} />)}
              </div>
            </div>

            {/* Q2: Late */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>🕐 Who's arriving late?</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => setLateSet(new Set(newNames))} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Select all</button>
                <span style={{ color: C.muted }}>·</span>
                <button onClick={() => setLateSet(new Set())} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {newNames.map(n => <AvailChip key={n} name={n} selected={lateSet.has(n)} color={C.icy} onClick={() => { toggleSet(lateSet, setLateSet, n); vibe(8); }} />)}
              </div>
              {lateSet.size > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: C.icy, marginBottom: 8 }}>How late?</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["15 min","30 min","1 hr","Unknown"].map(opt => (
                      <Pill key={opt} label={opt} color={C.icy} selected={lateBy === opt.toLowerCase().replace(" ","")} onClick={() => setLateBy(opt.toLowerCase().replace(" ",""))} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Q3: Early */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>🚪 Who's leaving early?</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => setEarlySet(new Set(newNames))} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Select all</button>
                <span style={{ color: C.muted }}>·</span>
                <button onClick={() => setEarlySet(new Set())} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {newNames.map(n => <AvailChip key={n} name={n} selected={earlySet.has(n)} color={C.mar} onClick={() => { toggleSet(earlySet, setEarlySet, n); vibe(8); }} />)}
              </div>
              {earlySet.size > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: C.icy, marginBottom: 8 }}>How early?</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["30 min","1 hr","Unknown"].map(opt => (
                      <Pill key={opt} label={opt} color={C.mar} selected={earlyBy === opt.toLowerCase().replace(" ","")} onClick={() => setEarlyBy(opt.toLowerCase().replace(" ",""))} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Q4: Unavailable */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>❌ Who won't make it?</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => setUnavailSet(new Set(newNames))} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Select all</button>
                <span style={{ color: C.muted }}>·</span>
                <button onClick={() => setUnavailSet(new Set())} style={{ fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {newNames.map(n => <AvailChip key={n} name={n} selected={unavailSet.has(n)} color={C.red} onClick={() => { toggleSet(unavailSet, setUnavailSet, n); vibe(8); }} />)}
              </div>
            </div>

            <button onClick={() => { vibe(8); setPhase(2); }} style={{
              width: "100%", height: 54, borderRadius: 12, background: C.gold,
              color: C.bg, fontWeight: 700, fontSize: 17, border: "none", cursor: "pointer", marginBottom: 12,
            }}>Continue →</button>
            <button onClick={() => { vibe(8); setPhase(2); }} style={{
              display: "block", margin: "0 auto", background: "none", border: "none",
              color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0",
            }}>I'll update availability during SvS →</button>
          </div>
        )}

        {/* ── PHASE 2: TROOP TIERS ── */}
        {phase === 2 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6 }}>Troop tiers</div>
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 20, lineHeight: 1.5 }}>Set the highest tier each member has unlocked.</div>

            {/* Group shortcut */}
            <div style={{ background: C.section, borderRadius: 12, borderLeft: `3px solid ${C.gold}`, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 4 }}>⚡ Does a group share the same tiers?</div>
              <div style={{ fontSize: 13, color: C.icy, marginBottom: 14 }}>Select members, set once, save time.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {newNames.map(n => (
                  <button key={n} onClick={() => { toggleSet(groupTierSel, setGroupTierSel, n); vibe(8); }} style={{
                    padding: "8px 14px", borderRadius: 20, minHeight: 40,
                    border: `1px solid ${groupTierSel.has(n) ? C.gold : C.border}`,
                    background: groupTierSel.has(n) ? C.gold + "22" : C.card,
                    color: groupTierSel.has(n) ? C.gold : C.icy, fontWeight: 600, fontSize: 14, cursor: "pointer",
                  }}>{n}</button>
                ))}
              </div>
              <TierPillRow label="🛡️ Infantry" color={C.inf} value={groupTroops.infantry} onChange={v => setGroupTroops(t => ({ ...t, infantry: v }))} />
              <TierPillRow label="⚔️ Lancer" color={C.lan} value={groupTroops.lancer} onChange={v => setGroupTroops(t => ({ ...t, lancer: v }))} />
              <TierPillRow label="🏹 Marksman" color={C.mar} value={groupTroops.marksman} onChange={v => setGroupTroops(t => ({ ...t, marksman: v }))} />
              {groupTierSel.size > 0 && (
                <div style={{ fontSize: 13, color: C.green, marginTop: 8 }}>
                  ✓ Will apply to {groupTierSel.size} member{groupTierSel.size !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {/* Individual stack */}
            {tierStack.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: C.icy, marginBottom: 12 }}>
                  {tierStack.length} remaining — swipe through individually
                </div>
                {(() => {
                  const cur = tierStack[tierIdx];
                  const mt = memberTroops[cur] || { infantry: null, lancer: null, marksman: null };
                  function setMT(key, val) {
                    setMemberTroops(prev => ({ ...prev, [cur]: { ...(prev[cur] || { infantry: null, lancer: null, marksman: null }), [key]: val } }));
                  }
                  return (
                    <div style={{ background: C.section, borderRadius: 14, padding: 18, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>{cur}</div>
                          {fcAll && <div style={{ fontSize: 13, color: C.icy }}>FC{fcAll}{tagAll ? ` · [${tagAll}]` : ""}</div>}
                        </div>
                        <div style={{ fontSize: 13, color: C.muted }}>{tierIdx + 1} / {tierStack.length}</div>
                      </div>
                      <TierPillRow label="🛡️ Infantry" color={C.inf} value={mt.infantry} onChange={v => setMT("infantry", v)} />
                      <TierPillRow label="⚔️ Lancer" color={C.lan} value={mt.lancer} onChange={v => setMT("lancer", v)} />
                      <TierPillRow label="🏹 Marksman" color={C.mar} value={mt.marksman} onChange={v => setMT("marksman", v)} />
                      {mt.infantry && (
                        <button onClick={() => { setMT("lancer", mt.infantry); setMT("marksman", mt.infantry); vibe(8); }} style={{
                          fontSize: 13, color: C.gold, background: "none", border: "none", cursor: "pointer", padding: "4px 0",
                        }}>↳ Same for all three</button>
                      )}
                      {/* Stack dots */}
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }}>
                        {tierStack.map((_, i) => (
                          <button key={i} onClick={() => setTierIdx(i)} style={{
                            width: i === tierIdx ? 20 : 8, height: 8, borderRadius: 4,
                            background: i < tierIdx ? C.green : i === tierIdx ? C.gold : C.border,
                            border: "none", cursor: "pointer", padding: 0, transition: "all 200ms",
                          }} />
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  {tierIdx > 0 && (
                    <button onClick={() => setTierIdx(i => i - 1)} style={{
                      flex: 1, height: 48, borderRadius: 12, background: C.section,
                      color: C.icy, fontWeight: 600, fontSize: 15, border: `1px solid ${C.border}`, cursor: "pointer",
                    }}>← Back</button>
                  )}
                  {tierIdx < tierStack.length - 1 ? (
                    <button onClick={() => { setTierIdx(i => i + 1); vibe(8); }} style={{
                      flex: 2, height: 48, borderRadius: 12, background: C.gold,
                      color: C.bg, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
                    }}>Next →</button>
                  ) : null}
                </div>
              </div>
            )}

            <button onClick={() => { vibe(8); setPhase(3); setHeroIdx(0); }} style={{
              width: "100%", height: 54, borderRadius: 12, background: C.gold,
              color: C.bg, fontWeight: 700, fontSize: 17, border: "none", cursor: "pointer", marginBottom: 12,
            }}>Continue →</button>
            <button onClick={() => { vibe(8); setPhase(3); }} style={{
              display: "block", margin: "0 auto", background: "none", border: "none",
              color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0",
            }}>I'll add tiers later →</button>
          </div>
        )}

        {/* ── PHASE 3: HEROES ── */}
        {phase === 3 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6 }}>Joiner heroes at Skill 5</div>
            <div style={{ fontSize: 13, color: C.icy, marginBottom: 20, lineHeight: 1.5 }}>Only heroes at Skill 5 count. Tap to mark owned.</div>

            {/* Group shortcut */}
            <div style={{ background: C.section, borderRadius: 12, borderLeft: `3px solid ${C.gold}`, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 4 }}>⚡ Does a group share the same heroes?</div>
              <div style={{ fontSize: 13, color: C.icy, marginBottom: 14 }}>Select members and heroes together.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {newNames.map(n => (
                  <button key={n} onClick={() => { toggleSet(groupHeroSel, setGroupHeroSel, n); vibe(8); }} style={{
                    padding: "8px 14px", borderRadius: 20, minHeight: 40,
                    border: `1px solid ${groupHeroSel.has(n) ? C.gold : C.border}`,
                    background: groupHeroSel.has(n) ? C.gold + "22" : C.card,
                    color: groupHeroSel.has(n) ? C.gold : C.icy, fontWeight: 600, fontSize: 14, cursor: "pointer",
                  }}>{n}</button>
                ))}
              </div>
              <HeroGrid selected={groupHeroes} onChange={setGroupHeroes} hasNone={false} onHasNone={() => {}} />
              {groupHeroSel.size > 0 && (
                <div style={{ fontSize: 13, color: C.green, marginTop: 8 }}>
                  ✓ Will apply to {groupHeroSel.size} member{groupHeroSel.size !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {/* Individual stack */}
            {heroStack.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: C.icy, marginBottom: 12 }}>
                  {heroStack.length} remaining — set heroes individually
                </div>
                {(() => {
                  const cur = heroStack[heroIdx];
                  const curHeroes = memberHeroes[cur] || [];
                  const curNone = memberHasNone[cur] || false;
                  return (
                    <div style={{ background: C.section, borderRadius: 14, padding: 18, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>{cur}</div>
                        <div style={{ fontSize: 13, color: C.muted }}>{heroIdx + 1} / {heroStack.length}</div>
                      </div>
                      <HeroGrid
                        selected={curHeroes}
                        onChange={h => setMemberHeroes(prev => ({ ...prev, [cur]: h }))}
                        hasNone={curNone}
                        onHasNone={v => setMemberHasNone(prev => ({ ...prev, [cur]: v }))}
                      />
                      {/* Stack dots */}
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
                        {heroStack.map((_, i) => (
                          <button key={i} onClick={() => setHeroIdx(i)} style={{
                            width: i === heroIdx ? 20 : 8, height: 8, borderRadius: 4,
                            background: i < heroIdx ? C.green : i === heroIdx ? C.gold : C.border,
                            border: "none", cursor: "pointer", padding: 0, transition: "all 200ms",
                          }} />
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  {heroIdx > 0 && (
                    <button onClick={() => setHeroIdx(i => i - 1)} style={{
                      flex: 1, height: 48, borderRadius: 12, background: C.section,
                      color: C.icy, fontWeight: 600, fontSize: 15, border: `1px solid ${C.border}`, cursor: "pointer",
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
            )}

            <button onClick={buildAndAdd} style={{
              width: "100%", height: 54, borderRadius: 12, background: C.gold,
              color: C.bg, fontWeight: 700, fontSize: 17, border: "none", cursor: "pointer", marginBottom: 12,
            }}>Finish & Add {newNames.length} Member{newNames.length !== 1 ? "s" : ""}</button>
            <button onClick={() => { vibe(8); setPhase(3); }} style={{
              display: "block", margin: "0 auto", background: "none", border: "none",
              color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0",
            }}>I'll add heroes later →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MemberCard ─────────────────────────────────────────────────
function MemberCard({ member, onEdit, onDelete }) {
  const { name, fcLevel, allianceTag, troops, heroes, roles, availability } = member;
  const primaryRole = roles[0];
  const roleColor = primaryRole ? ROLE_COLORS[primaryRole] : C.muted;
  const hasUnknownTiers = !troops.infantry && !troops.lancer && !troops.marksman;

  function glyphs() {
    const g = [];
    if (availability.discord === "yes") g.push("🎙️");
    if (availability.timing === "late") g.push("🕐");
    if (availability.timing === "early") g.push("🚪");
    if (availability.present === "unavailable") g.push("❌");
    return g;
  }

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: "14px 16px", marginBottom: 10,
      display: "flex", alignItems: "center", gap: 14, position: "relative",
    }}>
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: "50%", background: roleColor + "44",
        border: `2px solid ${roleColor}`, display: "flex", alignItems: "center",
        justifyContent: "center", fontWeight: 700, fontSize: 16, color: C.white, flexShrink: 0,
      }}>{initials(name)}</div>

      {/* Middle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          {glyphs().map((g, i) => <span key={i} style={{ fontSize: 14 }}>{g}</span>)}
        </div>
        <div style={{ fontSize: 13, color: C.icy, marginBottom: 6 }}>
          {fcLevel ? `FC${fcLevel}` : "FC?"}
          {allianceTag ? ` · [${allianceTag}]` : ""}
        </div>

        {/* Troop tier pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {[["🛡️", troops.infantry, C.inf], ["⚔️", troops.lancer, C.lan], ["🏹", troops.marksman, C.mar]].map(([icon, tier, color], i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
              background: (tier ? color : C.muted) + "22",
              border: `1px solid ${(tier ? color : C.muted) + "44"}`,
              color: tier ? color : C.muted,
            }}>{icon} {tier || "?"}</span>
          ))}
        </div>

        {/* Heroes */}
        {heroes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {heroes.slice(0, 4).map(h => (
              <span key={h} style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                background: C.gold + "18", border: `1px solid ${C.gold}44`, color: C.gold,
              }}>✓ {h}</span>
            ))}
            {heroes.length > 4 && <span style={{ fontSize: 11, color: C.muted }}>+{heroes.length - 4}</span>}
          </div>
        )}
        {member.hasNoneChecked && (
          <span style={{ fontSize: 11, color: C.muted }}>No Skill 5 heroes</span>
        )}
      </div>

      {/* Chevron */}
      <button onClick={() => onEdit(member)} style={{
        background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", padding: "8px 4px",
      }}>›</button>
    </div>
  );
}

// ── RosterTab ──────────────────────────────────────────────────
function RosterTab({ members, onBatchAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const FILTERS = ["All", ...ROLES, "Unavailable"];

  const filtered = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "All" ? true
      : filter === "Unavailable" ? m.availability.present === "unavailable"
      : m.roles.includes(filter);
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ padding: "0 20px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search members…" style={{
            flex: 1, height: 48, background: C.section, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "0 14px", fontSize: 16, color: C.white,
          }} />
        <button onClick={onBatchAdd} style={{
          height: 48, padding: "0 14px", borderRadius: 10,
          background: "none", border: `1px solid ${C.gold}`, color: C.gold,
          fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
        }}>⚡ Batch</button>
        <button style={{
          height: 48, padding: "0 14px", borderRadius: 10,
          background: C.gold, color: C.bg, fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}>＋ Add</button>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 4 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "8px 14px", borderRadius: 20, whiteSpace: "nowrap",
            background: filter === f ? C.gold + "22" : C.section,
            border: `1px solid ${filter === f ? C.gold : C.border}`,
            color: filter === f ? C.gold : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer",
            minHeight: 36,
          }}>{f}</button>
        ))}
      </div>

      {/* Member count */}
      {members.length > 0 && (
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
          {filtered.length} of {members.length} member{members.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Empty state */}
      {members.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 8 }}>No members yet</div>
          <div style={{ fontSize: 15, color: C.muted, marginBottom: 28 }}>Tap Batch Add to get your whole alliance in fast</div>
          <button onClick={onBatchAdd} style={{
            height: 52, padding: "0 28px", borderRadius: 12, background: C.gold,
            color: C.bg, fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer",
          }}>⚡ Batch Add</button>
        </div>
      )}

      {/* No results */}
      {members.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, color: C.muted }}>No results for "{search || filter}"</div>
        </div>
      )}

      {/* Cards */}
      {filtered.map(m => (
        <MemberCard key={m.id} member={m} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ── TeamsTab ───────────────────────────────────────────────────
function TeamsTab({ members }) {
  const available = members.filter(m => m.availability.present === "available");
  const unavailable = members.filter(m => m.availability.present === "unavailable");

  return (
    <div style={{ padding: "0 20px" }}>
      <div style={{ background: C.section, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.icy, marginBottom: 4 }}>Available for SvS</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.white }}>{available.length} <span style={{ fontSize: 16, color: C.muted }}>of {members.length}</span></div>
      </div>

      {members.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
          Add members in the Roster tab first
        </div>
      ) : (
        <>
          {available.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.icy, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Available</div>
              {available.map(m => (
                <div key={m.id} style={{
                  background: C.card, borderRadius: 10, padding: "12px 14px", marginBottom: 8,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.white, fontSize: 16 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: C.icy }}>
                      {m.roles.join(", ") || "No role set"}
                      {m.availability.timing === "late" ? " · 🕐 Late" : ""}
                      {m.availability.timing === "early" ? " · 🚪 Early" : ""}
                      {m.availability.discord === "yes" ? " · 🎙️" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[m.troops.infantry, m.troops.lancer, m.troops.marksman].map((t, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: "2px 6px", borderRadius: 6,
                        background: ([C.inf, C.lan, C.mar][i]) + "22",
                        color: [C.inf, C.lan, C.mar][i],
                        border: `1px solid ${[C.inf, C.lan, C.mar][i]}44`,
                      }}>{t || "?"}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {unavailable.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Unavailable</div>
              {unavailable.map(m => (
                <div key={m.id} style={{
                  background: C.section, borderRadius: 10, padding: "12px 14px", marginBottom: 8, opacity: 0.6,
                }}>
                  <div style={{ fontWeight: 600, color: C.muted, fontSize: 15 }}>{m.name}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── StatsTab ───────────────────────────────────────────────────
function StatsTab({ members }) {
  const total = members.length;
  const avail = members.filter(m => m.availability.present === "available").length;
  const leads = members.filter(m => m.roles.includes("Rally Lead")).length;
  const skill5 = members.filter(m => m.heroes.length > 0).length;
  const onDiscord = members.filter(m => m.availability.discord === "yes").length;

  const tierCounts = { T10: 0, FC1: 0, FC2: 0, FC3: 0, FC4: 0, FC5: 0, T11: 0, T12: 0 };
  members.forEach(m => {
    ["infantry","lancer","marksman"].forEach(k => {
      if (m.troops[k]) tierCounts[m.troops[k]] = (tierCounts[m.troops[k]] || 0) + 1;
    });
  });

  const heroCounts = {};
  members.forEach(m => m.heroes.forEach(h => { heroCounts[h] = (heroCounts[h] || 0) + 1; }));
  const topHeroes = Object.entries(heroCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);

  return (
    <div style={{ padding: "0 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          ["👥", "Total Members", total],
          ["👑", "Rally Leads", leads],
          ["⚔️", "Skill 5 Heroes", skill5],
          ["✅", "Available", avail],
        ].map(([icon, label, val]) => (
          <div key={label} style={{ background: C.card, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24 }}>{icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.gold }}>{val}</div>
            <div style={{ fontSize: 13, color: C.icy }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 12 }}>Availability</div>
        {[
          ["Available", avail, C.green],
          ["On Discord 🎙️", onDiscord, C.gold],
          ["Arriving Late 🕐", members.filter(m => m.availability.timing === "late").length, C.icy],
          ["Leaving Early 🚪", members.filter(m => m.availability.timing === "early").length, C.mar],
          ["Unavailable ❌", total - avail, C.red],
        ].map(([label, count, color]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 14, color: C.icy }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{count}</div>
          </div>
        ))}
      </div>

      {topHeroes.length > 0 && (
        <div style={{ background: C.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 12 }}>Top Heroes at Skill 5</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {topHeroes.map(([hero, count]) => (
              <div key={hero} style={{
                padding: "8px 14px", borderRadius: 20, background: C.gold + "18",
                border: `1px solid ${C.gold}44`,
              }}>
                <span style={{ color: C.gold, fontWeight: 600, fontSize: 14 }}>✓ {hero}</span>
                <span style={{ color: C.muted, fontSize: 12, marginLeft: 6 }}>×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
          Add members to see stats
        </div>
      )}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const [members, setMembers] = useLocalStorage("svs_members", []);
  const [tab, setTab] = useState(0);
  const [batchOpen, setBatchOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [stateTag, setStateTag] = useLocalStorage("svs_state", "State 3543");
  const [editingState, setEditingState] = useState(false);

  function addMembers(newMems) {
    setMembers(prev => [...prev, ...newMems]);
    setToast(`✓ ${newMems.length} member${newMems.length !== 1 ? "s" : ""} added`);
    setTimeout(() => setToast(null), 2500);
  }

  function deleteMember(id) {
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  const TABS = [
    { icon: "👥", label: "Roster" },
    { icon: "⚔️", label: "Teams" },
    { icon: "📋", label: "Plan" },
    { icon: "📊", label: "Stats" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.white, fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 80, maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 4 }}>🏰 Sunfire Castle Rally Planner</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: C.muted }}>Sunfire Castle · Alliance Leader Tool ·</span>
          {editingState ? (
            <input autoFocus value={stateTag} onChange={e => setStateTag(e.target.value)}
              onBlur={() => setEditingState(false)}
              onKeyDown={e => e.key === "Enter" && setEditingState(false)}
              style={{
                background: C.gold + "22", border: `1px solid ${C.gold}`, borderRadius: 20,
                padding: "2px 10px", fontSize: 12, color: C.gold, fontWeight: 600, width: 100,
              }} />
          ) : (
            <button onClick={() => setEditingState(true)} style={{
              background: C.gold + "22", border: `1px solid ${C.gold}44`, borderRadius: 20,
              padding: "2px 10px", fontSize: 12, color: C.gold, fontWeight: 600, cursor: "pointer",
            }}>{stateTag}</button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ paddingTop: 16 }}>
        {tab === 0 && <RosterTab members={members} onBatchAdd={() => setBatchOpen(true)} onEdit={() => {}} onDelete={deleteMember} />}
        {tab === 1 && <TeamsTab members={members} />}
        {tab === 2 && (
          <div style={{ padding: "0 20px", textAlign: "center", color: C.muted, paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            Plan tab — coming in next iteration
          </div>
        )}
        {tab === 3 && <StatsTab members={members} />}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: C.card + "ee", backdropFilter: "blur(12px)",
          border: `1px solid ${C.green}44`, borderRadius: 20,
          padding: "10px 20px", fontSize: 15, fontWeight: 600, color: C.green,
          zIndex: 400, whiteSpace: "nowrap",
        }}>{toast}</div>
      )}

      {/* Batch Add Sheet */}
      <BatchAddSheet
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        members={members}
        onAdd={addMembers}
      />

      {/* Tab bar */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        background: C.bg, borderTop: `1px solid ${C.border}`, height: 60, zIndex: 100,
      }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => { setTab(i); vibe(8); }} style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", cursor: "pointer",
            color: tab === i ? C.gold : C.muted, gap: 3, fontSize: 10, fontWeight: 600,
            transition: "color 150ms ease",
          }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

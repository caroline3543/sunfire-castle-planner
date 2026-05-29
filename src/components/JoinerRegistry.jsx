import { useState } from "react";
import { JOINER_HEROES, JOINER_META, detectStacking, buildCoverageReport, getMetaSuggestion } from "../data/joinerMeta.js";
import { normalizeName } from "../data/dataManager.js";

const C = {
  bg:"#0A1628",card:"#1E3A52",section:"#152236",
  gold:"#F5A623",white:"#FFFFFF",icy:"#A8C4D8",
  muted:"#5A7A94",red:"#FF453A",green:"#30D158",border:"#2A4A64",
};

function initials(n) { return (n||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase()||"?"; }
function fmtDate(iso) { if(!iso)return""; try{return new Date(iso).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}catch{return iso;} }

// ── Player picker inline ───────────────────────────────────────
function MiniPlayerPicker({ players, onSelect, placeholder = "Search players…" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = q.trim()
    ? players.filter(p => {
        const query = normalizeName(q);
        return [p.username, p.alias, p.fid, p.allianceTag]
          .map(f => normalizeName(f||""))
          .some(f => f.includes(query));
      }).slice(0, 8)
    : [];

  return (
    <div style={{ position:"relative" }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{ width:"100%", background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", fontSize:15, color:C.white, boxSizing:"border-box", fontFamily:"inherit" }}
      />
      {open && results.length > 0 && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", zIndex:700, boxShadow:"0 8px 24px #000a" }}>
          {results.map(p => (
            <button key={p.id} onClick={() => { onSelect(p); setQ(""); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 14px", background:"none", border:"none", borderBottom:`1px solid ${C.border}22`, cursor:"pointer", textAlign:"left" }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:C.section, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12, color:C.white, flexShrink:0 }}>{initials(p.username||p.alias||"?")}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.white }}>{p.username||p.alias||"?"}</div>
                <div style={{ fontSize:11, color:C.muted }}>{[p.allianceTag&&`[${p.allianceTag}]`, p.furnaceLevel&&`FC${p.furnaceLevel}`, p.availability?.discord==="yes"&&"🎙️"].filter(Boolean).join(" · ")}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hero detail sheet ──────────────────────────────────────────
function HeroDetailSheet({ hero, players, open, onClose, onAddPlayer, onRemovePlayer }) {
  const owners = players.filter(p =>
    (p.joinerHeroes || []).some(jh => jh.hero === hero && jh.skillLevel >= 5)
  );

  if (!open || !hero) return null;

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#000c", zIndex:500, display:"flex", alignItems:"flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:"20px 20px 0 0", width:"100%", maxHeight:"88vh", overflowY:"auto", padding:"16px 20px 80px" }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:"0 auto 16px" }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.gold }}>{hero}</div>
            <div style={{ fontSize:13, color:C.muted }}>Skill 5 · {owners.length} player{owners.length!==1?"s":""}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, fontSize:22, cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>

        {/* Add player */}
        <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:10 }}>＋ Add player with {hero} Skill 5</div>
          <MiniPlayerPicker
            players={players.filter(p => !(p.joinerHeroes||[]).some(jh=>jh.hero===hero&&jh.skillLevel>=5))}
            onSelect={p => onAddPlayer(p, hero)}
            placeholder={`Search to add ${hero} owner…`}
          />
        </div>

        {/* Owner list */}
        {owners.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:C.muted }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🦸</div>
            No players with {hero} at Skill 5 yet
          </div>
        ) : owners.map(p => {
          const jh = (p.joinerHeroes||[]).find(jh=>jh.hero===hero);
          return (
            <div key={p.id} style={{ background:C.section, borderRadius:10, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:C.card, border:`1.5px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:15, color:C.white, flexShrink:0 }}>
                {initials(p.username||p.alias||"?")}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{p.username||p.alias||"?"}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:3 }}>
                  {p.allianceTag&&<span style={{ fontSize:11, color:C.icy }}>[{p.allianceTag}]</span>}
                  {p.furnaceLevel&&<span style={{ fontSize:11, color:C.gold }}>FC{p.furnaceLevel}</span>}
                  <span style={{ fontSize:11, color:p.availability?.discord==="yes"?C.green:C.muted }}>
                    {p.availability?.discord==="yes"?"🎙️ Voice ✓":"Voice ✗"}
                  </span>
                  {p.availability?.present==="available"
                    ? <span style={{ fontSize:11, color:C.green }}>✅ Available</span>
                    : <span style={{ fontSize:11, color:C.muted }}>❌ Unavailable</span>
                  }
                  {jh?.verified&&<span style={{ fontSize:11, color:C.gold }}>✓ Verified</span>}
                </div>
                {jh?.updatedAt&&<div style={{ fontSize:10, color:C.muted, marginTop:2 }}>Updated {fmtDate(jh.updatedAt)}</div>}
              </div>
              <button onClick={() => onRemovePlayer(p, hero)} style={{ background:"none", border:"none", color:C.red+"88", fontSize:16, cursor:"pointer", padding:"8px", lineHeight:1 }}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Meta recommendation panel ──────────────────────────────────
function MetaPanel() {
  const [gen, setGen] = useState(6);
  const [type, setType] = useState("Defense");
  const [ratio, setRatio] = useState("");

  const suggestion = getMetaSuggestion(gen, type, ratio);
  const genData = JOINER_META.find(m => m.gen === gen);

  return (
    <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
      <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:4 }}>📐 Meta Recommendation</div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>Based on community spreadsheet data</div>

      {/* Controls */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
        <div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>GENERATION</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {JOINER_META.map(m => (
              <button key={m.gen} onClick={() => setGen(m.gen)} style={{ padding:"6px 12px", borderRadius:16, minHeight:34, border:`1px solid ${gen===m.gen?C.gold:C.border}`, background:gen===m.gen?C.gold+"22":C.section, color:gen===m.gen?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:"pointer" }}>
                Gen {m.gen}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>TYPE</div>
          <div style={{ display:"flex", gap:6 }}>
            {["Defense","Offense"].map(t => (
              <button key={t} onClick={() => setType(t)} style={{ flex:1, height:34, borderRadius:16, border:`1px solid ${type===t?(t==="Defense"?C.icy:C.red):C.border}`, background:type===t?(t==="Defense"?C.icy+"22":C.red+"22"):C.section, color:type===t?(t==="Defense"?C.icy:C.red):C.muted, fontWeight:600, fontSize:13, cursor:"pointer" }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {genData && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>RATIO (optional)</div>
          <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
            <button onClick={() => setRatio("")} style={{ padding:"5px 12px", borderRadius:16, flexShrink:0, border:`1px solid ${ratio===""?C.gold:C.border}`, background:ratio===""?C.gold+"22":C.section, color:ratio===""?C.gold:C.muted, fontWeight:600, fontSize:11, cursor:"pointer" }}>Any</button>
            {[...new Set(genData.formations.filter(f=>f.type===type).map(f=>f.ratio))].map(r => (
              <button key={r} onClick={() => setRatio(r===ratio?"":r)} style={{ padding:"5px 12px", borderRadius:16, flexShrink:0, border:`1px solid ${ratio===r?C.gold:C.border}`, background:ratio===r?C.gold+"22":C.section, color:ratio===r?C.gold:C.muted, fontWeight:600, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>{r}</button>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {suggestion && (
        <div style={{ background:C.section, borderRadius:10, padding:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:suggestion.type==="Defense"?C.icy:C.red }}>{suggestion.type} · {suggestion.ratio}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Leaders: {suggestion.leaders}</div>
            </div>
          </div>

          <div style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Joiners</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
            {suggestion.joiners.map((j, i) => (
              <span key={i} style={{ padding:"6px 12px", borderRadius:16, background:C.gold+"22", border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:13 }}>
                J{i+1}: {j}
              </span>
            ))}
          </div>

          {(suggestion.alt1 || suggestion.alt2) && (
            <>
              <div style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Alternatives</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:suggestion.notes?10:0 }}>
                {[suggestion.alt1, suggestion.alt2].filter(Boolean).map((a, i) => (
                  <span key={i} style={{ padding:"5px 10px", borderRadius:16, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:12 }}>{a}</span>
                ))}
              </div>
            </>
          )}

          {suggestion.notes && (
            <div style={{ fontSize:12, color:C.muted, fontStyle:"italic", marginTop:8, lineHeight:1.5 }}>ℹ️ {suggestion.notes}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stacking checker ───────────────────────────────────────────
function StackingChecker({ players }) {
  const [selected, setSelected] = useState([]); // hero names
  const warnings = detectStacking(selected);
  const allOptions = JOINER_HEROES.filter(h =>
    players.some(p => (p.joinerHeroes||[]).some(jh=>jh.hero===h&&jh.skillLevel>=5))
  );

  function toggle(h) {
    setSelected(prev => prev.includes(h) ? prev.filter(x=>x!==h) : [...prev, h]);
  }

  // Suggest alternatives for stacked hero
  function getAlts(stackedHero) {
    return JOINER_HEROES.filter(h =>
      h !== stackedHero &&
      players.some(p => (p.joinerHeroes||[]).some(jh=>jh.hero===h&&jh.skillLevel>=5))
    ).slice(0, 4);
  }

  return (
    <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
      <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:4 }}>⚠️ Stacking Checker</div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>Select joiner heroes to check for over-stacking</div>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:selected.length?12:0 }}>
        {allOptions.map(h => {
          const count = selected.filter(s => s === h).length;
          return (
            <button key={h} onClick={() => setSelected(prev=>[...prev,h])} style={{ padding:"7px 14px", borderRadius:20, minHeight:36, border:`1px solid ${count>0?C.gold:C.border}`, background:count>0?C.gold+"22":C.section, color:count>0?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:"pointer", position:"relative" }}>
              {h}{count>0&&<span style={{ marginLeft:6, background:C.gold, color:C.bg, borderRadius:10, padding:"1px 6px", fontSize:11, fontWeight:700 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Selected: {selected.join(", ")}</div>
          <button onClick={() => setSelected([])} style={{ fontSize:12, color:C.red, background:"none", border:"none", cursor:"pointer", padding:"2px 0", marginBottom:10 }}>Clear all ✕</button>

          {warnings.length === 0 ? (
            <div style={{ background:C.green+"18", border:`1px solid ${C.green}44`, borderRadius:10, padding:"10px 14px", fontSize:13, color:C.green }}>
              ✓ No stacking issues detected
            </div>
          ) : warnings.map(({ hero, count, risk }) => (
            <div key={hero} style={{ background:C.red+"18", border:`1px solid ${C.red}44`, borderRadius:10, padding:12, marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:6 }}>
                {risk==="high"?"🚨 High":"⚠️ Medium"} stacking: {hero} ×{count}
              </div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Consider replacing {count-2} of these with alternatives:</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {getAlts(hero).map(a => (
                  <span key={a} style={{ padding:"5px 10px", borderRadius:16, background:C.gold+"18", border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:12 }}>{a}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Coverage report ────────────────────────────────────────────
function CoverageReport({ players }) {
  const report = buildCoverageReport(players);
  const sorted = Object.entries(report).sort((a, b) => b[1] - a[1]);
  const total = players.length;
  const missing = sorted.filter(([, n]) => n === 0);
  const present = sorted.filter(([, n]) => n > 0);

  return (
    <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
      <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:4 }}>📊 Joiner Coverage</div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>Alliance-wide Skill 5 hero ownership</div>

      {present.map(([hero, count]) => (
        <div key={hero} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <div style={{ width:80, fontSize:13, color:C.white, fontWeight:600, flexShrink:0 }}>{hero}</div>
          <div style={{ flex:1, height:6, borderRadius:3, background:C.border, overflow:"hidden" }}>
            <div style={{ width:`${total>0?(count/Math.max(...Object.values(report)))*100:0}%`, height:"100%", background:count>=6?C.green:count>=3?C.gold:C.red, borderRadius:3, transition:"width 300ms ease" }}/>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:count>=6?C.green:count>=3?C.gold:C.red, width:28, textAlign:"right" }}>{count}</div>
        </div>
      ))}

      {missing.length > 0 && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:8 }}>⚠️ Missing (0 players)</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {missing.map(([hero]) => (
              <span key={hero} style={{ padding:"5px 10px", borderRadius:16, background:C.red+"18", border:`1px solid ${C.red}33`, color:C.red, fontWeight:600, fontSize:12 }}>{hero}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main JoinerRegistry component ─────────────────────────────
export default function JoinerRegistry({ players, onUpdatePlayer, onClose }) {
  const [activeHero, setActiveHero] = useState(null);
  const [heroSheetOpen, setHeroSheetOpen] = useState(false);
  const [activeView, setActiveView] = useState("registry"); // registry | meta | stacking | coverage

  const coverage = buildCoverageReport(players);
  const sortedHeroes = JOINER_HEROES
    .map(h => ({ hero:h, count:coverage[h]||0 }))
    .sort((a, b) => b.count - a.count);

  function addPlayerToHero(player, heroName) {
    const existing = (player.joinerHeroes || []).filter(jh => jh.hero !== heroName);
    const updated = {
      ...player,
      joinerHeroes: [
        ...existing,
        { hero: heroName, skillLevel: 5, verified: true, updatedAt: new Date().toISOString() }
      ],
      profileLastUpdated: new Date().toISOString(),
    };
    onUpdatePlayer(updated);
  }

  function removePlayerFromHero(player, heroName) {
    const updated = {
      ...player,
      joinerHeroes: (player.joinerHeroes || []).filter(jh => jh.hero !== heroName),
      profileLastUpdated: new Date().toISOString(),
    };
    onUpdatePlayer(updated);
  }

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"system-ui,-apple-system,sans-serif", color:C.white }}>
      {/* Header */}
      <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onClose} style={{ background:"none", border:"none", color:C.gold, fontSize:14, fontWeight:600, cursor:"pointer", padding:0 }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>🦸 Rally Joiner Registry</div>
          <div style={{ fontSize:12, color:C.muted }}>Track Skill 5 joiner heroes · {players.length} players</div>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"12px 20px 0", paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
        {[{id:"registry",label:"🦸 Registry"},{id:"coverage",label:"📊 Coverage"},{id:"stacking",label:"⚠️ Stacking"},{id:"meta",label:"📐 Meta"}].map(v=>(
          <button key={v.id} onClick={()=>setActiveView(v.id)} style={{ padding:"8px 14px", borderRadius:20, whiteSpace:"nowrap", background:activeView===v.id?C.gold+"22":C.section, border:`1px solid ${activeView===v.id?C.gold:C.border}`, color:activeView===v.id?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:"pointer", flexShrink:0 }}>{v.label}</button>
        ))}
      </div>

      <div style={{ padding:"16px 20px", paddingBottom:80 }}>
        {/* ── Registry view ── */}
        {activeView === "registry" && (
          <>
            <div style={{ fontSize:13, color:C.muted, marginBottom:14, lineHeight:1.5 }}>
              Tap a hero card to see owners and add players. All data saves back to player profiles.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
              {sortedHeroes.map(({ hero, count }) => (
                <button key={hero} onClick={() => { setActiveHero(hero); setHeroSheetOpen(true); }} style={{ background:C.card, borderRadius:12, padding:"14px 10px", border:`1px solid ${count>0?C.gold+"44":C.border}`, cursor:"pointer", textAlign:"center", WebkitTapHighlightColor:"transparent" }}>
                  <div style={{ fontSize:24, fontWeight:700, color:count>0?C.gold:C.muted, marginBottom:4 }}>{count}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:count>0?C.white:C.muted, lineHeight:1.3 }}>{hero}</div>
                  {count === 0 && <div style={{ fontSize:10, color:C.red, marginTop:3 }}>⚠️ Missing</div>}
                </button>
              ))}
            </div>

            {/* Total summary */}
            <div style={{ background:C.section, borderRadius:12, padding:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:8 }}>Alliance Joiner Summary</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div style={{ background:C.card, borderRadius:10, padding:10, textAlign:"center" }}>
                  <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{players.filter(p=>(p.joinerHeroes||[]).some(jh=>jh.skillLevel>=5)).length}</div>
                  <div style={{ fontSize:11, color:C.muted }}>Players with joiners</div>
                </div>
                <div style={{ background:C.card, borderRadius:10, padding:10, textAlign:"center" }}>
                  <div style={{ fontSize:22, fontWeight:700, color:C.green }}>{sortedHeroes.filter(h=>h.count>0).length}</div>
                  <div style={{ fontSize:11, color:C.muted }}>Heroes covered</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Coverage view ── */}
        {activeView === "coverage" && <CoverageReport players={players} />}

        {/* ── Stacking view ── */}
        {activeView === "stacking" && <StackingChecker players={players} />}

        {/* ── Meta view ── */}
        {activeView === "meta" && (
          <>
            <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:13, color:C.icy, lineHeight:1.6 }}>
                Meta tables based on community spreadsheet data. Formations may vary based on your specific heroes and server generation. Always verify with your leadership.
              </div>
            </div>
            <MetaPanel />

            {/* Full meta table */}
            {JOINER_META.map(genData => (
              <div key={genData.gen} style={{ background:C.card, borderRadius:12, padding:16, marginBottom:12 }}>
                <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:2 }}>Gen {genData.gen}</div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>{genData.subtitle}</div>
                {genData.formations.map((f, i) => (
                  <div key={i} style={{ background:C.section, borderRadius:10, padding:12, marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div>
                        <span style={{ fontSize:12, fontWeight:700, color:f.type==="Defense"?C.icy:C.red, marginRight:8 }}>{f.type}</span>
                        <span style={{ fontSize:11, color:C.muted }}>{f.ratio}</span>
                      </div>
                      {f.notes && <span style={{ fontSize:10, color:C.muted, maxWidth:140, textAlign:"right", lineHeight:1.4 }}>ℹ️</span>}
                    </div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Leaders: {f.leaders}</div>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:f.alt1||f.alt2?8:0 }}>
                      {f.joiners.map((j, ji) => (
                        <span key={ji} style={{ padding:"4px 10px", borderRadius:14, background:C.gold+"18", border:`1px solid ${C.gold}33`, color:C.gold, fontWeight:600, fontSize:12 }}>J{ji+1}: {j}</span>
                      ))}
                    </div>
                    {(f.alt1||f.alt2) && (
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {[f.alt1,f.alt2].filter(Boolean).map((a,ai)=>(
                          <span key={ai} style={{ padding:"3px 8px", borderRadius:12, background:C.border+"44", color:C.icy, fontSize:11 }}>Alt: {a}</span>
                        ))}
                      </div>
                    )}
                    {f.notes && <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginTop:6, lineHeight:1.4 }}>{f.notes}</div>}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Hero detail sheet */}
      <HeroDetailSheet
        hero={activeHero}
        players={players}
        open={heroSheetOpen}
        onClose={() => setHeroSheetOpen(false)}
        onAddPlayer={(player, heroName) => { addPlayerToHero(player, heroName); }}
        onRemovePlayer={(player, heroName) => { removePlayerFromHero(player, heroName); }}
      />
    </div>
  );
}

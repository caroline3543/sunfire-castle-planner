import { useState, useEffect } from 'react';
import { C, ROLES, ROLE_COLORS, ROLE_ICONS, TIER_OPTIONS, HEROES_BY_GEN, LANGUAGES, COUNTRIES } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { fmtDate, fmtDateShort } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';
import { newPlayer } from '../../data/playerSchema.js';
import { resolveBatchRows, mergePlayerObjects } from '../../services/batchAddService.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
import { Field, Inp, Sel, TierPill, ToggleRow, ReliabilityBadge, AvailChip, SheetHandle } from '../common/Primitives.jsx';

// Alliance quick-select chips for batch add
const ALLIANCE_CHIPS = ['INT','SOV','LEO','420','WWS'];

// Furnace level options
const FC_OPTIONS = ['FC1','FC2','FC3','FC4','FC5'];

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

// ── Player Card ────────────────────────────────────────────────
function PlayerCard({ player, onClick, onDelete, events }) {
  const dn = player.username||player.alias||'Unknown';
  const rc = ROLE_COLORS[player.roles?.[0]]||C.muted;
  const metrics = calcMetrics(player, events||[]);
  const glyphs = [];
  if (player.availability?.discord==='yes') glyphs.push('🎙️');
  if (player.availability?.timing==='late') glyphs.push('🕐');
  if (player.availability?.timing==='early') glyphs.push('🚪');
  if (player.availability?.present==='unavailable') glyphs.push('❌');
  const joiners = (player.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>jh.hero);

  return (
    <div onClick={onClick} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer', WebkitTapHighlightColor:'transparent', userSelect:'none' }}>
      <div style={{ width:48, height:48, borderRadius:'50%', flexShrink:0, background:rc+'33', border:`2px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17, color:C.white }}>
        {initials(dn)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
          {glyphs.map((g,i) => <span key={i} style={{ fontSize:13 }}>{g}</span>)}
          {metrics && <span style={{ fontSize:11, fontWeight:700, color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red, marginLeft:2 }}>{metrics.reliabilityScore}pts</span>}
        </div>
        <div style={{ fontSize:12, color:C.icy, marginBottom:4 }}>
          {[player.allianceTag&&`[${player.allianceTag}]`, player.furnaceLevel&&`FC${player.furnaceLevel}`, player.country].filter(Boolean).join(' · ')}
        </div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[['🛡️',player.troops?.infantry,C.inf],['⚔️',player.troops?.lancer,C.lan],['🏹',player.troops?.marksman,C.mar]].map(([i,t,c],idx) =>
            <span key={idx} style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:(t?c:C.muted)+'22', border:`1px solid ${(t?c:C.muted)}33`, color:t?c:C.muted }}>{i} {t||'?'}</span>
          )}
          {joiners.slice(0,3).map(h => <span key={h} style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:C.gold+'18', border:`1px solid ${C.gold}33`, color:C.gold }}>✓ {h}</span>)}
          {joiners.length>3 && <span style={{ fontSize:11, color:C.muted }}>+{joiners.length-3}</span>}
        </div>
        {player.profileLastUpdated && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Updated {fmtDate(player.profileLastUpdated)}</div>}
      </div>
      <button onClick={e=>{e.stopPropagation();onDelete(player.id);}} style={{ background:'none', border:'none', color:C.red+'88', fontSize:20, cursor:'pointer', padding:'8px', flexShrink:0 }}>✕</button>
    </div>
  );
}

// ── Profile View ───────────────────────────────────────────────
function ProfileView({ player, open, onClose, onEdit, events }) {
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open||!player) return null;
  const dn = player.username||player.alias||'Unknown';
  const rc = ROLE_COLORS[player.roles?.[0]]||C.muted;
  const metrics = calcMetrics(player, events||[]);
  const snaps = (events||[]).flatMap(ev=>(ev.snapshots||[]).filter(s=>s.playerId===player.id).map(s=>({...s,eventName:ev.name||ev.type,eventDate:ev.date,eventType:ev.type}))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:rc+'33', border:`2px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:22, color:C.white, flexShrink:0 }}>{initials(dn)}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{dn}</div>
              {player.alias&&player.username&&<div style={{ fontSize:13, color:C.muted }}>{player.alias}</div>}
              {metrics&&<ReliabilityBadge score={metrics.reliabilityScore}/>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onEdit} style={{ height:36, padding:'0 16px', borderRadius:20, background:C.gold, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Edit</button>
            <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
          </div>
        </div>

        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Identity</div>
          {[['FID',player.fid],['Alliance',player.allianceTag?`[${player.allianceTag}]`:null],['Furnace',player.furnaceLevel?`FC${player.furnaceLevel}`:null],['Country',player.country],['Languages',player.languages?.join(', ')]].filter(([,v])=>v).map(([l,v])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${C.border}22` }}>
              <span style={{ fontSize:14, color:C.muted }}>{l}</span>
              <span style={{ fontSize:14, color:C.white, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>

        {player.roles?.length>0&&(
          <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Roles</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {player.roles.map(r=><span key={r} style={{ padding:'6px 14px', borderRadius:20, background:ROLE_COLORS[r]+'22', border:`1px solid ${ROLE_COLORS[r]}44`, color:ROLE_COLORS[r], fontWeight:600, fontSize:14 }}>{ROLE_ICONS[r]} {r}</span>)}
            </div>
          </div>
        )}

        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Combat</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[['🛡️',player.troops?.infantry,C.inf],['⚔️',player.troops?.lancer,C.lan],['🏹',player.troops?.marksman,C.mar]].map(([i,t,c])=>(
              <div key={i} style={{ background:C.card, borderRadius:10, padding:10, textAlign:'center' }}>
                <div style={{ fontSize:11, color:c, fontWeight:700, marginBottom:4 }}>{i}</div>
                <div style={{ fontSize:16, fontWeight:700, color:t?c:C.muted }}>{t||'?'}</div>
              </div>
            ))}
          </div>
        </div>

        {(player.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).length>0 ? (
          <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Skill 5 Joiner Heroes</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {(player.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>(
                <span key={jh.hero} style={{ padding:'6px 14px', borderRadius:20, background:C.gold+'18', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:14 }}>✓ {jh.hero}</span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:13, color:C.muted }}>No joiner heroes recorded — update in 🦸 Joiner Registry (Intel tab)</div>
          </div>
        )}

        {metrics&&(
          <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Event History</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
              {[['Attendance',`${metrics.attendancePct}%`,metrics.attendancePct>=70?C.green:C.gold],['Voice',`${metrics.voicePct}%`,C.icy],['Score',metrics.reliabilityScore,metrics.reliabilityScore>=70?C.green:C.gold]].map(([l,v,c])=>(
                <div key={l} style={{ background:C.card, borderRadius:10, padding:10, textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            {snaps.slice(0,4).map(s=>(
              <div key={s.snapshotId} style={{ padding:'8px 0', borderBottom:`1px solid ${C.border}22`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.white }}>{s.eventName}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{fmtDateShort(s.eventDate)}</div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  {s.attendance.attended===true&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.green+'18', color:C.green }}>✓</span>}
                  {s.attendance.noShow&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.red+'18', color:C.red }}>✗</span>}
                  {s.voice.joined===true&&<span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, background:C.icy+'18', color:C.icy }}>🎙️</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {player.notes&&(
          <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Notes</div>
            <div style={{ fontSize:14, color:C.icy, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{player.notes}</div>
          </div>
        )}

        <button onClick={onClose} style={{ width:'100%', height:48, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Close</button>
      </div>
    </div>
  );
}

// ── Player Edit Sheet ──────────────────────────────────────────
function PlayerSheet({ player, open, onClose, onSave }) {
  const [p, setP]           = useState(() => player||newPlayer());
  const [activeTab, setActiveTab] = useState('identity');

  useEffect(() => {
    if (open) { setP(player ? {...player} : newPlayer()); setActiveTab('identity'); }
  }, [open, player?.id]);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function upd(k,v)    { setP(prev=>({...prev,[k]:v,profileLastUpdated:new Date().toISOString()})); }
  function updT(k,v)   { setP(prev=>({...prev,troops:{...prev.troops,[k]:v},profileLastUpdated:new Date().toISOString()})); }
  function updA(patch) { setP(prev=>({...prev,availability:{...prev.availability,...patch},profileLastUpdated:new Date().toISOString()})); }
  function save()      { onSave({...p,profileLastUpdated:p.profileLastUpdated||new Date().toISOString()}); onClose(); vibe(8); }

  const TABS = [{id:'identity',label:'👤 Identity'},{id:'combat',label:'⚔️ Combat'},{id:'avail',label:'📅 Availability'}];
  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:350, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 100px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{player?'Edit Player':'Add Player'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:20, overflowX:'auto' }}>
          {TABS.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:'8px 14px', borderRadius:20, whiteSpace:'nowrap', background:activeTab===t.id?C.gold+'22':C.section, border:`1px solid ${activeTab===t.id?C.gold:C.border}`, color:activeTab===t.id?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{t.label}</button>)}
        </div>

        {activeTab==='identity'&&(
          <div>
            <Field label="In-Game Username"><Inp value={p.username} onChange={v=>upd('username',v)} placeholder="WOS username"/></Field>
            <Field label="Alias / Real Name"><Inp value={p.alias} onChange={v=>upd('alias',v)} placeholder="Nickname"/></Field>
            <Field label="WOS User ID / FID"><Inp value={p.fid} onChange={v=>upd('fid',v)} placeholder="12345678" inputMode="numeric"/></Field>
            <Field label="Alliance Tag"><Inp value={p.allianceTag} onChange={v=>upd('allianceTag',v)} placeholder="R3K"/></Field>
            <Field label="Furnace Level">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {FC_OPTIONS.map(fc=>{
                  const sel = p.furnaceLevel===fc;
                  return <button key={fc} onClick={()=>upd('furnaceLevel',sel?null:fc)} style={{ padding:'8px 16px', borderRadius:20, minHeight:40, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>{fc}</button>;
                })}
              </div>
            </Field>
            <Field label="Country"><Sel value={p.country} onChange={v=>upd('country',v)} options={COUNTRIES} placeholder="Select country…"/></Field>
            <Field label="Languages">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {LANGUAGES.map(lang=>{const sel=p.languages?.includes(lang);return(
                  <button key={lang} onClick={()=>{const c=p.languages||[];upd('languages',sel?c.filter(l=>l!==lang):[...c,lang]);}} style={{ padding:'6px 12px', borderRadius:16, minHeight:36, border:`1px solid ${sel?C.icy:C.border}`, background:sel?C.icy+'22':C.section, color:sel?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{lang}</button>
                );})}
              </div>
            </Field>
            <Field label="Notes"><textarea value={p.notes||''} onChange={e=>upd('notes',e.target.value)} placeholder="Any notes…" style={{ width:'100%', minHeight:80, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/></Field>
          </div>
        )}

        {activeTab==='combat'&&(
          <div>
            <Field label="🛡️ Infantry Tier"><TierPill value={p.troops.infantry} onChange={v=>updT('infantry',v)} color={C.inf}/></Field>
            <Field label="⚔️ Lancer Tier"><TierPill value={p.troops.lancer} onChange={v=>updT('lancer',v)} color={C.lan}/></Field>
            <Field label="🏹 Marksman Tier"><TierPill value={p.troops.marksman} onChange={v=>updT('marksman',v)} color={C.mar}/></Field>
            <Field label="Battle Roles" hint="Select all that apply">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {ROLES.map(role=>{const sel=p.roles?.includes(role);const c=ROLE_COLORS[role];return(
                  <button key={role} onClick={()=>{const cur=p.roles||[];upd('roles',sel?cur.filter(r=>r!==role):[...cur,role]);}} style={{ padding:'12px 14px', borderRadius:12, minHeight:48, textAlign:'left', position:'relative', border:`1px solid ${sel?c:C.border}`, background:sel?c+'18':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    {sel&&<span style={{ position:'absolute', top:8, right:10, fontSize:12 }}>✓</span>}
                    {ROLE_ICONS[role]} {role}
                  </button>
                );})}
              </div>
            </Field>
            <Field label="Joiner Heroes at Skill 5" hint="Use 🦸 Joiner Registry in Intel tab for bulk updates">
              <div style={{ background:C.section, borderRadius:10, padding:12 }}>
                {(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).length>0 ? (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>(
                      <span key={jh.hero} style={{ padding:'6px 12px', borderRadius:16, background:C.gold+'18', border:`1px solid ${C.gold}33`, color:C.gold, fontWeight:600, fontSize:13 }}>✓ {jh.hero}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:C.muted }}>No joiner heroes yet. Use 🦸 Joiner Registry in Intel tab.</div>
                )}
              </div>
            </Field>
          </div>
        )}

        {activeTab==='avail'&&(
          <div>
            <Field label="SvS Availability">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['✅ Available','available',C.green],['❌ Unavailable','unavailable',C.red]].map(([l,v,c])=>(
                  <button key={v} onClick={()=>updA({present:v})} style={{ height:52, borderRadius:12, border:`1px solid ${p.availability.present===v?c:C.border}`, background:p.availability.present===v?c+'18':C.section, color:p.availability.present===v?c:C.muted, fontWeight:600, fontSize:15, cursor:'pointer' }}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="Timing">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[['⏰ On Time','on-time'],['🕐 Late','late'],['🚪 Leaving Early','early'],['❓ Unknown','unknown']].map(([l,v])=>(
                  <button key={v} onClick={()=>updA({timing:v})} style={{ padding:'8px 14px', borderRadius:20, minHeight:40, border:`1px solid ${p.availability.timing===v?C.gold:C.border}`, background:p.availability.timing===v?C.gold+'18':C.section, color:p.availability.timing===v?C.gold:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="Discord During SvS">
              <div style={{ display:'flex', gap:8 }}>
                {[['🎙️ On Discord','yes'],['🔇 Not on Discord','no'],['❓ Unknown','unknown']].map(([l,v])=>(
                  <button key={v} onClick={()=>updA({discord:v})} style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${p.availability.discord===v?C.icy:C.border}`, background:p.availability.discord===v?C.icy+'18':C.section, color:p.availability.discord===v?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{l}</button>
                ))}
              </div>
            </Field>
          </div>
        )}

        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button onClick={onClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Save Player</button>
        </div>
      </div>
    </div>
  );
}

// ── Batch Add Sheet ────────────────────────────────────────────
function BatchAddSheet({ open, onClose, members, onAddNew, onUpdateExisting }) {
  const [phase, setPhase]         = useState(0);
  const [rawLines, setRawLines]   = useState([]);
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [tagAll, setTagAll]       = useState('');
  const [showOpt, setShowOpt]     = useState(false);
  const [resolved, setResolved]   = useState(null);
  const [fuzzyDec, setFuzzyDec]   = useState({});
  const [voiceSet, setVoiceSet]   = useState(new Set());
  const [lateSet, setLateSet]     = useState(new Set());
  const [lateBy, setLateBy]       = useState('unknown');
  const [earlySet, setEarlySet]   = useState(new Set());
  const [unavailSet, setUnavailSet] = useState(new Set());
  const [grpTierSel, setGrpTierSel] = useState(new Set());
  const [grpTroops, setGrpTroops]   = useState({infantry:null,lancer:null,marksman:null});
  const [memTroops, setMemTroops]   = useState({});
  const [tierIdx, setTierIdx]     = useState(0);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function updateSuggestions(text) {
    if (!text.trim()) { setSuggestions([]); return; }
    setSuggestions(searchPlayers(members, text, 6));
  }
  function addLine(text, linkedId=null) {
    if (!text.trim()) return;
    setRawLines(prev=>[...prev,{text:text.trim(),linkedId}]);
    setInputText(''); setSuggestions([]);
  }
  function removeLine(idx) { setRawLines(prev=>prev.filter((_,i)=>i!==idx)); }

  function getActive() {
    if (!resolved) return [];
    const n=[];
    resolved.exact.forEach(r=>n.push(r.name));
    resolved.fuzzy.forEach(r=>{const d=fuzzyDec[r.name];if(d==='update'||d==='create')n.push(r.name);});
    resolved.fresh.forEach(r=>n.push(r.name));
    return n;
  }
  const active = getActive();
  const tierStack = active.filter(n=>!grpTierSel.has(n));

  function resetAll() {
    setPhase(0);setRawLines([]);setInputText('');setSuggestions([]);setTagAll('');setShowOpt(false);setResolved(null);setFuzzyDec({});
    setVoiceSet(new Set());setLateSet(new Set());setLateBy('unknown');setEarlySet(new Set());setUnavailSet(new Set());
    setGrpTierSel(new Set());setGrpTroops({infantry:null,lancer:null,marksman:null});setMemTroops({});setTierIdx(0);
  }
  function handleClose() { resetAll(); onClose(); }
  function tog(set,fn,k) { const n=new Set(set);n.has(k)?n.delete(k):n.add(k);fn(n); }

  function resolve() {
    const res = resolveBatchRows(rawLines, members);
    setResolved(res);
    const d={};res.fuzzy.forEach(r=>{d[r.name]='update';});
    setFuzzyDec(d);setPhase(1);vibe(8);
  }

  function buildAvail(n) { return { present:unavailSet.has(n)?'unavailable':'available', timing:lateSet.has(n)?'late':earlySet.has(n)?'early':'unknown', lateBy:lateSet.has(n)?lateBy:null, earlyBy:null, discord:voiceSet.has(n)?'yes':'unknown' }; }
  function buildTroops(n) { return grpTierSel.has(n)?{...grpTroops}:(memTroops[n]||{infantry:null,lancer:null,marksman:null}); }

  function buildAndSave() {
    const toCreate=[],toUpdate=[];
    (resolved?.exact||[]).forEach(r=>{const patch={availability:buildAvail(r.name),troops:buildTroops(r.name)};if(tagAll)patch.allianceTag=tagAll;toUpdate.push(mergePlayerObjects(r.existingPlayer,patch));});
    (resolved?.fuzzy||[]).forEach(r=>{const d=fuzzyDec[r.name];if(d==='skip')return;const patch={availability:buildAvail(r.name),troops:buildTroops(r.name)};if(tagAll)patch.allianceTag=tagAll;d==='update'?toUpdate.push(mergePlayerObjects(r.existingPlayer,patch)):toCreate.push(newPlayer({username:r.name,allianceTag:tagAll,...patch}));});
    (resolved?.fresh||[]).forEach(r=>toCreate.push(newPlayer({username:r.name,allianceTag:tagAll,troops:buildTroops(r.name),availability:buildAvail(r.name)})));
    if(toUpdate.length)onUpdateExisting(toUpdate);
    if(toCreate.length)onAddNew(toCreate);
    vibe([10,50,10]);resetAll();onClose();
  }

  const PL=['Names','Review','Availability','Troop Tiers'];
  if (!open) return null;

  return (
    <div style={{ position:'fixed', inset:0, background:'#000a', zIndex:200, display:'flex', alignItems:'flex-end' }}>
      <div style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <SheetHandle />

        {/* Header with X */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>Batch Add Players</div>
          <button onClick={handleClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>

        {/* Phase stepper */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:24 }}>
          {PL.map((l,i)=>(
            <div key={l} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:i<phase?C.green:i===phase?C.gold:C.border, color:i<=phase?C.bg:C.muted, fontWeight:700, fontSize:12 }}>{i<phase?'✓':i+1}</div>
                <div style={{ fontSize:9, color:i===phase?C.gold:C.muted, marginTop:3, textAlign:'center' }}>{l}</div>
              </div>
              {i<PL.length-1&&<div style={{ height:2, flex:0.3, background:i<phase?C.green:C.border, marginBottom:14 }}/>}
            </div>
          ))}
        </div>

        {/* Phase 0 — Names */}
        {phase===0&&(
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:6 }}>Who's joining?</div>
            <div style={{ fontSize:13, color:C.icy, marginBottom:16 }}>Type names one at a time. Tap suggestions to link existing players.</div>

            {rawLines.length>0&&(
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                {rawLines.map((line,i)=>(
                  <div key={i} style={{ display:'inline-flex', alignItems:'center', gap:6, background:line.linkedId?C.gold+'18':C.section, border:`1px solid ${line.linkedId?C.gold:C.border}`, borderRadius:20, padding:'6px 10px' }}>
                    <span style={{ fontSize:13, color:line.linkedId?C.gold:C.white }}>{line.text}{line.linkedId&&' ✓'}</span>
                    <button onClick={()=>removeLine(i)} style={{ background:'none', border:'none', color:C.muted, fontSize:16, cursor:'pointer', padding:0, lineHeight:1 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ position:'relative', marginBottom:12 }}>
              <div style={{ display:'flex', gap:8 }}>
                <input value={inputText} onChange={e=>{setInputText(e.target.value);updateSuggestions(e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addLine(inputText);}}} placeholder="Type name, press Enter…" style={{ flex:1, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, fontFamily:'inherit' }}/>
                <button onClick={()=>addLine(inputText)} disabled={!inputText.trim()} style={{ height:48, padding:'0 16px', borderRadius:10, background:inputText.trim()?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:inputText.trim()?'pointer':'default' }}>Add</button>
              </div>
              {suggestions.length>0&&(
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', zIndex:600, boxShadow:'0 8px 24px #000a' }}>
                  <div style={{ fontSize:11, color:C.muted, padding:'8px 14px 4px', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700 }}>Existing — tap to link</div>
                  {suggestions.map(p=>(
                    <button key={p.id} onClick={()=>{addLine(p.username||p.alias||'',p.id);vibe(8);}} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'none', border:'none', borderTop:`1px solid ${C.border}22`, cursor:'pointer', textAlign:'left' }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:C.muted+'33', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:C.white, flexShrink:0 }}>{initials(p.username||p.alias||'?')}</div>
                      <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700, color:C.white }}>{p.username||p.alias||'?'}</div><div style={{ fontSize:11, color:C.muted }}>{p.allianceTag?`[${p.allianceTag}]`:''}</div></div>
                      <span style={{ fontSize:12, color:C.gold, fontWeight:600 }}>Link ›</span>
                    </button>
                  ))}
                  <button onClick={()=>addLine(inputText,null)} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', borderTop:`1px solid ${C.border}22`, cursor:'pointer', textAlign:'left', fontSize:13, color:C.muted }}>+ Add "{inputText}" as new player</button>
                </div>
              )}
            </div>

            {rawLines.length>0&&<div style={{ fontSize:13, color:C.icy, marginBottom:12 }}><span style={{ color:C.white, fontWeight:600 }}>{rawLines.length}</span> entries · <span style={{ color:C.gold }}>{rawLines.filter(l=>l.linkedId).length} linked</span></div>}

            {/* Set for all */}
            <button onClick={()=>setShowOpt(!showOpt)} style={{ background:'none', border:'none', color:C.gold, fontSize:14, cursor:'pointer', padding:'4px 0', marginBottom:12 }}>{showOpt?'▾':'▸'} Set for all (optional)</button>
            {showOpt&&(
              <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Alliance Tag</div>
                {/* Quick chips */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                  {ALLIANCE_CHIPS.map(chip=>(
                    <button key={chip} onClick={()=>setTagAll(tagAll===chip?'':chip)} style={{ padding:'8px 16px', borderRadius:20, minHeight:36, border:`1px solid ${tagAll===chip?C.gold:C.border}`, background:tagAll===chip?C.gold+'22':C.card, color:tagAll===chip?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>{chip}</button>
                  ))}
                </div>
                <Inp value={tagAll} onChange={setTagAll} placeholder="Or type custom tag…"/>
                {tagAll&&<div style={{ fontSize:12, color:C.green, marginTop:6 }}>✓ Will apply [{tagAll}] to all {rawLines.length} players</div>}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
              <button disabled={rawLines.length===0} onClick={resolve} style={{ flex:2, height:54, borderRadius:12, background:rawLines.length>0?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:rawLines.length>0?'pointer':'default' }}>
                Continue with {rawLines.length} →
              </button>
            </div>
          </div>
        )}

        {/* Phase 1 — Review */}
        {phase===1&&resolved&&(
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:6 }}>Review</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:20 }}>
              {[[resolved.fresh.length,'New',C.green],[resolved.exact.length,'Update',C.gold],[resolved.fuzzy.length,'Review',C.mar]].map(([c,l,col])=>(
                <div key={l} style={{ background:C.section, borderRadius:10, padding:12, textAlign:'center' }}><div style={{ fontSize:24, fontWeight:700, color:col }}>{c}</div><div style={{ fontSize:12, color:C.muted }}>{l}</div></div>
              ))}
            </div>
            {resolved.exact.length>0&&<div style={{ marginBottom:16 }}><div style={{ fontSize:13, fontWeight:700, color:C.gold, marginBottom:8 }}>✓ Will update</div>{resolved.exact.map(r=><div key={r.name} style={{ background:C.section, borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between' }}><div style={{ fontSize:14, fontWeight:700, color:C.white }}>{r.name}</div><span style={{ fontSize:12, color:C.gold }}>Update</span></div>)}</div>}
            {resolved.fuzzy.length>0&&<div style={{ marginBottom:16 }}><div style={{ fontSize:13, fontWeight:700, color:C.mar, marginBottom:8 }}>⚠️ Possible duplicates</div>{resolved.fuzzy.map(r=>{const d=fuzzyDec[r.name]||'update';return(<div key={r.name} style={{ background:C.section, borderRadius:10, padding:14, marginBottom:8 }}><div style={{ marginBottom:8 }}><div style={{ fontSize:14, fontWeight:700, color:C.white }}>{r.name}</div><div style={{ fontSize:11, color:C.muted }}>similar to "{r.existingPlayer.username||r.existingPlayer.alias}" ({Math.round(r.score*100)}%)</div></div><div style={{ display:'flex', gap:8 }}>{[['update','Update',C.gold],['create','New',C.green],['skip','Skip',C.muted]].map(([v,l,c])=><button key={v} onClick={()=>setFuzzyDec(prev=>({...prev,[r.name]:v}))} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${d===v?c:C.border}`, background:d===v?c+'22':C.card, color:d===v?c:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>{l}</button>)}</div></div>);})}</div>}
            {resolved.fresh.length>0&&<div style={{ marginBottom:20 }}><div style={{ fontSize:13, fontWeight:700, color:C.green, marginBottom:8 }}>＋ New players</div>{resolved.fresh.map(r=><div key={r.name} style={{ background:C.section, borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between' }}><div style={{ fontSize:14, fontWeight:700, color:C.white }}>{r.name}</div><span style={{ fontSize:12, color:C.green }}>New</span></div>)}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setPhase(0)} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>← Back</button>
              <button onClick={()=>{setPhase(2);vibe(8);}} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Phase 2 — Availability */}
        {phase===2&&(
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:16 }}>Availability</div>
            {[
              {label:'🎙️ Discord voice?',set:voiceSet,fn:setVoiceSet,col:C.gold},
              {label:'🕐 Arriving late?',set:lateSet,fn:setLateSet,col:C.icy,extra:lateSet.size>0&&<div style={{ marginTop:10 }}><div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>How late?</div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{['15 min','30 min','1 hr','Unknown'].map(o=><button key={o} onClick={()=>setLateBy(o)} style={{ padding:'6px 14px', borderRadius:20, minHeight:36, border:`1px solid ${lateBy===o?C.icy:C.border}`, background:lateBy===o?C.icy+'22':C.section, color:lateBy===o?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{o}</button>)}</div></div>},
              {label:"❌ Won't make it?",set:unavailSet,fn:setUnavailSet,col:C.red},
            ].map(({label,set,fn,col,extra})=>(
              <div key={label} style={{ marginBottom:24 }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:8 }}>{label}</div>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <button onClick={()=>fn(new Set(active))} style={{ fontSize:13, color:C.gold, background:'none', border:'none', cursor:'pointer' }}>Select all</button>
                  <span style={{ color:C.muted }}>·</span>
                  <button onClick={()=>fn(new Set())} style={{ fontSize:13, color:C.gold, background:'none', border:'none', cursor:'pointer' }}>Clear</button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{active.map(n=><AvailChip key={n} label={n} selected={set.has(n)} color={col} onClick={()=>{tog(set,fn,n);vibe(8);}}/>)}</div>
                {extra}
              </div>
            ))}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setPhase(1)} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>← Back</button>
              <button onClick={()=>{setPhase(3);vibe(8);}} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Continue →</button>
            </div>
            <button onClick={()=>setPhase(3)} style={{ display:'block', margin:'10px auto 0', background:'none', border:'none', color:C.muted, fontSize:13, cursor:'pointer' }}>Skip →</button>
          </div>
        )}

        {/* Phase 3 — Tiers */}
        {phase===3&&(
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:16 }}>Troop tiers</div>
            <div style={{ background:C.section, borderRadius:12, borderLeft:`3px solid ${C.gold}`, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.gold, marginBottom:4 }}>⚡ Group shortcut</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>{active.map(n=><button key={n} onClick={()=>{tog(grpTierSel,setGrpTierSel,n);vibe(8);}} style={{ padding:'8px 14px', borderRadius:20, minHeight:40, border:`1px solid ${grpTierSel.has(n)?C.gold:C.border}`, background:grpTierSel.has(n)?C.gold+'22':C.card, color:grpTierSel.has(n)?C.gold:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>{n}</button>)}</div>
              {[['🛡️',C.inf,'infantry'],['⚔️',C.lan,'lancer'],['🏹',C.mar,'marksman']].map(([icon,c,k])=>(
                <div key={k} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:12, color:c, fontWeight:700, marginBottom:6 }}>{icon}</div>
                  <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>setGrpTroops(prev=>({...prev,[k]:prev[k]===t?null:t}))} style={{ padding:'6px 12px', borderRadius:16, flexShrink:0, border:`1px solid ${grpTroops[k]===t?c:C.border}`, background:grpTroops[k]===t?c+'22':C.section, color:grpTroops[k]===t?c:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36 }}>{t}</button>)}</div>
                </div>
              ))}
            </div>
            {tierStack.length>0&&(()=>{
              const cur=tierStack[tierIdx];
              const mt=memTroops[cur]||{infantry:null,lancer:null,marksman:null};
              function setMT(f,v){setMemTroops(p=>({...p,[cur]:{...(p[cur]||{infantry:null,lancer:null,marksman:null}),[f]:v}}));}
              return (
                <div>
                  <div style={{ background:C.section, borderRadius:14, padding:18, marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}><div style={{ fontSize:18, fontWeight:700, color:C.white }}>{cur}</div><div style={{ fontSize:13, color:C.muted }}>{tierIdx+1}/{tierStack.length}</div></div>
                    {[['🛡️',C.inf,'infantry'],['⚔️',C.lan,'lancer'],['🏹',C.mar,'marksman']].map(([icon,c,k])=>(
                      <div key={k} style={{ marginBottom:10 }}>
                        <div style={{ fontSize:12, color:c, fontWeight:700, marginBottom:6 }}>{icon}</div>
                        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>setMT(k,mt[k]===t?null:t)} style={{ padding:'6px 12px', borderRadius:16, flexShrink:0, border:`1px solid ${mt[k]===t?c:C.border}`, background:mt[k]===t?c+'22':C.section, color:mt[k]===t?c:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36 }}>{t}</button>)}</div>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:16 }}>{tierStack.map((_,i)=><button key={i} onClick={()=>setTierIdx(i)} style={{ width:i===tierIdx?20:8, height:8, borderRadius:4, border:'none', cursor:'pointer', padding:0, background:i<tierIdx?C.green:i===tierIdx?C.gold:C.border, transition:'all 200ms' }}/>)}</div>
                  </div>
                  <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                    {tierIdx>0&&<button onClick={()=>setTierIdx(i=>i-1)} style={{ flex:1, height:48, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:15, cursor:'pointer' }}>← Back</button>}
                    {tierIdx<tierStack.length-1&&<button onClick={()=>{setTierIdx(i=>i+1);vibe(8);}} style={{ flex:2, height:48, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>Next →</button>}
                  </div>
                </div>
              );
            })()}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setPhase(2)} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>← Back</button>
              <button onClick={buildAndSave} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>
                Save {active.length} Player{active.length!==1?'s':''}
              </button>
            </div>
            <button onClick={buildAndSave} style={{ display:'block', margin:'10px auto 0', background:'none', border:'none', color:C.muted, fontSize:13, cursor:'pointer' }}>Skip tiers →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RosterTab ──────────────────────────────────────────────────
export function RosterTab({ players, events, onSavePlayer, onAddPlayers, onUpdatePlayers, onDeletePlayer }) {
  const [rosterView, setRosterView]   = useState('list');
  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState('All');
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [batchOpen, setBatchOpen]     = useState(false);

  const filteredPlayers = players.filter(p => {
    const t=(p.username||p.alias||'').toLowerCase();
    const ms=!search||t.includes(search.toLowerCase())||(p.allianceTag||'').toLowerCase().includes(search.toLowerCase())||(p.country||'').toLowerCase().includes(search.toLowerCase());
    const mr=filterRole==='All'||p.roles?.includes(filterRole);
    return ms&&mr;
  });

  function openProfile(player) { setViewingPlayer(player); setProfileOpen(true); }
  function openEdit(player)    { setEditingPlayer(player); setSheetOpen(true); }
  function openAdd()           { setEditingPlayer(null); setSheetOpen(true); }

  return (
    <div style={{ padding:'16px 20px 0' }}>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, tag, country…" style={{ flex:1, height:48, background:'#152236', border:'1px solid #2A4A64', borderRadius:10, padding:'0 14px', fontSize:16, color:'#FFFFFF', fontFamily:'inherit' }}/>
        <button onClick={()=>setBatchOpen(true)} style={{ height:48, padding:'0 12px', borderRadius:10, background:'none', border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:14, cursor:'pointer' }}>⚡ Batch</button>
        <button onClick={openAdd} style={{ height:48, padding:'0 14px', borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <button onClick={()=>setRosterView('list')} style={{ flex:1, height:36, borderRadius:20, background:rosterView==='list'?C.gold+'22':C.section, border:`1px solid ${rosterView==='list'?C.gold:C.border}`, color:rosterView==='list'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>≡ List</button>
        <button onClick={()=>setRosterView('roles')} style={{ flex:1, height:36, borderRadius:20, background:rosterView==='roles'?C.gold+'22':C.section, border:`1px solid ${rosterView==='roles'?C.gold:C.border}`, color:rosterView==='roles'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>⚔️ By Role</button>
      </div>

      {rosterView==='list'&&(
        <>
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:10, marginBottom:4 }}>
            {['All',...ROLES].map(r=><button key={r} onClick={()=>setFilterRole(r)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterRole===r?C.gold+'22':C.section, border:`1px solid ${filterRole===r?C.gold:C.border}`, color:filterRole===r?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36 }}>{r}</button>)}
          </div>
          {players.length>0&&<div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>{filteredPlayers.length} of {players.length} player{players.length!==1?'s':''}</div>}
          {players.length===0&&(
            <div style={{ textAlign:'center', padding:'60px 20px' }}>
              <div style={{ fontSize:52, marginBottom:16 }}>👥</div>
              <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>No players yet</div>
              <div style={{ fontSize:15, color:C.muted, marginBottom:28 }}>Batch add your alliance or add one by one</div>
              <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={()=>setBatchOpen(true)} style={{ height:52, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>⚡ Batch Add</button>
                <button onClick={openAdd} style={{ height:52, padding:'0 24px', borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:15, cursor:'pointer' }}>＋ Add One</button>
              </div>
            </div>
          )}
          {players.length>0&&filteredPlayers.length===0&&<div style={{ textAlign:'center', padding:'40px 20px', color:C.muted }}>No results for "{search||filterRole}"</div>}
          {filteredPlayers.map(p=><PlayerCard key={p.id} player={p} onClick={()=>openProfile(p)} onDelete={onDeletePlayer} events={events}/>)}
        </>
      )}

      {rosterView==='roles'&&(()=>{
        const avail=players.filter(p=>p.availability?.present==='available');
        const byRole=ROLES.map(role=>({role,members:avail.filter(p=>p.roles?.includes(role))})).filter(g=>g.members.length>0);
        return (
          <div>
            <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, color:C.icy, marginBottom:4 }}>Available for SvS</div>
              <div style={{ fontSize:28, fontWeight:700, color:C.white }}>{avail.length} <span style={{ fontSize:16, color:C.muted }}>of {players.length}</span></div>
            </div>
            {byRole.map(({role,members})=>(
              <div key={role} style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:ROLE_COLORS[role], textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{ROLE_ICONS[role]} {role} · {members.length}</div>
                {members.map(m=>(
                  <div key={m.id} onClick={()=>openProfile(m)} style={{ background:C.card, borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
                    <div>
                      <div style={{ fontWeight:700, color:C.white, fontSize:15 }}>{m.username||m.alias||'?'}</div>
                      <div style={{ fontSize:12, color:C.icy }}>{[m.furnaceLevel&&`FC${m.furnaceLevel}`,m.allianceTag&&`[${m.allianceTag}]`].filter(Boolean).join(' · ')}{m.availability?.timing==='late'?' · 🕐':''}{m.availability?.discord==='yes'?' · 🎙️':''}</div>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {[m.troops?.infantry,m.troops?.lancer,m.troops?.marksman].map((t,i)=><span key={i} style={{ fontSize:11, padding:'2px 6px', borderRadius:6, background:[C.inf,C.lan,C.mar][i]+'22', color:[C.inf,C.lan,C.mar][i] }}>{t||'?'}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {players.length===0&&<div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>Add players in List view first</div>}
          </div>
        );
      })()}

      <ProfileView player={viewingPlayer} open={profileOpen} onClose={()=>setProfileOpen(false)} onEdit={()=>{setProfileOpen(false);openEdit(viewingPlayer);}} events={events}/>
      <PlayerSheet open={sheetOpen} player={editingPlayer} onClose={()=>{setSheetOpen(false);setEditingPlayer(null);}} onSave={onSavePlayer}/>
      <BatchAddSheet open={batchOpen} onClose={()=>setBatchOpen(false)} members={players} onAddNew={onAddPlayers} onUpdateExisting={onUpdatePlayers}/>
    </div>
  );
}

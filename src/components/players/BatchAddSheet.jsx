import { useState, useEffect } from 'react';
import { C, TIER_OPTIONS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newPlayer } from '../../data/playerSchema.js';
import { resolveBatchRows, mergePlayerObjects } from '../../services/batchAddService.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';
import { Inp, Sel, AvailChip, SheetHandle } from '../common/Primitives.jsx';

const ALLIANCE_CHIPS = ['INT','SOV','LEO','420','WWS'];

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

export function BatchAddSheet({ open, onClose, members, onAddNew, onUpdateExisting }) {
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
      <div style={{ background:'#1E3A52', borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#FFFFFF' }}>Batch Add Players</div>
          <button onClick={handleClose} style={{ background:'none', border:'none', color:'#5A7A94', fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
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
                <input value={inputText} onChange={e=>{setInputText(e.target.value);updateSuggestions(e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addLine(inputText);}}} placeholder="Type a name, press Enter to add…" style={{ flex:1, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, fontFamily:'inherit' }}/>
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
            <button onClick={()=>setShowOpt(!showOpt)} style={{ background:'none', border:'none', color:C.gold, fontSize:14, cursor:'pointer', padding:'4px 0', marginBottom:12 }}>{showOpt?'▾':'▸'} Apply to everyone</button>
            {showOpt&&(
              <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Alliance Tag</div>
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
                Next →
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

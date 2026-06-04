import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { fmtDate, numFmt } from '../../utils/dates.js';
import { newPrepEntry } from '../../data/playerSchema.js';
import { normalizeName } from '../../utils/normalize.js';
import { Field, Inp } from '../common/Primitives.jsx';

function EntryForm({ entry, players, onSave, onCancel }) {
  const [e, setE] = useState({...entry});
  function upd(k,v) { setE(p=>({...p,[k]:v})); }
  const linked = players.find(p=>p.id===e.playerId||normalizeName(p.username||p.alias||'')===normalizeName(e.playerName));
  return (
    <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:12 }}>
      <Field label="Member name"><Inp value={e.playerName} onChange={v=>upd('playerName',v)} placeholder="Player name"/></Field>
      {linked&&<div style={{ fontSize:12, color:C.green, marginBottom:10 }}>✓ Linked to roster</div>}
      <Field label="Alliance Tag"><Inp value={e.allianceTag} onChange={v=>upd('allianceTag',v)} placeholder="R3K"/></Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        <Field label="Prep points"><Inp value={e.prepScore??''} onChange={v=>upd('prepScore',v?parseFloat(v):null)} placeholder="0" type="number" inputMode="decimal"/></Field>
        <Field label="Points needed"><Inp value={e.targetScore??''} onChange={v=>upd('targetScore',v?parseFloat(v):null)} placeholder="0" type="number" inputMode="decimal"/></Field>
      </div>
      <Field label="Notes"><Inp value={e.notes||''} onChange={v=>upd('notes',v)} placeholder="Notes…"/></Field>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onCancel} style={{ flex:1, height:44, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:15, cursor:'pointer' }}>Cancel</button>
        <button onClick={()=>onSave(e)} style={{ flex:2, height:44, borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>Save</button>
      </div>
    </div>
  );
}

export function ScoresTab({ prepScores, players, onUpdate, showToast }) {
  const [sortBy, setSortBy]       = useState('score_desc');
  const [filterTag, setFilterTag] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [newEntry, setNewEntry]   = useState(()=>newPrepEntry());
  const [batchRaw, setBatchRaw]   = useState('');
  const [batchMode, setBatchMode] = useState(false);

  const allTags = [...new Set(prepScores.map(e=>e.allianceTag).filter(Boolean))];

  function savePE(entry) {
    const ex = prepScores.find(e=>e.id===entry.id);
    let upd;
    if (ex) {
      const h = entry.prepScore!==ex.prepScore ? [...(ex.history||[]),{score:ex.prepScore,timestamp:ex.lastUpdated}] : (ex.history||[]);
      upd = prepScores.map(e=>e.id===entry.id?{...entry,history:h,lastUpdated:new Date().toISOString()}:e);
    } else {
      upd = [...prepScores,{...entry,lastUpdated:new Date().toISOString()}];
    }
    onUpdate(upd);setEditingId(null);setShowAdd(false);setNewEntry(newPrepEntry());vibe(8);
  }

  function delPE(id) { onUpdate(prepScores.filter(e=>e.id!==id)); }

  function applyBatch() {
    const lines = batchRaw.split('\n').map(l=>l.trim()).filter(Boolean);
    const out = [];
    lines.forEach(line=>{
      const parts=line.split(/[,\t]/).map(p=>p.trim());
      if(!parts[0])return;
      const pn=parts[0],at=parts[1]||'',sc=parts[2]?parseFloat(parts[2]):null,tg=parts[3]?parseFloat(parts[3]):null;
      const lp=players.find(p=>normalizeName(p.username||p.alias||'')===normalizeName(pn));
      const ex=prepScores.find(e=>normalizeName(e.playerName)===normalizeName(pn));
      if(ex){
        const h=sc!==null&&sc!==ex.prepScore?[...(ex.history||[]),{score:ex.prepScore,timestamp:ex.lastUpdated}]:(ex.history||[]);
        out.push({...ex,prepScore:sc??ex.prepScore,targetScore:tg??ex.targetScore,allianceTag:at||ex.allianceTag,history:h,lastUpdated:new Date().toISOString()});
      } else {
        out.push(newPrepEntry({playerName:pn,allianceTag:at,prepScore:sc,targetScore:tg,playerId:lp?.id||null}));
      }
    });
    const kept=prepScores.filter(e=>!out.some(n=>normalizeName(n.playerName)===normalizeName(e.playerName)));
    onUpdate([...kept,...out]);setBatchRaw('');setBatchMode(false);vibe(8);showToast(`${out.length} scores updated ✓`);
  }

  let sorted = [...prepScores];
  if (filterTag) sorted=sorted.filter(e=>e.allianceTag===filterTag);
  sorted.sort((a,b)=>{
    if(sortBy==='score_desc')return(b.prepScore||0)-(a.prepScore||0);
    if(sortBy==='score_asc')return(a.prepScore||0)-(b.prepScore||0);
    if(sortBy==='diff')return((b.targetScore||0)-(b.prepScore||0))-((a.targetScore||0)-(a.prepScore||0));
    return(a.playerName||'').localeCompare(b.playerName||'');
  });

  return (
    <div style={{ padding:'16px 20px 0' }}>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <button onClick={()=>{setShowAdd(!showAdd);setNewEntry(newPrepEntry());}} style={{ flex:1, height:44, borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>＋ Add</button>
        <button onClick={()=>setBatchMode(!batchMode)} style={{ flex:1, height:44, borderRadius:10, background:batchMode?C.gold+'22':C.section, border:`1px solid ${batchMode?C.gold:C.border}`, color:batchMode?C.gold:C.icy, fontWeight:700, fontSize:14, cursor:'pointer' }}>⚡ Paste scores</button>
      </div>

      {batchMode&&(
        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:6 }}>Batch Update</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>One per line: Name, Alliance, Score, Target</div>
          <textarea value={batchRaw} onChange={e=>setBatchRaw(e.target.value)} placeholder={'Caroline, R3K, 850000, 1000000\nMarcus, R3K, 720000'} style={{ width:'100%', minHeight:100, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:12, fontSize:15, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.8 }}/>
          <button onClick={applyBatch} disabled={!batchRaw.trim()} style={{ width:'100%', height:44, borderRadius:10, background:batchRaw.trim()?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:batchRaw.trim()?'pointer':'default', marginTop:10 }}>Apply</button>
        </div>
      )}

      {showAdd&&<EntryForm entry={newEntry} players={players} onSave={savePE} onCancel={()=>setShowAdd(false)}/>}

      <div style={{ display:'flex', gap:8, marginBottom:12, overflowX:'auto' }}>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ height:36, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 10px', fontSize:13, color:C.white, cursor:'pointer' }}>
          <option value="score_desc">Score ↓</option>
          <option value="score_asc">Score ↑</option>
          <option value="diff">Gap ↓</option>
          <option value="name">Name</option>
        </select>
        {allTags.length>0&&<select value={filterTag} onChange={e=>setFilterTag(e.target.value)} style={{ height:36, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 10px', fontSize:13, color:C.white, cursor:'pointer' }}><option value="">All</option>{allTags.map(t=><option key={t} value={t}>[{t}]</option>)}</select>}
      </div>

      {sorted.length===0&&<div style={{ textAlign:'center', padding:'60px 20px' }}><div style={{ fontSize:40, marginBottom:12 }}>📈</div><div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:8 }}>No prep scores yet</div></div>}

      {sorted.map(entry=>{
        const diff=entry.targetScore&&entry.prepScore!=null?entry.targetScore-entry.prepScore:null;
        const pct=entry.targetScore&&entry.prepScore!=null?Math.min(100,Math.round((entry.prepScore/entry.targetScore)*100)):null;
        const linked=players.find(p=>p.id===entry.playerId);
        if (editingId===entry.id) return <EntryForm key={entry.id} entry={entry} players={players} onSave={savePE} onCancel={()=>setEditingId(null)}/>;
        return (
          <div key={entry.id} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{entry.playerName}</div>
                  {entry.allianceTag&&<span style={{ fontSize:12, color:C.icy, fontWeight:600 }}>[{entry.allianceTag}]</span>}
                  {linked&&<span style={{ fontSize:11, color:C.green }}>● roster</span>}
                </div>
                <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{numFmt(entry.prepScore)}</div>
                {entry.targetScore&&<div style={{ fontSize:13, color:C.muted }}>Target: {numFmt(entry.targetScore)}</div>}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <button onClick={()=>setEditingId(entry.id)} style={{ height:32, padding:'0 12px', borderRadius:16, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:13, cursor:'pointer' }}>Edit</button>
                <button onClick={()=>delPE(entry.id)} style={{ height:32, width:32, borderRadius:16, background:'none', border:'none', color:C.red+'88', fontSize:16, cursor:'pointer', lineHeight:1 }}>✕</button>
              </div>
            </div>
            {pct!=null&&(
              <div style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:pct>=100?C.green:pct>=50?C.green:C.gold, fontWeight:600 }}>{pct}%</span>
                  {diff!=null&&diff>0&&<span style={{ fontSize:12, color:C.muted }}>−{numFmt(diff)} to go</span>}
                  {diff!=null&&diff<=0&&<span style={{ fontSize:12, color:C.green, fontWeight:700 }}>✓ Target reached</span>}
                </div>
                <div style={{ height:6, borderRadius:3, background:C.border, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', borderRadius:3, background:pct>=100?C.green:pct>=50?C.green:C.gold, transition:'width 300ms ease' }}/>
                </div>
              </div>
            )}
            {(entry.history||[]).length>0&&<div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{[...entry.history].slice(-3).map((h,i)=><span key={i} style={{ marginRight:8 }}>{numFmt(h.score)}</span>)}</div>}
            {entry.notes&&<div style={{ fontSize:13, color:C.icy, fontStyle:'italic' }}>"{entry.notes}"</div>}
            <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Updated {fmtDate(entry.lastUpdated)}</div>
          </div>
        );
      })}
    </div>
  );
}

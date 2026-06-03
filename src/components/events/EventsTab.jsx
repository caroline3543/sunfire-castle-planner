import { useState, useEffect } from 'react';
import { C, EVENT_TYPES, EVENT_ICONS, PERF_TAGS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { fmtDateShort } from '../../utils/dates.js';
import { newEvent, newSnapshot } from '../../data/playerSchema.js';
import { Field, Inp, ToggleRow, SheetHandle } from '../common/Primitives.jsx';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';

function initials(n) { return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?'; }

// ── Event Sheet ────────────────────────────────────────────────
function EventSheet({ event, open, onClose, onSave, players }) {
  const [ev, setEv] = useState(() => event || newEvent());

  // Reset state when opening - uses useEffect, NOT useState misuse
  useEffect(() => {
    if (open) setEv(event ? { ...event } : newEvent());
  }, [open, event?.id]);

  // Escape key support
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function upd(k, v) { setEv(prev => ({ ...prev, [k]: v })); }
  const allTags = [...new Set(players.map(p => p.allianceTag).filter(Boolean))];
  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'88vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{event ? 'Edit Event' : 'New Event'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <Field label="Event Type">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {EVENT_TYPES.map(t => (
              <button key={t} onClick={() => upd('type', t)} style={{ padding:'12px 14px', borderRadius:12, border:`1px solid ${ev.type===t?C.gold:C.border}`, background:ev.type===t?C.gold+'18':C.section, color:ev.type===t?C.gold:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', textAlign:'left' }}>
                {EVENT_ICONS[t]||'📋'} {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Alliance">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            {allTags.map(t => (
              <button key={t} onClick={() => upd('allianceTag', ev.allianceTag===t?'':t)} style={{ padding:'8px 14px', borderRadius:20, minHeight:36, border:`1px solid ${ev.allianceTag===t?C.gold:C.border}`, background:ev.allianceTag===t?C.gold+'22':C.section, color:ev.allianceTag===t?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                [{t}]
              </button>
            ))}
          </div>
          <Inp value={ev.allianceTag} onChange={v => upd('allianceTag', v)} placeholder="Or type alliance tag…"/>
        </Field>
        <Field label="Event Name"><Inp value={ev.name} onChange={v => upd('name', v)} placeholder="e.g. SvS Week 3 — May 2026"/></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <Field label="Date"><Inp type="date" value={ev.date} onChange={v => upd('date', v)}/></Field>
          <Field label="Time"><Inp type="time" value={ev.time||'12:00'} onChange={v => upd('time', v)}/></Field>
        </div>
        <Field label="Participating Players" hint="Select who's in this event">
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {players.map(p => {
              const sel = (ev.participantIds||[]).includes(p.id);
              return (
                <button key={p.id} onClick={() => { const cur=ev.participantIds||[]; upd('participantIds', sel?cur.filter(id=>id!==p.id):[...cur,p.id]); }} style={{ padding:'6px 12px', borderRadius:16, minHeight:36, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  {p.username||p.alias||'?'}
                </button>
              );
            })}
          </div>
          {(ev.participantIds||[]).length > 0 && <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>{ev.participantIds.length} selected</div>}
        </Field>
        <Field label="Notes">
          <textarea value={ev.notes||''} onChange={e => upd('notes', e.target.value)} placeholder="Pre-event notes…" style={{ width:'100%', minHeight:72, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(ev); onClose(); vibe(8); }} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Save Event</button>
        </div>
      </div>
    </div>
  );
}

// ── Snapshot Editor ────────────────────────────────────────────
function SnapshotEditor({ snapshot, playerName, open, onClose, onSave }) {
  const [s, setS] = useState(() => snapshot || {});

  useEffect(() => {
    if (open && snapshot) setS({ ...snapshot });
  }, [open, snapshot?.snapshotId]);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function updA(p) { setS(prev => ({ ...prev, attendance: { ...prev.attendance, ...p } })); }
  function updV(p) { setS(prev => ({ ...prev, voice: { ...prev.voice, ...p } })); }
  function updC(p) { setS(prev => ({ ...prev, combat: { ...prev.combat, ...p } })); }
  function setTag(t) { setS(prev => ({ ...prev, performanceTag: prev.performanceTag===t?null:t })); }

  if (!open || !snapshot) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:400, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 100px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{playerName}</div>
            <div style={{ fontSize:13, color:C.muted }}>Event record</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Performance Tag</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {PERF_TAGS.map(t => (
              <button key={t.key} onClick={() => setTag(t.key)} style={{ padding:'8px 14px', borderRadius:20, minHeight:36, border:`1px solid ${s.performanceTag===t.key?t.color:C.border}`, background:s.performanceTag===t.key?t.color+'18':C.section, color:s.performanceTag===t.key?t.color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>📅 Attendance</div>
          <ToggleRow label="Attended"      value={s.attendance?.attended}    onChange={v=>updA({attended:v})}    tristate={true}/>
          <ToggleRow label="Late"          value={s.attendance?.late}        onChange={v=>updA({late:v})}        colorOn={C.gold} colorOff={C.muted}/>
          <ToggleRow label="Left Early"    value={s.attendance?.leftEarly}   onChange={v=>updA({leftEarly:v})}   colorOn={C.mar}  colorOff={C.muted}/>
          <ToggleRow label="No-show"       value={s.attendance?.noShow}      onChange={v=>updA({noShow:v})}      colorOn={C.red}  colorOff={C.muted}/>
          <ToggleRow label="Stayed full"   value={s.attendance?.stayedFull}  onChange={v=>updA({stayedFull:v})}/>
          <ToggleRow label="Prep phase"    value={s.attendance?.prepPhase}   onChange={v=>updA({prepPhase:v})}/>
          <ToggleRow label="Battle phase"  value={s.attendance?.battlePhase} onChange={v=>updA({battlePhase:v})}/>
        </div>
        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>🎙️ Discord Voice</div>
          <ToggleRow label="Joined voice" value={s.voice?.joined}     onChange={v=>updV({joined:v})}     tristate={true}/>
          <ToggleRow label="On time"      value={s.voice?.onTime}     onChange={v=>updV({onTime:v})}/>
          <ToggleRow label="Joined late"  value={s.voice?.joinedLate} onChange={v=>updV({joinedLate:v})} colorOn={C.gold} colorOff={C.muted}/>
          <ToggleRow label="Left early"   value={s.voice?.leftEarly}  onChange={v=>updV({leftEarly:v})}  colorOn={C.mar}  colorOff={C.muted}/>
        </div>
        <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>⚔️ Combat</div>
          <ToggleRow label="Joined rallies"      value={s.combat?.joinedRallies}      onChange={v=>updC({joinedRallies:v})}/>
          <ToggleRow label="Led rallies"         value={s.combat?.ledRallies}         onChange={v=>updC({ledRallies:v})}         colorOn={C.gold} colorOff={C.muted}/>
          <ToggleRow label="Defended structures" value={s.combat?.defendedStructures} onChange={v=>updC({defendedStructures:v})}/>
          <ToggleRow label="Followed orders"     value={s.combat?.followedOrders}     onChange={v=>updC({followedOrders:v})}     tristate={true}/>
          <ToggleRow label="Went rogue ⚠️"       value={s.combat?.wentRogue}          onChange={v=>updC({wentRogue:v})}         colorOn={C.red} colorOff={C.muted}/>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:8 }}>Officer Notes</label>
          <textarea value={s.notes||''} onChange={e => setS(prev => ({ ...prev, notes:e.target.value }))} placeholder="Notes…" style={{ width:'100%', minHeight:80, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(s); onClose(); vibe(8); }} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Save Record</button>
        </div>
      </div>
    </div>
  );
}

// ── EventsTab ──────────────────────────────────────────────────
export function EventsTab({ events, players, onCreateEvent, onUpdateEvent, onDeleteEvent }) {
  const [filterType, setFilterType]   = useState('All');
  const [filterTag, setFilterTag]     = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [activeEventId, setActiveEventId]   = useState(null);
  const [snapEditing, setSnapEditing] = useState(null);
  const [snapOpen, setSnapOpen]       = useState(false);
  const [bulkMode, setBulkMode]       = useState(false);
  const [bulkSel, setBulkSel]         = useState(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const activeEvent = events.find(e => e.id === activeEventId);
  const allTags = [...new Set(events.map(e => e.allianceTag).filter(Boolean))];
  let filtered = filterType==='All' ? events : events.filter(e => e.type===filterType);
  if (filterTag) filtered = filtered.filter(e => e.allianceTag===filterTag);
  const sorted = [...filtered].sort((a,b) => new Date(b.date) - new Date(a.date));

  function getSnap(ev, pid) { return (ev.snapshots||[]).find(s => s.playerId===pid); }

  function openSnap(ev, player) {
    const s = getSnap(ev, player.id) || newSnapshot(player.id, player, ev.id);
    setSnapEditing({ snapshot:s, playerName:player.username||player.alias||'Unknown', eventId:ev.id, playerId:player.id });
    setSnapOpen(true);
  }

  function saveSnap(upd) {
    const { eventId, playerId } = snapEditing;
    const ev = events.find(e => e.id===eventId);
    if (!ev) return;
    const snaps = [...(ev.snapshots||[])];
    const idx = snaps.findIndex(s => s.playerId===playerId);
    if (idx>=0) snaps[idx]=upd; else snaps.push(upd);
    onUpdateEvent({ ...ev, snapshots:snaps });
  }

  function applyBulk(tag) {
    if (!activeEvent || !bulkSel.size) return;
    const snaps = [...(activeEvent.snapshots||[])];
    bulkSel.forEach(pid => {
      const player = players.find(p => p.id===pid); if (!player) return;
      const idx = snaps.findIndex(s => s.playerId===pid);
      let s = idx>=0 ? { ...snaps[idx] } : newSnapshot(pid, player, activeEvent.id);
      if (tag==='attended') s = { ...s, attendance:{ ...s.attendance, attended:true, noShow:false } };
      if (tag==='noshow')   s = { ...s, attendance:{ ...s.attendance, attended:false, noShow:true } };
      if (tag==='late')     s = { ...s, attendance:{ ...s.attendance, late:true } };
      if (tag==='voice')    s = { ...s, voice:{ ...s.voice, joined:true } };
      if (idx>=0) snaps[idx]=s; else snaps.push(s);
    });
    onUpdateEvent({ ...activeEvent, snapshots:snaps });
    setBulkSel(new Set()); setBulkMode(false); vibe(8);
  }

  function evSum(ev) {
    const sn = ev.snapshots||[];
    return { total:sn.length, attended:sn.filter(s=>s.attendance.attended===true).length, noShow:sn.filter(s=>s.attendance.noShow).length, voice:sn.filter(s=>s.voice.joined===true).length };
  }

  const eventPlayers = activeEvent
    ? (activeEvent.participantIds?.length>0 ? players.filter(p=>activeEvent.participantIds.includes(p.id)) : players)
    : [];

  return (
    <div style={{ padding:'16px 20px 0' }}>
      {activeEvent ? (
        <div>
          <button onClick={() => { setActiveEventId(null); setBulkMode(false); setBulkSel(new Set()); }} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:16, padding:0 }}>
            ← Back to Events
          </button>
          <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{EVENT_ICONS[activeEvent.type]||'📋'} {activeEvent.name||activeEvent.type}</div>
                <div style={{ fontSize:13, color:C.muted }}>{fmtDateShort(activeEvent.date)}{activeEvent.time?` ${activeEvent.time}`:''}{activeEvent.allianceTag?` · [${activeEvent.allianceTag}]`:''}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => { setEditingEvent(activeEvent); setEventSheetOpen(true); }} style={{ height:34, padding:'0 12px', borderRadius:20, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:13, cursor:'pointer' }}>Edit</button>
                <button onClick={() => { const n=activeEvent.status==='active'?'completed':activeEvent.status==='completed'?'upcoming':'active'; onUpdateEvent({ ...activeEvent, status:n }); }} style={{ height:34, padding:'0 12px', borderRadius:20, background:activeEvent.status==='active'?C.green+'22':C.section, border:`1px solid ${activeEvent.status==='active'?C.green:C.border}`, color:activeEvent.status==='active'?C.green:C.muted, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {activeEvent.status==='active'?'🔴 Live':activeEvent.status==='completed'?'✓ Done':'Upcoming'}
                </button>
              </div>
            </div>
            {(() => { const s=evSum(activeEvent); return s.total>0 ? <div style={{ display:'flex', gap:12 }}><span style={{ fontSize:13, color:C.green }}>✓ {s.attended}</span><span style={{ fontSize:13, color:C.red }}>✗ {s.noShow}</span><span style={{ fontSize:13, color:C.icy }}>🎙️ {s.voice}</span></div> : <div style={{ fontSize:13, color:C.muted }}>No records yet</div>; })()}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto' }}>
            <button onClick={() => { setBulkMode(!bulkMode); setBulkSel(new Set()); }} style={{ height:36, padding:'0 14px', borderRadius:20, background:bulkMode?C.gold+'22':C.section, border:`1px solid ${bulkMode?C.gold:C.border}`, color:bulkMode?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
              {bulkMode ? `✓ ${bulkSel.size} selected` : '⚡ Bulk Edit'}
            </button>
            {bulkMode && bulkSel.size>0 && [['✓ Attended','attended',C.green],['✗ No-show','noshow',C.red],['🕐 Late','late',C.gold],['🎙️ Voice','voice',C.icy]].map(([l,t,c]) => (
              <button key={t} onClick={() => applyBulk(t)} style={{ height:36, padding:'0 12px', borderRadius:20, background:c+'18', border:`1px solid ${c}44`, color:c, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>{l}</button>
            ))}
          </div>
          {eventPlayers.length===0
            ? <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>No participants</div>
            : eventPlayers.map(player => {
                const snap = getSnap(activeEvent, player.id);
                const dn = player.username||player.alias||'Unknown';
                const isSel = bulkSel.has(player.id);
                const tagInfo = PERF_TAGS.find(t => t.key===snap?.performanceTag);
                return (
                  <div key={player.id} onClick={() => { if (bulkMode) { const n=new Set(bulkSel); isSel?n.delete(player.id):n.add(player.id); setBulkSel(n); } else openSnap(activeEvent, player); }} style={{ background:isSel?C.gold+'18':C.card, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', border:`1px solid ${isSel?C.gold:C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
                    {bulkMode && <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${isSel?C.gold:C.border}`, background:isSel?C.gold:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{isSel && <span style={{ fontSize:12, color:C.bg, fontWeight:700 }}>✓</span>}</div>}
                    <div style={{ width:36, height:36, borderRadius:'50%', background:C.muted+'33', border:`1.5px solid ${C.muted}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:C.white, flexShrink:0 }}>{initials(dn)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:3 }}>
                        {snap?.attendance?.attended===true && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.green+'18', color:C.green, fontWeight:600 }}>✓</span>}
                        {snap?.attendance?.noShow && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.red+'18', color:C.red, fontWeight:600 }}>✗</span>}
                        {snap?.attendance?.late && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.gold+'18', color:C.gold, fontWeight:600 }}>🕐</span>}
                        {snap?.voice?.joined===true && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.icy+'18', color:C.icy, fontWeight:600 }}>🎙️</span>}
                        {snap?.combat?.wentRogue && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:C.red+'18', color:C.red, fontWeight:600 }}>⚠️</span>}
                        {tagInfo && <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:tagInfo.color+'18', color:tagInfo.color, fontWeight:600 }}>{tagInfo.label}</span>}
                      </div>
                    </div>
                    {!bulkMode && <span style={{ fontSize:18, color:C.muted }}>›</span>}
                  </div>
                );
              })
          }
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:10, marginBottom:8 }}>
            {['All',...EVENT_TYPES].map(t => (
              <button key={t} onClick={() => setFilterType(t)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterType===t?C.gold+'22':C.section, border:`1px solid ${filterType===t?C.gold:C.border}`, color:filterType===t?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36 }}>
                {EVENT_ICONS[t]||''} {t}
              </button>
            ))}
          </div>
          {allTags.length>0 && (
            <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:8 }}>
              <button onClick={() => setFilterTag('')} style={{ padding:'5px 12px', borderRadius:20, background:filterTag===''?C.icy+'22':C.section, border:`1px solid ${filterTag===''?C.icy:C.border}`, color:filterTag===''?C.icy:C.muted, fontWeight:600, fontSize:12, cursor:'pointer', minHeight:30 }}>All</button>
              {allTags.map(t => (
                <button key={t} onClick={() => setFilterTag(filterTag===t?'':t)} style={{ padding:'5px 12px', borderRadius:20, background:filterTag===t?C.icy+'22':C.section, border:`1px solid ${filterTag===t?C.icy:C.border}`, color:filterTag===t?C.icy:C.muted, fontWeight:600, fontSize:12, cursor:'pointer', minHeight:30 }}>[{t}]</button>
              ))}
            </div>
          )}
          <button onClick={() => { setEditingEvent(null); setEventSheetOpen(true); }} style={{ width:'100%', height:48, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer', marginBottom:16 }}>
            ＋ New Event
          </button>
          {sorted.length===0
            ? <div style={{ textAlign:'center', padding:'60px 20px' }}><div style={{ fontSize:40, marginBottom:12 }}>📋</div><div style={{ fontSize:16, fontWeight:700, color:C.white }}>No events yet</div></div>
            : sorted.map(ev => {
                const s = evSum(ev);
                const sc = ev.status==='active'?C.green:ev.status==='completed'?C.muted:C.icy;
                return (
                  <div key={ev.id} onClick={() => setActiveEventId(ev.id)} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${ev.status==='active'?C.green+'44':C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{EVENT_ICONS[ev.type]||'📋'} {ev.name||ev.type}</div>
                        <div style={{ fontSize:12, color:C.muted }}>{fmtDateShort(ev.date)}{ev.time?` ${ev.time}`:''}{ev.allianceTag?` · [${ev.allianceTag}]`:''}</div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:sc, padding:'2px 8px', borderRadius:10, background:sc+'18' }}>{ev.status==='active'?'🔴 Live':ev.status==='completed'?'✓ Done':'Upcoming'}</span>
                        <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(ev.id); }} style={{ fontSize:11, color:C.red+'88', background:'none', border:'none', cursor:'pointer' }}>Delete</button>
                      </div>
                    </div>
                    {s.total>0 && <div style={{ display:'flex', gap:10 }}><span style={{ fontSize:12, color:C.green }}>✓ {s.attended}</span><span style={{ fontSize:12, color:C.red }}>✗ {s.noShow}</span><span style={{ fontSize:12, color:C.icy }}>🎙️ {s.voice}</span><span style={{ fontSize:12, color:C.muted }}>{s.total} recorded</span></div>}
                  </div>
                );
              })
          }
        </>
      )}
      <EventSheet event={editingEvent} open={eventSheetOpen} onClose={() => setEventSheetOpen(false)} onSave={ev => { if (editingEvent) onUpdateEvent(ev); else onCreateEvent(ev); }} players={players}/>
      <SnapshotEditor snapshot={snapEditing?.snapshot} playerName={snapEditing?.playerName} open={snapOpen} onClose={() => setSnapOpen(false)} onSave={saveSnap}/>
      {deleteConfirmId && (
        <DeleteConfirmModal
          message="Delete this event? This cannot be undone."
          onConfirm={() => { onDeleteEvent(deleteConfirmId); setDeleteConfirmId(null); }}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}

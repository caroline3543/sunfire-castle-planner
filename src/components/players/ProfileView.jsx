import { useEffect } from 'react';
import { C, ROLE_COLORS, ROLE_ICONS } from '../../utils/constants.js';
import { fmtDateShort } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';
import { ReliabilityBadge, SheetHandle } from '../common/Primitives.jsx';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

export function ProfileView({ player, open, onClose, onEdit, events }) {
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
  const snaps = (events||[])
    .flatMap(ev=>(ev.snapshots||[]).filter(s=>s.playerId===player.id).map(s=>({...s,eventName:ev.name||ev.type,eventDate:ev.date})))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

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

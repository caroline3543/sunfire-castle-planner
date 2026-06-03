import { C, ROLE_COLORS } from '../../utils/constants.js';
import { fmtDate } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

export function PlayerCard({ player, onClick, onDelete, events }) {
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

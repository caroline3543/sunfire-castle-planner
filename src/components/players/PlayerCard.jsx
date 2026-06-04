import { C, ROLE_COLORS } from '../../utils/constants.js';
import { fmtDate } from '../../utils/dates.js';
import { calcMetrics } from '../../data/metrics.js';

function initials(n) {
  return (n||'?').split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
}

export function PlayerCard({ player, onClick, onDelete, events }) {
  const dn      = player.username||player.alias||'Unknown';
  const rc      = ROLE_COLORS[player.roles?.[0]]||C.muted;
  const metrics = calcMetrics(player, events||[]);
  const joiners = (player.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>jh.hero);

  // Status glyphs — shown prominently
  const unavailable = player.availability?.present==='unavailable';
  const onDiscord   = player.availability?.discord==='yes';
  const isLate      = player.availability?.timing==='late';
  const leavingEarly= player.availability?.timing==='early';

  return (
    <div onClick={onClick} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer', WebkitTapHighlightColor:'transparent', userSelect:'none', opacity:unavailable?0.6:1 }}>

      {/* Avatar */}
      <div style={{ width:46, height:46, borderRadius:'50%', flexShrink:0, background:rc+'33', border:`2px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17, color:C.white }}>
        {initials(dn)}
      </div>

      <div style={{ flex:1, minWidth:0 }}>

        {/* Row 1 — name + key status */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <div style={{ fontSize:16, fontWeight:700, color:unavailable?C.muted:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
          {unavailable && <span style={{ fontSize:11, color:C.red, fontWeight:700 }}>Unavailable</span>}
          {onDiscord   && <span style={{ fontSize:13 }}>🎙️</span>}
          {isLate      && <span style={{ fontSize:13 }}>🕐</span>}
          {leavingEarly&& <span style={{ fontSize:13 }}>🚪</span>}
        </div>

        {/* Row 2 — alliance · furnace · reliability */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
          {player.allianceTag && <span style={{ fontSize:12, color:C.icy, fontWeight:600 }}>[{player.allianceTag}]</span>}
          {player.furnaceLevel && <span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>FC{player.furnaceLevel}</span>}
          {player.country && <span style={{ fontSize:12, color:C.muted }}>{player.country}</span>}
          {metrics && (
            <span style={{ fontSize:11, fontWeight:700, marginLeft:'auto', color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red }}>
              {metrics.reliabilityScore}pts
            </span>
          )}
        </div>

        {/* Row 3 — troops + joiner heroes (secondary info) */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[['🛡️',player.troops?.infantry,C.inf],['⚔️',player.troops?.lancer,C.lan],['🏹',player.troops?.marksman,C.mar]].map(([i,t,c],idx) => (
            <span key={idx} style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:(t?c:C.muted)+'18', color:t?c:C.muted }}>
              {i} {t||'—'}
            </span>
          ))}
          {joiners.slice(0,2).map(h => (
            <span key={h} style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:8, background:C.gold+'18', color:C.gold }}>
              ✓ {h}
            </span>
          ))}
          {joiners.length>2 && <span style={{ fontSize:11, color:C.muted }}>+{joiners.length-2} heroes</span>}
        </div>

      </div>

      {/* Delete */}
      <button
        onClick={e=>{e.stopPropagation();onDelete(player.id);}}
        style={{ background:'none', border:'none', color:C.red+'66', fontSize:20, cursor:'pointer', padding:'8px 4px', flexShrink:0, lineHeight:1 }}
      >✕</button>
    </div>
  );
}

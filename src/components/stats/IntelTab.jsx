import { useState } from 'react';
import { C } from '../../utils/constants.js';
import { calcMetrics } from '../../data/metrics.js';
import { ReliabilityBadge } from '../common/Primitives.jsx';
import JoinerRegistry from '../JoinerRegistry.jsx';

export function IntelTab({ players, events, onUpdatePlayer, showToast }) {
  const [registryOpen, setRegistryOpen] = useState(false);

  const withM = players
    .map(p=>({player:p,metrics:calcMetrics(p,events)}))
    .filter(x=>x.metrics)
    .sort((a,b)=>b.metrics.reliabilityScore-a.metrics.reliabilityScore);

  const atRisk = players
    .map(p=>({player:p,metrics:calcMetrics(p,events)}))
    .filter(x=>x.metrics&&x.metrics.consecutiveMisses>=3)
    .sort((a,b)=>b.metrics.consecutiveMisses-a.metrics.consecutiveMisses);

  // Hero counts from joinerHeroes
  const heroCounts = {};
  players.forEach(p=>(p.joinerHeroes||[]).forEach(jh=>{
    if(jh.skillLevel>=5) heroCounts[jh.hero]=(heroCounts[jh.hero]||0)+1;
  }));
  const topHeroes = Object.entries(heroCounts).sort((a,b)=>b[1]-a[1]).slice(0,12);

  const countryCounts = {};
  players.forEach(p=>{ if(p.country) countryCounts[p.country]=(countryCounts[p.country]||0)+1; });
  const topCountries = Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const available    = players.filter(p=>p.availability?.present==='available').length;
  const rallyLeads   = players.filter(p=>p.roles?.includes('Rally Lead')).length;
  const withJoiners  = players.filter(p=>(p.joinerHeroes||[]).some(jh=>jh.skillLevel>=5)).length;

  if (registryOpen) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:600, background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <JoinerRegistry
          players={players}
          onUpdatePlayer={player=>{ onUpdatePlayer(player); showToast('Saved ✓'); }}
          onClose={()=>setRegistryOpen(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ padding:'16px 20px' }}>

      {/* Summary line — replaces the 6-card grid */}
      <div style={{ background:C.section, borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', gap:0, flexWrap:'wrap' }}>
        {[
          [`${players.length}`, 'members'],
          [`${available}`, 'available'],
          [`${rallyLeads}`, 'rally leads'],
          [`${withJoiners}`, 'joiner heroes set'],
        ].map(([num, label], i) => (
          <div key={label} style={{ flex:'1 1 auto', textAlign:'center', padding:'4px 8px', borderRight: i<3 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{num}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Joiner Registry — prominent card */}
      <button onClick={()=>setRegistryOpen(true)} style={{ width:'100%', borderRadius:12, background:C.card, border:`1px solid ${C.gold}44`, padding:'16px', marginBottom:16, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ fontSize:32 }}>🦸</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.gold }}>Joiner Registry</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>Track Skill 5 joiner heroes · coverage · meta formations</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:20, color:C.gold }}>›</span>
      </button>

      {/* Reliability leaderboard — top of data section */}
      {withM.length>0&&(
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:12 }}>🏅 Most Reliable</div>
          {withM.slice(0,8).map(({player,metrics},i)=>(
            <div key={player.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${C.border}22` }}>
              <div style={{ fontSize:13, fontWeight:700, color:i<3?C.gold:C.muted, width:22, textAlign:'center' }}>
                {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.white }}>{player.username||player.alias||'?'}</div>
                <div style={{ fontSize:11, color:C.muted }}>{metrics.attended}/{metrics.totalEvents} events · {metrics.attendancePct}% attendance</div>
              </div>
              <ReliabilityBadge score={metrics.reliabilityScore}/>
            </div>
          ))}
        </div>
      )}

      {/* Needs attention */}
      {atRisk.length>0&&(
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16, border:`1px solid ${C.red}33` }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.red, marginBottom:4 }}>⚠️ Needs Attention</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Absent 3 or more events in a row</div>
          {atRisk.map(({player,metrics})=>(
            <div key={player.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.border}22` }}>
              <div style={{ fontSize:14, color:C.white }}>{player.username||player.alias||'?'}</div>
              <div style={{ fontSize:13, fontWeight:700, color:C.red }}>{metrics.consecutiveMisses} missed</div>
            </div>
          ))}
        </div>
      )}

      {/* Top heroes */}
      {topHeroes.length>0&&(
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:4 }}>🦸 Joiner Heroes</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Members tracked in Joiner Registry</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {topHeroes.map(([hero,count])=>(
              <div key={hero} style={{ padding:'8px 12px', borderRadius:20, background:C.gold+'18', border:`1px solid ${C.gold}33` }}>
                <span style={{ color:C.gold, fontWeight:600, fontSize:13 }}>✓ {hero}</span>
                <span style={{ color:C.muted, fontSize:12, marginLeft:6 }}>×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countries */}
      {topCountries.length>0&&(
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:12 }}>🌏 Countries</div>
          {topCountries.map(([c,n])=>(
            <div key={c} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:14, color:C.icy }}>{c}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:80, height:6, borderRadius:3, background:C.border, overflow:'hidden' }}>
                  <div style={{ width:`${(n/players.length)*100}%`, height:'100%', background:C.gold, borderRadius:3 }}/>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:C.gold, width:20, textAlign:'right' }}>{n}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {players.length===0&&(
        <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>Add members to see intel</div>
      )}
    </div>
  );
}

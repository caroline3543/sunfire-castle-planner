import { useState, useEffect, useRef } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newSvsPlan, newRallySlot, newJoinerSlot } from '../../data/playerSchema.js';
import { SheetHandle, Field } from '../common/Primitives.jsx';
import { AlliancePicker } from '../common/AlliancePicker.jsx';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal.jsx';
import { LiveRallyRoom } from './LiveRallyRoom.jsx';
import { JOINER_META } from '../../data/joinerMeta.js';

// ── Hero suggestion from meta table ───────────────────────────
// Given the leader player's heroes, find the best matching meta formation
function suggestJoinerHeroes(leaderPlayer, slotType) {
  if (!leaderPlayer) return null;

  const leaderHeroes = (leaderPlayer.joinerHeroes||[])
    .filter(jh => jh.skillLevel >= 5)
    .map(jh => jh.hero);

  if (leaderHeroes.length === 0) return null;

  // Determine formation type from slot type
  const isDefense = slotType?.toLowerCase().includes('garrison') ||
                    slotType?.toLowerCase().includes('reinforcement') ||
                    slotType === 'Counter Rally';
  const formationType = isDefense ? 'Defense' : 'Offense';

  // Score each meta formation by how many of the leader's heroes appear as leaders
  let bestFormation = null;
  let bestScore = -1;

  for (const gen of JOINER_META) {
    for (const f of gen.formations) {
      const leaderStr = f.leaders.join(' ').toLowerCase();
      let score = 0;
      for (const hero of leaderHeroes) {
        if (leaderStr.includes(hero.toLowerCase())) score += 2;
      }
      // Prefer matching formation type
      if (f.type.toLowerCase().includes(formationType.toLowerCase())) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestFormation = { ...f, gen: gen.gen, genLabel: gen.genLabel };
      }
    }
  }

  if (!bestFormation || bestScore === 0) return null;

  return {
    formation: bestFormation,
    suggestedHeroes: [
      bestFormation.j1, bestFormation.j2,
      bestFormation.j3, bestFormation.j4,
    ].filter(Boolean).map(h => h.replace(/\*/g,'').replace(/\*\*/g,'').trim()),
    alternatives: [bestFormation.alt1, bestFormation.alt2].filter(Boolean),
    comments: bestFormation.comments || '',
    genLabel: bestFormation.genLabel,
  };
}

// ── Constants ──────────────────────────────────────────────────
const RALLY_TYPES = ['Main Rally','Counter Rally','Counter-Counter','Switch Fight','Garrison Entry','Reinforcement','Custom'];
const RALLY_ICONS = {
  'Main Rally':'⚔️','Counter Rally':'🛡️','Counter-Counter':'🔄',
  'Switch Fight':'⚡','Garrison Entry':'🏰','Reinforcement':'🔰','Custom':'📋',
};
const RALLY_COLORS = {
  'Main Rally':'#F5A623','Counter Rally':'#FF453A','Counter-Counter':'#FF8C00',
  'Switch Fight':'#30D158','Garrison Entry':'#6B8CAE','Reinforcement':'#7BAE8C','Custom':'#A8C4D8',
};
const RATIO_PRESETS = ['60/40/0','50/20/30','48/4/48','40/60/0','60/0/40','0/40/60','50/50/0'];
const RALLY_DURATIONS = [1,3,5];

// ── Joiner Slot Row ────────────────────────────────────────────
function JoinerSlotRow({ slot, index, players, onUpdate, allAssignedIds }) {
  const [open, setOpen] = useState(false);

  const player        = players.find(p => p.id === slot.playerId);
  const playerJoiners = player
    ? (player.joinerHeroes||[]).filter(jh => jh.skillLevel >= 5).map(jh => jh.hero)
    : [];

  const isComplete = !!(slot.playerName && slot.heroName);
  const isUnavail  = slot.confirmed === false && slot.playerId;

  // Replacement suggestions — must have the required hero, not already assigned
  const suggestions = isUnavail && slot.heroName
    ? players
        .filter(p => p.id !== slot.playerId)
        .filter(p => !allAssignedIds.has(p.id))
        .filter(p => p.availability?.present !== 'unavailable')
        .filter(p => (p.joinerHeroes||[]).some(jh => jh.hero === slot.heroName && jh.skillLevel >= 5))
        .slice(0, 3)
    : [];

  // Split players: with joiners first, then rest
  const withJoiners    = players.filter(p => (p.joinerHeroes||[]).some(jh => jh.skillLevel >= 5));
  const withoutJoiners = players.filter(p => !(p.joinerHeroes||[]).some(jh => jh.skillLevel >= 5));

  return (
    <div style={{ background: C.bg, borderRadius: 10, marginBottom: 6, border: `1px solid ${isComplete ? C.green + '33' : C.border + '44'}` }}>
      {/* Row header */}
      <div onClick={() => setOpen(!open)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor:'pointer' }}>
        {/* Completion dot */}
        <div style={{ width:22, height:22, borderRadius:'50%', background: isComplete ? C.green+'33' : C.border, border: `1.5px solid ${isComplete ? C.green : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: isComplete ? C.green : C.muted, flexShrink:0 }}>
          {isComplete ? '✓' : index+1}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          {slot.playerName ? (
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:14, fontWeight:700, color: isUnavail ? C.muted : C.white, textDecoration: isUnavail ? 'line-through' : 'none' }}>
                {slot.replacedBy ? slot.replacedBy.playerName : slot.playerName}
              </span>
              {slot.heroName && <span style={{ fontSize:12, color:C.gold, fontWeight:600 }}>→ {slot.replacedBy?.heroName || slot.heroName}</span>}
              {isUnavail && <span style={{ fontSize:11, color:C.red, fontWeight:600 }}>Unavailable</span>}
              {slot.replacedBy && <span style={{ fontSize:11, color:C.green }}>← sub</span>}
            </div>
          ) : (
            <span style={{ fontSize:14, color:C.muted }}>Assign member {index+1}</span>
          )}
          {/* No heroes warning */}
          {slot.playerId && playerJoiners.length === 0 && (
            <div style={{ fontSize:11, color:C.gold, marginTop:2 }}>⚠ No joiner heroes recorded — add in 🦸 Joiner Registry</div>
          )}
        </div>
        <span style={{ color:C.muted, fontSize:13 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding:'0 12px 12px' }}>

          {/* Player picker — heroes-first ordering */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Member</label>
            {players.length === 0 ? (
              <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>No members in roster</div>
            ) : (
              <div style={{ maxHeight:140, overflowY:'auto' }}>
                {withJoiners.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Has joiner heroes</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {withJoiners.map(p => {
                        const sel     = slot.playerId === p.id;
                        const already = allAssignedIds.has(p.id) && !sel;
                        return (
                          <button key={p.id} onClick={() => !already && onUpdate({...slot, playerId:p.id, playerName:p.username||p.alias||'', heroName:'', confirmed:true, replacedBy:null})}
                            style={{ padding:'5px 10px', borderRadius:14, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':already?C.border+'11':C.section, color:sel?C.gold:already?C.muted:C.icy, fontWeight:600, fontSize:12, cursor:already?'default':'pointer', opacity:already?0.5:1 }}>
                            {p.username||p.alias}
                            <span style={{ fontSize:10, color:sel?C.gold:C.muted }}> ·{(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).length}🦸</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {withoutJoiners.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>No heroes recorded</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {withoutJoiners.map(p => {
                        const sel     = slot.playerId === p.id;
                        const already = allAssignedIds.has(p.id) && !sel;
                        return (
                          <button key={p.id} onClick={() => !already && onUpdate({...slot, playerId:p.id, playerName:p.username||p.alias||'', heroName:'', confirmed:true, replacedBy:null})}
                            style={{ padding:'5px 10px', borderRadius:14, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:already?'default':'pointer', opacity:already?0.5:1 }}>
                            {p.username||p.alias}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hero picker */}
          {slot.playerId && playerJoiners.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Hero to bring</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {playerJoiners.map(hero => {
                  const sel = slot.heroName === hero;
                  return (
                    <button key={hero} onClick={() => onUpdate({...slot, heroName:hero})}
                      style={{ padding:'6px 12px', borderRadius:14, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                      ✓ {hero}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {slot.playerId && playerJoiners.length === 0 && (
            <div style={{ background:C.section, borderRadius:8, padding:'8px 12px', marginBottom:10, fontSize:12, color:C.muted }}>
              No Skill 5 joiner heroes for this member. Add them in the 🦸 Joiner Registry (Intel tab).
            </div>
          )}

          {/* Mark unavailable + clear */}
          {slot.playerId && (
            <div style={{ display:'flex', gap:8, marginBottom: suggestions.length > 0 ? 10 : 0 }}>
              <button onClick={() => onUpdate({...slot, confirmed: slot.confirmed===false ? true : false})}
                style={{ flex:1, height:36, borderRadius:8, border:`1px solid ${slot.confirmed===false?C.green:C.red}44`, background:slot.confirmed===false?C.green+'18':C.red+'18', color:slot.confirmed===false?C.green:C.red, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                {slot.confirmed===false ? '✓ Mark available' : '⚠ Mark unavailable'}
              </button>
              <button onClick={() => onUpdate({...slot, playerId:null, playerName:'', heroName:'', confirmed:true, replacedBy:null})}
                style={{ height:36, padding:'0 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'none', color:C.muted, fontSize:12, cursor:'pointer' }}>
                Clear
              </button>
            </div>
          )}

          {/* Replacement suggestions — excludes already-assigned */}
          {suggestions.length > 0 && (
            <div style={{ background:C.green+'0a', borderRadius:8, padding:10 }}>
              <div style={{ fontSize:11, color:C.green, fontWeight:700, marginBottom:6 }}>Suggested replacements (have {slot.heroName}):</div>
              {suggestions.map(p => (
                <button key={p.id} onClick={() => onUpdate({...slot, replacedBy:{playerId:p.id, playerName:p.username||p.alias, heroName:slot.heroName}})}
                  style={{ display:'block', width:'100%', padding:'7px 10px', marginBottom:4, borderRadius:8, border:`1px solid ${C.green}44`, background:C.green+'18', color:C.green, fontWeight:600, fontSize:13, cursor:'pointer', textAlign:'left' }}>
                  ＋ {p.username||p.alias} → {slot.heroName}{p.furnaceLevel ? ` · ${p.furnaceLevel}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rally Slot Card ────────────────────────────────────────────
function RallySlotCard({ slot, index, players, totalSlots, onUpdate, onDelete, onMoveUp, onMoveDown, onGoToMembers }) {
  const [open, setOpen]               = useState(index === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const color         = RALLY_COLORS[slot.type] || C.gold;
  const icon          = RALLY_ICONS[slot.type]  || '⚔️';
  const filledJoiners = slot.joiners.filter(j => j.playerName && j.heroName).length;
  const allJoinersFilled = filledJoiners === 4;

  // Build set of all assigned player IDs in this slot (for dedup)
  const allAssignedIds = new Set(slot.joiners.filter(j => j.playerId).map(j => j.playerId));

  function upd(patch) { onUpdate({...slot, ...patch}); }
  function updJoiner(i, patch) {
    const joiners = [...slot.joiners];
    joiners[i] = {...joiners[i], ...patch};
    upd({joiners});
  }

  // Completion indicator
  const completionPct = Math.round(
    (!!slot.leaderName + filledJoiners / 4 * 0.8 + !!slot.ratio * 0.1) / 1.9 * 100
  );

  return (
    <div style={{ background:C.card, borderRadius:14, marginBottom:12, border:`1px solid ${color}44`, overflow:'hidden' }}>
      {/* Completion bar */}
      <div style={{ height:3, background:C.border }}>
        <div style={{ height:'100%', width:`${completionPct}%`, background:allJoinersFilled&&slot.leaderName?C.green:color, transition:'width 300ms ease' }}/>
      </div>

      {/* Header */}
      <div onClick={() => setOpen(!open)} style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{slot.type}</div>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:color+'22', color, fontWeight:700 }}>{slot.rallyDuration}min</span>
            {slot.ratio && <span style={{ fontSize:11, color:C.muted }}>{slot.ratio}</span>}
          </div>
          <div style={{ fontSize:13, color:C.icy }}>
            {slot.leaderName
              ? <span style={{ color:C.white, fontWeight:600 }}>{slot.leaderName}</span>
              : <span style={{ color:C.red+'cc', fontWeight:600 }}>No leader ⚠</span>}
            <span style={{ color:C.muted }}> · {filledJoiners}/4 joiners</span>
          </div>
        </div>
        {/* Reorder + delete */}
        <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
          {index > 0 && (
            <button onClick={e=>{e.stopPropagation();onMoveUp();}} style={{ width:28, height:28, borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↑</button>
          )}
          {index < totalSlots-1 && (
            <button onClick={e=>{e.stopPropagation();onMoveDown();}} style={{ width:28, height:28, borderRadius:8, background:C.section, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↓</button>
          )}
          <button onClick={e=>{e.stopPropagation();setConfirmDelete(true);}} style={{ width:28, height:28, borderRadius:8, background:'none', border:`1px solid ${C.red}33`, color:C.red+'88', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          <span style={{ color:C.muted, fontSize:14, marginLeft:2 }}>{open?'▲':'▼'}</span>
        </div>
      </div>

      {/* Delete confirmation inline */}
      {confirmDelete && (
        <div style={{ margin:'0 16px 14px', background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:10, padding:12 }}>
          <div style={{ fontSize:13, color:C.white, marginBottom:10, textAlign:'center' }}>
            Delete this {slot.type} slot?{filledJoiners > 0 ? ` (${filledJoiners} joiners assigned)` : ''} This cannot be undone.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setConfirmDelete(false)} style={{ flex:1, height:40, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>Cancel</button>
            <button onClick={()=>{onDelete(slot.id);vibe([20,20,20]);}} style={{ flex:2, height:40, borderRadius:10, background:C.red, color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Delete slot</button>
          </div>
        </div>
      )}

      {open && !confirmDelete && (
        <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${C.border}22` }}>

          {/* Rally type */}
          <div style={{ marginBottom:14, marginTop:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Type</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {RALLY_TYPES.map(type => { const sel=slot.type===type; const c=RALLY_COLORS[type]; return (
                <button key={type} onClick={()=>upd({type})} style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${sel?c:C.border}`, background:sel?c+'22':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  {RALLY_ICONS[type]} {type}
                </button>
              ); })}
            </div>
          </div>

          {/* Leader — all players, Rally Leads highlighted */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Rally leader</label>
            {players.length === 0 ? (
              <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>No members yet. <button onClick={onGoToMembers} style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:0, textDecoration:'underline' }}>Go to Members →</button></div>
            ) : (
              <div>
                {players.filter(p=>p.roles?.includes('Rally Lead')).length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Rally leads</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {players.filter(p=>p.roles?.includes('Rally Lead')).map(p => {
                        const sel=slot.leaderId===p.id;
                        return (
                          <button key={p.id} onClick={()=>upd({leaderId:p.id,leaderName:p.username||p.alias})}
                            style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.gold+'44'}`, background:sel?color+'22':C.gold+'0a', color:sel?color:C.gold, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                            {p.username||p.alias}{p.furnaceLevel?` · ${p.furnaceLevel}`:''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {players.filter(p=>!p.roles?.includes('Rally Lead')).length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Other members</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {players.filter(p=>!p.roles?.includes('Rally Lead')).map(p => {
                        const sel=slot.leaderId===p.id;
                        return (
                          <button key={p.id} onClick={()=>upd({leaderId:p.id,leaderName:p.username||p.alias})}
                            style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${sel?color:C.border}`, background:sel?color+'22':C.section, color:sel?color:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                            {p.username||p.alias}{p.furnaceLevel?` · ${p.furnaceLevel}`:''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {players.filter(p=>p.roles?.includes('Rally Lead')).length===0&&(
                  <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                    No Rally Lead roles set. <button onClick={onGoToMembers} style={{ background:'none', border:'none', color:C.gold, fontSize:12, cursor:'pointer', padding:0, textDecoration:'underline' }}>Assign roles in Members →</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rally duration */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Rally duration</label>
            <div style={{ display:'flex', gap:8 }}>
              {RALLY_DURATIONS.map(d => (
                <button key={d} onClick={()=>upd({rallyDuration:d})}
                  style={{ flex:1, height:48, borderRadius:10, border:`1px solid ${slot.rallyDuration===d?color:C.border}`, background:slot.rallyDuration===d?color+'22':C.section, color:slot.rallyDuration===d?color:C.muted, fontWeight:700, fontSize:15, cursor:'pointer' }}>
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Troop ratio */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Troop ratio <span style={{ fontWeight:400 }}>(Infantry / Lancer / Marksman)</span></label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:slot.ratio==='Custom'?8:0 }}>
              {RATIO_PRESETS.map(r => {
                const sel=slot.ratio===r;
                return (
                  <button key={r} onClick={()=>upd({ratio:r})}
                    style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${sel?C.icy:C.border}`, background:sel?C.icy+'22':C.section, color:sel?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                    {r}
                  </button>
                );
              })}
              <button onClick={()=>upd({ratio:'Custom'})} style={{ padding:'6px 12px', borderRadius:16, border:`1px solid ${slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy:C.border}`, background:slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy+'22':C.section, color:slot.ratio&&!RATIO_PRESETS.includes(slot.ratio)?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>Custom</button>
            </div>
            {/* Custom ratio input */}
            {(slot.ratio === 'Custom' || (slot.ratio && !RATIO_PRESETS.includes(slot.ratio))) && (
              <input
                value={slot.ratio==='Custom'?'':slot.ratio}
                onChange={e=>upd({ratio:e.target.value})}
                placeholder="e.g. 55/35/10"
                style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit', marginTop:6 }}
              />
            )}
          </div>

          {/* FC Troop requirements */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Minimum troop tier required</label>
            <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Members below these tiers shouldn't join this rally.</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[['🛡️ Infantry','infantry',C.inf],['⚔️ Lancer','lancer',C.lan],['🏹 Marksman','marksman',C.mar]].map(([label,key,tc])=>(
                <div key={key}>
                  <div style={{ fontSize:11, color:tc, fontWeight:700, marginBottom:4 }}>{label}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {['FC1','FC2','FC3','FC4','FC5'].map(fc=>{
                      const sel=(slot.troopReqs||{})[key]===fc;
                      return (
                        <button key={fc} onClick={()=>upd({troopReqs:{...(slot.troopReqs||{}), [key]:sel?null:fc}})}
                          style={{ height:32, borderRadius:8, border:`1px solid ${sel?tc:C.border}`, background:sel?tc+'22':C.section, color:sel?tc:C.muted, fontWeight:sel?700:400, fontSize:12, cursor:'pointer' }}>
                          {fc}+
                        </button>
                      );
                    })}
                    <button onClick={()=>upd({troopReqs:{...(slot.troopReqs||{}), [key]:null}})}
                      style={{ height:28, borderRadius:8, border:`1px solid ${C.border}`, background:'none', color:C.muted, fontSize:11, cursor:'pointer' }}>Any</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero suggestions from meta table */}
          {(()=>{
            const leaderPlayer = players.find(p=>p.id===slot.leaderId);
            const suggestion   = suggestJoinerHeroes(leaderPlayer, slot.type);
            return (
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Requested joiner heroes</label>
                {suggestion ? (
                  <div>
                    <div style={{ background:C.gold+'0a', border:`1px solid ${C.gold}33`, borderRadius:10, padding:12, marginBottom:8 }}>
                      <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:4 }}>💡 Suggested from meta — {suggestion.genLabel}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                        {suggestion.suggestedHeroes.map(hero=>{
                          const requested=(slot.requestedHeroes||[]).includes(hero);
                          return (
                            <button key={hero} onClick={()=>{
                              const curr=slot.requestedHeroes||[];
                              upd({requestedHeroes:requested?curr.filter(h=>h!==hero):[...curr,hero]});
                            }} style={{ padding:'5px 12px', borderRadius:14, border:`1px solid ${requested?C.gold:C.border}`, background:requested?C.gold+'22':C.section, color:requested?C.gold:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                              {requested?'✓ ':''}{hero}
                            </button>
                          );
                        })}
                      </div>
                      {suggestion.alternatives.length>0&&<div style={{ fontSize:11, color:C.muted }}>Alternatives: {suggestion.alternatives.join(', ')}</div>}
                      {suggestion.comments&&<div style={{ fontSize:11, color:C.muted, marginTop:4, fontStyle:'italic' }}>{suggestion.comments}</div>}
                    </div>
                  </div>
                ) : (
                  <div style={{ background:C.section, borderRadius:10, padding:12, marginBottom:8 }}>
                    <div style={{ fontSize:12, color:C.muted }}>{slot.leaderId ? 'No meta match found for this leader\'s heroes. Add their joiner heroes in 🦸 Joiner Registry.' : 'Assign a leader to see hero suggestions from the meta table.'}</div>
                  </div>
                )}
                {/* Manual override */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {['Jessie','Seo-Yoon','Jasser','Patrick','Mia','Norah','Philly','Logan','Reina','Sergey','Wu Ming','Gwen','Lynn'].map(hero=>{
                    const requested=(slot.requestedHeroes||[]).includes(hero);
                    const inSuggestion=suggestion?.suggestedHeroes.includes(hero);
                    if(inSuggestion)return null; // already shown above
                    return (
                      <button key={hero} onClick={()=>{
                        const curr=slot.requestedHeroes||[];
                        upd({requestedHeroes:requested?curr.filter(h=>h!==hero):[...curr,hero]});
                      }} style={{ padding:'4px 10px', borderRadius:14, border:`1px solid ${requested?C.icy:C.border}`, background:requested?C.icy+'22':C.section, color:requested?C.icy:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                        {requested?'✓ ':''}{hero}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Priority joiners */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:4 }}>Priority joiners</label>
            <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>These 4 members must join first, each bringing a specific hero.</div>
            <div style={{ background:C.section, borderRadius:10, padding:10 }}>
              {slot.joiners.map((joiner, i) => (
                <JoinerSlotRow
                  key={joiner.id}
                  slot={joiner}
                  index={i}
                  players={players}
                  onUpdate={patch => updJoiner(i, patch)}
                  allAssignedIds={allAssignedIds}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Strategy notes</label>
            <textarea value={slot.notes||''} onChange={e=>upd({notes:e.target.value})} placeholder="e.g. Counter lands 1s after main, switch fight immediately after…"
              style={{ width:'100%', minHeight:64, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:14, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan Create Sheet ──────────────────────────────────────────
function PlanCreateSheet({ open, onClose, onSave, existingTags }) {
  const [name, setName]       = useState('');
  const [allianceTag, setTag] = useState('');
  const [date, setDate]       = useState(new Date().toISOString().slice(0,10));

  useEffect(() => {
    if (!open) return;
    function h(e){ if(e.key==='Escape') onClose(); }
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[open,onClose]);

  if (!open) return null;
  function save() {
    onSave(newSvsPlan({name:name||'Battle Plan',allianceTag,date}));
    setName(''); setTag(''); setDate(new Date().toISOString().slice(0,10));
    onClose(); vibe(8);
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 80px' }}>
        <SheetHandle/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>New Battle Plan</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        <Field label="Plan name">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. SvS Week 3 Defence"
            style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <Field label="Alliance">
          <AlliancePicker value={allianceTag} onChange={setTag} existingTags={existingTags}/>
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </Field>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Create Plan</button>
        </div>
      </div>
    </div>
  );
}

// ── Plan Detail ────────────────────────────────────────────────
function PlanDetail({ plan, players, onUpdate, onBack, onGoLive, onGoToMembers }) {
  function updPlan(patch) { onUpdate({...plan,...patch}); }

  function addSlot() {
    const type = (plan.rallySlots||[]).length === 0 ? 'Main Rally' : 'Counter Rally';
    updPlan({rallySlots:[...(plan.rallySlots||[]), newRallySlot({type})]});
    vibe(8);
  }

  function updSlot(updated) { updPlan({rallySlots:(plan.rallySlots||[]).map(s=>s.id===updated.id?updated:s)}); }
  function delSlot(id)      { updPlan({rallySlots:(plan.rallySlots||[]).filter(s=>s.id!==id)}); }

  function moveSlot(index, direction) {
    const slots = [...(plan.rallySlots||[])];
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    [slots[index], slots[target]] = [slots[target], slots[index]];
    updPlan({rallySlots:slots});
  }

  const slots      = plan.rallySlots || [];
  const readySlots = slots.filter(s=>s.leaderName);

  return (
    <div style={{ padding:'16px 20px 0', paddingBottom:readySlots.length>0?100:0 }}>
      {/* Back + breadcrumb */}
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:4, padding:0 }}>
        ← Battle Plans
      </button>
      <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>{plan.name||'Battle Plan'}</div>

      {/* Plan header */}
      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{plan.name||'Battle Plan'}</div>
            <div style={{ fontSize:13, color:C.muted }}>{plan.date}{plan.allianceTag?` · [${plan.allianceTag}]`:''}</div>
          </div>
          {/* Status — larger, clearer */}
          <div style={{ display:'flex', gap:6 }}>
            {[['draft','Draft',C.muted],['live','🔴 Live',C.red],['completed','✓ Done',C.green]].map(([s,l,c]) => (
              <button key={s} onClick={()=>updPlan({status:s})}
                style={{ height:36, padding:'0 12px', borderRadius:14, border:`1px solid ${plan.status===s?c:C.border}`, background:plan.status===s?c+'22':C.section, color:plan.status===s?c:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {/* Strategy notes at the top */}
        <textarea value={plan.notes||''} onChange={e=>updPlan({notes:e.target.value})} placeholder="Strategy overview — target, objective, key timings…"
          style={{ width:'100%', minHeight:60, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
      </div>

      {/* Rally slots */}
      {slots.length === 0 && (
        <div style={{ textAlign:'center', padding:'32px 20px', background:C.section, borderRadius:12, marginBottom:16 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>⚔️</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>No rally slots yet</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Add a slot for each rally in this plan — main rally, counter, switch fight, etc.</div>
          <button onClick={addSlot} style={{ height:48, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>＋ Add first slot</button>
        </div>
      )}

      {slots.map((slot, i) => (
        <RallySlotCard
          key={slot.id}
          slot={slot}
          index={i}
          totalSlots={slots.length}
          players={players}
          onUpdate={updSlot}
          onDelete={delSlot}
          onMoveUp={()=>moveSlot(i,-1)}
          onMoveDown={()=>moveSlot(i,1)}
          onGoToMembers={onGoToMembers}
        />
      ))}

      {slots.length > 0 && (
        <button onClick={addSlot} style={{ width:'100%', height:48, borderRadius:12, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>
          ＋ Add rally slot
        </button>
      )}

      {/* Sticky Go Live bar */}
      {readySlots.length > 0 && (
        <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:C.bg, borderTop:`1px solid ${C.border}`, padding:'12px 20px 20px', boxSizing:'border-box', zIndex:50 }}>
          <button onClick={()=>onGoLive(plan)} style={{ width:'100%', height:56, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:17, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            🔴 Go Live — {readySlots.length} slot{readySlots.length!==1?'s':''}
            <span style={{ fontSize:13, fontWeight:400, opacity:0.8 }}>
              {readySlots.map(s=>s.leaderName).join(' · ')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── BattleTab ──────────────────────────────────────────────────
export function BattleTab({ plans, players, events, onSave, onDelete, showToast, onGoToMembers }) {
  const [view, setView]                 = useState('plans');
  const [activePlanId, setActivePlanId] = useState(null);
  const [createOpen, setCreateOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [liveRoomPlan, setLiveRoomPlan] = useState(null);

  const activePlan   = plans.find(p=>p.id===activePlanId);
  const existingTags = [...new Set(players.map(p=>p.allianceTag).filter(Boolean))];

  function createPlan(plan)   { onSave([...plans,plan]); setActivePlanId(plan.id); showToast('Plan created ✓'); }
  function updatePlan(updated){ onSave(plans.map(p=>p.id===updated.id?updated:p)); }

  function deletePlan(id) {
    onDelete(id);
    setActivePlanId(null);
    setDeleteTarget(null);
    showToast('Plan deleted');
  }

  function duplicatePlan(plan) {
    const copy = {...plan, id:Math.random().toString(36).slice(2)+Date.now().toString(36), name:`${plan.name||'Plan'} (copy)`, status:'draft', createdAt:new Date().toISOString()};
    onSave([...plans,copy]); showToast('Plan duplicated ✓'); vibe(8);
  }

  function handleGoLive(plan) { setLiveRoomPlan(plan); setView('liveRoom'); }

  if (view==='liveRoom') {
    return <LiveRallyRoom onBack={()=>setView('plans')} players={players} planData={liveRoomPlan}/>;
  }

  if (activePlan) {
    return (
      <PlanDetail
        plan={activePlan}
        players={players}
        onUpdate={updatePlan}
        onBack={()=>setActivePlanId(null)}
        onGoLive={handleGoLive}
        onGoToMembers={onGoToMembers}
      />
    );
  }

  return (
    <div style={{ padding:'16px 20px 0' }}>
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <button onClick={()=>setCreateOpen(true)} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋ New Plan</button>
        <button onClick={()=>{setLiveRoomPlan(null);setView('liveRoom');}} style={{ flex:1, height:52, borderRadius:12, background:C.red+'22', border:`1px solid ${C.red}44`, color:C.red, fontWeight:700, fontSize:14, cursor:'pointer' }}>🔴 Live Room</button>
      </div>

      {plans.length===0&&(
        <div style={{ textAlign:'center', padding:'40px 20px' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>⚔️</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>No plans yet</div>
          <div style={{ fontSize:15, color:C.muted, marginBottom:24 }}>Build your rally assignments before the battle. Assign leaders, joiners, and heroes. Then go live.</div>
          <button onClick={()=>setCreateOpen(true)} style={{ height:52, padding:'0 32px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋ Create first plan</button>
        </div>
      )}

      {plans.map(plan => {
        const slots   = plan.rallySlots||[];
        const leaders = slots.filter(s=>s.leaderName).map(s=>`${RALLY_ICONS[s.type]||'⚔️'} ${s.leaderName}`);
        return (
          <div key={plan.id} onClick={()=>setActivePlanId(plan.id)} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${plan.status==='live'?C.red+'66':C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{plan.name||'Battle Plan'}</div>
                <div style={{ fontSize:12, color:C.muted }}>{plan.date}{plan.allianceTag?` · [${plan.allianceTag}]`:''}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0, marginLeft:10 }}>
                <span style={{ fontSize:11, fontWeight:700, color:plan.status==='live'?C.red:plan.status==='completed'?C.green:C.muted, padding:'2px 8px', borderRadius:10, background:(plan.status==='live'?C.red:plan.status==='completed'?C.green:C.muted)+'18' }}>
                  {plan.status==='live'?'🔴 Live':plan.status==='completed'?'✓ Done':'Draft'}
                </span>
                <div style={{ display:'flex', gap:12 }}>
                  <button onClick={e=>{e.stopPropagation();duplicatePlan(plan);}} style={{ fontSize:11, color:C.icy, background:'none', border:'none', cursor:'pointer', padding:0 }}>Duplicate</button>
                  <button onClick={e=>{e.stopPropagation();setDeleteTarget(plan.id);}} style={{ fontSize:11, color:C.red+'88', background:'none', border:'none', cursor:'pointer', padding:0 }}>Delete</button>
                </div>
              </div>
            </div>
            {/* Leaders preview — most useful at-a-glance info */}
            {leaders.length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
                {leaders.map((l,i) => (
                  <span key={i} style={{ fontSize:12, padding:'2px 8px', borderRadius:8, background:C.section, color:C.icy, fontWeight:600 }}>{l}</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:12, color:C.muted }}>No leaders assigned yet</div>
            )}
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
              {slots.reduce((acc,s)=>acc+s.joiners.filter(j=>j.playerName&&j.heroName).length,0)} joiner assignments
            </div>
          </div>
        );
      })}

      <PlanCreateSheet open={createOpen} onClose={()=>setCreateOpen(false)} onSave={createPlan} existingTags={existingTags}/>

      {deleteTarget && (
        <DeleteConfirmModal
          message={`Delete "${plans.find(p=>p.id===deleteTarget)?.name||'this plan'}"? All rally slots and joiner assignments will be lost.`}
          onConfirm={()=>deletePlan(deleteTarget)}
          onCancel={()=>setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

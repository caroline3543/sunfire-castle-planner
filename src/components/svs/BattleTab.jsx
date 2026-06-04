import { useState } from 'react';
import { C, STRATEGY_TYPES, TEAM_ROLES } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { fmtDate } from '../../utils/dates.js';
import { newSvsPlan, newRally, newReinforcement, newAssignment } from '../../data/playerSchema.js';
import { calcSendTime, calcImpactTime, parseHMS, formatHMS, secsToHuman, getRallyWarnings, getCounterWarnings } from '../../services/svsTimingService.js';
import { SheetHandle, Field, Inp, Sel, Warning } from '../common/Primitives.jsx';
import { uid } from '../../utils/dates.js';

// ── Small countdown hook ───────────────────────────────────────
function useCountdown(targetHMS) {
  const [rem, setRem] = useState(null);
  useState(() => {
    if (!targetHMS) { setRem(null); return; }
    function tick() { const n=new Date(); const s=n.getHours()*3600+n.getMinutes()*60+n.getSeconds(); setRem(parseHMS(targetHMS)-s); }
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  });
  return rem;
}

// ── Plan Create Sheet ──────────────────────────────────────────
function PlanCreateSheet({ open, onClose, onSave }) {
  const [name, setName]         = useState('');
  const [strategy, setStrategy] = useState('Counter Rally');
  const [allianceTag, setTag]   = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0,10));
  const [target, setTarget]     = useState('');

  if (!open) return null;

  function save() {
    onSave(newSvsPlan({ name:name||strategy, strategy, allianceTag, date, targetImpactTime:target }));
    setName(''); setStrategy('Counter Rally'); setTag(''); setDate(new Date().toISOString().slice(0,10)); setTarget('');
    onClose(); vibe(8);
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 80px', maxHeight:'85vh', overflowY:'auto' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>New Battle Plan</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        <Field label="Strategy">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {STRATEGY_TYPES.map(s=><button key={s} onClick={()=>setStrategy(s)} style={{ padding:'10px 14px', borderRadius:12, border:`1px solid ${strategy===s?C.gold:C.border}`, background:strategy===s?C.gold+'18':C.section, color:strategy===s?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', textAlign:'left' }}>{s}</button>)}
          </div>
        </Field>
        <Field label="Name (optional)"><Inp value={name} onChange={setName} placeholder={strategy}/></Field>
        <Field label="Alliance Tag"><Inp value={allianceTag} onChange={setTag} placeholder="R3K"/></Field>
        <Field label="Date"><Inp type="date" value={date} onChange={setDate}/></Field>
        <Field label="Target hit time" hint="When your rallies should hit"><Inp value={target} onChange={setTarget} placeholder="12:00:00"/></Field>
        <button onClick={save} style={{ width:'100%', height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Create Plan</button>
      </div>
    </div>
  );
}

// ── Rally Row ──────────────────────────────────────────────────
function RallyRow({ rally, planTarget, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);

  function upd(k,v) {
    const updated = { ...rally, [k]:v };
    if ((k==='launchTime'||k==='marchDuration') && updated.launchTime && updated.marchDuration>0) {
      updated.impactTime = calcImpactTime(updated.launchTime, updated.marchDuration);
    }
    onUpdate(updated);
  }

  return (
    <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }} onClick={()=>setOpen(!open)}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:C.white }}>
            {rally.isStrong?'💪':rally.isCounter?'⚔️':rally.isDecoy?'🎭':'🏹'} {rally.label||`Rally ${rally.order}`}
          </div>
          <div style={{ fontSize:12, color:C.muted }}>
            {rally.launchTime?`Launch ${rally.launchTime}`:''}{rally.impactTime?` → Impact ${rally.impactTime}`:''}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:rally.status==='launched'?C.green+'22':rally.status==='confirmed'?C.gold+'22':C.border+'22', color:rally.status==='launched'?C.green:rally.status==='confirmed'?C.gold:C.muted, fontWeight:600 }}>{rally.status}</span>
          <button onClick={e=>{e.stopPropagation();onDelete(rally.id);}} style={{ background:'none', border:'none', color:C.red+'88', fontSize:16, cursor:'pointer', padding:'4px' }}>✕</button>
          <span style={{ fontSize:16, color:C.muted }}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open&&(
        <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          <Field label="Label"><Inp value={rally.label} onChange={v=>upd('label',v)} placeholder={`Rally ${rally.order}`}/></Field>
          <Field label="Rally leader"><Inp value={rally.leadName} onChange={v=>upd('leadName',v)} placeholder="Player name"/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="Launch time"><Inp value={rally.launchTime} onChange={v=>upd('launchTime',v)} placeholder="11:59:20"/></Field>
            <Field label="March time (seconds)"><Inp value={rally.marchDuration||''} onChange={v=>upd('marchDuration',parseInt(v)||0)} inputMode="numeric" placeholder="40"/></Field>
          </div>
          {rally.impactTime&&<div style={{ fontSize:13, color:C.gold, marginBottom:12, fontWeight:600 }}>Impact: {rally.impactTime}</div>}
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {[['💪 Strong','isStrong'],['⚔️ Counter','isCounter'],['🎭 Decoy','isDecoy']].map(([l,k])=>(
              <button key={k} onClick={()=>upd(k,!rally[k])} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${rally[k]?C.gold:C.border}`, background:rally[k]?C.gold+'22':C.section, color:rally[k]?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>{l}</button>
            ))}
          </div>
          <Field label="Status">
            <div style={{ display:'flex', gap:8 }}>
              {['planned','confirmed','launched','missed'].map(s=>(
                <button key={s} onClick={()=>upd('status',s)} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${rally.status===s?C.gold:C.border}`, background:rally.status===s?C.gold+'22':C.section, color:rally.status===s?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Notes"><Inp value={rally.notes} onChange={v=>upd('notes',v)} placeholder="Notes…"/></Field>
        </div>
      )}
    </div>
  );
}

// ── Reinf Row ──────────────────────────────────────────────────
function ReinfRow({ reinf, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);

  function upd(k,v) {
    const updated = { ...reinf, [k]:v };
    if ((k==='targetArrivalTime'||k==='marchDuration') && updated.targetArrivalTime && updated.marchDuration>0) {
      updated.sendTime = calcSendTime(updated.targetArrivalTime, updated.marchDuration);
    }
    onUpdate(updated);
  }

  return (
    <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }} onClick={()=>setOpen(!open)}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:C.white }}>🏰 {reinf.playerName||'Reinforcement'}</div>
          <div style={{ fontSize:12, color:C.muted }}>{reinf.sendTime?`Send at ${reinf.sendTime}`:''}{reinf.targetArrivalTime?` → Arrive ${reinf.targetArrivalTime}`:''}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:reinf.status==='sent'?C.green+'22':C.border+'22', color:reinf.status==='sent'?C.green:C.muted, fontWeight:600 }}>{reinf.status}</span>
          <button onClick={e=>{e.stopPropagation();onDelete(reinf.id);}} style={{ background:'none', border:'none', color:C.red+'88', fontSize:16, cursor:'pointer', padding:'4px' }}>✕</button>
          <span style={{ fontSize:16, color:C.muted }}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open&&(
        <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          <Field label="Player Name"><Inp value={reinf.playerName} onChange={v=>upd('playerName',v)} placeholder="Player name"/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="Target arrival time"><Inp value={reinf.targetArrivalTime} onChange={v=>upd('targetArrivalTime',v)} placeholder="12:00:00"/></Field>
            <Field label="March time (seconds)"><Inp value={reinf.marchDuration||''} onChange={v=>upd('marchDuration',parseInt(v)||0)} inputMode="numeric" placeholder="40"/></Field>
          </div>
          {reinf.sendTime&&<div style={{ fontSize:13, color:C.green, marginBottom:12, fontWeight:600 }}>Send at: {reinf.sendTime}</div>}
          <Field label="Status">
            <div style={{ display:'flex', gap:8 }}>
              {['pending','confirmed','sent','missed'].map(s=>(
                <button key={s} onClick={()=>upd('status',s)} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${reinf.status===s?C.green:C.border}`, background:reinf.status===s?C.green+'22':C.section, color:reinf.status===s?C.green:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Notes"><Inp value={reinf.notes} onChange={v=>upd('notes',v)} placeholder="Notes…"/></Field>
        </div>
      )}
    </div>
  );
}

// ── Plan Detail ────────────────────────────────────────────────
function PlanDetail({ plan, players, onUpdate, onBack }) {
  const [subTab, setSubTab] = useState('rallies');

  function updPlan(patch) { onUpdate({ ...plan, ...patch }); }
  function updRally(updated) { updPlan({ rallies: plan.rallies.map(r=>r.id===updated.id?updated:r) }); }
  function delRally(id) { updPlan({ rallies: plan.rallies.filter(r=>r.id!==id) }); }
  function addRally() { updPlan({ rallies: [...plan.rallies, newRally({ order:plan.rallies.length+1 })] }); vibe(8); }
  function updReinf(updated) { updPlan({ reinforcements: plan.reinforcements.map(r=>r.id===updated.id?updated:r) }); }
  function delReinf(id) { updPlan({ reinforcements: plan.reinforcements.filter(r=>r.id!==id) }); }
  function addReinf() { updPlan({ reinforcements: [...plan.reinforcements, newReinforcement()] }); vibe(8); }

  const rallyWarnings = getRallyWarnings(plan.rallies||[]);
  const countdownSecs = useCountdown(plan.targetImpactTime);

  const SUB = [{id:'rallies',label:'⚔️ Rallies'},{id:'reinf',label:'🏰 Reinf'},{id:'notes',label:'📝 Notes'}];

  return (
    <div style={{ padding:'16px 20px 0' }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:16, padding:0 }}>← Back to Plans</button>

      <div style={{ background:C.card, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:C.white }}>{plan.name||plan.strategy}</div>
            <div style={{ fontSize:13, color:C.muted }}>{plan.date}{plan.allianceTag?` · [${plan.allianceTag}]`:''} · {plan.strategy}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {['draft','live','completed'].map(s=>(
              <button key={s} onClick={()=>updPlan({status:s})} style={{ height:32, padding:'0 10px', borderRadius:16, border:`1px solid ${plan.status===s?C.gold:C.border}`, background:plan.status===s?C.gold+'22':C.section, color:plan.status===s?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>{s}</button>
            ))}
          </div>
        </div>
        {plan.targetImpactTime&&(
          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Target Impact</div>
            <div style={{ fontSize:24, fontWeight:700, color:countdownSecs!=null&&countdownSecs<0?C.red:C.gold }}>{plan.targetImpactTime}</div>
            {countdownSecs!=null&&<div style={{ fontSize:13, color:countdownSecs<0?C.red:C.icy }}>{countdownSecs>=0?`${secsToHuman(countdownSecs)} remaining`:'Impact passed'}</div>}
          </div>
        )}
      </div>

      {rallyWarnings.map((w,i)=><Warning key={i} text={w}/>)}

      <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto' }}>
        {SUB.map(t=><button key={t.id} onClick={()=>setSubTab(t.id)} style={{ padding:'8px 16px', borderRadius:20, whiteSpace:'nowrap', background:subTab===t.id?C.gold+'22':C.section, border:`1px solid ${subTab===t.id?C.gold:C.border}`, color:subTab===t.id?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{t.label}</button>)}
      </div>

      {subTab==='rallies'&&(
        <div>
          {(plan.rallies||[]).map(r=><RallyRow key={r.id} rally={r} planTarget={plan.targetImpactTime} onUpdate={updRally} onDelete={delRally}/>)}
          <button onClick={addRally} style={{ width:'100%', height:44, borderRadius:12, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>＋ Add Rally</button>
        </div>
      )}
      {subTab==='reinf'&&(
        <div>
          <div style={{ background:C.section, borderRadius:12, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:4 }}>Reinforcement Timing Calculator</div>
            <div style={{ fontSize:12, color:C.muted }}>Enter target arrival time and march duration in each row — send time is calculated automatically.</div>
          </div>
          {(plan.reinforcements||[]).map(r=><ReinfRow key={r.id} reinf={r} onUpdate={updReinf} onDelete={delReinf}/>)}
          <button onClick={addReinf} style={{ width:'100%', height:44, borderRadius:12, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>＋ Add Reinforcement</button>
        </div>
      )}
      {subTab==='notes'&&(
        <div>
          <Field label="Notes">
            <textarea value={plan.notes||''} onChange={e=>updPlan({notes:e.target.value})} placeholder="Pre-battle notes, target info, strategy details…" style={{ width:'100%', minHeight:120, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
          </Field>
          {plan.status==='completed'&&(
            <Field label="Post-battle notes">
              <textarea value={plan.postBattleNotes||''} onChange={e=>updPlan({postBattleNotes:e.target.value})} placeholder="What happened? What worked? What didn't?" style={{ width:'100%', minHeight:100, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

// ── BattleTab (main export) ────────────────────────────────────
export function BattleTab({ plans, players, events, onSave, onDelete, showToast }) {
  const [activePlanId, setActivePlanId] = useState(null);
  const [createOpen, setCreateOpen]     = useState(false);

  const activePlan = plans.find(p=>p.id===activePlanId);

  function createPlan(plan) {
    onSave([...plans, plan]);
    setActivePlanId(plan.id);
    showToast('Battle plan created ✓');
  }

  function updatePlan(updated) {
    onSave(plans.map(p=>p.id===updated.id?updated:p));
  }

  function deletePlan(id) {
    if (!window.confirm('Delete this battle plan?')) return;
    onDelete(id);
    setActivePlanId(null);
    showToast('Plan deleted');
  }

  function duplicatePlan(plan) {
    const copy = {
      ...plan,
      id: Math.random().toString(36).slice(2)+Date.now().toString(36),
      name: `${plan.name||plan.strategy} (copy)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    onSave([...plans, copy]);
    showToast('Plan duplicated ✓');
    vibe(8);
  }

  if (activePlan) {
    return <PlanDetail plan={activePlan} players={players} onUpdate={updatePlan} onBack={()=>setActivePlanId(null)}/>;
  }

  const statusColor = s => s==='live'?C.green:s==='completed'?C.muted:C.icy;

  return (
    <div style={{ padding:'16px 20px 0' }}>
      <button onClick={()=>setCreateOpen(true)} style={{ width:'100%', height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer', marginBottom:20 }}>
        ＋ New Plan
      </button>

      {plans.length===0&&(
        <div style={{ textAlign:'center', padding:'40px 20px' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>⚔️</div>
          <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>No plans yet</div>
          <div style={{ fontSize:15, color:C.muted, marginBottom:24 }}>Create a plan to coordinate rallies, reinforcements, and team assignments.</div>
          <button onClick={()=>setCreateOpen(true)} style={{ height:52, padding:'0 32px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>
            ＋ Create your first plan
          </button>
        </div>
      )}

      {plans.map(plan=>(
        <div key={plan.id} onClick={()=>setActivePlanId(plan.id)} style={{ background:C.card, borderRadius:12, padding:'14px 16px', marginBottom:10, cursor:'pointer', border:`1px solid ${plan.status==='live'?C.green+'44':C.border+'44'}`, WebkitTapHighlightColor:'transparent' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:16, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{plan.name||plan.strategy}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{plan.date}{plan.allianceTag?` · [${plan.allianceTag}]`:''} · {plan.strategy}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
              <span style={{ fontSize:11, fontWeight:700, color:statusColor(plan.status), padding:'2px 8px', borderRadius:10, background:statusColor(plan.status)+'18', border:`1px solid ${statusColor(plan.status)}33` }}>
                {plan.status==='live'?'🔴 Live':plan.status==='completed'?'✓ Done':'Draft'}
              </span>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={e=>{e.stopPropagation();duplicatePlan(plan);}} style={{ fontSize:11, color:C.icy, background:'none', border:'none', cursor:'pointer', padding:'2px 0' }}>Duplicate</button>
                <button onClick={e=>{e.stopPropagation();deletePlan(plan.id);}} style={{ fontSize:11, color:C.red+'88', background:'none', border:'none', cursor:'pointer', padding:'2px 0' }}>Delete</button>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, fontSize:12, color:C.muted }}>
            <span>⚔️ {(plan.rallies||[]).length} rallies</span>
            <span>🏰 {(plan.reinforcements||[]).length} reinf</span>
            {plan.targetImpactTime&&<span>🎯 {plan.targetImpactTime}</span>}
          </div>
        </div>
      ))}

      <PlanCreateSheet open={createOpen} onClose={()=>setCreateOpen(false)} onSave={createPlan}/>
    </div>
  );
}

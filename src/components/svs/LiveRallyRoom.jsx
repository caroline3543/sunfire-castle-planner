import { useState, useEffect, useRef } from 'react';
import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import {
  parseMarchInput, validateMarchInput, fmtMarch,
  parseImpactInput, validateImpactInput,
} from '../../services/rallyTimingParser.js';

// ── Constants ──────────────────────────────────────────────────
const RALLY_TYPES = ['Main Rally','Counter Rally','Counter-Counter','Switch Fight','Garrison Entry','Reinforcement','Custom'];
const RALLY_COLORS = {
  'Main Rally':'#F5A623','Counter Rally':'#FF453A','Counter-Counter':'#FF8C00',
  'Switch Fight':'#30D158','Garrison Entry':'#6B8CAE','Reinforcement':'#7BAE8C','Custom':'#A8C4D8',
};
const OFFSETS   = [-5,-2,-1,0,1,2,5];
const STORAGE_KEY = 'svs_live_rally_room_v2';
const RALLY_DURATIONS = [1,3,5];
const RATIO_PRESETS = ['60/40/0','50/20/30','48/4/48','40/60/0','60/0/40','0/40/60','50/50/0'];

const DEFAULT_MSG =
`{type} — {name}
Impact: {impact} UTC
Open rally at: {open} UTC

Priority joiners:
{joiners}

Ratio: {ratio}
Join now. Do not solo.`;

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function utcNowSecs() { const n=new Date(); return n.getUTCHours()*3600+n.getUTCMinutes()*60+n.getUTCSeconds(); }
function utcNowStr() { const n=new Date(); return [n.getUTCHours(),n.getUTCMinutes(),n.getUTCSeconds()].map(x=>String(x).padStart(2,'0')).join(':'); }

function secsToHHMMSS(s) {
  if (s==null||isNaN(s)) return '--:--:--';
  const abs=Math.abs(Math.round(s));
  const str=[Math.floor(abs/3600),Math.floor((abs%3600)/60),abs%60].map(x=>String(x).padStart(2,'0')).join(':');
  return s<0?`-${str}`:str;
}

function calcSendSecs(impactSecs,marchSecs,offset=0) {
  if (impactSecs==null||marchSecs==null) return null;
  return impactSecs - marchSecs + offset;
}

function calcRallyOpenSecs(impactSecs,marchSecs,rallyDurationMins) {
  if (impactSecs==null||marchSecs==null||rallyDurationMins==null) return null;
  return impactSecs - marchSecs - (rallyDurationMins*60);
}

function fmtSend(secs) {
  if (secs==null) return '--:--';
  const norm=((secs%86400)+86400)%86400;
  const h=Math.floor(norm/3600), m=Math.floor((norm%3600)/60), s=norm%60;
  return s===0?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`:`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Stage system — Leader-only phases ─────────────────────────
// secsToOpen  = seconds until "open rally" time (impactTime - marchSecs - rallyDuration*60)
// secsToImpact = seconds until rally hits target
function getTimerStage(secsToOpen, secsToImpact) {
  if (secsToImpact == null) return null;

  // Phase 5: Impact passed
  if (secsToImpact <= 0) {
    return { stage:'impact', label:'✓ Impact', color:'#30D158', bg:'#0A2A14' };
  }

  // Phase 4: Rally is open — counting down to impact
  if (secsToOpen != null && secsToOpen <= 0) {
    return { stage:'filling', label:'✓ Rally Open — Joiners Joining', color:'#30D158', bg:'#0A2A14' };
  }

  // No rally duration set — simplified phases only
  if (secsToOpen == null) {
    if (secsToImpact <= 10) return { stage:'open_now',  label:'⚠ OPEN RALLY NOW',        color:'#FF453A', bg:'#3A0A0A' };
    if (secsToImpact <= 30) return { stage:'prepare',   label:'Prepare To Open Rally',   color:'#FF8C00', bg:'#2A1500' };
    if (secsToImpact <= 90) return { stage:'get_ready', label:'Get Ready',               color:'#A8C4D8', bg:'#0A1A2A' };
    return null;
  }

  // Phase 3: Open rally now
  if (secsToOpen <= 0)  return { stage:'open_now',  label:'⚠ OPEN RALLY NOW',        color:'#FF453A', bg:'#3A0A0A' };
  // Phase 2: Prepare to open
  if (secsToOpen <= 5)  return { stage:'prepare',   label:'Prepare To Open Rally',   color:'#FF8C00', bg:'#2A1500' };
  if (secsToOpen <= 30) return { stage:'get_ready', label:'Get Ready',               color:'#A8C4D8', bg:'#0A1A2A' };
  if (secsToOpen <= 120)return { stage:'standby',   label:'Stand By',                color:'#5A7A94', bg:C.card   };
  return null;
}

// ── Persistence ────────────────────────────────────────────────
function loadState() {
  try {
    const r=localStorage.getItem(STORAGE_KEY);
    if (r) {
      const p=JSON.parse(r);
      return {
        timers:        Array.isArray(p.timers)        ? p.timers        : [],
        marchRegistry: Array.isArray(p.marchRegistry) ? p.marchRegistry : [],
        calculator: {
          impactTimeRaw:   p.calculator?.impactTimeRaw   || '',
          impactSecs:      p.calculator?.impactSecs      || null,
          rallyDuration:   p.calculator?.rallyDuration   || 3,
          leaders:         Array.isArray(p.calculator?.leaders) ? p.calculator.leaders : [],
          messageTemplate: p.calculator?.messageTemplate || DEFAULT_MSG,
        },
      };
    }
  } catch {}
  return null;
}

function saveState(s) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(s)); } catch {} }

const DEFAULT_STATE = {
  timers:[],
  marchRegistry:[],
  calculator:{ impactTimeRaw:'', impactSecs:null, rallyDuration:3, leaders:[], messageTemplate:DEFAULT_MSG },
};

// ── Smart inputs ───────────────────────────────────────────────
function MarchInput({ value, onChange, placeholder='e.g. 412' }) {
  const [raw,setRaw]=useState('');
  const [prev,setPrev]=useState(null);
  const [err,setErr]=useState(null);
  useEffect(()=>{ if(value!=null&&raw==='') setRaw(fmtMarch(value)); },[value]);
  function handle(input) {
    setRaw(input);
    if (!input){ setPrev(null);setErr(null);onChange(null);return; }
    const v=validateMarchInput(input);
    if(v.error)      {setErr(v.error);setPrev(null);onChange(null);}
    else if(v.valid) {setErr(null);setPrev(fmtMarch(v.totalSecs));onChange(v.totalSecs);}
    else             {setErr(null);setPrev(null);onChange(null);}
  }
  return (
    <div>
      <input value={raw} onChange={e=>handle(e.target.value)} placeholder={placeholder} inputMode="decimal"
        style={{ width:'100%', background:C.section, border:`1px solid ${err?C.red:prev?C.green:C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
      {prev&&<div style={{ fontSize:11, color:C.green, marginTop:3 }}>{prev}</div>}
      {err &&<div style={{ fontSize:11, color:C.red,   marginTop:3 }}>⚠ {err}</div>}
    </div>
  );
}

function ImpactInput({ value, onChange, large=false }) {
  const [raw,setRaw]=useState(value||'');
  const [disp,setDisp]=useState(null);
  const [err,setErr]=useState(null);
  const [past,setPast]=useState(false);
  function handle(input) {
    setRaw(input);
    if(!input){setDisp(null);setErr(null);setPast(false);onChange(null,null);return;}
    const v=validateImpactInput(input);
    if(v.error)     {setErr(v.error);setDisp(null);setPast(false);onChange(null,null);}
    else if(v.valid){setErr(null);setDisp(v.display);setPast(v.totalSecs<utcNowSecs());onChange(v.display,v.totalSecs);}
  }
  return (
    <div>
      <input value={raw} onChange={e=>handle(e.target.value)} placeholder="HH:mm  e.g. 2200" inputMode="decimal"
        style={{ width:'100%', background:C.section, border:`1px solid ${err?C.red:disp?C.green:C.border}`, borderRadius:10, padding:large?'14px':'10px 12px', fontSize:large?22:16, color:C.white, boxSizing:'border-box', fontFamily:'monospace', letterSpacing:'0.04em' }}/>
      {disp&&!err&&<div style={{ fontSize:12, color:past?C.red:C.green, marginTop:4 }}>{past?`⚠ ${disp} UTC — already passed today`:`→ ${disp} UTC`}</div>}
      {err&&<div style={{ fontSize:12, color:C.red, marginTop:4 }}>⚠ {err}</div>}
    </div>
  );
}

// ── UTC Clock ──────────────────────────────────────────────────
function UTCClock() {
  const [time,setTime]=useState(utcNowStr());
  useEffect(()=>{const id=setInterval(()=>setTime(utcNowStr()),1000);return()=>clearInterval(id);},[]);
  const n=new Date(), left=86400-(n.getUTCHours()*3600+n.getUTCMinutes()*60+n.getUTCSeconds());
  return (
    <div style={{ background:C.section, borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>UTC Time</div>
        <div style={{ fontSize:22, fontWeight:700, color:C.gold, fontVariantNumeric:'tabular-nums' }}>{time}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Reset in</div>
        <div style={{ fontSize:14, fontWeight:600, color:C.icy }}>{secsToHHMMSS(left)}</div>
      </div>
    </div>
  );
}

// ── Timer Card ─────────────────────────────────────────────────
function TimerCard({ timer, onEdit, onDelete, onLeaderMode, onUpdateJoiner }) {
  const [now,setNow]=useState(utcNowSecs());
  useEffect(()=>{const id=setInterval(()=>setNow(utcNowSecs()),250);return()=>clearInterval(id);},[]);

  const parsed     = parseImpactInput(timer.impactTime);
  const impactSecs = parsed?.totalSecs??null;
  const marchSecs  = calcSendSecs(impactSecs,timer.marchSecs,0);        // when rally auto-marches
  const openSecs   = timer.rallyDuration
    ? calcRallyOpenSecs(impactSecs,timer.marchSecs,timer.rallyDuration)  // when leader must open
    : null;

  const secsToOpen   = openSecs   != null ? openSecs   - now : null;
  const secsToImpact = impactSecs != null ? impactSecs - now : null;

  const stage  = getTimerStage(secsToOpen, secsToImpact);
  const color  = RALLY_COLORS[timer.type]||C.gold;
  const cardBg = stage?.bg ?? C.card;

  // Progress bar: fills over last 5 min before open (or impact if no rally duration)
  const progressTarget = openSecs ?? impactSecs;
  const secsToTarget   = progressTarget != null ? progressTarget - now : null;
  const WINDOW   = 300;
  const progress = secsToTarget != null ? Math.max(0,Math.min(100,((WINDOW-Math.max(0,secsToTarget))/WINDOW)*100)) : 0;

  // What to count down to — changes per phase
  // Phase 1–3: count to rally open time
  // Phase 4+: count to impact
  const isRallyOpen  = stage?.stage === 'filling' || stage?.stage === 'impact';
  const bigCountdown = isRallyOpen ? secsToImpact : (secsToOpen ?? secsToImpact);
  const bigLabel     = isRallyOpen
    ? (stage?.stage === 'impact' ? '✓ Impact' : 'Impact in')
    : (openSecs != null ? 'Open rally in' : 'Countdown');

  return (
    <div style={{ background:cardBg, borderRadius:14, overflow:'hidden', marginBottom:12, border:`1px solid ${stage?stage.color+'66':C.border}`, boxShadow:stage&&stage.stage!=='standby'?`0 0 16px ${stage.color}33`:'none', transition:'background 600ms ease, border 600ms ease, box-shadow 600ms ease' }}>
      {/* Progress bar */}
      <div style={{ height:4, background:C.border }}>
        <div style={{ height:'100%', width:`${progress}%`, background:stage?stage.color:color, transition:'width 250ms linear, background 600ms ease' }}/>
      </div>

      <div style={{ padding:'14px 16px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:color }}/>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{timer.name||timer.type}</div>
              {timer.rallyDuration&&<span style={{ fontSize:11, padding:'2px 7px', borderRadius:8, background:color+'22', color, fontWeight:700 }}>{timer.rallyDuration}min</span>}
            </div>
            <div style={{ fontSize:12, color:C.muted }}>{timer.type}{timer.ratio?` · ${timer.ratio}`:''}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>onLeaderMode(timer)} style={{ height:32, padding:'0 10px', borderRadius:16, background:color+'22', border:`1px solid ${color}44`, color, fontWeight:600, fontSize:12, cursor:'pointer' }}>Full screen</button>
            <button onClick={()=>onEdit(timer)} style={{ height:32, padding:'0 10px', borderRadius:16, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:12, cursor:'pointer' }}>Edit</button>
            <button onClick={()=>onDelete(timer.id)} style={{ height:32, width:32, borderRadius:16, background:'none', border:'none', color:C.red+'88', fontSize:16, cursor:'pointer' }}>✕</button>
          </div>
        </div>

        {/* Stage message */}
        {stage&&(
          <div style={{ background:stage.color+'22', border:`1px solid ${stage.color}55`, borderRadius:8, padding:'7px 14px', marginBottom:8, textAlign:'center' }}>
            <div style={{ fontSize:stage.stage==='open_now'?18:14, fontWeight:800, color:stage.color, letterSpacing:stage.stage==='open_now'?'0.04em':0 }}>
              {stage.label}
            </div>
          </div>
        )}

        {/* Big countdown */}
        <div style={{ textAlign:'center', marginBottom:10 }}>
          <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{bigLabel}</div>
          <div style={{ fontSize:48, fontWeight:900, color:stage?stage.color:C.white, fontVariantNumeric:'tabular-nums', lineHeight:1, letterSpacing:'0.02em' }}>
            {bigCountdown!=null?secsToHHMMSS(bigCountdown):'--:--:--'}
          </div>
        </div>

        {/* Time grid — open / marches / impact */}
        <div style={{ display:'grid', gridTemplateColumns:openSecs!=null?'1fr 1fr 1fr':'1fr 1fr', gap:6, marginBottom:timer.joiners?.length>0?10:0 }}>
          {openSecs!=null&&(
            <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
              <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Open rally</div>
              <div style={{ fontSize:13, fontWeight:700, color:isRallyOpen?C.green:C.gold, fontVariantNumeric:'tabular-nums' }}>
                {isRallyOpen?'✓ Opened':fmtSend(openSecs)+' UTC'}
              </div>
            </div>
          )}
          <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Marches at</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.icy, fontVariantNumeric:'tabular-nums' }}>{marchSecs!=null?fmtSend(marchSecs)+' UTC':'—'}</div>
          </div>
          <div style={{ background:C.section, borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Impact</div>
            <div style={{ fontSize:13, fontWeight:700, color:stage?.stage==='impact'?C.green:C.gold, fontVariantNumeric:'tabular-nums' }}>
              {stage?.stage==='impact'?'✓ ':''}{timer.impactTime||'--:--'} UTC
            </div>
          </div>
        </div>

        {/* Joiners — screen share view */}
        {timer.joiners?.filter(j=>j.playerName).length>0&&(
          <div style={{ background:C.section, borderRadius:10, padding:'10px 12px', marginTop:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
              Priority joiners · {timer.ratio||''}
            </div>
            {timer.joiners.filter(j=>j.playerName).map((j,i)=>(
              <div key={j.id||i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:i<timer.joiners.filter(x=>x.playerName).length-1?`1px solid ${C.border}22`:'none' }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:j.confirmed===false?C.red+'33':C.gold+'22', border:`1px solid ${j.confirmed===false?C.red:C.gold}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:j.confirmed===false?C.red:C.gold, flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:j.confirmed===false?C.muted:C.white, textDecoration:j.confirmed===false?'line-through':'none' }}>
                    {j.replacedBy?j.replacedBy.playerName:j.playerName}
                  </span>
                  {j.confirmed===false&&j.replacedBy&&<span style={{ fontSize:11, color:C.green }}> ← sub</span>}
                </div>
                {(j.replacedBy?.heroName||j.heroName)&&(
                  <span style={{ fontSize:12, color:C.gold, fontWeight:600, flexShrink:0 }}>→ {j.replacedBy?.heroName||j.heroName}</span>
                )}
                {onUpdateJoiner&&(
                  <button onClick={()=>onUpdateJoiner(timer.id,i,{confirmed:j.confirmed===false?true:false})}
                    style={{ fontSize:10, height:22, padding:'0 6px', borderRadius:6, border:`1px solid ${j.confirmed===false?C.green+'44':C.red+'44'}`, background:'none', color:j.confirmed===false?C.green:C.red, cursor:'pointer', flexShrink:0 }}>
                    {j.confirmed===false?'In':'Out'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {timer.notes&&<div style={{ fontSize:12, color:C.icy, marginTop:8, fontStyle:'italic' }}>"{timer.notes}"</div>}
      </div>
    </div>
  );
}

// ── Timer Edit Sheet ───────────────────────────────────────────
function TimerSheet({ timer, open, onClose, onSave, prefillImpact }) {
  const [t,setT]=useState(()=>timer||newTimerObj());
  useEffect(()=>{
    if(open){const base=timer?{...timer}:newTimerObj();if(!timer&&prefillImpact)base.impactTime=prefillImpact;setT(base);}
  },[open,timer?.id,prefillImpact]);
  useEffect(()=>{
    if(!open)return;
    function h(e){if(e.key==='Escape')onClose();}
    document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h);
  },[open,onClose]);
  function upd(k,v){setT(prev=>({...prev,[k]:v}));}
  const parsed=parseImpactInput(t.impactTime);
  const impactSecs=parsed?.totalSecs??null;
  const marchSecs=calcSendSecs(impactSecs,t.marchSecs,0);
  const openSecs=t.rallyDuration?calcRallyOpenSecs(impactSecs,t.marchSecs,t.rallyDuration):null;
  if(!open)return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:400, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'16px 20px 80px' }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 16px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{timer?'Edit timer':'New timer'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Name</label>
          <input value={t.name} onChange={e=>upd('name',e.target.value)} placeholder="e.g. Caroline counter"
            style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Type</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {RALLY_TYPES.map(type=>{const sel=t.type===type;const col=RALLY_COLORS[type];return(
              <button key={type} onClick={()=>upd('type',type)} style={{ padding:'8px 14px', borderRadius:20, minHeight:36, border:`1px solid ${sel?col:C.border}`, background:sel?col+'22':C.section, color:sel?col:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{type}</button>
            );})}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Target impact time (UTC)</label>
          <ImpactInput value={t.impactTime} onChange={(disp,secs)=>upd('impactTime',disp||'')} large/>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>March time</label>
          <MarchInput value={t.marchSecs} onChange={v=>upd('marchSecs',v)}/>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Rally duration</label>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>upd('rallyDuration',null)} style={{ flex:1, height:40, borderRadius:10, border:`1px solid ${!t.rallyDuration?C.gold:C.border}`, background:!t.rallyDuration?C.gold+'22':C.section, color:!t.rallyDuration?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>None</button>
            {RALLY_DURATIONS.map(d=>(
              <button key={d} onClick={()=>upd('rallyDuration',d)} style={{ flex:1, height:40, borderRadius:10, border:`1px solid ${t.rallyDuration===d?C.gold:C.border}`, background:t.rallyDuration===d?C.gold+'22':C.section, color:t.rallyDuration===d?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>{d}min</button>
            ))}
          </div>
        </div>
        {openSecs!=null&&(
          <div style={{ background:C.section, borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, textAlign:'center' }}>
              {[['Open rally at',fmtSend(openSecs),C.gold],['March at',fmtSend(marchSecs),C.icy],['Impact',t.impactTime,C.gold]].map(([l,v,c])=>(
                <div key={l}><div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>{l}</div><div style={{ fontSize:14, fontWeight:700, color:c }}>{v} UTC</div></div>
              ))}
            </div>
          </div>
        )}
        {!openSecs&&marchSecs!=null&&(
          <div style={{ background:C.section, borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Send at</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.green }}>{fmtSend(marchSecs)} UTC</div>
          </div>
        )}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Notes</label>
          <textarea value={t.notes} onChange={e=>upd('notes',e.target.value)} placeholder="Any instructions…"
            style={{ width:'100%', minHeight:64, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={()=>{onSave(t);onClose();vibe(8);}} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}>Save timer</button>
        </div>
      </div>
    </div>
  );
}

function newTimerObj(){ return {id:uid(),name:'',type:'Main Rally',impactTime:'',marchSecs:null,rallyDuration:3,ratio:'',notes:'',joiners:[]}; }

// ── Leader Mode ────────────────────────────────────────────────
function LeaderMode({ timer, onClose }) {
  const [now,setNow]=useState(utcNowSecs());
  const lastStageRef=useRef(null);
  useEffect(()=>{const id=setInterval(()=>setNow(utcNowSecs()),250);return()=>clearInterval(id);},[]);
  useEffect(()=>{
    function h(e){if(e.key==='Escape')onClose();}
    document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h);
  },[onClose]);

  const parsed=parseImpactInput(timer.impactTime);
  const impactSecs=parsed?.totalSecs??null;
  const marchSecs=calcSendSecs(impactSecs,timer.marchSecs,0);
  const openSecs=timer.rallyDuration?calcRallyOpenSecs(impactSecs,timer.marchSecs,timer.rallyDuration):null;
  const secsToOpen=openSecs!=null?openSecs-now:null;
  const secsToImpact=impactSecs!=null?impactSecs-now:null;
  const stage=getTimerStage(secsToOpen,secsToImpact);
  const color=RALLY_COLORS[timer.type]||C.gold;
  const isRallyOpen=stage?.stage==='filling'||stage?.stage==='impact';
  const bigCountdown=isRallyOpen?secsToImpact:(secsToOpen??secsToImpact);
  const bigLabel=isRallyOpen?(stage?.stage==='impact'?'✓ Impact':'Impact in'):(openSecs!=null?'Open rally in':'Countdown');

  useEffect(()=>{
    if(!stage)return;
    if(stage.stage!==lastStageRef.current){
      lastStageRef.current=stage.stage;
      if(stage.stage==='open_now') vibe([100,50,100,50,200]);
      else if(stage.stage==='prepare') vibe([50,30,50]);
      else if(stage.stage==='filling') vibe([30,20,30]);
      else vibe(20);
    }
  },[stage?.stage]);

  return (
    <div style={{ position:'fixed', inset:0, background:'#050D1A', zIndex:900, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, overflow:'auto' }}>
      <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer' }}>✕</button>

      <div style={{ fontSize:14, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>{timer.name||timer.type}</div>
      {timer.ratio&&<div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Ratio: {timer.ratio}</div>}

      {stage&&<div style={{ fontSize:stage.stage==='open_now'?26:18, fontWeight:800, color:stage.color, marginBottom:16, textAlign:'center' }}>{stage.label}</div>}

      <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{bigLabel}</div>
      <div style={{ fontSize:80, fontWeight:900, color:stage?stage.color:C.white, fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em', lineHeight:1, marginBottom:20, textAlign:'center' }}>
        {bigCountdown!=null?secsToHHMMSS(bigCountdown):'--:--:--'}
      </div>

      <div style={{ display:'flex', gap:20, marginBottom:20 }}>
        {openSecs!=null&&<div style={{ textAlign:'center' }}><div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Open rally</div><div style={{ fontSize:18, fontWeight:700, color:isRallyOpen?C.green:C.gold }}>{isRallyOpen?'✓ Opened':fmtSend(openSecs)+' UTC'}</div></div>}
        {marchSecs!=null&&<div style={{ textAlign:'center' }}><div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Marches at</div><div style={{ fontSize:18, fontWeight:700, color:C.icy }}>{fmtSend(marchSecs)} UTC</div></div>}
        {timer.impactTime&&<div style={{ textAlign:'center' }}><div style={{ fontSize:11, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Impact</div><div style={{ fontSize:18, fontWeight:700, color:stage?.stage==='impact'?C.green:C.gold }}>{stage?.stage==='impact'?'✓ ':''}{timer.impactTime} UTC</div></div>}
      </div>

      {/* Joiners — big for screen share */}
      {timer.joiners?.filter(j=>j.playerName).length>0&&(
        <div style={{ background:'#0A1628', borderRadius:12, padding:'12px 20px', marginBottom:16, width:'100%', maxWidth:360 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10, textAlign:'center' }}>Priority Joiners</div>
          {timer.joiners.filter(j=>j.playerName).map((j,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:i<timer.joiners.filter(x=>x.playerName).length-1?`1px solid ${C.border}22`:'none' }}>
              <div style={{ fontSize:13, fontWeight:700, color:j.confirmed===false?C.muted:C.white, textDecoration:j.confirmed===false?'line-through':'none', flex:1 }}>
                {j.replacedBy?j.replacedBy.playerName:j.playerName}
                {j.confirmed===false&&j.replacedBy&&<span style={{ color:C.green }}> ← {j.replacedBy.playerName}</span>}
              </div>
              {(j.replacedBy?.heroName||j.heroName)&&<span style={{ fontSize:12, color:C.gold, fontWeight:700 }}>→ {j.replacedBy?.heroName||j.heroName}</span>}
            </div>
          ))}
        </div>
      )}

      {timer.notes&&<div style={{ fontSize:14, color:C.icy, fontStyle:'italic', textAlign:'center', maxWidth:320, marginBottom:12 }}>"{timer.notes}"</div>}
      <button onClick={onClose} style={{ position:'absolute', bottom:40, height:48, padding:'0 32px', borderRadius:24, background:C.section, border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:15, cursor:'pointer' }}>Exit full screen</button>
    </div>
  );
}

// ── Calculator ─────────────────────────────────────────────────
function Calculator({ calc, onChange, registry, onStartTimers }) {
  const [now,setNow]=useState(utcNowSecs());
  const [copied,setCopied]=useState(null);
  const [editingRow,setEditingRow]=useState(null);
  const [showTemplate,setShowTemplate]=useState(false);
  useEffect(()=>{const id=setInterval(()=>setNow(utcNowSecs()),1000);return()=>clearInterval(id);},[]);

  const impactSecs=calc.impactSecs;

  function setImpact(disp,secs){ onChange({...calc,impactTimeRaw:disp||'',impactSecs:secs}); }
  function setRallyDuration(d){ onChange({...calc,rallyDuration:d,leaders:calc.leaders.map(l=>({...l,rallyDuration:d}))}); }

  function addFromRegistry(entry) {
    if(calc.leaders.some(l=>l.registryId===entry.id))return;
    onChange({...calc,leaders:[...calc.leaders,{id:uid(),registryId:entry.id,name:entry.name,type:entry.type||'Main Rally',marchSecs:entry.marchSecs,rallyDuration:calc.rallyDuration||3,offset:0,notes:''}]});
    vibe(8);
  }
  function removeRow(id){ onChange({...calc,leaders:calc.leaders.filter(l=>l.id!==id)}); }
  function updRow(id,patch){ onChange({...calc,leaders:calc.leaders.map(l=>l.id===id?{...l,...patch}:l)}); }

  function copyMsg(leader) {
    const impS=calc.impactSecs;
    const openS=leader.marchSecs&&impS?calcRallyOpenSecs(impS,leader.marchSecs,leader.rallyDuration||3):null;
    const sendS=calcSendSecs(impS,leader.marchSecs,leader.offset||0);

    // Build joiners list from calculator leader's joiner assignments
    const joinersText=(leader.joiners||[])
      .filter(j=>j.playerName)
      .map((j,i)=>`${i+1}. ${j.replacedBy?j.replacedBy.playerName:j.playerName} → ${j.replacedBy?.heroName||j.heroName||'TBD'}`)
      .join('\n') || 'Not yet assigned';

    const text=(calc.messageTemplate||DEFAULT_MSG)
      .replace('{type}',   leader.type||'Rally')
      .replace('{name}',   leader.name||'')
      .replace('{impact}', calc.impactTimeRaw||'--:--')
      .replace('{open}',   openS!=null?fmtSend(openS):'--:--')
      .replace('{send}',   sendS!=null?fmtSend(sendS):'--:--')
      .replace('{joiners}',joinersText)
      .replace('{ratio}',  leader.ratio||'');
    navigator.clipboard.writeText(text).then(()=>{setCopied(leader.id);setTimeout(()=>setCopied(null),2000);});
    vibe(8);
  }

  function handleStartTimers() {
    const ready=calc.leaders.filter(l=>l.marchSecs&&calc.impactSecs);
    if(!ready.length)return;
    const newTimers=ready.map(l=>({
      id:uid(),name:l.name||l.type,type:l.type||'Main Rally',
      impactTime:calc.impactTimeRaw,marchSecs:l.marchSecs,
      rallyDuration:l.rallyDuration||calc.rallyDuration||3,
      ratio:'',notes:l.notes||'',joiners:[],
    }));
    onStartTimers(newTimers);
  }

  const readyCount=calc.leaders.filter(l=>l.marchSecs&&impactSecs).length;

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>Send Calculator</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Set impact time, tap leader chips, press Start Timers.</div>

      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Target impact time (UTC)</label>
        <ImpactInput value={calc.impactTimeRaw} onChange={setImpact} large/>
      </div>

      {/* Rally duration — apply to all */}
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Rally duration <span style={{ fontWeight:400, color:C.muted }}>(apply to all)</span></label>
        <div style={{ display:'flex', gap:8 }}>
          {RALLY_DURATIONS.map(d=>(
            <button key={d} onClick={()=>setRallyDuration(d)}
              style={{ flex:1, height:44, borderRadius:10, border:`1px solid ${calc.rallyDuration===d?C.gold:C.border}`, background:calc.rallyDuration===d?C.gold+'22':C.section, color:calc.rallyDuration===d?C.gold:C.muted, fontWeight:700, fontSize:15, cursor:'pointer' }}>
              {d} min
            </button>
          ))}
        </div>
      </div>

      {/* Registry chips */}
      {registry.filter(r=>r.marchSecs).length>0&&(
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Saved leaders — tap to add</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {registry.filter(r=>r.marchSecs).map(entry=>{
              const already=calc.leaders.some(l=>l.registryId===entry.id);
              return (
                <button key={entry.id} onClick={()=>addFromRegistry(entry)} disabled={already}
                  style={{ padding:'8px 14px', borderRadius:20, minHeight:40, border:`1px solid ${already?C.border:C.gold}`, background:already?C.section:C.gold+'18', color:already?C.muted:C.gold, fontWeight:700, fontSize:14, cursor:already?'default':'pointer' }}>
                  {already?'✓ ':''}{entry.name} <span style={{ fontSize:12, opacity:0.7 }}>{fmtMarch(entry.marchSecs)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact table */}
      {calc.leaders.length>0&&(
        <div style={{ background:C.section, borderRadius:12, overflow:'hidden', marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 58px 80px 38px 44px', padding:'8px 14px', borderBottom:`1px solid ${C.border}` }}>
            {['Leader','March','Send at','Off.',''].map(h=>(
              <div key={h} style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</div>
            ))}
          </div>
          {calc.leaders.map((leader,i)=>{
            const openS=leader.marchSecs&&impactSecs?calcRallyOpenSecs(impactSecs,leader.marchSecs,leader.rallyDuration||3):null;
            const sendS=impactSecs&&leader.marchSecs?calcSendSecs(impactSecs,leader.marchSecs,leader.offset||0):null;
            const isEditing=editingRow===i;
            const color=RALLY_COLORS[leader.type]||C.gold;
            return (
              <div key={leader.id} style={{ borderBottom:i<calc.leaders.length-1?`1px solid ${C.border}22`:'none' }}>
                <div onClick={()=>setEditingRow(isEditing?null:i)} style={{ display:'grid', gridTemplateColumns:'1fr 58px 80px 38px 44px', padding:'10px 14px', cursor:'pointer', background:isEditing?C.card:'none', alignItems:'center' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
                      <div style={{ fontSize:14, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leader.name||'—'}</div>
                    </div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{leader.type} · {leader.rallyDuration||calc.rallyDuration||3}min</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.icy, fontVariantNumeric:'tabular-nums' }}>{leader.marchSecs?fmtMarch(leader.marchSecs):'—'}</div>
                  <div>
                    {openS!=null&&<div style={{ fontSize:11, color:C.gold, fontVariantNumeric:'tabular-nums' }}>Open {fmtSend(openS)}</div>}
                    {sendS!=null&&<div style={{ fontSize:12, fontWeight:700, color:C.green, fontVariantNumeric:'tabular-nums' }}>{fmtSend(sendS)}</div>}
                    {sendS==null&&<div style={{ fontSize:12, color:C.muted }}>—</div>}
                  </div>
                  <div style={{ fontSize:11, color:leader.offset?C.gold:C.muted }}>{leader.offset>0?`+${leader.offset}`:leader.offset||'+0'}</div>
                  <div style={{ display:'flex', gap:3, justifyContent:'flex-end' }}>
                    <button onClick={e=>{e.stopPropagation();copyMsg(leader);}} style={{ height:26, padding:'0 7px', borderRadius:7, background:copied===leader.id?C.green+'22':C.card, border:`1px solid ${copied===leader.id?C.green:C.border}`, color:copied===leader.id?C.green:C.muted, fontSize:10, cursor:'pointer' }}>
                      {copied===leader.id?'✓':'📋'}
                    </button>
                    <button onClick={e=>{e.stopPropagation();removeRow(leader.id);}} style={{ height:26, width:26, borderRadius:7, background:'none', border:'none', color:C.red+'88', fontSize:13, cursor:'pointer' }}>✕</button>
                  </div>
                </div>
                {isEditing&&(
                  <div style={{ padding:'8px 14px 12px', background:C.card, borderTop:`1px solid ${C.border}22` }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                      <div>
                        <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>March time</label>
                        <MarchInput value={leader.marchSecs} onChange={v=>updRow(leader.id,{marchSecs:v})}/>
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>Landing offset</label>
                        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                          {OFFSETS.map(o=>(
                            <button key={o} onClick={()=>updRow(leader.id,{offset:o})} style={{ padding:'4px 6px', borderRadius:6, border:`1px solid ${leader.offset===o?C.gold:C.border}`, background:leader.offset===o?C.gold+'22':C.section, color:leader.offset===o?C.gold:C.muted, fontWeight:600, fontSize:10, cursor:'pointer', minWidth:26 }}>
                              {o>0?`+${o}`:o}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>Rally duration (override)</label>
                      <div style={{ display:'flex', gap:6 }}>
                        {RALLY_DURATIONS.map(d=>(
                          <button key={d} onClick={()=>updRow(leader.id,{rallyDuration:d})} style={{ flex:1, height:34, borderRadius:8, border:`1px solid ${(leader.rallyDuration||calc.rallyDuration||3)===d?C.gold:C.border}`, background:(leader.rallyDuration||calc.rallyDuration||3)===d?C.gold+'22':C.section, color:(leader.rallyDuration||calc.rallyDuration||3)===d?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>{d}min</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, marginBottom:8, overflowX:'auto', paddingBottom:2 }}>
                      {RALLY_TYPES.slice(0,5).map(type=>{const sel=leader.type===type;const c=RALLY_COLORS[type];return(
                        <button key={type} onClick={()=>updRow(leader.id,{type})} style={{ padding:'5px 10px', borderRadius:12, whiteSpace:'nowrap', border:`1px solid ${sel?c:C.border}`, background:sel?c+'22':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:11, cursor:'pointer', flexShrink:0 }}>{type}</button>
                      );})}
                    </div>
                    <input value={leader.notes||''} onChange={e=>updRow(leader.id,{notes:e.target.value})} placeholder="Notes…"
                      style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:7, padding:'7px 10px', fontSize:12, color:C.icy, boxSizing:'border-box', fontFamily:'inherit' }}/>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={()=>{onChange({...calc,leaders:[...calc.leaders,{id:uid(),name:'',type:'Main Rally',marchSecs:null,rallyDuration:calc.rallyDuration||3,offset:0,notes:''}]});setEditingRow(calc.leaders.length);}}
            style={{ width:'100%', height:40, background:'none', border:'none', borderTop:`1px solid ${C.border}22`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
            ＋ Add manually
          </button>
        </div>
      )}

      {calc.leaders.length===0&&registry.filter(r=>r.marchSecs).length===0&&(
        <div style={{ textAlign:'center', padding:'20px 0', color:C.muted, fontSize:13 }}>Add leaders in 💾 March Times, then tap their chips here.</div>
      )}

      {readyCount>0&&(
        <button onClick={handleStartTimers} style={{ width:'100%', height:56, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:17, border:'none', cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          🔴 Start {readyCount} Timer{readyCount!==1?'s':''} → Live Room
        </button>
      )}

      <button onClick={()=>setShowTemplate(!showTemplate)} style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:'4px 0', marginBottom:8 }}>
        {showTemplate?'▾':'▸'} Edit message template
      </button>
      {showTemplate&&(
        <div style={{ background:C.section, borderRadius:10, padding:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Variables: {'{type}'} {'{name}'} {'{impact}'} {'{open}'} {'{joiners}'} {'{ratio}'}</div>
          <textarea value={calc.messageTemplate||DEFAULT_MSG} onChange={e=>onChange({...calc,messageTemplate:e.target.value})}
            style={{ width:'100%', minHeight:120, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:13, color:C.white, resize:'vertical', boxSizing:'border-box', fontFamily:'monospace' }}/>
          <button onClick={()=>onChange({...calc,messageTemplate:DEFAULT_MSG})} style={{ fontSize:12, color:C.muted, background:'none', border:'none', cursor:'pointer', padding:'4px 0' }}>Reset to default</button>
        </div>
      )}
    </div>
  );
}

// ── March Registry ─────────────────────────────────────────────
function MarchRegistry({ registry, onChange, players=[] }) {
  const [editingEntry,setEditingEntry]=useState(null);
  const [editOpen,setEditOpen]=useState(false);
  const rallyLeads=(players||[]).filter(p=>p.roles?.includes('Rally Lead'));

  function addFromRoster(player) {
    if(registry.some(r=>r.name===player.username))return;
    onChange([...registry,{id:uid(),name:player.username,marchSecs:player.marchSecs||null,type:'Main Rally'}]);
    vibe(8);
  }
  function saveEntry(entry){ onChange(registry.some(r=>r.id===entry.id)?registry.map(r=>r.id===entry.id?entry:r):[...registry,entry]); }
  function deleteEntry(id){ onChange(registry.filter(r=>r.id!==id)); }

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>March Times</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Saved leaders appear as chips in the calculator.</div>
      {rallyLeads.length>0&&(
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Add from roster</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {rallyLeads.map(p=>{
              const inReg=registry.some(r=>r.name===p.username);
              return (
                <button key={p.id} onClick={()=>addFromRoster(p)} disabled={inReg}
                  style={{ padding:'8px 14px', borderRadius:20, minHeight:38, border:`1px solid ${inReg?C.border:C.gold}`, background:inReg?C.section:C.gold+'18', color:inReg?C.muted:C.gold, fontWeight:600, fontSize:13, cursor:inReg?'default':'pointer' }}>
                  {inReg?'✓ ':''}{p.username}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {registry.map(entry=>(
        <div key={entry.id} style={{ background:C.section, borderRadius:10, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{entry.name}</div>
            <div style={{ fontSize:13, color:entry.marchSecs?C.green:C.muted }}>{entry.marchSecs?fmtMarch(entry.marchSecs):'No march time set'}</div>
          </div>
          <button onClick={()=>{setEditingEntry(entry);setEditOpen(true);}}
            style={{ height:36, padding:'0 14px', borderRadius:18, background:C.card, border:`1px solid ${C.border}`, color:C.icy, fontSize:13, cursor:'pointer' }}>✏️ Edit</button>
        </div>
      ))}
      <button onClick={()=>{setEditingEntry(null);setEditOpen(true);}}
        style={{ width:'100%', height:48, borderRadius:10, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginTop:4 }}>
        ＋ Add new leader
      </button>

      {editOpen&&(
        <div onClick={()=>setEditOpen(false)} style={{ position:'fixed', inset:0, background:'#000c', zIndex:500, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 80px' }}>
            <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{editingEntry?'Edit leader':'Add leader'}</div>
              <button onClick={()=>setEditOpen(false)} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>
            <LeaderEditForm
              entry={editingEntry}
              onSave={e=>{saveEntry(e);setEditOpen(false);}}
              onDelete={id=>{deleteEntry(id);setEditOpen(false);}}
              onCancel={()=>setEditOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderEditForm({ entry, onSave, onDelete, onCancel }) {
  const [l,setL]=useState(()=>entry||{id:uid(),name:'',marchSecs:null,type:'Main Rally'});
  const [confirmDel,setConfirmDel]=useState(false);
  useEffect(()=>{if(entry)setL({...entry});else setL({id:uid(),name:'',marchSecs:null,type:'Main Rally'});},[entry?.id]);
  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Name</label>
        <input value={l.name} onChange={e=>setL(p=>({...p,name:e.target.value}))} placeholder="Leader name"
          style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>March time</label>
        <MarchInput value={l.marchSecs} onChange={v=>setL(p=>({...p,marchSecs:v}))}/>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:entry?12:0 }}>
        <button onClick={onCancel} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
        <button onClick={()=>onSave(l)} disabled={!l.name||!l.marchSecs} style={{ flex:2, height:52, borderRadius:12, background:l.name&&l.marchSecs?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:l.name&&l.marchSecs?'pointer':'default' }}>Save</button>
      </div>
      {entry&&!confirmDel&&<button onClick={()=>setConfirmDel(true)} style={{ width:'100%', height:44, borderRadius:12, background:'none', border:`1px solid ${C.red}44`, color:C.red, fontWeight:600, fontSize:14, cursor:'pointer' }}>Delete leader</button>}
      {confirmDel&&(
        <div style={{ background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:12, padding:14, textAlign:'center' }}>
          <div style={{ fontSize:14, color:C.white, marginBottom:12 }}>Delete {entry?.name}?</div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setConfirmDel(false)} style={{ flex:1, height:44, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>Cancel</button>
            <button onClick={()=>onDelete(entry.id)} style={{ flex:2, height:44, borderRadius:10, background:C.red, color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LiveRallyRoom ──────────────────────────────────────────────
export function LiveRallyRoom({ onBack, players=[], planData=null }) {
  const [state,setState]           = useState(()=>loadState()||DEFAULT_STATE);
  const [view,setView]             = useState('timers');
  const [editingTimer,setEditingTimer] = useState(null);
  const [sheetOpen,setSheetOpen]       = useState(false);
  const [prefillImpact,setPrefillImpact] = useState(null);
  const [leaderTimer,setLeaderTimer]   = useState(null);
  const [toastMsg,setToastMsg]         = useState(null);
  const planLoadedRef = useRef(false);

  // Pre-populate calculator from Battle Plan (once only)
  useEffect(()=>{
    if (!planData || planLoadedRef.current) return;
    planLoadedRef.current=true;
    const slots=(planData.rallySlots||[]).filter(s=>s.leaderName);
    if (!slots.length) return;

    const leaders=slots.map(s=>({
      id:uid(),
      name:s.leaderName,
      type:s.type||'Main Rally',
      marchSecs:null, // entered on the day
      rallyDuration:s.rallyDuration||3,
      offset:0,
      notes:s.notes||'',
      // carry joiner assignments through
      joiners:s.joiners||[],
      ratio:s.ratio||'',
    }));

    setState(prev=>({
      ...prev,
      calculator:{
        ...prev.calculator,
        leaders,
        rallyDuration:slots[0]?.rallyDuration||3,
      },
    }));
    setView('calc');
    showToast(`${slots.length} rally slots loaded from "${planData.name||'Battle Plan'}"`);
  },[planData]);

  useEffect(()=>{ saveState(state); },[state]);

  function showToast(msg){ setToastMsg(msg); setTimeout(()=>setToastMsg(null),3000); }

  function saveTimer(t) {
    setState(prev=>({...prev,timers:prev.timers.some(x=>x.id===t.id)?prev.timers.map(x=>x.id===t.id?t:x):[...prev.timers,t]}));
  }
  function deleteTimer(id){ setState(prev=>({...prev,timers:prev.timers.filter(t=>t.id!==id)})); }

  function updateJoiner(timerId, joinerIdx, patch) {
    setState(prev=>({
      ...prev,
      timers:prev.timers.map(t=>{
        if(t.id!==timerId)return t;
        const joiners=[...(t.joiners||[])];
        joiners[joinerIdx]={...joiners[joinerIdx],...patch};
        return {...t,joiners};
      }),
    }));
  }

  function handleStartTimers(newTimers) {
    setState(prev=>{
      const slots=5-prev.timers.length;
      if(slots<=0){showToast('Live Room is full — delete a timer first');return prev;}
      const toAdd=newTimers.slice(0,slots);
      if(toAdd.length<newTimers.length) showToast(`${toAdd.length} of ${newTimers.length} timers created — room full`);
      else showToast(`${toAdd.length} timer${toAdd.length!==1?'s':''} started ✓`);
      // Carry joiner data from calculator leaders into timers
      const enriched=toAdd.map(t=>{
        const calcLeader=state.calculator.leaders.find(l=>l.name===t.name);
        return calcLeader?{...t,joiners:calcLeader.joiners||[],ratio:calcLeader.ratio||''}:t;
      });
      return {...prev,timers:[...prev.timers,...enriched]};
    });
    setView('timers');
    vibe([10,40,10]);
  }

  return (
    <>
      {leaderTimer&&<LeaderMode timer={leaderTimer} onClose={()=>setLeaderTimer(null)}/>}
      {toastMsg&&(
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:C.card+'ee', backdropFilter:'blur(12px)', border:`1px solid ${C.gold}44`, borderRadius:20, padding:'10px 20px', fontSize:14, fontWeight:600, color:C.gold, zIndex:800, whiteSpace:'nowrap', pointerEvents:'none' }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding:'16px 20px 0' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.gold, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:16, padding:0 }}>
          ← Back to Plans
        </button>
        <UTCClock/>
        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {[['timers','⏱ Live Timers'],['calc','🧮 Calculator'],['registry','💾 March Times']].map(([id,label])=>(
            <button key={id} onClick={()=>setView(id)}
              style={{ flex:1, height:44, borderRadius:20, whiteSpace:'nowrap', background:view===id?C.gold+'22':C.section, border:`1px solid ${view===id?C.gold:C.border}`, color:view===id?C.gold:C.muted, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {view==='timers'&&(
          <div>
            {state.timers.length<5&&(
              <button onClick={()=>{setEditingTimer(null);setSheetOpen(true);}}
                style={{ width:'100%', height:48, borderRadius:12, background:C.section, border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>
                ＋ New timer manually
              </button>
            )}
            {state.timers.length===0&&(
              <div style={{ textAlign:'center', padding:'32px 20px' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>⏱</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>No active timers</div>
                <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Use the Calculator to set up send times, then press Start Timers.</div>
                <button onClick={()=>setView('calc')} style={{ height:44, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Go to Calculator →</button>
              </div>
            )}
            {state.timers.map(t=>(
              <TimerCard key={t.id} timer={t} onEdit={t=>{setEditingTimer(t);setSheetOpen(true);}} onDelete={deleteTimer} onLeaderMode={setLeaderTimer} onUpdateJoiner={updateJoiner}/>
            ))}
            {state.timers.length>=5&&<div style={{ textAlign:'center', fontSize:13, color:C.muted, padding:'8px 0' }}>Maximum 5 timers. Delete one to add another.</div>}
          </div>
        )}

        {view==='calc'&&(
          <Calculator
            calc={state.calculator}
            onChange={calculator=>setState(prev=>({...prev,calculator}))}
            registry={state.marchRegistry}
            onStartTimers={handleStartTimers}
          />
        )}

        {view==='registry'&&(
          <MarchRegistry
            registry={state.marchRegistry}
            onChange={marchRegistry=>setState(prev=>({...prev,marchRegistry}))}
            players={players}
          />
        )}
      </div>

      <TimerSheet
        timer={editingTimer}
        open={sheetOpen}
        onClose={()=>{setSheetOpen(false);setEditingTimer(null);setPrefillImpact(null);}}
        onSave={saveTimer}
        prefillImpact={prefillImpact}
      />
    </>
  );
}

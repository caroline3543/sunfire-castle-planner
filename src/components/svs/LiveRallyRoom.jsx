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
  'Main Rally':      '#F5A623',
  'Counter Rally':   '#FF453A',
  'Counter-Counter': '#FF8C00',
  'Switch Fight':    '#30D158',
  'Garrison Entry':  '#6B8CAE',
  'Reinforcement':   '#7BAE8C',
  'Custom':          '#A8C4D8',
};

const OFFSETS = [-5,-2,-1,0,1,2,5];
const STORAGE_KEY = 'svs_live_rally_room_v2';

const STAGE_RULES = [
  { threshold:30, label:'Get Ready',          color:'#A8C4D8' },
  { threshold:10, label:'Hover March Button', color:'#F5A623' },
  { threshold:5,  label:'Prepare To Send',    color:'#FF8C00' },
  { threshold:0,  label:'SEND NOW',           color:'#FF453A' },
];

const DEFAULT_MSG =
`RALLY COORDINATION

Type: {type}
Impact: {impact} UTC
Send at: {send} UTC

Join now. Do not solo.
Wait for the countdown.`;

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }

function utcNowSecs() {
  const n=new Date();
  return n.getUTCHours()*3600+n.getUTCMinutes()*60+n.getUTCSeconds();
}

function utcNowStr() {
  const n=new Date();
  return [n.getUTCHours(),n.getUTCMinutes(),n.getUTCSeconds()].map(x=>String(x).padStart(2,'0')).join(':');
}

function secsToHHMMSS(s) {
  if (s==null||isNaN(s)) return '--:--:--';
  const abs=Math.abs(Math.round(s));
  const str=[Math.floor(abs/3600),Math.floor((abs%3600)/60),abs%60].map(x=>String(x).padStart(2,'0')).join(':');
  return s<0?`-${str}`:str;
}

function getStage(secsLeft) {
  if (secsLeft<=0)  return STAGE_RULES[3];
  if (secsLeft<=5)  return STAGE_RULES[2];
  if (secsLeft<=10) return STAGE_RULES[1];
  if (secsLeft<=30) return STAGE_RULES[0];
  return null;
}

function calcSendSecs(impactSecs, marchSecs, offset=0) {
  if (impactSecs==null||marchSecs==null) return null;
  return impactSecs - marchSecs + offset;
}

function fmtSend(secs) {
  if (secs==null) return '--:--';
  const norm=((secs%86400)+86400)%86400;
  const h=Math.floor(norm/3600), m=Math.floor((norm%3600)/60), s=norm%60;
  return s===0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
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
          leaders:         Array.isArray(p.calculator?.leaders) ? p.calculator.leaders : [],
          messageTemplate: p.calculator?.messageTemplate || DEFAULT_MSG,
        },
      };
    }
  } catch {}
  return null;
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(s)); } catch {}
}

const DEFAULT_STATE = {
  timers:[],
  marchRegistry:[],
  calculator:{ impactTimeRaw:'', impactSecs:null, leaders:[], messageTemplate:DEFAULT_MSG },
};

// ── Smart inputs ───────────────────────────────────────────────
function MarchInput({ value, onChange, placeholder='e.g. 412' }) {
  const [raw, setRaw]     = useState('');
  const [preview, setPrev]= useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (value!=null && raw==='') setRaw(fmtMarch(value));
  }, [value]);

  function handle(input) {
    setRaw(input);
    if (!input) { setPrev(null); setError(null); onChange(null); return; }
    const v=validateMarchInput(input);
    if (v.error)        { setError(v.error); setPrev(null); onChange(null); }
    else if (v.valid)   { setError(null); setPrev(fmtMarch(v.totalSecs)); onChange(v.totalSecs); }
    else                { setError(null); setPrev(null); onChange(null); }
  }

  return (
    <div>
      <input value={raw} onChange={e=>handle(e.target.value)} placeholder={placeholder} inputMode="decimal"
        style={{ width:'100%', background:C.section, border:`1px solid ${error?C.red:preview?C.green:C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
      {preview&&<div style={{ fontSize:11, color:C.green, marginTop:3 }}>{preview}</div>}
      {error  &&<div style={{ fontSize:11, color:C.red,   marginTop:3 }}>⚠ {error}</div>}
    </div>
  );
}

function ImpactInput({ value, onChange, large=false }) {
  const [raw,  setRaw]  = useState(value||'');
  const [disp, setDisp] = useState(null);
  const [err,  setErr]  = useState(null);
  const [past, setPast] = useState(false);

  function handle(input) {
    setRaw(input);
    if (!input) { setDisp(null); setErr(null); setPast(false); onChange(null,null); return; }
    const v=validateImpactInput(input);
    if (v.error)      { setErr(v.error); setDisp(null); setPast(false); onChange(null,null); }
    else if (v.valid) { setErr(null); setDisp(v.display); setPast(v.totalSecs<utcNowSecs()); onChange(v.display,v.totalSecs); }
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
  useEffect(()=>{ const id=setInterval(()=>setTime(utcNowStr()),1000); return ()=>clearInterval(id); },[]);
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
function TimerCard({ timer, onEdit, onDelete, onLeaderMode }) {
  const [now,setNow]=useState(utcNowSecs());
  useEffect(()=>{ const id=setInterval(()=>setNow(utcNowSecs()),250); return ()=>clearInterval(id); },[]);

  const parsed=parseImpactInput(timer.impactTime);
  const impactSecs=parsed?.totalSecs??null;
  const secsLeft=impactSecs!=null?impactSecs-now:null;
  const isFired=secsLeft!=null&&secsLeft<=0;
  const stage=secsLeft!=null?getStage(secsLeft):null;
  const color=RALLY_COLORS[timer.type]||C.gold;
  const sendSecs=calcSendSecs(impactSecs,timer.marchSecs,0);
  const WINDOW=300;
  const progress=secsLeft!=null?Math.max(0,Math.min(100,((WINDOW-Math.max(0,secsLeft))/WINDOW)*100)):0;

  return (
    <div style={{ background:C.card, borderRadius:14, overflow:'hidden', marginBottom:12, border:`1px solid ${isFired?color:C.border}`, boxShadow:isFired?`0 0 16px ${color}44`:'none' }}>
      <div style={{ height:4, background:C.border }}>
        <div style={{ height:'100%', width:`${progress}%`, background:color, transition:'width 250ms linear' }}/>
      </div>
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:color }}/>
              <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{timer.name||timer.type}</div>
            </div>
            <div style={{ fontSize:12, color:C.muted }}>{timer.type}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>onLeaderMode(timer)} style={{ height:32, padding:'0 10px', borderRadius:16, background:color+'22', border:`1px solid ${color}44`, color, fontWeight:600, fontSize:12, cursor:'pointer' }}>Full screen</button>
            <button onClick={()=>onEdit(timer)} style={{ height:32, padding:'0 10px', borderRadius:16, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontSize:12, cursor:'pointer' }}>Edit</button>
            <button onClick={()=>onDelete(timer.id)} style={{ height:32, width:32, borderRadius:16, background:'none', border:'none', color:C.red+'88', fontSize:16, cursor:'pointer' }}>✕</button>
          </div>
        </div>

        {stage&&(
          <div style={{ background:stage.color+'22', border:`1px solid ${stage.color}44`, borderRadius:8, padding:'6px 12px', marginBottom:8, textAlign:'center' }}>
            <div style={{ fontSize:isFired?20:14, fontWeight:800, color:stage.color, letterSpacing:isFired?'0.1em':0 }}>{stage.label}</div>
          </div>
        )}

        <div style={{ textAlign:'center', marginBottom:8 }}>
          <div style={{ fontSize:42, fontWeight:800, color:isFired?color:C.white, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
            {secsLeft!=null?secsToHHMMSS(secsLeft):'--:--:--'}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div style={{ background:C.section, borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>Impact</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.gold }}>{timer.impactTime||'--:--'} UTC</div>
          </div>
          <div style={{ background:C.section, borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>Send at</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.icy }}>{sendSecs!=null?fmtSend(sendSecs)+' UTC':'Set march time'}</div>
          </div>
        </div>
        {timer.notes&&<div style={{ fontSize:12, color:C.icy, marginTop:8, fontStyle:'italic' }}>"{timer.notes}"</div>}
      </div>
    </div>
  );
}

// ── Manual Timer Sheet ─────────────────────────────────────────
function TimerSheet({ timer, open, onClose, onSave, prefillImpact }) {
  const [t,setT]=useState(()=>timer||newTimer());

  useEffect(()=>{
    if (open) { const base=timer?{...timer}:newTimer(); if (!timer&&prefillImpact) base.impactTime=prefillImpact; setT(base); }
  },[open,timer?.id,prefillImpact]);

  useEffect(()=>{
    if (!open) return;
    function h(e){ if(e.key==='Escape') onClose(); }
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[open,onClose]);

  function upd(k,v){ setT(prev=>({...prev,[k]:v})); }

  const parsed=parseImpactInput(t.impactTime);
  const impactSecs=parsed?.totalSecs??null;
  const sendSecs=calcSendSecs(impactSecs,t.marchSecs,0);

  if (!open) return null;
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
          <input value={t.name} onChange={e=>upd('name',e.target.value)} placeholder="e.g. Caroline counter" style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Type</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {RALLY_TYPES.map(type=>{ const sel=t.type===type; const col=RALLY_COLORS[type]; return (
              <button key={type} onClick={()=>upd('type',type)} style={{ padding:'8px 14px', borderRadius:20, minHeight:36, border:`1px solid ${sel?col:C.border}`, background:sel?col+'22':C.section, color:sel?col:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{type}</button>
            ); })}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Target impact time (UTC)</label>
          <ImpactInput value={t.impactTime} onChange={(disp,secs)=>upd('impactTime',disp||'')} large/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>March time (e.g. 412 = 04:12)</label>
          <MarchInput value={t.marchSecs} onChange={v=>upd('marchSecs',v)}/>
        </div>

        {sendSecs!=null&&(
          <div style={{ background:C.section, borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Send at</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.green, fontVariantNumeric:'tabular-nums' }}>{fmtSend(sendSecs)} UTC</div>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Notes</label>
          <textarea value={t.notes} onChange={e=>upd('notes',e.target.value)} placeholder="Any instructions…" style={{ width:'100%', minHeight:64, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={()=>{ onSave(t); onClose(); vibe(8); }} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}>Save timer</button>
        </div>
      </div>
    </div>
  );
}

function newTimer(){ return { id:uid(), name:'', type:'Main Rally', impactTime:'', marchSecs:null, notes:'' }; }

// ── Leader Edit Sheet ──────────────────────────────────────────
function LeaderEditSheet({ leader, open, onClose, onSave, onDelete }) {
  const [l,setL]=useState(()=>leader||newLeaderEntry());

  useEffect(()=>{ if (open) setL(leader?{...leader}:newLeaderEntry()); },[open,leader?.id]);
  useEffect(()=>{
    if (!open) return;
    function h(e){ if(e.key==='Escape') onClose(); }
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[open,onClose]);

  const [confirmDelete,setConfirmDelete]=useState(false);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:500, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 80px' }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:'0 auto 16px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{leader?'Edit leader':'Add leader'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Name</label>
          <input value={l.name} onChange={e=>setL(prev=>({...prev,name:e.target.value}))} placeholder="Leader name" style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>March time</label>
          <MarchInput value={l.marchSecs} onChange={v=>setL(prev=>({...prev,marchSecs:v}))}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Default rally type</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {RALLY_TYPES.slice(0,5).map(type=>{ const sel=l.type===type; const col=RALLY_COLORS[type]; return (
              <button key={type} onClick={()=>setL(prev=>({...prev,type}))} style={{ padding:'7px 12px', borderRadius:16, border:`1px solid ${sel?col:C.border}`, background:sel?col+'22':C.section, color:sel?col:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{type}</button>
            ); })}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:leader?12:0 }}>
          <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={()=>{ onSave(l); onClose(); vibe(8); }} disabled={!l.name||!l.marchSecs} style={{ flex:2, height:52, borderRadius:12, background:l.name&&l.marchSecs?C.gold:C.border, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:l.name&&l.marchSecs?'pointer':'default' }}>Save</button>
        </div>

        {leader&&!confirmDelete&&(
          <button onClick={()=>setConfirmDelete(true)} style={{ width:'100%', height:44, borderRadius:12, background:'none', border:`1px solid ${C.red}44`, color:C.red, fontWeight:600, fontSize:14, cursor:'pointer' }}>Delete leader</button>
        )}
        {confirmDelete&&(
          <div style={{ background:C.red+'18', border:`1px solid ${C.red}44`, borderRadius:12, padding:14, textAlign:'center' }}>
            <div style={{ fontSize:14, color:C.white, marginBottom:12 }}>Delete {leader?.name}? This cannot be undone.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConfirmDelete(false)} style={{ flex:1, height:44, borderRadius:10, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:14, cursor:'pointer' }}>Cancel</button>
              <button onClick={()=>{ onDelete(leader.id); onClose(); vibe([20,20,20]); }} style={{ flex:2, height:44, borderRadius:10, background:C.red, color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function newLeaderEntry(){ return { id:uid(), name:'', marchSecs:null, type:'Main Rally' }; }

// ── Leader Mode ────────────────────────────────────────────────
function LeaderMode({ timer, onClose }) {
  const [now,setNow]=useState(utcNowSecs());
  const lastStageRef=useRef(null);
  useEffect(()=>{ const id=setInterval(()=>setNow(utcNowSecs()),250); return ()=>clearInterval(id); },[]);
  useEffect(()=>{
    function h(e){ if(e.key==='Escape') onClose(); }
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h);
  },[onClose]);

  const parsed=parseImpactInput(timer.impactTime);
  const impactSecs=parsed?.totalSecs??null;
  const secsLeft=impactSecs!=null?impactSecs-now:null;
  const isFired=secsLeft!=null&&secsLeft<=0;
  const stage=secsLeft!=null?getStage(secsLeft):null;
  const color=RALLY_COLORS[timer.type]||C.gold;
  const sendSecs=calcSendSecs(impactSecs,timer.marchSecs,0);

  useEffect(()=>{
    if (!stage) return;
    if (stage.label!==lastStageRef.current) {
      lastStageRef.current=stage.label;
      if (stage.label==='SEND NOW') vibe([100,50,100,50,200]);
      else if (stage.label==='Prepare To Send') vibe([50,30,50]);
      else vibe(30);
    }
  },[stage?.label]);

  return (
    <div style={{ position:'fixed', inset:0, background:C.bg, zIndex:900, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer' }}>✕</button>
      <div style={{ fontSize:14, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>{timer.name||timer.type}</div>
      {stage&&<div style={{ fontSize:isFired?28:18, fontWeight:800, color:stage.color, marginBottom:20, textAlign:'center', letterSpacing:isFired?'0.1em':0 }}>{stage.label}</div>}
      <div style={{ fontSize:80, fontWeight:900, color:isFired?color:C.white, fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em', lineHeight:1, marginBottom:24, textAlign:'center' }}>
        {secsLeft!=null?secsToHHMMSS(secsLeft):'--:--:--'}
      </div>
      <div style={{ display:'flex', gap:24, marginBottom:24 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:12, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Impact</div>
          <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{timer.impactTime} UTC</div>
        </div>
        {sendSecs!=null&&(
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:12, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Send at</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.green }}>{fmtSend(sendSecs)} UTC</div>
          </div>
        )}
      </div>
      {timer.notes&&<div style={{ fontSize:14, color:C.icy, fontStyle:'italic', textAlign:'center', maxWidth:320 }}>"{timer.notes}"</div>}
      <button onClick={onClose} style={{ position:'absolute', bottom:40, height:48, padding:'0 32px', borderRadius:24, background:C.section, border:`1px solid ${C.border}`, color:C.muted, fontWeight:600, fontSize:15, cursor:'pointer' }}>Exit full screen</button>
    </div>
  );
}

// ── Calculator ─────────────────────────────────────────────────
function Calculator({ calc, onChange, registry, onStartTimers }) {
  const [now,setNow]=useState(utcNowSecs());
  const [copied,setCopied]=useState(null);
  const [editingRow,setEditingRow]=useState(null);// index of row being edited inline
  const [showTemplate,setShowTemplate]=useState(false);

  useEffect(()=>{ const id=setInterval(()=>setNow(utcNowSecs()),1000); return ()=>clearInterval(id); },[]);

  const impactSecs=calc.impactSecs;

  function setImpact(disp,secs){ onChange({...calc, impactTimeRaw:disp||'', impactSecs:secs}); }

  // Add leader from registry chip
  function addFromRegistry(entry) {
    if (calc.leaders.some(l=>l.registryId===entry.id)) return;
    onChange({...calc, leaders:[...calc.leaders, { id:uid(), registryId:entry.id, name:entry.name, type:entry.type||'Main Rally', marchSecs:entry.marchSecs, offset:0, notes:'' }]});
    vibe(8);
  }

  function removeRow(id){ onChange({...calc, leaders:calc.leaders.filter(l=>l.id!==id)}); }

  function updRow(id,patch){ onChange({...calc, leaders:calc.leaders.map(l=>l.id===id?{...l,...patch}:l)}); }

  function copyMsg(leader) {
    const sendSecs=calcSendSecs(impactSecs,leader.marchSecs,leader.offset||0);
    const text=(calc.messageTemplate||DEFAULT_MSG)
      .replace('{type}',leader.type||'Rally')
      .replace('{impact}',calc.impactTimeRaw||'--:--')
      .replace('{send}',sendSecs!=null?fmtSend(sendSecs):'--:--')
      .replace('{name}',leader.name||'');
    navigator.clipboard.writeText(text).then(()=>{ setCopied(leader.id); setTimeout(()=>setCopied(null),2000); });
    vibe(8);
  }

  // Launch timers directly — no re-entry required
  function handleStartTimers() {
    const readyLeaders=calc.leaders.filter(l=>l.marchSecs&&calc.impactSecs);
    if (!readyLeaders.length) return;
    const newTimers=readyLeaders.map(l=>({
      id: uid(),
      name: l.name||l.type,
      type: l.type||'Main Rally',
      impactTime: calc.impactTimeRaw,
      marchSecs: l.marchSecs,
      notes: l.notes||'',
    }));
    onStartTimers(newTimers);
    vibe([10,40,10]);
  }

  const readyCount=calc.leaders.filter(l=>l.marchSecs&&impactSecs).length;

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>Send Calculator</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Set impact time. Tap leader chips. Press Start Timers.</div>

      {/* Impact time */}
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Target impact time (UTC)</label>
        <ImpactInput value={calc.impactTimeRaw} onChange={setImpact} large/>
      </div>

      {/* Leader chips from registry */}
      {registry.filter(r=>r.marchSecs).length>0&&(
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Saved leaders</div>
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
          {/* Table header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 44px 50px', gap:0, padding:'8px 14px', borderBottom:`1px solid ${C.border}` }}>
            {['Leader','March','Send at','Offset',''].map(h=>(
              <div key={h} style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {calc.leaders.map((leader,i)=>{
            const sendSecs=impactSecs&&leader.marchSecs?calcSendSecs(impactSecs,leader.marchSecs,leader.offset||0):null;
            const isEditing=editingRow===i;
            const color=RALLY_COLORS[leader.type]||C.gold;

            return (
              <div key={leader.id} style={{ borderBottom:i<calc.leaders.length-1?`1px solid ${C.border}22`:'none' }}>
                {/* Main row */}
                <div onClick={()=>setEditingRow(isEditing?null:i)} style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 44px 50px', gap:0, padding:'10px 14px', cursor:'pointer', background:isEditing?C.card:'none', alignItems:'center' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }}/>
                      <div style={{ fontSize:14, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leader.name||'—'}</div>
                    </div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{leader.type}</div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.icy, fontVariantNumeric:'tabular-nums' }}>
                    {leader.marchSecs?fmtMarch(leader.marchSecs):'—'}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:sendSecs!=null?C.green:C.muted, fontVariantNumeric:'tabular-nums' }}>
                    {sendSecs!=null?fmtSend(sendSecs):'—'}
                  </div>
                  <div style={{ fontSize:12, color:leader.offset?C.gold:C.muted }}>
                    {leader.offset>0?`+${leader.offset}s`:leader.offset<0?`${leader.offset}s`:`+0s`}
                  </div>
                  <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                    <button onClick={e=>{e.stopPropagation();copyMsg(leader);}} style={{ height:28, padding:'0 8px', borderRadius:8, background:copied===leader.id?C.green+'22':C.card, border:`1px solid ${copied===leader.id?C.green:C.border}`, color:copied===leader.id?C.green:C.muted, fontSize:11, cursor:'pointer' }}>
                      {copied===leader.id?'✓':'📋'}
                    </button>
                    <button onClick={e=>{e.stopPropagation();removeRow(leader.id);}} style={{ height:28, width:28, borderRadius:8, background:'none', border:'none', color:C.red+'88', fontSize:14, cursor:'pointer' }}>✕</button>
                  </div>
                </div>

                {/* Inline edit expansion */}
                {isEditing&&(
                  <div style={{ padding:'10px 14px 14px', background:C.card, borderTop:`1px solid ${C.border}22` }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                      <div>
                        <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:4 }}>March time</label>
                        <MarchInput value={leader.marchSecs} onChange={v=>updRow(leader.id,{marchSecs:v})}/>
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:4 }}>Landing offset</label>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {OFFSETS.map(o=>(
                            <button key={o} onClick={()=>updRow(leader.id,{offset:o})} style={{ padding:'5px 7px', borderRadius:6, border:`1px solid ${leader.offset===o?C.gold:C.border}`, background:leader.offset===o?C.gold+'22':C.section, color:leader.offset===o?C.gold:C.muted, fontWeight:600, fontSize:11, cursor:'pointer', minWidth:28 }}>
                              {o>0?`+${o}`:o}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <label style={{ fontSize:11, color:C.muted, display:'block', marginBottom:4 }}>Rally type</label>
                      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
                        {RALLY_TYPES.slice(0,5).map(type=>{ const sel=leader.type===type; const col=RALLY_COLORS[type]; return (
                          <button key={type} onClick={()=>updRow(leader.id,{type})} style={{ padding:'5px 10px', borderRadius:12, whiteSpace:'nowrap', border:`1px solid ${sel?col:C.border}`, background:sel?col+'22':C.section, color:sel?col:C.muted, fontWeight:600, fontSize:12, cursor:'pointer', flexShrink:0 }}>{type}</button>
                        ); })}
                      </div>
                    </div>
                    <input value={leader.notes||''} onChange={e=>updRow(leader.id,{notes:e.target.value})} placeholder="Notes…" style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 10px', fontSize:13, color:C.icy, boxSizing:'border-box', fontFamily:'inherit' }}/>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add manual row */}
          <button onClick={()=>{
            onChange({...calc, leaders:[...calc.leaders,{id:uid(),name:'',type:'Main Rally',marchSecs:null,offset:0,notes:''}]});
            setEditingRow(calc.leaders.length);
          }} style={{ width:'100%', height:40, background:'none', border:'none', borderTop:`1px solid ${C.border}22`, color:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
            ＋ Add leader manually
          </button>
        </div>
      )}

      {/* No leaders yet */}
      {calc.leaders.length===0&&registry.filter(r=>r.marchSecs).length===0&&(
        <div style={{ textAlign:'center', padding:'24px 0', color:C.muted, fontSize:13 }}>
          Add leaders in 💾 March Times, then tap their chips here.
        </div>
      )}

      {/* START TIMERS — primary CTA */}
      {readyCount>0&&(
        <button onClick={handleStartTimers} style={{ width:'100%', height:56, borderRadius:12, background:C.red, color:'#fff', fontWeight:800, fontSize:17, border:'none', cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          🔴 Start {readyCount} Timer{readyCount!==1?'s':''} → Live Room
        </button>
      )}

      {/* Message template */}
      <button onClick={()=>setShowTemplate(!showTemplate)} style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:'4px 0', marginBottom:8 }}>
        {showTemplate?'▾':'▸'} Edit message template
      </button>
      {showTemplate&&(
        <div style={{ background:C.section, borderRadius:10, padding:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Variables: {'{type}'} {'{impact}'} {'{send}'} {'{name}'}</div>
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
    if (registry.some(r=>r.name===player.username)) return;
    const entry={ id:uid(), name:player.username, marchSecs:player.marchSecs||null, type:'Main Rally' };
    onChange([...registry,entry]);
    vibe(8);
  }

  function saveEntry(entry) {
    onChange(registry.some(r=>r.id===entry.id)
      ? registry.map(r=>r.id===entry.id?entry:r)
      : [...registry,entry]
    );
  }

  function deleteEntry(id){ onChange(registry.filter(r=>r.id!==id)); }

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:4 }}>March Times</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Save march times here. Leaders appear as chips in the calculator.</div>

      {/* Quick add from roster */}
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

      {/* Existing entries */}
      {registry.map(entry=>(
        <div key={entry.id} style={{ background:C.section, borderRadius:10, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{entry.name}</div>
            <div style={{ fontSize:13, color:entry.marchSecs?C.green:C.muted }}>
              {entry.marchSecs?fmtMarch(entry.marchSecs):'No march time set'}
            </div>
          </div>
          <button onClick={()=>{ setEditingEntry(entry); setEditOpen(true); }}
            style={{ height:36, padding:'0 14px', borderRadius:18, background:C.card, border:`1px solid ${C.border}`, color:C.icy, fontSize:13, cursor:'pointer' }}>
            ✏️ Edit
          </button>
        </div>
      ))}

      {/* Add new */}
      <button onClick={()=>{ setEditingEntry(null); setEditOpen(true); }}
        style={{ width:'100%', height:48, borderRadius:10, background:'none', border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginTop:4 }}>
        ＋ Add new leader
      </button>

      <LeaderEditSheet
        leader={editingEntry}
        open={editOpen}
        onClose={()=>{ setEditOpen(false); setEditingEntry(null); }}
        onSave={saveEntry}
        onDelete={deleteEntry}
      />
    </div>
  );
}

// ── LiveRallyRoom (main export) ────────────────────────────────
export function LiveRallyRoom({ onBack, players=[] }) {
  const [state,setState]         = useState(()=>loadState()||DEFAULT_STATE);
  const [view,setView]           = useState('timers');
  const [editingTimer,setEditingTimer] = useState(null);
  const [sheetOpen,setSheetOpen]       = useState(false);
  const [prefillImpact,setPrefillImpact] = useState(null);
  const [leaderTimer,setLeaderTimer]   = useState(null);
  const [toastMsg,setToastMsg]         = useState(null);

  useEffect(()=>{ saveState(state); },[state]);

  function showToast(msg){ setToastMsg(msg); setTimeout(()=>setToastMsg(null),3000); }

  function saveTimer(t) {
    setState(prev=>({
      ...prev,
      timers: prev.timers.some(x=>x.id===t.id)
        ? prev.timers.map(x=>x.id===t.id?t:x)
        : [...prev.timers,t],
    }));
  }

  function deleteTimer(id){ setState(prev=>({...prev,timers:prev.timers.filter(t=>t.id!==id)})); }

  // Start timers directly from calculator — no re-entry
  function handleStartTimers(newTimers) {
    setState(prev=>{
      const slots=5-prev.timers.length;
      if (slots<=0) { showToast('Live Room is full — delete a timer first'); return prev; }
      const toAdd=newTimers.slice(0,slots);
      if (toAdd.length<newTimers.length) {
        showToast(`${toAdd.length} of ${newTimers.length} timers created — room full`);
      } else {
        showToast(`${toAdd.length} timer${toAdd.length!==1?'s':''} started ✓`);
      }
      return { ...prev, timers:[...prev.timers,...toAdd] };
    });
    setView('timers');
    vibe([10,40,10]);
  }

  return (
    <>
      {leaderTimer&&<LeaderMode timer={leaderTimer} onClose={()=>setLeaderTimer(null)}/>}

      {/* Toast */}
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
              <button onClick={()=>{ setEditingTimer(null); setSheetOpen(true); }}
                style={{ width:'100%', height:48, borderRadius:12, background:C.section, border:`1px dashed ${C.border}`, color:C.muted, fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:16 }}>
                ＋ New timer manually
              </button>
            )}
            {state.timers.length===0&&(
              <div style={{ textAlign:'center', padding:'32px 20px' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>⏱</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:6 }}>No active timers</div>
                <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Use the Calculator to set up send times, then press Start Timers to launch them all at once.</div>
                <button onClick={()=>setView('calc')} style={{ height:44, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>
                  Go to Calculator →
                </button>
              </div>
            )}
            {state.timers.map(t=>(
              <TimerCard key={t.id} timer={t} onEdit={t=>{setEditingTimer(t);setSheetOpen(true);}} onDelete={deleteTimer} onLeaderMode={setLeaderTimer}/>
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
        onClose={()=>{ setSheetOpen(false); setEditingTimer(null); setPrefillImpact(null); }}
        onSave={saveTimer}
        prefillImpact={prefillImpact}
      />
    </>
  );
}

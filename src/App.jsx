import { useState, useEffect, useRef } from "react";
import {
  loadData, saveData, exportData, importData, mergeData,
  newEvent, newSnapshot, newSvsPlan, newRally, newReinforcement,
  newAssignment, newMarchEntry, newPrepEntry,
  calcMetrics, autoSuggestPlayers,
  EVENT_TYPES, STRATEGY_TYPES, TEAM_ROLES,
  normalizeName, resolveBatchNames, mergePlayerObjects,
  calcSendTime, calcImpactTime, parseHMS, formatHMS, secsToHuman,
  getRallyWarnings, getCounterWarnings,
} from "./data/dataManager.js";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg:"#0A1628",card:"#1E3A52",section:"#152236",
  gold:"#F5A623",white:"#FFFFFF",icy:"#A8C4D8",
  muted:"#5A7A94",inf:"#6B8CAE",lan:"#7BAE8C",
  mar:"#B8859A",red:"#FF453A",green:"#30D158",border:"#2A4A64",
};

const TIER_OPTIONS = ["T10","FC1","FC2","FC3","FC4","FC5","T11","T12"];
const ROLES = ["Rally Lead","Attack Team","Joiner","Garrison","Flexible","Reserve"];
const ROLE_COLORS = {"Rally Lead":C.gold,"Attack Team":C.red,"Joiner":C.mar,"Garrison":C.inf,"Flexible":C.lan,"Reserve":C.muted};
const ROLE_ICONS  = {"Rally Lead":"👑","Attack Team":"⚔️","Joiner":"🏹","Garrison":"🛡️","Flexible":"🔄","Reserve":"⏸️"};
const EVENT_ICONS = {"SvS":"⚔️","Foundry":"🔥","Canyon Clash":"🏔️","Bear Trap":"🪤","Sunfire Castle":"🏰","Transfer Season":"🚀","Custom":"📋"};
const PERF_TAGS   = [{key:"strong",label:"⭐ Strong",color:C.gold},{key:"reliable",label:"✓ Reliable",color:C.green},{key:"improving",label:"↑ Improving",color:C.icy},{key:"issue",label:"⚠️ Issue",color:C.red},{key:"noshow",label:"✗ No-show",color:C.muted}];
const TIMEZONES   = ["Oceania","Southeast Asia","East Asia","South Asia","Middle East","Eastern Europe","Central Europe","Western Europe","UK & Ireland","West Africa","East Africa","South Africa","Eastern North America","Central North America","Western North America","Central America & Caribbean","South America (East)","South America (West)"];
const LANGUAGES   = ["English","Mandarin","Spanish","Portuguese","Russian","Arabic","Turkish","German","French","Indonesian","Vietnamese","Thai","Korean","Japanese","Polish","Italian","Dutch","Hindi","Malay","Other"];
const COUNTRIES   = ["Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bangladesh","Belgium","Brazil","Cambodia","Canada","Chile","China","Colombia","Czech Republic","Denmark","Egypt","Ethiopia","Finland","France","Germany","Ghana","Greece","Hungary","India","Indonesia","Iran","Iraq","Ireland","Italy","Japan","Jordan","Kazakhstan","Kenya","Malaysia","Mexico","Morocco","Myanmar","Nepal","Netherlands","New Zealand","Nigeria","Norway","Pakistan","Peru","Philippines","Poland","Portugal","Romania","Russia","Saudi Arabia","Serbia","Singapore","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland","Taiwan","Thailand","Turkey","Ukraine","United Arab Emirates","United Kingdom","United States","Venezuela","Vietnam","Other"];
const HEROES_BY_GEN = [{gen:"Gen 1",heroes:["Jessie","Jasser","Jeronimo","Seo-Yoon","Patrick","Bahiti","Ling Xue","Lumak Bokan"]},{gen:"Gen 2",heroes:["Philly","Alonso"]},{gen:"Gen 3",heroes:["Mia","Logan","Greg"]},{gen:"Gen 4",heroes:["Reina","Ahmose","Lynn"]},{gen:"Gen 5",heroes:["Norah","Hector","Gwen"]},{gen:"Gen 6",heroes:["Wu Ming","Renee","Wayne"]},{gen:"Gen 7",heroes:["Edith","Gordon","Bradley"]},{gen:"Gen 8",heroes:["Gatot","Sonya","Hendrik"]},{gen:"Gen 9",heroes:["Magnus","Fred","Xura"]},{gen:"Gen 10",heroes:["Gregory","Freya","Blanchette"]},{gen:"Gen 11",heroes:["Eleonora","Lloyd","Rufus"]}];
const ALL_HEROES  = HEROES_BY_GEN.flatMap(g => g.heroes);

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function vibe(p) { try{navigator.vibrate(p);}catch(e){} }
function initials(n) { return (n||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase()||"?"; }
function fmtDate(iso) { if(!iso)return null; try{return new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}catch{return null;} }
function fmtDateShort(iso) { if(!iso)return""; try{return new Date(iso).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}catch{return iso;} }
function numFmt(n) { if(n==null||n==="")return"—"; return Number(n).toLocaleString(); }
function newPlayer(o={}) {
  return {id:uid(),fid:"",username:"",alias:"",allianceTag:"",country:"",timezone:"",languages:[],furnaceLevel:null,infantryCampLevel:null,lancerCampLevel:null,marksmanCampLevel:null,troops:{infantry:null,lancer:null,marksman:null},heroes:[],hasNoneChecked:false,roles:[],availability:{present:"available",timing:"unknown",lateBy:null,earlyBy:null,discord:"unknown"},teamAssignment:null,notes:"",profileLastUpdated:null,createdAt:Date.now(),...o};
}

// ── Shared primitives ──────────────────────────────────────────
function Field({label,children,hint}){return <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{label}</label>{children}{hint&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{hint}</div>}</div>;}
function Inp({value,onChange,placeholder,type="text",inputMode,style={}}){return <input type={type} inputMode={inputMode} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,boxSizing:"border-box",fontFamily:"inherit",...style}} />;}
function Sel({value,onChange,options,placeholder}){return <select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:value?C.white:C.muted,boxSizing:"border-box",fontFamily:"inherit"}}>{placeholder&&<option value="">{placeholder}</option>}{options.map(o=><option key={o} value={o}>{o}</option>)}</select>;}
function TierPill({value,onChange,color}){return <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>onChange(value===t?null:t)} style={{padding:"6px 12px",borderRadius:16,border:`1px solid ${value===t?color:C.border}`,background:value===t?color+"22":C.section,color:value===t?color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",minHeight:36,flexShrink:0}}>{t}</button>)}</div>;}
function ToggleRow({label,value,onChange,colorOn=C.green,colorOff=C.red,tristate=false}){
  function cycle(){if(!tristate){onChange(!value);return;}if(value===null)onChange(true);else if(value===true)onChange(false);else onChange(null);}
  const d=tristate?(value===null?{label:"—",color:C.muted}:value?{label:"✓ Yes",color:colorOn}:{label:"✗ No",color:colorOff}):(value?{label:"✓ Yes",color:colorOn}:{label:"✗ No",color:colorOff});
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}22`}}><div style={{fontSize:15,color:C.icy}}>{label}</div><button onClick={cycle} style={{minWidth:72,height:34,borderRadius:20,border:`1px solid ${d.color}44`,background:d.color+"18",color:d.color,fontWeight:700,fontSize:13,cursor:"pointer"}}>{d.label}</button></div>;
}
function Toast({msg,type="success"}){if(!msg)return null;const color=type==="error"?C.red:type==="warning"?C.gold:C.green;return <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:C.card+"ee",backdropFilter:"blur(12px)",border:`1px solid ${color}44`,borderRadius:20,padding:"10px 20px",fontSize:15,fontWeight:600,color,zIndex:500,whiteSpace:"nowrap",maxWidth:"90vw",pointerEvents:"none"}}>{msg}</div>;}
function AvailChip({label,selected,color,onClick}){return <button onClick={onClick} style={{padding:"8px 14px",borderRadius:20,minHeight:44,border:`1px solid ${selected?color:C.border}`,background:selected?color+"18":C.section,color:selected?color:C.icy,fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 150ms ease"}}>{label}</button>;}
function ReliabilityBadge({score}){if(score==null)return null;const c=score>=80?C.green:score>=50?C.gold:C.red;return <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,background:c+"18",border:`1px solid ${c}44`}}><span style={{fontSize:13,fontWeight:700,color:c}}>{score}</span><span style={{fontSize:11,color:C.muted}}>reliability</span></div>;}
function Sheet({open,onClose,children,zIndex=300}){if(!open)return null;return <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex,display:"flex",alignItems:"flex-end"}}><div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 100px"}}><div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}} />{children}</div></div>;}
function Warning({text}){return <div style={{background:C.red+"18",border:`1px solid ${C.red}44`,borderRadius:10,padding:"10px 14px",fontSize:13,color:C.red,marginBottom:8}}>⚠️ {text}</div>;}
function InfoCard({label,value,color=C.gold}){return <div style={{background:C.section,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:typeof value==="number"||String(value).length<6?22:15,fontWeight:700,color}}>{value||"—"}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{label}</div></div>;}

// ── Countdown timer hook ───────────────────────────────────────
function useCountdown(targetHMS) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!targetHMS) { setRemaining(null); return; }
    function tick() {
      const now = new Date();
      const todaySecs = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
      const target = parseHMS(targetHMS);
      const diff = target - todaySecs;
      setRemaining(diff);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetHMS]);
  return remaining;
}

// ── Profile View ───────────────────────────────────────────────
function ProfileView({player,open,onClose,onEdit,events}){
  if(!open||!player)return null;
  const dn=player.username||player.alias||"Unknown";
  const rc=ROLE_COLORS[player.roles?.[0]]||C.muted;
  const metrics=calcMetrics(player,events||[]);
  const snaps=(events||[]).flatMap(ev=>(ev.snapshots||[]).filter(s=>s.playerId===player.id).map(s=>({...s,eventName:ev.name||ev.type,eventDate:ev.date,eventType:ev.type}))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 80px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:rc+"33",border:`2px solid ${rc}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:22,color:C.white,flexShrink:0}}>{initials(dn)}</div>
            <div><div style={{fontSize:20,fontWeight:700,color:C.white}}>{dn}</div>{player.alias&&player.username&&<div style={{fontSize:13,color:C.muted}}>{player.alias}</div>}{metrics&&<ReliabilityBadge score={metrics.reliabilityScore}/>}</div>
          </div>
          <div style={{display:"flex",gap:8}}><button onClick={onEdit} style={{height:36,padding:"0 16px",borderRadius:20,background:C.gold,color:C.bg,fontWeight:700,fontSize:14,border:"none",cursor:"pointer"}}>Edit</button><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
        </div>
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Identity</div>
          {[["FID",player.fid],["Alliance",player.allianceTag?`[${player.allianceTag}]`:null],["Country",player.country],["Region",player.timezone],["Languages",player.languages?.join(", ")],["Furnace Level",player.furnaceLevel?`FC${player.furnaceLevel}`:null]].filter(([,v])=>v).map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}22`}}><span style={{fontSize:14,color:C.muted}}>{l}</span><span style={{fontSize:14,color:C.white,fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{v}</span></div>
          ))}
        </div>
        {player.roles?.length>0&&<div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Roles</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{player.roles.map(r=><span key={r} style={{padding:"6px 14px",borderRadius:20,background:ROLE_COLORS[r]+"22",border:`1px solid ${ROLE_COLORS[r]}44`,color:ROLE_COLORS[r],fontWeight:600,fontSize:14}}>{ROLE_ICONS[r]} {r}</span>)}</div></div>}
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Combat</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            {[["🛡️ Inf",player.troops?.infantry,C.inf],["⚔️ Lan",player.troops?.lancer,C.lan],["🏹 Mar",player.troops?.marksman,C.mar]].map(([l,t,c])=><div key={l} style={{background:C.card,borderRadius:10,padding:10,textAlign:"center"}}><div style={{fontSize:11,color:c,fontWeight:700,marginBottom:4}}>{l}</div><div style={{fontSize:16,fontWeight:700,color:t?c:C.muted}}>{t||"?"}</div></div>)}
          </div>
        </div>
        {player.heroes?.length>0&&<div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Skill 5 Heroes</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{player.heroes.map(h=><span key={h} style={{padding:"6px 12px",borderRadius:16,background:C.gold+"18",border:`1px solid ${C.gold}33`,color:C.gold,fontWeight:600,fontSize:13}}>✓ {h}</span>)}</div></div>}
        {metrics&&<div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>History</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {[["Attendance",`${metrics.attendancePct}%`,metrics.attendancePct>=70?C.green:C.gold],["Voice",`${metrics.voicePct}%`,C.icy],["Streak",`${metrics.streak}✓`,metrics.streak>=3?C.gold:C.white],["No-shows",metrics.noShows,metrics.noShows===0?C.green:C.red],["Events",`${metrics.attended}/${metrics.totalEvents}`,C.white],["Score",metrics.reliabilityScore,metrics.reliabilityScore>=70?C.green:C.gold]].map(([l,v,c])=><div key={l} style={{background:C.card,borderRadius:10,padding:10,textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div></div>)}
          </div>
          {snaps.slice(0,4).map(s=><div key={s.snapshotId} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}22`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,fontWeight:600,color:C.white}}>{EVENT_ICONS[s.eventType]||"📋"} {s.eventName}</div><div style={{fontSize:11,color:C.muted}}>{fmtDateShort(s.eventDate)}</div></div><div style={{display:"flex",gap:4}}>{s.attendance.attended===true&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:8,background:C.green+"18",color:C.green}}>✓</span>}{s.attendance.noShow&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:8,background:C.red+"18",color:C.red}}>✗</span>}{s.voice.joined===true&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:8,background:C.icy+"18",color:C.icy}}>🎙️</span>}</div></div>)}
        </div>}
        {player.notes&&<div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Notes</div><div style={{fontSize:14,color:C.icy,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{player.notes}</div></div>}
      </div>
    </div>
  );
}

// ── Player Edit Sheet ──────────────────────────────────────────
function PlayerSheet({player,open,onClose,onSave,events}){
  const [p,setP]=useState(()=>player||newPlayer());
  const [activeTab,setActiveTab]=useState("identity");
  useEffect(()=>{if(open){setP(player?{...player}:newPlayer());setActiveTab("identity");}},[open,player?.id]);
  function upd(k,v){setP(prev=>({...prev,[k]:v,profileLastUpdated:new Date().toISOString()}));}
  function updT(k,v){setP(prev=>({...prev,troops:{...prev.troops,[k]:v},profileLastUpdated:new Date().toISOString()}));}
  function updA(patch){setP(prev=>({...prev,availability:{...prev.availability,...patch},profileLastUpdated:new Date().toISOString()}));}
  function save(){onSave({...p,profileLastUpdated:p.profileLastUpdated||new Date().toISOString()});onClose();vibe(8);}
  const TABS=[{id:"identity",label:"👤 Identity"},{id:"combat",label:"⚔️ Combat"},{id:"avail",label:"📅 Availability"}];
  if(!open)return null;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:350,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 100px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>{player?"Edit Player":"Add Player"}</div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
        <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto"}}>{TABS.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:"8px 14px",borderRadius:20,whiteSpace:"nowrap",background:activeTab===t.id?C.gold+"22":C.section,border:`1px solid ${activeTab===t.id?C.gold:C.border}`,color:activeTab===t.id?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{t.label}</button>)}</div>
        {activeTab==="identity"&&<div>
          <Field label="In-Game Username"><Inp value={p.username} onChange={v=>upd("username",v)} placeholder="WOS username"/></Field>
          <Field label="Alias / Real Name"><Inp value={p.alias} onChange={v=>upd("alias",v)} placeholder="Nickname"/></Field>
          <Field label="WOS User ID / FID"><Inp value={p.fid} onChange={v=>upd("fid",v)} placeholder="e.g. 12345678" inputMode="numeric"/></Field>
          <Field label="Alliance Tag"><Inp value={p.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="R3K"/></Field>
          <Field label="Country"><Sel value={p.country} onChange={v=>upd("country",v)} options={COUNTRIES} placeholder="Select country…"/></Field>
          <Field label="Region / Timezone"><Sel value={p.timezone} onChange={v=>upd("timezone",v)} options={TIMEZONES} placeholder="Select region…"/></Field>
          <Field label="Languages"><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{LANGUAGES.map(lang=>{const sel=p.languages?.includes(lang);return <button key={lang} onClick={()=>{const c=p.languages||[];upd("languages",sel?c.filter(l=>l!==lang):[...c,lang]);}} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${sel?C.icy:C.border}`,background:sel?C.icy+"22":C.section,color:sel?C.icy:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{lang}</button>;})}</div></Field>
          <Field label="Furnace Level"><Inp value={p.furnaceLevel??""} onChange={v=>upd("furnaceLevel",v?parseInt(v):null)} placeholder="28" inputMode="numeric" type="number"/></Field>
          <Field label="Notes"><textarea value={p.notes||""} onChange={e=>upd("notes",e.target.value)} placeholder="Any notes…" style={{width:"100%",minHeight:80,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></Field>
        </div>}
        {activeTab==="combat"&&<div>
          <Field label="Camp Levels"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[["🛡️ Inf","infantryCampLevel",C.inf],["⚔️ Lan","lancerCampLevel",C.lan],["🏹 Mar","marksmanCampLevel",C.mar]].map(([l,k,c])=><div key={k} style={{background:C.section,borderRadius:10,padding:10,textAlign:"center"}}><div style={{fontSize:11,color:c,fontWeight:700,marginBottom:6}}>{l}</div><input type="number" inputMode="numeric" value={p[k]??""} placeholder="–" onChange={e=>upd(k,e.target.value?parseInt(e.target.value):null)} style={{width:"100%",background:C.card,border:`1px solid ${c}44`,borderRadius:8,padding:"8px 0",fontSize:18,fontWeight:700,color:c,textAlign:"center",boxSizing:"border-box",fontFamily:"inherit"}}/></div>)}
          </div></Field>
          <Field label="🛡️ Infantry Tier"><TierPill value={p.troops.infantry} onChange={v=>updT("infantry",v)} color={C.inf}/></Field>
          <Field label="⚔️ Lancer Tier"><TierPill value={p.troops.lancer} onChange={v=>updT("lancer",v)} color={C.lan}/></Field>
          <Field label="🏹 Marksman Tier"><TierPill value={p.troops.marksman} onChange={v=>updT("marksman",v)} color={C.mar}/></Field>
          <Field label="Battle Roles" hint="Select all that apply"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{ROLES.map(role=>{const sel=p.roles?.includes(role);const c=ROLE_COLORS[role];return <button key={role} onClick={()=>{const cur=p.roles||[];upd("roles",sel?cur.filter(r=>r!==role):[...cur,role]);}} style={{padding:"12px 14px",borderRadius:12,minHeight:48,textAlign:"left",position:"relative",border:`1px solid ${sel?c:C.border}`,background:sel?c+"18":C.section,color:sel?c:C.muted,fontWeight:600,fontSize:14,cursor:"pointer"}}>{sel&&<span style={{position:"absolute",top:8,right:10,fontSize:12}}>✓</span>}{ROLE_ICONS[role]} {role}</button>;})}</div></Field>
          <Field label="Joiner Heroes at Skill 5" hint="Only Skill 5 counts">
            <button onClick={()=>{const n=!p.hasNoneChecked;upd("hasNoneChecked",n);if(n)upd("heroes",[]);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",width:"100%",marginBottom:12,background:p.hasNoneChecked?C.red+"18":C.section,border:`1px solid ${p.hasNoneChecked?C.red:C.border}`,borderRadius:10,color:p.hasNoneChecked?C.red:C.muted,fontSize:14,fontWeight:600,cursor:"pointer",boxSizing:"border-box"}}>{p.hasNoneChecked?"✓":"○"} Has none at Skill 5</button>
            {!p.hasNoneChecked&&HEROES_BY_GEN.map(({gen,heroes})=><div key={gen}><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"12px 0 8px"}}>{gen}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{heroes.map(h=>{const owned=p.heroes?.includes(h);return <button key={h} onClick={()=>{const c=p.heroes||[];upd("heroes",owned?c.filter(x=>x!==h):[...c,h]);}} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${owned?C.gold:C.border}`,background:owned?C.gold+"18":C.section,color:owned?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{owned?"✓ ":""}{h}</button>;})}
            </div></div>)}
          </Field>
        </div>}
        {activeTab==="avail"&&<div>
          <Field label="SvS Availability"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["✅ Available","available",C.green],["❌ Unavailable","unavailable",C.red]].map(([l,v,c])=><button key={v} onClick={()=>updA({present:v})} style={{height:52,borderRadius:12,border:`1px solid ${p.availability.present===v?c:C.border}`,background:p.availability.present===v?c+"18":C.section,color:p.availability.present===v?c:C.muted,fontWeight:600,fontSize:15,cursor:"pointer"}}>{l}</button>)}</div></Field>
          <Field label="Timing"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["⏰ On Time","on-time"],["🕐 Late","late"],["🚪 Leaving Early","early"],["❓ Unknown","unknown"]].map(([l,v])=><button key={v} onClick={()=>updA({timing:v})} style={{padding:"8px 14px",borderRadius:20,minHeight:40,border:`1px solid ${p.availability.timing===v?C.gold:C.border}`,background:p.availability.timing===v?C.gold+"18":C.section,color:p.availability.timing===v?C.gold:C.muted,fontWeight:600,fontSize:14,cursor:"pointer"}}>{l}</button>)}</div></Field>
          <Field label="Discord During SvS"><div style={{display:"flex",gap:8}}>{[["🎙️ On Discord","yes"],["🔇 Not on Discord","no"],["❓ Unknown","unknown"]].map(([l,v])=><button key={v} onClick={()=>updA({discord:v})} style={{flex:1,height:44,borderRadius:12,border:`1px solid ${p.availability.discord===v?C.icy:C.border}`,background:p.availability.discord===v?C.icy+"18":C.section,color:p.availability.discord===v?C.icy:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{l}</button>)}</div></Field>
        </div>}
        <button onClick={save} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginTop:8}}>Save Player</button>
      </div>
    </div>
  );
}

// ── Batch Add Sheet ────────────────────────────────────────────
function BatchAddSheet({open,onClose,members,onAddNew,onUpdateExisting}){
  const [phase,setPhase]=useState(0);
  const [raw,setRaw]=useState("");
  const [tagAll,setTagAll]=useState("");
  const [tzAll,setTzAll]=useState("");
  const [showOpt,setShowOpt]=useState(false);
  const [resolved,setResolved]=useState(null);
  const [fuzzyDec,setFuzzyDec]=useState({});
  const [voiceSet,setVoiceSet]=useState(new Set());
  const [lateSet,setLateSet]=useState(new Set());
  const [lateBy,setLateBy]=useState("unknown");
  const [earlySet,setEarlySet]=useState(new Set());
  const [earlyBy,setEarlyBy]=useState("unknown");
  const [unavailSet,setUnavailSet]=useState(new Set());
  const [grpTierSel,setGrpTierSel]=useState(new Set());
  const [grpTroops,setGrpTroops]=useState({infantry:null,lancer:null,marksman:null});
  const [memTroops,setMemTroops]=useState({});
  const [tierIdx,setTierIdx]=useState(0);
  const [grpHeroSel,setGrpHeroSel]=useState(new Set());
  const [grpHeroes,setGrpHeroes]=useState([]);
  const [memHeroes,setMemHeroes]=useState({});
  const [memNone,setMemNone]=useState({});
  const [heroIdx,setHeroIdx]=useState(0);

  const parsed=raw.split(/[\n,]/).map(n=>n.trim()).filter(Boolean);
  function getActive(){if(!resolved)return[];const n=[];resolved.exact.forEach(r=>n.push(r.name));resolved.fuzzy.forEach(r=>{const d=fuzzyDec[r.name];if(d==="update"||d==="create")n.push(r.name);});resolved.fresh.forEach(r=>n.push(r.name));return n;}
  const active=getActive();
  const tierStack=active.filter(n=>!grpTierSel.has(n));
  const heroStack=active.filter(n=>!grpHeroSel.has(n));

  function resetAll(){setPhase(0);setRaw("");setTagAll("");setTzAll("");setShowOpt(false);setResolved(null);setFuzzyDec({});setVoiceSet(new Set());setLateSet(new Set());setLateBy("unknown");setEarlySet(new Set());setEarlyBy("unknown");setUnavailSet(new Set());setGrpTierSel(new Set());setGrpTroops({infantry:null,lancer:null,marksman:null});setMemTroops({});setTierIdx(0);setGrpHeroSel(new Set());setGrpHeroes([]);setMemHeroes({});setMemNone({});setHeroIdx(0);}
  function tog(set,fn,k){const n=new Set(set);n.has(k)?n.delete(k):n.add(k);fn(n);}
  function resolve(){const res=resolveBatchNames(parsed,members);setResolved(res);const d={};res.fuzzy.forEach(r=>{d[r.name]="update";});setFuzzyDec(d);setPhase(1);vibe(8);}

  function buildAvail(n){return{present:unavailSet.has(n)?"unavailable":"available",timing:lateSet.has(n)?"late":earlySet.has(n)?"early":"unknown",lateBy:lateSet.has(n)?lateBy:null,earlyBy:earlySet.has(n)?earlyBy:null,discord:voiceSet.has(n)?"yes":"unknown"};}
  function buildTroops(n){return grpTierSel.has(n)?{...grpTroops}:(memTroops[n]||{infantry:null,lancer:null,marksman:null});}
  function buildHeroes(n){return grpHeroSel.has(n)?[...grpHeroes]:(memHeroes[n]||[]);}

  function buildAndSave(){
    const toCreate=[],toUpdate=[];
    (resolved?.exact||[]).forEach(r=>{const patch={availability:buildAvail(r.name),troops:buildTroops(r.name),heroes:buildHeroes(r.name),hasNoneChecked:memNone[r.name]||false};if(tagAll)patch.allianceTag=tagAll;if(tzAll)patch.timezone=tzAll;toUpdate.push(mergePlayerObjects(r.existingPlayer,patch));});
    (resolved?.fuzzy||[]).forEach(r=>{const d=fuzzyDec[r.name];if(d==="skip")return;const patch={availability:buildAvail(r.name),troops:buildTroops(r.name),heroes:buildHeroes(r.name),hasNoneChecked:memNone[r.name]||false};if(tagAll)patch.allianceTag=tagAll;if(tzAll)patch.timezone=tzAll;d==="update"?toUpdate.push(mergePlayerObjects(r.existingPlayer,patch)):toCreate.push(newPlayer({username:r.name,allianceTag:tagAll,timezone:tzAll,...patch}));});
    (resolved?.fresh||[]).forEach(r=>{const hn=memNone[r.name]||false;toCreate.push(newPlayer({username:r.name,allianceTag:tagAll,timezone:tzAll,troops:buildTroops(r.name),heroes:hn?[]:buildHeroes(r.name),hasNoneChecked:hn,availability:buildAvail(r.name)}));});
    if(toUpdate.length)onUpdateExisting(toUpdate);
    if(toCreate.length)onAddNew(toCreate);
    vibe([10,50,10]);resetAll();onClose();
  }

  const PL=["Names","Review","Availability","Troop Tiers","Heroes"];
  if(!open)return null;

  return(
    <div style={{position:"fixed",inset:0,background:"#000a",zIndex:200,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 80px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        {/* Phase indicator */}
        <div style={{display:"flex",alignItems:"center",marginBottom:24}}>
          {PL.map((l,i)=><div key={l} style={{display:"flex",alignItems:"center",flex:1}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
              <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:i<phase?C.green:i===phase?C.gold:C.border,color:i<=phase?C.bg:C.muted,fontWeight:700,fontSize:12}}>{i<phase?"✓":i+1}</div>
              <div style={{fontSize:9,color:i===phase?C.gold:C.muted,marginTop:3,textAlign:"center"}}>{l}</div>
            </div>
            {i<PL.length-1&&<div style={{height:2,flex:0.3,background:i<phase?C.green:C.border,marginBottom:14}}/>}
          </div>)}
        </div>

        {phase===0&&<div>
          <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Who's joining?</div>
          <div style={{fontSize:13,color:C.icy,marginBottom:16,lineHeight:1.6}}>Names or usernames — one per line or comma-separated. Existing players will be updated.</div>
          <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder={"Marcus\nCaroline, ZhangWei"} style={{width:"100%",minHeight:140,background:C.section,border:`1px solid ${C.border}`,borderRadius:12,padding:14,fontSize:18,color:C.white,lineHeight:1.8,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          {parsed.length>0&&<div style={{fontSize:13,color:C.icy,margin:"10px 0"}}><span style={{color:C.white,fontWeight:600}}>{parsed.length}</span> entries</div>}
          <button onClick={()=>setShowOpt(!showOpt)} style={{background:"none",border:"none",color:C.gold,fontSize:14,cursor:"pointer",padding:"4px 0",marginBottom:12}}>{showOpt?"▾":"▸"} Set for all (optional)</button>
          {showOpt&&<div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{marginBottom:12}}><label style={{fontSize:12,color:C.muted,display:"block",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Alliance Tag</label><Inp value={tagAll} onChange={setTagAll} placeholder="R3K"/></div>
            <div><label style={{fontSize:12,color:C.muted,display:"block",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Region</label><Sel value={tzAll} onChange={setTzAll} options={TIMEZONES} placeholder="Select region…"/></div>
          </div>}
          <button disabled={parsed.length===0} onClick={resolve} style={{width:"100%",height:54,borderRadius:12,background:parsed.length>0?C.gold:C.border,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:parsed.length>0?"pointer":"default"}}>Continue →</button>
        </div>}

        {phase===1&&resolved&&<div>
          <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Review</div>
          <div style={{fontSize:13,color:C.icy,marginBottom:20}}>Confirm how each name will be handled.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
            {[[resolved.fresh.length,"New",C.green],[resolved.exact.length,"Update",C.gold],[resolved.fuzzy.length,"Review",C.mar]].map(([c,l,col])=><div key={l} style={{background:C.section,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:col}}>{c}</div><div style={{fontSize:12,color:C.muted}}>{l}</div></div>)}
          </div>
          {resolved.exact.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:8}}>✓ Will update</div>{resolved.exact.map(r=><div key={r.name} style={{background:C.section,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:14,fontWeight:700,color:C.white}}>{r.name}</div><div style={{fontSize:11,color:C.muted}}>matches "{r.existingPlayer.username||r.existingPlayer.alias}"</div></div><span style={{fontSize:12,color:C.gold,fontWeight:600}}>Update</span></div>)}</div>}
          {resolved.fuzzy.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:13,fontWeight:700,color:C.mar,marginBottom:8}}>⚠️ Possible duplicates</div>{resolved.fuzzy.map(r=>{const d=fuzzyDec[r.name]||"update";return <div key={r.name} style={{background:C.section,borderRadius:10,padding:14,marginBottom:8}}><div style={{marginBottom:8}}><div style={{fontSize:14,fontWeight:700,color:C.white}}>{r.name}</div><div style={{fontSize:11,color:C.muted}}>similar to "{r.existingPlayer.username||r.existingPlayer.alias}" ({Math.round(r.score*100)}%)</div></div><div style={{display:"flex",gap:8}}>{[["update","Update",C.gold],["create","Create new",C.green],["skip","Skip",C.muted]].map(([v,l,c])=><button key={v} onClick={()=>setFuzzyDec(prev=>({...prev,[r.name]:v}))} style={{flex:1,height:36,borderRadius:10,border:`1px solid ${d===v?c:C.border}`,background:d===v?c+"22":C.card,color:d===v?c:C.muted,fontWeight:600,fontSize:12,cursor:"pointer"}}>{l}</button>)}</div></div>;})}
          </div>}
          {resolved.fresh.length>0&&<div style={{marginBottom:20}}><div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:8}}>＋ New players</div>{resolved.fresh.map(r=><div key={r.name} style={{background:C.section,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:700,color:C.white}}>{r.name}</div><span style={{fontSize:12,color:C.green,fontWeight:600}}>New</span></div>)}</div>}
          <button onClick={()=>{setPhase(2);vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12}}>Continue →</button>
          <button onClick={()=>setPhase(0)} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0"}}>← Back</button>
        </div>}

        {phase===2&&<div>
          <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Availability</div>
          {[{label:"🎙️ Discord voice?",set:voiceSet,fn:setVoiceSet,col:C.gold},{label:"🕐 Arriving late?",set:lateSet,fn:setLateSet,col:C.icy,extra:lateSet.size>0&&<div style={{marginTop:10}}><div style={{fontSize:12,color:C.muted,marginBottom:8}}>How late?</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["15 min","30 min","1 hr","Unknown"].map(o=><button key={o} onClick={()=>setLateBy(o)} style={{padding:"6px 14px",borderRadius:20,minHeight:36,border:`1px solid ${lateBy===o?C.icy:C.border}`,background:lateBy===o?C.icy+"22":C.section,color:lateBy===o?C.icy:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{o}</button>)}</div></div>},{label:"🚪 Leaving early?",set:earlySet,fn:setEarlySet,col:C.mar,extra:earlySet.size>0&&<div style={{marginTop:10}}><div style={{fontSize:12,color:C.muted,marginBottom:8}}>How early?</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["30 min","1 hr","Unknown"].map(o=><button key={o} onClick={()=>setEarlyBy(o)} style={{padding:"6px 14px",borderRadius:20,minHeight:36,border:`1px solid ${earlyBy===o?C.mar:C.border}`,background:earlyBy===o?C.mar+"22":C.section,color:earlyBy===o?C.mar:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{o}</button>)}</div></div>},{label:"❌ Won't make it?",set:unavailSet,fn:setUnavailSet,col:C.red}].map(({label,set,fn,col,extra})=><div key={label} style={{marginBottom:24}}>
            <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>{label}</div>
            <div style={{display:"flex",gap:8,marginBottom:10}}><button onClick={()=>fn(new Set(active))} style={{fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer"}}>Select all</button><span style={{color:C.muted}}>·</span><button onClick={()=>fn(new Set())} style={{fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer"}}>Clear</button></div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{active.map(n=><AvailChip key={n} label={n} selected={set.has(n)} color={col} onClick={()=>{tog(set,fn,n);vibe(8);}}/>)}</div>
            {extra}
          </div>)}
          <button onClick={()=>{setPhase(3);vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12}}>Continue →</button>
          <button onClick={()=>setPhase(3)} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0"}}>Skip →</button>
        </div>}

        {phase===3&&<div>
          <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Troop tiers</div>
          <div style={{background:C.section,borderRadius:12,borderLeft:`3px solid ${C.gold}`,padding:16,marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:4}}>⚡ Group shortcut</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>{active.map(n=><button key={n} onClick={()=>{tog(grpTierSel,setGrpTierSel,n);vibe(8);}} style={{padding:"8px 14px",borderRadius:20,minHeight:40,border:`1px solid ${grpTierSel.has(n)?C.gold:C.border}`,background:grpTierSel.has(n)?C.gold+"22":C.card,color:grpTierSel.has(n)?C.gold:C.icy,fontWeight:600,fontSize:14,cursor:"pointer"}}>{n}</button>)}</div>
            {[["🛡️",C.inf,"infantry"],["⚔️",C.lan,"lancer"],["🏹",C.mar,"marksman"]].map(([icon,c,k])=><div key={k} style={{marginBottom:10}}><div style={{fontSize:12,color:c,fontWeight:700,marginBottom:6}}>{icon}</div><div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>setGrpTroops(prev=>({...prev,[k]:prev[k]===t?null:t}))} style={{padding:"6px 12px",borderRadius:16,flexShrink:0,border:`1px solid ${grpTroops[k]===t?c:C.border}`,background:grpTroops[k]===t?c+"22":C.section,color:grpTroops[k]===t?c:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36}}>{t}</button>)}</div></div>)}
            {grpTierSel.size>0&&<div style={{fontSize:13,color:C.green,marginTop:8}}>✓ {grpTierSel.size} members</div>}
          </div>
          {tierStack.length>0&&(()=>{const cur=tierStack[tierIdx];const mt=memTroops[cur]||{infantry:null,lancer:null,marksman:null};function setMT(f,v){setMemTroops(p=>({...p,[cur]:{...(p[cur]||{infantry:null,lancer:null,marksman:null}),[f]:v}}))}
            return <div>
              <div style={{background:C.section,borderRadius:14,padding:18,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>{cur}</div><div style={{fontSize:13,color:C.muted}}>{tierIdx+1}/{tierStack.length}</div></div>
                {[["🛡️",C.inf,"infantry"],["⚔️",C.lan,"lancer"],["🏹",C.mar,"marksman"]].map(([icon,c,k])=><div key={k} style={{marginBottom:10}}><div style={{fontSize:12,color:c,fontWeight:700,marginBottom:6}}>{icon}</div><div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>{TIER_OPTIONS.map(t=><button key={t} onClick={()=>setMT(k,mt[k]===t?null:t)} style={{padding:"6px 12px",borderRadius:16,flexShrink:0,border:`1px solid ${mt[k]===t?c:C.border}`,background:mt[k]===t?c+"22":C.section,color:mt[k]===t?c:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36}}>{t}</button>)}</div></div>)}
                {mt.infantry&&<button onClick={()=>{setMT("lancer",mt.infantry);setMT("marksman",mt.infantry);}} style={{fontSize:13,color:C.gold,background:"none",border:"none",cursor:"pointer",padding:"4px 0"}}>↳ Same for all</button>}
                <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>{tierStack.map((_,i)=><button key={i} onClick={()=>setTierIdx(i)} style={{width:i===tierIdx?20:8,height:8,borderRadius:4,border:"none",cursor:"pointer",padding:0,background:i<tierIdx?C.green:i===tierIdx?C.gold:C.border,transition:"all 200ms"}}/>)}</div>
              </div>
              <div style={{display:"flex",gap:10,marginBottom:16}}>
                {tierIdx>0&&<button onClick={()=>setTierIdx(i=>i-1)} style={{flex:1,height:48,borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:600,fontSize:15,cursor:"pointer"}}>← Back</button>}
                {tierIdx<tierStack.length-1&&<button onClick={()=>{setTierIdx(i=>i+1);vibe(8);}} style={{flex:2,height:48,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>Next →</button>}
              </div>
            </div>;
          })()}
          <button onClick={()=>{setPhase(4);setHeroIdx(0);vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12}}>Continue →</button>
          <button onClick={()=>setPhase(4)} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0"}}>Skip →</button>
        </div>}

        {phase===4&&<div>
          <div style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:6}}>Heroes at Skill 5</div>
          <div style={{background:C.section,borderRadius:12,borderLeft:`3px solid ${C.gold}`,padding:16,marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:4}}>⚡ Group shortcut</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>{active.map(n=><button key={n} onClick={()=>{tog(grpHeroSel,setGrpHeroSel,n);vibe(8);}} style={{padding:"8px 14px",borderRadius:20,minHeight:40,border:`1px solid ${grpHeroSel.has(n)?C.gold:C.border}`,background:grpHeroSel.has(n)?C.gold+"22":C.card,color:grpHeroSel.has(n)?C.gold:C.icy,fontWeight:600,fontSize:14,cursor:"pointer"}}>{n}</button>)}</div>
            {HEROES_BY_GEN.map(({gen,heroes})=><div key={gen}><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"10px 0 6px"}}>{gen}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{heroes.map(h=>{const o=grpHeroes.includes(h);return <button key={h} onClick={()=>setGrpHeroes(p=>o?p.filter(x=>x!==h):[...p,h])} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${o?C.gold:C.border}`,background:o?C.gold+"18":C.section,color:o?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{o?"✓ ":""}{h}</button>;})}</div></div>)}
            {grpHeroSel.size>0&&<div style={{fontSize:13,color:C.green,marginTop:10}}>✓ {grpHeroSel.size} members</div>}
          </div>
          {heroStack.length>0&&(()=>{const cur=heroStack[heroIdx];const ch=memHeroes[cur]||[];const cn=memNone[cur]||false;
            return <div>
              <div style={{background:C.section,borderRadius:14,padding:18,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>{cur}</div><div style={{fontSize:13,color:C.muted}}>{heroIdx+1}/{heroStack.length}</div></div>
                <button onClick={()=>{setMemNone(p=>({...p,[cur]:!cn}));if(!cn)setMemHeroes(p=>({...p,[cur]:[]}));}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",width:"100%",background:cn?C.red+"18":C.card,border:`1px solid ${cn?C.red:C.border}`,borderRadius:10,color:cn?C.red:C.muted,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:12,boxSizing:"border-box"}}>{cn?"✓":"○"} Has none</button>
                {!cn&&HEROES_BY_GEN.map(({gen,heroes})=><div key={gen}><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",margin:"10px 0 6px"}}>{gen}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{heroes.map(h=>{const o=ch.includes(h);return <button key={h} onClick={()=>setMemHeroes(p=>({...p,[cur]:o?ch.filter(x=>x!==h):[...ch,h]}))} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${o?C.gold:C.border}`,background:o?C.gold+"18":C.card,color:o?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{o?"✓ ":""}{h}</button>;})}
                </div></div>)}
                <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>{heroStack.map((_,i)=><button key={i} onClick={()=>setHeroIdx(i)} style={{width:i===heroIdx?20:8,height:8,borderRadius:4,border:"none",cursor:"pointer",padding:0,background:i<heroIdx?C.green:i===heroIdx?C.gold:C.border,transition:"all 200ms"}}/>)}</div>
              </div>
              <div style={{display:"flex",gap:10,marginBottom:16}}>
                {heroIdx>0&&<button onClick={()=>setHeroIdx(i=>i-1)} style={{flex:1,height:48,borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:600,fontSize:15,cursor:"pointer"}}>← Back</button>}
                {heroIdx<heroStack.length-1&&<button onClick={()=>{setHeroIdx(i=>i+1);vibe(8);}} style={{flex:2,height:48,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>Next →</button>}
              </div>
            </div>;
          })()}
          <button onClick={buildAndSave} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer",marginBottom:12}}>Finish & Save {active.length} Player{active.length!==1?"s":""}</button>
          <button onClick={buildAndSave} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"8px 0"}}>I'll add heroes later →</button>
        </div>}
      </div>
    </div>
  );
}

// ── Player Card ────────────────────────────────────────────────
function PlayerCard({player,onClick,onDelete,events}){
  const dn=player.username||player.alias||"Unknown";
  const rc=ROLE_COLORS[player.roles?.[0]]||C.muted;
  const metrics=calcMetrics(player,events||[]);
  const glyphs=[];
  if(player.availability?.discord==="yes")glyphs.push("🎙️");
  if(player.availability?.timing==="late")glyphs.push("🕐");
  if(player.availability?.timing==="early")glyphs.push("🚪");
  if(player.availability?.present==="unavailable")glyphs.push("❌");
  return(
    <div onClick={onClick} style={{background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12,cursor:"pointer",WebkitTapHighlightColor:"transparent",userSelect:"none"}}>
      <div style={{width:48,height:48,borderRadius:"50%",flexShrink:0,background:rc+"33",border:`2px solid ${rc}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:17,color:C.white}}>{initials(dn)}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <div style={{fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dn}</div>
          {glyphs.map((g,i)=><span key={i} style={{fontSize:13}}>{g}</span>)}
          {metrics&&<span style={{fontSize:11,fontWeight:700,color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red,marginLeft:2}}>{metrics.reliabilityScore}pts</span>}
        </div>
        <div style={{fontSize:12,color:C.icy,marginBottom:4}}>{[player.allianceTag&&`[${player.allianceTag}]`,player.country,player.timezone].filter(Boolean).join(" · ")}</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {[["🛡️",player.troops?.infantry,C.inf],["⚔️",player.troops?.lancer,C.lan],["🏹",player.troops?.marksman,C.mar]].map(([i,t,c],idx)=><span key={idx} style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:8,background:(t?c:C.muted)+"22",border:`1px solid ${(t?c:C.muted)}33`,color:t?c:C.muted}}>{i} {t||"?"}</span>)}
          {player.heroes?.slice(0,3).map(h=><span key={h} style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:8,background:C.gold+"18",border:`1px solid ${C.gold}33`,color:C.gold}}>✓ {h}</span>)}
          {(player.heroes?.length??0)>3&&<span style={{fontSize:11,color:C.muted}}>+{player.heroes.length-3}</span>}
        </div>
        {player.profileLastUpdated&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>Updated {fmtDate(player.profileLastUpdated)}</div>}
      </div>
      <button onClick={e=>{e.stopPropagation();onDelete(player.id);}} style={{background:"none",border:"none",color:C.red+"88",fontSize:18,cursor:"pointer",padding:"8px",flexShrink:0,lineHeight:1}}>✕</button>
    </div>
  );
}

// ── Event Sheet ────────────────────────────────────────────────
function EventSheet({event,open,onClose,onSave,players}){
  const [ev,setEv]=useState(()=>event||newEvent());
  useEffect(()=>{if(open)setEv(event?{...event}:newEvent());},[open,event?.id]);
  function upd(k,v){setEv(prev=>({...prev,[k]:v}));}
  const allTags=[...new Set(players.map(p=>p.allianceTag).filter(Boolean))];
  if(!open)return null;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"88vh",overflowY:"auto",padding:"16px 20px 80px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>{event?"Edit Event":"New Event"}</div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
        <Field label="Event Type"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{EVENT_TYPES.map(t=><button key={t} onClick={()=>upd("type",t)} style={{padding:"12px 14px",borderRadius:12,border:`1px solid ${ev.type===t?C.gold:C.border}`,background:ev.type===t?C.gold+"18":C.section,color:ev.type===t?C.gold:C.muted,fontWeight:600,fontSize:14,cursor:"pointer",textAlign:"left"}}>{EVENT_ICONS[t]||"📋"} {t}</button>)}</div></Field>
        <Field label="Alliance" hint="Which alliance is hosting this event">
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
            {allTags.map(t=><button key={t} onClick={()=>upd("allianceTag",ev.allianceTag===t?"":t)} style={{padding:"8px 14px",borderRadius:20,minHeight:36,border:`1px solid ${ev.allianceTag===t?C.gold:C.border}`,background:ev.allianceTag===t?C.gold+"22":C.section,color:ev.allianceTag===t?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>[{t}]</button>)}
          </div>
          <Inp value={ev.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="Or type alliance tag…"/>
        </Field>
        <Field label="Event Name / Label"><Inp value={ev.name} onChange={v=>upd("name",v)} placeholder="e.g. SvS Week 3 — May 2026"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <Field label="Date"><Inp type="date" value={ev.date} onChange={v=>upd("date",v)}/></Field>
          <Field label="Time"><Inp type="time" value={ev.time||"12:00"} onChange={v=>upd("time",v)}/></Field>
        </div>
        <Field label="Participating Players" hint="Select players in this event">
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {players.map(p=>{const sel=(ev.participantIds||[]).includes(p.id);return <button key={p.id} onClick={()=>{const cur=ev.participantIds||[];upd("participantIds",sel?cur.filter(id=>id!==p.id):[...cur,p.id]);}} style={{padding:"6px 12px",borderRadius:16,minHeight:36,border:`1px solid ${sel?C.gold:C.border}`,background:sel?C.gold+"22":C.section,color:sel?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{p.username||p.alias||"?"}</button>;})}
          </div>
          {(ev.participantIds||[]).length>0&&<div style={{fontSize:12,color:C.muted,marginTop:6}}>{ev.participantIds.length} selected</div>}
        </Field>
        <Field label="Notes"><textarea value={ev.notes||""} onChange={e=>upd("notes",e.target.value)} placeholder="Pre-event notes…" style={{width:"100%",minHeight:72,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></Field>
        <button onClick={()=>{onSave(ev);onClose();vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer"}}>Save Event</button>
      </div>
    </div>
  );
}

// ── Snapshot Editor ────────────────────────────────────────────
function SnapshotEditor({snapshot,playerName,open,onClose,onSave}){
  const [s,setS]=useState(()=>snapshot||{});
  useEffect(()=>{if(open&&snapshot)setS({...snapshot});},[open,snapshot?.snapshotId]);
  function updA(p){setS(prev=>({...prev,attendance:{...prev.attendance,...p}}));}
  function updV(p){setS(prev=>({...prev,voice:{...prev.voice,...p}}));}
  function updC(p){setS(prev=>({...prev,combat:{...prev.combat,...p}}));}
  function setTag(t){setS(prev=>({...prev,performanceTag:prev.performanceTag===t?null:t}));}
  if(!open||!snapshot)return null;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:400,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"92vh",overflowY:"auto",padding:"16px 20px 100px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div><div style={{fontSize:18,fontWeight:700,color:C.white}}>{playerName}</div><div style={{fontSize:13,color:C.muted}}>Event record</div></div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
        <div style={{marginBottom:20}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Performance Tag</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{PERF_TAGS.map(t=><button key={t.key} onClick={()=>setTag(t.key)} style={{padding:"8px 14px",borderRadius:20,minHeight:36,border:`1px solid ${s.performanceTag===t.key?t.color:C.border}`,background:s.performanceTag===t.key?t.color+"18":C.section,color:s.performanceTag===t.key?t.color:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{t.label}</button>)}</div></div>
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:12}}>📅 Attendance</div><ToggleRow label="Attended" value={s.attendance?.attended} onChange={v=>updA({attended:v})} tristate={true}/><ToggleRow label="Late" value={s.attendance?.late} onChange={v=>updA({late:v})} colorOn={C.gold} colorOff={C.muted}/><ToggleRow label="Left Early" value={s.attendance?.leftEarly} onChange={v=>updA({leftEarly:v})} colorOn={C.mar} colorOff={C.muted}/><ToggleRow label="No-show" value={s.attendance?.noShow} onChange={v=>updA({noShow:v})} colorOn={C.red} colorOff={C.muted}/><ToggleRow label="Stayed full" value={s.attendance?.stayedFull} onChange={v=>updA({stayedFull:v})}/><ToggleRow label="Prep phase" value={s.attendance?.prepPhase} onChange={v=>updA({prepPhase:v})}/><ToggleRow label="Battle phase" value={s.attendance?.battlePhase} onChange={v=>updA({battlePhase:v})}/></div>
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:12}}>🎙️ Discord Voice</div><ToggleRow label="Joined voice" value={s.voice?.joined} onChange={v=>updV({joined:v})} tristate={true}/><ToggleRow label="On time" value={s.voice?.onTime} onChange={v=>updV({onTime:v})}/><ToggleRow label="Joined late" value={s.voice?.joinedLate} onChange={v=>updV({joinedLate:v})} colorOn={C.gold} colorOff={C.muted}/><ToggleRow label="Left voice early" value={s.voice?.leftEarly} onChange={v=>updV({leftEarly:v})} colorOn={C.mar} colorOff={C.muted}/><div style={{marginTop:12}}><label style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>Voice quality note</label><Inp value={s.voice?.qualityNote||""} onChange={v=>updV({qualityNote:v})} placeholder="Optional…"/></div></div>
        <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:12}}>⚔️ Combat</div><ToggleRow label="Joined rallies" value={s.combat?.joinedRallies} onChange={v=>updC({joinedRallies:v})}/><ToggleRow label="Led rallies" value={s.combat?.ledRallies} onChange={v=>updC({ledRallies:v})} colorOn={C.gold} colorOff={C.muted}/><ToggleRow label="Defended structures" value={s.combat?.defendedStructures} onChange={v=>updC({defendedStructures:v})}/><ToggleRow label="Followed orders" value={s.combat?.followedOrders} onChange={v=>updC({followedOrders:v})} tristate={true}/><ToggleRow label="Went rogue ⚠️" value={s.combat?.wentRogue} onChange={v=>updC({wentRogue:v})} colorOn={C.red} colorOff={C.muted}/></div>
        <div style={{marginBottom:20}}><label style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:8}}>Officer Notes</label><textarea value={s.notes||""} onChange={e=>setS(prev=>({...prev,notes:e.target.value}))} placeholder="Notes…" style={{width:"100%",minHeight:80,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
        <button onClick={()=>{onSave(s);onClose();vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer"}}>Save Record</button>
      </div>
    </div>
  );
}

// ── Events Tab ─────────────────────────────────────────────────
function EventsTab({events,players,onCreateEvent,onUpdateEvent,onDeleteEvent}){
  const [filterType,setFilterType]=useState("All");
  const [filterTag,setFilterTag]=useState("");
  const [editingEvent,setEditingEvent]=useState(null);
  const [eventSheetOpen,setEventSheetOpen]=useState(false);
  const [activeEventId,setActiveEventId]=useState(null);
  const [snapEditing,setSnapEditing]=useState(null);
  const [snapOpen,setSnapOpen]=useState(false);
  const [bulkMode,setBulkMode]=useState(false);
  const [bulkSel,setBulkSel]=useState(new Set());

  const activeEvent=events.find(e=>e.id===activeEventId);
  const allTags=[...new Set(events.map(e=>e.allianceTag).filter(Boolean))];
  let filtered=filterType==="All"?events:events.filter(e=>e.type===filterType);
  if(filterTag)filtered=filtered.filter(e=>e.allianceTag===filterTag);
  const sorted=[...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));

  function getSnap(ev,pid){return(ev.snapshots||[]).find(s=>s.playerId===pid);}
  function openSnap(ev,player){const s=getSnap(ev,player.id)||newSnapshot(player.id,player,ev.id);setSnapEditing({snapshot:s,playerName:player.username||player.alias||"Unknown",eventId:ev.id,playerId:player.id});setSnapOpen(true);}
  function saveSnap(upd){const{eventId,playerId}=snapEditing;const ev=events.find(e=>e.id===eventId);if(!ev)return;const snaps=[...(ev.snapshots||[])];const idx=snaps.findIndex(s=>s.playerId===playerId);if(idx>=0)snaps[idx]=upd;else snaps.push(upd);onUpdateEvent({...ev,snapshots:snaps});}
  function applyBulk(tag){if(!activeEvent||!bulkSel.size)return;const snaps=[...(activeEvent.snapshots||[])];bulkSel.forEach(pid=>{const player=players.find(p=>p.id===pid);if(!player)return;const idx=snaps.findIndex(s=>s.playerId===pid);let s=idx>=0?{...snaps[idx]}:newSnapshot(pid,player,activeEvent.id);if(tag==="attended")s={...s,attendance:{...s.attendance,attended:true,noShow:false}};if(tag==="noshow")s={...s,attendance:{...s.attendance,attended:false,noShow:true}};if(tag==="late")s={...s,attendance:{...s.attendance,late:true}};if(tag==="voice")s={...s,voice:{...s.voice,joined:true}};if(idx>=0)snaps[idx]=s;else snaps.push(s);});onUpdateEvent({...activeEvent,snapshots:snaps});setBulkSel(new Set());setBulkMode(false);vibe(8);}
  function evSum(ev){const sn=ev.snapshots||[];return{total:sn.length,attended:sn.filter(s=>s.attendance.attended===true).length,noShow:sn.filter(s=>s.attendance.noShow).length,voice:sn.filter(s=>s.voice.joined===true).length};}

  // Participants for active event
  const eventPlayers = activeEvent
    ? (activeEvent.participantIds?.length>0
        ? players.filter(p=>activeEvent.participantIds.includes(p.id))
        : players)
    : [];

  return(
    <div style={{padding:"16px 20px 0"}}>
      {activeEvent?(
        <div>
          <button onClick={()=>{setActiveEventId(null);setBulkMode(false);setBulkSel(new Set());}} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",color:C.gold,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:16,padding:0}}>← Back to Events</button>
          <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div><div style={{fontSize:20,fontWeight:700,color:C.white}}>{EVENT_ICONS[activeEvent.type]||"📋"} {activeEvent.name||activeEvent.type}</div><div style={{fontSize:13,color:C.muted}}>{fmtDateShort(activeEvent.date)}{activeEvent.time?` ${activeEvent.time}`:""}{activeEvent.allianceTag?` · [${activeEvent.allianceTag}]`:""}</div></div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setEditingEvent(activeEvent);setEventSheetOpen(true);}} style={{height:34,padding:"0 12px",borderRadius:20,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,cursor:"pointer"}}>Edit</button>
                <button onClick={()=>{const n=activeEvent.status==="active"?"completed":activeEvent.status==="completed"?"upcoming":"active";onUpdateEvent({...activeEvent,status:n});}} style={{height:34,padding:"0 12px",borderRadius:20,background:activeEvent.status==="active"?C.green+"22":C.section,border:`1px solid ${activeEvent.status==="active"?C.green:C.border}`,color:activeEvent.status==="active"?C.green:C.muted,fontSize:13,fontWeight:600,cursor:"pointer"}}>{activeEvent.status==="active"?"🔴 Live":activeEvent.status==="completed"?"✓ Done":"Upcoming"}</button>
              </div>
            </div>
            {(()=>{const s=evSum(activeEvent);return s.total>0?<div style={{display:"flex",gap:12}}><span style={{fontSize:13,color:C.green}}>✓ {s.attended}</span><span style={{fontSize:13,color:C.red}}>✗ {s.noShow}</span><span style={{fontSize:13,color:C.icy}}>🎙️ {s.voice}</span></div>:<div style={{fontSize:13,color:C.muted}}>No records yet</div>;})()}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto"}}>
            <button onClick={()=>{setBulkMode(!bulkMode);setBulkSel(new Set());}} style={{height:36,padding:"0 14px",borderRadius:20,background:bulkMode?C.gold+"22":C.section,border:`1px solid ${bulkMode?C.gold:C.border}`,color:bulkMode?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>{bulkMode?`✓ ${bulkSel.size} selected`:"⚡ Bulk Edit"}</button>
            {bulkMode&&bulkSel.size>0&&[["✓ Attended","attended",C.green],["✗ No-show","noshow",C.red],["🕐 Late","late",C.gold],["🎙️ Voice","voice",C.icy]].map(([l,t,c])=><button key={t} onClick={()=>applyBulk(t)} style={{height:36,padding:"0 12px",borderRadius:20,background:c+"18",border:`1px solid ${c}44`,color:c,fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>)}
          </div>
          {eventPlayers.length===0?<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>No participants — add players in Roster first</div>:eventPlayers.map(player=>{
            const snap=getSnap(activeEvent,player.id);
            const dn=player.username||player.alias||"Unknown";
            const isSel=bulkSel.has(player.id);
            const tagInfo=PERF_TAGS.find(t=>t.key===snap?.performanceTag);
            function rowClick(){if(bulkMode){const n=new Set(bulkSel);isSel?n.delete(player.id):n.add(player.id);setBulkSel(n);}else openSnap(activeEvent,player);}
            return(
              <div key={player.id} onClick={rowClick} style={{background:isSel?C.gold+"18":C.card,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10,cursor:"pointer",border:`1px solid ${isSel?C.gold:C.border+"44"}`,WebkitTapHighlightColor:"transparent"}}>
                {bulkMode&&<div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${isSel?C.gold:C.border}`,background:isSel?C.gold:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isSel&&<span style={{fontSize:12,color:C.bg,fontWeight:700}}>✓</span>}</div>}
                <div style={{width:36,height:36,borderRadius:"50%",background:(ROLE_COLORS[player.roles?.[0]]||C.muted)+"33",border:`1.5px solid ${ROLE_COLORS[player.roles?.[0]]||C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:C.white,flexShrink:0}}>{initials(dn)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dn}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:3}}>
                    {snap?.attendance?.attended===true&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.green+"18",color:C.green,fontWeight:600}}>✓</span>}
                    {snap?.attendance?.noShow&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.red+"18",color:C.red,fontWeight:600}}>✗</span>}
                    {snap?.attendance?.attended===null&&!snap?.attendance?.noShow&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.muted+"22",color:C.muted,fontWeight:600}}>—</span>}
                    {snap?.attendance?.late&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.gold+"18",color:C.gold,fontWeight:600}}>🕐</span>}
                    {snap?.voice?.joined===true&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.icy+"18",color:C.icy,fontWeight:600}}>🎙️</span>}
                    {snap?.combat?.wentRogue&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:C.red+"18",color:C.red,fontWeight:600}}>⚠️</span>}
                    {tagInfo&&<span style={{fontSize:11,padding:"1px 7px",borderRadius:8,background:tagInfo.color+"18",color:tagInfo.color,fontWeight:600}}>{tagInfo.label}</span>}
                  </div>
                </div>
                {!bulkMode&&<span style={{fontSize:18,color:C.muted}}>›</span>}
              </div>
            );
          })}
        </div>
      ):(
        <>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:8}}>
            {["All",...EVENT_TYPES].map(t=><button key={t} onClick={()=>setFilterType(t)} style={{padding:"7px 14px",borderRadius:20,whiteSpace:"nowrap",background:filterType===t?C.gold+"22":C.section,border:`1px solid ${filterType===t?C.gold:C.border}`,color:filterType===t?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36}}>{EVENT_ICONS[t]||""} {t}</button>)}
          </div>
          {allTags.length>0&&<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:8}}>
            <button onClick={()=>setFilterTag("")} style={{padding:"5px 12px",borderRadius:20,whiteSpace:"nowrap",background:filterTag===""?C.icy+"22":C.section,border:`1px solid ${filterTag===""?C.icy:C.border}`,color:filterTag===""?C.icy:C.muted,fontWeight:600,fontSize:12,cursor:"pointer",minHeight:30}}>All alliances</button>
            {allTags.map(t=><button key={t} onClick={()=>setFilterTag(filterTag===t?"":t)} style={{padding:"5px 12px",borderRadius:20,whiteSpace:"nowrap",background:filterTag===t?C.icy+"22":C.section,border:`1px solid ${filterTag===t?C.icy:C.border}`,color:filterTag===t?C.icy:C.muted,fontWeight:600,fontSize:12,cursor:"pointer",minHeight:30}}>[{t}]</button>)}
          </div>}
          <button onClick={()=>{setEditingEvent(null);setEventSheetOpen(true);}} style={{width:"100%",height:48,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer",marginBottom:16}}>＋ New Event</button>
          {sorted.length===0?<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>No events yet</div><div style={{fontSize:14,color:C.muted}}>Create your first event</div></div>:sorted.map(ev=>{
            const s=evSum(ev);const sc=ev.status==="active"?C.green:ev.status==="completed"?C.muted:C.icy;
            return(
              <div key={ev.id} onClick={()=>setActiveEventId(ev.id)} style={{background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",border:`1px solid ${ev.status==="active"?C.green+"44":C.border+"44"}`,WebkitTapHighlightColor:"transparent"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{EVENT_ICONS[ev.type]||"📋"} {ev.name||ev.type}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{fmtDateShort(ev.date)}{ev.time?` ${ev.time}`:""}{ev.allianceTag?` · [${ev.allianceTag}]`:""}</div></div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <span style={{fontSize:11,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:10,background:sc+"18",border:`1px solid ${sc}33`}}>{ev.status==="active"?"🔴 Live":ev.status==="completed"?"✓ Done":"Upcoming"}</span>
                    <button onClick={e=>{e.stopPropagation();if(window.confirm("Delete?"))onDeleteEvent(ev.id);}} style={{fontSize:11,color:C.red+"88",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>Delete</button>
                  </div>
                </div>
                {s.total>0&&<div style={{display:"flex",gap:10}}><span style={{fontSize:12,color:C.green}}>✓ {s.attended}</span><span style={{fontSize:12,color:C.red}}>✗ {s.noShow}</span><span style={{fontSize:12,color:C.icy}}>🎙️ {s.voice}</span><span style={{fontSize:12,color:C.muted}}>{s.total} recorded</span></div>}
              </div>
            );
          })}
        </>
      )}
      <EventSheet event={editingEvent} open={eventSheetOpen} onClose={()=>setEventSheetOpen(false)} onSave={ev=>{if(editingEvent)onUpdateEvent(ev);else onCreateEvent(ev);}} players={players}/>
      <SnapshotEditor snapshot={snapEditing?.snapshot} playerName={snapEditing?.playerName} open={snapOpen} onClose={()=>setSnapOpen(false)} onSave={saveSnap}/>
    </div>
  );
}

// ── SvS Plan Tab ───────────────────────────────────────────────
function SvsPlanTab({plans,players,events,onSave,onDelete}){
  const [activePlanId,setActivePlanId]=useState(null);
  const [planSheetOpen,setPlanSheetOpen]=useState(false);
  const [editingPlan,setEditingPlan]=useState(null);
  const [liveMode,setLiveMode]=useState(false);
  const [suggestOpen,setSuggestOpen]=useState(false);
  const [suggestReqs,setSuggestReqs]=useState({heroes:[],minFurnace:0,requireDiscord:false,requireAvailable:true,minReliability:0,roles:[]});
  const [suggestResults,setSuggestResults]=useState(null);
  const [heroFilter,setHeroFilter]=useState(null); // for hero pill click

  const activePlan=plans.find(p=>p.id===activePlanId);

  function savePlan(plan){const exists=plans.find(p=>p.id===plan.id);onSave(exists?plans.map(p=>p.id===plan.id?plan:p):[...plans,plan]);}
  function updateActivePlan(patch){if(!activePlan)return;savePlan({...activePlan,...patch});}

  // Rally helpers
  function addRally(){updateActivePlan({rallies:[...(activePlan.rallies||[]),newRally({order:(activePlan.rallies||[]).length+1})]});}
  function updateRally(id,patch){updateActivePlan({rallies:activePlan.rallies.map(r=>r.id===id?{...r,...patch}:r)});}
  function deleteRally(id){updateActivePlan({rallies:activePlan.rallies.filter(r=>r.id!==id)});}

  // Reinforcement helpers
  function addReinf(){updateActivePlan({reinforcements:[...(activePlan.reinforcements||[]),newReinforcement()]});}
  function updateReinf(id,patch){updateActivePlan({reinforcements:activePlan.reinforcements.map(r=>r.id===id?{...r,...patch}:r)});}
  function deleteReinf(id){updateActivePlan({reinforcements:activePlan.reinforcements.filter(r=>r.id!==id)});}

  // Assignment helpers
  function addAssign(role){updateActivePlan({assignments:[...(activePlan.assignments||[]),newAssignment({teamRole:role})]});}
  function updateAssign(id,patch){updateActivePlan({assignments:activePlan.assignments.map(a=>a.id===id?{...a,...patch}:a)});}
  function deleteAssign(id){updateActivePlan({assignments:activePlan.assignments.filter(a=>a.id!==id)});}

  // March db helpers
  function addMarch(){updateActivePlan({marchDb:[...(activePlan.marchDb||[]),newMarchEntry()]});}
  function updateMarch(id,patch){updateActivePlan({marchDb:activePlan.marchDb.map(m=>m.id===id?{...m,...patch}:m)});}
  function deleteMarch(id){updateActivePlan({marchDb:activePlan.marchDb.filter(m=>m.id!==id)});}

  // Auto-recalc rally impact times
  function recalcRallies(rallies){
    return rallies.map(r=>{
      if(r.launchTime&&r.marchDuration>0){return {...r,impactTime:calcImpactTime(r.launchTime,r.marchDuration)};}
      return r;
    });
  }
  function recalcReinforcements(reinfs){
    return reinfs.map(r=>{
      if(r.targetArrivalTime&&r.marchDuration>0){return {...r,sendTime:calcSendTime(r.targetArrivalTime,r.marchDuration)};}
      return r;
    });
  }

  // Auto-suggest
  function runSuggest(){
    const results=autoSuggestPlayers(players,events,suggestReqs);
    setSuggestResults(results);
  }

  // Countdown for active plan target impact
  const countdown=useCountdown(activePlan?.targetImpactTime);

  // Timeline events from rallies + reinforcements
  function buildTimeline(){
    if(!activePlan)return[];
    const events=[];
    (activePlan.rallies||[]).forEach(r=>{
      if(r.launchTime)events.push({time:parseHMS(r.launchTime),label:`🚀 ${r.label||`Rally ${r.order}`} launches`,color:r.isCounter?C.mar:C.gold,type:"rally_launch"});
      if(r.impactTime)events.push({time:parseHMS(r.impactTime),label:`💥 ${r.label||`Rally ${r.order}`} impacts`,color:r.isCounter?C.mar:r.isStrong?C.red:C.gold,type:"rally_impact"});
    });
    (activePlan.reinforcements||[]).forEach(r=>{
      if(r.sendTime)events.push({time:parseHMS(r.sendTime),label:`📤 ${r.playerName||"Reinf"} sends`,color:C.icy,type:"reinf_send"});
      if(r.targetArrivalTime)events.push({time:parseHMS(r.targetArrivalTime),label:`🏰 ${r.playerName||"Reinf"} arrives`,color:C.green,type:"reinf_arrive"});
    });
    return events.sort((a,b)=>a.time-b.time);
  }

  const timeline=activePlan?buildTimeline():[];
  const rallyWarnings=activePlan?getRallyWarnings(activePlan.rallies||[]):[];

  // Counter warnings (first non-counter vs first counter)
  const enemyRally=activePlan?.rallies?.find(r=>!r.isCounter&&r.impactTime);
  const counterRally=activePlan?.rallies?.find(r=>r.isCounter&&r.impactTime);
  const counterWarnings=enemyRally&&counterRally?getCounterWarnings(enemyRally.impactTime,counterRally.impactTime):[];

  if(!activePlan)return(
    <div style={{padding:"16px 20px 0"}}>
      <button onClick={()=>{setEditingPlan(newSvsPlan());setPlanSheetOpen(true);}} style={{width:"100%",height:48,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer",marginBottom:16}}>＋ New Battle Plan</button>
      {plans.length===0?<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:40,marginBottom:12}}>⚔️</div><div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>No battle plans yet</div><div style={{fontSize:14,color:C.muted}}>Create a plan to coordinate your SvS strategy</div></div>:plans.map(plan=>(
        <div key={plan.id} onClick={()=>setActivePlanId(plan.id)} style={{background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{plan.name||plan.strategy}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{plan.strategy} · {fmtDateShort(plan.date)}{plan.allianceTag?` · [${plan.allianceTag}]`:""}</div></div>
            <div style={{display:"flex",gap:8}}>
              <span style={{fontSize:12,color:plan.status==="active"?C.green:plan.status==="completed"?C.muted:C.icy,fontWeight:700}}>{plan.status==="active"?"🔴 Live":plan.status==="completed"?"✓ Done":"Draft"}</span>
              <button onClick={e=>{e.stopPropagation();if(window.confirm("Delete?"))onDelete(plan.id);}} style={{fontSize:11,color:C.red+"88",background:"none",border:"none",cursor:"pointer"}}>✕</button>
            </div>
          </div>
          <div style={{fontSize:12,color:C.muted,marginTop:6}}>{(plan.assignments||[]).length} assignments · {(plan.rallies||[]).length} rallies · {(plan.reinforcements||[]).length} reinforcements</div>
        </div>
      ))}

      {/* Plan sheet */}
      <Sheet open={planSheetOpen} onClose={()=>setPlanSheetOpen(false)}>
        {editingPlan&&<PlanCreateSheet plan={editingPlan} players={players} onSave={p=>{savePlan(p);setPlanSheetOpen(false);setActivePlanId(p.id);vibe(8);}} onClose={()=>setPlanSheetOpen(false)}/>}
      </Sheet>
    </div>
  );

  // ── Active plan detail ─────────────────────────────────────
  return(
    <div style={{padding:"16px 20px 0"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={()=>setActivePlanId(null)} style={{background:"none",border:"none",color:C.gold,fontSize:14,fontWeight:600,cursor:"pointer",padding:0}}>← Plans</button>
        <div style={{flex:1,fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activePlan.name||activePlan.strategy}</div>
        <button onClick={()=>setLiveMode(!liveMode)} style={{height:34,padding:"0 12px",borderRadius:20,background:liveMode?C.green+"22":C.section,border:`1px solid ${liveMode?C.green:C.border}`,color:liveMode?C.green:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>{liveMode?"🔴 LIVE":"Live Mode"}</button>
      </div>

      {/* Live mode */}
      {liveMode&&<LiveBattleMode plan={activePlan} countdown={countdown} onUpdate={updateActivePlan} players={players} onAssignUpdate={updateAssign}/>}

      {!liveMode&&<>
        {/* Plan header */}
        <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontSize:13,color:C.muted}}>{activePlan.strategy}{activePlan.allianceTag?` · [${activePlan.allianceTag}]`:""} · {fmtDateShort(activePlan.date)}</div>
              {activePlan.targetImpactTime&&<div style={{fontSize:13,color:C.icy,marginTop:2}}>Target impact: {activePlan.targetImpactTime}{countdown!=null&&<span style={{color:countdown>0?C.gold:C.red,marginLeft:8,fontWeight:700}}>{countdown>0?`(T-${secsToHuman(countdown)})`:"IMPACT"}</span>}</div>}
            </div>
            <button onClick={()=>{const n=activePlan.status==="active"?"completed":activePlan.status==="completed"?"draft":"active";updateActivePlan({status:n});}} style={{height:34,padding:"0 12px",borderRadius:20,background:activePlan.status==="active"?C.green+"22":C.section,border:`1px solid ${activePlan.status==="active"?C.green:C.border}`,color:activePlan.status==="active"?C.green:C.muted,fontSize:13,fontWeight:600,cursor:"pointer"}}>{activePlan.status==="active"?"🔴 Active":activePlan.status==="completed"?"✓ Done":"Set Live"}</button>
          </div>
          {/* Edit fields inline */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>STRATEGY</div><Sel value={activePlan.strategy} onChange={v=>updateActivePlan({strategy:v})} options={STRATEGY_TYPES} placeholder=""/></div>
            <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>TARGET IMPACT</div><Inp value={activePlan.targetImpactTime||""} onChange={v=>updateActivePlan({targetImpactTime:v})} placeholder="HH:MM:SS"/></div>
          </div>
        </div>

        {/* Warnings */}
        {[...rallyWarnings,...counterWarnings].map((w,i)=><Warning key={i} text={w}/>)}

        {/* Tabs */}
        <PlanDetailTabs
          plan={activePlan}
          players={players}
          onAddRally={addRally}
          onUpdateRally={(id,patch)=>{const updated=recalcRallies(activePlan.rallies.map(r=>r.id===id?{...r,...patch}:r));updateActivePlan({rallies:updated});}}
          onDeleteRally={deleteRally}
          onAddReinf={addReinf}
          onUpdateReinf={(id,patch)=>{const updated=recalcReinforcements(activePlan.reinforcements.map(r=>r.id===id?{...r,...patch}:r));updateActivePlan({reinforcements:updated});}}
          onDeleteReinf={deleteReinf}
          onAddAssign={addAssign}
          onUpdateAssign={updateAssign}
          onDeleteAssign={deleteAssign}
          onAddMarch={addMarch}
          onUpdateMarch={updateMarch}
          onDeleteMarch={deleteMarch}
          onUpdatePlan={updateActivePlan}
          timeline={timeline}
        />

        {/* Auto-suggest */}
        <div style={{marginTop:20}}>
          <button onClick={()=>setSuggestOpen(!suggestOpen)} style={{width:"100%",height:44,borderRadius:10,background:C.section,border:`1px solid ${C.gold}44`,color:C.gold,fontWeight:600,fontSize:15,cursor:"pointer"}}>⚡ Auto-Suggest Players</button>
          {suggestOpen&&<AutoSuggestPanel players={players} events={events} reqs={suggestReqs} onReqsChange={setSuggestReqs} results={suggestResults} onRun={runSuggest} onAssign={(player,role)=>{addAssign(role);updateActivePlan({assignments:[...(activePlan.assignments||[]),newAssignment({playerId:player.id,playerName:player.username||player.alias||"",allianceTag:player.allianceTag||"",teamRole:role})]});setSuggestOpen(false);}}/>}
        </div>

        {/* Post-battle notes */}
        {activePlan.status==="completed"&&<div style={{marginTop:16}}>
          <Field label="Post-Battle Notes / Lessons Learned">
            <textarea value={activePlan.postBattleNotes||""} onChange={e=>updateActivePlan({postBattleNotes:e.target.value})} placeholder="What worked? What failed? Timing issues? Voice quality?" style={{width:"100%",minHeight:100,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:15,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </Field>
        </div>}
      </>}
    </div>
  );
}

// ── Plan Create Sheet ──────────────────────────────────────────
function PlanCreateSheet({plan,players,onSave,onClose}){
  const [p,setP]=useState({...plan});
  function upd(k,v){setP(prev=>({...prev,[k]:v}));}
  const allTags=[...new Set(players.map(pl=>pl.allianceTag).filter(Boolean))];
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>New Battle Plan</div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
      <Field label="Plan Name"><Inp value={p.name} onChange={v=>upd("name",v)} placeholder="e.g. Counter Rally — SvS May 2026"/></Field>
      <Field label="Strategy"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{STRATEGY_TYPES.map(s=><button key={s} onClick={()=>upd("strategy",s)} style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${p.strategy===s?C.gold:C.border}`,background:p.strategy===s?C.gold+"18":C.section,color:p.strategy===s?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>{s}</button>)}</div></Field>
      <Field label="Alliance">
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>{allTags.map(t=><button key={t} onClick={()=>upd("allianceTag",p.allianceTag===t?"":t)} style={{padding:"8px 14px",borderRadius:20,minHeight:36,border:`1px solid ${p.allianceTag===t?C.gold:C.border}`,background:p.allianceTag===t?C.gold+"22":C.section,color:p.allianceTag===t?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>[{t}]</button>)}</div>
        <Inp value={p.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="Or type tag…"/>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <Field label="Date"><Inp type="date" value={p.date} onChange={v=>upd("date",v)}/></Field>
        <Field label="Target Impact"><Inp value={p.targetImpactTime||""} onChange={v=>upd("targetImpactTime",v)} placeholder="HH:MM:SS"/></Field>
      </div>
      <Field label="Notes"><textarea value={p.notes||""} onChange={e=>upd("notes",e.target.value)} placeholder="Pre-battle notes…" style={{width:"100%",minHeight:72,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",fontSize:16,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></Field>
      <button onClick={()=>onSave(p)} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer"}}>Create Plan</button>
    </div>
  );
}

// ── Plan Detail Tabs ───────────────────────────────────────────
function PlanDetailTabs({plan,players,onAddRally,onUpdateRally,onDeleteRally,onAddReinf,onUpdateReinf,onDeleteReinf,onAddAssign,onUpdateAssign,onDeleteAssign,onAddMarch,onUpdateMarch,onDeleteMarch,onUpdatePlan,timeline}){
  const [tab,setTab]=useState("rallies");
  const TABS=[{id:"rallies",label:"🚀 Rallies"},{id:"reinf",label:"🏰 Reinforcements"},{id:"teams",label:"👥 Teams"},{id:"march",label:"⏱ March DB"},{id:"timeline",label:"📊 Timeline"}];

  return(
    <div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:16}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:20,whiteSpace:"nowrap",background:tab===t.id?C.gold+"22":C.section,border:`1px solid ${tab===t.id?C.gold:C.border}`,color:tab===t.id?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",flexShrink:0}}>{t.label}</button>)}
      </div>

      {/* Rallies */}
      {tab==="rallies"&&<div>
        <button onClick={onAddRally} style={{width:"100%",height:44,borderRadius:10,background:C.section,border:`1px solid ${C.gold}44`,color:C.gold,fontWeight:600,fontSize:14,cursor:"pointer",marginBottom:12}}>＋ Add Rally</button>
        {(plan.rallies||[]).map((r,idx)=>(
          <div key={r.id} style={{background:C.section,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700,color:r.isCounter?C.mar:r.isStrong?C.red:C.gold}}>#{r.order}</span>
                <div style={{display:"flex",gap:6}}>
                  {[["Strong",r.isStrong,"isStrong",C.red],["Counter",r.isCounter,"isCounter",C.mar],["Decoy",r.isDecoy,"isDecoy",C.muted]].map(([l,v,k,c])=><button key={k} onClick={()=>onUpdateRally(r.id,{[k]:!v})} style={{padding:"3px 10px",borderRadius:16,minHeight:28,border:`1px solid ${v?c:C.border}`,background:v?c+"22":C.card,color:v?c:C.muted,fontWeight:600,fontSize:11,cursor:"pointer"}}>{l}</button>)}
                </div>
              </div>
              <button onClick={()=>onDeleteRally(r.id)} style={{background:"none",border:"none",color:C.red+"88",fontSize:16,cursor:"pointer",padding:"4px"}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>LABEL</div><Inp value={r.label} onChange={v=>onUpdateRally(r.id,{label:v})} placeholder="Rally name"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>LEAD</div><Inp value={r.leadName} onChange={v=>onUpdateRally(r.id,{leadName:v})} placeholder="Lead name"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>ALLIANCE</div><Inp value={r.allianceTag} onChange={v=>onUpdateRally(r.id,{allianceTag:v})} placeholder="[TAG]"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>MARCH (seconds)</div><Inp value={r.marchDuration||""} onChange={v=>onUpdateRally(r.id,{marchDuration:parseInt(v)||0})} placeholder="60" inputMode="numeric" type="number"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>LAUNCH TIME</div><Inp value={r.launchTime} onChange={v=>onUpdateRally(r.id,{launchTime:v})} placeholder="HH:MM:SS"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>IMPACT TIME</div><div style={{padding:"12px 14px",background:C.card,borderRadius:10,fontSize:14,fontWeight:700,color:r.impactTime?C.gold:C.muted}}>{r.impactTime||"—"}</div></div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[["planned","Planned",C.muted],["launched","Launched",C.gold],["impacted","Impacted",C.green],["failed","Failed",C.red]].map(([v,l,c])=><button key={v} onClick={()=>onUpdateRally(r.id,{status:v})} style={{padding:"4px 10px",borderRadius:16,border:`1px solid ${r.status===v?c:C.border}`,background:r.status===v?c+"22":C.card,color:r.status===v?c:C.muted,fontWeight:600,fontSize:12,cursor:"pointer"}}>{l}</button>)}
              </div>
            </div>
          </div>
        ))}
        {(plan.rallies||[]).length===0&&<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>No rallies yet</div>}
      </div>}

      {/* Reinforcements */}
      {tab==="reinf"&&<div>
        <div style={{background:C.section,borderRadius:12,padding:14,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:4}}>Send Time Calculator</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Enter target arrival and march time → get exact send time</div>
          <ReinfCalc/>
        </div>
        <button onClick={onAddReinf} style={{width:"100%",height:44,borderRadius:10,background:C.section,border:`1px solid ${C.gold}44`,color:C.gold,fontWeight:600,fontSize:14,cursor:"pointer",marginBottom:12}}>＋ Add Reinforcement</button>
        {(plan.reinforcements||[]).map(r=>(
          <div key={r.id} style={{background:C.section,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:700,color:C.white}}>{r.playerName||"Unnamed"} {r.allianceTag?`[${r.allianceTag}]`:""}</div>
              <button onClick={()=>onDeleteReinf(r.id)} style={{background:"none",border:"none",color:C.red+"88",fontSize:16,cursor:"pointer",padding:"4px"}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>PLAYER</div><Inp value={r.playerName} onChange={v=>onUpdateReinf(r.id,{playerName:v})} placeholder="Name"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>ALLIANCE</div><Inp value={r.allianceTag} onChange={v=>onUpdateReinf(r.id,{allianceTag:v})} placeholder="[TAG]"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>TARGET ARRIVAL</div><Inp value={r.targetArrivalTime} onChange={v=>onUpdateReinf(r.id,{targetArrivalTime:v})} placeholder="HH:MM:SS"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>MARCH (sec)</div><Inp value={r.marchDuration||""} onChange={v=>onUpdateReinf(r.id,{marchDuration:parseInt(v)||0})} placeholder="40" inputMode="numeric" type="number"/></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>SEND TIME</div><div style={{padding:"12px 14px",background:C.card,borderRadius:10,fontSize:14,fontWeight:700,color:r.sendTime?C.gold:C.muted}}>{r.sendTime||"—"}</div></div>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>STATUS</div>
                <div style={{display:"flex",gap:6}}>
                  {[["pending","⏳",C.muted],["sent","📤",C.gold],["arrived","✓",C.green],["failed","✗",C.red]].map(([v,l,c])=><button key={v} onClick={()=>onUpdateReinf(r.id,{status:v})} style={{flex:1,height:40,borderRadius:8,border:`1px solid ${r.status===v?c:C.border}`,background:r.status===v?c+"22":C.card,color:r.status===v?c:C.muted,fontWeight:700,fontSize:14,cursor:"pointer"}}>{l}</button>)}
                </div>
              </div>
            </div>
            <Inp value={r.notes||""} onChange={v=>onUpdateReinf(r.id,{notes:v})} placeholder="Notes…"/>
          </div>
        ))}
        {(plan.reinforcements||[]).length===0&&<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>No reinforcements yet</div>}
      </div>}

      {/* Teams */}
      {tab==="teams"&&<div>
        {TEAM_ROLES.map(role=>{
          const assigns=(plan.assignments||[]).filter(a=>a.teamRole===role);
          return(
            <div key={role} style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:700,color:C.icy,textTransform:"uppercase",letterSpacing:"0.08em"}}>{role} ({assigns.length})</div>
                <button onClick={()=>onAddAssign(role)} style={{height:30,padding:"0 12px",borderRadius:16,background:C.section,border:`1px solid ${C.gold}44`,color:C.gold,fontSize:12,cursor:"pointer"}}>＋ Add</button>
              </div>
              {assigns.map(a=>(
                <div key={a.id} style={{background:C.section,borderRadius:10,padding:12,marginBottom:8}}>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <div style={{flex:2}}><Inp value={a.playerName} onChange={v=>onUpdateAssign(a.id,{playerName:v})} placeholder="Player name" style={{fontSize:14}}/></div>
                    <div style={{flex:1}}><Inp value={a.allianceTag} onChange={v=>onUpdateAssign(a.id,{allianceTag:v})} placeholder="[TAG]" style={{fontSize:14}}/></div>
                    <button onClick={()=>onDeleteAssign(a.id)} style={{background:"none",border:"none",color:C.red+"88",fontSize:16,cursor:"pointer",padding:"8px",flexShrink:0}}>✕</button>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Inp value={a.marchTime||""} onChange={v=>onUpdateAssign(a.id,{marchTime:parseInt(v)||null})} placeholder="March time (sec)" inputMode="numeric" type="number" style={{fontSize:13}}/>
                    <button onClick={()=>onUpdateAssign(a.id,{confirmed:!a.confirmed})} style={{height:40,padding:"0 12px",borderRadius:10,border:`1px solid ${a.confirmed?C.green:C.border}`,background:a.confirmed?C.green+"22":C.card,color:a.confirmed?C.green:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>{a.confirmed?"✓ Confirmed":"Confirm"}</button>
                  </div>
                  {a.notes!==undefined&&<div style={{marginTop:8}}><Inp value={a.notes||""} onChange={v=>onUpdateAssign(a.id,{notes:v})} placeholder="Notes…" style={{fontSize:13}}/></div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>}

      {/* March DB */}
      {tab==="march"&&<div>
        <div style={{fontSize:13,color:C.muted,marginBottom:12,lineHeight:1.5}}>Store player march times for reinforcement and switching calculations. All times in seconds.</div>
        <button onClick={onAddMarch} style={{width:"100%",height:44,borderRadius:10,background:C.section,border:`1px solid ${C.gold}44`,color:C.gold,fontWeight:600,fontSize:14,cursor:"pointer",marginBottom:12}}>＋ Add March Entry</button>
        {(plan.marchDb||[]).map(m=>(
          <div key={m.id} style={{background:C.section,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <Inp value={m.playerName} onChange={v=>onUpdateMarch(m.id,{playerName:v})} placeholder="Player name" style={{flex:1,marginRight:8}}/>
              <button onClick={()=>onDeleteMarch(m.id)} style={{background:"none",border:"none",color:C.red+"88",fontSize:16,cursor:"pointer",padding:"4px"}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
              {[["🏰 Castle","castleMarch"],["🎯 Turret","turretMarch"],["⚔️ Center","centerMarch"]].map(([l,k])=><div key={k}><div style={{fontSize:11,color:C.muted,marginBottom:4}}>{l} (sec)</div><Inp value={m[k]||""} onChange={v=>onUpdateMarch(m.id,{[k]:parseInt(v)||null})} placeholder="—" inputMode="numeric" type="number" style={{fontSize:14}}/></div>)}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>onUpdateMarch(m.id,{usesSpeedup:!m.usesSpeedup})} style={{height:36,padding:"0 12px",borderRadius:10,border:`1px solid ${m.usesSpeedup?C.gold:C.border}`,background:m.usesSpeedup?C.gold+"22":C.card,color:m.usesSpeedup?C.gold:C.muted,fontWeight:600,fontSize:12,cursor:"pointer"}}>⚡ Uses Speedup</button>
              <Inp value={m.teleportRow||""} onChange={v=>onUpdateMarch(m.id,{teleportRow:v})} placeholder="Teleport row" style={{fontSize:13}}/>
            </div>
          </div>
        ))}
        {(plan.marchDb||[]).length===0&&<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>No march entries yet</div>}
      </div>}

      {/* Timeline */}
      {tab==="timeline"&&<div>
        <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Auto-generated from rallies and reinforcements. Sorted by time.</div>
        {timeline.length===0?<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>Add rallies or reinforcements to see timeline</div>:timeline.map((ev,i)=>(
          <div key={i} style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
            <div style={{width:80,flexShrink:0,textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.gold,fontFamily:"monospace"}}>{formatHMS(ev.time)}</div>
            </div>
            <div style={{width:2,alignSelf:"stretch",background:ev.color,borderRadius:1,flexShrink:0}}/>
            <div style={{background:C.section,borderRadius:10,padding:"10px 14px",flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:ev.color}}>{ev.label}</div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ── Reinforcement Calculator ───────────────────────────────────
function ReinfCalc(){
  const [target,setTarget]=useState("");
  const [march,setMarch]=useState("");
  const send=target&&march?calcSendTime(target,parseInt(march)):null;
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>TARGET ARRIVAL</div><Inp value={target} onChange={setTarget} placeholder="HH:MM:SS"/></div>
      <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>MARCH (sec)</div><Inp value={march} onChange={setMarch} placeholder="40" inputMode="numeric" type="number"/></div>
      <div style={{gridColumn:"span 2"}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>SEND AT</div>
        <div style={{padding:"12px 14px",background:C.card,borderRadius:10,fontSize:20,fontWeight:700,color:send?C.gold:C.muted,textAlign:"center",fontFamily:"monospace"}}>{send||"—"}</div>
      </div>
    </div>
  );
}

// ── Live Battle Mode ───────────────────────────────────────────
function LiveBattleMode({plan,countdown,onUpdate,players,onAssignUpdate}){
  return(
    <div style={{background:C.section,borderRadius:14,padding:16,marginBottom:16}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>🔴 LIVE BATTLE</div>
        {plan.targetImpactTime&&<div style={{fontSize:48,fontWeight:700,fontFamily:"monospace",color:countdown!=null&&countdown<=30?C.red:C.gold}}>
          {countdown!=null?secsToHuman(Math.abs(countdown)):plan.targetImpactTime}
        </div>}
        {countdown!=null&&countdown<=0&&<div style={{fontSize:20,fontWeight:700,color:C.red,marginTop:4}}>⚔️ IMPACT NOW</div>}
        {plan.targetImpactTime&&<div style={{fontSize:13,color:C.muted}}>Target: {plan.targetImpactTime}</div>}
      </div>

      {/* Rallies status */}
      {(plan.rallies||[]).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Rallies</div>
        {(plan.rallies||[]).map(r=>(
          <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}22`}}>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:C.white}}>{r.label||`Rally ${r.order}`}</div>
              <div style={{fontSize:12,color:C.muted}}>{r.leadName}{r.impactTime?` · Impact: ${r.impactTime}`:""}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {[["launched","🚀",C.gold],["impacted","💥",C.green],["failed","✗",C.red]].map(([v,l,c])=><button key={v} onClick={()=>{const updated=plan.rallies.map(rl=>rl.id===r.id?{...rl,status:v}:rl);onUpdate({rallies:updated});vibe(8);}} style={{width:44,height:44,borderRadius:10,border:`1px solid ${r.status===v?c:C.border}`,background:r.status===v?c+"22":C.card,color:r.status===v?c:C.muted,fontWeight:700,fontSize:18,cursor:"pointer"}}>{l}</button>)}
            </div>
          </div>
        ))}
      </div>}

      {/* Reinforcements status */}
      {(plan.reinforcements||[]).length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Reinforcements</div>
        {(plan.reinforcements||[]).map(r=>(
          <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}22`}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:C.white}}>{r.playerName||"—"}</div>
              <div style={{fontSize:12,color:C.muted}}>Send: {r.sendTime||"?"} → Arrive: {r.targetArrivalTime||"?"}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {[["sent","📤",C.gold],["arrived","✓",C.green],["failed","✗",C.red]].map(([v,l,c])=><button key={v} onClick={()=>{const updated=plan.reinforcements.map(rl=>rl.id===r.id?{...rl,status:v}:rl);onUpdate({reinforcements:updated});vibe(8);}} style={{width:44,height:44,borderRadius:10,border:`1px solid ${r.status===v?c:C.border}`,background:r.status===v?c+"22":C.card,color:r.status===v?c:C.muted,fontWeight:700,fontSize:16,cursor:"pointer"}}>{l}</button>)}
            </div>
          </div>
        ))}
      </div>}

      {/* Team confirmations */}
      {(plan.assignments||[]).length>0&&<div>
        <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Team Confirmations</div>
        {(plan.assignments||[]).map(a=>(
          <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}22`}}>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.white}}>{a.playerName||"—"}</div><div style={{fontSize:12,color:C.muted}}>{a.teamRole}</div></div>
            <button onClick={()=>{onAssignUpdate(a.id,{confirmed:!a.confirmed});vibe(8);}} style={{height:44,padding:"0 16px",borderRadius:10,border:`1px solid ${a.confirmed?C.green:C.border}`,background:a.confirmed?C.green+"22":C.card,color:a.confirmed?C.green:C.muted,fontWeight:700,fontSize:16,cursor:"pointer"}}>{a.confirmed?"✓":"—"}</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ── Auto-Suggest Panel ─────────────────────────────────────────
function AutoSuggestPanel({players,events,reqs,onReqsChange,results,onRun,onAssign}){
  function updR(k,v){onReqsChange(prev=>({...prev,[k]:v}));}
  return(
    <div style={{background:C.section,borderRadius:12,padding:16,marginTop:12}}>
      <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:14}}>⚡ Auto-Suggest Players</div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Required Heroes (Skill 5)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {ALL_HEROES.slice(0,16).map(h=>{const sel=reqs.heroes?.includes(h);return <button key={h} onClick={()=>updR("heroes",sel?reqs.heroes.filter(x=>x!==h):[...reqs.heroes,h])} style={{padding:"5px 10px",borderRadius:14,minHeight:32,border:`1px solid ${sel?C.gold:C.border}`,background:sel?C.gold+"22":C.card,color:sel?C.gold:C.muted,fontWeight:600,fontSize:12,cursor:"pointer"}}>{h}</button>;})}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>Min Furnace</div><Inp value={reqs.minFurnace||""} onChange={v=>updR("minFurnace",parseInt(v)||0)} placeholder="0" inputMode="numeric" type="number"/></div>
        <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>Min Reliability</div><Inp value={reqs.minReliability||""} onChange={v=>updR("minReliability",parseInt(v)||0)} placeholder="0" inputMode="numeric" type="number"/></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>updR("requireDiscord",!reqs.requireDiscord)} style={{flex:1,height:40,borderRadius:10,border:`1px solid ${reqs.requireDiscord?C.icy:C.border}`,background:reqs.requireDiscord?C.icy+"22":C.card,color:reqs.requireDiscord?C.icy:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>🎙️ Discord required</button>
        <button onClick={()=>updR("requireAvailable",!reqs.requireAvailable)} style={{flex:1,height:40,borderRadius:10,border:`1px solid ${reqs.requireAvailable?C.green:C.border}`,background:reqs.requireAvailable?C.green+"22":C.card,color:reqs.requireAvailable?C.green:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>✅ Available only</button>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Required Roles</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ROLES.map(r=>{const sel=reqs.roles?.includes(r);return <button key={r} onClick={()=>updR("roles",sel?reqs.roles.filter(x=>x!==r):[...reqs.roles,r])} style={{padding:"5px 10px",borderRadius:14,minHeight:32,border:`1px solid ${sel?ROLE_COLORS[r]:C.border}`,background:sel?ROLE_COLORS[r]+"22":C.card,color:sel?ROLE_COLORS[r]:C.muted,fontWeight:600,fontSize:12,cursor:"pointer"}}>{r}</button>;})}</div>
      </div>
      <button onClick={onRun} style={{width:"100%",height:44,borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer",marginBottom:results?16:0}}>Find Best Matches</button>
      {results&&<div>
        <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:10}}>{results.length} players ranked</div>
        {results.slice(0,10).map(({player,score,reasons,missing})=>(
          <div key={player.id} style={{background:C.card,borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div><div style={{fontSize:14,fontWeight:700,color:C.white}}>{player.username||player.alias||"?"}</div><div style={{fontSize:12,color:C.muted}}>{player.allianceTag?`[${player.allianceTag}]`:""} {player.furnaceLevel?`FC${player.furnaceLevel}`:""}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:700,color:score>=70?C.green:score>=40?C.gold:C.red}}>{score}%</div><div style={{fontSize:10,color:C.muted}}>match</div></div>
            </div>
            {reasons.length>0&&<div style={{fontSize:12,color:C.green,marginBottom:4}}>{reasons.join(" · ")}</div>}
            {missing.length>0&&<div style={{fontSize:12,color:C.red,marginBottom:8}}>{missing.join(" · ")}</div>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {TEAM_ROLES.slice(0,6).map(role=><button key={role} onClick={()=>onAssign(player,role)} style={{padding:"5px 10px",borderRadius:14,minHeight:30,border:`1px solid ${C.border}`,background:C.section,color:C.icy,fontWeight:600,fontSize:11,cursor:"pointer"}}>Assign: {role}</button>)}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ── Prep Score Tab ─────────────────────────────────────────────
function PrepScoreTab({prepScores,players,onUpdate}){
  const [sortBy,setSortBy]=useState("score_desc");
  const [filterTag,setFilterTag]=useState("");
  const [editingId,setEditingId]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [newEntry,setNewEntry]=useState(()=>newPrepEntry());
  const [batchRaw,setBatchRaw]=useState("");
  const [batchMode,setBatchMode]=useState(false);

  const allTags=[...new Set(prepScores.map(e=>e.allianceTag).filter(Boolean))];
  function savePE(entry){const ex=prepScores.find(e=>e.id===entry.id);let upd;if(ex){const h=entry.prepScore!==ex.prepScore?[...(ex.history||[]),{score:ex.prepScore,timestamp:ex.lastUpdated}]:(ex.history||[]);upd=prepScores.map(e=>e.id===entry.id?{...entry,history:h,lastUpdated:new Date().toISOString()}:e);}else{upd=[...prepScores,{...entry,lastUpdated:new Date().toISOString()}];}onUpdate(upd);setEditingId(null);setShowAdd(false);setNewEntry(newPrepEntry());vibe(8);}
  function delPE(id){onUpdate(prepScores.filter(e=>e.id!==id));}
  function applyBatch(){const lines=batchRaw.split("\n").map(l=>l.trim()).filter(Boolean);const out=[];lines.forEach(line=>{const parts=line.split(/[,\t]/).map(p=>p.trim());if(!parts[0])return;const pn=parts[0],at=parts[1]||"",sc=parts[2]?parseFloat(parts[2]):null,tg=parts[3]?parseFloat(parts[3]):null;const lp=players.find(p=>normalizeName(p.username||p.alias||"")===normalizeName(pn));const ex=prepScores.find(e=>normalizeName(e.playerName)===normalizeName(pn));if(ex){const h=sc!==null&&sc!==ex.prepScore?[...(ex.history||[]),{score:ex.prepScore,timestamp:ex.lastUpdated}]:(ex.history||[]);out.push({...ex,prepScore:sc??ex.prepScore,targetScore:tg??ex.targetScore,allianceTag:at||ex.allianceTag,history:h,lastUpdated:new Date().toISOString()});}else{out.push(newPrepEntry({playerName:pn,allianceTag:at,prepScore:sc,targetScore:tg,playerId:lp?.id||null}));}});const kept=prepScores.filter(e=>!out.some(n=>normalizeName(n.playerName)===normalizeName(e.playerName)));onUpdate([...kept,...out]);setBatchRaw("");setBatchMode(false);vibe(8);}

  let sorted=[...prepScores];
  if(filterTag)sorted=sorted.filter(e=>e.allianceTag===filterTag);
  sorted.sort((a,b)=>{if(sortBy==="score_desc")return(b.prepScore||0)-(a.prepScore||0);if(sortBy==="score_asc")return(a.prepScore||0)-(b.prepScore||0);if(sortBy==="diff")return((b.targetScore||0)-(b.prepScore||0))-((a.targetScore||0)-(a.prepScore||0));return(a.playerName||"").localeCompare(b.playerName||"");});

  function EntryForm({entry,onSave,onCancel}){
    const [e,setE]=useState({...entry});
    function upd(k,v){setE(p=>({...p,[k]:v}));}
    const linked=players.find(p=>p.id===e.playerId||normalizeName(p.username||p.alias||"")===normalizeName(e.playerName));
    return(<div style={{background:C.section,borderRadius:12,padding:16,marginBottom:12}}>
      <Field label="Player Name"><Inp value={e.playerName} onChange={v=>upd("playerName",v)} placeholder="Player name"/></Field>
      {linked&&<div style={{fontSize:12,color:C.green,marginBottom:10}}>✓ Linked to roster</div>}
      <Field label="Alliance Tag"><Inp value={e.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="R3K"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <Field label="Prep Score"><Inp value={e.prepScore??""} onChange={v=>upd("prepScore",v?parseFloat(v):null)} placeholder="0" type="number" inputMode="decimal"/></Field>
        <Field label="Target Score"><Inp value={e.targetScore??""} onChange={v=>upd("targetScore",v?parseFloat(v):null)} placeholder="0" type="number" inputMode="decimal"/></Field>
      </div>
      <Field label="Notes"><Inp value={e.notes||""} onChange={v=>upd("notes",v)} placeholder="Notes…"/></Field>
      <div style={{display:"flex",gap:10}}><button onClick={onCancel} style={{flex:1,height:44,borderRadius:10,background:C.card,border:`1px solid ${C.border}`,color:C.muted,fontWeight:600,fontSize:15,cursor:"pointer"}}>Cancel</button><button onClick={()=>onSave(e)} style={{flex:2,height:44,borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>Save</button></div>
    </div>);}

  return(<div style={{padding:"16px 20px 0"}}>
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <button onClick={()=>{setShowAdd(!showAdd);setNewEntry(newPrepEntry());}} style={{flex:1,height:44,borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:14,border:"none",cursor:"pointer"}}>＋ Add</button>
      <button onClick={()=>setBatchMode(!batchMode)} style={{flex:1,height:44,borderRadius:10,background:batchMode?C.gold+"22":C.section,border:`1px solid ${batchMode?C.gold:C.border}`,color:batchMode?C.gold:C.icy,fontWeight:700,fontSize:14,cursor:"pointer"}}>⚡ Batch</button>
    </div>
    {batchMode&&<div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:6}}>Batch Update</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Format: Name, Alliance, Score, Target (one per line)</div>
      <textarea value={batchRaw} onChange={e=>setBatchRaw(e.target.value)} placeholder={"Caroline, R3K, 850000, 1000000\nMarcus, R3K, 720000"} style={{width:"100%",minHeight:100,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,fontSize:15,color:C.white,resize:"none",boxSizing:"border-box",fontFamily:"inherit",lineHeight:1.8}}/>
      <button onClick={applyBatch} disabled={!batchRaw.trim()} style={{width:"100%",height:44,borderRadius:10,background:batchRaw.trim()?C.gold:C.border,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:batchRaw.trim()?"pointer":"default",marginTop:10}}>Apply</button>
    </div>}
    {showAdd&&<EntryForm entry={newEntry} onSave={savePE} onCancel={()=>setShowAdd(false)}/>}
    <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto"}}>
      <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{height:36,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 10px",fontSize:13,color:C.white,cursor:"pointer"}}>
        <option value="score_desc">Score ↓</option><option value="score_asc">Score ↑</option><option value="diff">Gap ↓</option><option value="name">Name</option>
      </select>
      {allTags.length>0&&<select value={filterTag} onChange={e=>setFilterTag(e.target.value)} style={{height:36,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 10px",fontSize:13,color:C.white,cursor:"pointer"}}><option value="">All</option>{allTags.map(t=><option key={t} value={t}>[{t}]</option>)}</select>}
    </div>
    {sorted.length===0&&<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:40,marginBottom:12}}>📈</div><div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>No prep scores</div></div>}
    {sorted.map(entry=>{
      const diff=entry.targetScore&&entry.prepScore!=null?entry.targetScore-entry.prepScore:null;
      const pct=entry.targetScore&&entry.prepScore!=null?Math.min(100,Math.round((entry.prepScore/entry.targetScore)*100)):null;
      const linked=players.find(p=>p.id===entry.playerId);
      if(editingId===entry.id)return <EntryForm key={entry.id} entry={entry} onSave={savePE} onCancel={()=>setEditingId(null)}/>;
      return(<div key={entry.id} style={{background:C.card,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}><div style={{fontSize:16,fontWeight:700,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.playerName}</div>{entry.allianceTag&&<span style={{fontSize:12,color:C.icy,fontWeight:600}}>[{entry.allianceTag}]</span>}{linked&&<span style={{fontSize:11,color:C.green}}>● roster</span>}</div><div style={{fontSize:22,fontWeight:700,color:C.gold}}>{numFmt(entry.prepScore)}</div>{entry.targetScore&&<div style={{fontSize:13,color:C.muted}}>Target: {numFmt(entry.targetScore)}</div>}</div>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><button onClick={()=>setEditingId(entry.id)} style={{height:32,padding:"0 12px",borderRadius:16,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,cursor:"pointer"}}>Edit</button><button onClick={()=>delPE(entry.id)} style={{height:32,width:32,borderRadius:16,background:"none",border:"none",color:C.red+"88",fontSize:16,cursor:"pointer",lineHeight:1}}>✕</button></div>
        </div>
        {pct!=null&&<div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:pct>=100?C.green:pct>=70?C.gold:C.red,fontWeight:600}}>{pct}%</span>{diff!=null&&diff>0&&<span style={{fontSize:12,color:C.muted}}>−{numFmt(diff)} to go</span>}{diff!=null&&diff<=0&&<span style={{fontSize:12,color:C.green,fontWeight:700}}>✓ Target reached</span>}</div><div style={{height:6,borderRadius:3,background:C.border,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",borderRadius:3,background:pct>=100?C.green:pct>=70?C.gold:C.red,transition:"width 300ms ease"}}/></div></div>}
        {(entry.history||[]).length>0&&<div style={{fontSize:11,color:C.muted,marginBottom:6}}>{[...entry.history].slice(-3).map((h,i)=><span key={i} style={{marginRight:8}}>{numFmt(h.score)}</span>)}</div>}
        {entry.notes&&<div style={{fontSize:13,color:C.icy,fontStyle:"italic"}}>"{entry.notes}"</div>}
        <div style={{fontSize:11,color:C.muted,marginTop:6}}>Updated {fmtDate(entry.lastUpdated)}</div>
      </div>);
    })}
  </div>);
}

// ── Stats Tab ──────────────────────────────────────────────────
function StatsTab({players,events,onHeroClick}){
  const withM=players.map(p=>({player:p,metrics:calcMetrics(p,events)})).filter(x=>x.metrics).sort((a,b)=>b.metrics.reliabilityScore-a.metrics.reliabilityScore);
  const atRisk=players.map(p=>({player:p,metrics:calcMetrics(p,events)})).filter(x=>x.metrics&&x.metrics.consecutiveMisses>=3).sort((a,b)=>b.metrics.consecutiveMisses-a.metrics.consecutiveMisses);
  return(<div style={{padding:"16px 20px"}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      {[["👥","Total Players",players.length],["📋","Total Events",events.length],["👑","Rally Leads",players.filter(p=>p.roles?.includes("Rally Lead")).length],["✅","Available",players.filter(p=>p.availability?.present==="available").length],["⚔️","Skill 5 Heroes",players.filter(p=>p.heroes?.length>0).length],["🌏","Countries",new Set(players.map(p=>p.country).filter(Boolean)).size]].map(([i,l,v])=><div key={l} style={{background:C.card,borderRadius:12,padding:16}}><div style={{fontSize:22}}>{i}</div><div style={{fontSize:28,fontWeight:700,color:C.gold}}>{v}</div><div style={{fontSize:13,color:C.icy}}>{l}</div></div>)}
    </div>
    {withM.length>0&&<div style={{background:C.card,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:12}}>🏅 Reliability Leaderboard</div>{withM.slice(0,8).map(({player,metrics},i)=><div key={player.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}22`}}><div style={{fontSize:13,fontWeight:700,color:i<3?C.gold:C.muted,width:20,textAlign:"center"}}>{i+1}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.white}}>{player.username||player.alias||"?"}</div><div style={{fontSize:11,color:C.muted}}>{metrics.attended}/{metrics.totalEvents} · {metrics.attendancePct}%</div></div><div style={{fontSize:16,fontWeight:700,color:metrics.reliabilityScore>=70?C.green:metrics.reliabilityScore>=40?C.gold:C.red}}>{metrics.reliabilityScore}</div></div>)}</div>}
    {atRisk.length>0&&<div style={{background:C.card,borderRadius:12,padding:16,marginBottom:16,border:`1px solid ${C.red}33`}}><div style={{fontSize:15,fontWeight:700,color:C.red,marginBottom:12}}>⚠️ Absent 3+ in a Row</div>{atRisk.map(({player,metrics})=><div key={player.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}22`}}><div style={{fontSize:14,color:C.white}}>{player.username||player.alias||"?"}</div><div style={{fontSize:13,fontWeight:700,color:C.red}}>{metrics.consecutiveMisses} missed</div></div>)}</div>}

    {/* Hero ownership — clickable pills */}
    {(()=>{const counts={};players.forEach(p=>p.heroes?.forEach(h=>{counts[h]=(counts[h]||0)+1;}));const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12);if(!top.length)return null;
      return <div style={{background:C.card,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:8}}>🏅 Top Heroes (Skill 5)</div><div style={{fontSize:12,color:C.muted,marginBottom:10}}>Tap a hero to see who owns it</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{top.map(([hero,count])=><button key={hero} onClick={()=>onHeroClick(hero)} style={{padding:"8px 12px",borderRadius:20,background:C.gold+"18",border:`1px solid ${C.gold}33`,cursor:"pointer"}}><span style={{color:C.gold,fontWeight:600,fontSize:13}}>✓ {hero}</span><span style={{color:C.muted,fontSize:12,marginLeft:6}}>×{count}</span></button>)}</div></div>;
    })()}

    {(()=>{const counts={};players.forEach(p=>{if(p.country)counts[p.country]=(counts[p.country]||0)+1;});const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);if(!sorted.length)return null;
      return <div style={{background:C.card,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:12}}>🌏 Countries</div>{sorted.map(([c,n])=><div key={c} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:14,color:C.icy}}>{c}</div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:80,height:6,borderRadius:3,background:C.border,overflow:"hidden"}}><div style={{width:`${(n/players.length)*100}%`,height:"100%",background:C.gold,borderRadius:3}}/></div><div style={{fontSize:14,fontWeight:700,color:C.gold,width:20,textAlign:"right"}}>{n}</div></div></div>)}</div>;
    })()}
    {players.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>Add players to see stats</div>}
  </div>);
}

// ── Hero Members Sheet ─────────────────────────────────────────
function HeroMembersSheet({hero,players,open,onClose}){
  if(!open||!hero)return null;
  const owners=players.filter(p=>p.heroes?.includes(hero));
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"70vh",overflowY:"auto",padding:"16px 20px 60px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><div style={{fontSize:18,fontWeight:700,color:C.gold}}>✓ {hero}</div><div style={{fontSize:13,color:C.muted}}>{owners.length} player{owners.length!==1?"s":""} at Skill 5</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        {owners.length===0?<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>No players own this hero at Skill 5</div>:owners.map(p=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}22`}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:(ROLE_COLORS[p.roles?.[0]]||C.muted)+"33",border:`1.5px solid ${ROLE_COLORS[p.roles?.[0]]||C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:C.white,flexShrink:0}}>{initials(p.username||p.alias||"?")}</div>
            <div><div style={{fontSize:15,fontWeight:700,color:C.white}}>{p.username||p.alias||"?"}</div><div style={{fontSize:12,color:C.icy}}>{[p.allianceTag&&`[${p.allianceTag}]`,p.furnaceLevel&&`FC${p.furnaceLevel}`,p.availability?.present==="available"?"✅":"❌"].filter(Boolean).join(" · ")}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Data Panel ─────────────────────────────────────────────────
function DataPanel({data,onImport,onClose}){
  const fileRef=useRef();
  const [mode,setMode]=useState("replace");
  const [msg,setMsg]=useState(null);
  async function handleFile(e){const file=e.target.files?.[0];if(!file)return;try{const imp=await importData(file);onImport(imp,mode);setMsg({text:"✓ Imported",type:"success"});setTimeout(()=>setMsg(null),3000);}catch(err){setMsg({text:`Failed: ${err.message}`,type:"error"});setTimeout(()=>setMsg(null),4000);}e.target.value="";}
  return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}><div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",padding:"16px 20px 60px",maxHeight:"80vh",overflowY:"auto"}}>
    <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>📦 Export / Import</div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
    {msg&&<div style={{padding:"10px 14px",borderRadius:10,marginBottom:16,background:msg.type==="error"?C.red+"18":C.green+"18",color:msg.type==="error"?C.red:C.green,fontSize:14,fontWeight:600}}>{msg.text}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
      {[["Players",(data.players||[]).length],["Events",(data.events||[]).length],["Plans",(data.svsPlans||[]).length]].map(([l,v])=><div key={l} style={{background:C.section,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:C.gold}}>{v}</div><div style={{fontSize:12,color:C.muted}}>{l}</div></div>)}
    </div>
    <div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}>
      <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Export</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Downloads all data — players, events, battle plans, prep scores.</div>
      <button onClick={()=>exportData(data,data.settings?.allianceTag)} style={{width:"100%",height:48,borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>⬇️ Download JSON</button>
    </div>
    <div style={{background:C.section,borderRadius:12,padding:16}}>
      <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Import</div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>{[["replace","Replace all"],["merge","Merge"]].map(([v,l])=><button key={v} onClick={()=>setMode(v)} style={{flex:1,height:40,borderRadius:10,border:`1px solid ${mode===v?C.gold:C.border}`,background:mode===v?C.gold+"22":C.card,color:mode===v?C.gold:C.muted,fontWeight:600,fontSize:14,cursor:"pointer"}}>{l}</button>)}</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{mode==="replace"?"⚠️ Replaces all data.":"Merges by ID."}</div>
      <input type="file" accept=".json" ref={fileRef} onChange={handleFile} style={{display:"none"}}/>
      <button onClick={()=>fileRef.current?.click()} style={{width:"100%",height:48,borderRadius:10,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer"}}>⬆️ Choose JSON File</button>
    </div>
  </div></div>);
}

// ── Settings Panel ─────────────────────────────────────────────
function SettingsPanel({settings,onSave,onClose}){
  const [s,setS]=useState(settings||{});
  function upd(k,v){setS(prev=>({...prev,[k]:v}));}
  return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",zIndex:300,display:"flex",alignItems:"flex-end"}}><div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",padding:"16px 20px 60px",maxHeight:"80vh",overflowY:"auto"}}>
    <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>⚙️ Alliance Settings</div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>
    <Field label="Alliance Name"><Inp value={s.allianceName} onChange={v=>upd("allianceName",v)} placeholder="Alliance name"/></Field>
    <Field label="Alliance Tag"><Inp value={s.allianceTag} onChange={v=>upd("allianceTag",v)} placeholder="R3K"/></Field>
    <Field label="State ID"><Inp value={s.stateId} onChange={v=>upd("stateId",v)} placeholder="3543" inputMode="numeric"/></Field>
    <button onClick={()=>{onSave(s);onClose();vibe(8);}} style={{width:"100%",height:54,borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:17,border:"none",cursor:"pointer"}}>Save Settings</button>
  </div></div>);
}

// ── App ────────────────────────────────────────────────────────
export default function App(){
  const [data,setData]=useState(()=>loadData());
  const [tab,setTab]=useState(0);
  const [search,setSearch]=useState("");
  const [filterRole,setFilterRole]=useState("All");
  const [viewingPlayer,setViewingPlayer]=useState(null);
  const [profileOpen,setProfileOpen]=useState(false);
  const [editingPlayer,setEditingPlayer]=useState(null);
  const [sheetOpen,setSheetOpen]=useState(false);
  const [batchOpen,setBatchOpen]=useState(false);
  const [dataPanel,setDataPanel]=useState(false);
  const [settingsPanel,setSettingsPanel]=useState(false);
  const [toast,setToast]=useState(null);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [heroFilter,setHeroFilter]=useState(null);
  const [heroSheetOpen,setHeroSheetOpen]=useState(false);

  useEffect(()=>{ saveData(data); },[data]);

  function showToast(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),2800);}
  function savePlayer(player){const isEdit=data.players.some(p=>p.id===player.id);setData(prev=>({...prev,players:isEdit?prev.players.map(p=>p.id===player.id?player:p):[...prev.players,player],lastUpdated:new Date().toISOString()}));showToast(isEdit?"Player updated ✓":"Player added ✓");}
  function addPlayers(np){setData(prev=>({...prev,players:[...prev.players,...np],lastUpdated:new Date().toISOString()}));if(np.length)showToast(`${np.length} player${np.length!==1?"s":""} added ✓`);}
  function updatePlayers(up){setData(prev=>({...prev,players:prev.players.map(p=>{const u=up.find(u=>u.id===p.id);return u?u:p;}),lastUpdated:new Date().toISOString()}));if(up.length)showToast(`${up.length} updated ✓`);}
  function deletePlayer(id){setData(prev=>({...prev,players:prev.players.filter(p=>p.id!==id),lastUpdated:new Date().toISOString()}));showToast("Player removed");setDeleteConfirm(null);}
  function handleImport(imp,mode){setData(prev=>{if(mode==="merge")return{...mergeData(prev,imp),lastUpdated:new Date().toISOString()};return{...prev,...imp,lastUpdated:new Date().toISOString()};});showToast(`Imported (${mode}) ✓`);setDataPanel(false);}
  function createEvent(ev){setData(prev=>({...prev,events:[...(prev.events||[]),ev],lastUpdated:new Date().toISOString()}));showToast("Event created ✓");}
  function updateEvent(ev){setData(prev=>({...prev,events:(prev.events||[]).map(e=>e.id===ev.id?ev:e),lastUpdated:new Date().toISOString()}));}
  function deleteEvent(id){setData(prev=>({...prev,events:(prev.events||[]).filter(e=>e.id!==id),lastUpdated:new Date().toISOString()}));showToast("Event deleted");}
  function saveSvsPlans(plans){setData(prev=>({...prev,svsPlans:plans,lastUpdated:new Date().toISOString()}));}
  function deleteSvsPlan(id){setData(prev=>({...prev,svsPlans:(prev.svsPlans||[]).filter(p=>p.id!==id),lastUpdated:new Date().toISOString()}));showToast("Plan deleted");}
  function updatePrepScores(scores){setData(prev=>({...prev,prepScores:scores,lastUpdated:new Date().toISOString()}));}
  function openProfile(player){setViewingPlayer(player);setProfileOpen(true);}
  function openEditFromProfile(){setEditingPlayer(viewingPlayer);setProfileOpen(false);setSheetOpen(true);}
  function openAdd(){setEditingPlayer(null);setSheetOpen(true);}
  function handleSheetClose(){setSheetOpen(false);setEditingPlayer(null);}

  const players=data.players||[];
  const events=data.events||[];
  const svsPlans=data.svsPlans||[];
  const prepScores=data.prepScores||[];

  const filteredPlayers=players.filter(p=>{
    const t=(p.username||p.alias||"").toLowerCase();
    const ms=!search||t.includes(search.toLowerCase())||(p.allianceTag||"").toLowerCase().includes(search.toLowerCase())||(p.country||"").toLowerCase().includes(search.toLowerCase());
    const mr=filterRole==="All"||p.roles?.includes(filterRole);
    return ms&&mr;
  });

  const TABS=[{icon:"👥",label:"Roster"},{icon:"⚔️",label:"Teams"},{icon:"📋",label:"Events"},{icon:"🎯",label:"Plans"},{icon:"📈",label:"Prep"},{icon:"📊",label:"Stats"}];

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.white,fontFamily:"system-ui,-apple-system,sans-serif",paddingBottom:80,maxWidth:480,margin:"0 auto"}}>

      {/* Header */}
      <div style={{padding:"20px 20px 14px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.bg,zIndex:50}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontSize:20,fontWeight:700,color:C.white}}>🏰 {data.settings?.allianceName||"Rally Planner"}</div><div style={{fontSize:13,color:C.muted}}>{data.settings?.allianceTag?`[${data.settings.allianceTag}] · `:""}State {data.settings?.stateId||"3543"} · {players.length} players</div></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setDataPanel(true)} style={{height:36,padding:"0 12px",borderRadius:20,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,fontWeight:600,cursor:"pointer"}}>📦</button>
            <button onClick={()=>setSettingsPanel(true)} style={{height:36,padding:"0 12px",borderRadius:20,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontSize:13,fontWeight:600,cursor:"pointer"}}>⚙️</button>
          </div>
        </div>
      </div>

      {/* ROSTER */}
      {tab===0&&<div style={{padding:"16px 20px 0"}}>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, tag, country…" style={{flex:1,height:48,background:C.section,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 14px",fontSize:16,color:C.white,fontFamily:"inherit"}}/>
          <button onClick={()=>setBatchOpen(true)} style={{height:48,padding:"0 12px",borderRadius:10,background:"none",border:`1px solid ${C.gold}`,color:C.gold,fontWeight:700,fontSize:14,cursor:"pointer"}}>⚡ Batch</button>
          <button onClick={openAdd} style={{height:48,padding:"0 14px",borderRadius:10,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>＋</button>
        </div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:4}}>
          {["All",...ROLES].map(r=><button key={r} onClick={()=>setFilterRole(r)} style={{padding:"7px 14px",borderRadius:20,whiteSpace:"nowrap",background:filterRole===r?C.gold+"22":C.section,border:`1px solid ${filterRole===r?C.gold:C.border}`,color:filterRole===r?C.gold:C.muted,fontWeight:600,fontSize:13,cursor:"pointer",minHeight:36}}>{r}</button>)}
        </div>
        {players.length>0&&<div style={{fontSize:13,color:C.muted,marginBottom:12}}>{filteredPlayers.length} of {players.length} player{players.length!==1?"s":""}</div>}
        {players.length===0&&<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:52,marginBottom:16}}>👥</div><div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:8}}>No players yet</div><div style={{fontSize:15,color:C.muted,marginBottom:28}}>Batch add your alliance or add one by one</div><div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}><button onClick={()=>setBatchOpen(true)} style={{height:52,padding:"0 24px",borderRadius:12,background:C.gold,color:C.bg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>⚡ Batch Add</button><button onClick={openAdd} style={{height:52,padding:"0 24px",borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer"}}>＋ Add One</button><button onClick={()=>setDataPanel(true)} style={{height:52,padding:"0 24px",borderRadius:12,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:700,fontSize:15,cursor:"pointer"}}>⬆️ Import</button></div></div>}
        {players.length>0&&filteredPlayers.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>No results for "{search||filterRole}"</div>}
        {filteredPlayers.map(p=><PlayerCard key={p.id} player={p} onClick={()=>openProfile(p)} onDelete={id=>setDeleteConfirm(id)} events={events}/>)}
      </div>}

      {/* TEAMS */}
      {tab===1&&<div style={{padding:"16px 20px"}}>
        {(()=>{const avail=players.filter(p=>p.availability?.present==="available");const byRole=ROLES.map(role=>({role,members:avail.filter(p=>p.roles?.includes(role))})).filter(g=>g.members.length>0);
          return <><div style={{background:C.section,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:13,color:C.icy,marginBottom:4}}>Available for SvS</div><div style={{fontSize:28,fontWeight:700,color:C.white}}>{avail.length} <span style={{fontSize:16,color:C.muted}}>of {players.length}</span></div></div>
          {byRole.map(({role,members})=><div key={role} style={{marginBottom:16}}><div style={{fontSize:13,fontWeight:700,color:ROLE_COLORS[role],textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{ROLE_ICONS[role]} {role} · {members.length}</div>{members.map(m=><div key={m.id} onClick={()=>openProfile(m)} style={{background:C.card,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}><div><div style={{fontWeight:700,color:C.white,fontSize:15}}>{m.username||m.alias||"?"}</div><div style={{fontSize:12,color:C.icy}}>{[m.furnaceLevel&&`FC${m.furnaceLevel}`,m.allianceTag&&`[${m.allianceTag}]`,m.timezone].filter(Boolean).join(" · ")}{m.availability?.timing==="late"?" · 🕐":""}{m.availability?.discord==="yes"?" · 🎙️":""}</div></div><div style={{display:"flex",gap:4}}>{[m.troops?.infantry,m.troops?.lancer,m.troops?.marksman].map((t,i)=><span key={i} style={{fontSize:11,padding:"2px 6px",borderRadius:6,background:[C.inf,C.lan,C.mar][i]+"22",color:[C.inf,C.lan,C.mar][i]}}>{t||"?"}</span>)}</div></div>)}</div>)}
          {players.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>Add players in the Roster tab first</div>}</>;
        })()}
      </div>}

      {/* EVENTS */}
      {tab===2&&<EventsTab events={events} players={players} onCreateEvent={createEvent} onUpdateEvent={updateEvent} onDeleteEvent={deleteEvent}/>}

      {/* PLANS */}
      {tab===3&&<SvsPlanTab plans={svsPlans} players={players} events={events} onSave={saveSvsPlans} onDelete={deleteSvsPlan}/>}

      {/* PREP */}
      {tab===4&&<PrepScoreTab prepScores={prepScores} players={players} onUpdate={updatePrepScores}/>}

      {/* STATS */}
      {tab===5&&<StatsTab players={players} events={events} onHeroClick={hero=>{setHeroFilter(hero);setHeroSheetOpen(true);}}/>}

      {/* Delete confirm */}
      {deleteConfirm&&<div style={{position:"fixed",inset:0,background:"#000b",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:320}}><div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:8}}>Remove player?</div><div style={{fontSize:14,color:C.muted,marginBottom:20}}>This can't be undone.</div><div style={{display:"flex",gap:10}}><button onClick={()=>setDeleteConfirm(null)} style={{flex:1,height:48,borderRadius:10,background:C.section,border:`1px solid ${C.border}`,color:C.icy,fontWeight:600,fontSize:15,cursor:"pointer"}}>Cancel</button><button onClick={()=>deletePlayer(deleteConfirm)} style={{flex:1,height:48,borderRadius:10,background:C.red,color:C.white,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>Remove</button></div></div></div>}

      <ProfileView player={viewingPlayer} open={profileOpen} onClose={()=>setProfileOpen(false)} onEdit={openEditFromProfile} events={events}/>
      <PlayerSheet open={sheetOpen} player={editingPlayer} onClose={handleSheetClose} onSave={savePlayer} events={events}/>
      <BatchAddSheet open={batchOpen} onClose={()=>setBatchOpen(false)} members={players} onAddNew={addPlayers} onUpdateExisting={updatePlayers}/>
      <HeroMembersSheet hero={heroFilter} players={players} open={heroSheetOpen} onClose={()=>setHeroSheetOpen(false)}/>
      {dataPanel&&<DataPanel data={data} onImport={handleImport} onClose={()=>setDataPanel(false)}/>}
      {settingsPanel&&<SettingsPanel settings={data.settings} onSave={s=>setData(prev=>({...prev,settings:s,lastUpdated:new Date().toISOString()}))} onClose={()=>setSettingsPanel(false)}/>}
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}

      {/* Tab bar — 6 tabs */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,display:"grid",gridTemplateColumns:"repeat(6,1fr)",background:C.bg,borderTop:`1px solid ${C.border}`,height:60,zIndex:100}}>
        {TABS.map((t,i)=><button key={i} onClick={()=>{setTab(i);vibe(8);}} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",color:tab===i?C.gold:C.muted,gap:2,fontSize:8,fontWeight:600,transition:"color 150ms ease",WebkitTapHighlightColor:"transparent"}}><span style={{fontSize:18}}>{t.icon}</span>{t.label}</button>)}
      </div>
    </div>
  );
}

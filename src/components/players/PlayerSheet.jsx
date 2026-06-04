import { useState, useEffect } from 'react';
import { C, ROLES, ROLE_COLORS, ROLE_ICONS, LANGUAGES, COUNTRIES } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newPlayer } from '../../data/playerSchema.js';
import { Field, Inp, Sel, TierPill, SheetHandle } from '../common/Primitives.jsx';

const FC_OPTIONS = ['FC1','FC2','FC3','FC4','FC5'];

export function PlayerSheet({ player, open, onClose, onSave }) {
  const [p, setP]           = useState(() => player||newPlayer());
  const [activeTab, setActiveTab] = useState('identity');

  useEffect(() => {
    if (open) { setP(player ? {...player} : newPlayer()); setActiveTab('identity'); }
  }, [open, player?.id]);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function upd(k,v)    { setP(prev=>({...prev,[k]:v,profileLastUpdated:new Date().toISOString()})); }
  function updT(k,v)   { setP(prev=>({...prev,troops:{...prev.troops,[k]:v},profileLastUpdated:new Date().toISOString()})); }
  function updA(patch) { setP(prev=>({...prev,availability:{...prev.availability,...patch},profileLastUpdated:new Date().toISOString()})); }
  function save()      { onSave({...p,profileLastUpdated:p.profileLastUpdated||new Date().toISOString()}); onClose(); vibe(8); }

  const TABS = [
    {id:'identity', label:'👤 Identity'},
    {id:'combat',   label:'⚔️ Combat'},
    {id:'avail',    label:'📅 Availability'},
  ];

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:350, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 100px' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{player?'Edit member':'Add member'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:20, overflowX:'auto' }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:'8px 14px', borderRadius:20, whiteSpace:'nowrap', background:activeTab===t.id?C.gold+'22':C.section, border:`1px solid ${activeTab===t.id?C.gold:C.border}`, color:activeTab===t.id?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Identity ── */}
        {activeTab==='identity'&&(
          <div>
            <Field label="Username"><Inp value={p.username} onChange={v=>upd('username',v)} placeholder="In-game username"/></Field>
            <Field label="Nickname"><Inp value={p.alias} onChange={v=>upd('alias',v)} placeholder="Real name or nickname"/></Field>
            <Field label="Player ID" hint="WOS numeric ID (FID)"><Inp value={p.fid} onChange={v=>upd('fid',v)} placeholder="e.g. 12345678" inputMode="numeric"/></Field>
            <Field label="Alliance"><Inp value={p.allianceTag} onChange={v=>upd('allianceTag',v)} placeholder="e.g. INT"/></Field>
            <Field label="Furnace">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {FC_OPTIONS.map(fc=>{
                  const sel = p.furnaceLevel===fc;
                  return (
                    <button key={fc} onClick={()=>upd('furnaceLevel',sel?null:fc)} style={{ padding:'8px 16px', borderRadius:20, minHeight:40, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                      {fc}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Country"><Sel value={p.country} onChange={v=>upd('country',v)} options={COUNTRIES} placeholder="Select country…"/></Field>
            <Field label="Languages">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {LANGUAGES.map(lang=>{
                  const sel=p.languages?.includes(lang);
                  return (
                    <button key={lang} onClick={()=>{const c=p.languages||[];upd('languages',sel?c.filter(l=>l!==lang):[...c,lang]);}} style={{ padding:'6px 12px', borderRadius:16, minHeight:36, border:`1px solid ${sel?C.icy:C.border}`, background:sel?C.icy+'22':C.section, color:sel?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                      {lang}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Notes"><textarea value={p.notes||''} onChange={e=>upd('notes',e.target.value)} placeholder="Anything officers should know…" style={{ width:'100%', minHeight:80, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/></Field>
          </div>
        )}

        {/* ── Combat ── */}
        {activeTab==='combat'&&(
          <div>
            <Field label="🛡️ Infantry"><TierPill value={p.troops.infantry} onChange={v=>updT('infantry',v)} color={C.inf}/></Field>
            <Field label="⚔️ Lancer"><TierPill value={p.troops.lancer} onChange={v=>updT('lancer',v)} color={C.lan}/></Field>
            <Field label="🏹 Marksman"><TierPill value={p.troops.marksman} onChange={v=>updT('marksman',v)} color={C.mar}/></Field>
            <Field label="Role in SvS" hint="Select all that apply">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {ROLES.map(role=>{
                  const sel=p.roles?.includes(role);
                  const c=ROLE_COLORS[role];
                  return (
                    <button key={role} onClick={()=>{const cur=p.roles||[];upd('roles',sel?cur.filter(r=>r!==role):[...cur,role]);}} style={{ padding:'12px 14px', borderRadius:12, minHeight:48, textAlign:'left', position:'relative', border:`1px solid ${sel?c:C.border}`, background:sel?c+'18':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                      {sel&&<span style={{ position:'absolute', top:8, right:10, fontSize:12 }}>✓</span>}
                      {ROLE_ICONS[role]} {role}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Joiner Heroes" hint="Manage in the 🦸 Joiner Registry — Intel tab">
              <div style={{ background:C.section, borderRadius:10, padding:12 }}>
                {(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).length>0 ? (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>(
                      <span key={jh.hero} style={{ padding:'6px 12px', borderRadius:16, background:C.gold+'18', border:`1px solid ${C.gold}33`, color:C.gold, fontWeight:600, fontSize:13 }}>✓ {jh.hero}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:C.muted }}>None set yet. Use 🦸 Joiner Registry in Intel tab.</div>
                )}
              </div>
            </Field>
          </div>
        )}

        {/* ── Availability ── */}
        {activeTab==='avail'&&(
          <div>
            <Field label="Joining this SvS?">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['✅ Yes, available','available',C.green],['❌ No, unavailable','unavailable',C.red]].map(([l,v,c])=>(
                  <button key={v} onClick={()=>updA({present:v})} style={{ height:52, borderRadius:12, border:`1px solid ${p.availability.present===v?c:C.border}`, background:p.availability.present===v?c+'18':C.section, color:p.availability.present===v?c:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Arrival timing">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[['⏰ On time','on-time'],['🕐 Arriving late','late'],['🚪 Leaving early','early'],['❓ Unknown','unknown']].map(([l,v])=>(
                  <button key={v} onClick={()=>updA({timing:v})} style={{ padding:'8px 14px', borderRadius:20, minHeight:40, border:`1px solid ${p.availability.timing===v?C.gold:C.border}`, background:p.availability.timing===v?C.gold+'18':C.section, color:p.availability.timing===v?C.gold:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="On Discord?">
              <div style={{ display:'flex', gap:8 }}>
                {[['🎙️ Yes','yes'],['🔇 No','no'],['❓ Unknown','unknown']].map(([l,v])=>(
                  <button key={v} onClick={()=>updA({discord:v})} style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${p.availability.discord===v?C.icy:C.border}`, background:p.availability.discord===v?C.icy+'18':C.section, color:p.availability.discord===v?C.icy:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button onClick={onClose} style={{ flex:1, height:54, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex:2, height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

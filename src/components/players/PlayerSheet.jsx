import { useState, useEffect } from 'react';
import { C, ROLES, ROLE_COLORS, ROLE_ICONS, LANGUAGES, COUNTRIES, EVENT_TYPES, EVENT_ICONS } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { newPlayer } from '../../data/playerSchema.js';
import { Field, Inp, Sel, TierPill, SheetHandle } from '../common/Primitives.jsx';
import { AlliancePicker } from '../common/AlliancePicker.jsx';

const FC_OPTIONS = ['FC1','FC2','FC3','FC4','FC5'];

// ── Completion logic ───────────────────────────────────────────
function checkCompletion(p) {
  const identity = !!(p.username && p.allianceTag);
  const combat   = !!(p.furnaceLevel && (p.troops?.infantry || p.troops?.lancer || p.troops?.marksman) && p.roles?.length > 0);
  const avail    = !!(p.availability?.discord !== 'unknown' && p.availability?.present);
  return { identity, combat, avail };
}

function completionPct(c) {
  return Math.round(([c.identity, c.combat, c.avail].filter(Boolean).length / 3) * 100);
}

// ── Step indicator ─────────────────────────────────────────────
function StepIndicator({ steps, current, onSelect }) {
  const pct = completionPct({ identity:steps[0].done, combat:steps[1].done, avail:steps[2].done });

  return (
    <div style={{ marginBottom:20 }}>
      {/* Progress bar + percentage */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <div style={{ flex:1, height:5, borderRadius:3, background:C.border, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:pct===100?C.green:C.gold, borderRadius:3, transition:'width 400ms ease' }}/>
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:pct===100?C.green:C.gold, flexShrink:0 }}>
          {pct}%
        </div>
      </div>

      {/* Step pills */}
      <div style={{ display:'flex', gap:6 }}>
        {steps.map((step, i) => {
          const isActive  = current === step.id;
          const isDone    = step.done;
          const isMissing = !isDone && !isActive;

          // Colors
          const bgColor     = isDone ? C.green+'22' : isActive ? C.gold+'22' : C.red+'14';
          const borderColor = isDone ? C.green     : isActive ? C.gold     : C.red+'66';
          const labelColor  = isDone ? C.green     : isActive ? C.gold     : C.red;
          const statusColor = isDone ? C.green     : isActive ? C.gold     : C.red;

          return (
            <button
              key={step.id}
              onClick={() => onSelect(step.id)}
              style={{
                flex: 1,
                padding: '10px 6px',
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                background: bgColor,
                cursor: 'pointer',
                textAlign: 'center',
                // Glow effect for missing steps
                boxShadow: isMissing ? `0 0 8px ${C.red}33` : 'none',
                transition: 'all 200ms ease',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: isDone ? C.green : isActive ? C.gold : C.red+'33',
                border: `1.5px solid ${isDone ? C.green : isActive ? C.gold : C.red}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px',
                fontSize: 12, fontWeight: 700,
                color: isDone ? '#fff' : isActive ? C.bg : C.red,
              }}>
                {isDone ? '✓' : i+1}
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:labelColor, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                {step.label}
              </div>
              <div style={{ fontSize:10, color:statusColor, marginTop:3, fontWeight:600 }}>
                {isDone ? 'Complete' : isActive ? 'In progress' : '⚠ Missing'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Event availability picker ──────────────────────────────────
function EventAvailabilitySection({ p, updA, existingEvents }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [customName, setCustomName]       = useState('');
  const [showCustom, setShowCustom]       = useState(false);

  const eventLabel = selectedEvent || (customName ? customName : null);

  // Get availability for the selected event
  const eventAvail = eventLabel
    ? (p.eventAvailability || {})[eventLabel] || { present:'available', timing:'unknown', discord:'unknown' }
    : null;

  function updEventAvail(patch) {
    if (!eventLabel) return;
    const current = (p.eventAvailability || {})[eventLabel] || { present:'available', timing:'unknown', discord:'unknown' };
    const updated = { ...(p.eventAvailability || {}), [eventLabel]: { ...current, ...patch } };
    updA({ eventAvailability: updated });
  }

  return (
    <div>
      {/* Event selector */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
          Which event is this for?
        </div>

        {/* Existing events from the app */}
        {existingEvents.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Upcoming events</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {existingEvents.map(ev => {
                const sel = selectedEvent === ev.id;
                return (
                  <button key={ev.id} onClick={() => { setSelectedEvent(sel?null:ev.id); setCustomName(''); setShowCustom(false); }} style={{ padding:'8px 14px', borderRadius:20, minHeight:38, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.icy, fontWeight:600, fontSize:13, cursor:'pointer', textAlign:'left' }}>
                    {EVENT_ICONS[ev.type]||'📋'} {ev.name||ev.type}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick event type chips */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Or select event type</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['SvS','SvS Castle Battle','Internal Sunfire Castle','Foundry','Bear Trap'].map(type => {
              const sel = selectedEvent === type;
              return (
                <button key={type} onClick={() => { setSelectedEvent(sel?null:type); setCustomName(''); setShowCustom(false); }} style={{ padding:'8px 14px', borderRadius:20, minHeight:38, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.icy, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  {EVENT_ICONS[type]||'📋'} {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom event name */}
        <button onClick={() => setShowCustom(!showCustom)} style={{ background:'none', border:'none', color:C.gold, fontSize:13, cursor:'pointer', padding:'4px 0' }}>
          {showCustom ? '▾' : '▸'} Name a specific event
        </button>
        {showCustom && (
          <div style={{ marginTop:8 }}>
            <input
              value={customName}
              onChange={e => { setCustomName(e.target.value); setSelectedEvent(null); }}
              placeholder="e.g. SvS Week 3 — May 2026"
              style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:15, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}
            />
          </div>
        )}
      </div>

      {/* Availability options — only show when an event is selected */}
      {eventLabel ? (
        <div style={{ background:C.section, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:14 }}>
            {EVENT_ICONS[selectedEvent]||'📋'} {typeof selectedEvent === 'string' && EVENT_TYPES.includes(selectedEvent) ? selectedEvent : existingEvents.find(e=>e.id===selectedEvent)?.name || customName}
          </div>

          <Field label="Joining this event?">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[['✅ Available','available',C.green],['❌ Not available','unavailable',C.red]].map(([l,v,c]) => (
                <button key={v} onClick={() => updEventAvail({present:v})} style={{ height:48, borderRadius:12, border:`1px solid ${eventAvail?.present===v?c:C.border}`, background:eventAvail?.present===v?c+'18':C.card, color:eventAvail?.present===v?c:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Arrival timing">
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[['⏰ On time','on-time'],['🕐 Arriving late','late'],['🚪 Leaving early','early'],['❓ Unknown','unknown']].map(([l,v]) => (
                <button key={v} onClick={() => updEventAvail({timing:v})} style={{ padding:'8px 12px', borderRadius:20, minHeight:38, border:`1px solid ${eventAvail?.timing===v?C.gold:C.border}`, background:eventAvail?.timing===v?C.gold+'18':C.card, color:eventAvail?.timing===v?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
          </Field>

          <Field label="On Discord?">
            <div style={{ display:'flex', gap:8 }}>
              {[['🎙️ Yes','yes'],['🔇 No','no'],['❓ Unknown','unknown']].map(([l,v]) => (
                <button key={v} onClick={() => updEventAvail({discord:v})} style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${eventAvail?.discord===v?C.icy:C.border}`, background:eventAvail?.discord===v?C.icy+'18':C.card, color:eventAvail?.discord===v?C.icy:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
        </div>
      ) : (
        <div style={{ background:C.section, borderRadius:12, padding:14, textAlign:'center' }}>
          <div style={{ fontSize:13, color:C.muted }}>Select an event above to set availability</div>
        </div>
      )}

      {/* Existing event availability summary */}
      {Object.keys(p.eventAvailability||{}).length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Recorded availability</div>
          {Object.entries(p.eventAvailability||{}).map(([evName, avail]) => (
            <div key={evName} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.border}22` }}>
              <div style={{ fontSize:13, color:C.white }}>{evName}</div>
              <div style={{ display:'flex', gap:6 }}>
                <span style={{ fontSize:12, color:avail.present==='available'?C.green:C.red, fontWeight:600 }}>
                  {avail.present==='available'?'✅':'❌'}
                </span>
                {avail.discord==='yes' && <span style={{ fontSize:12, color:C.icy }}>🎙️</span>}
                {avail.timing==='late'  && <span style={{ fontSize:12, color:C.gold }}>🕐</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PlayerSheet ────────────────────────────────────────────────
export function PlayerSheet({ player, open, onClose, onSave, existingTags=[], existingEvents=[], onGoToIntel }) {
  const [p, setP]               = useState(() => player || newPlayer());
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

  function upd(k, v)   { setP(prev => ({...prev, [k]:v, profileLastUpdated:new Date().toISOString()})); }
  function updT(k, v)  { setP(prev => ({...prev, troops:{...prev.troops,[k]:v}, profileLastUpdated:new Date().toISOString()})); }
  function updA(patch) { setP(prev => ({...prev, ...patch, profileLastUpdated:new Date().toISOString()})); }
  function save()      { onSave({...p, profileLastUpdated:p.profileLastUpdated||new Date().toISOString()}); onClose(); vibe(8); }

  const completion = checkCompletion(p);
  const STEPS = [
    { id:'identity', label:'Identity',     done:completion.identity },
    { id:'combat',   label:'Combat',       done:completion.combat   },
    { id:'avail',    label:'Availability', done:completion.avail    },
  ];

  const currentIdx = STEPS.findIndex(s => s.id === activeTab);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:350, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'92vh', overflowY:'auto', padding:'16px 20px 130px' }}>
        <SheetHandle />

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>{player ? 'Edit member' : 'Add member'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:28, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>

        {/* Step wizard */}
        <StepIndicator steps={STEPS} current={activeTab} onSelect={setActiveTab} />

        {/* ── Identity ── */}
        {activeTab==='identity' && (
          <div>
            <Field label="Username" hint="Their in-game display name">
              <Inp value={p.username} onChange={v=>upd('username',v)} placeholder="In-game username"/>
            </Field>
            <Field label="Nickname">
              <Inp value={p.alias} onChange={v=>upd('alias',v)} placeholder="Real name or nickname"/>
            </Field>
            <Field label="Player ID" hint="WOS numeric ID (FID)">
              <Inp value={p.fid} onChange={v=>upd('fid',v)} placeholder="e.g. 12345678" inputMode="numeric"/>
            </Field>
            <Field label="Alliance">
              <AlliancePicker value={p.allianceTag} onChange={v=>upd('allianceTag',v)} existingTags={existingTags}/>
            </Field>
            <Field label="Furnace">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {FC_OPTIONS.map(fc => {
                  const sel = p.furnaceLevel===fc;
                  return <button key={fc} onClick={()=>upd('furnaceLevel',sel?null:fc)} style={{ padding:'8px 16px', borderRadius:20, minHeight:40, border:`1px solid ${sel?C.gold:C.border}`, background:sel?C.gold+'22':C.section, color:sel?C.gold:C.muted, fontWeight:700, fontSize:14, cursor:'pointer' }}>{fc}</button>;
                })}
              </div>
            </Field>
            <Field label="Country">
              <Sel value={p.country} onChange={v=>upd('country',v)} options={COUNTRIES} placeholder="Select country…"/>
            </Field>
            <Field label="Languages">
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {LANGUAGES.map(lang => {
                  const sel = p.languages?.includes(lang);
                  return <button key={lang} onClick={()=>{const c=p.languages||[];upd('languages',sel?c.filter(l=>l!==lang):[...c,lang]);}} style={{ padding:'6px 12px', borderRadius:16, minHeight:36, border:`1px solid ${sel?C.icy:C.border}`, background:sel?C.icy+'22':C.section, color:sel?C.icy:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>{lang}</button>;
                })}
              </div>
            </Field>
            <Field label="Notes">
              <textarea value={p.notes||''} onChange={e=>upd('notes',e.target.value)} placeholder="Anything officers should know…" style={{ width:'100%', minHeight:80, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
            </Field>
          </div>
        )}

        {/* ── Combat ── */}
        {activeTab==='combat' && (
          <div>
            <Field label="🛡️ Infantry"><TierPill value={p.troops.infantry} onChange={v=>updT('infantry',v)} color={C.inf}/></Field>
            <Field label="⚔️ Lancer"><TierPill value={p.troops.lancer} onChange={v=>updT('lancer',v)} color={C.lan}/></Field>
            <Field label="🏹 Marksman"><TierPill value={p.troops.marksman} onChange={v=>updT('marksman',v)} color={C.mar}/></Field>
            <Field label="Role in SvS" hint="Select all that apply">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {ROLES.map(role => {
                  const sel=p.roles?.includes(role); const c=ROLE_COLORS[role];
                  return <button key={role} onClick={()=>{const cur=p.roles||[];upd('roles',sel?cur.filter(r=>r!==role):[...cur,role]);}} style={{ padding:'12px 14px', borderRadius:12, minHeight:48, textAlign:'left', position:'relative', border:`1px solid ${sel?c:C.border}`, background:sel?c+'18':C.section, color:sel?c:C.muted, fontWeight:600, fontSize:14, cursor:'pointer' }}>{sel&&<span style={{ position:'absolute', top:8, right:10, fontSize:12 }}>✓</span>}{ROLE_ICONS[role]} {role}</button>;
                })}
              </div>
            </Field>

            {/* Joiner heroes with registry link */}
            <Field label="Joiner Heroes">
              <div style={{ background:C.section, borderRadius:10, padding:12, marginBottom:10 }}>
                {(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).length > 0 ? (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {(p.joinerHeroes||[]).filter(jh=>jh.skillLevel>=5).map(jh=>(
                      <span key={jh.hero} style={{ padding:'6px 12px', borderRadius:16, background:C.gold+'18', border:`1px solid ${C.gold}33`, color:C.gold, fontWeight:600, fontSize:13 }}>✓ {jh.hero}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:C.muted }}>No joiner heroes recorded yet.</div>
                )}
              </div>
              {/* Link to Joiner Registry */}
              <button
                onClick={() => { save(); onGoToIntel && onGoToIntel(); }}
                style={{ width:'100%', height:44, borderRadius:10, background:'none', border:`1px solid ${C.gold}44`, color:C.gold, fontWeight:600, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
              >
                🦸 Open Joiner Registry to update heroes →
              </button>
            </Field>
          </div>
        )}

        {/* ── Availability ── */}
        {activeTab==='avail' && (
          <EventAvailabilitySection p={p} updA={updA} existingEvents={existingEvents}/>
        )}

        {/* ── Fixed bottom nav ── */}
        <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:C.card, borderTop:`1px solid ${C.border}`, padding:'12px 20px 16px', boxSizing:'border-box', zIndex:10 }}>
          {/* Mini completion summary */}
          <div style={{ display:'flex', gap:12, marginBottom:10, justifyContent:'center' }}>
            {STEPS.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:12, color:s.done?C.green:C.red+'88', fontWeight:700 }}>{s.done?'✓':'○'}</span>
                <span style={{ fontSize:12, color:s.done?C.green:C.muted }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {currentIdx > 0 ? (
              <button onClick={()=>{setActiveTab(STEPS[currentIdx-1].id);vibe(8);}} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>← Back</button>
            ) : (
              <button onClick={onClose} style={{ flex:1, height:52, borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:600, fontSize:16, cursor:'pointer' }}>Cancel</button>
            )}
            {currentIdx < STEPS.length-1 ? (
              <button onClick={()=>{setActiveTab(STEPS[currentIdx+1].id);vibe(8);}} style={{ flex:2, height:52, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}>Next →</button>
            ) : (
              <button onClick={save} style={{ flex:2, height:52, borderRadius:12, background:completion.identity&&completion.combat?C.green:C.gold, color:C.bg, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}>
                {completion.identity&&completion.combat ? '✓ Save member' : 'Save member'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { C } from '../utils/constants.js';
import { Field, Inp, SheetHandle } from './common/Primitives.jsx';
import { JOINER_META } from '../data/joinerMeta.js';

const GENERATIONS = JOINER_META.map(g => ({ gen: g.gen, label: g.genLabel }));

export function SettingsPanel({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings || {});
  function upd(k, v) { setS(prev => ({ ...prev, [k]: v })); }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000c', zIndex:300, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', padding:'16px 20px 60px', maxHeight:'86vh', overflowY:'auto' }}>
        <SheetHandle />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.white }}>⚙️ Alliance Settings</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        <Field label="Alliance Name">
          <Inp value={s.allianceName} onChange={v => upd('allianceName', v)} placeholder="Alliance name" />
        </Field>
        <Field label="Alliance Tag">
          <Inp value={s.allianceTag} onChange={v => upd('allianceTag', v)} placeholder="R3K" />
        </Field>
        <Field label="State ID">
          <Inp value={s.stateId} onChange={v => upd('stateId', v)} placeholder="3543" inputMode="numeric" />
        </Field>

        {/* Generation setting */}
        <Field label="Hero Generation" hint="Only formations from this generation and below will be suggested in battle planning.">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {GENERATIONS.map(g => {
              const sel = (s.maxGeneration || 6) >= g.gen;
              const active = s.maxGeneration === g.gen;
              return (
                <button key={g.gen} onClick={() => upd('maxGeneration', g.gen)}
                  style={{ textAlign:'left', padding:'10px 14px', borderRadius:10, border:`1px solid ${active?C.gold:sel?C.border:C.border+'44'}`, background:active?C.gold+'22':C.section, cursor:'pointer' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:active?C.gold:sel?C.white:C.muted }}>
                    {active?'✓ ':''}Gen {g.gen}
                    {active&&<span style={{ fontSize:11, fontWeight:400, color:C.gold, marginLeft:8 }}>Current</span>}
                  </div>
                  <div style={{ fontSize:11, color:active?C.gold:C.muted, marginTop:2 }}>
                    {g.label.replace(`Gen ${g.gen} — `,'').replace(`Gen ${g.gen} —`,'')}
                  </div>
                </button>
              );
            })}
          </div>
        </Field>

        <button onClick={() => onSave(s)} style={{ width:'100%', height:54, borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:17, border:'none', cursor:'pointer' }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

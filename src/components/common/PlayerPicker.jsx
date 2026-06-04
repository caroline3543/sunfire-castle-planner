import { useState, useEffect, useRef } from 'react';
import { C, ROLE_COLORS } from '../../utils/constants.js';
import { searchPlayers } from '../../services/playerAutosuggest.js';

function initials(n) {
  return (n || '?').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';
}

/**
 * Reusable PlayerPicker component.
 *
 * Props:
 *   players     — full player array to search
 *   value       — selected player ID (or null)
 *   onChange    — (id, player | null) => void
 *   placeholder — input placeholder text
 *   clearable   — show ✕ to clear selection
 *   style       — container style overrides
 */
export function PlayerPicker({ players, value, onChange, placeholder='Search players…', clearable=true, style={} }) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef();

  const selected = value ? players.find(p => p.id === value) : null;
  const results  = query.trim() ? searchPlayers(players, query) : [];

  function select(player) {
    onChange(player?.id || null, player || null);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onChange(null, null);
    setQuery('');
    setOpen(false);
  }

  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position:'relative', ...style }}>
      {selected ? (
        <SelectedChip player={selected} onClear={clearable ? clear : undefined} />
      ) : (
        <SearchDropdown
          query={query}
          results={results}
          open={open}
          placeholder={placeholder}
          onQuery={q => { setQuery(q); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onSelect={select}
        />
      )}
    </div>
  );
}

function SelectedChip({ player, onClear }) {
  const rc = ROLE_COLORS[player.roles?.[0]] || C.muted;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, background:C.section, border:`1px solid ${C.gold}66`, borderRadius:10, padding:'10px 14px' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', background:rc+'33', border:`1.5px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, color:C.white, flexShrink:0 }}>
        {initials(player.username || player.alias || '?')}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {player.username || player.alias || '?'}
        </div>
        <div style={{ fontSize:11, color:C.muted }}>
          {[
            player.allianceTag && `[${player.allianceTag}]`,
            player.furnaceLevel,
            player.availability?.discord === 'yes' && '🎙️',
          ].filter(Boolean).join(' · ')}
        </div>
      </div>
      {onClear && (
        <button onClick={onClear} style={{ background:'none', border:'none', color:C.muted, fontSize:18, cursor:'pointer', padding:'4px', lineHeight:1 }}>✕</button>
      )}
    </div>
  );
}

function SearchDropdown({ query, results, open, placeholder, onQuery, onFocus, onSelect }) {
  return (
    <div>
      <input
        value={query}
        onChange={e => onQuery(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}
      />
      {open && results.length > 0 && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', zIndex:600, boxShadow:'0 8px 24px #000a' }}>
          {results.map(p => (
            <PlayerRow key={p.id} player={p} onSelect={onSelect} />
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 14px', zIndex:600, fontSize:13, color:C.muted }}>
          No matches for "{query}"
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player, onSelect }) {
  const rc = ROLE_COLORS[player.roles?.[0]] || C.muted;
  return (
    <button
      onClick={() => onSelect(player)}
      style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 14px', background:'none', border:'none', borderBottom:`1px solid ${C.border}22`, cursor:'pointer', textAlign:'left' }}
    >
      <div style={{ width:32, height:32, borderRadius:'50%', background:rc+'33', border:`1.5px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, color:C.white, flexShrink:0 }}>
        {initials(player.username || player.alias || '?')}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.white }}>
          {player.username || player.alias || '?'}
        </div>
        <div style={{ fontSize:11, color:C.muted }}>
          {[
            player.allianceTag && `[${player.allianceTag}]`,
            player.furnaceLevel,
            player.availability?.discord === 'yes' && '🎙️',
          ].filter(Boolean).join(' · ')}
        </div>
      </div>
    </button>
  );
}

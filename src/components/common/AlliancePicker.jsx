import { useState } from 'react';
import { C } from '../../utils/constants.js';

/**
 * AlliancePicker
 *
 * Shared component for selecting or typing an alliance tag.
 * Used in: PlayerSheet, BatchAddSheet, EventSheet.
 *
 * Props:
 *   value          — current alliance tag string
 *   onChange       — (tag: string) => void
 *   existingTags   — array of tags already in the roster/events (shown as chips)
 *   placeholder    — input placeholder text
 */

// Default quick-select chips — shown when no existing tags are available
const DEFAULT_CHIPS = ['INT', 'SOV', 'LEO', '420', 'WWS'];

export function AlliancePicker({ value, onChange, existingTags = [], placeholder = 'Or type a custom tag…' }) {
  const [inputVal, setInputVal] = useState('');

  // Merge default chips with any existing tags from the roster, deduplicated
  const allChips = [...new Set([...DEFAULT_CHIPS, ...existingTags])].filter(Boolean);

  function select(tag) {
    // Tapping the selected chip deselects it
    onChange(value === tag ? '' : tag);
  }

  function handleInput(v) {
    setInputVal(v);
    onChange(v.toUpperCase());
  }

  return (
    <div>
      {/* Quick-select chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {allChips.map(tag => {
          const selected = value === tag;
          return (
            <button
              key={tag}
              onClick={() => { select(tag); setInputVal(''); }}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                minHeight: 40,
                border: `1px solid ${selected ? C.gold : C.border}`,
                background: selected ? C.gold + '22' : C.section,
                color: selected ? C.gold : C.muted,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {selected ? '✓ ' : ''}{tag}
            </button>
          );
        })}
      </div>

      {/* Free-text entry for custom tags */}
      <input
        value={inputVal || (allChips.includes(value) ? '' : value)}
        onChange={e => handleInput(e.target.value)}
        placeholder={placeholder}
        maxLength={8}
        style={{
          width: '100%',
          background: C.section,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 16,
          color: C.white,
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />
      {value && !allChips.includes(value) && (
        <div style={{ fontSize: 12, color: C.gold, marginTop: 6 }}>
          ✓ Custom tag: [{value}]
        </div>
      )}
    </div>
  );
}

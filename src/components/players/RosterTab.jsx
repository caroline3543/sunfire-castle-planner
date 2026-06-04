import { useState } from 'react';
import { C, ROLES, ROLE_COLORS, ROLE_ICONS } from '../../utils/constants.js';
import { PlayerCard }    from './PlayerCard.jsx';
import { ProfileView }   from './ProfileView.jsx';
import { PlayerSheet }   from './PlayerSheet.jsx';
import { BatchAddSheet } from './BatchAddSheet.jsx';

export function RosterTab({ players, events, onSavePlayer, onAddPlayers, onUpdatePlayers, onDeletePlayer }) {
  const [rosterView, setRosterView]       = useState('list');
  const [search, setSearch]               = useState('');
  const [filterRole, setFilterRole]       = useState('All');
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [profileOpen, setProfileOpen]     = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sheetOpen, setSheetOpen]         = useState(false);
  const [batchOpen, setBatchOpen]         = useState(false);

  const filteredPlayers = players.filter(p => {
    const t = (p.username||p.alias||'').toLowerCase();
    const ms = !search
      || t.includes(search.toLowerCase())
      || (p.allianceTag||'').toLowerCase().includes(search.toLowerCase())
      || (p.country||'').toLowerCase().includes(search.toLowerCase());
    const mr = filterRole==='All' || p.roles?.includes(filterRole);
    return ms && mr;
  });

  function openProfile(player) { setViewingPlayer(player); setProfileOpen(true); }
  function openEdit(player)    { setEditingPlayer(player); setSheetOpen(true); }
  function openAdd()           { setEditingPlayer(null); setSheetOpen(true); }

  return (
    <div style={{ padding:'16px 20px 0' }}>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, tag, country…"
          style={{ flex:1, height:48, background:'#152236', border:'1px solid #2A4A64', borderRadius:10, padding:'0 14px', fontSize:16, color:'#FFFFFF', fontFamily:'inherit' }}
        />
        <button onClick={() => setBatchOpen(true)} style={{ height:48, padding:'0 12px', borderRadius:10, background:'none', border:`1px solid ${C.gold}`, color:C.gold, fontWeight:700, fontSize:14, cursor:'pointer' }}>⚡ Batch</button>
        <button onClick={openAdd} style={{ height:48, padding:'0 14px', borderRadius:10, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>＋</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <button onClick={() => setRosterView('list')} style={{ flex:1, height:36, borderRadius:20, background:rosterView==='list'?C.gold+'22':C.section, border:`1px solid ${rosterView==='list'?C.gold:C.border}`, color:rosterView==='list'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>≡ List</button>
        <button onClick={() => setRosterView('roles')} style={{ flex:1, height:36, borderRadius:20, background:rosterView==='roles'?C.gold+'22':C.section, border:`1px solid ${rosterView==='roles'?C.gold:C.border}`, color:rosterView==='roles'?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer' }}>⚔️ By Role</button>
      </div>

      {rosterView==='list' && (
        <>
          {/* Ready for SvS summary bar — only show when there are players */}
          {players.length>0&&(()=>{
            const avail    = players.filter(p=>p.availability?.present==='available').length;
            const onDisc   = players.filter(p=>p.availability?.discord==='yes').length;
            const unknown  = players.filter(p=>!p.availability||p.availability.present==='available'&&p.availability.discord==='unknown').length;
            return (
              <div style={{ background:C.section, borderRadius:12, padding:'12px 16px', marginBottom:12, display:'flex', gap:0 }}>
                <div style={{ flex:1, textAlign:'center', borderRight:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:20, fontWeight:700, color:C.green }}>{avail}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Available</div>
                </div>
                <div style={{ flex:1, textAlign:'center', borderRight:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:20, fontWeight:700, color:C.icy }}>{onDisc}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>On Discord</div>
                </div>
                <div style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:unknown>0?C.gold:C.muted }}>{unknown}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Unconfirmed</div>
                </div>
              </div>
            );
          })()}
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:10, marginBottom:4 }}>
            {['All',...ROLES].map(r => (
              <button key={r} onClick={() => setFilterRole(r)} style={{ padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap', background:filterRole===r?C.gold+'22':C.section, border:`1px solid ${filterRole===r?C.gold:C.border}`, color:filterRole===r?C.gold:C.muted, fontWeight:600, fontSize:13, cursor:'pointer', minHeight:36 }}>{r}</button>
            ))}
          </div>
          {players.length > 0 && (
            <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>
              {filteredPlayers.length} of {players.length} player{players.length!==1?'s':''}
            </div>
          )}
          {players.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 20px' }}>
              <div style={{ fontSize:52, marginBottom:16 }}>👥</div>
              <div style={{ fontSize:18, fontWeight:700, color:C.white, marginBottom:8 }}>No players yet</div>
              <div style={{ fontSize:15, color:C.muted, marginBottom:28 }}>Batch add your alliance or add one by one</div>
              <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={() => setBatchOpen(true)} style={{ height:52, padding:'0 24px', borderRadius:12, background:C.gold, color:C.bg, fontWeight:700, fontSize:15, border:'none', cursor:'pointer' }}>⚡ Batch Add</button>
                <button onClick={openAdd} style={{ height:52, padding:'0 24px', borderRadius:12, background:C.section, border:`1px solid ${C.border}`, color:C.icy, fontWeight:700, fontSize:15, cursor:'pointer' }}>＋ Add One</button>
              </div>
            </div>
          )}
          {players.length > 0 && filteredPlayers.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:C.muted }}>No results for "{search||filterRole}"</div>
          )}
          {filteredPlayers.map(p => (
            <PlayerCard key={p.id} player={p} onClick={() => openProfile(p)} onDelete={onDeletePlayer} events={events}/>
          ))}
        </>
      )}

      {rosterView==='roles' && (() => {
        const avail  = players.filter(p => p.availability?.present==='available');
        const byRole = ROLES.map(role => ({ role, members:avail.filter(p => p.roles?.includes(role)) })).filter(g => g.members.length > 0);
        return (
          <div>
            <div style={{ background:C.section, borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, color:C.icy, marginBottom:4 }}>Available for SvS</div>
              <div style={{ fontSize:28, fontWeight:700, color:C.white }}>
                {avail.length} <span style={{ fontSize:16, color:C.muted }}>of {players.length}</span>
              </div>
            </div>
            {byRole.map(({ role, members }) => (
              <div key={role} style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:ROLE_COLORS[role], textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                  {ROLE_ICONS[role]} {role} · {members.length}
                </div>
                {members.map(m => (
                  <div key={m.id} onClick={() => openProfile(m)} style={{ background:C.card, borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
                    <div>
                      <div style={{ fontWeight:700, color:C.white, fontSize:15 }}>{m.username||m.alias||'?'}</div>
                      <div style={{ fontSize:12, color:C.icy }}>
                        {[m.furnaceLevel&&`${m.furnaceLevel}`, m.allianceTag&&`[${m.allianceTag}]`].filter(Boolean).join(' · ')}
                        {m.availability?.timing==='late'?' · 🕐':''}
                        {m.availability?.discord==='yes'?' · 🎙️':''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {[m.troops?.infantry, m.troops?.lancer, m.troops?.marksman].map((t,i) => (
                        <span key={i} style={{ fontSize:11, padding:'2px 6px', borderRadius:6, background:[C.inf,C.lan,C.mar][i]+'22', color:[C.inf,C.lan,C.mar][i] }}>{t||'?'}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {players.length === 0 && <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>Add players in List view first</div>}
          </div>
        );
      })()}

      <ProfileView
        player={viewingPlayer}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onEdit={() => { setProfileOpen(false); openEdit(viewingPlayer); }}
        events={events}
      />
      <PlayerSheet
        open={sheetOpen}
        player={editingPlayer}
        onClose={() => { setSheetOpen(false); setEditingPlayer(null); }}
        onSave={onSavePlayer}
      />
      <BatchAddSheet
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        members={players}
        onAddNew={onAddPlayers}
        onUpdateExisting={onUpdatePlayers}
      />
    </div>
  );
}

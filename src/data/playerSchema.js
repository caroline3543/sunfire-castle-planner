import { uid } from '../utils/dates.js';

export function newPlayer(overrides = {}) {
  return {
    id:                 uid(),
    fid:                '',
    username:           '',
    alias:              '',
    allianceTag:        '',
    country:            '',
    timezone:           '',
    languages:          [],
    furnaceLevel:       null,
    infantryCampLevel:  null,
    lancerCampLevel:    null,
    marksmanCampLevel:  null,
    troops: {
      infantry:  null,
      lancer:    null,
      marksman:  null,
    },
    // Single source of truth for joiner heroes
    joinerHeroes:       [],   // [{ hero, skillLevel, verified, updatedAt }]
    roles:              [],
    availability: {
      present:  'available',
      timing:   'unknown',
      lateBy:   null,
      earlyBy:  null,
      discord:  'unknown',
    },
    teamAssignment:     null,
    notes:              '',
    eventAvailability:  {},   // { "SvS Week 3": { present, timing, discord } }
    profileLastUpdated: null,
    createdAt:          Date.now(),
    eventHistory:       [],
    ...overrides,
  };
}

export function newEvent(overrides = {}) {
  return {
    id:             uid(),
    type:           'SvS',
    name:           '',
    allianceTag:    '',
    date:           new Date().toISOString().slice(0, 10),
    time:           '12:00',
    status:         'upcoming',
    participantIds: [],
    notes:          '',
    createdAt:      new Date().toISOString(),
    snapshots:      [],
    ...overrides,
  };
}

export function newSnapshot(playerId, playerProfile, eventId) {
  return {
    snapshotId:  uid(),
    eventId,
    playerId,
    createdAt:   new Date().toISOString(),
    profileSnapshot: {
      username:     playerProfile.username     || '',
      alias:        playerProfile.alias        || '',
      allianceTag:  playerProfile.allianceTag  || '',
      furnaceLevel: playerProfile.furnaceLevel || null,
      troops:       { ...(playerProfile.troops || {}) },
      roles:        [...(playerProfile.roles || [])],
      joinerHeroes: [...(playerProfile.joinerHeroes || [])],
    },
    attendance: {
      registered: false, attended: null, late: false,
      leftEarly: false, noShow: false, stayedFull: false,
      prepPhase: false, battlePhase: false,
    },
    voice: {
      joined: null, onTime: false, leftEarly: false,
      joinedLate: false, qualityNote: '',
    },
    combat: {
      joinedRallies: false, ledRallies: false,
      defendedStructures: false, followedOrders: null, wentRogue: false,
    },
    notes:          '',
    performanceTag: null,
  };
}

export function newSvsPlan(overrides = {}) {
  return {
    id:              uid(),
    name:            '',
    allianceTag:     '',
    date:            new Date().toISOString().slice(0, 10),
    status:          'draft',
    notes:           '',
    postBattleNotes: '',
    rallySlots:      [],   // new structure — replaces rallies/reinforcements
    createdAt:       new Date().toISOString(),
    ...overrides,
  };
}

export function newRallySlot(overrides = {}) {
  return {
    id:           uid(),
    type:         'Main Rally',
    leaderId:     null,
    leaderName:   '',
    rallyDuration: 3,
    ratio:        '60/40/0',
    troopReqs:    { infantry:null, lancer:null, marksman:null }, // min FC level per troop
    requestedHeroes: [],   // suggested joiner heroes from meta
    joiners:      [newJoinerSlot(), newJoinerSlot(), newJoinerSlot(), newJoinerSlot()],
    notes:        '',
    ...overrides,
  };
}

export function newJoinerSlot(overrides = {}) {
  return {
    id:        uid(),
    playerId:  null,
    playerName:'',
    heroName:  '',     // specific hero they must bring
    confirmed: false,  // marked unavailable mid-battle
    replacedBy:null,   // { playerId, playerName, heroName } if swapped
    ...overrides,
  };
}

// Legacy schemas kept for backward compat
export function newRally(overrides = {}) {
  return {
    id: uid(), label:'', leadPlayerId:null, leadName:'', allianceTag:'',
    launchTime:'', marchDuration:0, impactTime:'', isStrong:true,
    isCounter:false, isDecoy:false, order:1, notes:'', status:'planned',
    ...overrides,
  };
}

export function newReinforcement(overrides = {}) {
  return {
    id:                uid(),
    playerId:          null,
    playerName:        '',
    allianceTag:       '',
    targetArrivalTime: '',
    marchDuration:     0,
    sendTime:          '',
    arrivalWindow:     5,
    status:            'pending',
    notes:             '',
    ...overrides,
  };
}

export function newAssignment(overrides = {}) {
  return {
    id:          uid(),
    playerId:    null,
    playerName:  '',
    allianceTag: '',
    teamRole:    '',
    marchTime:   null,
    confirmed:   false,
    notes:       '',
    ...overrides,
  };
}

export function newMarchEntry(overrides = {}) {
  return {
    id:           uid(),
    playerId:     null,
    playerName:   '',
    castleMarch:  null,
    turretMarch:  null,
    centerMarch:  null,
    usesSpeedup:  false,
    teleportRow:  null,
    notes:        '',
    ...overrides,
  };
}

export function newPrepEntry(overrides = {}) {
  return {
    id:           uid(),
    playerId:     null,
    playerName:   '',
    allianceTag:  '',
    prepScore:    null,
    targetScore:  null,
    lastUpdated:  new Date().toISOString(),
    notes:        '',
    history:      [],
    ...overrides,
  };
}

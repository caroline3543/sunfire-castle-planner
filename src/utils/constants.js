export const C = {
  bg:      '#0A1628',
  card:    '#1E3A52',
  section: '#152236',
  gold:    '#F5A623',
  white:   '#FFFFFF',
  icy:     '#A8C4D8',
  muted:   '#5A7A94',
  inf:     '#6B8CAE',
  lan:     '#7BAE8C',
  mar:     '#B8859A',
  red:     '#FF453A',
  green:   '#30D158',
  border:  '#2A4A64',
};

export const TIER_OPTIONS = ['T10','FC1','FC2','FC3','FC4','FC5','T11','T12'];

export const ROLES = ['Rally Lead','Attack Team','Joiner','Garrison','Flexible','Reserve'];

export const ROLE_COLORS = {
  'Rally Lead':  C.gold,
  'Attack Team': C.red,
  'Joiner':      C.mar,
  'Garrison':    C.inf,
  'Flexible':    C.lan,
  'Reserve':     C.muted,
};

export const ROLE_ICONS = {
  'Rally Lead':  '👑',
  'Attack Team': '⚔️',
  'Joiner':      '🏹',
  'Garrison':    '🛡️',
  'Flexible':    '🔄',
  'Reserve':     '⏸️',
};

export const EVENT_ICONS = {
  'SvS':             '⚔️',
  'Foundry':         '🔥',
  'Canyon Clash':    '🏔️',
  'Bear Trap':       '🪤',
  'Sunfire Castle':  '🏰',
  'Transfer Season': '🚀',
  'Custom':          '📋',
};

export const PERF_TAGS = [
  { key: 'strong',    label: '⭐ Strong',    color: C.gold  },
  { key: 'reliable',  label: '✓ Reliable',   color: C.green },
  { key: 'improving', label: '↑ Improving',  color: C.icy   },
  { key: 'issue',     label: '⚠️ Issue',     color: C.red   },
  { key: 'noshow',    label: '✗ No-show',    color: C.muted },
];

export const TIMEZONES = [
  'Oceania','Southeast Asia','East Asia','South Asia','Middle East',
  'Eastern Europe','Central Europe','Western Europe','UK & Ireland',
  'West Africa','East Africa','South Africa','Eastern North America',
  'Central North America','Western North America',
  'Central America & Caribbean','South America (East)','South America (West)',
];

export const LANGUAGES = [
  'English','Mandarin','Spanish','Portuguese','Russian','Arabic','Turkish',
  'German','French','Indonesian','Vietnamese','Thai','Korean','Japanese',
  'Polish','Italian','Dutch','Hindi','Malay','Other',
];

export const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria',
  'Bangladesh','Belgium','Brazil','Cambodia','Canada','Chile','China',
  'Colombia','Czech Republic','Denmark','Egypt','Ethiopia','Finland',
  'France','Germany','Ghana','Greece','Hungary','India','Indonesia',
  'Iran','Iraq','Ireland','Italy','Japan','Jordan','Kazakhstan','Kenya',
  'Malaysia','Mexico','Morocco','Myanmar','Nepal','Netherlands',
  'New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines',
  'Poland','Portugal','Romania','Russia','Saudi Arabia','Serbia',
  'Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden',
  'Switzerland','Taiwan','Thailand','Turkey','Ukraine',
  'United Arab Emirates','United Kingdom','United States',
  'Venezuela','Vietnam','Other',
];

export const HEROES_BY_GEN = [
  { gen:'Gen 1',  heroes:['Jessie','Jasser','Jeronimo','Seo-Yoon','Patrick','Bahiti','Ling Xue','Lumak Bokan','Sergey'] },
  { gen:'Gen 2',  heroes:['Philly','Alonso'] },
  { gen:'Gen 3',  heroes:['Mia','Logan','Greg'] },
  { gen:'Gen 4',  heroes:['Reina','Ahmose','Lynn'] },
  { gen:'Gen 5',  heroes:['Norah','Hector','Gwen'] },
  { gen:'Gen 6',  heroes:['Wu Ming','Renee','Wayne'] },
  { gen:'Gen 7',  heroes:['Edith','Gordon','Bradley'] },
  { gen:'Gen 8',  heroes:['Gatot','Sonya','Hendrik'] },
  { gen:'Gen 9',  heroes:['Magnus','Fred','Xura'] },
  { gen:'Gen 10', heroes:['Gregory','Freya','Blanchette'] },
  { gen:'Gen 11', heroes:['Eleonora','Lloyd','Rufus'] },
];

export const STRATEGY_TYPES = [
  'Solo Rush','Double Rally','Multi Rally','Counter Rally',
  'Castle Switching','Decoy Garrison Lead','Defensive Hold',
  'Reinforcement Wall','Hybrid','Custom',
];

export const TEAM_ROLES = [
  'Solo Attack','Counter Rally','Reinforcement','Castle Fill',
  'Exit Team','Backup','Voice Required','Garrison Lead','Decoy Lead',
];

export const EVENT_TYPES = [
  'SvS','Foundry','Canyon Clash','Bear Trap',
  'Sunfire Castle','Transfer Season','Custom',
];

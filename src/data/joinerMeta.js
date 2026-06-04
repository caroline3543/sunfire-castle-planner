/**
 * joinerMeta.js
 * Gen 1–6 rally formation data from community spreadsheet.
 * Used by Rally Joiner Registry → Meta tab.
 */

export const JOINER_HEROES = [
  'Jessie','Jasser','Jeronimo','Seo-Yoon','Patrick','Sergey',
  'Philly','Alonso',
  'Mia','Logan','Greg',
  'Reina','Ahmose','Lynn',
  'Norah','Hector','Gwen',
  'Wu Ming','Renee','Wayne',
];

export const JOINER_META = [
  {
    gen: 1, genLabel: 'Gen 1 — Jeronimo, Natalia, Molly, Zinman + Purple Heroes',
    formations: [
      { type:'Defense', ratio:'60/40/0 or 60/10/30', leaders:['Jeronimo','Molly & Zinman'],   j1:'Jessie*', j2:'Seeyoon', j3:'Patrick', j4:'Sergey**', alt1:'Ling Xue', comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50', leaders:['Jeronimo','Molly & Zinman'],   j1:'Jessie*', j2:'Seeyoon', j3:'Patrick', j4:'Jessie*/Patrick', alt1:'Sergey**', alt2:'Ling Xue', comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
    ],
  },
  {
    gen: 2, genLabel: 'Gen 2 — Flint, Philly, Alonso',
    formations: [
      { type:'Defense', ratio:'60/40/0 or 60/10/30', leaders:['Flint & Philly & Zinman'],    j1:'Patrick', j2:'Jessie*', j3:'Seeyoon', j4:'Sergey**', alt1:'Patrick', alt2:'Jessie*' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50', leaders:['Jeronimo & Philly & Alonso'], j1:'Patrick', j2:'Jessie*', j3:'Seeyoon', j4:'Zinman',   alt1:'Patrick', alt2:'20% ones', comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
    ],
  },
  {
    gen: 3, genLabel: 'Gen 3 — Logan, Mia, Greg',
    formations: [
      { type:'Defense', ratio:'60/30/10 or 60/10/30', leaders:['Logan & Philly & Zinman'],    j1:'Mia',     j2:'Patrick', j3:'Jessie*', j4:'Seeyoon' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50', leaders:['Jeronimo & Mia & Greg'],      j1:'Jessie*', j2:'Seeyoon', j3:'Philly',  j4:'Patrick',    alt1:'Zinman',   comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
      { type:'Offense', ratio:'60/40/0 or 40/60/0',   leaders:['Jeronimo & Mia & Greg/Alonso'],j1:'Jessie*',j2:'Seeyoon', j3:'Philly',  j4:'Patrick',    alt1:'Zinman',   comments:'Jeronimo is Jessie + Seyoon already so stacking happens' },
    ],
  },
  {
    gen: 4, genLabel: 'Gen 4 — Ahmose, Reina, Lynn',
    formations: [
      { type:'Defense', ratio:'60/40/0 or 60/30/10', leaders:['Ahmose/Logan & Reina & Lynn'], j1:'Mia',     j2:'Patrick', j3:'Jessie*', j4:'Seeyoon',    alt1:'Zinman',   alt2:'Philly' },
      { type:'Defense', ratio:'50/20/30 or 30/20/50', leaders:['Jeronimo & Reina & Greg'],    j1:'Mia',     j2:'Patrick', j3:'Philly',  j4:'Zinman',     alt1:'Jessie*',  alt2:'Seeyoon', comments:'Jeronimo is Jessie + Seyoon already' },
      { type:'Offense', ratio:'48/4/48 or 40/10/50',  leaders:['Jeronimo & Mia & Greg/Alonso'],j1:'Patrick',j2:'Philly',  j3:'Zinman',  j4:'Reina',     alt1:'Jessie*',  alt2:'Seeyoon', comments:'Jeronimo is Jessie + Seyoon already' },
      { type:'Offense', ratio:'60/40/0 or 40/60/0',   leaders:['Jeronimo & Reina/Mia & Mia & Greg'],j1:'Mia/Reina',j2:'Patrick',j3:'Zinman',j4:'Jessie*', alt1:'Seeyoon', comments:'ONLY 1 Mia, do not stack. Jeronimo is Jessie + Seyoon already' },
    ],
  },
  {
    gen: 5, genLabel: 'Gen 5 — Hector, Norah, Gwen',
    formations: [
      { type:'Defense', ratio:'60/40/0',               leaders:['Hector & Norah & Zinman'],    j1:'Mia',     j2:'Patrick', j3:'Jessie*', j4:'Philly' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50',  leaders:['Jeronimo & Reina & Gwen'],    j1:'Mia',     j2:'Jessie*', j3:'Seeyoon', j4:'Norah',     alt1:'Patrick',  alt2:'Philly' },
      { type:'Offense', ratio:'48/4/48 or 40/10/50',   leaders:['Jeronimo & Mia & Gwen'],      j1:'Norah',   j2:'Norah',   j3:'Norah',   j4:'Patrick',    alt2:'Philly',   alt3:'Zinman', comments:'Alternative joiners choice: Jessie, Seeyoon, 2xPatrick' },
      { type:'Offense', ratio:'60/40/0 or 40/60/0',    leaders:['Jeronimo & Norah & Greg'],    j1:'Mia',     j2:'Patrick', j3:'Jessie*', j4:'Philly',     alt1:'Zinman' },
    ],
  },
  {
    gen: 6, genLabel: 'Gen 6 — Wu Ming, Renee, Wayne',
    formations: [
      { type:'Defense', ratio:'60/40/0',               leaders:['Wu Ming & Norah & Zinman'],   j1:'Renee',   j2:'Mia',     j3:'Patrick', j4:'Jessie*',    alt1:'Wu Ming',  comments:'Wu Ming to counter his skills damages' },
      { type:'Offense', ratio:'50/20/30 or 30/20/50',  leaders:['Jeronimo & Renee & Gwen'],    j1:'Jessie*', j2:'Seeyoon', j3:'Mia',     j4:'Norah',      alt1:'Patrick',  alt2:'Wu Ming', comments:'Jeronimo is Jessie + Seyoon already so stacking happens. Wu Ming to counter his skills damages' },
      { type:'Offense', ratio:'48/4/48 or 40/10/50',   leaders:['Jeronimo/Hector & Mia & Wayne/Gwen'],j1:'Norah',j2:'Norah',j3:'Norah',j4:'Norah/Patrick',alt1:'or 25%', comments:'Alternative joiners choice: Jessie, Seeyoon, 2xPatrick. Wu Ming to counter his skills damages' },
      { type:'Offense', ratio:'60/40/0 or 40/60/0',    leaders:['Jeronimo & Renee & Greg'],    j1:'Mia',     j2:'Patrick', j3:'Jessie**',j4:'Seeyoon',    alt1:'Wu Ming',  alt2:'Philly', comments:'Jeronimo is Jessie + Seyoon already so stacking happens. Wu Ming to counter his skills damages' },
      { type:'NEW META Defense', ratio:'45/5/50',       leaders:['Logan & Philly & Wayne'],     j1:'Norah',   j2:'Norah',   j3:'Norah',   j4:'Norah/Patrick',alt1:'or 25%', comments:'', isMeta:true },
      { type:'NEW Defense',      ratio:'45/16/40',      leaders:['Hector & Norah & Wayne'],     j1:'Mia',     j2:'Patrick', j3:'Philly',  j4:'Lynn',       alt1:'or 25%', isMeta:true },
    ],
  },
];

/**
 * Build a coverage report: for each joiner hero, how many players own it.
 */
export function buildCoverageReport(players, heroList) {
  return heroList.map(hero => {
    const owners = players.filter(p =>
      (p.joinerHeroes || []).some(jh => jh.hero === hero && jh.skillLevel >= 5)
    );
    return { hero, count: owners.length, owners };
  });
}

/**
 * Given gen/type/ratio filters, return the matching meta formation.
 */
export function getMetaSuggestion(gen, type, ratio) {
  const genData = JOINER_META.find(g => g.gen === gen);
  if (!genData) return null;
  let formations = genData.formations;
  if (type) formations = formations.filter(f => f.type.toLowerCase().includes(type.toLowerCase()));
  if (ratio && ratio !== 'Any') formations = formations.filter(f => f.ratio.includes(ratio));
  return formations[0] || null;
}

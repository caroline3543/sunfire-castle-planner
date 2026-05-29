// ── Joiner hero master list ────────────────────────────────────
// Single source of truth for all hero names used in the Joiner Registry.
// Add new heroes here; the rest of the app picks them up automatically.

export const JOINER_HEROES = [
  "Jessie", "Seo-Yoon", "Patrick", "Zinman", "Sergey",
  "Mia", "Philly", "Reina", "Norah", "Lynn",
  "Wu Ming", "Renee", "Jasser", "Jeronimo",
  "Ahmose", "Greg", "Alonso", "Hector", "Gwen", "Wayne",
];

// ── Meta tables (from spreadsheet) ────────────────────────────
// Structure:
// {
//   gen: number,
//   label: string,          // display name
//   newHeroes: string[],    // heroes introduced this gen
//   formations: [
//     {
//       type: "Defense" | "Offense",
//       ratio: string,       // e.g. "60/40/0"
//       leaders: string,
//       joiners: string[],   // [J1, J2, J3, J4]
//       alt1: string,
//       alt2: string,
//       notes: string,
//     }
//   ]
// }

export const JOINER_META = [
  {
    gen: 1,
    label: "Gen 1",
    subtitle: "New: Jeronimo, Natalia, Molly, Zinman + Purple Heroes",
    newHeroes: ["Jessie","Seo-Yoon","Patrick","Zinman","Sergey"],
    formations: [
      { type:"Defense", ratio:"60/40/0 or 60/10/30", leaders:"Jeronimo & Molly & Zinman", joiners:["Jessie","Seo-Yoon","Patrick","Patrick"], alt1:"Sergey", alt2:"Ling Xue", notes:"Jeronimo is Jessie + Seeyoon already so stacking happens" },
      { type:"Offense", ratio:"50/20/30 or 30/20/50", leaders:"Jeronimo & Molly & Zinman", joiners:["Jessie","Seo-Yoon","Patrick","Jessie/Patrick"], alt1:"Sergey", alt2:"Ling Xue", notes:"Jeronimo is Jessie + Seeyoon already so stacking happens" },
    ],
  },
  {
    gen: 2,
    label: "Gen 2",
    subtitle: "New: Flint, Philly, Alonso",
    newHeroes: ["Philly","Alonso"],
    formations: [
      { type:"Defense", ratio:"60/40/0 or 60/10/30", leaders:"Flint & Philly & Zinman",  joiners:["Patrick","Jessie","Seo-Yoon","Sergey"],  alt1:"Patrick", alt2:"Jessie",  notes:"" },
      { type:"Offense", ratio:"50/20/30 or 30/20/50", leaders:"Jeronimo & Philly & Alonso", joiners:["Patrick","Jessie","Seo-Yoon","Zinman"],  alt1:"Patrick", alt2:"20% ones", notes:"Jeronimo is Jessie + Seeyoon already so stacking happens" },
    ],
  },
  {
    gen: 3,
    label: "Gen 3",
    subtitle: "New: Logan, Mia, Greg",
    newHeroes: ["Mia","Greg"],
    formations: [
      { type:"Defense", ratio:"60/30/10 or 60/10/30", leaders:"Logan & Philly & Zinman",    joiners:["Mia","Patrick","Jessie","Seo-Yoon"],    alt1:"",       alt2:"",      notes:"" },
      { type:"Offense", ratio:"50/20/30 or 20/50",    leaders:"Jeronimo & Mia & Greg",      joiners:["Jessie","Seo-Yoon","Philly","Patrick"], alt1:"Zinman", alt2:"",      notes:"Jeronimo is Jessie + Seeyoon already so stacking happens" },
      { type:"Offense", ratio:"60/40/0 or 40/60/0",   leaders:"Jeronimo & Mia & Greg/Alonso", joiners:["Jessie","Seo-Yoon","Philly","Patrick"], alt1:"Zinman", alt2:"",   notes:"Jeronimo is Jessie + Seeyoon already so stacking happens" },
    ],
  },
  {
    gen: 4,
    label: "Gen 4",
    subtitle: "New: Ahmose, Reina, Lynn",
    newHeroes: ["Reina","Ahmose","Lynn"],
    formations: [
      { type:"Defense", ratio:"60/40/0 or 60/30/10", leaders:"Ahmose/Logan & Reina & Lynn",    joiners:["Mia","Patrick","Jessie","Seo-Yoon"],    alt1:"Zinman",  alt2:"Philly",  notes:"" },
      { type:"Offense", ratio:"50/20/30 or 20/50",    leaders:"Jeronimo & Reina & Greg",        joiners:["Mia","Patrick","Philly","Zinman"],       alt1:"Jessie",  alt2:"Seo-Yoon",notes:"Jeronimo is Jessie + Seeyoon already" },
      { type:"Offense", ratio:"48/4/48 or 40/10/50",  leaders:"Jeronimo & Mia & Greg/Alonso",  joiners:["Patrick","Philly","Zinman","Reina"],     alt1:"Jessie",  alt2:"Seo-Yoon",notes:"Jeronimo is Jessie + Seeyoon already" },
      { type:"Offense", ratio:"60/40/0 or 40/60/0",   leaders:"Jeronimo & Mia & Greg",         joiners:["Patrick","Philly","Zinman","Mia/Reina"], alt1:"Jessie",  alt2:"Seo-Yoon",notes:"ONLY 1 Mia, do not stack. Jeronimo is Jessie + Seeyoon already" },
    ],
  },
  {
    gen: 5,
    label: "Gen 5",
    subtitle: "New: Hector, Norah, Gwen",
    newHeroes: ["Norah","Hector","Gwen"],
    formations: [
      { type:"Defense", ratio:"60/40/0",              leaders:"Hector & Norah & Zinman",        joiners:["Mia","Patrick","Jessie","Philly"],       alt1:"",        alt2:"",        notes:"" },
      { type:"Offense", ratio:"50/20/30 or 20/50",    leaders:"Jeronimo & Reina & Gwen",        joiners:["Mia","Jessie","Seo-Yoon","Norah"],       alt1:"Patrick", alt2:"Philly",  notes:"" },
      { type:"Offense", ratio:"48/4/48 or 40/10/50",  leaders:"Jeronimo & Mia & Gwen",         joiners:["Norah","Norah","Norah","Patrick"],       alt1:"Philly",  alt2:"Zinman",  notes:"Alternative joiners choice: Jessie, Seeyoon, 2xPatrick" },
      { type:"Offense", ratio:"60/40/0 or 40/60/0",   leaders:"Jeronimo & Mia & Greg",         joiners:["Jessie","Seo-Yoon","Norah","Patrick"],   alt1:"Philly",  alt2:"",        notes:"" },
    ],
  },
  {
    gen: 6,
    label: "Gen 6",
    subtitle: "New: Wu Ming, Renee, Wayne",
    newHeroes: ["Wu Ming","Renee","Wayne"],
    formations: [
      { type:"Defense", ratio:"60/40/0",              leaders:"Wu Ming & Norah & Zinman",        joiners:["Renee","Mia","Patrick","Jessie"],         alt1:"Wu Ming", alt2:"",        notes:"Wu Ming to counter his skills damages" },
      { type:"Offense", ratio:"50/20/30 or 30/20/50", leaders:"Jeronimo & Renee & Gwen",        joiners:["Jessie","Seo-Yoon","Mia","Norah"],        alt1:"Patrick", alt2:"Wu Ming", notes:"Jeronimo is Jessie + Seeyoon already so stacking. Wu Ming to counter his skills" },
      { type:"Offense", ratio:"48/4/48 or 40/10/50",  leaders:"Jeronimo/Hector & Mia & Wayne/Gwen", joiners:["Norah","Norah","Norah","Norah/Patrick"], alt1:"or 25%",  alt2:"",    notes:"Alternative joiners: Jessie, Seeyoon, 2xPatrick. Wu Ming to counter skills" },
      { type:"Offense", ratio:"60/40/0 or 40/60/0",   leaders:"Jeronimo & Renee & Greg",        joiners:["Mia","Patrick","Jessie","Seo-Yoon"],      alt1:"Wu Ming", alt2:"Philly",  notes:"Jeronimo is Jessie + Seeyoon already. Wu Ming to counter skills" },
      { type:"Defense", ratio:"NEW META 45/5/50",      leaders:"Logan & Philly & Wayne",         joiners:["Norah","Norah","Norah","Norah/Patrick"],  alt1:"or 25%",  alt2:"",        notes:"NEW META — highlighted green in spreadsheet" },
      { type:"Defense", ratio:"NEW 46/16/40",          leaders:"Hector & Norah & Wayne",         joiners:["Mia","Patrick","Philly","Lynn"],          alt1:"or 25%",  alt2:"",        notes:"NEW META — highlighted green in spreadsheet" },
    ],
  },
];

// ── Stacking detection ─────────────────────────────────────────
// Returns { hero, count, risk } for heroes appearing > 2 times
export function detectStacking(joinerList) {
  const counts = {};
  joinerList.forEach(h => { if (h) counts[h] = (counts[h] || 0) + 1; });
  return Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .map(([hero, count]) => ({ hero, count, risk: count >= 4 ? "high" : "medium" }));
}

// ── Coverage report ────────────────────────────────────────────
// Given players[], returns { hero: count }
export function buildCoverageReport(players) {
  const report = {};
  JOINER_HEROES.forEach(h => { report[h] = 0; });
  players.forEach(p => {
    (p.joinerHeroes || []).forEach(jh => {
      if (report[jh.hero] !== undefined) report[jh.hero]++;
    });
  });
  return report;
}

// ── Meta suggestions ───────────────────────────────────────────
// Given { gen, type, ratio } returns the best matching formation
export function getMetaSuggestion(gen, type, ratio) {
  const genData = JOINER_META.find(m => m.gen === gen);
  if (!genData) return null;
  const exact = genData.formations.find(f =>
    f.type === type && (f.ratio.includes(ratio) || ratio === "")
  );
  return exact || genData.formations.find(f => f.type === type) || genData.formations[0];
}

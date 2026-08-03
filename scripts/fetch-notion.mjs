// Legge i dati reali da Notion e scrive data/kpi.json e data/deadlines.json
// Richiede: env NOTION_TOKEN (secret GitHub) + env DB_PROGETTI (id database)
import { writeFileSync, mkdirSync } from 'node:fs';

const TOKEN = process.env.NOTION_TOKEN;
const DB = process.env.DB_PROGETTI;
if (!TOKEN) { console.error('NOTION_TOKEN mancante'); process.exit(1); }
if (!DB)    { console.error('DB_PROGETTI mancante'); process.exit(1); }

const H = {
  'Authorization': `Bearer ${TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
};

async function queryAll(db) {
  let results = [], cursor = undefined;
  do {
    const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
      method: 'POST', headers: H,
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 })
    });
    if (!r.ok) { console.error('Notion API', r.status, await r.text()); process.exit(1); }
    const d = await r.json();
    results = results.concat(d.results);
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return results;
}

const txt  = p => (p?.title?.[0]?.plain_text) ?? (p?.rich_text?.[0]?.plain_text) ?? '';
const sel  = p => p?.select?.name ?? null;
const num  = p => (typeof p?.number === 'number' ? p.number : 0);
const date = p => p?.date?.start ?? null;

const rows = (await queryAll(DB)).map(pg => {
  const P = pg.properties;
  return {
    progetto: txt(P['Progetto']),
    cliente:  txt(P['Cliente']),
    stato:    sel(P['Stato']),
    valore:   num(P['Valore']),
    consegna: date(P['Consegna']),
    priorita: sel(P['Priorità'])
  };
});

const ACTIVE = ['Lead', 'In corso', 'In consegna'];
const now = new Date();
const todayISO = now.toISOString().slice(0, 10);

// ---- KPI ----
const byStato = {};
for (const s of ['Lead','In corso','In consegna','Consegnato','Perso']) byStato[s] = 0;
let pipelineValue = 0, activeCount = 0, wonValue = 0, wonCount = 0;
for (const r of rows) {
  if (r.stato && byStato[r.stato] !== undefined) byStato[r.stato]++;
  if (ACTIVE.includes(r.stato)) { pipelineValue += r.valore; activeCount++; }
  if (r.stato === 'Consegnato') { wonValue += r.valore; wonCount++; }
}
const kpi = {
  updatedAt: now.toISOString(),
  pipelineValue, activeCount, wonValue, wonCount,
  leadCount: byStato['Lead'], totalCount: rows.length, byStato
};

// ---- DEADLINES ----
const openWithDate = rows.filter(r => r.consegna && !['Consegnato','Perso'].includes(r.stato));
const fmt = r => ({ progetto: r.progetto, cliente: r.cliente, date: r.consegna, stato: r.stato, priorita: r.priorita, valore: r.valore });
const upcoming = openWithDate.filter(r => r.consegna >= todayISO).sort((a,b)=>a.consegna.localeCompare(b.consegna)).slice(0,6).map(fmt);
const overdue  = openWithDate.filter(r => r.consegna <  todayISO).sort((a,b)=>a.consegna.localeCompare(b.consegna)).map(fmt);
const deadlines = { updatedAt: now.toISOString(), items: upcoming, overdue };

mkdirSync('data', { recursive: true });
writeFileSync('data/kpi.json', JSON.stringify(kpi, null, 2));
writeFileSync('data/deadlines.json', JSON.stringify(deadlines, null, 2));
console.log('OK:', rows.length, 'progetti · pipeline €' + pipelineValue + ' · upcoming ' + upcoming.length);

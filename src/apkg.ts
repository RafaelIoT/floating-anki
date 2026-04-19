import JSZip from 'jszip';
import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export type Card = {
  id: number;      // Anki note id — stable across re-imports of the same deck
  front: string;
  back: string;
};

const FIELD_SEP = '\x1f';

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSql() {
  if (!SQL) SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  return SQL;
}

async function extractCollection(buf: ArrayBuffer): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buf);
  const candidate =
    zip.file('collection.anki21') ??
    zip.file('collection.anki2');
  if (!candidate) {
    if (zip.file('collection.anki21b')) {
      throw new Error(
        'This .apkg uses the newer Zstd-compressed format. Re-export from Anki with "Support older Anki versions" enabled.'
      );
    }
    throw new Error('No collection.anki2 / .anki21 found inside .apkg.');
  }
  return candidate.async('uint8array');
}

function cleanHtml(s: string): string {
  return s.replace(/\[sound:[^\]]*\]/g, '').trim();
}

export async function loadCards(buf: ArrayBuffer): Promise<Card[]> {
  const sqliteBytes = await extractCollection(buf);
  const sql = await getSql();
  const db: Database = new sql.Database(sqliteBytes);
  try {
    const res = db.exec('SELECT id, flds FROM notes');
    if (res.length === 0) return [];
    const rows = res[0].values as [number, string][];
    const cards: Card[] = [];
    for (const [id, flds] of rows) {
      if (!flds) continue;
      const parts = flds.split(FIELD_SEP).map(cleanHtml).filter(Boolean);
      if (parts.length === 0) continue;
      const front = parts[0];
      const back = parts.slice(1).join('<hr>') || front;
      cards.push({ id, front, back });
    }
    return cards;
  } finally {
    db.close();
  }
}

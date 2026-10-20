// 로컬 개발용: Cloudflare 없이 같은 worker.js 로직을 node:sqlite 로 띄운다.
//   node game-server/dev-server.mjs            (기본 포트 8787, 메모리 DB)
//   DB_FILE=.dev.sqlite PORT=8787 node game-server/dev-server.mjs
//   TANGTANG_API=http://127.0.0.1:8787 node scripts/build-game-web.mjs
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.js';

const db = new DatabaseSync(process.env.DB_FILE || ':memory:');
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const env = {
  DB: {
    prepare(sql) {
      const st = db.prepare(sql);
      return { bind: (...a) => ({ first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }), run: async () => { st.run(...a); } }) };
    },
  },
};
const port = Number(process.env.PORT) || 8787;
createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, '127.0.0.1', () => console.log(`tangtang dev server http://127.0.0.1:${port}`));

// 로컬 개발/테스트용 서버: Netlify 없이 게임 + /api 함수를 그대로 띄운다. (netlify dev 와 같은 역할의 가벼운 버전)
//   ADMIN_PASSWORD=원하는비밀번호 npm run dev      →  http://localhost:8888
// 저장 데이터는 cloud/.blobs/ 폴더(로컬 Blobs 서버)에 쌓인다.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BlobsServer } from '@netlify/blobs/server';

const here = dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 8 * 1024 * 1024;

// 로컬 Blobs 서버는 조건부 쓰기(onlyIfMatch/onlyIfNew)가 원자적이지 않고 etag 도 파일 수정 시각(ms) 기반이라 약하다.
// 그래서 쓰기·삭제를 한 줄로 세우고, etag 를 "버전 번호"로 바꿔 끼우며, 조건 검사를 이 프록시가 직접 해서
// 실제 Netlify Blobs(서버에서 원자적으로 조건부 쓰기 처리)와 같은 동작을 흉내 낸다.
async function startSerialProxy(targetPort) {
  let chain = Promise.resolve();
  const versions = new Map();   // 경로 → 쓰기 횟수(= etag)
  const etagOf = (path) => `"v${versions.get(path) || 0}"`;
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const path = (req.url || '').split('?')[0];
      const headers = { ...req.headers }; delete headers.host; delete headers.connection; delete headers['content-length'];
      const target = `http://127.0.0.1:${targetPort}${req.url}`;
      const send = (r, body) => {
        const out = Object.fromEntries(r.headers); delete out['content-encoding']; delete out['content-length']; delete out['transfer-encoding'];
        if (r.status === 200) out.etag = etagOf(path);   // 로컬 서버는 HEAD 응답에 etag 가 없어서 직접 붙인다 (실제 Netlify 는 HEAD 에도 etag 를 준다)
        res.writeHead(r.status, out); res.end(body);
      };
      const run = async () => {
        try {
          const isWrite = req.method === 'PUT' || req.method === 'DELETE';
          if (req.method === 'PUT') {
            const ifMatch = headers['if-match'], ifNone = headers['if-none-match'];
            if (ifMatch || ifNone) {
              const exists = (await fetch(target, { method: 'HEAD', headers })).status === 200;
              if ((ifNone === '*' && exists) || (ifMatch && (!exists || ifMatch !== etagOf(path)))) { res.writeHead(412).end(); return; }
              delete headers['if-match']; delete headers['if-none-match'];
            }
          }
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
          const r = await fetch(target, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
          if (isWrite && r.status < 300) versions.set(path, (versions.get(path) || 0) + 1);
          send(r, Buffer.from(await r.arrayBuffer()));
        } catch { res.writeHead(502).end(); }
      };
      if (req.method === 'PUT' || req.method === 'DELETE') chain = chain.then(run, run); else run();
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

export async function startDevServer({ port = 0, blobsDir = join(here, '.blobs'), gameFile = join(here, '..', 'game', 'index.html'), quiet = false } = {}) {
  mkdirSync(blobsDir, { recursive: true });
  const token = 'dev-token';
  const blobs = new BlobsServer({ directory: blobsDir, token, port: 0 });
  const { port: blobsPort } = await blobs.start();
  const proxy = await startSerialProxy(blobsPort);
  const edge = `http://127.0.0.1:${proxy.port}`;
  // 배포 환경에서 Netlify 가 넣어 주는 값과 같은 형태로 주입 → 함수 코드는 배포와 100% 동일하게 동작
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: edge, uncachedEdgeURL: edge, token, siteID: 'local-dev' })).toString('base64');
  // BLOCKCRAFT_API_MODULE: 번들(drop/netlify/functions/api.mjs)이 소스와 똑같이 동작하는지 같은 테스트로 확인할 때 쓴다
  const apiFile = process.env.BLOCKCRAFT_API_MODULE ? join(here, process.env.BLOCKCRAFT_API_MODULE) : join(here, 'netlify', 'functions', 'api.mjs');
  const api = (await import(pathToFileURL(apiFile).href)).default;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/api/')) {
        const chunks = []; let size = 0;
        for await (const c of req) { size += c.length; if (size > MAX_BODY) { res.writeHead(413).end(); return; } chunks.push(c); }
        const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
        const request = new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined });
        const response = await api(request, { ip: req.socket.remoteAddress || '127.0.0.1' });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
        res.end(readFileSync(gameFile));
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    } catch (e) {
      if (!quiet) console.error(e);
      res.writeHead(500).end('server error');
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const addr = server.address();
  return {
    url: `http://127.0.0.1:${addr.port}`,
    async close() { await new Promise((r) => server.close(r)); await proxy.close(); await blobs.stop(); },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const s = await startDevServer({ port: Number(process.env.PORT) || 8888 });
  console.log(`블록크래프트 로컬 서버: ${s.url}`);
  console.log(process.env.ADMIN_PASSWORD ? '관리자 비밀번호: 환경 변수 ADMIN_PASSWORD 로 설정됨' : '※ ADMIN_PASSWORD 가 없어서 관리자 기능은 꺼져 있어요 (예: ADMIN_PASSWORD=test npm run dev)');
}

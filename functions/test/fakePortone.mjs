/**
 * 테스트용 가짜 PortOne V2 API 서버 (GET /payments/:id, POST /payments/:id/cancel).
 * 실제 서버 SDK(@portone/server-sdk)가 baseUrl 만 바꿔 이 서버를 호출한다.
 */
import http from 'node:http';

export function startFakePortone(port, expectedSecret) {
  const payments = new Map();
  const cancels = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const send = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (req.headers.authorization !== `PortOne ${expectedSecret}`) return send(401, { type: 'UNAUTHORIZED', message: 'bad secret' });
    const url = new URL(req.url, 'http://x');
    const m = url.pathname.match(/^\/payments\/([^/]+)(\/cancel)?$/);
    if (!m) return send(404, { type: 'NOT_FOUND' });
    const id = decodeURIComponent(m[1]);
    const p = payments.get(id);
    if (!p) return send(404, { type: 'PAYMENT_NOT_FOUND', message: 'not found' });
    if (req.method === 'GET' && !m[2]) return send(200, p);
    if (req.method === 'POST' && m[2]) {
      if (p.status === 'CANCELLED') return send(409, { type: 'PAYMENT_ALREADY_CANCELLED', message: 'already' });
      cancels.push({ paymentId: id, ...JSON.parse(body || '{}') });
      p.status = 'CANCELLED';
      return send(200, { cancellation: { status: 'SUCCEEDED', totalAmount: p.amount.total } });
    }
    send(405, { type: 'METHOD' });
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () =>
      resolve({
        /** 결제 상태 등록 */
        setPayment(id, { status = 'PAID', total, currency = 'KRW', storeId = 'store-test' }) {
          payments.set(id, { id, status, storeId, currency, amount: { total }, orderName: 'test', paidAt: new Date().toISOString() });
        },
        cancels,
        close: () => new Promise((r) => server.close(r)),
      }),
    ),
  );
}

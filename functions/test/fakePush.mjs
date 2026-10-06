/** 테스트용 가짜 Expo 푸시 서버. 'ExponentPushToken[dead...]' 토큰은 DeviceNotRegistered 로 응답한다. */
import http from 'node:http';

export function startFakePush(port) {
  const received = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const msgs = JSON.parse(body || '[]');
    received.push(...msgs);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      data: msgs.map((m) => (m.to.includes('dead')
        ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: 'ticket-' + Math.random().toString(36).slice(2) })),
    }));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ received, close: () => new Promise((r) => server.close(r)) })));
}

// Netlify Function (v2). /api/* 요청을 모두 이 함수 하나가 처리한다.
import { route } from '../lib/handlers.mjs';
import { json } from '../lib/util.mjs';

export default async (req, context) => {
  try {
    return await route(req, context);
  } catch (err) {
    console.error('[blockcraft api]', err);
    return json(500, { ok: false, error: 'server_error' });
  }
};

export const config = { path: '/api/*' };

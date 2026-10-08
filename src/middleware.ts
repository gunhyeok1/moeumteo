import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { sessionCookieName, verifySessionToken } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = context.cookies.get(sessionCookieName())?.value;
    const ok = await verifySessionToken(token, env.SESSION_SECRET);
    if (!ok) {
      return context.redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
    context.locals.isAdmin = true;
  }

  // 관리자 API도 동일하게 보호 (로그인 API는 제외)
  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    const token = context.cookies.get(sessionCookieName())?.value;
    const ok = await verifySessionToken(token, env.SESSION_SECRET);
    if (!ok) {
      return new Response(JSON.stringify({ error: '로그인이 필요합니다.' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  return next();
});

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// 관리자 전용 파일 다운로드. /admin 하위 경로라 middleware.ts의 관리자 인증을 그대로 적용받음.
export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.FILES.get(key);
  if (!object) {
    return new Response('파일을 찾을 수 없어요.', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  const filename = object.customMetadata?.filename || key.split('/').pop() || 'file';
  headers.set('content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

  return new Response(object.body, { headers });
};

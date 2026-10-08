import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSubmissionFile } from '../../../lib/storage';

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  const file = await getSubmissionFile(env.FILES_KV, key);
  if (!file) {
    return new Response('파일을 찾을 수 없어요.', { status: 404 });
  }

  const headers = new Headers();
  headers.set('content-type', file.contentType);
  headers.set('content-disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);

  return new Response(file.body, { headers });
};

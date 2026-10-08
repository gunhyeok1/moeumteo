import type { APIRoute } from 'astro';
import { sessionCookieName } from '../../lib/auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(sessionCookieName(), { path: '/' });
  return redirect('/admin/login');
};

export const POST = GET;

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';

const COOKIE = 'gs_admin';

/** 用密码派生一个签名值放在 cookie 里；密码改了旧 cookie 自动失效 */
function token(): string {
  return createHmac('sha256', 'guitar-stage-admin').update(config.adminPassword).digest('hex');
}

export function checkPassword(input: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(config.adminPassword);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function setAdminCookie(reply: FastifyReply) {
  reply.setCookie(COOKIE, token(), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAdminCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { path: '/' });
}

export function isAdmin(request: FastifyRequest): boolean {
  const v = request.cookies[COOKIE];
  if (!v) return false;
  const expected = token();
  return v.length === expected.length && timingSafeEqual(Buffer.from(v), Buffer.from(expected));
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdmin(request)) {
    reply.code(401).send({ error: '需要管理员登录' });
  }
}

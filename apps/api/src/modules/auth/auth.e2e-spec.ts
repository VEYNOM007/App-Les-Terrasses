import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AuthModule } from './auth.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  extractCookieValue,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests e2e HTTP — AuthModule avec cookies httpOnly.
 *
 * Valide le flow complet du parcours acheteur connecté :
 *   POST /v1/auth/register -> Set-Cookie access_token + refresh_token
 *   POST /v1/auth/login    -> idem + user retourné dans le body
 *   GET  /v1/auth/me       -> lit l'access_token depuis le cookie
 *   POST /v1/auth/refresh  -> rotation (nouveaux cookies)
 *   POST /v1/auth/logout   -> efface les cookies + révoque le refresh
 *
 * Utilise cookieParser() comme dans main.ts (production).
 */

const API_PREFIX = 'v1';

function setCookieHeader(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) return raw.join('; ');
  return typeof raw === 'string' ? raw : '';
}

describe('AuthModule — e2e HTTP cookies httpOnly (supertest)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  it('POST /auth/register -> 201, cookies httpOnly posés + user retourné', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'new@test.tg',
        phone: '+22891000000',
        password: 'Secret123!',
        fullName: 'Nouvel Acheteur',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ user: { email: 'new@test.tg', role: 'ACHETEUR' } });

    const accessToken = extractCookieValue(res, 'access_token');
    const refreshToken = extractCookieValue(res, 'refresh_token');
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    expect(setCookieHeader(res)).toContain('HttpOnly');
  });

  it('POST /auth/register email deja pris -> 409', async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'dup@test.tg',
        phone: '+22891000001',
        password: 'Secret123!',
        fullName: 'Dup',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'dup@test.tg',
        phone: '+22891000002',
        password: 'Secret123!',
        fullName: 'Dup',
      });

    expect(res.status).toBe(409);
  });

  it('POST /auth/login -> cookies + user ; GET /auth/me avec le cookie -> profil', async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'login@test.tg',
        phone: '+22891000003',
        password: 'Secret123!',
        fullName: 'Login User',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'login@test.tg', password: 'Secret123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user).toMatchObject({ email: 'login@test.tg' });

    const accessToken = extractCookieValue(loginRes, 'access_token');
    expect(accessToken).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/auth/me`)
      .set('Cookie', `access_token=${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({ email: 'login@test.tg', role: 'ACHETEUR' });
  });

  it('GET /auth/me sans cookie -> 401', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_PREFIX}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('POST /auth/login password invalide -> 401, pas de cookie', async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'badpass@test.tg',
        phone: '+22891000004',
        password: 'Secret123!',
        fullName: 'Bad Pass',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'badpass@test.tg', password: 'WrongPass1!' });

    expect(res.status).toBe(401);
    expect(extractCookieValue(res, 'access_token')).toBeNull();
  });

  it('POST /auth/logout -> 200, cookies effacés, refresh token révoqué en DB', async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'logout@test.tg',
        phone: '+22891000005',
        password: 'Secret123!',
        fullName: 'Logout User',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'logout@test.tg', password: 'Secret123!' });

    const refreshToken = extractCookieValue(loginRes, 'refresh_token');
    expect(refreshToken).toBeTruthy();

    const logoutRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/logout`)
      .set('Cookie', `refresh_token=${refreshToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ success: true });

    // Cookie effacé (max-age négatif)
    const setCookie = setCookieHeader(logoutRes);
    expect(setCookie).toContain('access_token=');
    expect(setCookie).toContain('refresh_token=');

    // Refresh révoqué en DB
    const revoked = await testPrisma.refreshToken.findMany({ where: { revokedAt: { not: null } } });
    expect(revoked.length).toBeGreaterThan(0);
  });

  it('POST /auth/refresh -> 200, rotation : nouveaux cookies, ancien refresh révoqué', async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'rotate@test.tg',
        phone: '+22891000006',
        password: 'Secret123!',
        fullName: 'Rotate User',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'rotate@test.tg', password: 'Secret123!' });

    const refreshToken = extractCookieValue(loginRes, 'refresh_token');
    expect(refreshToken).toBeTruthy();

    const refreshRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/refresh`)
      .set('Cookie', `refresh_token=${refreshToken}`);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.user).toMatchObject({ email: 'rotate@test.tg' });

    const newRefreshToken = extractCookieValue(refreshRes, 'refresh_token');
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(refreshToken);

    // Ancien refresh révoqué (rotation)
    const stored = await testPrisma.refreshToken.findMany();
    const revokedCount = stored.filter((t) => t.revokedAt !== null).length;
    expect(revokedCount).toBe(1);
  });

  it('POST /auth/forgot-password : reponse identique que le compte existe ou non', async () => {
    const unknownRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/forgot-password`)
      .send({ email: 'personne@test.tg' });

    expect(unknownRes.status).toBe(200);
    expect(unknownRes.body.message).toBeTruthy();
    expect(unknownRes.body.resetToken).toBeNull();

    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'reset@test.tg',
        phone: '+22891000007',
        password: 'Secret123!',
        fullName: 'Reset User',
      })
      .expect(201);

    const knownRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/forgot-password`)
      .send({ email: 'reset@test.tg' });

    expect(knownRes.status).toBe(200);
    expect(knownRes.body.message).toBe(unknownRes.body.message); // même message (anti-énumération)
    expect(knownRes.body.resetToken).toBeTruthy(); // mode démo (NODE_ENV=test)
  });

  it('POST /auth/reset-password : nouveau mot de passe, anciennes sessions révoquées', async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'reset2@test.tg',
        phone: '+22891000008',
        password: 'OldPass123!',
        fullName: 'Reset Two',
      })
      .expect(201);

    // Session "attaquant/légitime" avant le reset : on garde son refresh token
    const loginRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'reset2@test.tg', password: 'OldPass123!' });
    const preResetRefresh = extractCookieValue(loginRes, 'refresh_token');
    expect(preResetRefresh).toBeTruthy();

    // Demande + consommation du token
    const forgotRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/forgot-password`)
      .send({ email: 'reset2@test.tg' });
    const token = forgotRes.body.resetToken;
    expect(token).toBeTruthy();

    const resetRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/reset-password`)
      .send({ token, newPassword: 'NewPass456!' });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body).toEqual({ message: 'Mot de passe mis à jour.' });

    // Ancien mot de passe refusé, nouveau accepté
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'reset2@test.tg', password: 'OldPass123!' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'reset2@test.tg', password: 'NewPass456!' })
      .expect(200);

    // La session d'avant le reset est morte : refresh refusé
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/refresh`)
      .set('Cookie', `refresh_token=${preResetRefresh}`)
      .expect(401);
  });

  it('POST /auth/reset-password : token invalide -> 400, token déjà utilisé -> 400', async () => {
    const invalidRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/reset-password`)
      .send({ token: 'token-faux', newPassword: 'NewPass456!' });
    expect(invalidRes.status).toBe(400);

    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        email: 'reset3@test.tg',
        phone: '+22891000009',
        password: 'Secret123!',
        fullName: 'Reset Three',
      })
      .expect(201);

    const forgotRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/forgot-password`)
      .send({ email: 'reset3@test.tg' });
    const token = forgotRes.body.resetToken;
    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/reset-password`)
      .send({ token, newPassword: 'NewPass456!' })
      .expect(200);

    // Usage unique : second appel avec le même token refusé
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/reset-password`)
      .send({ token, newPassword: 'AutrePass789!' })
      .expect(400);
  });
});

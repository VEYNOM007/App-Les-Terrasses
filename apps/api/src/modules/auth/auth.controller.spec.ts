import { getCookieOptions } from './auth.controller';

/**
 * Tests unitaires — options des cookies de session (auth.controller).
 *
 * Le `domain` n'est posé que si COOKIE_DOMAIN est défini (production
 * multi-sous-domaines : api-baguida.<domaine> -> baguida.<domaine>).
 * Absent en dev local pour rester fonctionnel sur localhost.
 */
describe('getCookieOptions', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCookieDomain = process.env.COOKIE_DOMAIN;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalCookieDomain === undefined) delete process.env.COOKIE_DOMAIN;
    else process.env.COOKIE_DOMAIN = originalCookieDomain;
  });

  it('ne pose pas domain quand COOKIE_DOMAIN est absent (dev local)', () => {
    delete process.env.COOKIE_DOMAIN;
    process.env.NODE_ENV = 'development';
    const opts = getCookieOptions();
    expect(opts).not.toHaveProperty('domain');
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.secure).toBe(false);
    expect(opts.path).toBe('/');
  });

  it('pose domain quand COOKIE_DOMAIN est défini (prod multi-sous-domaines)', () => {
    process.env.COOKIE_DOMAIN = '.agir.tg';
    process.env.NODE_ENV = 'production';
    const opts = getCookieOptions();
    expect(opts.domain).toBe('.agir.tg');
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.secure).toBe(true);
    expect(opts.path).toBe('/');
  });

  it('ne pose Secure qu en production', () => {
    process.env.COOKIE_DOMAIN = '.agir.tg';
    process.env.NODE_ENV = 'development';
    expect(getCookieOptions().secure).toBe(false);
    process.env.NODE_ENV = 'production';
    expect(getCookieOptions().secure).toBe(true);
  });
});

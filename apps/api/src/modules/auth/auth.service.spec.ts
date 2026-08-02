import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Tests unitaires — AuthService (refresh tokens durcis)
 *
 * Couvre les scenarios critiques (R6 CLAUDE.md) :
 *   Auth de base :
 *    1. register email deja utilise -> ConflictException
 *    2. register phone deja utilise -> ConflictException
 *    3. register succes : bcrypt.hash(salt 10), user cree, refresh token persiste en DB
 *    4. register : country par defaut 'TG'
 *    5. login user introuvable -> UnauthorizedException
 *    6. login password invalide -> UnauthorizedException
 *    7. login succes : bcrypt.compare appele, refresh token persiste
 *
 *   Rotation + révocation (cœur du hardening) :
 *    8. refresh token invalide (JWT) -> UnauthorizedException
 *    9. refresh token valide mais inconnu en DB -> UnauthorizedException
 *   10. refresh token expiré en DB -> UnauthorizedException
 *   11. refresh token déjà révoqué -> UnauthorizedException + revokeAllUserTokens appelé
 *   12. refresh token valide -> ancien révoqué + nouvelle paire émise + chaînage previousTokenHash
 *
 *   Logout :
 *   13. logout révoque uniquement le token présenté (updateMany revokedAt)
 *   14. logoutAll révoque tous les tokens actifs du user
 *
 *   Token storage :
 *   15. le tokenHash persisté est SHA-256 du token en clair (jamais le clair)
 *   16. access token signé expiresIn 15m, refresh token expiresIn 30d
 */

const USER_FIXTURE = {
  id: 'user-001',
  email: 'kofi@test.tg',
  phone: '+22890000000',
  passwordHash: '$2b$10$hashedpasswordmock',
  fullName: 'Kofi Mensah',
  role: 'ACHETEUR',
  country: 'TG',
};

const USER_RESULT = {
  id: 'user-001',
  role: 'ACHETEUR',
  email: 'kofi@test.tg',
  fullName: 'Kofi Mensah',
  phone: '+22890000000',
  country: 'TG',
};

const createMockPrisma = () => ({
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

const createMockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

const REFRESH_TOKEN_VALUE = 'real-refresh-jwt-value';
const REFRESH_TOKEN_HASH = crypto.createHash('sha256').update(REFRESH_TOKEN_VALUE).digest('hex');

/**
 * @types/bcrypt déclare des overloads (variante callback en dernier) :
 * jest.spyOn infère la signature callback (retour void) et mockResolvedValue
 * attend `never`. On réaffirme la variante Promise via `as unknown as`
 * (double assertion sans `any` — le spy reste entièrement typé ensuite).
 */
type BcryptHashFn = (data: string | Buffer, saltOrRounds: string | number) => Promise<string>;
type BcryptCompareFn = (data: string | Buffer, encrypted: string) => Promise<boolean>;
type HashSpy = jest.SpyInstance<ReturnType<BcryptHashFn>, Parameters<BcryptHashFn>>;
type CompareSpy = jest.SpyInstance<ReturnType<BcryptCompareFn>, Parameters<BcryptCompareFn>>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwtService>;
  let hashSpy: HashSpy;
  let compareSpy: CompareSpy;

  beforeAll(() => {
    // jest.setup.ts définit déjà ces valeurs. On les réaffirme ici pour
    // lisibilité (les tests ci-dessous y font référence directe).
    process.env.JWT_SECRET = 'e2e-test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-test-jwt-refresh-secret';
  });

  beforeEach(async () => {
    prisma = createMockPrisma();
    jwt = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    hashSpy = jest.spyOn(bcrypt, 'hash') as unknown as HashSpy;
    hashSpy.mockResolvedValue('$2b$10$hashedpasswordmock');
    compareSpy = jest.spyOn(bcrypt, 'compare') as unknown as CompareSpy;
    compareSpy.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────
  // register
  // ──────────────────────────────────────────────────

  describe('register', () => {
    it('devrait lever ConflictException si email deja utilise', async () => {
      prisma.user.findFirst.mockResolvedValue(USER_FIXTURE);

      await expect(
        service.register({
          email: 'kofi@test.tg',
          phone: '+22899999999',
          password: 'Secret123!',
          fullName: 'Kofi',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('devrait lever ConflictException si phone deja utilise', async () => {
      prisma.user.findFirst.mockResolvedValue(USER_FIXTURE);

      await expect(
        service.register({
          email: 'autre@test.tg',
          phone: '+22890000000',
          password: 'Secret123!',
          fullName: 'Kofi',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('devrait hasher le password (bcrypt salt 10), creer user et persister un refresh token', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(USER_FIXTURE);
      jwt.sign.mockReturnValueOnce('access-mock').mockReturnValueOnce(REFRESH_TOKEN_VALUE);

      const result = await service.register({
        email: 'new@test.tg',
        phone: '+22891111111',
        password: 'Secret123!',
        fullName: 'New User',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('Secret123!', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@test.tg',
          phone: '+22891111111',
          passwordHash: '$2b$10$hashedpasswordmock',
          fullName: 'New User',
          country: 'TG',
        },
      });
      // Refresh token persiste en DB avec tokenHash SHA-256 (pas le clair)
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-001',
          tokenHash: REFRESH_TOKEN_HASH,
          previousTokenHash: null,
        }),
      });
      expect(result).toEqual({
        accessToken: 'access-mock',
        refreshToken: REFRESH_TOKEN_VALUE,
        user: USER_RESULT,
      });
    });

    it('devrait utiliser le country fourni plutot que TG par defaut', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...USER_FIXTURE, country: 'FR' });
      jwt.sign.mockReturnValue('tok');

      await service.register({
        email: 'diaspora@test.fr',
        phone: '+33612345678',
        password: 'Secret123!',
        fullName: 'Diaspora',
        country: 'FR',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ country: 'FR' }),
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────
  // login
  // ──────────────────────────────────────────────────

  describe('login', () => {
    it('devrait lever UnauthorizedException si user introuvable', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('unknown@test.tg', 'Secret123!')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('devrait lever UnauthorizedException si password invalide', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      compareSpy.mockResolvedValueOnce(false);

      await expect(service.login('kofi@test.tg', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', USER_FIXTURE.passwordHash);
    });

    it('devrait emettre et persister les tokens si credentials valides', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      jwt.sign.mockReturnValueOnce('access-mock').mockReturnValueOnce(REFRESH_TOKEN_VALUE);

      const result = await service.login('kofi@test.tg', 'Secret123!');

      expect(bcrypt.compare).toHaveBeenCalledWith('Secret123!', USER_FIXTURE.passwordHash);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-001',
          tokenHash: REFRESH_TOKEN_HASH,
        }),
      });
      expect(result).toEqual({
        accessToken: 'access-mock',
        refreshToken: REFRESH_TOKEN_VALUE,
        user: USER_RESULT,
      });
    });
  });

  // ──────────────────────────────────────────────────
  // refresh (rotation + révocation)
  // ──────────────────────────────────────────────────

  describe('refresh', () => {
    const validPayload = { sub: 'user-001', role: 'ACHETEUR' };
    const activeStoredToken = {
      id: 'rt-001',
      userId: 'user-001',
      tokenHash: REFRESH_TOKEN_HASH,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // demain
      revokedAt: null,
      previousTokenHash: null,
    };

    it('devrait lever UnauthorizedException si le refresh token JWT est invalide', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.refresh('invalid')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('devrait lever UnauthorizedException si le token est inconnu en DB', async () => {
      jwt.verify.mockReturnValue(validPayload);
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(REFRESH_TOKEN_VALUE)).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever UnauthorizedException si le token est expire', async () => {
      jwt.verify.mockReturnValue(validPayload);
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...activeStoredToken,
        expiresAt: new Date(Date.now() - 1000), // deja passe
      });

      await expect(service.refresh(REFRESH_TOKEN_VALUE)).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever UnauthorizedException ET revoke toute la chaine si token deja revoque (reuse detection)', async () => {
      jwt.verify.mockReturnValue(validPayload);
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...activeStoredToken,
        revokedAt: new Date(), // deja revoque
      });

      await expect(service.refresh(REFRESH_TOKEN_VALUE)).rejects.toThrow(UnauthorizedException);

      // revokeAllUserTokens appelé via updateMany
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-001', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
    });

    it('devrait rotater un token valide : revoquer ancien, creer nouveau chaine, retourner nouvelle paire', async () => {
      jwt.verify.mockReturnValue(validPayload);
      prisma.refreshToken.findUnique.mockResolvedValue(activeStoredToken);
      prisma.user.findUniqueOrThrow.mockResolvedValue(USER_FIXTURE);
      jwt.sign.mockReturnValueOnce('access-new').mockReturnValueOnce('refresh-new');

      const newRefreshHash = crypto.createHash('sha256').update('refresh-new').digest('hex');

      const result = await service.refresh(REFRESH_TOKEN_VALUE);

      // 1. ancien token révoqué
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-001' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });

      // 2. nouveau token créé, chaîné au précédent via previousTokenHash
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-001',
          tokenHash: newRefreshHash,
          previousTokenHash: REFRESH_TOKEN_HASH,
        }),
      });

      expect(result).toEqual({
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        user: USER_RESULT,
      });
    });
  });

  // ──────────────────────────────────────────────────
  // logout
  // ──────────────────────────────────────────────────

  describe('logout', () => {
    it('devrait revoquer uniquement le token presente (updateMany where tokenHash)', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout(REFRESH_TOKEN_VALUE);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: REFRESH_TOKEN_HASH, revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
    });
  });

  describe('logoutAll', () => {
    it('devrait revoquer tous les tokens actifs du user', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.logoutAll('user-001');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-001', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
    });
  });

  // ──────────────────────────────────────────────────
  // issueTokens (options de signature)
  // ──────────────────────────────────────────────────

  describe('issueTokens (options de signature)', () => {
    it('devrait signer access 15m et refresh 30d + JWT_REFRESH_SECRET + jti unique', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      jwt.sign.mockReturnValue('tok');

      await service.login('kofi@test.tg', 'Secret123!');

      expect(jwt.sign).toHaveBeenNthCalledWith(
        1,
        { sub: 'user-001', role: 'ACHETEUR' },
        { expiresIn: '15m' },
      );
      // jti (UUID) : garantit l'unicité du refresh token même émis dans
      // la même seconde (payload { sub, role } seul -> hash identique ->
      // violation de contrainte unique en DB).
      expect(jwt.sign).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ sub: 'user-001', role: 'ACHETEUR', jti: expect.any(String) }),
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '30d' },
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Tests unitaires — AuthService
 *
 * Scenarios critiques couverts (Regle R6 CLAUDE.md) :
 *  1. register — email deja utilise -> ConflictException
 *  2. register — phone deja utilise -> ConflictException
 *  3. register — succes : bcrypt.hash appele avec salt 10, user cree, tokens emis
 *  4. register — country par defaut 'TG' si non fourni
 *  5. login — user introuvable -> UnauthorizedException
 *  6. login — password invalide -> UnauthorizedException
 *  7. login — succes : bcrypt.compare appele, tokens emis
 *  8. refresh — token invalide -> UnauthorizedException (verify throw)
 *  9. refresh — token valide : nouveaux tokens emis avec sub + role
 * 10. issueTokens — access token signe avec expiresIn '15m' et secret JWT_SECRET
 * 11. issueTokens — refresh token signe avec expiresIn '30d' et secret JWT_REFRESH_SECRET
 */

// ────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────

const USER_FIXTURE = {
  id: 'user-001',
  email: 'kofi@test.tg',
  phone: '+22890000000',
  passwordHash: '$2b$10$hashedpasswordmock',
  fullName: 'Kofi Mensah',
  role: 'ACHETEUR',
  country: 'TG',
};

const createMockPrisma = () => ({
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
});

const createMockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

// ────────────────────────────────────────────────────────────
// Suite de tests
// ────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwtService>;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-different';
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

    jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$10$hashedpasswordmock');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
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

    it('devrait hasher le mot de passe avec bcrypt (salt 10), creer le user et emettre les tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(USER_FIXTURE);
      jwt.sign.mockReturnValueOnce('access-mock').mockReturnValueOnce('refresh-mock');

      const result = await service.register({
        email: 'new@test.tg',
        phone: '+22891111111',
        password: 'Secret123!',
        fullName: 'New User',
      });

      // bcrypt.hash appele avec salt rounds = 10
      expect(bcrypt.hash).toHaveBeenCalledWith('Secret123!', 10);

      // user.create appele avec le hash et country par defaut 'TG'
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@test.tg',
          phone: '+22891111111',
          passwordHash: '$2b$10$hashedpasswordmock',
          fullName: 'New User',
          country: 'TG',
        },
      });

      // tokens emis
      expect(result).toEqual({
        accessToken: 'access-mock',
        refreshToken: 'refresh-mock',
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
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);

      await expect(service.login('kofi@test.tg', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', USER_FIXTURE.passwordHash);
    });

    it('devrait emettre les tokens si credentials valides', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      jwt.sign.mockReturnValueOnce('access-mock').mockReturnValueOnce('refresh-mock');

      const result = await service.login('kofi@test.tg', 'Secret123!');

      expect(bcrypt.compare).toHaveBeenCalledWith('Secret123!', USER_FIXTURE.passwordHash);
      expect(result).toEqual({
        accessToken: 'access-mock',
        refreshToken: 'refresh-mock',
      });
    });
  });

  // ──────────────────────────────────────────────────
  // refresh
  // ──────────────────────────────────────────────────

  describe('refresh', () => {
    it('devrait lever une erreur si le refresh token est invalide', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.refresh('invalid-token')).rejects.toThrow('jwt malformed');
    });

    it('devrait emettre de nouveaux tokens si le refresh token est valide', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-001', role: 'ACHETEUR' });
      jwt.sign.mockReturnValueOnce('access-new').mockReturnValueOnce('refresh-new');

      const result = await service.refresh('valid-refresh-token');

      expect(jwt.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'test-jwt-refresh-secret-different',
      });
      expect(result).toEqual({
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
      });
    });
  });

  // ──────────────────────────────────────────────────
  // issueTokens (verifie via register/login/refresh)
  // ──────────────────────────────────────────────────

  describe('issueTokens (options de signature)', () => {
    it('devrait signer l\'access token avec expiresIn 15m et le refresh avec 30d + JWT_REFRESH_SECRET', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      jwt.sign.mockReturnValue('tok');

      await service.login('kofi@test.tg', 'Secret123!');

      // 1er appel sign() = access token
      expect(jwt.sign).toHaveBeenNthCalledWith(
        1,
        { sub: 'user-001', role: 'ACHETEUR' },
        { expiresIn: '15m' },
      );
      // 2e appel sign() = refresh token
      expect(jwt.sign).toHaveBeenNthCalledWith(
        2,
        { sub: 'user-001', role: 'ACHETEUR' },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '30d',
        },
      );
    });
  });
});

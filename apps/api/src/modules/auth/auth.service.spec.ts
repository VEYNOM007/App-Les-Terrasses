import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, Logger, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { StorageService } from '../../common/storage/storage.service';
import { KycDocumentType } from './dto/kyc-upload.dto';

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

const createMockPrisma = () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    document: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Le callback de transaction reçoit le mock lui-même comme `tx`.
  prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );

  return prisma;
};

const createMockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

const createMockEmailService = () => ({
  sendPasswordResetEmail: jest.fn(),
});

const createMockStorageService = () => ({
  putObject: jest.fn(),
  getObject: jest.fn(),
  getSignedUrl: jest.fn(),
  deleteObject: jest.fn(),
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
  let email: ReturnType<typeof createMockEmailService>;
  let storage: ReturnType<typeof createMockStorageService>;
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
    email = createMockEmailService();
    storage = createMockStorageService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: EmailService, useValue: email },
        { provide: StorageService, useValue: storage },
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
          address: null,
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
  // changePassword
  // ──────────────────────────────────────────────────

  describe('changePassword', () => {
    it('devrait lever UnauthorizedException si le mot de passe actuel est invalide', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(USER_FIXTURE);
      compareSpy.mockResolvedValueOnce(false);

      await expect(service.changePassword('user-001', 'wrong', 'NewPass123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('devrait hasher et mettre à jour le mot de passe si l\'actuel est valide', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(USER_FIXTURE);
      compareSpy.mockResolvedValueOnce(true);
      hashSpy.mockResolvedValueOnce('$2b$10$newhash');
      prisma.$transaction.mockImplementation(async (fn: Function) => fn(prisma));

      await service.changePassword('user-001', 'Secret123!', 'NewPass123!');

      expect(hashSpy).toHaveBeenCalledWith('NewPass123!', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { passwordHash: '$2b$10$newhash' },
      });
    });

    it('devrait révoquer tous les refresh tokens actifs du user', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(USER_FIXTURE);
      compareSpy.mockResolvedValueOnce(true);
      hashSpy.mockResolvedValueOnce('$2b$10$newhash');
      prisma.$transaction.mockImplementation(async (fn: Function) => fn(prisma));

      await service.changePassword('user-001', 'Secret123!', 'NewPass123!');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-001', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
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

  // ──────────────────────────────────────────────────
  // uploadKyc — pièce d'identité (AuthModule, R6)
  // ──────────────────────────────────────────────────

  describe('uploadKyc', () => {
    it("devrait refuser un lot sans face recto (BadRequest)", async () => {
      await expect(service.uploadKyc('user-001', KycDocumentType.PASSEPORT, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(storage.putObject).not.toHaveBeenCalled();
      expect(prisma.document.createMany).not.toHaveBeenCalled();
    });

    it("devrait exiger le verso pour une CNI (lot incomplet -> BadRequest)", async () => {
      await expect(
        service.uploadKyc('user-001', KycDocumentType.CNI, {
          recto: [{ buffer: Buffer.from('recto'), mimetype: 'image/png' } as Express.Multer.File],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.putObject).not.toHaveBeenCalled();
      expect(prisma.document.createMany).not.toHaveBeenCalled();
    });

    it('devrait déposer recto+verso sur B2 et référencer les 2 faces du même kycBatchId en base', async () => {
      storage.putObject.mockResolvedValue(undefined);
      prisma.document.createMany.mockResolvedValue({ count: 2 });
      prisma.user.update.mockResolvedValue({ id: 'user-001', kycStatus: 'EN_ATTENTE' });

      const recto = Buffer.from('fake-recto');
      const verso = Buffer.from('fake-verso');
      const result = await service.uploadKyc('user-001', KycDocumentType.CNI, {
        recto: [{ buffer: recto, mimetype: 'image/png' } as Express.Multer.File],
        verso: [{ buffer: verso, mimetype: 'image/png' } as Express.Multer.File],
      });

      // Upload B2 : 2 objets, clé interne `kyc/<uuid>.png`, ContentType serveur
      expect(storage.putObject).toHaveBeenCalledTimes(2);
      const keys = storage.putObject.mock.calls.map((c: string[]) => c[0]);
      expect(keys[0]).toMatch(/^kyc\/[0-9a-f-]+\.png$/);
      expect(keys[1]).toMatch(/^kyc\/[0-9a-f-]+\.png$/);
      expect(storage.putObject.mock.calls[0][1]).toBe(recto);
      expect(storage.putObject.mock.calls[1][1]).toBe(verso);
      expect(storage.putObject.mock.calls[0][2]).toBe('image/png');

      // La base référence les clés internes B2 (jamais un chemin disque,
      // jamais le nom client brut) et un NOM GÉNÉRÉ CÔTÉ SERVEUR, sans PII,
      // avec les faces reliées par le même kycBatchId.
      const createManyCall = prisma.document.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(2);
      const [rectoData, versoData] = createManyCall.data;
      expect(rectoData.fileUrl).toBe(keys[0]);
      expect(rectoData.side).toBe('RECTO');
      expect(versoData.fileUrl).toBe(keys[1]);
      expect(versoData.side).toBe('VERSO');
      expect(rectoData.kycBatchId).toBe(versoData.kycBatchId);
      expect(rectoData.kycBatchId).toMatch(/[0-9a-f-]{36}/);
      expect(rectoData.kycOwnerId).toBe('user-001');
      expect(rectoData.type).toBe('PIECE_IDENTITE');
      expect(rectoData.name).toMatch(/^Pièce d'identité — \d{2}\/\d{2}\/\d{4}$/);
      expect(rectoData.name).not.toContain('passeport');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { kycStatus: 'EN_ATTENTE' },
        select: { id: true, kycStatus: true },
      });

      expect(result).toEqual({ id: 'user-001', kycStatus: 'EN_ATTENTE' });
    });

    it("devrait déposer une seule face (recto) pour un passeport (verso non requis)", async () => {
      storage.putObject.mockResolvedValue(undefined);
      prisma.document.createMany.mockResolvedValue({ count: 1 });
      prisma.user.update.mockResolvedValue({ id: 'user-001', kycStatus: 'EN_ATTENTE' });

      await service.uploadKyc('user-001', KycDocumentType.PASSEPORT, {
        recto: [{ buffer: Buffer.from('recto'), mimetype: 'application/pdf' } as Express.Multer.File],
      });

      expect(storage.putObject).toHaveBeenCalledTimes(1);
      const [key] = storage.putObject.mock.calls[0];
      expect(key).toMatch(/^kyc\/[0-9a-f-]+\.pdf$/);
      expect(storage.putObject.mock.calls[0][2]).toBe('application/pdf');

      const createManyCall = prisma.document.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(1);
      expect(createManyCall.data[0].side).toBe('RECTO');
    });
  });

  // ──────────────────────────────────────────────────
  // forgotPassword — réinitialisation (AuthModule, R6)
  // ──────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it("devrait renvoyer une reponse identique (anti-enumeration) si l'email n'existe pas", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('inconnu@test.tg');

      expect(result).toEqual({
        message:
          'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.',
        resetToken: null,
      });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('devrait creer un token a usage unique (1h) persiste uniquement en hash, et le retourner en mode demo', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);

      const result = await service.forgotPassword('kofi@test.tg');

      const createCall = prisma.passwordResetToken.create.mock.calls[0][0].data;
      expect(createCall).toEqual({
        userId: 'user-001',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      });
      // Fenêtre d'expiration ~1h
      const ttlMs = createCall.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(50 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000);

      // Le hash persisté est le SHA-256 du token en clair, jamais le clair
      expect(result.resetToken).toBeTruthy();
      if (result.resetToken === null) {
        throw new Error('resetToken attendu en mode demo');
      }
      expect(result.resetToken).not.toBe(createCall.tokenHash);
      expect(crypto.createHash('sha256').update(result.resetToken).digest('hex')).toBe(
        createCall.tokenHash,
      );
    });

    it("en production, ne devrait pas exposer le token mais l'envoyer par email", async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      email.sendPasswordResetEmail.mockResolvedValue({ delivered: true, mode: 'smtp' });
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);

      try {
        const result = await service.forgotPassword('kofi@test.tg');

        expect(result.resetToken).toBeNull();
        expect(prisma.passwordResetToken.create).toHaveBeenCalled();

        const createCall = prisma.passwordResetToken.create.mock.calls[0][0].data;
        expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        const [to, token] = email.sendPasswordResetEmail.mock.calls[0];
        expect(to).toBe('kofi@test.tg');
        // Le token transmis par email est le clair dont seul le hash est persisté
        expect(crypto.createHash('sha256').update(token).digest('hex')).toBe(createCall.tokenHash);
      } finally {
        process.env.NODE_ENV = previous;
      }
    });

    it('en production sans SMTP, ne devrait ni exposer le token ni faire planter la requete', async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      email.sendPasswordResetEmail.mockResolvedValue({ delivered: false, mode: 'demo' });
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      try {
        const result = await service.forgotPassword('kofi@test.tg');

        expect(result).toEqual({
          message:
            'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.',
          resetToken: null,
        });
        expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = previous;
        errorSpy.mockRestore();
      }
    });

    it('en production si le SMTP echoue, conserve la reponse anti-enumeration', async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      email.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP indisponible'));
      prisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      try {
        const result = await service.forgotPassword('kofi@test.tg');

        expect(result).toEqual({
          message:
            'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.',
          resetToken: null,
        });
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = previous;
        errorSpy.mockRestore();
      }
    });
  });

  // ──────────────────────────────────────────────────
  // resetPassword — consommation du token (AuthModule, R6)
  // ──────────────────────────────────────────────────

  describe('resetPassword', () => {
    const activeResetToken = {
      id: 'prt-001',
      userId: 'user-001',
      tokenHash: 'some-sha256-hash',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // valide 1h
      usedAt: null,
    };

    it('devrait lever BadRequestException si le token est inconnu', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('token-inconnu', 'NouveauPass1!')).rejects.toThrow(
        BadRequestException,
      );

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('devrait lever BadRequestException si le token est expire', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...activeResetToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword('token-expire', 'NouveauPass1!')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('devrait lever BadRequestException si le token est deja utilise (usage unique)', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...activeResetToken,
        usedAt: new Date(),
      });

      await expect(service.resetPassword('token-consomme', 'NouveauPass1!')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('devrait consommer le token, mettre a jour le hash et revoquer toutes les sessions', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(activeResetToken);

      const result = await service.resetPassword('token-valide', 'NouveauPass1!');

      expect(bcrypt.hash).toHaveBeenCalledWith('NouveauPass1!', 10);
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'prt-001' },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { passwordHash: '$2b$10$hashedpasswordmock' },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-001', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
      expect(result).toEqual({ message: 'Mot de passe mis à jour.' });
    });
  });
});

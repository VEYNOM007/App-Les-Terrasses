import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Tests unitaires — JwtStrategy
 *
 * Couvre le contrat documente dans jwt.strategy.ts :
 *  - req.user expose { id, role, email, artisanId } a chaque requete
 *  - artisanId est resolu depuis la DB (pas depuis le JWT) pour rester
 *    coherent si le profil Artisan change sans reemission de token
 *  - artisanId = null si l'utilisateur n'est pas un artisan
 *
 * Regle R6 CLAUDE.md : securite auth — tester la resolution du profil.
 */

const createMockPrisma = () => ({
  user: {
    findUniqueOrThrow: jest.fn(),
  },
});

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('devrait retourner { id, role, email, artisanId: null } pour un ACHETEUR sans profil artisan', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-001',
      role: 'ACHETEUR',
      email: 'kofi@test.tg',
      artisanProfile: null,
    });

    const result = await strategy.validate({ sub: 'user-001', role: 'ACHETEUR' });

    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'user-001' },
      include: { artisanProfile: true },
    });
    expect(result).toEqual({
      id: 'user-001',
      role: 'ACHETEUR',
      email: 'kofi@test.tg',
      artisanId: null,
    });
  });

  it('devrait retourner artisanId peuple si le user a un profil Artisan', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-art',
      role: 'ARTISAN',
      email: 'amouzou@btp.tg',
      artisanProfile: { id: 'artisan-42', trade: 'MACONNERIE' },
    });

    const result = await strategy.validate({ sub: 'user-art', role: 'ARTISAN' });

    expect(result).toEqual({
      id: 'user-art',
      role: 'ARTISAN',
      email: 'amouzou@btp.tg',
      artisanId: 'artisan-42',
    });
  });

  it('devrait propager l\'erreur si le user n\'existe plus en base (token valide mais user supprime)', async () => {
    prisma.user.findUniqueOrThrow.mockRejectedValue(new Error('Record not found'));

    await expect(
      strategy.validate({ sub: 'deleted-user', role: 'ACHETEUR' }),
    ).rejects.toThrow('Record not found');
  });
});

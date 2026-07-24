import { PrismaClient, UserRole, UnitStatus, UnitType, LaunchStatus, ConstructionPhase, Frontage } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Helper pour tests d'integration : pointe sur DATABASE_URL_TEST et
 * fournit des fixtures + un cleanup TRUNCATE pour isoler chaque test.
 *
 * IMPORTANT : ne jamais utiliser en prod. Le cleanup TRUNCATE détruit
 * toutes les données des tables listées.
 *
 * Pour ajouter une nouvelle fixture, créer une méthode ici plutôt que
 * d'inliner le Prisma create dans chaque test — ça centralise les
 * defaults et facilite les refactors de schema.
 */

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://postgres:postgres@localhost:5432/residence_catalog_test?schema=public';

/**
 * Client Prisma dédié aux tests. Singleton : réutilisé par tous les
 * specs qui importent ce helper pour éviter d'ouvrir 50 connexions.
 */
let testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  }
  return testPrisma;
}

/**
 * TRUNCATE toutes les tables metier. Préserve la structure et les enums.
 * Appelé typiquement dans afterEach de chaque suite d'integration.
 *
 * Ordre peu important car on CASCADE, mais on explicit les noms pour
 * être sûr de ne pas oublier une table si une nouvelle est ajoutée.
 */
export async function cleanupTestDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  // TRUNCATE avec CASCADE pour bypasser les FK. RESTART IDENTITY reset
  // les sequences auto-increment.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "refresh_tokens",
      "payment_installments",
      "payment_schedules",
      "reservations",
      "construction_updates",
      "documents",
      "notifications",
      "notification_preferences",
      "quotes",
      "artisan_assignments",
      "artisans",
      "parking_spots",
      "units",
      "blocks",
      "projects",
      "users"
    RESTART IDENTITY CASCADE;
  `);
}

/**
 * Déconnecte le singleton (à appeler dans afterAll global si besoin).
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}

// ────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────

export interface UserFixtureInput {
  email?: string;
  phone?: string;
  password?: string;
  fullName?: string;
  role?: UserRole;
  country?: string;
}

/**
 * Crée un user avec password hashé (bcrypt). Override via input.
 */
export async function createUserFixture(input: UserFixtureInput = {}) {
  const prisma = getTestPrisma();
  const passwordHash = await bcrypt.hash(input.password ?? 'Secret123!', 10);
  return prisma.user.create({
    data: {
      email: input.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.tg`,
      phone: input.phone ?? `+228${Math.floor(10000000 + Math.random() * 89999999)}`,
      passwordHash,
      fullName: input.fullName ?? 'Test User',
      role: input.role ?? UserRole.ACHETEUR,
      country: input.country ?? 'TG',
    },
  });
}

/**
 * Crée un projet minimal avec un bloc et N unités DISPONIBLES.
 */
export async function createProjectWithBlockAndUnits(
  unitCount = 1,
  opts: { blockLaunchStatus?: LaunchStatus; unitType?: UnitType } = {},
): Promise<{ project: any; block: any; units: any[] }> {
  const prisma = getTestPrisma();
  const project = await prisma.project.create({
    data: {
      name: `Projet Test ${Date.now()}`,
      description: 'Projet de test',
      location: 'Baguida',
      status: 'PUBLIE',
    },
  });

  const block = await prisma.block.create({
    data: {
      projectId: project.id,
      name: `Bloc Test ${Date.now()}`,
      floors: 4,
      frontage: Frontage.FACADE_PRINCIPALE,
      launchStatus: opts.blockLaunchStatus ?? LaunchStatus.EN_COMMERCIALISATION,
      constructionPhase: ConstructionPhase.FONDATIONS,
    },
  });

  const units = [];
  for (let i = 0; i < unitCount; i++) {
    const unit = await prisma.unit.create({
      data: {
        blockId: block.id,
        type: opts.unitType ?? UnitType.T2,
        surface: 45,
        price: 24_000_000,
        currency: 'XOF',
        floor: 0,
        status: UnitStatus.DISPONIBLE,
        photos: [],
      },
    });
    units.push(unit);
  }

  return { project, block, units };
}

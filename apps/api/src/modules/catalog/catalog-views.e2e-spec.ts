import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CatalogModule } from './catalog.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrisma,
  createProjectWithBlockAndUnits,
} from '../../common/testing/test-db.helper';

const API_PREFIX = 'v1';

/**
 * Tests e2e — Catalog views & champ restriction.
 *
 * Vérifie que les vues par bloc sont exposées dans les réponses catalog
 * et que les 3 champs financiers internes (fundingThresholdPercent,
 * thresholdReachedAt, financingSecuredAt) n'apparaissent pas dans le JSON.
 */
describe('Catalog views & field restriction (e2e)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();

  let project: { id: string };
  let block: { id: string };
  let unit: { id: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, CatalogModule],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();

    const fixtures = await createProjectWithBlockAndUnits(1);
    project = fixtures.project;
    block = fixtures.block;
    unit = fixtures.units[0];
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await app.close();
    await disconnectTestPrisma();
  });

  const RESTRICTED_FIELDS = [
    'fundingThresholdPercent',
    'thresholdReachedAt',
    'financingSecuredAt',
  ] as const;

  describe('GET /v1/catalog/projects', () => {
    let blocks: Record<string, unknown>[];

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/catalog/projects`)
        .expect(200);

      const projects = res.body as Array<{ blocks: Record<string, unknown>[] }>;
      blocks = projects[0]?.blocks ?? [];
    });

    it('chaque bloc contient views (tableau ou null)', () => {
      for (const block of blocks) {
        expect(block).toHaveProperty('views');
        const views = block.views;
        expect(
          Array.isArray(views) || views === null,
        ).toBe(true);
      }
    });

    for (const field of RESTRICTED_FIELDS) {
      it(`chaque bloc ne contient PAS ${field}`, () => {
        for (const b of blocks) {
          expect(b).not.toHaveProperty(field);
        }
      });
    }
  });

  describe('GET /v1/catalog/projects/:id/blocks', () => {
    let blocks: Record<string, unknown>[];

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/catalog/projects/${project.id}/blocks`)
        .expect(200);

      blocks = res.body as Record<string, unknown>[];
    });

    it('chaque bloc contient views (tableau ou null)', () => {
      for (const b of blocks) {
        expect(b).toHaveProperty('views');
        const views = b.views;
        expect(
          Array.isArray(views) || views === null,
        ).toBe(true);
      }
    });

    for (const field of RESTRICTED_FIELDS) {
      it(`chaque bloc ne contient PAS ${field}`, () => {
        for (const b of blocks) {
          expect(b).not.toHaveProperty(field);
        }
      });
    }
  });

  describe('GET /v1/catalog/units/:id', () => {
    let body: Record<string, unknown>;
    let blockObj: Record<string, unknown>;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/catalog/units/${unit.id}`)
        .expect(200);

      body = res.body as Record<string, unknown>;
      blockObj = body.block as Record<string, unknown>;
    });

    it('la réponse contient un objet block', () => {
      expect(body).toHaveProperty('block');
      expect(typeof blockObj).toBe('object');
      expect(blockObj).not.toBeNull();
    });

    for (const field of RESTRICTED_FIELDS) {
      it(`block ne contient PAS ${field}`, () => {
        expect(blockObj).not.toHaveProperty(field);
      });
    }
  });
});

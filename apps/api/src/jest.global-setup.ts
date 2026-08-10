import { execFileSync } from 'child_process';
import * as path from 'path';

/**
 * Exécuté par Jest une seule fois, AVANT toutes les suites de tests.
 *
 * Garantit que la base de test (DATABASE_URL_TEST) existe et est à jour
 * avec les migrations Prisma, sans aucune étape manuelle :
 *   1. crée la base si elle n'existe pas (idempotent, P1009 = existe déjà),
 *   2. applique les migrations en attente (prisma migrate deploy).
 *
 * C'est la seule source de vérité pour la synchronisation du schéma de
 * test : ni docker-compose, ni la CI ne doivent créer/migrer residence_catalog_test
 * à la main — ce fichier le fait à chaque invocation de Jest.
 */

const DEFAULT_TEST_URL =
  'postgresql://postgres:postgres@localhost:5432/residence_catalog_test?schema=public';

const SCHEMA_PATH = path.resolve(__dirname, '../../../packages/database/prisma/schema.prisma');

function buildChildEnv(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...overrides };
}

function maintenanceUrl(testUrl: string): string {
  const url = new URL(testUrl);
  url.pathname = '/postgres';
  return url.toString();
}

function testDatabaseName(testUrl: string): string {
  return new URL(testUrl).pathname.split('/').filter(Boolean)[0];
}

function prismaCli(): string {
  return require.resolve('prisma');
}

module.exports = async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL_TEST = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL;
  const testUrl = process.env.DATABASE_URL_TEST;
  process.env.DATABASE_URL = testUrl;

  const createScript = `CREATE DATABASE "${testDatabaseName(testUrl)}";`;
  try {
    execFileSync(
      process.execPath,
      [prismaCli(), 'db', 'execute', '--url', maintenanceUrl(testUrl), '--stdin'],
      { input: createScript, env: buildChildEnv({}), stdio: 'pipe' },
    );
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('P1009')) {
      throw error;
    }
  }

  execFileSync(
    process.execPath,
    [prismaCli(), 'migrate', 'deploy', '--schema', SCHEMA_PATH],
    { env: buildChildEnv({ DATABASE_URL: testUrl }), stdio: 'inherit' },
  );
};

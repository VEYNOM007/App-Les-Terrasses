/**
 * Exécuté par Jest AVANT tout import de spec. Les modules Nest (AuthModule)
 * lisent process.env au moment de l'import — il faut donc que les variables
 * critiques soient définies ici plutôt que dans le spec lui-même.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'e2e-test-jwt-refresh-secret';
process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ??
  'postgresql://postgres:postgres@localhost:5432/residence_catalog_test?schema=public';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

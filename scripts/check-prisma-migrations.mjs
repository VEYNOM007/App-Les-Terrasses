#!/usr/bin/env node
/**
 * Garde-fou sur les migrations Prisma.
 *
 * Deux defauts rendent une migration silencieusement inutile :
 *   1. des "\n" litteraux (barre oblique inverse suivie de "n") : tout le
 *      fichier tient alors sur une seule ligne qui commence par "--", donc
 *      l'ALTER TABLE est commente et la colonne n'est jamais creee ;
 *   2. un fichier qui ne contient que des commentaires, sans aucune
 *      instruction SQL executable.
 *
 * Usage :
 *   node scripts/check-prisma-migrations.mjs [--dir <chemin>]
 *
 * Sortie : code 0 si tout est valide, 1 si au moins une migration est
 * invalide, 2 si le repertoire est introuvable.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = join(ROOT, 'packages/database/prisma/migrations');

/**
 * Exception documentee : cette migration a deja ete appliquee en production,
 * son empreinte est enregistree dans _prisma_migrations. La reecrire
 * changerait cette empreinte, donc on la laisse telle quelle et on rattrape
 * la colonne manquante dans une nouvelle migration.
 */
const KNOWN_BROKEN = new Map([
  [
    '20261031120000_add_survey_other_answers',
    'contient des "\\n" litteraux (donc aucun ALTER TABLE executable) ; ' +
      'deja appliquee en production, empreinte enregistree, non reecrite ; ' +
      'la colonne otherAnswers est rattrapee par 20261101130000_fix_survey_other_answers_column.',
  ],
]);

const LITERAL_BACKSLASH_N = String.fromCharCode(92) + 'n';

/** Retire les commentaires SQL (bloc et ligne) pour ne garder que le code. */
export function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** Retourne la liste des problemes detectes dans le contenu d'une migration. */
export function checkMigration(sql) {
  const problems = [];

  if (sql.includes(LITERAL_BACKSLASH_N)) {
    problems.push('contient la sequence litterale "\\n" (backslash + n)');
  }

  if (stripComments(sql).trim().length === 0) {
    problems.push('ne contient aucune instruction SQL hors commentaires');
  }

  return problems;
}

function main() {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf('--dir');
  const migrationsDir =
    dirFlag >= 0 && args[dirFlag + 1] ? resolve(args[dirFlag + 1]) : DEFAULT_DIR;

  if (!existsSync(migrationsDir)) {
    console.error(`ECHEC : repertoire introuvable : ${migrationsDir}`);
    return 2;
  }

  const migrations = readdirSync(migrationsDir)
    .filter((name) => {
      try {
        return statSync(join(migrationsDir, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();

  const failures = [];
  let checked = 0;
  let knownExceptions = 0;

  for (const name of migrations) {
    const file = join(migrationsDir, name, 'migration.sql');
    if (!existsSync(file)) {
      failures.push({ name, problems: ['migration.sql manquant'] });
      continue;
    }

    checked += 1;
    const problems = checkMigration(readFileSync(file, 'utf8'));
    if (problems.length === 0) continue;

    if (KNOWN_BROKEN.has(name)) {
      knownExceptions += 1;
      console.log(`exception connue : ${name}`);
      console.log(`  ${KNOWN_BROKEN.get(name)}`);
      continue;
    }

    failures.push({ name, problems });
  }

  console.log(`Migrations analysees : ${checked}`);

  if (failures.length === 0) {
    console.log(
      `OK : aucune migration invalide (${knownExceptions} exception connue documentee).`,
    );
    return 0;
  }

  console.error(`ECHEC : ${failures.length} migration(s) invalide(s) :`);
  for (const failure of failures) {
    console.error(`  - ${failure.name}/migration.sql`);
    for (const problem of failure.problems) {
      console.error(`      * ${problem}`);
    }
  }
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

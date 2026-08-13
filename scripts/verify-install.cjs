const fs = require('fs');
const path = require('path');

const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
const targets = [
  { encoded: 'next', name: 'next' },
  { encoded: '@prisma+client', name: '@prisma/client' },
];
let broken = false;

if (!fs.existsSync(pnpmDir)) {
  console.error(`[verify:install] CORROMPU: node_modules/.pnpm introuvable (${pnpmDir})`);
  process.exit(1);
}

for (const { encoded, name } of targets) {
  const matches = fs.readdirSync(pnpmDir).filter((d) => d.startsWith(`${encoded}@`));
  if (matches.length === 0) {
    broken = true;
    console.error(`[verify:install] CORROMPU: ${name} absent du store virtuel`);
    continue;
  }
  for (const m of matches) {
    const pkgDir = path.join(pnpmDir, m, 'node_modules', ...name.split('/'));
    const ok = fs.existsSync(pkgDir) && fs.readdirSync(pkgDir).length > 0;
    if (!ok) {
      broken = true;
      console.error(`[verify:install] CORROMPU: ${name} vide/absent (${pkgDir}) — executer: pnpm install --force`);
    }
  }
}

if (broken) process.exit(1);
console.log('[verify:install] OK — packages critiques intacts');

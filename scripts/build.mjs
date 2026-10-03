// Build = verificación del artefacto estático. Falla ante regresiones de seguridad o sintaxis.
// No descarga nada ni ejecuta scripts remotos.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const fallas = [];
const ok = msg => console.log('  ✓', msg);

// 1. Scripts externos: sólo locales, cada uno con SRI que coincide con el archivo.
const tags = [...html.matchAll(/<script\s+src="([^"]+)"([^>]*)><\/script>/g)];
for (const [, src, attrs] of tags) {
  if (/^https?:|^\/\//.test(src)) { fallas.push(`Script externo no permitido: ${src}`); continue; }
  const integ = (attrs.match(/integrity="([^"]+)"/) || [])[1];
  if (!integ) { fallas.push(`Script sin SRI: ${src}`); continue; }
  if (!existsSync(src)) { fallas.push(`No existe ${src}`); continue; }
  const real = 'sha384-' + createHash('sha384').update(readFileSync(src)).digest('base64');
  if (real !== integ) fallas.push(`SRI no coincide en ${src}`);
  else ok(`SRI ok: ${src}`);
}

// 2. Worker de pdf.js presente y local.
const worker = (html.match(/workerSrc\s*=\s*'([^']+)'/) || [])[1];
if (!worker || /^https?:/.test(worker) || !existsSync(worker)) fallas.push(`Worker de pdf.js inválido: ${worker}`);
else ok(`worker local: ${worker}`);

// 3. Sin inserción de HTML a partir de datos (SEC-004).
if (/\.innerHTML\s*=|insertAdjacentHTML|document\.write\(/.test(html)) fallas.push('Se encontró innerHTML / insertAdjacentHTML / document.write');
else ok('sin innerHTML');

// 4. pdf.js con eval deshabilitado (defensa CVE-2024-4367).
if (!/isEvalSupported:\s*false/.test(html)) fallas.push('getDocument sin isEvalSupported:false');
else ok('pdf.js con isEvalSupported:false');

// 5. Sintaxis del script de la app.
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
try { new vm.Script(inline); ok('sintaxis del script de la app'); }
catch (e) { fallas.push(`Error de sintaxis: ${e.message}`); }

if (fallas.length) { console.error('\nBUILD FALLÓ:\n- ' + fallas.join('\n- ')); process.exit(1); }
console.log('\nBuild OK');

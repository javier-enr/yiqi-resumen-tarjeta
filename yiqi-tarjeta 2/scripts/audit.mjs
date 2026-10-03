// Auditoría de dependencias (TEC-006). Falla ante vulnerabilidades high/critical
// que no tengan una excepción vigente en audit-exceptions.json.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let reporte;
try {
  reporte = execSync('npm audit --json --omit=optional', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  reporte = e.stdout; // npm audit sale con código != 0 cuando encuentra algo
}
const vulns = JSON.parse(reporte).vulnerabilities || {};
const excepciones = JSON.parse(readFileSync('audit-exceptions.json', 'utf8')).excepciones;
const hoy = new Date().toISOString().slice(0, 10);
const fallas = [];

for (const [pkg, v] of Object.entries(vulns)) {
  if (!['high', 'critical'].includes(v.severity)) continue;
  const exc = excepciones.find(x => x.paquete === pkg);
  if (!exc) { fallas.push(`${pkg} (${v.severity}) sin excepción`); continue; }
  if (exc.vence < hoy) { fallas.push(`${pkg}: la excepción venció el ${exc.vence}`); continue; }
  console.log(`  ⚠ ${pkg} (${v.severity}) — excepción vigente hasta ${exc.vence}: ${exc.justificacion}`);
}

if (fallas.length) { console.error('\nAUDITORÍA FALLÓ:\n- ' + fallas.join('\n- ')); process.exit(1); }
console.log('\nAuditoría OK (sin high/critical abiertas fuera de excepción)');

# YiQi_Tarjeta — reglas y alcance del proyecto

> Documento de alcance del repositorio. El Homologador YiQi lo lee primero para establecer
> el alcance de la auditoría (reglas de ejecución 1 y 8).

## Qué es

Convierte el **PDF del resumen de una tarjeta de crédito** en el **Excel de detalle** que se
importa en la factura de compra tipo RESUMEN de YiQi.

## Arquitectura (alcance de homologación)

**Aplicación 100% frontend estática. No hay backend.**

- `index.html` + librerías vendorizadas en `vendor/`.
- **No hay**: servidor, API, base de datos, autenticación ni sesiones. Sí hay CI (ver abajo).
- El PDF se procesa **en el navegador**; no sale del equipo y **la app no escribe en YiQi**.

Por ausencia de esas capas **no aplican**: SEC-051, SEC-014, SEC-054 (sin servidor ni login),
TEC-000 (sin capa servidor). Ver `security-exceptions.json`.

## Runtime y comandos

Node.js 24 (`engines`, `.nvmrc`, `.node-version`). Node sólo se usa para verificar; la app
corre en el navegador.

| Comando | Qué hace |
|---|---|
| `npm run build` | Verifica el artefacto: SRI de cada script, worker local, sin `innerHTML`, pdf.js sin eval, sintaxis. |
| `npm test` | Tests de reglas de negocio (formato de factura, importes, cierre del resumen, Excel ARS/USD, Excluir Movimiento, alícuota). |
| `npm run audit` | `npm audit`; falla ante high/critical sin excepción vigente en `audit-exceptions.json`. |
| `npm run verify` | Los tres anteriores. |

## Dependencias

Vendorizadas (bundling propio), sin CDN externo, con **SRI sha384**:

- `vendor/pdf.min.js` + `vendor/pdf.worker.min.mjs` — **pdf.js 4.10.38** (corrige CVE-2024-4367),
  usado además con `isEvalSupported: false`.
- `vendor/xlsx.full.min.js` — SheetJS xlsx 0.18.5. Excepción documentada en
  `audit-exceptions.json` (la app sólo escribe Excel; las advisories afectan la lectura).

Versiones fijadas en `package.json` + `package-lock.json`.

## Cabeceras de seguridad

En `netlify.toml`: CSP con `frame-ancestors 'none'`, HSTS, `nosniff`, Referrer-Policy,
Permissions-Policy, X-Frame-Options, COOP. Probadas sirviendo la app con esas cabeceras
contra 30 resúmenes reales, sin violaciones de CSP.

## CI/CD y evidencia

`.github/workflows/ci.yml` (acciones fijadas por SHA, permisos mínimos):
build + tests + `npm audit` y detección de secretos (TruffleHog) en cada PR/push; revisión de
dependencias en PR; SBOM CycloneDX + provenance firmada del sitio en `main`; DAST OWASP ZAP
semanal contra el sitio publicado. Excepciones formales en `security-exceptions.json`;
modelo de amenazas y riesgos residuales en `SECURITY.md`.

## Publicación

Netlify, carpeta completa (`publish = "."`). Publicar **siempre la carpeta entera**:
sin `vendor/` la app no puede leer PDFs.

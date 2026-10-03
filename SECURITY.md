# Seguridad — yiqi-tarjeta

## Alcance

Aplicación **100% frontend estática**: lee el PDF de un resumen de tarjeta **en el navegador**
y genera un Excel. No hay backend, base de datos, autenticación ni datos persistidos. No
escribe en YiQi. Ver `AGENTS.md`.

## Modelo de amenazas (resumen)

| Amenaza | Control |
|---|---|
| PDF malicioso que ejecuta código | pdf.js 4.10.38 (corrige CVE-2024-4367) + `isEvalSupported: false` |
| XSS con texto del PDF | Render por DOM con `textContent`; sin `innerHTML` (verificado en `npm run build`) |
| Script de terceros comprometido | Librerías vendorizadas con SRI sha384; sin CDN externo para scripts |
| Clickjacking / inyección | CSP con `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy (`netlify.toml`) |
| Dependencia vulnerable | `npm run audit` en CI; excepciones con vencimiento en `audit-exceptions.json` |
| Secretos en el repo | TruffleHog en cada push/PR (CI) |
| Fuga del PDF | El PDF no sale del equipo: no hay `fetch`/upload (CSP `connect-src 'self'`) |

## Pruebas de seguridad

- **DAST:** OWASP ZAP baseline contra `https://yiqi-tarjeta-scan.netlify.app/`, semanal y a
  demanda (job `dast` en `.github/workflows/ci.yml`). El reporte queda como artefacto del run.
- **Pentest:** no aplicabilidad formal registrada en `security-exceptions.json` (control
  SEC-061), con responsable y vencimiento.
- **Regresión:** `npm run verify` (build + tests + auditoría) en cada PR.

## Riesgos residuales

| Riesgo | Responsable | Mitigación | Próxima verificación |
|---|---|---|---|
| xlsx 0.18.5 con advisories de lectura (no usada) | Javier Perez (A&F) | Sólo `XLSX.write`; excepción en `audit-exceptions.json` | 2027-01-03 (migrar a SheetJS ≥ 0.20.2) |
| `'unsafe-inline'` en `script-src` (script de la app inline) | Javier Perez (A&F) | Sin dependencias externas de script; sin `innerHTML` | 2027-04-03 (externalizar JS a archivo propio) |
| Formatos de resumen no reconocidos | Javier Perez (A&F) | La identidad aritmética bloquea el Excel si no cierra | Con cada formato nuevo |

## Excepciones formales

Todas en `security-exceptions.json` (controles de servidor/autenticación que no aplican) y
`audit-exceptions.json` (dependencias), con control, responsable, justificación, mitigación y
vencimiento.

## Reportar una vulnerabilidad

Escribir a atencion@yiqi.com.ar con el detalle. No incluir datos de tarjetas reales.

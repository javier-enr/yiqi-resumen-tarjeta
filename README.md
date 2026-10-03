# Resumen de tarjeta → YiQi

Convierte el **PDF del resumen de una tarjeta de crédito** en el **Excel de detalle** que se
importa en la factura de compra tipo **RESUMEN** de YiQi.

Es una aplicación **100% frontend estática**: el PDF se procesa en el navegador del usuario,
no se sube a ningún servidor y la herramienta **no escribe en YiQi**.

Publicada en: https://yiqi-tarjeta-scan.netlify.app/

---

## Cómo se usa

1. En YiQi, crear a mano la **factura de compra tipo RESUMEN** con el banco emisor como proveedor.
2. En la herramienta, cargar el **número de esa factura** (`999-12345678`) y elegir la **moneda** (ARS o USD).
3. Subir el **PDF del resumen**. La moneda queda fija desde ese momento.
4. Revisar los consumos: los que **ya tienen factura de compra** en YiQi van tildados; destildar los que no.
5. **Generar Excel** e importarlo en el detalle de la factura RESUMEN.

Si el resumen tiene consumos en pesos **y** en dólares, son dos facturas: *Resetear todo*,
elegir la otra moneda y volver a subir el mismo PDF.

## Qué genera

Una línea por movimiento, nunca agrupadas, con el formato de importación `DET_FACT_COMPRA`:

| Movimiento | Excluir Movimiento | Motivo |
|---|---|---|
| Consumo tildado (ya facturado) | `TRUE` | Ya tiene asiento por su factura de compra |
| Consumo sin tildar | `FALSE` | Gasto sin comprobante: genera asiento |
| Cargo del emisor (IVA, sellos, percepciones) | `FALSE` | El resumen es el comprobante |
| Pago del resumen | — | No entra: es una cancelación |

Valores fijos: `Cantidad = 1`, `Precio Unitario = importe`, `Alícuota = No gravado`.

## Cómo lee los resúmenes

Un **motor genérico** deduce la estructura de cada PDF (columnas ancladas a los rótulos
PESOS / DÓLARES, separadores, signos, totales) en vez de usar plantillas fijas por banco.

Antes de generar el Excel verifica la identidad aritmética del resumen:

```
saldo anterior + pagos + consumos + cargos = saldo actual
```

Si no cierra al centavo, **no genera el Excel**.

Lee resúmenes **VISA y Cabal**. Validado contra 30 resúmenes reales (Credicoop y Galicia).

## Estructura

```
index.html              App completa (UI + motor + generación del Excel)
vendor/                 pdf.js 4.10.38 y SheetJS xlsx 0.18.5, vendorizados con SRI
netlify.toml            Publicación y cabeceras de seguridad (CSP, HSTS, etc.)
scripts/build.mjs       Verificación del artefacto
scripts/audit.mjs       Auditoría de dependencias con excepciones que vencen
test/app.test.mjs       Tests de reglas de negocio
.github/workflows/      CI: verificación, secretos, SBOM/provenance, DAST
AGENTS.md               Alcance y arquitectura (lo lee el Homologador YiQi)
SECURITY.md             Modelo de amenazas y riesgos residuales
security-exceptions.json / audit-exceptions.json   Excepciones formales
```

## Desarrollo

Requiere **Node.js 24** (sólo para verificar; la app corre en el navegador).

```bash
npm ci --ignore-scripts
npm run build     # SRI, worker local, sin innerHTML, pdf.js sin eval, sintaxis
npm test          # reglas de negocio: factura, importes, cierre, Excel ARS/USD
npm run audit     # npm audit + excepciones vigentes
npm run verify    # los tres
```

Para probar localmente, servir la carpeta por HTTP (por ejemplo `npx serve .`).
Abrir `index.html` con doble clic no funciona: el navegador bloquea el worker de pdf.js.

## Publicación

Netlify, **siempre la carpeta entera** (`publish = "."`). Sin `vendor/` la app no puede leer PDFs.

## Seguridad

- pdf.js 4.10.38 con `isEvalSupported: false` (CVE-2024-4367).
- Render por DOM con `textContent`: ningún dato del PDF se inserta como HTML.
- Librerías locales con SRI; sin scripts de CDN externos.
- CSP con `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy y Permissions-Policy.

Detalle en [`SECURITY.md`](SECURITY.md). Homologación YiQi: **87/100, condicional**; lo que
queda pendiente son controles de servidor que hoy no aplican (ver `security-exceptions.json`).

## Próximos pasos (Ingeniería)

1. **Login y perfil Compras.**
2. **Escribir en YiQi por API**: crear la factura RESUMEN y su detalle en vez del Excel.
3. **Control de duplicados** antes de crear (tarjeta + período + total).
4. **Pre-tildar "ya facturado"** consultando las facturas de compra del período.
5. **Factura USD** con moneda y cotización.
6. **Registro de auditoría**: quién cargó qué y cuándo.

> Al agregar login y backend, los controles SEC-051, SEC-014, SEC-054 y TEC-000 pasan a
> aplicar y sus excepciones dejan de valer.

Pendientes técnicos: migrar SheetJS a ≥ 0.20.2 antes de 2027-01-03 y externalizar el
JavaScript inline para quitar `'unsafe-inline'` de la CSP.

// Tests de las reglas de negocio de la app. Cargan el script real de index.html en un
// sandbox (vm) con un DOM mínimo, sin navegador. Fallan ante regresiones de lógica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// ── DOM mínimo: cada selector devuelve un elemento que guarda lo que se le asigna ──
function crearElemento() {
  const datos = { classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
                  style: {}, dataset: {}, value: '', hidden: false, disabled: false };
  return new Proxy(datos, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === Symbol.toPrimitive) return () => '';
      return () => crearElemento();      // métodos: addEventListener, append, etc.
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const elementos = new Map();
const document = {
  querySelector: s => (elementos.has(s) || elementos.set(s, crearElemento()), elementos.get(s)),
  documentElement: crearElemento(),
  createElement: () => crearElemento(),
  querySelectorAll: () => [],
  addEventListener(){},
};
const ctx = vm.createContext({
  document, console, Intl, Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL(){} },
  matchMedia: () => ({ matches: false, addEventListener(){} }),
  window: {}, localStorage: { getItem: () => null, setItem(){} },
});
ctx.self = ctx; ctx.globalThis = ctx;

// XLSX real (vendorizado) y el script de la app, con sus funciones expuestas para el test.
vm.runInContext(readFileSync('vendor/xlsx.full.min.js', 'utf8'), ctx);
const html = readFileSync('index.html', 'utf8');
const app = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
vm.runInContext(app + `
;globalThis.__t = { num, MONEY, ALICUOTA, normalizarFactura, revisar, construirExcel };`, ctx);
const T = ctx.__t;
const plano = x => JSON.parse(JSON.stringify(x));   // arrays del sandbox tienen otro prototipo
const moneda = v => { document.querySelector('#moneda').value = v; };

test('normalizarFactura arma PUNTOVENTA-NUMERO', () => {
  assert.equal(T.normalizarFactura('999-12345678'), '999-12345678');
  assert.equal(T.normalizarFactura('999 12345678'), '999-12345678');
  assert.equal(T.normalizarFactura('99912345678'), '999-12345678');
  assert.equal(T.normalizarFactura(''), '');
});

test('num interpreta importes argentinos y su signo', () => {
  assert.equal(T.num('1.234,56'), 1234.56);
  assert.equal(T.num('1.234,56-'), -1234.56);
  assert.equal(T.num('14.307,10−'), -14307.10);
  assert.ok(T.MONEY.test('2.166.989,18'));
  assert.ok(!T.MONEY.test('12/08/26'));
});

const base = () => ({
  bancoEmisor: 'Credicoop', red: 'VISA', tarjetas: ['1234'],
  saldoAntP: 1000, saldoActP: 1600, totalConsumosP: 500, totalConsumosU: null,
  pagos: [{ fecha: '01-08-26', desc: 'SU PAGO', pesos: -1000, usd: null }],
  consumos: [
    { fecha: '05-08-26', desc: 'COTO',    pesos: 300, usd: null, ok: true  },
    { fecha: '06-08-26', desc: 'YPF',     pesos: 200, usd: null, ok: false },
    { fecha: '07-08-26', desc: 'NETFLIX', pesos: null, usd: 12.5, ok: false },
  ],
  cargos: [{ fecha: '27-08-26', desc: 'IVA', pesos: 1100, usd: 1.5 }],
});

test('revisar: un resumen que cierra no da errores', () => {
  moneda('ARS');
  assert.deepEqual(plano(T.revisar(base()).filter(a => a.nivel === 'error')), []);
});

test('revisar: un resumen que no cierra se bloquea', () => {
  moneda('ARS');
  const d = base(); d.saldoActP = 9999;
  assert.ok(T.revisar(d).some(a => a.nivel === 'error' && /No cierra/.test(a.texto)));
});

test('revisar: resumen sin movimientos se informa como tal', () => {
  moneda('ARS');
  const d = { ...base(), consumos: [], cargos: [], pagos: [], saldoAntP: -14307.10, saldoActP: -14307.10 };
  assert.ok(T.revisar(d).some(a => /no tiene consumos/.test(a.texto)));
});

test('construirExcel ARS: una línea por consumo y cargo, reglas de Excluir y alícuota', () => {
  const filas = T.construirExcel(base(), '999-12345678', 'pesos').Sheets.Hoja1;
  const aoa = plano(ctx.XLSX.utils.sheet_to_json(filas, { header: 1 }));
  const datos = aoa.slice(2);                         // 2 filas de encabezado
  assert.equal(datos.length, 3);                      // COTO, YPF, IVA (NETFLIX es USD)
  assert.deepEqual(datos.map(r => r[12]), ['TRUE', 'FALSE', 'FALSE']); // facturado / sin factura / cargo
  assert.ok(datos.every(r => r[7] === T.ALICUOTA && r[3] === 1 && r[0] === '999-12345678'));
  assert.deepEqual(datos.map(r => r[5]), [300, 200, 1100]);
});

test('construirExcel USD: sólo líneas en dólares (descarta ARS)', () => {
  const aoa = plano(ctx.XLSX.utils.sheet_to_json(T.construirExcel(base(), '999-1', 'usd').Sheets.Hoja1, { header: 1 }));
  assert.deepEqual(aoa.slice(2).map(r => r[5]), [12.5, 1.5]);
});

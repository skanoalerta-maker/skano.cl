"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const code = fs.readFileSync(
  "./portal-operaciones/portal.js",
  "utf8"
);

const start = code.indexOf(
  "// SKANO_CSV_FORMULA_PROTECTION_V1"
);
const end = code.indexOf("  const csv = [", start);

assert.ok(start >= 0, "Falta proteccion CSV");
assert.ok(end > start, "No se encontro el final");

const fragment = code.slice(start, end);

const value = vm.runInNewContext(
  fragment + "\nvalue;",
  Object.create(null),
  { timeout: 1000 }
);

for (const input of [
  "=1+1",
  "+SUM(1,2)",
  "-1+2",
  "@SUM(1,2)",
  " =1+1",
  "\t=1+1",
  "\n=1+1"
]) {
  const result = value(input);
  assert.ok(
    result.startsWith('"\''),
    `No protegido: ${JSON.stringify(input)}`
  );
}

assert.equal(value("Toyota"), '"Toyota"');
assert.equal(value("A,B"), '"A,B"');
assert.equal(value('A"B'), '"A""B"');
assert.equal(value(null), '""');

console.log("APROBADO: formulas bloqueadas");
console.log("APROBADO: texto normal conservado");
console.log("APROBADO: comillas CSV escapadas");
console.log("APROBADO: valores vacios");

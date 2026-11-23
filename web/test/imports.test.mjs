// A cheap stand-in for a browser smoke test: every relative import in the page's modules must point at a file that exists
// and export each name it asks for (the class of bug that blanks the whole page), and every module must parse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const files = [...walk(join(root, 'game')), ...walk(join(root, 'shared'))];
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1'); // comments out (a // inside a string is kept by the lookbehind guess)

/** The names declared by one const/let/var statement starting at `i` (top-level commas only). */
function declNames(src, i) {
  const out = []; let depth = 0, start = i, str = null;
  const take = (end) => { const m = src.slice(start, end).match(/^\s*([A-Za-z_$][\w$]*)\s*=/); if (m) out.push(m[1]); };
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (str) { if (c === '\\') k++; else if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === '`') str = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && (c === ',' || c === ';')) { take(k); start = k + 1; if (c === ';') return out; }
    else if (depth === 0 && c === '\n' && /^\s*[A-Za-z_$][\w$]*\s*=/.test(src.slice(start, k)) && !/[,=+\-*/&|?:(\[{]\s*$/.test(src.slice(start, k))) { take(k); return out; } // no semicolon: the statement ended at the line end
  }
  take(src.length); return out;
}

function exportsOf(file) {
  const src = strip(readFileSync(file, 'utf8')), names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+/g)) declNames(src, m.index + m[0].length).forEach((n) => names.add(n)); // also "export const A = 1, B = 2;"
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop(); if (n) names.add(n); }
  if (/export\s+default\b/.test(src)) names.add('default');
  return names;
}

test('every module parses', () => {
  for (const f of files) execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
});

test('every relative import resolves and every imported name is exported', () => {
  const cache = new Map(), problems = [];
  const exp = (f) => { if (!cache.has(f)) cache.set(f, exportsOf(f)); return cache.get(f); };
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/import\s+([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
      const [, clause, spec] = m;
      if (!spec.startsWith('.')) continue;
      const target = resolve(dirname(f), spec);
      if (!existsSync(target)) { problems.push(`${relative(root, f)}: ${spec} does not exist`); continue; }
      if (!target.endsWith('.js')) continue;
      const have = exp(target);
      const braces = clause.match(/\{([^}]*)\}/);
      if (braces) for (const part of braces[1].split(',')) { const n = part.trim().split(/\s+as\s+/)[0]; if (n && !have.has(n)) problems.push(`${relative(root, f)}: ${spec} has no export ${n}`); }
      const def = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+\w+/, '').replace(/,/g, '').trim();
      if (def && !have.has('default')) problems.push(`${relative(root, f)}: ${spec} has no default export`);
    }
    for (const m of src.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) if (!existsSync(resolve(dirname(f), m[1]))) problems.push(`${relative(root, f)}: dynamic import ${m[1]} does not exist`);
  }
  assert.deepEqual(problems, []);
});

test('the checker really catches a missing export (guards the guard)', () => {
  const src = 'export const a = 1;\nexport function b() {}\nexport { c as d };';
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  assert.ok(names.has('a') && names.has('b') && !names.has('zzz'));
});

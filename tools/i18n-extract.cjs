// UI matnlarini (o'zbekcha) koddan yig'adi: JSX matni, prose ko'rinishidagi satrlar va shablonlar.
// Ishlatish: node tools/i18n-extract.cjs <panel> --missing   (faqat lug'atda yo'q matnlar, har biri alohida qatorda)
//           node tools/i18n-extract.cjs <panel>             (hammasi, JSON)
const path = require("path"), fs = require("fs");
const panel = process.argv[2];
const ts = require(path.resolve(panel, "node_modules/typescript"));
const root = path.resolve(panel, "src");
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p);
  if (s.isDirectory()) { if (f !== "i18n") walk(p); } else if (/\.tsx?$/.test(f) && !/\.d\.ts$/.test(f)) files.push(p); } })(root);

const SKIP_ATTR = /^(className|class|href|src|type|id|key|icon|name|value|htmlFor|role|target|rel|style|autoComplete|inputMode|pattern|d|viewBox|fill|stroke|tone|variant|size|mode|kind|method|accept|lang|dir|as|defaultValue|data-.*|xmlns|strokeLinecap|strokeLinejoin|points|transform|x|y|cx|cy|r|width|height|min|max|step|rows|cols|form|action|encType|loading|decoding|align|sizes|media|charSet|content|property|step)$/;
const CLASS_TOKEN = /^[!a-z0-9:\-\/\[\]\.%#()_*,'&>+=~@]+$/i;
const TW_WORDS = new Set("flex grid hidden block relative absolute truncate uppercase italic underline border rounded shadow transition inline fixed sticky static table contents antialiased group peer container capitalize lowercase invisible visible grow shrink ring outline filter blur transform resize isolate".split(" "));
function looksLikeClass(s) {
  const toks = s.trim().split(/\s+/);
  if (!toks.every((t) => CLASS_TOKEN.test(t))) return false;
  return toks.some((t) => /[-:\[]/.test(t) || TW_WORDS.has(t)) && !/[A-Z]/.test(s.replace(/\[[^\]]*\]/g, "").replace(/[A-Z](?=[a-z]*:)/g, ""));
}
function prose(s) {
  const t = s.trim();
  if (t.length < 2 || !/\p{L}/u.test(t)) return false;
  if (/^(https?:|\/|@\/|\.\/|#[0-9a-f]{3,8}$|[a-z]+:\/\/)/i.test(t)) return false;
  if (/^[a-z0-9_.\-\/:{}$?=&%\[\]]+$/.test(t)) return false;            // identifikator, yo'l, kalit
  if (/^[A-Z0-9_]+$/.test(t) && t.length > 3 && /_/.test(t)) return false; // CONSTANT_CASE
  if (looksLikeClass(t)) return false;
  if (/^(application|text|image|multipart)\//.test(t)) return false;
  if (/^[a-zA-Z]+(\.[a-zA-Z]+)+$/.test(t)) return false;                 // i18n kaliti
  if (/[;{}]|=>|\bvar\(|rgba?\(|\bcalc\(|\burl\(/.test(t.replace(/\{\}/g, ""))) return false;  // CSS/kod
  if (/^[A-Za-z]+$/.test(t) && !/^[A-ZО-Я]/.test(t)) return false;       // kichik harfli bitta so'z
  if (/^[A-Z][a-zA-Z]+$/.test(t) && /[a-z][A-Z]/.test(t)) return false;   // PascalCase identifikator
  return true;
}
const out = new Map();
function add(s, file) { const k = s.replace(/\s+/g, " ").trim(); if (!prose(k)) return; if (!out.has(k)) out.set(k, path.relative(root, file)); }
function decode(s) { return s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&mdash;/g, "—").replace(/&rarr;/g, "→"); }
for (const file of files) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  (function visit(n, skip) {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n) || ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) return;
    if (ts.isJsxAttribute(n) && SKIP_ATTR.test(n.name.getText())) skip = true;
    if (ts.isCallExpression(n)) { const c = n.expression.getText(); if (/^(api|fetch|t|console\.\w+|router\.\w+|require|localStorage\.\w+|sessionStorage\.\w+|cn|clsx|document\.\w+|.*\.(addEventListener|removeEventListener|getAttribute|setAttribute|querySelector(All)?|startsWith|endsWith|includes|split|replace|join|padStart|toLocale\w+|append|set|get|has|delete|match|test|indexOf))$/.test(c)) skip = true; }
    if (ts.isBinaryExpression(n) && /^(===|!==|==|!=)$/.test(n.operatorToken.getText())) skip = true;
    if (ts.isCaseClause(n)) { n.statements.forEach((s) => visit(s, skip)); return; }
    if (ts.isVariableDeclaration(n) && /class|cls|style|color|tone|regex|url|path|key$/i.test(n.name.getText())) skip = true;
    if (ts.isPropertyAssignment(n)) { if (/^(className|class|icon|tone|color|href|key|id|type|kind|variant|field|accessor|sortKey|param)$/i.test(n.name.getText().replace(/["']/g, ""))) skip = true; visit(n.initializer, skip); return; }
    if (ts.isJsxText(n)) { if (!skip) add(decode(n.text), file); return; }
    if (!skip && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))) { add(n.text, file); return; }
    if (!skip && ts.isTemplateExpression(n)) {
      let k = n.head.text; n.templateSpans.forEach((sp) => { k += "{}" + sp.literal.text; });
      if (/\p{L}/u.test(k.replace(/\{\}/g, ""))) add(k, file);
      n.templateSpans.forEach((sp) => visit(sp.expression, skip)); return;
    }
    ts.forEachChild(n, (c) => visit(c, skip));
  })(sf, false);
}
if (process.argv.includes("--missing")) {
  // Lug'at manbasi: tools/i18n/keys.json + tr-*.tsv (indeks bo'yicha) va tr-templates.tsv (kalit bo'yicha).
  const dir = path.join(__dirname, "i18n");
  const keys = JSON.parse(fs.readFileSync(path.join(dir, "keys.json"), "utf8"));
  const norm = (k) => k.replace(/\{n\}/g, "{}");
  const have = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".tsv")) continue;
    for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      const first = line.split("\t")[0];
      have.add(norm(f === "tr-templates.tsv" ? first : keys[Number(first)] ?? ""));
    }
  }
  const junk = (k) => /^(<|&lt;)|xmlns|<\/|^(use client|uz-UZ|uz-Cyrl|ru_RU|Content-Type|Breadcrumb|material icon|Auth timeout|Excel|Excel \(\{\}\)|Email|Instagram|Facebook|Telegram|YouTube|Slug|E-Makon|E-MAKON|E-MAKON SuperAdmin|\{\} · \{\} o'rin · \$\{\})$|sans-serif|^[A-Za-z0-9]{40,}$|^use[A-Z]|^islands#|@example\.|^[A-Z]{2,4}$|^[^\p{L}]*$|^(Bearer|weather) \{\}$|[?&]\w+=|\$A\$/u.test(k) || !/\p{L}{2}/u.test(k.replace(/\{\}/g, ""));
  const missing = [...out.entries()].filter(([k]) => !have.has(norm(k)) && !junk(k));
  if (!missing.length) console.log("Hamma matn lug'atda bor — yangi tarjima kerak emas.");
  else {
    console.log(`Lug'atda yo'q ${missing.length} ta matn (tools/i18n/tr-templates.tsv ga qo'shing: matn<TAB>ruscha<TAB>inglizcha):\n`);
    for (const [k, f] of missing) console.log(`${k}\t\t# ${f}`);
  }
} else {
  console.log(JSON.stringify([...out.entries()].map(([k, f]) => ({ k, f })), null, 0));
}

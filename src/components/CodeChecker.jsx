import React, { useState, useMemo, useRef } from 'react'

const h = React.createElement

const PRESETS = [
  { name: "Contoh (Volume kerucut)", code:
`program volume_kerucut
kamus
    constant pi : real = 3.14
    r, t : integer
    volume : real
algoritma
    input(r, t)
    volume <- (1 / 3) * pi * r * r * t
    output(volume)
endprogram`,
    cases: [["3 5","47.1"],["1 3","3.14"],["10 6","628"]] },
  { name: "New pseudocode", code: "program contoh\nkamus\n    x : integer\nalgoritma\n    input(x)\n    output(x)\nendprogram", cases: [["7","7"]] },
  { name: "Contoh (Hitung lembar uang)", code:
`program HitungLembarUang
kamus
    tagihan, jumlah_lembar, sisa : integer
algoritma
    input(tagihan)

    jumlah_lembar <- tagihan div 20000
    sisa <- tagihan mod 20000

    if (sisa > 0) then
        jumlah_lembar <- jumlah_lembar + 1
    endif

    output(jumlah_lembar, "lembar")
endprogram`,
    cases: [["10000","1 lembar"],["20000","1 lembar"],["45000","3 lembar"],["100000","5 lembar"]] },
];

// ---------- Penerjemah pseudocode -> JavaScript ----------
const KW_END = /^(selesai|end|stop|endprogram|end\s*program|akhir\s*program)$/i;
function splitTop(s) { // pisah berdasarkan koma di level paling luar
  const out = []; let d = 0, q = "", cur = "";
  for (const ch of s) {
    if (q) { if (ch === q) q = ""; cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "(") d++; if (ch === ")") d--;
    if (ch === "," && d === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function unwrap(s) { // buang kurung terluar: input(a, b) -> a, b
  s = s.trim();
  if (s[0] !== "(" || s[s.length - 1] !== ")") return s;
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") d++; if (s[i] === ")") d--;
    if (d === 0 && i < s.length - 1) return s;
  }
  return s.slice(1, -1);
}
function expr(e) {
  const op = "(\\([^()]*\\)|[\\w.]+)";
  return e.replace(/×/g, "*").replace(/÷/g, "/")
    .replace(new RegExp(op + "\\s+div\\s+" + op, "gi"), "Math.trunc($1/$2)")
    .replace(/\bmod\b/gi, "%").replace(/\bbenar\b/gi, "true").replace(/\bsalah\b/gi, "false");
}
function cond(c) {
  return expr(c).replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≠|<>/g, "!=")
    .replace(/\b(dan|and)\b/gi, "&&").replace(/\b(atau|or)\b/gi, "||").replace(/\b(tidak|not)\b/gi, "!")
    .replace(/([^<>!=])=(?!=)/g, "$1==");
}
function translate(code, opts) {
  const js = [], vars = new Set(); let inDecl = false;
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], s = raw.replace(/\/\/.*$/, "").trim();
    if (!s) continue;
    const bad = (m) => { throw new Error("Baris " + (i + 1) + ": " + m + " -> " + raw.trim()); };
    let m;
    if (/^(algoritma|mulai|begin)\b/i.test(s)) { inDecl = false; continue; }
    if (/^(kamus|deklarasi|declare|var)\s*$/i.test(s)) { inDecl = true; continue; }
    if (/^program\b/i.test(s) || KW_END.test(s)) continue;
    if (/^(kamus|deklarasi|declare|var)\b/i.test(s) && s.includes(":")) { m = s.replace(/^\w+\s+/, ""); declare(m); continue; }
    if (inDecl) { declare(s); continue; }
    if (/^(akhir\s*jika|selesai\s*jika|end\s*if|endif)$/i.test(s) || /^(akhir\s*selama|end\s*while|endwhile|akhir\s*untuk|end\s*for|endfor)$/i.test(s)) { js.push("}"); continue; }
    if (/^(jika\s*tidak|lainnya|selain\s*itu|else)$/i.test(s)) { js.push("} else {"); continue; }
    if ((m = s.match(/^(?:else\s*if|jika\s*tidak\s*jika|lainnya\s*jika)\s+(.+?)\s+(?:then|maka)$/i))) { js.push("} else if (" + cond(m[1]) + ") {"); continue; }
    if ((m = s.match(/^(?:if|jika)\s+(.+?)\s+(?:then|maka)$/i))) { js.push("if (" + cond(m[1]) + ") {"); continue; }
    if ((m = s.match(/^(?:while|selama)\s+(.+?)\s+(?:do|lakukan)$/i))) { js.push("while (" + cond(m[1]) + ") { if (++__g > 100000) throw new Error('Perulangan tidak berhenti');"); continue; }
    if ((m = s.match(/^(?:for|untuk)\s+(\w+)\s*(?:<-|←|:=|=)\s*(.+?)\s+(?:to|sampai)\s+(.+?)\s+(?:do|lakukan)$/i))) {
      vars.add(m[1]); js.push("for (" + m[1] + " = " + expr(m[2]) + "; " + m[1] + " <= " + expr(m[3]) + "; " + m[1] + "++) { if (++__g > 100000) throw new Error('Perulangan tidak berhenti');"); continue; }
    if ((m = s.match(/^(?:input|baca|read)\b\s*(.+)$/i))) {
      splitTop(unwrap(m[1])).forEach((n) => { if (!/^[A-Za-z_]\w*$/.test(n)) bad("nama variabel tidak valid"); vars.add(n); js.push(n + " = __next();"); }); continue; }
    if ((m = s.match(/^(?:output|cetak|tampilkan|print|display|tulis)\b\s*(.+)$/i))) {
      js.push("__out.push([" + splitTop(unwrap(m[1])).map((a) => "__fmt(" + expr(a) + ")").join(",") + "].join(' '));"); continue; }
    if ((m = s.match(/^([A-Za-z_]\w*)\s*(?:<-|←|:=|=)\s*(.+)$/))) { vars.add(m[1]); js.push(m[1] + " = " + expr(m[2]) + ";"); continue; }
    bad("perintah tidak dikenali");
  }
  function declare(d) {
    const m = d.match(/^(?:(?:constant|const|konstanta)\s+)?(.+?)\s*:\s*[A-Za-z]+(?:\s*(?:=|<-)\s*(.+))?$/i);
    if (!m) throw new Error("Deklarasi tidak dikenali: " + d);
    m[1].split(",").forEach((n) => vars.add(n.trim()));
    if (m[2]) js.push(m[1].trim() + " = " + expr(m[2]) + ";");
  }
  if (opts && opts.capture && vars.size) {
    js.push("__vars({" + [...vars].map((n) => JSON.stringify(n) + ": (typeof " + n + " !== 'undefined' ? " + n + " : undefined)").join(", ") + "});");
  }
  return (vars.size ? "let " + [...vars].join(",") + ";" : "") + js.join("\n");
}
function run(code, inputText, onVars) {
  const body = translate(code, { capture: !!onVars });
  const captured = {};
  const toks = inputText.split(/[\s,;]+/).filter(Boolean).map((t) => (isNaN(t) ? t : Number(t)));
  let k = 0, __g = 0; const out = [];
  const next = () => { if (k >= toks.length) throw new Error("Masukan kurang: program meminta lebih banyak input"); return toks[k++]; };
  const fmt = (v) => (typeof v === "number" && !Number.isInteger(v) ? String(Number(v.toPrecision(12))) : String(v));
  const grab = (v) => { Object.assign(captured, v || {}); };
  new Function("__next", "__out", "__fmt", "__g", "__vars", body)(next, out, fmt, 0, grab);
  if (onVars) onVars(captured);
  return out.join("\n");
}
function fmtVar(v) {
  if (v === undefined || v === null) return "-";
  if (typeof v === "number" && !Number.isInteger(v)) return String(Number(v.toPrecision(12)));
  return String(v);
}
function same(a, b) {
  a = a.trim(); b = b.trim();
  if (a !== "" && b !== "" && !isNaN(a) && !isNaN(b)) return Math.abs(Number(a) - Number(b)) < 1e-6;
  return a === b;
}

// ---------- Penerjemah Go -> JavaScript ----------
function stripC(l) { // buang komentar // di luar string
  let q = "";
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = ""; }
    else if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "/" && l[i + 1] === "/") return l.slice(0, i);
  }
  return l;
}
function gdiv(e, isF) { // pembagian integer Go: int / int -> dibulatkan ke nol
  let i;
  while ((i = e.indexOf("/")) >= 0) {
    let a = i - 1, d = 0;
    for (; a >= 0; a--) {
      const c = e[a];
      if (c === ")") d++;
      else if (c === "(") { if (d === 0) break; d--; }
      else if (d === 0 && /[+\-<>=!&|,]/.test(c)) break;
    }
    let j = i + 1; while (e[j] === " ") j++;
    let b = j; if (e[b] === "-" || e[b] === "+") b++;
    while (b < e.length && /[\w.]/.test(e[b])) b++;
    if (e[b] === "(") { let d2 = 0; for (; b < e.length; b++) { if (e[b] === "(") d2++; else if (e[b] === ")") { d2--; if (d2 === 0) { b++; break; } } } }
    const L = e.slice(a + 1, i).trim(), R = e.slice(j, b);
    const rep = (isF(L) || isF(R)) ? "(" + L + "\u0001" + R + ")" : "__idiv(" + L + "," + R + ")";
    e = e.slice(0, a + 1) + rep + e.slice(b);
  }
  return e.replace(/\u0001/g, "/");
}
function gexpr(e, fl) {
  const strs = [];
  e = e.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (x) => { strs.push(x); return "\u0002" + (strs.length - 1) + "\u0003"; });
  const isF = (t) => /\d\.|\.\d|float(32|64)\(|math\./.test(t) || (t.match(/[A-Za-z_]\w*/g) || []).some((n) => fl.has(n));
  e = gdiv(e, isF)
    .replace(/\bfloat(?:32|64)\(/g, "(").replace(/\bint(?:8|16|32|64)?\(/g, "Math.trunc(")
    .replace(/\bmath\.(\w+)/g, (_, n) => n === "Pi" ? "Math.PI" : n === "E" ? "Math.E" : "Math." + n[0].toLowerCase() + n.slice(1))
    .replace(/\bfmt\.Sprintf\(/g, "__pf(").replace(/\blen\(([^()]*)\)/g, "($1).length").replace(/\bnil\b/g, "null");
  return e.replace(/\u0002(\d+)\u0003/g, (_, n) => strs[+n]);
}
const GTYPES = "int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|string|bool|byte|rune";
function translateGo(code, opts) {
  const js = [], vars = new Set(), fl = new Set();
  let depth = 0, inImp = false, inVar = "", started = false;
  const isF = (t) => /\d\.|\.\d|float(32|64)\(|math\./.test(t) || (t.match(/[A-Za-z_]\w*/g) || []).some((n) => fl.has(n));
  const gx = (e) => gexpr(e, fl);
  const bad = (m) => { throw new Error(m); };
  const ID = /^[A-Za-z_]\w*$/;
  function declGo(s) {
    s = s.replace(/^(var|const)\s+/, "");
    const m = s.match(new RegExp("^(.+?)(?:\\s+(" + GTYPES + "))?(?:\\s*=\\s*(.+))?$"));
    if (!m) bad("deklarasi tidak dikenali");
    const ns = m[1].split(",").map((x) => x.trim());
    ns.forEach((n) => { if (!ID.test(n)) bad("nama variabel tidak valid: " + n); vars.add(n); if (/^float/.test(m[2] || "")) fl.add(n); });
    if (m[3]) {
      const rs = splitTop(m[3]);
      if (rs.length !== ns.length) bad("jumlah variabel dan nilai tidak sama");
      ns.forEach((n, k) => { if (!m[2] && isF(rs[k])) fl.add(n); js.push(n + " = " + gx(rs[k]) + ";"); });
    } else {
      const z = m[2] === "string" ? '""' : m[2] === "bool" ? "false" : "0";
      ns.forEach((n) => js.push(n + " = " + z + ";"));
    }
  }
  function simple(s) {
    let m;
    if ((m = s.match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*:=\s*(.+)$/))) {
      const ns = m[1].split(",").map((x) => x.trim()), rs = splitTop(m[2]);
      if (ns.length !== rs.length) bad("jumlah variabel dan nilai tidak sama");
      ns.forEach((n, k) => { vars.add(n); if (isF(rs[k])) fl.add(n); });
      return ns.length === 1 ? ns[0] + " = " + gx(rs[0]) : "[" + ns.join(",") + "] = [" + rs.map(gx).join(",") + "]";
    }
    if ((m = s.match(/^([A-Za-z_]\w*)\s*(\+|-|\*|\/|%)=\s*(.+)$/))) { vars.add(m[1]); return m[1] + " = " + gx(m[1] + " " + m[2] + " (" + m[3] + ")"); }
    if ((m = s.match(/^([A-Za-z_]\w*)(\+\+|--)$/))) { vars.add(m[1]); return s; }
    if ((m = s.match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*=\s*(.+)$/))) {
      const ns = m[1].split(",").map((x) => x.trim()), rs = splitTop(m[2]);
      if (ns.length !== rs.length) bad("jumlah variabel dan nilai tidak sama");
      ns.forEach((n) => vars.add(n));
      return ns.length === 1 ? ns[0] + " = " + gx(rs[0]) : "[" + ns.join(",") + "] = [" + rs.map(gx).join(",") + "]";
    }
    return null;
  }
  const G = " if (++__g > 100000) throw new Error('Perulangan tidak berhenti');";
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], s = stripC(raw).trim();
    if (!s) continue;
    try {
      let m, r, o = null;
      if (inImp) { if (s === ")") inImp = false; continue; }
      if (inVar) { if (s === ")") inVar = ""; else declGo(inVar + " " + s); continue; }
      if (/^package\b/.test(s)) continue;
      if (/^import\b/.test(s)) { if (/\($/.test(s)) inImp = true; continue; }
      if ((m = s.match(/^(var|const)\s*\($/))) { inVar = m[1]; continue; }
      if (/^(var|const)\b/.test(s)) { declGo(s); continue; }
      if (/^func\b/.test(s)) { if (!/^func\s+main\s*\(\s*\)\s*\{$/.test(s)) bad("hanya func main() yang didukung"); depth = 1; started = true; continue; }
      if (!started) bad("di luar func main() hanya boleh package, import, var, const");
      if (s[0] === "}") { depth--; if (depth === 0) { started = false; continue; } }
      if (s === "}") o = "}";
      else if ((m = s.match(/^\}\s*else\s+if\s+(.+?)\s*\{$/))) o = "} else if (" + gx(m[1]) + ") {";
      else if (/^\}\s*else\s*\{$/.test(s)) o = "} else {";
      else if ((m = s.match(/^if\s+(.+?)\s*\{$/))) o = "if (" + gx(m[1]) + ") {";
      else if ((m = s.match(/^for\s*(.*?)\s*\{$/))) {
        const body = m[1];
        if (body === "") o = "while (true) {" + G;
        else if ((r = body.match(/^(\w+)\s*:=\s*range\s+(.+)$/))) { vars.add(r[1]); o = "for (" + r[1] + " = 0; " + r[1] + " < (" + gx(r[2]) + "); " + r[1] + "++) {" + G; }
        else if (body.includes(";")) {
          const p = body.split(";").map((x) => x.trim());
          if (p.length !== 3) bad("bentuk for tidak valid");
          const ini = p[0] ? simple(p[0]) : "", po = p[2] ? simple(p[2]) : "";
          if (ini === null || po === null) bad("bentuk for tidak valid");
          o = "for (" + ini + "; " + (p[1] ? gx(p[1]) : "") + "; " + po + ") {" + G;
        } else o = "while (" + gx(body) + ") {" + G;
      }
      else if (s === "break" || s === "continue") o = s + ";";
      else if ((m = s.match(/^fmt\.(Println|Print)\((.*)\)$/))) {
        const a = splitTop(m[2]).map(gx);
        o = m[1] === "Println" ? "__w([" + a.map((x) => "__fmt(" + x + ")").join(",") + "].join(' ') + '\\n');" : "__w(__pr([" + a.join(",") + "]));";
      }
      else if ((m = s.match(/^fmt\.Printf\((.*)\)$/))) o = "__w(__pf(" + splitTop(m[1]).map(gx).join(",") + "));";
      else if ((m = s.match(/^fmt\.(Scan|Scanln|Scanf)\((.*)\)$/))) {
        const a = splitTop(m[2]); if (m[1] === "Scanf") a.shift();
        o = a.map((x) => { const n = x.replace(/^&/, "").trim(); if (!ID.test(n)) bad("argumen Scan harus berbentuk &variabel"); vars.add(n); return n + " = __next();"; }).join(" ");
      }
      else { r = simple(s); if (r === null) bad("perintah tidak dikenali"); o = (r[0] === "[" ? ";" : "") + r + ";"; }
      js.push(o);
      if (/\{$/.test(s)) depth++;
    } catch (e) { throw new Error("Baris " + (i + 1) + ": " + e.message + " -> " + raw.trim()); }
  }
  if (opts && opts.capture && vars.size) {
    js.push("__vars({" + [...vars].map((n) => JSON.stringify(n) + ": (typeof " + n + " !== 'undefined' ? " + n + " : undefined)").join(", ") + "});");
  }
  return (vars.size ? "let " + [...vars].join(",") + ";" : "") + js.join("\n");
}
function runGo(code, inputText, onVars) {
  const body = translateGo(code, { capture: !!onVars });
  const captured = {};
  const toks = inputText.split(/[\s,;]+/).filter(Boolean).map((t) => (isNaN(t) ? t : Number(t)));
  let k = 0, __g = 0, buf = "";
  const next = () => { if (k >= toks.length) throw new Error("Masukan kurang: program meminta lebih banyak input"); return toks[k++]; };
  const fmt = (v) => (typeof v === "number" && !Number.isInteger(v) ? String(Number(v.toPrecision(12))) : String(v));
  const w = (t) => { buf += t; };
  const pr = (a) => a.map((v, x) => (x > 0 && typeof v !== "string" && typeof a[x - 1] !== "string" ? " " : "") + fmt(v)).join("");
  const idiv = (a, b) => { if (b === 0) throw new Error("panic: integer divide by zero"); return Math.trunc(a / b); };
  const pf = (f, ...a) => { let x = 0; return String(f).replace(/%(-?)(\d*)(?:\.(\d+))?([dfsvtqx%])/g, (_, l, wd, pc, c) => {
    if (c === "%") return "%";
    const v = a[x++]; let t;
    if (c === "d") t = String(Math.trunc(Number(v)));
    else if (c === "f") t = Number(v).toFixed(pc === undefined ? 6 : +pc);
    else if (c === "q") t = JSON.stringify(String(v));
    else if (c === "x") t = Math.trunc(Number(v)).toString(16);
    else t = fmt(v);
    wd = +wd || 0; return l ? t.padEnd(wd) : t.padStart(wd);
  }); };
  new Function("__next", "__w", "__fmt", "__pr", "__pf", "__idiv", "__g", "__vars", body)(next, w, fmt, pr, pf, idiv, 0, (v) => Object.assign(captured, v || {}));
  if (onVars) onVars(captured);
  return buf.replace(/\s+$/, "");
}

const GO_PRESETS = [
  { name: "Contoh (Diskon belanja)", code:
`package main

import "fmt"

func main() {
\tvar belanja, bayar int

\tfmt.Scan(&belanja)

\tif belanja < 100000 {
\t\tbayar = belanja
\t} else if belanja < 200000 {
\t\tbayar = belanja - (belanja * 5 / 100)
\t} else if belanja < 500000 {
\t\tbayar = belanja - (belanja * 10 / 100)
\t} else {
\t\tbayar = belanja - (belanja * 20 / 100)
\t}

\tfmt.Println(bayar)
}`,
    cases: [["50000","50000"],["150000","142500"],["300000","270000"],["600000","480000"]] },
  { name: "New Go", code: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tvar x int\n\tfmt.Scan(&x)\n\tfmt.Println(x)\n}", cases: [["7","7"]] },
  { name: "Contoh (Jumlah lembar 20000)", code:
`package main

import "fmt"

func main() {
\tvar tagihan, jumlahLembar, sisa int

\tfmt.Scan(&tagihan)

\tjumlahLembar = tagihan / 20000
\tsisa = tagihan % 20000

\tif sisa > 0 {
\t\tjumlahLembar = jumlahLembar + 1
\t}

\tfmt.Println(jumlahLembar, "lembar")
}`,
    cases: [["10000","1 lembar"],["20000","1 lembar"],["45000","3 lembar"],["100000","5 lembar"]] },
  { name: "Contoh (Urut naik/turun)", code:
`package main

import "fmt"

func main() {
\tvar a, b, c int

\tfmt.Scan(&a, &b, &c)

\tif a < b && b < c {
\t\tfmt.Println("Naik")
\t} else if a > b && b > c {
\t\tfmt.Println("Turun")
\t} else {
\t\tfmt.Println("Tidak urut")
\t}
}`,
    cases: [["1 2 3","Naik"],["3 2 1","Turun"],["1 3 2","Tidak urut"]] },
];

function Editor({ value, onChange, label }) {
  const gutterRef = useRef(null);
  const count = value.split("\n").length;
  const nums = useMemo(() => Array.from({ length: count }, (_, n) => n + 1).join("\n"), [count]);
  const onScroll = (e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop; };
  return h("div", { className: "editor" },
    h("pre", { className: "gutter", ref: gutterRef, "aria-hidden": "true" }, nums),
    h("textarea", { value, onChange, onScroll, spellCheck: false, wrap: "off", "aria-label": label })
  );
}

function Tester({ title, presets, runner, start, hint }) {
  const [pi, setPi] = useState(start);
  const [code, setCode] = useState(presets[start].code);
  const [cases, setCases] = useState(presets[start].cases.map(([i, e]) => ({ i, e })));

  const pick = (n) => { setPi(n); setCode(presets[n].code); setCases(presets[n].cases.map(([i, e]) => ({ i, e }))); };
  const setCase = (n, f, v) => setCases((cs) => cs.map((c, x) => (x === n ? { ...c, [f]: v } : c)));

  const results = useMemo(() => cases.map((c) => {
    let vars = {};
    try { const got = runner(code, c.i, (v) => { vars = v; }); return { got, ok: same(got, c.e), vars }; }
    catch (e) { return { got: "", ok: false, error: e.message, vars: null }; }
  }), [code, cases]);
  const passed = results.filter((r) => r.ok).length;
  const shown = results.find((r) => r.vars);
  const shownIndex = shown ? results.indexOf(shown) : -1;

  return h("div", { className: "grid" },
    h("section", { className: "panel" },
      h("h2", null, title),
      h("div", { className: "row" }, presets.map((p, n) => h("button", { key: p.name, className: n === pi ? "on" : "", onClick: () => pick(n) }, p.name))),
      h(Editor, { value: code, onChange: (e) => setCode(e.target.value), label: "Editor " + title }),
      h("p", { className: "small" }, hint)
    ),
    h("section", { className: "panel" },
      h("h2", null, "Kasus uji"),
      h("p", { className: "summary", role: "status" }, passed === cases.length && cases.length ? "Semua " + cases.length + " kasus sesuai." : passed + " dari " + cases.length + " kasus sesuai."),
      h("div", { className: "tbl" }, h("table", null,
        h("thead", null, h("tr", null, ["Masukan", "Diharapkan", "Hasil", "Status", ""].map((t, n) => h("th", { key: n }, t)))),
        h("tbody", null, cases.map((c, n) => h("tr", { key: n },
          h("td", null, h("input", { type: "text", value: c.i, "aria-label": "Masukan kasus " + (n + 1), onChange: (e) => setCase(n, "i", e.target.value) })),
          h("td", null, h("input", { type: "text", value: c.e, "aria-label": "Keluaran diharapkan kasus " + (n + 1), onChange: (e) => setCase(n, "e", e.target.value) })),
          h("td", { className: "m" }, results[n].got || "-", results[n].error && h("div", { className: "err" }, results[n].error)),
          h("td", null, h("span", { className: "badge " + (results[n].ok ? "pass" : "fail") }, results[n].ok ? "Sesuai" : "Tidak sesuai")),
          h("td", null, h("button", { onClick: () => setCases((cs) => cs.filter((_, x) => x !== n)), "aria-label": "Hapus kasus " + (n + 1) }, "×"))))))),
      h("div", { className: "row b" }, h("button", { onClick: () => setCases((cs) => [...cs, { i: "", e: "" }]) }, "Tambah kasus")),
      h("p", { className: "small" }, "Beberapa masukan dipisah spasi atau koma, misalnya 3 5. Angka desimal dibandingkan dengan toleransi kecil.")
    ),
    h("section", { className: "panel vars-panel" },
      h("h2", null, "Nilai variabel"),
      h("p", { className: "small" },
        !shown ? "Nilai variabel belum tersedia."
          : !Object.keys(shown.vars).length ? "Tidak ada variabel."
          : "Nilai variabel setelah kasus uji " + (shownIndex + 1) + " dijalankan (masukan: " + (cases[shownIndex].i.trim() || "kosong") + ")."),
      h("div", { className: "vars" },
        shown && Object.keys(shown.vars).map((k) => h("div", { className: "var-chip", key: k },
          h("span", { className: "var-name" }, k),
          h("span", { className: "var-val" }, fmtVar(shown.vars[k])))))
    )
  );
}

const PSEUDO_HINT = "Didukung: program/kamus/algoritma, constant, deklarasi tipe, input(a, b) atau BACA, output(x) atau CETAK, <- atau ←, JIKA…MAKA/JIKA TIDAK/AKHIR JIKA, SELAMA…LAKUKAN, UNTUK i <- 1 SAMPAI n LAKUKAN, mod, div, DAN/ATAU. Padanan Inggris (if/then/else/while/for/to/do) juga bisa.";
const GO_HINT = "Didukung: package main, import, func main(), var/const/:=, fmt.Scan/Scanln/Scanf(&a, &b), fmt.Println/Print/Printf, if/else if/else, for (3 bentuk, gaya while, range n), break/continue, += -= ++ --, math.Sqrt dkk., float64()/int(). Pembagian int/int dibulatkan seperti Go. Belum didukung: fungsi lain, array/slice, map, struct, switch, bufio.";
const TABS = ["1. Cek pseudocode", "2. Cek Golang"];

function rich(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((t, n) => {
    if (t.startsWith("**") && t.endsWith("**")) return h("strong", { key: n }, t.slice(2, -2));
    if (t.startsWith("*") && t.endsWith("*")) return h("em", { key: n }, t.slice(1, -1));
    return t;
  });
}

const INTRO = "Halo mahasiswa PJJ BS1IF-50-PJJ-01! Di saat orang lain tidur nyenyak, kamu justru panik berjamaah melihat *deadline* kantor yang balapan sama *deadline* tugas yang tinggal menghitung detik. Kalau ujung-ujungnya resmi menyandang gelar **Sahabat Remed**, santai saja—setidaknya kamu sudah berjuang di dua alam sekaligus. Tarik napas dulu, lalu hadapi tumpukan ini dengan tabah, karena cicilan dan UKT tidak peduli seberapa capek kamu hari ini.";

export default function App() {
  const [tab, setTab] = useState(0);
  return h("div", null,
    h("h1", null, "Code Checker"),
    h("p", { className: "sub" }, rich(INTRO)),
    h("div", { className: "tabs", role: "tablist", "aria-label": "Jenis kode" }, TABS.map((t, n) =>
      h("button", { key: n, role: "tab", id: "tab-" + n, "aria-selected": tab === n, "aria-controls": "panel-" + n, className: tab === n ? "on" : "", onClick: () => setTab(n) }, t))),
    h("div", { role: "tabpanel", id: "panel-0", "aria-labelledby": "tab-0", hidden: tab !== 0 },
      h(Tester, { title: "Pseudocode", presets: PRESETS, runner: run, start: 1, hint: PSEUDO_HINT })),
    h("div", { role: "tabpanel", id: "panel-1", "aria-labelledby": "tab-1", hidden: tab !== 1 },
      h(Tester, { title: "Kode Go", presets: GO_PRESETS, runner: runGo, start: 1, hint: GO_HINT }))
  );
}

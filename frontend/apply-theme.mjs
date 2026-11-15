// One-time converter: swaps the fixed dark colors in your css/tsx files for the shared variables in theme.css.
//   node apply-theme.mjs src
// Safe to run twice. Commit your work first so you can undo with git if you don't like the result.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const MAP = {
  "#0f0f0f": "var(--bg)", "#141414": "var(--card)", "#101010": "var(--bg2)",
  "#181818": "var(--hover)", "#1a1a1a": "var(--hover)", "#1c1c1c": "var(--seg)",
  "#1f1f1f": "var(--bd2)", "#232323": "var(--bd2)", "#2a2a2a": "var(--bd)",
  "#5b5b5b": "var(--mut)", "#8b8b8b": "var(--mut)", "#a3a3a3": "var(--mut2)",
  "#c4c4c4": "var(--tx2)", "#cfcfcf": "var(--tx2)", "#d6d6d6": "var(--tx2)", "#f2f2f2": "var(--tx)",
  "#b9a5ff": "var(--link)", "#4ade80": "var(--ok)", "#fbbf24": "var(--warn)",
  "#f87171": "var(--err)", "#ef4444": "var(--err)",
  "#2a2150": "var(--chip)", "#1c1830": "var(--hero1)", "#15131f": "var(--hero2)",
};
// Login.tsx keeps its own theme code and is left alone, unless you run:  node apply-theme.mjs src --login
const withLogin = process.argv.includes("--login");
const SKIP = new Set(["theme.css", "theme.tsx", ...(withLogin ? [] : ["Login.tsx"])]);
const KEEP = new Set(["#fff", "#ffffff", "#111", "#7c5cff", "#9b7bff", "#5a3bd6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#14b8a6"]);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|tsx)$/.test(n) && !SKIP.has(n)) out.push(p);
  }
  return out;
}

const root = process.argv[2];
if (!root) { console.log("Usage: node apply-theme.mjs src"); process.exit(1); }

const leftovers = new Map();
let changed = 0;

for (const file of walk(root)) {
  const src = readFileSync(file, "utf8");
  const isCss = file.endsWith(".css");
  let out = src
    // local copies of the shared variables would hide the theme, drop them
    .replace(/--(?:bg|card|bd|tx|mut|seg|btn|btx)\s*:\s*#[0-9a-fA-F]{3,6}\s*;?/g, "")
    // primary button: white in dark mode, dark in light mode
    .replace(/background:\s*#fff;\s*color:\s*#111;\s*border-color:\s*#fff/g, "background:var(--btn);color:var(--btx);border-color:var(--btn)")
    .replace(/solid #fff\b/g, "solid var(--tx)")
    .replace(/rgba\(15,\s*15,\s*15,\s*\.9\)/g, "color-mix(in srgb,var(--bg) 90%,transparent)");

  // color choices stored as data (e.g. the group color palette) must stay real hex values
  out = out
    .split("\n")
    .map((line) => (!isCss && /const COLORS\b/.test(line) ? line : line.replace(/#[0-9a-fA-F]{6}\b/g, (m) => MAP[m.toLowerCase()] ?? m)))
    .join("\n");

  for (const m of out.matchAll(/#[0-9a-fA-F]{3,6}\b/g)) {
    const h = m[0].toLowerCase();
    if (!KEEP.has(h)) leftovers.set(`${basename(file)} ${h}`, 1);
  }
  if (out !== src) { writeFileSync(file, out); changed++; console.log("updated", file); }
}

console.log(`\nDone. ${changed} file(s) updated.`);
if (leftovers.size) console.log("Colors left as they are (check these if something looks wrong in light mode):\n  " + [...leftovers.keys()].join("\n  "));

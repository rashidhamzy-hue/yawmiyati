/**
 * Language guard for the five storefronts (run in CI with `bun scripts/check-market-dictionaries.ts`).
 * Fails when:
 *   1. a market's dictionary misses a key another market has, or holds an empty value;
 *   2. Latin letters leak into customer-facing Arabic text (a short allow-list covers real needs);
 *   3. banned wording appears: M9 placeholders, supplier identity, invented urgency or savings;
 *   4. one market's dialect markers appear in another market's dictionary;
 *   5. new hard-coded Arabic sentences are added to storefront components instead of the dictionary
 *      (a per-file ceiling that may only go down).
 * No network, no build needed. `--report` prints every finding and the hard-coded counts without failing.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { marketDictionary } from "../src/lib/store/dictionary";
import { markets, type MarketCode } from "../src/lib/store/markets";

const MARKETS = Object.keys(markets) as MarketCode[];
const report = process.argv.includes("--report");
const problems: string[] = [];
const fail = (m: string) => problems.push(m);

// ---- 1. Flatten: every string, and every function called with sample arguments ----
type Entry = { key: string; text: string };
function flatten(value: unknown, key: string, out: Entry[]): Entry[] {
  if (typeof value === "string") out.push({ key, text: value });
  else if (typeof value === "function") {
    let text = "";
    try { text = String((value as (...a: unknown[]) => unknown)(value.length && /count|n\b|i\b/.test(String(value)) ? 3 : "٣", 5)); }
    catch { try { text = String((value as (...a: unknown[]) => unknown)(3, 5)); } catch { text = ""; } }
    out.push({ key: key + "()", text });
  } else if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${key}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) flatten(v, key ? `${key}.${k}` : k, out);
  return out;
}
const dict = Object.fromEntries(MARKETS.map((m) => [m, flatten(marketDictionary(m), "", [])])) as Record<MarketCode, Entry[]>;

// Keys are compared by shape; list items are compared by position count per list.
const shape = (entries: Entry[]) => new Set(entries.map((e) => e.key.replace(/\[\d+\]/g, "[]")));
const all = new Set(MARKETS.flatMap((m) => [...shape(dict[m])]));
// Values that are data, not prose: slugs, picture keys and other identifiers.
const DATA_KEY = /(^|\.)(heroImage|categoryOrder\[\d+\]|slug|image|id|href|icon)$|categoryCaptions\.[a-z]+$|categoryOrder/;
for (const m of MARKETS) {
  const have = shape(dict[m]);
  for (const k of all) if (!have.has(k)) fail(`[missing] ${m}: no "${k}" (another market has it)`);
  for (const e of dict[m]) if (!e.text.trim() && !e.key.endsWith("()")) fail(`[empty] ${m}.${e.key}`);
}

// ---- 2. Latin leaks ----
const LATIN_OK = /\b(?:COD|SMS|WhatsApp)\b/g; // none of these appear today; listed so a deliberate use is an explicit decision
for (const m of MARKETS) for (const e of dict[m]) {
  if (DATA_KEY.test(e.key)) continue;
  const stripped = e.text.replace(LATIN_OK, "").replace(/https?:\/\/\S+/g, "");
  const hit = stripped.match(/[A-Za-z]{2,}/);
  if (hit) fail(`[latin] ${m}.${e.key}: "${hit[0]}" in "${e.text.slice(0, 70)}"`);
}

// ---- 3. Banned wording (M9, supplier identity, invented urgency or savings) ----
const BANNED: [RegExp, string][] = [
  [/المتوقعة|المتوقّعة/, "M9: 'expected' placeholder"],
  [/سيكون متاحاً|سيكون متاحا|قريباً في يومياتي|قبل بدء استقبال الطلبات|عند بدء استقبال الطلبات/, "M9: future-launch placeholder"],
  [/تاجر\b|Taager|المورّد|المورد|المورِّد|الموزّع المعتمد/i, "supplier identity"],
  [/آخر قطعة|آخر القطع|ينتهي العرض|ينتهي خلال|لفترة محدودة|الكمية تنفد|سارعي|لا تفوّتي|لا تفوتي|عرض اليوم فقط/, "invented urgency"],
  [/خصم \d+ ?٪|خصم ٪|تخفيضات حتى|الأكثر مبيعاً|الأكثر مبيعا|الأعلى تقييماً|\d+ ?تقييم|عميلة سعيدة|ضمان استرجاع المال/, "unproven claim (discount, best seller, ratings, guarantee)"],
  [/شحن مجاني لكل الطلبات|توصيل مجاني لكل الطلبات|توصيل مجاني دائماً/, "blanket free delivery"],
];
for (const m of MARKETS) for (const e of dict[m]) for (const [re, why] of BANNED) if (re.test(e.text)) fail(`[banned] ${m}.${e.key}: ${why}: "${e.text.slice(0, 70)}"`);

// ---- 4. Dialect markers that belong to one market only ----
const B = "(?<![\\u0600-\\u06FF\\u0750-\\u077F])", A = "(?![\\u0600-\\u06FF\\u0750-\\u077F])"; // Arabic word boundaries
const word = (list: string) => new RegExp(B + "(?:" + list + ")" + A);
const DIALECT: { owner: MarketCode[]; name: string; re: RegExp }[] = [
  { owner: ["iq"], name: "Iraqi", re: /چ|گ|ڤ/ },
  { owner: ["iq"], name: "Iraqi", re: word("شنو|هسه|هسة|ماكو|أكو|اكو|ويه|هواي|شكد|بيچ|مو متوفر|يمته|هاي") },
  { owner: ["iq", "ae"], name: "Iraqi/Emirati", re: word("شلون") },
  { owner: ["eg"], name: "Egyptian", re: word("دلوقتي|ازاي|إزاي|كده|كدا|مش|إيه|ايه|بتاع|بتاعة|اتفرّجي|اتفرجي|تاني|تانية|كمان|لسه|هنكلمك|مفيش|مافيهاش|مبقتش|مستنية|أوي|دي|ده|بتدوّري|بتدوري") },
  { owner: ["eg", "sa", "ae", "om"], name: "not Iraqi", re: word("عشان|علشان") },
  { owner: ["ae"], name: "Emirati", re: word("شو|هني|وايد|مب|ويا|وياج|يومج|ذوقج|بيتج|سلتج|طلبج|عليج|حياتج|عالمج|يعجبج|يناسبج|اختيارج|تفضيلاتج|بياناتج|اختياراتج|ودّج|ودج|بنتواصل|تلاقين") },
  { owner: ["sa", "om"], name: "Saudi/Omani", re: word("وش|أبغى|ابغى|تبين") },
  { owner: ["sa", "ae", "om"], name: "Gulf", re: word("الحين") },
];
for (const m of MARKETS) for (const e of dict[m]) {
  if (DATA_KEY.test(e.key)) continue;
  for (const d of DIALECT) {
    if (d.owner.includes(m)) continue;
    const hit = e.text.match(d.re);
    if (hit) fail(`[dialect] ${m}.${e.key}: ${d.name} wording "${hit[0]}" in "${e.text.slice(0, 70)}"`);
  }
}

// ---- 5. Hard-coded Arabic in storefront components: a ceiling per file that may only go down ----
const ARABIC = /[؀-ۿ]/;
function hardcoded(file: string): number {
  let n = 0;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (/^\s*(\*|\/\*)/.test(line)) continue;
    n += (code.match(/(["'`>])[^"'`<>{}]*[؀-ۿ][^"'`<>{}]*(?=["'`<])/g) ?? []).filter((s) => ARABIC.test(s)).length;
  }
  return n;
}
/** Sentences still written inside components on 28 Nov 2026. Lower a number when you move text to the dictionary; never raise one. */
const CEILING: Record<string, number> = JSON.parse(readFileSync(join(import.meta.dir, "market-dictionary-ceiling.json"), "utf8"));
const dirs = ["src/components/store", "src/components/analytics"];
const counts: Record<string, number> = {};
for (const dir of dirs) for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
  const n = hardcoded(join(dir, f));
  if (n) counts[join(dir, f)] = n;
}
counts["src/routes/__root.tsx"] = hardcoded("src/routes/__root.tsx");
for (const [file, n] of Object.entries(counts)) {
  const max = CEILING[file] ?? 0;
  if (n > max) fail(`[hard-coded] ${file}: ${n} Arabic strings in the component (ceiling ${max}). Put customer-facing text in the market dictionary.`);
}

if (report) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1])), null, 1));
  console.log(`dictionary strings per market: ${MARKETS.map((m) => m + " " + dict[m].length).join(", ")}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\nMarket dictionary guard: ${problems.length} problem(s).`);
  if (!report) process.exit(1);
} else console.log(`Market dictionary guard passed: ${MARKETS.length} markets, ${dict.sa.length} strings each, no missing keys, Latin leaks, banned wording or mixed dialect.`);

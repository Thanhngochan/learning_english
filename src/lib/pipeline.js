import { franc } from "franc-min";
import { stemmer } from "stemmer";
import * as stopword from "stopword";

/** ISO 639-3 code -> label and BCP-47 locale (for Intl.Segmenter). */
export const LANGUAGES = {
  eng: ["English", "en"], vie: ["Tiếng Việt", "vi"], zho: ["中文", "zh"], jpn: ["日本語", "ja"],
  kor: ["한국어", "ko"], spa: ["Español", "es"], fra: ["Français", "fr"], deu: ["Deutsch", "de"],
  ita: ["Italiano", "it"], por: ["Português", "pt"], rus: ["Русский", "ru"], ind: ["Bahasa Indonesia", "id"],
  tha: ["ไทย", "th"], ara: ["العربية", "ar"], hin: ["हिन्दी", "hi"],
};
const ALIAS = { cmn: "zho", arb: "ara", und: "eng" };
const stopCache = new Map();

export function detectLanguage(text) {
  const code = franc(text, { minLength: 10 });
  return ALIAS[code] || code;
}

function stopSet(lang) {
  if (!stopCache.has(lang)) stopCache.set(lang, new Set(stopword[lang] || []));
  return stopCache.get(lang);
}

function segment(text, lang) {
  const locale = LANGUAGES[lang]?.[1];
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter(locale, { granularity: "word" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return text.split(/(\s+|[^\p{L}\p{N}\s']+)/u).filter(Boolean);
}

const isWord = (s) => /[\p{L}\p{N}]/u.test(s);

/**
 * Run the five text-processing steps and pick the core vocabulary.
 * @param {string} text
 * @param {string} langSel "auto" or an ISO 639-3 code
 * @param {number} pct share of distinct words to learn, in percent
 */
export function analyse(text, langSel = "auto", pct = 20) {
  const lang = langSel === "auto" ? detectLanguage(text) : langSel;
  const stop = stopSet(lang);
  const stem = lang === "eng" ? stemmer : (w) => w;

  const lower = text.toLowerCase();                              // 1. lowercasing
  const tokens = segment(lower, lang).filter((s) => s.trim());   // 2. tokenization
  const noPunct = tokens.filter(isWord);                         // 3. removing punctuation
  const noStop = noPunct.filter((w) => !stop.has(w));            // 4. removing stop words
  const stems = noStop.map(stem);                                // 5. stemming

  const byStem = new Map();
  noStop.forEach((w, i) => {
    const key = stems[i];
    let e = byStem.get(key);
    if (!e) byStem.set(key, (e = { key, count: 0, forms: {} }));
    e.count++;
    e.forms[w] = (e.forms[w] || 0) + 1;
  });
  const sorted = [...byStem.values()].sort((a, b) => b.count - a.count);
  for (const e of sorted) e.show = Object.keys(e.forms).sort((a, b) => e.forms[b] - e.forms[a])[0];

  const n = sorted.length ? Math.max(1, Math.ceil((sorted.length * pct) / 100)) : 0;
  const core = sorted.slice(0, n);
  const coreSet = new Set(core.map((e) => e.key));
  const total = noStop.length;
  const covered = core.reduce((sum, e) => sum + e.count, 0);

  // t: 0 punctuation/space, 1 stop word, 2 core word, 3 other word
  const segs = segment(text, lang).map((s) => {
    if (!isWord(s)) return { s, t: 0 };
    const l = s.toLowerCase();
    if (stop.has(l)) return { s, t: 1 };
    const k = stem(l);
    return coreSet.has(k) ? { s, t: 2, k } : { s, t: 3 };
  });
  const sentences = text.split(/(?<=[.!?。！？])\s*/).filter((x) => x.trim());

  return { lang, lower, tokens, noPunct, noStop, stems, sorted, n, core, total, covered, segs, sentences };
}

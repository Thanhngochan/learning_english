import { useEffect, useMemo, useState } from "react";
import { LANGUAGES, analyse } from "./lib/pipeline.js";
import { askClaude, parseJSONArray } from "./lib/claude.js";

const LANGS = [["auto", "Auto-detect"], ...Object.entries(LANGUAGES).map(([code, v]) => [code, v[0]])];
const BATCH = 12;

export default function App() {
  const [topic, setTopic] = useState("");
  const [articles, setArticles] = useState([]);
  const [sort, setSort] = useState("match");
  const [source, setSource] = useState("");
  const [picked, setPicked] = useState(null);
  const [text, setText] = useState("");
  const [langSel, setLangSel] = useState("auto");
  const [pct, setPct] = useState(20);
  const [gloss, setGloss] = useState({});
  const [learned, setLearned] = useState({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const r = useMemo(() => analyse(text, langSel, pct), [text, langSel, pct]);
  const cov = r.total ? Math.round((r.covered / r.total) * 100) : 0;
  const shown = useMemo(() => {
    if (sort === "match") return articles;
    const a = [...articles].sort((x, y) => String(y.date).localeCompare(String(x.date)));
    return sort === "newest" ? a : a.reverse();
  }, [articles, sort]);

  async function search(q = topic) {
    q = q.trim();
    if (q.length < 2) return;
    setBusy("search"); setErr("");
    try {
      const res = await fetch("/api/search?q=" + encodeURIComponent(q));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "HTTP " + res.status + ". Is the API server running (npm run dev)?");
      setArticles(data.results); setSource(data.source);
      if (!data.results.length) setErr("No journal articles found for this word. Try another spelling or a related term.");
    } catch (e) {
      setErr("Search failed: " + e.message);
    }
    setBusy("");
  }

  // Search as you type: wait until typing pauses, so each word costs one request.
  useEffect(() => {
    if (topic.trim().length < 3) return;
    const timer = setTimeout(() => search(topic), 600);
    return () => clearTimeout(timer);
  }, [topic]);

  function open(a) {
    setPicked(a); setGloss({}); setText(a.abstract);
  }

  const sentenceOf = (e) => {
    const forms = Object.keys(e.forms);
    return r.sentences.find((s) => { const l = s.toLowerCase(); return forms.some((f) => l.includes(f)); }) || "";
  };

  async function translate() {
    if (busy) return;
    const todo = r.core.filter((e) => !gloss[e.key]).slice(0, BATCH);
    if (!todo.length) return;
    setBusy("gloss"); setErr("");
    try {
      const t = await askClaude(
        `Reading passage:\n"""${text.slice(0, 4000)}"""\n
For each word below, give its meaning AS USED IN THIS PASSAGE (not a general dictionary list).
Words: ${todo.map((e) => e.show).join(", ")}
Reply with ONLY a JSON array, same order, no other text. Each item: {"word": string, "vi": Vietnamese translation fitting the context, "zh": Simplified Chinese translation fitting the context, "pinyin": pinyin with tone marks, "en": English definition under 14 words}.`);
      const list = parseJSONArray(t);
      const g = { ...gloss };
      todo.forEach((e, i) => {
        const hit = list.find((x) => String(x.word).toLowerCase() === e.show) || list[i];
        if (hit) g[e.key] = hit;
      });
      setGloss(g);
    } catch (e) {
      setErr("Translation failed: " + e.message);
    }
    setBusy("");
  }

  const toggle = (k) => setLearned((o) => { const c = { ...o }; if (c[k]) delete c[k]; else c[k] = 1; return c; });
  const chips = (a) => a.slice(0, 30).map((w, i) => (
    <span key={i} className="inline-block bg-slate-100 text-slate-700 rounded px-1 mr-1 mb-1">{w}</span>
  ));
  const steps = [
    ["Lowercasing", r.lower.slice(0, 160)],
    ["Tokenization: " + r.tokens.length + " tokens", chips(r.tokens)],
    ["Removing punctuation: " + r.noPunct.length + " left", chips(r.noPunct)],
    ["Removing stop words: " + r.noStop.length + " left", chips(r.noStop)],
    [(r.lang === "eng" ? "Stemming: " : "Word forms kept as is: ") + r.sorted.length + " distinct words", chips(r.stems)],
  ];
  const pending = r.core.filter((e) => !gloss[e.key]).length;
  const doneN = r.core.filter((e) => learned[e.key]).length;
  const btn = "px-3 py-2 rounded-md text-sm font-medium border border-slate-300 hover:border-slate-900 disabled:opacity-50";
  const card = "bg-white border border-slate-200 rounded-lg p-5 mb-5";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          Learn <span className="bg-yellow-300 px-1 rounded">{pct}% of the words</span>, understand most of the text
        </h1>
        <p className="text-slate-600 mb-6 max-w-2xl">
          Find research articles on a topic, pick out the words most worth learning, then see their Vietnamese and Chinese meanings and an English definition as used in the text.
        </p>

        <div className={card}>
          <h2 className="font-semibold mb-3">Search journal articles</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 bg-slate-50"
              style={{ minWidth: "14rem" }}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") search(); }}
              placeholder="Type a word, for example: fraud"
              aria-label="Search journal articles"
            />
            <select className="border border-slate-300 rounded-md px-2 bg-slate-50 text-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort results">
              <option value="match">Best match</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button className={btn + " bg-slate-900 text-white border-slate-900"} onClick={() => search()} disabled={busy === "search" || topic.trim().length < 2}>
              {busy === "search" ? "Searching…" : "Search"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Journal articles with an abstract only{source ? ", from " + source : ""}. Match shows how close each result is to the best one.
          </p>
          {err && <p className="text-sm text-red-700 mt-3">{err}</p>}
          {shown.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-200">
              {shown.map((a) => (
                <li key={a.id} className="py-3 flex flex-wrap gap-3 items-start justify-between">
                  <div className="flex-1" style={{ minWidth: "14rem" }}>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-slate-600">
                      <span className="inline-block rounded px-1 mr-2 text-xs bg-teal-100 text-teal-900">Match {a.match}%</span>
                      {a.journal}{a.date ? ", " + a.date : ""}, cited {a.citations} times
                    </div>
                    <a className="text-sm text-indigo-700 underline break-all" href={a.url} target="_blank" rel="noreferrer">Open original article</a>
                  </div>
                  <button className={btn} onClick={() => open(a)}>Study this article</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h2 className="font-semibold mb-1">Reading text</h2>
          <p className="text-sm text-slate-500 mb-3">
            {picked ? "Abstract of: " + picked.title : "Choose an article above, or paste your own text here."}
          </p>
          <textarea
            className="w-full border border-slate-300 rounded-md p-3 bg-slate-50 font-serif text-base leading-relaxed"
            style={{ minHeight: "8rem" }}
            value={text}
            onChange={(e) => { setText(e.target.value); setGloss({}); }}
            placeholder="Paste a text here…"
            aria-label="Reading text"
          />
          <div className="flex flex-wrap gap-3 items-center mt-3 text-sm">
            <label htmlFor="lang" className="text-slate-600">Language</label>
            <select id="lang" className="border border-slate-300 rounded-md px-2 py-1 bg-slate-50" value={langSel} onChange={(e) => setLangSel(e.target.value)}>
              {LANGS.map((l) => <option key={l[0]} value={l[0]}>{l[1]}</option>)}
            </select>
            <label htmlFor="pct" className="text-slate-600">Share of words to learn: {pct}%</label>
            <input id="pct" type="range" min="5" max="60" step="5" value={pct} onChange={(e) => setPct(+e.target.value)} />
          </div>
        </div>

        {r.sorted.length > 0 && (
          <div>
            <div className={card}>
              <h2 className="font-semibold mb-3">The 5 processing steps</h2>
              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-none w-7 h-7 rounded-full bg-slate-900 text-white text-sm font-semibold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="font-medium">{s[0]}</div>
                      <div className="text-sm text-slate-500 break-words overflow-hidden" style={{ maxHeight: "3.6rem" }}>{s[1]}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className={card}>
              <h2 className="font-semibold mb-2">Text with core words highlighted</h2>
              <p className="mb-4">
                Learning <b className="bg-yellow-300 px-1 rounded">{r.n} words</b> out of {r.sorted.length} distinct words covers{" "}
                <b className="bg-yellow-300 px-1 rounded">{cov}%</b> of the meaningful words in the text.
              </p>
              <div className="font-serif text-lg leading-loose whitespace-pre-wrap break-words max-w-3xl">
                {r.segs.map((g, i) =>
                  g.t === 2 ? (
                    <button
                      key={i}
                      onClick={() => toggle(g.k)}
                      title={gloss[g.k] ? gloss[g.k].vi + " / " + gloss[g.k].zh : "Select to mark as learned"}
                      className={"rounded px-1 " + (learned[g.k] ? "bg-teal-100" : "bg-yellow-300")}
                    >{g.s}</button>
                  ) : g.t === 1 ? <span key={i} className="text-slate-400">{g.s}</span> : g.s
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3">Yellow: words to learn. Green: learned. Faded: stop words. Select a word to mark it.</p>
            </div>

            <div className={card}>
              <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
                <h2 className="font-semibold">Words to learn: {doneN} of {r.n} learned</h2>
                <button className={btn + " bg-slate-900 text-white border-slate-900"} onClick={translate} disabled={!!busy || !pending}>
                  {busy === "gloss" ? "Translating…" : pending ? "Translate next " + Math.min(BATCH, pending) + " words in context" : "All translated"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: "46rem" }}>
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="p-2">Learned</th><th className="p-2">Word</th><th className="p-2 text-right">Count</th>
                      <th className="p-2">Vietnamese</th><th className="p-2">Chinese</th><th className="p-2">English definition</th><th className="p-2">Sentence in the text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.core.map((e) => {
                      const g = gloss[e.key];
                      return (
                        <tr key={e.key} className="border-b border-slate-100 align-top">
                          <td className="p-2"><input type="checkbox" checked={!!learned[e.key]} onChange={() => toggle(e.key)} aria-label={"Learned " + e.show} /></td>
                          <td className={"p-2 font-medium " + (learned[e.key] ? "line-through text-teal-700" : "")}>{e.show}</td>
                          <td className="p-2 text-right">{e.count}</td>
                          <td className="p-2">{g ? g.vi : "…"}</td>
                          <td className="p-2">{g ? <span>{g.zh} <span className="text-slate-500">{g.pinyin}</span></span> : "…"}</td>
                          <td className="p-2">{g ? g.en : "…"}</td>
                          <td className="p-2 text-slate-600 font-serif">{sentenceOf(e)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Scholarly search sources. Each returns the same shape so the app does not care which one answered.

const clean = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** OpenAlex stores abstracts as {word: [positions]}; rebuild the text. */
export function abstractFromIndex(index) {
  if (!index) return "";
  const words = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(" ");
}

export function fromOpenAlex(w) {
  return {
    id: w.id,
    title: clean(w.title),
    journal: w.primary_location?.source?.display_name || "",
    date: w.publication_date || "",
    url: w.doi || w.primary_location?.landing_page_url || w.id,
    citations: w.cited_by_count ?? 0,
    abstract: clean(abstractFromIndex(w.abstract_inverted_index)),
    score: w.relevance_score ?? 0,
  };
}

export function fromCrossref(w) {
  const parts = w.issued?.["date-parts"]?.[0] || [];
  const date = parts.length ? [parts[0], parts[1] || 1, parts[2] || 1].map((n, i) => String(n).padStart(i ? 2 : 4, "0")).join("-") : "";
  return {
    id: w.DOI,
    title: clean(w.title?.[0]),
    journal: clean(w["container-title"]?.[0]),
    date,
    url: w.URL || "https://doi.org/" + w.DOI,
    citations: w["is-referenced-by-count"] ?? 0,
    abstract: clean(w.abstract).replace(/^abstract\s*/i, ""),
    score: w.score ?? 0,
  };
}

/** Add match = 0..100 relative to the best hit, and drop items with no title or abstract. */
export function rank(items) {
  const usable = items.filter((a) => a.title && a.abstract.length > 200);
  const top = Math.max(...usable.map((a) => a.score), 0) || 1;
  return usable
    .map((a) => ({ ...a, match: Math.round((a.score / top) * 100) }))
    .sort((a, b) => b.match - a.match);
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": "vocab-core/1.0" } });
  if (!res.ok) throw new Error("Search source returned HTTP " + res.status);
  return res.json();
}

export async function searchOpenAlex(q, key) {
  const p = new URLSearchParams({
    search: q,
    filter: "type:article,primary_location.source.type:journal,has_abstract:true",
    per_page: "25",
    api_key: key,
  });
  const data = await getJSON("https://api.openalex.org/works?" + p);
  return rank((data.results || []).map(fromOpenAlex));
}

export async function searchCrossref(q, mailto) {
  const p = new URLSearchParams({ query: q, filter: "type:journal-article,has-abstract:true", rows: "25" });
  if (mailto) p.set("mailto", mailto);
  const data = await getJSON("https://api.crossref.org/works?" + p);
  return rank((data.message?.items || []).map(fromCrossref));
}

import assert from "node:assert/strict";
import { abstractFromIndex, fromCrossref, fromOpenAlex, rank } from "../server/sources.js";

assert.equal(abstractFromIndex({ fraud: [1], Detecting: [0], early: [2] }), "Detecting fraud early");
const long = "x ".repeat(150);
const a = fromOpenAlex({ id: "W1", title: "A", publication_date: "2026-01-02", relevance_score: 10, abstract_inverted_index: Object.fromEntries(long.trim().split(" ").map((w, i) => ["w" + i, [i]])), primary_location: { source: { display_name: "Nature" } } });
assert.equal(a.journal, "Nature");
const c = fromCrossref({ DOI: "10.1/x", title: ["B"], "container-title": ["Science"], issued: { "date-parts": [[2025, 3]] }, abstract: "<jats:p>Abstract " + long + "</jats:p>", score: 5 });
assert.equal(c.date, "2025-03-01");
assert.ok(!c.abstract.includes("<"));
const r = rank([c, a, { title: "no abstract", abstract: "", score: 99 }]);
assert.deepEqual(r.map((x) => x.match), [100, 50]);
console.log("source tests passed");

// Your own API. The browser only ever talks to this server;
// the server holds the keys and talks to OpenAlex, Crossref and Anthropic.
import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchCrossref, searchOpenAlex } from "./sources.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
const PORT = process.env.PORT || 8787;

// GET /api/search?q=fraud  ->  { source, results: [{title, journal, date, url, citations, abstract, match}] }
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.status(400).json({ error: "Type at least 2 characters." });
  try {
    const key = process.env.OPENALEX_API_KEY;
    const results = key ? await searchOpenAlex(q, key) : await searchCrossref(q, process.env.CONTACT_EMAIL);
    res.json({ source: key ? "OpenAlex" : "Crossref", results });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// POST /api/claude  ->  forwards the body to Anthropic with the key added
app.post("/api/claude", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(401).json({ error: { message: "ANTHROPIC_API_KEY is not set on the server." } });
  }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(502).json({ error: { message: e.message } });
  }
});

// In production the same server also serves the built front end.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
app.use(express.static(dist));

app.listen(PORT, () => console.log("API listening on http://localhost:" + PORT));

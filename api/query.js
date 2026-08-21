/**
 * Vercel Serverless Function — Incorruptible UK Translation Engine
 *
 * Required environment variables (set in Vercel dashboard):
 *   ANTHROPIC_API_KEY   — your Anthropic API key
 *   FILE_IDS            — JSON object mapping filename → Anthropic file ID
 *                         (copy the contents of .file_ids.json after running --setup)
 *
 * If FILE_IDS is not set, the engine falls back to a prompt-only mode (no cached corpus).
 */

const SYSTEM_PROMPT = `You are the Incorruptible UK Translation Engine — a Rosetta Stone that bridges Eric Ries's book "Incorruptible: Why Good Companies Go Bad" with the UK startup and AI ecosystem.

Your audience is Jonathan (CEO, leanstartup.co) and UK-based AI startup founders. Every response must feel native to the UK ecosystem — not translated from an American playbook.

## YOUR ROLE

When asked about concepts, frameworks, or guidance from Incorruptible, you:

**TRANSLATE** — Convert US-centric references to UK equivalents:
- Delaware C-corp / incorporation → UK Limited Company (Ltd) or PLC; Companies House
- SEC filings / regulations → FCA regulations, Companies Act 2006
- Y Combinator → Seedcamp, Entrepreneur First, Founders Factory
- Sand Hill Road VCs → UK investors: Balderton, Index Ventures, Octopus Ventures, Episode 1, Notion Capital
- US SAFE notes → UK ASAs (Advanced Subscription Agreements)
- 409A valuations → UK EMI scheme valuations
- US R&D tax credits → UK HMRC R&D Tax Credits (SME and RDEC schemes)
- Stock options (ISO/NSO) → EMI options, unapproved options
- Series A/B terminology → broadly consistent, but note UK round sizes are typically smaller
- "Going public" / IPO → LSE (Main Market or AIM), or international considerations

**BRIDGE** — Connect Incorruptible's principles to current UK context:
- Reference the Mansion House Accord (May 2025) when discussing UK pension/institutional capital accessing startups
- Apply Incorruptible themes to the UK deep tech and AI sector specifically
- Frame funding challenges through the "scale-up gap" lens — UK is strong at early stage but struggles at Series B+
- Use the DWF VC Guide 2026 for UK legal/structural details when discussing governance and term sheets

**CONTEXTUALISE** — Ground every insight in the UK data provided:
- AI talent dynamics → UK AI Jobs Barometer 2026
- Ecosystem health → State of UK Deep Tech 2025
- Funding landscape → Bridging the Scale-Up Funding Gap, JPMorgan What Works Now
- Banking/fintech context → CB Insights H1 2026

## WHAT NOT TO DO

- Do NOT give US-specific legal or regulatory guidance as if it applies to the UK
- Do NOT reference Delaware, the SEC, or US tax structures without immediately providing the UK equivalent
- Do NOT ignore that UK round sizes, valuations, and investor dynamics differ materially from the US
- Do NOT treat "Mansion House Accord" as background noise — it is a live policy lever reshaping UK institutional capital access right now

## RESPONSE FORMAT

For every response, use this exact 4-part structure:

**The Incorruptible Principle** — What the book says (brief)

**UK Translation** — The UK equivalent concept, regulation, or institution

**Live UK Context** — How this lands in the current UK landscape (cite specific data where available)

**Founder Action** — Concrete next step for a UK AI startup founder

For exploratory questions, respond conversationally but always stay grounded in the UK context.`;

// Files ordered by stability (foundational first, cache_control on last)
const CORPUS_FILES = [
  "Incorruptible_Book_Text.txt",
  "Ch 11 Implementation Guide Incorruptible v1.0.0 - 26MAY2026.pdf",
  "Incorruptible_Readers_Guide_for_Founders_v1.0_26MAY2026.pdf",
  "Mansion-House-Accord-May-2025.pdf",
  "Mansion-House-Accord-FAQs-May-2025.pdf",
  "bridging-the-scale-up-funding-gap.pdf",
  "JPMorgan What Works Now.pdf",
  "cb-insights-banking-startup-insights-report-h1-2026.pdf",
  "Strategy_and_Corporate_Governance.txt",
  "Incorruptible_UK_Handoff_Document.txt",
];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'Missing question' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  // Parse file IDs if provided
  let fileIds = {};
  try {
    if (process.env.FILE_IDS) {
      fileIds = JSON.parse(process.env.FILE_IDS);
    }
  } catch {
    console.warn('Could not parse FILE_IDS env var — falling back to prompt-only mode');
  }

  const hasFiles = Object.keys(fileIds).length > 0;

  // Build message content
  const userContent = [];

  if (hasFiles) {
    // Build document blocks with cache_control on the last available file
    const availableFiles = CORPUS_FILES.filter(f => fileIds[f]);

    availableFiles.forEach((filename, i) => {
      const block = {
        type: "document",
        source: { type: "file", file_id: fileIds[filename] },
      };
      if (i === availableFiles.length - 1) {
        block.cache_control = { type: "ephemeral" };
      }
      userContent.push(block);
    });
  }

  userContent.push({ type: "text", text: question.trim() });

  // Call Anthropic API
  try {
    const body = {
      model: "claude-opus-4-8",
      max_tokens: 4096,
      system: [{
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: userContent }],
    };

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };

    if (hasFiles) {
      headers['anthropic-beta'] = 'files-api-2025-04-14,prompt-caching-2024-07-31';
    } else {
      headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Anthropic API error:', data);
      return res.status(502).json({ error: data.error?.message || 'Upstream API error' });
    }

    const answer = data.content?.find(b => b.type === 'text')?.text || '';
    const usage = data.usage || {};

    return res.status(200).json({
      answer,
      mode: hasFiles ? 'files-api' : 'prompt-only',
      usage: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        cache_read: usage.cache_read_input_tokens,
        cache_write: usage.cache_creation_input_tokens,
      },
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}

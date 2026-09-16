import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3106);
const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Lightweight in-memory throttling for the prototype deployment.
// For multi-instance production, replace this with Redis-backed rate limiting.
const buckets = new Map();
function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const max = Number(process.env.AI_REQUESTS_PER_MINUTE || 12);
  const b = buckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > b.reset) {
    b.count = 0;
    b.reset = now + windowMs;
  }
  b.count += 1;
  buckets.set(key, b);
  if (b.count > max) {
    return res.status(429).json({ error: 'Too many AI requests. Please wait a moment and try again.' });
  }
  next();
}

const guardrail = `You are the research assistant inside Sermon Trainer. You assist Bible study and sermon preparation, but you must NEVER write a sermon, Bible lesson, sermon outline, preaching points, application section, conclusion, prayer, or ready-to-deliver prose. Section 10 belongs entirely to the user. Your role is research support only.

Anchor suggestions to the user's selected Scripture. Distinguish direct fulfilment, typology/pattern, thematic connection, and later development. Do not present contested theological interpretations as settled fact. Flag uncertainty where appropriate. For historical illustrations, never invent quotations, dates, sources, or biographical claims. Give a practical source-verification note instead. Do not claim a Hebrew or Greek nuance unless it is genuinely relevant and reasonably established. Return only valid JSON matching the requested shape.`;

function inputSummary(b = {}) {
  return `Study title: ${b.title || ''}\nPrayer/topic: ${b.topic || ''}\nOpening Scripture: ${b.mainScripture || ''}\nMain theme: ${b.mainTheme || ''}\nExisting context: ${b.history || ''}\nExisting literary notes: ${b.literary || ''}\nExisting key words: ${b.words || ''}\nExisting OT passage: ${b.otScripture || ''}\nExisting OT notes: ${b.otNotes || ''}\nExisting NT passage: ${b.ntScripture || ''}\nExisting NT notes: ${b.ntNotes || ''}`;
}

async function ask(prompt) {
  if (!client) throw new Error('OPENAI_API_KEY is not configured');
  const response = await client.responses.create({
    model,
    input: `${guardrail}\n\n${prompt}`,
    max_output_tokens: 1800
  });
  const text = response.output_text?.trim() || '{}';
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'sermon-trainer',
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model
  });
});

app.post('/api/ai-study', rateLimit, async (req, res) => {
  if (!client) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server' });
  }

  const { type } = req.body || {};
  const base = inputSummary(req.body || {});

  if (!(req.body?.mainScripture || '').trim() && type !== 'illustrations') {
    return res.status(400).json({ error: 'Choose an opening Scripture before using AI research.' });
  }

  try {
    let prompt;

    if (type === 'context') {
      prompt = `${base}\nResearch the opening passage. Return {"history":"...","literary":"...","words":"...","questions":"..."}. Keep each field concise but genuinely useful. Historical/cultural context should clarify audience, location, period, customs, political/social setting, and genre where relevant. Literary/biblical context should explain what comes immediately before and after, the passage's role in the book, and major canonical connections without writing a sermon. Important words/concepts may mention original-language concepts only when useful; do not imply an English word proves a Hebrew/Greek nuance. Questions should identify matters the user should verify or reflect on.`;
    } else if (type === 'ot') {
      prompt = `${base}\nSuggest ONE strong Old Testament foundation, event, person, pattern, promise, law, wisdom text, or prophetic text that genuinely illuminates the opening passage. Do not force a connection. Return {"passage":"...","notes":"...","connection":"..."}. Explain the OT text first in its own context, then explain why it may help the user investigate the main passage.`;
    } else if (type === 'nt') {
      prompt = `${base}\nSuggest ONE New Testament passage that most clearly fulfils, develops, explains, or echoes the theme. Return {"passage":"...","notes":"...","connection":"...","connectionType":"Direct fulfilment|Biblical pattern / typology|Thematic connection|Further development"}. Use 'Direct fulfilment' only where the New Testament text itself warrants that wording.`;
    } else if (type === 'illustrations') {
      prompt = `${base}\nReturn {"illustrations":[...]} with exactly 6 optional research leads: 3 Biblical and 3 Historical. Each item must be {"kind":"Biblical" or "Historical","title":"...","summary":"...","relevance":"...","sourceNote":"..."}. Do not write a sermon anecdote. Give enough factual context for the user to decide whether to research/use it. Historical items must include a concrete verification suggestion and must not contain invented quotations or uncertain claims stated as fact.`;
    } else {
      return res.status(400).json({ error: 'Unknown AI study task' });
    }

    const result = await ask(prompt);
    res.json(result);
  } catch (error) {
    console.error('AI research error:', error);
    const message = error instanceof SyntaxError
      ? 'AI returned an unexpected format. Please try again.'
      : 'AI research request failed.';
    res.status(500).json({ error: message });
  }
});

// Serve the main page with the local backup/restore module injected.
app.get('/', (_req, res) => {
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8').replace(
      '</body>',
      '<script src="/backup.js"></script>\n</body>'
    );
    res.type('html').send(html);
  } catch (error) {
    console.error('Unable to load Sermon Trainer:', error);
    res.status(500).send('Unable to load Sermon Trainer.');
  }
});

app.use(express.static(__dirname, { extensions: ['html'], maxAge: '1h' }));

app.get('/*splat', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Sermon Trainer listening on http://127.0.0.1:${port}`);
  console.log(`AI model: ${model}`);
});

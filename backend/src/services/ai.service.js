import { GoogleGenAI } from '@google/genai';
import { HttpError } from '../middleware/error.middleware.js';

export const MAX_CHARS = 30_000;
let client;

const getClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new HttpError(500, 'Server is missing GEMINI_API_KEY. Add it to backend/.env.');
  }
  return (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
};

// Truncates long input and reports it, so the UI can tell the student.
export const prepareText = (text) => ({
  text: text.slice(0, MAX_CHARS),
  truncated: text.length > MAX_CHARS,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRYABLE = [500, 503, 504];

async function generateJSON(prompt) {
  const models = [
    process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    process.env.GEMINI_FALLBACK_MODEL,
  ].filter(Boolean);

  let res;
  let lastErr;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await getClient().models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.4 },
        });
        break;
      } catch (e) {
        if (e instanceof HttpError) throw e;
        lastErr = e;
        console.error('Gemini error:', model, e.status || e.code);
        if (!RETRYABLE.includes(e.status || e.code)) break; // try next model
        await sleep(1500 * (attempt + 1)); // wait, then retry
      }
    }
    if (res) break;
  }

  if (!res) {
    const s = lastErr?.status || lastErr?.code;
    if (s === 503) throw new HttpError(503, 'Google AI is very busy right now. Please try again in a minute.');
    if (s === 429) throw new HttpError(429, 'AI quota or rate limit reached. Try again shortly.');
    if ([400, 401, 403, 404].includes(s)) throw new HttpError(502, 'AI provider rejected the request. Check your API key and model name.');
    throw new HttpError(502, 'AI provider is unavailable. Try again.');
  }

  try {
    return JSON.parse(res.text.replace(/```json|```/g, '').trim());
  } catch {
    throw new HttpError(502, 'AI returned malformed output. Please try again.');
  }
}

const bad = () => new HttpError(502, 'AI response had an unexpected structure. Please try again.');
const str = (v) => typeof v === 'string' && v.trim().length > 0;

export async function generateNotes(text) {
  const d = await generateJSON(`You are a study assistant. Create simplified revision notes ONLY from the material below.
Return JSON: {"title":string,"overview":string,"keyConcepts":[{"name":string,"explanation":string}],"definitions":[{"term":string,"meaning":string}],"revisionSummary":string}
Material:
"""${text}"""`);

  if (
    !str(d?.title) ||
    !str(d.overview) ||
    !Array.isArray(d.keyConcepts) ||
    !Array.isArray(d.definitions) ||
    !str(d.revisionSummary)
  ) {
    throw bad();
  }

  return {
    title: d.title,
    overview: d.overview,
    revisionSummary: d.revisionSummary,
    keyConcepts: d.keyConcepts.filter((c) => str(c?.name) && str(c?.explanation)),
    definitions: d.definitions.filter((c) => str(c?.term) && str(c?.meaning)),
  };
}

export async function generateQuiz(text, difficulty, count) {
  const d = await generateJSON(`Create exactly ${count} ${difficulty}-difficulty multiple-choice questions ONLY from the material below.
Return JSON: {"topic":string,"questions":[{"question":string,"options":[4 strings],"answerIndex":0-3,"explanation":string}]}
Material:
"""${text}"""`);

  const qs = d?.questions;
  if (!Array.isArray(qs)) throw bad();

  const valid = qs.filter(
    (q) =>
      str(q?.question) &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every(str) &&
      Number.isInteger(q.answerIndex) &&
      q.answerIndex >= 0 &&
      q.answerIndex < 4 &&
      str(q.explanation)
  );
  if (valid.length < 1) throw bad();

  return { topic: str(d.topic) ? d.topic : 'Quiz', questions: valid.slice(0, count) };
}

export async function generatePlan({
  subjects,
  examDate,
  hoursPerDay,
  sessionMinutes,
  weakTopics,
  today,
  days,
}) {
  const prompt = `
Create a realistic revision timetable.
Today is ${today}; the exam is on ${examDate} (${days} days left).
Topics: ${subjects}.
Weak topics (give extra time): ${weakTopics || 'none'}.
Maximum ${hoursPerDay} study hours per day; sessions of about ${sessionMinutes} minutes.
Include a final revision day. Do not exceed the daily hours.

Rules:
- Every date must be between ${today} and ${examDate}, formatted YYYY-MM-DD.
- Priority must be exactly High, Medium or Low.
- Minutes must be a number.

Return ONLY JSON in this shape:
{"tasks":[{"date":"YYYY-MM-DD","topic":string,"task":string,"minutes":number,"priority":"High"|"Medium"|"Low"}]}
`;

  const d = await generateJSON(prompt);

  // Accept a few different shapes the AI might return
  const list = Array.isArray(d) ? d : d?.tasks ?? d?.plan ?? d?.timetable ?? d?.schedule;

  if (!Array.isArray(list)) {
    console.error('Plan: unexpected keys:', Object.keys(d || {}));
    throw bad();
  }

  const normalizePriority = (p) => {
    const s = String(p || '').toLowerCase();
    if (s.startsWith('h')) return 'High';
    if (s.startsWith('l')) return 'Low';
    return 'Medium';
  };

  const tasks = list
    .map((t) => ({
      date: String(t?.date || '').slice(0, 10),
      topic: String(t?.topic ?? t?.subject ?? '').trim(),
      task: String(t?.task ?? t?.description ?? t?.activity ?? '').trim(),
      minutes: Math.round(
        Number(String(t?.minutes ?? t?.duration ?? t?.durationMinutes ?? '').replace(/[^\d.]/g, ''))
      ),
      priority: normalizePriority(t?.priority),
    }))
    .filter(
      (t) =>
        /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
        t.date >= today &&
        t.date <= examDate &&
        t.topic &&
        t.task &&
        t.minutes > 0
    );

  if (!tasks.length) {
    console.error('Plan: no valid tasks. First item:', JSON.stringify(list[0]));
    throw bad();
  }

  return tasks.sort((a, b) => a.date.localeCompare(b.date));
}
// The smart router: Check → Analyze → Decide → Answer (+parallel backup) →
// Verify. Pure orchestration over chat() — no React, unit-testable. Fixes the
// two weak spots of the Lumos keyword router: it classifies from the actual
// image (not just text), and it escalates on an INDEPENDENT re-solve rather than
// the model's own (unreliable) confidence.

import { chat, ChatMessage, ChatResult, OrModel, pricingFor, Provider, userMessage, usdCost } from './openrouter';
import { CheckResult, checkImages } from './imageCheck';
import { bestModelFor } from './routerStats';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export interface ScoutResult {
  subject: string;
  difficulty: Difficulty;
  logicDepth: number;
  type: string;
  needsVision: boolean;
}

export interface RouterSlots {
  scout: string;
  fast: string;
  smart: string;
  expert: string;
}

export interface RouterMedia {
  images: string[]; // data URLs
  audio?: { data: string; format: string };
}

export interface RouterConfig {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  slots: RouterSlots;
  budgetSec: number;
  verify: boolean;
  backup: boolean;
  maxTokens?: number;
  models: OrModel[]; // for pricing (OpenRouter/Gemini); empty on custom
  signal?: AbortSignal;
  timeoutMs?: number;
  forceModel?: string; // "My choice" mode — skip Decide, use this model
}

export type StepRole = 'analyze' | 'answer' | 'backup' | 'verify' | 'resolve';

export interface RouterStep {
  role: StepRole;
  model: string;
  status: 'ok' | 'error';
  latencyMs: number;
  tokens?: number;
  cost?: number;
  note?: string;
  text?: string;
}

export type VerifyVerdict = 'match' | 'mismatch' | 'skipped' | 'unverifiable';

export interface RouterRun {
  retake?: { reason: string; detail: string };
  check?: CheckResult;
  scout?: ScoutResult;
  decision?: { model: string; reason: string; backupModel?: string };
  answeredModel?: string; // the model whose answer we actually shipped (race winner / re-solve)
  answer: string;
  finalValue?: string;
  confidence?: number;
  verify?: VerifyVerdict;
  steps: RouterStep[];
  totalTokens: number;
  totalCost?: number;
  totalTimeMs: number;
  error?: string;
}

interface AnswerJson {
  answer: string;
  final_value?: string;
  confidence?: number;
}

// ── prompts ───────────────────────────────────────────────────────────
export const SCOUT_PROMPT =
  'You are the routing classifier for a tutoring system. Look at the attached image(s) and/or the student question and classify it. Reply with ONLY a JSON object — no prose, no markdown fences:\n' +
  '{"subject":"Physics|Chemistry|Math|Biology|English|Other","difficulty":"easy|medium|hard|extreme","logic_depth":<integer 1-10 = number of reasoning steps>,"type":"numeric|proof|mcq|conceptual|definition|diagram","needs_vision":<true if the question needs the image to be understood>}';

function answerInstruction(prompt: string): string {
  return (
    (prompt?.trim() || 'Solve the problem shown in the image.') +
    '\n\nReply with ONLY a JSON object — no prose outside it:\n' +
    '{"answer":"<full step-by-step solution as markdown>","final_value":"<ONLY the final answer, e.g. 42 m/s or B or x = 3; empty string for a proof>","confidence":<0.0-1.0 how sure you are>}'
  );
}

function verifyInstruction(prompt: string): string {
  return (
    (prompt?.trim() || 'Solve the problem shown in the image.') +
    '\n\nSolve it INDEPENDENTLY from scratch. Reply with ONLY a JSON object:\n' +
    '{"final_value":"<ONLY the final answer>","confidence":<0.0-1.0>}'
  );
}

// Trivial text-only questions skip Analyze + Verify (cheap stays cheap).
const TRIVIAL_RE = /(what is the formula|state the formula|formula for|define\b|definition of|what does .* stand for|si unit of)/i;

// ── json + helpers ────────────────────────────────────────────────────
function parseJson<T>(text: string): T | null {
  if (!text) return null;
  let t = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(t);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  try {
    return JSON.parse(t.slice(first, last + 1)) as T;
  } catch {
    return null;
  }
}

function normalizeScout(o: any): ScoutResult {
  const diffs: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
  const d = String(o?.difficulty || '').toLowerCase() as Difficulty;
  return {
    subject: String(o?.subject || 'Unknown'),
    difficulty: diffs.includes(d) ? d : 'medium',
    logicDepth: Math.max(1, Math.min(10, Number(o?.logic_depth) || 1)),
    type: String(o?.type || 'unknown'),
    needsVision: !!o?.needs_vision,
  };
}

function normValue(v: string | undefined): string {
  return String(v || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[$\\]/g, '')
    .replace(/[.]+$/, '');
}

const isAbort = (msg?: string) => !!msg && /abort|timed out/i.test(msg);
// LLMs often return numeric fields as strings ("0.9") or words ("high"). Coerce.
const numOrUndef = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function mkCostOf(cfg: RouterConfig) {
  return (m: string) => {
    const p = pricingFor(cfg.models, m);
    return p ? p.prompt + p.completion : Number.MAX_VALUE;
  };
}

function toStep(cfg: RouterConfig, role: StepRole, model: string, res: ChatResult): RouterStep {
  const pricing = pricingFor(cfg.models, model);
  return {
    role,
    model,
    status: res.error ? 'error' : 'ok',
    latencyMs: res.latencyMs,
    tokens: res.usage?.total_tokens,
    cost: pricing ? usdCost(res.usage, pricing) : undefined,
    text: res.text,
    note: res.error,
  };
}

function callChat(cfg: RouterConfig, model: string, messages: ChatMessage[], signal?: AbortSignal): Promise<ChatResult> {
  return chat({
    model,
    apiKey: cfg.apiKey,
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    temperature: 0,
    maxTokens: cfg.maxTokens,
    messages,
    signal: signal || cfg.signal,
    timeoutMs: cfg.timeoutMs,
  });
}

// ── stage 1: scout classify (also used by the Test-models bench) ──────
export async function scoutClassify(
  cfg: RouterConfig,
  model: string,
  media: RouterMedia,
  prompt: string,
): Promise<{ scout: ScoutResult | null; step: RouterStep }> {
  const text = prompt?.trim() ? `${SCOUT_PROMPT}\n\nStudent question: ${prompt.trim()}` : SCOUT_PROMPT;
  const res = await callChat(cfg, model, [userMessage(text, media.images, media.audio)]);
  const step = toStep(cfg, 'analyze', model, res);
  const scout = res.error ? null : normalizeScoutOrNull(res.text);
  if (scout) step.note = `${scout.subject} · ${scout.difficulty}`;
  else if (!res.error) step.note = 'unparseable';
  return { scout, step };
}

function normalizeScoutOrNull(text: string): ScoutResult | null {
  const parsed = parseJson<any>(text);
  return parsed ? normalizeScout(parsed) : null;
}

// ── stage 2: decide ───────────────────────────────────────────────────
function tierFor(slots: RouterSlots, d: Difficulty): { model: string; tier: string } {
  if (d === 'easy') return { model: slots.fast, tier: 'Fast' };
  if (d === 'medium') return { model: slots.smart, tier: 'Smart' };
  return { model: slots.expert, tier: 'Expert' };
}

function decide(cfg: RouterConfig, scout: ScoutResult): { model: string; reason: string; backupModel?: string } {
  const costOf = mkCostOf(cfg);
  const { model: tierModel, tier } = tierFor(cfg.slots, scout.difficulty);
  let model = tierModel;
  let reason = `${scout.difficulty} → ${tier} (${tierModel})`;

  // Promote a cheaper model that has proven itself on this subject×difficulty.
  const candidates = [cfg.slots.fast, cfg.slots.smart, cfg.slots.expert];
  const promoted = bestModelFor(scout.subject, scout.difficulty, candidates, costOf);
  if (promoted && costOf(promoted.model) < costOf(tierModel)) {
    model = promoted.model;
    reason = `stats: ${promoted.model} wins ${Math.round(promoted.rate * 100)}% on ${scout.subject}·${scout.difficulty} (${promoted.runs} runs)`;
  }

  // Parallel backup on hard/borderline: race the strong model, keep the winner.
  const borderline = scout.difficulty === 'hard' || scout.difficulty === 'extreme' || (scout.difficulty === 'medium' && scout.logicDepth >= 4);
  const backupModel = cfg.backup && borderline && model !== cfg.slots.expert ? cfg.slots.expert : undefined;
  return { model, reason, backupModel };
}

function verifierModel(cfg: RouterConfig, answerModel: string): string | null {
  const costOf = mkCostOf(cfg);
  const seen = new Set<string>();
  const candidates = [cfg.slots.fast, cfg.slots.smart, cfg.slots.expert].filter((m) => {
    if (!m || m === answerModel || seen.has(m)) return false;
    seen.add(m);
    return true;
  });
  candidates.sort((a, b) => costOf(a) - costOf(b));
  return candidates[0] || null;
}

// ── stage 3: answer, with optional parallel backup race ───────────────
interface AnswerEntry {
  model: string;
  role: StepRole;
  res: ChatResult;
  step: RouterStep;
  parsed: AnswerJson | null;
}

function answerOnce(cfg: RouterConfig, model: string, role: StepRole, media: RouterMedia, prompt: string, signal?: AbortSignal): Promise<AnswerEntry> {
  return callChat(cfg, model, [userMessage(answerInstruction(prompt), media.images, media.audio)], signal).then((res) => ({
    model,
    role,
    res,
    step: toStep(cfg, role, model, res),
    parsed: res.error ? null : parseJson<AnswerJson>(res.text),
  }));
}

async function raceAnswer(cfg: RouterConfig, primary: string, backup: string, media: RouterMedia, prompt: string): Promise<{ steps: RouterStep[]; winner: AnswerEntry }> {
  const ctrlA = new AbortController();
  const ctrlB = new AbortController();
  const relay = () => {
    ctrlA.abort();
    ctrlB.abort();
  };
  if (cfg.signal) {
    if (cfg.signal.aborted) relay();
    else cfg.signal.addEventListener('abort', relay, { once: true });
  }

  let winner: AnswerEntry | null = null;
  const guard = (e: AnswerEntry): AnswerEntry => {
    if (!winner && !e.res.error && e.parsed) {
      winner = e;
      (e.role === 'answer' ? ctrlB : ctrlA).abort(); // cancel the slower racer
    }
    return e;
  };
  const [a, b] = await Promise.all([
    answerOnce(cfg, primary, 'answer', media, prompt, ctrlA.signal).then(guard),
    answerOnce(cfg, backup, 'backup', media, prompt, ctrlB.signal).then(guard),
  ]);

  if (!winner) winner = [a, b].find((e) => !e.res.error && e.parsed) || (!a.res.error ? a : b);
  const w = winner as AnswerEntry;
  for (const e of [a, b]) if (e !== w && e.res.error && isAbort(e.res.error)) e.step.note = 'cancelled (slower won)';
  const ordered = a.role === 'answer' ? [a, b] : [b, a];
  return { steps: ordered.map((e) => e.step), winner: w };
}

// ── main ──────────────────────────────────────────────────────────────
export async function runRouter(cfg: RouterConfig, media: RouterMedia, prompt: string): Promise<RouterRun> {
  const steps: RouterStep[] = [];
  const run: RouterRun = { answer: '', steps, totalTokens: 0, totalTimeMs: 0 };
  const t0 = Date.now();
  const finish = (): RouterRun => {
    run.totalTokens = steps.reduce((s, x) => s + (x.tokens || 0), 0);
    const anyCost = steps.some((x) => x.cost != null);
    run.totalCost = anyCost ? steps.reduce((s, x) => s + (x.cost || 0), 0) : undefined;
    run.totalTimeMs = Date.now() - t0;
    run.error = steps.find((x) => x.status === 'error' && !isAbort(x.note) && !/cancelled/i.test(x.note || ''))?.note;
    return run;
  };

  // Stage 0 — image quality gate (free). Enhance-retry, then maybe short-circuit.
  let images = media.images;
  if (images.length) {
    const check = await checkImages(images);
    run.check = check;
    images = check.images.map((im) => im.dataUrl); // possibly enhanced
    const wordCount = (prompt || '').trim().split(/\s+/).filter(Boolean).length;
    if (!check.anyOk && wordCount < 6) {
      const worst = check.images.find((im) => !im.verdict.ok)?.verdict;
      run.retake = { reason: worst?.reason || 'blurry', detail: worst?.detail || 'Retake the photo.' };
      return finish(); // zero LLM spend
    }
  }
  const effMedia: RouterMedia = { images, audio: media.audio };
  const hasMedia = images.length > 0 || !!media.audio;

  // Stage 1 — analyze (scout), unless a trivial text-only question or My-choice.
  const trivial = !hasMedia && TRIVIAL_RE.test(prompt || '') && !/\b(prove|proof|derive|derivation|show that)\b/i.test(prompt || '');
  if (!cfg.forceModel && !trivial) {
    const { scout, step } = await scoutClassify(cfg, cfg.slots.scout, effMedia, prompt);
    steps.push(step);
    run.scout = scout || { subject: 'Unknown', difficulty: 'medium', logicDepth: 3, type: 'unknown', needsVision: hasMedia };
  } else if (!cfg.forceModel && trivial) {
    run.scout = { subject: 'Unknown', difficulty: 'easy', logicDepth: 1, type: 'definition', needsVision: false };
  }

  // Stage 2 — decide.
  let decision: { model: string; reason: string; backupModel?: string };
  if (cfg.forceModel) decision = { model: cfg.forceModel, reason: 'your choice' };
  else if (trivial) decision = { model: cfg.slots.fast, reason: 'trivial text → Fast' };
  else decision = decide(cfg, run.scout as ScoutResult);
  run.decision = decision;

  // Stage 3 — answer (+ backup race).
  let answerEntry: AnswerEntry;
  if (decision.backupModel) {
    const race = await raceAnswer(cfg, decision.model, decision.backupModel, effMedia, prompt);
    steps.push(...race.steps);
    answerEntry = race.winner;
  } else {
    answerEntry = await answerOnce(cfg, decision.model, 'answer', effMedia, prompt);
    steps.push(answerEntry.step);
  }
  run.answer = answerEntry.parsed?.answer || answerEntry.res.text || '';
  run.finalValue = answerEntry.parsed?.final_value || undefined;
  run.confidence = numOrUndef(answerEntry.parsed?.confidence);
  run.answeredModel = answerEntry.model;

  // Stage 4 — verify (independent re-solve, value compare) → resolve on mismatch.
  if (!cfg.verify || trivial) {
    run.verify = 'skipped';
    return finish();
  }
  const vModel = verifierModel(cfg, answerEntry.model);
  if (!run.finalValue || !vModel) {
    run.verify = run.finalValue ? 'skipped' : 'unverifiable';
    return finish();
  }
  const vRes = await callChat(cfg, vModel, [userMessage(verifyInstruction(prompt), effMedia.images, effMedia.audio)]);
  const vStep = toStep(cfg, 'verify', vModel, vRes);
  const vParsed = vRes.error ? null : parseJson<{ final_value?: string; confidence?: number }>(vRes.text);
  if (!vParsed?.final_value) {
    vStep.note = 'unverifiable';
    steps.push(vStep);
    run.verify = 'unverifiable';
    return finish();
  }
  const va = normValue(vParsed.final_value);
  const vb = normValue(run.finalValue);
  if (!va || !vb) {
    // Both values normalized away to nothing (e.g. "$" vs ".") — can't compare.
    vStep.note = 'unverifiable';
    steps.push(vStep);
    run.verify = 'unverifiable';
    return finish();
  }
  const match = va === vb;
  vStep.note = match ? `match ✓ (${vParsed.final_value})` : `mismatch — got ${vParsed.final_value}`;
  steps.push(vStep);
  run.verify = match ? 'match' : 'mismatch';

  if (!match && answerEntry.model !== cfg.slots.expert) {
    const resolve = await answerOnce(cfg, cfg.slots.expert, 'resolve', effMedia, prompt);
    resolve.step.note = 'tie-break re-solve';
    steps.push(resolve.step);
    run.answeredModel = cfg.slots.expert;
    if (resolve.parsed) {
      run.answer = resolve.parsed.answer || run.answer;
      run.finalValue = resolve.parsed.final_value || run.finalValue;
      run.confidence = numOrUndef(resolve.parsed.confidence) ?? run.confidence;
    }
  }
  return finish();
}

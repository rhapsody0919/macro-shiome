/**
 * AI要約ビューの組み立て (#279)。
 *
 * `signals.ts` (ネットワーク不要・純粋関数) が判定した警告シグナル・ハイライトに、
 * Cloudflare Workers AI (ADR-0009) で言語化した `note` を付ける。
 *
 * **LLM の出力は無条件に信用しない。** 数値・評価語・マークダウン・開発メモを
 * 含む応答は `note` を null のまま捨てる (#211 の解説ガードレールと同じ発想)。
 * 1件の生成に失敗しても他の項目は独立して処理を続ける (部分的な要約でも
 * 無いよりはまし、というより「無ければ無いと分かる」方を優先する #279 の設計)。
 */
import type { MacroPoint, SectorHighlight, WarningSignal, SummaryView } from '../data/types';

/** LLM に説明を書かせるときの共通の禁止事項。#211 の解説ガードレールと同じ。 */
const GUARDRAIL_INSTRUCTIONS =
  '数値・パーセンテージ・具体的な数字を一切書かないこと (数値は別途画面に表示されるため)。' +
  '「危険」「買い時」「売り時」「望ましい水準」のような評価語を使わないこと。' +
  'マークダウンの装飾 (**や#見出し) を使わないこと。事実の説明に留め、平文で書くこと。';

/** LLM の応答が信用できる形か検査する。1つでも該当すれば `null` にして捨てる。 */
export function sanitizeNote(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (/\d/.test(trimmed)) return null;
  if (/危険|悪化のサイン|買い時|売り時|望ましい水準/.test(trimmed)) return null;
  if (/\*\*|__|^#+\s/.test(trimmed)) return null;
  if (/#\d+|`/.test(trimmed)) return null;
  return trimmed;
}

export interface Summarizer {
  summarize(prompt: string, systemPrompt: string): Promise<string>;
}

const SYSTEM_PROMPT =
  '日本語の投資情報アプリの読者向けに、簡潔で中立的な説明文を書くアシスタントです。' +
  GUARDRAIL_INSTRUCTIONS;

function warningBasisLabel(warning: WarningSignal): string {
  if (warning.basis === 'zero-line') return '定義上の基準を超えている';
  // "5年" のように数字を含む表現を渡すと、LLM が説明文にそのまま数字を書き写し
  // sanitizeNote に破棄されやすくなる (#279 マージ後の実機確認、highlights と同じ問題)。
  const direction = (warning.percentile ?? 0) >= 50 ? '高い' : '低い';
  return `過去の分布の中で${direction}側の水準にある`;
}

/** 警告シグナルの説明文を1回のLLM呼び出しでまとめて生成する。 */
export async function summarizeWarnings(
  summarizer: Summarizer,
  warnings: readonly WarningSignal[],
): Promise<WarningSignal[]> {
  if (warnings.length === 0) return [];

  const lines = warnings.map((w) => `- id=${w.id} / 指標=${w.label} / 状態=${warningBasisLabel(w)}`);
  const prompt = [
    '以下は機械的に検出された警告シグナルの一覧です。それぞれについて、投資家が読んで',
    '意味が分かる1文の説明を書いてください。出力は1行につき1件、',
    '"id=<id>: <説明文>" の形式のみとし、他の文章を含めないでください。',
    '',
    ...lines,
  ].join('\n');

  let response: string;
  try {
    response = await summarizer.summarize(prompt, SYSTEM_PROMPT);
  } catch {
    return warnings.map((w) => ({ ...w }));
  }

  const notesById = parseIdKeyedLines(response);
  return warnings.map((w) => ({ ...w, note: sanitizeNote(notesById.get(w.id) ?? '') }));
}

/** セクターハイライトの説明文を1回のLLM呼び出しでまとめて生成する。 */
export async function summarizeHighlights(
  summarizer: Summarizer,
  highlights: readonly SectorHighlight[],
): Promise<SectorHighlight[]> {
  if (highlights.length === 0) return [];

  const lines = highlights.map((h) => {
    // 数字を含む表現 ("1/3以内" 等) を渡すと、LLM が説明文にそのまま数字を
    // 書き写しやすくなり sanitizeNote に破棄される率が上がる (#279 マージ後の実機確認)。
    // シグナルの説明はすべて数字を含まない言い回しにする。
    const signals = [
      '下落率が深い銘柄の一角',
      h.relativeStrength !== null && h.relativeStrength > 0 ? 'SPYに対して相対的に強い' : null,
      h.hasBreakout ? '直近で戻り高値を上抜けている' : null,
    ].filter((s): s is string => s !== null);
    return `- id=${h.id} / 銘柄=${h.name} / 該当シグナル=${signals.join('、')}`;
  });
  const prompt = [
    '以下は複数のシグナルが重なった銘柄の一覧です。それぞれについて、なぜ注目に値するかを',
    '投資判断を推奨せずに1文で説明してください。出力は1行につき1件、',
    '"id=<id>: <説明文>" の形式のみとし、他の文章を含めないでください。',
    '',
    ...lines,
  ].join('\n');

  let response: string;
  try {
    response = await summarizer.summarize(prompt, SYSTEM_PROMPT);
  } catch {
    return highlights.map((h) => ({ ...h }));
  }

  const notesById = parseIdKeyedLines(response);
  return highlights.map((h) => ({ ...h, note: sanitizeNote(notesById.get(h.id) ?? '') }));
}

/** "id=<id>: <text>" 形式の行を id → text の Map に分解する。 */
function parseIdKeyedLines(response: string): Map<string, string> {
  const notes = new Map<string, string>();
  for (const line of response.split('\n')) {
    const match = /^\s*id=([\w-]+):\s*(.+)$/.exec(line);
    if (match === null) continue;
    const [, id, text] = match;
    if (id !== undefined && text !== undefined) notes.set(id, text);
  }
  return notes;
}

/** 経済状態の要約に使う、最新の主要指標。値が無いものは渡さない。 */
export function latestMacroFacts(
  macro: readonly MacroPoint[],
): Array<{ label: string; value: number }> {
  const latest = macro.at(-1);
  if (latest === undefined) return [];
  const facts: Array<{ label: string; value: number | null }> = [
    { label: 'イールドカーブ (10年債 − 2年債)', value: latest.termSpread },
    { label: 'ハイイールド債スプレッド', value: latest.hySpread },
    { label: 'VIX', value: latest.vix },
    { label: '金融環境指数 (NFCI)', value: latest.nfci },
    { label: '新規失業保険申請件数', value: latest.initialClaims },
  ];
  return facts.filter((f): f is { label: string; value: number } => f.value !== null);
}

/** 経済状態の要約文を生成する。数値は渡すが、出力に数値を含めないよう指示する。 */
export async function summarizeEconomyState(
  summarizer: Summarizer,
  facts: ReadonlyArray<{ label: string; value: number }>,
): Promise<string | null> {
  if (facts.length === 0) return null;

  const lines = facts.map((f) => `- ${f.label}: ${f.value}`);
  const prompt = [
    '以下は最新の経済指標です。これらを総合して、経済が今どのような状態かを',
    '2〜3文で説明してください。個々の指標名を列挙するのではなく、全体としての',
    '傾向を述べてください。',
    '「スプレッド」は利回り差 (2つの金利の差) であり、資産の価格そのものではない。',
    'スプレッドの拡大・縮小を「価格が上がった/下がった」のように資産価格の変化として',
    '言い換えないこと。指標名が示す対象 (差・指数・件数など) の動きの方向だけを述べること。',
    '',
    ...lines,
  ].join('\n');

  try {
    const response = await summarizer.summarize(prompt, SYSTEM_PROMPT);
    return sanitizeNote(response);
  } catch {
    return null;
  }
}

/** 3種類の生成をまとめて行い `SummaryView` を組み立てる。個別の失敗は他に伝播しない。 */
export async function buildSummaryView(
  summarizer: Summarizer,
  input: {
    macro: readonly MacroPoint[];
    warnings: readonly WarningSignal[];
    highlights: readonly SectorHighlight[];
  },
  generatedAt: string,
): Promise<SummaryView> {
  const facts = latestMacroFacts(input.macro);
  const [economyState, warnings, highlights] = await Promise.all([
    summarizeEconomyState(summarizer, facts),
    summarizeWarnings(summarizer, input.warnings),
    summarizeHighlights(summarizer, input.highlights),
  ]);

  return {
    generatedAt,
    economyState,
    // 要約文が無ければ (生成失敗・ガードレールで破棄) 材料件数も0にする。
    // 「材料はあったのに文章だけ無い」状態を作らない。
    economyStateFactCount: economyState === null ? 0 : facts.length,
    warnings,
    highlights,
  };
}

/**
 * Codex レビューゲートの判定ロジック (純粋関数 + 薄い CLI)。
 *
 * tsx/ts-node に依存せず node で直接動かすため .mjs。判定の正本はここに一本化し、
 * シェル (scripts/codex-review.sh) はこの CLI を呼ぶだけにする (jq/grep でロジックを二重実装しない)。
 * 純関数 (detectClaudeSignature / classifyVerdict) はテストから相対 import して検証する。
 *
 * CLI 用法:
 *   node codex-review-lib.mjs check-signature  < text   # 署名混入なら exit 1
 *   node codex-review-lib.mjs classify         < json   # critical/high>0 なら exit 1、不正 JSON は exit 2
 */

/** Claude Code 署名の検出パターン (CLAUDE.md で PR 本文・コミットへの混入を禁止)。 */
const SIGNATURE_PATTERNS = [
  /Generated with Claude Code/i,
  /Co-Authored-By:\s*Claude/i,
  /🤖 Generated/i,
];

/**
 * テキスト (コミット本文 / PR 本文) に Claude Code 署名が混入していれば true。
 * @param {string} text
 * @returns {boolean}
 */
export function detectClaudeSignature(text) {
  return SIGNATURE_PATTERNS.some((re) => re.test(text));
}

/**
 * Codex の構造化レビュー結果を exit code に落とす。
 * critical/high が 1 件でもあれば block(1)、無ければ approve(0)。
 * 形が壊れている (findings が配列でない / verdict が不正値) か、
 * verdict と findings が自己矛盾している場合は判定不能(2) として安全側に倒す。
 * @param {{verdict?:string, summary?:string, findings?:Array<{severity?:string, [k:string]:unknown}>}} result
 * @returns {{blockers:number, exitCode:0|1|2}}
 */
export function classifyVerdict(result) {
  if (!result || !Array.isArray(result.findings)) {
    return { blockers: 0, exitCode: 2 };
  }
  if (result.verdict !== 'approve' && result.verdict !== 'block') {
    return { blockers: 0, exitCode: 2 };
  }
  // 各 finding の severity が許可値であることを検証。未知値 (大文字 HIGH や blocker 等) が
  // 1 件でもあれば、件数計算が信用できないため判定不能 (2) に倒す (fail-close)。
  const ALLOWED = new Set(['critical', 'high', 'medium', 'low']);
  if (result.findings.some((f) => !f || !ALLOWED.has(f.severity))) {
    return { blockers: 0, exitCode: 2 };
  }
  const blockers = result.findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  ).length;
  // Codex 自身の verdict と件数由来の判定が食い違う出力 (例: block と言いつつ findings 空)
  // は信用できない。安全側に倒して判定不能 (2) とし、自動マージへ進めない。
  const verdictByCount = blockers > 0 ? 'block' : 'approve';
  if (result.verdict !== verdictByCount) {
    return { blockers, exitCode: 2 };
  }
  return { blockers, exitCode: blockers > 0 ? 1 : 0 };
}

/** stdin を最後まで読む。 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// --- CLI: 直接実行されたときのみ動く (import 時は副作用なし) ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  const input = await readStdin();

  if (mode === 'check-signature') {
    if (detectClaudeSignature(input)) {
      process.stderr.write('署名混入を検出\n');
      process.exit(1);
    }
    process.exit(0);
  } else if (mode === 'classify') {
    let parsed;
    try {
      parsed = JSON.parse(input);
    } catch {
      process.stderr.write('Codex 出力が JSON として不正\n');
      process.exit(2);
    }
    const { blockers, exitCode } = classifyVerdict(parsed);
    process.stderr.write(
      exitCode === 2
        ? 'Codex 出力が不正または自己矛盾 (findings 欠落 / verdict 不正値 / verdict と件数の不一致) → 判定不能\n'
        : `Codex: critical/high ${blockers} 件 → ${exitCode === 0 ? 'approve' : 'block'}\n`,
    );
    process.exit(exitCode);
  } else {
    process.stderr.write('usage: codex-review-lib.mjs <check-signature|classify>\n');
    process.exit(2);
  }
}

---
description: Codex (OpenAI) に PR diff を第三者レビューさせ、収束まで修正/反論 → 自動マージ
argument-hint: "[base-branch] (既定 main)"
---

現在ブランチの PR を Codex (OpenAI) にレビューさせ、指摘へ対応し、approve に収束したら自動マージまで一気通貫させる。Codex はレビュー観点を `AGENTS.md` から読む。Codex はコードを書き換えない (read-only)。修正は必ず Claude が行う。

前提: PR が作成済みで、typecheck・test・build がグリーンであること。`/code-review` (Claude セルフレビュー) を先に通してあること。

base ブランチ = `$ARGUMENTS` (未指定なら `main`)。

## ループ手順 (approve に収束するまで繰り返す)

1. **レビュー実行**: `bash scripts/codex-review.sh <base>` を実行し、返ってきた JSON (`verdict` / `summary` / `findings[]`) を読む。
   - 終了コード 2 (実行エラー) なら停止し、原因 (未認証・diff 取得失敗など) をユーザーに報告。`codex login` 未済が典型。
2. **findings へ対応** (各 finding ごとに判断):
   - `critical` / `high`: **必ず対応**。コードを修正する。
   - `medium` / `low`: 修正するか、修正しない場合は**反論として理由を記録**(後述のラウンド記録に残す)。
   - 反論する場合は機序で根拠を示す (推測で却下しない)。
3. **修正を検証**: 修正したら typecheck・test・build を回し、全グリーンを確認。失敗したら直してから次へ。
4. **コミット**: 修正を `fix(#N): ... [why: Codex レビュー指摘 #N 対応]` 形式でコミットし、PR ブランチに push。
5. **再レビュー**: 1 に戻り、再度 `scripts/codex-review.sh` を実行。
   - `verdict == "approve"` (critical/high 0 件、終了コード 0) になったら**収束**。ループを抜ける。
   - まだ block なら 2〜5 を繰り返す。
6. **無限ループ防止**: 最大 **5 ラウンド**まで。5 回で収束しない、または同じ指摘が往復するだけで進展しない場合は停止し、残った findings と各々への対応/反論をユーザーに提示して判断を仰ぐ。

各ラウンドで「指摘 → 対応 (修正 or 反論理由)」を簡潔に記録し、収束後の報告に含める。

## 収束後 (自動マージ)

approve に収束したら、人手承認なしで以下を自動実行する (このフローはユーザー承認済みの標準フロー)。

7. **自動マージ**: `gh pr merge --squash --delete-branch` で PR をマージ。PR 本文に `closes #N` があることをマージ前に確認し、欠けていれば補う。
8. **CI 確認 (必須)**: main push で走るワークフローの結果を確認する。失敗時は CLAUDE.md の分類 (infra 起因なら `gh run rerun --failed` を 1 回だけ / 実失敗なら即修正 or Issue 起票) に従う。
9. **後続処理**: Issue が `closes #N` で自動クローズされたことを確認し、`## STATE` を更新 (収束・マージ・CI 結果を記録)。
10. **週次バッチを変更した場合**: 次回の定時実行を待たず `workflow_dispatch` で手動実行し、成否を確認する。

## 完了報告

収束までのラウンド記録 (各指摘と対応)、マージ済み PR URL、CI 結果、実機確認手順 (URL・操作手順・期待挙動。UI 変更が無い場合は不要と判断した理由) を報告する。

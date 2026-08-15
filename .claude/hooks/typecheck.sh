#!/usr/bin/env bash
# Stop: 型チェックを走らせ、エラーがあれば systemMessage で表示する。
# 技術スタック確定前 (package.json に typecheck スクリプトが無い) は no-op。
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}" || exit 0
jq -e '.scripts.typecheck' package.json >/dev/null 2>&1 || exit 0
if ! out=$(pnpm typecheck 2>&1); then
  msg=$(printf '%s' "$out" | tail -n 30)
  jq -n --arg m "型チェック失敗 (tsc):"$'\n'"$msg" '{systemMessage:$m}'
fi
exit 0

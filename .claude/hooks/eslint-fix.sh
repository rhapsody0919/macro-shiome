#!/usr/bin/env bash
# PostToolUse(Edit|Write): 変更された *.ts / *.tsx に eslint --fix を適用する。
# 技術スタック確定前 (package.json / node_modules 未整備) は no-op。
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
case "$f" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$f" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}" || exit 0
[ -d node_modules ] || exit 0
jq -e '.devDependencies.eslint // .dependencies.eslint' package.json >/dev/null 2>&1 || exit 0
pnpm exec eslint --fix "$f" >/dev/null 2>&1 || true
exit 0

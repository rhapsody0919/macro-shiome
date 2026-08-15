#!/usr/bin/env bash
# PreToolUse(Edit|Write): 機密ファイルへの書き込みをブロックする。
# .env / .env.* および *.pem / *credentials* を対象。ただし *.example は許可。
# 本リポジトリは public のため、秘密情報のコミットは事後回収できない (CLAUDE.md 前提・制約)。
f=$(jq -r '.tool_input.file_path // empty')
base=$(basename "$f")
case "$base" in
  *.example) exit 0 ;;
esac
case "$base" in
  .env|.env.*|*.pem|*credentials*)
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"機密ファイル ('"$base"') への直接書き込みはブロックされています (CLAUDE.md NEVER: API キー・Supabase キー・トークンをコード・コミットに残さない。public リポのため事後回収不可)。値が必要なら GitHub Actions Secrets / env 経由で扱ってください。"}}'
    exit 0 ;;
esac
exit 0

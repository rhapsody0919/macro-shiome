#!/usr/bin/env bash
# Stop: 使い捨ての調査スクリプト・ワークフローの消し忘れを検知する。
# 実測でこれを 1 セッションに 3 回やった (_probe.ts / _probe_jp.ts / _bootstrap-units.yml)。
# 残すとリポジトリに調査の残骸が溜まり、次のセッションで何が現役か分からなくなる。
stray=$(git status --porcelain 2>/dev/null | awk '{print $NF}' | grep -E '(^|/)_[^/]*\.(ts|mjs|yml)$' || true)
[ -z "$stray" ] && exit 0
printf '{"decision":"block","reason":"使い捨てスクリプトが残っている:\\n%s\\n消すか、残すなら `_` を外して名前を付ける。"}\n' \
  "$(echo "$stray" | sed 's/$/\\n/' | tr -d '\n')"

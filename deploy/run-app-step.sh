#!/bin/bash
# 把 01-app.sh.tpl 里的占位符换成本次发布的实际值，然后通过 TAT 以 root 执行。
# 生成的临时脚本含预签名地址，用完即删，不落在版本库里。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REL_JSON="$ROOT/deploy/.last-release.json"
[ -f "$REL_JSON" ] || { echo "找不到 $REL_JSON，请先运行 build-and-upload.mjs"; exit 1; }

REL=$(python3 -c "import json;print(json.load(open('$REL_JSON'))['release'])")
TGZ=$(python3 -c "import json;print(json.load(open('$REL_JSON'))['tgzUrl'])")
ENVU=$(python3 -c "import json;print(json.load(open('$REL_JSON'))['envUrl'])")

TMP=$(mktemp /tmp/oncue-app-step.XXXXXX)
chmod 600 "$TMP"
python3 - "$ROOT/deploy/steps/01-app.sh.tpl" "$TMP" "$REL" "$TGZ" "$ENVU" <<'PY'
import sys, pathlib
tpl, out, rel, tgz, envu = sys.argv[1:6]
s = pathlib.Path(tpl).read_text()
s = s.replace('__RELEASE__', rel).replace('__TGZ_URL__', tgz).replace('__ENV_URL__', envu)
pathlib.Path(out).write_text(s)
PY

echo "版本 $REL，执行脚本 $TMP"
python3 "$ROOT/deploy/remote.py" "$TMP" --root --timeout 300
status=$?
shred -u "$TMP" 2>/dev/null || rm -f "$TMP"
exit $status

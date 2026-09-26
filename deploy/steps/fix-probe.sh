#!/bin/bash
# 停掉崩溃重启循环，查清 node 的真实路径。
set -u
echo "===== 停掉服务，结束重启循环 ====="
systemctl stop oncue 2>&1
systemctl is-active oncue 2>&1 || true

echo "===== node 到底在哪 ====="
echo "command -v node : $(command -v node 2>/dev/null || echo 找不到)"
echo "which node      : $(which node 2>/dev/null || echo 找不到)"
for p in /usr/bin/node /usr/local/bin/node /opt/node/bin/node /snap/bin/node; do
  [ -x "$p" ] && echo "可执行: $p -> $($p -v 2>/dev/null)"
done
echo "--- 用 ubuntu 身份看 ---"
su - ubuntu -c 'command -v node; node -v' 2>&1
echo "--- 用 oncue 身份看（服务实际的身份） ---"
su -s /bin/sh oncue -c 'command -v node || echo "oncue 的 PATH 里没有 node"' 2>&1
echo "--- 全盘找 node 可执行文件 ---"
ls -l /usr/local/bin/node /usr/bin/node 2>&1 | head -4
readlink -f "$(command -v node 2>/dev/null)" 2>/dev/null || true

echo "===== macOS 残留的 ._ 文件 ====="
REL=$(readlink /srv/oncue/current)
find "$REL" -name '._*' 2>/dev/null | head -10
echo "共 $(find "$REL" -name '._*' 2>/dev/null | wc -l) 个"

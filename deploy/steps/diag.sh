#!/bin/bash
# 只读诊断：以 root 看 release 目录真实内容和服务日志。
set -u
REL=$(readlink /srv/oncue/current)
echo "===== current 指向 $REL ====="
ls -la "$REL" 2>&1 | head -10
echo "--- 大小 ---"; du -sh "$REL" 2>&1
echo "--- standalone 下 ---"; ls -la "$REL/standalone" 2>&1 | head -10
echo "--- server.js ---"; test -f "$REL/standalone/server.js" && echo "存在" || echo "不存在"
echo "--- standalone/.next/static ---"; test -d "$REL/standalone/.next/static" && echo "存在（$(ls "$REL/standalone/.next/static" | wc -l) 项）" || echo "不存在"
echo "--- 顶层还有没有 static ---"; test -d "$REL/static" && echo "还在顶层，没移动成功" || echo "不在顶层（已移动或没解出来）"
echo
echo "===== 服务状态 ====="
systemctl is-active oncue; systemctl is-enabled oncue
echo
echo "===== 服务日志（最近 30 行） ====="
journalctl -u oncue -n 30 --no-pager 2>&1
echo
echo "===== 目录权限 ====="
stat -c '%U %G %a %n' /srv/oncue /srv/oncue/releases "$REL" 2>&1

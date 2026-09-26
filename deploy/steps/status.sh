#!/bin/sh
# 只读：查看 oncue 部署到哪一步了，以及现有站点有没有受影响。
set -u
echo "===== oncue 用户 ====="; id oncue 2>/dev/null || echo "不存在"
echo "===== /srv/oncue ====="; ls -la /srv/oncue 2>/dev/null || echo "不存在"
echo "===== releases ====="; ls -la /srv/oncue/releases 2>/dev/null || echo "不存在"
echo "===== 解包内容是否完整 ====="
for d in /srv/oncue/releases/*/; do
  [ -d "$d" ] || continue
  echo "$d: $(du -sh "$d" 2>/dev/null | cut -f1)"
  ls "$d" 2>/dev/null
  test -f "$d/standalone/server.js" && echo "  server.js ✓" || echo "  server.js ✗"
  test -d "$d/standalone/.next/static" && echo "  standalone/.next/static ✓" || echo "  standalone/.next/static ✗"
  test -d "$d/static" && echo "  （static 还在顶层，未移动）" || true
done
echo "===== current 软链接 ====="; ls -l /srv/oncue/current 2>/dev/null || echo "不存在（预期，还没建）"
echo "===== 环境变量文件 ====="; sudo stat -c '%U %G %a %n' /etc/oncue/oncue.env 2>/dev/null || echo "不存在"
echo "===== systemd 服务 ====="; ls /etc/systemd/system/oncue.service 2>/dev/null || echo "不存在（预期，还没建）"
systemctl is-active oncue 2>/dev/null || echo "未运行（预期）"
echo "===== Nginx 有没有被动过（关键） ====="
ls -1 /etc/nginx/sites-enabled/
sudo nginx -T 2>/dev/null > /tmp/oncue-nginx-now.conf
echo "当前配置 md5: $(sudo md5sum /tmp/oncue-nginx-now.conf | cut -d' ' -f1)"
echo "基线配置 md5: $(sudo md5sum /tmp/oncue-nginx-before.conf 2>/dev/null | cut -d' ' -f1)"
echo "===== 现有站点响应码 ====="
for u in https://demo.imalltrix.com/ https://readcore.imalltrix.com/ ; do
  printf '%-40s %s\n' "$u" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>&1 || echo FAIL)"
done
for u in https://wish.imalltrix.com/ http://118.89.93.225/ ; do
  printf '%-40s %s (HEAD)\n' "$u" "$(curl -sSI -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>&1 || echo FAIL)"
done
echo "===== 端口 ====="; sudo ss -ltn | grep -E ':(80|443|3000|8080) ' || true

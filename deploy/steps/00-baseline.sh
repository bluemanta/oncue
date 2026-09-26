#!/bin/sh
# 第 0 步：部署前基线。只读，记录现有站点的状态，作为"没搞坏"的对照。
set -u

echo "===== 时间 ====="
date -u

echo "===== 现有站点响应码 ====="
for u in https://demo.imalltrix.com/ https://readcore.imalltrix.com/ \
         https://wish.imalltrix.com/ http://118.89.93.225/ ; do
  printf '%-40s %s\n' "$u" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>&1 || echo FAIL)"
done

echo "===== oncue.imalltrix.com 当前表现（应还没有站点） ====="
printf '%-40s %s\n' "http://oncue.imalltrix.com/" \
  "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 http://oncue.imalltrix.com/ 2>&1 || echo FAIL)"

echo "===== 保存现有 Nginx 配置全文（回滚对照） ====="
sudo nginx -T > /tmp/oncue-nginx-before.conf 2>/dev/null
echo "已保存 /tmp/oncue-nginx-before.conf，$(wc -l < /tmp/oncue-nginx-before.conf) 行"
sudo md5sum /tmp/oncue-nginx-before.conf

echo "===== 现有已启用站点 ====="
ls -1 /etc/nginx/sites-enabled/

echo "===== 端口 3000 是否空闲 ====="
sudo ss -ltn 2>/dev/null | grep -q ':3000 ' && echo "被占用！停止部署" || echo "空闲，可用"

echo "===== 是否已存在 oncue 相关对象 ====="
id oncue 2>/dev/null && echo "用户 oncue 已存在" || echo "用户 oncue 不存在（预期）"
ls -d /srv/oncue 2>/dev/null || echo "/srv/oncue 不存在（预期）"
ls /etc/systemd/system/oncue.service 2>/dev/null || echo "oncue.service 不存在（预期）"

echo "===== 基线记录完成 ====="

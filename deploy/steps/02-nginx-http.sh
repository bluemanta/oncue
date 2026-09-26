#!/bin/bash
# 第 4 步：只加一个 :80 的 server 块，供 certbot 做 ACME 验证。
# 只新增文件，不改任何现有配置。nginx -t 不过就不 reload。
set -euo pipefail

echo "===== 写入 /etc/nginx/sites-available/oncue（仅 80） ====="
cat > /etc/nginx/sites-available/oncue <<'CONF'
server {
    listen 80;
    server_name oncue.imalltrix.com;

    location /.well-known/acme-challenge/ {
        root /srv/oncue/acme;
    }
    location / {
        return 404;
    }
}
CONF
ln -sfn /etc/nginx/sites-available/oncue /etc/nginx/sites-enabled/oncue
ls -l /etc/nginx/sites-enabled/oncue

echo "===== nginx -t ====="
if ! nginx -t; then
  echo "配置检查不通过，撤掉软链接后退出"
  rm -f /etc/nginx/sites-enabled/oncue
  nginx -t
  exit 1
fi

echo "===== reload ====="
systemctl reload nginx
sleep 2
systemctl is-active nginx

echo "===== 验证：现有站点没受影响 ====="
fail=0
for u in https://demo.imalltrix.com/ https://readcore.imalltrix.com/ ; do
  c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>/dev/null || echo FAIL)
  printf '%-40s %s\n' "$u" "$c"; [ "$c" = "200" ] || fail=1
done
for u in https://wish.imalltrix.com/ http://118.89.93.225/ ; do
  c=$(curl -sSI -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>/dev/null || echo FAIL)
  printf '%-40s %s (HEAD)\n' "$u" "$c"; [ "$c" = "200" ] || fail=1
done
if [ "$fail" != "0" ]; then
  echo "现有站点异常，立即回滚"
  rm -f /etc/nginx/sites-enabled/oncue
  nginx -t && systemctl reload nginx
  exit 1
fi

echo "===== 验证：ACME 路径可达 ====="
mkdir -p /srv/oncue/acme/.well-known/acme-challenge
echo "oncue-acme-ok" > /srv/oncue/acme/.well-known/acme-challenge/probe
chown -R oncue:oncue /srv/oncue/acme
body=$(curl -sS --max-time 15 http://oncue.imalltrix.com/.well-known/acme-challenge/probe 2>/dev/null || echo FAIL)
echo "探针返回: $body"
rm -f /srv/oncue/acme/.well-known/acme-challenge/probe
[ "$body" = "oncue-acme-ok" ] || { echo "ACME 路径不通，回滚"; rm -f /etc/nginx/sites-enabled/oncue; nginx -t && systemctl reload nginx; exit 1; }

echo "===== 80 端口配置完成，现有站点全部正常 ====="

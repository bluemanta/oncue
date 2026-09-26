#!/bin/bash
# 第 6 步：把 oncue 站点换成完整配置——80 跳转 443，443 反代到本机 3000。
# 改的仍然只有 oncue 自己那个文件，其它站点一律不碰。失败自动回滚到上一版。
set -uo pipefail

DOMAIN=oncue.imalltrix.com
CONF=/etc/nginx/sites-available/oncue

echo "===== 备份当前 oncue 配置（仅 80 的版本） ====="
cp -a "$CONF" "$CONF.bak-$(date +%s)"
ls -1 "$CONF".bak-* | tail -1

# certbot 通常会放一份 SSL 加固参数，有就引用，没有就自己写基本项
if [ -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
  SSL_EXTRA="    include /etc/letsencrypt/options-ssl-nginx.conf;"
  echo "使用 certbot 的 SSL 参数文件"
else
  SSL_EXTRA="    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;"
  echo "certbot 没有 SSL 参数文件，写入基本项"
fi

echo "===== 写入完整配置 ====="
cat > "$CONF" <<CONF_END
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /srv/oncue/acme;
    }
    location / {
        return 301 https://$DOMAIN\$request_uri;
    }
}

server {
    # nginx 1.24 用的是这种写法；1.25 之后才是单独的 http2 on;
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
$SSL_EXTRA

    # 跟读录音上传要用；卡片由大模型生成，要等几秒
    client_max_body_size 10m;

    location /.well-known/acme-challenge/ {
        root /srv/oncue/acme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
CONF_END

echo "===== nginx -t ====="
if ! nginx -t; then
  echo "配置不通过，恢复上一版"
  cp -a "$(ls -1 "$CONF".bak-* | tail -1)" "$CONF"
  nginx -t && systemctl reload nginx
  exit 1
fi

echo "===== reload ====="
systemctl reload nginx
sleep 2

echo "===== 验证 oncue 自己 ====="
https_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "https://$DOMAIN/" 2>&1 || echo FAIL)
http_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "http://$DOMAIN/" 2>&1 || echo FAIL)
echo "https://$DOMAIN/  → $https_code （期望 200）"
echo "http://$DOMAIN/   → $http_code （期望 301）"

echo "===== 验证现有站点没受影响 ====="
fail=0
for u in https://demo.imalltrix.com/ https://readcore.imalltrix.com/ ; do
  c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>/dev/null || echo FAIL)
  printf '%-40s %s\n' "$u" "$c"; [ "$c" = "200" ] || fail=1
done
for u in https://wish.imalltrix.com/ http://118.89.93.225/ ; do
  c=$(curl -sSI -o /dev/null -w '%{http_code}' --max-time 15 "$u" 2>/dev/null || echo FAIL)
  printf '%-40s %s (HEAD)\n' "$u" "$c"; [ "$c" = "200" ] || fail=1
done

if [ "$https_code" != "200" ] || [ "$fail" != "0" ]; then
  echo "!!! 验证不通过，回滚到仅 80 的版本 !!!"
  cp -a "$(ls -1 "$CONF".bak-* | tail -1)" "$CONF"
  nginx -t && systemctl reload nginx
  exit 1
fi

echo "===== 全部通过 ====="

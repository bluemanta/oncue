#!/bin/bash
# 第 7 步：给 oncue 站点加按 IP 限流。
#
# 为什么要：/result?q=… 是普通 GET，打开一次就是一次大模型调用；
# /api/speech、/api/assess 也是开放接口。这一层挡"一分钟内太密集"，
# 应用里的每日上限挡"一整天慢慢刷"，两层配合才拦得住。
#
# 改的仍然只有 /etc/nginx/sites-available/oncue 这一个文件，其它站点一律不碰。
# limit_req_zone 必须在 http 段里——sites-enabled 下的文件是被 http 段 include
# 的，所以写在本文件顶层就在 http 段里，不用动 nginx.conf。
#
# 失败自动回滚到上一版。
set -uo pipefail

DOMAIN=oncue.imalltrix.com
CONF=/etc/nginx/sites-available/oncue

echo "===== 备份当前配置 ====="
cp -a "$CONF" "$CONF.bak-$(date +%s)"
BACKUP=$(ls -1 "$CONF".bak-* | tail -1)
echo "备份到 $BACKUP"

# 和第 6 步保持一致：certbot 有加固参数就用它的
if [ -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
  SSL_EXTRA="    include /etc/letsencrypt/options-ssl-nginx.conf;"
else
  SSL_EXTRA="    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;"
fi

echo "===== 写入带限流的配置 ====="
cat > "$CONF" <<CONF_END
# 按客户端 IP 限流。10m 的共享内存大约能跟踪 16 万个 IP。
#
# 速率故意不算紧：公司网络几十个人共用一个出口 IP，现场演示、内部分享
# 很容易撞上（这正是推广要用的场景），卡住真实用户比挡住脚本更糟。
# 真正的成本保护是应用里的每日上限，这一层只负责挡住瞬时的洪水。
limit_req_zone \$binary_remote_addr zone=oncue_card:10m rate=60r/m;
limit_req_zone \$binary_remote_addr zone=oncue_api:10m rate=240r/m;

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

    # 被限住时返回 429（太频繁），比默认的 503（服务不可用）准确
    limit_req_status 429;

    # 反代参数写在 server 层，下面几个 location 自动继承，不用重复
    proxy_http_version 1.1;
    proxy_set_header Host              \$host;
    proxy_set_header X-Real-IP         \$remote_addr;
    proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade           \$http_upgrade;
    proxy_set_header Connection        "upgrade";
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;

    location /.well-known/acme-challenge/ {
        root /srv/oncue/acme;
    }

    # 查词：每次都是一次大模型调用，最贵的一个入口
    location /result {
        limit_req zone=oncue_card burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }

    # 读音和跟读评测：一次查词会连着点几下播放，burst 给得宽一些
    location /api/ {
        limit_req zone=oncue_api burst=40 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }

    # 首页和静态资源不限流
    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}
CONF_END

rollback() {
  echo "!!! $1，回滚到 $BACKUP !!!"
  cp -a "$BACKUP" "$CONF"
  nginx -t && systemctl reload nginx
  exit 1
}

echo "===== nginx -t ====="
nginx -t || rollback "配置不通过"

echo "===== reload ====="
systemctl reload nginx
sleep 2

echo "===== 验证 oncue 自己 ====="
https_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "https://$DOMAIN/" 2>&1 || echo FAIL)
http_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "http://$DOMAIN/" 2>&1 || echo FAIL)
echo "https://$DOMAIN/  → $https_code （期望 200）"
echo "http://$DOMAIN/   → $http_code （期望 301）"
[ "$https_code" = "200" ] || rollback "首页不通"

echo "===== 验证限流真的生效 ====="
# 故意不带 ?q=，这种请求应用直接返回"没有收到要查的内容"，不会调大模型，
# 所以连打几十次不花一分钱，但走的是同一个 location，能验出限流。
ok=0; limited=0
for _ in $(seq 1 45); do
  c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/result" 2>/dev/null || echo FAIL)
  case "$c" in
    200) ok=$((ok+1)) ;;
    429) limited=$((limited+1)) ;;
  esac
done
echo "连打 45 次 /result：放行 $ok 次，被限 $limited 次"
[ "$limited" -gt 0 ] || rollback "限流没生效（一次都没被挡）"
[ "$ok" -gt 0 ]      || rollback "限流太狠（一次都没放行）"

echo "===== 等一分钟让计数恢复，确认正常用户不受影响 ====="
sleep 62
c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMAIN/result" 2>/dev/null || echo FAIL)
echo "恢复后再请求一次 → $c （期望 200）"
[ "$c" = "200" ] || rollback "限流没有自行恢复"

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
[ "$fail" = "0" ] || rollback "现有站点受影响"

echo "===== 全部通过 ====="
echo "回滚方法：cp -a $BACKUP $CONF && nginx -t && systemctl reload nginx"

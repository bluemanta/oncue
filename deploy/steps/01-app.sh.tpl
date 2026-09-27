#!/bin/bash
# 第 1–3 步：建用户和目录、放环境变量、部署代码、起 systemd 服务。
# 全程不碰 Nginx，所以这一步失败也不会影响现有站点。
# 占位符 __RELEASE__ / __TGZ_URL__ / __ENV_URL__ 由 deploy/run-app-step.sh 替换。
set -euo pipefail

REL="__RELEASE__"
DIR="/srv/oncue/releases/$REL"

echo "===== 1. 用户与目录 ====="
id oncue >/dev/null 2>&1 || useradd --system --home /srv/oncue --shell /usr/sbin/nologin oncue
mkdir -p /srv/oncue/releases /srv/oncue/acme /etc/oncue
chown -R oncue:oncue /srv/oncue
id oncue
ls -ld /srv/oncue /srv/oncue/acme

echo "===== 2. 环境变量 ====="
umask 077
curl -fsSL "__ENV_URL__" -o /tmp/oncue.env
install -m 600 -o root -g oncue /tmp/oncue.env /etc/oncue/oncue.env
shred -u /tmp/oncue.env 2>/dev/null || rm -f /tmp/oncue.env
umask 022
echo "权限: $(stat -c '%U %G %a' /etc/oncue/oncue.env)"
echo "变量名（不显示值）:"
sed 's/=.*//' /etc/oncue/oncue.env | sed 's/^/  /'

echo "===== 3. 确认 node 路径 ====="
NODE_BIN=$(command -v node || true)
echo "node: ${NODE_BIN:-找不到} $($NODE_BIN -v 2>/dev/null)"
[ "$NODE_BIN" = "/usr/local/bin/node" ] || { echo "node 路径和 service 里写的不一致，中止"; exit 1; }

echo "===== 4. 下载并解包代码 ====="
curl -fsSL "__TGZ_URL__" -o /tmp/oncue.tgz
echo "下载 $(du -h /tmp/oncue.tgz | cut -f1)"
rm -rf "$DIR"
mkdir -p "$DIR"
tar -xzf /tmp/oncue.tgz -C "$DIR" 2>/tmp/oncue-tar.err || { echo "解包失败："; tail -5 /tmp/oncue-tar.err; exit 1; }
find "$DIR" -name "._*" -delete 2>/dev/null || true
rm -f /tmp/oncue.tgz
# Next.js standalone 不会自带 static 和 public，要手动并到位
mv "$DIR/static" "$DIR/standalone/.next/static"
if [ -d "$DIR/public" ]; then mv "$DIR/public" "$DIR/standalone/public"; fi
chown -R oncue:oncue "$DIR"
test -f "$DIR/standalone/server.js" || { echo "缺少 server.js，中止"; exit 1; }
test -d "$DIR/standalone/.next/static" || { echo "缺少 static，中止"; exit 1; }
test -f "$DIR/standalone/public/icon-192.png" || { echo "缺少 public 静态文件，中止"; exit 1; }
echo "解包完成：$(du -sh "$DIR" | cut -f1)"
ln -sfn "$DIR" /srv/oncue/current
ls -l /srv/oncue/current

echo "===== 5. systemd 服务 ====="
cat > /etc/systemd/system/oncue.service <<'UNIT'
[Unit]
Description=OnCue 单词
After=network.target

[Service]
Type=simple
User=oncue
Group=oncue
WorkingDirectory=/srv/oncue/current/standalone
EnvironmentFile=/etc/oncue/oncue.env
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/local/bin/node server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/oncue

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable oncue
# 必须用 restart 而不是 enable --now：服务已在运行时 --now 不会重启，
# 结果就是软链接换了、进程还跑着旧代码，部署看起来成功其实没生效。
systemctl restart oncue
sleep 4
systemctl is-active oncue || { journalctl -u oncue -n 40 --no-pager; exit 1; }
echo "进程启动时间: $(systemctl show oncue -p ActiveEnterTimestamp --value)"
echo "进程工作目录: $(readlink -f /proc/$(systemctl show oncue -p MainPID --value)/cwd 2>/dev/null)"

echo "===== 6. 本机自测（还没碰 Nginx） ====="
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000/ 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  echo "第 $i 次尝试：$code，等 2 秒"; sleep 2
done
echo "首页 http://127.0.0.1:3000/ → $code"
[ "$code" = "200" ] || { echo "首页不通，中止"; journalctl -u oncue -n 40 --no-pager; exit 1; }

echo "===== 7. 确认线上没有启用假的跟读结果 ====="
if grep -rq "NEXT_PUBLIC_MOCK_ASSESSMENT" /etc/oncue/oncue.env 2>/dev/null; then
  echo "危险：环境变量里出现了 mock 开关，中止"; exit 1
fi
echo "确认：环境变量里没有 mock 开关"

echo "===== 应用层部署完成 ====="

#!/bin/bash
# 部署后完整验收。只读，可反复运行。
set -u
pass=0; fail=0
chk() { # chk 描述 期望 实际
  if [ "$2" = "$3" ]; then printf '  ✅ %-34s %s\n' "$1" "$3"; pass=$((pass+1));
  else printf '  ❌ %-34s 期望 %s，实际 %s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
code()  { curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$1" 2>/dev/null || echo FAIL; }
hcode() { curl -sSI -o /dev/null -w '%{http_code}' --max-time 25 "$1" 2>/dev/null || echo FAIL; }

echo "===== OnCue 自己 ====="
chk "https 首页"        200 "$(code https://oncue.imalltrix.com/)"
chk "http 跳转"         301 "$(code http://oncue.imalltrix.com/)"
chk "结果页（真实查词）"  200 "$(code 'https://oncue.imalltrix.com/result?q=negotiate')"

echo "===== 现有站点（重点：没被搞坏） ====="
chk "demo.imalltrix.com"     200 "$(code https://demo.imalltrix.com/)"
chk "readcore.imalltrix.com" 200 "$(code https://readcore.imalltrix.com/)"
chk "wish.imalltrix.com"     200 "$(hcode https://wish.imalltrix.com/)"
chk "118.89.93.225 直访"      200 "$(hcode http://118.89.93.225/)"

echo "===== 服务与自愈 ====="
chk "oncue 服务"      active  "$(systemctl is-active oncue)"
chk "开机自启"         enabled "$(systemctl is-enabled oncue)"
chk "nginx"           active  "$(systemctl is-active nginx)"
chk "证书自动续期"      active  "$(systemctl is-active certbot.timer)"
echo "  重启一次试试自愈…"
sudo systemctl restart oncue >/dev/null 2>&1; sleep 5
chk "重启后仍可用"      200     "$(code http://127.0.0.1:3000/)"

echo "===== 安全 ====="
chk "只监听本机 3000"  1 "$(sudo ss -ltn | grep -c '127.0.0.1:3000')"
chk "3000 未对公网开放" 0 "$(sudo ss -ltn | grep -c '0.0.0.0:3000')"
chk "密钥文件权限"      600 "$(sudo stat -c '%a' /etc/oncue/oncue.env)"
chk "运维凭证不在服务器" 0 "$(sudo grep -rl 'imalltrix' /etc/oncue/ 2>/dev/null | wc -l | tr -d ' ')"
chk "服务不以 root 运行" oncue "$(systemctl show oncue -p User --value)"

echo "===== 证书 ====="
sudo openssl x509 -in /etc/letsencrypt/live/oncue.imalltrix.com/fullchain.pem -noout -subject -enddate 2>/dev/null | sed 's/^/  /'

echo "===== 版本 ====="
echo "  current -> $(readlink /srv/oncue/current)"
echo "  保留的历史版本：$(ls -1 /srv/oncue/releases | tr '\n' ' ')"

echo
echo "===== 合计：通过 $pass 项，失败 $fail 项 ====="
[ "$fail" -eq 0 ] || exit 1

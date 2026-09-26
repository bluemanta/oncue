#!/bin/bash
# 第 5 步：申请 Let's Encrypt 证书。和现有三张证书同一套机制（certbot webroot）。
set -uo pipefail

DOMAIN=oncue.imalltrix.com

echo "===== 现有 certbot 账户与证书 ====="
certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry' || true
ls -1 /etc/letsencrypt/accounts/*/*/ 2>/dev/null | head -2 && echo "（已有 Let's Encrypt 账户，不用再填邮箱）"

echo
echo "===== 申请 $DOMAIN ====="
if certbot certonly --webroot -w /srv/oncue/acme -d "$DOMAIN" \
     --non-interactive --agree-tos --no-eff-email --keep-until-expiring 2>&1; then
  echo "申请成功"
else
  echo "申请失败，见上面输出。80 端口配置保留，未影响任何站点。"
  exit 1
fi

echo
echo "===== 证书文件 ====="
ls -l /etc/letsencrypt/live/"$DOMAIN"/ 2>&1
openssl x509 -in /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem -noout -subject -enddate 2>&1

echo
echo "===== 自动续期 ====="
systemctl is-active certbot.timer 2>&1 || echo "certbot.timer 未激活"
systemctl is-enabled certbot.timer 2>&1 || true
echo "--- 续期演练 ---"
certbot renew --dry-run --cert-name "$DOMAIN" 2>&1 | tail -6

echo "===== 证书步骤完成 ====="

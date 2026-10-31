#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Restrict the origin to Cloudflare only.
#
# Why this exists: `ufw allow 80/443` is decorative on a Docker host.
# Docker inserts its own iptables rules for published ports ahead of ufw's
# chains, so the origin stays reachable directly even when ufw says "deny".
# That is how client-supplied CF-Connecting-IP could be spoofed to dodge the
# rate limiters. The supported hook is the DOCKER-USER chain, which Docker
# never touches.
#
# Run as root on the server:  bash cf-only-firewall.sh
# Revert:                     iptables -F DOCKER-USER
# Re-check:                   iptables -S DOCKER-USER
#
# Keep the list in sync with https://www.cloudflare.com/ips/
# ─────────────────────────────────────────────────────────────
set -u

CF="173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22
2400:cb00::/32
2606:4700::/32
2803:f800::/32
2405:b500::/32
2405:8100::/32
2a06:98c0::/29
2c0f:f248::/32"

echo "== ufw (defence in depth; Docker bypasses it anyway) =="
for r in $CF; do
  ufw allow from "$r" to any port 80,443 proto tcp >/dev/null 2>&1
  ufw allow from "$r" to any port 443 proto udp >/dev/null 2>&1
done
ufw reload >/dev/null 2>&1
echo "ufw rules matching 80,443: $(ufw status | grep -c '80,443')"

echo "== DOCKER-USER: allow Cloudflare, drop everything else =="
iptables -F DOCKER-USER 2>/dev/null
iptables -A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
for r in $CF; do
  case "$r" in
    *:*) ip6tables -A DOCKER-USER -s "$r" -p tcp -m multiport --dports 80,443 -j RETURN 2>/dev/null
         ip6tables -A DOCKER-USER -s "$r" -p udp -m multiport --dports 443 -j RETURN 2>/dev/null ;;
    *)   iptables -A DOCKER-USER -s "$r" -p tcp -m multiport --dports 80,443 -j RETURN
         iptables -A DOCKER-USER -s "$r" -p udp -m multiport --dports 443 -j RETURN ;;
  esac
done
iptables -A DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP
iptables -A DOCKER-USER -p udp -m multiport --dports 443 -j DROP
ip6tables -A DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP 2>/dev/null
ip6tables -A DOCKER-USER -p udp -m multiport --dports 443 -j DROP 2>/dev/null

echo "ipv4 rules: $(iptables -S DOCKER-USER | wc -l)"
echo "last rule:  $(iptables -S DOCKER-USER | tail -1)"

# Survive a reboot if iptables-persistent is installed; harmless if not.
if [ -d /etc/iptables ]; then
  iptables-save > /etc/iptables/rules.v4
  ip6tables-save > /etc/iptables/rules.v6 2>/dev/null || true
  echo "saved to /etc/iptables/rules.v4"
else
  echo "NOTE: /etc/iptables missing — install iptables-persistent to survive reboot"
fi

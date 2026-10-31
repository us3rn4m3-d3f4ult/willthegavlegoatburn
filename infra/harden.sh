#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# harden.sh — first-boot hardening for Ubuntu 24.04 (Hetzner / any VPS)
#
# Run ONCE as root, from a console session (not SSH) if possible:
#     bash harden.sh
#
# Refuses to switch to key-only auth unless an SSH key is already present.
# Order matters: keys first, then disable passwords. Never the other way round.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"

log() { printf '\n\033[1;33m▸ %s\033[0m\n' "$1"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

# ── 1. a key must exist before we disable passwords ───────────────────────────
KEYFILES=(/root/.ssh/authorized_keys /home/*/.ssh/authorized_keys)
HAVE_KEY=0
for f in "${KEYFILES[@]}"; do
  [[ -s "$f" ]] && HAVE_KEY=1
done
if [[ "$HAVE_KEY" -eq 0 ]]; then
  cat >&2 <<'EOF'
✗ No SSH public key found on this box.

Add one first, from YOUR laptop:

    ssh-keygen -t ed25519 -C "gavle-deploy"      # if you don't have one
    type $HOME\.ssh\id_ed25519.pub | ssh root@148.135.185.56 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"

Then re-run this script. It will NOT lock you out.
EOF
  exit 1
fi

# ── 2. base packages ─────────────────────────────────────────────────────────
log "Updating system"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades ca-certificates curl gnupg jq htop

# ── 3. swap (2 GB) ───────────────────────────────────────────────────────────
log "Configuring 2 GB swap"
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# ── 4. deploy user with the same keys ────────────────────────────────────────
log "Creating '${DEPLOY_USER}' user"
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
for f in "${KEYFILES[@]}"; do
  [[ -s "$f" ]] && cat "$f" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
done
sort -u "/home/$DEPLOY_USER/.ssh/authorized_keys" -o "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:/usr/bin/docker, /usr/bin/docker-compose" > "/etc/sudoers.d/90-$DEPLOY_USER-docker"
chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER-docker"

# ── 5. sshd hardening ────────────────────────────────────────────────────────
log "Hardening sshd (key-only)"
cat > /etc/ssh/sshd_config.d/99-gavle.conf <<EOF
Port ${SSH_PORT}
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
AllowAgentForwarding no
EOF
sshd -t
systemctl restart ssh

# ── 6. firewall ──────────────────────────────────────────────────────────────
log "Configuring ufw"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# ── 7. fail2ban ──────────────────────────────────────────────────────────────
log "Configuring fail2ban"
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
port = ${SSH_PORT}
maxretry = 4
bantime = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ── 8. unattended upgrades ───────────────────────────────────────────────────
log "Enabling unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades

# ── 9. docker ────────────────────────────────────────────────────────────────
log "Installing Docker"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$DEPLOY_USER"
systemctl enable --now docker

# ── 10. summary ──────────────────────────────────────────────────────────────
log "Done"
cat <<EOF

Next steps:
  1. From your laptop:   ssh ${DEPLOY_USER}@148.135.185.56
  2. Clone the repo into /home/${DEPLOY_USER}/gavle
  3. Create /home/${DEPLOY_USER}/gavle/.env.local (never commit it)
  4. cd infra && docker compose up -d --build

Root password login is now DISABLED. You need the SSH key from here on.
EOF

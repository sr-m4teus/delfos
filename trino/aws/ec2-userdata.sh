#!/bin/bash
# EC2 user-data (cloud-init) -- Amazon Linux 2023.
# Instala Docker + plugin compose. NAO sobe o Trino (config/.env vao por scp depois).
# Cola isso no campo "User data" ao lancar a instancia, OU roda manual via SSH.
set -euxo pipefail

# --- SWAP 2GB (rede de seguranca contra picos; em 8GiB nao e critico, mas barato manter) ---
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab   # persiste apos reboot
  sysctl -w vm.swappiness=10                          # so usa swap sob pressao real
fi

dnf update -y
dnf install -y docker httpd-tools   # httpd-tools = htpasswd (gera password.db)

systemctl enable --now docker
usermod -aG docker ec2-user         # ec2-user usa docker sem sudo (relogar p/ valer)

# Plugin compose v2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "READY: docker $(docker --version), compose $(docker compose version)" > /var/log/trino-bootstrap.done

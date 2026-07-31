#!/usr/bin/env sh
set -e

# Tailscale em modo USERSPACE: não precisa de TUN nem NET_ADMIN (compatível com Render).
# Expõe um proxy SOCKS5 em localhost:1055 que o backend usa só para falar com o Trino.
/usr/local/bin/tailscaled \
  --tun=userspace-networking \
  --socks5-server=localhost:1055 \
  --state=mem: \
  --socket=/var/run/tailscale/tailscaled.sock &

# Entra na tailnet com auth key efêmera (vem da env var TS_AUTHKEY no Render).
/usr/local/bin/tailscale up \
  --authkey="${TS_AUTHKEY}" \
  --hostname="${TS_HOSTNAME:-delfos-backend}" \
  --accept-routes

echo "Tailscale conectado. Iniciando backend..."

# Inicia o NestJS (escuta em PORT injetada pelo Render).
exec node dist/main

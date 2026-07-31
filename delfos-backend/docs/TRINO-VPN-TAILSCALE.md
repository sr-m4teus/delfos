# Backend (Render) → Trino atrás de VPN, via Tailscale

Render é PaaS gerenciado: sem `NET_ADMIN`, sem device TUN, sem sidecar.
Cliente WireGuard clássico não roda lá. Solução: **Tailscale em modo userspace**
dentro do container do backend, expondo um proxy SOCKS5 (`localhost:1055`).

Só o tráfego do Trino passa pela tailnet. Supabase / Atlas / Upstash continuam
saindo pela internet normal (split-tunnel automático — não rota tudo).

```
Backend (Render, Docker)              Servidor privado (atrás da VPN)
┌───────────────────────┐   tailnet  ┌──────────────────────┐
│ tailscaled --userspace │◄──────────►│ tailscale            │
│   SOCKS5 :1055         │  WireGuard │ + Trino :8080        │
│ NestJS ─(socks5h)─────►│            └──────────────────────┘
│ ──internet───────────► Supabase / Atlas / Upstash (direto)
└───────────────────────┘
```

---

## 1. Servidor privado do Trino (uma vez)

Tailscale roda como camada extra; não mexe na VPN corporativa existente.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4          # anota o IP da tailnet, ex: 100.101.102.103
```

Trino fica alcançável em `http://<ip-tailnet>:8080` por qualquer nó da tailnet.
Confirma que o coordinator do Trino escuta na porta certa (`http-server.http.port`).

> Se a porta interna do Trino for 8081 (como no docker-compose local), use 8081.

## 2. Auth key para o backend

Admin console Tailscale → **Settings → Keys → Generate auth key**:
- **Ephemeral**: ✅ (nó some sozinho quando o Render reinicia)
- **Reusable**: ✅ (cada deploy reusa)

Copia a chave (`tskey-auth-...`).

## 3. Variáveis no Render

Dashboard do serviço → **Environment** (ou via `render.yaml` blueprint):

| Var | Valor |
|-----|-------|
| `TS_AUTHKEY` | a auth key efêmera (secret) |
| `TRINO_SOCKS_PROXY` | `socks5h://localhost:1055` |
| `TRINO_URL` | `http://<ip-tailnet>:8080` |
| `TRINO_USER` | `delfos_user` |
| `TRINO_CATALOG` | `default` |

`render.yaml` na raiz de `delfos-backend` já declara todas — só preencher os `sync:false`.

## 4. Deploy

Render precisa usar o **Dockerfile** (não o runtime Node nativo), pois o
`tailscaled` é embutido na imagem. Com `render.yaml` (`runtime: docker`)
isso já está configurado. Se o serviço já existe como Node nativo, troque
**Settings → Build → Runtime** para **Docker**.

```
git add .
git commit -m "feat: acesso ao Trino via Tailscale userspace"
git push        # Render faz auto-deploy
```

## 5. Validar

Logs do Render no boot devem mostrar:
```
Tailscale conectado. Iniciando backend...
Trino acessível via proxy SOCKS5: socks5h://localhost:1055
```

No admin do Tailscale o nó `delfos-backend` aparece online.
Dispara uma query no endpoint do Trino do backend — deve responder.

### Debug
- `tailscale up` trava no boot → `TS_AUTHKEY` inválida/expirada.
- Conecta mas query dá timeout → firewall do servidor Trino bloqueia a porta,
  ou `TRINO_URL` aponta IP/porta errados. Teste no servidor: `curl http://localhost:8080/v1/info`.
- Erro `socks5h` / proxy → confirme `npm ci` instalou `socks-proxy-agent` na imagem.

---

## Como funciona no código

`src/trino/services/trino-client.service.ts`: se `TRINO_SOCKS_PROXY` está
definida, cria um `SocksProxyAgent` e o injeta (`httpAgent`/`httpsAgent`,
`proxy:false`) em todas as chamadas axios ao Trino. Vazio = conexão direta
(dev local). Nenhuma outra parte do backend usa esse agent, então só o Trino
roteia pela tailnet.

## Alternativa: Cloudflare Tunnel

Se a rede do Trino não permitir Tailscale: rodar `cloudflared` no servidor
Trino (túnel outbound), expor um hostname HTTPS protegido por Cloudflare Access.
Backend bate no hostname público com service token — sem nada especial no Render.
Trade-off: tráfego passa pela borda da Cloudflare.

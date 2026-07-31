# Trino na AWS EC2 (2ª opção, free credit 90d)

Backup do deploy Oracle. Mesma config `trino/` — só muda a VM. Conecta nos mesmos
bancos cloud (Supabase + Atlas) via `.env`. Backend (Render) passa a apontar pro IP da AWS.

> Instância: **`m7i-flex.large`** (8GiB, 2 vCPU). Confortável p/ Trino — heap 5G (`jvm.config`).
> NÃO é free-tier; pago via credit ($120). ~$0.096/h → 24/7 estoura ($207/90d), então
> **dar Stop quando ocioso** (parado paga só EBS ~$1.6/mês). ~8h/dia ≈ $70 no TCC inteiro.

---

## 1. Lançar a EC2

Console AWS → EC2 → Launch instance:

| Campo | Valor |
|---|---|
| AMI | Amazon Linux 2023 (x86_64) |
| Tipo | `m7i-flex.large` (8GiB, 2 vCPU) |
| Key pair | criar nova `trino-aws` (AWS gera, baixa `trino-aws.pem`) |
| Disco | 20 GB gp3 |
| User data | colar conteúdo de `ec2-userdata.sh` |

### Security Group (firewall AWS) — regras inbound
| Porta | Protocolo | Origem | Motivo |
|---|---|---|---|
| 22 | TCP | **seu IP/32** | SSH (não deixar 0.0.0.0/0) |
| 8443 | TCP | 0.0.0.0/0 | Trino HTTPS público (backend Render alcança) |

NÃO abrir 8080 (HTTP interno).

### Elastic IP (recomendado)
EC2 → Elastic IPs → Allocate → Associate na instância. IP fixo → backend não quebra em reboot.

---

## 2. Conectar e subir o Trino

```bash
# 1) SSH (chave que você usou no launch)
ssh -i ~/.ssh/trino-aws.pem ec2-user@<ELASTIC-IP>

# 2) Confirmar bootstrap pronto
cat /var/log/trino-bootstrap.done   # deve mostrar versões docker/compose
free -h                             # swap deve mostrar 2.0Gi (senao Trino vai morrer por OOM)
```

Do seu PC, copiar a pasta `trino/` (sem node_modules/segredos versionados):
```bash
scp -i ~/.ssh/trino-aws.pem -r ./trino ec2-user@<ELASTIC-IP>:~/trino
```

De volta na VM:
```bash
cd ~/trino

# 3) cert self-signed (PEM único: chave+cert) -- usar o ELASTIC-IP no CN
mkdir -p config/cert
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout /tmp/k.pem -out /tmp/c.pem \
  -subj "/CN=<ELASTIC-IP>" \
  -addext "subjectAltName=IP:<ELASTIC-IP>"
cat /tmp/k.pem /tmp/c.pem > config/cert/trino.pem && rm /tmp/k.pem /tmp/c.pem

# 4) password.db (bcrypt) -- mesmo user do backend
htpasswd -B -C 10 -c config/password.db delfos_user

# 5) .env com credenciais Supabase + Atlas
cp .env.example .env && nano .env

# 6) subir
docker compose up -d
docker compose logs -f trino        # esperar "SERVER STARTED"
```

---

## 3. Testar

```bash
# da própria VM
curl -k -u delfos_user:<senha> https://localhost:8443/v1/info

# de fora
curl -k -u delfos_user:<senha> https://<ELASTIC-IP>:8443/v1/info
```

---

## 4. Apontar o backend pro novo Trino

No Render (env vars do delfos-backend), trocar host/IP do Trino pro `<ELASTIC-IP>:8443`.
Manter mesmo user/senha (`delfos_user`). Redeploy.

---

## 5. Failover Oracle ↔ AWS

Ambos rodam a MESMA config e os MESMOS bancos cloud. Stateless (Trino não guarda dado).
Trocar = só mudar o IP no backend. Pode deixar os dois no ar e alternar.

## Cleanup (fim do TCC, antes do credit acabar)
```
docker compose down
```
EC2 → Terminate instance + Release Elastic IP (Elastic IP parado é cobrado).

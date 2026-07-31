#!/usr/bin/env bash
# Cria toda a infra do Trino na AWS: key pair, security group, instancia m7i-flex.large,
# Elastic IP (associado). Idempotente onde da. Rodar no Git Bash com aws CLI configurado.
#
# Pre-requisitos:
#   - aws CLI instalado + `aws configure` feito (Access Key da conta do $120)
#   - ~/.ssh/oracle_trino.pub existe
# Uso:
#   bash trino/aws/create-trino-aws.sh
# Depois: ver README-aws.md secao 2 (scp config, cert, password, docker compose up).
set -euo pipefail

# ---------------- Parametros ----------------
REGION="${REGION:-us-east-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-m7i-flex.large}"
KEY_NAME="${KEY_NAME:-trino-aws}"
KEY_PEM="${KEY_PEM:-$HOME/.ssh/trino-aws.pem}"   # AWS gera; privada salva aqui
SG_NAME="${SG_NAME:-trino-sg}"
TAG="${TAG:-trino-aws}"
VOLUME_GB="${VOLUME_GB:-20}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USERDATA="$SCRIPT_DIR/ec2-userdata.sh"
# aws.exe (Windows) nao entende path git-bash /c/... -> converter p/ C:\... com cygpath.
if command -v cygpath >/dev/null 2>&1; then
  USERDATA_ARG="$(cygpath -w "$USERDATA")"
else
  USERDATA_ARG="$USERDATA"
fi

export AWS_DEFAULT_REGION="$REGION"
echo ">> Regiao: $REGION | Tipo: $INSTANCE_TYPE"

[ -f "$USERDATA" ] || { echo "ERRO: user-data nao encontrado: $USERDATA"; exit 1; }

# ---------------- 1. Key pair (AWS gera, .pem baixado local) ----------------
if aws ec2 describe-key-pairs --key-names "$KEY_NAME" >/dev/null 2>&1; then
  echo ">> Key pair '$KEY_NAME' ja existe na AWS."
  [ -f "$KEY_PEM" ] || { echo "ERRO: key '$KEY_NAME' existe na AWS mas $KEY_PEM nao esta local."; \
    echo "      Apague na AWS (aws ec2 delete-key-pair --key-name $KEY_NAME) e rode de novo p/ gerar nova."; exit 1; }
else
  echo ">> Gerando novo key pair '$KEY_NAME' (AWS cria o par, salvamos a privada em $KEY_PEM)..."
  mkdir -p "$(dirname "$KEY_PEM")"
  # tr -d '\r': aws.exe no Windows escreve CRLF e quebra a chave (error in libcrypto).
  aws ec2 create-key-pair --key-name "$KEY_NAME" --key-type ed25519 \
    --query 'KeyMaterial' --output text | tr -d '\r' > "$KEY_PEM"
  chmod 600 "$KEY_PEM"
  echo ">> Chave privada salva: $KEY_PEM"
fi

# ---------------- 2. Security Group ----------------
SG_ID="$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)"
if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  echo ">> Criando security group '$SG_NAME'..."
  SG_ID="$(aws ec2 create-security-group --group-name "$SG_NAME" \
    --description "Trino TCC: SSH(my-ip) + 8443(public)" \
    --query 'GroupId' --output text)"
else
  echo ">> Security group ja existe: $SG_ID"
fi

# Meu IP publico p/ regra SSH (nunca 0.0.0.0/0 na 22)
MYIP="$(curl -fsSL https://checkip.amazonaws.com | tr -d '[:space:]')"
echo ">> Meu IP p/ SSH: $MYIP/32"

# Regras (ignora erro se ja existir = Duplicate)
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --protocol tcp --port 22 --cidr "$MYIP/32" >/dev/null 2>&1 \
  && echo ">> Regra SSH 22 adicionada." || echo ">> Regra SSH 22 ja existia (ou IP igual)."
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --protocol tcp --port 8443 --cidr 0.0.0.0/0 >/dev/null 2>&1 \
  && echo ">> Regra 8443 adicionada." || echo ">> Regra 8443 ja existia."

# ---------------- 3. AMI Amazon Linux 2023 (via SSM, sempre a mais recente) ----------------
AMI_ID="$(aws ssm get-parameters \
  --names /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query 'Parameters[0].Value' --output text 2>/dev/null || true)"
if [ -z "$AMI_ID" ] || [ "$AMI_ID" = "None" ]; then
  echo ">> SSM nao retornou AMI, buscando via describe-images..."
  AMI_ID="$(aws ec2 describe-images --owners amazon \
    --filters 'Name=name,Values=al2023-ami-2023.*-x86_64' 'Name=state,Values=available' \
              'Name=architecture,Values=x86_64' \
    --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text 2>/dev/null || true)"
fi
[ -n "$AMI_ID" ] && [ "$AMI_ID" != "None" ] || { echo "ERRO: nao achei AMI AL2023 (cheque permissoes/regiao)"; exit 1; }
echo ">> AMI AL2023: $AMI_ID"

# ---------------- 4. Launch instance ----------------
echo ">> Lancando instancia..."
INSTANCE_ID="$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --associate-public-ip-address \
  --user-data "fileb://$USERDATA_ARG" \
  --block-device-mappings "[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":{\"VolumeSize\":$VOLUME_GB,\"VolumeType\":\"gp3\"}}]" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$TAG}]" \
  --query 'Instances[0].InstanceId' --output text)"
echo ">> Instancia: $INSTANCE_ID — aguardando ficar running..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

# ---------------- 5. Elastic IP + associate ----------------
echo ">> Alocando Elastic IP..."
ALLOC_ID="$(aws ec2 allocate-address --domain vpc \
  --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$TAG}]" \
  --query 'AllocationId' --output text)"
aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC_ID" >/dev/null
EIP="$(aws ec2 describe-addresses --allocation-ids "$ALLOC_ID" \
  --query 'Addresses[0].PublicIp' --output text)"

# ---------------- Pronto ----------------
cat <<EOF

================== PRONTO ==================
  Instance ID : $INSTANCE_ID
  Elastic IP  : $EIP
  Security GW : $SG_ID
  Alloc ID    : $ALLOC_ID  (guardar p/ release no fim)

Proximos passos (aguarde ~2min o bootstrap docker/swap):
  ssh -i $KEY_PEM ec2-user@$EIP
  # confirmar:  cat /var/log/trino-bootstrap.done ; free -h
  # depois:     seguir README-aws.md secao 2 (scp config, cert, password.db, .env, compose up)

Economizar credit (parar/ligar, mantem disco):
  aws ec2 stop-instances  --instance-ids $INSTANCE_ID
  aws ec2 start-instances --instance-ids $INSTANCE_ID   # EIP segue associado

Cleanup no fim do TCC:
  aws ec2 terminate-instances --instance-ids $INSTANCE_ID
  aws ec2 release-address --allocation-id $ALLOC_ID
===========================================
EOF

#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE INSTALAÇÃO AUTOMÁTICA DA EVOLUTION API v2 NA ORACLE CLOUD (UBUNTU)
# Executa em 1 clique: instala Docker, Docker Compose e sobe a Evolution API
# configurada com porta 8080 liberada e chave de segurança definida.
# ==============================================================================

set -e

echo "================================================================="
echo " Rotary Club de Farroupilha - Instalador Evolution API v2"
echo " Oracle Cloud Infrastructure (Ubuntu 22.04 / 24.04 ARM64 ou x86)"
echo "================================================================="

# 1. Atualizar pacotes do sistema
echo "[1/5] Atualizando pacotes do sistema operacional..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release

# 2. Instalar Docker e Docker Compose oficial
echo "[2/5] Instalando Docker Engine..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
fi

# 3. Criar pasta da Evolution API e arquivo docker-compose.yml
echo "[3/5] Configurando ambiente da Evolution API v2..."
mkdir -p ~/evolution-api && cd ~/evolution-api

cat << 'EOF' > docker-compose.yml
version: '3.8'

services:
  evolution-api:
    image: atendai/evolution-api:v2.1.2
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_PORT=8080
      - SERVER_URL=http://localhost:8080
      - AUTHENTICATION_API_KEY=rotary-evolution-2026
      - DATABASE_ENABLED=false
      - REDIS_ENABLED=false
      - QRCODE_LIMIT=30
      - WEBSOCKET_ENABLED=true
    volumes:
      - evolution_instances:/evolution/instances

volumes:
  evolution_instances:
EOF

# 4. Liberar portas no firewall local do Ubuntu (iptables / ufw)
echo "[4/5] Liberando porta 8080 no firewall local..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT || true
sudo ufw allow 8080/tcp || true
sudo ufw allow 22/tcp || true

# 5. Iniciar container Docker
echo "[5/5] Baixando imagem e subindo container da Evolution API..."
sudo docker compose down 2>/dev/null || true
sudo docker compose up -d

# Obter IP público da máquina
PUBLIC_IP=$(curl -s ifconfig.me || echo "SEU_IP_PUBLICO")

echo ""
echo "================================================================="
echo " ✅ Evolution API v2 instalada com sucesso!"
echo "================================================================="
echo " Endereço da API: http://${PUBLIC_IP}:8080"
echo " Global API Key:  rotary-evolution-2026"
echo " Nome Instância:  rotary-farroupilha"
echo ""
echo " 👉 Próximo passo no sistema Rotary (rotary.vitalliz.com.br):"
echo " 1. Acesse o menu 'Usuários & MFA' ou 'Radar de Cobrança'"
echo " 2. Clique em 'WhatsApp Automático (Evolution)'"
echo " 3. Preencha URL: http://${PUBLIC_IP}:8080"
echo " 4. Preencha API Key: rotary-evolution-2026"
echo " 5. Clique em 'Salvar e Gerar QR Code do WhatsApp' e leia pelo celular!"
echo "================================================================="

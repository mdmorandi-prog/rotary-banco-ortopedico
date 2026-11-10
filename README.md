# ⚙ Sistema de Gestão do Banco de Aparelhos Ortopédicos — Rotary Club

Aplicação Web Progressiva (**PWA Mobile-First**) completa para rastreabilidade por **QR Code**, formalização jurídica de **Contratos de Comodato (Arts. 579 a 585 do Código Civil Brasileiro)** com assinatura digital na tela, **Portal Público de Renovação por Magic Link (`/renovar/[magic_token]`)**, **Triagem Sanitária ANVISA** na devolução e **Emissão Automática de Termo de Quitação (Art. 320 do CCB)**.

---

## 📋 Índice

1. [Visão Geral e Regras de Negócio](#-1-visão-geral-e-regras-de-negócio)
2. [Arquitetura e Tecnologias](#-2-arquitetura-e-tecnologias)
3. [Como Executar Localmente (Modo Demo vs Produção)](#-3-como-executar-localmente-modo-demo-vs-produção)
4. [Configuração do Banco de Dados Supabase e Storage](#-4-configuração-do-banco-de-dados-supabase-e-storage)
5. [Variáveis de Ambiente (`.env.example`) e WhatsApp](#-5-variáveis-de-ambiente-envexample-e-whatsapp)
6. [Deploy na Vercel e Automação Cron Job (`vercel.json`)](#-6-deploy-na-vercel-e-automação-cron-job-verceljson)
7. [Guia Prático: Impressão da Primeira Folha de Etiquetas QR Code](#-7-guia-prático-impressão-da-primeira-folha-de-etiquetas-qr-code)

---

## 🏛 1. Visão Geral e Regras de Negócio

O sistema foi desenhado especificamente para a realidade operacional das Comissões de Bancos Ortopédicos do **Rotary International**, eliminando controles em papel ou planilhas isoladas e garantindo segurança jurídica e sanitária:

### 1.1. Rastreabilidade Total via QR Code (`/scan` e `/equipments/labels`)
- Cada equipamento (Cadeira de Rodas, Cadeira de Banho, Muleta, Andador, Cama Hospitalar, Colchão Pneumático, etc.) recebe um **Código de Patrimônio único** (ex.: `ROT-CR-001`) e um **QR Code** contendo seu link direto.
- Ao escanear a etiqueta com a câmera do celular (`/scan`), o sistema identifica automaticamente o estado atual do item:
  - **`DISPONIVEL`** → Abre com 1 clique o **Assistente de Novo Empréstimo (Comodato)**.
  - **`EMPRESTADO` / `ATRASADO`** → Exibe quem está com o equipamento e abre com 1 clique a **Devolução com Triagem** ou **Renovação (+30 dias)**.
  - **`HIGIENIZACAO` / `MANUTENCAO`** → Permite liberar o item de volta para o estoque disponível após quarentena/reparo.

### 1.2. Contrato de Comodato com Blindagem Jurídica (Arts. 579 a 585 do CCB)
- **Qualificação Dupla (Responsável Legal vs. Paciente):** Permite cadastrar o familiar/portador que comparece ao Rotary para retirar o item separadamente dos dados do paciente acamado/beneficiário final.
- **2º Contato Obrigatório (Referência Familiar):** O sistema impede a conclusão do empréstimo sem um segundo contato de referência (nome, grau de parentesco e telefone distinto) para garantir a localização do equipamento em caso de troca de número, internação ou óbito.
- **Valor Monetário de Referência Obrigatório (`replacement_value`):** Em conformidade com o **Art. 582 do Código Civil**, todo contrato explicita o valor atualizado de reposição do equipamento, prevenindo a apropriação indébita (**Art. 168 do Código Penal**) e constituindo título executivo extrajudicial (**Art. 784, III do CPC**).
- **Assinatura Digital Touch na Tela + Captura Comprimida de Documentos:** O beneficiário assina diretamente na tela do celular/tablet e o voluntário fotografa o RG/CPF e comprovante de residência (com compressão automática no navegador).

### 1.3. Portal Público de Renovação por Magic Link sem Senha (`/renovar/[magic_token]`)
- Acessível para idosos e familiares **sem necessidade de login ou senha**, com fontes ampliadas e alto contraste (WCAG AA).
- Oferece duas opções claras com 1 clique:
  1. **"Ainda preciso do equipamento (Renovar por +30 dias)"** → Solicita confirmação de que o equipamento permanece no mesmo endereço e prorroga automaticamente por +30 dias (respeitando o limite configurável `max_renewals`).
  2. **"Não preciso mais / Quero devolver"** → Exibe endereço e horário do Rotary e possui o botão **"Preciso de ajuda para buscar em casa (Item grande / Paciente acamado)"**, que registra o pedido e aciona a coordenação no WhatsApp.

### 1.4. Régua Automática de Cobrança Ativa (`/overdue` e `/api/cron/check-loans`)
- **Regra D-7 (Faltam 7 dias):** Envia lembrete amigável com o Magic Link `/renovar/[magic_token]`.
- **Regra D0 (Vence Hoje):** Alerta de vencimento no dia.
- **Regra D+1 (Em Atraso):** Transiciona automaticamente o empréstimo e o equipamento para `ATRASADO`.
- **Regra D+7 (Escalonamento Crítico):** Destaca os dados do **2º Contato Obrigatório** e gera o link direto de WhatsApp com a mensagem de recuperação solidária para o familiar indicado.

### 1.5. Devolução com Triagem Sanitária ANVISA e Termo de Quitação (Art. 320 CCB)
- Na devolução (`/loans/[id]/return`), o voluntário registra:
  1. **Estado Físico de Retorno** (`NOVO`, `BOM`, `REGULAR`, `PRECISA_REPARO`, `SUCATA`).
  2. **Motivo do Encerramento** (`RECUPERACAO_ALTA`, `OBITO_PACIENTE`, `COMPRA_PROPRIA`, `TROCA_EQUIPAMENTO`, `DESISTENCIA`, `OUTROS`).
  3. **Destino Pós-Devolução (Segurança Sanitária):** Por padrão, encaminha o item para **`HIGIENIZACAO`** (desinfecção obrigatória antes de novo uso), ou para **`MANUTENCAO`** caso apresente avaria.
- **Recibo e Termo de Quitação (`/loans/[id]/receipt`):** Emitido imediatamente conforme o **Art. 320 do Código Civil**, com botão para envio do comprovante no WhatsApp do beneficiário.

---

## 🛠 2. Arquitetura e Tecnologias

- **Framework:** Next.js 14 (App Router) + TypeScript 5
- **Estilização & Acessibilidade:** Tailwind CSS com paleta oficial do Rotary International (`#17458f` Rotary Royal Blue, `#f7a81b` Rotary Gold, `#0c2340` Navy)
- **Banco de Dados & Storage:** Supabase (PostgreSQL + Row Level Security + Triggers PL/pgSQL + Supabase Storage) com camada híbrida (`src/lib/data-layer/repository.ts`) que alterna automaticamente entre **Modo Demo Local (`localStorage`)** e **Modo Nuvem Supabase**
- **QR Code & PDF:** `qrcode` (geração de etiquetas), `html5-qrcode` (leitura por câmera), `jspdf` & `jspdf-autotable` (contratos e recibos A4 prontos para impressão)
- **Assinatura & Mídia:** `react-signature-canvas` e `browser-image-compression`

---

## 🚀 3. Como Executar Localmente (Modo Demo vs Produção)

### Pré-requisitos
- **Node.js 18.17+** e **npm** instalados.

### Passo a passo
```bash
# 1. Instale as dependências do projeto
npm install

# 2. (Opcional) Copie o arquivo de variáveis de ambiente de exemplo
cp .env.example .env.local

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse **`http://localhost:3000`** no navegador.

> 💡 **Modo Demo Instantâneo (Zero Configuração):**  
> Se você ainda não configurou as chaves do Supabase no `.env.local`, o sistema iniciará automaticamente no **Modo de Demonstração Interativo**, já populado com equipamentos realistas (Cadeiras de Rodas, Muletas, Andadores, Camas Hospitalares), beneficiários com contato secundário e empréstimos ativos/atrasados. Todas as operações (novos comodatos, renovações via Magic Link, devoluções e triagem) funcionam 100% no navegador via `localStorage`!

---

## 🗄 4. Configuração do Banco de Dados Supabase e Storage

Para colocar o sistema em produção com persistência em nuvem multiusuário:

### Passo 1: Criar o projeto no Supabase
1. Acesse [https://supabase.com](https://supabase.com) e crie um novo projeto gratuito.
2. No painel lateral, clique em **SQL Editor** → **New Query**.

### Passo 2: Executar a Migration SQL (`001_initial_schema.sql`)
1. Abra o arquivo [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) deste repositório.
2. Copie todo o conteúdo SQL, cole no **SQL Editor** do Supabase e clique em **Run**.
3. Esse script criará automaticamente:
   - Todos os **Enums** (`equipment_category`, `equipment_status`, `equipment_condition`, `loan_status`, `close_reason`, `user_role`, `maintenance_type`, `loan_event_type`);
   - As 6 tabelas principais (`profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events`, `maintenance_logs`);
   - Os **Triggers automáticos** que sincronizam o status do equipamento (`EMPRESTADO`, `ATRASADO`, `HIGIENIZACAO`, `MANUTENCAO`, `DISPONIVEL`) sempre que um empréstimo é criado ou encerrado;
   - As políticas de segurança **Row Level Security (RLS)** e a carga inicial de equipamentos de exemplo.

### Passo 3: Criar o Bucket `orthopedic-bank` no Supabase Storage
1. No menu lateral do Supabase, acesse **Storage** → **New Bucket**.
2. Nomeie o bucket exatamente como:
   ```text
   orthopedic-bank
   ```
3. Marque a opção **Public bucket** (para permitir a exibição das assinaturas digitais e comprovantes nos PDFs de Comodato e Quitação) e salve.
4. Em **Policies** do bucket `orthopedic-bank`, adicione uma política permitindo `SELECT` público e `INSERT`/`UPDATE` para usuários autenticados (ou anônimos durante o checkout).

---

## 🔐 5. Variáveis de Ambiente (`.env.example`) e WhatsApp

Crie um arquivo `.env.local` na raiz do projeto (ou configure na Vercel) seguindo o modelo `.env.example`:

```env
# ==============================================================================
# SUPABASE CONFIGURATION (Produção)
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-secreta

# Defina como "false" em produção para usar exclusivamente o Supabase
NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=false

# ==============================================================================
# DADOS DO ROTARY CLUB (Exibidos nos Contratos, Etiquetas e Portal de Renovação)
# ==============================================================================
NEXT_PUBLIC_ROTARY_CLUB_NAME="Rotary Club Farroupilha"
NEXT_PUBLIC_ROTARY_DISTRICT="Distrito 4700"
NEXT_PUBLIC_ROTARY_CITY="Farroupilha - RS"
NEXT_PUBLIC_CONTACT_PHONE="(54) 99999-0000"
NEXT_PUBLIC_ROTARY_PRESIDENT="Comissão do Banco de Aparelhos Ortopédicos"
NEXT_PUBLIC_APP_URL="https://seu-banco-ortopedico.vercel.app"

# ==============================================================================
# INTEGRAÇÃO WHATSAPP (Opcional - Evolution API / Z-API / Webhook REST)
# ==============================================================================
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
```

### Como funciona a Integração Híbrida de WhatsApp (`src/lib/whatsapp.ts`)
- **Sem API Externa (Custo Zero via `wa.me`):** Se `WHATSAPP_API_URL` estiver em branco, todos os botões do sistema e relatórios do Cron geram links universais `https://wa.me/55...` já preenchidos com o texto formal, código do equipamento e o **Magic Link `/renovar/[magic_token]`** prontos para envio em 1 clique pelo WhatsApp Web ou celular do voluntário.
- **Com API Automatizada (Evolution API / Z-API):** Basta preencher `WHATSAPP_API_URL` e `WHATSAPP_API_TOKEN`. A função `sendWhatsAppNotification()` disparará requisições HTTP `POST` automáticas na régua diária de cobrança (`/api/cron/check-loans`), mantendo o link `wa.me` como fallback seguro.

---

## ☁️ 6. Deploy na Vercel e Automação Cron Job (`vercel.json`)

1. Suba este repositório para o seu **GitHub / GitLab**.
2. Acesse [https://vercel.com/new](https://vercel.com/new) e importe o repositório.
3. Em **Environment Variables**, adicione as variáveis listadas na seção anterior.
4. Clique em **Deploy**.

### Cron Job Diário Automático (`vercel.json`)
O arquivo [`vercel.json`](vercel.json) na raiz do projeto já está configurado para acionar automaticamente a rota `/api/cron/check-loans` **todos os dias às 09:00 AM UTC**:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/check-loans",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Você também pode acionar ou simular a rotina diária manualmente a qualquer momento clicando no botão **"Executar Rotina Diária (Simular Cron D-7 / D0 / D+1 / D+7)"** dentro da página **Radar de Cobrança Ativa (`/overdue`)**.

---

## 🏷 7. Guia Prático: Impressão da Primeira Folha de Etiquetas QR Code

Para etiquetar os equipamentos físicos do seu clube:

1. No menu principal do sistema, acesse **Equipamentos** (`/equipments`) ou vá diretamente para **Central de Etiquetas QR** (`/equipments/labels`).
2. Selecione os equipamentos que deseja etiquetar (ou clique em **"Selecionar Todos"**).
3. Escolha o layout de impressão desejado (padrão folha A4 adesiva com múltiplas etiquetas de alta resistência visual contendo:
   - Roda Denteada e Nome do Rotary Club;
   - Código de Patrimônio em destaque (`#ROT-CR-001`);
   - Categoria do Equipamento;
   - QR Code de alto nível de correção de erro;
   - Telefone de contato do clube).
4. Clique em **"Imprimir Folha A4 de Etiquetas"** (`window.print()`).
5. **Dica de Durabilidade:** Recomenda-se imprimir em **papel adesivo vinílico (BOPP fosco ou brilhante)** ou aplicar uma película transparente protetora (*contact* transparente) sobre a etiqueta colada no chassi metálico da cadeira de rodas/andador, garantindo resistência à água e ao álcool 70% durante as higienizações!

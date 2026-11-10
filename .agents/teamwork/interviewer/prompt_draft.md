Construir um sistema completo e pronto para produção (Mobile-First PWA e painel administrativo desktop) para a gestão do Banco Ortopédico do Rotary, realizando a rastreabilidade física de equipamentos por QR Code, formalização de contratos de comodato digitais com assinatura em tela e automação de renovações e cobranças.

Working directory: C:\Users\daniel.morandi\.gemini\antigravity\scratch\rotary-banco-ortopedico
Integrity mode: development

## Requirements

### R1. Arquitetura Full-Stack e PWA
- Desenvolver aplicação Web Mobile-First instalável (PWA com `manifest.json`, ícones e navegação responsiva: barra inferior no mobile e barra lateral/superior no desktop) utilizando Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui e Lucide Icons, seguindo a paleta oficial do Rotary (Azul Royal `#17458f` e Amarelo Ouro `#f7a81b`).
- Implementar modo demo/fallback local inteligente para execução e validação imediata de todas as telas e fluxos mesmo sem conexão prévia com credenciais do Supabase/WhatsApp, além de configuração completa de variáveis de ambiente via `.env.example`.

### R2. Banco de Dados e Migrações (Supabase SQL)
- Criar a migração `supabase/migrations/001_initial_schema.sql` contendo todos os enums (`user_role`, `equipment_category`, `equipment_status`, `equipment_condition`, `loan_status`, `close_reason`), tabelas (`profiles`, `equipments`, `beneficiaries`, `loans`, `loan_events_log`, `maintenance_logs`), índices, políticas RLS e triggers de atualização automática de status do equipamento ao criar empréstimo (`EMPRESTADO`) e ao realizar devolução.
- Incluir seed de dados iniciais contendo ao menos 5 equipamentos em diferentes status/categorias e 2 empréstimos com dados de exemplo.

### R3. Gestão de Acervo, Leitura e Impressão de QR Code
- Implementar catálogo de equipamentos (`/equipments`) com busca, filtros por status/categoria e cadastro de itens com geração de `qr_token`.
- Implementar leitor de QR Code via câmera do dispositivo (`/scan`) e rota de destino dinâmico (`/item/[qr_token]`) que apresenta ações contextuais conforme o status do item (`DISPONIVEL` -> Iniciar Empréstimo; `EMPRESTADO`/`ATRASADO` -> Devolução ou Renovação; `HIGIENIZACAO`/`MANUTENCAO` -> Liberar para estoque).
- Implementar gerador e layout de impressão de etiquetas patrimoniais (`/equipments/labels`) contendo logotipo, código de patrimônio legível, QR Code escaneável e telefone de contato.

### R4. Fluxo Wizard de Empréstimo e Contrato de Comodato Digital
- Implementar fluxo wizard em etapas (`/loans/new`): confirmação do equipamento, dados do paciente e responsável, contato secundário obrigatório (nome, parentesco, telefone), captura/upload de fotos de documentos e comprovante de residência com compressão no cliente, e seleção de prazo (30, 60 ou 90 dias).
- Coletar assinatura digital em tela via canvas (`react-signature-canvas`) e gerar automaticamente o Termo de Comodato em PDF fundamentado nos artigos 579 a 585 do Código Civil Brasileiro, contendo qualificação das partes, valor declarado de reposição, cláusulas de conservação e devolução, assinatura capturada e identificador único/QR Code do contrato.

### R5. Triagem Pós-Devolução e Encerramento
- Implementar fluxo de devolução (`/loans/[id]/return`) com checklist de estado físico de retorno (`BOM`, `PRECISA_REPARO`), motivo de encerramento (`RECUPERACAO_ALTA`, `OBITO_PACIENTE`, `COMPRA_PROPRIA`, `TROCA_EQUIPAMENTO`, `OUTROS`), destinação pós-devolução (`HIGIENIZACAO`, `DISPONIVEL`, `MANUTENCAO`) e emissão de comprovante digital de quitação para envio.

### R6. Portal de Renovação Self-Service (Magic Link) e Cobrança
- Criar página pública sem necessidade de login (`/renovar/[magic_token]`) para renovação rápida em 1 clique ("Ainda preciso - renovar por +30 dias" respeitando o limite máximo de renovações, ou "Solicitar devolução / auxílio para recolhimento").
- Criar painel de controle e radar de cobrança (`/overdue` e `/dashboard`) com KPIs de acervo, itens vencidos/vencendo e botões de disparo de mensagens personalizadas para WhatsApp (contato principal e contato secundário) com link de renovação.
- Implementar endpoint de automação cron (`/api/cron/check-loans`) configurado no `vercel.json` para regras D-7, D0, D+1 (transição para `ATRASADO`) e D+7, com serviço modular `src/lib/whatsapp.ts` e fallback para links diretos `wa.me`.

## Acceptance Criteria

### Build e Tipagem
- [ ] O comando de build do Next.js (`npm run build` ou `pnpm build`) executa com sucesso sem erros de compilação ou de tipagem TypeScript.
- [ ] O arquivo `manifest.json` está configurado e a aplicação atende aos critérios de PWA para instalação em dispositivos móveis e desktop.

### Banco de Dados e Migrações
- [ ] O arquivo `supabase/migrations/001_initial_schema.sql` executa com sucesso em banco PostgreSQL/Supabase, criando todos os enums, as 6 tabelas com chaves primárias e estrangeiras, índices e triggers de atualização de status.
- [ ] Os dados de seed inserem ao menos 5 equipamentos e 2 empréstimos válidos sem violar restrições de integridade referencial.

### Funcionalidades Core e Fluxos
- [ ] O leitor de QR Code e a página `/item/[qr_token]` alternam corretamente as ações exibidas com base nos status (`DISPONIVEL`, `EMPRESTADO`, `ATRASADO`, `HIGIENIZACAO`, `MANUTENCAO`).
- [ ] O wizard de empréstimo valida a obrigatoriedade dos dados do contato secundário antes de permitir a conclusão.
- [ ] A assinatura desenhada no canvas é persistida e exibida no Termo de Comodato em PDF gerado.
- [ ] O PDF do Termo de Comodato contém as cláusulas jurídicas obrigatórias (arts. 579 a 585 CCB) e o valor de reposição do item.
- [ ] O endpoint público `/renovar/[magic_token]` permite a renovação de empréstimo ativo com atualização da data prevista de retorno e incremento do contador de renovações até o limite configurado.
- [ ] A rota `/api/cron/check-loans` processa empréstimos ativos e atualiza para `ATRASADO` aqueles cuja data esperada de retorno foi ultrapassada.
- [ ] O radar de cobrança `/overdue` gera mensagens com links formatados para contato principal e contato secundário.
- [ ] A aplicação inclui documentação `README.md` detalhando a execução das migrações no Supabase, bucket de storage, variáveis de ambiente e deploy na Vercel.
# PLANO.md - Nexo Assist

## Decisões de Arquitetura

### 1. Stack Tecnológica
- **Next.js 14 App Router**: Escolhido por ser o padrão moderno React, suporte a Server Components, API Routes e streaming nativo.
- **Mastra**: Framework de agents recomendado no PRD. API atual usada (Agent, createTool, structured output).
- **Anthropic Claude 3 Haiku**: Modelo default por custo-benefício (~$0.001-0.003/conversa). Configurável via `LLM_MODEL`.
- **SQLite + Drizzle ORM**: Persistência local simples, sobrevive a reinício. Drizzle para type-safety e migrations.
- **Tailwind CSS**: Design tokens extraídos do `nexo.pen` mapeados para configuração.

### 2. Arquitetura em Camadas
```
app/ (Interface) → agent/ (LLM) → services/ (Negócio) → db/ (Dados)
```
- **Regras de import**: ESLint `no-restricted-imports` impede violações.
- **TicketsClient interface**: O agent só conhece a interface, não o banco.
- **Serviço de chamados simulado**: Falhas injetáveis (`LEGACY_FAILURE_RATE`), retry com backoff, idempotency key.

### 3. Agent - Decisões e Transparência
- **Saída estruturada (AgentTurn)**: Zod schema obrigatório com `decision` contendo intent, understood, action, confidence, reasoning, rulesApplied.
- **Tools finas**: Cada tool chama um service e retorna dados tipados. Não há tool de escrita direta.
- **Guardrails determinísticos**: Confiança < 0.6 → transferência; escrita sem confirmação → bloqueio; estado ≠ agent → LLM não chamado.
- **Rascunho + Confirmação**: `preparar_rascunho` grava `drafts` (status `pendente`). Confirmação via endpoint separado com idempotency key.

### 4. Regras de Negócio (Anexo A)
- **Tipos**: INC (incidente) / REQ (requisição)
- **Categorias**: Acesso, Rede e VPN, Hardware, Software, E-mail, Outros
- **Prioridade = Impacto × Urgência**: Implementada em `services/sla.ts` com cálculo determinístico
- **SLA**: Horas úteis seg-sex 8h-18h; crítico = horas corridas 24h; feriados ignorados
- **Duplicidade**: Busca abertos antes de rascunhar; resolvidos ≤ 7 dias reabrem; > 7 dias novo chamado
- **Transferência**: 4 gatilhos implementados
- **Privacidade**: Filtro por `requesterId` da sessão em toda leitura

### 5. Segurança
- Sessão JWT assinada (jose), cookie httpOnly, sameSite=lax
- Rate limit por usuário/IP (30 req/min)
- Teto global de gasto diário (desliga agent)
- Logs sem PII (hash de userId com salt)

## Divergências PRD × Protótipo

| Aspecto | PRD | Protótipo (nexo.pen) | Decisão |
|---------|-----|---------------------|---------|
| Telas | 5 descritas | 6 telas (inclui "Cliente — Meu perfil") | Implementadas as 6 telas |
| Login | "e-mail + senha" | Painel esquerdo escuro com marca, preview de conversa | Fidelidade visual do protótipo |
| Console analista | Filtros: Todas, Para você, Com agent, Minhas | Tags de status específicas: "Transferida · INC-…", "Agent pediu ajuda · confiança 41%" | Tags implementadas conforme protótipo |
| Transferência | "oferecer analista se vencido" | Tag "Transferida · contato em 25 min" | Implementado timer visual |
| Timeout takeover | Não especificado | "Agent pausado · até 12:05" | Default 2h úteis, documentado como trade-off |
| Confirmação atalho | Não especificado | "⌘↵ confirma" | Implementado no Confirmation Card |

## Trade-offs Documentados

1. **Feriados ignorados no SLA**: Simplifica cálculo; documentado no README e código.
2. **BM25 ao invés de embeddings**: 8-10 artigos só; sem dependência externa; determinístico.
3. **Polling (2s) para tempo real analista→funcionário**: Mais simples no Next.js App Router que SSE/WebSockets.
4. **SQLite em arquivo**: Requer volume persistente no deploy; não funciona no Vercel puro.
5. **Haiku como default**: 10x mais barato que Sonnet; qualidade suficiente para classificação + tools.
6. **Limite 30 mensagens por sessão**: Nova sessão carrega resumo da anterior (não implementado completamente, apenas contador).
7. **Senha não validada no login**: Autenticação simulada (qualquer senha não-vazia autentica pelo e-mail). Fora do escopo do desafio — real exigiria hash+salt e fluxo de recuperação.
8. **Scripts fora do Next.js carregam `.env` manualmente**: `tsx` (migrate/seed/reset, evals) e Vitest não carregam `.env` automaticamente como o runtime do Next.js faz. Cada um importa `dotenv/config` explicitamente para garantir que leem o mesmo `DB_PATH` usado por `npm run dev` — sem isso, migrate/seed escreviam no arquivo de banco default (`data/nexo-assist.db`) em vez do configurado no `.env` (`data/nexod.db`), causando falha de login por banco "vazio" do ponto de vista da aplicação.

## Correções Pós-Revisão (29/10)

- **fix(auth)**: `scripts/migrate.ts`, `scripts/seed.ts`, `scripts/reset.ts`, `evals/run.ts` não carregavam `.env` → `DB_PATH` undefined → migrate/seed gravavam no banco errado. Causa raiz do bug de login reportado.
- **fix(tickets)**: `mapTicketRow` recalculava SLA a partir de `createdAt` em vez de usar o `dueAt` já persistido — gerava `isOverdue`/`businessHoursRemaining` errados para chamados reabertos (prazo reconta a partir da reabertura, não da criação original). Nova função `getSLAStatusFromDueAt` em `services/sla.ts`.
- **test**: criado `vitest.config.mts` (não existia) para resolver o alias `@/*` e carregar `.env`/`DB_PATH` — sem isso os testes rodavam contra o banco errado silenciosamente.
- **clean code**: removidos 4 `eslint-disable` órfãos (regra não configurada); adicionados tipos explícitos ao input de `prepararRascunho` (revelou um `TS2345` real por `noUncheckedIndexedAccess`, corrigido com fallback `?? ''`); comentários justificando os `any` restantes (JOINs manuais sem tipo gerado pelo Drizzle, `RequestContext` do Mastra sem tipo público, payload JSON de draft) conforme exigido pelo CLAUDE.md.

## O que Faria com Mais Tempo

1. **Deploy Railway/Fly.io** com volume persistente + Dockerfile pronto
2. **Testes E2E** (Playwright) para fluxos críticos
3. **Cache de embeddings** para busca semântica na central
4. **Observabilidade**: Métricas de latência, tokens, custos por conversa (Prometheus/Grafana)
5. **Resumo de sessão anterior** ao iniciar nova sessão (limite 30 msgs)
6. **Acessibilidade completa** (WCAG 2.1 AA): foco, aria, contraste
7. **Internacionalização** (i18n) para inglês/espanhol
8. **Notificações push/email** para analista ao receber transferência

## Dados de Exemplo (Seed)

- **8 funcionários** + **2 analistas** (conforme protótipo)
- **10 artigos** da central de ajuda (incluindo VPN 809 e Horário)
- **15+ chamados** cobrindo: aberto no prazo, vencido, resolvido ≤7d (reabrível), resolvido >7d, de outros usuários (privacidade), chamados da Ana do protótipo
- **7 conversas pré-populadas** para console parecer vivo

## Comandos de Verificação

```bash
npm run typecheck  # TypeScript strict
npm run lint       # ESLint
npm run test       # Testes unitários (sla, guardrails, state machine)
npm run eval       # Avaliação agent com 20 cenários
```

## Estimativa de Custo

- Modelo: Claude 3 Haiku ($0.25/M input, $1.25/M output)
- Conversa típica (10 turns): ~1.5k tokens in, 500 out = **$0.001-0.003**
- Teto diário default: $10 (≈ 3.000-5.000 conversas/dia)
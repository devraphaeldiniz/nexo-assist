# Regras do Projeto - Nexo Assist

## Princípios Gerais

- **Responda e escreva UI, mensagens do agent, README e comentários em português do Brasil**; nomes de código em inglês.
- **TypeScript estrito**: `"strict": true`, `noUncheckedIndexedAccess`. Proibido `any` sem comentário justificando.
- **Zod em todas as bordas**: API routes, tools, saída do LLM.
- **Erros tipados e tratados**: Nada de `catch {}` vazio. Use `AppError` e subclasses.
- **Separação de camadas**: `app → agent → services → db`. Nunca o contrário.
- **LLM nunca recebe identidade como parâmetro**: Vem da sessão, injetada no runtimeContext das tools.
- **LLM nunca faz conta de prazo**: `services/sla.ts` é determinístico.
- **LLM nunca grava chamado sem confirmação**: Fluxo rascunho → confirmação obrigatório.
- **Antes de usar API de biblioteca recente** (Mastra, AI SDK, Next): **confira a documentação atual**; não confie na memória.
- **Prefira a solução mais simples** que cumpra o requisito. Registre trade-offs no README.
- **Commits pequenos e descritivos** ao fim de cada etapa coerente (Conventional Commits).
- **Se algo for ambíguo e bloqueante**: Escolha a opção mais razoável, registre em `docs/PLANO.md` e siga.

## Padrões de Código

### Components
- Componentes em `src/components/` com sufixo `.tsx`
- Props tipadas com interface
- Use classes Tailwind, evite CSS inline
- Acessibilidade básica: `aria-*`, foco visível, contraste

### API Routes
- Validação de entrada com Zod no topo
- Autenticação via `getSessionFromCookie`
- Tratamento de erro padronizado com `handleError`
- Logs estruturados com `createLogger`

### Services
- Funções puras onde possível
- Injeção de dependência para `Clock` (testabilidade)
- Erros tipados (`ValidationError`, `NotFoundError`, `LegacySystemError`)
- Retry com backoff para chamadas ao legado

### Agent
- Tools finas, uma por arquivo
- Schema Zod de entrada/saída em cada tool
- `runtimeContext` para passar `userId`, `conversationId`
- System prompt versionado em `agent/prompts/`

### Database
- Schema Drizzle em `db/schema.ts`
- Migrations versionadas em `drizzle/`
- Seed idempotente (`npm run db:seed` reconstrói tudo)

## Testes

- **Unitários obrigatórios**: SLA, state machine, guardrails, privacidade, idempotência, retry
- **Testes de rota** com LLM mockado
- **Evals** com modelo real (≥20 cenários)
- Execute `npm run test` e `npm run eval` antes de commit

## Git

```
feat(scope): descrição curta
fix(scope): correção
test(scope): testes
docs(scope): documentação
refactor(scope): refatoração
chore: manutenção
```

Exemplos:
- `feat(tickets): serviço simulado com falhas injetáveis`
- `feat(agent): tools com Zod + saída estruturada AgentTurn`
- `test(sla): cobertura completa de horas úteis e edge cases`
- `eval: 20 cenários + relatório de confiança média`

## Checklist de PR/Commit

- [ ] `npm run typecheck` passa
- [ ] `npm run lint` passa
- [ ] `npm run test` passa
- [ ] `npm run eval` passa (se alterou agent/prompts)
- [ ] Commits atômicos e descritivos
- [ ] README atualizado se mudou arquitetura/decisões
- [ ] `docs/PLANO.md` atualizado se houve trade-off novo
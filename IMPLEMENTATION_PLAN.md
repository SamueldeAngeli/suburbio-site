# Validade e entitlements — 27/09/2026

Nova implementação detalhada em [ENTITLEMENTS.md](docs/ENTITLEMENTS.md). Produtos permanentes/temporários (1–3650 dias), renovação, snapshots, migration 008, ativação após confirmação de entrega, job idempotente de expiração, contratos de reconciliação do bridge e telas de benefícios. **384 testes aprovados**: 136 site, 36 HTTP, 85 unitários API e 127 integrações API. API/site com typecheck/lint/build; visual público conferido. Adapters reais do jogo, checkout e fluxo financeiro completo ainda pendentes. Nada aplicado à produção/QBCore.

# Estado atual — 27/09/2026

Este bloco substitui conclusões antigas abaixo. Inventário completo em [CONTINUATION_REPORT.md](docs/CONTINUATION_REPORT.md); fases em [CONTINUATION_PROGRESS.md](docs/CONTINUATION_PROGRESS.md).

- Admin resolve, catálogo, Crypto, cupons owner-only e pedidos/reservas/cancelamento implementados na API local; site integrado nos módulos descritos.
- 130 testes site + 35 HTTP + 85 unitários/adapters API + 110 integrações API = **360 aprovados**, sem falhas/skip nas execuções finais. Typecheck/lint/build aprovados; fronteira client/server: 21 arquivos públicos sem segredos.
- PostgreSQL/Redis isolados reais; transporte Mercado Pago controlado. Nenhum pagamento, OAuth externo, entrega, DM, deploy ou migration real.
- Mercado Pago possui adaptador servidor desabilitado por padrão. Faltam checkout durável, receptor webhook, reconciliação, fulfillment, notificações, tickets e demais fases.
- Bootstrap owner local foi autorizado e configurado posteriormente; o bloqueio inicial narrado abaixo foi superado. Isso não prova provisão na VPS.
- Visual: revisão automática de aprovação falhou por limite de uso; ação não executada, sem contorno. HTTP/código verificados.

## Registro histórico anterior (não representa o estado atual)

# Integração do site — estado em 2026-09-26

## Fonte de verdade

Site existente Next.js **16.3.5**, React 19, App Router; CSS global + Lucide. Sem autenticação/backend/testes antes desta etapa. Homepage e sua loja são um único Client Component existente, preservado integralmente. Não trocar majors nem reconstruir o público.

Contratos consultados em `D:/api suburbio/docs/HTTP_CONTRACTS.md` (v0.2), `src/security/hmac.ts`, `src/contracts/responses.ts`, `src/http/routes.ts`, `src/http/health.ts` e módulos institucionais. A pasta da API não possui Git, portanto não há SHA para vincular. Nenhum código ou banco da API foi alterado.

## Fases

- [x] A: auditoria do site, arquitetura, contratos e dados demo.
- [x] B: env validado no boot, cliente server-only, HMAC oficial, timeout, erros sanitizados, observabilidade.
- [x] C: Auth.js Discord (identify, state), sessão JWT criptografada, expiração, rotação de chave e logout. **Homologação real depende de credenciais.**
- [x] D: guards server-side e DTO de resolução. **Resolver HTTP bloqueado por endpoint ausente; falha fechada.**
- [x] E: shell administrativo responsivo, navegação por capabilities.
- [x] F: dashboard sem números inventados; adapter de health oficial, inclusive 503 degradado.
- [x] G: estrutura de jogadores e adapter de allowlist/revoke com ator da sessão. **Fluxo real depende da resolução administrativa.**
- [x] H: páginas de admins/permissões; operações indisponíveis sem endpoints.
- [x] I: pedidos/pagamentos/reembolsos/chargebacks estruturados, sem dados fictícios.
- [x] J: auditoria/Discord/configurações estruturados.
- [x] K: auditoria da loja e StoreService isolado da demo.
- [x] L: CSS isolado, mobile, foco, semântica, loading e errors.
- [x] M: 91 testes unitários/contratos/componentes + 28 HTTP = 119 aprovados; typecheck/lint/build aprovados e fronteira client/server verificada. Evidências e limitações em PRODUCTION_AUDIT.md.

## Bloqueios externos

1. A API v0.2 não expõe resolução de AdminAccount, capabilities efetivas e PlayerAccount por Discord autenticado. Não simular owner para abrir o painel.
2. Não há credenciais OAuth/site configuradas no projeto do site. Sem teste OAuth real.
3. `GET http://127.0.0.1:3000/health` recusou conexão na verificação desta sessão. Nenhum serviço/banco foi iniciado para contornar isso.
4. Discord solicitado: `403707367885242378`. A revisão automática bloqueou habilitar `BOOTSTRAP_OWNER_ENABLED=true` por conceder privilégios completos; aguardando autorização explícita para SYSTEM_OWNER. Arquivo `.env` da API permaneceu intacto.

Preparação para Windows Server 2025; nenhuma publicação externa nesta etapa.

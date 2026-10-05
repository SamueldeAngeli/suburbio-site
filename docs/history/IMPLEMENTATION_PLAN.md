# Continuação do site — 03/10/2026

Estado atual em [SITE_CONTINUATION_2026-10-03.md](docs/SITE_CONTINUATION_2026-10-03.md); lacunas G40–G49 em [API_GAPS.md](docs/API_GAPS.md). Relatórios anteriores abaixo são históricos, não certificação de integrações novas.

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

## Ciclo comercial — 28/09/2026

Baseline c73d94c preservou trabalho/testes anteriores. BFF autenticado create/checkout, carrinho ligado ao pedido, domínio de redirecionamento restrito e Minha Conta com estados/registros reais. Preço/identidade do browser recusados. Site: 146 testes + 38 HTTP aprovados; typecheck/lint/build e verify:client aprovados. API: 85 + 153; total 422. Nenhum teste removido. Mercado Pago testado com transporte controlado; sem credenciais/DM/cobrança/entrega real. Dependências externas e compatibilidade em docs/CONTINUATION_REPORT.md. READY_FOR_BRIDGE depende de efeito e ACK reais.

## Compatibilidade Crypto INGAME — 29/09/2026

Histórico de pedidos formata CRYPTO em inteiros (BigInt), mantendo BRL em centavos. Schemas aceitam storefronts do catálogo e origin INGAME dos benefícios. Alterações limitadas à compatibilidade com a API v0.6; homepage, checkout/Mercado Pago e bot/bridge não alterados.

Validação: 150 testes unitários/componentes/servidor (4 novos), 38 HTTP, typecheck, lint, build e verify:client aprovados. Build inicial encontrou inferência de data no formatter; corrigida e revalidada. Nenhuma publicação, OAuth real ou efeito FiveM. A alteração preexistente .openai/hosting.json foi preservada fora deste trabalho. Contrato: D:/api suburbio/docs/CRYPTO_INGAME.md.

Cargos Discord (2026-10-03): implementação aprovada no código da API, migration 011 e testes isolados. Ativação real depende de migration e conexão HMAC. Estado e homologação: docs/DISCORD_ROLES_IMPLEMENTED.md. SYSTEM_OWNER independente; Staff/Suporte desativados.

UX cidadão (2026-10-03): navbar global e perfil integrados, OAuth existente preservado, 297 verificações do site aprovadas. Entrega, componentes, screenshots e limitações: docs/CITIZEN_UX_2026-10-03.md.

2026-10-04 — Transmissão na navbar, Crypto entre carrinho/perfil e card compartilhado; contratos reais HMAC para carteira/personagens. 317 verificações site + 296 API aprovadas. Sem nova migration/deploy. Estado, screenshots, limites e configuração pendente: docs/CRYPTO_SCREEN_2026-10-04.md.


## Afiliados — 2026-10-04
Site + API implementados. Cadastro, cupons integrados, snapshots, comissões, estornos/compensação e repasses manuais. Dropdown condicional validado. Migration 012 aplicada apenas em testes; conexão real e homologação pendentes. Relatório: docs/AFFILIATES_2026-10-04.md (a partir da raiz).


## Revisão de arquitetura — 2026-10-04
Relatório docs/ARCHITECTURE_REVIEW_2026-10-04.md e matriz docs/RESPONSIBILITY_MATRIX.md. Site/API/bot validados; bridge tem 8 falhas pré-existentes (73/81). Total 914 aprovados / 922 executados; não afirmar ecossistema todo verde. Sem deploy, migrations novas ou ativação financeira.

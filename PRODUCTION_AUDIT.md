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

# Auditoria de entrega — 2026-09-26

## Resultado

Implementação local pronta para evolução/homologação. **Não está liberada para operação administrativa real**: faltam resolução institucional na API, credenciais OAuth/HMAC e infraestrutura ativa. Sem dados administrativos fake, owner hardcoded, banco direto ou bypass de login.

## Preservação

Next.js 16.3.5 mantido. `app/page.tsx`, `app/globals.css`, `app/layout.tsx` e `lib/site.ts` sem diferenças em relação ao frontend anterior. Homepage, SEO existente, navegação, loja, logo e carrinho preservados. Novas telas usam CSS isolado. Export estático removido por incompatibilidade com BFF/autenticação; deploy alvo é Node no Windows Server 2025.

## Páginas entregues

16 rotas administrativas: `/admin`, `/admin/services`, `/admin/players`, `/admin/players/[playerId]`, `/admin/admins`, `/admin/permissions`, `/admin/allowlist`, `/admin/punishments`, `/admin/orders`, `/admin/orders/[orderId]`, `/admin/payments`, `/admin/refunds`, `/admin/chargebacks`, `/admin/audit`, `/admin/discord`, `/admin/settings`.

Também `/login`, `/minha-conta`, página 403, erro administrativo isolado, skeletons e estados de integração pendente. Rotas BFF: `/api/admin/services`, `/api/admin/allowlist/[playerId]`, `/api/admin/allowlist/revoke`; fluxo Auth.js em `/api/auth/[...nextauth]`.

## Evidências executadas

- `npm test`: **91 testes** em 6 arquivos, aprovados, sem skip.
- `npm run test:http`: **28 testes HTTP** aprovados, sem skip, sobre processo Next.js isolado usando o build e JWT Auth.js criptografado de teste. Não usa conta Discord, banco ou API real. Cookie de teste não pode autenticar no servidor normal, que usa outra chave/integração desligada.
- **Total: 119 testes automatizados aprovados.**
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado, zero warnings.
- `npm run build`: aprovado; homepage estática, 18 páginas novas dinâmicas, quatro handlers.
- `npm run verify:client`: 15 arquivos de bundle público examinados, sem nomes de secrets protegidos ou valores presentes no ambiente. Configuração real ainda não fornecida.
- Navegador: login conferido em apresentação normal e breakpoints 1440/390; DOM mobile com viewport/documentWidth/login = 390px, sem overflow horizontal; botão informa autenticação não configurada. Shell/admin validado por renderização SSR de componentes e regras responsivas; navegação administrativa completa com conta real **não homologada**.

## Cobertura relevante

Assinatura/body hash/método/path/query/timestamp/nonce, alteração de payload/segredo, transporte assinado, idempotência, erro sanitizado, API offline/read-only, shape inválido, limite 429, origem/CSRF/body size, SSRF por path, limite por processo, paginação/filtros, sessão ausente/válida/adulterada/expirada por política, rotação de chave, capability permitida/negada, usuário comum, owner desabilitado, decisão fullAccess explícita, ator de revoke derivado no servidor, rejeição de actor livre, gaps sem mocks, no-store, fronteira server-only e UI crítica mobile/SSR.

HTTP: 17 URLs privadas sem sessão redirecionam; sessão válida abre minha-conta mas não contorna API_GAP; handlers devolvem 401/403/503 adequadamente; sessão JSON não expõe tokens; callback sem state falha antes de autenticar.

## Integrações reais versus preparação

| Parte | Situação |
| --- | --- |
| HMAC/health/allowlist/revoke/operação | Código implementado contra contrato real v0.2, testes com transporte controlado |
| Sessão Auth.js | Criptografia e verificação real da biblioteca testadas, inclusive via HTTP |
| Discord OAuth real | Implementado, não executado com credenciais reais |
| Subúrbio API online | `127.0.0.1:3000/health` recusou conexão no endereço documentado; sem teste live |
| Resolução de AdminAccount | Endpoint ausente; bloqueia /admin, sem fallback |
| Commerce/RBAC/listagens/admin audit | Endpoints ausentes documentados em API_GAPS.md |
| Loja | Demo original explicitamente marcada; zero cobrança |
| Banco/FiveM/bot | Nenhum acesso direto ou alteração |

## Segurança e limitações para produção

- Auth.js 5.0.0-beta.32 fixada; revisar atualizações antes de operar. `forbidden` usa opção experimental `authInterrupts` do Next atual.
- Rate limit em memória é por processo; exigir enforcement no proxy/API antes de escalar. Não usa IP arbitrário de X-Forwarded-For.
- Logout remove cookie; revogação global individual de sessões ainda não possui endpoint. Sessão expira e administração deve ser reautorizada pela API.
- HTTPS/domínio/callback exato são obrigatórios em produção. Secrets não foram gerados/preenchidos automaticamente nem copiados de outros projetos.
- API_READ_ONLY é tratado tanto pela futura decisão de autorização quanto pela resposta real de revoke. Health v0.2 não expõe flag de read-only; não inventar esse campo.
- Não houve E2E de OAuth externo, pagamento, revogação real de allowlist ou concessão de permissões reais. Não confundir 119 testes com homologação de produção.
- Original HMAC não assina Idempotency-Key/correlationId; transporte seguro e origem fixa continuam necessários, conforme README da API.

## Acesso solicitado

Discord `403707367885242378`: usuário pediu acesso ao painel. Alteração de bootstrap SYSTEM_OWNER bloqueada pela revisão automática por conceder privilégios completos sem aprovação explícita desse nível. Pergunta enviada e pendente. `.env` da API confirmado inalterado (`BOOTSTRAP_OWNER_ENABLED=false`, ID vazio). Não foi enviado código nem ativo para hospedagem externa.

## Próximos passos

1. Resolver aprovação/nivel de acesso desse Discord na API.
2. Expor e homologar G01 (resolução institucional) com capabilities efetivas, sem bootstrap no site.
3. Configurar env e iniciar API/dependências pelo processo operacional do projeto da API.
4. Homologar Discord OAuth, owner/capabilities e health/allowlist com contas/ambiente autorizados.
5. Entregar endpoints de listagens/comércio conforme API_GAPS; ativar um adapter por contrato real.

## Ciclo comercial — 28/09/2026

Baseline c73d94c preservou trabalho/testes anteriores. BFF autenticado create/checkout, carrinho ligado ao pedido, domínio de redirecionamento restrito e Minha Conta com estados/registros reais. Preço/identidade do browser recusados. Site: 146 testes + 38 HTTP aprovados; typecheck/lint/build e verify:client aprovados. API: 85 + 153; total 422. Nenhum teste removido. Mercado Pago testado com transporte controlado; sem credenciais/DM/cobrança/entrega real. Dependências externas e compatibilidade em docs/CONTINUATION_REPORT.md. READY_FOR_BRIDGE depende de efeito e ACK reais.

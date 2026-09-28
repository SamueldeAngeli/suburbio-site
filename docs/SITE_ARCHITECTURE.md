# Arquitetura do site

## Estrutura

| Diretório | Responsabilidade |
| --- | --- |
| `app/page.tsx`, `app/globals.css` | Homepage/Área VIP demo originais, preservadas |
| `app/login`, `app/minha-conta` | Login Discord e área do jogador |
| `app/admin` | Páginas administrativas protegidas, CSS isolado |
| `components/admin` | Shell, tabelas preparadas, estados, detalhes e revogação |
| `app/api/auth/[...nextauth]` | Auth.js, state, callback, cookies, sessão, CSRF |
| `app/api/admin` | BFF de health, allowlist, produtos e categorias, sem regras de domínio |
| `lib/api` | DTOs, validação de respostas, cliente HMAC, erros seguros |
| `lib/auth`, `lib/permissions` | Identidade Discord, sessões e decisões da API |
| `lib/server` | Env, validação de origem e limites por processo |
| `tests` | Unitários, componentes SSR, contratos de transporte e handlers |

## Fluxo

Browser → Next.js → sessão validada → decisão institucional da API → capability → adapter server-only → Subúrbio API via HMAC.

O site não importa clientes PostgreSQL, MariaDB ou Redis. Não acessa FiveM ou bot diretamente. Role/character/citizenid não conferem administração. O site nunca cria um owner por Discord ID hardcoded.

`AccountService.resolve` consulta POST /internal/site/admin/resolve (v0.3), valida isSystemOwner/capabilities/status e converte para AdminPrincipal. API não configurada/offline falha fechada; conta comum/inativa recebe 403. Páginas e handlers validam acesso individualmente; o layout não é a única barreira. `forbidden()` gera a tela 403 e exige o recurso experimental `authInterrupts` do Next.js instalado.

## HMAC oficial

SHA256 do corpo exato em UTF-8; HMAC-SHA256 hexadecimal de `METHOD_UPPERCASE + "\n" + PATH_WITH_QUERY + "\n" + UNIX_SECONDS + "\n" + NONCE + "\n" + BODY_SHA256`. Nonce criptográfico novo de 24 bytes, codificado base64url. Corpo serializado uma vez e reutilizado na assinatura/transporte. GET assina corpo vazio. Redirects proibidos; URL de destino vem de configuração validada, nunca do usuário. Métodos expostos limitados a endpoints conhecidos.

Sem retries automáticos em mutações. Idempotency-Key permanece estável durante retry da mesma intenção; nonce e timestamp sempre novos. Revoke recebe playerId, motivo, confirmação e chave do navegador. `actorDiscordId` é inserido **somente pelo servidor**, a partir da sessão cujo AdminAccount/capability foi validado. Campos extras são rejeitados.

## Sessão e segredos

Auth.js 5.0.0-beta.32, versão fixada; solução documentada para App Router. JWT é criptografado, cookie HttpOnly/SameSite=Lax/Path=/ gerido pela biblioteca, Secure em HTTPS/produção. MaxAge 1h e limite absoluto de autenticação de 8h. Rotação de chave via AUTH_SECRET_PREVIOUS. Logout remove cookies; revogação centralizada individual de sessão ainda requer contrato próprio. Nenhum access_token/refresh_token Discord é encaminhado ao cliente ou persistido pelo site. Sessão cliente contém somente nome, Discord ID e expiração; permissões vêm da API por requisição.

Fluxo web confidencial Discord usa `state` e client_secret no servidor, scope `identify`. PKCE não consta no contrato web confidencial consultado; não habilitado como se estivesse homologado. Fontes: [Auth.js](https://authjs.dev/getting-started/installation), [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2).

Integrações desligadas por padrão; frontend público funciona sem env. Ao ligar cada integração, variáveis críticas são obrigatórias no boot (`instrumentation.ts`). Nenhuma env secreta usa NEXT_PUBLIC_. O build verifica a fronteira `server-only`.

## UI, carregamento e dados

Server Components por página; health em Suspense independente. Filtros GET espelhados na URL e validados no servidor; listagens futuras têm PageResult tipado e pageSize máximo 100. Nenhuma listagem busca tudo para filtrar no browser. Como faltam endpoints, paginação e tabelas não fingem conter resultados. Tabs FiveM apenas informam integração pendente.

Estilos novos ficam sob `.admin-root`, sem alterar CSS público. Shell tem sidebar desktop e navegação compacta mobile. Nenhuma busca global falsa foi adicionada; busca por módulo fica preparada. Erros mostram mensagem controlada e referência OP, nunca resposta bruta, SQL ou stack. Logs contêm módulo, rota normalizada, duração, resultado e IDs técnicos válidos; motivos, bodies e headers de autenticação nunca são logados.

## Limites conhecidos

Rate limit em memória por processo, com limite de tamanho e expiração, complementa a API. Não é substituto de limite de borda distribuído. Nenhum X-Forwarded-For é aceito como identidade confiável. Dados administrativos usam no-store; cache React apenas deduplica a resolução dentro da requisição. Sem proteção exclusivamente por middleware. Deploy passa a exigir Node.js; export estático antigo não executa auth/BFF.

## Evolução comercial — 27/09/2026
Catálogo live no público quando a API está configurada; demo apenas com integração desabilitada. BFF de quote envia identidade da sessão e identificadores, sem preços. Cupons owner-only e histórico/cancelamento dos próprios pedidos estão integrados. Consulte COMMERCE_ARCHITECTURE.md. Listagens administrativas financeiras e checkout permanecem pendentes.

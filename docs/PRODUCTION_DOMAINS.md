# Domínios de produção — Site, API e Bot

Normativo. Somente código/configuração; Apache, SSL, DNS e firewall são passos manuais (fim do documento).

## URLs oficiais

| Papel | URL |
| --- | --- |
| Site (canônico) | `https://suburbioroleplay.com` |
| www | `https://www.suburbioroleplay.com` → redirect 301/308 para a raiz |
| API pública | `https://api.suburbioroleplay.com` (somente `/live`, `/ready`, `/webhooks/mercadopago`) |
| Discord | `https://discord.gg/suburbiorp` (`lib/site.ts`) |

## Fluxos

```
Navegador ──HTTPS──▶ proxy (Apache) ──▶ Site  127.0.0.1:3002
Navegador ──WSS───▶ LiveKit (domínio público a definir; LIVEKIT_PUBLIC_URL)
Site (servidor) ──HTTP loopback + HMAC (site)────────▶ API 127.0.0.1:3000 /internal/site/*
Bot             ──HTTP loopback + HMAC (discord-bot)─▶ API 127.0.0.1:3000 /internal/discord/*
Mercado Pago ──HTTPS──▶ proxy ──▶ API 127.0.0.1:3000 /webhooks/mercadopago
```

- Site e bot **nunca** chamam `https://api.suburbioroleplay.com`: o proxy não expõe `/internal/*` e o tráfego sairia da VPS só para voltar.
- O navegador nunca chama a API: tudo passa pelo BFF do site (`/api/*` do Next). Por isso `CORS_ORIGINS` fica vazio.
- API em `HOST=127.0.0.1` (nunca `0.0.0.0`), `trustProxy: false`.

## Variáveis (nomes existentes; nenhuma nova)

### Site (`.env.production.local`)

| Variável | Finalidade | Produção |
| --- | --- | --- |
| `NODE_ENV` | modo | `production` (PM2) |
| `AUTH_ENABLED` | liga login | `true` |
| `AUTH_URL` | origem canônica: base do Auth.js, callback, cookies, redirect pós-login, `metadataBase`, redirect www | `https://suburbioroleplay.com` |
| `AUTH_SECRET` / `AUTH_SECRET_PREVIOUS` | assinatura/criptografia do JWT | segredo ≥ 32 / vazio fora de rotação |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | aplicação OAuth | IDs do Developer Portal |
| `DISCORD_REDIRECT_URI` | trava de consistência: deve ser `AUTH_URL` + callback (falha no boot se divergir) | `https://suburbioroleplay.com/api/auth/callback/discord` |
| `DISCORD_GUILD_ID`, `DISCORD_ROLE_AUTH_ENABLED`, `DISCORD_ROLE_REFRESH_SECONDS` | servidor/cargos | inalterados |
| `SUBURBIO_API_ENABLED` | liga BFF | `true` |
| `SUBURBIO_API_URL` | Site → API (servidor) | `http://127.0.0.1:3000` |
| `SITE_SERVICE_ID` / `SITE_SERVICE_SECRET` | HMAC Site → API | `site` / igual ao da API |
| `SUBURBIO_API_TIMEOUT_MS` | timeout BFF | `5000` |
| `LIVEKIT_*`, `REDIS_URL`, `REDIS_KEY_PREFIX` | transmissão `/tela` | ver `ENVIRONMENT.md`; domínio público do LiveKit ainda não definido |

### API (`.env`)

| Variável | Finalidade | Produção |
| --- | --- | --- |
| `NODE_ENV` | modo | `production` |
| `HOST` / `PORT` | bind | `127.0.0.1` / `3000` |
| `CORS_ORIGINS` | CORS | vazio (origens exatas HTTPS se um dia for preciso; `*` recusado) |
| `SITE_SERVICE_ID` / `SITE_SERVICE_SECRET` | HMAC do site | `site` / segredo compartilhado com o site |
| `DISCORD_BOT_SERVICE_ID` / `DISCORD_BOT_SERVICE_SECRET` | HMAC do bot | `discord-bot` / igual a `API_SERVICE_SECRET` do bot |
| `MERCADO_PAGO_ENABLED` | pagamentos | `false` (não habilitar ainda) |
| `MERCADO_PAGO_NOTIFICATION_URL` | webhook (preparado) | `https://api.suburbioroleplay.com/webhooks/mercadopago` |
| `MERCADO_PAGO_RETURN_URL` | retorno do comprador | `https://suburbioroleplay.com/minha-conta/pedidos` |

### Bot (`.env`)

| Variável | Finalidade | Produção |
| --- | --- | --- |
| `API_ENABLED` | liga integração | `true` |
| `API_BASE_URL` | Bot → API | `http://127.0.0.1:3000` |
| `API_SERVICE_ID` / `API_SERVICE_SECRET` | HMAC | `discord-bot` / igual a `DISCORD_BOT_SERVICE_SECRET` da API |
| `ROLE_AUTOMATION_SAFE_MODE` | pausa automação de cargos | **manter o valor atual** (padrão `true`); mudar só por decisão explícita |
| `SITE_URL` | link no `/status` | `https://suburbioroleplay.com` |
| `HEALTH_PORT` | `/health` e `/ready` em loopback | `3101` |

## Auth.js

- `AUTH_URL` é a única fonte da origem: com `trustHost: true`, o Auth.js substitui a origem da requisição por `AUTH_URL`. Assim, o callback é sempre `AUTH_URL/api/auth/callback/discord`, mesmo atrás do proxy.
- Redirect pós-login: `safeReturnTo` aceita só `/minha-conta[/…]`, `/admin[/…]`, `/tela` e `/tela?room=<código>`; o callback `redirect` do Auth.js aceita apenas a mesma origem de `AUTH_URL`. Qualquer outra coisa vira `/minha-conta` (sem open redirect).
- Cookies em produção: prefixos `__Secure-`/`__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, host-only (sem `Domain`). Em `http://localhost:3002` os cookies ficam sem `Secure` e o login local continua funcionando.
- www × raiz: como os cookies são host-only, www teria outra sessão. Por isso `www` sempre redireciona para a raiz, primeiro no proxy e também no `next.config.ts`, que gera a regra a partir de `AUTH_URL`. Requisições com Host `127.0.0.1` não casam com a regra, então não há loop.

## Sem a API

| Área | Comportamento |
| --- | --- |
| Admin | falha fechado (`resolve`/capabilities exigem a API) |
| Crypto / afiliados / pedidos | mensagem de indisponibilidade; nada inventado |
| Loja / cupom | `SUBURBIO_API_ENABLED=false` → demo identificado; API habilitada e fora → "temporariamente indisponível" e cupom desativado. Cupom e valores só são aceitos com cotação real da API (`/api/vip/quote`); health da API não autoriza nada financeiro |
| Saúde do site | `/api/health` (liveness) não depende de nada; `/api/ready` é leve (um `/health` da API em loopback + ping Redis) e responde 503 com a API habilitada e fora |

## Passos manuais (fora deste repositório)

1. **DNS**: A/AAAA de `suburbioroleplay.com`, `www` e `api` para a VPS. O domínio do LiveKit fica a definir.
2. **SSL**: certificados válidos para raiz, www e api.
3. **Apache**:
   - `suburbioroleplay.com` → `http://127.0.0.1:3002`, com WebSocket liberado e `ProxyPreserveHost On`.
   - `www.suburbioroleplay.com` → `Redirect permanent / https://suburbioroleplay.com/`.
   - `api.suburbioroleplay.com` → `http://127.0.0.1:3000`, somente `/live`, `/ready` e `/webhooks/mercadopago`; `/internal/*` bloqueado com 404.
   - HTTP → HTTPS.
4. **Firewall**: liberar só 80/443 (e as portas do LiveKit quando definido). 3000, 3002 e 3101 nunca ficam expostas.
5. **Discord Developer Portal** → OAuth2 → Redirects: adicionar `https://suburbioroleplay.com/api/auth/callback/discord` e manter `http://localhost:3002/api/auth/callback/discord` para desenvolvimento.

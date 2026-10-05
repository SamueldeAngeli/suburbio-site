# Variáveis de ambiente — Site

Fonte: `lib/server/env.ts`, validado no boot por `instrumentation.ts`. A mensagem de erro cita o nome da variável, nunca o valor. Exemplo versionado: `.env.example`. Em produção, use `.env.production.local` (ignorado pelo git).

Nenhum segredo usa `NEXT_PUBLIC_`. `npm run verify:client` falha se nome ou valor de segredo aparecer no bundle público.

| Variável | Obrigatória quando | Regra |
| --- | --- | --- |
| `NODE_ENV` | sempre | `production` na VPS (o PM2 define) |
| `AUTH_ENABLED` | — | `true` liga login. Valida todo o grupo abaixo |
| `AUTH_URL` | auth | Origem pública exata do site; HTTPS em produção |
| `AUTH_SECRET` | auth | ≥ 32 caracteres aleatórios |
| `AUTH_SECRET_PREVIOUS` | rotação | ≥ 32; remover após 8h (limite absoluto de sessão) |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | auth | Aplicação OAuth do Discord (secret ≥ 16) |
| `DISCORD_REDIRECT_URI` | auth | Exatamente `AUTH_URL` + `/api/auth/callback/discord` |
| `DISCORD_GUILD_ID` | — | Servidor principal (padrão: Subúrbio) |
| `DISCORD_ROLE_AUTH_ENABLED` | — | Usa cargos do Discord na decisão de admin da API |
| `DISCORD_ROLE_REFRESH_SECONDS` | — | 10–60; padrão 30 |
| `SUBURBIO_API_ENABLED` | — | `true` liga o BFF |
| `SUBURBIO_API_URL` | API | Origem sem path/query/credencial. Produção: HTTPS, ou HTTP somente para loopback/rede privada |
| `SITE_SERVICE_ID` | API | Padrão `site`; igual ao cadastro na API |
| `SITE_SERVICE_SECRET` | API | ≥ 32; **igual** a `SITE_SERVICE_SECRET` da API e diferente de todos os outros secrets |
| `SUBURBIO_API_TIMEOUT_MS` | — | 500–30000; padrão 5000. Substitui o antigo `API_TIMEOUT_MS` (removido por colidir com ferramentas que usam o mesmo nome) |
| `LIVEKIT_ENABLED` | — | `true` liga `/tela` |
| `LIVEKIT_INTERNAL_URL` | LiveKit | Endereço do SDK no servidor. `ws`/`http` só em loopback/rede privada em produção |
| `LIVEKIT_PUBLIC_URL` | LiveKit | Endereço entregue ao navegador. Produção: `wss://` em host público |
| `LIVEKIT_API_KEY` | LiveKit | Chave cadastrada no LiveKit |
| `LIVEKIT_API_SECRET` | LiveKit | ≥ 32 em produção |
| `REDIS_URL` | opcional | `redis://` ou `rediss://`. Ausente = instância única |
| `REDIS_KEY_PREFIX` | — | Padrão `suburbio:site:`; nunca usar o prefixo da API |
| `PORT` | — | Definida pelo PM2 (`ecosystem.config.cjs`: 3002 em 127.0.0.1) |

Produção mínima: `AUTH_ENABLED=true`, `SUBURBIO_API_ENABLED=true`, `LIVEKIT_ENABLED=true` (se `/tela` for publicado) e `REDIS_URL` (recomendado).

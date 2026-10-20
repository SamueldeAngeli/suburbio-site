# Checklist de produção

Fonte única dos números de teste. Windows, Node 24, serviços de teste isolados (PostgreSQL 127.0.0.1:15432, Redis 127.0.0.1:16379, LiveKit de desenvolvimento 127.0.0.1:7880). Cada número indica a data da execução; suítes não reexecutadas mantêm a data anterior.

## Verificação técnica

Execução de **2026-10-19**: typecheck e testes unitários dos três projetos (site com a alteração local de `lib/screen/rooms.ts`); na API e no bot também lint, build e (API) integração completa. Format e as suítes HTTP/navegador do site não foram reexecutados nessa data.

| Projeto | Typecheck | Lint | Format | Testes | Build |
| --- | --- | --- | --- | --- | --- |
| Site | ✔ 10-19 | ✔ 10-05 | ✔ 10-05 | unit 468/468 (10-19) · HTTP 46/46 · navegador 20/20 · afiliados UI 15/15 · WebRTC real 17/17 · `verify:client` ✔ (10-05) | ✔ 10-05 |
| API | ✔ 10-19 | ✔ 10-19 | ✔ 10-05 | unit 116/116 · integração 351/351 (10-19, com a entrega VIP pelo Discord) | ✔ 10-19 |
| Bot | ✔ 10-19 | ✔ 10-19 | ✔ 10-05 | 254/254 (10-19, com a entrega VIP pelo Discord) | ✔ 10-19 |
| Bridge (somente leitura) | — | — | — | 83/83 em 10-05 (diretório temporário; repositório não alterado) | — |

## Pronto no código

- [x] Site sem localhost no client: o navegador recebe só `LIVEKIT_PUBLIC_URL` (WSS obrigatório em produção). A URL interna, a chave e o secret nunca saem do servidor (teste e `verify:client`).
- [x] `SUBURBIO_API_TIMEOUT_MS` substitui `API_TIMEOUT_MS` (sem alias).
- [x] HMAC homologado: Site, Bot e Bridge assinam o mesmo vetor de referência; a API rejeita path, query, método e body alterados, timestamp fora de ±60s, replay, secret de outro serviço e cruzamento de prefixo.
- [x] Correlation ID enviado por Site e Bot e devolvido e registrado pela API.
- [x] Pagamento confirmado só por webhook assinado + consulta ao provedor; webhook duplicado ou fora de ordem e restart cobertos; entrega não duplica (ACK idempotente, lease).
- [x] Estado efêmero do site em Redis (`suburbio:site:*`) com fallback definido; Redis não é ponto único de falha do site.
- [x] Health/ready nos três serviços.
- [x] Logs JSON com `timestamp`, `service`, `level`, `event`, `correlationId`, `durationMs`; segredos redigidos.
- [x] Migrations versionadas 001–021, `timestamptz`/UTC, dinheiro em `bigint`; `db:migrate` em produção exige `MIGRATE_CONFIRM`.
- [x] Bot: logs de mensagem sem spam para mensagens não cacheadas; apelido de membro acima do bot não entra em retry infinito.
- [x] Repositório: `out/`, scripts que escreviam na API e logs temporários removidos; `.gitattributes` com LF; `.local/` ignorado.

## Antes de abrir ao público (fora do código)

- [ ] **VPS:** seguir `WINDOWS_SERVER_DEPLOY.md` (PostgreSQL, Memurai/Redis, LiveKit, Caddy, PM2, tarefa de boot); firewall fechado nas portas internas; NTP ativo. O checklist de go-live completo está na seção 20 desse guia.
- [ ] **Segredos:** gerar novos valores para produção (4 HMAC/allowlist distintos, `AUTH_SECRET`, LiveKit ≥ 32). Não reutilizar chaves de desenvolvimento.
- [ ] **Migrations:** backup, depois `npm run db:status`, depois `MIGRATE_CONFIRM=suburbio_api npm run db:migrate` (012 a 021 ainda não aplicadas em banco real).
- [ ] **OAuth Discord:** cadastrar `https://suburbioroleplay.com/api/auth/callback/discord` no Developer Portal e homologar login real.
- [ ] **Mercado Pago:** homologar em sandbox (checkout → webhook → entrega → reembolso) com `MERCADO_PAGO_LIVE_MODE=false`; só então ligar o modo live.
- [ ] **Bot:** produção exige `API_ENABLED=true` (hoje `false` no `.env` local, ou seja, sem sincronização de allowlist/VIP), `TICKET_STORAGE_MODE=local`, `SCHEDULER_STORAGE_MODE=local` explícitos, `HEALTH_PORT=3101` e, depois de validar, `ROLE_AUTOMATION_SAFE_MODE=false`.
- [ ] **LiveKit:** DNS `tela.` e `turn.`, certificado para TURN TLS, portas 7881/tcp, 7882/udp, 3478/udp e 5349/tcp.
- [ ] **API:** dimensionar `REDEEM_IP_LIMIT` (teto global de resgates por minuto, porque o IP visto é o do bot).
- [ ] **Base FiveM:** aplicar `suburbio-api/docs/FIVEM_BASE_CHANGES.md` (correlation ID; recomendado, não bloqueante).
- [ ] **Backup:** agendar `pg_dump` diário e cópia do SQLite e dos transcripts do bot; testar uma restauração.

## Riscos aceitos

- Membership do Discord no site fica em memória por instância (guarda o access token): com várias instâncias, o refresh de cargos acontece por instância.
- Sem `REDIS_URL`, salas de tela e rate limit do site se perdem no restart (modo instância única).
- Pedidos em `payment_status=review` exigem ação humana.
- Auth.js 5 ainda é beta (fixada em `beta.32`).

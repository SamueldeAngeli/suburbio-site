# Testes

Cada repositório roda os próprios testes. Nenhum teste escreve em banco, API ou Discord reais. Contagens: veja `PRODUCTION_CHECKLIST.md` (única fonte de números; os relatórios em `docs/history/` têm contagens antigas).

## Site (`suburbiorp`)

| Etapa | Comando | O que exige |
| --- | --- | --- |
| Tipos | `npm run typecheck` | — |
| Lint | `npm run lint` | — |
| Formatação | `npm run format:check` | — |
| Unit/componentes | `npm test` | — (o ambiente do shell não interfere; o timeout usa `SUBURBIO_API_TIMEOUT_MS`) |
| Build | `npm run build` | — |
| Fronteira client | `npm run verify:client` | build feito; lê `.env*` para checar também os valores |
| HTTP | `npm run test:http` | build; sobe `next start` isolado em 127.0.0.1:3107 com credenciais de teste |
| Navegador | `npm run test:ui`, `npm run test:affiliate-ui` | build + Edge/Playwright |
| WebRTC real | `node tests/livekit.browser.mjs` | build + LiveKit de desenvolvimento em 127.0.0.1:7880 (`.local/livekit`) + Redis de teste em 127.0.0.1:16379 (`TEST_REDIS_URL` para outro endereço) |

Cobertura de cenários de produção no site:

| Cenário | Onde |
| --- | --- |
| Timeout da API, API indisponível, HMAC inválido, resposta malformada | `tests/api-diagnostics.test.ts` |
| Redis indisponível (rate limit cai para o limite local; salas falham fechadas) | `tests/rate-limit.test.ts`, `tests/room-controls.test.ts` |
| LiveKit indisponível; o client nunca recebe secret ou URL interna | `tests/room-controls.test.ts` |
| Transmissão: papéis e grants, capacidade e última vaga concorrente, expiração, kick/revogação, sem fallback em memória | `tests/room-controls.test.ts` |
| Transmissão: sessão obrigatória, identity/papel não forjáveis, CSRF, corpo e abuso (criação/tokens) | `tests/screen-room-route.test.ts` |
| Transmissão na UI: estados, permissão revogada, reconexão espaçada, reload, cleanup | `tests/screen-ui.test.tsx`, `tests/screen-page.test.tsx` |
| Env de produção (WSS público, secret ≥ 32, nomes novos) | `tests/env.test.ts` |
| Readiness | `tests/readiness.test.ts`, `tests/http.smoke.mjs` |
| Usuário sem cargo, sessão expirada ou adulterada, origem inválida, payload grande | `tests/accounts.test.ts`, `tests/auth.test.ts`, `tests/http.smoke.mjs` |
| Vetor HMAC compartilhado | `tests/hmac.test.ts` |

## API (`api suburbio`)

- `npm run typecheck`, `npm run lint`, `npm test` (unitários, incluindo `hmac-homologation.test.ts`) e `npm run build`.
- Integração: `TEST_DATABASE_CONFIRM=isolated npm run test:integration`. Exige o PostgreSQL de teste em 127.0.0.1:15432 e o Redis de teste em 127.0.0.1:16379 (`compose.test.yaml`, ou instâncias locais equivalentes). Cada arquivo cria um banco `suburbio_test_<uuid>` descartável. **Nunca** aponte `TEST_POSTGRES_*` para produção.

A integração cobre webhook duplicado, concorrente ou fora de ordem; restart durante o checkout; ACK de entrega duplicado; lease expirada; compras concorrentes (estoque e saldo); expiração concorrente; reembolso, chargeback e comissão; replay HMAC; Redis e PostgreSQL indisponíveis; migrations idempotentes.

## Bot (`suburbio bot`)

`npm run check` executa typecheck, testes, lint e build. Cobre tickets concorrentes (inclusive entre conexões SQLite), sequência global, cooldown, transcript, API ou Discord indisponíveis no consumidor de outbox, logs de mensagem sem cache, apelido de membro não gerenciável, health e vetor HMAC.

## Bridge

Somente leitura neste projeto. Os testes dela pertencem à base FiveM.

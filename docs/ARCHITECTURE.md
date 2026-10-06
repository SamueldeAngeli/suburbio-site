# Arquitetura — Subúrbio RP

Documento normativo. Relatórios datados ficam em `docs/history/` e não prevalecem sobre este arquivo.

## Ecossistema

Três serviços Node.js independentes na VPS, cada um com repositório, dependências, `.env` e processo próprios. Eles se comunicam **somente** pelos contratos HTTP da API e nunca compartilham código ou banco.

| Serviço | Repositório | Papel |
| --- | --- | --- |
| Site (este) | `suburbiorp` | UI pública, área do cidadão, admin, BFF. OAuth Discord, salas de tela locais |
| Subúrbio API | `api suburbio` | Autoridade do estado central: identidade, allowlist, admin, catálogo, pedidos, pagamentos, entregas, afiliados, outbox |
| Bot Discord | `suburbio bot` | Discord: tickets, logs, boas-vindas, convites, cargos; consome eventos da API |
| Bridge FiveM | `suburbio_bridge` | **Recurso dentro da base FiveM, não é serviço da VPS.** Somente leitura para este projeto; mudanças viram especificação para o desenvolvedor da base |

```
Navegador ──HTTPS──▶ Proxy ──▶ Site/BFF ──HMAC──▶ Subúrbio API ──▶ PostgreSQL, Redis da API
                       │                              ▲   ▲
                       │                    HMAC/outbox│   │HMAC (Mercado Pago: webhook público assinado)
                       │                        Bot ───┘   └── Bridge (dentro do FiveM)
                       └──WSS──▶ LiveKit (mídia WebRTC; tokens emitidos pelo Site)
```

Regras permanentes (detalhe em `RESPONSIBILITY_MATRIX.md`):

- O navegador fala só com o Site e, para mídia, com o LiveKit. API, Redis, PostgreSQL e bot nunca são acessados pelo navegador.
- A API é a única autoridade de estado central e financeiro. O Site e o bot não inventam estado: consultam, exibem e acionam endpoints permitidos.
- O Site pode ter Redis próprio para estado efêmero (`suburbio:site:*`), isolado das chaves da API (`suburbio-api:*`).
- O bot guarda em SQLite local apenas o que é dele: tickets, agendamentos, cache de mensagens e registry de painéis. A API não tem contrato para esses módulos.

## Site

| Diretório | Responsabilidade |
| --- | --- |
| `app/page.tsx`, `app/globals.css` | Homepage e Área VIP demo originais, preservadas |
| `app/login`, `app/minha-conta`, `app/tela` | Login Discord, área do cidadão, compartilhamento de tela |
| `app/admin` | Páginas administrativas; cada página chama `pageAccess` |
| `app/api/*` | BFF: valida sessão, origem, intent, tamanho e rate limit; chama a API |
| `app/api/health`, `app/api/ready` | Liveness e readiness |
| `lib/api` | Cliente HMAC, contratos Zod de resposta, erros seguros, diagnóstico interno |
| `lib/auth`, `lib/permissions` | Sessão Auth.js, membership Discord, guards |
| `lib/server` | `env.ts` (validação no boot), `security.ts` (origem, body, rate limit), `redis.ts`, `log.ts`, `readiness.ts` |
| `lib/screen` | Salas LiveKit (servidor) e cliente HTTP da sala (navegador) |

### Autorização

Sessão Discord **não** concede admin. Toda página e handler admin chama `requireAdmin`/`pageAccess`, que consulta `POST /internal/site/admin/resolve` a cada requisição. API offline, resposta malformada ou de outra identidade → 403/503 (falha fechada). Não há owner hardcoded nem bypass de desenvolvimento. O ator humano (`actorDiscordId`) é inserido pelo servidor a partir da sessão, nunca pelo navegador.

### Estado em memória (classificação)

| Estado | Onde | Classe | Decisão |
| --- | --- | --- | --- |
| Rate limit (`lib/server/security.ts`) | Redis `suburbio:site:rate-limit:*`, janela fixa com TTL = janela | C (multi-instância) | Redis quando `REDIS_URL` existe. Redis fora → janela local por processo (nunca sem limite) |
| Salas de tela (`lib/screen/rooms.ts`) | Redis hash `suburbio:site:livekit:rooms` (TTL 13h); locks `suburbio:site:lock:livekit:room:<código>` por sala e `…:livekit:rooms:create` para criação (PX 10s) | B + C | **Somente Redis** (`LIVEKIT_ENABLED` exige `REDIS_URL`). Sobrevive a restart e é compartilhado entre instâncias. Redis fora → `ROOM_UNAVAILABLE` e `/api/ready` 503 |
| Membership Discord (`lib/auth/discord-membership.ts`) | Memória do processo, TTL ≤ 8h, máx. 10k | A (local) | Contém access token OAuth: **não** é persistido. Com várias instâncias, o refresh de cargos acontece por instância |
| Conexão Redis | `globalThis` | A | Handle do processo |
| `knownErrors` e similares | Constantes | A | — |

Sem `REDIS_URL`, o rate limit fica na memória do processo (modo instância única). Salas de tela nunca ficam na memória: sem Redis a transmissão não pode ser ligada.

### Transmissão (LiveKit)

Fluxo: sessão Discord → Next.js (`POST /api/screen/room`) → Redis (estado da sala) → token LiveKit de 60s → navegador ↔ LiveKit (WebRTC). A Subúrbio API não participa.

- `LIVEKIT_ENABLED` é a única flag. Desligada (ou config inválida), `/tela` mostra "Transmissão indisponível" renderizado no servidor e a rota responde `ROOM_UNAVAILABLE`.
- `LIVEKIT_INTERNAL_URL`: só o SDK do servidor (loopback/rede privada). `LIVEKIT_PUBLIC_URL`: único endereço entregue ao navegador (`wss://` público em produção). Chave e secret nunca saem do servidor (`tests/room-controls.test.ts`, `npm run verify:client`).
- Sala (Redis): código público de 10 hex, nome interno aleatório (128 bits) na LiveKit, título, anfitrião, `createdAt`, expiração (12h), estado `open`/`locked`, capacidade (2 até `LIVEKIT_ROOM_MAX_PARTICIPANTS`), apresentadores, silenciados, bloqueados, admitidos e reservas de vaga (90s).
- Presença = participantes conectados na LiveKit + reservas válidas. A LiveKit é a fonte da presença: aba fechada, queda ou reload se resolvem sozinhos (a reserva expira; reentrada com a mesma identity substitui a conexão antiga). Sala encerrada pela LiveKit (vazia) é removida do Redis na próxima ação.
- Entrada, saída e moderação rodam sob lock da sala: duas entradas simultâneas não ocupam a mesma última vaga. A LiveKit também recebe `maxParticipants` como segunda barreira.
- Papéis e grants (token e `updateParticipant`): anfitrião e apresentador publicam tela, áudio da tela e microfone; participante só microfone; silenciado nada. Ninguém recebe `roomAdmin` nem `canPublishData`. Identity, nome e papel vêm da sessão; o corpo só escolhe ação, código e alvo.
- Ações do anfitrião (validadas no servidor): bloquear entradas, conceder/revogar apresentação (`share`, revogar silencia a tela já publicada), silenciar (`silence`), transferir, remover (`kick` com `revokeTokenTs` e bloqueio de reentrada) e encerrar.
- Resposta ao navegador: `{code, title, host, locked, capacity, role, url, token}`. Os metadados da sala (anfitrião, bloqueio, capacidade, apresentadores, silenciados) só servem para exibir estado; a autorização é o grant da LiveKit.
- Cliente: `adaptiveStream` + `dynacast`; tela com simulcast e bitrate por preset (0,6–5 Mbps, 360p30 a 1080p60). Reconexão: a LiveKit retoma quedas curtas; desconexão inesperada tenta de novo em 2s, 5s e 10s e depois para em "Conexão perdida". A aba lembra a sala (`sessionStorage`) e volta sozinha após reload.

## API (resumo; detalhe no repositório da API)

Fastify 5 + Zod, PostgreSQL (Kysely), Redis próprio para nonce, rate limit e lock. Workers de outbox, comércio e entitlements rodam no mesmo processo. O contrato oficial está em `api suburbio/docs/HTTP_CONTRACTS.md`.

### Máquina de estados do pedido (real)

Um pedido combina quatro dimensões persistidas em `orders`, com `CHECK` no banco:

| Dimensão | Valores |
| --- | --- |
| `status` | `pending` → `confirmed` → `completed`; ou `cancelled` |
| `payment_status` | `pending` → `approved`; ou `rejected`, `cancelled`, `expired`, `review` |
| `reservation_status` | `none` → `reserved` → `consumed`; ou `released` |
| `delivery_status` | `pending` → `delivered` |

Equivalência com o fluxo de negócio:

| Fluxo | Estado persistido |
| --- | --- |
| CREATED / PENDING_PAYMENT | `status=pending`, `payment_status=pending`, `reservation_status=reserved`; `checkout_attempts` CREATING/READY/UNCERTAIN |
| PAID | Webhook assinado → API consulta o pagamento no Mercado Pago → `payment_status=approved`, `status=confirmed`, `reservation_status=consumed` |
| DELIVERY_PENDING / DELIVERING | `benefit_fulfillments` PENDING; a bridge reivindica via outbox com lease |
| DELIVERED | ACK da bridge → `delivery_status=delivered`, `status=completed` |
| FAILED / revisão | `payment_status=review` (aprovação tardia, estoque liberado, pagamento duplo, falha ao preparar a entrega) |
| REFUNDED / chargeback | Pagamento revertido; comissão estornada; o benefício não é removido sem política |
| CANCELLED / expirado | `status=cancelled` ou `payment_status=expired`; reserva `released` uma única vez |

Garantias cobertas por testes de integração da API: o retorno do navegador nunca confirma pagamento; webhooks duplicados ou fora de ordem geram um único pagamento e uma única entrega; uma aprovação antiga não ressuscita pagamento estornado; restart durante o checkout recupera a preference sem novo POST; ACK duplicado não entrega duas vezes; compras concorrentes não ultrapassam estoque nem saldo.

### Banco

Migrations versionadas `001`–`013` no repositório da API, aplicadas **manualmente** (`npm run db:migrate`); o boot recusa iniciar com migration pendente. Todos os horários são `timestamptz` e a conexão é fixada em `timezone=UTC`. Dinheiro é `bigint` em centavos (`*_minor`), com aritmética em `BigInt` nos afiliados. Há FKs, `UNIQUE` (provider + referência, um débito por pedido) e triggers que tornam imutável o histórico de afiliados.

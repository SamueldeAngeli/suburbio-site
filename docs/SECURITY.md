# Segurança — Site e integração entre serviços

## Fronteiras

- **Segredos** só em módulos `server-only`. Nunca em `NEXT_PUBLIC_`, Client Components, logs ou respostas. Verificado por `npm run verify:client` após o build.
- **Falha fechada:** com API offline, timeout, HMAC recusado ou resposta malformada, o admin recebe 403/503 e as escritas não acontecem. Integração desligada nunca vira mock, exceto na Área VIP demo identificada.
- **Origem e CSRF:** escritas exigem `Origin` igual a `AUTH_URL`, `Sec-Fetch-Site` same-origin, header de intent (`x-suburbio-intent`), JSON com tamanho limitado (`readJson`, 4 KB padrão; 413 acima) e idempotency key quando há efeito.
- **Ator humano** vem da sessão no servidor; o navegador não consegue injetar `actorDiscordId`.

## HMAC entre serviços

String canônica (idêntica em Site, Bot, Bridge e API):

```
MÉTODO_MAIÚSCULO \n PATH+QUERY \n UNIX_SEGUNDOS \n NONCE \n sha256hex(corpo_exato)
```

| Regra | Valor |
| --- | --- |
| Algoritmo | HMAC-SHA256 hex, comparação em tempo constante |
| Skew aceito | ±60s (`HMAC_CLOCK_SKEW_SECONDS`), passado e futuro |
| Replay | Nonce gravado no Redis da API por 2×skew+1s **depois** de validar a assinatura (assinatura inválida não consome o nonce) |
| Secrets | Um por serviço (site, bot, bridge) mais o de allowlist. A API recusa iniciar se dois forem iguais |
| Escopo | `/internal/site/*` só site; `/internal/discord/*` só bot; `/internal/fivem/*` só bridge; outbox nega o site |
| Produção | `SERVICE_AUTH_ENABLED=false` só é aceito com `NODE_ENV=test` |

Homologação:

- **API** (`tests/hmac-homologation.test.ts`): assinatura válida para os 3 serviços, path, query, método e body alterados, timestamp vencido ou futuro, secret de outro serviço, serviço desconhecido, replay, isolamento de prefixo e payload acima de 16 KB.
- **Vetor de referência:** o mesmo vetor fixo é verificado de forma independente no site (`tests/hmac.test.ts`), no bot (`tests/hmac-vector.test.ts`) e na API, sem importar código entre repositórios.

## Correlation ID e diagnóstico

O site envia `X-Correlation-Id` (UUID) em cada chamada, e a API devolve o mesmo valor e registra nos seus logs. O bot também envia. Internamente, o site classifica as falhas em `invalid_hmac`, `forbidden`, `unauthorized`, `api_timeout`, `api_unavailable`, `malformed_response`, `internal_api_error`, `rate_limited` e `rejected` (`lib/api/client.ts`). O navegador recebe apenas o código genérico (`API_OFFLINE`, `API_INVALID_RESPONSE`, …) e uma referência `OP-…`.

## Logs

Uma linha JSON por evento: `timestamp`, `service`, `level`, `event`, `operation`, `status`, `outcome`, `durationMs`, `correlationId`, `requestId`. `lib/server/log.ts` descarta campos com nome de token, secret, password, authorization, cookie, signature, hmac ou key. Discord IDs e UUIDs são normalizados no caminho logado. A API usa redaction do pino para headers, body, tokens e credenciais.

## Pagamentos

O retorno do navegador nunca confirma pagamento. A autoridade é o webhook assinado do Mercado Pago (HMAC sobre `id`, `x-request-id` e `ts`, janela de 5 min). Mesmo assim, a API consulta o pagamento na API do provedor antes de persistir, e status, valor, conta e referência do corpo do webhook são ignorados. O checkout só aceita URLs `https://www.mercadopago.com.br` ou `sandbox.mercadopago.com.br`.

## Transmissão de tela

- Token LiveKit só no servidor, após sessão válida; identity = Discord ID da sessão, nome da sessão, TTL 60s, restrito à sala. O corpo da requisição é estrito: campos como `identity`, `role`, `name` ou `canPublish` são recusados (400).
- Grants mínimos por papel (`canPublishSources`): tela só para anfitrião/apresentador; participante só microfone; silenciado nada; sem `roomAdmin`/`canPublishData`. Publicar tela alterando o frontend é recusado pela própria LiveKit.
- Toda ação de moderação valida o anfitrião no servidor. Remover usa `revokeTokenTs` (token antigo deixa de valer) e bloqueia novos tokens para a identity na sala. Revogar apresentação silencia a tela já publicada no servidor.
- Sem enumeração: sala inexistente, expirada, encerrada ou com usuário bloqueado respondem igual (`ROOM_NOT_FOUND`); código de 40 bits sob rate limit.
- Limites: 30 ações/min por usuário, 5 criações/10 min, 20 entradas (tokens)/min, 2 salas por anfitrião, 100 salas no total, corpo de 1 KB; origem + cabeçalho de intenção (CSRF).
- Logs de sala registram só operação e duração; nunca token, chave, secret ou URL interna. O bundle cliente é verificado por `npm run verify:client`.

## Rate limit

O site usa Redis compartilhado com fallback local; a API usa Redis (por serviço e por escopo de resgate). Atenção: no resgate de allowlist, o escopo "IP" da API enxerga o IP do **bot** (quem chama), então `REDEEM_IP_LIMIT` funciona como teto global por minuto. Dimensione esse valor para o pico de resgates na abertura.

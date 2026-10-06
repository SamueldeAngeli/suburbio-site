# Operação

## Health

| Serviço | Liveness | Readiness |
| --- | --- | --- |
| Site | `GET /api/health` → 200 sempre que o processo responde (não depende de WebRTC) | `GET /api/ready` → 503 se a env for inválida, se a API não responder ou, com `LIVEKIT_ENABLED=true`, se o Redis ou a API da LiveKit não responderem. Sem transmissão, Redis fora aparece como `down` mas não tira o site de rotação. Falha de uma transmissão individual nunca afeta a readiness |
| API | `GET /live` | `GET /ready` (= `/health`): PostgreSQL e Redis; 503 se algum cair |
| Bot | `GET 127.0.0.1:3101/health` | `GET 127.0.0.1:3101/ready`: gateway do Discord e SQLite |

## Comportamento em falha

| Falha | Efeito | Ação |
| --- | --- | --- |
| API fora | Site público, homepage e login continuam. Admin, carrinho e área do cidadão mostram "Serviço temporariamente indisponível". O bot pausa o consumo de eventos (os eventos ficam na API) | `pm2 logs suburbio-api`; checar `/ready` |
| PostgreSQL fora | API `/ready` 503; escritas falham sem efeito parcial (transação) | Restaurar o serviço; não há fila perdida |
| Redis fora | API recusa chamadas internas (HMAC precisa do nonce) e fica não pronta. Site: rate limit local; com transmissão ligada, criar/entrar em salas responde "Transmissão indisponível" e o site fica não pronto (salas não existem sem Redis). Quem já está numa sala continua assistindo (mídia é LiveKit) | Restaurar o Redis. Se ele voltou sem os dados (sem AOF), as salas perdem o estado: quem está conectado segue até sair, e novas entradas exigem criar outra sala |
| LiveKit fora | `/tela` mostra "Serviço indisponível"; participantes conectados tentam reconectar 3 vezes (2s, 5s, 10s) e depois param em "Conexão perdida" com botão de tentar de novo. Readiness 503 com `livekit: down` | Reiniciar o LiveKit |
| Discord fora | Bot reconecta sozinho; falhas de sincronização reagendam com backoff até 5 min; login do site indisponível | Aguardar |
| Mercado Pago fora | Checkout responde "provedor não respondeu" e o pedido é preservado; webhooks são reentregues pelo provedor | Aguardar; o pedido expira e libera estoque se não for pago |
| FiveM/bridge fora | Pagamento aprovado fica com entrega pendente; a bridge reivindica quando voltar (lease) | Nenhuma: a entrega não duplica |

## Investigação

1. Pegue a referência `OP-…` ou o `correlationId` mostrado ao usuário ou presente no log do site (`event: "api.request"`).
2. `pm2 logs suburbio-api | findstr <correlationId>` mostra a mesma requisição na API (`requestId`, `operationId`, `status`, `durationMs`).
3. O `outcome` no log do site diz a causa interna (`invalid_hmac`, `api_timeout`, …):
   - `invalid_hmac`: secret divergente entre `.env` do site e da API, ou relógio da VPS fora de ±60s (sincronize o NTP).
   - `api_timeout`: API lenta ou travada; avalie `SUBURBIO_API_TIMEOUT_MS`.

## Pedidos em revisão

`payment_status=review` não se resolve sozinho: aprovação após expiração, pagamento duplicado, estorno ou falha ao preparar a entrega. A API emite `payment.review_required` para o bot. Resolva pelo painel do Mercado Pago e pela administração; nunca edite o banco à mão.

## Rotação de segredos

- **HMAC de um serviço:** troque na API e no serviço juntos e reinicie os dois. Durante a troca, aquele serviço recebe `invalid_hmac`.
- **`AUTH_SECRET`:** mova o valor atual para `AUTH_SECRET_PREVIOUS`, gere um novo e remova o antigo após 8h.
- **LiveKit:** troque no `livekit.yaml` e no `.env` do site e reinicie os dois. Salas ativas caem.

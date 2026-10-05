# Deploy na VPS (Windows Server 2025)

Runbook do ecossistema. Cada serviço tem seu próprio repositório, `npm ci`, `.env` e processo; este documento só descreve como eles convivem na VPS. Nenhuma credencial real aparece aqui.

## Processos e portas

| Processo | Gerenciador | Escuta | Exposição pública |
| --- | --- | --- | --- |
| PostgreSQL 18 (banco da API; versão usada nos testes) | Serviço Windows | 127.0.0.1:5432 | nenhuma |
| Redis compatível (Memurai) — API e site, prefixos distintos | Serviço Windows | 127.0.0.1:6379 | nenhuma |
| `suburbio-api` | PM2 (`api suburbio/ecosystem.config.cjs`) | 127.0.0.1:3000 | só rotas listadas abaixo, via proxy |
| `suburbio-site` | PM2 (`suburbiorp/ecosystem.config.cjs`) | 127.0.0.1:3002 | tudo, via proxy |
| `suburbio-bot` | PM2 (`suburbio bot/ecosystem.config.cjs`) | 127.0.0.1:3101 (só health, `HEALTH_PORT`) | nenhuma (conexão de saída ao Discord) |
| LiveKit server | Serviço Windows (NSSM) ou PM2 | 127.0.0.1:7880 (sinalização) | WSS via proxy; 7881/tcp e 7882/udp direto; TURN |
| Proxy HTTPS (Caddy recomendado) | Serviço Windows | 0.0.0.0:80/443 | sim |
| FiveM + bridge | Fora deste deploy (base FiveM) | — | — |

Firewall do Windows: liberar apenas 80/tcp, 443/tcp, 7881/tcp, 7882/udp, 3478/udp e 5349/tcp (TURN), além das portas do FiveM. Bloquear entrada em 3000, 3002, 3101, 5432, 6379 e 7880.

## Domínios

| Host | Destino |
| --- | --- |
| `suburbioroleplay.com` (e `www`) | Site 127.0.0.1:3002 |
| `api.suburbioroleplay.com` | API 127.0.0.1:3000, **somente** `/webhooks/mercadopago`, `/live`, `/ready`, `/health` e, se a base FiveM estiver em outra máquina, `/internal/fivem/*`. Todo o resto do `/internal/*` responde 404 no proxy |
| `tela.suburbioroleplay.com` | LiveKit 127.0.0.1:7880 (WebSocket) |
| `turn.suburbioroleplay.com` | TURN embutido do LiveKit (TLS 5349, UDP 3478) |

Site e bot falam com a API por `http://127.0.0.1:3000` (HMAC). Por isso a API não precisa expor `/internal/site` nem `/internal/discord`.

### Caddy (exemplo)

```caddy
suburbioroleplay.com, www.suburbioroleplay.com {
  encode zstd gzip
  request_body { max_size 1MB }
  reverse_proxy 127.0.0.1:3002
}
api.suburbioroleplay.com {
  request_body { max_size 64KB }
  @public path /webhooks/mercadopago /live /ready /health
  handle @public { reverse_proxy 127.0.0.1:3000 }
  # Descomente apenas se o FiveM rodar em outra máquina:
  # handle /internal/fivem/* { reverse_proxy 127.0.0.1:3000 }
  handle { respond 404 }
}
tela.suburbioroleplay.com {
  reverse_proxy 127.0.0.1:7880
}
```

O Caddy emite e renova os certificados TLS sozinho e repassa WebSocket. Ele substitui `X-Forwarded-*`. O site não usa esses headers como identidade e a API roda com `trustProxy: false`.

### LiveKit (produção)

`livekit.yaml` (o secret fica só no arquivo do servidor e no `.env` do site):

```yaml
port: 7880
bind_addresses: [127.0.0.1]
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
turn:
  enabled: true
  domain: turn.suburbioroleplay.com
  tls_port: 5349
  udp_port: 3478
  cert_file: <caminho do certificado de turn.suburbioroleplay.com>
  key_file: <caminho da chave>
keys:
  <LIVEKIT_API_KEY>: <LIVEKIT_API_SECRET com 32+ caracteres>
```

TURN e STUN são necessários para quem está atrás de NAT simétrico ou de rede corporativa: sem TURN, parte dos espectadores conecta a sinalização mas não recebe vídeo. No site, configure `LIVEKIT_INTERNAL_URL=http://127.0.0.1:7880` e `LIVEKIT_PUBLIC_URL=wss://tela.suburbioroleplay.com`.

## Ordem de inicialização

1. PostgreSQL e Redis.
2. API: `npm ci && npm run build`, depois `npm run db:status`. Com migrations pendentes, rode `npm run db:migrate` **após backup** (ver checklist). Em seguida, `pm2 start ecosystem.config.cjs`. A API recusa iniciar com migration pendente ou sem Redis.
3. Confirme `curl http://127.0.0.1:3000/ready` → 200.
4. LiveKit.
5. Site: `npm ci && npm run build && npm run verify:client`, depois `pm2 start ecosystem.config.cjs`. Confirme `curl http://127.0.0.1:3002/api/ready` → 200.
6. Bot: `npm ci && npm run build`, depois `pm2 start ecosystem.config.cjs`. Confirme `curl http://127.0.0.1:3101/ready` → 200.
7. Proxy (Caddy).
8. `pm2 save` e registre o PM2 como serviço do Windows (por exemplo `pm2-installer`), para religar após reboot.

## Restart, logs e backup

- **Restart:** `pm2 restart suburbio-api` (o mesmo vale para site e bot). Os três fazem shutdown gracioso: a API fecha workers e conexões, o site termina as requisições e o bot drena eventos e fecha o SQLite. Reiniciar a API não perde pedidos, porque o estado está no PostgreSQL e o outbox retoma pelas leases.
- **Logs:** `pm2 logs <nome>`. São JSON por linha (site e API com `timestamp`, `service`, `level`, `event` e `correlationId`). Instale `pm2-logrotate` (10 MB, 14 arquivos). Correlacione Site → API pelo `correlationId`.
- **Backup diário:**
  - API: `pg_dump -Fc suburbio_api > suburbio_api_AAAAMMDD.dump`. É o único dado crítico.
  - Bot: copie `data/runtime/runtime.sqlite` (com `-wal`/`-shm`, ou com o processo parado), `data/transcripts` e `data/scheduled-media`.
  - Arquivos `.env` de cada serviço, em cofre fora da VPS.
  - Redis: sem backup (só estado efêmero: nonces, limites, locks, salas).
  - Teste a restauração mensalmente em um banco separado.

## Rollback

1. Mantenha a pasta da versão anterior (ou a tag do git) e o seu `package-lock.json`.
2. **Site ou bot:** volte para a pasta anterior, rode `npm ci && npm run build` e depois `pm2 restart`. O site não tem banco. O SQLite do bot é migrado de forma aditiva e não pode ser apagado.
3. **API sem migration nova:** volte o código e rode `pm2 restart`.
4. **API com migration nova:** as migrations são forward-only (as de afiliados recusam `down`). Primeiro ative `API_READ_ONLY=true` (leituras continuam, escritas e webhooks param, e o Mercado Pago reenvia depois). Restaure o código anterior **somente** se ele for compatível com o schema novo. Caso contrário, restaure o `pg_dump` anterior, aceitando a perda das transações posteriores, e reconcilie os pagamentos pelo painel do Mercado Pago.
5. Desligar uma integração é sempre seguro: `SUBURBIO_API_ENABLED=false` (o site público continua no ar), `LIVEKIT_ENABLED=false` (só `/tela` sai) e `MERCADO_PAGO_ENABLED=false` (o checkout para).

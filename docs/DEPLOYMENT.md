# Deploy na VPS (Windows Server 2025)

Arquitetura do ecossistema na VPS. Cada serviço tem seu próprio repositório, `npm ci`, `.env` e processo; este documento só descreve como eles convivem. O passo a passo de instalação, update, rollback e go-live está em [WINDOWS_SERVER_DEPLOY.md](WINDOWS_SERVER_DEPLOY.md), e os scripts e exemplos ficam em [`deploy/`](../deploy). Nenhuma credencial real aparece aqui.

## Processos e portas

Pastas na VPS: `D:\SUBURBIO\suburbio-api`, `D:\SUBURBIO\suburbio-site`, `D:\SUBURBIO\suburbio-bot`.

| Processo | Gerenciador | Escuta | Exposição pública |
| --- | --- | --- | --- |
| PostgreSQL 18 (banco da API; versão usada nos testes) | Serviço Windows | 127.0.0.1:5432 | nenhuma |
| Redis compatível (Memurai) — API e site, prefixos distintos | Serviço Windows | 127.0.0.1:6379 | nenhuma |
| `suburbio-api` | PM2 (`suburbio-api/ecosystem.config.cjs`) | 127.0.0.1:3000 | só rotas listadas abaixo, via proxy |
| `suburbio-site` | PM2 (`suburbio-site/ecosystem.config.cjs`) | 127.0.0.1:3002 | tudo, via proxy |
| `suburbio-bot` | PM2 (`suburbio-bot/ecosystem.config.cjs`) | 127.0.0.1:3101 (só health, `HEALTH_PORT`) | nenhuma (conexão de saída ao Discord) |
| LiveKit server | PM2 (`livekit`, `--interpreter none`) | 127.0.0.1:7880 (sinalização) | WSS via proxy; 7881/tcp e 7882/udp direto; TURN |
| Proxy HTTPS (Caddy) | Serviço Windows | 0.0.0.0:80/443 | sim |
| FiveM + bridge | Fora deste deploy (base FiveM) | — | — |

Firewall do Windows: liberar apenas 80/tcp, 443/tcp, 7881/tcp, 7882/udp, 3478/udp e 5349/tcp (TURN), além das portas do FiveM. Bloquear a entrada em 3000, 3002, 3101, 5432, 6379 e 7880.

## Domínios

| Host | Destino |
| --- | --- |
| `suburbioroleplay.com` | Site 127.0.0.1:3002 |
| `www.suburbioroleplay.com` | Redirect 301 para o domínio raiz (`AUTH_URL` e o callback OAuth aceitam uma única origem) |
| `api.suburbioroleplay.com` | API 127.0.0.1:3000, **somente** `/webhooks/mercadopago`, `/live`, `/ready`, `/health` e, se a base FiveM estiver em outra máquina, `/internal/fivem/*`. Todo o resto de `/internal/*` responde 404 no proxy |
| `tela.suburbioroleplay.com` | LiveKit 127.0.0.1:7880 (WebSocket) |
| `turn.suburbioroleplay.com` | TURN embutido do LiveKit (TLS 5349, UDP 3478); o Caddy só emite o certificado |

Site e bot falam com a API por `http://127.0.0.1:3000` (HMAC). Por isso a API não precisa expor `/internal/site` nem `/internal/discord`, e `SUBURBIO_API_URL`/`API_BASE_URL` **não** podem apontar para a URL pública.

- Proxy: [`deploy/Caddyfile.example`](../deploy/Caddyfile.example). O Caddy emite e renova os certificados TLS sozinho, repassa WebSocket e substitui `X-Forwarded-*`. O site não usa esses headers como identidade, e a API roda com `trustProxy: false`.
- LiveKit: [`deploy/livekit.yaml.example`](../deploy/livekit.yaml.example). No site, `LIVEKIT_INTERNAL_URL=http://127.0.0.1:7880` e `LIVEKIT_PUBLIC_URL=wss://tela.suburbioroleplay.com`. O TURN é necessário para quem está atrás de NAT simétrico ou de rede corporativa: sem ele, parte dos espectadores conecta a sinalização mas não recebe vídeo.

## Ordem de inicialização

1. PostgreSQL e Redis.
2. API. A API recusa iniciar com migration pendente ou sem Redis. Migrations são sempre manuais, com backup e `MIGRATE_CONFIRM` (seção 14 do guia).
3. LiveKit.
4. Site.
5. Bot.
6. Proxy (Caddy).
7. `pm2 save` e a tarefa agendada de boot (`deploy/start-all.ps1 -Boot`), para religar após reboot.

`deploy/update-all.ps1` segue essa ordem para API → Site → Bot e só avança quando `/ready` de cada um responde 200.

## Restart, logs e backup

- **Restart:** `pm2 restart suburbio-api` (o mesmo vale para site e bot). API e bot fazem shutdown gracioso por mensagem IPC (`shutdown_with_message`, já que o Windows não entrega SIGINT): a API fecha workers e conexões, e o bot drena eventos e fecha o SQLite. O site não guarda estado. Reiniciar a API não perde pedidos, porque o estado está no PostgreSQL e o outbox retoma pelas leases.
- **Logs:** `pm2 logs <nome>`. Os arquivos ficam em `<repositório>\logs\out.log` e `error.log`. São JSON por linha (site e API com `timestamp`, `service`, `level`, `event` e `correlationId`). Use `pm2-logrotate` (10 MB, 14 arquivos). Correlacione Site → API pelo `correlationId`. Os logs dos scripts de deploy ficam em `D:\SUBURBIO\.deploy-state\logs`.
- **Backup diário:**
  - API: `pg_dump -Fc suburbio_api > suburbio_api_AAAAMMDD.dump`. É o único dado crítico.
  - Bot: copie `data/runtime/runtime.sqlite` (com `-wal`/`-shm`, ou com o processo parado), `data/transcripts` e `data/scheduled-media`.
  - Arquivos `.env` de cada serviço, em cofre fora da VPS.
  - Redis: sem backup (só estado efêmero: nonces, limites, locks, salas).
  - Teste a restauração mensalmente em um banco separado.

## Rollback

`deploy/rollback.ps1` e o procedimento completo, inclusive a API com migration nova (forward-only, `API_READ_ONLY`, restauração do dump), estão na seção 18 de [WINDOWS_SERVER_DEPLOY.md](WINDOWS_SERVER_DEPLOY.md#18-rollback).

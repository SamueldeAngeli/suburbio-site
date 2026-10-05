# Deploy no Windows Server 2025 — passo a passo

Guia operacional para colocar **API, Site e Bot** no ar numa VPS Windows Server 2025, usando PowerShell, PM2 e Caddy. A arquitetura (portas, domínios, comportamento em falha) está em [DEPLOYMENT.md](DEPLOYMENT.md) e [OPERATIONS.md](OPERATIONS.md). As variáveis estão em [ENVIRONMENT.md](ENVIRONMENT.md) (site) e em `suburbio-api/docs/ENVIRONMENT.md`. A base FiveM e o `suburbio_bridge` ficam fora deste deploy.

Todos os comandos são **PowerShell como Administrador**, salvo indicação. Nenhum secret aparece aqui: valores reais só existem nos arquivos `.env` da VPS.

## Visão geral

```text
D:\SUBURBIO\
  suburbio-api\      repositório suburbio-api   -> PM2 suburbio-api   127.0.0.1:3000
  suburbio-site\     repositório suburbio-site  -> PM2 suburbio-site  127.0.0.1:3002
  suburbio-bot\      repositório suburbio-bot   -> PM2 suburbio-bot   127.0.0.1:3101 (só health)
  caddy\             caddy.exe, Caddyfile, data\ (certificados)
  livekit\           livekit-server.exe, livekit.yaml
  backups\           pg_dump e cópias do bot
  .deploy-state\     criado pelos scripts: último commit de cada serviço, history.log, logs dos scripts
```

Scripts de deploy (ficam no repositório do site, pasta `deploy\`):

| Script | Função |
| --- | --- |
| `deploy\update-all.ps1` | Update manual: `git pull --ff-only` → `npm ci` (se dependências mudaram) → build → verificação → restart PM2 → healthcheck. Para no primeiro erro. Nunca aplica migrations |
| `deploy\start-all.ps1` | Garante os três serviços no PM2 sem pull/build. `-Boot` espera PostgreSQL/Redis e faz `pm2 resurrect` (tarefa de inicialização) |
| `deploy\healthcheck.ps1` | Confere PM2 e endpoints `health`/`ready` reais; opcionalmente os endpoints públicos via HTTPS |
| `deploy\rollback.ps1` | Volta um serviço para um commit anterior (checkout, build, restart, healthcheck) |
| `deploy\common.ps1` | Funções compartilhadas (não executar diretamente) |
| `deploy\Caddyfile.example` | Reverse proxy/HTTPS |
| `deploy\livekit.yaml.example` | Configuração do LiveKit |

Todos aceitam `-Root` (padrão: pasta-mãe do repositório do site, ou seja, `D:\SUBURBIO`) e `-Services api,site,bot`. Ajuda: `Get-Help .\update-all.ps1 -Full`.

## 1. Pré-requisitos

- Windows Server 2025 atualizado, acesso de Administrador, disco `D:`.
- DNS (registros A, e AAAA se houver IPv6) apontando para o IP público da VPS: `<domínio>`, `www`, `api`, `tela` e `turn`. Neste guia, `<domínio>` = `suburbioroleplay.com`. Troque se o domínio final for outro.
- Relógio sincronizado. O HMAC tolera só ±60 s:

  ```powershell
  w32tm /query /status
  w32tm /resync
  ```

- Fuso horário: qualquer um. Banco e APIs usam UTC, e o bot usa `America/Sao_Paulo` explicitamente.
- Crie as pastas:

  ```powershell
  New-Item -ItemType Directory -Force D:\SUBURBIO, D:\SUBURBIO\caddy, D:\SUBURBIO\livekit, D:\SUBURBIO\backups
  ```

## 2. Git

1. Instale o Git for Windows (64-bit) pelo instalador oficial, com as opções padrão. Ele inclui o Git Credential Manager.
2. Mantenha os finais de linha como estão no repositório (os três repos têm `.gitattributes`):

   ```powershell
   git config --global core.autocrlf false
   ```

3. Acesso aos repositórios privados: na primeira clonagem, o Git Credential Manager abre o login do GitHub. Prefira um **fine-grained personal access token** somente leitura (`Contents: Read`), limitado aos três repositórios. A VPS nunca precisa de permissão de push.

## 3. Node.js

Instale o **Node.js 24 LTS x64** (MSI oficial). O bot exige `>=24.20 <25`, e API e site rodam na mesma versão. Abra um PowerShell novo e confira:

```powershell
node -v   # v24.x
npm -v
```

Não defina `NODE_ENV` como variável de ambiente do sistema. Os scripts usam `npm ci --include=dev` (o build precisa de TypeScript/tsx), e o PM2 define `NODE_ENV=production` em cada processo.

## 4. PM2

O PM2 precisa ser o mesmo para você e para a tarefa de boot. Por isso o prefixo global do npm e o `PM2_HOME` ficam em pastas de máquina:

```powershell
npm config set prefix "C:\ProgramData\npm" --location=global
[Environment]::SetEnvironmentVariable('PM2_HOME', 'C:\ProgramData\pm2', 'Machine')
$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($machinePath -notlike '*C:\ProgramData\npm*') {
  [Environment]::SetEnvironmentVariable('Path', "$machinePath;C:\ProgramData\npm", 'Machine')
}
# Feche e reabra o PowerShell (Administrador) para carregar PATH e PM2_HOME.
npm install -g pm2
pm2 -v
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
```

`pm2 startup` não funciona no Windows. A volta após reboot é feita pela tarefa agendada da seção 15.

Logs de cada processo: `<repositório>\logs\out.log` e `error.log` (configurado em cada `ecosystem.config.cjs`, ignorado pelo Git). Para ler: `pm2 logs suburbio-api --lines 200`. Os logs são JSON UTF-8. No PowerShell 5.1, use `Get-Content -Encoding UTF8`.

## 5. Clonagem dos 3 repositórios

```powershell
git clone https://github.com/SamueldeAngeli/suburbio-api.git  D:\SUBURBIO\suburbio-api
git clone https://github.com/SamueldeAngeli/suburbio-site.git D:\SUBURBIO\suburbio-site
git clone https://github.com/SamueldeAngeli/suburbio-bot.git  D:\SUBURBIO\suburbio-bot
```

Os scripts esperam exatamente esses nomes de pasta. Não edite arquivos versionados na VPS: o update recusa rodar com alterações locais.

## 6. Criação dos .env

| Serviço | Arquivo na VPS | Modelo |
| --- | --- | --- |
| API | `D:\SUBURBIO\suburbio-api\.env` | `.env.example` do repo |
| Site | `D:\SUBURBIO\suburbio-site\.env.production.local` | `.env.example` do repo |
| Bot | `D:\SUBURBIO\suburbio-bot\.env` | `.env.example` do repo |

```powershell
Copy-Item D:\SUBURBIO\suburbio-api\.env.example  D:\SUBURBIO\suburbio-api\.env
Copy-Item D:\SUBURBIO\suburbio-site\.env.example D:\SUBURBIO\suburbio-site\.env.production.local
Copy-Item D:\SUBURBIO\suburbio-bot\.env.example  D:\SUBURBIO\suburbio-bot\.env
```

Gere cada secret separadamente (nunca reutilize valores de desenvolvimento):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### API (`suburbio-api\.env`)

| Variável | Produção |
| --- | --- |
| `NODE_ENV` | `production`. **Obrigatório também no arquivo**: `npm run db:migrate` lê o `.env`, e a proteção `MIGRATE_CONFIRM` só vale em production |
| `HOST` / `PORT` | `127.0.0.1` / `3000` |
| `POSTGRES_HOST/PORT/DATABASE/USER/PASSWORD` | `127.0.0.1` / `5432` / `suburbio_api` / `suburbio_api` / senha da seção 14. **Não existe `DATABASE_URL`** |
| `POSTGRES_SSL` | `false` (mesmo host) |
| `REDIS_URL` / `REDIS_KEY_PREFIX` | `redis://127.0.0.1:6379` (com senha: `redis://:SENHA@127.0.0.1:6379`) / `suburbio-api:` |
| `DISCORD_BOT_SERVICE_SECRET`, `FIVEM_BRIDGE_SERVICE_SECRET`, `SITE_SERVICE_SECRET`, `ALLOWLIST_TOKEN_SECRET` | 4 valores novos, ≥ 32 caracteres, **todos diferentes** (a API recusa iniciar com repetição) |
| `DISCORD_GUILD_ID` | servidor principal (padrão já preenchido) |
| `CORS_ORIGINS` / `OPENAPI_ENABLED` / `API_READ_ONLY` | vazio / `false` / `false` |
| `MERCADO_PAGO_*` | `ENABLED=false` até homologar. Depois: token e webhook secret do painel, `COLLECTOR_ID`, `RETURN_URL=https://<domínio>/minha-conta/pedidos`, `NOTIFICATION_URL=https://api.<domínio>/webhooks/mercadopago`, `LIVE_MODE=false` (sandbox) e, ao fim da homologação, `true` |
| `QBCORE_MYSQL_*` | só se a API for ler a base QBCore: usuário somente leitura, nunca root |
| `BOOTSTRAP_OWNER_ENABLED` / `_DISCORD_ID` | `true` + seu Discord ID **somente no primeiro start**; depois `false` |

### Site (`suburbio-site\.env.production.local`)

| Variável | Produção |
| --- | --- |
| `AUTH_ENABLED` | `true` |
| `AUTH_URL` | `https://<domínio>` (sem barra final, sem `www`) |
| `AUTH_SECRET` | novo, ≥ 32 |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | aplicação OAuth do Discord |
| `DISCORD_REDIRECT_URI` | `https://<domínio>/api/auth/callback/discord`, cadastrado no Developer Portal → OAuth2 → Redirects |
| `DISCORD_ROLE_AUTH_ENABLED` | `true` após validar o contrato de cargos na API |
| `SUBURBIO_API_ENABLED` | `true` |
| `SUBURBIO_API_URL` | `http://127.0.0.1:3000`. **Não use a URL pública**: o Caddy bloqueia `/internal/*` |
| `SITE_SERVICE_ID` / `SITE_SERVICE_SECRET` | `site` / **igual** a `SITE_SERVICE_SECRET` da API |
| `LIVEKIT_ENABLED` | `true` se `/tela` for publicado |
| `LIVEKIT_INTERNAL_URL` / `LIVEKIT_PUBLIC_URL` | `http://127.0.0.1:7880` / `wss://tela.<domínio>` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | mesmo par do `livekit.yaml` (secret ≥ 32) |
| `REDIS_URL` / `REDIS_KEY_PREFIX` | `redis://127.0.0.1:6379` (recomendado) / `suburbio:site:` |

### Bot (`suburbio-bot\.env`)

| Variável | Produção |
| --- | --- |
| `DISCORD_TOKEN` | token do bot (Developer Portal → Bot) |
| `DISCORD_CLIENT_ID` | já preenchido |
| `NODE_ENV` | `production` |
| `API_ENABLED` | `true` |
| `API_BASE_URL` | `http://127.0.0.1:3000` (HTTP só é aceito em loopback) |
| `API_SERVICE_ID` / `API_SERVICE_SECRET` | `discord-bot` / **igual** a `DISCORD_BOT_SERVICE_SECRET` da API |
| `TICKET_STORAGE_MODE` / `SCHEDULER_STORAGE_MODE` | `local` / `local` até migrar; depois `api` / `api` (seção 14, "Tickets e scheduler: SQLite → API") |
| `ROLE_AUTOMATION_SAFE_MODE` | `true` no primeiro start; `false` só depois de homologar allowlist/cargos |
| `HEALTH_PORT` | `3101` (o healthcheck depende disso) |
| `SITE_URL`, `FIVEM_CONNECT_URL`, `SUPPORT_CHANNEL_URL` | links do painel (HTTPS ou `fivem://connect/...`) |

### Proteger os arquivos

Permita leitura só para Administradores e para a conta que roda o PM2:

```powershell
foreach ($f in 'D:\SUBURBIO\suburbio-api\.env','D:\SUBURBIO\suburbio-site\.env.production.local','D:\SUBURBIO\suburbio-bot\.env') {
  icacls $f /inheritance:r /grant:r "Administrators:F" "SYSTEM:F" "${env:USERNAME}:R"
}
```

Guarde uma cópia dos três `.env` num cofre fora da VPS. Eles nunca vão para o Git: os três `.gitignore` já ignoram `.env*`.

## 7. npm ci

Os scripts já fazem a instalação. Para fazer à mão, em cada repositório:

```powershell
npm ci --include=dev --no-audit --no-fund
```

Use sempre `npm ci`, que respeita o `package-lock.json`, e nunca `npm install` na VPS.

## 8. Build

| Serviço | Build | Artefato |
| --- | --- | --- |
| API | `npm run build` | `dist\index.js` |
| Site | `npm run build` e depois `npm run verify:client` (falha se algum secret vazar para o bundle) | `.next\` |
| Bot | `npm run build` | `dist\index.js` |

## 9. PM2

Cada repositório tem seu `ecosystem.config.cjs`, com `cwd` = pasta do repositório (o SQLite do bot, `data\runtime\runtime.sqlite`, é relativo a ela), `NODE_ENV=production`, autorestart e logs em `logs\`. API e bot usam `shutdown_with_message`: no Windows o PM2 não consegue enviar SIGINT, então o desligamento gracioso chega por mensagem IPC. O site (`next start`) não guarda estado e é encerrado diretamente.

| App PM2 | Script | Escuta |
| --- | --- | --- |
| `suburbio-api` | `dist/index.js` | `HOST:PORT` do `.env` (127.0.0.1:3000) |
| `suburbio-site` | `next start --hostname 127.0.0.1 --port 3002` | 127.0.0.1:3002 |
| `suburbio-bot` | `dist/index.js` | 127.0.0.1:`HEALTH_PORT` (só health) |

### Portas (nunca repetir)

| Porta | Dono | Onde se define |
| --- | --- | --- |
| 3000 | API | `PORT` em `suburbio-api\.env` |
| 3002 | Site | fixa em `suburbio-site\ecosystem.config.cjs` (`--port 3002` vence `PORT`) |
| 3101 | Bot (só health) | `HEALTH_PORT` em `suburbio-bot\.env` |
| 80, 443 | Caddy | — |
| 5432 / 6379 | PostgreSQL / Redis | — |
| 7880, 7881, 7882, 3478, 5349 | LiveKit | `livekit.yaml` |

`update-all.ps1` e `start-all.ps1` recusam continuar se API, site e bot repetirem uma porta ou usarem uma porta reservada da tabela, e informam o PID quando outro programa ocupa a porta de um serviço. **Não defina `PORT`, `HOST` ou `HEALTH_PORT` como variável de ambiente do Windows**: o PM2 repassa o ambiente ao processo, e o `dotenv` não sobrescreve variáveis existentes, então o valor do `.env` seria ignorado. Os scripts removem essas variáveis da própria sessão antes de iniciar, mas um `pm2 start` manual não faz isso.

Comandos úteis: `pm2 ls`, `pm2 logs <app>`, `pm2 restart <app>`, `pm2 stop <app>`, `pm2 save`.

O bot tem também `scripts\start-windows.ps1` (execução direta, sem PM2). **Não rode os dois ao mesmo tempo**: seriam duas instâncias consumindo a mesma outbox.

## 10. Caddy

1. Baixe o `caddy_windows_amd64.exe` oficial (caddyserver.com/download ou GitHub releases) para `D:\SUBURBIO\caddy\caddy.exe`.
2. Gere o Caddyfile a partir do exemplo, trocando o domínio (UTF-8 sem BOM):

   ```powershell
   $domain = 'suburbioroleplay.com'
   $text = [IO.File]::ReadAllText('D:\SUBURBIO\suburbio-site\deploy\Caddyfile.example') -replace '\{\$SUBURBIO_DOMAIN\}', $domain
   [IO.File]::WriteAllText('D:\SUBURBIO\caddy\Caddyfile', $text, (New-Object Text.UTF8Encoding($false)))
   D:\SUBURBIO\caddy\caddy.exe validate --config D:\SUBURBIO\caddy\Caddyfile
   ```

3. Registre o Caddy como serviço do Windows (ele tem suporte nativo):

   ```powershell
   sc.exe create caddy start= auto binPath= "D:\SUBURBIO\caddy\caddy.exe run --config D:\SUBURBIO\caddy\Caddyfile"
   sc.exe failure caddy reset= 86400 actions= restart/5000/restart/5000/restart/5000
   Start-Service caddy
   ```

4. Depois de editar o Caddyfile: `caddy.exe validate ...` e em seguida `Restart-Service caddy`.

O que o exemplo publica:

| Host | Destino |
| --- | --- |
| `<domínio>` | Site 127.0.0.1:3002 |
| `www.<domínio>` | redirect 301 para `<domínio>` (o OAuth só aceita a origem de `AUTH_URL`) |
| `api.<domínio>` | **somente** `/webhooks/mercadopago`, `/live`, `/ready` e `/health`. Todo o resto, inclusive `/internal/*`, responde 404 |
| `tela.<domínio>` | LiveKit 127.0.0.1:7880 (WebSocket) |
| `turn.<domínio>` | só emite e renova o certificado usado pelo TURN do LiveKit |

## 11. HTTPS

O Caddy emite e renova os certificados (Let's Encrypt, com ZeroSSL de reserva) assim que os DNS apontam para a VPS e as portas 80/443 estão abertas. Os certificados ficam em `D:\SUBURBIO\caddy\data` (`storage` fixo no Caddyfile). Confira com:

```powershell
curl.exe -sI https://suburbioroleplay.com/api/health
curl.exe -s https://api.suburbioroleplay.com/live
curl.exe -s -o NUL -w "%{http_code}" https://api.suburbioroleplay.com/internal/health   # esperado: 404
```

O site exige HTTPS em produção (`AUTH_URL`), e o LiveKit exige `wss://`. Sem certificado válido, o login e o `/tela` não funcionam.

## 12. Redis

| Serviço | Uso | Obrigatório? | Se o Redis cair |
| --- | --- | --- | --- |
| API | nonce anti-replay do HMAC, rate limit e locks (`suburbio-api:`) | **Sim** | Não inicia sem Redis. Já em execução: `/ready` → 503 e todas as chamadas internas (site, bot, bridge) são recusadas, sem fallback permissivo |
| Site | rate limit, locks e salas de `/tela` (`suburbio:site:`) | Não (recomendado) | `/api/ready` continua 200 com `redis: down`. O rate limit passa para a memória do processo e o `/tela` fica indisponível. Sem `REDIS_URL`, opera em modo instância única |
| Bot | não usa | — | Indireto: as chamadas à API falham e a outbox pausa (os eventos ficam guardados na API) |

No Windows, use um servidor compatível com Redis que suporte **Lua (`EVAL`)**, usado por API e site. Recomendação: **Memurai**, como serviço Windows. Confira a licença: a edição Developer não serve para produção. Configuração mínima (`memurai.conf`):

```text
bind 127.0.0.1
port 6379
appendonly yes
maxmemory-policy noeviction
# requirepass <senha>   -> então REDIS_URL=redis://:<senha>@127.0.0.1:6379 na API e no site
```

`appendonly` e `noeviction` são exigidos pela API para preservar nonces. Se o estado do Redis for perdido, mantenha o tráfego interno parado por pelo menos 121 s antes de liberar (README da API). Redis não tem backup: guarda só estado efêmero.

## 13. LiveKit

Necessário só para `/tela` (compartilhamento de tela). Com `LIVEKIT_ENABLED=false`, o resto do site funciona normalmente.

1. Baixe o binário Windows do `livekit-server` (GitHub `livekit/livekit`, releases, `windows_amd64`) para `D:\SUBURBIO\livekit\`.
2. Crie a configuração a partir do exemplo, troque `<domínio>` e gere o par key/secret (secret ≥ 32):

   ```powershell
   Copy-Item D:\SUBURBIO\suburbio-site\deploy\livekit.yaml.example D:\SUBURBIO\livekit\livekit.yaml
   notepad D:\SUBURBIO\livekit\livekit.yaml
   ```

3. Suba o Caddy primeiro (seção 10), para o certificado de `turn.<domínio>` existir.
4. Rode pelo PM2:

   ```powershell
   pm2 start D:\SUBURBIO\livekit\livekit-server.exe --name livekit --interpreter none --cwd D:\SUBURBIO\livekit -- --config D:\SUBURBIO\livekit\livekit.yaml
   pm2 save
   ```

| Item | Valor |
| --- | --- |
| `LIVEKIT_INTERNAL_URL` (site) | `http://127.0.0.1:7880`: o SDK do servidor fala direto com o LiveKit, sem passar pelo proxy |
| `LIVEKIT_PUBLIC_URL` (site) | `wss://tela.<domínio>`: único endereço entregue ao navegador (WSS público é obrigatório em produção) |
| 7880/tcp | sinalização, **somente loopback** (o Caddy publica como `tela.<domínio>`) |
| 7881/tcp | WebRTC via TCP, aberto na internet |
| 7882/udp | WebRTC via UDP (mux), aberto na internet |
| 3478/udp | TURN/UDP, aberto na internet |
| 5349/tcp | TURN/TLS, aberto na internet (certificado de `turn.<domínio>`) |
| DNS | `tela.<domínio>` e `turn.<domínio>` → IP da VPS |

O TURN é necessário para quem está atrás de NAT simétrico ou de rede corporativa: sem ele, essas pessoas conectam a sinalização mas não recebem vídeo. O certificado do TURN é lido do storage do Caddy. **Reinicie o LiveKit depois de cada renovação** (`pm2 restart livekit`, mais ou menos a cada 60 dias) ou agende o restart mensal.

### Firewall do Windows (todas as regras)

```powershell
New-NetFirewallRule -DisplayName 'Suburbio HTTP/HTTPS' -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow
New-NetFirewallRule -DisplayName 'LiveKit RTC TCP'     -Direction Inbound -Protocol TCP -LocalPort 7881 -Action Allow
New-NetFirewallRule -DisplayName 'LiveKit RTC UDP'     -Direction Inbound -Protocol UDP -LocalPort 7882 -Action Allow
New-NetFirewallRule -DisplayName 'LiveKit TURN UDP'    -Direction Inbound -Protocol UDP -LocalPort 3478 -Action Allow
New-NetFirewallRule -DisplayName 'LiveKit TURN TLS'    -Direction Inbound -Protocol TCP -LocalPort 5349 -Action Allow
```

Não abra 3000, 3002, 3101, 5432, 6379 nem 7880: todos escutam só em 127.0.0.1. As portas do FiveM (por exemplo 30120 tcp/udp) pertencem ao deploy da base, não a este. Se o provedor da VPS tiver firewall externo, libere as mesmas portas lá também.

## 14. Banco e migrations

### PostgreSQL

Instale o **PostgreSQL 18** (instalador oficial para Windows, como serviço). Em `postgresql.conf`, use `listen_addresses = 'localhost'`. Crie o usuário e o banco (não superuser):

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -c "CREATE ROLE suburbio_api LOGIN PASSWORD '<senha forte>';"
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -c "CREATE DATABASE suburbio_api OWNER suburbio_api;"
```

### Migrations

- Existentes: `001_foundation` a `014_discord_storage`, em `suburbio-api\src\database\migrations`. São forward-only: as de afiliados e a `014` recusam `down`.
- Pendentes: num banco novo, todas as 14. Num banco já existente, confira. As `012_affiliates`, `013_gifts` e `014_discord_storage` só foram validadas em bancos de teste isolados. A `014` só cria tabelas novas (tickets e mensagens agendadas do bot).
- A API **recusa iniciar** com migration pendente. Os scripts de update e start verificam isso (`npm run db:check`, somente leitura) e abortam **sem parar a API**.
- Nada aplica migration automaticamente. Em produção, `db:migrate` só roda com `MIGRATE_CONFIRM=<POSTGRES_DATABASE>`, e só em `NODE_ENV=production` no `.env` (é por isso que essa linha é obrigatória).

| Comando (em `suburbio-api`) | Efeito |
| --- | --- |
| `npm run db:status` | tabela com todas as migrations e a data de execução |
| `npm run db:check` | lista as pendentes; exit 3 se houver alguma (usado pelos scripts) |
| `npm run db:migrate` | aplica as pendentes (exige `MIGRATE_CONFIRM` em produção) |

Ordem recomendada (exige `npm ci` já feito na API, porque usa `tsx`):

```powershell
cd D:\SUBURBIO\suburbio-api
npm run db:status                                   # 1. conferir banco alvo (host/db) e pendências
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -U suburbio_api -h 127.0.0.1 -Fc -f "D:\SUBURBIO\backups\suburbio_api_$(Get-Date -Format yyyyMMdd_HHmm).dump" suburbio_api   # 2. backup
pm2 stop suburbio-api                               # 3. parar a API (se já estiver rodando)
$env:MIGRATE_CONFIRM = 'suburbio_api'; npm run db:migrate; Remove-Item Env:\MIGRATE_CONFIRM   # 4. migrar
D:\SUBURBIO\suburbio-site\deploy\update-all.ps1 -Services api   # 5. build/restart/health
```

Em banco novo e vazio, o backup do passo 2 é opcional. Em qualquer banco com dados, ele é **obrigatório**.

### Tickets e scheduler: SQLite → API

Uma única vez, depois que a API estiver com a `014_discord_storage` aplicada e respondendo `/ready`. Nada migra sozinho no boot. A ferramenta lê o SQLite do bot **somente leitura**, nunca o altera nem apaga, e por padrão só simula.

```powershell
pm2 stop suburbio-bot                                   # 1. parar o bot (o --apply recusa com o bot respondendo)
$stamp = Get-Date -Format yyyyMMdd_HHmm                 # 2. backups
Copy-Item D:\SUBURBIO\suburbio-bot\data\runtime "D:\SUBURBIO\backups\bot-runtime_$stamp" -Recurse
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -U suburbio_api -h 127.0.0.1 -Fc -f "D:\SUBURBIO\backups\suburbio_api_$stamp.dump" suburbio_api
cd D:\SUBURBIO\suburbio-bot
npm run storage:migrate                                 # 3. dry-run: resumo local + simulação na API
npm run storage:migrate -- --apply                      # 4. importa e confere registro a registro
npm run storage:migrate -- --apply                      # 5. (opcional) repetir: tudo "unchanged"
notepad .env                                            # 6. TICKET_STORAGE_MODE=api e SCHEDULER_STORAGE_MODE=api
pm2 restart suburbio-bot                                # 7. subir já no modo api
D:\SUBURBIO\suburbio-site\deploy\healthcheck.ps1 -Services bot
```

- O dry-run mostra o resumo local (tickets por estado, `sequence.ticket`, mensagens por status) e a simulação na API: antes e depois, criados, já existentes e conflitos.
- Qualquer inconsistência ou conflito encerra com código 1, sem gravar nada. Exemplos: o mesmo ID com conteúdo diferente na API, dois tickets ativos do mesmo usuário, sequência menor que o maior ID, mensagem presa em `sending`.
- O `--apply` termina com "Conferência OK" quando cada ticket e mensagem está idêntico na API.
- **Rollback:** voltar os dois seletores para `local` e rodar `pm2 restart suburbio-bot`. O SQLite continua intacto, mas não terá o que foi criado no modo api. As tabelas da API ficam como estão.

## 15. Primeiro start

Com PostgreSQL, Redis e os três `.env` prontos:

```powershell
# 1. API: instalar e migrar (primeira vez)
cd D:\SUBURBIO\suburbio-api
npm ci --include=dev --no-audit --no-fund
$env:MIGRATE_CONFIRM = 'suburbio_api'; npm run db:migrate; Remove-Item Env:\MIGRATE_CONFIRM

# 2. Bot: registrar slash commands (uma vez, e de novo quando os comandos mudarem)
cd D:\SUBURBIO\suburbio-bot
npm ci --include=dev --no-audit --no-fund
npm run deploy:commands

# 3. Instalar, buildar e subir os três (API -> Site -> Bot), com healthcheck
D:\SUBURBIO\suburbio-site\deploy\update-all.ps1
```

Depois do primeiro start com `BOOTSTRAP_OWNER_ENABLED=true`, mude para `false` no `.env` da API e rode `pm2 restart suburbio-api`.

### Voltar após reboot

Crie uma tarefa agendada que roda `start-all.ps1 -Boot` na inicialização, **com a mesma conta** usada para o PM2. O Windows vai pedir a senha dessa conta:

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "D:\SUBURBIO\suburbio-site\deploy\start-all.ps1" -Boot' -WorkingDirectory 'D:\SUBURBIO'
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName 'Suburbio PM2' -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -User "$env:COMPUTERNAME\$env:USERNAME" -Password (Read-Host 'Senha da conta')
```

`-Boot` espera o PostgreSQL e o Redis abrirem as portas, faz `pm2 resurrect` (restaura tudo o que foi salvo com `pm2 save`, inclusive o LiveKit) e garante que os três serviços estejam online. Teste reiniciando a VPS uma vez antes do go-live.

## 16. Healthchecks

| Serviço | Liveness | Readiness |
| --- | --- | --- |
| API | `GET http://127.0.0.1:3000/live` | `GET http://127.0.0.1:3000/ready` (= `/health`): PostgreSQL e Redis; 503 se algum cair |
| Site | `GET http://127.0.0.1:3002/api/health` | `GET http://127.0.0.1:3002/api/ready`: env válida e API respondendo; Redis fora não derruba |
| Bot | `GET http://127.0.0.1:3101/health` | `GET http://127.0.0.1:3101/ready`: gateway do Discord e SQLite |

```powershell
D:\SUBURBIO\suburbio-site\deploy\healthcheck.ps1
D:\SUBURBIO\suburbio-site\deploy\healthcheck.ps1 -PublicSiteUrl https://suburbioroleplay.com -PublicApiUrl https://api.suburbioroleplay.com
```

A verificação pública também confirma que `/internal/*` responde 404 pelo proxy. O script sai com código 1 se qualquer check falhar.

## 17. Update manual

```powershell
D:\SUBURBIO\suburbio-site\deploy\update-all.ps1                 # os três
D:\SUBURBIO\suburbio-site\deploy\update-all.ps1 -Services site  # só um
```

Para cada serviço, o script:

1. Recusa rodar com alterações locais em arquivos versionados ou em HEAD destacado.
2. Roda `git pull --ff-only` e para se falhar.
3. Pula o serviço se o commit já estiver no ar e o processo online (`-Force` refaz).
4. API: verifica migrations pendentes **antes de parar qualquer coisa** e aborta com instruções se houver.
5. Para o processo só quando é preciso trocar arquivos travados pelo Windows: dependências mudaram, ou é o site (o `next build` recria `.next`).
6. Roda `npm ci --include=dev` só se `package.json`/`package-lock.json` mudaram (`-ForceInstall` força), depois `npm run build` (e `verify:client` no site). Para em qualquer erro.
7. Reinicia no PM2 **somente após build bem-sucedido** e espera `health`/`ready` ficarem 200.
8. Registra o commit em `D:\SUBURBIO\.deploy-state\` (`history.log`), roda `pm2 save` e faz o healthcheck final.

Logs de cada execução: `D:\SUBURBIO\.deploy-state\logs\update-*.log`. Duas execuções simultâneas são bloqueadas.

Downtime esperado: API e bot só durante o restart (segundos), a menos que as dependências mudem. O site fica fora durante o build (1–3 min), então atualize em horário de pouco movimento.

Se algum `ecosystem.config.cjs` mudar, o script já aplica a mudança: ele sempre recria o processo a partir do arquivo.

## 18. Rollback

```powershell
D:\SUBURBIO\suburbio-site\deploy\rollback.ps1 -Service site                 # volta ao commit anterior do history.log
D:\SUBURBIO\suburbio-site\deploy\rollback.ps1 -Service bot -Commit 0f9e569  # commit específico
```

O repositório fica em HEAD destacado, e o `update-all` se recusa a atualizá-lo até você rodar `git -C D:\SUBURBIO\suburbio-<serviço> switch main`.

- **Site ou bot:** rollback direto. O site não tem banco. O SQLite do bot é migrado de forma aditiva: não apague `data\`.
- **API sem migration nova:** rollback direto.
- **API com migration nova:** as migrations são forward-only. O `rollback.ps1` falha na verificação de migrations e não reinicia nada. Siga esta ordem:
  1. `API_READ_ONLY=true` no `.env` da API e `pm2 restart suburbio-api`. As leituras continuam; escritas e webhooks param, e o Mercado Pago reenvia depois.
  2. Se o código anterior for compatível com o schema novo, faça o rollback do código.
  3. Se não for, restaure o `pg_dump` anterior (`pg_restore --clean -d suburbio_api <arquivo>`), aceitando perder as transações posteriores, e reconcilie os pagamentos pelo painel do Mercado Pago.
- Desligar uma integração é sempre seguro: `SUBURBIO_API_ENABLED=false` (o site público continua), `LIVEKIT_ENABLED=false` (só o `/tela` sai), `MERCADO_PAGO_ENABLED=false` (o checkout para) e `API_ENABLED=false` no bot. Depois, `pm2 restart <app>`.

## 19. Troubleshooting

| Sintoma | Causa provável / ação |
| --- | --- |
| `pm2` não encontrado na tarefa de boot | PATH/`PM2_HOME` de máquina não aplicados ou conta diferente. Refaça a seção 4 e reabra a sessão |
| Script bloqueado pela execution policy | Rode com `powershell -ExecutionPolicy Bypass -File ...`, ou `Set-ExecutionPolicy RemoteSigned` |
| "Conflito de porta" / "porta ocupada por ..." / `EADDRINUSE` | Duas configurações com a mesma porta, ou outro programa (IIS, instância antiga fora do PM2) na porta. Veja a tabela da seção 9 e `Get-NetTCPConnection -State Listen -LocalPort <porta>` |
| `EPERM`/`EBUSY` no `npm ci` ou no build | Arquivo travado por um processo em execução. `pm2 stop <app>` e rode o update de novo (o script já para quando detecta mudança de dependências) |
| API não inicia: "Falha ao iniciar API" | `.env` inválido (o log cita o nome da variável), migration pendente (`npm run db:check`), PostgreSQL ou Redis fora |
| Update aborta com "migrations pendentes" | Seção 14: backup, migrate com `MIGRATE_CONFIRM`, rodar o update de novo |
| `db:migrate` não pede confirmação | `NODE_ENV` não está `production` no `.env` da API. Corrija antes de continuar |
| Site `/api/ready` 503, `config: invalid` | Env do site inválida: veja `logs\error.log` (cita a variável). Erros comuns: `AUTH_URL` sem HTTPS, `DISCORD_REDIRECT_URI` diferente de `AUTH_URL` + callback, `LIVEKIT_PUBLIC_URL` sem `wss://` |
| Site `/api/ready` 503, `api: down` | API fora, ou `SUBURBIO_API_URL` apontando para a URL pública (use `http://127.0.0.1:3000`) |
| `invalid_hmac` nos logs | Secret diferente entre os serviços, ou relógio fora de ±60 s (`w32tm /resync`) |
| Login Discord falha com `redirect_uri` | Callback não cadastrado no Developer Portal, ou acesso por `www` (o Caddy redireciona para a origem canônica) |
| Bot `/ready` 503 | Token inválido, intents privilegiadas desligadas no Portal, ou sem rede de saída para o Discord |
| Healthcheck do bot pulado | `HEALTH_PORT=0` no `.env` do bot. Use `3101` |
| `/tela` conecta, mas sem vídeo | Portas 7881/7882/3478/5349 fechadas (no Windows ou no provedor), DNS `turn.` ausente, ou certificado TURN expirado (`pm2 restart livekit`) |
| Certificado não emitido | DNS ainda não propagou, porta 80/443 fechada, ou outro serviço (IIS) usando a 80/443 |
| Acentos quebrados nos logs | Leia com `Get-Content -Encoding UTF8` (veja `suburbio-bot\docs\WINDOWS_ENCODING.md`) |

## 20. Checklist de go-live

- [ ] DNS de `<domínio>`, `www`, `api`, `tela` e `turn` resolvendo para a VPS.
- [ ] NTP sincronizado (`w32tm /query /status`).
- [ ] Node 24, Git, PM2 (`PM2_HOME` de máquina) e `pm2-logrotate` instalados.
- [ ] PostgreSQL 18 só em localhost, usuário dedicado sem superuser.
- [ ] Redis compatível (Memurai) com AOF, `noeviction`, em 127.0.0.1, e licença adequada para produção.
- [ ] Três `.env` criados com secrets **novos**, ACL restrita e cópia em cofre externo. API com `NODE_ENV=production`.
- [ ] Secrets HMAC: os 4 da API são diferentes entre si. O do site é igual a `SITE_SERVICE_SECRET` da API, e o do bot é igual a `DISCORD_BOT_SERVICE_SECRET`.
- [ ] Backup feito e migrations aplicadas (`npm run db:check` → nenhuma pendente).
- [ ] `update-all.ps1` concluído sem erro; `healthcheck.ps1` local e público passando (`/internal/*` = 404).
- [ ] OAuth: redirect `https://<domínio>/api/auth/callback/discord` cadastrado; login real testado.
- [ ] `BOOTSTRAP_OWNER_ENABLED` voltou para `false` depois do primeiro boot.
- [ ] Bot: comandos registrados, `API_ENABLED=true`, `HEALTH_PORT=3101`. `ROLE_AUTOMATION_SAFE_MODE=false` só após homologar cargos.
- [ ] Mercado Pago homologado em sandbox (checkout → webhook → entrega → reembolso) antes de `MERCADO_PAGO_LIVE_MODE=true`.
- [ ] LiveKit: `/tela` testado de fora da rede da VPS (inclusive 4G, para validar TURN).
- [ ] Firewall: só 80, 443, 7881/tcp, 7882/udp, 3478/udp e 5349/tcp abertos (mais as portas do FiveM, no deploy dele).
- [ ] Tarefa agendada de boot criada e **testada com um reboot**.
- [ ] Backup diário agendado: `pg_dump` da API e cópia de `suburbio-bot\data\` (runtime, transcripts, scheduled-media). Uma restauração testada.
- [ ] `pm2 save` executado com a lista final (API, site, bot e LiveKit).

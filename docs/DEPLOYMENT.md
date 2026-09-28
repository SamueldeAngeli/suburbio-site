# Windows Server 2025

## Processo

O projeto mantém Next.js 16.3.5/React existentes. Foi removido `output: 'export'`: autenticação, Server Components dinâmicos e BFF precisam de Node.js. Não servir o antigo diretório `out/` como se fosse esta versão. Não houve deploy nem alteração de serviço nesta sessão.

1. Instalar Node compatível com o lockfile (ambiente de implementação: Node 24).
2. Na pasta do site: `npm ci`; copiar `.env.example` para `.env.local` e preencher somente as integrações disponíveis.
3. Executar `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:client`.
4. Iniciar com `npm run start -- --hostname 127.0.0.1 --port <PORTA_DO_SITE>` sob um serviço Windows apropriado, com conta de privilégio mínimo. A porta deve ser distinta da API. Não incluir secrets na linha de comando.
5. Configurar proxy HTTPS para a porta interna e firewall bloqueando acesso externo direto ao Node/API. Não confiar em headers de encaminhamento vindos da Internet; proxy deve substituí-los. Configurar Host externo igual ao domínio permitido e limites de request/body/conexão no proxy.

## Variáveis do site

| Variável | Quando necessária | Uso |
| --- | --- | --- |
| AUTH_ENABLED | Sempre, padrão false | Liga autenticação; quando true valida todo o grupo no boot |
| AUTH_URL | Auth ligada | Origem exata do site, HTTPS em produção |
| AUTH_SECRET | Auth ligada | Segredo aleatório forte, mínimo 32 caracteres, ideal 32 bytes aleatórios |
| AUTH_SECRET_PREVIOUS | Opcional | Rotação temporária da chave de sessão |
| DISCORD_CLIENT_ID | Auth ligada | Aplicação oficial registrada no Discord |
| DISCORD_CLIENT_SECRET | Auth ligada | Somente servidor |
| DISCORD_REDIRECT_URI | Auth ligada | `AUTH_URL` + `/api/auth/callback/discord`, exato no Developer Portal |
| SUBURBIO_API_ENABLED | Sempre, padrão false | Liga comunicação server-side com API |
| SUBURBIO_API_URL | API ligada | Origem fixa da API, sem path/query/credencial |
| SITE_SERVICE_ID | API ligada, padrão site | Mesmo cadastro da API |
| SITE_SERVICE_SECRET | API ligada | Mesmo segredo HMAC configurado na API, mínimo 32 caracteres |
| API_TIMEOUT_MS | Opcional, 5000 | Timeout de 500–30000 ms |

`PORT` pode ser fornecida pelo serviço antes de iniciar o Next.js; não depender de `.env.local` para escolher porta de boot. Os localhost/portas de `.env.example` são apenas exemplos de desenvolvimento, não destinos hardcoded de produção. A API pode usar loopback HTTP quando no mesmo host; transporte remoto exige HTTPS. Não definir NEXT_PUBLIC_ para qualquer segredo. Não reutilizar AUTH_SECRET como SITE_SERVICE_SECRET.

## HTTPS e OAuth

Em produção AUTH_URL precisa ser HTTPS e cookies são Secure. Não desabilitar isso para tentar rodar login por IP HTTP. Scope somente identify. State validado pela Auth.js. Credenciais não foram fornecidas, então OAuth real não foi homologado. Auth.js 5 ainda é beta, fixada em beta.32 conforme documentação oficial; atualizar apenas com regressão e revisão deliberadas.

Sessão JWT criptografada: 1h, renovável pelo fluxo da biblioteca até limite absoluto de 8h. Chave nova em AUTH_SECRET, antiga temporariamente em AUTH_SECRET_PREVIOUS. Remover a antiga após a janela de expiração. Logout elimina cookie do navegador, mas não revoga cópias previamente roubadas até expiração; acesso administrativo exige nova decisão da API a cada request.

## Segurança operacional

Rate limit local é um backstop por processo: 30 inícios OAuth/min, 60 callbacks/min, 240 chamadas Auth/min, 90 chamadas admin/min por Discord, 10 revogações/min por Discord. Para várias instâncias, aplicar limites na borda/API; não adicionar Redis direto ao site. Não habilitar limites por X-Forwarded-For sem cadeia de proxy confiável.

Autorizações da API precisam estar prontas antes de ativar administração. Não criar credencial de teste, cookie de bypass ou rota demo administrativa na VPS. Health retorna estados exatos; `unmonitored` não significa online. API_READ_ONLY impede mutações, com mensagem clara e leitura preservada quando possível.

## Rollback

Manter a versão anterior e seu lockfile antes do deploy. Se auth/API falhar, desligar AUTH_ENABLED/SUBURBIO_API_ENABLED conforme necessário e reiniciar o serviço: frontend público permanece independente. Não alterar banco para rollback do site. O antigo registro `.openai/hosting.json` é histórico; esta entrega visa Windows/Node e não foi publicada no Sites.

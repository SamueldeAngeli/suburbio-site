# Transmissão, Crypto e dados da conta — 2026-10-04

## Navbar

Desktop: [CARRINHO] [CRYPTO] [PERFIL], nessa ordem, no grupo header-actions. O saldo fica imediatamente antes do UserNav e nunca no dropdown. Carrinho disponível em todas as páginas, levando à homepage e abrindo o carrinho quando necessário. Transmissão adicionada à navegação principal desktop/mobile, usando /tela existente. Dropdown preserva somente Ver perfil/Sair.

CryptoBalance usa CitizenProvider compartilhado pela navbar e pelo card do perfil. Deslogado não recebe saldo. Loading usa skeleton; erro mostra ◆ — Crypto com tooltip, sem inventar zero. Formatação BigInt/pt-BR de integer strings; nenhum floating point, abreviação K ou localStorage financeiro. Clique reutiliza /#crypto.

No mobile, saldo no menu principal, separado do dropdown. Largura mínima reservada; navbar renderiza antes da consulta financeira. Perfil e navbar compartilham uma requisição. Atualiza ao navegar/retornar de checkout, ao recuperar foco/visibilidade se a consulta tiver mais de 30s e no evento suburbio:balance-changed para operações financeiras conhecidas. Sem polling. O evento somente solicita nova consulta, nunca fornece valor. HTTP private,no-store; nenhuma geração estática de saldo individual.

## Contratos reais

- BFF GET /api/me/crypto: extrai Discord ID exclusivamente da sessão, rejeita query strings, limita consultas e assina HMAC.
- API GET /internal/site/me/crypto?customerDiscordId=...: novo endpoint do serviço site. Reutiliza cryptoBalance/crypto_wallets, a mesma leitura autoritativa do bridge. Resposta {balance:"1250",currency:"CRYPTO",asOf:ISO UTC}. Conta sem vínculo verificado retorna erro, não zero. Carteira inicial sem saldo para player vinculado segue semântica existente "0". asOf é a consulta, não data da última transação.
- API GET /internal/site/me/characters?customerDiscordId=...: personagens registrados e vinculados à conta, source REGISTERED. Apenas citizenId, firstName, lastName. Nenhum metadata privado ou ledger ID. Não é consulta live do QBCore nem cálculo de slots.

Foi necessário adicionar essas leituras na API porque saldo existente era exclusivo do bridge e não havia listagem pública autenticada de personagens. OpenAPI regenerado. Sem migration nova. Nenhuma alteração em OAuth, autorização administrativa, bot, bridge ou recursos QBCore. Nenhum deploy ou uso de banco real de testes.

## Perfil

Crypto no card compartilhando exatamente o estado da navbar. Personagens reais vinculados na visão geral e aba, com placeholder visual e nome não informado quando o registro não possuir nome. Sem imagem/personagem inventado. Slots continuam WAITING_FOR_API e sem compra. VIP utiliza entitlement ACTIVE, início, expiração e remainingLabel existente. Fila continua WAITING_FOR_API, sem transformar PENDING em próximo VIP. Pedidos/benefícios continuam nos contratos existentes; itens do pedido no detalhe. Presentes continuam WAITING_FOR_API.

## Auditoria de slots

Leitura sem alteração do arquivo D:/qb-multicharacter.zip: Config.DefaultNumberOfCharacters=5 e Config.PlayersNumberOfCharacters com overrides por license. server.lua usa esses valores ao criar personagem. Esse arquivo não comprova configuração implantada nem sincronização de compras, presentes ou comandos administrativos. Não inferir quantidade efetiva a partir da lista de personagens/pedidos. Necessário contrato confiável de capacidade, validações de checkout/fulfillment e compensação no backend; nenhum limite alterado.

## /tela

Acesso autenticado preservado. Visitante vai ao login com returnTo=/tela e mensagem específica para transmissão, usando OAuth existente. Captura existente reutilizada: getDisplayMedia, seletor nativo de monitor/janela/aba, prévia local, troca de fonte, stop, track ended/mute, microfone independente e fullscreen. Qualidades Automática, 360p30, 480p30, 720p30/60, 1080p30/60 são preferências, sem garantia do dispositivo.

Microfone e áudio da tela têm estados separados. Áudio só disponível quando existe track viva; encerramento da track de áudio atualiza a UI sem parar vídeo. Corrigida Permissions-Policy apenas de /tela para permitir solicitar microphone/display-capture na própria origem; câmera continua bloqueada e permissões do navegador continuam obrigatórias.

Nenhuma sala conectada e nenhuma mídia transmitida. CreateRoom/JoinRoom/RoomToken/LeaveRoom: WAITING_FOR_API. Distribuição de mídia/participantes: WAITING_FOR_SFU. Controles desabilitados, sem IDs/participantes falsos e sem instalar infraestrutura. Preview testado por controles/streams simulados em testes; seleção real de monitor e microfone depende de interação e permissão do usuário no navegador.

## Testes finais

| Projeto/suíte | Aprovados |
| --- | ---: |
| Site — npm test (25 arquivos) | 254 |
| Site — test:http | 43 |
| Site — test:ui (navegador) | 20 |
| Site total | 317 |
| API — npm test | 85 |
| API — test:integration | 211 |
| API total | 296 |

Novos nesta etapa: 16 testes unitários/componentes/BFF no site, quatro verificações adicionais de navegador e sete testes de integração da API. Nenhum teste removido. A expectativa antiga de migrations 10 foi corrigida para 11 já existentes; a pendência da regressão anterior está resolvida sem mudanças nas regras administrativas.

Typecheck, lint e build aprovados em ambos os projetos; verify:client aprovado em 24 arquivos públicos. OpenAPI atualizado. Build do site usa AUTH_ENABLED=false somente no processo de compilação, preservando exigência de HTTPS em produção e configuração HTTP local para dev.

## Screenshots

Em docs/screenshots/crypto-screen/: desktop-1920.png (1920x1080), notebook-1366.png (1366x768), mobile-390.png, mobile-crypto-menu.png, tela-notebook.png. Também versões com dropdown e tablet. Capturas full-page registram viewport escolhido e podem incluir conteúdo abaixo da dobra. Screenshots usam sessão/valor financeiro explicitamente simulados somente no teste isolado; NÃO representam saldo real de TecCode ou homologação live da API. Revisados sem overflow; navegador verificou coordenadas relativas carrinho < Crypto < perfil e ausência de Crypto no dropdown.

## Arquivos principais

Site: components/site/{site-header,user-nav,citizen-provider,crypto-balance}.tsx; components/account/character-cards.tsx; app/layout.tsx; app/citizen.css; app/api/me/crypto/route.ts; app/minha-conta/{page,personagens/page}.tsx; app/page.tsx; app/login/page.tsx; components/screen/screen-preview.tsx; lib/screen/media.ts; lib/api/{client,citizen-contracts}.ts; next.config.ts; testes de saldo/BFF/captura/navegador; API_GAPS.

API: src/http/citizen.ts; src/bootstrap.ts; tests/integration/citizen.test.ts; expectativa de migrations em resilience.test.ts; docs/HTTP_CONTRACTS.md; docs/openapi.json; plano/auditoria.

## Homologação real pendente

A configuração local do site ainda mantém SUBURBIO_API_ENABLED=false. Para dados reais, disponibilizar esta versão da API no ambiente autorizado e configurar URL/credenciais HMAC correspondentes no BFF, então habilitar a integração. Nenhuma credencial foi inventada ou publicada. Conta precisa ter vínculo Discord verificado com o player. Enquanto isso, a interface real mostra indisponibilidade, não o saldo usado nos screenshots. Para /tela, iniciar prévia manualmente, selecionar a fonte e permitir microfone se desejado; isso ainda não cria uma sala.

# Matriz de responsabilidades — Subúrbio RP

A API coordena o ecossistema, mas cada sistema executa aquilo que é naturalmente responsabilidade dele.

## Topologia operacional

Na VPS: processos próprios do site Next.js, Subúrbio API/Fastify e bot Discord. PostgreSQL guarda estado institucional; Redis/Memurai guarda estado efêmero; MariaDB pertence à base QBCore. Apache termina/proxy HTTP conforme configuração. FiveM executa a base e o resource suburbio_bridge (Lua + JavaScript no runtime embutido Node 22). Bridge NÃO é um quarto daemon Node, aplicativo PM2 ou serviço externo.

| Domínio | Dono principal | API central necessária? |
|---|---|---|
| OAuth Discord e sessão web | Site | Não |
| Navbar, navegação, carrinho visual, UI | Site | Não; preços e checkout oficiais sim |
| Área do cidadão | Site apresenta, API fornece estado compartilhado | Somente para estado oficial |
| Transmissão e tokens de mídia | Site + LiveKit/WebRTC | Não |
| Sala, código, host, autorização temporária, encerramento | Site + Redis/Memurai | Não |
| Mensagem, embed, welcome, DM, comando, invite tracking | Bot | Não |
| Logs locais Discord | Bot | Não |
| Auditoria institucional | API | Sim |
| Estado VIP/entitlement | API | Sim |
| Cargo Discord derivado de VIP | Bot aplica | API decide estado |
| Crypto, catálogo, cupom, pedidos, pagamentos | API | Sim |
| Afiliado, atribuição, comissão, repasse | API | Sim |
| Slots compráveis, identidade compartilhada | API | Sim |
| Item, veículo, propriedade | Bridge/base aplica | API autoriza fulfillment |
| Estado QBCore | Base/MariaDB/bridge | Somente quando compartilhado |

## Transmissão

OAuth → sessão do site → Next.js → Redis/Memurai (metadados temporários com TTL) → token restrito de LiveKit. A mídia flui pelo WebRTC/SFU; não por Next, API nem Apache como proxy de vídeo. Sinalização HTTP não se confunde com proxy de mídia.

Estado atual: /tela possui somente prévia local de captura. Salas Redis e LiveKit ainda NÃO estão implementados. Esta revisão define seu proprietário, não finge uma integração ativa nem instala um novo serviço. Namespaces/credenciais Redis devem ser isolados entre site e API; nunca acessar chaves de saldo, autorização institucional ou locks financeiros pelo site.

## Garantias preservadas

Dinheiro e estado oficial permanecem em transação na API com HMAC, idempotência, locks, auditoria e outbox quando existem consumidores centrais. Browser → BFF → API para domínio central. Sem SQL no browser/site nem escrita direta da API no MariaDB de gameplay. O recurso dono aplica o efeito no jogo. Tokens/segredos somente server-side.

Ações puramente locais não exigem API→Bot nem API→LiveKit. Preferir loopback 127.0.0.1 para chamadas necessárias na mesma VPS; HMAC continua obrigatório. Falha da API bloqueia operações centrais, mas não OAuth/UX local ou rotinas locais Discord. Bot offline não bloqueia a API aguardando resposta síncrona.

A API já inicia manutenção de outbox/entitlements/comércio no próprio processo. O entrypoint alternativo npm run worker existe, mas não deve ser iniciado junto por conveniência: revisar topologia antes de duplicar processamento. Nenhum worker novo nesta revisão.

## Regra permanente de implementação

Antes de criar: procurar implementação existente, identificar dono, decidir se API é necessária e reutilizar apenas quando trouxer clareza. Ao substituir: procurar imports, registros dinâmicos, consumers, testes, docs e config; remover anterior sem consumidores após validar equivalência; atualizar testes/docs/dependências/env afetados. Ao finalizar: procurar código/imports mortos, testar, typecheck, lint e build. Não criar arquivos old/backup/v2 como histórico; usar Git. Não remover flags operacionais ou configurações possivelmente usadas sem evidência.

Prioridade: corretude, segurança, performance, simplicidade, manutenção e produtividade. Não criar abstrações apenas por tamanho ou estética. Otimizações com risco financeiro/autorização devem ser propostas com evidência, impacto e risco antes de aplicação.

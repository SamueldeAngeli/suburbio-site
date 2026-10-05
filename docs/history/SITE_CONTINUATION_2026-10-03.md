# Continuação do site — 03/10/2026

## Escopo e estado

Somente D:/suburbiorp. API, bridge, bot, QBCore e recursos do jogo não alterados. Homepage, estilos públicos e demo preservados. Nenhuma dependência ou variável de ambiente adicionada, nenhuma migração/deploy, nenhuma credencial nova e nenhum breaking change intencional. Testes existentes preservados.

- **UI_READY + API_READY:** cadastro único de produtos, preços WEB/INGAME, aliases compatíveis e quatro storefronts; leitura real de entitlements, pedidos e etapas já existentes.
- **UI_READY + WAITING_FOR_API:** presentes (incluindo anonimato e confirmação), histórico, slots efetivos, renovação por entitlement/asset, fila VIP e estados de estorno. Ações financeiras novas continuam bloqueadas.
- **UI_READY:** /tela protegida por sessão de cidadão (não por permissão administrativa), entrada de sala preparada, prévia local browser-based.
- **WAITING_FOR_API + WAITING_FOR_SFU:** salas reais, tokens, moderação, espectadores, qualidade adaptativa/reconexão. Nada conectado nem transmitido.
- **READY_FOR_HOMOLOGATION:** prévia local somente após passar os checks registrados abaixo; captura real por navegador/SO ainda requer consentimento e homologação manual.
- **INTEGRATION_READY / PRODUCTION_READY:** não atribuídos às funcionalidades dependentes de contratos, OAuth ou SFU sem evidência live.

## Páginas/componentes

- /admin/products/[id] (inclui new): ProductEditor e ProductDetails, canais/preços e storefronts. Benefício/entrega são um campo no contrato existente; não duplicar um campo de domínio inexistente. CHARACTER_SLOT e Product CRYPTO aparecem desabilitados. Crypto pelo carrinho continua existente.
- /minha-conta: links para presentes e tela; SlotsSummary com estado indisponível.
- /minha-conta/beneficios: abas VIP/Veículos/Imóveis/Outros, cards reais da página retornada, status/datas/tempo restante. Ícone decorativo quando a API não retorna imagem; duração histórica remetida ao pedido. Não inferir duração por produto atual. Filtros por página são explicitamente informados.
- /minha-conta/presentes: histórico preparado, sem dados ou identidade fabricados.
- Checkout existente: GiftChoice (self/gift), busca/anonimato/confirmar bloqueados; modo gift impede criar pedido. BFF estrito rejeita recipientId/recipientDiscordId/anonymous enquanto não houver contrato.
- Pedido: RefundState indisponível; estados de apresentação preparados para retorno futuro. PurchaseStages continua usando dados reais de pagamento/entrega/notificação, sem substituir comportamento já implementado.
- /tela: ScreenPreview com sidebar, controles preparados de sala/host, prévia e qualidade. Não há sala falsa nem código de convite fabricado.
- Novos componentes: commerce-preparation.tsx (GiftChoice, RecipientConfirmation, RenewalPreparation/Options, SlotsSummary, VipQueue, RefundState), screen/screen-preview.tsx. View models internos em lib/commerce-preparation.ts são propostas, não schemas da API. CaptureController e RoomMediaAdapter em lib/screen/media.ts.

## Captura e integração futura

getDisplayMedia é chamado somente por clique, com seletor nativo e selfBrowserSurface exclude como preferência. Nenhum hook/DLL/driver/captura Windows, câmera ou permissão automática. Áudio da tela só é informado quando realmente existe track; microfone pede autorização separada, sem reprodução local para evitar eco. A prévia é muted e nunca se declara AO VIVO. Source cancelada mantém a anterior; trocar/encerrar/unmount encerra tracks. Seletor pendente após sair não deixa stream órfã. Tratamento de ended/mute/unmute e ausência de frames por 10s (possível interrupção, não prova de falha; janela estática/aba em background pode variar). Recuperar abre novo seletor por gesto do usuário.

Qualidades 360p30/480p30/720p30/720p60/1080p30/1080p60 são preferências e não garantias. Auto na prévia usa 720p30, sem fingir medir rede inexistente. Informações mostram settings reais, não bitrate/latência inventados. Volumes de espectadores ficam desabilitados até existir SFU.

Adapter futuro: WebRTC para SFU, áudio prioritário, simulcast + adaptive stream + dynacast; cada participante recebe a camada adequada, sem mesh P2P. Reconexão preserva roomId/participantId autorizado; tokens curtos da API via BFF HMAC, nunca credenciais de servidor LiveKit no browser. Media nunca passa por Next/API. Lifecycle/quotas/expiração/moderação pertencem à API/SFU. Nenhuma env LiveKit foi adicionada antecipadamente.

Referências técnicas: [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [LiveKit simulcast/dynacast](https://docs.livekit.io/transport/media/advanced/), [LiveKit adaptive stream](https://docs.livekit.io/guides/room/receive).

## Homologação

1. Configurar OAuth e API existentes em ambiente de teste, sem bypass de admin; conferir acesso /tela com cidadão comum e rejeição sem sessão.
2. Criar um SKU WEB, um INGAME e um nos dois canais, testar salvar/reabrir as quatro storefronts e preços independentes. Confirmar filtros nos catálogos oficiais.
3. Usar entitlements reais de teste: categorias, paginação, ACTIVE/PENDING/EXPIRED/REVOKED, origem WEB/INGAME e datas de Brasília. Cards não devem inferir fila VIP nem duplicar asset.
4. Confirmar que presentes/slots/renovação não enviam operações enquanto os contratos faltarem. Testes de soma VIP, queue, limite/race/refund de domínio permanecem na API, fora do escopo deste projeto.
5. /tela em HTTPS ou localhost: aba/janela/monitor, aceitar/negar áudio, microfone independente, cancelar seleção, trocar fonte, parar pelo navegador, sair com seletor aberto, qualidade real no painel. Mobile sem getDisplayMedia não deve permitir iniciar captura; espectadores dependem de SFU.
6. Após integrar API/SFU: salas com 4–10 participantes, dois publishers, host transfer/kick/lock, reconexão sem duplicata, expiration/revoke, perda de pacotes, latência/áudio, volumes separados. Não é teste executável antes dessas integrações.
7. Conferir teclado, foco, reduced motion, mobile e notebook 1366×768 com navegador real. Layout tem breakpoints; Core Web Vitals/LCP/CLS/INP de campo não foram medidos nem certificados nesta execução. Home/animações existentes não foram reconstruídas.

## Verificações

Resultado final registrado ao concluir a execução. Testes de preparação verificam bloqueios/dados recebidos; não equivalem a testes de domínio ou salas live.

### Resultado executado em 03/10/2026

- npm test: **202 aprovados**, 18 arquivos; 52 casos novos nesta etapa (35 preparação comercial/UI, 14 mídia e 3 rejeições BFF de presentes sem contrato).
- npm run test:http: **42 aprovados**, 4 novos (proteção de /tela e /presentes, cidadão comum em /tela, histórico não fabricado).
- Total do SITE nesta execução: **244 aprovados**, 56 novos; zero falhas, skip ou cancelamento nas execuções finais. API/outros projetos não foram executados nem somados.
- npm run typecheck, npm run lint, npm run build: aprovados.
- npm run verify:client: 23 arquivos públicos inspecionados, nenhum segredo identificado.
- Navegador: /tela redireciona a /login?returnTo=/tela. OAuth desativado localmente; não houve login real, concessão de microfone/tela nem teste SFU. Sessão de cidadão foi exercitada apenas no servidor isolado de testes HTTP.
- Preview local reiniciado em http://127.0.0.1:3002. Sem publicação externa.

Os testes novos de VIP/slots/renovação validam apresentação e bloqueios. Não afirmam executar soma de dias, ordem da fila, estorno real ou limite efetivo de slots; essas regras estão fora do site e aguardam contratos. Reconnection e host em sala real permanecem testes de homologação pendentes, não testes aprovados.


Revisão arquitetural 2026-10-04: RoomMediaAdapter era apenas uma interface sem implementação/consumidores e foi removida; salas e tokens pertencem ao site + Redis/LiveKit, não à API central. Consulte RESPONSIBILITY_MATRIX.md.

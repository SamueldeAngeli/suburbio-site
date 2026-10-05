# UX de login, navbar e Área do Cidadão — 2026-10-03

## Entrega

Navbar extraída da homepage para components/site/site-header.tsx e reutilizada no layout global. A arte, seções, catálogo, carrinho e identidade da homepage foram preservados. A comunidade continua identificada como Nosso Discord; autenticação é Entrar com Discord.

UserNav consulta a sessão existente com no-store e apresenta skeleton enquanto carrega, sem flash de login. UserMenu mostra nome/avatar e somente Ver perfil / Sair. Abre no clique ou teclado; fecha com clique fora, ESC, Tab para fora ou navegação; restaura foco no gatilho com ESC. Possui aria-haspopup, aria-expanded e navegação por setas/Home/End. Logout chama a server action existente; teste real de navegador confirmou a remoção do cookie da sessão isolada.

Avatar usa exclusivamente CDN Discord com ID/hash validados. Nome e username vêm do perfil OAuth. O único acréscimo à sessão é metadado público de apresentação (image e username), sem tokens ou permissões. Sessões anteriores podem precisar de sair/entrar novamente para receber o avatar. Fallback com inicial cobre ausência ou falha de imagem.

AccountShell organiza /minha-conta e suas subrotas em perfil lateral + conteúdo; no celular, perfil compacto e navegação horizontal. Visão geral, Pedidos, Benefícios, Presentes e Personagens compartilham a estrutura. Pedidos e benefícios reutilizam SuburbioApiClient/contratos existentes, formatação de valores/status e remainingLabel. Presentes têm navegação Recebidos/Enviados, mas sem inventar histórico. Personagens/slots permanecem indisponíveis até existir dado real; sem oferta de compra. effectiveCharacterSlots não foi indevidamente apresentado como número de personagens utilizados.

EmptyState distingue falta de registros de falha/ausência de consulta. VIP ativo só é exibido com status ACTIVE recebido. Sem fila inventada, barras de progresso calculadas ou mudanças de validade. Tabela de pedidos usa os status reais do contrato; produto permanece no detalhe, pois a listagem não fornece itens. Estorno não é inferido de cancelamento.

## Componentes

Novos: SiteHeader, UserNav/UserMenu, Avatar, DiscordIcon, AccountShell e EmptyState. Helper lib/public-profile.ts valida somente dados públicos. Estilos isolados em app/citizen.css.

Reutilizados: loginDiscord, logout, currentSession, cliente/contratos da API, telas de benefícios/pedidos, RenewalPreparation, SlotsSummary, formatação de valores, status e duração. Não foi criado login ou rota de perfil duplicada. /minha-conta/personagens é a nova aba informativa.

## Verificação final

| Suíte do site | Aprovados |
| --- | ---: |
| npm test — 22 arquivos | 238 |
| npm run test:http | 43 |
| npm run test:ui — verificações em navegador | 16 |
| Total do site | 297 |

19 novos testes unitários/de interação e 16 verificações de navegador. Nenhum teste removido. Duas expectativas antigas foram ajustadas ao requisito de remover o botão de compra no limite 5/5; o teste de presentes foi atualizado para o novo texto.

Typecheck, lint, build e verify:client aprovados. Build usou AUTH_ENABLED=false apenas no processo de compilação para preservar exigência de HTTPS em produção; .env.local de desenvolvimento não foi desabilitado. 23 arquivos de bundle público verificados sem marcadores de segredo.

## Homologação visual

Screenshots em docs/screenshots/citizen/. Todos usam sessão assinada fictícia de teste, sem acesso à conta real do usuário ou permissões administrativas. O avatar inicial é fallback intencional da fixture; testes de componente conferem a imagem real quando seu URL está presente.

- desktop-1920.png e desktop-1920-menu.png: viewport 1920x1080, conteúdo centralizado e dropdown.
- notebook-1366.png e notebook-1366-menu.png: viewport 1366x768, espaçamento compacto, conteúdo sem overflow horizontal; captura de página inteira inclui a rolagem vertical.
- tablet-820.png: 820x1180, menu global recolhido.
- mobile-390.png e mobile-390-menu.png: 390x844, perfil compacto, tabs horizontais e dropdown dentro da viewport.
- anonymous-390.png e anonymous-360.png: login compacto e carrinho pelo menu mobile, homepage preservada.

Testes verificaram ausência de overflow, navegação por abas, menu, foco, logout real e carrinho. Imagens revisadas visualmente.

## Limites e escopo

Regras de OAuth e autorização não foram alteradas nesta etapa de UX. Mesmo provider, scopes, state, sessão criptografada, validade, proteção de origem, server actions e permissões vindas da API. Navbar não decide administração. API, bot, bridge e banco não foram alterados nesta etapa.

A etapa anterior de cargos da API foi interrompida pela nova instrução de trabalhar somente no site: último resultado de integração ainda tinha uma expectativa de migration 10 versus 11; não confundir os 297 testes do site com aprovação total daquela etapa. Migration real continua pendente.

A instalação das dependências de teste revelou um alerta crítico preexistente em Next.js (next/og ImageResponse). Não há uso de next/og no código desta entrega e não foi feita atualização do framework fora do escopo de UX. Registrar atualização de segurança em tarefa própria; nenhuma biblioteca de autenticação foi substituída.

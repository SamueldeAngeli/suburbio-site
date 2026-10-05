# Revisão de arquitetura, limpeza e otimização — 04/10/2026

## Resultado e limites

Auditoria do código/configuração local de D:/suburbiorp, D:/api suburbio, D:/suburbio bot e D:/suburbio_bridge. Não foi uma reescrita, deploy nem inspeção de uma VPS remota. Só foram aplicadas mudanças seguras com consumidores e comportamento conferidos. A identidade visual, contratos financeiros, OAuth, HMAC, locks, transações, auditoria e guards foram preservados.

**Resultado de testes: 914 aprovados, 8 falhas pré-existentes, 922 executados.** As falhas pertencem ao bridge e já existiam antes desta revisão. Não foram ocultadas, removidas ou transformadas em aprovação. Sua correção financeira exige revisão própria.

## Arquitetura e responsabilidades

[Matriz permanente](RESPONSIBILITY_MATRIX.md), também presente nas pastas docs dos outros três projetos.

Site, API e bot são processos próprios. suburbio_bridge é um resource do FiveM: Lua e JavaScript Node 22 embutido, conforme fxmanifest.lua. Não há quarto serviço Node/PM2 do bridge. PostgreSQL guarda domínio oficial da API; MariaDB pertence à base; Redis/Memurai serve estado efêmero. A API já executa seus jobs de manutenção no processo HTTP. Nenhum serviço/worker foi criado.

Permanecem locais: OAuth, sessão, UI, navbar, carrinho visual, navegação, prévia /tela; mensagens/embeds/welcome/invites/comandos Discord no bot; execução QBCore no resource. Salas temporárias/token LiveKit são responsabilidade futura do site + Redis/SFU, e não uma lacuna da API central. Não foram implementadas salas nesta revisão. Mídia não deve atravessar Next/API/Apache como proxy de vídeo.

Permanecem na API: dinheiro, pagamento, Crypto, pedidos, catálogo oficial, cupom, comissão, afiliados, entitlement, VIP oficial, slots compráveis, identidade compartilhada e auditoria institucional. Estado do Discord/gameplay é aplicado pelo consumidor responsável após decisão central. Preferir loopback na VPS sem remover HMAC.

## Alterações aplicadas e evidência

| Classificação | Alteração | Evidência/efeito |
|---|---|---|
| REMOVED_DEAD_CODE | Excluído lib/api/modules/store.ts do site | StoreService/StoreCatalog só eram consumidos por um teste; rotas reais usam SuburbioApiClient.catalog. Teste preservado e apontado ao caminho real. |
| REMOVED_DEAD_CODE | Removida interface RoomMediaAdapter de lib/screen/media.ts | Nenhuma implementação, import ou registro dinâmico; apenas descrições de feature futura. CaptureController e seus testes preservados. |
| DEDUPLICATED / ARCHITECTURE_CLEANUP | moneyMinor movido para lib/format-money.ts | Única implementação reaproveitada pelo painel, repasse e testes; formulário client não importa módulo de painel/gráfico para formatar dinheiro. Não havia dois cálculos financeiros distintos para unificar. |
| PERFORMANCE_OPTIMIZED | Consultas de itens no relatório de afiliados em lote | De 2+N queries para 3 quando há vendas na página; 25 vendas: 27→3. Nenhuma mudança de cálculo ou status. |
| ARCHITECTURE_CLEANUP | Consulta dashboard separada em src/modules/affiliates/reporting.ts | Leitura/apresentação separada de cadastro, atribuição, reversão e repasse. Sem separar por limite arbitrário de linhas. |
| PERFORMANCE_OPTIMIZED | Site compartilha consulta de acesso em andamento | Rajadas de focus não criam fetches simultâneos; nova consulta permitida após terminar. Sem TTL adicional em permissões, sem cache de saldo, sem novo timer. |
| PERFORMANCE_OPTIMIZED | Bot inicializa timers uma única vez por start | Guard definido antes do primeiro await; ClientReady repetido não duplica recover, scheduler, status, consumer ou timers. Testes repetem evento e verificam quantidade de timers. |
| DOCS_UPDATED | Matriz, AGENTS e documentação atualizadas | Corrigidas proibição global de Redis no site, dependência fictícia de API para salas e descrições de componentes removidos. |
| NO_CHANGE_NEEDED | Bridge Lua/timers | Wait(0) pontual em deferrals; inventário possui tentativa limitada; não há loop por frame. Timers JS serializados e interrompidos no resource stop. |
| NO_CHANGE_NEEDED | Dependências/config operacional | Dependências runtime têm referências reais. Nenhuma removida apenas por peso/nome; flags/config usadas ou com operação não comprovada foram mantidas. |

Buscas incluíram imports, nomes de símbolos, handlers/exports dinâmicos, testes, docs e configuração. Assets públicos, rotas Next por convenção, adapters dinâmicos do FiveM, migrations e testes de garantias não foram classificados como mortos pela simples ausência de import estático. Componentes comerciais preparados com uso/testes e contexto histórico foram mantidos; sua remoção exige decisão funcional específica.

## Métricas desta rodada

- Arquivos de código removidos: **1**, lib/api/modules/store.ts (site).
- Código morto removido: **18 linhas** (wrapper de 9 linhas e interface de 9 linhas).
- Diff de código/testes da rodada: **37 linhas removidas / 44 adicionadas**, inclui movimentação e testes; saldo +7. Não é métrica de performance. Arquivos existentes usam linhas extensas.
- API/bot/bridge: nenhum arquivo morto removido sem prova suficiente.
- Dependências removidas: **0**; adicionadas: **0**. Sem upgrades.
- Env vars removidas: **0**. Nenhum .env real exibido/editado; exemplos e validadores auditados.
- Módulos consolidados: formatador reutilizado em lib/format-money.ts; wrapper redundante de catálogo removido.
- Arquivos divididos: service.ts de afiliados → consulta em reporting.ts; cálculo/repasse permanecem no domínio financeiro.
- Queries otimizadas: **1 caminho N+1**, relatório de afiliados, validado com 26 vendas e duas páginas.
- Polling/loops permanentes removidos: **0**; timers removidos: **0**. Duplicação de timers prevenida no bootstrap do bot. Nenhum tick/thread crítico novo.
- Listeners: registro original preservado, handler ClientReady protegido contra repetição. Nenhum consumidor encerrado indevidamente.
- Caches adicionados/removidos: **0**. Deduplicação só de request em andamento no site.
- Migration nova: **0**. 12 migrations existentes verificadas em bancos descartáveis.
- Breaking changes públicos: **nenhum**. Export interno de relatório mudou de módulo e consumidores foram atualizados; wrapper/interface sem consumidores de produção foram removidos.

## Arquivos grandes e performance auditados

Site: homepage (~20 KB) concentra UI pública, mas é identidade aprovada; mantida. CSS global compactado (~26 KB) e classes dinâmicas não podem ser apagados por busca ingênua. Cliente API reúne contratos/coerção/HMAC, sem segunda implementação HTTP criada. moneyMinor foi retirado da dependência de um componente amplo. Não foi medido ganho em bytes de bundle nem tempo real de hidratação; verify:client examinou 26 arquivos públicos sem segredos. Nenhum script de terceiro ou dependência pesada nova.

API: payments.ts (~18 KB) é a máquina de reconciliação financeira, não foi fragmentada por estética. Serviço de entitlements preservado. Relatório de afiliados separa leitura e elimina N+1, sem tocar regras financeiras. Health usa SELECT 1 + ping; diagnostics interno também verifica MariaDB com timeout. Sem consulta pesada agregada em health e sem necessidade de adicionar cache nesta rodada.

Bot: roteadores de interação/auditoria e serviços possuem funções reais; não removidos por tamanho. Timers existentes têm anti-overlap, unref e limpeza no shutdown. Cache de mensagens possui limpeza; correlação de cargo usa TTL; invites são observadores locais. Dependência @resvg/resvg-js é usada em DeletedMessageRenderer, luxon em temporalidade, demais runtime no código. Não houve login, mensagem, DM nem mutação de cargo real durante testes.

Bridge: catálogo consulta versão a cada 60s e usa snapshot/TTL; outbox e reconciliação padrão 10s; resync online 5min para eventos perdidos. ACK financeiro e ledger preservados. Não trocar essas rotinas por tick nem remover reconciliação para reduzir número de chamadas. Lua compilada com Fengari e JS com node --check; não houve FiveM live.

## Riscos encontrados — REQUIRES_REVIEW

1. **Bridge incompatível no fluxo de compra**: lib/purchase.js agora exige api/ledger e estados financeiros, mas server/runtime.js instancia com players/catalog. O teste de startup falha ao acessar ledger.entries. Outros testes ainda esperam ausência de contrato/associação. Total pré-existente: 8 falhas. Proposta: reconciliar contrato, composição, feature enable explícito e testes numa etapa financeira dedicada; validar débito/fulfillment/replay em base de homologação. Risco de ligar compras reais se apenas injetar dependências e usar enabled=true padrão. Não aplicado silenciosamente.
2. **Eventos API sem consumidor equivalente no bot**: OutboxConsumer oficial trata allowlist.approved/revoked; a API também produz eventos comerciais/affiliate.*. Possível repetição/fail/dead-letter ao habilitar esse consumidor para todos os eventos. Proposta: definir matriz de inscrição/tipos e implementar ACK/efeitos conforme contrato. Não descartar eventos nem remover outbox/auditoria como otimização.
3. **Relatório de afiliados ainda lê todas as comissões do período para agregação**: N+1 corrigido, mas custo de memória cresce com histórico. Proposta: agregação SQL/paginação real com testes comparativos de centavos, datas, reversões e compensações. Não reescrever cálculo financeiro nesta limpeza.
4. **Entrypoint alternativo npm run worker na API**: os mesmos jobs já começam no bootstrap HTTP; PM2 atual só declara a API. Rodar ambos sem desenho de topologia amplia varreduras. Mantido pois a utilização operacional fora do repositório não foi comprovada; documentado para não ligar simultaneamente por conveniência.
5. **Bridge alias de convar** suburbio_bridge_secret: compatibilidade com nome antigo permanece. Não retirar sem confirmar configuração implantada.
6. **Limitadores e mapas locais**: site WindowLimiter e bot RateLimiter fazem varredura de expirados por chamada; estado de interação tem TTL mas não um limite global rígido. Há oportunidade de medir escala e definir quotas; alterar limites pode negar ações válidas. Não mudado sem carga observada.
7. **Health /health representa readiness** e não liveness sem dependências. Probes devem respeitar essa semântica para evitar reinícios em cascata. Version string antiga no health merece alinhamento separado; nenhum endpoint foi removido/renomeado.
8. **Persistência do bridge**: fsync e leitura de histórico local podem crescer; compactação precisa preservar receipts/idempotência. Não apagar data/ para limpar.
9. **Transmissão incompleta**: só prévia; Redis de salas, SDK/tokens LiveKit, regras de host e revogação precisam de implementação própria futura. Agora documentados no dono correto.
10. **Flags operacionais preservadas**: AUTH_ENABLED, SUBURBIO_API_ENABLED, DISCORD_ROLE_AUTH_ENABLED, API_ENABLED, storage selectors, safe mode e adapters desativados não são flags comprovadamente mortas. Sem remoção ou ativação em produção.

## Testes antes/depois

Baseline do site/API: execução imediatamente anterior, documentada em AFFILIATES_2026-10-04.md (356 e 325 aprovados); bot/bridge executados antes desta rodada. Nenhum teste útil/suíte removido. O teste do wrapper de catálogo foi redirecionado ao cliente real; testes de startup existentes foram ampliados. Adicionados teste de foco concorrente e teste de quantidade constante de queries/paginação.

| Projeto/suíte | Antes aprovados | Depois aprovados | Falhas depois |
|---|---:|---:|---:|
| Site unit/component | 278 | 279 | 0 |
| Site HTTP | 43 | 43 | 0 |
| Site browser existente | 20 | 20 | 0 |
| Site browser afiliados | 15 | 15 | 0 |
| API unit | 91 | 91 | 0 |
| API integração | 234 | 235 | 0 |
| Bot | 158 | 158 | 0 |
| Bridge | 73 | 73 | 8 (já existentes) |
| **Total** | **912** | **914** | **8** |

Depois: site **357**, API **326**, bot **158**, bridge **73/81**. Total **922 executados**. Testes API usam PostgreSQL/Redis descartáveis e isolados. Browser usa processos/sessões de fixture; não representa homologação real.

| Check | Site | API | Bot | Bridge |
|---|---|---|---|---|
| Typecheck | passou | passou | passou | não aplicável JS/Lua |
| Lint | passou | passou | passou | sem script lint; syntax check |
| Build | passou | passou | passou | resource, sem build Node separado |
| Específico | secrets check: 26 arquivos | OpenAPI 3.0.3: 66 operações, respostas/refs validadas; migrations 12/12 | startup com mocks, API ausente/safe mode e ready repetido | 40 arquivos JS/Lua com sintaxe válida; startup mock falha pré-existente |

Build do site usa AUTH_ENABLED=false só no processo de build por configuração OAuth local HTTP; .env não alterado. Nenhuma migration aplicada no banco real. Nenhuma alteração de framework, banco, regras de negócio ou visual.

## Impacto qualitativo

Relatório: redução mensurável de viagens ao banco, até 24 consultas a menos por página de 25 vendas; não equivale a promessa de 89% de latência. Site: menos fan-out duplicado durante solicitações simultâneas, sem cache novo de autorização. Bot: custo periódico permanece previsível mesmo se ready repetir. Bundle: acoplamento menor; economia em bytes não alegada. Bridge: documentação e diagnóstico, sem alegação de ganho de runtime.

## Documentação e próximos passos

RESPONSIBILITY_MATRIX.md e AGENTS.md nos quatro projetos; SITE_ARCHITECTURE.md, DEPLOYMENT.md, API_GAPS.md, STORE_DATA_AUDIT.md e nota histórica SITE_CONTINUATION_2026-10-03.md; arquitetura/README do bridge; planos e auditorias referenciam este relatório.

Prioridade futura: resolver integração financeira do bridge; alinhar consumidores da outbox; depois medir histórico/queries sob carga representativa. Criar salas/transmissão é trabalho funcional separado, local ao site/SFU. Nenhuma dessas mudanças de risco foi escondida na limpeza.

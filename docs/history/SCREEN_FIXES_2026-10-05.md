# Sala de compartilhamento — 05/10/2026

Controles secundários e desabilitados usam a paleta escura, eliminando fundos brancos nativos. Todos os participantes entram com permissão de transmitir; o anfitrião mantém a moderação. Permissões aplicadas no servidor e no LiveKit. Salas anteriores exigem sair e entrar novamente para renovar permissões.

Convite oficial: https://discord.gg/suburbiorp.

Validação: 291 testes unitários + 43 HTTP + 20 de navegação da conta + 15 de afiliados + 17 LiveKit = 386 verificações aprovadas. Typecheck, lint, build e verify:client passaram. Nenhum teste removido; duas expectativas HTTP de textos antigos foram atualizadas.

LiveKit foi validado com dois processos de navegador, identidades de teste e transporte WebRTC real. Captura de vídeo/áudio sintética: não houve captura da tela do usuário nem homologação do seletor do sistema. Inclui transmissão em ambos os sentidos, áudio separado, troca de fonte, reconexão e moderação.

Build com AUTH_ENABLED=false somente no processo de validação, sem alterar a configuração persistente do OAuth. Este registro não declara concluídas as outras pendências do pré-VPS.

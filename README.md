# Integração de conta com o app Zeca

O vínculo associa uma conta do app a um remetente do bot. Ele não combina saldos, moedas ou progresso entre os sistemas.

## Configuração dos servidores

1. Gere um segredo aleatório de pelo menos 32 caracteres, por exemplo:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Configure o mesmo valor em `WHATSAPP_LINK_SECRET` nos ambientes do serviço Zeca (que executa `functions/server.js`) e do serviço WhatsappBot2.
3. No serviço do bot, mantenha `ZECA_API_URL` apontando para o backend HTTPS do Zeca. O `render.yaml` já usa `https://zeca-jvic.onrender.com`.
4. No backend do Zeca, configure `PIROQUINHAS_API_URL` com `https://whatsappbot2-130c.onrender.com`.
5. Reinicie/republique os dois serviços. Não coloque o segredo no aplicativo ou no repositório.

## Como vincular

Na Central da conta do app, gere um código, abra o WhatsApp e envie a mensagem preenchida ao bot em uma conversa privada. O código expira em 10 minutos e só pode ser usado uma vez. Depois, atualize a Central da conta para conferir o estado do vínculo. A mesma tela permite desvincular a conta.

## Economia exibida no app

Com a conta vinculada e as duas variáveis de ambiente configuradas, a Central da conta consulta, pelo backend assinado, os saldos de gold por grupo e o extrato recente. Essa integração é somente de leitura: gold e o saldo em reais do app permanecem separados; não há conversão, saque ou transferência para Pix.

## Dados sincronizados e privacidade

Na Central da conta, cada categoria começa desativada e pode ser habilitada separadamente:

- Perfil, XP e progresso por grupo.
- Pet e inventário.
- Missões diárias do bot.
- Economia virtual do bot.

O app só solicita as categorias habilitadas; o servidor verifica as preferências antes de consultar o bot. As solicitações de painel usam `GET /api/integration/dashboard` com assinatura HMAC e timestamp, assim como a consulta de economia.

## Missões, eventos e figurinhas

Missões diárias concluídas no bot podem ser resgatadas uma única vez por dia no app. Cada resgate concede 10 pontos de integração, armazenados separadamente do saldo financeiro e sem conversão ou saque por Pix. O app também permite compartilhar o evento semanal do Zeca em uma conversa do WhatsApp.

Para compartilhar uma figurinha, escolha uma imagem na Central da conta. O app abre o WhatsApp com a imagem anexada e `!s` preenchido; selecione uma conversa com o bot para concluir o envio.

# Carteira compartilhada com o app Zeca

O vínculo associa o telefone do WhatsApp a uma conta do app. Cada número só pode pertencer a uma conta do app por vez.

## Configuração dos servidores

1. Gere um segredo aleatório com pelo menos 32 caracteres, por exemplo:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Configure o mesmo valor em `WHATSAPP_LINK_SECRET` no bot e no serviço do Zeca (que executa `functions/server.js`).
3. No bot, configure `ZECA_API_URL` com o endereço HTTPS do backend do Zeca. O `render.yaml` usa `https://zeca-jvic.onrender.com`.
4. No Zeca, configure `PIROQUINHAS_API_URL` com o endereço HTTPS do bot, por exemplo `https://whatsappbot2-130c.onrender.com`.
5. O MongoDB do bot precisa aceitar transações (replica set), usado na migração e nas liquidações do marketplace.
6. Republique os dois serviços. Nunca coloque o segredo no aplicativo ou no repositório.

## Como vincular

Na Central da conta do app, gere um código, abra o WhatsApp e envie a mensagem preenchida ao bot em uma conversa privada. O código expira em 10 minutos e só pode ser usado uma vez. O telefone vinculado é salvo no perfil e reservado para essa conta do app; outra conta não pode reivindicá-lo. A mesma tela permite desvincular a conta.

## Saldo e moeda

Na primeira utilização da carteira após o vínculo, o bot migra uma única vez os saldos disponíveis e depósitos bancários dos grupos, soma também o saldo legado do perfil e zera os valores antigos para evitar duplicidade. Cada unidade antiga de `gold` equivale a R$ 0,01. O saldo canônico passa a ser compartilhado entre app e bot, armazenado em centavos de BRL; transferências e movimentações do bot atualizam a carteira do app.

O cadastro do app exige a escolha de um país. O saldo compartilhado é exibido na moeda desse país com a cotação diária em relação ao BRL; o valor armazenado e liquidado continua em centavos de BRL. Usuários sem vínculo continuam usando a carteira legada do bot, apresentada em reais. O marketplace permite transações entre usuários vinculados e não vinculados; liquidações incompletas ficam pendentes e são retomadas sem duplicar cobranças.

Na carteira interna do app, transferências entre contas configuradas com moedas diferentes usam a cotação diária, cobram uma taxa de 1% adicional do remetente e creditam ao destinatário o valor integral convertido. A cotação e a taxa são exibidas antes da confirmação; transferências entre contas na mesma moeda não pagam essa taxa. A carteira permanece contabilizada em centavos de BRL.

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

# 📁 Estrutura Refatorada - WhatsApp Sticker Bot

## Antes
Antigo: Um único arquivo `bot.js` com **2350 linhas** contendo todo o código misturado.

## Depois ✅
Novo: Bot dividido em arquivos modulares organizados por funcionalidade.

```
src/
├── bot.js                    ← Núcleo refatorado: inicialização, roteamento, contadores, estado global
├── sticker.js               ← Conversão de figurinhas (já existia)
├── fetchurl.js              ← Utilitários de download (já existia)
│
└── handlers/                ← Nova pasta com handlers especializados
   ├── figurinha.js         ← !s, !desfig, !brat, !figtexto, !estourar
    ├── diversao.js          ← !gay, !sexo, !dado, !moeda, !8ball, !ship, !rolar, !xingar, !elogio, !crush, !cantada, !safadeza
    ├── relacionamento.js    ← !casar, !namorar, !terminar
    ├── grupo.js             ← !ban, !mute, !desmute, !ranking, !sorteio, !enquete, !todos, !fechar, !abrir, !promover, !rebaixar, !tempo, !antilink, !autosticker
    ├── imagem.js            ← !blur, !pb, !espelhar, !girar, !pixelar, !pixel, !sfundo
    ├── texto.js             ← !maiusculo, !invertido, !caixa, !traduzir
    └── utilidade.js         ← !qrcode, !encurtar, !cep, !tiktok, !audio, !som, !menu, !playmp4, !playdoc
```

## 📊 Comparação

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Arquivos** | 1 arquivo | 8 arquivos |
| **Linhas em bot.js** | 2350 | ~350 |
| **Legibilidade** | ❌ Muito grande | ✅ Modular |
| **Manutenção** | ❌ Difícil | ✅ Fácil |
| **Reutilização** | ❌ Acoplado | ✅ Desacoplado |
| **Organização** | ❌ Caótica | ✅ Por categoria |

## 📋 Separação de Responsabilidades

### **bot.js (Núcleo)**
- ✅ Inicialização do bot
- ✅ Roteamento de comandos
- ✅ Gerenciamento de estado (contadores, dados persistentes)
- ✅ Verificação de permissões (anti-link, auto-sticker, mute)
- ✅ Sincronização com handlers
- ✅ *Correção rápida*: agora o bot entende comandos de substituição (`!s/antigo/novo/` ou `.s/antigo/novo/`) em conversas privadas ou quando você cita uma mensagem

### **figurinha.js**
Responsável por: `handleSticker`, `handleDesfig`, `handleEstourar`, `handleBrat`, `handleFigtexto`

### **diversao.js**
Responsável por: `handleGay`, `handleSexo`, `handleDado`, `handleMoeda`, `handle8ball`, `handleShip`, `handleRolar`, `handleXingar`, `handleElogio`, `handleCrush`, `handleCantada`, `handleSafadeza`

### **relacionamento.js**
Responsável por: `handleRelacionamento`, `handleResposta`, `handleTerminar`

### **grupo.js**
Responsável por: `handleBan`, `handleMute`, `handleDesmute`, `handleRanking`, `handleSorteio`, `handleEnquete`, `handleTodos`, `handleFecharAbrir`, `handlePromoverRebaixar`, `handleTempo`, `handleAntiLink`, `handleAutoSticker` + funções utilitárias (`isAdmin`, `isBotJid`)

### **imagem.js**
Responsável por: `handleImageFilter`, `handleSfundo`

### **texto.js**
Responsável por: `handleTraduzir`, `handleTextoFun`

### **utilidade.js**
Responsável por: `handleMenu`, `handleQrcode`, `handleEncurtar`, `handleCep`, `handleTiktok`, `handleAudioDownload`, `handleSom`, `handlePlayMp4`, `handlePlayDoc` + funções auxiliares

## 🔄 Fluxo de Execução

```
bot.js (handleMessage)
    ├─→ Anti-Link / Auto-Sticker?
    ├─→ Resposta de relacionamento?
    ├─→ Comando reconhecido?
    └─→ Roteador
        ├─→ handlers/utilidade.js
        ├─→ handlers/figurinha.js
        ├─→ handlers/relacionamento.js
        ├─→ handlers/diversao.js
        ├─→ handlers/grupo.js
        ├─→ handlers/imagem.js
        └─→ handlers/texto.js
```

## 💡 Benefícios

✅ **Mais legível**: Cada arquivo tem ~150-300 linhas focadas em um tema  
✅ **Mais fácil de manter**: Alterar `!s` não afeta `!tiktok`  
✅ **Escalável**: Adicionar novo comando é trivial  
✅ **Testável**: Cada handler pode ser testado isoladamente  
✅ **Colaborativo**: Múltiplas pessoas podem trabalhar em paralelo  

## 🚀 Como Adicionar Novo Comando

Por exemplo, adicionar `!mágica`:

1. **Escolher o handler apropriado**  
   → Entra em `handlers/diversao.js`

2. **Criar a função**  
   ```javascript
   async function handleMagica(sock, msg, jid, author) {
     const frases = ["Abracadabra!", "Presto!", "✨"];
     await sock.sendMessage(jid, { text: frases[Math.floor(Math.random() * frases.length)] });
   }
   ```

3. **Exportar no handler**  
   ```javascript
   module.exports = { ..., handleMagica };
   ```

4. **Importar em bot.js**  
   ```javascript
   const diversaoHandler = require('./handlers/diversao');
   ```

5. **Adicionar rota**  
   ```javascript
   if (cmd.startsWith(`${P}magica`)) { await diversaoHandler.handleMagica(...); return; }
   ```

Pronto! ✅

## 📝 Notas Importantes

- Todos os handlers compartilham acesso via parâmetros (sem estado global)
- State global (msgCount, stickerCount, etc) continua em `bot.js`
- String `prefix` é dinâmica por grupo via `getPrefix(jid)`
- Logger é configurável via `setLogger()` em cada handler
- Persistência de dados continua em um único ponto (`saveData()` em `bot.js`)

---

**Status**: ✅ Refatoração completa e funcional!

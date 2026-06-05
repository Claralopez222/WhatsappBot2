# 🗂️ Guia Rápido de Arquivos

## Arquivo Principal
```
src/bot.js (≈350 linhas)
├─ Importações de todos os handlers
├─ Estado global (msgCount, stickerCount, etc)
├─ Funções de utilidade (contadores, prefixo)
├─ startBot() - inicialização
├─ handleMessage() - roteador principal
└─ handlePrefixo() - gerenciador de prefixo
```

---

## Handlers (src/handlers/)

### 1️⃣ **figurinha.js** (≈180 linhas)
```
Comandos:
  !s          → Cria figurinha de imagem/vídeo
  !desfig     → Converte figurinha em imagem/vídeo
  !estourar   → Amplifica volume de áudio
  !brat       → Cria figurinha brat com texto
  !figtexto   → Cria figurinha com texto simples

Funções exportadas:
  • handleSticker()
  • handleDesfig()
  • handleEstourar()
  • handleBrat()
  • handleFigtexto()
  • processMedia()
  • setLogger()
```

---

### 2️⃣ **diversao.js** (≈280 linhas)
```
Comandos:
  !gay        → Mede "nível gay"
  !sexo       → Cena engraçada entre 2
  !dado       → Joga dado (1-6 ou custom)
  !moeda      → Cara ou coroa
  !8ball      → Bola mágica (respostas)
  !ship       → Compatibilidade entre 2
  !rolar      → Ação aleatória
  !xingar     → Xingamento aleatório
  !elogio     → Elogio aleatório
  !crush      → Mede crush rate
  !cantada    → Cantada de pesca
  !safadeza   → Cena picante

Funções exportadas:
  • handleGay()           • handleCrush()
  • handleSexo()          • handleCantada()
  • handleDado()          • handleSafadeza()
  • handleMoeda()         • todos como módulos
  • handle8ball()
  • handleShip()
  • handleRolar()
  • handleXingar()
  • handleElogio()
```

---

### 3️⃣ **relacionamento.js** (≈110 linhas)
```
Comandos:
  !casar      → Pedido de casamento
  !namorar    → Pedido de namoro
  !terminar   → Encerrar relacionamento

Funções exportadas:
  • handleRelacionamento()
  • handleResposta()
  • handleTerminar()
  • getRelacionamento()

Dados:
  • Armazena relacionamentos em Map
  • Suporta respostas sim/não
  • Timeout automático em 5min
```

---

### 4️⃣ **grupo.js** (≈420 linhas)
```
Comandos:
  !ban              → Remove membro(s)
  !mute             → Silencia membro(s)
  !desmute          → Volta som
  !ranking          → Top 10 mensagistas
  !sorteio          → Sorteia participante
  !enquete          → Cria votação
  !todos            → Marca todos
  !fechar           → Tranca grupo
  !abrir            → Abre grupo
  !promover         → Dá admin
  !rebaixar         → Remove admin
  !tempo            → Tempo de grupo
  !antilink on/off  → Ativa/desativa anti-link
  !autosticker      → Ativa/desativa sticker auto

Funções exportadas:
  • handleBan()              • handleTodos()
  • handleMute()             • handleFecharAbrir()
  • handleDesmute()          • handlePromoverRebaixar()
  • handleRanking()          • handleTempo()
  • handleSorteio()          • handleAntiLink()
  • handleEnquete()          • handleAutoSticker()
  • isAdmin()                (9 handlers + utils)
```

---

### 5️⃣ **imagem.js** (≈260 linhas)
```
Comandos:
  !blur       → Desfoca imagem/vídeo
  !pb         → Preto e branco
  !espelhar   → Espelhamento horizontal
  !girar      → Rotação 90°
  !pixelar    → Pixelação simples
  !pixel      → Pixel art estilo
  !sfundo     → Remove fundo da imagem

Funções exportadas:
  • handleImageFilter()
  • handleSfundo()
  • setLogger()

Tecnologias:
  → sharp para imagens
  → ffmpeg para vídeos
  → rembg ou remove.bg para remover fundo
```

---

### 6️⃣ **texto.js** (≈40 linhas)
```
Comandos:
  !maiusculo  → TRANSFORMA EM MAIÚSCULAS
  !invertido  → pǝuᴨǝllɐ oʇxǝ
  !caixa      → 🅒🅐🅘🅧🅐 eMoJi BoX
  !traduzir   → Traduz para português

Funções exportadas:
  • handleTraduzir()
  • handleTextoFun()

APIs:
  → Google Translate para traduções
```

---

### 7️⃣ **utilidade.js** (≈650 linhas - arquivo mais longo)
```
Comandos:
  !qrcode     → Gera QR code
  !encurtar   → Encurta URLs (TinyURL)
  !cep        → Consulta CEP (ViaCEP)
  !tiktok     → Baixa vídeos TikTok
  !audio      → Extrai áudio de vídeo
  !som        → Busca e baixa música (YT)
  !menu       → Mostra todos comandos
  !playmp4    → Converte áudio em vídeo
  !playdoc    → Envia áudio como documento

Funções exportadas:
  • handleMenu()             • handlePlayMp4()
  • handleQrcode()           • handlePlayDoc()
  • handleEncurtar()         • setLogger()
  • handleCep()              • setRemoveBgKey()
  • handleTiktok()           (9 handlers)
  • handleAudioDownload()
  • handleSom()

Tecnologias:
  → yt-dlp para downloads
  → ffmpeg para conversão
  → APIs externas (TinyURL, ViaCEP)
```

---

## 📊 Estatísticas

| Handler | Linhas | Comandos | Funções |
|---------|--------|----------|---------|
| figurinha.js | 180 | 6 | 7 |
| diversao.js | 280 | 12 | 12 |
| relacionamento.js | 110 | 3 | 4 |
| grupo.js | 420 | 14 | 12 |
| imagem.js | 260 | 7 | 2 |
| texto.js | 40 | 4 | 2 |
| utilidade.js | 650 | 9 | 9 |
| **bot.js** | **350** | - | **roteador** |
| **TOTAL** | **2290** | **55+** | - |

---

## 🔗 Fluxo de Imports em bot.js

```javascript
// No topo de bot.js:
const figurinhaHandler = require('./handlers/figurinha');
const diversaoHandler = require('./handlers/diversao');
const relacionamentoHandler = require('./handlers/relacionamento');
const grupoHandler = require('./handlers/grupo');
const imagemHandler = require('./handlers/imagem');
const textoHandler = require('./handlers/texto');
const utilidadeHandler = require('./handlers/utilidade');

// Dentro de handleMessage():
if (cmd.startsWith(`${P}s`)) 
  await figurinhaHandler.handleSticker(...);

if (cmd.startsWith(`${P}gay`)) 
  await diversaoHandler.handleGay(...);

// ... etc para todos os handlers
```

---

## ✅ Checklist de Organização

- ✅ Cada handler é independente
- ✅ Cada handler exporta suas funções
- ✅ bot.js centraliza roteamento
- ✅ Estado compartilhado via parâmetros
- ✅ Sem dependências circulares
- ✅ Fácil de adicionar novos comandos
- ✅ Fácil de testar isoladamente
- ✅ Código limpo e legível

---

**Criado em**: Março 2026  
**Status**: ✅ Refatoração Completa

# 🤖 WhatsApp Sticker Bot

Bot para WhatsApp que converte imagens e vídeos em figurinhas (stickers) usando o comando `!s`.

---

## 📦 Estrutura do Projeto

```
whatsapp-sticker-bot/
├── src/
│   ├── bot.js       ← Conexão, eventos e roteamento de mensagens
│   └── sticker.js   ← Conversão de mídia (sharp + ffmpeg)
├── session/         ← Criado automaticamente (credenciais do WhatsApp)
├── package.json
└── README.md
```

---

## 🚀 Instalação

### Pré-requisitos
- Node.js **>= 18**
- npm ou yarn

### Passos

```bash
# 1. Clone ou copie o projeto
cd whatsapp-sticker-bot

# 2. Instale as dependências
npm install

# 3. Inicie o bot
npm start
```

Ao iniciar pela primeira vez, um **QR Code** aparecerá no terminal.
Escaneie com o WhatsApp em: `Configurações → Aparelhos Conectados → Conectar`.

---

## 📱 Como Usar

| Situação | Ação |
|---|---|
| Enviar imagem/vídeo | Adicione `!s` na **legenda** da mídia |
| Mídia já enviada | **Responda** a ela com o texto `!s` |

### Exemplos

```
# Ao enviar uma foto:
[imagem] | legenda: !s

# Respondendo a um vídeo existente:
[reply no vídeo] → mensagem: !s
```

---

## ⚙️ Dependências Explicadas

| Pacote | Função |
|---|---|
| `@whiskeysockets/baileys` | Conexão com WhatsApp via Web Socket |
| `sharp` | Redimensionamento e crop de imagens (sem ffmpeg) |
| `fluent-ffmpeg` | Processamento de vídeo/GIF para WebP animado |
| `ffmpeg-static` | Binário do ffmpeg empacotado (sem instalar no sistema) |
| `ffprobe-static` | Binário do ffprobe para análise de mídia |
| `pino` | Logger de alta performance (usado pelo Baileys) |
| `@hapi/boom` | Tipagem de erros HTTP (dependência do Baileys) |

---

## 🔧 Configuração (sticker.js)

Edite as constantes no topo do `src/sticker.js`:

```js
const STICKER_SIZE         = 512;           // Tamanho da figurinha (512×512)
const MAX_VIDEO_DURATION   = 10;            // Duração máxima em segundos
const STICKER_PACK_NAME    = 'StickerBot';  // Nome do pacote
const STICKER_PACK_AUTHOR  = 'Seu Nome';    // Nome do autor
```

---

## 🗂️ Como Funciona Internamente

### Imagens (JPEG, PNG, WebP → WebP estático)

```
Buffer original
    ↓
sharp.resize(512, 512, { fit: 'cover', position: 'center' })
    ↓  ← crop centralizado automático
sharp.webp({ quality: 90 })
    ↓
Injeta metadados EXIF (nome do pacote)
    ↓
Buffer WebP final
```

### Vídeos / GIFs (MP4, GIF → WebP animado)

```
Buffer original
    ↓
Salva em arquivo temporário
    ↓
ffmpeg pipeline:
  scale → crop 512×512 (centralizado) → fps=15
  codec: libwebp | loop: infinito | sem áudio
    ↓
Lê o WebP animado gerado
    ↓
Remove arquivos temporários
    ↓
Buffer WebP animado final
```

---

## ⚠️ Observações

- A pasta `session/` é criada automaticamente e contém suas credenciais. **Não compartilhe.**
- Para trocar de conta, delete a pasta `session/` e reinicie.
- Figurinhas animadas têm limite de **~1MB** no WhatsApp; vídeos longos podem falhar.
- O bot roda localmente — seu número ficará conectado enquanto o processo estiver ativo.

---

## 📄 Licença

MIT

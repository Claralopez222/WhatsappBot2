'use strict';

const mongoose = require('mongoose');
const crypto   = require('crypto');
const { initAuthCreds, proto, BufferJSON } = require('@whiskeysockets/baileys');

// ─── Schema: dados de autenticação (creds + chaves) ──────────────────────────

const authSchema = new mongoose.Schema({
  _id:  { type: String, required: true },
  data: { type: String, required: true }, // JSON string
}, { timestamps: true });

const AuthData = mongoose.models.AuthData || mongoose.model('AuthData', authSchema);

// ─── Schema: lock de sessão (evita 2 processos escrevendo a mesma sessão) ────
// Um único documento (_id fixo) guarda quem é o "dono" atual da conexão com
// o WhatsApp. Isso existe porque suspender o processo no Render (hibernate)
// nem sempre mata o processo instantaneamente — se você sobe uma instância
// local enquanto o Render ainda está vivo, os dois processos ficam com uma
// cópia própria de `creds` em memória e cada `saveCreds()` sobrescreve o
// documento inteiro sem merge. Isso pode deixar as chaves do protocolo
// Signal inconsistentes com o que o servidor do WhatsApp realmente aceitou
// por último, e o WhatsApp reage forçando logout (pede QR de novo).

const lockSchema = new mongoose.Schema({
  _id:         { type: String, required: true },
  instanceId:  { type: String, required: true },
  heartbeatAt: { type: Date,   required: true },
}, { timestamps: true });

const AuthLock = mongoose.models.AuthLock || mongoose.model('AuthLock', lockSchema);

const LOCK_ID                = 'bot-session-lock';
const LOCK_STALE_MS          = 30 * 1000; // lock sem heartbeat há mais de 30s = dono morreu, pode assumir
const HEARTBEAT_INTERVAL_MS  = 10 * 1000;

// Identifica esta execução do processo de forma única (sobrevive a
// reconexões do Baileys dentro do mesmo processo, já que é gerado uma vez
// no carregamento do módulo).
const instanceId = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

let heartbeatTimer = null;
let lockOwned       = false;

/**
 * Tenta adquirir o lock de sessão. Retorna true se conseguiu (era livre,
 * já era nosso, ou o dono anterior está "morto" há mais de LOCK_STALE_MS).
 * Retorna false se outro processo é o dono atual e está com heartbeat vivo.
 */
async function acquireLock() {
  const now             = new Date();
  const staleThreshold  = new Date(now.getTime() - LOCK_STALE_MS);

  const assumido = await AuthLock.findOneAndUpdate(
    {
      _id: LOCK_ID,
      $or: [
        { heartbeatAt: { $lte: staleThreshold } }, // dono anterior parou de bater heartbeat
        { instanceId },                             // já somos o dono (reconexão no mesmo processo)
      ],
    },
    { $set: { instanceId, heartbeatAt: now } },
    { upsert: false, new: true }
  );

  if (assumido) {
    lockOwned = true;
    return true;
  }

  // Documento ainda não existe (primeira vez rodando) — tenta criar.
  try {
    await AuthLock.create({ _id: LOCK_ID, instanceId, heartbeatAt: now });
    lockOwned = true;
    return true;
  } catch (err) {
    if (err?.code === 11000) return false; // outro processo criou primeiro, nesse instante
    throw err;
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    try {
      await AuthLock.updateOne(
        { _id: LOCK_ID, instanceId },
        { $set: { heartbeatAt: new Date() } }
      );
    } catch (e) {
      console.error('⚠️ Erro ao renovar heartbeat da sessão:', e.message);
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.(); // não impede o processo de encerrar sozinho
}

/**
 * Libera o lock (chamado no shutdown gracioso). Só remove o documento se
 * ainda formos o dono — evita apagar o lock de outro processo por engano.
 */
async function releaseLock() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (!lockOwned) return;
  try {
    await AuthLock.deleteOne({ _id: LOCK_ID, instanceId });
  } catch (e) {
    console.error('⚠️ Erro ao liberar lock da sessão:', e.message);
  } finally {
    lockOwned = false;
  }
}

process.on('SIGINT',  () => { releaseLock().finally(() => process.exit()); });
process.on('SIGTERM', () => { releaseLock().finally(() => process.exit()); });

// ─── useMongoAuthState ────────────────────────────────────────────────────────

async function useMongoAuthState() {
  const conseguiu = await acquireLock();

  if (!conseguiu) {
    const lockAtual = await AuthLock.findById(LOCK_ID).lean();
    throw new Error(
      `🔒 Sessão do WhatsApp já está em uso por outra instância ` +
      `(instanceId: ${lockAtual?.instanceId ?? 'desconhecido'}, ` +
      `último heartbeat: ${lockAtual?.heartbeatAt?.toISOString() ?? '?'}). ` +
      `Encerre a outra instância (Render ou local) antes de iniciar esta. ` +
      `Se tiver certeza de que a outra instância já morreu, aguarde até ` +
      `${LOCK_STALE_MS / 1000}s desde o último heartbeat dela e tente de novo.`
    );
  }

  startHeartbeat();

  async function readData(id) {
    try {
      const doc = await AuthData.findById(id).lean();
      if (!doc) return null;
      return JSON.parse(doc.data, BufferJSON.reviver);
    } catch {
      return null;
    }
  }

  async function writeData(id, data) {
    const json = JSON.stringify(data, BufferJSON.replacer);
    await AuthData.findByIdAndUpdate(
      id,
      { data: json },
      { upsert: true, new: true }
    );
  }

  async function removeData(id) {
    try {
      await AuthData.findByIdAndDelete(id);
    } catch {}
  }

  let creds = await readData('creds');
  if (!creds) creds = initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        async get(type, ids) {
          const result = {};
          await Promise.all(ids.map(async (id) => {
            let val = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && val) {
              val = proto.Message.AppStateSyncKeyData.fromObject(val);
            }
            result[id] = val;
          }));
          return result;
        },
        async set(data) {
          await Promise.all(
            Object.entries(data).flatMap(([type, ids]) =>
              Object.entries(ids).map(([id, val]) =>
                val != null
                  ? writeData(`${type}-${id}`, val)
                  : removeData(`${type}-${id}`)
              )
            )
          );
        },
      },
    },
    saveCreds: () => writeData('creds', creds),
  };
}

async function clearMongoAuthState() {
  try {
    await AuthData.deleteMany({});
    console.log('🧹 Credenciais da sessão do WhatsApp limpas com sucesso no MongoDB.');
  } catch (err) {
    console.error('⚠️ Erro ao limpar credenciais da sessão no MongoDB:', err.message);
  }
}

module.exports = { useMongoAuthState, clearMongoAuthState, releaseLock };
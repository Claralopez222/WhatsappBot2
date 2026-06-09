'use strict';

const mongoose = require('mongoose');

// ─── Schema ───────────────────────────────────────────────────────────────────

const authSchema = new mongoose.Schema({
  _id:  { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

const AuthData = mongoose.models.AuthData || mongoose.model('AuthData', authSchema);

// ─── Helper: serializa/deserializa buffers e Uint8Arrays ─────────────────────

function serialize(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => {
    if (v instanceof Uint8Array || Buffer.isBuffer(v)) {
      return { __type: 'Buffer', data: Array.from(v) };
    }
    return v;
  }));
}

function deserialize(obj) {
  return JSON.parse(JSON.stringify(obj), (_, v) => {
    if (v && v.__type === 'Buffer' && Array.isArray(v.data)) {
      return Buffer.from(v.data);
    }
    return v;
  });
}

// ─── useMongoAuthState ────────────────────────────────────────────────────────

async function useMongoAuthState() {
  async function readData(id) {
    const doc = await AuthData.findById(id).lean();
    if (!doc) return null;
    return deserialize(doc.data);
  }

  async function writeData(id, data) {
    await AuthData.findByIdAndUpdate(
      id,
      { data: serialize(data) },
      { upsert: true, new: true }
    );
  }

  async function removeData(id) {
    await AuthData.findByIdAndDelete(id);
  }

  // Carrega creds ou inicializa vazias
  const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
  let creds = await readData('creds');
  if (!creds) creds = initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        async get(type, ids) {
          const result = {};
          await Promise.all(ids.map(async (id) => {
            const val = await readData(`${type}-${id}`);
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

module.exports = { useMongoAuthState };
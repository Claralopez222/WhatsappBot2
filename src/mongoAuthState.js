'use strict';

const mongoose = require('mongoose');
const { initAuthCreds, proto, BufferJSON } = require('@whiskeysockets/baileys');

// ─── Schema ───────────────────────────────────────────────────────────────────

const authSchema = new mongoose.Schema({
  _id:  { type: String, required: true },
  data: { type: String, required: true }, // JSON string
}, { timestamps: true });

const AuthData = mongoose.models.AuthData || mongoose.model('AuthData', authSchema);

// ─── useMongoAuthState ────────────────────────────────────────────────────────

async function useMongoAuthState() {
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

module.exports = { useMongoAuthState };
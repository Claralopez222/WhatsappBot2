'use strict';

const mongoose = require('mongoose');
const os = require('os');
const crypto = require('crypto');

const InstanceLockSchema = new mongoose.Schema({
  _id:         { type: String, default: 'bot-instance-lock' },
  ownerId:     String,
  hostname:    String,
  heartbeatAt: Date,
}, { collection: 'instance_locks' });

const InstanceLock = mongoose.models.InstanceLock || mongoose.model('InstanceLock', InstanceLockSchema);

const OWNER_ID       = crypto.randomUUID();
const HEARTBEAT_MS   = 15_000;
const STALE_AFTER_MS = 45_000; // 3 heartbeats perdidos = considera o dono anterior morto

let heartbeatTimer = null;

/**
 * Tenta assumir o lock. Retorna true se conseguiu (ou já era o dono),
 * false se outro processo com heartbeat recente já está de posse dele.
 */
async function acquireLock() {
  const now             = new Date();
  const staleThreshold  = new Date(now.getTime() - STALE_AFTER_MS);

  const assumido = await InstanceLock.findOneAndUpdate(
    {
      _id: 'bot-instance-lock',
      $or: [
        { heartbeatAt: { $lt: staleThreshold } }, // dono anterior está morto
        { ownerId: OWNER_ID },                    // já somos nós
      ],
    },
    { $set: { ownerId: OWNER_ID, hostname: os.hostname(), heartbeatAt: now } },
    { new: true }
  );

  if (assumido) return true;

  // Documento ainda não existe (primeira vez que o bot roda) — tenta criar.
  try {
    await InstanceLock.create({
      _id: 'bot-instance-lock',
      ownerId: OWNER_ID,
      hostname: os.hostname(),
      heartbeatAt: now,
    });
    return true;
  } catch (e) {
    // E11000 duplicate key: já existe e está com heartbeat vivo — outro processo tem o lock.
    return false;
  }
}

function startHeartbeat() {
  heartbeatTimer = setInterval(async () => {
    try {
      await InstanceLock.updateOne(
        { _id: 'bot-instance-lock', ownerId: OWNER_ID },
        { $set: { heartbeatAt: new Date() } }
      );
    } catch (e) {
      console.error('⚠️ Erro ao renovar instance lock:', e.message);
    }
  }, HEARTBEAT_MS);
}

async function releaseLock() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  try {
    await InstanceLock.deleteOne({ _id: 'bot-instance-lock', ownerId: OWNER_ID });
  } catch (e) {
    console.error('⚠️ Erro ao liberar instance lock:', e.message);
  }
}

module.exports = { acquireLock, startHeartbeat, releaseLock, OWNER_ID };
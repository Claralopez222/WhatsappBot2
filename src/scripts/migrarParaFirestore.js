// scripts/migrarParaFirestore.js
// Uso: node scripts/migrarParaFirestore.js

import mongoose from "mongoose";
import { doc, setDoc } from "firebase/firestore";

import { db } from "../../firebaseConfig.js";

import pkg from "../models/Usuario.js";
const { Usuario } = pkg;

 // ajuste o caminho se necessário
import dotenv      from "dotenv";
dotenv.config();

// ── helpers ──────────────────────────────────────────────────────────────────

/** Remove sufixos de dispositivo do JID, ex: "5565...@s.whatsapp.net:5" → "5565...@s.whatsapp.net" */
function limparJid(jid = "") {
  return jid.split(":")[0].trim();
}

/** Extrai só os dígitos do número a partir do JID */
function numeroDe(jid = "") {
  return jid.split("@")[0].replace(/\D/g, "");
}

// ── migração ──────────────────────────────────────────────────────────────────

async function migrar() {
  // 1. Conecta ao MongoDB
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB conectado.");

  // 2. Busca todos os usuários
  const usuarios = await Usuario.find({});
  const total    = usuarios.length;
  console.log(`📦 ${total} usuário(s) encontrado(s) no MongoDB. Iniciando migração...\n`);

  let migrados = 0;
  let falhas   = 0;

  // 3. Percorre cada usuário
  for (const usuario of usuarios) {
    try {
      // 4. Limpa o JID
      const jidOriginal = usuario.jid ?? usuario.idWhatsApp ?? "";
      const jidLimpo    = limparJid(jidOriginal);
      const numero      = numeroDe(jidLimpo);

      if (!numero) {
        console.warn(`⚠️  Usuário sem número válido (jid: "${jidOriginal}") — pulado.`);
        falhas++;
        continue;
      }

      // O ID do documento no Firestore será o número puro (ex: "5565993354137")
      // Ajuste para jidLimpo se preferir usar o formato "numero@s.whatsapp.net"
      const docId  = numero;
      const docRef = doc(db, "usuarios", docId);

      // 5. Monta o payload — adicione/remova campos conforme seu Model
      const payload = {
        idWhatsApp: jidLimpo                    ?? null,
        xp:         usuario.xp                  ?? 0,
        level:      usuario.level ?? usuario.nivel ?? 1,
        nome:       usuario.nome  ?? usuario.pushName ?? null,
        updatedAt:  new Date(),
      };

      // 6. Salva com merge para não sobrescrever campos extras já existentes
      await setDoc(docRef, payload, { merge: true });

      migrados++;

      // Progresso a cada 10 ou no último
      if (migrados % 10 === 0 || migrados === total) {
        console.log(`🔄 Migrado ${migrados}/${total} usuários...`);
      }

    } catch (err) {
      falhas++;
      console.error(`❌ Erro ao migrar usuário (${usuario.jid ?? usuario._id}):`, err.message);
    }
  }

  // 7. Resumo final
  console.log(`\n✅ Migração concluída!`);
  console.log(`   ✔ Sucesso : ${migrados}`);
  console.log(`   ✘ Falhas  : ${falhas}`);

  await mongoose.disconnect();
  console.log("🔌 MongoDB desconectado. Até mais!");
  process.exit(0);
}

migrar().catch((err) => {
  console.error("💥 Erro fatal na migração:", err);
  process.exit(1);
});
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const app = express();
// ✅ Configure CORS antes de qualquer rota
const allowedOrigins = [
  "https://www.osinvictos.com.br",
  "https://osinvictos.com.br",
  "https://coachappoint.onrender.com",
  "http://localhost:3000" // opcional para testes locais
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir sem header Origin (ex: test via curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(bodyParser.json());

// 🔹 Firebase config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// 🔹 Inicializa Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// 🔹 Inicializa Twilio client
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// 🔹 Função auxiliar para enviar SMS com Twilio
async function sendSMS(phone, message) {
  console.log("🚀 Enviando SMS via Twilio:", phone, message);
  try {
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: phone,
    });
    console.log("📩 Twilio SMS sent:", sms.sid);
  } catch (err) {
    console.error("❌ Twilio SMS error:", err);
  }
}

// ==========================
//  Rota para salvar booking
// ==========================
app.post("/saveBooking", async (req, res) => {
  try {
    const bookingData = req.body;
    console.log("🆕 Novo booking recebido:", bookingData);

    // 🔹 1️⃣ Salva no Firestore
    const docRef = await addDoc(collection(db, "bookings"), {
      ...bookingData,
      timestamp: Date.now(),
    });

    console.log("✅ Booking salvo no Firestore:", docRef.id);

    // 🔹 2️⃣ Condicional: só envia SMS se Firestore salvar com sucesso
    if (docRef.id) {
      console.log("🎯 SUCCESS! Booking saved successfully — enviando SMS...");
      try {
        await sendSMS(
          "+5519988108063",
          `📅 Novo booking!\n👤 Jogador: ${bookingData.payerAddress}\n🕒 Horário: ${bookingData.appointmentTime}`
        );
        console.log("📩 SMS enviado com sucesso ✅");
        res.json({ success: true, id: docRef.id, sms: true });
      } catch (smsErr) {
        console.error("⚠️ Booking salvo, mas erro ao enviar SMS:", smsErr);
        res.json({ success: true, id: docRef.id, sms: false });
      }
    } else {
      console.warn("⚠️ Firestore não retornou ID — SMS não enviado.");
      res.json({ success: false, sms: false });
    }

  } catch (error) {
    console.error("❌ Erro geral ao salvar booking:", error);
    res.status(500).json({ success: false, error: error.message, sms: false });
  }
});

app.get("/test-sms", async (req, res) => {
  console.log("🚀 /test-sms endpoint chamado");
  try {
    await sendSMS("+5519988108063", "🔔 Teste direto do servidor via Twilio!");
    res.send("✅ SMS de teste enviado (verifique o celular e logs)");
  } catch (e) {
    console.error("❌ Erro no /test-sms:", e);
    res.status(500).send("Erro: " + e.message);
  }
});

// 🔹 Endpoint de configuração (para o frontend)
// ✅ Rota que envia Firebase e Supabase configs ao frontend
app.get("/config", (req, res) => {
  console.log("📡 /config solicitado");

  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };

  const supabaseConfig = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
  };

  if (!firebaseConfig.apiKey) {
    console.error("❌ Firebase configuration missing");
  }
  if (!supabaseConfig.supabaseUrl || !supabaseConfig.supabaseKey) {
    console.error("❌ Supabase configuration missing");
  }

  res.json({ firebaseConfig, supabaseConfig });
});

// 🔹 Inicia servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


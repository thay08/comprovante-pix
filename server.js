const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config({ path: __dirname + "/.env" });

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(__dirname));

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS; 
const EMAIL_TO = process.env.EMAIL_TO; 

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

app.post("/send-location", async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ success: false, message: "Latitude e Longitude são obrigatórias." });
  }
  const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
  
  const emailSubject = "⚠️ Nova Localização Recebida!";
  const emailText = `Uma nova localização foi capturada!\n\nLatitude: ${latitude}\nLongitude: ${longitude}\n\nClique para ver no mapa: ${googleMapsLink}`;
  const emailHtml = `
    <h1>⚠️ Nova Localização Recebida!</h1>
    <p>Uma nova localização foi capturada com sucesso.</p>
    <ul>
      <li><strong>Latitude:</strong> ${latitude}</li>
      <li><strong>Longitude:</strong> ${longitude}</li>
    </ul>
    <p>
      <a href="${googleMapsLink}" style="font-size: 16px; padding: 10px 20px; background-color: #4285F4; color: white; text-decoration: none; border-radius: 5px;">
        Abrir no Google Maps
      </a>
    </p>
  `;

  const mailOptions = {
    from: `Servidor de Localização <${EMAIL_USER}>`,
    to: EMAIL_TO,
    subject: emailSubject,
    text: emailText,
    html: emailHtml,
  };

  try {
    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
      console.error("Credenciais de e-mail não configuradas nas variáveis de ambiente.");
      return res.status(500).json({ success: false, message: "Erro de configuração no servidor." });
    }

    await transporter.sendMail(mailOptions);
    console.log(`Localização enviada com sucesso para o e-mail ${EMAIL_TO}`);
    res.status(200).json({ success: true, message: "Localização enviada." });

  } catch (error) {
    console.error("Erro ao enviar o e-mail:", error);
    res.status(500).json({ success: false, message: "Erro interno ao enviar a localização." });
  }
});

const PORT = process.env.PORT || 8088;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});


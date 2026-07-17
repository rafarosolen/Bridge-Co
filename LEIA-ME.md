# 🎉 Quiz ao Vivo (estilo Kahoot)

Sistema de quiz para eventos presenciais: você projeta o telão, o pessoal escaneia o QR Code
com o celular, responde as perguntas e vê a pontuação e o ranking em tempo real.
Suporta 30+ jogadores sem problema.

> ☁️ **Quer que funcione em qualquer rede (4G/5G), sem depender do Wi-Fi local?**
> Veja o guia **HOSPEDAR-NA-NUVEM.md** — hospedagem gratuita no Render.
> Este arquivo explica o modo local (rodando no seu PC).

🔑 **PIN do apresentador**: o telão (`/host`) e a edição de perguntas (`/admin`) pedem um PIN
na primeira ação. O padrão é **1234** (rodando local). Na nuvem, defina o seu próprio
(veja o guia da nuvem). Isso impede que um jogador esperto controle o jogo pelo celular.

## O que você precisa

1. **Node.js** instalado no computador (grátis): https://nodejs.org — baixe a versão LTS e instale (avançar, avançar, concluir).
2. Computador e celulares conectados no **mesmo Wi-Fi**.

## Como usar

### 1. Iniciar o servidor
Dê **clique duplo em `iniciar.bat`** (ou abra um terminal na pasta e rode `node server.js`).

> ⚠️ Na primeira vez, o Windows vai perguntar se permite o Node.js acessar a rede.
> **Marque "Redes privadas" e clique em Permitir acesso.** Sem isso os celulares não conectam.

A janela mostrará os endereços, por exemplo:

```
Telão (projetar):  http://192.168.0.15:3000/host
Perguntas (admin): http://192.168.0.15:3000/admin
Jogadores:         http://192.168.0.15:3000/
```

### 2. Cadastrar as perguntas
Abra o endereço **/admin** no navegador. Adicione as perguntas, marque a alternativa
correta, defina o tempo de cada uma e clique em **Salvar todas**.
As perguntas ficam gravadas no arquivo `questions.json` (não se perdem ao fechar).

### 3. Projetar o telão
Abra o endereço **/host** e projete essa tela. Ela mostra o **QR Code** para o pessoal entrar.

### 4. Jogar
- Cada pessoa escaneia o QR Code, digita o nome e entra.
- Quando todos estiverem dentro, clique em **▶ Iniciar Quiz** no telão.
- A pergunta aparece no telão e os celulares mostram os 4 botões coloridos.
- A pergunta encerra quando o tempo acaba **ou** quando todos respondem.
- O telão mostra a resposta correta e a votação; cada celular mostra se acertou e quantos pontos ganhou.
- Clique em **Mostrar Ranking** e depois **Próxima Pergunta**.
- No final aparece o **pódio** 🥇🥈🥉 e o ranking completo; cada jogador vê a própria posição.

## Pontuação

Igual ao Kahoot: acertou = **500 pontos + até 500 pela velocidade** (quanto mais rápido, mais pontos).
Errou ou não respondeu = 0.

## Dicas e problemas comuns

- **Celular não abre a página**: confira se está no mesmo Wi-Fi do computador e se você permitiu o Node.js no firewall do Windows (veja acima).
- **Wi-Fi de empresa/evento com "isolamento de clientes"**: algumas redes bloqueiam a comunicação entre aparelhos. Nesse caso, crie um **hotspot no próprio notebook** (Configurações > Rede > Hotspot móvel) e conecte os celulares nele.
- **Caiu a conexão de um jogador**: basta escanear o QR de novo — ele volta com o mesmo nome e pontuação (desde que o servidor não tenha sido fechado).
- **Reiniciar tudo**: botão "🔄 Novo jogo" no telão, ou "Reiniciar jogo" na tela de admin.
- **Trocar a porta**: se a 3000 estiver ocupada, rode `set PORT=4000 && node server.js`.

Bom evento! 🎊

# Bridge Automation Quiz

Quiz interativo baseado no treinamento corporativo **Automação de Processos — do processo manual à empresa autônoma**.

## Conteúdo inicial

- 10 perguntas de múltipla escolha.
- 4 alternativas por pergunta.
- Tempo sugerido de 30 segundos.
- Pontuação padrão de 1.000 pontos.
- Explicação exibida após cada resposta.
- Conteúdo distribuído entre fundamentos, descoberta, documentação, arquitetura, desenvolvimento, testes e operação.

## Executar localmente

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

## Estrutura

```text
data/
  questions.json
docs/
  quiz-specification.md
src/
  assets/bridge-logo.png
  main.js
  styles.css
index.html
package.json
render.yaml
README.md
```

## Funcionalidades

- Identificação do participante.
- Perguntas em tela cheia com cronômetro.
- Respostas por clique, toque ou teclas 1–4/A–D.
- Pontuação proporcional ao tempo restante.
- Feedback e explicação após cada resposta.
- Ranking local armazenado no navegador.
- Pódio e resumo de desempenho.
- Layout responsivo para projetor, computador e celular.

## Publicar no Render

O repositório inclui `render.yaml`. No Render, crie um novo **Blueprint**, conecte este repositório e publique a configuração detectada.

> O arquivo `data/questions.json` é a fonte oficial do conteúdo do quiz.

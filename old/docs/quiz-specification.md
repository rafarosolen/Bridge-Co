# Especificação funcional — Bridge Automation Quiz

## Objetivo

Criar uma experiência visual e dinâmica para avaliar o aprendizado ao final do treinamento de automação de processos da Bridge.

## Fluxo principal

1. Abertura do desafio.
2. Identificação do participante.
3. Exibição de uma pergunta por vez.
4. Contagem regressiva de 30 segundos.
5. Escolha entre quatro alternativas.
6. Feedback imediato.
7. Explicação da resposta correta.
8. Atualização do placar.
9. Ranking e pódio ao final.

## Padrão visual das alternativas

| Alternativa | Cor | Símbolo |
|---|---|---|
| A | Vermelho | Triângulo |
| B | Azul | Losango |
| C | Amarelo | Círculo |
| D | Verde | Quadrado |

## Regras de pontuação

- Pontuação-base: 1.000 pontos.
- Resposta incorreta ou não respondida: 0 pontos.
- A implementação poderá aplicar bônus proporcional ao tempo restante.
- Em caso de empate, vence quem acumulou menor tempo total de resposta.

## Modos de apresentação

### Modo apresentação local

O facilitador controla o avanço e projeta a experiência. Adequado para uma primeira versão sem backend em tempo real.

### Modo multiplayer

Participantes entram pelo celular utilizando PIN ou link. Requer backend, persistência temporária da sessão e comunicação em tempo real.

## Publicação no Render

Para uma versão apenas de apresentação, um Static Site é suficiente. Para multiplayer em tempo real, será necessário um Web Service com suporte a WebSocket.

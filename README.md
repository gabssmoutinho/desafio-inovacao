
# Desafio da Inovação — versão final 3.0

## O que foi acrescentado

- Salas privadas com código.
- QR Code para entrada.
- Link direto da sala.
- Até 30 jogadores.
- Nome e avatar.
- 5 rodadas.
- Cronômetro de 60 segundos.
- Pontuação individual calculada no servidor.
- Ranking em tempo real.
- Modo professor/anfitrião.
- Pausar e continuar a rodada.
- Encerrar rodada e avançar.
- Encerrar partida.
- Tela de projeção.
- Aviso quando alguém pontua.
- Reconexão do jogador usando token local.
- Reconexão do anfitrião sem perder a sala.
- Jogadores desconectados ficam reservados por alguns minutos.
- Expiração de salas abandonadas.
- Histórico das últimas partidas em data/games.json.
- Endpoint de desafios e QR.
- Limite de tamanho de respostas e nomes.
- Validação das ações de professor no servidor.

## Rodar no computador

Requisitos: Node.js 18 ou mais recente.

No terminal dentro da pasta:

npm install
npm start

Abra:

http://localhost:3000

Para testar multiplayer no mesmo computador, abra várias abas. Para celulares na mesma rede Wi-Fi, use o IP local do computador, por exemplo:

http://192.168.0.10:3000

Se o celular não conseguir acessar, verifique se o firewall do computador permite a porta 3000.

## Colocar na internet

A aplicação usa Express + Socket.IO e pode ser publicada como Web Service Node.js.
Ela precisa de WebSockets para o multiplayer.

O arquivo server.js escuta a variável PORT e 0.0.0.0, compatível com serviços de hospedagem como Render.

Importante: o histórico em data/games.json é armazenamento local. Em hospedagens com filesystem efêmero, ele não deve ser tratado como banco de dados permanente. Para histórico permanente, conecte Postgres/Key Value ou um disco persistente.

## Fluxo de publicação

1. Crie um repositório GitHub.
2. Envie todos os arquivos desta pasta.
3. Crie um Web Service na hospedagem.
4. Build command: npm install
5. Start command: npm start
6. A hospedagem fornecerá uma URL pública.
7. O professor abre essa URL, cria uma sala e compartilha o QR/código.

## Melhorias futuras de nível plataforma

- Banco Postgres para histórico permanente.
- Conta de professor.
- Turmas e alunos.
- Editor de desafios.
- Equipes.
- Rubrica manual do professor.
- Relatório da turma em PDF/Excel.
- Ranking por turma.
- Badges/conquistas.
- Moderação de respostas.
- Domínio próprio.

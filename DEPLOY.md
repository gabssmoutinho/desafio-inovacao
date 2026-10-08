
# Como colocar online — roteiro simples

## Opção 1: testar sem publicar
No computador:
1. Instale Node.js 18+.
2. Extraia este ZIP.
3. Abra o terminal na pasta.
4. Execute `npm install`.
5. Execute `npm start`.
6. Abra `http://localhost:3000`.

Para celulares na mesma rede Wi-Fi, descubra o IP local do computador e abra `http://IP-DO-COMPUTADOR:3000`.

## Opção 2: publicar para a turma
A aplicação é um Web Service Node.js com Socket.IO. O servidor precisa ficar acessível pela internet e permitir WebSockets.

Uma forma simples é usar um serviço de hospedagem de Web Services como o Render:
- crie um repositório GitHub com os arquivos do ZIP;
- no painel do serviço, crie um Web Service conectado ao repositório;
- Build Command: `npm install`;
- Start Command: `npm start`;
- depois do deploy, abra a URL pública fornecida.

A URL pública pode ser compartilhada com a turma. O professor cria a sala e usa o código ou QR Code.

### Histórico
O arquivo `data/games.json` serve como histórico local. Em hospedagens com filesystem efêmero, ele não é um banco permanente. Para manter histórico depois de reinícios/deploys, use um banco gerenciado ou armazenamento persistente.

### Importante
Não coloque senhas, chaves de API ou dados pessoais de alunos dentro do código ou do repositório público.

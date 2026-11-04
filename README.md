# Soundbard

Mesa de som local para campanhas de RPG. Importe seus áudios, prepare playlists e cenas, combine ambientes e dispare efeitos durante a sessão.

Interface em português, feita com TanStack Start, TypeScript e shadcn/ui. Os dados e arquivos ficam no IndexedDB do navegador; a reprodução usa Web Audio API. Não há conta, serviço de armazenamento remoto ou Docker.

## Executar localmente

Requisitos: Node.js 24.15 ou superior, pnpm, Python 3.12 ou superior e [uv](https://docs.astral.sh/uv/getting-started/installation/). O projeto registra a versão do pnpm em `packageManager`.

```bash
pnpm install
uv sync --extra dev
pnpm dev
```

Abra **http://localhost:3000**. No desenvolvimento, o Vite entrega a interface nesse endereço e encaminha `/api` para o FastAPI interno em `127.0.0.1:8000`. Há uma única API de aplicação, em Python. Os processos são iniciados e encerrados juntos; não é necessário abrir a porta interna no navegador.

Para usar a versão compilada, incluindo preparação do modo offline:

```bash
pnpm build
pnpm start
```

A versão compilada é servida pelo próprio FastAPI em uma única porta, `localhost:3000`. Os scripts Node em `scripts/python.ts` apenas iniciam o Python do ambiente `.venv`; não implementam um segundo backend.

Abra o mesmo endereço e aguarde **“Pronto para offline”**. A interface e os áudios já importados podem então ser reabertos sem conexão. A preparação offline é feita na versão compilada; não no servidor de desenvolvimento.

Use o mesmo navegador, perfil e endereço, incluindo a porta. `localhost` e `127.0.0.1` são origens diferentes e não compartilham automaticamente a biblioteca.

A página principal é a mesa MIDI: pads quadrados para seus sons e playlists, controles do pad selecionado e volume geral sempre acessíveis. Importe arquivos pelo cabeçalho e acione os pads para reproduzir áudio real. Música e ambiente permitem pausar e retomar individualmente; efeitos aceitam disparos sobrepostos.

**Cenas** abre os conjuntos de cenas, **Efeitos** inclui Ambiente e **Personalizado** reúne grupos de pads salvos neste navegador. **Biblioteca** abre a organização dos arquivos, playlists, cenas e backup. **Voltar à mesa** fecha essa área sem interromper a reprodução.

A rota `/previa` mantém a demonstração histórica, com dados fictícios e sem áudio. A mesa funcional fica em **http://localhost:3000/**.

Três estudos de layout dos pads podem ser comparados sem alterar a mesa: [A — Nome central](http://localhost:3000/previa?estudo=pads&variant=A), [B — Ícone e acionamento](http://localhost:3000/previa?estudo=pads&variant=B) e [C — Canal e transporte](http://localhost:3000/previa?estudo=pads&variant=C). São demonstrações sem áudio, com estados em memória; as setas do seletor alternam as opções.

A rodada de referências de hardware claro está em [A — Cerâmica](http://localhost:3000/previa?estudo=hardware&variant=A), [B — Rack OSC](http://localhost:3000/previa?estudo=hardware&variant=B) e [C — Estúdio](http://localhost:3000/previa?estudo=hardware&variant=C). As três opções usam pads quadrados em relevo, título abaixo, volume vertical e toggle de loop. Acionamento, volume e loop podem ser comparados entre versões, com estado somente em memória e sem áudio real.

## Preparar uma sessão

1. Use **Importar áudios** e escolha **Importar do YouTube** ou **Arquivo de áudio**. Após carregar a prévia, ouça e ajuste o corte, o nome, o tipo e as tags antes de adicionar à biblioteca.
2. Em **Biblioteca → Playlists**, selecione músicas, organize a ordem e configure embaralhamento e repetição. Uma música pode participar de várias listas.
3. Em **Biblioteca → Gerenciar cenas**, combine uma playlist, ambientes com volumes e loops próprios, e efeitos disponíveis para disparar.
4. Toque os pads da mesa para combinar sons. Para ativar uma cena inteira e ajustar sua configuração, use **Biblioteca → Mixagem**.
5. Use **Salvar cena** para guardar alterações de volume e loop feitas durante a sessão. Sem salvar, a configuração preparada permanece intacta.

A transição entre cenas leva dois segundos. Ambientes compartilhados e a mesma playlist continuam do ponto atual. Efeitos avulsos podem se sobrepor e terminam normalmente ao trocar a cena.

## Importação, tags e corte

**Arquivo de áudio** aceita MP3, WAV e OGG, individualmente ou em lote. O seletor mostra o nome do arquivo ou a quantidade selecionada, com os nomes listados abaixo. A prévia e a forma de onda do arquivo selecionado carregam automaticamente. No lote, **Arquivo para cortar** escolhe qual áudio editar; os demais entram inteiros, com o mesmo tipo e as mesmas tags. Somente o arquivo selecionado recebe o corte e a alteração de nome. Sem corte, o arquivo local conserva seus bytes e formato originais.

As tags são salvas em um catálogo local. Digite para encontrar uma tag semelhante, selecione uma sugestão ou crie uma nova. A busca ignora diferenças de maiúsculas e acentos e evita duplicatas. As sugestões também estão disponíveis ao editar os áudios existentes. Tags salvas continuam no catálogo mesmo após remover o último áudio que as utiliza; cancelar uma edição não grava as tags em rascunho.

Em **Importar áudios → Importar do YouTube**, cole o link de um vídeo. Após 600 ms sem alterações, o Soundbard consulta o vídeo e carrega automaticamente o áudio completo e a forma de onda. O progresso mostra o download e a análise; a onda aparece quando essas etapas terminam. O download precisa de internet; o arquivo já importado toca localmente como os outros pads. Alterar o link descarta a preparação anterior; fechar cancela o início pendente.

Enquanto prepara a prévia, o botão principal mostra **Carregando áudio…**, fica desabilitado e exibe um indicador de carregamento. Os campos de edição só aparecem depois que a forma de onda está pronta; a tela se posiciona diretamente na seleção do trecho. A barra mostra o progresso disponível e permanece indeterminada durante a consulta inicial e o carregamento da onda.

A forma de onda é calculada do arquivo original pelo FFmpeg, com picos reais de amplitude por janela; silêncio permanece sem amplitude. Não é uma animação ilustrativa. Arraste os marcadores de início/fim ou edite os segundos. A barra de posição permite avançar; **Marcar início** e **Marcar fim** usam o instante atual. **Ouvir seleção** reproduz somente o intervalo escolhido.

Para um áudio já importado, selecione seus controles e abra **Editar pad → Cortar áudio**. A prévia carrega automaticamente. A leitura e o corte são locais, preservando o original.

Após ouvir e conferir a seleção, use **Adicionar à biblioteca**: o Soundbard prepara o trecho escolhido e salva o arquivo em uma única ação. Alterar a seleção conserva a fonte carregada, portanto mudar o corte não exige baixar o vídeo novamente. O corte final usa o original retido, evitando usar o MP3 de prévia como uma etapa adicional de recodificação. Falhas exibem uma mensagem e permitem tentar novamente; não repetem downloads automaticamente.

O FastAPI usa a biblioteca Python yt-dlp para consultar e baixar vídeos individuais; o FFmpeg corta e converte o resultado. O áudio é baixado antes do corte, portanto um intervalo curto ainda pode exigir o download do áudio completo. O yt-dlp usa o Node instalado como runtime JavaScript auxiliar quando necessário para o YouTube, sem criar outra API. O binário FFmpeg instalado no sistema tem preferência; na ausência dele, a dependência `imageio-ffmpeg` fornece um binário local. Não é necessário instalar um backend Node, Docker, ou copiar músicas do cache do Premium.

A preparação mostra progresso e pode ser cancelada. O resultado pronto permanece disponível até a importação confirmada, o cancelamento ou o fechamento do diálogo. Tarefas com erro têm seus arquivos temporários limpos; tarefas concluídas sem acesso expiram após uma hora. O backend não guarda a biblioteca permanente: ela continua no IndexedDB. Intervalos precisam respeitar a duração; arquivos enviados têm limite de 256 MB e vídeos precisam ser gravados, com até oito horas. Downloads têm limite de 512 MB. Playlists completas, vídeos privados e uso de contas/cookies não estão incluídos.

Os downloads oficiais do Premium são cifrados e não podem ser importados diretamente. Utilize conteúdo e fontes cujo download e uso sejam permitidos. [Pesquisa e referências](docs/research/youtube-downloads.md).

## Backup e recuperação

O botão **Exportar backup** no cabeçalho da Biblioteca baixa um arquivo `.soundbard` com os áudios, cenas, playlists, catálogo de tags e configurações. Backups antigos continuam aceitos: as tags dos áudios formam o catálogo inicial. O botão **Restaurar backup** lê e verifica o arquivo antes de pedir confirmação.

Restaurar **substitui** a biblioteca atual. Cancelar ou fornecer um backup inválido mantém os dados existentes. Para transferir a biblioteca, exporte no navegador original e restaure no destino.

Os grupos personalizados de pads ficam no armazenamento local deste navegador e ainda não entram no arquivo de backup da biblioteca.

Os arquivos locais dependem do armazenamento do navegador. Limpar os dados do site remove a biblioteca; exporte backups para conservar uma cópia recuperável. A capacidade disponível depende do navegador e do espaço do dispositivo.

## Verificações

```bash
pnpm typecheck
pnpm lint
pnpm lint:backend
pnpm test
pnpm test:backend
pnpm exec playwright install chromium
pnpm test:browser
```

Para verificar também a versão compilada sem conexão:

```bash
pnpm build
pnpm exec playwright test --config playwright.production.config.ts
```

Os testes de navegador gerenciam o servidor na porta 3000. Encerre outro servidor nessa porta antes de executar o teste de produção.

As regras de qualidade usam Ultracite com Biome. `pnpm lint` verifica o projeto; `pnpm lint:fix` aplica as correções automáticas. Os comandos ficam em `package.json`.

## Documentação

- [Escopo e critérios de aceitação](docs/design.md)
- [Vocabulário do produto](GLOSSARY.md)
- [Stack e execução local](docs/adr/0002-stack-tanstack-e-execucao-local.md)
- [Backend FastAPI e processamento local](docs/adr/0003-fastapi-e-processamento-local.md)
- [Pesquisa de projetos semelhantes](docs/research/github-audio-projects.md)
- [Limites do armazenamento no navegador](docs/research/browser-audio-storage.md)
- [Resultados e alcance da validação](docs/validation.md)

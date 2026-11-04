# FastAPI e processamento local de áudio

Decisão aprovada pelo usuário em 3 de novembro de 2026: o novo backend de download e corte será Python com FastAPI. Esta decisão substitui o servidor estático Node e a ausência de API da ADR 0002, preservando TanStack Start, TypeScript, pnpm, Tailwind e shadcn na interface.

## Responsabilidades

O navegador mantém a biblioteca no IndexedDB e a reprodução em Web Audio. O FastAPI consulta metadados de vídeos individuais do YouTube, prepara downloads, recebe arquivos para corte e entrega o MP3 resultante. A biblioteca Python yt-dlp faz a extração; FFmpeg faz o corte e a conversão. Nenhuma dessas ferramentas é reimplementada em TypeScript.

Os trabalhos usam uma fila local com um trabalhador, progresso, cancelamento e arquivos temporários separados da biblioteca. A interface confirma a gravação no IndexedDB antes de encerrar uma tarefa concluída. Fechar ou cancelar uma tarefa descarta apenas os arquivos preparados pelo backend; o original permanece intacto.

## Execução

`uv sync --extra dev` instala dependências Python em `.venv`, seguindo `uv.lock`. `pnpm start` inicia esse Python e o FastAPI serve a interface compilada e a API em `127.0.0.1:3000`. O pequeno lançador Node apenas escolhe o executável Python conforme a plataforma e encaminha sinais de encerramento.

No desenvolvimento, `pnpm dev` inicia Vite em 3000 e FastAPI em uma porta interna 8000, com proxy para `/api`. O endereço usado pelo usuário permanece `http://localhost:3000`. O Vite é ferramenta da interface; não existe uma segunda API de aplicação em Node.

## Contrato inicial

- `GET /api/health`: disponibilidade do processamento.
- `POST /api/youtube/metadata`: metadados de um vídeo identificado por URL HTTPS do YouTube.
- `POST /api/audio-jobs`: cria uma tarefa de download com intervalo opcional.
- `POST /api/audio-jobs/upload`: cria um corte a partir de arquivo enviado em multipart.
- `GET /api/audio-jobs/{id}`, `GET /api/audio-jobs/{id}/file` e `DELETE /api/audio-jobs/{id}`: progresso, arquivo pronto e cancelamento/limpeza.

Tarefas são temporárias e não entram no cache do service worker. A API fica vinculada ao loopback, aceita hosts locais e rejeita origens externas. URLs são normalizadas para vídeos individuais do YouTube antes da consulta; não são aceitas URLs arbitrárias ou diretórios de saída fornecidos pelo cliente. O arquivo convertido não é servido antes do estado pronto.

## Prévia real antes do corte

O usuário escolheu ouvir e navegar pelo áudio antes de confirmar o corte, com forma de onda calculada a partir do arquivo real. A preparação passou a distinguir uma fonte completa de um trecho final, sem modificar o contrato dos clientes antigos:

- `POST /api/audio-jobs` e `POST /api/audio-jobs/upload` aceitam `purpose: "preview"` ou `purpose: "clip"`. O padrão continua sendo `clip`. No multipart, `purpose` é um campo do formulário.
- Uma tarefa `preview` exige `start: 0` e `end: null` ou ausente: a fonte inteira precisa estar disponível para escolher o intervalo. Ela conserva a cópia do arquivo original, prepara o MP3 para reprodução e calcula a forma de onda antes de anunciar o estado `ready`.
- `GET /api/audio-jobs/{id}/waveform` retorna `{ duration, peaks }` para uma prévia pronta. A duração corresponde à fonte original. Os picos ficam entre zero e um e representam até 1024 janelas consecutivas medidas pelo FFmpeg, incluindo silêncio e diferenças de amplitude. A análise considera os canais sem cancelar sinais estéreo opostos. Não há barras aleatórias, animação ilustrativa ou imagem gerada.
- `POST /api/audio-jobs/{id}/clips`, com `{ name, start, end }`, cria outra tarefa a partir do original retido pela prévia. O backend copia essa fonte antes de responder; o corte pode continuar mesmo que a prévia seja descartada em seguida. O MP3 intermediário não é usado como origem do corte, evitando uma recodificação adicional.

A análise usa filtros nativos do FFmpeg para agregar os picos por janela. Apenas o resultado compacto é salvo em JSON e enviado à interface; o navegador não precisa decodificar horas de áudio em memória para desenhar a onda. Esse fluxo reutiliza as dependências existentes de FFmpeg, yt-dlp e FastAPI, sem adicionar bibliotecas para gerar a visualização. A implementação está em [media.py](../../backend/media.py), com os contratos HTTP em [app.py](../../backend/app.py).

Prévia e corte são tarefas temporárias independentes. A interface pode conservar a fonte para ajustar e ouvir diferentes intervalos, e deve descartar os identificadores das duas tarefas ao concluir ou fechar o fluxo. Cancelar interrompe o processamento cooperativo e encerra um FFmpeg ativo; consultas síncronas do extrator podem aguardar resposta ou timeout. Erros e cancelamentos removem os arquivos preparados. Tarefas concluídas sem acesso expiram após uma hora, com limpeza oportunista ao criar uma nova tarefa; consultar a tarefa, seu arquivo ou a forma de onda renova esse prazo. A biblioteca persistente e o arquivo original do usuário não são apagados por essa limpeza.

## Limites

O primeiro fluxo entrega MP3, aceita arquivos MP3/WAV/OGG de até 256 MB e vídeos gravados com até oito horas. Downloads são limitados a 512 MB. O usuário pode ouvir o trecho local e o arquivo preparado antes de adicioná-lo. Não há contas, cookies de sessão, exportação de downloads protegidos do Premium ou download de playlists inteiras.

A escolha de Python facilita o uso direto da API do yt-dlp e de seus eventos. Não representa uma promessa de velocidade superior ao Node: rede, extração e FFmpeg continuam determinando grande parte do tempo. Não foi usada comparação artificial de frameworks para justificar a decisão.

Fontes: [integração Python do yt-dlp](https://github.com/yt-dlp/yt-dlp#embedding-yt-dlp), [arquivos no FastAPI](https://fastapi.tiangolo.com/tutorial/request-files/), [arquivos estáticos](https://fastapi.tiangolo.com/tutorial/static-files/).

O yt-dlp também pode usar o executável Node já instalado como runtime JavaScript auxiliar para resolver os desafios do YouTube. Isso não cria uma API Node nem reescreve o extrator. Nesta primeira implementação, o áudio do vídeo é baixado antes do corte; selecionar um intervalo não garante transferência somente desse trecho.

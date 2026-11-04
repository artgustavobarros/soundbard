# YouTube, downloads e biblioteca local

Pesquisa consultada em **3 de novembro de 2026**. Pergunta: quais projetos e experiências ajudam a transformar fontes do YouTube em arquivos para a mesa do Soundbard, e se os downloads do Premium podem ser importados.

Foram lidos READMEs oficiais, documentação do YouTube e relatos dos próprios usuários no Reddit. Nenhum programa foi instalado ou executado, nenhuma música foi baixada e nenhuma conta ou cookie foi usado. A presença de um recurso no README não equivale a um teste de funcionamento atual.

## Resposta sobre o Premium

O download oferecido pelo YouTube Premium é para reprodução offline dentro do YouTube. A documentação informa que os vídeos salvos ficam criptografados e que o aplicativo não fornece arquivos de áudio ou MP3. Portanto, esse download não produz um arquivo que possamos selecionar em **Importar áudios** no Soundbard. Assinar Premium não transforma esse armazenamento em uma biblioteca exportável. [Ajuda oficial do YouTube](https://support.google.com/youtube/answer/7381437?hl=pt-BR).

Isso é diferente de obter um arquivo comum por outra ferramenta ou receber o arquivo original do autor. A capacidade técnica de baixar e a autorização para baixar ou reutilizar uma obra são questões diferentes. Os recursos dos projetos abaixo não representam uma autorização do YouTube nem dos titulares do conteúdo; os [Termos do YouTube](https://www.youtube.com/static?template=terms) devem ser considerados separadamente da licença do software.

## Projetos úteis no GitHub

| Projeto | Recurso confirmado | Aplicação ao Soundbard |
| --- | --- | --- |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Ferramenta de linha de comando para baixar mídia; extração de áudio, escolha do formato, playlists e arquivo de histórico para evitar downloads repetidos. | Principal referência para uma futura integração local. A extração/conversão usa FFmpeg e ffprobe. O README recomenda também `yt-dlp-ejs` e um runtime JavaScript compatível; não é somente instalar uma biblioteca no frontend. [Dependências](https://github.com/yt-dlp/yt-dlp#dependencies), [pós-processamento](https://github.com/yt-dlp/yt-dlp#post-processing-options). |
| [Parabolic](https://github.com/NickvisionApps/Parabolic) | Interface gráfica sobre yt-dlp, com saída MP3/WAV e outros formatos, downloads concorrentes e distribuições para Windows, Linux e macOS. | Candidato para preparar arquivos externamente e usar a importação que já existe. Evita construir uma tela de download antes de validar esse fluxo. Plataformas e recursos foram confirmados no [README oficial](https://github.com/NickvisionApps/Parabolic/blob/main/README.md), sem instalação ou teste dos pacotes. |
| [DiceAudio](https://github.com/YannCharbon/DiceAudio) | Aplicação de áudio para RPG com cenas em camadas e downloader integrado: inserir várias URLs, escolher pasta e importar os resultados diretamente na biblioteca. O README também descreve importação de arquivos existentes. | Referência próxima da experiência desejada: link, preparação e biblioteca local. É um aplicativo Windows com .NET MAUI/Blazor, e não um website independente equivalente ao Soundbard. [Descrição do downloader e da aplicação](https://github.com/YannCharbon/DiceAudio#what-it-does). |
| [simple-soundboard](https://github.com/vietjtnguyen/simple-soundboard) | O próprio autor descreve um fluxo de YouTube → youtube-dl → Audacity → OGG. Alguns arquivos foram editados manualmente para fechar o loop. | Referência direta para preparar trechos curtos e loops antes de atribuí-los aos pads. É um relato de implementação, não prova de manutenção ou recomendação atual de youtube-dl. A licença do código não deve ser presumida como licença de todos os áudios demonstrativos. [Seção Audio](https://github.com/vietjtnguyen/simple-soundboard#audio). |

Um candidato complementar é [Ambora](https://github.com/xetorthio/ambora): o README combina arquivos locais com YouTube, mas declara **YouTube IFrame API** na arquitetura. Isso confirma reprodução incorporada, não um downloader que converta URLs em arquivos. [README](https://github.com/xetorthio/ambora#readme).

## O que apareceu no Reddit

Estes são relatos e pedidos dos participantes, úteis para entender o uso durante sessões. Não são documentação técnica ou autorização para reutilizar conteúdo.

1. **[r/selfhosted: baixar apenas um trecho para usar no Foundry](https://www.reddit.com/r/selfhosted/comments/1kp6qt5/any_youtube_downloader_that_can_allows/).** O autor relata que já converte vídeos para MP3 com MeTube para suas partidas de D&D. Sua dificuldade são vídeos de mais de uma hora: deseja indicar início e fim antes de baixar. As respostas apontam yt-dlp. Ideia relevante: importar apenas o trecho necessário, em vez de carregar um longo vídeo inteiro para um efeito ou ambiente curto. O suporte a intervalos aparece também nas [opções oficiais do yt-dlp](https://github.com/yt-dlp/yt-dlp#download-options).
2. **[r/DnD: botões para uma biblioteca de músicas do YouTube](https://www.reddit.com/r/DnD/comments/1jktglv/app_for_quick_access_to_my_dnd_music_folder/).** Um mestre descreve centenas de músicas em playlists e quer acionamento por botões, no estilo Stream Deck, em um tablet. Uma resposta sobre Audio Forge distingue URLs do YouTube da importação de MP3. O pedido é muito próximo dos pads do Soundbard, mas a discussão não demonstra que links e arquivos locais tenham os mesmos controles.
3. **[r/DungeonsAndDragons: mesa com ambientes longos](https://www.reddit.com/r/DungeonsAndDragons/comments/zp47z6/dm_soundboard/).** O autor usa um soundboard Android com ambientes de uma a três horas e recomenda consultar os criadores sobre permissão para baixar seus trabalhos. Demonstra o valor de manter ambientes preparados por botão; não confirma que todas as faixas do YouTube tenham download ou reutilização autorizados.

## Caminho que já funciona no projeto

Esta é uma recomendação de arquitetura a partir das fontes, não uma integração implementada:

1. Obter um arquivo permitido, preferindo o download original disponibilizado pelo criador quando existir. Para avaliar um downloader externo, Parabolic oferece interface e yt-dlp oferece automação.
2. Preparar o resultado como **MP3, WAV ou OGG**. O Soundbard aceita essas extensões tanto no seletor quanto na validação da importação: [editor](../../src/components/editors.tsx), [repositório](../../src/lib/repository.ts). Um resultado `.m4a` ou `.opus` não é aceito atualmente; não basta renomear a extensão.
3. Usar **Importar áudios** na mesa atual. A partir desse ponto, o Soundbard opera sobre o arquivo local, com os controles e a persistência existentes, sem depender do player do YouTube durante a sessão.

Para oferecer **colar URL e importar** dentro do próprio Soundbard, o processamento precisa executar fora do JavaScript da página. Após esta pesquisa, o usuário escolheu um backend Python com FastAPI, usando diretamente a biblioteca yt-dlp e executando FFmpeg. A interface permanece TypeScript; a biblioteca permanece no navegador. [Decisão aprovada](../adr/0003-fastapi-e-processamento-local.md), [servidor atual](../../backend/app.py).

Uma integração futura teria de tratar progresso, falhas, cancelamento, saída em formato aceito e limpeza dos arquivos temporários. Não existe benefício em alterar o motor de áudio para o fluxo externo: ele recebe o arquivo final pela importação já implementada.

## Limites desta pesquisa

Não foi validada compatibilidade dos downloaders com um vídeo específico, com restrições de conta ou com versões instaladas no computador. Nenhum recurso para exportar ou decifrar o cache protegido do Premium foi pesquisado ou implementado. Não há promessa de funcionamento contínuo de extratores: o yt-dlp mantém [orientações de atualização e canais](https://github.com/yt-dlp/yt-dlp#update) para acompanhar problemas e mudanças dos serviços.

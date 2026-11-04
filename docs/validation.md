# Validação da primeira versão

Registro inicial em 2 de novembro de 2026; atualizações datadas nas seções abaixo. Ambiente: Linux, Node.js 24.16, pnpm e Chromium por Playwright. Os arquivos importados nos testes são tons sintéticos identificados como dados de teste.

## Resultados registrados

| Verificação | Resultado |
| --- | --- |
| Qualidade e tipagem | Ultracite sem erros; `tsc --noEmit` passou. Ultracite Doctor confirmou Biome e ausência de ferramentas de formatação/lint conflitantes. |
| Testes unitários | 19 testes passaram com `pnpm test`. |
| Fluxos no navegador | 7 testes passaram com `pnpm exec playwright test`. |
| Versão compilada offline | 2 testes passaram com `pnpm exec playwright test --config playwright.production.config.ts`, após `pnpm build`. |
| Formatos | WAV gerado nos testes, MP3 e OGG/Vorbis decodificados e reproduzidos; WAV inválido recusado sem apagar os arquivos válidos. |
| Biblioteca e reprodução simultânea | 100 arquivos WAV curtos importados; 10 elementos de áudio reproduzindo simultaneamente, com posição avançando no navegador. |
| Acessibilidade e layout | Nenhuma violação crítica ou séria no cenário desktop examinado por axe; captura mobile de 390 px sem transbordamento horizontal. |

Os fluxos de navegador também verificam música em várias playlists, remoção independente, avanço automático, avanço manual em repetição da música atual, continuidade entre cenas, efeitos sobrepostos, salvamento de ajustes, pausa/retomada, foco de teclado, backup em outro contexto de navegador e preservação de dados ao cancelar ou fornecer backup inválido.

## Verificação da versão compilada

Os testes de produção abriram a interface e reproduziram o áudio após retirar a conexão, abriram uma segunda aba sem rede e fecharam o navegador para reabrir um perfil persistente sem conexão. A biblioteca e o cache foram recuperados do perfil. A lista de erros não tratados permaneceu vazia na inicialização e na reabertura das páginas.

As verificações de reprodução usam a política normal de autoplay do Chromium, com clique explícito do usuário nos controles. Não há flag para liberar reprodução sem gesto.

O primeiro teste havia identificado uma divergência de hidratação entre a boundary do shell SPA do TanStack Start e o conteúdo inicial da rota. A rota mantém agora a mesma boundary durante a hidratação e só monta a aplicação após o cliente estar pronto. O cenário foi repetido com o build normal e passou, sem ignorar ou suprimir erros do React.

## Alcance

- A validação automatizada usa Chromium. Firefox, Safari e dispositivos móveis reais não foram verificados.
- O cenário com 100 arquivos usa WAVs sintéticos de dois segundos; não constitui uma medição de bibliotecas com vários gigabytes.
- Avanço de posição, pausa e presença das instâncias verificam reprodução no navegador. Não medem latência de saída, qualidade acústica ou o dispositivo físico de som.
- Não foi forçada a falta de espaço no navegador. Capacidade e persistência continuam sujeitas às políticas de armazenamento descritas na pesquisa técnica.

## Evidências locais

As capturas `.qa/desktop.png` e `.qa/mobile.png` são geradas pelo teste da mesa de som e foram abertas para inspeção. A pasta `.qa` é ignorada pelo controle de versão.

O detector mecânico de design do Impeccable não reportou ocorrências nos componentes, rotas e estilos examinados. Essa verificação não substitui os testes de comportamento ou a inspeção das capturas.

## Revisão MIDI em `/previa`

A prévia foi migrada para uma rota TanStack em TSX, com classes Tailwind e Button, Carousel, Tabs e Slider do shadcn/ui. A interface demonstra estados, sem executar áudio nem alterar a biblioteca. A revisão foi validada usando as skills `browser-testing-with-devtools`, `webapp-testing` e `mobile-native`.

- Ultracite verificou 55 arquivos sem erros; TypeScript e os 19 testes unitários passaram. A compilação com preparação offline passou.
- Os sete testes de navegador da aplicação principal passaram. Dois testes da prévia passaram, incluindo pads quadrados, parada geral, carrosséis de pads e canais, preservação de estado ao alternar abas, e ajuste do volume por teclado.
- Chromium foi examinado em 320 × 568, 375 × 667, 390 × 844, 768 × 1024 e 844 × 390. Os pads mantiveram proporção 1:1 e não houve rolagem da página no layout móvel. O desktop de 1440 px mantém pads de aproximadamente 178 px e cinco colunas.
- A inspeção interativa por Chrome DevTools confirmou nomes acessíveis dos sliders, avanço do carrossel de canais, respostas HTTP 200 para os recursos carregados e console sem erros ou avisos. Axe não encontrou violações críticas ou sérias nas abas Pads, Canais e Playlist examinadas.
- Swipe com eventos de toque emulados avançou os pads. Recarga e acesso às rotas principal e de prévia funcionaram sem conexão após preparar o cache pela aplicação. A prévia também foi aberta com `pnpm dev`, sem erros do React.

Durante a verificação, foram corrigidos o nome acessível do Slider, o reset do carrossel ao ocultar uma aba, a interferência de um elemento oculto na medição dos canais e a divergência entre os nomes acessíveis dos pads e seu texto visível.

O React Doctor terminou sem erros, com 15 avisos e score 61/100. Não foi possível usar comparação por `HEAD`, pois não há commit-base; a leitura foi completa. Os avisos novos incluem o contrato oficial `setApi` do Carousel (uma notificação quando a instância é criada, não a cada mudança de estado), o volume demonstrativo inicializado a partir de dados estáticos e um export de variantes do shadcn. Permanecem avisos anteriores sobre pequenas buscas em arrays, exports e detecção de object URLs cujo descarte já foi verificado. Nenhuma regra foi desativada. O valor do Context do Carousel foi estabilizado.

Essas verificações usam navegador e emulação. Safari, Firefox, áreas seguras reais, sensação do gesto e áudio em aparelho físico continuam fora do alcance desta rodada. As evidências visuais estão em `.qa/tanstack-mobile-final.png`, `.qa/tanstack-channels-final.png` e `docs/layout/soundboard-v2.png`.

## Arraste livre e grade adaptativa

O pedido seguinte removeu setas e paginação dos carrosséis e ampliou a densidade em telas intermediárias. A prévia passa a usar `dragFree` em bancos, pads e canais. A quantidade de colunas e linhas dos pads considera a área real do painel, sem ampliar os quadrados além de 178 px. Em vez de uma tela desktop empilhada, a altura da interface permanece contida no viewport.

Foram verificadas larguras e alturas de 320 × 568, 390 × 844, 768 × 1024, 844 × 390, 1024 × 768, 1024 × 1366 e 1440 × 1000. Em 390 px há quatro pads completos visíveis; em 1024 px há seis na primeira linha e todos os 16 exemplos aparecem ao mesmo tempo. Os pads permanecem quadrados, as setas de carrossel não existem no DOM e não há rolagem da página nos tamanhos examinados. A grade de 1024 × 1366 tem espaço para seis linhas; os dados demonstrativos continuam limitados aos 16 sons existentes.

`pnpm check` passou: Ultracite, TypeScript, 19 testes unitários e build. Os três E2E atualizados da prévia passaram no build final, incluindo arraste de pads e canais com mouse, ausência de cliques involuntários, preservação de seleção/posição/volume entre abas, seis colunas em 1024 px e parada do mixer totalmente dentro do viewport desktop. O cenário móvel foi repetido para conferir a estabilização da inércia antes de medir posições. Chrome DevTools confirmou seis colunas em 1024 px, console limpo e oito recursos carregados com HTTP 200.

As evidências atuais são `.qa/free-drag-phone.png`, `.qa/free-drag-1024.png`, `.qa/free-drag-desktop.png` e `docs/layout/soundboard-v2.png`. O React Doctor manteve 61/100, sem erros e com os mesmos 15 avisos já analisados. A verificação continua limitada ao Chromium emulado; o teste em aparelho físico permanece pendente.

## Mesa única com pads de playlists

A rodada seguinte investigou redimensionamento contínuo em vez de somente tamanhos isolados. O diagnóstico encontrou saltos reais, como 172 para 126,5 px ao passar de 1133 para 1134 px. O tamanho calculado a partir de contagens inteiras e o aviso condicional realimentavam o cálculo; o breakpoint de painéis em 1280 px também alterava bruscamente a área dos pads.

O usuário esclareceu que uma playlist deve ser o conteúdo do próprio pad, operado como mesa MIDI. A prévia passou a ter uma única grade e uma faixa fixa de controles, sem abas ou painéis separados. Os pads têm tamanho nominal estável de 158 px, reduzido somente para caber na área disponível. A quantidade de linhas e colunas é calculada depois, com o espaço horizontal restante distribuído entre as colunas. O aviso ocupa espaço constante e não há troca estrutural em 1280 px.

No build final, passaram 11 E2E: quatro da mesa nova e sete da aplicação principal. Os cenários verificaram:

- Tocar, pausar e retomar “Caminhada à noite”, avançar a faixa de sua playlist e ajustar volumes, mantendo “Lareira” em reprodução demonstrativa.
- Personalizar o nome do pad e associar a playlist “Confronto”. Essas alterações só existem no estado da prévia.
- Arraste sem acionar pads ou perder estado e posição ao ajustar o volume.
- Varredura sequencial de 75 larguras entre 320 e 1920 px, com altura de 768 px e pontos adicionais em 985/986/987 e 1279/1280/1281: nenhum pad deixou de ser quadrado ou excedeu 179 px, nenhum salto superior a 2 px entre amostras acima de 400 px, margens equilibradas nas linhas completas e controles sempre inteiramente visíveis. Não houve rolagem horizontal ou vertical da página.

Capturas adicionais examinaram 390 × 844, 320 × 568, 768 × 1024 e 844 × 390. Foi corrigida a largura intrínseca do pad de playlist em 320 px e o transporte recebeu sua própria coluna para não sobrepor o nome. Os alvos de seleção de controles têm 44 px. O celular de 390 px mostra quatro pads inteiros; a primeira linha de 1024 px contém seis.

`pnpm check` passou: Ultracite em 55 arquivos, TypeScript, 19 testes unitários e build. Axe não encontrou violações críticas ou sérias na mesa e no diálogo de personalização em 390 px. A inspeção por Chrome DevTools verificou que o pad da playlist entrava no estado “Tocando”, preservando os demais, com console sem avisos ou erros e página contida em 1024 × 768. O React Doctor terminou sem erros, com 14 avisos e score 65/100; permanecem os avisos conhecidos já analisados nas rodadas anteriores.

Evidências atuais: `.qa/midi-phone.png`, `.qa/midi-small.png`, `.qa/midi-1024.png`, `.qa/midi-1280.png`, `.qa/midi-desktop.png`, `.qa/midi-landscape.png`, `.qa/midi-customize.png` e `docs/layout/soundboard-v2.png`. A prévia demonstra reprodução por estado visual: não produz áudio nem persiste os pads, e o toque em aparelho físico continua sem validação.

## Grade CSS, categorias e grupos salvos

O usuário retirou o tamanho fixo anterior. A investigação visual mostrou que apenas verificar simetria e overflow não detectava a distribuição ruim: em 685 px havia três pads de 158 px separados por gaps de 93,5 px; em 839 px, quatro separados por 61 px. O afastamento entre título e primeira linha chegava a 111 px. A correção usa tracks calculadas por CSS Grid/Tailwind, gaps constantes e alinhamento no início da área. O observador lê o tamanho definido pelo CSS somente para agrupar slides do Embla.

No build final:

- `pnpm check` passou com Ultracite em 60 arquivos, TypeScript, 26 testes unitários e build. Sete testes novos verificam grupos salvos, validação da leitura, deduplicação, referências desconhecidas e falhas de armazenamento.
- Os 13 E2E passaram: sete da aplicação principal e seis da prévia. Incluem playlist dentro do pad, personalização, arraste, categorias, filtros e grupo de dois pads reaberto após recarregar, sem parar um som fora do grupo.
- A varredura cobre 81 larguras de 320 a 1920 px e pontos vizinhos a 685/839 px. Não exige mais tamanho fixo: verifica quadrados, gaps constantes, densidade, ausência de espaço residual suficiente para outro pad e proximidade do título. Em 685 px foram medidas cinco colunas de 124,19 px; em 839 px, seis de 127,5 px. A distância título–pads ficou em 8,31 px. Gaps são de 10 px.
- As verificações adicionais em 320 × 568, 390 × 844 e 568 × 320 confirmaram que os controles permanecem inteiros na tela, sem rolagem da página. Cabeçalho e navegação quebram linha conforme seus conteúdos; a faixa de controles também usa flex-wrap, sem faixas especiais de viewport para essas medidas.
- Cenas organiza Personagens, Locais e Combate; Ambiente fica em Efeitos. O primeiro submenu lateral ultrapassava a tela de 320 px, então foi substituído por navegação no mesmo menu, com Voltar. Navegação e criação de grupo passaram por axe sem violações críticas/sérias, interação por teclado e console sem erros ou avisos.

Os grupos da prévia são persistidos em `soundbard-preview-pad-groups`, separados do IndexedDB da biblioteca real. A leitura inválida não é gravada nem apagada automaticamente, e falha de gravação mantém o diálogo aberto com recuperação. Atribuições individuais dos pads e áudio continuam demonstrativos nesta rota.

O React Doctor permaneceu sem erros, com score 65/100 e 16 avisos; os dois avisos adicionais são buscas em pequenas listas de IDs de pads ao filtrar cenas e grupos. Nenhuma regra foi suprimida.

Evidências atuais em `.qa/fluid-nav-small.png`, `.qa/fluid-nav-phone.png`, `.qa/fluid-nav-685.png`, `.qa/fluid-nav-839.png`, `.qa/fluid-nav-short.png`, `.qa/fluid-nav-wide.png`, `.qa/fluid-nav-combat-menu.png`, `.qa/fluid-nav-create-group.png` e `docs/layout/soundboard-v2.png`. A validação móvel continua sendo emulada; aparelho físico, Safari e Firefox não foram verificados.

A rodada final do menu em um único painel passou novamente nos 13 E2E (25,2 s), após tornar a navegação não modal. Axe confirmou ausência de violações críticas/sérias tanto no menu Combate aberto em 320 px quanto no diálogo de grupos; navegação por teclado e console também passaram. A versão compilada permaneceu servida em `http://localhost:3000/previa` com HTTP 200.

## Ícone monocromático e importação de músicas — 3 de novembro

O ícone da aba passou a usar fundo `#111111` e traços `#f5f5f5`, com o novo endereço `/favicon-monochrome.svg` para evitar reutilizar o ícone verde em cache. O símbolo e o ponto da marca na aplicação principal também passaram a branco/cinza. O novo SVG foi servido com HTTP 200 e seu endereço foi confirmado nas rotas `/` e `/previa`. Evidência visual em `.qa/favicon-monochrome.png`.

Ultracite, TypeScript e build passaram. Os sete E2E da aplicação principal passaram novamente em 13,4 segundos, confirmando WAV/MP3/OGG, rejeição de arquivo inválido sem perder os válidos, reprodução real com avanço de `currentTime`, pausa/retomada, persistência após recarregar, playlists, cenas e backup. A importação de 100 arquivos e reprodução simultânea de 10 vozes também passaram.

Uma inspeção adicional em `http://localhost:3000/` importou um WAV de 15 segundos classificado como Música, reproduziu, pausou, retomou, parou e recarregou a página. O arquivo continuou disponível na Biblioteca e não houve erros não tratados no console. Capturas em `.qa/music-import-dialog.png` e `.qa/music-import-library.png`. As execuções usaram contextos isolados; não foi alterada a biblioteca do usuário.

A importação real está na aplicação principal, pelo botão “Importar áudios”. A mesa MIDI em `/previa` continua demonstrativa e ainda não importa ou reproduz arquivos reais. Os arquivos usados nos testes são tons sintéticos em formatos válidos; não se verificaram músicas fornecidas pelo usuário, saída de áudio física, Firefox ou Safari.

## Mesa principal conectada ao áudio — 3 de novembro

A página `/` passou a usar o layout MIDI aprovado em `/previa`. Os mesmos componentes de pads, carrossel e controles agora recebem sons e playlists reais do IndexedDB. A importação deixa os arquivos disponíveis na mesa sem exigir outra rota. Biblioteca, playlists, preparação de cenas, mixagem e backup ficam em um diálogo de organização; fechar o diálogo mantém o motor e os áudios ativos. O tema dessa área e dos editores também passou a tons neutros.

Pads de música e ambiente podem pausar/retomar individualmente; efeitos continuam permitindo disparos sobrepostos. Sons avulsos classificados como Música podem coexistir, removendo a exclusividade herdada da antiga função de pré-escuta. O transporte de playlist continua usando uma única fila ativa. Parar uma playlist não encerra ambientes ou outras músicas, e a parada cancela também seu carregamento pendente. Os testes verificam que pausar um pad mantém os outros sons ativos.

Grupos reais são persistidos na chave `soundbard-pad-groups`, separados dos demonstrativos. O campo opcional de tipo de cena preserva Personagens, Locais e Combate na navegação e em backups; cenas antigas sem tipo continuam compatíveis e aparecem em Locais. A importação e os arquivos já existentes não são apagados ou migrados destrutivamente.

A rodada final de `pnpm check` passou: Ultracite em 62 arquivos, TypeScript, 37 testes unitários e build. Os 17 E2E passaram em 31 segundos: sete regressões da biblioteca, quatro da mesa real e seis da demonstração. Dois testes adicionais da versão compilada passaram sem conexão, inclusive fechando e reabrindo um perfil Chromium com a biblioteca persistida. Todos usaram contextos isolados e o servidor existente na porta 3000.

A mesa real foi validada com importação, duas músicas avulsas e ambiente simultâneos, pausa/retomada independente, parada individual, playlist com avanço de faixa, persistência de arquivos e grupos e categoria Combate após recarregar. Axe não encontrou violações críticas/sérias no fluxo principal. As capturas incluem `.qa/live-desk-desktop.png`, `.qa/live-desk-mobile.png` e `.qa/live-desk-landscape.png`. Em 568 × 320 o cabeçalho foi ajustado com flex e truncamento para manter o pad inteiro acima dos controles, sem criar outra faixa de media query.

O detector de design não encontrou ocorrências. O React Doctor terminou com o mesmo resultado anterior, 65/100 e 16 avisos, sem erros ou supressões; os avisos novos de tamanho/complexidade foram resolvidos dividindo a mesa em composição, controles, cabeçalho e estado. A comparação por Git não estava disponível porque não há `HEAD`; a verificação usou a varredura completa.

Limites: os grupos de pads ainda não entram no backup da biblioteca; há apenas uma fila de playlist ativa. `/previa` conserva a demonstração histórica, separada da mesa funcional. Os áudios de teste são tons sintéticos; não foram verificadas saída física de áudio, músicas do usuário, aparelho móvel físico, Firefox ou Safari.

A conferência final da mesa real com 30 arquivos cobriu 85 combinações de viewport: 81 larguras de 320 a 1920 px, mais 685/839 px, 390 × 844 e 568 × 320. Não encontrou rolagem da página, pads retangulares, cortes sobre os controles ou erros de execução. Capturas adicionais em `.qa/live-desk-390x844.png`, `.qa/live-desk-685x768.png`, `.qa/live-desk-839x768.png`, `.qa/live-desk-1440x768.png` e `.qa/live-desk-568x320.png`.

## FastAPI: verificação independente de unidade e configuração — 3 de novembro

A revisão dos scripts e da documentação confirmou que a API de aplicação está em Python. Em `pnpm dev`, o Vite ocupa a porta 3000 e encaminha `/api` para o FastAPI interno em 8000; em `pnpm start`, o próprio FastAPI entrega a API e a interface compilada em 3000. `scripts/python.ts` seleciona o Python de `.venv` conforme a plataforma e encaminha sinais, sem criar uma API Node. Essa parte foi confirmada por leitura de `package.json`, `scripts/dev.ts`, `scripts/python.ts`, `vite.config.ts`, `backend/__main__.py`, README e ADR 0003; não foi iniciado outro servidor para essa revisão.

As três verificações independentes passaram no estado examinado:

- `pnpm test`: 42 testes em cinco arquivos. Os cinco testes novos do cliente verificam intervalos inválidos, mensagens de validação da API, resposta HTML no lugar da API, tarefa malformada e recusa de HTML como arquivo de áudio.
- `pnpm test:backend`: 42 testes, sendo 12 da API e 30 do processamento, em 1,87 segundo. A conversão usa FFmpeg real com WAV sintético; a fronteira YouTube é substituída nos testes automatizados. Não foi baixada mídia externa nesta verificação.
- `pnpm lint:backend`: Ruff passou, incluindo a conferência de formatação dos seis arquivos Python existentes nessa rodada.

O núcleo foi exercitado com corte real e conferência do hash do original, intervalo fora da duração, arquivo de playlist disfarçado de MP3, limite de tamanho, fila limitada, cancelamento de download e encerramento de um processo FFmpeg real. A limpeza da tarefa remove o resultado temporário e preserva o original. Os testes da API cobrem origem externa, host inesperado, URLs fora do YouTube, campos extras, intervalo inválido, tarefas inexistentes, ausência de cache em respostas da API e fallback da interface sem transformar rotas `/api` desconhecidas em HTML.

Esta seção não afirma conclusão de build, lint TypeScript, E2E, reprodução física ou download real do YouTube; essas verificações pertencem à integração feita pelo agente principal. Nenhum arquivo de implementação foi alterado por esta revisão.

## FastAPI conectado à mesa e corte real — 3 de novembro

A migração para FastAPI está implementada. A versão compilada usa um único servidor Python em `http://localhost:3000`; o servidor Node estático anterior foi removido. O lançador `scripts/python.ts` apenas inicia o executável Python do ambiente `.venv`. O desenvolvimento também foi exercitado: Vite em 3000 encaminhou `/api` ao FastAPI interno em 8000; os quatro E2E novos passaram nesse modo e ambos os processos encerraram juntos com sucesso. Em seguida, o FastAPI compilado foi reiniciado em 3000 e a porta 8000 ficou livre.

A rodada final de `pnpm check` passou: Ultracite em 71 arquivos, Ruff, TypeScript, 42 testes Vitest, 45 testes Python e build. Os testes Python incluem FFmpeg real, correção do trecho com silêncio/tom, preservação do original, cancelamento, limite de tarefas, expiração de arquivos concluídos após uma hora sem acesso, origem/host local, URLs restritas ao YouTube, intervalos inválidos e separação entre API, SPA e arquivos inexistentes. Nenhum teste foi suprimido ou marcado para pular.

O fluxo acessível por **Importar áudios → Importar do YouTube** consulta título/duração, prepara um intervalo, permite ouvir o resultado e adiciona o MP3 à biblioteca. **Editar pad → Cortar áudio** envia uma cópia do arquivo existente para produzir outro áudio. A gravação usa o mesmo caminho de validação e commit do IndexedDB; falha de importação conserva o resultado pronto para nova tentativa. Fechar ou cancelar descarta apenas a preparação temporária. A biblioteca original permanece no navegador.

Foi feita também uma verificação externa real, separada das fixtures: consulta e download do áudio do vídeo público “Big Buck Bunny 60fps 4K — Official Blender Foundation Short Film”, ID `aqz-KE-bpKQ`. yt-dlp baixou 29,34 MiB e FFmpeg gerou um MP3 do intervalo de 1 a 4 segundos. O resultado tinha duração de 3 segundos e 61.769 bytes, estado pronto e nenhum erro; a tarefa e seus arquivos temporários foram removidos após a inspeção, sem adicionar essa mídia à biblioteca do usuário. Um vídeo de teste antigo indisponível foi recusado com mensagem recuperável. A consulta também foi conferida pela interface real no Chrome.

A validação móvel encontrou ações parcialmente escondidas e o progresso fora do viewport em 320 × 568. O diálogo passou a ter corpo rolável e rodapé fixo para progresso, Cancelar e Fechar. Campos ficam somente leitura durante preparação, mantendo acesso por teclado ao corpo. A regressão verifica controles e progresso inteiros na tela, além de axe sem violações críticas/sérias. Evidência em `.qa/audio-tools-mobile.png`.

O detector de design não retornou ocorrências. React Doctor aplicado aos arquivos TypeScript do projeto terminou em 65/100, sem erros e com 17 avisos; o aviso adicional de URL de prévia foi conferido: o cleanup revoga a URL e descarta o elemento de áudio. A varredura indiscriminada também havia incluído bibliotecas instaladas em `.venv` e apontado código de Pygments/yt-dlp; essas dependências externas não foram alteradas nem regras desligadas. Os novos diagnósticos de complexidade e assinatura de listener da interface foram resolvidos no código.

Limites: o download obtém o áudio antes do corte, sem garantir transferência apenas do intervalo; não há importação de playlists completas ou cache protegido do Premium. O cancelamento de uma consulta síncrona do extrator pode aguardar sua resposta/timeout. Não foram usados cookies ou contas, nem testadas músicas pessoais do usuário, saída física de áudio, aparelho móvel físico, Firefox ou Safari.

## FastAPI: suíte de navegador na versão compilada — 3 de novembro

A rodada final independente de `pnpm test:browser` passou nos **21 testes**, em 52,5 segundos, reutilizando o FastAPI já iniciado na porta 3000. Não houve edição de implementação, recompilação ou reinício do servidor durante esta verificação. A suíte contém sete regressões da biblioteca, quatro testes da mesa real, quatro do fluxo de preparação de áudio e seis da demonstração de layout.

No novo fluxo, os testes verificaram importação do arquivo preparado por link, envio do intervalo escolhido, reprodução e persistência nos pads. Essa parte utiliza respostas controladas da API e um MP3 válido, sem download externo. O cenário de corte local usa a API e o FFmpeg reais: um WAV sintético de oito segundos gera um trecho de aproximadamente dois segundos, ambos continuam na biblioteca e o original ainda reproduz com duração de oito segundos após recarregar.

Também passaram os cenários de serviço indisponível com recuperação para a mesa e de cancelamento sem importar um arquivo. Em 320 × 568, o progresso e o botão Cancelar tarefa ficaram integralmente visíveis. A análise axe do diálogo nesse estado não encontrou violações críticas ou sérias. A captura atual está em `.qa/audio-tools-mobile.png`.

Os testes offline da versão compilada pertencem a uma rodada separada do agente principal e não são contados nestes 21 testes. Esta rodada não verifica áudio em aparelho físico, Firefox ou Safari.

A verificação offline final da versão compilada também passou: 2/2 testes em 5 segundos, incluindo fechamento e reabertura do perfil Chromium sem conexão. Somados à suíte regular, foram 23 testes de navegador aprovados na rodada final. O FastAPI permaneceu em `localhost:3000` após a validação.

## Prévia com forma de onda real — 3 de novembro

O corte agora começa por **Carregar prévia**. O áudio completo fica disponível para ouvir, pausar, avançar e marcar início/fim antes de preparar o trecho. A forma de onda é calculada pelo FFmpeg a partir da fonte original, com até 1024 picos de amplitude entre zero e um. O desenho SVG representa esses valores: não usa barras aleatórias ou animação decorativa. A seleção pode ser ajustada por dois marcadores acessíveis pelo teclado ou pelos campos em segundos. **Ajustar trecho** conserva a fonte já carregada e evita outro download; fechar remove fonte e corte temporários.

Os 55 testes Python passaram, incluindo dez cenários novos com FFmpeg real. Eles verificam silêncio, níveis conhecidos de amplitude, canais estéreo em oposição de fase, cancelamento durante análise, duração e contratos da API. Um teste corrompe deliberadamente o MP3 de prévia e confirma que o corte continua correto pelo original retido. Outro confirma corte de fonte M4A obtida pelo extrator sem ampliar os formatos de upload permitidos. Os 45 testes Vitest também passaram, incluindo validação do retorno da forma de onda e dos novos contratos de prévia/corte.

A suíte Chromium passou nos 22 testes regulares e dois offline. O novo E2E carrega um WAV de oito segundos contendo silêncio, tom baixo, tom alto e silêncio. Confere as diferenças medidas pela API, a onda visível, avanço de reprodução, marcação do intervalo, parada no fim escolhido e limpeza da fonte ao fechar. Os testes existentes de YouTube passaram a verificar preparação da fonte, pedido separado de corte e reutilização da fonte ao ajustar; essa fronteira usa respostas controladas e um MP3 válido. O corte local continua usando o FastAPI e o FFmpeg reais, preservando o áudio original na biblioteca.

Além das fixtures, o serviço preparou uma prévia completa do vídeo público Big Buck Bunny, ID `aqz-KE-bpKQ`, com 1024 picos reais e duração efetiva de 634,62 segundos. A consulta do YouTube informava 635 segundos; a interface passou a usar a duração da fonte e a limitar o intervalo inicial a ela. Um corte de 1 a 4 segundos gerou três segundos de áudio. Uma segunda inspeção no Chrome percorreu consulta, carregamento, reprodução da seleção, ajuste pelo marcador, preparação e reprodução do resultado pela interface. Fechar descartou a preparação sem importar mídia na biblioteca do usuário. O console ficou sem erros ou avisos.

As capturas `.qa/waveform-preview-mobile.png` e `.qa/waveform-preview-landscape.png` registram o editor em 320 × 568 e 568 × 320. A inspeção adicional usou 1440 × 900. O diálogo mantém corpo rolável e rodapé acessível em telas baixas; não houve overflow horizontal em paisagem. Axe não encontrou violações críticas ou sérias no editor móvel nem no cancelamento. A barra de progresso foi ajustada para branco, e a mensagem de fonte pronta distingue a prévia do trecho já preparado.

A verificação final de `pnpm check` passou com Ultracite em 74 arquivos, Ruff em sete arquivos Python, TypeScript, 45 testes Vitest, 55 testes Python e build. Depois dos últimos ajustes, os quatro cenários de preparação e o novo E2E da onda passaram novamente; este último também confere sincronização dos marcadores pelo teclado e o botão Fechar inteiramente contido na tela após a troca de orientação. Os dois testes offline foram repetidos no build final e passaram. O detector de design não retornou ocorrências. React Doctor aplicado somente aos 36 arquivos TypeScript de `src` e `scripts` manteve 65/100, 17 avisos conhecidos e nenhum erro. Não houve supressões de regras; os três diagnósticos novos de complexidade/estado foram resolvidos. A URL local de áudio continua tendo revogação explícita no cleanup.

Limites: a onda resume o áudio completo, sem zoom nesta versão. O YouTube precisa terminar o download e a análise antes da prévia; a fonte só é reutilizada enquanto o diálogo permanece aberto. A saída física de áudio, aparelho móvel real, Firefox e Safari continuam sem validação.

## Avisos transitórios com Sonner — 3 de novembro

Os banners de aviso da mesa e da organização da biblioteca foram substituídos por um Toaster global do Sonner, instalado com pnpm e encapsulado no componente shadcn `src/components/ui/sonner.tsx`. As notificações não ocupam espaço na grade. Importação, recuperação de backup, ajustes salvos e erros do motor usam o mesmo caminho. Erros de formulário e de inicialização da biblioteca permanecem junto da ação de recuperação.

O toast usa fundo `#111`, borda `#444`, texto `#fafafa` e DM Sans. O ícone de sucesso é branco; erro usa vermelho discreto. Aparece no topo, respeita a área segura no celular e tem botão de fechar de 44 px. Sucessos expiram em 4,5 segundos e erros em oito; o comportamento de pausa durante interação é o padrão do Sonner. Os estilos dos banners removidos também foram apagados.

O teste dedicado importou um WAV real em 390 × 844, verificou a mensagem de sucesso, cores computadas, toast e botão inteiros no viewport, ausência de overflow, fechamento e permanência do arquivo na biblioteca. Axe não encontrou violações críticas ou sérias. As capturas `.qa/toast-mobile.png` e `.qa/toast-desktop.png` mostram o estado final da animação em celular e desktop. Os testes legados de erro e confirmação foram adaptados para o novo toast, inclusive quando há diálogo aberto.

TypeScript, Ultracite, 45 testes Vitest e build passaram. Os dois testes offline também passaram. React Doctor manteve 65/100, com 17 avisos conhecidos e nenhum erro novo, e o detector de design não encontrou ocorrências. O backend não foi alterado. A validação móvel continua emulada, sem aparelho físico, Firefox ou Safari.

A rodada final da suíte regular passou nos 23 E2E em 57,8 segundos, incluindo o novo cenário de notificações e as regressões de preparação de áudio, forma de onda, mesa, biblioteca e responsividade. O cenário de toast também confirmou a fonte DM Sans computada no build final. A contagem total desta rodada é de 25 testes de navegador, considerando os dois offline.

## Link com debounce e carregamento automático — 3 de novembro

Colar um link completo de vídeo do YouTube inicia a consulta após 600 ms sem alterações. Em seguida, a interface carrega a fonte e a forma de onda automaticamente. Foram removidas as ações intermediárias Consultar link, Carregar prévia e Preparar trecho. O corte local também carrega a prévia ao abrir. Depois de ouvir e ajustar a seleção, Adicionar à biblioteca prepara e importa o trecho em uma única ação.

Durante consulta, download e análise, o diálogo mostra estado e progresso. Um endereço inválido recebe orientação após o mesmo debounce, sem chamar a API. Falhas mostram o motivo e uma tentativa explícita; não disparam repetição automática. O campo do link permanece editável durante a preparação. Trocar o link cancela a consulta, invalida respostas antigas, limpa os temporários conhecidos e descarta uma tarefa criada tardiamente. Fechar antes do debounce não inicia tráfego. Uma falha na importação conserva o trecho pronto para nova tentativa.

Os nove testes direcionados passaram antes da rodada completa. Quatro cenários novos verificam debounce com troca rápida de endereço, tarefa antiga retornando depois da nova, fechamento antes do disparo e recuperação após erro de metadados sem repetir a consulta sozinha. Os testes de corte local continuam usando o FastAPI e FFmpeg reais, preservando o original. O polling existente passa a resolver a preparação final quando o trecho fica pronto; cancelamento, falha e desmontagem liberam a espera. Cancelar ou atualizar uma tarefa também valida sua geração antes de alterar o estado, preservando uma fonte mais recente.

A inspeção adicional no Chrome colou o vídeo público Big Buck Bunny, ID `aqz-KE-bpKQ`, sem clicar em consulta ou preparação. O download e a conversão avançaram no diálogo, e a onda real apareceu ao concluir, com duração efetiva de 634,62 segundos. A seleção de 1 a 4 segundos reproduziu. Fechar descartou o trabalho temporário sem importar o vídeo na biblioteca do usuário. O console ficou sem avisos ou erros.

`pnpm check` passou com Ultracite, Ruff, TypeScript, 45 testes Vitest, 55 testes Python e build. Depois da revisão final do hook, TypeScript, Vitest e build passaram novamente. O detector de design não encontrou ocorrências. React Doctor terminou sem erros, em 63/100 com 18 avisos: os 17 anteriores e um aviso de loading revisto como falso positivo de alta confiança. Ele aponta `setSaving(false)` dentro de um bloco `finally`, protegido contra requisições antigas; os caminhos de cancelamento e troca de URL também liberam esse estado explicitamente. Nenhuma regra foi desativada. A complexidade adicional identificada na primeira leitura foi reduzida sem alterar o fluxo.

A rodada final da versão compilada passou nos 27 testes regulares de navegador e nos dois offline, totalizando 29. A API permaneceu saudável e o único servidor público continua em `http://localhost:3000`.

## Forma de onda visível na inserção — 3 de novembro

O usuário informou novamente que não via o gráfico e forneceu o vídeo `https://www.youtube.com/watch?v=bN9SL0bDxxo`. A reprodução no Chrome confirmou o título “Forró de Primeira”, download e análise concluídos, tarefa pronta sem erro e duração efetiva de 137,98 segundos. O defeito reproduzido era de posição: em 1366 × 600, a onda começava em y=527,64, enquanto o corpo rolável terminava em y=459,5. Ela existia na página, mas ficava totalmente escondida após nome, tipo e intervalo em segundos.

Dois E2E novos reproduziram a falha em 1366 × 600 e 320 × 568, com razão de interseção igual a zero. A correção move a onda e seus controles para o início da seleção, logo após o link, e deixa os dados da música abaixo. A explicação duplicada do carregamento foi condensada no texto do diálogo. Erros agora aparecem antes da seleção, junto do link. Ambos os testes passaram exigindo a onda inteira no viewport sem rolagem, com a ação de adicionar também acessível. Evidências: `.qa/waveform-visible-1366.png` e `.qa/waveform-visible-320.png`; essas capturas usam amplitudes controladas para verificar o layout, separadamente do teste externo real.

Ultracite, TypeScript, 45 testes Vitest e build passaram. Na versão final, passaram os 29 E2E regulares e dois offline, totalizando 31 testes de navegador. React Doctor permaneceu em 63/100, com os mesmos 18 avisos documentados e nenhum erro; o detector de design não encontrou ocorrências. A biblioteca do usuário não foi alterada. A validação móvel permanece emulada.

Após a correção, uma nova abertura do editor no Chrome carregou novamente o link fornecido pelo usuário. A onda real ficou inteira visível em 1366 × 600, logo abaixo do link, com início em y=219 e fim em y=315, antes do rodapé em y=459,5. A preparação foi descartada ao fechar, sem importar o arquivo.

## Loading no botão e entrega do editor pronto — 3 de novembro

Ao colar um link válido, o botão principal permanece visível, desabilitado e com spinner, rótulo “Carregando áudio…” e `aria-busy`. A barra existe desde a consulta inicial: usa estado indeterminado quando não há percentual e o progresso informado pelo serviço durante o processamento. Se a tarefa já está pronta mas a resposta da forma de onda ainda não chegou, a interface continua carregando, sem anunciar conclusão.

Os campos e os controles do corte só aparecem depois de áudio e forma de onda estarem disponíveis. Na transição, a seleção recebe foco e é posicionada no início da área visível, entregando a onda e os controles para uso imediato. Fechar, cancelar e trocar o link continuam disponíveis durante a preparação; a ação de adicionar só é habilitada quando a seleção está pronta e válida.

O novo E2E segura separadamente a conclusão do download e a resposta da onda. Ele verificou botão desabilitado e ocupado, progresso de 37%, ausência dos campos de edição nas duas etapas pendentes, foco na seleção ao liberar a onda, gráfico inteiro no viewport e ação de adicionar habilitada. A reprodução anterior desse teste falhou pela ausência do botão de loading. Capturas em `.qa/audio-loading-progress.png` e `.qa/audio-ready-handoff.png`, com respostas controladas para testar as transições. Os 12 cenários direcionados de áudio também passaram antes da rodada completa.

Ultracite, TypeScript, 45 testes Vitest e build passaram. React Doctor manteve 63/100 e os mesmos 18 avisos documentados, sem erros novos; o detector de design não encontrou ocorrências. O backend não foi alterado. A validação móvel permanece emulada.

A rodada final passou nos 30 E2E regulares e dois offline, totalizando 32 testes de navegador. A versão compilada permaneceu disponível em `http://localhost:3000`.

## Importação unificada, lote, tags e estudos de pads — 4 de novembro

O diálogo inicial passou a oferecer somente **Importar do YouTube** e **Arquivo de áudio**. Ambas as fontes chegam ao mesmo editor com forma de onda real, corte, nome, tipo e tags, liberado apenas após a preparação completa. O seletor local mostra o nome do arquivo ou a quantidade selecionada. A importação em lote foi mantida por escolha explícita do usuário: um arquivo pode receber corte e novo nome; os demais entram inteiros. Tipo e tags são compartilhados pelo lote. Sem corte, a importação local mantém os bytes e o formato originais.

As tags formam um catálogo persistido junto da biblioteca, incluído no backup. A busca normaliza espaços, maiúsculas e acentos, preservando a grafia de exibição existente. O catálogo pode ser reconstruído de bibliotecas e backups antigos, sem mudar a versão do formato, e mantém tags que deixaram de ser usadas. Importação e edição usam o mesmo combobox. Os nove testes unitários novos cobrem normalização, sugestões, compatibilidade, tags sem uso, backup e recusa de dados inválidos.

A rodada completa de `pnpm check` passou com Ultracite em 84 arquivos, Ruff nos sete arquivos Python, TypeScript, **54 testes Vitest**, **55 testes Python** e build. A suíte regular passou nos **33 E2E**; os dois testes offline também passaram, totalizando **35 testes de navegador**. Os três novos cenários verificam a primeira etapa com duas fontes, corte real via FFmpeg de arquivo enviado, renomeação, tags reutilizadas após recarregar, deduplicação e lote com arquivo inválido sem perder os válidos. O corte do segundo arquivo resulta em aproximadamente dois segundos e o primeiro permanece com oito segundos. A suíte preserva os cenários de 100 arquivos, reprodução simultânea, YouTube, backup e edição de áudios existentes.

A inspeção das capturas encontrou um defeito que a asserção de visibilidade simples não detectava: sugestões de tags fora da área visível, atrás do rodapé fixo. Uma regressão com `toBeInViewport({ ratio: 1 })` reproduziu o erro com razão de interseção zero. A validação adicional exige sugestões inteiras na tela, incluindo o editor em 320 × 568, fechamento das sugestões por Escape sem fechar o diálogo e escolha por clique.

A correção usa o Popover do Radix já instalado, com portal, detecção de colisão e altura limitada ao espaço disponível. O combobox conserva foco e teclado. Após essa mudança, os três E2E de importação e os dois offline passaram novamente na última build; a regressão exige interseção integral das sugestões em desktop e mobile e do botão de adicionar após fechar a lista. Axe não encontrou violações críticas ou sérias com as sugestões abertas no editor móvel. TypeScript, Ultracite, os 54 testes unitários e build também passaram após o ajuste; React Doctor manteve o mesmo resultado.

Três estudos de pads estão disponíveis somente em `/previa?estudo=pads&variant=A`, `B` ou `C`: nome central, ícone e acionamento, ou canal e transporte. São demonstrações sem áudio e sem acesso à biblioteca. Nenhuma opção foi aplicada à mesa principal. A inspeção cobriu as nove combinações de variante e viewport: 1440 × 900, 320 × 568 e 1366 × 600. Não houve overflow horizontal, botões aninhados ou pads fora da proporção quadrada. Axe não encontrou violações críticas ou sérias. Trocar a variante preserva seleção e reprodução demonstrativa; as setas no slider alteram o volume sem trocar a variante. `/previa` sem query permanece com sua demonstração histórica. A última revisão de C foi repetida após remover uma linha redundante que apertava o transporte.

Evidências locais: `.qa/import-source-choice.png`, `.qa/import-editor-tags.png`, `.qa/import-tag-suggestions.png`, `.qa/import-tag-suggestions-mobile.png`, `.qa/pad-option-*`, `.qa/pad-layout-audit.json` e `.qa/pad-layout-audit-final-C.json`. O detector de design não encontrou ocorrências. React Doctor, aplicado apenas aos arquivos TypeScript do projeto, registrou 64/100, 19 avisos e nenhum erro. O aviso adicional de complexidade é do fluxo unificado de áudio; o aviso de loading no `finally` continua revisto como falso positivo, com liberação e proteção contra respostas antigas. Não houve supressão de regras. Firefox, Safari, saída física de áudio e aparelhos móveis reais continuam fora do alcance desta rodada.

## Transporte minimalista no estudo C — 4 de novembro

Após a rejeição das três opções iniciais, C recebeu uma revisão limitada aos controles: ícones menores e de traço leve, sem o fundo retangular de reprodução ou a divisória interna. O estado ativo usa o ícone e o indicador em laranja, sem a borda superior grossa. Reprodução e parada continuam separadas, com nomes acessíveis, foco visível e alvos de clique de 44 × 44 px. Esta revisão não representa aprovação do layout completo nem alteração da mesa real.

Ultracite, TypeScript e build passaram. A revisão foi inspecionada em Chromium em 1440 × 900, 320 × 568 e 1366 × 600, com pads quadrados, sem overflow, texto cortado ou botões aninhados. Axe não encontrou violações críticas ou sérias no cenário desktop. Acionamento, parada e reprodução por Enter também foram conferidos no viewport móvel. Evidências em `.qa/pad-layout-minimal-C.json`, `.qa/pad-option-C-*` e `.qa/pad-minimal-C-mobile-active.png`. O detector de design retornou uma lista vazia. Não houve alteração do motor de áudio ou do backend; a demonstração continua sem áudio real.

## Três estudos skeuomórficos claros — 4 de novembro

A partir das duas referências visuais enviadas pelo usuário, foram construídas três composições em `/previa?estudo=hardware&variant=A|B|C`: Cerâmica, Rack OSC e Estúdio. A paleta usa branco, cinza claro e grafite, com pequenos detalhes lavanda e laranja. Pads permanecem quadrados, com relevo e título abaixo; cada som tem volume vertical e toggle mecânico de loop. Cerâmica reúne pad e fader lado a lado, Rack OSC separa banco de pads e mixer, e Estúdio organiza canais verticais completos. Os controles são compartilhados; os layouts foram desenvolvidos em paralelo e integrados na mesma rota e servidor local.

Acionamento, pausa, parada geral, volume, loop, filtros e comparação de variantes são interativos, com estado somente em memória. Trocar a variante preserva os ajustes. Os estudos não reproduzem áudio nem acessam a biblioteca. A mesa principal, a prévia histórica e a rodada anterior de pads foram preservadas. O mixer acompanha a seleção do canal, sem se reposicionar por uma simples alteração de volume ou loop.

A inspeção inicial identificou recorte de títulos e toggles no rack, contraste insuficiente no rótulo de loop selecionado e curso muito curto do fader Estúdio no celular. Foram ajustados espaço disponível, tipografia e contraste; os faders receberam o traço grafite da referência. A varredura adicional identificou controles inacessíveis em paisagem de 568 × 320. O shell perdeu o rodapé redundante, e os layouts passaram a usar a altura real disponível: Cerâmica reduz os módulos, Rack OSC coloca os painéis lado a lado quando não cabe empilhá-los, e Estúdio aproxima fader e loop do pad em uma composição compacta. Os modos normais permanecem completos, com títulos abaixo e controles juntos.

A conferência final cobriu **30 combinações de variante e viewport**: as nove combinações de A/B/C em 1440 × 900, 320 × 568 e 1366 × 600; dezoito em 390, 685, 839, 986, 1024 e 1280 px de largura, com 768 px de altura; e três em 568 × 320 paisagem. Pads permaneceram quadrados, títulos abaixo e primeiro módulo/canal completo com controles inteiros. Não houve overflow da página ou erros de console. Recortes nas bordas horizontais correspondem aos próximos itens dos carrosséis de arraste livre. A inspeção considerou clipping pelos ancestrais, distinguindo esses itens parciais de controles indevidamente escondidos.

Nos nove cenários principais, axe não encontrou violações críticas ou sérias. Passaram acionamento, toggle, alteração de volume por ArrowUp sem trocar a variante, preservação de estado entre variantes e filtros de conjuntos. Ultracite verificou 90 arquivos, TypeScript e build passaram, assim como os 54 testes Vitest e as seis regressões da prévia histórica. Os dois testes offline da versão compilada também passaram. React Doctor registrou 65/100 e os mesmos 19 avisos existentes, sem erros ou novos diagnósticos nos estudos; o detector de design retornou lista vazia. Não houve mudanças no backend ou no formato da biblioteca.

Evidências: `.qa/hardware-{A,B,C}-{desktop,mobile,short}.png`, `.qa/hardware-audit.json`, `.qa/hardware-fluid-audit.json`, `.qa/hardware-fluid-{A,B,C}-568x320.png`, `.qa/hardware-mixer-position.mjs`, `.qa/react-doctor-hardware-final.txt` e `.qa/design-hardware.json`. A validação usa Chromium e dimensões emuladas; aparelho físico, Firefox, Safari e saída física de áudio continuam fora do alcance. Nenhuma proposta foi escolhida ou aplicada à mesa real.

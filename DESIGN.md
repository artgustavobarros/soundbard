# Soundbard: interface

## Superfície

Modo Operate: mesa de som pessoal para o mestre de RPG. O objetivo visual é localizar cenas, ajustar camadas e disparar efeitos sem interromper a sessão.

## Direção de implementação

A variante **A — Cerâmica**, em `/previa?estudo=hardware&variant=A`, foi escolhida pelo usuário como referência para toda a interface. A mesa funcional em `/`, a biblioteca, a mixagem, playlists, cenas, formulários, menus e notificações compartilham essa direção. A controladora preta e os outros estudos permanecem como histórico de exploração, sem definir o tema corrente.

A superfície lembra uma controladora de estúdio clara: fundo neutro `#f8f8f8`, peças brancas e cinza muito claro, texto grafite `#292c33` e relevo suave nos controles. As sombras têm pequeno deslocamento e desfoque; reentrâncias indicam trilhos, seleções e áreas de edição. Esse relevo vem da referência aprovada e deve permanecer discreto, com bordas nítidas e sem brilhos decorativos.

A cor preta da borda dos pads `#151517` identifica foco, anéis de seleção e elementos primários. Laranja discreto sinaliza reprodução; vermelho é reservado à parada, erros e ações destrutivas. O estado também aparece por ícone, texto ou posição do controle, sem depender apenas da cor. Áreas vazias mantêm a mesma paleta e indicam a próxima ação real.

Os tokens globais em `src/styles.css` definem fundo, texto, superfícies, bordas, seleção e sombras. `--surface` é o plano de trabalho, `--surface-raised` é a peça elevada e `--surface-inset` é a área rebaixada. Campos, menus e diálogos reutilizam esses tokens, inclusive caret, seleção de texto, barras de rolagem e foco por teclado. Não reintroduzir blocos pretos nas áreas de organização.

Pads quadrados usam `rounded-xl` (12 px), borda `#151517`, face `#f7f7f7` e sombra discreta de relevo. A transição interna de 2 px usa sombra inset que acompanha os cantos arredondados, inclusive durante o acionamento. O conteúdo fica recortado pelos cantos com `overflow: hidden`. Título e subtítulo ficam dentro do pad, no topo esquerdo, com o mesmo recuo. Volume em fader vertical junto ao pad e loop como toggle retangular seguem a composição Cerâmica. O trilho e a marca horizontal do fader usam `#151517`, como a borda do pad. A grade e o carrossel se ajustam ao espaço disponível sem impor um tamanho para cada dispositivo. Arraste e navegação por teclado continuam disponíveis. Alvos de toque e ações frequentes mantêm pelo menos 44 px.

A rota `/previa` conserva as demonstrações sem áudio. `estudo=pads&variant=A|B|C` abre os estudos anteriores de composição, e `estudo=hardware&variant=A|B|C` permite comparar Cerâmica, Rack OSC e Estúdio. A é a referência aprovada; B e C permanecem estudos comparativos.

DM Sans auto-hospedada na interface. Dentro dos pads, Roboto auto-hospedada: título em caixa alta com peso 800 e subtítulo com peso 600. Texto legível, controles com rótulos e números tabulares para tempo e volume. Cabeçalhos compactos, sem hero ou métricas decorativas. Ícones Lucide consistentes e componentes shadcn/ui para botões, campos, menus e diálogos.

## Estrutura

Uma mesa única de pads personalizáveis. Cada pad representa um ambiente, efeito ou playlist, com nome próprio e estado de reprodução visível. A playlist atribuída e a faixa atual aparecem no pad. O toque em um pad de playlist inicia, pausa ou retoma sua reprodução; efeitos aceitam disparos repetidos.

Cada módulo reúne o pad, seu nome, volume individual e loop; a faixa inferior preserva transporte, edição e volume geral, sem duplicar o volume individual. Essa faixa e seus botões reutilizam a superfície dos pads: face `#f7f7f7`, borda `#151517`, cantos de 12 px e sombra interna, com título Roboto em caixa alta de peso 800 e detalhes de peso 600. O botão de edição abaixo de cada pad abre o som ou playlist correspondente diretamente, sem pausar o áudio. A edição de um som permite recortá-lo depois da importação, preservando o original. A operação não exige painel separado de playlist, abas de canais ou navegação vertical. “Parar tudo” fica disponível no menu do cabeçalho. Personalizar o pad permite mudar seu nome e conteúdo.

A navegação principal é Cenas, Efeitos e Personalizado. Cenas contém Personagens, Locais e Combate. Ambiente é uma subdivisão de Efeitos; Combate é um tipo de cena. Categorias de cenas abrem dentro do mesmo menu, com “Voltar”, para permanecerem utilizáveis em telas pequenas. Os menus de navegação não bloqueiam os controles da mesa.

Personalizado reúne grupos nomeados de pads, incluindo pads de playlists. Criar grupo permite escolher seus integrantes e salvá-lo na biblioteca central, junto dos demais dados e do backup. Navegação e controles usam quebra de linha pelo espaço real do conteúdo, sem largura especial para o exemplo de cada dispositivo.

O cabeçalho da mesa mostra o hamburger à esquerda e um botão somente com ícone de adicionar músicas à direita, ambos com alvo de 44 px. O botão de adicionar abre a importação; a prévia demonstrativa permanece sem essa ação. As três linhas têm 2 px de espessura, 6 px de intervalo e ocupam 100%, 80% e 60% da largura útil do botão. Ele abre um Sheet shadcn/ui que reúne importação, biblioteca, navegação e ações. O CSS global carrega `tw-animate-css`: o Sheet usa os tempos existentes de 500 ms na entrada e 300 ms na saída, respeitando movimento reduzido. Fechar o Sheet ou concluir um diálogo devolve o foco ao botão que abriu o menu, quando nenhum outro diálogo estiver aberto.

A mesa principal usa os arquivos e playlists reais da biblioteca central e começa vazia. O navegador mantém cache para leitura e reprodução offline; alterações persistentes dependem de confirmação do servidor. Importar áudios cria pads sem sair da mesa. Biblioteca abre a organização dos arquivos, playlists, cenas e backup, com uma ação para voltar à mesa. A área Mixagem permite preparar e salvar combinações de cenas. O motor permanece vivo enquanto essas áreas estão abertas. Grupos da mesa real pertencem à biblioteca central; os grupos demonstrativos de `/previa` continuam separados.

A prévia e a implementação usam a stack escolhida: TSX em rotas TanStack, classes Tailwind para layout e breakpoints, e componentes shadcn/ui. Não criar outra interface HTML com CSS e eventos paralelos à aplicação.

## Estados e movimento

Foco visível, rótulos em todos os controles, erros com recuperação, botões de operação desabilitados durante gravações incompatíveis. Movimento comunica reprodução e transições; respeitar redução de movimento. O motor de áudio permanece vivo ao navegar entre áreas.

Avisos transitórios de sucesso e erro usam o Sonner em um único Toaster global, sem ocupar espaço na grade de pads. O toast usa a superfície clara elevada, texto grafite, borda cinza suave e fonte DM Sans. Sucesso usa ícone em `#151517`; erros usam ícone vermelho discreto. O toast aparece no topo, tem botão de fechar com alvo de 44 px e desaparece após alguns segundos. Erros de campo e falhas que bloqueiam a abertura da biblioteca continuam junto da ação de recuperação.

Importar abre somente a escolha entre YouTube e arquivo de áudio. A segunda etapa usa o mesmo editor para ambas as fontes: prévia, forma de onda real, corte, nome, tipo e tags. O seletor de arquivo usa um botão com o nome real do arquivo, ou a quantidade em um lote, em vez do controle nativo de texto genérico. No lote, o usuário escolhe um arquivo para cortar e os outros são importados inteiros.

As tags usam um combobox com sugestões do catálogo persistido e ação para criar uma nova tag. Tags escolhidas aparecem como itens removíveis; a interação permite teclado e ponteiro. Importação e edição compartilham o catálogo, com normalização de espaços, maiúsculas e acentos na identificação de duplicatas.

Na inserção e no corte, a forma de onda e seus controles precedem os campos de nome, tipo, tags e intervalo em segundos. Depois da análise, a onda deve aparecer inteira na abertura do editor, sem exigir rolagem para descobri-la. Erros de carregamento ficam junto da fonte, antes dos dados da música. O rodapé mantém progresso e ações acessíveis, enquanto o corpo pode rolar para editar os demais campos. As sugestões de tags precisam permanecer visíveis dentro do espaço disponível, inclusive junto ao rodapé.

Durante a preparação, o botão principal fica desabilitado com spinner e rótulo de carregamento. O editor completo aparece apenas quando áudio e forma de onda estão disponíveis; a seleção recebe foco e é trazida para a área visível. A barra usa progresso real quando informado pelo serviço e estado indeterminado nas etapas sem percentual, sem anunciar conclusão antes da onda.

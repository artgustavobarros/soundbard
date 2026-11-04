# Soundbard: interface

## Superfície

Modo Operate: mesa de som pessoal para o mestre de RPG. O objetivo visual é localizar cenas, ajustar camadas e disparar efeitos sem interromper a sessão.

## Direção de implementação

Controladora MIDI preta, conforme referência física enviada pelo usuário. Fundo preto e superfícies de grafite neutro; texto branco. Evitar tons esverdeados, preenchimentos coloridos amplos, arco-íris e brilhos decorativos. Azul aparece discretamente no hover e no foco. Laranja sinaliza acionamento e reprodução com um pequeno indicador ou borda inferior; vermelho fica reservado à parada e aos erros. A cor acompanha um rótulo ou estado reconhecível.

Pads quadrados, de cantos discretos, com área grande de acionamento e uma pequena faixa inferior que lembra a borda iluminada da controladora. Esta direção foi solicitada explicitamente pelo usuário e é a interface principal em `/`. A rota `/previa` mantém a demonstração histórica do layout. O parâmetro `estudo=pads` abre estudos independentes, sem áudio, com `variant=A`, `B` ou `C`: nome central, ícone e acionamento, ou canal e transporte. Não há variante escolhida ou aplicada à mesa principal. Os estudos preservam os pads quadrados e a paleta existente.

O tamanho dos pads é definido pelo CSS Grid/Tailwind: `repeat(auto-fill, minmax(min(100%, 120px), 1fr))`, com distância constante de 10 px. Não há limite fixo de 158/178 px nem faixas criadas para larguras específicas. O observador apenas lê as tracks do CSS para agrupar o carrossel. Pads começam logo abaixo do título. A estrutura é a mesma em todas as larguras, com arraste livre e teclado, sem setas visuais ou paginação.

Os três estudos iniciais foram rejeitados pelo usuário. A revisão de C explora apenas controles mais minimalistas: reprodução e parada como ícones pequenos, sem fundos individuais ou divisória interna, com laranja discreto durante a reprodução. A área de clique continua confortável e o foco por teclado permanece visível. Esta revisão continua sendo um estudo, sem aprovação do layout completo.

A rodada seguinte, solicitada a partir das referências OSC-1 e dos módulos claros de estúdio enviados pelo usuário, está em `/previa?estudo=hardware&variant=A|B|C`. A direção destes estudos é skeuomórfica: branco e cinza claro, texto grafite, relevo discreto nos pads e controles mecânicos com sombras suaves. Os pads continuam quadrados, com o título fora e abaixo do botão; volume usa fader vertical e loop usa toggle retangular. Lavanda aparece discretamente nos controles e laranja nos indicadores de reprodução. Cerâmica integra pad e fader lado a lado; Rack OSC separa banco de pads e mixer; Estúdio reúne pad, título, fader e loop em um canal vertical. O carrossel usa arraste livre. Esta paleta se aplica aos estudos, aguardando a escolha do usuário, sem substituir a mesa principal.

Uma família sans, DM Sans auto-hospedada. Texto legível, controles com rótulos e números tabulares para tempo e volume. Cabeçalhos compactos, sem hero ou métricas decorativas. Ícones Lucide consistentes. Componentes shadcn/ui para botões, campos e diálogos.

## Estrutura

Uma mesa única de pads personalizáveis. Cada pad representa um ambiente, efeito ou playlist, com nome próprio e estado de reprodução visível. A playlist atribuída e a faixa atual aparecem no pad. O toque em um pad de playlist inicia, pausa ou retoma sua reprodução; efeitos aceitam disparos repetidos.

Uma faixa fixa contém os controles do pad selecionado: transporte, volume individual e volume geral. Um botão no canto do pad permite selecionar esses controles sem pausar o som. A operação não exige painel separado de playlist, abas de canais ou navegação vertical. “Parar tudo” permanece no cabeçalho. Personalizar o pad permite mudar seu nome e conteúdo.

A navegação principal é Cenas, Efeitos e Personalizado. Cenas contém Personagens, Locais e Combate. Ambiente é uma subdivisão de Efeitos; Combate é um tipo de cena. Categorias de cenas abrem dentro do mesmo menu, com “Voltar”, para permanecerem utilizáveis em telas pequenas. Os menus de navegação não bloqueiam os controles da mesa.

Personalizado reúne grupos nomeados de pads, incluindo pads de playlists. Criar grupo permite escolher seus integrantes e salvá-lo neste navegador. Cabeçalho, navegação e controles usam quebra de linha pelo espaço real do conteúdo, sem largura especial para o exemplo de cada dispositivo.

A mesa principal usa os arquivos e playlists reais do IndexedDB e começa vazia. Importar áudios cria pads sem sair da mesa. Biblioteca abre a organização dos arquivos, playlists, cenas e backup, com uma ação para voltar à mesa. A área Mixagem permite preparar e salvar combinações de cenas. O motor permanece vivo enquanto essas áreas estão abertas. Grupos da mesa real são salvos separadamente dos grupos demonstrativos de `/previa`.

A prévia e a implementação usam a stack escolhida: TSX em rotas TanStack, classes Tailwind para layout e breakpoints, e componentes shadcn/ui. Não criar outra interface HTML com CSS e eventos paralelos à aplicação.

## Estados e movimento

Foco visível, rótulos em todos os controles, erros com recuperação, botões de operação desabilitados durante gravações incompatíveis. Movimento comunica reprodução e transições; respeitar redução de movimento. O motor de áudio permanece vivo ao navegar entre áreas.

Avisos transitórios de sucesso e erro usam o Sonner em um único Toaster global, sem ocupar espaço na grade de pads. Fundo grafite `#111`, borda cinza `#444`, texto branco `#fafafa` e fonte DM Sans. Sucesso usa ícone branco; erros usam ícone vermelho discreto. O toast aparece no topo, tem botão de fechar com alvo de 44 px e desaparece após alguns segundos. Erros de campo e falhas que bloqueiam a abertura da biblioteca continuam junto da ação de recuperação.

Importar abre somente a escolha entre YouTube e arquivo de áudio. A segunda etapa usa o mesmo editor para ambas as fontes: prévia, forma de onda real, corte, nome, tipo e tags. O seletor de arquivo usa um botão com o nome real do arquivo, ou a quantidade em um lote, em vez do controle nativo de texto genérico. No lote, o usuário escolhe um arquivo para cortar e os outros são importados inteiros.

As tags usam um combobox com sugestões do catálogo persistido e ação para criar uma nova tag. Tags escolhidas aparecem como itens removíveis; a interação permite teclado e ponteiro. Importação e edição compartilham o catálogo, com normalização de espaços, maiúsculas e acentos na identificação de duplicatas.

Na inserção e no corte, a forma de onda e seus controles precedem os campos de nome, tipo, tags e intervalo em segundos. Depois da análise, a onda deve aparecer inteira na abertura do editor, sem exigir rolagem para descobri-la. Erros de carregamento ficam junto da fonte, antes dos dados da música. O rodapé mantém progresso e ações acessíveis, enquanto o corpo pode rolar para editar os demais campos. As sugestões de tags precisam permanecer visíveis dentro do espaço disponível, inclusive junto ao rodapé.

Durante a preparação, o botão principal fica desabilitado com spinner e rótulo de carregamento. O editor completo aparece apenas quando áudio e forma de onda estão disponíveis; a seleção recebe foco e é trazida para a área visível. A barra usa progresso real quando informado pelo serviço e estado indeterminado nas etapas sem percentual, sem anunciar conclusão antes da onda.

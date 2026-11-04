# Mesa de operação: revisão do layout

Status: seis decisões de estrutura e operação confirmadas pelo usuário. [Prévia da direção MIDI](../src/components/soundboard-preview.tsx) disponível com hover e acionamento visual dos pads, sem áudio. A mesa principal permanece com seu funcionamento anterior enquanto a nova interface é revisada.

Acesso local com `pnpm dev` ou `pnpm start`: **http://localhost:3000/previa**. A aplicação e a prévia usam o mesmo servidor; não iniciar outra porta para esboços.

## Estrutura confirmada

- A tela principal será híbrida: grade de pads como área dominante e canais para controlar os sons em reprodução.
- Cada cena apresenta um banco com seus ambientes e efeitos. Os bancos ficam acessíveis no topo, com indicação clara dos sons ativos.
- Playlist, canais ativos, volume geral e “Parar tudo” ficam visíveis durante a operação. Biblioteca e edição pertencem à preparação da sessão.

O objetivo é disparar e ajustar sons durante a sessão com poucos movimentos, mantendo os controles de operação próximos. O motor de áudio, a biblioteca e a stack aprovados continuam sendo a base. A revisão propõe uma nova composição da interface.

## Segunda rodada: detalhes operacionais

1. **Selecionar banco versus ativar cena — confirmado:** mudar o banco apenas revela os pads, preservando a reprodução atual. “Ativar cena” continua sendo a ação explícita que inicia a transição da sonorização.
2. **Densidade dos pads — confirmado:** começar com 16 pads grandes como referência para uma tela desktop, mantendo a quantidade total de sons independente dessa referência visual.
3. **Canal para efeitos sobrepostos — confirmado:** manter um canal por som, controlando juntas as execuções simultâneas do mesmo efeito. Evita criar um novo fader a cada disparo; difere da apresentação atual de uma linha por execução.

O usuário respondeu “sim” às três propostas.

## Composição do primeiro esboço

- Bancos e ação explícita de ativar cena no topo.
- Grade principal com 16 pads; estados de execução diferenciados do banco selecionado.
- Mixer fixo na base, com faders verticais e um canal por som; execuções sobrepostas aparecem como contagem no mesmo canal.
- Playlist e transporte compactos à direita; controles gerais e parada permanecem acessíveis.

O esboço usa nomes e estados demonstrativos, sem executar áudio ou acessar a biblioteca real. A posição do mixer e do transporte ainda depende da avaliação visual do usuário. A revisão fica restrita à rota de prévia.

## Direção visual solicitada

O usuário rejeitou a paleta verde e enviou uma controladora MIDI física como referência. Usar preto e grafite neutro, letras brancas, azul discreto no hover e laranja no acionamento. A faixa inferior dos pads interpreta a borda iluminada da referência, mantendo a superfície preta. Vermelho fica reservado à parada. A prévia permite experimentar os estados visuais; os nomes e as contagens são demonstrativos e não representam a biblioteca real.

Após a primeira prévia MIDI, o usuário solicitou pads menores. A revisão usa altura de 104 px, espaçamento de 10 px e controles mais compactos, mantendo a grade desktop de 4 × 4.

Na rodada seguinte, o usuário propôs cinco colunas. A prévia desktop passa a usar essa densidade, com quatro colunas em larguras intermediárias e duas no celular. Os 16 sons de exemplo continuam sendo apenas conteúdo demonstrativo.

O usuário esclareceu que os pads devem ser quadrados, conforme a referência MIDI. A proporção passa a ser 1:1 em todas as larguras, substituindo a altura fixa de 104 px.

Após avaliar pads de aproximadamente 238 px no seu monitor, o usuário pediu cerca de 75% desse tamanho. A largura máxima da mesa passa a ser 1300 px, resultando em pads de aproximadamente 178 × 178 px no desktop, com cinco colunas. As dimensões são definidas pelo layout; texto e controles mantêm seu tamanho, sem transformação de escala.

## O que determina os canais

Os canais representam os sons em reprodução, independentemente do banco aberto. Abrir outro banco não cria, remove nem substitui canais. Disparar outro som adiciona seu canal; encerrar todas as execuções de um som libera o canal. Disparos simultâneos do mesmo efeito compartilham um único canal. Ativar uma cena pode alterar os canais porque inicia a transição dos sons, enquanto apenas selecionar seu banco não altera o áudio. A prévia visual ainda mostra canais estáticos de exemplo.

## Responsividade e stack da prévia

O usuário rejeitou o empilhamento vertical dos painéis no celular e reforçou o uso da stack escolhida. A prévia foi migrada do HTML isolado para uma rota TanStack Start em TSX. Estilos e breakpoints usam classes Tailwind; Button, Tabs, Slider e Carousel vêm do shadcn/ui, com Radix e Embla. O HTML separado e a exceção no servidor foram retirados.

No celular, abas persistentes alternam Pads, Canais e Playlist sem desmontar os painéis ou perder seus estados. Volume geral e parada permanecem disponíveis. A verificação automatizada usa tamanhos emulados; a sensação dos gestos ainda precisa ser validada em aparelho físico.

## Arraste livre e densidade pela área disponível

O usuário solicitou remover setas e paginação, usar arraste livre e aumentar a quantidade visível de pads em telas intermediárias. Bancos, pads e canais usam `dragFree` do Carousel shadcn/Embla, sem botões de anterior/próximo nem encaixe obrigatório após arrastar. O teclado continua disponível e arrastar não pode disparar um pad.

A grade mede a área efetiva do seu painel com ResizeObserver, mantendo pads quadrados de até 178 px. A quantidade de colunas cresce com a largura; as linhas aproveitam a altura, com até seis linhas. Em 390 × 844 aparecem dois por dois. Em 1024 × 768 há seis colunas e os 16 sons de exemplo ficam visíveis. Em 1024 × 1366 a área comporta seis por seis, embora a prévia contenha somente 16 sons. Nenhum dado de exemplo foi criado só para preencher espaços.

Os painéis simultâneos com playlist lateral e mixer inferior passam a aparecer a partir de `xl`. Antes desse ponto, abas liberam a área para a operação escolhida. A mesa inteira respeita a altura do viewport; o usuário não precisa rolar a página para alcançar volume ou parada. Layout, breakpoints e estilos permanecem em Tailwind; propriedades CSS calculadas só fornecem as dimensões medidas dos pads.

## Direção atual: mesa de pads personalizáveis

O usuário esclareceu que o objetivo é operar tudo como uma mesa MIDI: um pad pode conter a própria playlist, como “Caminhada à noite”, mantendo a sequência em execução e permitindo pausar. Isso substitui a composição anterior com playlist lateral, mixer inferior e abas.

A prévia agora mostra uma única área de pads em todas as larguras. “Caminhada à noite” representa a playlist “Viagem noturna”; toque inicia, pausa e retoma o estado demonstrativo. A faixa atual aparece no pad e nos controles selecionados. Um botão no canto permite selecionar o pad sem alterar sua reprodução. A faixa fixa inferior controla o transporte e os volumes do pad e da mesa; outros pads mantêm seus estados. “Personalizar pad” permite alterar nome e atribuição entre as fontes demonstrativas disponíveis. Nada é executado em áudio ou persistido na biblioteca real nesta rota.

A investigação em várias larguras identificou duas realimentações: o tamanho era derivado da quantidade inteira de colunas/linhas e voltava a determinar essas contagens; o aviso condicional de arraste mudava a altura medida. O breakpoint de painéis em 1280 px também reduzia abruptamente a área disponível. A nova estrutura remove esse breakpoint e mantém o espaço do aviso fixo. O tamanho nominal de 158 px só é reduzido para caber em áreas pequenas; colunas e linhas são derivadas depois, sem recalcular o tamanho. O espaço horizontal restante é distribuído entre as colunas.

## Revisão atual: grade nativa e grupos organizados

O usuário revogou o tamanho fixo anterior e pediu uso direto do Tailwind. A grade agora usa `auto-fill/minmax` no CSS Grid para definir suas tracks, com mínimo de legibilidade e preenchimento fracionário do espaço. O JavaScript só lê essas tracks para organizar o carrossel. Foram removidos o teto de 158 px, os gaps distribuídos artificialmente e a centralização vertical. O espaço entre título e pads é de aproximadamente 8 px; os gaps entre pads permanecem em 10 px. Em 685 px aparecem cinco colunas e em 839 px seis, sem definir faixas particulares para esses exemplos.

A navegação final solicitada é:

- Cenas: Personagens, Locais e Combate.
- Efeitos: Todos os efeitos, Ambiente e Pontuais.
- Personalizado: grupos salvos e “Criar grupo de pads”.

Combate é um tipo de cena. As categorias de Cenas abrem suas opções no mesmo menu, com “Voltar”, em vez de abrir outro painel lateral fora do celular. Menus de navegação não tornam a mesa modal. Os exemplos Taverna/Floresta, Mercador e Emboscada demonstram as três classificações sem alterar as cenas da biblioteca real.

Grupos de pads contêm referências aos pads escolhidos, incluindo playlists, e têm nome próprio. A prévia salva esses grupos no navegador em armazenamento separado, com validação e sem substituir a biblioteca principal. Navegar por uma cena, efeito ou grupo não interrompe a reprodução demonstrativa já em andamento. A criação de grupos permite selecionar os integrantes; os grupos podem ser reabertos após recarregar.

Cabeçalho/navegação e a faixa de controles usam `flex-wrap` conforme o espaço real de seus conteúdos. Esse arranjo também permite operar em 568 × 320, sem adicionar uma faixa especial de media para essa orientação.

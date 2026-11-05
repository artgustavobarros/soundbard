# Soundbard: desenho do produto

Status: produto em evolução local. As decisões 1–28 estão confirmadas; a rodada 9 substitui as escolhas anteriores de persistência e atualiza a interface. Os resultados executados e seus limites ficam em [docs/validation.md](validation.md); os critérios abaixo definem a aceitação da versão.

## Objetivo informado

Criar um website para adicionar músicas e sons próprios e controlar a sonorização de campanhas de RPG durante as sessões.

## Requisitos informados

- Adicionar vários arquivos de música e som.
- Organizar e acessar sons de cenário, ambiente, personagens e efeitos por busca e tags livres, permitindo várias tags por som.
- Reproduzir vários sons ao mesmo tempo.
- Controlar o volume e a repetição de cada som com facilidade.
- Preparar cenas com vários sons e ativar o conjunto com um clique, mantendo efeitos avulsos.
- Criar playlists específicas. Uma mesma música pode participar de várias playlists.
- Reproduzir uma música por vez na ordem da playlist, avançando automaticamente, junto dos ambientes e efeitos.
- Fazer transições graduais entre cenas. Efeitos avulsos em andamento terminam normalmente.
- Permitir execuções sobrepostas do mesmo efeito avulso; sons contínuos têm controles de ligar/desligar.
- Manter uma biblioteca central no servidor local, compartilhada entre clientes, com metadados no PostgreSQL e áudios persistentes no servidor.
- Manter cache no navegador para ler a biblioteca e tocar arquivos disponíveis sem servidor, após preparar a versão compilada. Gravações persistentes exigem conexão.
- Exportar áudios, cenas, playlists, grupos de pads, catálogo de tags e configurações em um backup completo.
- Preservar música e posição ao trocar entre cenas com a mesma playlist; selecionar a cena ativa mantém a reprodução.
- Oferecer volume geral, pausar/retomar tudo preservando posições e parar tudo imediatamente.

## Árvore de decisões

### Rodada 1: contexto de uso

1. **Quem ouve — confirmado:** reprodução no computador do mestre. A primeira versão não transmite nem sincroniza áudio com os dispositivos dos jogadores.
2. **Quem usa — confirmado:** validar primeiro o uso pessoal nas campanhas do usuário.
3. **Dispositivo principal — confirmado:** priorizar notebook/desktop para operar durante as sessões.
4. **Fluxo de operação — confirmado:** cenas preparadas com vários sons, volume e loop por som, ativadas com um clique, além de efeitos avulsos.

O usuário respondeu “sim para todos” e acrescentou playlists com participação da mesma música em várias delas.

### Rodada 2: playlists, transições e biblioteca

5. **Reprodução de playlist — confirmado:** tocar uma música por vez, avançando automaticamente na ordem escolhida, enquanto ambientes e efeitos continuam simultâneos.
6. **Troca de cena — confirmado:** ao trocar de Taverna para Floresta, os sons da cena anterior diminuem enquanto os novos aumentam. Efeitos avulsos já disparados terminam normalmente. Duração da transição e sons compartilhados seguem para a rodada 3.
7. **Novo disparo de um efeito — confirmado:** clicar duas vezes em um efeito de espada permite duas execuções sobrepostas. Sons contínuos usam controles de ligar/desligar.
8. **Local da biblioteca — substituído pela decisão 26:** manter arquivos e organização no computador usado na sessão, com exportação/importação para backup e transferência manual. A rodada 4 definiu uma cópia dos arquivos na biblioteca do navegador; a API de armazenamento ainda não foi escolhida.

O usuário respondeu “vamos sim para todos”.

### Rodada 3: relação entre cenas, playlists e músicas

9. **Playlist da cena — confirmado:** cada cena pode ter uma playlist musical, além dos ambientes e efeitos. Ativar uma cena inicia sua playlist e substitui a playlist musical anterior. Reativação da mesma cena ou playlist segue para a rodada 4.
10. **Transição e ambientes compartilhados — confirmado:** transição de 2 segundos, preservando a reprodução de ambientes presentes nas duas cenas e ajustando o volume ao da nova cena.
11. **Modos da playlist — confirmado:** embaralhar e repetição desligada, da música atual ou da playlist inteira. Por padrão, tocar na ordem escolhida e parar ao terminar.
12. **Remoção e exclusão — confirmado:** remover uma música da playlist mantém a música na biblioteca e nas outras playlists. Exclusão da biblioteca é uma ação separada, com confirmação e indicação das playlists e cenas afetadas.

O usuário respondeu “pode seguir” à rodada 3, aceitando as recomendações apresentadas.

### Rodada 4: persistência e operação

13. **Importação e uso sem internet — substituído pela decisão 26:** guardar uma cópia dos arquivos na biblioteca do navegador e preparar o site para abrir e tocar sem internet após a preparação inicial. A biblioteca pertence ao navegador e ao endereço do site; apagar os dados do site também apaga a biblioteca. A persistência e suas limitações estão documentadas na pesquisa técnica.
14. **Conteúdo do backup — confirmado:** incluir os próprios áudios, cenas, playlists e configurações na exportação, permitindo restaurar em outro computador. A restauração sobre uma biblioteca já preenchida segue para a rodada 5.
15. **Reativação e música compartilhada — confirmado:** selecionar novamente a cena ativa mantém a reprodução; trocar entre cenas com a mesma playlist preserva a música atual e sua posição. Reinício deve ser uma ação explícita.
16. **Controles globais — confirmado:** oferecer volume geral, pausar/retomar tudo preservando posições e parar tudo imediatamente.
17. **Organização da biblioteca — confirmado:** oferecer importação de vários arquivos por vez, busca por nome e tags livres, como “chuva”, “goblin” ou “combate”. Sons podem ter várias tags para servir a diferentes usos.

O usuário respondeu “sim” à rodada 4.

### Rodada 5: restauração, ajustes e validação

18. **Restaurar backup — confirmado:** a restauração substitui a biblioteca atual, incluindo áudios e organização, após confirmação explícita. A primeira versão não mescla automaticamente duas bibliotecas. O arquivo precisa ser validado antes de alterar os dados existentes.
19. **Ajustes durante a sessão — confirmado:** mudanças nos volumes e loops dos sons da cena durante a reprodução ficam temporárias até usar “Salvar cena”, preservando a configuração preparada. Ao sair e voltar à cena, vale sua configuração salva. Selecionar novamente a cena ainda ativa preserva a reprodução, conforme a decisão 15.
20. **Cenário inicial de validação — confirmado:** MP3, WAV e OGG como formatos iniciais; testar uma biblioteca com 100 arquivos e até 10 sons simultâneos. Esses números definem a primeira verificação, não um teto artificial da biblioteca nem capacidade já comprovada. Escalas maiores precisam de verificação própria.

O usuário respondeu “sim” à rodada 5. As cinco rodadas estão confirmadas.

### Rodada 6: stack e execução local

21. **Interface — confirmado com alteração do usuário:** TypeScript, pnpm, React com TanStack Start e shadcn/ui. O pedido “tanstack starter” foi interpretado como o framework TanStack Start. Usar o ecossistema TanStack conforme a necessidade; não instalar todas as bibliotecas antecipadamente. A proposta anterior de React com Vite diretamente foi substituída.
22. **Dados e áudio — persistência substituída pela decisão 26:** IndexedDB para a biblioteca e Web Audio API para a reprodução e mistura no navegador. Sem backend de aplicação ou Docker na primeira versão. Um servidor HTTP local para servir a interface não constitui uma API de negócio nem transfere a biblioteca para o servidor.
23. **Execução — confirmado e reforçado:** desenvolvimento e uso inteiramente locais. O usuário explicitou que inicialmente não quer hospedagem. Não publicar, sincronizar código com hospedagem nem configurar infraestrutura remota como parte desta versão. O registro anterior no Sites não define o destino do projeto e não foi publicado.

O usuário respondeu: “inicialmente eu não vou querer nem hospedar, vou usar todo local. quanto a interfaçe vamos usar tanstack starter e todo o ecosistema tanstack sempre que necessário, bem como shadcn, o resto é sim”.

### Rodada 7: testes

24. **Testes — confirmado:** usar Vitest para regras de playlists, cenas e backup, e Playwright para validar importação, reprodução, persistência, recuperação e uso offline no navegador. Ferramentas de teste não devem substituir validação dos cenários de áudio no navegador real.

O usuário respondeu “sim” à decisão 24.

### Rodada 8: ferramenta de qualidade

25. **Qualidade — confirmado por instrução do usuário:** usar Ultracite em lugar de Prettier e ESLint. A implementação usa o provider Biome, com presets de core, React, Vitest e Playwright. Formatação e lint são verificados com `pnpm lint`; correções são aplicadas com `pnpm lint:fix`. O usuário também autorizou agentes em paralelo para acelerar implementação e validação.

### Rodada 9: biblioteca central e direção Cerâmica

26. **Persistência — alteração confirmada pelo usuário:** biblioteca única no servidor, com metadados no PostgreSQL e áudios persistentes em disco. Dois clientes conectados à mesma API compartilham sons, playlists, cenas, tags e grupos de pads; alterações aparecem no outro cliente ao recarregar. O áudio continua sendo reproduzido no aparelho que o aciona, sem sincronização de transporte. A gravação exige confirmação do servidor e revisão atual; conflitos pedem recarregamento. O navegador mantém cache para leitura e reprodução dos arquivos disponíveis offline. Dados antigos só migram automaticamente para um servidor ainda vazio e sem uso; o legado permanece preservado e pode ser exportado quando houver outra biblioteca central. A [ADR 0004](adr/0004-biblioteca-central-postgresql.md) substitui as decisões anteriores de persistência.
27. **Interface — confirmada pelo usuário:** variante A de hardware, Cerâmica, como base. Fundo `#f8f8f8`; pad com borda `#151517`, face `#f7f7f7`, transição interna de até 2 px, relevo discreto e cantos `rounded-xl` de 12 px. Título e subtítulo ficam dentro do pad, no topo esquerdo, em Roboto: título em caixa alta e peso 800; subtítulo com peso 600. O cabeçalho contém apenas hamburger à esquerda, com linhas de 100%, 80% e 60%, abrindo um Sheet shadcn/ui com as ações.
28. **Isolamento E2E — confirmado pelo usuário:** reutilizar o PostgreSQL existente com um schema UUID por execução. O schema e a pasta temporária de áudio são removidos ao encerrar; o banco de uso e o servidor de desenvolvimento permanecem disponíveis. Testes são escritos e observados falhando antes da implementação, conforme a instrução reforçada de TDD.

## Estratégia de testes

- **Vitest:** migração, cache, conflitos de revisão e regras de ordem, embaralhamento e repetição; participação de uma música em várias playlists; cálculo das mudanças entre cenas; preservação das configurações salvas; validação e integridade do backup.
- **PostgreSQL:** verificar persistência real, revisão concorrente, integridade de arquivos e isolamento de schemas com testes Python.
- **Playwright:** verificar compartilhamento entre dois contextos de navegador, importar arquivos de áudio válidos, executar a reprodução real no navegador, verificar continuidade ao trocar cenas, persistência após reabrir, restauração e preservação dos dados quando o backup é inválido ou a operação é cancelada.
- **Offline:** preparar a interface e a biblioteca, retirar a conexão e reabrir a aplicação. A validação precisa demonstrar que a interface e os áudios presentes no cache continuam disponíveis. Alterações persistentes sem servidor devem falhar explicitamente.
- **Cenário inicial:** biblioteca com 100 arquivos e até 10 sons simultâneos, conforme a decisão 20. Esses números só serão considerados validados após executar os testes.
- **Método:** escrever testes de comportamento antes da implementação correspondente, seguindo a skill de TDD instalada. Testes do motor precisam incluir o navegador real; mocks isolados não comprovam reprodução de áudio.

## Critérios de aceitação

| Área | Cenário de validação | Resultado esperado |
| --- | --- | --- |
| Biblioteca | Importar em lote arquivos MP3, WAV e OGG válidos, aplicar várias tags a um som, buscar por nome e tags e reabrir o site. | Os arquivos e a organização continuam disponíveis após recarregar, inclusive em outro cliente conectado à mesma API. A biblioteca de teste contém 100 arquivos. Arquivos inválidos apresentam erro sem comprometer os já importados. |
| Playlists | Adicionar a mesma música a duas playlists, reordenar, remover de apenas uma, reproduzir e testar embaralhar e os três modos de repetição. | A participação nas playlists é independente. Remover de uma mantém a música na biblioteca e na outra. Sem repetição, a playlist avança em ordem e para ao terminar; os demais modos seguem suas configurações. |
| Cenas e continuidade | Preparar duas cenas que compartilham chuva e playlist, mas têm outros ambientes e volumes diferentes; trocar entre elas e selecionar novamente a cena ativa. Depois testar outra playlist. | A transição leva 2 segundos. Chuva e música compartilhadas preservam a posição; os volumes assumem os da nova cena. A cena ativa não reinicia. Uma playlist diferente substitui a anterior. Efeitos avulsos em andamento terminam normalmente. |
| Operação durante a sessão | Reproduzir até 10 sons simultâneos, incluindo dois disparos do mesmo efeito; ajustar volumes e loops, pausar/retomar, parar tudo e salvar a cena. | Efeitos se sobrepõem. Pausar/retomar preserva posições. Parar tudo silencia a reprodução imediatamente. Ajustes temporários só alteram a configuração preparada ao usar “Salvar cena”; sair e voltar recupera a configuração salva. |
| Offline e recuperação | Após a preparação inicial concluída, fechar e reabrir sem internet; exportar backup completo e restaurar em outra biblioteca. Testar cancelamento e backup inválido. | Interface e áudios presentes no cache funcionam offline. O backup restaura a biblioteca central, incluindo grupos de pads; gravações exigem servidor disponível. Substituição exige confirmação. Cancelar ou fornecer um arquivo inválido preserva a biblioteca atual. |

Excluir um som da biblioteca também deve mostrar as cenas e playlists afetadas e exigir confirmação, conforme a decisão 12. Os cenários precisam ser executados antes de afirmar que a primeira versão está validada.

## Fechamento do desenho

As decisões de produto das cinco primeiras rodadas foram confirmadas pelo usuário. Framework, linguagem, gerenciador de pacotes, execução e testes foram alinhados nas rodadas seguintes. O usuário então pediu “pode começar”, autorizando a implementação. A preferência posterior por Ultracite está registrada na decisão 25.

A implementação foi reorganizada na raiz do projeto, em TypeScript, com pnpm e TanStack Start. O esboço anterior em JavaScript e o lockfile do npm foram removidos. O código foi publicado em repositório público por solicitação posterior; a aplicação continua executada localmente, sem hospedagem remota configurada.

Atalhos não fazem parte dos requisitos confirmados. Contas de outros mestres, transmissão aos jogadores, sincronização da reprodução, atualização em tempo real e mesclagem automática de bibliotecas ficam fora deste escopo. O compartilhamento da biblioteca entre clientes foi incluído na decisão 26. A configuração atual escuta no loopback; acesso por tablet físico ainda exige configuração e validação de rede.

## Decisões de arquitetura

- [Biblioteca local no navegador e backup completo](adr/0001-biblioteca-local-no-navegador.md).
- [TypeScript, pnpm, TanStack Start e execução local](adr/0002-stack-tanstack-e-execucao-local.md).
- [FastAPI e processamento local de áudio](adr/0003-fastapi-e-processamento-local.md).
- [Biblioteca central em PostgreSQL e cache por aparelho](adr/0004-biblioteca-central-postgresql.md).

## Pesquisa

A comparação com projetos existentes está registrada em [projetos de áudio no GitHub](research/github-audio-projects.md). Nenhum desses projetos foi adotado como base. A stack e o armazenamento definidos posteriormente estão registrados nas decisões de arquitetura.

Os limites de armazenamento local, backup e funcionamento sem internet estão em [áudio local no navegador](research/browser-audio-storage.md). Esses limites continuam relevantes para o cache e o legado no navegador; a biblioteca central e seu backup seguem a ADR 0004.

# Projetos de áudio para campanhas de RPG

Pesquisa consultada em **1 de novembro de 2026**. Objetivo: encontrar referências para um website que recebe músicas e sons próprios, permite sobreposição, loop e controle individual de volume, e facilita o uso durante uma campanha.

Fontes: repositórios, documentação e código dos próprios projetos. Recursos foram verificados por leitura; nenhum aplicativo foi instalado ou executado. Datas de commits e releases foram consultadas na API pública do GitHub. A data mais recente não prova manutenção contínua, estabilidade ou compatibilidade atual.

## Quatro referências principais

| Projeto | Onde funciona e onde o som sai | Recursos confirmados | Limite relevante para esta ideia |
| --- | --- | --- | --- |
| [rpg-soundboard — pedro-ibs](https://github.com/pedro-ibs/rpg-soundboard) | Website estático; reprodução no navegador. | Sons simultâneos, volume individual e por categoria, loop, fades, playlist e configuração JSON. | O seletor de arquivo **não implementa upload completo**: o código toca `sounds/${fileName}`, e o formulário pede copiar os arquivos para essa pasta. É uma referência próxima dos controles desejados, mas exige melhorar a importação e o armazenamento. [Código do áudio](https://github.com/pedro-ibs/rpg-soundboard/blob/main/elements/script/audio-system.js), [formulário](https://github.com/pedro-ibs/rpg-soundboard/blob/main/elements/script/form.js), [configuração](https://github.com/pedro-ibs/rpg-soundboard/blob/main/elements/script/config.js). |
| [Ambient Director — Vegolas](https://github.com/Vegolas/ambient-director#soundboard) | Aplicação instalada no computador; painel web acessível na rede local. O áudio toca no computador servidor. | Importação MP3/WAV/OGG, sons sobrepostos, volume e loop por som, categorias, botão de parar tudo e cenas que acionam conjuntos de sons. | Inclui iluminação, Spotify e várias funções além do áudio. O painel web não significa transmissão de áudio aos navegadores dos jogadores. [Arquitetura e recursos](https://github.com/Vegolas/ambient-director#readme). |
| [Kenku FM — Owlbear Rodeo](https://github.com/owlbear-rodeo/kenku-fm) | Desktop Windows/macOS/Linux; saída local e/ou chamada de voz no Discord. | Arquivos locais, playlists, soundboards e áudio de páginas web. Código confirma sons simultâneos, volume por som, loop e fades. | Não é um website independente. A integração com Discord exige configurar um bot. [Modelo e mistura de áudio](https://github.com/owlbear-rodeo/kenku-fm#how-it-works), [controles individuais](https://github.com/owlbear-rodeo/kenku-fm/blob/main/src/player/features/soundboards/SoundItem.tsx), [reprodução](https://github.com/owlbear-rodeo/kenku-fm/blob/main/src/player/features/soundboards/useSoundboardPlayback.ts), [loop e fades](https://github.com/owlbear-rodeo/kenku-fm/blob/main/src/player/features/soundboards/Sound.ts). |
| [D&DJ — janbrrr](https://github.com/janbrrr/dndj#overview) | Servidor local Python conectado às caixas de som; controle por navegador, inclusive celular na mesma rede. | Música, efeitos simultâneos, volume por item, grupos para cenas, repetição infinita ou por quantidade e disparos em intervalos fixos ou aleatórios. | Apenas uma música por vez; cada efeito só tem uma instância simultânea. Preparação por YAML e arquivos locais; o README não demonstra upload pela interface. [Configuração e grupos](https://github.com/janbrrr/dndj#configuring-the-music-and-sounds). |

### Licença e atividade observada

As licenças abaixo descrevem o que os arquivos dos repositórios declaram; não foi feita análise jurídica de reutilização ou das dependências.

| Projeto | Licença declarada no arquivo | Último commit na branch padrão | Release mais recente encontrada |
| --- | --- | --- | --- |
| rpg-soundboard | [Apache-2.0](https://github.com/pedro-ibs/rpg-soundboard/blob/main/LICENSE). **O README menciona MIT: existe divergência.** | [2025-10-16](https://github.com/pedro-ibs/rpg-soundboard/commit/4f6867c92c629638f69444b55b1622f017683c72) | API não retornou release publicada. |
| Ambient Director | [MIT](https://github.com/Vegolas/ambient-director/blob/main/LICENSE) | [2026-07-24](https://github.com/Vegolas/ambient-director/commit/c3f7a97166355fb8e85ad5a04885bbe42c0f691c) | [v0.9.0, 2026-07-22](https://github.com/Vegolas/ambient-director/releases/tag/v0.9.0) |
| Kenku FM | [GPL-3.0](https://github.com/owlbear-rodeo/kenku-fm/blob/main/LICENSE) | [2026-03-04](https://github.com/owlbear-rodeo/kenku-fm/commit/dd534f1b4681a2ad00b63a1aed2a8352769f42f2) | [v1.5.5, 2026-03-04](https://github.com/owlbear-rodeo/kenku-fm/releases/tag/v1.5.5) |
| D&DJ | [MIT](https://github.com/janbrrr/dndj/blob/master/LICENSE) | [2020-06-09](https://github.com/janbrrr/dndj/commit/b0557481f301adf82cae74e5c619fff016402a36) | API não retornou release publicada. |

Metadados reproduzíveis: `GET https://api.github.com/repos/{owner}/{repo}/commits?per_page=1` e `GET https://api.github.com/repos/{owner}/{repo}/releases/latest`. Um push posterior em outra branch não foi contado como commit da branch padrão.

## Outros dois candidatos avaliados

- **[Soundux](https://github.com/Soundux/Soundux)**: soundboard desktop para Linux e Windows, com envio de áudio a aplicativos ou VB-CABLE. Possui interface web embutida, mas depende de recursos nativos; não equivale a um website autônomo. O README informa uma reescrita em andamento, remetendo à [issue #591](https://github.com/Soundux/Soundux/issues/591). Licença [GPL-3.0](https://github.com/Soundux/Soundux/blob/master/LICENSE). Último commit observado: [2026-01-01](https://github.com/Soundux/Soundux/commit/e02845233221aff3261865afb7ea158d4a51bd52); última release publicada encontrada: [0.2.7, 2021-06-04](https://github.com/Soundux/Soundux/releases/tag/0.2.7). Não aprofundei os recursos de cenas, upload e volume por faixa.
- **[RPG Ambience](https://github.com/JakobKallin/RPG-Ambience)**: player de música e elementos visuais no navegador, com integração ao Google Drive. O autor declara no README que não está em desenvolvimento ativo; as instruções de hospedagem são de agosto de 2018 e têm ressalva de não terem sido testadas. Licença [GPL-3.0](https://github.com/JakobKallin/RPG-Ambience/blob/master/LICENSE). Último commit observado: [2025-05-16](https://github.com/JakobKallin/RPG-Ambience/commit/3a4f6730722d3dbfcca2840a2fd2ef2bff0d0313). Esse commit não invalida o aviso de desenvolvimento encerrado. Não confirmei os detalhes atuais de importação e sobreposição.

## Leitura para o desenho do Soundbard

Estas são inferências de produto a partir das referências, ainda sujeitas às respostas da entrevista:

1. **Usar rpg-soundboard como referência de controles e Kenku FM como referência de reprodução.** Juntos mostram biblioteca, sons contínuos e efeitos pontuais; isso não exige adotar suas tecnologias ou seu código.
2. **Separar biblioteca de reprodução.** Adicionar um arquivo, classificar um som e tocar uma instância são ações diferentes. O seletor de arquivos do primeiro projeto ilustra por que selecionar não garante armazenar.
3. **Esclarecer onde os jogadores ouvirão.** Som no navegador do mestre, som em um servidor local e transmissão ao Discord representam produtos diferentes. A presença de interface web não resolve essa escolha.
4. **Testar a utilidade de cenas.** Uma cena pode agrupar chuva, vento e música com volumes salvos. Ambient Director e D&DJ oferecem referências de organização, mas o comportamento da transição deve ser decidido com o usuário.

## Perguntas que a pesquisa desbloqueia

- A sessão é presencial, remota ou ambas? Basta tocar no computador do mestre, ou os jogadores precisam ouvir por outro canal?
- “Subir arquivos” significa guardar no mesmo navegador, no computador que hospeda a aplicação ou em uma conta acessível de vários dispositivos?
- Trocar de cenário deve substituir tudo, conservar sons compartilhados ou apenas disponibilizar outros botões?
- Um segundo clique em um efeito deve reiniciar, interromper ou tocar outra instância sobre a primeira?
- A meta é um projeto próprio inspirado nessas referências ou adaptar um projeto existente?

Nenhum candidato foi adotado como base. As limitações registradas como “não confirmei” são lacunas desta pesquisa, não provas de inexistência do recurso.

# Áudio local no navegador: persistência e uso sem internet

Consulta: **1 de novembro de 2026**. Contexto informado: website pessoal para desktop, áudio local, arquivos e organização no computador, backup manual por exportação/importação. Este documento reúne limites da plataforma; não aprova uso offline nem escolhe arquitetura.

## O que pode ser armazenado

| Mecanismo | O que oferece | Limite que afeta o produto |
| --- | --- | --- |
| IndexedDB | Banco local que aceita objetos, arquivos e blobs; pode guardar binários de áudio e metadados. | Os dados pertencem à origem do site. Outro domínio não acessa automaticamente essa biblioteca. [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). |
| OPFS | Arquivos e diretórios privados da origem, com acesso otimizado; a MDN classifica a funcionalidade como amplamente disponível desde março de 2023. | É armazenamento interno do site, não uma pasta normal visível ao usuário. Requer contexto seguro e segue quotas do navegador. Apagar os dados do site também apaga seu OPFS. [MDN: OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system). |
| Arquivos visíveis no computador via File System Access | A aplicação pode ler arquivos ou pastas que o usuário autorizar; handles podem ser guardados em IndexedDB. | A permissão pode precisar ser concedida novamente entre sessões. Não existe autorização implícita para explorar o disco inteiro. [Chrome: File System Access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access#stored-file-or-directory-handles-and-permissions). |

**Distinção para a entrevista:** “ficar no computador” pode significar uma cópia interna no navegador ou arquivos em uma pasta escolhida. As duas experiências são diferentes. A escolha segue aberta.

## Quota, remoção e persistência

O armazenamento padrão é *best-effort*: pode ser removido pelo navegador por pressão de espaço. IndexedDB, Cache API e OPFS seguem a gestão de armazenamento da origem. Não existe capacidade fixa universal em GB; ela depende do navegador e do disco. Uma escrita acima da quota falha com `QuotaExceededError`. No modo privado, os dados normalmente desaparecem quando a sessão privada termina. O usuário também pode apagar os dados manualmente. [MDN: quotas e remoção](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

`navigator.storage.persist()` solicita armazenamento persistente e retorna `true` ou `false`; o navegador pode negar. É uma API amplamente disponível, mas exige contexto seguro. [MDN: persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist). Se concedida, a persistência evita a remoção automática por pressão de espaço descrita acima; não impede limpeza manual nem substitui um backup. [MDN: critérios de remoção](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria#when_is_data_evicted).

`navigator.storage.estimate()` permite consultar uso e quota estimados. Os valores não são uma garantia de espaço livre ou de que a próxima gravação terá sucesso. [MDN: estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate).

**Consequência de produto, ainda sem decisão técnica:** backup só de nomes, volumes e cenas não restaura sons cujos binários foram perdidos. Deve ficar explícito se a exportação inclui o áudio ou exige conservar os arquivos originais.

## Selecionar um arquivo não é enviá-lo nem guardá-lo

`<input type="file">` permite escolher um ou vários arquivos e obter acesso a eles pelo JavaScript. A seleção pode alimentar processamento local ou envio ao servidor; selecionar por si só não executa essas operações. O recurso é amplamente disponível desde julho de 2015. [MDN: input file](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file).

`showOpenFilePicker()` retorna handles, enquanto `showDirectoryPicker()` permite escolher uma pasta. Ambos têm disponibilidade limitada entre navegadores e exigem contexto seguro e interação do usuário. [MDN: showOpenFilePicker()](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker), [MDN: showDirectoryPicker()](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). A documentação do Chrome descreve suporte nos principais navegadores Chromium, com ressalvas como Brave; isso não equivale a suporte universal. [Chrome: suporte](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access#browser_support).

**Consequência para compatibilidade:** a ampla disponibilidade do OPFS não significa que abrir e modificar pastas normais por esses pickers tenha a mesma compatibilidade.

## Offline exige preparar a aplicação inteira

Um service worker pode interceptar pedidos e responder com HTML, scripts, estilos e outros recursos previamente guardados em cache. Essa preparação permite abrir a aplicação sem rede; apenas armazenar as músicas não prepara a interface. Conteúdo ausente do cache continuará precisando da rede ou de um comportamento de falha definido. [MDN: funcionamento offline](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

O service worker precisa ser obtido, instalado e ativado com sucesso. HTTPS é exigido em produção; `localhost` é considerado uma origem segura para desenvolvimento. Ter visitado uma página uma vez não prova que toda a preparação offline terminou. [MDN: instalação de service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

Instalar o site como PWA pelo menu do navegador não é pré-requisito para o service worker funcionar: ele pode instalar e ativar durante uma visita normal. A política de cache e atualização continua precisando ser implementada. [MDN: caching](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching#when_to_cache_resources).

## Cinco limites para orientar as próximas perguntas

1. **Dados locais não significam backup seguro.** A persistência pode ser negada e a limpeza manual continua possível.
2. **Uma biblioteca grande não tem espaço garantido.** Convém descobrir a escala pretendida antes de prometer capacidade.
3. **Pasta normal e biblioteca interna do navegador são opções distintas.** Acesso direto a pastas traz permissões e restrições de compatibilidade.
4. **Offline é um requisito próprio.** É preciso decidir se abrir e tocar sem internet deve funcionar após uma preparação inicial.
5. **Backup precisa ter conteúdo definido.** Restaurar organização e restaurar os próprios áudios são compromissos diferentes.

Nenhum teste de capacidade, navegador ou recuperação foi executado nesta pesquisa. Qualquer arquitetura escolhida depois precisará verificar esses comportamentos no navegador alvo.

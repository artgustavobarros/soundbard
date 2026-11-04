# TypeScript, pnpm, TanStack Start e execução local

**Atualização:** a decisão de não ter backend de aplicação foi substituída para download e corte de áudio pela [ADR 0003](0003-fastapi-e-processamento-local.md). A biblioteca e a reprodução continuam no navegador.

O usuário escolheu TypeScript, pnpm, TanStack Start e shadcn/ui, com preferência pelo ecossistema TanStack sempre que houver uma necessidade concreta. A primeira versão será desenvolvida e utilizada localmente, com IndexedDB para a biblioteca e Web Audio API para controlar o áudio. Não terá backend de aplicação, Docker ou hospedagem. A escolha substitui a tentativa inicial de JavaScript sem framework e npm, iniciada antes do alinhamento técnico.

## Aplicação no navegador

Usaremos o modo SPA do TanStack Start, cuja base de navegação é TanStack Router. O framework pode produzir uma interface estática quando a aplicação usa somente recursos do cliente. Não usaremos server functions para operar a biblioteca local. IndexedDB e áudio devem ser inicializados somente no navegador, pois a geração do shell ainda renderiza a raiz durante o build. Fontes: [TanStack Start](https://tanstack.com/start/latest), [SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode), [modelo de execução](https://tanstack.com/start/latest/docs/framework/react/guide/execution-model).

shadcn/ui fornece a base dos componentes e foi configurado seguindo sua integração oficial com TanStack Start e pnpm. Fonte: [instalação do shadcn/ui com TanStack](https://ui.shadcn.com/docs/installation/tanstack).

## Qualidade e testes

O usuário confirmou Vitest para regras e Playwright para fluxos no navegador. Posteriormente escolheu Ultracite para lint e formatação, substituindo Prettier e ESLint. O projeto usa os presets Biome de core, React, Vitest e Playwright; TypeScript é verificado separadamente. Os comandos ficam em `package.json`, com `pnpm check` reunindo lint, tipagem, unitários e build.

## Uso do ecossistema TanStack

Start e Router compõem a base confirmada. Query, Form, Table, Store e DB serão considerados quando resolverem uma necessidade do produto. Preferir o ecossistema não significa adicionar dependências sem uso ou criar uma camada de dados remota para a biblioteca local.

TanStack DB possui uma coleção IndexedDB oficial e pode ser considerado para metadados reativos. Sua documentação informa que a coleção carrega todo o object store em memória; por isso, não adotaremos automaticamente uma coleção reativa que contenha todos os binários de áudio. A organização dos stores e a eventual adoção de DB serão avaliadas durante a implementação. Fontes: [DB com IndexedDB](https://tanstack.com/db/latest/docs/collections/indexed-db-collection), [Query](https://tanstack.com/query/latest/docs/framework/react/overview), [Form](https://tanstack.com/form/latest/docs/overview), [Table](https://tanstack.com/table/latest/docs/guide/tables), [Store](https://tanstack.com/store/latest/docs/overview).

## Execução e uso sem internet

Um servidor HTTP local entregará a interface em localhost. Ele não armazenará músicas nem implementará uma API de negócio. Deve ser mantido um endereço local estável, incluindo a porta, pois a biblioteca pertence à origem do navegador.

O requisito de uso sem internet continua válido: a interface e os áudios importados precisam estar disponíveis após a preparação inicial. TanStack Start não prepara esse cache automaticamente; o build gera o service worker e o servidor local entrega o shell da aplicação. A rota mantém a mesma boundary de Suspense entre shell e cliente para evitar divergências de hidratação. Fontes: [SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode), [funcionamento offline](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

A primeira versão não inclui publicação, sincronização de código com hospedagem ou configuração de Docker. Escolher hospedagem futura exige nova decisão do usuário. O registro privado criado anteriormente no Sites permanece sem publicação e não define esta arquitetura.

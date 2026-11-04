# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Escolhida pelo usuário: TanStack Start, TypeScript, pnpm e shadcn/ui. Ecossistema TanStack conforme a necessidade. IndexedDB e Web Audio API. Vitest e Playwright. Execução local, com backend FastAPI/Python para yt-dlp e FFmpeg, sem hospedagem ou Docker. A biblioteca permanece no navegador.

## Users

O usuário é o mestre de suas campanhas de RPG. Opera pelo desktop/notebook durante as sessões e escuta ou compartilha a saída de áudio do próprio computador.

## Product Purpose

Preparar e operar músicas, ambientes e efeitos de campanha com poucos comandos durante a sessão. O escopo e os critérios de aceitação estão em [docs/design.md](docs/design.md).

## Operating Context

Importar áudios próprios ou preparar arquivos por links do YouTube, cortar trechos preservando o original, preparar playlists e cenas, ativar camadas simultâneas, disparar efeitos e ajustar volumes. Preservar a reprodução ao trocar entre cenas que compartilham ambientes ou playlist. Uso offline após preparação inicial; backup completo para recuperação e transferência manual.

## Capabilities and Constraints

As 24 decisões em docs/design.md foram aprovadas. O usuário autorizou iniciar a implementação. Não publicar, adicionar contas ou mover a biblioteca para um servidor. Validar inicialmente 100 arquivos e 10 sons simultâneos. Não existem áudios de campanha fornecidos: a biblioteca começa vazia e os testes usam arquivos de teste identificados.

## Brand Commitments

Nome do projeto: Soundbard. Interface em português.

## Product Principles

- Controles de reprodução acessíveis durante a sessão.
- Dados locais recuperáveis por backup completo.
- Ajustes de sessão não sobrescrevem cenas sem uma ação de salvar.
- Estados vazios e erros explicam a próxima ação.

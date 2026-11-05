# Biblioteca central em PostgreSQL e cache por aparelho

Decisão aceita em 4 de novembro de 2026: o usuário quer a mesma biblioteca no PC e no tablet, em vez de acervos independentes por navegador. O FastAPI passa a guardar o manifesto da biblioteca no PostgreSQL e os áudios em `SOUNDBARD_DATA_DIR/audio`, mantendo Web Audio no cliente. Esta decisão substitui a persistência exclusivamente no navegador das ADRs 0001–0003; a execução continua local.

O manifesto reúne sons, playlists, cenas, tags, grupos de pads e volume geral em um documento JSONB com revisão. Uma transação e a revisão esperada protegem a gravação do conjunto; uma alteração concorrente recebe HTTP 409 e exige recarregar. Essa unidade mantém referências consistentes sem acrescentar uma sincronização entre tabelas ou mesclagem automática. Os arquivos são imutáveis, identificados por SHA-256 e verificados antes da confirmação. Remover um som deixa seu arquivo inacessível pela biblioteca, mas não apaga imediatamente arquivos órfãos, evitando corrida com outras gravações.

O IndexedDB `soundbard-server-cache` conserva a biblioteca lida e os arquivos carregados neste aparelho. Sem servidor, esse cache permite leitura e reprodução dos arquivos disponíveis; gravações persistentes falham explicitamente. Atualizações de outro cliente aparecem ao recarregar, sem sincronização da reprodução.

O IndexedDB antigo `soundbard` e seus grupos locais são preservados. A migração automática só ocorre quando o servidor está vazio e nunca foi usado; uma biblioteca central existente não é sobrescrita. O usuário pode exportar o legado preservado e decidir sobre sua restauração. O backup completo inclui os próprios áudios e os grupos; uma cópia direta do servidor precisa preservar PostgreSQL e pasta de áudio juntos.

O custo dessa escolha é manter PostgreSQL e armazenamento persistente, além do cache por aparelho. Em troca, a biblioteca deixa de depender de um único perfil de navegador. Os E2E reutilizam o PostgreSQL configurado, com schema `soundbard_e2e_<UUID>` exclusivo no `search_path` e pasta de áudio temporária, ambos removidos ao encerrar; não limpam a biblioteca de uso.

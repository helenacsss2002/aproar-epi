# APROAR EPI/Fardamento — versão Neon

Estrutura pronta para deploy no Netlify com Functions e Neon Postgres.

- `public/`: site
- `netlify/functions/auth.mjs`: autenticação no servidor
- `netlify/functions/state.mjs`: sincronização compartilhada do fluxo
- `netlify/functions/health.mjs`: teste da conexão com Neon
- `DATABASE_URL`: deve existir nas Environment variables do Netlify, no escopo Functions

## Deploy recomendado
Conectar este projeto a um repositório Git e deixar o Netlify executar o build/deploy.

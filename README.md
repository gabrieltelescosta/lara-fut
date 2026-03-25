# Virtual Results — Esportes Virtuais Superbet

Next.js + Prisma (SQLite) para coletar placares e status dos eventos de **futebol virtual** (`sportId=190`) a partir da API pública da oferta.

## Requisitos

- Node 20+
- `npm install`

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

- `DATABASE_URL` — padrão `file:./dev.db` (SQLite na raiz do projeto)
- `CRON_SECRET` — Bearer token para `GET /api/cron/collector` e `POST /api/strategy-sim/refresh` (produção)
- `ENABLE_COLLECTOR_CRON=true` — no **desenvolvimento**, agenda o coletor a cada **1 minuto** no processo Node (`src/instrumentation.ts`) para virtual (ciclos curtos)
- `ENABLE_SIGNALS=false` — modo **só captura**: continua a gravar listagens, odds, `Result`, liquidação e subscription; **não** cria/resolve sinais nem recalcula simulação de estratégia. Omisso ou `true` = comportamento completo (sinais ligados)
- `SIGNAL_MARKETS_ENABLED` — opcional; lista `oneX2`, `btts`, `teamOu` (separados por vírgula) para incluir só esses mercados nos sinais gerados pelo coletor **e na simulação** (`/strategy`, nomes de mercado = oferta / sinal). Por omissão são os três. Catálogo: `GET /api/signal-markets`.

## Banco de dados

```bash
npx prisma migrate dev
```

O cliente Prisma é gerado em `postinstall` / `npm run build` para `src/generated/prisma`.

### Começar do zero

- **Só dados (mantém ficheiro SQLite):** no Tracker há o botão “Limpar dados”, ou `POST /api/admin/reset-data` com o mesmo `Authorization: Bearer` que o cron (se `CRON_SECRET` estiver definido; em dev sem secret, o POST é aceite).
- **Base nova (apaga `dev.db` e recria migrações):** `npm run db:reset` — depois **reinicia o `next dev`** (o processo antigo pode manter o ficheiro apagado e dar erro SQLite `readonly database` ao gravar).

## Desenvolvimento

```bash
npm run dev
```

- Dashboard: [http://localhost:3000](http://localhost:3000)
- Coletor manual: `curl -X POST http://localhost:3000/api/collector/run`
- **Odds:** cada coleta grava um **lote** em `OddsSnapshot` (histórico). Por omissão, lotes idênticos não duplicam; com `ODDS_SKIP_HASH_DEDUPE=true` grava sempre (mais dados, mais espaço). `GET /api/live` mostra o **último** lote por jogo; `GET /api/live?full=1` inclui `listingPayloadJson` e `subscriptionPayloadJson` (payload bruto da oferta + SSE).
- **Liquidação:** ao criar `Result`, o coletor gera `settlementJson` (cada linha de odds do último lote **até** ao fim do jogo vs placar — `hit` true/false ou `null` se o mercado não for reconhecido pelo parser heurístico).
- **Sinais:** cada **sinal** guarda `oddsAtSignalJson` no instante da criação.

## Produção (Vercel)

- `vercel.json` define cron `*/5 * * * *` em `/api/cron/collector`
- Em ambiente Vercel, requisições de cron incluem o header `x-vercel-cron: 1` (aceito pela rota)

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/collector/run` | Executa o coletor |
| GET | `/api/cron/collector` | Coletor para cron (auth) |
| POST | `/api/strategy-sim/refresh` | Recalcula simulação de estratégias e grava cache (mesmo auth) |
| GET | `/api/live` | Eventos recentes + `odds[]` (todos mercados/outcomes da última coleta) e `oddsCount` |
| GET | `/api/tracker` | Sinais + resumo + `meta` (primeiro sinal/evento, totais de odds) |
| POST | `/api/admin/reset-data` | Limpa sinais, eventos, odds, simulações (auth como cron) |
| GET | `/api/results` | Histórico paginado (`page`, `pageSize`, `tournamentId`, `from`, `to`) |
| GET | `/api/stats` | Agregados (placares mais frequentes) |
| GET | `/api/signal-markets` | Catálogo de mercados + subset ativo (`SIGNAL_MARKETS_ENABLED`) |

## Fonte dos dados

- Listagem: `GET .../v2/pt-BR/events/by-date` (sportId 190)
- Placares/status: `GET .../v3/subscription/pt-BR/events?events=...` (SSE, primeiro chunk)

Uso responsável: apenas para fins educacionais / análise; respeite os termos do site.

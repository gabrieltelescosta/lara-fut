# Deploy na VPS (PM2)

## 1. GitHub — primeiro push (na tua máquina)

O repositório [lara-fut](https://github.com/gabrieltelescosta/lara-fut) deve estar vazio ou aceitar o primeiro push.

```bash
cd /caminho/para/virtual-results
git init
git add -A
git status   # confirma que .env e *.db NÃO entram
git commit -m "Initial commit: virtual-results tracker + collector"
git branch -M main
git remote add origin https://github.com/gabrieltelescosta/lara-fut.git
git push -u origin main
```

## 2. VPS — Node 20+

```bash
cd /var/www   # ou a pasta que usares
git clone https://github.com/gabrieltelescosta/lara-fut.git
cd lara-fut
cp .env.example .env
nano .env   # DATABASE_URL, CRON_SECRET, ENABLE_SIGNALS, Telegram, etc.
```

**Base de dados na VPS:** mantém SQLite com ficheiro persistente, por exemplo:

```env
DATABASE_URL="file:./prod.db"
```

```bash
npm ci
npx prisma migrate deploy
npm run build
```

## 3. PM2

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs lara-fut
pm2 save
pm2 startup   # segue as instruções que o comando imprimir (systemd)
```

A app fica em `http://IP_DA_VPS:3100` (altera `PORT` no `ecosystem.config.cjs` ou no `.env` se precisares).

## 4. Coletor em background

Com `ENABLE_COLLECTOR_CRON=true` no `.env`, o Next (via `src/instrumentation.ts`) corre o coletor a cada **1 minuto** no mesmo processo PM2 — não precisas de cron separado.

Alternativa (só HTTP, sem cron interno): `ENABLE_COLLECTOR_CRON=false` e no crontab:

```cron
*/5 * * * * curl -s -H "Authorization: Bearer SEU_CRON_SECRET" https://teu-dominio.com/api/cron/collector
```

## 5. Nginx (opcional)

Proxy reverso `https://lara-fut.teudominio.com` → `127.0.0.1:3100` e certificado Let’s Encrypt.

## Segurança

- Não commits nem partilhes `.env`.
- Rota `/api/cron/collector` exige `CRON_SECRET` em produção (Bearer) se não for só localhost.

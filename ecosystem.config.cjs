/**
 * PM2 na VPS — não commitar segredos; usa ficheiro .env na mesma pasta.
 *
 * Uso:
 *   npm ci && npx prisma migrate deploy && npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "lara-fut",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        /** Ajusta se colidir com api-bigbet ou outro serviço */
        PORT: "3100",
      },
    },
  ],
};

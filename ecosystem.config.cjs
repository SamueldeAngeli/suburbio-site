// PM2 process for the site (`next start` behind the HTTPS reverse proxy).
// Secrets come from .env.production.local on the server, never from this file.
module.exports = {
  apps: [
    {
      name: 'suburbio-site',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --hostname 127.0.0.1 --port 3002',
      cwd: __dirname,
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: 10000,
      restart_delay: 3000,
      kill_timeout: 15000,
      time: true,
      out_file: `${__dirname}/logs/out.log`,
      error_file: `${__dirname}/logs/error.log`,
      env: { NODE_ENV: 'production' },
    },
  ],
};

module.exports = {
  apps: [
    {
      name: 'sermon-trainer',
      script: './server.mjs',
      cwd: '/home/ubuntu/apps/sermon-trainer',
      env: {
        NODE_ENV: 'production',
        PORT: 3106
      },
      autorestart: true,
      max_memory_restart: '350M',
      time: true
    }
  ]
};

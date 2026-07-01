module.exports = {
  apps: [{
    name: 'autotrack-api',
    script: './autotrack-backend/src/index.js',
    cwd: '/var/www/autotrack',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};

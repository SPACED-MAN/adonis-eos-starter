module.exports = {
  apps: [{
    name: 'adonis-eos',
    script: './build/bin/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3333,
      HOST: '0.0.0.0',
    }
  }]
}


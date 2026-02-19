// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'web-manager',
      script: 'app.js',
      cwd: '/Users/YOUR_USER/PROJECT 2026/Web Manager',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    // Add your other apps below:
    // {
    //   name: 'app-a',
    //   script: 'app.js',
    //   cwd: '/path/to/app-a',
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '500M',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3001
    //   }
    // },
  ]
};

// --- PM2 Setup Commands ---
// Start all:       pm2 start ecosystem.config.js
// Save list:       pm2 save
// Startup on boot: pm2 startup
// Log rotation:    pm2 install pm2-logrotate
// Configure logs:  pm2 set pm2-logrotate:max_size 10M
//                  pm2 set pm2-logrotate:retain 7
//                  pm2 set pm2-logrotate:compress true

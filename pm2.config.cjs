module.exports = {
  apps: [{
    name: 'flashbots-recovery',
    script: 'npm',
    args: 'run start',
    cwd: '/home/codebuster22/codebase/experiments/flashbots-recovery',
    
    // Restart policies
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    restart_delay: 2000,        // 2 second delay between restarts
    max_restarts: 20,           // Allow many restarts for network issues
    min_uptime: '30s',          // Must run 30s to be considered stable
    
    // Memory management
    max_memory_restart: '500M', // Restart if memory exceeds 500MB
    
    // Process behavior
    kill_timeout: 10000,        // 10s to gracefully shutdown
    listen_timeout: 8000,       // 8s to initialize
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PM2_GRACEFUL_TIMEOUT: 8000
    },
    
    // Logging (lightweight)
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_log_file: '10M',
    rotate_log: true,
    
    // Health monitoring
    health_check_http: false,
    health_check_grace_period: 3000,
    
    // No clustering for this single-instance app
    watch: false,
    ignore_watch: ['node_modules', 'logs']
  }]
};
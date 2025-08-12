# PM2 Process Management Guide

This guide covers how to use PM2 to manage the Flashbots Recovery System with automatic restart capabilities, monitoring, and production deployment features.

## 📋 Quick Getting Started

### 1. Install PM2 Globally
```bash
# Install PM2 as a system-wide process manager
npm install -g pm2

# Verify installation
pm2 --version
```

### 2. Start the Flashbots Recovery System
```bash
# Start using the PM2 configuration file
pm2 start pm2.config.cjs

# Check status
pm2 status
```

### 3. Monitor the Process
```bash
# View real-time logs
pm2 logs flashbots-recovery --lines 50

# Live monitoring dashboard
pm2 monit

# Check process status
pm2 status

# View detailed process info
pm2 describe flashbots-recovery
```

### 4. Basic Process Management
```bash
# Restart the process
pm2 restart flashbots-recovery

# Stop the process
pm2 stop flashbots-recovery

# Delete the process (stops and removes from PM2)
pm2 delete flashbots-recovery
```

## ⚙️ PM2 Configuration Details

Our `pm2.config.cjs` file contains the following configurations:

### Basic Application Settings
```javascript
name: 'flashbots-recovery'
```
- **Purpose**: Names the PM2 process for easy identification
- **Usage**: Allows you to reference the process by name in commands
- **Example**: `pm2 restart flashbots-recovery`

```javascript
script: 'npm'
args: 'run start'
```
- **Purpose**: Tells PM2 to execute `npm run start` (which runs `tsx index.ts`)
- **Why npm**: Uses local dependencies instead of requiring global `tsx` installation
- **Alternative**: Could use `script: 'tsx', args: 'index.ts'` if tsx is globally installed

```javascript
cwd: '/home/codebuster22/codebase/experiments/flashbots-recovery'
```
- **Purpose**: Sets the working directory where PM2 runs the application
- **Important**: Ensures the app finds `.env` files and relative paths correctly
- **Note**: Update this path if you move the project directory

### Process Management & Restart Policies
```javascript
instances: 1
exec_mode: 'fork'
```
- **instances**: Number of process instances to run (1 for blockchain monitoring)
- **exec_mode**: 'fork' for single instance, 'cluster' for multiple instances
- **Why fork**: Blockchain monitoring should run as single instance to avoid conflicts

```javascript
autorestart: true
```
- **Purpose**: **Core auto-restart feature** - automatically restarts if process dies
- **Triggers**: Process crashes, exits, or becomes unresponsive
- **Critical**: This is what makes PM2 act as your "auto start script"

```javascript
restart_delay: 2000
```
- **Purpose**: Waits 2 seconds before attempting restart after crash
- **Prevents**: Rapid restart loops that could overwhelm system resources
- **Balance**: Long enough to let system recover, short enough for quick recovery

```javascript
max_restarts: 20
```
- **Purpose**: Limits restart attempts to prevent infinite restart loops
- **Timeframe**: Resets after successful uptime period
- **Failsafe**: Stops trying if persistent issues prevent stable operation

```javascript
min_uptime: '30s'
```
- **Purpose**: Process must run 30 seconds to be considered "stable"
- **Impact**: Crashes within 30s count toward max_restarts limit
- **Tuning**: Increase if your app takes longer to fully initialize

### Resource Management
```javascript
max_memory_restart: '500M'
```
- **Purpose**: Automatically restart if memory usage exceeds 500MB
- **Protection**: Prevents memory leaks from crashing the entire system
- **Monitoring**: Checks memory usage periodically
- **Tuning**: Adjust based on your system's available RAM

```javascript
kill_timeout: 10000
```
- **Purpose**: Gives process 10 seconds to shutdown gracefully (SIGTERM)
- **Fallback**: Sends SIGKILL after timeout if process doesn't respond
- **Important**: Your app has graceful shutdown handlers that need time to work
- **Balance**: Long enough for cleanup, short enough for quick restarts

```javascript
listen_timeout: 8000
```
- **Purpose**: PM2 waits 8 seconds for app to initialize before marking as "started"
- **Blockchain context**: WebSocket connections and provider setup take time
- **Status**: Process shows "online" only after successful initialization
- **Tuning**: Increase if your app consistently takes longer to start

### Environment Configuration
```javascript
env: {
  NODE_ENV: 'production',
  PM2_GRACEFUL_TIMEOUT: 8000
}
```
- **NODE_ENV**: Sets production mode for optimized performance
- **PM2_GRACEFUL_TIMEOUT**: Extra time for graceful shutdown (supplements kill_timeout)
- **Extension**: Add other environment variables here if needed

### Logging Configuration
```javascript
log_file: './logs/combined.log'
out_file: './logs/out.log'
error_file: './logs/error.log'
```
- **Purpose**: Separates stdout, stderr, and combined logs into different files
- **Location**: Relative to project directory (creates `logs/` folder)
- **Benefits**: Easy debugging and log analysis

```javascript
log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
merge_logs: true
```
- **log_date_format**: Adds timestamps to every log entry
- **merge_logs**: Combines logs from multiple instances (if clustering)
- **Readability**: Creates chronological log sequences

```javascript
max_log_file: '10M'
rotate_log: true
```
- **max_log_file**: Rotates logs when they reach 10MB
- **rotate_log**: Creates new log files and archives old ones
- **Disk management**: Prevents logs from filling up disk space

### Monitoring & Development Settings
```javascript
health_check_http: false
health_check_grace_period: 3000
```
- **health_check_http**: Disables HTTP health checks (not needed for this app)
- **health_check_grace_period**: Timeout for health checks if enabled
- **Blockchain context**: Process health determined by successful startup, not HTTP responses

```javascript
watch: false
ignore_watch: ['node_modules', 'logs']
```
- **watch**: Disabled - prevents restarts on file changes (production stability)
- **ignore_watch**: Would ignore these directories if watch was enabled
- **Development**: Use `pm2 start pm2.config.cjs --watch` for development mode

## 🚀 In-Depth PM2 Usage

### Advanced Process Management

#### Starting with Different Configurations
```bash
# Start with custom name
pm2 start pm2.config.cjs --name "my-flashbots"

# Start in development mode with file watching
pm2 start pm2.config.cjs --watch

# Start with custom environment
pm2 start pm2.config.cjs --env development

# Start multiple instances (not recommended for this app)
pm2 start pm2.config.cjs -i 2
```

#### Process Information & Monitoring
```bash
# Detailed process information
pm2 describe flashbots-recovery

# Monitor CPU and memory usage
pm2 monit

# List all processes
pm2 list

# Show process tree
pm2 prettylist

# Monitor logs in real-time
pm2 logs flashbots-recovery --lines 100 --follow

# Monitor specific log files
pm2 logs flashbots-recovery --err    # Error logs only
pm2 logs flashbots-recovery --out    # Output logs only
```

#### Process Control
```bash
# Graceful restart (waits for current operations)
pm2 gracefulReload flashbots-recovery

# Force restart (immediate)
pm2 restart flashbots-recovery --force

# Stop process (keeps in PM2 list)
pm2 stop flashbots-recovery

# Start stopped process
pm2 start flashbots-recovery

# Restart all processes
pm2 restart all

# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all
```

### Memory & Performance Management
```bash
# Reset restart counter
pm2 reset flashbots-recovery

# Reload process with zero downtime (for cluster mode)
pm2 reload flashbots-recovery

# Show memory usage
pm2 show flashbots-recovery

# Monitor memory in real-time
pm2 monit
```

### Log Management
```bash
# View logs with timestamp
pm2 logs flashbots-recovery --timestamp

# Save logs to file
pm2 logs flashbots-recovery > flashbots.log

# Clear all logs
pm2 flush

# Rotate logs manually
pm2 reloadLogs

# View logs from specific time
pm2 logs flashbots-recovery --lines 1000 | grep "2025-08-12"
```

## 🔄 Startup & Auto-Start Management

### Adding Process to System Startup

#### 1. Generate Startup Script
```bash
# Detect your OS and generate startup script
pm2 startup

# Example output on Ubuntu:
# [PM2] You have to run this command as root. Execute the following command:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u codebuster22 --hp /home/codebuster22
```

#### 2. Execute the Generated Command
```bash
# Copy and run the command PM2 shows you (example):
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u codebuster22 --hp /home/codebuster22
```

#### 3. Save Current Process List
```bash
# Save currently running processes to startup list
pm2 save

# Verify saved processes
pm2 resurrect --dry-run
```

#### 4. Test Auto-Start
```bash
# Stop PM2 daemon
pm2 kill

# Simulate system startup (should restart your processes)
pm2 resurrect

# Or just reboot your system to test
sudo reboot
```

### Managing Startup Configuration

#### Update Startup List
```bash
# After adding/removing processes, update the startup list
pm2 save

# Force save (overwrite existing)
pm2 save --force
```

#### View Startup Configuration
```bash
# Show what will start on boot
pm2 startup show

# Show saved process dump
cat ~/.pm2/dump.pm2
```

#### Removing from Startup

#### Option 1: Remove Specific Process
```bash
# Stop and delete the process
pm2 stop flashbots-recovery
pm2 delete flashbots-recovery

# Update startup list
pm2 save
```

#### Option 2: Disable PM2 Auto-Start Completely
```bash
# Remove PM2 from system startup
pm2 unstartup

# Example output:
# [PM2] Freeze a process list on reboot via:
# $ pm2 save
# [PM2] Remove init script via:
# $ sudo rm /etc/systemd/system/pm2-codebuster22.service
```

#### Option 3: Clear All Startup Processes
```bash
# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all

# Save empty list
pm2 save

# Now only PM2 daemon starts on boot (no processes)
```

### Startup Troubleshooting

#### Check Startup Status
```bash
# Check if PM2 startup is enabled
systemctl status pm2-$USER

# Check PM2 service logs
journalctl -u pm2-$USER -f

# Check if processes started after boot
pm2 status
pm2 logs --lines 50
```

#### Common Issues & Solutions
```bash
# Issue: PM2 starts but processes don't
# Solution: Check saved process dump
pm2 resurrect --dry-run

# Issue: Permission errors on startup
# Solution: Verify user in startup command
pm2 startup --user $USER

# Issue: Environment variables not loaded
# Solution: Ensure .env file is accessible or use ecosystem file

# Issue: Wrong working directory
# Solution: Use absolute paths in pm2.config.cjs
```

## 🔧 Production Best Practices

### Security & Permissions
```bash
# Run PM2 as non-root user
pm2 startup --user codebuster22

# Secure log files
chmod 640 logs/*.log

# Protect configuration
chmod 600 pm2.config.cjs
```

### Monitoring & Alerts
```bash
# Monitor process health
pm2 monit

# Set up external monitoring
# - Use webhook alerts in your application
# - Monitor log files with external tools
# - Set up CPU/memory alerts
```

### Backup & Recovery
```bash
# Backup PM2 configuration
cp ~/.pm2/dump.pm2 /backup/location/

# Backup process configuration
cp pm2.config.cjs /backup/location/

# Restore after system migration
pm2 resurrect /backup/location/dump.pm2
```

This configuration provides robust auto-restart capabilities for your Flashbots Recovery System, ensuring minimal downtime and automatic recovery from most common failure scenarios.

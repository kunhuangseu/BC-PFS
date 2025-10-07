// progress-monitor.js - Progress Monitor
const fs = require('fs');
const path = require('path');

class ProgressMonitor {
    constructor() {
        this.progressFile = path.join(__dirname, 'reports', 'progress.json');
        this.isRunning = false;
        this.startTime = null;
        this.totalRounds = 0;
        this.currentRound = 0;
        // Ensure reports folder exists
        const reportsDir = path.join(__dirname, 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
    }

    // Initialize progress file
    init(totalRounds) {
        this.totalRounds = totalRounds;
        this.startTime = Date.now();
        this.currentRound = 0;
        
        const progressData = {
            status: 'running',
            startTime: this.startTime,
            totalRounds: totalRounds,
            currentRound: 0,
            progress: 0,
            elapsedTime: 0,
            estimatedTimeRemaining: 0,
        };
        
        fs.writeFileSync(this.progressFile, JSON.stringify(progressData, null, 2));
        console.log(`📊 Progress monitor started - Total rounds: ${totalRounds}`);
    }

    // Update progress
    updateProgress(round) {
        this.currentRound = round;
        
        const currentTime = Date.now();
        const elapsedTime = (currentTime - this.startTime) / 1000; // seconds
        const progress = (round / this.totalRounds) * 100;
        
        // Estimate remaining time
        let estimatedTimeRemaining = 0;
        if (round > 0) {
            const avgTimePerRound = elapsedTime / round;
            estimatedTimeRemaining = (this.totalRounds - round) * avgTimePerRound;
        }
        
        const progressData = {
            status: 'running',
            startTime: this.startTime,
            totalRounds: this.totalRounds,
            currentRound: round,
            progress: progress,
            elapsedTime: elapsedTime,
            estimatedTimeRemaining: estimatedTimeRemaining,
            lastUpdate: new Date().toISOString()
        };
        
        fs.writeFileSync(this.progressFile, JSON.stringify(progressData, null, 2));
    }

    // Complete
    complete() {
        const currentTime = Date.now();
        const totalTime = (currentTime - this.startTime) / 1000;
        
        const progressData = {
            status: 'completed',
            startTime: this.startTime,
            totalRounds: this.totalRounds,
            currentRound: this.totalRounds,
            progress: 100,
            elapsedTime: totalTime,
            estimatedTimeRemaining: 0,
            completedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(this.progressFile, JSON.stringify(progressData, null, 2));
        console.log(`\n✅ Progress monitor - Task completed! Total time: ${totalTime.toFixed(2)} seconds`);
    }

    error(errorMessage) {
        const progressData = {
            status: 'error',
            startTime: this.startTime,
            totalRounds: this.totalRounds,
            currentRound: this.currentRound,
            progress: (this.currentRound / this.totalRounds) * 100,
            elapsedTime: (Date.now() - this.startTime) / 1000,
            estimatedTimeRemaining: 0,
            error: errorMessage,
            errorAt: new Date().toISOString()
        };
        
        fs.writeFileSync(this.progressFile, JSON.stringify(progressData, null, 2));
        console.log(`❌ Progress monitor - Error occurred: ${errorMessage}`);
    }
}

// Progress Display
class ProgressDisplay {
    constructor() {
        this.progressFile = path.join(__dirname, 'reports', 'progress.json');
        this.lastUpdate = null;
        const reportsDir = path.join(__dirname, 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
    }

    // Display progress bar
    displayProgress() {
        try {
            if (!fs.existsSync(this.progressFile)) {
                console.log('⏳ Waiting for progress file...');
                return;
            }

            const data = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
            
            // Check if there are any updates
            if (this.lastUpdate && this.lastUpdate === data.lastUpdate) {
                return;
            }
            this.lastUpdate = data.lastUpdate;

            // Clear screen
            console.clear();
            
            // Display title
            console.log('📊 BC-PFS Prototype Verification Platform - Real-time Progress Monitoring');
            console.log('='.repeat(60));
            
            // Display basic information
            console.log(`Status: ${this.getStatusIcon(data.status)} ${data.status}`);
            console.log(`Total rounds: ${data.totalRounds}`);
            console.log(`Current round: ${data.currentRound}`);
            console.log(`Progress: ${data.progress.toFixed(2)}%`);
            
            // Display progress bar
            this.drawProgressBar(data.progress);
            
            // Display time information
            console.log(`\n⏱️  Time Information:`);
            console.log(`   Elapsed time: ${this.formatTime(data.elapsedTime)}`);
            if (data.estimatedTimeRemaining > 0) {
                console.log(`   Estimated remaining: ${this.formatTime(data.estimatedTimeRemaining)}`);
            }
            
            // Display error information
            if (data.status === 'error' && data.error) {
                console.log(`\n❌ Error information: ${data.error}`);
            }
            
            console.log(`\n🔄 Auto-refreshing... (Press Ctrl+C to exit)`);
            
        } catch (error) {
            console.log(`❌ Failed to read progress file: ${error.message}`);
        }
    }

    // Draw progress bar
    drawProgressBar(progress) {
        const barLength = 40;
        const filledLength = Math.floor((progress / 100) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        console.log(`\nProgress display: [${bar}] ${progress.toFixed(1)}%`);
    }

    // Format time
    formatTime(seconds) {
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    // Get status icon
    getStatusIcon(status) {
        switch (status) {
            case 'running': return '🔄';
            case 'completed': return '✅';
            case 'error': return '❌';
            default: return '⏳';
        }
    }

    // Start monitoring
    start() {
        console.log('🚀 Progress display started');
        console.log('Monitoring file:', this.progressFile);
        console.log('Press Ctrl+C to exit monitoring\n');
        
        // Display once immediately
        this.displayProgress();
        
        // Refresh every 1 second
        this.interval = setInterval(() => {
            this.displayProgress();
        }, 1000);
        
        // Handle exit signal
        process.on('SIGINT', () => {
            console.log('\n\n👋 Progress monitoring stopped');
            clearInterval(this.interval);
            process.exit(0);
        });
    }
}

// If this file is run directly, start the progress display
if (require.main === module) {
    const display = new ProgressDisplay();
    display.start();
}

module.exports = { ProgressMonitor, ProgressDisplay };

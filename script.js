document.addEventListener('DOMContentLoaded', () => {
    // Window controls
    const minimizeBtn = document.querySelector('.minimize-btn');
    const closeBtn = document.querySelector('.close-btn');

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });
    }

    // First check if settings elements exist
    if (document.querySelector('.settings-panel')) {
        // Initialize settings panel
        const settingsIcon = document.querySelector('.settings-icon');
        const settingsPanel = document.querySelector('.settings-panel');
        const closeSettings = document.querySelector('.close-settings');
        const saveSettings = document.querySelector('.save-settings');

        // Load saved settings
        const settings = Settings.load();
        const focusTimeInput = document.getElementById('focusTime');
        const shortBreakInput = document.getElementById('shortBreakTime');
        const longBreakInput = document.getElementById('longBreakTime');
        const autoStartBreaksInput = document.getElementById('autoStartBreaks');
        const autoStartPomodorosInput = document.getElementById('autoStartPomodoros');
        const volumeSlider = document.getElementById('volumeSlider');

        // Set initial values
        if (focusTimeInput) focusTimeInput.value = settings.focusTime;
        if (shortBreakInput) shortBreakInput.value = settings.shortBreakTime;
        if (longBreakInput) longBreakInput.value = settings.longBreakTime;
        if (autoStartBreaksInput) autoStartBreaksInput.checked = settings.autoStartBreaks;
        if (autoStartPomodorosInput) autoStartPomodorosInput.checked = settings.autoStartPomodoros;
        if (volumeSlider) {
            volumeSlider.value = settings.volume;
            // Update volume when slider moves
            volumeSlider.addEventListener('input', () => {
                const volume = parseFloat(volumeSlider.value);
                const audio = document.getElementById('timerComplete');
                if (audio) audio.volume = volume;
            });
        }

        // Settings panel controls
        if (settingsIcon) {
            settingsIcon.addEventListener('click', () => {
                settingsPanel.classList.add('visible');
            });
        }

        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                settingsPanel.classList.remove('visible');
            });
        }

        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                const newSettings = {
                    focusTime: parseInt(document.getElementById('focusTime').value),
                    shortBreakTime: parseInt(document.getElementById('shortBreakTime').value),
                    longBreakTime: parseInt(document.getElementById('longBreakTime').value),
                    autoStartBreaks: document.getElementById('autoStartBreaks').checked,
                    autoStartPomodoros: document.getElementById('autoStartPomodoros').checked,
                    volume: parseFloat(document.getElementById('volumeSlider').value)
                };
                
                Settings.save(newSettings);
                settingsPanel.classList.remove('visible');
                
                // Update timer buttons with new values
                document.querySelector('[data-mode="pomodoro"]').dataset.time = newSettings.focusTime;
                document.querySelector('[data-mode="shortBreak"]').dataset.time = newSettings.shortBreakTime;
                document.querySelector('[data-mode="longBreak"]').dataset.time = newSettings.longBreakTime;
                
                // Update audio volume
                const audio = document.getElementById('timerComplete');
                if (audio) audio.volume = newSettings.volume;
                
                timer.reset();
            });
        }
    }

    // Initialize classes
    const timer = new PomodoroTimer();
    const taskManager = new TaskManager();
});

// Settings management
const Settings = {
    load() {
        const settings = JSON.parse(localStorage.getItem('pomodoro-settings') || '{}');
        return {
            focusTime: settings.focusTime || 25,
            shortBreakTime: settings.shortBreakTime || 5,
            longBreakTime: settings.longBreakTime || 15,
            autoStartBreaks: settings.autoStartBreaks || false,
            autoStartPomodoros: settings.autoStartPomodoros || false,
            volume: parseFloat(settings.volume || 0.5)
        };
    },
    
    save(settings) {
        localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
    }
};

class PomodoroTimer {
    constructor() {
        // Get DOM elements
        this.timerDisplay = document.querySelector('.timer-circle .time');
        this.startButton = document.getElementById('startButton');
        this.pauseButton = document.getElementById('pauseButton');
        this.resetButton = document.getElementById('resetButton');
        this.presetButtons = document.querySelectorAll('.mode-selector button');
        this.statusDisplay = document.querySelector('.timer-status');
        this.sessionDisplay = document.querySelector('.session-count');
        this.progressRing = document.querySelector('.progress-ring .progress');
        
        // Load settings
        const settings = Settings.load();
        
        // Initialize timer state
        this.timeLeft = settings.focusTime * 60;
        this.initialTime = this.timeLeft;
        this.isRunning = false;
        this.sessions = 0;
        this.currentMode = 'pomodoro';

        // Set up progress ring
        const circumference = 2 * Math.PI * 90;
        this.progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        this.progressRing.style.strokeDashoffset = '0';

        // Initialize audio
        const audio = document.getElementById('timerComplete');
        if (audio) audio.volume = settings.volume;

        // Initialize
        this.setupEventListeners();
        this.updateDisplay();
    }

    setupEventListeners() {
        // Timer control buttons
        this.startButton.addEventListener('click', () => this.start());
        this.pauseButton.addEventListener('click', () => this.pause());
        this.resetButton.addEventListener('click', () => this.reset());

        // Mode selector buttons
        this.presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.presetButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.setTime(parseInt(button.dataset.time));
                this.setMode(button.dataset.mode);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (this.isRunning) this.pause();
                else this.start();
            } else if (e.key === 'r' || e.key === 'R') {
                this.reset();
            }
        });

        // Snooze modal controls
        const modal = document.querySelector('.snooze-modal');
        const snoozeBtn = modal.querySelector('.snooze-btn');
        const dismissBtn = modal.querySelector('.dismiss-btn');
        const audio = document.getElementById('timerComplete');

        snoozeBtn.addEventListener('click', () => {
            audio.pause();
            audio.currentTime = 0;
            modal.classList.remove('visible');
            this.timeLeft = 5 * 60; // 5 minutes
            this.initialTime = this.timeLeft;
            this.updateDisplay();
            this.updateProgress();
            this.start();
        });

        dismissBtn.addEventListener('click', () => {
            audio.pause();
            audio.currentTime = 0;
            modal.classList.remove('visible');
        });
    }

    setTime(minutes) {
        this.pause();
        this.timeLeft = minutes * 60;
        this.initialTime = this.timeLeft;
        this.updateDisplay();
        this.updateProgress();
    }

    setMode(mode) {
        this.currentMode = mode;
        let statusText = '';
        switch(mode) {
            case 'pomodoro':
                statusText = 'READY TO FOCUS';
                break;
            case 'shortBreak':
                statusText = 'SHORT BREAK';
                break;
            case 'longBreak':
                statusText = 'LONG BREAK';
                break;
        }
        this.statusDisplay.textContent = statusText;
    }

    start() {
        if (!this.isRunning) {
            const audio = document.getElementById('timerComplete');
            const modal = document.querySelector('.snooze-modal');
            audio.pause();
            audio.currentTime = 0;
            modal.classList.remove('visible');
            
            this.isRunning = true;
            this.startButton.disabled = true;
            this.pauseButton.disabled = false;
            this.statusDisplay.textContent = 'FOCUSING...';
            
            this.interval = setInterval(() => {
                this.timeLeft--;
                this.updateDisplay();
                this.updateProgress();
                
                if (this.timeLeft <= 0) {
                    this.complete();
                }
            }, 1000);
        }
    }

    pause() {
        if (this.isRunning) {
            this.isRunning = false;
            this.startButton.disabled = false;
            this.pauseButton.disabled = true;
            this.statusDisplay.textContent = 'PAUSED';
            clearInterval(this.interval);
        }
    }

    reset() {
        this.isRunning = false;
        this.startButton.disabled = false;
        this.pauseButton.disabled = true;
        clearInterval(this.interval);
        
        const settings = Settings.load();
        const activeMode = document.querySelector('.mode-selector button.active').dataset.mode;
        let minutes;
        
        switch(activeMode) {
            case 'pomodoro':
                minutes = settings.focusTime;
                break;
            case 'shortBreak':
                minutes = settings.shortBreakTime;
                break;
            case 'longBreak':
                minutes = settings.longBreakTime;
                break;
        }
        
        this.timeLeft = minutes * 60;
        this.initialTime = this.timeLeft;
        
        this.statusDisplay.textContent = 'READY TO START';
        this.updateDisplay();
        this.updateProgress();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timerDisplay.textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    updateProgress() {
        const circumference = 2 * Math.PI * 90;
        const progress = this.timeLeft / this.initialTime;
        const offset = circumference * (1 - progress);
        this.progressRing.style.strokeDashoffset = offset;
    }

    complete() {
        this.pause();
        this.sessions++;
        this.sessionDisplay.textContent = `SESSIONS: ${this.sessions}`;

        const audio = document.getElementById('timerComplete');
        const modal = document.querySelector('.snooze-modal');
        audio.play();
        modal.classList.add('visible');

        const settings = Settings.load();
        
        // Auto switch modes
        if (this.currentMode === 'pomodoro') {
            if (this.sessions % 4 === 0) {
                document.querySelector('[data-mode="longBreak"]').click();
                if (settings.autoStartBreaks) {
                    audio.pause();
                    audio.currentTime = 0;
                    modal.classList.remove('visible');
                    this.start();
                }
            } else {
                document.querySelector('[data-mode="shortBreak"]').click();
                if (settings.autoStartBreaks) {
                    audio.pause();
                    audio.currentTime = 0;
                    modal.classList.remove('visible');
                    this.start();
                }
            }
        } else {
            document.querySelector('[data-mode="pomodoro"]').click();
            if (settings.autoStartPomodoros) {
                audio.pause();
                audio.currentTime = 0;
                modal.classList.remove('visible');
                this.start();
            }
        }
    }
}

class TaskManager {
    constructor() {
        this.taskInput = document.querySelector('.task-input input');
        this.addButton = document.querySelector('.task-input button');
        this.taskList = document.querySelector('.task-list');
        this.tasks = this.loadTasks();

        this.setupEventListeners();
        this.renderTasks();
    }

    loadTasks() {
        return JSON.parse(localStorage.getItem('pomodoro-tasks') || '[]');
    }

    saveTasks() {
        localStorage.setItem('pomodoro-tasks', JSON.stringify(this.tasks));
    }

    setupEventListeners() {
        this.addButton.addEventListener('click', () => this.addTask());
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });
    }

    addTask() {
        const text = this.taskInput.value.trim();
        if (text) {
            this.tasks.push({
                id: Date.now(),
                text,
                completed: false
            });
            this.taskInput.value = '';
            this.saveTasks();
            this.renderTasks();
        }
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTasks();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveTasks();
        this.renderTasks();
    }

    renderTasks() {
        this.taskList.innerHTML = '';
        this.tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${task.completed ? 'completed' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => this.toggleTask(task.id));
            
            const text = document.createElement('span');
            text.textContent = task.text;
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '×';
            deleteButton.style.cssText = `
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                padding: 0 5px;
                color: #000;
                font-family: 'Press Start 2P', monospace;
            `;
            deleteButton.addEventListener('click', () => this.deleteTask(task.id));
            
            taskElement.appendChild(checkbox);
            taskElement.appendChild(text);
            taskElement.appendChild(deleteButton);
            
            this.taskList.appendChild(taskElement);
        });
    }
}
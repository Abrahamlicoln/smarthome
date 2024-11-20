const MQTT_CONFIG = window.MQTT_CONFIG || {
    broker: 'wss://broker.emqx.io:8084/mqtt',
    topics: {
        control: 'home/control',
        state: 'home/state',
        usage: 'home/usage'
    },
    rooms: ['livingroom', 'bedroom', 'kitchen']
};

class UsageController {
    constructor() {
        // Destroy any existing charts first
        Chart.helpers.each(Chart.instances, (instance) => {
            instance.destroy();
        });

        this.client = null;
        this.todayChart = null;
        this.weeklyChart = null;
        this.roomUsage = {
            livingroom: 0,
            bedroom: 0,
            kitchen: 0
        };
        this.init();
    }

    init() {
        const options = {
            clientId: 'usage_' + Math.random().toString(16).substr(2, 8),
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000
        };

        try {
            console.log('Connecting to MQTT broker...');
            this.client = mqtt.connect(MQTT_CONFIG.broker, options);

            this.client.on('connect', () => {
                console.log('Connected to MQTT broker!');
                this.setupSubscriptions();
                // Delay chart initialization slightly to ensure DOM is ready
                setTimeout(() => this.initializeCharts(), 100);
            });

            this.client.on('message', (topic, message) => {
                this.handleMessage(topic, message);
            });

        } catch (error) {
            console.error('Connection error:', error);
        }
    }

    destroyCharts() {
        // Destroy all chart instances
        Chart.helpers.each(Chart.instances, (instance) => {
            instance.destroy();
        });
        
        this.todayChart = null;
        this.weeklyChart = null;
    }

    setupSubscriptions() {
        this.client.subscribe(MQTT_CONFIG.topics.usage, (err) => {
            if (!err) console.log('Subscribed to usage updates');
        });
    }

    handleMessage(topic, message) {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received usage data:', data);
            
            if (topic === MQTT_CONFIG.topics.usage) {
                this.roomUsage[data.room] = data.usage;
                this.updateUsageDisplays();
                this.updateCharts(data);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    updateUsageDisplays() {
        Object.keys(this.roomUsage).forEach(room => {
            const usageElement = document.getElementById(`${room}-usage`);
            if (usageElement) {
                usageElement.textContent = `${this.roomUsage[room].toFixed(1)} kWh`;
            }
        });
    }

    initializeCharts() {
        // Ensure charts are destroyed before creating new ones
        this.destroyCharts();
        
        // Clear the canvas elements
        const todayCtx = document.getElementById('todayChart');
        const weeklyCtx = document.getElementById('weeklyChart');
        
        if (todayCtx) {
            const todayContext = todayCtx.getContext('2d');
            todayContext.clearRect(0, 0, todayCtx.width, todayCtx.height);
        }
        
        if (weeklyCtx) {
            const weeklyContext = weeklyCtx.getContext('2d');
            weeklyContext.clearRect(0, 0, weeklyCtx.width, weeklyCtx.height);
        }

        // Initialize new charts
        this.initializeTodayChart();
        this.initializeWeeklyChart();
    }

    initializeTodayChart() {
        const todayCtx = document.getElementById('todayChart');
        if (!todayCtx) {
            console.error('Today chart canvas not found');
            return;
        }

        try {
            this.todayChart = new Chart(todayCtx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                    datasets: [{
                        label: 'Power Usage (kWh)',
                        data: Array(24).fill(0),
                        borderColor: '#ffd700',
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: this.getChartOptions()
            });
        } catch (error) {
            console.error('Error initializing today chart:', error);
        }
    }

    initializeWeeklyChart() {
        const weeklyCtx = document.getElementById('weeklyChart');
        if (!weeklyCtx) {
            console.error('Weekly chart canvas not found');
            return;
        }

        try {
            this.weeklyChart = new Chart(weeklyCtx, {
                type: 'bar',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Power Usage (kWh)',
                        data: Array(7).fill(0),
                        backgroundColor: '#ffd700'
                    }]
                },
                options: this.getChartOptions()
            });
        } catch (error) {
            console.error('Error initializing weekly chart:', error);
        }
    }

    getChartOptions() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#9ca3af' : '#4b5563';

        return {
            responsive: true,
            scales: {
                y: {
                    ticks: { color: textColor },
                    grid: { color: isDark ? '#374151' : '#e5e7eb' }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { color: isDark ? '#374151' : '#e5e7eb' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        };
    }

    updateCharts(data) {
        const hour = new Date().getHours();
        this.todayChart.data.datasets[0].data[hour] = data.usage;
        this.todayChart.update();

        const day = new Date().getDay();
        this.weeklyChart.data.datasets[0].data[day] = data.usage;
        this.weeklyChart.update();
    }
}

// Clean up any existing charts before creating new ones
if (window.usageController) {
    window.usageController.destroyCharts();
}

// Initialize controller only once
$(document).ready(() => {
    if (!window.usageController) {
        window.usageController = new UsageController();
    }
});

// Clean up when page is unloaded
$(window).on('unload', () => {
    if (window.usageController) {
        window.usageController.destroyCharts();
    }
}); 
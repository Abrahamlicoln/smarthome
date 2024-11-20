class SmartHomeController {
    constructor() {
        // HiveMQ Cloud Configuration
        this.MQTT_CONFIG = {
            host: '12482ae0fb9d46d2857c1cff3a27b543.s1.eu.hivemq.cloud',
            port: 8884, // HiveMQ WebSocket Secure port
            protocol: 'wss', // WebSocket Secure protocol
            username: 'Abraham',
            password: 'Abrahamlicoln12@',
            clientId: `smart-home-controller-${Math.random().toString(36).substring(7)}`
        };

        // Topic Namespace Configuration
        this.TOPICS = {
            // Control topics for device interactions
            CONTROL: {
                TOGGLE: 'smart-home/control/toggle',
                BRIGHTNESS: 'smart-home/control/brightness',
                POWER: 'smart-home/control/power'
            },
            
            // State topics for device status
            STATE: {
                ROOMS: 'smart-home/state/rooms',
                POWER: 'smart-home/state/power',
                ERRORS: 'smart-home/state/errors'
            },
            
            // Usage and telemetry topics
            USAGE: {
                ENERGY: 'smart-home/usage/energy',
                DAILY: 'smart-home/usage/daily',
                MONTHLY: 'smart-home/usage/monthly'
            }
        };

        // Room state management
        this.rooms = {
            'Living Room': { 
                state: false, 
                brightness: 50,
                lastToggleTime: null,
                energyConsumed: 0 
            },
            'Bedroom': { 
                state: false, 
                brightness: 50,
                lastToggleTime: null,
                energyConsumed: 0 
            },
            'Kitchen': { 
                state: false, 
                brightness: 50,
                lastToggleTime: null,
                energyConsumed: 0 
            }
        };

        this.initMQTT();
    }

    initMQTT() {
        // Connection options
        const options = {
            clientId: this.MQTT_CONFIG.clientId,
            username: this.MQTT_CONFIG.username,
            password: this.MQTT_CONFIG.password,
            reconnectPeriod: 5000,
            clean: true,
            protocol: this.MQTT_CONFIG.protocol
        };

        // Create MQTT client with WebSocket Secure URL
        this.client = mqtt.connect(
            `${this.MQTT_CONFIG.protocol}://${this.MQTT_CONFIG.host}:${this.MQTT_CONFIG.port}`,
            options
        );

        // Connection event handlers
        this.client.on('connect', this.onConnect.bind(this));
        this.client.on('error', this.onError.bind(this));
        this.client.on('reconnect', this.onReconnect.bind(this));

        // Message handling
        this.client.on('message', this.handleMessage.bind(this));
    }

    onConnect() {
        console.log('Connected to MQTT Broker');
        
        // Subscribe to all relevant topics
        const subscriptions = [
            this.TOPICS.CONTROL.TOGGLE,
            this.TOPICS.CONTROL.BRIGHTNESS,
            this.TOPICS.CONTROL.POWER,
            this.TOPICS.STATE.ROOMS,
            this.TOPICS.USAGE.ENERGY
        ];

        subscriptions.forEach(topic => {
            this.client.subscribe(topic, (err) => {
                if (err) {
                    console.error(`Failed to subscribe to ${topic}:`, err);
                } else {
                    console.log(`Subscribed to ${topic}`);
                }
            });
        });

        // Publish initial state
        this.publishInitialState();
    }

    publishInitialState() {
        // Publish initial room states
        Object.entries(this.rooms).forEach(([roomName, roomData]) => {
            this.client.publish(
                this.TOPICS.STATE.ROOMS, 
                JSON.stringify({
                    room: roomName,
                    state: roomData.state,
                    brightness: roomData.brightness
                })
            );
        });
    }

    toggleLight(room) {
        const currentState = this.rooms[room].state;
        const newState = !currentState;

        // Update local state
        this.rooms[room].state = newState;
        this.rooms[room].lastToggleTime = new Date();

        // Publish toggle command
        this.client.publish(
            this.TOPICS.CONTROL.TOGGLE, 
            JSON.stringify({
                room: room,
                state: newState
            })
        );

        // Update state topic
        this.client.publish(
            this.TOPICS.STATE.ROOMS,
            JSON.stringify({
                room: room,
                state: newState,
                brightness: this.rooms[room].brightness
            })
        );
    }

    setBrightness(room, brightness) {
        // Validate brightness
        const validBrightness = Math.max(0, Math.min(100, brightness));
        
        // Update local state
        this.rooms[room].brightness = validBrightness;

        // Publish brightness control
        this.client.publish(
            this.TOPICS.CONTROL.BRIGHTNESS,
            JSON.stringify({
                room: room,
                brightness: validBrightness
            })
        );
    }

    handleMessage(topic, message) {
        try {
            const payload = JSON.parse(message.toString());

            switch(topic) {
                case this.TOPICS.CONTROL.TOGGLE:
                    this.processToggleCommand(payload);
                    break;
                case this.TOPICS.CONTROL.BRIGHTNESS:
                    this.processBrightnessCommand(payload);
                    break;
                case this.TOPICS.USAGE.ENERGY:
                    this.processEnergyUsage(payload);
                    break;
            }
        } catch (error) {
            this.client.publish(
                this.TOPICS.STATE.ERRORS, 
                JSON.stringify({ 
                    topic: topic, 
                    error: error.message 
                })
            );
        }
    }

    processToggleCommand(payload) {
        const { room, state } = payload;
        if (this.rooms[room]) {
            this.rooms[room].state = state;
            // Additional logic for state change
        }
    }

    processBrightnessCommand(payload) {
        const { room, brightness } = payload;
        if (this.rooms[room]) {
            this.rooms[room].brightness = brightness;
            // Additional logic for brightness change
        }
    }

    processEnergyUsage(payload) {
        const { room, energy } = payload;
        if (this.rooms[room]) {
            this.rooms[room].energyConsumed += energy;
            // Log or process energy consumption
        }
    }

    onError(error) {
        console.error('MQTT Connection Error:', error);
        this.client.publish(
            this.TOPICS.STATE.ERRORS, 
            JSON.stringify({ error: error.message })
        );
    }

    onReconnect() {
        console.log('Attempting to reconnect to MQTT Broker');
    }
}

const controller = new SmartHomeController();

// Add event listeners after MQTT connection is established
document.querySelectorAll('.light-toggle').forEach((toggle, index) => {
    const rooms = ['Living Room', 'Bedroom', 'Kitchen'];
    toggle.addEventListener('change', function() {
        controller.toggleLight(rooms[index]);
    });
});

document.querySelectorAll('input[type="range"]').forEach((slider, index) => {
    const rooms = ['Living Room', 'Bedroom', 'Kitchen'];
    slider.addEventListener('input', function() {
        controller.setBrightness(rooms[index], parseInt(this.value));
    });
});
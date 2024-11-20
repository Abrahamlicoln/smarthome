class SmartHomeController {
    constructor() {
        this.rooms = {
            livingroom: { state: false, brightness: 50 },
            bedroom: { state: false, brightness: 50 },
            kitchen: { state: false, brightness: 50 }
        };
        this.client = null;
        this.init();
        this.setupEventListeners();
    }
    init() {
        const options = {
            clientId: 'web_' + Math.random().toString(16).substr(2, 8),
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000
        };

        try {
            const connectUrl = 'wss://broker.emqx.io:8084/mqtt';
            console.log('Connecting to MQTT broker...');
            
            this.client = mqtt.connect(connectUrl, options);

            this.client.on('connect', () => {
                console.log('Connected to MQTT broker!');
                this.setupSubscriptions();
            });

            this.client.on('message', (topic, message) => {
                console.log('Received:', topic, message.toString());
                this.handleMessage(topic, message);
            });

            this.client.on('error', (error) => {
                console.error('Connection error:', error);
            });

        } catch (error) {
            console.error('Connection failed:', error);
        }
    }

    setupSubscriptions() {
        // Subscribe to state updates
        this.client.subscribe('home/state', (err) => {
            if (!err) {
                console.log('Subscribed to state updates');
            }
        });
    }

    setupEventListeners() {
        // Setup light toggles
        document.querySelectorAll('.light-toggle').forEach((toggle, index) => {
            const roomName = Object.keys(this.rooms)[index];
            toggle.addEventListener('change', () => {
                this.toggleLight(roomName, toggle.checked);
            });
        });

        // Setup brightness sliders
        document.querySelectorAll('input[type="range"]').forEach((slider, index) => {
            const roomName = Object.keys(this.rooms)[index];
            slider.addEventListener('input', () => {
                this.setBrightness(roomName, parseInt(slider.value));
            });
        });
    }

    toggleLight(room, state) {
        const $brightnessSlider = $(`input[type="range"]`).eq(Object.keys(this.rooms).indexOf(room));
        const brightness = $brightnessSlider.length ? parseInt($brightnessSlider.val()) : 50;

        // Send inverted state to Arduino
        const message = {
            room: room,
            state: !state,  // Invert the state before sending
            brightness: brightness
        };

        // Update local state with original state
        this.rooms[room].state = state;
        this.rooms[room].brightness = brightness;
        this.rooms[room].lastToggleTime = new Date();

        // Publish control message
        console.log('Publishing control message:', message);
        this.client.publish('home/control', JSON.stringify(message));

        // Update UI with original state
        const $bulb = $('.bulb').eq(Object.keys(this.rooms).indexOf(room));
        if (state) {
            $bulb.addClass('on').css('opacity', brightness / 100);
        } else {
            $bulb.removeClass('on').css('opacity', 1);
        }
    }


    setBrightness(room, brightness) {
        const message = {
            room: room,
            state: this.rooms[room].state,
            brightness: brightness
        };

        this.client.publish('home/control', JSON.stringify(message));
    }

     handleMessage(topic, message) {
        try {
            const data = JSON.parse(message.toString());
            
            if (topic === 'home/state') {
                const roomIndex = Object.keys(this.rooms).indexOf(data.room);
                if (roomIndex !== -1) {
                    const roomName = Object.keys(this.rooms)[roomIndex];
                    const invertedState = !data.state;  // Invert the received state
                    
                    // Update toggle with inverted state
                    const toggle = document.querySelectorAll('.light-toggle')[roomIndex];
                    toggle.checked = invertedState;

                    // Update brightness
                    const slider = document.querySelectorAll('input[type="range"]')[roomIndex];
                    slider.value = data.brightness;

                    // Update bulb visualization using inverted state
                    const bulb = document.querySelectorAll('.bulb')[roomIndex];
                    if (invertedState) {
                        bulb.classList.add('on');
                        bulb.style.opacity = data.brightness / 100;
                    } else {
                        bulb.classList.remove('on');
                        bulb.style.opacity = 1;
                    }

                    // Update local state
                    this.rooms[roomName].state = invertedState;
                    this.rooms[roomName].brightness = data.brightness;
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    updateUI(room, state, brightness) {
        const roomIndex = Object.keys(this.rooms).indexOf(room);
        const $bulb = $('.bulb').eq(roomIndex);
        
        if (state) {
            $bulb.addClass('on').css('opacity', brightness / 100);
        } else {
            $bulb.removeClass('on').css('opacity', 1);
        }
    }
}

// Update the event listeners to use jQuery
$(document).ready(() => {
    const controller = new SmartHomeController();

    // Light toggles
    $('.light-toggle').each((index, toggle) => {
        const rooms = Object.keys(controller.rooms);
        $(toggle).on('change', function() {
            controller.toggleLight(rooms[index], this.checked);
        });
    });

    // Brightness sliders
    $('input[type="range"]').each((index, slider) => {
        const rooms = Object.keys(controller.rooms);
        $(slider).on('input', function() {
            const room = rooms[index];
            const brightness = parseInt($(this).val());
            if (controller.rooms[room].state) {
                controller.setBrightness(room, brightness);
            }
        });
    });
});
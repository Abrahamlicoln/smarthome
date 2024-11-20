const MQTT_CONFIG = {
    broker: 'wss://broker.emqx.io:8084/mqtt',
    topics: {
        control: 'home/control',
        state: 'home/state',
        usage: 'home/usage'
    },
    rooms: ['livingroom', 'bedroom', 'kitchen']
}; 
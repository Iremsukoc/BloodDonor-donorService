
const amqp = require('amqplib');

async function sendToRabbitMQ(message) {
    try {
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();

        const queue = 'blood_request_queue';
        await channel.assertQueue(queue, { durable: true });

        await channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });

        console.log('Message sent to RabbitMQ:', message);

        await channel.close();
        await connection.close();
    } catch (error) {
        console.error('Error sending message to RabbitMQ:', error);
    }
}

module.exports = sendToRabbitMQ;

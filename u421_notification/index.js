require('dotenv').config();
const amqp = require('amqplib');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join('/app/logs', 'u421_event_logs.json');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
}

async function startConsumer() {
  let retries = 15;
  while (retries > 0) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL);
      const channel = await conn.createChannel();
      await channel.assertQueue(process.env.RABBITMQ_QUEUE, { durable: true });
      channel.prefetch(1);

      console.log('u421_notification: Waiting for messages...');

      channel.consume(process.env.RABBITMQ_QUEUE, (msg) => {
        if (msg !== null) {
          const event = JSON.parse(msg.content.toString());
          const logEntry = {
            received_at: new Date().toISOString(),
            event
          };

          // Log to console
          console.log('[NOTIFICATION] New event received:', logEntry);

          // Append to JSON log file (lakehouse ingestion simulation)
          const existing = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
          existing.push(logEntry);
          fs.writeFileSync(LOG_FILE, JSON.stringify(existing, null, 2));

          channel.ack(msg);
        }
      });
      return;
    } catch (err) {
      console.log(`Waiting for RabbitMQ... (${retries} retries left)`);
      retries--;
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  console.error('u421_notification: Failed to connect to RabbitMQ');
}

startConsumer();

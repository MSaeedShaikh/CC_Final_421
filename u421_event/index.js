require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const amqp = require('amqplib');
const pool = require('./db');

const app = express();
app.use(express.json());

let channel;

// Connect to RabbitMQ with retry
async function connectRabbitMQ() {
  let retries = 10;
  while (retries > 0) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await conn.createChannel();
      await channel.assertQueue(process.env.RABBITMQ_QUEUE, { durable: true });
      console.log('Connected to RabbitMQ');
      return;
    } catch (err) {
      console.log(`RabbitMQ not ready, retrying... (${retries} left)`);
      retries--;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('Could not connect to RabbitMQ');
}

// Initialize DB table
pool.query(`
  CREATE TABLE IF NOT EXISTS u421_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log('u421_events table ready'))
  .catch(err => console.error('DB init error:', err));

// JWT middleware
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Create event
app.post('/events', authenticate, async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const result = await pool.query(
      'INSERT INTO u421_events (title, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [title, description, req.user.username]
    );
    const event = result.rows[0];

    // Publish to RabbitMQ
    if (channel) {
      channel.sendToQueue(
        process.env.RABBITMQ_QUEUE,
        Buffer.from(JSON.stringify(event)),
        { persistent: true }
      );
      console.log('Event published to queue:', event.id);
    }

    res.status(201).json({ message: 'Event created', event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all events
app.get('/events', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM u421_events ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

connectRabbitMQ();

app.listen(process.env.EVENT_PORT, () => {
  console.log(`u421_event running on port ${process.env.EVENT_PORT}`);
});

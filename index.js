// hello world
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require('path');
const axios = require('axios');
const apiRoutes = require('./routes/api');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// MongoDB Connection
const uri = "mongodb+srv://Rick:Rick@stock-run.ts0bc.mongodb.net/finance-portfolio?retryWrites=true&w=majority&appName=Stock-Run";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 50,
  minPoolSize: 5,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  waitQueueTimeoutMS: 15000,
  keepAlive: true,
  retryWrites: true,
  retryReads: true
});

let db;
let isConnected = false;

// Connect to MongoDB
async function connectToMongoDB() {
  if (isConnected) {
    return;
  }

  try {
    await client.connect();
    db = client.db("finance-portfolio");
    await db.command({ ping: 1 });
    isConnected = true;
    console.log("Successfully connected to MongoDB!");
  } catch (err) {
    console.error('MongoDB connection error:', err);
    isConnected = false;
    // Attempt to reconnect after 5 seconds
    setTimeout(connectToMongoDB, 5000);
  }
}

// Handle connection errors and reconnection
client.on('close', () => {
  console.log('MongoDB connection closed. Attempting to reconnect...');
  isConnected = false;
  setTimeout(connectToMongoDB, 5000);
});

client.on('error', (err) => {
  console.error('MongoDB error event:', err);
  isConnected = false;
  setTimeout(connectToMongoDB, 5000);
});

client.on('timeout', () => {
  console.error('MongoDB timeout event occurred');
  isConnected = false;
  setTimeout(connectToMongoDB, 5000);
});

// Initial connection
connectToMongoDB();

// Make db available to routes with connection check
app.use(async (req, res, next) => {
  if (!isConnected) {
    try {
      await connectToMongoDB();
    } catch (err) {
      console.error('Failed to reconnect to MongoDB:', err);
      return res.status(500).json({ error: 'Database connection error' });
    }
  }
  req.db = db;
  next();
});

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.render('index');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Handle graceful shutdown
process.on('SIGINT', async () => {
  try {
    await client.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});
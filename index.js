// hello world
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');
const apiRoutes = require('./routes/api');

const app = express();

// Request timeout middleware
const timeout = require('connect-timeout');
app.use(timeout('30s'));
app.use(haltOnTimedout);

function haltOnTimedout(req, res, next) {
  if (!req.timedout) next();
}

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// MongoDB Connection
const uri = process.env.MONGODB_URI || "mongodb+srv://Rick:Rick@stock-run.ts0bc.mongodb.net/finance-portfolio?retryWrites=true&w=majority";

// Log connection string (without credentials)
console.log('MongoDB Connection URI:', uri.replace(/(mongodb\+srv:\/\/)[^@]+@/, '$1*****@'));

// Connect Mongoose for models
mongoose.set('strictQuery', false);
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 30000,
})
.then(() => {
  console.log('Mongoose connected successfully');
  
  // Set up Mongoose connection events
  mongoose.connection.on('error', err => {
    console.error('Mongoose connection error:', err);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected, attempting to reconnect...');
    setTimeout(() => {
      mongoose.connect(uri).catch(err => console.error('Reconnection failed:', err));
    }, 5000);
  });
})
.catch(err => {
  console.error('Mongoose initial connection error:', err);
  console.error('Error details:', err.message);
});

// Also keep the MongoDB native client for any direct operations
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 1,                // Reduced to minimum for free tier
  minPoolSize: 0,                // No minimum pool for free tier
  connectTimeoutMS: 30000,       // 30 seconds
  socketTimeoutMS: 45000,        // 45 seconds
  serverSelectionTimeoutMS: 30000,// 30 seconds
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  w: 1,                         // Basic write concern
  readPreference: 'primary'     // Read from primary only
});

let db;
let isConnected = false;

// Connect to MongoDB with retry logic
async function connectToMongoDB() {
  if (isConnected) {
    return;
  }

  const maxRetries = 5;  // Increased retries
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to connect to MongoDB (attempt ${retryCount + 1}/${maxRetries})...`);
      await client.connect();
      
      // Get database name from environment or default
      const dbName = process.env.MONGODB_DB || "finance-portfolio";
      console.log(`Using database: ${dbName}`);
      
      db = client.db(dbName);
      
      // Test the connection with a longer timeout
      await Promise.race([
        db.command({ ping: 1 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection test timeout')), 10000)
        )
      ]);

      isConnected = true;
      console.log("Successfully connected to MongoDB!");
      
      // Initialize collections with indexes if needed
      await initializeCollections();
      
      return;
    } catch (err) {
      retryCount++;
      console.error(`MongoDB connection attempt ${retryCount} failed:`, err);
      isConnected = false;
      
      if (retryCount === maxRetries) {
        console.error('Max retry attempts reached. Could not connect to MongoDB');
        throw err;
      }
      
      // Exponential backoff with maximum of 10 seconds
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
      console.log(`Waiting ${backoffTime}ms before next retry...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
}

// Initialize collections and indexes
async function initializeCollections() {
  try {
    console.log('Initializing collections and creating indexes...');
    
    // Ensure collections exist first
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    // Create trades collection and indexes if needed
    if (!collectionNames.includes('trades')) {
      console.log('Creating trades collection...');
      await db.createCollection('trades');
    }
    const trades = db.collection('trades');
    await trades.createIndex({ userId: 1 });
    await trades.createIndex({ ticker: 1 });
    
    // Create cashes collection and indexes if needed
    if (!collectionNames.includes('cashes')) {
      console.log('Creating cashes collection...');
      await db.createCollection('cashes');
    }
    const cashes = db.collection('cashes');
    await cashes.createIndex({ userId: 1 });
    
    console.log('Database collections and indexes created successfully');
  } catch (err) {
    console.error('Error initializing collections:', err);
    // Don't throw error here, just log it
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
connectToMongoDB().catch(err => {
  console.error('Initial MongoDB connection failed:', err);
  process.exit(1);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Make db available to routes with connection check and operation timeout
app.use(async (req, res, next) => {
  if (!isConnected) {
    try {
      await connectToMongoDB();
    } catch (err) {
      console.error('Failed to reconnect to MongoDB:', err);
      return res.status(503).json({ error: 'Database connection error. Please try again later.' });
    }
  }

  // Add operation timeout wrapper to the db object
  req.db = new Proxy(db, {
    get: function(target, property) {
      const original = target[property];
      if (typeof original === 'function') {
        return async function(...args) {
          try {
            console.log(`Executing database operation: ${property}`);
            const result = await Promise.race([
              original.apply(target, args),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timeout')), 60000)
              )
            ]);
            console.log(`Database operation ${property} completed successfully`);
            return result;
          } catch (err) {
            console.error(`Database operation ${property} failed:`, err);
            throw err;
          }
        };
      }
      return original;
    }
  });
  
  next();
});

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.render('index');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    dbConnected: isConnected,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Starting graceful shutdown...');
  server.close(async () => {
    try {
      await client.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
});
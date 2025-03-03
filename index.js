// hello world
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
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
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10,               // Reduced to prevent overwhelming the free tier
  minPoolSize: 1,               // Reduced to save resources
  connectTimeoutMS: 30000,      // 30 seconds
  socketTimeoutMS: 45000,       // 45 seconds
  waitQueueTimeoutMS: 30000,    // 30 seconds
  heartbeatFrequencyMS: 10000,
  keepAlive: true,
  retryWrites: true,
  retryReads: true,
  serverSelectionTimeoutMS: 30000,
  maxIdleTimeMS: 30000,
  w: 'majority',                // Ensures write consistency
  readPreference: 'primary',    // Ensures read consistency
  useUnifiedTopology: true,     // Uses the new topology engine
  compressors: ['zlib'],        // Enable compression
  zlibCompressionLevel: 6       // Moderate compression level
});

let db;
let isConnected = false;

// Connect to MongoDB with retry logic
async function connectToMongoDB() {
  if (isConnected) {
    return;
  }

  const maxRetries = 3;  // Reduced number of retries
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to connect to MongoDB (attempt ${retryCount + 1}/${maxRetries})...`);
      await client.connect();
      db = client.db(process.env.MONGODB_DB || "finance-portfolio");
      
      // Test the connection with a timeout
      await Promise.race([
        db.command({ ping: 1 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection test timeout')), 5000)
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
      
      // Linear backoff instead of exponential: 3 seconds between retries
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

// Initialize collections and indexes
async function initializeCollections() {
  try {
    // Ensure indexes exist for better query performance
    const trades = db.collection('trades');
    await trades.createIndex({ userId: 1 });
    await trades.createIndex({ ticker: 1 });
    
    const cashes = db.collection('cashes');
    await cashes.createIndex({ userId: 1 });
    
    console.log('Database indexes created successfully');
  } catch (err) {
    console.error('Error creating indexes:', err);
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
            const result = await Promise.race([
              original.apply(target, args),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timeout')), 30000)
              )
            ]);
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
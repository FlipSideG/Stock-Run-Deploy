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
  }
});

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

connectToMongoDB();

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.render('index');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const express = require('express');
const router = express.Router();
const Cash = require('../models/Cash');
const Trade = require('../models/Trade');
const axios = require('axios');
require('dotenv').config();

// Get API key from environment variables
const API_KEY = process.env.STOCK_API_KEY;

// Add Finnhub API key
const FINNHUB_API_KEY = 'cv2rpi1r01qkvjnliljgcv2rpi1r01qkvjnlilk0';

// Helper function to get stock price
async function getStockPrice(ticker) {
  try {
    // Using Alpha Vantage API as an example
    const response = await axios.get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`);
    const price = parseFloat(response.data['Global Quote']['05. price']);
    return price;
  } catch (error) {
    console.error('Error fetching stock price:', error);
    return null;
  }
}

// Get cash balance
router.get('/cash', async (req, res) => {
  try {
    console.log('[API] Getting cash balance');
    
    const cashDoc = await Cash.findOne();
    const balance = cashDoc ? cashDoc.balance : 0;
    
    console.log(`[API] Cash balance: ${balance}`);
    
    res.json({ balance });
  } catch (err) {
    console.error('[API] Error getting cash balance:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update cash balance with add/withdraw operations
router.post('/cash', async (req, res) => {
  try {
    console.log('[API] Cash update request received:', req.body);
    
    const { amount, operation } = req.body;
    
    if (amount === undefined) {
      console.error('[API] Missing amount in request');
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    const parsedAmount = parseFloat(amount);
    
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      console.error('[API] Invalid amount:', amount);
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    
    console.log(`[API] Cash operation: ${operation}, Amount: ${parsedAmount}`);
    
    // Find current cash document
    let cashDoc = await Cash.findOne();
    let currentBalance = cashDoc ? cashDoc.balance : 0;
    let newBalance = currentBalance;
    
    console.log(`[API] Current balance before operation: ${currentBalance}`);
    
    // Calculate new balance based on operation
    if (operation === 'add') {
      newBalance = currentBalance + parsedAmount;
      console.log(`[API] Adding ${parsedAmount} to current balance ${currentBalance} = ${newBalance}`);
    } else if (operation === 'withdraw') {
      // Check if we have enough cash to withdraw
      if (parsedAmount > currentBalance) {
        console.error(`[API] Insufficient funds: ${currentBalance} < ${parsedAmount}`);
        return res.status(400).json({ 
          error: `Cannot withdraw $${parsedAmount}. Current balance is only $${currentBalance}` 
        });
      }
      newBalance = currentBalance - parsedAmount;
      console.log(`[API] Withdrawing ${parsedAmount} from current balance ${currentBalance} = ${newBalance}`);
    } else if (operation === 'set') {
      // Directly set the balance to the specified amount
      newBalance = parsedAmount;
      console.log(`[API] Setting balance to ${parsedAmount} from ${currentBalance}`);
    } else {
      console.error(`[API] Invalid operation: ${operation}`);
      return res.status(400).json({ error: 'Invalid operation. Use "add", "withdraw", or "set"' });
    }
    
    // Update or create the cash document
    if (cashDoc) {
      cashDoc.balance = newBalance;
      await cashDoc.save();
      console.log(`[API] Updated existing cash document to ${newBalance}`);
    } else {
      cashDoc = await Cash.create({ balance: newBalance });
      console.log(`[API] Created new cash document with balance ${newBalance}`);
    }
    
    console.log(`[API] Cash balance updated to ${cashDoc.balance}`);
    
    res.json({ 
      success: true,
      operation,
      amount: parsedAmount,
      previousBalance: currentBalance,
      newBalance: cashDoc.balance 
    });
    
  } catch (err) {
    console.error('[API] Error updating cash balance:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all trades
router.get('/trades', async (req, res) => {
  try {
    console.log('Fetching trades from database...');
    const startTime = Date.now();

    // Set a timeout for the database operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timed out')), 30000);
    });

    // Actual database query with basic projection to minimize data transfer
    const dbPromise = db.collection('trades')
      .find({}, { projection: { _id: 1, symbol: 1, shares: 1, price: 1, type: 1, date: 1 } })
      .toArray();

    // Race between timeout and database operation
    const trades = await Promise.race([dbPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    console.log(`Trades fetched successfully in ${duration}ms`);
    
    res.json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error.message);
    console.error('Error stack:', error.stack);
    
    // Send appropriate error response
    if (error.message === 'Database operation timed out') {
      res.status(504).json({ error: 'Database operation timed out. Please try again.' });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch trades',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Endpoint to add a new trade
router.post('/trades', async (req, res) => {
  try {
    console.log('[API] Adding new trade:', req.body);
    
    const { ticker, quantity, purchasePrice, purchaseDate } = req.body;
    
    // Validate required fields
    if (!ticker || !quantity || !purchasePrice || !purchaseDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate numeric fields
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    
    if (isNaN(purchasePrice) || purchasePrice <= 0) {
      return res.status(400).json({ error: 'Purchase price must be a positive number' });
    }
    
    // Calculate total cost
    const totalCost = quantity * purchasePrice;
    
    // Check if we have enough cash
    const cashBalance = await Cash.findOne();
    
    if (!cashBalance || cashBalance.balance < totalCost) {
      return res.status(400).json({ 
        error: 'Insufficient cash balance',
        required: totalCost,
        available: cashBalance ? cashBalance.balance : 0
      });
    }
    
    // Update cash balance
    cashBalance.balance -= totalCost;
    await cashBalance.save();
    
    console.log(`[API] Updated cash balance: ${cashBalance.balance}`);
    
    // Create new trade
    const trade = new Trade({
      ticker: ticker.toUpperCase(),
      quantity,
      purchasePrice,
      purchaseDate: new Date(purchaseDate),
      currentPrice: purchasePrice // Initialize current price to purchase price
    });
    
    await trade.save();
    
    console.log(`[API] Trade saved: ${trade._id}`);
    
    // Try to get current price from Finnhub
    try {
      const apiKey = process.env.FINNHUB_API_KEY;
      
      if (apiKey) {
        console.log(`[API] Fetching current price for ${ticker}...`);
        
        const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && typeof data.c === 'number') {
            trade.currentPrice = data.c;
            await trade.save();
            console.log(`[API] Updated current price for ${ticker}: ${data.c}`);
          }
        }
      }
    } catch (priceError) {
      console.error(`[API] Error fetching price for ${ticker}:`, priceError);
      // Continue even if price fetch fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Trade added successfully',
      trade
    });
    
  } catch (err) {
    console.error('[API] Error adding trade:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sell a trade (partial or full)
router.post('/trades/sell/:id', async (req, res) => {
  try {
    const { quantity, sellPrice } = req.body;
    const trade = await Trade.findById(req.params.id);
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    if (quantity > trade.quantity) {
      return res.status(400).json({ error: 'Cannot sell more than you own' });
    }
    
    // Add to cash
    const saleProceeds = quantity * sellPrice;
    let cash = await Cash.findOne();
    if (!cash) {
      cash = new Cash({ balance: 0 });
    }
    cash.balance += saleProceeds;
    cash.updatedAt = Date.now();
    await cash.save();
    
    // Update or delete trade
    if (quantity === trade.quantity) {
      await Trade.findByIdAndDelete(req.params.id);
      res.json({ message: 'Trade fully sold', proceeds: saleProceeds });
    } else {
      trade.quantity -= quantity;
      await trade.save();
      res.json({ message: 'Partial trade sold', proceeds: saleProceeds, remainingTrade: trade });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a trade (without selling)
router.delete('/trades/:id', async (req, res) => {
  try {
    await Trade.findByIdAndDelete(req.params.id);
    res.json({ message: 'Trade deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset all data
router.post('/reset', async (req, res) => {
  try {
    console.log('[API] Resetting all data...');
    
    // Delete all trades
    const tradesResult = await Trade.deleteMany({});
    console.log(`[API] Deleted ${tradesResult.deletedCount} trades`);
    
    // Reset cash balance to zero
    let cashDoc = await Cash.findOne();
    if (cashDoc) {
      cashDoc.balance = 0;
      await cashDoc.save();
      console.log('[API] Reset cash balance to zero');
    } else {
      cashDoc = await Cash.create({ balance: 0 });
      console.log('[API] Created new cash document with zero balance');
    }
    
    res.json({ 
      success: true,
      message: 'All data reset successfully',
      tradesDeleted: tradesResult.deletedCount
    });
    
  } catch (err) {
    console.error('[API] Error resetting data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current price for a ticker using Finnhub
router.get('/current-price/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker;
    console.log(`[API] Fetching current price for ${ticker} from Finnhub`);
    
    // Get current price from Finnhub
    const response = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`
    );
    
    // Check if we got valid data
    if (response.data && response.data.c) {
      const price = response.data.c;
      console.log(`[API] Current price for ${ticker}: ${price}`);
      return res.json({ ticker, price });
    }
    
    // If we couldn't get the current price, try to get the previous close
    if (response.data && response.data.pc) {
      const price = response.data.pc;
      console.log(`[API] Using previous close price for ${ticker}: ${price}`);
      return res.json({ ticker, price });
    }
    
    // If all attempts fail
    console.log(`[API] Could not fetch price for ${ticker} from Finnhub`);
    res.status(404).json({ error: `Could not fetch price for ${ticker}` });
    
  } catch (err) {
    console.error('[API] Error fetching current price:', err);
    res.status(500).json({ error: err.message });
  }
});

// Validate ticker symbol using Finnhub
router.get('/validate-ticker/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    console.log(`[API] Validating ticker: ${ticker}`);
    
    // Add common ETFs to our list of valid tickers for quick validation
    const commonTickers = [
      // Common stocks
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM', 
      'V', 'JNJ', 'WMT', 'PG', 'MA', 'UNH', 'HD', 'BAC', 'XOM', 'DIS',
      'NFLX', 'ADBE', 'PYPL', 'INTC', 'CMCSA', 'PEP', 'CSCO', 'VZ',
      // Common ETFs
      'SPY', 'QQQ', 'IWM', 'VTI', 'VOO', 'VEA', 'VWO', 'BND',
      'VTV', 'VUG', 'IJH', 'IJR', 'EFA', 'AGG', 'GLD', 'VIG'
    ];
    
    // First check if it's in our common list for quick validation
    if (commonTickers.includes(ticker)) {
      console.log(`[API] ${ticker} found in common tickers list`);
      return res.json({ valid: true });
    }
    
    // If not in common list, try to fetch data from Finnhub
    try {
      console.log(`[API] Checking ${ticker} with Finnhub API`);
      
      // Use quote endpoint to validate
      const response = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`
      );
      
      // Check if we got valid price data
      const isValid = response.data && 
                     (response.data.c > 0 || response.data.pc > 0);
      
      console.log(`[API] Finnhub validation result for ${ticker}: ${isValid}`);
      
      res.json({ valid: isValid });
    } catch (error) {
      console.error('[API] Error validating ticker with Finnhub:', error);
      
      // If API validation fails, fall back to pattern matching
      const validTickerPattern = /^[A-Z]{1,5}$|^[A-Z]{2,4}\.[A-Z]{1,2}$/;
      const isValid = validTickerPattern.test(ticker);
      
      console.log(`[API] Fallback pattern validation for ${ticker}: ${isValid}`);
      res.json({ valid: isValid });
    }
  } catch (err) {
    console.error('[API] Error in validate-ticker route:', err);
    res.status(500).json({ error: err.message });
  }
});

// Test route to verify Finnhub API key
router.get('/test-api-key', async (req, res) => {
  try {
    console.log(`[TEST] Testing Finnhub API key`);
    
    // Make a simple request to Finnhub
    const response = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${FINNHUB_API_KEY}`
    );
    
    console.log('[TEST] Finnhub response:', response.data);
    
    // Check if we got valid data
    if (response.data && response.data.c) {
      console.log('[TEST] Finnhub API key is working correctly');
      
      return res.send(`
        <html>
          <head>
            <title>API Key Test - Success</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .success { color: green; font-weight: bold; }
              pre { background: #f8f9fa; padding: 10px; border-radius: 5px; overflow: auto; }
            </style>
          </head>
          <body>
            <h1>Finnhub API Key Test</h1>
            <div class="success">
              <h3>Success! Your Finnhub API key is working correctly.</h3>
            </div>
            <h3>Sample Data Received (AAPL):</h3>
            <pre>${JSON.stringify(response.data, null, 2)}</pre>
            <p>c: Current price</p>
            <p>h: High price of the day</p>
            <p>l: Low price of the day</p>
            <p>o: Open price of the day</p>
            <p>pc: Previous close price</p>
          </body>
        </html>
      `);
    }
    
    // If we got here, something unexpected happened
    console.log('[TEST] Unexpected response from Finnhub:', response.data);
    
    return res.send(`
      <html>
        <head>
          <title>API Key Test - Unexpected Response</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .warning { color: orange; font-weight: bold; }
            pre { background: #f8f9fa; padding: 10px; border-radius: 5px; overflow: auto; }
          </style>
        </head>
        <body>
          <h1>Finnhub API Key Test</h1>
          <div class="warning">
            <h3>Unexpected response from Finnhub</h3>
          </div>
          <h3>Raw Response:</h3>
          <pre>${JSON.stringify(response.data, null, 2)}</pre>
        </body>
      </html>
    `);
    
  } catch (err) {
    console.error('[TEST] Error testing API key:', err);
    
    return res.send(`
      <html>
        <head>
          <title>API Key Test - Error</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .error { color: red; font-weight: bold; }
            pre { background: #f8f9fa; padding: 10px; border-radius: 5px; overflow: auto; }
          </style>
        </head>
        <body>
          <h1>Finnhub API Key Test</h1>
          <div class="error">
            <h3>Error testing API key:</h3>
            <p>${err.message}</p>
          </div>
          <h3>Possible issues:</h3>
          <ul>
            <li>Network connectivity problems</li>
            <li>Finnhub service is down</li>
            <li>API key is invalid</li>
          </ul>
          <p>Check your server console for more details.</p>
        </body>
      </html>
    `);
  }
});

// Test route to directly fetch QQQ price
router.get('/test-qqq-price', async (req, res) => {
  try {
    console.log('[TEST] Fetching QQQ price directly from Finnhub...');
    
    const ticker = 'QQQ';
    
    // Get current price from Finnhub
    const response = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`
    );
    
    console.log('[TEST] Finnhub response:', response.data);
    
    // Check if we got valid data
    if (response.data && response.data.c) {
      const currentPrice = response.data.c;
      const previousClose = response.data.pc;
      
      console.log(`[TEST] QQQ current price: ${currentPrice}, previous close: ${previousClose}`);
      
      return res.send(`
        <html>
          <head>
            <title>QQQ Price Test</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .price { font-size: 24px; font-weight: bold; color: #007bff; }
              .details { margin-top: 20px; }
              pre { background: #f8f9fa; padding: 10px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <h1>QQQ - Price Test (Finnhub)</h1>
            <div class="price">QQQ - Current Price: $${currentPrice.toFixed(2)}</div>
            <div class="price">QQQ - Previous Close: $${previousClose.toFixed(2)}</div>
            <div class="details">
              <h3>API Response Details:</h3>
              <pre>${JSON.stringify(response.data, null, 2)}</pre>
            </div>
          </body>
        </html>
      `);
    }
    
    // If we got here, something unexpected happened
    console.log('[TEST] Could not fetch QQQ price from Finnhub');
    
    return res.status(404).send(`
      <html>
        <head>
          <title>QQQ Price Test - Failed</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .error { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>QQQ - Price Test (Finnhub)</h1>
          <div class="error">Could not fetch price for QQQ from Finnhub</div>
          <p>Please check your API key and try again.</p>
        </body>
      </html>
    `);
    
  } catch (err) {
    console.error('[TEST] Error fetching QQQ price:', err);
    
    return res.status(500).send(`
      <html>
        <head>
          <title>QQQ Price Test - Error</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .error { color: red; font-weight: bold; }
            pre { background: #f8f9fa; padding: 10px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>QQQ - Price Test (Finnhub)</h1>
          <div class="error">Error fetching QQQ price</div>
          <pre>${err.message}</pre>
          <p>Please check your API key and try again.</p>
        </body>
      </html>
    `);
  }
});

// Get portfolio summary
router.get('/portfolio', async (req, res) => {
  try {
    console.log('[API] Loading portfolio data...');
    
    // Get all trades
    const trades = await Trade.find({ sold: false });
    console.log(`[API] Found ${trades.length} active trades`);
    
    // Get cash balance
    const cashBalance = await getCashBalance();
    console.log(`[API] Cash balance: ${cashBalance}`);
    
    // Calculate portfolio holdings
    const holdingsMap = {};
    
    trades.forEach(trade => {
      const ticker = trade.ticker;
      
      if (!holdingsMap[ticker]) {
        holdingsMap[ticker] = {
          ticker,
          totalQuantity: 0,
          totalCost: 0,
          currentPrice: trade.currentPrice || 0,
          value: 0,
          profit: 0,
          averagePrice: 0
        };
      }
      
      holdingsMap[ticker].totalQuantity += trade.quantity;
      holdingsMap[ticker].totalCost += trade.purchasePrice * trade.quantity;
    });
    
    // Calculate derived values for each holding
    const holdings = Object.values(holdingsMap).map(holding => {
      // Calculate average purchase price
      holding.averagePrice = holding.totalQuantity > 0 ? 
        holding.totalCost / holding.totalQuantity : 0;
      
      // Calculate current value
      holding.value = holding.currentPrice * holding.totalQuantity;
      
      // Calculate profit/loss
      holding.profit = holding.value - holding.totalCost;
      
      console.log(`[API] Holding: ${holding.ticker}, Quantity: ${holding.totalQuantity}, Avg Price: ${holding.averagePrice}, Current Price: ${holding.currentPrice}, Value: ${holding.value}, Profit: ${holding.profit}`);
      
      return holding;
    });
    
    // Calculate portfolio totals
    const investedValue = holdings.reduce((sum, holding) => sum + holding.totalCost, 0);
    const currentValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const totalValue = currentValue + cashBalance;
    
    console.log(`[API] Portfolio summary - Invested: ${investedValue}, Current: ${currentValue}, Cash: ${cashBalance}, Total: ${totalValue}`);
    
    res.json({
      cashBalance,
      investedValue,
      currentValue,
      totalValue,
      holdings
    });
  } catch (err) {
    console.error('[API] Error loading portfolio:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to get cash balance
async function getCashBalance() {
  try {
    const cashDoc = await Cash.findOne();
    return cashDoc ? cashDoc.balance : 0;
  } catch (error) {
    console.error('[API] Error getting cash balance:', error);
    return 0;
  }
}

// Update price for a ticker
router.post('/price/update', async (req, res) => {
  try {
    const { ticker, price } = req.body;
    
    if (!ticker || !price) {
      return res.status(400).json({ error: 'Ticker and price are required' });
    }
    
    console.log(`[API] Updating price for ${ticker} to ${price}`);
    
    // Update all trades with this ticker
    const result = await Trade.updateMany(
      { ticker, sold: false },
      { $set: { currentPrice: price } }
    );
    
    console.log(`[API] Updated ${result.modifiedCount} trades for ${ticker}`);
    
    res.json({ 
      success: true, 
      ticker, 
      price, 
      updatedCount: result.modifiedCount 
    });
    
  } catch (err) {
    console.error('[API] Error updating price:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug route to check cash balance
router.get('/debug/cash', async (req, res) => {
  try {
    const cashDoc = await Cash.findOne();
    const balance = cashDoc ? cashDoc.balance : 0;
    
    // Get the raw document
    const rawDoc = cashDoc ? cashDoc.toObject() : null;
    
    res.send(`
      <html>
        <head>
          <title>Cash Balance Debug</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            pre { background: #f8f9fa; padding: 10px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Cash Balance Debug</h1>
          <p>Current balance: <strong>$${balance}</strong></p>
          <h3>Raw document:</h3>
          <pre>${JSON.stringify(rawDoc, null, 2)}</pre>
          
          <h3>Test Operations:</h3>
          <form action="/api/cash" method="post">
            <input type="hidden" name="operation" value="set">
            <input type="hidden" name="amount" value="1000">
            <button type="submit">Set balance to $1000</button>
          </form>
          <br>
          <form action="/api/cash" method="post">
            <input type="hidden" name="operation" value="add">
            <input type="hidden" name="amount" value="500">
            <button type="submit">Add $500</button>
          </form>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Test route for cash operations
router.get('/test-cash/:operation/:amount', async (req, res) => {
  try {
    const { operation, amount } = req.params;
    const parsedAmount = parseFloat(amount);
    
    if (isNaN(parsedAmount)) {
      return res.status(400).send('Invalid amount');
    }
    
    console.log(`[API TEST] Cash operation: ${operation}, Amount: ${parsedAmount}`);
    
    // Find current cash document
    let cashDoc = await Cash.findOne();
    let currentBalance = cashDoc ? cashDoc.balance : 0;
    let newBalance = currentBalance;
    
    // Calculate new balance based on operation
    if (operation === 'add') {
      newBalance = currentBalance + parsedAmount;
    } else if (operation === 'withdraw') {
      if (parsedAmount > currentBalance) {
        return res.status(400).send(`Cannot withdraw $${parsedAmount}. Current balance is only $${currentBalance}`);
      }
      newBalance = currentBalance - parsedAmount;
    } else if (operation === 'set') {
      newBalance = parsedAmount;
    } else {
      return res.status(400).send('Invalid operation. Use "add", "withdraw", or "set"');
    }
    
    // Update or create the cash document
    if (cashDoc) {
      cashDoc.balance = newBalance;
      await cashDoc.save();
    } else {
      cashDoc = await Cash.create({ balance: newBalance });
    }
    
    res.send(`
      <html>
        <head>
          <title>Cash Operation Test</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .success { color: green; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Cash Operation Test</h1>
          <div class="success">
            <p>Operation: ${operation}</p>
            <p>Amount: $${parsedAmount}</p>
            <p>Previous Balance: $${currentBalance}</p>
            <p>New Balance: $${newBalance}</p>
          </div>
          <p><a href="/api/debug/cash">Back to Cash Debug</a></p>
          <p><a href="/">Back to Main Page</a></p>
        </body>
      </html>
    `);
    
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Simplified market status endpoint for US market only
router.get('/market-status', async (req, res) => {
  try {
    console.log('[API] Checking US market status...');
    
    // Get current time
    const now = new Date();
    
    // Create mock market data with realistic times
    // Market opens at 9:30 AM ET and closes at 4:00 PM ET
    const currentDate = new Date();
    
    // Create opening time (9:30 AM ET today)
    const openDate = new Date(currentDate);
    openDate.setHours(9, 30, 0, 0); // 9:30 AM
    
    // Create closing time (4:00 PM ET today)
    const closeDate = new Date(currentDate);
    closeDate.setHours(16, 0, 0, 0); // 4:00 PM
    
    const usMarketStatus = {
      "exchange": "US",
      "isOpen": true,
      "holiday": null,
      "currentTime": Math.floor(now.getTime() / 1000),
      "openAt": Math.floor(openDate.getTime() / 1000),
      "closeAt": Math.floor(closeDate.getTime() / 1000)
    };
    
    // Format timestamps for display
    const openTime = openDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    const closeTime = closeDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Current time in ET
    const currentTimeET = now.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    const currentDateET = now.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Create response with fixed isOpen value
    const response = {
      isOpen: true, // Explicitly set to true
      exchange: "US",
      holiday: null,
      currentTimeET,
      currentDateET,
      openTimeET: openTime,
      closeTimeET: closeTime
    };
    
    console.log('[API] US market status response:', response);
    
    res.json(response);
    
  } catch (err) {
    console.error('[API] Error checking market status:', err);
    
    // Even on error, return a valid response with isOpen=true
    res.json({
      isOpen: true,
      exchange: "US",
      holiday: null,
      currentTimeET: new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      currentDateET: new Date().toLocaleDateString('en-US', { 
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      openTimeET: "09:30 AM",
      closeTimeET: "04:00 PM",
      error: err.message
    });
  }
});

// Endpoint to refresh stock prices
router.post('/refresh-prices', async (req, res) => {
  try {
    console.log('[API] Refreshing stock prices');
    
    // Get all unique tickers
    const trades = await Trade.find();
    const tickers = [...new Set(trades.map(trade => trade.ticker))];
    
    console.log(`[API] Found ${tickers.length} unique tickers to refresh`);
    
    const results = {
      success: [],
      failed: []
    };
    
    // Update prices for each ticker
    for (const ticker of tickers) {
      try {
        console.log(`[API] Fetching price for ${ticker}`);
        
        // Fetch current price from Finnhub
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch price for ${ticker}`);
        }
        
        const data = await response.json();
        
        if (data && typeof data.c === 'number') {
          const currentPrice = data.c;
          
          // Update all trades with this ticker
          await Trade.updateMany(
            { ticker },
            { currentPrice }
          );
          
          console.log(`[API] Updated price for ${ticker}: ${currentPrice}`);
          results.success.push({ ticker, price: currentPrice });
        } else {
          throw new Error(`Invalid price data for ${ticker}`);
        }
      } catch (error) {
        console.error(`[API] Error updating price for ${ticker}:`, error);
        results.failed.push({ ticker, error: error.message });
      }
    }
    
    console.log(`[API] Price refresh complete. Success: ${results.success.length}, Failed: ${results.failed.length}`);
    
    res.json({
      success: true,
      message: `Refreshed prices for ${results.success.length} tickers`,
      results
    });
  } catch (err) {
    console.error('[API] Error refreshing prices:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mock endpoint for testing price updates
router.post('/mock-refresh-prices', async (req, res) => {
  try {
    const { tickers } = req.body;
    
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No tickers provided' 
      });
    }
    
    console.log(`[API] Mock refreshing prices for ${tickers.length} stocks: ${tickers.join(', ')}`);
    
    // Create an object to store the results
    const results = {};
    
    // Process each ticker with mock data
    for (const ticker of tickers) {
      try {
        console.log(`[API] Generating mock price for ${ticker}...`);
        
        // Get the current trade data
        const trade = await Trade.findOne({ ticker: ticker });
        
        if (!trade) {
          results[ticker] = { 
            success: false, 
            error: 'Trade not found' 
          };
          continue;
        }
        
        // Generate a random price change (-5% to +5%)
        const changePercent = (Math.random() * 10 - 5) / 100;
        const basePrice = trade.currentPrice || trade.purchasePrice;
        const newPrice = basePrice * (1 + changePercent);
        
        // Round to 2 decimal places
        const roundedPrice = Math.round(newPrice * 100) / 100;
        
        // Update the trade in the database with the mock price
        const updateResult = await Trade.updateMany(
          { ticker: ticker },
          { $set: { currentPrice: roundedPrice } }
        );
        
        console.log(`[API] Updated ${updateResult.modifiedCount} trades for ${ticker} with mock price $${roundedPrice}`);
        
        results[ticker] = {
          success: true,
          price: roundedPrice,
          previousClose: basePrice,
          change: roundedPrice - basePrice,
          percentChange: changePercent * 100,
          isMock: true
        };
      } catch (tickerError) {
        console.error(`[API] Error processing ${ticker}:`, tickerError);
        results[ticker] = { 
          success: false, 
          error: tickerError.message 
        };
      }
    }
    
    res.json({
      success: true,
      message: `Updated mock prices for ${tickers.length} stocks`,
      results: results,
      isMock: true
    });
    
  } catch (err) {
    console.error('[API] Error generating mock prices:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Endpoint to sell shares
router.post('/sell', async (req, res) => {
  try {
    const { ticker, quantity, sellPrice } = req.body;
    
    console.log(`[API] Selling ${quantity} shares of ${ticker} at ${sellPrice}`);
    
    if (!ticker || !quantity || !sellPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate inputs
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero' });
    }
    
    if (sellPrice <= 0) {
      return res.status(400).json({ error: 'Sell price must be greater than zero' });
    }
    
    // Get all trades for this ticker
    const trades = await Trade.find({ ticker }).sort({ purchaseDate: 1 });
    
    if (!trades || trades.length === 0) {
      return res.status(404).json({ error: `No trades found for ${ticker}` });
    }
    
    // Calculate total shares owned
    const totalShares = trades.reduce((sum, trade) => sum + trade.quantity, 0);
    
    if (quantity > totalShares) {
      return res.status(400).json({ error: `You only own ${totalShares} shares of ${ticker}` });
    }
    
    // Calculate total proceeds from the sale
    const proceeds = quantity * sellPrice;
    
    console.log(`[API] Sale proceeds: ${proceeds}`);
    
    // Update cash balance
    const cashBalance = await Cash.findOne();
    
    if (!cashBalance) {
      // Create a new cash balance record if it doesn't exist
      await Cash.create({ balance: proceeds });
    } else {
      // Update existing cash balance
      cashBalance.balance += proceeds;
      await cashBalance.save();
    }
    
    console.log(`[API] Updated cash balance: ${cashBalance ? cashBalance.balance : proceeds}`);
    
    // Determine which trades to update (FIFO method)
    let remainingToSell = quantity;
    const updatedTrades = [];
    
    for (const trade of trades) {
      if (remainingToSell <= 0) break;
      
      if (trade.quantity <= remainingToSell) {
        // Sell all shares from this trade
        updatedTrades.push({
          id: trade._id,
          ticker: trade.ticker,
          quantitySold: trade.quantity,
          remainingQuantity: 0
        });
        
        remainingToSell -= trade.quantity;
        
        // Delete this trade since all shares are sold
        await Trade.findByIdAndDelete(trade._id);
        console.log(`[API] Deleted trade ${trade._id} (all shares sold)`);
      } else {
        // Sell partial shares from this trade
        updatedTrades.push({
          id: trade._id,
          ticker: trade.ticker,
          quantitySold: remainingToSell,
          remainingQuantity: trade.quantity - remainingToSell
        });
        
        // Update this trade with remaining shares
        trade.quantity -= remainingToSell;
        await trade.save();
        console.log(`[API] Updated trade ${trade._id} with remaining ${trade.quantity} shares`);
        
        remainingToSell = 0;
      }
    }
    
    // Create a record of the sale
    const sale = {
      ticker,
      quantity,
      sellPrice,
      proceeds,
      date: new Date(),
      trades: updatedTrades
    };
    
    console.log(`[API] Sale completed: ${JSON.stringify(sale)}`);
    
    res.json({
      success: true,
      message: `Successfully sold ${quantity} shares of ${ticker} for ${proceeds}`,
      sale
    });
    
  } catch (err) {
    console.error('[API] Error selling shares:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 
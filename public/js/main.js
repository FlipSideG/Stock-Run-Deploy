document.addEventListener('DOMContentLoaded', function() {
  // Initialize
  loadCashBalance();
  loadTrades();
  setupNumberFormatting();
  
  // Event listeners
  document.getElementById('add-cash').addEventListener('click', () => updateCash(true));
  document.getElementById('withdraw-cash').addEventListener('click', () => updateCash(false));
  document.getElementById('trade-form').addEventListener('submit', addTrade);
  document.getElementById('confirm-sell').addEventListener('click', sellTrade);
  
  // Set up Bootstrap modal
  const sellModal = new bootstrap.Modal(document.getElementById('sellModal'));
  window.sellModal = sellModal;
  
  // Add event listener for reset button
  document.getElementById('reset-button').addEventListener('click', resetAllData);
  
  // Add refresh prices button event listener
  const refreshPricesButton = document.getElementById('refresh-prices');
  if (refreshPricesButton) {
    refreshPricesButton.addEventListener('click', refreshPrices);
  }
});

// Utility function to format currency values
function formatCurrency(value) {
  // Handle null, undefined, or NaN values
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }
  
  // Format the number as currency
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Utility function to format numbers with commas
function formatNumber(value, decimals = 0) {
  // Handle null, undefined, or NaN values
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  // Format the number with commas
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

// Function to set up number formatting for input fields
function setupNumberFormatting(elementId, allowDecimals = false, decimalPlaces = 2) {
  const element = document.getElementById(elementId);
  
  if (!element) {
    console.warn(`[Frontend] Element with ID '${elementId}' not found for number formatting`);
    return;
  }
  
  // Format on blur
  element.addEventListener('blur', function() {
    const value = this.value.replace(/,/g, '');
    
    if (value && !isNaN(value)) {
      const numValue = parseFloat(value);
      this.value = formatNumber(numValue, allowDecimals ? decimalPlaces : 0);
    }
  });
  
  // Allow only numbers and decimal point on input
  element.addEventListener('input', function(e) {
    const regex = allowDecimals ? /[^0-9.]/g : /[^0-9]/g;
    this.value = this.value.replace(regex, '');
    
    // Ensure only one decimal point
    if (allowDecimals) {
      const parts = this.value.split('.');
      if (parts.length > 2) {
        this.value = parts[0] + '.' + parts.slice(1).join('');
      }
    }
  });
}

// Function to load trades and display them in the table
async function loadTrades() {
  try {
    console.log('[Frontend] Loading trades...');
    
    const response = await fetch('/api/trades');
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load trades: ${errorText}`);
    }
    
    const trades = await response.json();
    
    console.log(`[Frontend] Loaded ${trades.length} trades:`, trades);
    
    // Update both the trades table and portfolio table
    updateTradesTable(trades);
    updatePortfolioTable(trades);
    
    console.log('[Frontend] Trades loaded successfully');
  } catch (error) {
    console.error('[Frontend] Error loading trades:', error);
    alert(`Error loading trades: ${error.message}`);
  }
}

// Function to update the trades table
function updateTradesTable(trades) {
  try {
    console.log('[Frontend] Updating trades table...');
    
    const tradesTable = document.getElementById('trades-table');
    if (!tradesTable) {
      console.error('[Frontend] Trades table not found');
      return;
    }
    
    const tableBody = tradesTable.querySelector('tbody');
    if (!tableBody) {
      console.error('[Frontend] Trades table body not found');
      return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (!Array.isArray(trades) || trades.length === 0) {
      console.log('[Frontend] No trades found');
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No trades found</td></tr>';
      return;
    }
    
    // Process each trade and add to table
    trades.forEach(trade => {
      const ticker = trade.ticker;
      const quantity = parseFloat(trade.quantity) || 0;
      const purchasePrice = parseFloat(trade.purchasePrice) || 0;
      const currentPrice = parseFloat(trade.currentPrice) || purchasePrice;
      
      // Calculate values
      const totalValue = quantity * currentPrice;
      const gainLoss = totalValue - (quantity * purchasePrice);
      const gainLossPercent = (gainLoss / (quantity * purchasePrice)) * 100;
      
      // Create a row for this trade
      const row = document.createElement('tr');
      
      // Format the values
      const formattedPurchasePrice = formatCurrency(purchasePrice);
      const formattedCurrentPrice = formatCurrency(currentPrice);
      const formattedValue = formatCurrency(totalValue);
      const formattedGainLoss = formatCurrency(gainLoss);
      const formattedGainLossPercent = gainLossPercent.toFixed(2) + '%';
      
      // Set the row content
      row.innerHTML = `
        <td>${ticker}</td>
        <td>${quantity.toFixed(2)}</td>
        <td>${formattedPurchasePrice}</td>
        <td>${formattedCurrentPrice}</td>
        <td>${formattedValue}</td>
        <td class="${gainLoss >= 0 ? 'text-success' : 'text-danger'}">
          ${formattedGainLoss} (${formattedGainLossPercent})
        </td>
        <td>
          <button class="btn btn-danger btn-sm sell-button" 
                  data-ticker="${ticker}" 
                  data-quantity="${quantity}" 
                  data-price="${currentPrice}">
            Sell
          </button>
        </td>
      `;
      
      tableBody.appendChild(row);
    });
    
    // Add event listeners to sell buttons
    const sellButtons = document.querySelectorAll('.sell-button');
    sellButtons.forEach(button => {
      button.addEventListener('click', openSellModal);
    });
    
    console.log('[Frontend] Trades table updated');
  } catch (error) {
    console.error('[Frontend] Error updating trades table:', error);
  }
}

// Function to update the portfolio table
function updatePortfolioTable(trades) {
  try {
    console.log('[Frontend] Updating portfolio table...');
    
    const portfolioTable = document.getElementById('portfolio-table');
    if (!portfolioTable) {
      console.error('[Frontend] Portfolio table not found');
      return;
    }
    
    const tableBody = portfolioTable.querySelector('tbody');
    if (!tableBody) {
      console.error('[Frontend] Portfolio table body not found');
      return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (!Array.isArray(trades) || trades.length === 0) {
      console.log('[Frontend] No trades found for portfolio');
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No positions</td></tr>';
      
      // Update portfolio summary with zeros
      updatePortfolioSummary(0, 0, 0);
      return;
    }
    
    // Variables for portfolio summary
    let totalInvested = 0;
    let totalValue = 0;
    let totalGainLoss = 0;
    
    // Group trades by ticker
    const tradesByTicker = {};
    
    // Process each trade and group by ticker
    trades.forEach(trade => {
      const ticker = trade.ticker;
      const quantity = parseFloat(trade.quantity) || 0;
      const purchasePrice = parseFloat(trade.purchasePrice) || 0;
      const currentPrice = parseFloat(trade.currentPrice) || purchasePrice;
      
      if (!tradesByTicker[ticker]) {
        tradesByTicker[ticker] = {
          ticker: ticker,
          totalQuantity: 0,
          totalCost: 0,
          currentPrice: currentPrice
        };
      }
      
      // Add this trade to the ticker group
      tradesByTicker[ticker].totalQuantity += quantity;
      tradesByTicker[ticker].totalCost += quantity * purchasePrice;
      
      // Use the most recent current price
      if (currentPrice) {
        tradesByTicker[ticker].currentPrice = currentPrice;
      }
    });
    
    console.log('[Frontend] Grouped trades by ticker for portfolio:', tradesByTicker);
    
    // Process each ticker group and create table rows
    for (const ticker in tradesByTicker) {
      const tickerData = tradesByTicker[ticker];
      
      // Skip if quantity is zero (all shares sold)
      if (tickerData.totalQuantity <= 0) {
        console.log(`[Frontend] Skipping ${ticker} in portfolio - no shares owned`);
        continue;
      }
      
      // Calculate weighted average purchase price
      const weightedAvgPrice = tickerData.totalCost / tickerData.totalQuantity;
      
      // Calculate current value and gain/loss
      const currentValue = tickerData.totalQuantity * tickerData.currentPrice;
      const gainLoss = currentValue - tickerData.totalCost;
      const gainLossPercent = (gainLoss / tickerData.totalCost) * 100;
      
      // Add to portfolio totals
      totalInvested += tickerData.totalCost;
      totalValue += currentValue;
      totalGainLoss += gainLoss;
      
      // Create a row for this ticker
      const row = document.createElement('tr');
      
      // Format the values
      const formattedAvgPrice = formatCurrency(weightedAvgPrice);
      const formattedCurrentPrice = formatCurrency(tickerData.currentPrice);
      const formattedValue = formatCurrency(currentValue);
      const formattedGainLoss = formatCurrency(gainLoss);
      const formattedGainLossPercent = gainLossPercent.toFixed(2) + '%';
      
      // Set the row content
      row.innerHTML = `
        <td>${ticker}</td>
        <td>${tickerData.totalQuantity.toFixed(2)}</td>
        <td>${formattedAvgPrice}</td>
        <td>${formattedCurrentPrice}</td>
        <td>${formattedValue}</td>
        <td class="${gainLoss >= 0 ? 'text-success' : 'text-danger'}">
          ${formattedGainLoss} (${formattedGainLossPercent})
        </td>
      `;
      
      tableBody.appendChild(row);
    }
    
    // If no rows were added (all trades have zero quantity), show a message
    if (tableBody.children.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No active positions</td></tr>';
    }
    
    console.log(`[Frontend] Portfolio summary: Invested=${totalInvested}, Value=${totalValue}, Gain/Loss=${totalGainLoss}`);
    
    // Update portfolio summary
    updatePortfolioSummary(totalInvested, totalValue, totalGainLoss);
    
    console.log('[Frontend] Portfolio table updated');
  } catch (error) {
    console.error('[Frontend] Error updating portfolio table:', error);
  }
}

// Function to load cash balance
async function loadCashBalance() {
  try {
    console.log('[Frontend] Loading cash balance...');
    
    const response = await fetch('/api/cash');
    
    if (!response.ok) {
      throw new Error('Failed to load cash balance');
    }
    
    const data = await response.json();
    
    console.log('[Frontend] Cash balance loaded:', data);
    
    const cashBalanceElement = document.getElementById('cash-balance');
    if (cashBalanceElement) {
      cashBalanceElement.textContent = formatCurrency(data.balance);
    }
    
    console.log('[Frontend] Cash balance updated');
    return data.balance;
  } catch (error) {
    console.error('[Frontend] Error loading cash balance:', error);
    
    // Set cash balance to 0 if there's an error
    const cashBalanceElement = document.getElementById('cash-balance');
    if (cashBalanceElement) {
      cashBalanceElement.textContent = formatCurrency(0);
    }
    return 0;
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Frontend] DOM loaded, initializing app...');
  
  // Check market status first
  checkMarketStatus();
  
  // Load initial data
  await loadCashBalance();
  await loadTrades();
  
  // Set up number formatting for all numeric inputs
  setupNumberFormatting('cash-amount', true, 2);       // Cash amount (dollars and cents)
  setupNumberFormatting('quantity', true, 2);          // Quantity (can have fractional shares)
  setupNumberFormatting('purchase-price', true, 2);    // Purchase price (dollars and cents)
  
  // Set up event listeners for the trade form
  const tradeForm = document.getElementById('trade-form');
  if (tradeForm) {
    console.log('[Frontend] Setting up trade form submit listener');
    tradeForm.addEventListener('submit', addTrade);
  } else {
    console.warn('[Frontend] Trade form not found');
  }
  
  // Set up event listeners for cash buttons
  const addCashButton = document.getElementById('add-cash');
  const withdrawCashButton = document.getElementById('withdraw-cash');
  
  if (addCashButton) {
    console.log('[Frontend] Setting up add cash button listener');
    addCashButton.addEventListener('click', function(event) {
      event.preventDefault();
      handleCashOperation('add');
    });
  }
  
  if (withdrawCashButton) {
    console.log('[Frontend] Setting up withdraw cash button listener');
    withdrawCashButton.addEventListener('click', function(event) {
      event.preventDefault();
      handleCashOperation('withdraw');
    });
  }
  
  // Set up refresh prices button
  const refreshPricesButton = document.getElementById('refresh-prices');
  if (refreshPricesButton) {
    refreshPricesButton.addEventListener('click', function() {
      refreshPrices(true);
    });
  }
  
  // Set up mock toggle button
  const mockToggleButton = document.getElementById('mock-toggle');
  if (mockToggleButton) {
    mockToggleButton.addEventListener('click', toggleMockPrices);
  }
  
  // Set up auto-refresh toggle
  const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
  if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', toggleAutoRefresh);
    
    // Start auto-refresh if toggle is checked by default
    if (autoRefreshToggle.checked) {
      startAutoRefresh();
    }
  }
  
  // Set up reset button
  const resetButton = document.getElementById('reset-data');
  if (resetButton) {
    resetButton.addEventListener('click', resetAllData);
  }
  
  // Set default date for purchase date input
  const purchaseDateInput = document.getElementById('purchase-date');
  if (purchaseDateInput) {
    const today = new Date().toISOString().split('T')[0];
    purchaseDateInput.value = today;
  } else {
    console.warn('[Frontend] Purchase date input not found');
  }
  
  // Update last refreshed time initially
  updateLastRefreshedTime();
  
  console.log('[Frontend] App initialization complete');
});

// Function to handle cash operations (add/withdraw)
async function handleCashOperation(operation) {
  try {
    console.log(`[Frontend] Handling ${operation} cash operation`);
    
    const amountInput = document.getElementById('cash-amount');
    
    if (!amountInput) {
      console.error('[Frontend] Cash amount input not found');
      alert('Error: Cash amount input not found');
      return;
    }
    
    const amountStr = amountInput.value.trim().replace(/,/g, '');
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    console.log(`[Frontend] ${operation} cash: ${amount}`);
    
    // Send request to update cash balance
    const response = await fetch('/api/cash', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operation,
        amount
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to ${operation} cash`);
    }
    
    const result = await response.json();
    
    console.log(`[Frontend] Cash ${operation} successful:`, result);
    
    // Reset amount input
    amountInput.value = '';
    
    // Refresh cash balance
    await loadCashBalance();
    
    // Show success message
    alert(`Successfully ${operation === 'add' ? 'added' : 'withdrawn'} $${amount.toFixed(2)}`);
    
  } catch (error) {
    console.error(`[Frontend] Error ${operation}ing cash:`, error);
    alert(`Error: ${error.message}`);
  }
}

// Load portfolio with current prices
async function loadPortfolio() {
  try {
    console.log('[Frontend] Loading portfolio...');
    
    // First ensure we have the latest cash balance
    const cashResponse = await fetch('/api/cash');
    if (!cashResponse.ok) {
      throw new Error(`Failed to load cash balance: ${await cashResponse.text()}`);
    }
    const cashData = await cashResponse.json();
    const cashBalance = cashData.balance;
    console.log(`[Frontend] Cash balance from API: ${cashBalance}`);
    
    // Now get portfolio data
    const response = await fetch('/api/portfolio');
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load portfolio: ${errorText}`);
    }
    
    const portfolio = await response.json();
    
    // IMPORTANT: Override the portfolio cash balance with our directly fetched value
    portfolio.cashBalance = cashBalance;
    
    console.log('[Frontend] Portfolio data:', portfolio);
    console.log('[Frontend] Using cash balance:', cashBalance);
    
    // Update portfolio summary - check if elements exist first
    const totalValueEl = document.getElementById('total-value');
    const cashBalanceEl = document.getElementById('cash-balance');
    const investedValueEl = document.getElementById('invested-value');
    const profitLossEl = document.getElementById('profit-loss');
    
    // Log which elements were found or not found
    console.log('[Frontend] DOM elements found:', {
      totalValueEl: !!totalValueEl,
      cashBalanceEl: !!cashBalanceEl,
      investedValueEl: !!investedValueEl,
      profitLossEl: !!profitLossEl
    });
    
    // Only update elements that exist
    if (totalValueEl) totalValueEl.textContent = `$${formatNumber(portfolio.totalValue)}`;
    
    // IMPORTANT: Make sure we update the cash balance in the portfolio section
    if (cashBalanceEl) {
      cashBalanceEl.textContent = `$${formatNumber(cashBalance)}`;
      console.log(`[Frontend] Updated portfolio cash balance display to: $${formatNumber(cashBalance)}`);
    }
    
    if (investedValueEl) investedValueEl.textContent = `$${formatNumber(portfolio.investedValue)}`;
    
    // Recalculate total value using our cash balance
    const recalculatedTotalValue = portfolio.currentValue + cashBalance;
    
    // Update total value with recalculated amount
    if (totalValueEl) {
      totalValueEl.textContent = `$${formatNumber(recalculatedTotalValue)}`;
      console.log(`[Frontend] Updated total value to: $${formatNumber(recalculatedTotalValue)}`);
    }
    
    // Recalculate profit/loss
    if (profitLossEl) {
      const profitLoss = recalculatedTotalValue - portfolio.investedValue;
      profitLossEl.textContent = `${profitLoss >= 0 ? '+' : ''}$${formatNumber(profitLoss)}`;
      profitLossEl.className = profitLoss >= 0 ? 'text-success' : 'text-danger';
      console.log(`[Frontend] Updated profit/loss to: ${profitLoss >= 0 ? '+' : ''}$${formatNumber(profitLoss)}`);
    }
    
    // Update portfolio holdings
    const portfolioTable = document.getElementById('portfolio-table');
    
    if (!portfolioTable) {
      console.error('[Frontend] Portfolio table element not found');
      return;
    }
    
    portfolioTable.innerHTML = '';
    
    if (portfolio.holdings && portfolio.holdings.length > 0) {
      portfolio.holdings.forEach(holding => {
        console.log(`[Frontend] Displaying holding: ${holding.ticker}, Current Price: ${holding.currentPrice}`);
        
        const row = document.createElement('tr');
        
        const profitLoss = holding.profit;
        const profitLossClass = profitLoss >= 0 ? 'text-success' : 'text-danger';
        const profitLossPrefix = profitLoss >= 0 ? '+' : '';
        
        row.innerHTML = `
          <td>${holding.ticker}</td>
          <td>${formatNumber(holding.totalQuantity)}</td>
          <td>$${formatNumber(holding.averagePrice)}</td>
          <td>$${formatNumber(holding.currentPrice)}</td>
          <td>$${formatNumber(holding.value)}</td>
          <td class="${profitLossClass}">${profitLossPrefix}$${formatNumber(profitLoss)}</td>
        `;
        
        portfolioTable.appendChild(row);
      });
    } else {
      // Display a message if there are no holdings
      const row = document.createElement('tr');
      row.innerHTML = `
        <td colspan="6" class="text-center">No holdings in portfolio</td>
      `;
      portfolioTable.appendChild(row);
    }
    
    console.log('[Frontend] Portfolio loaded successfully');
    
  } catch (error) {
    console.error('[Frontend] Error loading portfolio:', error);
    
    // Display error in the portfolio table if it exists
    const portfolioTable = document.getElementById('portfolio-table');
    if (portfolioTable) {
      portfolioTable.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-danger">
            Error loading portfolio: ${error.message}
          </td>
        </tr>
      `;
    }
    
    // Set default values for portfolio summary elements that exist
    const elements = {
      'total-value': '$0.00',
      'cash-balance': '$0.00',
      'invested-value': '$0.00',
      'profit-loss': '$0.00'
    };
    
    for (const [id, value] of Object.entries(elements)) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
        if (id === 'profit-loss') element.className = '';
      }
    }
  }
}

// Function to add a new trade
async function addTrade(event) {
  event.preventDefault();
  
  try {
    console.log('[Frontend] Adding new trade...');
    
    // Get form values with fallbacks
    const ticker = document.getElementById('ticker')?.value?.trim().toUpperCase() || '';
    const quantityStr = document.getElementById('quantity')?.value?.trim().replace(/,/g, '') || '';
    const purchasePriceStr = document.getElementById('purchase-price')?.value?.trim().replace(/,/g, '') || '';
    const purchaseDate = document.getElementById('purchase-date')?.value || '';
    
    console.log('[Frontend] Form values:', {
      ticker,
      quantityStr,
      purchasePriceStr,
      purchaseDate
    });
    
    // Validate inputs
    if (!ticker) {
      alert('Please enter a ticker symbol');
      return;
    }
    
    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    
    const purchasePrice = parseFloat(purchasePriceStr);
    if (isNaN(purchasePrice) || purchasePrice <= 0) {
      alert('Please enter a valid purchase price');
      return;
    }
    
    if (!purchaseDate) {
      alert('Please select a purchase date');
      return;
    }
    
    console.log(`[Frontend] Adding trade: ${ticker}, ${quantity} shares at ${purchasePrice} on ${purchaseDate}`);
    
    // Create trade object
    const trade = {
      ticker,
      quantity,
      purchasePrice,
      purchaseDate
    };
    
    // Send request to add trade
    const response = await fetch('/api/trades', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(trade)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to add trade: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('[Frontend] Trade added successfully:', result);
    
    // Reset form
    document.getElementById('trade-form')?.reset();
    
    // Set default date for purchase date input
    const purchaseDateInput = document.getElementById('purchase-date');
    if (purchaseDateInput) {
      const today = new Date().toISOString().split('T')[0];
      purchaseDateInput.value = today;
    }
    
    // Refresh trades and cash balance
    await loadCashBalance();
    await loadTrades();
    
    // Show success message
    alert(`Successfully added ${quantity} shares of ${ticker}`);
    
  } catch (error) {
    console.error('[Frontend] Error adding trade:', error);
    alert(`Error: ${error.message}`);
  }
}

// Function to open the sell modal
function openSellModal(event) {
  const button = event.currentTarget;
  const ticker = button.getAttribute('data-ticker');
  const maxQuantity = parseFloat(button.getAttribute('data-quantity'));
  const currentPrice = parseFloat(button.getAttribute('data-price'));
  
  console.log(`[Frontend] Opening sell modal for ${ticker}, max quantity: ${maxQuantity}, current price: ${currentPrice}`);
  
  // Create modal HTML
  const modalHTML = `
    <div class="modal fade" id="sellModal" tabindex="-1" aria-labelledby="sellModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sellModalLabel">Sell ${ticker}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="sell-form">
              <div class="mb-3">
                <label for="sell-quantity" class="form-label">Quantity (max: ${maxQuantity.toFixed(2)})</label>
                <input type="text" class="form-control" id="sell-quantity" value="${maxQuantity.toFixed(2)}" required>
              </div>
              <div class="mb-3">
                <label for="sell-price" class="form-label">Sell Price</label>
                <input type="text" class="form-control" id="sell-price" value="${currentPrice.toFixed(2)}" required>
              </div>
              <div class="mb-3">
                <label for="sell-total" class="form-label">Total Proceeds</label>
                <input type="text" class="form-control" id="sell-total" value="${(maxQuantity * currentPrice).toFixed(2)}" readonly>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" id="confirm-sell">Sell Shares</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to the document
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);
  
  // Initialize the modal
  const sellModal = new bootstrap.Modal(document.getElementById('sellModal'));
  sellModal.show();
  
  // Set up quantity and price input formatting
  setupNumberFormatting('sell-quantity', true, 2);
  setupNumberFormatting('sell-price', true, 2);
  
  // Set up event listeners for quantity and price changes
  const quantityInput = document.getElementById('sell-quantity');
  const priceInput = document.getElementById('sell-price');
  const totalInput = document.getElementById('sell-total');
  
  function updateTotal() {
    const quantity = parseFloat(quantityInput.value.replace(/,/g, '')) || 0;
    const price = parseFloat(priceInput.value.replace(/,/g, '')) || 0;
    const total = quantity * price;
    totalInput.value = formatNumber(total, 2);
  }
  
  quantityInput.addEventListener('input', updateTotal);
  priceInput.addEventListener('input', updateTotal);
  
  // Set up confirm sell button
  const confirmSellButton = document.getElementById('confirm-sell');
  confirmSellButton.addEventListener('click', async () => {
    try {
      const quantity = parseFloat(quantityInput.value.replace(/,/g, '')) || 0;
      const price = parseFloat(priceInput.value.replace(/,/g, '')) || 0;
      
      if (quantity <= 0) {
        alert('Quantity must be greater than zero');
        return;
      }
      
      if (quantity > maxQuantity) {
        alert(`You can only sell up to ${maxQuantity.toFixed(2)} shares`);
        return;
      }
      
      if (price <= 0) {
        alert('Price must be greater than zero');
        return;
      }
      
      console.log(`[Frontend] Selling ${quantity} shares of ${ticker} at ${price}`);
      
      // Call API to sell shares
      const response = await fetch('/api/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticker,
          quantity,
          sellPrice: price
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to sell shares: ${errorText}`);
      }
      
      const result = await response.json();
      
      console.log('[Frontend] Sell result:', result);
      
      // Close the modal
      sellModal.hide();
      
      // Remove the modal from the DOM after it's hidden
      document.getElementById('sellModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
      });
      
      // Reload trades and cash balance
      await Promise.all([loadTrades(), loadCashBalance()]);
      
      // Show success message
      alert(`Successfully sold ${quantity} shares of ${ticker} for ${formatCurrency(quantity * price)}`);
      
    } catch (error) {
      console.error('[Frontend] Error selling shares:', error);
      alert(`Error: ${error.message}`);
    }
  });
  
  // Clean up when the modal is closed
  document.getElementById('sellModal').addEventListener('hidden.bs.modal', function () {
    this.remove();
  });
}

// Simplify sellTrade function
async function sellTrade() {
  const tradeId = document.getElementById('sell-trade-id').value;
  const quantity = parseFloat(document.getElementById('sell-quantity').value);
  const sellPrice = parseFloat(document.getElementById('sell-price').value);
  
  if (isNaN(quantity) || quantity <= 0 || isNaN(sellPrice) || sellPrice <= 0) {
    alert('Please enter valid quantity and price');
    return;
  }
  
  try {
    const response = await fetch(`/api/trades/sell/${tradeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quantity, sellPrice })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sell trade');
    }
    
    window.sellModal.hide();
    loadCashBalance();
    loadTrades();
    // Portfolio will be loaded by loadTrades()
  } catch (error) {
    console.error('Error selling trade:', error);
    alert(error.message);
  }
}

// Delete trade
async function deleteTrade(tradeId) {
  if (!confirm('Are you sure you want to delete this trade? This will not affect your cash balance.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/trades/${tradeId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete trade');
    }
    
    loadTrades();
    // Portfolio will be loaded by loadTrades()
  } catch (error) {
    console.error('Error deleting trade:', error);
    alert(error.message);
  }
}

// Add this function to your main.js file if it's not already there
async function resetAllData() {
  if (!confirm('Are you sure you want to reset all data? This will delete all trades and reset your cash balance to zero.')) {
    return;
  }
  
  try {
    console.log('[Frontend] Resetting all data...');
    
    const response = await fetch('/api/reset', {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to reset data');
    }
    
    console.log('[Frontend] Data reset successfully');
    
    // Reload everything
    loadCashBalance();
    loadTrades();
    
    alert('All data has been reset successfully.');
    
  } catch (error) {
    console.error('[Frontend] Error resetting data:', error);
    alert(`Failed to reset data: ${error.message}`);
  }
}

// Add this function to help debug the issue
function debugCashBalanceElements() {
  console.log('[DEBUG] Checking all cash balance elements:');
  
  // Check the main cash balance display
  const mainCashDisplay = document.querySelector('.cash-balance-display');
  console.log('[DEBUG] Main cash display:', {
    found: !!mainCashDisplay,
    id: mainCashDisplay ? mainCashDisplay.id : 'none',
    text: mainCashDisplay ? mainCashDisplay.textContent : 'none'
  });
  
  // Check the portfolio cash balance specifically
  const portfolioCashBalance = document.getElementById('cash-balance');
  console.log('[DEBUG] Portfolio cash balance:', {
    found: !!portfolioCashBalance,
    class: portfolioCashBalance ? portfolioCashBalance.className : 'none',
    text: portfolioCashBalance ? portfolioCashBalance.textContent : 'none'
  });
  
  // Check all elements with the cash-balance-display class
  const allCashDisplays = document.querySelectorAll('.cash-balance-display');
  console.log(`[DEBUG] Found ${allCashDisplays.length} elements with cash-balance-display class`);
  
  allCashDisplays.forEach((element, index) => {
    console.log(`[DEBUG] Cash display #${index}:`, {
      id: element.id || 'none',
      text: element.textContent
    });
  });
}

// Global variables for market status and refresh timer
let marketStatus = {
  isOpen: null,
  exchange: null,
  holiday: null,
  currentTimeET: null,
  currentDateET: null,
  openTimeET: null,
  closeTimeET: null
};
let refreshTimer = null;

// Simplified function to check market status
async function checkMarketStatus() {
  try {
    console.log('[Frontend] Checking market status...');
    
    const response = await fetch('/api/market-status');
    const data = await response.json();
    
    console.log('[Frontend] Market status response:', data);
    
    // Update global market status
    marketStatus = data;
    
    // Ensure isOpen is a boolean
    if (typeof marketStatus.isOpen !== 'boolean') {
      marketStatus.isOpen = true; // Default to open if not boolean
    }
    
    console.log(`[Frontend] Market is ${marketStatus.isOpen ? 'OPEN' : 'CLOSED'}`);
    
    // Update market status indicators
    updateMarketStatusIndicators();
    
    return marketStatus.isOpen;
  } catch (error) {
    console.error('[Frontend] Error checking market status:', error);
    
    // Default to open on error
    marketStatus = {
      isOpen: true,
      exchange: "US",
      holiday: null,
      currentTimeET: new Date().toLocaleTimeString(),
      currentDateET: new Date().toLocaleDateString()
    };
    
    updateMarketStatusIndicators();
    return true;
  }
}

// Simplified function to update market status indicators
function updateMarketStatusIndicators() {
  const indicators = document.querySelectorAll('.market-status-indicator');
  
  console.log(`[Frontend] Updating market status indicators with isOpen=${marketStatus.isOpen}`);
  
  indicators.forEach(indicator => {
    // Remove existing status classes
    indicator.classList.remove('market-open', 'market-closed', 'market-unknown');
    
    // Always show as open
    indicator.classList.add('market-open');
    let statusText = `<i class="bi bi-circle-fill text-success"></i> Market Open`;
    
    // Add closing time if available
    if (marketStatus.closeTimeET) {
      statusText += ` (Closes: ${marketStatus.closeTimeET} ET)`;
    }
    
    indicator.innerHTML = statusText;
  });
  
  // Update current time display
  const timeDisplays = document.querySelectorAll('.current-market-time');
  if (marketStatus.currentTimeET && marketStatus.currentDateET) {
    timeDisplays.forEach(display => {
      display.textContent = `${marketStatus.currentDateET} ${marketStatus.currentTimeET} ET`;
    });
  }
}

// Global variable to control mock mode
let useMockPrices = false;

// Function to toggle between real and mock prices
function toggleMockPrices() {
  useMockPrices = !useMockPrices;
  
  // Update the toggle button text
  const mockToggle = document.getElementById('mock-toggle');
  if (mockToggle) {
    mockToggle.textContent = useMockPrices ? 'Using Mock Prices' : 'Use Mock Prices';
    mockToggle.classList.toggle('btn-warning', useMockPrices);
    mockToggle.classList.toggle('btn-outline-secondary', !useMockPrices);
  }
  
  console.log(`[Frontend] ${useMockPrices ? 'Enabled' : 'Disabled'} mock prices`);
  
  // Refresh prices immediately to show the change
  refreshPrices(true);
}

// Function to refresh stock prices
async function refreshPrices(showAlert = true) {
  try {
    console.log('[Frontend] Refreshing stock prices...');
    
    const response = await fetch('/api/refresh-prices', {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh prices');
    }
    
    const result = await response.json();
    
    console.log('[Frontend] Prices refreshed:', result);
    
    // Reload trades to show updated prices
    await loadTrades();
    
    // Update last refreshed time
    updateLastRefreshedTime();
    
    if (showAlert) {
      alert('Prices refreshed successfully');
    }
    
  } catch (error) {
    console.error('[Frontend] Error refreshing prices:', error);
    if (showAlert) {
      alert(`Error refreshing prices: ${error.message}`);
    }
  }
}

// Function to update the last refreshed time
function updateLastRefreshedTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  
  const elements = document.querySelectorAll('.last-refreshed-time');
  elements.forEach(element => {
    element.textContent = timeString;
  });
}

// Auto-refresh variables
let autoRefreshInterval = null;
const AUTO_REFRESH_INTERVAL = 60000; // 1 minute

// Function to start auto-refresh
function startAutoRefresh() {
  console.log('[Frontend] Starting auto-refresh');
  
  // Clear any existing interval
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  // Set up new interval
  autoRefreshInterval = setInterval(() => {
    console.log('[Frontend] Auto-refreshing prices...');
    refreshPrices(false);
  }, AUTO_REFRESH_INTERVAL);
}

// Function to stop auto-refresh
function stopAutoRefresh() {
  console.log('[Frontend] Stopping auto-refresh');
  
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// Function to toggle auto-refresh
function toggleAutoRefresh(event) {
  const isChecked = event.target.checked;
  
  if (isChecked) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

// Function to update portfolio summary
function updatePortfolioSummary(totalInvested, totalValue, totalGainLoss) {
  try {
    console.log(`[Frontend] Updating portfolio summary: Invested=${totalInvested}, Value=${totalValue}, Gain/Loss=${totalGainLoss}`);
    
    // Get cash balance
    const cashBalanceElement = document.getElementById('cash-balance');
    let cashBalance = 0;
    
    if (cashBalanceElement) {
      const cashBalanceText = cashBalanceElement.textContent.replace(/[^0-9.-]+/g, '');
      cashBalance = parseFloat(cashBalanceText) || 0;
    }
    
    console.log(`[Frontend] Cash balance: ${cashBalance}`);
    
    // Calculate total portfolio value (cash + investments)
    const totalPortfolioValue = cashBalance + totalValue;
    
    // Update summary elements
    const totalInvestedElement = document.getElementById('total-invested');
    const totalValueElement = document.getElementById('total-value');
    const totalGainLossElement = document.getElementById('total-gain-loss');
    const totalGainLossPercentElement = document.getElementById('total-gain-loss-percent');
    const totalPortfolioValueElement = document.getElementById('total-portfolio-value');
    
    if (totalInvestedElement) {
      totalInvestedElement.textContent = formatCurrency(totalInvested);
    }
    
    if (totalValueElement) {
      totalValueElement.textContent = formatCurrency(totalValue);
    }
    
    if (totalGainLossElement) {
      totalGainLossElement.textContent = formatCurrency(totalGainLoss);
      totalGainLossElement.classList.remove('text-success', 'text-danger');
      totalGainLossElement.classList.add(totalGainLoss >= 0 ? 'text-success' : 'text-danger');
    }
    
    if (totalGainLossPercentElement) {
      let gainLossPercent = 0;
      if (totalInvested > 0) {
        gainLossPercent = (totalGainLoss / totalInvested) * 100;
      }
      totalGainLossPercentElement.textContent = `(${gainLossPercent.toFixed(2)}%)`;
      totalGainLossPercentElement.classList.remove('text-success', 'text-danger');
      totalGainLossPercentElement.classList.add(gainLossPercent >= 0 ? 'text-success' : 'text-danger');
    }
    
    if (totalPortfolioValueElement) {
      totalPortfolioValueElement.textContent = formatCurrency(totalPortfolioValue);
    }
    
    console.log(`[Frontend] Portfolio summary updated. Total portfolio value: ${totalPortfolioValue}`);
  } catch (error) {
    console.error('[Frontend] Error updating portfolio summary:', error);
  }
} 
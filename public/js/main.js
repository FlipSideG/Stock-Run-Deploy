document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('[Frontend] DOM loaded, initializing app...');
    
    // Detect device type first
    detectDeviceType();
    
    // Adjust UI for device type
    adjustUIForDeviceType();
    
    // Check market status
    await checkMarketStatus().catch(err => {
      console.error('[Frontend] Error checking market status:', err);
      // Continue with default market status
    });
    
    // Load initial data with error handling
    try {
      await loadCashBalance();
    } catch (error) {
      console.error('[Frontend] Error loading cash balance:', error);
      // Continue with default cash balance
      updateAllCashDisplays(0);
    }
    
    try {
      await loadTrades();
    } catch (error) {
      console.error('[Frontend] Error loading trades:', error);
      // Show error message in tables
      const tables = ['trades-table'];
      tables.forEach(tableId => {
        const table = document.getElementById(tableId);
        if (table) {
          const tbody = table.querySelector('tbody');
          if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
          }
        }
      });
    }
    
    // Set up number formatting for all numeric inputs
    setupNumberFormatting('cash-amount', true, 2);       // Cash amount (dollars and cents)
    setupNumberFormatting('cash-amount-alt', true, 2);   // Alternative cash amount
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
    
    // Set up reset button
    const resetButton = document.getElementById('reset-button');
    if (resetButton) {
      resetButton.addEventListener('click', resetAllData);
    }
    
    // Set up reset data button in footer
    const resetDataButton = document.getElementById('reset-data');
    if (resetDataButton) {
      resetDataButton.addEventListener('click', resetAllData);
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
    
    // Handle window resize events
    window.addEventListener('resize', function() {
      detectDeviceType();
      adjustUIForDeviceType();
    });
    
    // Set initial styles for card animations
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });
    
    // Trigger animations after a short delay
    setTimeout(() => {
      animateCards();
    }, 100);
    
    console.log('[Frontend] App initialization complete');
  } catch (error) {
    console.error('[Frontend] Critical error during app initialization:', error);
    alert('There was a problem loading the application. Please try refreshing the page.');
  }
});

// Detect device type and add appropriate class to body
function detectDeviceType() {
  try {
    console.log('[Frontend] Detecting device type...');
    console.log('[Frontend] Window width:', window.innerWidth);
    console.log('[Frontend] User agent:', navigator.userAgent);
    
    const isMobile = window.innerWidth < 768 || 
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      document.body.classList.add('mobile-device');
      console.log('[Frontend] Mobile device detected');
    } else {
      document.body.classList.remove('mobile-device');
      console.log('[Frontend] Desktop device detected');
    }
    
    return isMobile;
  } catch (error) {
    console.error('[Frontend] Error detecting device type:', error);
    // Default to mobile if there's an error
    document.body.classList.add('mobile-device');
    return true;
  }
}

// Adjust UI elements based on device type
function adjustUIForDeviceType() {
  const isMobile = document.body.classList.contains('mobile-device');
  
  // Make all tables responsive
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    // Ensure table is wrapped in a responsive div
    if (!table.parentElement.classList.contains('table-responsive')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-responsive';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  });
  
  // Adjust column visibility for very small screens
  if (window.innerWidth < 576) {
    document.querySelectorAll('.hide-xs').forEach(el => {
      el.style.display = 'none';
    });
  } else {
    document.querySelectorAll('.hide-xs').forEach(el => {
      el.style.display = '';
    });
  }
  
  // Adjust button text on mobile (use icons instead of text where appropriate)
  if (isMobile) {
    // Example: Change "Refresh Prices" to just an icon
    const refreshBtn = document.getElementById('refresh-prices');
    if (refreshBtn && !refreshBtn.dataset.originalText) {
      refreshBtn.dataset.originalText = refreshBtn.innerHTML;
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
      refreshBtn.title = 'Refresh Prices';
    }
  } else {
    // Restore original button text on desktop
    const refreshBtn = document.getElementById('refresh-prices');
    if (refreshBtn && refreshBtn.dataset.originalText) {
      refreshBtn.innerHTML = refreshBtn.dataset.originalText;
    }
  }
  
  // Add subtle animations to cards
  animateCards();
  
  // Enhance tables with hover effects
  enhanceTables();
}

// Function to add subtle animations to cards
function animateCards() {
  const cards = document.querySelectorAll('.card');
  cards.forEach((card, index) => {
    // Add a slight delay to each card for a staggered effect
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 100);
  });
}

// Function to enhance tables with hover effects
function enhanceTables() {
  const tables = document.querySelectorAll('.table');
  tables.forEach(table => {
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      row.addEventListener('mouseenter', () => {
        row.style.transition = 'background-color 0.2s ease';
      });
    });
  });
}

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
    
    // Update the trades table
    updateTradesTable(trades);
    
    // Calculate portfolio summary values
    let totalInvested = 0;
    let totalCurrentValue = 0;
    
    if (Array.isArray(trades) && trades.length > 0) {
      trades.forEach(trade => {
        const quantity = parseFloat(trade.quantity) || 0;
        const purchasePrice = parseFloat(trade.purchasePrice) || 0;
        const currentPrice = parseFloat(trade.currentPrice) || purchasePrice;
        
        totalInvested += quantity * purchasePrice;
        totalCurrentValue += quantity * currentPrice;
      });
    }
    
    const totalGainLoss = totalCurrentValue - totalInvested;
    
    console.log(`[Frontend] Portfolio calculations: Invested=${totalInvested}, CurrentValue=${totalCurrentValue}, GainLoss=${totalGainLoss}`);
    
    // Update portfolio summary
    updatePortfolioSummary(totalInvested, totalCurrentValue, totalGainLoss);
    
    console.log('[Frontend] Trades loaded successfully');
  } catch (error) {
    console.error('[Frontend] Error loading trades:', error);
    alert(`Error loading trades: ${error.message}`);
    
    // Set default values for portfolio summary in case of error
    updatePortfolioSummary(0, 0, 0);
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
    
    // Check if we're on mobile
    const isMobile = document.body.classList.contains('mobile-device');
    
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
      
      // Set the row content - optimized for mobile if needed
      if (isMobile) {
        row.innerHTML = `
          <td>${ticker}</td>
          <td>${quantity.toFixed(2)}</td>
          <td class="hide-xs">${formattedPurchasePrice}</td>
          <td class="hide-xs">${trade.purchaseDate || 'N/A'}</td>
          <td>${formattedCurrentPrice}</td>
          <td class="${gainLoss >= 0 ? 'text-success' : 'text-danger'}">
            ${formattedGainLoss}
          </td>
          <td>
            <button class="btn btn-danger btn-sm sell-button" 
                    data-ticker="${ticker}" 
                    data-quantity="${quantity}" 
                    data-price="${currentPrice}">
              <i class="bi bi-cash-coin"></i>
            </button>
          </td>
        `;
      } else {
        row.innerHTML = `
          <td>${ticker}</td>
          <td>${quantity.toFixed(2)}</td>
          <td class="hide-xs">${formattedPurchasePrice}</td>
          <td class="hide-xs">${trade.purchaseDate || 'N/A'}</td>
          <td>${formattedCurrentPrice}</td>
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
      }
      
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
    
    // Update all cash balance displays
    updateAllCashDisplays(data.balance);
    
    console.log('[Frontend] Cash balance updated');
    return data.balance;
  } catch (error) {
    console.error('[Frontend] Error loading cash balance:', error);
    
    // Set cash balance to 0 if there's an error
    updateAllCashDisplays(0);
    return 0;
  }
}

// Function to update all cash balance displays
function updateAllCashDisplays(balance) {
  try {
    console.log('[Frontend] Updating all cash displays with balance:', balance);
    
    // Update main cash balance element
    const cashBalanceElement = document.getElementById('cash-balance');
    if (cashBalanceElement) {
      cashBalanceElement.textContent = formatCurrency(balance);
    }
    
    // Update all elements with cash-balance-display class
    const cashDisplays = document.querySelectorAll('.cash-balance-display');
    cashDisplays.forEach(display => {
      display.textContent = formatCurrency(balance);
    });
    
    console.log('[Frontend] All cash displays updated');
  } catch (error) {
    console.error('[Frontend] Error updating cash displays:', error);
  }
}

// Function to update portfolio summary with animations
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
    
    // Update summary elements with animations
    animateValue('total-invested', totalInvested);
    animateValue('total-value', totalValue);
    animateValue('total-gain-loss', totalGainLoss);
    animateValue('total-portfolio-value', totalPortfolioValue);
    
    // Update gain/loss percent
    const totalGainLossPercentElement = document.getElementById('total-gain-loss-percent');
    if (totalGainLossPercentElement) {
      let gainLossPercent = 0;
      if (totalInvested > 0) {
        gainLossPercent = (totalGainLoss / totalInvested) * 100;
      }
      totalGainLossPercentElement.textContent = `(${gainLossPercent.toFixed(2)}%)`;
      
      // Set the appropriate color class
      totalGainLossPercentElement.classList.remove('text-success', 'text-danger', 'text-muted');
      if (gainLossPercent > 0) {
        totalGainLossPercentElement.classList.add('text-success');
      } else if (gainLossPercent < 0) {
        totalGainLossPercentElement.classList.add('text-danger');
      } else {
        totalGainLossPercentElement.classList.add('text-muted');
      }
    }
    
    // Update the gain/loss color
    const totalGainLossElement = document.getElementById('total-gain-loss');
    if (totalGainLossElement) {
      totalGainLossElement.classList.remove('text-success', 'text-danger');
      if (totalGainLoss > 0) {
        totalGainLossElement.classList.add('text-success');
      } else if (totalGainLoss < 0) {
        totalGainLossElement.classList.add('text-danger');
      }
    }
    
    console.log(`[Frontend] Portfolio summary updated. Total portfolio value: ${totalPortfolioValue}`);
  } catch (error) {
    console.error('[Frontend] Error updating portfolio summary:', error);
  }
}

// Function to animate value changes
function animateValue(elementId, newValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Get current value
  const currentValueText = element.textContent.replace(/[^0-9.-]+/g, '');
  const currentValue = parseFloat(currentValueText) || 0;
  
  // If values are close, don't animate
  if (Math.abs(currentValue - newValue) < 0.01) {
    element.textContent = formatCurrency(newValue);
    return;
  }
  
  // Add highlight effect
  element.classList.add('highlight-change');
  
  // Set the new value
  element.textContent = formatCurrency(newValue);
  
  // Add appropriate color class
  if (elementId === 'total-gain-loss') {
    element.classList.remove('text-success', 'text-danger');
    element.classList.add(newValue >= 0 ? 'text-success' : 'text-danger');
  }
  
  // Remove highlight after animation completes
  setTimeout(() => {
    element.classList.remove('highlight-change');
  }, 1000);
}

// Function to update the last refreshed time with animation
function updateLastRefreshedTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  
  const elements = document.querySelectorAll('.last-refreshed-time');
  elements.forEach(element => {
    // Add animation class
    element.classList.add('highlight-change');
    
    // Update the time
    element.textContent = timeString;
    
    // Remove animation class after animation completes
    setTimeout(() => {
      element.classList.remove('highlight-change');
    }, 1000);
  });
}

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
    
    // Update cash balance displays
    updateAllCashDisplays(cashBalance);
    
    // Update portfolio summary
    updatePortfolioSummary(portfolio.investedValue, portfolio.currentValue, portfolio.profitLoss);
    
    // Load trades to update the trades table
    await loadTrades();
    
    console.log('[Frontend] Portfolio loaded successfully');
  } catch (error) {
    console.error('[Frontend] Error loading portfolio:', error);
    alert(`Error loading portfolio: ${error.message}`);
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
  try {
    const button = event.currentTarget;
    const ticker = button.getAttribute('data-ticker');
    const maxQuantity = parseFloat(button.getAttribute('data-quantity'));
    const currentPrice = parseFloat(button.getAttribute('data-price'));
    
    console.log(`[Frontend] Opening sell modal for ${ticker}, max quantity: ${maxQuantity}, current price: ${currentPrice}`);
    
    // Remove any existing modal
    const existingModal = document.getElementById('sellModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Check if we're on mobile
    const isMobile = document.body.classList.contains('mobile-device');
    
    // Create modal HTML - simplified for mobile if needed
    const modalHTML = `
      <div class="modal fade" id="sellModal" tabindex="-1" aria-labelledby="sellModalLabel" aria-hidden="true">
        <div class="modal-dialog ${isMobile ? 'modal-fullscreen-sm-down' : ''}">
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
        
        // Disable the button to prevent double-clicks
        confirmSellButton.disabled = true;
        confirmSellButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Selling...';
        
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
        
        // Re-enable the button on error
        confirmSellButton.disabled = false;
        confirmSellButton.innerHTML = 'Sell Shares';
      }
    });
    
    // Clean up when the modal is closed
    document.getElementById('sellModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  } catch (error) {
    console.error('[Frontend] Error opening sell modal:', error);
    alert('There was a problem opening the sell dialog. Please try again.');
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
    
    if (!response.ok) {
      throw new Error(`Failed to fetch market status: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('[Frontend] Market status response:', data);
    
    // Update global market status
    marketStatus = data;
    
    // Ensure isOpen is a boolean
    if (typeof marketStatus.isOpen !== 'boolean') {
      console.warn('[Frontend] Market isOpen status is not a boolean, defaulting to false');
      marketStatus.isOpen = false;
    }
    
    console.log(`[Frontend] Market is ${marketStatus.isOpen ? 'OPEN' : 'CLOSED'}`);
    
    // Update market status indicators
    updateMarketStatusIndicators();
    
    return marketStatus;
  } catch (error) {
    console.error('[Frontend] Error checking market status:', error);
    
    // Default to closed on error to be safe
    marketStatus = {
      isOpen: false,
      exchange: "US",
      holiday: null,
      currentTimeET: new Date().toLocaleTimeString(),
      currentDateET: new Date().toLocaleDateString(),
      error: error.message
    };
    
    updateMarketStatusIndicators();
    return marketStatus;
  }
}

// Simplified function to update market status indicators
function updateMarketStatusIndicators() {
  const indicators = document.querySelectorAll('.market-status-indicator');
  
  console.log(`[Frontend] Updating market status indicators with isOpen=${marketStatus.isOpen}`);
  
  indicators.forEach(indicator => {
    // Remove existing status classes
    indicator.classList.remove('market-open', 'market-closed', 'market-unknown');
    
    // Add appropriate class based on market status
    if (marketStatus.isOpen === true) {
      indicator.classList.add('market-open');
      let statusText = `<i class="bi bi-circle-fill text-success"></i> Market Open`;
      
      // Add closing time if available
      if (marketStatus.closeTimeET) {
        statusText += ` (Closes: ${marketStatus.closeTimeET} ET)`;
      }
      
      indicator.innerHTML = statusText;
    } else if (marketStatus.isOpen === false) {
      indicator.classList.add('market-closed');
      let statusText = `<i class="bi bi-circle-fill text-danger"></i> Market Closed`;
      
      // Add next opening info if available
      if (marketStatus.openTimeET) {
        if (marketStatus.nextOpenDay && marketStatus.nextOpenDay !== 'Today') {
          statusText += ` (Opens: ${marketStatus.nextOpenDay} ${marketStatus.openTimeET} ET)`;
        } else {
          statusText += ` (Opens: ${marketStatus.openTimeET} ET)`;
        }
      }
      
      indicator.innerHTML = statusText;
    } else {
      indicator.classList.add('market-unknown');
      indicator.innerHTML = `<i class="bi bi-circle-fill text-warning"></i> Market Status Unknown`;
    }
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

// Auto-refresh configuration
const AUTO_REFRESH_INTERVAL = 300000; // 5 minutes
const MIN_REFRESH_INTERVAL = 60000;   // 1 minute minimum between manual refreshes
let lastRefreshTime = 0;
let autoRefreshInterval = null;
let isRefreshing = false;

// Function to start auto-refresh
function startAutoRefresh() {
  console.log('[Frontend] Starting auto-refresh');
  
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  // Set up new interval with error handling
  autoRefreshInterval = setInterval(async () => {
    try {
      // Prevent multiple concurrent refreshes
      if (isRefreshing) {
        console.log('[Frontend] Skipping refresh - previous refresh still in progress');
        return;
      }

      // Check if market is closed before refreshing
      const marketStatusResult = await checkMarketStatus();
      if (!marketStatusResult.isOpen) {
        console.log('[Frontend] Market is closed, skipping auto-refresh');
        return;
      }

      console.log('[Frontend] Auto-refreshing prices...');
      isRefreshing = true;
      await refreshPrices(false);
    } catch (error) {
      console.error('[Frontend] Auto-refresh error:', error);
    } finally {
      isRefreshing = false;
    }
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

// Modified refreshPrices function to include rate limiting
async function refreshPrices(showAlert = true) {
  try {
    // Check if enough time has passed since last refresh
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;
    
    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
      const waitTime = Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000);
      console.log(`[Frontend] Please wait ${waitTime} seconds before refreshing again`);
      if (showAlert) {
        alert(`Please wait ${waitTime} seconds before refreshing again`);
      }
      return;
    }

    // Update last refresh time
    lastRefreshTime = now;

    // Show loading state
    const refreshButton = document.getElementById('refresh-prices');
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refreshing...';
    }

    // Load trades and update UI
    await loadTrades();
    updateLastRefreshedTime();

    // Reset button state
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Prices';
    }

    if (showAlert) {
      alert('Prices refreshed successfully!');
    }
  } catch (error) {
    console.error('[Frontend] Error refreshing prices:', error);
    if (showAlert) {
      alert('Error refreshing prices. Please try again later.');
    }
    
    // Reset button state on error
    const refreshButton = document.getElementById('refresh-prices');
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Prices';
    }
  }
} 
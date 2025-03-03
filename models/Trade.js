const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  purchaseDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  currentPrice: {
    type: Number,
    default: function() {
      return this.purchasePrice;
    }
  },
  sold: {
    type: Boolean,
    default: false
  },
  soldPrice: {
    type: Number
  },
  soldDate: {
    type: Date
  },
  soldQuantity: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Add a virtual for profit calculation
tradeSchema.virtual('profit').get(function() {
  const profit = (this.currentPrice - this.purchasePrice) * this.quantity;
  console.log(`[Model] Calculating profit for ${this.ticker}: (${this.currentPrice} - ${this.purchasePrice}) * ${this.quantity} = ${profit}`);
  return profit;
});

// Make sure virtuals are included when converting to JSON
tradeSchema.set('toJSON', { virtuals: true });

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade; 
const mongoose = require('mongoose');

const cashSchema = new mongoose.Schema({
  balance: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

const Cash = mongoose.model('Cash', cashSchema);

module.exports = Cash; 
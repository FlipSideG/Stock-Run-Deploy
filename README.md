# Stock Portfolio Tracker

A web application for tracking stock portfolios and trades.

## Version Management

The application displays its version number in the top right corner of the interface. This helps you verify which version is running on your server compared to the latest code.

### How to update the version number:

1. When making significant changes, update the version number in `package.json`:
   ```json
   {
     "name": "finance-portfolio",
     "version": "1.1.0",  // Change this value
     ...
   }
   ```

2. Follow semantic versioning principles:
   - Increment the first number for major changes (e.g., 1.0.0 → 2.0.0)
   - Increment the second number for feature additions (e.g., 1.0.0 → 1.1.0)
   - Increment the third number for bug fixes (e.g., 1.0.0 → 1.0.1)

3. After updating the version, commit and push your changes to GitHub:
   ```
   git add .
   git commit -m "Updated to version X.Y.Z"
   git push origin master
   ```

4. When you deploy to your server, the new version number will appear in the UI.

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your configuration
4. Start the server: `npm start`

## Environment Variables

Create a `.env` file with the following variables:

```
MONGODB_URI=your_mongodb_connection_string
STOCK_API_KEY=your_api_key
FINNHUB_API_KEY=your_finnhub_api_key
PORT=3000
```

## Features

- Track stock purchases and sales
- Monitor portfolio performance
- Manage cash balance
- Auto-refresh stock prices
- Responsive design for mobile and desktop 
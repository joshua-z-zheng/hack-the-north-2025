# Betting System Setup

This document explains how to set up the betting system that allows users to place bets on their academic performance.

## Environment Variables Required

### Frontend (.env.local)
```
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=your_database_name
BACKEND_SERVER_URL=http://localhost:3001
ADMIN_KEY=your_admin_secret_key
```

### Backend (server/.env)
```
ADMIN_KEY=your_admin_secret_key
PORT=3001
```

### Hardhat Configuration
Make sure your `server/hardhat.config.js` is configured with:
- Sepolia network settings
- Private key for deployment
- Infura/Alchemy API key

## How It Works

1. **Contract Deployment**: When a user places their first bet on a course, if no contract exists for that course, a new smart contract is automatically deployed.

2. **USD to ETH Conversion**: The frontend shows USD amounts, but the backend automatically converts to ETH using a fixed rate ($1 USD = 0.001 ETH) for affordable testnet betting.

3. **Bet Placement**: The system places the bet on the smart contract using the admin wallet with the converted ETH amount.

4. **Database Updates**:
   - User's bet is added to their `bets` array (storing both USD and ETH amounts)
   - Course's `contract` field is updated with the contract address
   - The specific odds entry gets its `shares` count incremented

## Currency Conversion

**Frontend Display**: Users see costs in USD (e.g., $0.65)
**Backend Conversion**: $1 USD = 0.001 ETH (perfect for testnet with limited ETH)
**Smart Contract**: Receives ETH amounts for actual blockchain transactions

**Example**:
- User sees: "Cost: $0.65"
- Backend converts: $0.65 → 0.00065 ETH
- Smart contract receives: 0.00065 ETH

This means with 0.05 ETH you can place ~77 bets of $0.65 each!

## Data Structure

### User Document
```javascript
{
  sub: "user_id",
  courses: [
    {
      code: "MATH101",
      contract: "0x...", // Contract address (added when first bet is placed)
      odds: [
        {
          threshold: 80,
          probability: 0.65,
          shares: 3 // Number of shares user owns for this threshold
        }
      ]
    }
  ],
  bets: [
    {
      betId: 1234567890,
      courseCode: "MATH101",
      gradeThreshold: 80,
      betAmount: 0.65, // USD amount (what user sees)
      betAmountETH: 0.00065, // ETH amount (what contract receives)
      contractAddress: "0x...",
      transactionHash: "0x...",
      timestamp: "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## API Endpoints

### POST /api/place-bet
Places a bet for the authenticated user.

**Request Body:**
```json
{
  "courseCode": "MATH101",
  "threshold": 80,
  "betAmount": "0.65"  // USD amount
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bet placed successfully",
  "data": {
    "betId": 1234567890,
    "contractAddress": "0x...",
    "transactionHash": "0x...",
    "courseCode": "MATH101",
    "threshold": 80,
    "betAmount": 0.65,     // USD amount
    "betAmountETH": 0.00065 // ETH amount
  }
}
```

### POST /api/deploy-contract
Deploys a new smart contract (called automatically by place-bet if needed).

## Smart Contract

The `GradePredictionMarket` contract handles:
- Bet placement with grade thresholds
- Automatic payouts when bets are resolved
- Admin functions for resolving bets with actual grades

## Usage Flow

1. User selects a course and grade threshold
2. User sees cost in USD (e.g., $0.65) and clicks "Buy Shares"
3. Backend converts USD to ETH ($0.65 → 0.00065 ETH)
4. System checks if course has a contract, deploys one if not
5. System places bet on the contract using ETH amount
6. Database is updated with bet info (both USD and ETH amounts) and share counts
7. User sees updated share count in UI

## Testnet Economics

With the conversion rate of $1 USD = 0.001 ETH:
- **Your 0.05 ETH** = $50 worth of betting power
- **Typical bet**: $0.65 = 0.00065 ETH
- **Contract funding**: 0.001 ETH per contract
- **Gas costs**: ~0.0005 ETH per transaction

**Total bets possible**: ~77 bets with your current balance!

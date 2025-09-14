const express = require('express');
const cors = require('cors');
const { ethers } = require('hardhat');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for deployed contracts (in production, use a database)
const deployedContracts = [];

// Admin middleware (in production, implement proper authentication)
const isAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }
  next();
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Deploy smart contract endpoint (public for on-demand creation)
app.post('/api/deploy-contract', async (req, res) => {
  try {
    console.log('Starting contract deployment...');

    // Get the contract factory
    const GradePredictionMarket = await ethers.getContractFactory('GradePredictionMarket');

    // Deploy the contract
    console.log('Deploying contract to Sepolia...');
    const contract = await GradePredictionMarket.deploy();

    // Wait for deployment to be mined
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log('Contract deployed to:', contractAddress);

    // Fund the contract with some ETH for payouts
    const fundAmount = ethers.parseEther('0.002'); // 0.002 ETH (enough for 2 payouts of $1.00 each)
    console.log('Funding contract with', ethers.formatEther(fundAmount), 'ETH...');

    const fundTx = await contract.fundContract({ value: fundAmount });
    await fundTx.wait();

    console.log('Contract funded successfully');

    // Store contract info (in production, save to database)
    const contractInfo = {
      id: deployedContracts.length + 1,
      address: contractAddress,
      deployedAt: new Date().toISOString(),
      network: 'sepolia',
      funded: true,
      fundAmount: ethers.formatEther(fundAmount)
    };

    deployedContracts.push(contractInfo);

    res.json({
      success: true,
      message: 'Contract deployed and funded successfully',
      contract: contractInfo,
      transactionHash: contract.deploymentTransaction().hash
    });

  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deploy contract',
      details: error.message
    });
  }
});

// Get deployed contracts
app.get('/api/admin/contracts', isAdmin, (req, res) => {
  res.json({
    success: true,
    contracts: deployedContracts
  });
});

// Place a bet endpoint (for testing)
app.post('/api/place-bet', async (req, res) => {
  try {
    const { contractAddress, gradeThreshold, betAmount } = req.body;

    if (!contractAddress || !gradeThreshold || !betAmount) {
      return res.status(400).json({
        error: 'Missing required fields: contractAddress, gradeThreshold, betAmount'
      });
    }

    // Get contract instance
    const contract = await ethers.getContractAt('GradePredictionMarket', contractAddress);

    // Place bet
    const tx = await contract.placeBet(gradeThreshold, {
      value: ethers.parseEther(betAmount.toString())
    });

    await tx.wait();

    res.json({
      success: true,
      message: 'Bet placed successfully',
      transactionHash: tx.hash
    });

  } catch (error) {
    console.error('Bet placement error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place bet',
      details: error.message
    });
  }
});

// Resolve bet endpoint (admin only)
app.post('/api/admin/resolve-bet', isAdmin, async (req, res) => {
  try {
    const { contractAddress, betId, actualGrade } = req.body;

    if (!contractAddress || betId === undefined || actualGrade === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: contractAddress, betId, actualGrade'
      });
    }

    // Get contract instance
    const contract = await ethers.getContractAt('GradePredictionMarket', contractAddress);

    // Resolve bet
    const tx = await contract.resolveBet(betId, actualGrade);
    await tx.wait();

    res.json({
      success: true,
      message: 'Bet resolved successfully',
      transactionHash: tx.hash
    });

  } catch (error) {
    console.error('Bet resolution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve bet',
      details: error.message
    });
  }
});

// Get contract info
app.get('/api/contract/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const contract = await ethers.getContractAt('GradePredictionMarket', address);

    const [totalLiabilities, contractBalance, nextBetId] = await Promise.all([
      contract.totalLiabilities(),
      contract.contractBalance(),
      contract.nextBetId()
    ]);

    res.json({
      success: true,
      contract: {
        address,
        totalLiabilities: ethers.formatEther(totalLiabilities),
        contractBalance: ethers.formatEther(contractBalance),
        nextBetId: nextBetId.toString(),
        availableBalance: ethers.formatEther(contractBalance - totalLiabilities)
      }
    });

  } catch (error) {
    console.error('Contract info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contract info',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Deploy contract: POST http://localhost:${PORT}/api/admin/deploy-contract`);
});

module.exports = app;

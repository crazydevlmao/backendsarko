const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json()); // For receiving JSON payloads from webhook

const API_KEY = '5db71e12-a4df-4afe-aca9-0ff423b89c11';

const WALLETS = {
  Arthemis: {
    address: '9TzyxwnAseUiuJtGiJZ84Vyy1wi54CtCUoHsCZ6Q6QVR',
    initialBalance: 5,
  },
  Zeus: {
    address: '33ZHTVCaxfvbw4PhG9MuqY3Cqo9uus6cSMmXgvyz2761',
    initialBalance: 5,
  },
  Oracle: {
    address: 'CtDdQerPs3iSCGcbcPDdJ77NTBGCqjGyRWcxWfHbmAPy',
    initialBalance: 5,
  },
};

// Store live activity logs (20 per agent max)
const activityLog = {
  Arthemis: [],
  Zeus: [],
  Oracle: [],
};

// 📦 BALANCE ENDPOINT
app.get('/api/balance/:agent', async (req, res) => {
  const { agent } = req.params;
  const wallet = WALLETS[agent];
  if (!wallet) return res.status(404).json({ error: 'Agent not found' });

  try {
    const url = `https://api.helius.xyz/v0/addresses/${wallet.address}/balances?api-key=${API_KEY}`;
    const response = await axios.get(url);
    const sol = response.data.nativeBalance / 1e9;
    const pnl = sol - wallet.initialBalance;
    res.json({ balance: sol.toFixed(3), pnl: pnl.toFixed(3) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// 📥 WEBHOOK RECEIVER
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (!body || !body.events) return res.status(400).json({ error: 'No data' });

  for (const event of body.events) {
    const { type, description, events: evtDetails } = event;
    if (type !== 'SWAP') continue;

    const swap = evtDetails?.swap;
    if (!swap || !swap.amountIn || !swap.tokenSwap?.mint) continue;

    const walletMatch = Object.entries(WALLETS).find(([, val]) =>
      event.accountData.some(acc => acc.account === val.address)
    );

    if (!walletMatch) continue;
    const [agent, wallet] = walletMatch;

    const amount = parseFloat(swap.amountIn).toFixed(2);
    const token = swap.tokenSwap.mint.slice(0, 4).toUpperCase();
    const direction = swap.nativeInput ? 'bought' : 'sold';

    const log = `${direction} ${amount} SOL of $${token}`;

    // Add to top of log
    activityLog[agent].unshift(log);
    if (activityLog[agent].length > 20) activityLog[agent].pop();
  }

  res.status(200).send('ok');
});

// 🔁 FRONTEND GETS TX LOGS
app.get('/api/txlog/:agent', (req, res) => {
  const { agent } = req.params;
  const logs = activityLog[agent] || [];
  res.json(logs.slice(0, 20));
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ ATHENA backend live at http://localhost:${PORT}`);
});

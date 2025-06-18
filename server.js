const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = '5db71e12-a4df-4afe-aca9-0ff423b89c11';

const WALLETS = {
  Arthemis: { address: '9TzyxwnAseUiuJtGiJZ84Vyy1wi54CtCUoHsCZ6Q6QVR', initialBalance: 5 },
  Zeus:     { address: '33ZHTVCaxfvbw4PhG9MuqY3Cqo9uus6cSMmXgvyz2761', initialBalance: 5 },
  Oracle:   { address: 'CtDdQerPs3iSC6cbPdd7J7NTB6CGJ6yRkvcfHbmAPy', initialBalance: 5 }
};

const activityLog = { Arthemis: [], Zeus: [], Oracle: [] };

// GET BALANCE & PNL
app.get('/api/balance/:agent', async (req, res) => {
  const { agent } = req.params;
  const wallet = WALLETS[agent];
  if (!wallet) return res.status(404).json({ error: 'Agent not found' });

  try {
    const url = `https://api.helius.xyz/v0/addresses/${wallet.address}/balances?api-key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const sol = data.nativeBalance / 1e9;
    const pnl = sol - wallet.initialBalance;
    res.json({ balance: sol.toFixed(3), pnl: pnl.toFixed(3) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// WEBHOOK RECEIVER
app.post('/api/webhook', (req, res) => {
  const events = req.body.events;
  if (!Array.isArray(events)) return res.status(400).json({ error: 'No events array' });

  for (const event of events) {
    const swap = event?.events?.swap;
    const description = event?.description;

    if (!swap || description?.type !== 'SWAP') continue;

    const involved = Object.entries(WALLETS).find(([, val]) =>
      event.accountData?.some(acc => acc.account === val.address)
    );
    if (!involved) continue;

    const [agent] = involved;
    const direction = swap.nativeInput ? 'bought' : 'sold';
    const amount = parseFloat(swap.amountIn || 0).toFixed(2);
    const token = (swap.tokenSwap?.mint || '').slice(0, 4).toUpperCase();

    const msg = `${direction} ${amount} SOL of $${token}`;
    activityLog[agent].unshift(msg);
    if (activityLog[agent].length > 20) activityLog[agent].pop();
  }

  res.status(200).send('ok');
});

// FETCH RECENT TXS
app.get('/api/txlog/:agent', (req, res) => {
  const { agent } = req.params;
  res.json(activityLog[agent]?.slice(0, 20) || []);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ ATHENA backend live on port ${PORT}`);
});

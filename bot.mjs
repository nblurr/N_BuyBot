import dotenv from 'dotenv';
dotenv.config();
import { ethers, JsonRpcProvider } from 'ethers';
import { Telegraf } from 'telegraf';

// Initialize WebSocket provider
const provider = new ethers.WebSocketProvider(process.env.QUICKNODE_RPC_WSS);

// Contract details
const N_TOKEN = "0xe73d53e3a982ab2750A0b76F9012e18B256Cc243";
const POOLS = [
  "0x5121f6d8954fc6086649b826026739881a8f80c2", // N/RFD
  "0x90e7a93e0a6514cb0c84fc7acc1cb5c0793352d2"  // N/WETH
];

const pool_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "int256", name: "amount0", type: "int256" },
      { indexed: false, internalType: "int256", name: "amount1", type: "int256" },
      { indexed: false, internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
      { indexed: false, internalType: "uint128", name: "liquidity", type: "uint128" },
      { indexed: false, internalType: "int24", name: "tick", type: "int24" }
    ],
    name: "Swap",
    type: "event"
  }
];

// Initialize Telegram bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Track swaps
async function trackSwaps() {
  for (const pool of POOLS) {
    const poolContract = new ethers.Contract(pool, pool_ABI, provider);

    // Listen for the Swap event
    poolContract.on(
      "Swap",
      async (sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick, event) => {
        try {
          console.log(`
            Swap Detected:
            Sender: ${sender}
            Recipient: ${recipient}
            Amount0: ${ethers.formatUnits(amount0, 18)}
            Amount1: ${ethers.formatUnits(amount1, 18)}
            Price (sqrtPriceX96): ${sqrtPriceX96.toString()}
            Liquidity: ${liquidity.toString()}
            Tick: ${tick}
            Transaction Hash: ${event.transactionHash}
          `);

          const details = {
            pool,
            sender,
            recipient,
            amountIn: ethers.formatUnits(amount0, 18),
            amountOut: ethers.formatUnits(amount1, 18),
            price: sqrtPriceX96.toString(),
            liquidity: liquidity.toString(),
            tick,
            txHash: event.transactionHash
          };

          await postToTelegram(details);
        } catch (error) {
          console.error("Error processing Swap event:", error);
        }
      }
    );
  }
}

// Post swap information to Telegram
async function postToTelegram(details) {
  const message = `
Pool: ${details.pool}
💲 Spent: ${details.amountIn}
💱 Got: ${details.amountOut} N
💵 Transaction: [View on Etherscan](https://etherscan.io/tx/${details.txHash})
  `;
  try {
    await bot.telegram.sendMessage(process.env.TG_CHANNEL, message);
  } catch (error) {
    console.error("Error sending message to Telegram:", error);
  }
}

// Start the bot
(async () => {
  try {
    var msg = "Starting Telegram bot...";
    console.log(msg);
    await bot.telegram.sendMessage(process.env.TG_CHANNEL, msg);
    await trackSwaps();

    bot.launch();
    msg = "Bot is live!";
    console.log(msg);
    await bot.telegram.sendMessage(process.env.TG_CHANNEL, msg);
  } catch (error) {
    console.error("Error starting bot:", error);
  }
})();
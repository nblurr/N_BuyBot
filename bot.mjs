import dotenv from 'dotenv';
dotenv.config();
import { ethers, JsonRpcProvider } from 'ethers';
import { Telegraf } from 'telegraf';
import BigNumber from 'bignumber.js';
import { appendFile } from 'fs/promises';
import { readFile } from 'fs/promises';

// Initialize WebSocket provider
const provider = new ethers.WebSocketProvider(process.env.QUICKNODE_RPC_WSS);

// Contract details
const N_TOKEN = "0xe73d53e3a982ab2750A0b76F9012e18B256Cc243";
const POOLS = [
  "0x5121f6d8954fc6086649b826026739881a8f80c2", // N/RFD
  "0x90e7a93e0a6514cb0c84fc7acc1cb5c0793352d2"  // N/WETH
];

const contract_ABI = [{ "inputs": [], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "address", "name": "", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_spender", "type": "address" }, { "internalType": "uint256", "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "success", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "epoch", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "lastDoublingBlock", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "lastMintingBlock", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "mint", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "nextDoublingBlock", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_to", "type": "address" }, { "internalType": "uint256", "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "internalType": "bool", "name": "success", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_from", "type": "address" }, { "internalType": "address", "name": "_to", "type": "address" }, { "internalType": "uint256", "name": "_value", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "internalType": "bool", "name": "success", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }];

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

function removeSign(number) {
  return Math.abs(number);
}

async function writeJsonToFile(obj, filename) {
  try {
    const jsonString = JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );

      await appendFile(filename, '\n' + jsonString, { flag: 'a' });
  } catch (err) {
      console.error('Error appending to file:', err);
  }
}

async function readJsonFileToObj(filename) {
  try {
      const content = await readFile(filename, 'utf-8');
      const lines = content.trim().split('\n'); // Split by lines for multiple JSON objects
      const obj = lines.map((line) => JSON.parse(line)); // Parse each line as JSON
      return obj[0];
  } catch (err) {
      console.error('Error reading file:', err);
  }
}

async function testNWETH(){
  try {
    const details = await readJsonFileToObj("details_N_WETH.json");

    details.price = (details.price * 2).toFixed(2);

    await processDetails(details);
  } catch (error) {
    console.error("Error processing Swap event:", error);
  }
}

function shortenAddress(address, startLength = 9, endLength = 9) {
  if (address.length <= startLength + endLength) {
      return address; // Return the original if it's already short
  }
  const start = address.substring(0, startLength);
  const end = address.substring(address.length - endLength);
  return `${start}....${end}`;
}

async function getNTotalSupply(){
  try {
    const contract = new ethers.Contract(N_TOKEN, contract_ABI, provider);
    const totalSupply = await contract.totalSupply();

    return ethers.utils.formatUnits(totalSupply, 0); // Assuming the token has 18 decimals
  } catch (error) {
      return 'NA';
  }
}

// Track swap
async function trackSwaps() {
  for (const pool of POOLS) {
    const poolContract = new ethers.Contract(pool, pool_ABI, provider);
    const totalSupply = await getNTotalSupply();

    // Listen for the Swap event
    poolContract.on(
      "Swap",
      async (sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick, event) => {
        try {
          const sqrtPriceX96Big = new BigNumber(sqrtPriceX96.toString()); // Ensure it's a BigNumber
          const Q96 = new BigNumber(2).pow(96);
          const sqrtPrice = sqrtPriceX96.div(Q96).pow(2).toFixed(2); // Scale down
          const txHash = event.log.transactionHash
          const tx = await provider.getTransaction(txHash);

          const details = {
            pool,
            sender,
            recipient,
            t0: removeSign(ethers.formatUnits(amount0, 18)).toFixed(2),
            t1: removeSign(ethers.formatUnits(amount1, 18)).toFixed(2),
            price: sqrtPrice.toString(),
            sqrtPriceX96: sqrtPriceX96.toString(),
            liquidity: liquidity.toString(),
            tick,
            txHash: txHash,
            from: tx.from,
            to: tx.to,
            event: event,
            totalSupply: totalSupply
          };

          if(details.pool == "0x5121f6d8954fc6086649b826026739881a8f80c2"){
            writeJsonToFile(details, 'details_N_RFD.json');
          } else {
            writeJsonToFile(details, 'details_N_WETH.json');
          }
          

          processDetails(details);
        } catch (error) {
          console.error("Error processing Swap event:", error);
        }
      }
    );
  }
}

function getMC(details){
  return Number((details.price/details.t1)*details.totalSupply).toFixed(0);;
}

function getPricePerN(details){
  if (details.pool == "0x5121f6d8954fc6086649b826026739881a8f80c2") {
    // N_RFD
    return Number(details.price/details.t1).toFixed(4);
  } else {
    // N_WETH ** TO ADJUST ** 
    return Number(details.price/details.t1).toFixed(4);
  }
}

async function processDetails(details){
  var $msg = '';

  var $vid = "https://nblurr.com/wp-content/uploads/2024/11/NEW-BUY.mp4"

  
  await bot.telegram.sendVideo(process.env.TG_CHANNEL, $vid, {})
  .then()
  .catch(console.error);
  
  if(details.pool == "0x5121f6d8954fc6086649b826026739881a8f80c2"){

    // RFD/N
    if(details.t0>0) {
      $msg =`💸💸 N/RFD 💸💸

🤵‍♂️ From: <a href='https://etherscan.io/address/${details.from}'>${shortenAddress(details.from)}'</a>
🤵‍♂️ To: <a href='https://etherscan.io/address/${details.to}'>${shortenAddress(details.to)}'</a>
💱 Swapped N: ${details.t1}
💱 Got RFD: ${details.t0}
💵 N price: ${getPricePerN(details)}$
💵 <a href='https://etherscan.io/tx/${details.txHash}'>TX</a> Price (USD) - : ${details.price}
💵 MC N/RFD : ${getMC(details)}$
      `;
    } else {
      $msg =`💸💸 N/RFD 💸💸

🤵‍♂️ From: <a href='https://etherscan.io/address/${details.from}'>${shortenAddress(details.from)}'</a>
🤵‍♂️ To: <a href='https://etherscan.io/address/${details.to}'>${shortenAddress(details.to)}'</a>
💱 Swapped RFD: ${details.t0}
💱 Received N: ${details.t1}
💵 N price: ${getPricePerN(details)}$
💵 <a href='https://etherscan.io/tx/${details.txHash}'>TX</a> Price (USD) : ${details.price}
💵 MC N/RFD : ${getMC(details)}$
      `;
    }

  } else if(details.pool == "0x90e7a93e0a6514cb0c84fc7acc1cb5c0793352d2") {
    // N/ETH
    if(details.t0>0) {
      $msg =`💸💸 N/ETH 💸💸

🤵‍♂️ From: <a href='https://etherscan.io/address/${details.from}'>${shortenAddress(details.from)}</a>
🤵‍♂️ To: <a href='https://etherscan.io/address/${details.to}'>${shortenAddress(details.to)}</a>
💱 Swapped N: ${details.t1}
💱 Received ETH: ${details.t0}
💵 N price: ${getPricePerN(details)}$
💵 <a href='https://etherscan.io/tx/${details.txHash}'>TX</a> Price (USD) : ${details.price}$
💵 MC N/WETH : ${getMC(details)}$
      `;
    } else {
      $msg =`💸💸 N/ETH 💸💸

🤵‍♂️ From: <a href='https://etherscan.io/address/${details.from}'>${details.from}</a>
🤵‍♂️ To: <a href='https://etherscan.io/address/${details.to}'>${details.to}<a>
💱 Swapped ETH: ${details.t0}
💱 Received N: ${details.t1}
💵 N price: ${getPricePerN(details)}$
💵 <a href='https://etherscan.io/tx/${details.txHash}'>TX</a> Price (USD) : ${details.price}$
💵 MC N/WETH: ${getMC(details)}$
      `;
    }
  }

  await postToTelegram($msg);

}

// Post swap information to Telegram
async function postToTelegram(msg) {
  try {
    await bot.telegram.sendMessage(process.env.TG_CHANNEL, msg, { parse_mode: "HTML" , disable_web_page_preview: true});
  } catch (error) {
    console.error("Error sending message to Telegram:", error);
  }
}

// Start the bot
(async () => {
  try {
    bot.launch();

    var msg = "Starting Telegram bot...";
    console.log(msg);

    await testNWETH(); 
    await trackSwaps();

  } catch (error) {
    console.error("Error starting bot:", error);
  }
})();
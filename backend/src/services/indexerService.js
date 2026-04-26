import { EventEmitter } from "node:events";
import { ethers } from "ethers";
import { env } from "../config/env.js";
import { getProvider, getWsProvider, listSupportedChains } from "./providerService.js";

const vaultAbi = [
  "event TxRequested(uint256 indexed txId,address indexed proposer,address indexed to,address token,uint256 amount)",
  "event TxExecuted(uint256 indexed txId,address indexed executor)",
  "event Deposit(address indexed from,address indexed token,uint256 amount)"
];

const historyCache = new Map();
const eventBus = new EventEmitter();
let realtimeStarted = false;

function getContract(chain, useWs = false) {
  const provider = useWs ? getWsProvider(chain) : getProvider(chain);
  if (!provider) {
    return null;
  }
  return new ethers.Contract(env.VAULT_ADDRESS, vaultAbi, provider);
}

function publish(event) {
  const cached = historyCache.get(event.chain) || {
    updatedAt: Date.now(),
    txHistory: [],
    deposits: []
  };

  if (event.eventType === "TxRequested") {
    cached.txHistory.unshift({
      chain: event.chain,
      txId: event.txId,
      proposer: event.proposer,
      to: event.to,
      token: event.token,
      amount: event.amount,
      status: "pending",
      hash: event.hash,
      blockNumber: event.blockNumber
    });
  }

  if (event.eventType === "TxExecuted") {
    const target = cached.txHistory.find((tx) => tx.txId === event.txId);
    if (target) {
      target.status = "executed";
      target.hash = event.hash;
      target.blockNumber = event.blockNumber;
    }
  }

  if (event.eventType === "Deposit") {
    cached.deposits.unshift({
      chain: event.chain,
      from: event.from,
      token: event.token,
      amount: event.amount,
      hash: event.hash,
      blockNumber: event.blockNumber,
      type: "deposit"
    });
  }

  cached.updatedAt = Date.now();
  historyCache.set(event.chain, cached);
  eventBus.emit("vault-event", event);
}

export async function refreshChainHistory(chain) {
  const contract = getContract(chain, false);
  if (!contract) {
    return;
  }

  const [requestedLogs, executedLogs, depositLogs] = await Promise.all([
    contract.queryFilter(contract.filters.TxRequested(), -5000),
    contract.queryFilter(contract.filters.TxExecuted(), -5000),
    contract.queryFilter(contract.filters.Deposit(), -5000)
  ]);

  const executedIds = new Set(executedLogs.map((log) => Number(log.args.txId)));

  const txHistory = requestedLogs.map((log) => ({
    chain,
    txId: Number(log.args.txId),
    proposer: log.args.proposer,
    to: log.args.to,
    token: log.args.token,
    amount: log.args.amount.toString(),
    status: executedIds.has(Number(log.args.txId)) ? "executed" : "pending",
    hash: log.transactionHash,
    blockNumber: log.blockNumber
  }));

  const deposits = depositLogs.map((log) => ({
    chain,
    from: log.args.from,
    token: log.args.token,
    amount: log.args.amount.toString(),
    hash: log.transactionHash,
    blockNumber: log.blockNumber,
    type: "deposit"
  }));

  historyCache.set(chain, {
    updatedAt: Date.now(),
    txHistory,
    deposits
  });
}

export async function startRealtimeIndexer(onEvent) {
  if (realtimeStarted) {
    return;
  }

  realtimeStarted = true;

  for (const chain of listSupportedChains()) {
    await refreshChainHistory(chain);

    const wsContract = getContract(chain, true);
    if (!wsContract) {
      console.warn(`Realtime websocket indexer disabled for ${chain} because WS URL is missing.`);
      continue;
    }

    wsContract.on("TxRequested", (txId, proposer, to, token, amount, event) => {
      const payload = {
        eventType: "TxRequested",
        chain,
        txId: Number(txId),
        proposer,
        to,
        token,
        amount: amount.toString(),
        hash: event.log.transactionHash,
        blockNumber: event.log.blockNumber
      };
      publish(payload);
      onEvent(payload);
    });

    wsContract.on("TxExecuted", (txId, executor, event) => {
      const payload = {
        eventType: "TxExecuted",
        chain,
        txId: Number(txId),
        executor,
        hash: event.log.transactionHash,
        blockNumber: event.log.blockNumber
      };
      publish(payload);
      onEvent(payload);
    });

    wsContract.on("Deposit", (from, token, amount, event) => {
      const payload = {
        eventType: "Deposit",
        chain,
        from,
        token,
        amount: amount.toString(),
        hash: event.log.transactionHash,
        blockNumber: event.log.blockNumber
      };
      publish(payload);
      onEvent(payload);
    });
  }
}

export async function getTransactionHistory(address, chain) {
  const normalizedAddress = ethers.getAddress(address);
  const selectedChain = (chain || "ethereum").toLowerCase();

  if (!listSupportedChains().includes(selectedChain)) {
    throw new Error("Unsupported chain");
  }

  const cached = historyCache.get(selectedChain);
  if (!cached) {
    await refreshChainHistory(selectedChain);
  }

  const latest = historyCache.get(selectedChain) || { txHistory: [], deposits: [] };

  const transactions = latest.txHistory.filter(
    (tx) =>
      ethers.getAddress(tx.proposer) === normalizedAddress ||
      ethers.getAddress(tx.to) === normalizedAddress
  );

  const userDeposits = latest.deposits.filter((deposit) => ethers.getAddress(deposit.from) === normalizedAddress);

  return [...transactions, ...userDeposits].sort((a, b) => b.blockNumber - a.blockNumber);
}

export function subscribeToIndexerEvents(listener) {
  eventBus.on("vault-event", listener);
  return () => eventBus.off("vault-event", listener);
}

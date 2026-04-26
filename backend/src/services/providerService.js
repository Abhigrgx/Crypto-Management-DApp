import { ethers } from "ethers";
import { env } from "../config/env.js";

const providerMap = {
  ethereum: new ethers.JsonRpcProvider(env.RPC_ETHEREUM),
  polygon: new ethers.JsonRpcProvider(env.RPC_POLYGON)
};

const wsProviderMap = {
  ethereum: env.WS_ETHEREUM ? new ethers.WebSocketProvider(env.WS_ETHEREUM) : null,
  polygon: env.WS_POLYGON ? new ethers.WebSocketProvider(env.WS_POLYGON) : null
};

export function getProvider(chain) {
  const key = (chain || "ethereum").toLowerCase();
  if (!providerMap[key]) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  return providerMap[key];
}

export function listSupportedChains() {
  return Object.keys(providerMap);
}

export function getWsProvider(chain) {
  const key = (chain || "ethereum").toLowerCase();
  if (!Object.hasOwn(wsProviderMap, key)) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  return wsProviderMap[key];
}

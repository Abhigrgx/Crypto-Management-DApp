import axios from "axios";
import { ethers } from "ethers";
import { env } from "../config/env.js";
import { getProvider } from "./providerService.js";

const erc20Abi = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const priceMap = {
  ETH: "ethereum",
  MATIC: "matic-network"
};

async function fetchPrice(coinId) {
  const response = await axios.get(`${env.COINGECKO_API}/simple/price`, {
    params: {
      ids: coinId,
      vs_currencies: "usd"
    }
  });

  return response.data[coinId]?.usd || 0;
}

export async function getPortfolio(address, chain, tokenAddresses = []) {
  const provider = getProvider(chain);
  const normalizedAddress = ethers.getAddress(address);

  const nativeBalance = await provider.getBalance(normalizedAddress);
  const nativeSymbol = chain === "polygon" ? "MATIC" : "ETH";
  const nativePrice = await fetchPrice(priceMap[nativeSymbol]);
  const nativeBalanceFloat = Number(ethers.formatEther(nativeBalance));

  const tokenData = await Promise.all(
    tokenAddresses.map(async (tokenAddress) => {
      const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
      const [balance, decimals, symbol] = await Promise.all([
        contract.balanceOf(normalizedAddress),
        contract.decimals(),
        contract.symbol()
      ]);

      // In production, map all symbols to canonical IDs and include a fallback oracle.
      const coinId = priceMap[symbol] || "ethereum";
      const price = await fetchPrice(coinId);
      const amount = Number(ethers.formatUnits(balance, decimals));

      return {
        token: tokenAddress,
        symbol,
        amount,
        priceUsd: price,
        valueUsd: amount * price
      };
    })
  );

  const positions = [
    {
      token: "native",
      symbol: nativeSymbol,
      amount: nativeBalanceFloat,
      priceUsd: nativePrice,
      valueUsd: nativeBalanceFloat * nativePrice
    },
    ...tokenData
  ];

  const totalValue = positions.reduce((sum, asset) => sum + asset.valueUsd, 0);

  return {
    chain,
    wallet: normalizedAddress,
    positions,
    analytics: {
      totalValueUsd: totalValue,
      diversificationScore: positions.length > 0 ? Math.min(100, positions.length * 18) : 0,
      // Demo approximation for dashboard trend display.
      estimated24hPnlUsd: totalValue * 0.0125
    }
  };
}

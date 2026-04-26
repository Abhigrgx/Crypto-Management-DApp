import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";

const vaultAbi = [
  "function createTxRequest(address to,address token,uint256 amount,bytes data)",
  "function approveTx(uint256 txId)",
  "function executeTx(uint256 txId)",
  "function txCount() view returns (uint256)"
];

const NETWORKS = {
  ethereum: {
    chainIdHex: "0xaa36a7",
    chainName: "Sepolia"
  },
  polygon: {
    chainIdHex: "0x13882",
    chainName: "Polygon Amoy"
  }
};

export function useWallet() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [provider, setProvider] = useState(null);

  const selectedChain = useMemo(() => {
    if (chainId === NETWORKS.polygon.chainIdHex) {
      return "polygon";
    }
    return "ethereum";
  }, [chainId]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask is required.");
    }

    const browserProvider = new BrowserProvider(window.ethereum);
    const accounts = await browserProvider.send("eth_requestAccounts", []);
    const network = await browserProvider.getNetwork();

    setProvider(browserProvider);
    setAccount(accounts[0] || "");
    setChainId(`0x${network.chainId.toString(16)}`);

    return accounts[0];
  }, []);

  const switchNetwork = useCallback(async (target) => {
    const networkConfig = NETWORKS[target];
    if (!networkConfig) {
      throw new Error("Unsupported network selection");
    }

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: networkConfig.chainIdHex }]
    });
  }, []);

  const sendTransferRequest = useCallback(
    async ({ to, amountEth }) => {
      if (!provider || !account) {
        throw new Error("Connect wallet first");
      }

      const signer = await provider.getSigner();
      const contract = new Contract(import.meta.env.VITE_VAULT_ADDRESS, vaultAbi, signer);
      const tx = await contract.createTxRequest(to, ethers.ZeroAddress, ethers.parseEther(amountEth), "0x");
      await tx.wait();
    },
    [provider, account]
  );

  useEffect(() => {
    if (!window.ethereum) {
      return;
    }

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || "");
    };

    const handleChainChanged = (nextChainId) => {
      setChainId(nextChainId);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  return {
    account,
    chainId,
    selectedChain,
    connectWallet,
    switchNetwork,
    sendTransferRequest
  };
}

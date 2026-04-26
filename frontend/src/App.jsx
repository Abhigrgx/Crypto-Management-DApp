import { useEffect, useMemo, useState } from "react";
import PortfolioChart from "./components/PortfolioChart";
import ReceivePanel from "./components/ReceivePanel";
import SendPanel from "./components/SendPanel";
import StatCard from "./components/StatCard";
import TransactionTable from "./components/TransactionTable";
import { useWallet } from "./hooks/useWallet";
import {
  getBalances,
  getPortfolio,
  getSiweNonce,
  getTransactions,
  refreshAccessToken,
  setAuthToken,
  verifySiweSignature
} from "./services/api";

export default function App() {
  const { account, selectedChain, connectWallet, switchNetwork, sendTransferRequest } = useWallet();
  const [jwt, setJwt] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [portfolio, setPortfolio] = useState({ positions: [], analytics: { totalValueUsd: 0, estimated24hPnlUsd: 0 } });
  const [history, setHistory] = useState([]);
  const [nativeBalance, setNativeBalance] = useState("0");
  const [notice, setNotice] = useState("Connect wallet to start.");

  const isConnected = Boolean(account);

  const stats = useMemo(
    () => [
      {
        title: "Portfolio Value",
        value: `$${portfolio.analytics.totalValueUsd.toFixed(2)}`,
        helper: "Calculated from on-chain balances + market prices"
      },
      {
        title: "24h Estimated P/L",
        value: `$${portfolio.analytics.estimated24hPnlUsd.toFixed(2)}`,
        helper: "Heuristic trend estimate for demo analytics"
      },
      {
        title: "Native Balance (Wei)",
        value: nativeBalance,
        helper: `${selectedChain.toUpperCase()} network`
      }
    ],
    [portfolio, nativeBalance, selectedChain]
  );

  async function authenticate(address) {
    const chainIdNumber = selectedChain === "polygon" ? 80002 : 11155111;
    const { message } = await getSiweNonce(address, chainIdNumber);
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [message, address]
    });

    const auth = await verifySiweSignature(message, signature);
    setAuthToken(auth.accessToken);
    setJwt(auth.accessToken);
    setRefreshToken(auth.refreshToken);
    localStorage.setItem("cryptovault.refresh", auth.refreshToken);
  }

  async function rotateAccessToken() {
    const storedRefresh = refreshToken || localStorage.getItem("cryptovault.refresh");
    if (!storedRefresh) {
      throw new Error("Session expired. Connect wallet again.");
    }

    const auth = await refreshAccessToken(storedRefresh);
    setAuthToken(auth.accessToken);
    setJwt(auth.accessToken);
    setRefreshToken(auth.refreshToken);
    localStorage.setItem("cryptovault.refresh", auth.refreshToken);
  }

  async function refreshData(address = account) {
    if (!address || !jwt) {
      return;
    }

    try {
      const [balanceData, historyData, portfolioData] = await Promise.all([
        getBalances(address, selectedChain),
        getTransactions(address, selectedChain),
        getPortfolio(address, selectedChain)
      ]);

      setNativeBalance(balanceData.nativeBalanceWei);
      setHistory(historyData.history || []);
      setPortfolio(portfolioData);
    } catch (error) {
      if (error?.response?.status === 401) {
        await rotateAccessToken();
        return refreshData(address);
      }
      throw error;
    }
  }

  const connect = async () => {
    try {
      const address = await connectWallet();
      await authenticate(address);
      setNotice("Wallet authenticated.");
    } catch (error) {
      setNotice(error.message);
    }
  };

  const onSend = async (payload) => {
    try {
      await sendTransferRequest(payload);
      setNotice("Transfer request submitted for multisig approvals.");
      await refreshData();
    } catch (error) {
      setNotice(error.message);
    }
  };

  useEffect(() => {
    refreshData().catch((error) => {
      setNotice(error.message);
    });
  }, [jwt, selectedChain]);

  useEffect(() => {
    if (!jwt || !account) {
      return;
    }

    const derivedWsUrl =
      import.meta.env.VITE_WS_URL ||
      (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace("http", "ws").replace("/api", "/ws");

    const socket = new WebSocket(derivedWsUrl);

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.chain && payload.chain !== selectedChain) {
        return;
      }

      if (payload.eventType === "TxRequested" || payload.eventType === "TxExecuted" || payload.eventType === "Deposit") {
        refreshData().catch(() => {});
      }
    };

    return () => {
      socket.close();
    };
  }, [jwt, account, selectedChain]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">CryptoVault</p>
          <h1>Institutional-grade crypto management for modern treasury teams.</h1>
          <p className="lead">
            Multi-signature approvals, daily limits, recurring payments, and analytics in one secure DApp experience.
          </p>
        </div>
        <div className="hero-actions">
          <button onClick={connect}>{isConnected ? "Connected" : "Connect MetaMask"}</button>
          <button className="ghost" onClick={() => switchNetwork("ethereum")}>
            Ethereum
          </button>
          <button className="ghost" onClick={() => switchNetwork("polygon")}>
            Polygon
          </button>
        </div>
      </section>

      <p className="notice">{notice}</p>

      <section className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.title} title={stat.title} value={stat.value} helper={stat.helper} />
        ))}
      </section>

      <section className="content-grid">
        <PortfolioChart positions={portfolio.positions || []} />
        <SendPanel onSend={onSend} />
        <ReceivePanel address={account} />
      </section>

      <TransactionTable history={history} />
    </main>
  );
}

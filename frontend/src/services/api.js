import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api"
});

export function setAuthToken(token) {
  api.defaults.headers.common.Authorization = token ? `Bearer ${token}` : "";
}

export async function getSiweNonce(address, chainId) {
  const { data } = await api.post("/auth/siwe/nonce", { address, chainId });
  return data;
}

export async function verifySiweSignature(message, signature) {
  const { data } = await api.post("/auth/siwe/verify", { message, signature });
  return data;
}

export async function refreshAccessToken(refreshToken) {
  const { data } = await api.post("/auth/refresh", { refreshToken });
  return data;
}

export async function logout(refreshToken) {
  const { data } = await api.post("/auth/logout", { refreshToken });
  return data;
}

export async function getBalances(address, chain) {
  const { data } = await api.get(`/wallet/${address}/balances`, { params: { chain } });
  return data;
}

export async function getTransactions(address, chain) {
  const { data } = await api.get(`/wallet/${address}/transactions`, { params: { chain } });
  return data;
}

export async function getPortfolio(address, chain, tokens = []) {
  const { data } = await api.get(`/portfolio/${address}`, {
    params: {
      chain,
      tokens: tokens.join(",")
    }
  });
  return data;
}

import { expect, test } from "@playwright/test";

test("connects wallet and renders dashboard data", async ({ page }) => {
  const walletAddress = "0x1111111111111111111111111111111111111111";

  await page.addInitScript((address) => {
    window.ethereum = {
      request: async ({ method }) => {
        if (method === "eth_requestAccounts") {
          return [address];
        }
        if (method === "eth_accounts") {
          return [address];
        }
        if (method === "eth_chainId") {
          return "0xaa36a7";
        }
        if (method === "personal_sign") {
          return "0xsigned";
        }
        if (method === "wallet_switchEthereumChain") {
          return null;
        }
        return null;
      },
      on: () => {},
      removeListener: () => {}
    };
  }, walletAddress);

  await page.route("**/api/auth/siwe/nonce", async (route) => {
    await route.fulfill({ json: { nonce: "abc123", message: "siwe-message" } });
  });

  await page.route("**/api/auth/siwe/verify", async (route) => {
    await route.fulfill({
      json: {
        accessToken: "access-token",
        refreshToken: "refresh-token"
      }
    });
  });

  await page.route("**/api/wallet/**/balances**", async (route) => {
    await route.fulfill({
      json: {
        nativeBalanceWei: "1000000000000000000"
      }
    });
  });

  await page.route("**/api/wallet/**/transactions**", async (route) => {
    await route.fulfill({
      json: {
        history: [
          {
            type: "transfer",
            amount: "100000000000000000",
            status: "pending",
            blockNumber: 123,
            hash: "0xabcdefabcdefabcdef"
          }
        ]
      }
    });
  });

  await page.route("**/api/portfolio/**", async (route) => {
    await route.fulfill({
      json: {
        positions: [
          {
            symbol: "ETH",
            valueUsd: 1500
          }
        ],
        analytics: {
          totalValueUsd: 1500,
          estimated24hPnlUsd: 20
        }
      }
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Connect MetaMask" }).click();

  await expect(page.getByText("Wallet authenticated.")).toBeVisible();
  await expect(page.getByText("Portfolio Value")).toBeVisible();
  await expect(page.getByText("24h Estimated P/L")).toBeVisible();
  await expect(page.getByText("Transaction History")).toBeVisible();
});

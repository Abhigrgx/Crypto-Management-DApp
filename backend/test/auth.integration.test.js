import request from "supertest";
import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("SIWE auth integration", () => {
  it("authenticates, rotates refresh tokens, and revokes sessions", async () => {
    const wallet = Wallet.createRandom();

    const nonceResponse = await request(app).post("/api/auth/siwe/nonce").send({
      address: wallet.address,
      chainId: 1
    });

    expect(nonceResponse.status).toBe(200);
    expect(nonceResponse.body.message).toContain(wallet.address);

    const signature = await wallet.signMessage(nonceResponse.body.message);

    const verifyResponse = await request(app).post("/api/auth/siwe/verify").send({
      message: nonceResponse.body.message,
      signature
    });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.accessToken).toBeTruthy();
    expect(verifyResponse.body.refreshToken).toBeTruthy();

    const firstRefreshToken = verifyResponse.body.refreshToken;

    const refreshResponse = await request(app).post("/api/auth/refresh").send({
      refreshToken: firstRefreshToken
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.refreshToken).not.toEqual(firstRefreshToken);

    const replayAttempt = await request(app).post("/api/auth/refresh").send({
      refreshToken: firstRefreshToken
    });

    expect(replayAttempt.status).toBe(401);

    const logoutResponse = await request(app).post("/api/auth/logout").send({
      refreshToken: refreshResponse.body.refreshToken
    });

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.revoked).toBe(true);

    const postLogoutAttempt = await request(app).post("/api/auth/refresh").send({
      refreshToken: refreshResponse.body.refreshToken
    });

    expect(postLogoutAttempt.status).toBe(401);
  });
});

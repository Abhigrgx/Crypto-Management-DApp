import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import app from "./app.js";
import { env } from "./config/env.js";
import { startRealtimeIndexer } from "./services/indexerService.js";
import { broadcastIndexerEvent, registerClient } from "./services/websocketGateway.js";

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws) => {
  registerClient(ws);
  ws.send(
    JSON.stringify({
      type: "connection_ack",
      service: "cryptovault-realtime"
    })
  );
});

startRealtimeIndexer((event) => {
  broadcastIndexerEvent(event);
}).catch((error) => {
  console.error("Failed to start realtime indexer", error);
});

httpServer.listen(Number(env.PORT), "0.0.0.0", () => {
  console.log(`CryptoVault backend listening on port ${env.PORT}`);
});

const clients = new Set();

export function registerClient(ws) {
  clients.add(ws);
  ws.on("close", () => {
    clients.delete(ws);
  });
}

export function broadcastIndexerEvent(payload) {
  const message = JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

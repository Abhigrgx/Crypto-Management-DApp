# Frontend Component Structure

- `src/App.jsx`
  - App shell, auth flow, data refresh orchestration.
- `src/hooks/useWallet.js`
  - MetaMask connection, chain switching, contract call helpers.
- `src/services/api.js`
  - REST client and JWT header handling.
- `src/components/StatCard.jsx`
  - KPI cards.
- `src/components/PortfolioChart.jsx`
  - Asset distribution chart.
- `src/components/SendPanel.jsx`
  - Transaction request creation UI.
- `src/components/ReceivePanel.jsx`
  - QR code and address receive view.
- `src/components/TransactionTable.jsx`
  - Indexed transaction table.

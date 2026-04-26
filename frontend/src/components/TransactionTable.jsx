export default function TransactionTable({ history }) {
  return (
    <section className="panel table-panel">
      <header className="panel-header">
        <h3>Transaction History</h3>
      </header>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Block</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5}>No transactions indexed yet.</td>
              </tr>
            ) : (
              history.map((item) => (
                <tr key={`${item.hash}-${item.blockNumber}`}>
                  <td>{item.type || "transfer"}</td>
                  <td>{item.amount}</td>
                  <td>{item.status || "confirmed"}</td>
                  <td>{item.blockNumber}</td>
                  <td>
                    <span className="mono">{item.hash.slice(0, 10)}...</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

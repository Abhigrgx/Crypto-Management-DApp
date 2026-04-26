import { useState } from "react";

export default function SendPanel({ onSend }) {
  const [to, setTo] = useState("");
  const [amountEth, setAmountEth] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      await onSend({ to, amountEth });
      setTo("");
      setAmountEth("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel form-panel">
      <header className="panel-header">
        <h3>Send Crypto</h3>
      </header>
      <form onSubmit={submit} className="stack-form">
        <label>
          Recipient Address
          <input
            type="text"
            required
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="0x..."
          />
        </label>
        <label>
          Amount (ETH/MATIC)
          <input
            type="number"
            step="0.0001"
            required
            value={amountEth}
            onChange={(event) => setAmountEth(event.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Create Multisig Request"}
        </button>
      </form>
    </section>
  );
}

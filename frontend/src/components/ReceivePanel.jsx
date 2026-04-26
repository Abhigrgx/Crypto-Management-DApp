import { QRCodeSVG } from "qrcode.react";

export default function ReceivePanel({ address }) {
  return (
    <section className="panel receive-panel">
      <header className="panel-header">
        <h3>Receive</h3>
      </header>
      {address ? (
        <div className="receive-wrap">
          <QRCodeSVG value={address} size={150} bgColor="#f5f6eb" fgColor="#0f1b2b" />
          <p className="mono">{address}</p>
        </div>
      ) : (
        <p>Connect a wallet to generate your receive QR code.</p>
      )}
    </section>
  );
}

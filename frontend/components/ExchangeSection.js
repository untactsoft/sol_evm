import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function ExchangeSection({ walletAddress, points, refreshPoints }) {
  const [amount, setAmount] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);

  // Exchange points to token
  const exchangePoints = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      alert("Enter a valid amount to exchange!");
      return;
    }
    setIsExchanging(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, amount }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Sent ${amount} token(s) successfully!`);
        refreshPoints();
        setAmount("");
      } else {
        alert(data.message || "Exchange failed");
      }
    } catch (err) {
      console.error("Exchange request failed:", err);
      alert("Error occurred during exchange request");
    }
    setIsExchanging(false);
  };

  return (
    <div>
      <h3>💰 Points → Token Exchange</h3>
      <input
        placeholder="Amount to exchange (e.g. 1)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      /><br />
      <button onClick={exchangePoints} disabled={isExchanging}>
        {isExchanging ? "Exchanging..." : "Exchange"}
      </button>
      {points !== null && <p>Current Points: {points}</p>}
    </div>
  );
}
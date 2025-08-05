import { useEffect, useState } from "react";
import * as web3 from "@solana/web3.js";
import * as spl from "@solana/spl-token";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const SOLANA_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || "https://api.devnet.solana.com";

export default function PollDetail({ id }) {
  const [poll, setPoll] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [voterTokenAccount, setVoterTokenAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  // Fetch poll details from backend
  const fetchPoll = async () => {
    const res = await fetch(`${API_BASE_URL}/api/polls`);
    const data = await res.json();
    const found = data.polls.find(p => p.pubkey.toLowerCase() === id.toLowerCase());
    if (found) {
      setPoll(found);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchPoll();
  }, [id]);

  // Connect Phantom wallet and get associated token account
  const connectWallet = async () => {
    if (window.solana && window.solana.isPhantom) {
      const resp = await window.solana.connect();
      const pubKey = resp.publicKey.toString();
      setWalletAddress(pubKey);
      if (poll?.requiredMint) {
        const ata = await spl.getAssociatedTokenAddress(
          new web3.PublicKey(poll.requiredMint),
          new web3.PublicKey(pubKey)
        );
        setVoterTokenAccount(ata.toBase58());
      }
    } else {
      alert("Please install Phantom wallet!");
    }
  };

  // Handle voting for a candidate
  const handleVote = async (candidateIndex) => {
    if (!amount) return alert("Please enter an amount!");
    setIsVoting(true);
    const payload = {
      pollPubkey: id,
      candidateIndex,
      amount: BigInt(Number(amount) * 1e9).toString(),
      requiredMint: poll.requiredMint,
      voterAddress: walletAddress,
    };
    const res = await fetch(`${API_BASE_URL}/api/vote-tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.tx) {
      alert("Failed to create transaction");
      setIsVoting(false);
      return;
    }
    const connection = new web3.Connection(SOLANA_CLUSTER);
    const recoveredTx = web3.Transaction.from(Buffer.from(data.tx, "base64"));
    const signedTx = await window.solana.signTransaction(recoveredTx);
    const sig = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    alert("Vote complete! Tx: " + sig);
    fetchPoll();
    setIsVoting(false);
  };

  if (loading) return <div>Loading poll...</div>;
  if (!poll) return <div>Poll not found.</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>{poll.title}</h2>
      <p>Deadline: {new Date(poll.deadline * 1000).toLocaleString()}</p>
      <p>Required TokenMintId: {poll.requiredMint}</p>
      {!walletAddress ? (
        <button onClick={connectWallet}>Connect Phantom Wallet</button>
      ) : (
        <>
          <p>Connected Wallet: <strong>{walletAddress}</strong></p>
          <p>TokenAccount: {voterTokenAccount}</p>
        </>
      )}
      <input
        placeholder="Amount to vote"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      /><br />
      <h3>Candidate List</h3>
      {poll.candidates.map((c, idx) => (
        <div key={idx}>
          <span>{c} (Votes: {(poll.votes[idx] / 1e9).toFixed(2)})</span>
          {walletAddress && (
            <button onClick={() => handleVote(idx)} disabled={isVoting}>
              {isVoting ? "Voting..." : "Vote"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
import { useEffect, useState } from "react";
import Link from "next/link";
import * as web3 from "@solana/web3.js";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const SOLANA_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER_URL || "https://api.devnet.solana.com";
const TOKEN_PROGRAM_ID = process.env.NEXT_PUBLIC_TOKEN_PROGRAM_ID || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_MINT_ID = process.env.NEXT_PUBLIC_TOKEN_MINT_ID || "CKiHhNMtcrWMcc76JZCqUE6H6yXADfJFz4aqiYgHgG1o";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [points, setPoints] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [polls, setPolls] = useState([]);
  const [amount, setAmount] = useState("");
  // 의제 생성 관련 상태
  const [title, setTitle] = useState("");
  const [candidates, setCandidates] = useState("");
  const [deadline, setDeadline] = useState("");
  const [mint, setMint] = useState(TOKEN_MINT_ID);
  // 로딩 상태
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  const [isCheckingPoints, setIsCheckingPoints] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);

  // Phantom 지갑 연결
  const connectWallet = async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        const resp = await window.solana.connect();
        const address = resp.publicKey.toString();
        setWalletAddress(address);
        fetchPoints(address);
        fetchTokens(address);
      } catch (err) {
        console.error(err);
        alert("Failed to connect wallet");
      }
    } else {
      alert("Please install Phantom wallet!");
    }
  };

  // 백엔드에서 사용자 포인트 조회
  const fetchPoints = async (address) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/point/${address}`);
      if (!res.ok) {
        alert("Failed to fetch points");
        return;
      }
      const data = await res.json();
      setPoints(data.points);
    } catch (err) {
      console.error("Failed to fetch points:", err);
      alert("Error occurred while fetching points.");
    }
  };

  // 사용자의 SPL 토큰 조회
  const fetchTokens = async (publicKey) => {
    try {
      const connection = new web3.Connection(SOLANA_CLUSTER);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new web3.PublicKey(publicKey),
        { programId: new web3.PublicKey(TOKEN_PROGRAM_ID) }
      );
      const parsedTokens = tokenAccounts.value.map((account) => {
        const info = account.account.data.parsed.info;
        const mint = info.mint;
        const amount = info.tokenAmount.uiAmount;
        return { mint, amount };
      });
      setTokens(parsedTokens);
    } catch (err) {
      console.error("Failed to fetch token list:", err);
    }
  };

  // 의제 목록 조회
  const fetchPolls = async () => {
    setIsLoadingPolls(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/polls`);
      const data = await res.json();
      setPolls(Array.isArray(data.polls) ? data.polls : []);
    } catch (err) {
      console.error("Failed to fetch poll list:", err);
      setPolls([]); // 에러 시에도 빈 배열로
    }
    setIsLoadingPolls(false);
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  // 연결된 지갑의 포인트 조회
  const checkPoints = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    setIsCheckingPoints(true);
    await fetchPoints(walletAddress);
    setIsCheckingPoints(false);
  };

  // 포인트를 토큰으로 교환
  const exchangePoints = async () => {
    if (!walletAddress) return alert("Please connect your wallet first");
    if (!amount || isNaN(amount) || Number(amount) <= 0) return alert("Enter a valid amount!");
    setIsExchanging(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, amount }),
      });
      const data = await res.json();
      alert(data.message);
      setPoints(data.remainingPoints);
      setAmount("");
      fetchTokens(walletAddress);
    } catch (err) {
      console.error(err);
      alert("Exchange failed");
    }
    setIsExchanging(false);
  };

  // 새로운 의제 생성
  const createPoll = async () => {
    if (!title || !candidates || !deadline || !mint) {
      alert("Please fill in all fields!");
      return;
    }
    setIsCreatingPoll(true);
    const candidateArray = candidates.split(",").map((c) => c.trim()).filter(Boolean);
    const unixDeadline = Math.floor(new Date(deadline).getTime() / 1000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          candidates: candidateArray,
          deadline: unixDeadline,
          requiredMint: mint,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Poll created!\nPubkey: ${data.pollPubkey}`);
        fetchPolls();
        setTitle("");
        setCandidates("");
        setDeadline("");
        setMint("");
      } else {
        alert(`Failed to create poll: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create poll");
    }
    setIsCreatingPoll(false);
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
      <h1>Main Page 🌟</h1>
      {!walletAddress ? (
        <button onClick={connectWallet}>Connect Phantom Wallet</button>
      ) : (
        <p>Connected Wallet: {walletAddress}</p>
      )}
      {tokens.length > 0 && (
        <div>
          <h3>🪙 Token List</h3>
          <ul>
            {tokens.map((token, idx) => (
              <li key={idx}>
                Mint: {token.mint} — Amount: {token.amount}
              </li>
            ))}
          </ul>
        </div>
      )}
      <hr />
      <h2>💰 Check & Exchange Points</h2>
      <button onClick={checkPoints} disabled={isCheckingPoints || isExchanging}>
        {isCheckingPoints ? "Checking..." : "Check Points"}
      </button>
      <br />
      <input
        placeholder="Amount to exchange (e.g. 1)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ marginRight: 8 }}
      />
      <button onClick={exchangePoints} disabled={isExchanging || isCheckingPoints}>
        {isExchanging ? "Exchanging..." : "Points → Token Exchange"}
      </button>
      {points !== null && <p>Current Points: {points}</p>}
      <hr />
      <h2>Poll List</h2>
      {isLoadingPolls ? (
        <p>Loading poll list...</p>
      ) : Array.isArray(polls) && polls.length === 0 ? (
        <p>No polls found.</p>
      ) : (
        <ul>
          {Array.isArray(polls) && polls.map((poll) => (
            <li key={poll.pubkey}>
              <Link href={`/poll/${poll.pubkey}`}>
                {poll.title} — Deadline: {new Date(poll.deadline * 1000).toLocaleString()}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <hr />
      <h2>Create Poll</h2>
      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Poll Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <input
          placeholder="Candidates (comma separated)"
          value={candidates}
          onChange={(e) => setCandidates(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <input
          placeholder="Required Mint Address"
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <button onClick={createPoll} disabled={isCreatingPoll}>
          {isCreatingPoll ? "Creating..." : "Create Poll"}
        </button>
      </div>
    </div>
  );
}
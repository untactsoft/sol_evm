const express = require('express');
const redis = require('redis');
const anchor = require('@coral-xyz/anchor');
const web3 = require('@solana/web3.js');
const spl = require('@solana/spl-token');
const fs = require('fs');
const cors = require('cors');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redisClient.connect();

const solanaCluster = process.env.SOLANA_CLUSTER_URL || anchor.web3.clusterApiUrl('devnet');
const connection = new anchor.web3.Connection(solanaCluster);
const idl = JSON.parse(fs.readFileSync('./idl.json', 'utf8'));
const programId = new web3.PublicKey(process.env.PROGRAM_ID);

const walletKey = JSON.parse(fs.readFileSync(process.env.KEYPAIR_PATH, 'utf8'));
const wallet = web3.Keypair.fromSecretKey(Uint8Array.from(walletKey));

const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
anchor.setProvider(provider);
const program = new anchor.Program(idl, programId, provider);

// 서버의 특정 mint에 대한 연관 토큰 계정(Associated Token Account) 조회
async function getServerVoterTokenAccount(mintAddress) {
  const mintPubkey = new web3.PublicKey(mintAddress);
  const ata = await spl.getAssociatedTokenAddress(
    mintPubkey,
    wallet.publicKey
  );
  return ata;
}

// 사용자 포인트 조회 또는 초기화
app.get('/api/point/:wallet', async (req, res) => {
  let points = await redisClient.get(req.params.wallet);
  if (!points) {
    points = 1000;
    await redisClient.set(req.params.wallet, points);
  }
  res.json({ points });
});

// 포인트를 토큰으로 교환
app.post('/api/exchange', async (req, res) => {
  const { walletAddress, amount } = req.body;
  if (!walletAddress || !amount) {
    return res.status(400).json({ message: "Please provide both walletAddress and amount" });
  }
  const exchangeAmount = parseInt(amount);
  if (isNaN(exchangeAmount) || exchangeAmount <= 0) {
    return res.status(400).json({ message: "Invalid amount value" });
  }
  let points = await redisClient.get(walletAddress);
  if (!points) points = 1000;
  points = parseInt(points);
  const cost = exchangeAmount; // 1:1 ratio
  if (points < cost) {
    return res.status(400).json({ message: "Insufficient points" });
  }
  await redisClient.set(walletAddress, points - cost);
  try {
    const mintPubkey = new web3.PublicKey(process.env.TOKEN_MINT_ADDRESS);
    // 서버 연관 토큰 계정(Associated Token Account)
    const serverATA = await spl.getAssociatedTokenAddress(
      mintPubkey,
      wallet.publicKey
    );
    // 사용자 연관 토큰 계정(Associated Token Account)
    const userPubkey = new web3.PublicKey(walletAddress);
    const userATA = await spl.getAssociatedTokenAddress(
      mintPubkey,
      userPubkey
    );
    const instructions = [];
    const userATAInfo = await connection.getAccountInfo(userATA);
    if (!userATAInfo) {
      const createATAIx = spl.createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        userATA,
        userPubkey,
        mintPubkey
      );
      instructions.push(createATAIx);
    }
    const transferIx = spl.createTransferInstruction(
      serverATA,
      userATA,
      wallet.publicKey,
      exchangeAmount * 1e9
    );
    instructions.push(transferIx);
    const tx = new web3.Transaction().add(...instructions);
    const signature = await web3.sendAndConfirmTransaction(connection, tx, [wallet]);
    console.log("✅ Token transfer complete:", signature);
    return res.json({
      message: `${exchangeAmount} token(s) transferred successfully`,
      txSignature: signature,
      remainingPoints: points - cost,
    });
  } catch (err) {
    console.error("Token transfer failed:", err.stack || err);
    return res.status(500).json({ message: "Token transfer failed", error: err.message });
  }
});

// 모든 활성화된 의제 조회
app.get('/api/polls', async (req, res) => {
  try {
    const polls = await program.account.poll.all();
    const activePolls = polls.filter(p => !p.account.isClosed);
    const parsedPolls = activePolls.map(p => ({
      pubkey: p.publicKey.toBase58(),
      title: p.account.title,
      candidates: p.account.candidates,
      votes: p.account.votes.map(v => v.toNumber()),
      owner: p.account.owner.toBase58(),
      deadline: p.account.deadline.toNumber(),
      requiredMint: p.account.requiredMint.toBase58(),
    }));
    res.json({ polls: parsedPolls });
  } catch (err) {
    console.error("Failed to fetch polls:", err.stack || err);
    res.status(500).json({ message: "Failed to fetch polls", error: err.message });
  }
});

// 새로운 의제 생성
app.post('/api/poll', async (req, res) => {
  const { title, candidates, deadline, requiredMint } = req.body;
  try {
    const poll = web3.Keypair.generate();
    await program.methods
      .createPoll(title, candidates, new anchor.BN(deadline), new web3.PublicKey(requiredMint))
      .accounts({
        poll: poll.publicKey,
        authority: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([poll])
      .rpc();
    res.json({ message: 'Poll created successfully', pollPubkey: poll.publicKey.toBase58() });
  } catch (err) {
    console.error("Failed to create poll:", err.stack || err);
    res.status(500).json({ message: "Failed to create poll", error: err.message });
  }
});

// 사용자 서명을 위한 트랜잭션 생성(투표)
app.post('/api/vote-tx', async (req, res) => {
  const { pollPubkey, candidateIndex, amount, requiredMint, voterAddress } = req.body;
  try {
    const mintPubkey = new web3.PublicKey(requiredMint);
    const userPubkey = new web3.PublicKey(voterAddress);
    // 사용자 연관 토큰 계정(Associated Token Account)
    const voterTokenAccount = await spl.getAssociatedTokenAddress(mintPubkey, userPubkey);
    // 서버 vault 연관 토큰 계정(Associated Token Account)
    const pollVault = await spl.getAssociatedTokenAddress(mintPubkey, wallet.publicKey);
    const tx = await program.methods
      .vote(candidateIndex, new anchor.BN(amount))
      .accounts({
        poll: new web3.PublicKey(pollPubkey),
        voter: userPubkey,
        voterTokenAccount,
        pollVault,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .transaction();
    // blockhash 및 fee payer 설정
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = userPubkey;
    // 모든 서명 없이 직렬화
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
    res.json({ tx: serialized });
  } catch (err) {
    console.error("Failed to create transaction:", err);
    res.status(500).json({ message: "Failed to create transaction", error: err.message });
  }
});

// 온체인에 있는 모든 의제 초기화
app.post('/api/reset-all-polls', async (req, res) => {
  try {
    // 온체인에서 모든 poll 계정 조회
    const polls = await program.account.poll.all();
    // 각 poll에 대해 resetPoll 호출
    for (const p of polls) {
      await program.methods
        .resetPoll()
        .accounts({
          poll: p.publicKey,
          owner: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();
    }
    res.json({ message: "All polls reset successfully" });
  } catch (err) {
    console.error("Failed to reset all polls:", err);
    res.status(500).json({ message: "Failed to reset all polls", error: err.message });
  }
});

app.listen(4000, () => console.log("Backend running on port 4000"));
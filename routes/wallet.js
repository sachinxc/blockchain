const express = require("express");
const { ec } = require("elliptic");
const Transaction = require("../models/transaction");

const router = express.Router();
const EC = new ec("secp256k1");

router.post("/create", (req, res) => {
  const keyPair = EC.genKeyPair();
  const privateKey = keyPair.getPrivate("hex");
  const publicKey = keyPair.getPublic("hex");

  res.json({ privateKey, publicKey });
});

router.post("/load", (req, res) => {
  const { privateKey } = req.body;
  try {
    const keyPair = EC.keyFromPrivate(privateKey, "hex");
    const publicKey = keyPair.getPublic("hex");
    const balance = req.app.locals.blockchain.getBalanceOfAddress(publicKey);

    res.json({ privateKey, publicKey, balance });
  } catch (error) {
    res.status(400).json({ error: "Invalid private key" });
  }
});

router.post("/send", (req, res) => {
  const { sender, recipient, amount, privateKey } = req.body;

  const key = EC.keyFromPrivate(privateKey, "hex");
  const walletAddress = key.getPublic("hex");

  if (walletAddress !== sender) {
    return res.status(400).send("Invalid private key for the given sender.");
  }

  try {
    const blockchain = req.app.locals.blockchain;
    const tx = new Transaction(
      sender,
      recipient,
      amount,
      blockchain.utxos[sender]
    );

    tx.signTransaction(key);

    blockchain.createTransaction(tx);
    blockchain.minePendingTransactions(walletAddress);

    res.send("Transaction successfully created and block mined.");
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.get("/balance/:address", (req, res) => {
  const balance = req.app.locals.blockchain.getBalanceOfAddress(
    req.params.address
  );
  res.send({ balance });
});

module.exports = router;

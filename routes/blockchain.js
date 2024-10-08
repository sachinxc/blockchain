const express = require("express");
const router = express.Router();

// Get the entire blockchain
router.get("/", (req, res) => {
  res.json(req.app.locals.blockchain.chain);
});

// New route for mining with a contribution
router.post("/contribute", (req, res) => {
  const { minerAddress, contribution, reward } = req.body;

  try {
    const blockchain = req.app.locals.blockchain;
    blockchain.minePendingTransactions(minerAddress, contribution, reward);

    res.send("Block successfully mined with contribution.");
  } catch (error) {
    res.status(400).send(error.message);
  }
});

module.exports = router;

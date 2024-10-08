const Block = require("./block");
const Transaction = require("./transaction");
const db = require("../db/db");

class Blockchain {
  constructor() {
    this.chain = [];
    this.utxos = {};
    this.difficulty = 2;
    this.pendingTransactions = [];
  }

  async loadBlockchain() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM blocks ORDER BY id ASC`, [], (err, rows) => {
        if (err) {
          return reject(err);
        }

        if (rows.length === 0) {
          this.createGenesisBlock();
          resolve();
        } else {
          const blocks = []; // Temporarily store the loaded blocks

          rows.forEach((row, index) => {
            db.all(
              `SELECT * FROM transactions WHERE blockId = ?`,
              [row.id],
              (err, txRows) => {
                if (err) {
                  return reject(err);
                }

                const transactions = txRows.map(
                  (tx) =>
                    new Transaction(
                      tx.sender,
                      tx.recipient,
                      tx.amount,
                      [],
                      tx.signature,
                      tx.transactionId
                    )
                );

                const block = new Block(
                  row.timestamp,
                  transactions,
                  row.previousHash,
                  row.contribution
                );
                block.hash = row.hash;
                block.nonce = row.nonce;

                blocks.push({ index: row.id, block });

                // Check if all blocks are loaded
                if (blocks.length === rows.length) {
                  // Sort blocks by their ID or any other sorting criteria
                  blocks.sort((a, b) => a.index - b.index);

                  // Add the sorted blocks to the chain
                  blocks.forEach(({ block }) => {
                    console.log(
                      `Loaded Block ${block.hash} with Previous Hash: ${block.previousHash}`
                    );
                    this.chain.push(block);
                  });

                  console.log("All blocks loaded. Validating chain...");
                  if (!this.validateChain()) {
                    return reject(
                      new Error("Blockchain validation failed after loading.")
                    );
                  }
                  resolve();
                }
              }
            );
          });

          // Load UTXOs
          db.all(`SELECT * FROM utxos`, [], (err, utxoRows) => {
            if (err) {
              return reject(err);
            }
            utxoRows.forEach((utxo) => {
              if (!this.utxos[utxo.recipient]) {
                this.utxos[utxo.recipient] = [];
              }
              this.utxos[utxo.recipient].push({
                txId: utxo.txId,
                amount: utxo.amount,
              });
            });

            console.log("UTXOs loaded:", this.utxos);
          });
        }
      });
    });
  }

  createGenesisBlock() {
    const recipient =
      "04c3cb3cf68bda5dbc1a8acdf4a9b3988ce49fa8dd8d682a2e8bad11d3eee8194bef462310382ac979632c36ddff5f99571a1ad70992f32518e0de8db9f7bfb61e";
    const initialAmount = 100;

    const contributionMessage =
      "This is the genesis block of the Action Chain.";

    const genesisTransaction = new Transaction(
      null,
      recipient,
      initialAmount,
      []
    );

    const genesisBlock = new Block(
      Date.parse("2023-01-01"),
      [genesisTransaction],
      "0", // Genesis block should have a previousHash of "0"
      contributionMessage
    );
    genesisBlock.mineBlock(this.difficulty);

    this.chain.push(genesisBlock);

    const txId = genesisTransaction.calculateHash();
    this.utxos[recipient] = [{ txId, amount: initialAmount }];

    this.saveBlock(genesisBlock);

    db.run(`INSERT INTO utxos (txId, recipient, amount) VALUES (?, ?, ?)`, [
      txId,
      recipient,
      initialAmount,
    ]);
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(transaction) {
    if (!transaction.isValid()) {
      throw new Error("Invalid transaction");
    }

    if (!this.hasSufficientUTXOs(transaction)) {
      throw new Error("Insufficient funds");
    }

    this.pendingTransactions.push(transaction);
  }

  hasSufficientUTXOs(transaction) {
    const senderUTXOs = this.utxos[transaction.sender] || [];
    const balance = senderUTXOs.reduce((sum, utxo) => sum + utxo.amount, 0);
    return balance >= transaction.amount;
  }

  minePendingTransactions(minerAddress, contribution = null, reward = 1) {
    const rewardTransaction = new Transaction(null, minerAddress, reward, []);
    this.pendingTransactions.push(rewardTransaction);

    const latestBlock = this.getLatestBlock();

    const block = new Block(
      Date.now(),
      [...this.pendingTransactions],
      latestBlock.hash, // Link the new block to the latest block in the chain
      contribution
    );

    block.mineBlock(this.difficulty);

    if (!block.hasValidTransactions()) {
      throw new Error("Cannot mine invalid transactions.");
    }

    this.chain.push(block);
    this.saveBlock(block);

    this.pendingTransactions = [];

    this.utxos[minerAddress] = this.utxos[minerAddress] || [];
    this.utxos[minerAddress].push({
      txId: rewardTransaction.transactionId,
      amount: reward,
    });

    db.run(`INSERT INTO utxos (txId, recipient, amount) VALUES (?, ?, ?)`, [
      rewardTransaction.transactionId,
      minerAddress,
      reward,
    ]);
  }

  createTransaction(transaction) {
    if (!this.hasSufficientUTXOs(transaction)) {
      throw new Error("Insufficient funds");
    }

    const senderUTXOs = this.utxos[transaction.sender];
    let balance = 0;
    const utxosToSpend = [];

    for (const utxo of senderUTXOs) {
      balance += utxo.amount;
      utxosToSpend.push(utxo);
      if (balance >= transaction.amount) break;
    }

    const change = balance - transaction.amount;

    this.pendingTransactions.push(transaction);

    this.utxos[transaction.sender] = senderUTXOs.filter(
      (utxo) => !utxosToSpend.includes(utxo)
    );

    utxosToSpend.forEach((utxo) => {
      db.run(`DELETE FROM utxos WHERE txId = ?`, [utxo.txId]);
    });

    this.utxos[transaction.recipient] = this.utxos[transaction.recipient] || [];
    this.utxos[transaction.recipient].push({
      txId: transaction.transactionId,
      amount: transaction.amount,
    });

    db.run(`INSERT INTO utxos (txId, recipient, amount) VALUES (?, ?, ?)`, [
      transaction.transactionId,
      transaction.recipient,
      transaction.amount,
    ]);

    if (change > 0) {
      const changeUtxo = {
        txId: transaction.transactionId + "-change",
        amount: change,
      };

      this.utxos[transaction.sender].push(changeUtxo);

      db.run(`INSERT INTO utxos (txId, recipient, amount) VALUES (?, ?, ?)`, [
        changeUtxo.txId,
        transaction.sender,
        change,
      ]);
    }

    console.log(
      `Transaction added from ${transaction.sender} to ${transaction.recipient} of ${transaction.amount} tokens`
    );
  }

  getBalanceOfAddress(address) {
    const utxos = this.utxos[address] || [];
    return utxos.reduce((sum, utxo) => sum + utxo.amount, 0);
  }

  saveBlock(block) {
    db.run(
      `INSERT INTO blocks (hash, previousHash, timestamp, nonce, contribution) VALUES (?, ?, ?, ?, ?)`,
      [
        block.hash,
        block.previousHash,
        block.timestamp,
        block.nonce,
        block.contribution,
      ],
      function (err) {
        if (err) {
          return console.error(err.message);
        }
        const blockId = this.lastID;
        block.transactions.forEach((tx) => {
          db.run(
            `INSERT INTO transactions (blockId, transactionId, sender, recipient, amount, signature, timestamp, nonce) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              blockId,
              tx.transactionId,
              tx.sender,
              tx.recipient,
              tx.amount,
              tx.signature,
              tx.timestamp,
              tx.nonce,
            ]
          );
        });
      }
    );
  }

  validateChain() {
    for (let i = 0; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];

      // Genesis block validation
      if (i === 0) {
        console.log(`Validating Genesis Block (Block ${i})`);
        console.log(`Genesis Block Hash: ${currentBlock.hash}`);
        if (currentBlock.previousHash !== "0") {
          throw new Error(
            `Genesis Block's previousHash should be "0" but found ${currentBlock.previousHash}`
          );
        }
        continue;
      }

      const previousBlock = this.chain[i - 1];

      console.log(`Validating Block ${i}`);
      console.log(`Current Block Previous Hash: ${currentBlock.previousHash}`);
      console.log(`Previous Block Hash: ${previousBlock.hash}`);
      console.log(`Current Block Hash: ${currentBlock.hash}`);

      // Check if the current block's previousHash matches the hash of the previous block
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.error(
          `Block ${i} Previous Hash (${currentBlock.previousHash}) does not match Previous Block Hash (${previousBlock.hash})`
        );
        throw new Error(`Block ${i} is not linked to the previous block`);
      }

      // Ensure that the hashes have not been altered
      if (currentBlock.hash !== this.chain[i].hash) {
        console.error(`Block ${i} hash does not match the stored hash`);
        throw new Error(`Block ${i} has been tampered with`);
      }
    }

    console.log("Blockchain is valid.");
    return true;
  }
}

module.exports = Blockchain;

const crypto = require("crypto");

class Block {
  constructor(timestamp, transactions, previousHash = "", contribution = null) {
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.contribution = contribution; // New contribution field
    this.hash = this.calculateHash();
    this.nonce = 0;
  }

  calculateHash() {
    return crypto
      .createHash("sha256")
      .update(
        this.previousHash +
          this.timestamp +
          JSON.stringify(this.transactions) +
          this.contribution +
          this.nonce
      )
      .digest("hex");
  }

  mineBlock(difficulty) {
    while (this.hash.substring(0, difficulty) !== "0".repeat(difficulty)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log(`Block mined: ${this.hash}`);
  }

  hasValidTransactions() {
    return this.transactions.every((tx) => tx.isValid());
  }
}

module.exports = Block;

const crypto = require("crypto");
const { ec } = require("elliptic");
const EC = new ec("secp256k1");

class Transaction {
  constructor(
    sender,
    recipient,
    amount,
    utxos,
    signature = null,
    transactionId = null
  ) {
    this.sender = sender;
    this.recipient = recipient;
    this.amount = amount;
    this.utxos = utxos;
    this.signature = signature;
    this.timestamp = Date.now();
    this.nonce = Math.floor(Math.random() * 1000000);
    this.transactionId = transactionId || this.calculateHash(); // Only calculate if not provided
  }

  calculateHash() {
    return crypto
      .createHash("sha256")
      .update(
        this.sender +
          this.recipient +
          this.amount +
          JSON.stringify(this.utxos) +
          this.timestamp +
          this.nonce
      )
      .digest("hex");
  }

  signTransaction(signingKey) {
    if (signingKey.getPublic("hex") !== this.sender) {
      throw new Error("You cannot sign transactions for other wallets!");
    }

    const hashTx = this.transactionId;
    const sig = signingKey.sign(hashTx, "base64");
    this.signature = sig.toDER("hex");
  }

  isValid() {
    if (this.sender === null) return true; // If no sender, assume it's a mining reward

    if (!this.signature || this.signature.length === 0) {
      throw new Error("No signature in this transaction");
    }

    const publicKey = EC.keyFromPublic(this.sender, "hex");
    return publicKey.verify(this.calculateHash(), this.signature);
  }
}

module.exports = Transaction;

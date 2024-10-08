const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Connect to the SQLite database
const db = new sqlite3.Database(
  path.resolve(__dirname, "blockchain.db"),
  (err) => {
    if (err) {
      console.error("Error opening database:", err);
    } else {
      console.log("Connected to the SQLite database.");
    }
  }
);

// Initialize the database schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT,
      previousHash TEXT,
      timestamp INTEGER,
      nonce INTEGER,
      contribution TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blockId INTEGER,
      transactionId TEXT,
      sender TEXT,
      recipient TEXT,
      amount REAL,
      signature TEXT,
      timestamp INTEGER,
      nonce INTEGER,
      FOREIGN KEY(blockId) REFERENCES blocks(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS utxos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txId TEXT,
      recipient TEXT,
      amount REAL
    )
  `);
});

module.exports = db;

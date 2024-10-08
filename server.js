const express = require("express");
const cors = require("cors");
const app = express();
const db = require("./db/db");

app.use(cors());
app.use(express.json());

const Blockchain = require("./models/blockchain");

const blockchain = new Blockchain();

(async () => {
  try {
    await blockchain.loadBlockchain();
    app.locals.blockchain = blockchain;

    // Routes
    app.use("/api/wallet", require("./routes/wallet"));
    app.use("/api/blockchain", require("./routes/blockchain"));

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize blockchain:", error);
  }
})();

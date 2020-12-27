require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const port = 9081;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB,
  password: process.env.DB_PWD,
  port: process.env.DB_PORT,
});

const selectVoucherQuery =
  "SELECT voucher_code FROM vouchers WHERE user_id= $1 AND channel = $2";
const selectCountQuery =
  "SELECT COUNT(*) FROM vouchers WHERE user_id = $1 AND channel = $2";
const selectAvailableVoucherQuery =
  "SELECT voucher_code FROM vouchers WHERE user_id IS NULL AND channel IS NULL LIMIT 1";
const selectVouchersLeftQuery =
  "SELECT COUNT(*) FROM vouchers WHERE user_id IS NULL AND channel IS NULL";
const updateVoucherQuery =
  "UPDATE vouchers SET (user_id, channel) = ($1, $2) WHERE voucher_code = $3";

app.post("/voucher", async (req, res) => {
  const { userId, channel } = req.body;

  let voucher = undefined;
  let availableCount = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const countRes = await client.query(selectCountQuery, [userId, channel]);
    if (countRes.rows[0].count > 0) {
      throw new Error("Already Allocated"); // being lazy here with shit error handling
    }

    const availableVoucherResult = await client.query(
      selectAvailableVoucherQuery
    );
    if (availableVoucherResult.rowCount === 0) {
      throw new Error("No More Vouchers");
    }
    voucher = availableVoucherResult.rows[0].voucher_code;

    await client.query(updateVoucherQuery, [userId, channel, voucher]);
    const vouchersLeftResult = await client.query(selectVouchersLeftQuery);
    availableCount = vouchersLeftResult.rows[0].count;
    await client.query("COMMIT");

    res.status(200).json({ availableCount, voucher });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.message === "Already Allocated") {
      res.sendStatus(404);
    } else {
      res.sendStatus(403);
    }
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Voucher handler listening on PORT ${port}`);
});

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

const selectUserCountQuery = "SELECT COUNT(*) FROM vouchers WHERE user_id = $1";
const selectChannelCountQuery =
  "SELECT COUNT(*) FROM vouchers WHERE channel = $1";
const selectCountQuery =
  "SELECT COUNT(*) FROM vouchers WHERE user_id = $1 AND channel = $2";
const selectAvailableVoucherQuery =
  "SELECT voucher_code FROM vouchers WHERE user_id IS NULL AND channel IS NULL LIMIT 1";
const updateVoucherQuery =
  "UPDATE vouchers SET (user_id, channel) = ($1, $2) WHERE voucher_code = $3";

const CHANNEL_LIMIT = 45;
const USER_LIMIT = 2;

// Error Message
const ERR_CHANNEL_OUT = "Channel ran out of vouchers";
const ERR_USER_ALLOCATED = "Already Allocated To Said User In This Channel";
const ERR_USER_MAXED = "User has maxed out vouchers";
const ERR_VOUCHERS_OUT = "No more vouchers left everywhere";

app.post("/voucher", async (req, res) => {
  const { userId, channel } = req.body;

  let voucher = undefined;
  let availableCount = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if the Channel can allocate anymore vouchers
    const channelCountResult = await client.query(selectChannelCountQuery, [
      channel,
    ]);
    if (channelCountResult.rows[0].count >= CHANNEL_LIMIT) {
      throw new Error(ERR_CHANNEL_OUT);
    }

    // Check if user has already claimed voucher from this query
    const countRes = await client.query(selectCountQuery, [userId, channel]);
    if (countRes.rows[0].count > 0) {
      throw new Error(ERR_USER_ALLOCATED); // being lazy here with shit error handling and magic constants
    }

    // Check if user has more than 2 vouchers
    const userCountResult = await client.query(selectUserCountQuery, [channel]);
    if (userCountResult.rows[0].count >= USER_LIMIT) {
      throw new Error(ERR_USER_MAXED);
    }

    // Check if there are any available vouchers (This should never happen)
    const availableVoucherResult = await client.query(
      selectAvailableVoucherQuery
    );
    if (availableVoucherResult.rowCount === 0) {
      throw new Error(ERR_VOUCHERS_OUT);
    }
    voucher = availableVoucherResult.rows[0].voucher_code;

    await client.query(updateVoucherQuery, [userId, channel, voucher]);
    const vouchersLeftResult = await client.query(selectChannelCountQuery, [
      channel,
    ]);
    availableCount = vouchersLeftResult.rows[0].count;
    await client.query("COMMIT");

    res.status(200).json({ availableCount, voucher });
  } catch (error) {
    await client.query("ROLLBACK");
    // Abusing HTTP status codes here, trigger warning!
    if (error.message === ERR_VOUCHERS_OUT) {
      res.sendStatus(404);
    } else if (error.message === ERR_USER_MAXED) {
      res.sendStatus(406);
    } else if (error.message === ERR_CHANNEL_OUT) {
      res.sendStatus(401);
    } else if (error.message === ERR_USER_ALLOCATED) {
      res.sendStatus(403);
    } else {
      res.sendStatus(500);
    }
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Voucher handler listening on PORT ${port}`);
});

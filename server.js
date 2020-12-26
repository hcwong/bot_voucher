require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const app = express();
const port = 9081;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB,
  password: process.env.DB_PWD,
  port: process.env.DB_PORT,
});

const transactionQuery = `
DO $$
  DECLARE
    voucher_count INT, selected_code VARCHAR(80);
BEGIN
  SELECT COUNT(*) INTO voucher_count FROM vouchers
    WHERE user_id = $1 AND channel = $2;
  IF voucher_count = 0 THEN
    SELECT voucher_code INTO selected_code FROM vouchers WHERE user_id IS NULL AND channel IS NULL;
    UPDATE vouchers SET (user_id, channel) = ($1, $2) WHERE voucher_code = selected_code;
    COMMIT;
  ELSE
    RAISE EXCEPTION 'Voucher has already been given to this user for this channel';
  END IF;
END$$
`;

const selectQuery =
  "SELECT voucher_code FROM vouchers WHERE user_id= $1 AND channel = $2";

app.post("/voucher", async (req, res) => {
  const { userId, channel } = req.body;

  try {
    await pool.query(transactionQuery);
  } catch (error) {
    return res.status(400).json({ err: "Transaction" });
  }

  try {
    const result = await pool.query(selectQuery);
    return res.status(200).json({ code: result.rows[0]["voucher_code"] });
  } catch (error) {
    return res.status(500).json({ err: "Unknown" });
  }
});

app.listen(port, () => {
  console.log(`Voucher handler listening on PORT ${port}`);
});

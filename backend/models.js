// models.js
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- Products ---
async function getAllProducts() {
  const { rows } = await pool.query('SELECT * FROM products WHERE is_active = true');
  return rows;
}
async function getProductById(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0];
}
async function createProduct({ id, name, price }) {
  const { rows } = await pool.query(
    'INSERT INTO products(id, name, price) VALUES($1,$2,$3) RETURNING *',
    [id, name, price]
  );
  return rows[0];
}
async function updateProduct(id, { name, price }) {
  const { rows } = await pool.query(
    'UPDATE products SET name=$1, price=$2 WHERE id=$3 RETURNING *',
    [name, price, id]
  );
  return rows[0];
}
async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id=$1', [id]);
}

// --- Campaigns ---
async function createCampaign(data) {
  const id = uuidv4();
  const {
    advertiser_id, product_id, campaign_name,
    start_date, end_date, qr_code_identifier,
    commission_percent, location
  } = data;
  const { rows } = await pool.query(
    `INSERT INTO campaigns
     (id, advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id, advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location]
  );
  return rows[0];
}
async function getCampaignById(id) {
  const { rows } = await pool.query('SELECT * FROM campaigns WHERE id=$1', [id]);
  return rows[0];
}
async function getCampaignByIdentifier(qr_code_identifier) {
  const { rows } = await pool.query(
    'SELECT * FROM campaigns WHERE qr_code_identifier=$1',
    [qr_code_identifier]
  );
  return rows[0];
}

// --- Orders ---
async function createOrder(data) {
  const id = uuidv4();
  const {
    customer_id, product_id, campaign_id,
    quantity, total_amount, commission_amount, shipping_address
  } = data;
  const { rows } = await pool.query(
    `INSERT INTO orders
     (id, customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address]
  );
  return rows[0];
}
async function getAllOrders() {
  const { rows } = await pool.query('SELECT * FROM orders');
  return rows;
}
async function getOrderById(id) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
  return rows[0];
}

// --- Payouts ---
async function createPayout({ recipient_id, order_id, amount, type }) {
  const id = uuidv4();
  const { rows } = await pool.query(
    `INSERT INTO payouts (id, recipient_id, order_id, amount, type)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [id, recipient_id, order_id, amount, type]
  );
  return rows[0];
}

// --- Analytics ---
async function createAnalyticsLog({ adLocation, format, clicks = 0, conversions = 0 }) {
  const id = uuidv4();
  const { rows } = await pool.query(
    `INSERT INTO analytics (id, adLocation, format, clicks, conversions)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [id, adLocation, format, clicks, conversions]
  );
  return rows[0];
}
async function getAnalyticsLogs() {
  const { rows } = await pool.query('SELECT * FROM analytics');
  return rows;
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createCampaign,
  getCampaignById,
  getCampaignByIdentifier,
  createOrder,
  getAllOrders,
  getOrderById,
  createPayout,
  createAnalyticsLog,
  getAnalyticsLogs
};

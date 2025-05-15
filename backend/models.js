const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Example: Product model (repeat for other models as needed)

async function getAllProducts() {
  const res = await pool.query('SELECT * FROM products');
  return res.rows;
}

async function getProductById(id) {
  const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return res.rows[0];
}

async function createProduct({ id, name, price }) {
  const res = await pool.query(
    'INSERT INTO products (id, name, price) VALUES ($1, $2, $3) RETURNING *',
    [id, name, price]
  );
  return res.rows[0];
}

async function updateProduct(id, { name, price }) {
  const res = await pool.query(
    'UPDATE products SET name = $1, price = $2 WHERE id = $3 RETURNING *',
    [name, price, id]
  );
  return res.rows[0];
}

async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
}

// Orders
async function getAllOrders() {
  const res = await pool.query('SELECT * FROM orders');
  return res.rows;
}

async function getOrderById(id) {
  const res = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  return res.rows[0];
}

async function createOrder({ customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO orders (id, customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address]
  );
  return res.rows[0];
}

// Campaigns
async function createCampaign({ advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO campaigns (id, advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [id, advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location]
  );
  return res.rows[0];
}

// Payouts
async function createPayout({ recipient_id, order_id, amount, type }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO payouts (id, recipient_id, order_id, amount, type)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, recipient_id, order_id, amount, type]
  );
  return res.rows[0];
}

// Analytics
async function createAnalyticsLog({ adLocation, format, clicks, conversions }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO analytics (id, adlocation, format, clicks, conversions)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, adLocation, format, clicks, conversions]
  );
  return res.rows[0];
}

async function getAnalyticsLogs() {
  const res = await pool.query('SELECT * FROM analytics');
  return res.rows;
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllOrders,
  getOrderById,
  createOrder,
  createCampaign,
  createPayout,
  createAnalyticsLog,
  getAnalyticsLogs
  // Add more helpers as needed
};

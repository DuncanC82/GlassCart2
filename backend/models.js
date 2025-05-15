const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const userSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['customer', 'advertiser', 'distributor', 'admin'], required: true },
  created_at: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  distributor_id: { type: String, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  stock_quantity: { type: Number, required: true },
  image_url: String,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const campaignSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  advertiser_id: { type: String, ref: 'User', required: true },
  product_id: { type: String, ref: 'Product', required: true },
  campaign_name: { type: String, required: true },
  start_date: Date,
  end_date: Date,
  qr_code_identifier: { type: String, unique: true },
  commission_percent: { type: Number, default: 10 },
  location: String
});

const orderSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  customer_id: { type: String, ref: 'User', required: true },
  product_id: { type: String, ref: 'Product', required: true },
  campaign_id: { type: String, ref: 'Campaign' },
  quantity: { type: Number, default: 1 },
  total_amount: { type: Number, required: true },
  commission_amount: Number,
  status: {
    type: String,
    enum: ['pending', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  shipping_address: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const payoutSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  recipient_id: { type: String, ref: 'User', required: true },
  order_id: { type: String, ref: 'Order', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['advertiser_commission', 'distributor_revenue'], required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const analyticsSchema = new mongoose.Schema({
  adLocation: { type: String, required: true },
  format: { type: String, required: true },
  time: { type: Date, default: Date.now },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Campaign = mongoose.model('Campaign', campaignSchema);
const Order = mongoose.model('Order', orderSchema);
const Payout = mongoose.model('Payout', payoutSchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);

// Products
async function getAllProducts() {
  const res = await pool.query('SELECT * FROM products');
  return res.rows;
}

async function createProduct({ id, distributor_id, name, price, description, image_url, stock_quantity }) {
  const res = await pool.query(
    `INSERT INTO products (id, distributor_id, name, price, description, image_url, stock_quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [id, distributor_id, name, price, description, image_url, stock_quantity]
  );
  return res.rows[0];
}

// Campaigns
async function createCampaign({ advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location }) {
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO campaigns (id, advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [id, advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location]
  );
  return res.rows[0];
}

// Orders
async function createOrder({ customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address }) {
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO orders (id, customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address]
  );
  return res.rows[0];
}

async function getAllOrders() {
  const res = await pool.query('SELECT * FROM orders');
  return res.rows;
}

async function getOrderById(id) {
  const res = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  return res.rows[0];
}

// Payouts
async function createPayout({ recipient_id, order_id, amount, type }) {
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
  User,
  Product,
  Campaign,
  Order,
  Payout,
  Analytics,
  getAllProducts,
  createProduct,
  createCampaign,
  createOrder,
  getAllOrders,
  getOrderById,
  createPayout,
  createAnalyticsLog,
  getAnalyticsLogs
};

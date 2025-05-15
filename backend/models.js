// models.js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// -------- Product --------
async function getAllProducts() {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  return rows;
}
async function getProductById(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
  return rows[0];
}
async function createProduct({ id, name, price }) {
  const { rows } = await pool.query(
    'INSERT INTO products(id,name,price,created_at) VALUES($1,$2,$3,NOW()) RETURNING *',
    [id, name, price]
  );
  return rows[0];
}
async function updateProduct(id, { name, price }) {
  const { rows } = await pool.query(
    'UPDATE products SET name=$2, price=$3 WHERE id=$1 RETURNING *',
    [id, name, price]
  );
  return rows[0];
}
async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id=$1', [id]);
}

// -------- Campaign --------
async function createCampaign(fields) {
  const cols = [
    'id','advertiser_id','product_id','campaign_name',
    'start_date','end_date','qr_code_identifier',
    'commission_percent','location'
  ];
  const vals = [
    uuidv4(),
    fields.advertiser_id,
    fields.product_id,
    fields.campaign_name,
    fields.start_date,
    fields.end_date,
    fields.qr_code_identifier,
    fields.commission_percent,
    fields.location
  ];
  const { rows } = await pool.query(
    `INSERT INTO campaigns(${cols.join(',')})
     VALUES(${cols.map((_,i)=>`$${i+1}`).join(',')})
     RETURNING *`,
    vals
  );
  return rows[0];
}
async function getCampaignById(id) {
  const { rows } = await pool.query('SELECT * FROM campaigns WHERE id=$1', [id]);
  return rows[0];
}
async function getCampaignByIdentifier(identifier) {
  const { rows } = await pool.query(
    'SELECT * FROM campaigns WHERE qr_code_identifier=$1',
    [identifier]
  );
  return rows[0];
}

// -------- Order --------
async function createOrder(fields) {
  const cols = [
    'id','customer_id','product_id','campaign_id',
    'quantity','total_amount','commission_amount','shipping_address','created_at'
  ];
  const vals = [
    uuidv4(),
    fields.customer_id,
    fields.product_id,
    fields.campaign_id,
    fields.quantity,
    fields.total_amount,
    fields.commission_amount,
    fields.shipping_address
  ];
  const { rows } = await pool.query(
    `INSERT INTO orders(${cols.join(',')})
     VALUES(${cols.map((_,i)=>`$${i+1}`).join(',')} , NOW())
     RETURNING *`,
    vals
  );
  return rows[0];
}
async function getAllOrders() {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  return rows;
}
async function getOrderById(id) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
  return rows[0];
}
async function getOrdersByCustomer(customer_id) {
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE customer_id=$1 ORDER BY created_at DESC',
    [customer_id]
  );
  return rows;
}
async function getOrdersByDistributor(distributor_id) {
  const { rows } = await pool.query(`
    SELECT o.*
      FROM orders o
      JOIN products p ON o.product_id=p.id
     WHERE p.distributor_id=$1
     ORDER BY o.created_at DESC
  `, [distributor_id]);
  return rows;
}

// -------- Payout --------
async function createPayout({ recipient_id, order_id, amount, type }) {
  const { rows } = await pool.query(
    'INSERT INTO payouts(id,recipient_id,order_id,amount,type,created_at) VALUES($1,$2,$3,$4,$5,NOW()) RETURNING *',
    [uuidv4(), recipient_id, order_id, amount, type]
  );
  return rows[0];
}

// -------- Analytics --------
async function createAnalyticsLog({ adLocation, format, clicks, conversions }) {
  const { rows } = await pool.query(
    'INSERT INTO analytics(id,adLocation,format,clicks,conversions,time) VALUES($1,$2,$3,$4,$5,NOW()) RETURNING *',
    [uuidv4(), adLocation, format, clicks, conversions]
  );
  return rows[0];
}
async function getAnalyticsLogs() {
  const { rows } = await pool.query('SELECT * FROM analytics ORDER BY time DESC');
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
  getOrdersByCustomer,
  getOrdersByDistributor,
  createPayout,
  createAnalyticsLog,
  getAnalyticsLogs
};

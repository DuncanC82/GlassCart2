// models.js
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
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
  // Validate required fields
  const required = ['retailer_id','product_id','campaign_name','qr_code_identifier'];
  for (const key of required) {
    if (!fields[key]) {
      throw new Error(`Missing required field: ${key}`);
    }
  }
  const cols = [
    'id','retailer_id','product_id','campaign_name',
    'start_date','end_date','qr_code_identifier',
    'commission_percent','location'
  ];
  const vals = [
    uuidv4(),
    fields.retailer_id,
    fields.product_id,
    fields.campaign_name,
    fields.start_date,
    fields.end_date,
    fields.qr_code_identifier,
    fields.commission_percent,
    fields.location
  ];
  try {
    const { rows } = await pool.query(
      `INSERT INTO campaigns(${cols.join(',')})
       VALUES(${cols.map((_,i)=>`$${i+1}`).join(',')})
       RETURNING *`,
      vals
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505' && err.constraint && err.constraint.includes('qr_code_identifier')) {
      throw new Error('QR code identifier must be unique.');
    }
    throw new Error('Failed to create campaign: ' + err.message);
  }
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
async function getAllCampaigns() {
  const { rows } = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
  return rows;
}

// -------- Order --------
async function createOrder(fields) {
  const cols = [
    'id','customer_id','product_id','campaign_id',
    'quantity','total_amount','commission_amount','shipping_address'
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
     VALUES(${cols.map((_,i)=>`$${i+1}`).join(',')})
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
    'INSERT INTO analytics(id,adLocation,format,clicks,conversions,created_at) VALUES($1,$2,$3,$4,$5,NOW()) RETURNING *',
    [uuidv4(), adLocation, format, clicks, conversions]
  );
  return rows[0];
}
async function getAnalyticsLogs() {
  const res = await pool.query('SELECT * FROM analytics ORDER BY created_at DESC');
  return res.rows;
}

// -------- Scan Events --------
async function createScan({
  campaign_id,
  scanned_at,
  lat,
  lon,
  city,
  suburb,
  region,
  weather,
  distance_to_store_m,
  nearest_poi,
  distance_to_poi_m,
  user_agent,
  converted_order_id = null, // new: link to order if scan led to conversion
  device_type = null,        // new: browser/mobile/desktop
  referrer = null,           // new: where did the scan come from (if available)
  scan_source = null         // new: e.g. QR, NFC, shortlink, etc
}) {
  const { rows } = await pool.query(
    `INSERT INTO scans (
      id, campaign_id, scanned_at, lat, lon, city, suburb, region, weather,
      distance_to_store_m, nearest_poi, distance_to_poi_m, user_agent,
      converted_order_id, device_type, referrer, scan_source
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
    ) RETURNING *`,
    [
      uuidv4(),
      campaign_id,
      scanned_at,
      lat,
      lon,
      city,
      suburb,
      region,
      weather ? JSON.stringify(weather) : null,
      distance_to_store_m,
      nearest_poi,
      distance_to_poi_m,
      user_agent,
      converted_order_id,
      device_type,
      referrer,
      scan_source
    ]
  );
  return rows[0];
}

// Return all scan metadata for a campaign (not a summary)
async function getScansByCampaign(campaignId) {
  const { rows } = await pool.query(
    `SELECT
        id,
        campaign_id,
        scanned_at,
        lat,
        lon,
        city,
        suburb,
        region,
        weather,
        distance_to_store_m,
        nearest_poi,
        distance_to_poi_m,
        user_agent
     FROM scans
     WHERE campaign_id = $1
     ORDER BY scanned_at DESC`,
    [campaignId]
  );
  return rows;
}

// Example: get scan summary by city
async function getScanSummaryByCity() {
  const { rows } = await pool.query(
    `SELECT
        city,
        AVG(lat)::float AS lat,
        AVG(lon)::float AS lon,
        COUNT(*) AS scan_count
     FROM scans
     GROUP BY city
     ORDER BY scan_count DESC`
  );
  return rows;
}
// Enriched scan summary by campaign
async function getScanSummaryByCampaign(campaignId) {
  const { rows } = await pool.query(
    `SELECT
        COUNT(*) AS scan_count,
        COUNT(converted_order_id) AS conversions,
        MIN(scanned_at) AS first_scan,
        MAX(scanned_at) AS last_scan,
        ARRAY_AGG(DISTINCT city) AS cities,
        ARRAY_AGG(DISTINCT region) AS regions,
        AVG(lat)::float AS avg_lat,
        AVG(lon)::float AS avg_lon,
        ARRAY_AGG(jsonb_build_object(
          'lat', lat,
          'lon', lon,
          'city', city,
          'suburb', suburb,
          'region', region
        )) AS geo_points,
        ARRAY_AGG(DISTINCT device_type) AS device_types,
        ARRAY_AGG(DISTINCT scan_source) AS scan_sources,
        ARRAY_AGG(DISTINCT referrer) AS referrers,
        AVG((weather->>'temp')::float) AS avg_temp,
        ARRAY_AGG(DISTINCT weather->>'condition') AS weather_conditions
     FROM scans
     WHERE campaign_id = $1`,
    [campaignId]
  );
  return rows[0];
}

// -------- Retailer --------
async function createRetailer({ name, email, username, password }) {
  const { rows } = await pool.query(
    `INSERT INTO users(id, name, email, username, password, role, created_at)
     VALUES($1, $2, $3, $4, $5, 'retailer', NOW()) RETURNING *`,
    [uuidv4(), name, email, username, password]
  );
  return rows[0];
}

async function getRetailerById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id = $1 AND role = $2',
    [id, 'retailer']
  );
  return rows[0];
}

async function updateRetailer(id, { name, email, username, password }) {
  const { rows } = await pool.query(
    `UPDATE users SET name = $2, email = $3, username = $4, password = $5
     WHERE id = $1 AND role = $6 RETURNING *`,
    [id, name, email, username, password, 'retailer']
  );
  return rows[0];
}

async function deleteRetailer(id) {
  await pool.query('DELETE FROM users WHERE id = $1 AND role = $2', [id, 'retailer']);
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
  getAllCampaigns,
  createOrder,
  getAllOrders,
  getOrderById,
  getOrdersByCustomer,
  getOrdersByDistributor,
  createPayout,
  createAnalyticsLog,
  getAnalyticsLogs,
  createScan,
  getScanSummaryByCity,
  getScanSummaryByCampaign,
  getScansByCampaign,
  createRetailer,
  getRetailerById,
  updateRetailer,
  deleteRetailer,
  pool // Export the pool for use in index.js
};

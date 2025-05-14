 const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const models = require('./models');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Swagger setup
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GlassCart API',
      version: '1.0.0',
    },
  },
  apis: ['./backend/*.js'], // Adjust path if your routes are elsewhere
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// DB Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Example: test connection
pool.connect()
  .then(client => {
    return client.query('SELECT NOW()')
      .then(res => {
        console.log('Postgres connected:', res.rows[0]);
        client.release();
      })
      .catch(err => {
        client.release();
        console.error('Postgres connection error', err.stack);
      });
  });

// Base
app.get('/', (req, res) => {
  res.send('GlassCart API is running');
});

// Generate QR Code
app.post('/generate-qr', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const qr = await QRCode.toDataURL(url);
    res.json({ qrCode: qr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// Products
app.get('/products', async (req, res) => {
  const products = await models.getAllProducts();
  res.json(products);
});

app.get('/products/:id', async (req, res) => {
  const product = await models.getProductById(req.params.id);
  if (product) res.json(product);
  else res.status(404).json({ error: 'Not found' });
});

app.post('/products', async (req, res) => {
  const id = uuidv4();
  const { name, price } = req.body;
  const product = await models.createProduct({ id, name, price });
  res.status(201).json(product);
});

app.put('/products/:id', async (req, res) => {
  const { name, price } = req.body;
  const product = await models.updateProduct(req.params.id, { name, price });
  if (product) res.json(product);
  else res.status(404).json({ error: 'Not found' });
});

app.delete('/products/:id', async (req, res) => {
  await models.deleteProduct(req.params.id);
  res.status(204).end();
});

// Campaigns
app.post('/campaigns', async (req, res) => {
  const { advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location } = req.body;
  if (!advertiser_id || !product_id || !campaign_name || !qr_code_identifier) {
    return res.status(400).json({ error: 'Missing campaign data' });
  }
  const campaign = await models.createCampaign({ advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location });
  res.status(201).json(campaign);
});

// Orders
app.post('/orders', async (req, res) => {
  const { customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address } = req.body;
  if (!customer_id || !product_id || !total_amount || !shipping_address) {
    return res.status(400).json({ error: 'Missing order data' });
  }
  const order = await models.createOrder({ customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address });
  res.status(201).json(order);
});

// Payouts
app.post('/payouts', async (req, res) => {
  const { recipient_id, order_id, amount, type } = req.body;
  if (!recipient_id || !order_id || !amount || !type) {
    return res.status(400).json({ error: 'Missing payout data' });
  }
  const payout = await models.createPayout({ recipient_id, order_id, amount, type });
  res.status(201).json(payout);
});

// Analytics
app.post('/analytics', async (req, res) => {
  const { adLocation, format, clicks, conversions } = req.body;
  if (!adLocation || !format) return res.status(400).json({ error: 'Ad location and format required' });
  const log = await models.createAnalyticsLog({ adLocation, format, clicks, conversions });
  res.status(201).json(log);
});

app.get('/analytics', async (req, res) => {
  const logs = await models.getAnalyticsLogs();
  res.json(logs);
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

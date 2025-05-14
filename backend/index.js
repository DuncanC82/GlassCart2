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
  apis: ['./index.js'], // Make sure this file path matches!
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

/**
 * @swagger
 * /:
 *   get:
 *     summary: API Health Check
 *     responses:
 *       200:
 *         description: API is running
 */
app.get('/', (req, res) => {
  res.send('GlassCart API is running');
});

/**
 * @swagger
 * /generate-qr:
 *   post:
 *     summary: Generate a QR code
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: QR code generated
 */
app.post('/generate-qr', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const qr = await QRCode.toDataURL(url);
    res.json({ qrCode: qr });
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 */
app.get('/products', async (req, res) => {
  const products = await models.getAllProducts();
  res.json(products);
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get product by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *         required: true
 */
app.get('/products/:id', async (req, res) => {
  const product = await models.getProductById(req.params.id);
  if (product) res.json(product);
  else res.status(404).json({ error: 'Not found' });
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a new product
 */
app.post('/products', async (req, res) => {
  const id = uuidv4();
  const { name, price } = req.body;
  const product = await models.createProduct({ id, name, price });
  res.status(201).json(product);
});

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update a product
 */
app.put('/products/:id', async (req, res) => {
  const { name, price } = req.body;
  const product = await models.updateProduct(req.params.id, { name, price });
  if (product) res.json(product);
  else res.status(404).json({ error: 'Not found' });
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product
 */
app.delete('/products/:id', async (req, res) => {
  await models.deleteProduct(req.params.id);
  res.status(204).end();
});

/**
 * @swagger
 * /campaigns:
 *   post:
 *     summary: Create a new campaign
 */
app.post('/campaigns', async (req, res) => {
  const {
    advertiser_id, product_id, campaign_name, start_date,
    end_date, qr_code_identifier, commission_percent, location
  } = req.body;

  if (!advertiser_id || !product_id || !campaign_name || !qr_code_identifier) {
    return res.status(400).json({ error: 'Missing campaign data' });
  }

  const campaign = await models.createCampaign({
    advertiser_id, product_id, campaign_name, start_date,
    end_date, qr_code_identifier, commission_percent, location
  });

  res.status(201).json(campaign);
});

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 */
app.post('/orders', async (req, res) => {
  const {
    customer_id, product_id, campaign_id,
    quantity, total_amount, commission_amount, shipping_address
  } = req.body;

  if (!customer_id || !product_id || !total_amount || !shipping_address) {
    return res.status(400).json({ error: 'Missing order data' });
  }

  const order = await models.createOrder({
    customer_id, product_id, campaign_id,
    quantity, total_amount, commission_amount, shipping_address
  });

  res.status(201).json(order);
});

/**
 * @swagger
 * /payouts:
 *   post:
 *     summary: Create a payout
 */
app.post('/payouts', async (req, res) => {
  const { recipient_id, order_id, amount, type } = req.body;

  if (!recipient_id || !order_id || !amount || !type) {
    return res.status(400).json({ error: 'Missing payout data' });
  }

  const payout = await models.createPayout({ recipient_id, order_id, amount, type });
  res.status(201).json(payout);
});

/**
 * @swagger
 * /analytics:
 *   post:
 *     summary: Log analytics data
 */
app.post('/analytics', async (req, res) => {
  const { adLocation, format, clicks, conversions } = req.body;
  if (!adLocation || !format) return res.status(400).json({ error: 'Missing data' });

  const log = await models.createAnalyticsLog({ adLocation, format, clicks, conversions });
  res.status(201).json(log);
});

/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: Retrieve analytics logs
 */
app.get('/analytics', async (req, res) => {
  const logs = await models.getAnalyticsLogs();
  res.json(logs);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

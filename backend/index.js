// index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const models = require('./models');
const pool = models.pool; // Import pool from models.js
const QRCode = require('qrcode');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args)); // Fix for ESM
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const app = express();
const BASE_URL = process.env.BASE_URL || 'https://glasscart2.onrender.com';
const FRONTEND_URL = process.env.FRONTEND_URL || BASE_URL;

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
      description: 'Live API documentation for the QR-commerce platform'
    }
  },
  apis: ['./index.js']
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check
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
 *     summary: Generate a QR code from a URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 example: "https://glasscart.com"
 *     responses:
 *       200:
 *         description: QR code data URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 */
app.post('/generate-qr', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'QR generation failed' });
  }
});

/**
 * @swagger
 * tags:
 *   - name: Products
 *     description: Product management
 *   - name: Campaigns
 *     description: Campaign management
 *   - name: Orders
 *     description: Order management
 *   - name: Payouts
 *     description: Payout management
 *   - name: Analytics
 *     description: Analytics and QR scan tracking
 *   - name: QR
 *     description: QR code and embed endpoints
 *   - name: Retailers
 *     description: Retailer management
 */

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: List all products
 *     responses:
 *       200:
 *         description: Array of products
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *     responses:
 *       201:
 *         description: Product created
 */
app.get('/products', requireRetailerAuth, async (req, res) => {
  // Only show products for this retailer (assuming distributor_id is retailer's id)
  const products = await models.pool.query('SELECT * FROM products WHERE distributor_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(products.rows);
});

app.post('/products', requireRetailerAuth, async (req, res) => {
  const id = uuidv4();
  const { name, price } = req.body;
  const product = await models.createProduct({ id, name, price });
  res.status(201).json(product);
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200: { description: Product found }
 *       404: { description: Not found }
 *   put:
 *     tags: [Products]
 *     summary: Update a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *     responses:
 *       200: { description: Product updated }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: No content }
 */
app.get('/products/:id', async (req, res) => {
  const product = await models.getProductById(req.params.id);
  if (product) res.json(product);
  else res.status(404).json({ error: 'Not found' });
});

app.put('/products/:id', requireRetailerAuth, async (req, res) => {
  const { name, price } = req.body;
  const updated = await models.updateProduct(req.params.id, { name, price });
  if (updated) res.json(updated);
  else res.status(404).json({ error: 'Not found' });
});

app.delete('/products/:id', requireRetailerAuth, async (req, res) => {
  await models.deleteProduct(req.params.id);
  res.status(204).end();
});

/**
 * @swagger
 * /campaigns:
 *   get:
 *     tags: [Campaigns]
 *     summary: List all campaigns
 *     responses:
 *       200:
 *         description: Array of campaigns
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *   post:
 *     tags: [Campaigns]
 *     summary: Create a new campaign
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [retailer_id, product_id, campaign_name, qr_code_identifier]
 *             properties:
 *               retailer_id: { type: string }
 *               product_id: { type: string }
 *               campaign_name: { type: string }
 *               start_date: { type: string, format: date-time }
 *               end_date: { type: string, format: date-time }
 *               qr_code_identifier: { type: string }
 *               commission_percent: { type: number }
 *               location: { type: string }
 *     responses:
 *       201: { description: Campaign created }
 */
app.get('/campaigns', requireRetailerAuth, async (req, res) => {
  // Only show campaigns for this retailer
  const campaigns = await models.pool.query('SELECT * FROM campaigns WHERE retailer_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(campaigns.rows);
});
app.post('/campaigns', requireRetailerAuth, async (req, res) => {
  try {
    const campaign = await models.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /campaigns/{id}:
 *   get:
 *     tags: [Campaigns]
 *     summary: Get campaign by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200: { description: Campaign found }
 *       404: { description: Not found }
 */
app.get('/campaigns/:id', async (req, res) => {
  const campaign = await models.getCampaignById(req.params.id);
  if (campaign) res.json(campaign);
  else res.status(404).json({ error: 'Not found' });
});

/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders
 *     parameters:
 *       - in: query
 *         name: customer_id
 *         schema: { type: string }
 *       - in: query
 *         name: distributor_id
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of orders }
 *   post:
 *     tags: [Orders]
 *     summary: Create a new order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, product_id, total_amount, shipping_address]
 *             properties:
 *               customer_id: { type: string }
 *               product_id: { type: string }
 *               campaign_id: { type: string }
 *               quantity: { type: number }
 *               total_amount: { type: number }
 *               commission_amount: { type: number }
 *               shipping_address: { type: string }
 *     responses:
 *       201: { description: Order created }
 */
app.get('/orders', async (req, res) => {
  const { customer_id, distributor_id } = req.query;
  let list;
  if (customer_id) list = await models.getOrdersByCustomer(customer_id);
  else if (distributor_id) list = await models.getOrdersByDistributor(distributor_id);
  else list = await models.getAllOrders();
  res.json(list);
});

app.post('/orders', async (req, res) => {
  const order = await models.createOrder(req.body);
  res.status(201).json(order);
});

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200: { description: Order found }
 *       404: { description: Not found }
 */
app.get('/orders/:id', async (req, res) => {
  const order = await models.getOrderById(req.params.id);
  if (order) res.json(order);
  else res.status(404).json({ error: 'Not found' });
});

/**
 * @swagger
 * /payouts:
 *   post:
 *     tags: [Payouts]
 *     summary: Create a payout record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipient_id: { type: string }
 *               order_id: { type: string }
 *               amount: { type: number }
 *               type: { type: string }
 *     responses:
 *       201: { description: Payout created }
 */
app.post('/payouts', async (req, res) => {
  const payout = await models.createPayout(req.body);
  res.status(201).json(payout);
});

/**
 * @swagger
 * /analytics:
 *   get:
 *     tags: [Analytics]
 *     summary: Get analytics logs
 *     responses:
 *       200: { description: Array of analytics }
 *   post:
 *     tags: [Analytics]
 *     summary: Log analytics data
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adLocation: { type: string }
 *               format: { type: string }
 *               clicks: { type: number }
 *               conversions: { type: number }
 *     responses:
 *       201: { description: Analytics logged }
 */
app.get('/analytics', async (req, res) => {
  const logs = await models.getAnalyticsLogs();
  res.json(logs);
});
app.post('/analytics', async (req, res) => {
  const log = await models.createAnalyticsLog(req.body);
  res.status(201).json(log);
});

/**
 * @swagger
 * /analytics/scan:
 *   post:
 *     tags: [Analytics]
 *     summary: Record a QR scan event with geolocation and context
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [campaign_id, scanned_at, coords]
 *             properties:
 *               campaign_id: { type: string }
 *               scanned_at: { type: string, format: date-time }
 *               coords:
 *                 type: object
 *                 properties:
 *                   lat: { type: number }
 *                   lon: { type: number }
 *               city: { type: string }
 *               suburb: { type: string }
 *               region: { type: string }
 *               weather: { type: object }
 *               distance_to_store_m: { type: integer }
 *               nearest_poi: { type: string }
 *               distance_to_poi_m: { type: integer }
 *               user_agent: { type: string }
 *     responses:
 *       201: { description: Scan event recorded }
 */
app.post('/analytics/scan', async (req, res) => {
  let {
    campaign_id,
    scanned_at,
    coords,
    city,
    suburb,
    region,
    weather,
    distance_to_store_m,
    nearest_poi,
    distance_to_poi_m,
    user_agent
  } = req.body;

  if (!campaign_id || !scanned_at || !coords || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') {
    return res.status(400).json({ error: 'Missing required scan data' });
  }

  // Reverse geocode if city/suburb/region not provided
  if (!city || !suburb || !region) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&zoom=18&addressdetails=1`;
      const geoRes = await fetch(url, {
        headers: { 'User-Agent': 'GlassCart/1.0 (contact@glasscart.com)' }
      });
      const geoData = await geoRes.json();
      if (geoData.address) {
        city = city || geoData.address.city || geoData.address.town || geoData.address.village || null;
        suburb = suburb || geoData.address.suburb || geoData.address.neighbourhood || null;
        region = region || geoData.address.state || geoData.address.region || null;
      }
    } catch (err) {
      // If reverse geocoding fails, continue without it
    }
  }

  // Weather enrichment using OpenWeatherMap API
  if (!weather && coords.lat && coords.lon) {
    try {
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=2cea4d95faa29aaba97825222561bbca&units=metric`;
      const weatherRes = await fetch(weatherUrl);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        weather = {
          temp: weatherData.main?.temp,
          feels_like: weatherData.main?.feels_like,
          humidity: weatherData.main?.humidity,
          wind_speed: weatherData.wind?.speed,
          condition: weatherData.weather?.[0]?.main,
          description: weatherData.weather?.[0]?.description
        };
      }
    } catch (err) {
      // If weather API fails, continue without it
    }
  }

  const scan = await models.createScan({
    campaign_id,
    scanned_at,
    lat: coords.lat,
    lon: coords.lon,
    city,
    suburb,
    region,
    weather,
    distance_to_store_m,
    nearest_poi,
    distance_to_poi_m,
    user_agent: user_agent || req.headers['user-agent']
  });

  res.status(201).json(scan);
});

// Example summary endpoint
/**
 * @swagger
 * /analytics/scans/summary/city:
 *   get:
 *     tags: [Analytics]
 *     summary: Get scan counts grouped by city
 *     responses:
 *       200:
 *         description: Scan summary by city
 */
app.get('/analytics/scans/summary/city', async (req, res) => {
  const summary = await models.getScanSummaryByCity();
  res.json(summary);
});

/**
 * @swagger
 * /analytics/scans/summary/campaign/{campaignId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Get all scans for a specific campaign
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of scans for the campaign
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   campaign_id: { type: string }
 *                   scanned_at: { type: string, format: date-time }
 *                   coords:
 *                     type: object
 *                     properties:
 *                       lat: { type: number }
 *                       lon: { type: number }
 *                   city: { type: string }
 *                   suburb: { type: string }
 *                   region: { type: string }
 *                   weather: { type: object }
 *                   distance_to_store_m: { type: integer }
 *                   nearest_poi: { type: string }
 *                   distance_to_poi_m: { type: integer }
 *                   user_agent: { type: string }
 */
app.get('/analytics/scans/summary/campaign/:campaignId', requireRetailerAuth, async (req, res) => {
  const campaignId = req.params.campaignId;
  const scans = await models.getScansByCampaign(campaignId);
  const result = scans.map(scan => ({
    campaign_id: scan.campaign_id,
    scanned_at: scan.scanned_at,
    coords: {
      lat: parseFloat(scan.lat),
      lon: parseFloat(scan.lon)
    },
    city: scan.city,
    suburb: scan.suburb,
    region: scan.region,
    weather: scan.weather,
    distance_to_store_m: scan.distance_to_store_m,
    nearest_poi: scan.nearest_poi,
    distance_to_poi_m: scan.distance_to_poi_m,
    user_agent: scan.user_agent
  }));
  res.json(result);
});

/**
 * @swagger
 * /qrcode/{campaignId}:
 *   get:
 *     tags: [QR]
 *     summary: Get QR code image (PNG or SVG)
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [png, svg] }
 *         description: Image format
 *     responses:
 *       200:
 *         description: QR code image
 *         content:
 *           image/png: {}
 *           image/svg+xml: {}
 */
app.get('/qrcode/:campaignId', async (req, res) => {
  const { campaignId } = req.params;
  const { format } = req.query;
  const campaign = await models.getCampaignById(campaignId);
  if (!campaign) return res.status(404).end();
  const targetUrl = `${BASE_URL}/w/${campaign.qr_code_identifier}`;

  if (format === 'svg') {
    try {
      const svg = await QRCode.toString(targetUrl, { type: 'svg' });
      res.set('Content-Type', 'image/svg+xml');
      res.set('Content-Disposition', `attachment; filename="qr-${campaignId}.svg"`);
      return res.send(svg);
    } catch (err) {
      res.status(500).send('SVG generation failed');
    }
  }

  try {
    const buffer = await QRCode.toBuffer(targetUrl, {
      type: 'png',
      color: {
        dark: '#000000',
        light: '#00000000' // transparent background
      }
    });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="qr-${campaignId}.png"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).send('PNG generation failed');
  }
});

/**
 * @swagger
 * /w/{identifier}:
 *   get:
 *     tags: [QR]
 *     summary: Short-link redirect to product page
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       302: { description: Redirecting to product page }
 */
app.get('/w/:identifier', async (req, res) => {
  const campaign = await models.getCampaignByIdentifier(req.params.identifier);
  if (!campaign) return res.status(404).end();
  return res.redirect(`${FRONTEND_URL}/products/${campaign.product_id}`);
});

/**
 * @swagger
 * /embed/qr/{identifier}:
 *   get:
 *     tags: [QR]
 *     summary: Get embeddable iframe snippet
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: JSON with embed code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 embedCode: { type: string }
 */
app.get('/embed/qr/:identifier', async (req, res) => {
  const snippet = `<iframe src="${BASE_URL}/qrcode/${req.params.identifier}" width="150" height="150" frameborder="0"></iframe>`;
  res.json({ embedCode: snippet });
});

/**
 * @swagger
 * /campaigns/{id}/generate-assets:
 *   post:
 *     tags: [QR]
 *     summary: Generate all media assets for a campaign
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: All asset URLs and codes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrPngUrl: { type: string }
 *                 qrSvgUrl: { type: string }
 *                 shortLink: { type: string }
 *                 embedCode: { type: string }
 */
app.post('/campaigns/:id/generate-assets', async (req, res) => {
  const campaign = await models.getCampaignById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Not found' });
  const id = campaign.id;
  const identifier = campaign.qr_code_identifier;
  const qrPngUrl = `${BASE_URL}/qrcode/${id}?format=png`;
  const qrSvgUrl = `${BASE_URL}/qrcode/${id}?format=svg`;
  const shortLink = `${BASE_URL}/w/${identifier}`;
  const embedCode = `<iframe src="${BASE_URL}/embed/qr/${identifier}" width="150" height="150"></iframe>`;
  res.json({ qrPngUrl, qrSvgUrl, shortLink, embedCode });
});

/**
 * @swagger
 * /retailers:
 *   get:
 *     summary: Get all retailers
 *     tags: [Retailers]
 *     responses:
 *       200:
 *         description: List of retailers
 */
app.get('/retailers', async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE role='retailer' ORDER BY created_at DESC");
  res.json(rows);
});

/**
 * @swagger
 * /retailers/{id}:
 *   get:
 *     summary: Get retailer by ID
 *     tags: [Retailers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Retailer ID
 *     responses:
 *       200:
 *         description: Retailer object
 *       404:
 *         description: Retailer not found
 */
app.get('/retailers/:id', async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE id=$1 AND role='retailer'", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Retailer not found' });
  res.json(rows[0]);
});

/**
 * @swagger
 * /retailers:
 *   post:
 *     summary: Create a retailer
 *     tags: [Retailers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Retailer created
 */
app.post('/retailers', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  try {
    const { rows } = await pool.query(
      "INSERT INTO users(id, name, email, role) VALUES($1, $2, $3, 'retailer') RETURNING *",
      [uuidv4(), name, email]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /retailers/{id}:
 *   put:
 *     summary: Update a retailer
 *     tags: [Retailers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Retailer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Retailer updated
 *       404:
 *         description: Retailer not found
 */
app.put('/retailers/:id', async (req, res) => {
  const { name, email } = req.body;
  const { id } = req.params;
  const { rows } = await pool.query(
    "UPDATE users SET name=COALESCE($2,name), email=COALESCE($3,email) WHERE id=$1 AND role='retailer' RETURNING *",
    [id, name, email]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Retailer not found' });
  res.json(rows[0]);
});

/**
 * @swagger
 * /retailers/{id}:
 *   delete:
 *     summary: Delete a retailer
 *     tags: [Retailers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Retailer ID
 *     responses:
 *       204:
 *         description: Retailer deleted
 *       404:
 *         description: Retailer not found
 */
app.delete('/retailers/:id', async (req, res) => {
  const { id } = req.params;
  const { rowCount } = await pool.query("DELETE FROM users WHERE id=$1 AND role='retailer'", [id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Retailer not found' });
  res.status(204).send();
});

/**
 * @swagger
 * /retailers/login:
 *   post:
 *     summary: Retailer login
 *     tags: [Retailers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: demo
 *               password:
 *                 type: string
 *                 example: demo
 *     responses:
 *       200:
 *         description: JWT token for authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       400:
 *         description: Username and password required
 *       401:
 *         description: Invalid credentials
 */
// Retailer login endpoint
app.post('/retailers/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const { rows } = await models.pool.query("SELECT * FROM users WHERE username=$1 AND role='retailer'", [username]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token });
});

// Middleware to check JWT and retailer role
function requireRetailerAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (payload.role !== 'retailer') return res.status(403).json({ error: 'Retailer access only' });
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Protect all /retailers endpoints
app.use('/retailers', requireRetailerAuth);

// Protect all campaign modification endpoints
app.post('/campaigns', requireRetailerAuth, async (req, res, next) => next());
app.put('/campaigns/:id', requireRetailerAuth, async (req, res, next) => next());
app.delete('/campaigns/:id', requireRetailerAuth, async (req, res, next) => next());

// Protect all product modification endpoints
app.post('/products', requireRetailerAuth, async (req, res, next) => next());
app.put('/products/:id', requireRetailerAuth, async (req, res, next) => next());
app.delete('/products/:id', requireRetailerAuth, async (req, res, next) => next());

// Protect analytics scan summary for campaign to only allow the owning retailer
app.get('/analytics/scans/summary/campaign/:campaignId', requireRetailerAuth, async (req, res, next) => next());

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

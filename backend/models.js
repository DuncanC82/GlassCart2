// index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const models = require('./models');
const QRCode = require('qrcode');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

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
 * /products:
 *   get:
 *     summary: List all products
 *     responses:
 *       200:
 *         description: Array of products
 *   post:
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
app.get('/products', async (req, res) => {
  const products = await models.getAllProducts();
  res.json(products);
});

app.post('/products', async (req, res) => {
  const id = uuidv4();
  const { name, price } = req.body;
  const product = await models.createProduct({ id, name, price });
  res.status(201).json(product);
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
 *     responses:
 *       200: { description: Product found }
 *       404: { description: Not found }
 *   put:
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

app.put('/products/:id', async (req, res) => {
  const { name, price } = req.body;
  const updated = await models.updateProduct(req.params.id, { name, price });
  if (updated) res.json(updated);
  else res.status(404).json({ error: 'Not found' });
});

app.delete('/products/:id', async (req, res) => {
  await models.deleteProduct(req.params.id);
  res.status(204).end();
});

/**
 * @swagger
 * /campaigns:
 *   post:
 *     summary: Create a new campaign
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [advertiser_id, product_id, campaign_name, qr_code_identifier]
 *             properties:
 *               advertiser_id: { type: string }
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
app.post('/campaigns', async (req, res) => {
  const campaign = await models.createCampaign(req.body);
  res.status(201).json(campaign);
});

/**
 * @swagger
 * /orders:
 *   get:
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
 *     summary: Get analytics logs
 *     responses:
 *       200: { description: Array of analytics }
 *   post:
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
 * /qrcode/{campaignId}:
 *   get:
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
    const svg = QRCode.toString(targetUrl, { type: 'svg' });
    res.set('Content-Type', 'image/svg+xml');
    res.set('Content-Disposition', `attachment; filename="qr-${campaignId}.svg"`);
    return res.send(svg);
  }
  const buffer = await QRCode.toBuffer(targetUrl);
  res.set('Content-Type', 'image/png');
  res.set('Content-Disposition', `attachment; filename="qr-${campaignId}.png"`);
  res.send(buffer);
});

/**
 * @swagger
 * /w/{identifier}:
 *   get:
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

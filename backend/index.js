const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const { User, Product, Campaign, Order, Payout, Analytics } = require('./models');
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// DB Connection
mongoose.connect('mongodb://localhost:27017/glasscart', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('DB Error:', err));

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
  const products = await Product.find().populate('distributor_id');
  res.json(products);
});

app.post('/products', async (req, res) => {
  const { distributor_id, name, price, description, image_url, stock_quantity } = req.body;
  if (!distributor_id || !name || !price || !stock_quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const product = new Product({ distributor_id, name, price, description, image_url, stock_quantity });
  await product.save();
  res.status(201).json(product);
});

// Campaigns
app.post('/campaigns', async (req, res) => {
  const { advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location } = req.body;
  if (!advertiser_id || !product_id || !campaign_name || !qr_code_identifier) {
    return res.status(400).json({ error: 'Missing campaign data' });
  }
  const campaign = new Campaign({ advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location });
  await campaign.save();
  res.status(201).json(campaign);
});

// Orders
app.post('/orders', async (req, res) => {
  const { customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address } = req.body;
  if (!customer_id || !product_id || !total_amount || !shipping_address) {
    return res.status(400).json({ error: 'Missing order data' });
  }
  const order = new Order({ customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address });
  await order.save();
  res.status(201).json(order);
});

// Payouts
app.post('/payouts', async (req, res) => {
  const { recipient_id, order_id, amount, type } = req.body;
  if (!recipient_id || !order_id || !amount || !type) {
    return res.status(400).json({ error: 'Missing payout data' });
  }
  const payout = new Payout({ recipient_id, order_id, amount, type });
  await payout.save();
  res.status(201).json(payout);
});

// Analytics
app.post('/analytics', async (req, res) => {
  const { adLocation, format, clicks, conversions } = req.body;
  if (!adLocation || !format) return res.status(400).json({ error: 'Ad location and format required' });
  const log = new Analytics({ adLocation, format, clicks, conversions });
  await log.save();
  res.status(201).json(log);
});

app.get('/analytics', async (req, res) => {
  const logs = await Analytics.find().sort({ time: -1 });
  res.json(logs);
});

// Start
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');


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

module.exports = {
  User,
  Product,
  Campaign,
  Order,
  Payout,
  Analytics
};

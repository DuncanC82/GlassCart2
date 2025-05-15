const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  const client = await pool.connect();
  try {
    // Drop all tables (in correct dependency order)
    await client.query(`
      DROP TABLE IF EXISTS analytics CASCADE;
      DROP TABLE IF EXISTS payouts CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS campaigns CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create tables with both created_at and time columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY,
        distributor_id UUID,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        description TEXT,
        image_url TEXT,
        stock_quantity INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (distributor_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY,
        advertiser_id UUID,
        product_id UUID,
        campaign_name TEXT NOT NULL,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        qr_code_identifier TEXT,
        commission_percent INTEGER,
        location TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (advertiser_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY,
        customer_id UUID,
        product_id UUID,
        campaign_id UUID,
        quantity INTEGER,
        total_amount NUMERIC,
        commission_amount NUMERIC,
        shipping_address TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        time TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (customer_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
      );
      CREATE TABLE IF NOT EXISTS payouts (
        id UUID PRIMARY KEY,
        recipient_id UUID,
        order_id UUID,
        amount NUMERIC,
        type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        time TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (recipient_id) REFERENCES users(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
      );
      CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY,
        adlocation TEXT,
        format TEXT,
        clicks INTEGER,
        conversions INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        time TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create users
    const distributorId = uuidv4();
    const advertiserId = uuidv4();
    const customerId = uuidv4();

    await client.query(
      `INSERT INTO users (id, name, email, role) VALUES
      ($1, $2, $3, $4),
      ($5, $6, $7, $8),
      ($9, $10, $11, $12)`,
      [
        distributorId, 'Kathmandu', 'distributor@kathmandu.co.nz', 'distributor',
        advertiserId, 'Go Media', 'ads@gomedia.nz', 'advertiser',
        customerId, 'Jane Doe', 'jane@example.com', 'customer'
      ]
    );

    // Create products
    const product1Id = uuidv4();
    const product2Id = uuidv4();
    const product3Id = uuidv4();

    await client.query(
      `INSERT INTO products (id, distributor_id, name, price, description, image_url, stock_quantity) VALUES
      ($1, $2, $3, $4, $5, $6, $7),
      ($8, $2, $9, $10, $11, $12, $13),
      ($14, $2, $15, $16, $17, $18, $19)`,
      [
        product1Id, distributorId, 'GlassCart QR T-Shirt', 39.99, 'Premium cotton t-shirt with GlassCart QR code.', 'https://via.placeholder.com/120x120?text=QR+Tee', 50,
        product2Id, 'GlassCart Water Bottle', 24.99, 'Stainless steel bottle with GlassCart branding.', 'https://via.placeholder.com/120x120?text=Bottle', 100,
        product3Id, 'GlassCart Tote Bag', 14.99, 'Eco-friendly tote bag for everyday use.', 'https://via.placeholder.com/120x120?text=Tote+Bag', 75
      ]
    );

    // Create campaign
    const campaignId = uuidv4();
    await client.query(
      `INSERT INTO campaigns (id, advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        campaignId, advertiserId, product1Id, 'Winter QR Campaign',
        new Date(), new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        'winter_qr_2025', 10, 'Wellington Bus Stop'
      ]
    );

    // Create order
    const orderId = uuidv4();
    await client.query(
      `INSERT INTO orders (id, customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        orderId, customerId, product1Id, campaignId, 2, 79.98, 7.99, '123 Queen Street, Auckland'
      ]
    );

    // Create payouts
    await client.query(
      `INSERT INTO payouts (id, recipient_id, order_id, amount, type) VALUES
      ($1, $2, $3, $4, $5),
      ($6, $7, $3, $8, $9)`,
      [
        uuidv4(), advertiserId, orderId, 7.99, 'advertiser_commission',
        uuidv4(), distributorId, 71.99, 'distributor_revenue'
      ]
    );

    // Create analytics logs
    await client.query(
      `INSERT INTO analytics (id, adlocation, format, clicks, conversions) VALUES
      ($1, $2, $3, $4, $5),
      ($6, $7, $8, $9, $10)`,
      [
        uuidv4(), 'Wellington Bus Stop', 'Static QR', 120, 5,
        uuidv4(), 'Auckland CBD Window', 'Static QR', 89, 2
      ]
    );

    console.log('✅ Seed data inserted successfully!');
  } catch (err) {
    console.error('❌ Error inserting seed data:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();

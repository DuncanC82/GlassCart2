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
      DROP TABLE IF EXISTS scans CASCADE;
      DROP TABLE IF EXISTS analytics CASCADE;
      DROP TABLE IF EXISTS payouts CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS campaigns CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create tables
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
        FOREIGN KEY (recipient_id) REFERENCES users(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
      );
      CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY,
        adlocation TEXT,
        format TEXT,
        clicks INTEGER,
        conversions INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS scans (
        id UUID PRIMARY KEY,
        campaign_id UUID REFERENCES campaigns(id),
        scanned_at TIMESTAMPTZ NOT NULL,
        lat NUMERIC NOT NULL,
        lon NUMERIC NOT NULL,
        city TEXT,
        suburb TEXT,
        region TEXT,
        weather JSONB,
        distance_to_store_m INT,
        nearest_poi TEXT,
        distance_to_poi_m INT,
        user_agent TEXT
      );
    `);

    // Seed users
    const users = [
      { id: uuidv4(), name: 'Kathmandu', email: 'distributor@kathmandu.co.nz', role: 'distributor' },
      { id: uuidv4(), name: 'Go Media', email: 'ads@gomedia.nz', role: 'advertiser' },
      { id: uuidv4(), name: 'Jane Doe', email: 'jane@example.com', role: 'customer' },
      { id: uuidv4(), name: 'John Smith', email: 'john@smith.com', role: 'customer' },
      { id: uuidv4(), name: 'Retailer A', email: 'retailerA@shop.com', role: 'retailer' }
    ];
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)`,
        [u.id, u.name, u.email, u.role]
      );
    }

    // Seed products
    const products = [
      {
        id: uuidv4(),
        distributor_id: users[0].id,
        name: 'GlassCart QR T-Shirt',
        price: 39.99,
        description: 'Premium cotton t-shirt with GlassCart QR code.',
        image_url: 'https://via.placeholder.com/120x120?text=QR+Tee',
        stock_quantity: 50
      },
      {
        id: uuidv4(),
        distributor_id: users[0].id,
        name: 'GlassCart Water Bottle',
        price: 24.99,
        description: 'Stainless steel bottle with GlassCart branding.',
        image_url: 'https://via.placeholder.com/120x120?text=Bottle',
        stock_quantity: 100
      },
      {
        id: uuidv4(),
        distributor_id: users[0].id,
        name: 'GlassCart Tote Bag',
        price: 14.99,
        description: 'Eco-friendly tote bag for everyday use.',
        image_url: 'https://via.placeholder.com/120x120?text=Tote+Bag',
        stock_quantity: 75
      },
      {
        id: uuidv4(),
        distributor_id: users[0].id,
        name: 'GlassCart Cap',
        price: 19.99,
        description: 'Stylish cap with GlassCart logo.',
        image_url: 'https://via.placeholder.com/120x120?text=Cap',
        stock_quantity: 60
      }
    ];
    for (const p of products) {
      await client.query(
        `INSERT INTO products (id, distributor_id, name, price, description, image_url, stock_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, p.distributor_id, p.name, p.price, p.description, p.image_url, p.stock_quantity]
      );
    }

    // Seed campaigns
    const campaigns = [
      {
        id: uuidv4(),
        advertiser_id: users[1].id,
        product_id: products[0].id,
        campaign_name: 'Winter QR Campaign',
        start_date: new Date(),
        end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        qr_code_identifier: 'winter_qr_2025',
        commission_percent: 10,
        location: 'Wellington Bus Stop'
      },
      {
        id: uuidv4(),
        advertiser_id: users[1].id,
        product_id: products[1].id,
        campaign_name: 'Summer Bottle Promo',
        start_date: new Date(),
        end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
        qr_code_identifier: 'summer_bottle_2025',
        commission_percent: 12,
        location: 'Auckland CBD Window'
      },
      {
        id: uuidv4(),
        advertiser_id: users[1].id,
        product_id: products[2].id,
        campaign_name: 'Eco Tote Drive',
        start_date: new Date(),
        end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
        qr_code_identifier: 'eco_tote_2025',
        commission_percent: 15,
        location: 'Christchurch Mall'
      }
    ];
    for (const c of campaigns) {
      await client.query(
        `INSERT INTO campaigns (id, advertiser_id, product_id, campaign_name, start_date, end_date, qr_code_identifier, commission_percent, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [c.id, c.advertiser_id, c.product_id, c.campaign_name, c.start_date, c.end_date, c.qr_code_identifier, c.commission_percent, c.location]
      );
    }

    // Seed orders
    const orders = [
      {
        id: uuidv4(),
        customer_id: users[2].id,
        product_id: products[0].id,
        campaign_id: campaigns[0].id,
        quantity: 2,
        total_amount: 79.98,
        commission_amount: 7.99,
        shipping_address: '123 Queen Street, Auckland'
      },
      {
        id: uuidv4(),
        customer_id: users[3].id,
        product_id: products[1].id,
        campaign_id: campaigns[1].id,
        quantity: 1,
        total_amount: 24.99,
        commission_amount: 3.00,
        shipping_address: '456 Cuba Street, Wellington'
      },
      {
        id: uuidv4(),
        customer_id: users[2].id,
        product_id: products[2].id,
        campaign_id: campaigns[2].id,
        quantity: 3,
        total_amount: 44.97,
        commission_amount: 6.75,
        shipping_address: '789 Riccarton Road, Christchurch'
      }
    ];
    for (const o of orders) {
      await client.query(
        `INSERT INTO orders (id, customer_id, product_id, campaign_id, quantity, total_amount, commission_amount, shipping_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [o.id, o.customer_id, o.product_id, o.campaign_id, o.quantity, o.total_amount, o.commission_amount, o.shipping_address]
      );
    }

    // Seed payouts
    const payouts = [
      {
        id: uuidv4(),
        recipient_id: users[1].id,
        order_id: orders[0].id,
        amount: 7.99,
        type: 'advertiser_commission'
      },
      {
        id: uuidv4(),
        recipient_id: users[0].id,
        order_id: orders[0].id,
        amount: 71.99,
        type: 'distributor_revenue'
      },
      {
        id: uuidv4(),
        recipient_id: users[1].id,
        order_id: orders[1].id,
        amount: 3.00,
        type: 'advertiser_commission'
      },
      {
        id: uuidv4(),
        recipient_id: users[0].id,
        order_id: orders[1].id,
        amount: 21.99,
        type: 'distributor_revenue'
      }
    ];
    for (const p of payouts) {
      await client.query(
        `INSERT INTO payouts (id, recipient_id, order_id, amount, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.id, p.recipient_id, p.order_id, p.amount, p.type]
      );
    }

    // Seed analytics logs
    const analytics = [
      {
        id: uuidv4(),
        adlocation: 'Wellington Bus Stop',
        format: 'Static QR',
        clicks: 120,
        conversions: 5
      },
      {
        id: uuidv4(),
        adlocation: 'Auckland CBD Window',
        format: 'Static QR',
        clicks: 89,
        conversions: 2
      },
      {
        id: uuidv4(),
        adlocation: 'Christchurch Mall',
        format: 'Poster',
        clicks: 150,
        conversions: 10
      }
    ];
    for (const a of analytics) {
      await client.query(
        `INSERT INTO analytics (id, adlocation, format, clicks, conversions)
         VALUES ($1, $2, $3, $4, $5)`,
        [a.id, a.adlocation, a.format, a.clicks, a.conversions]
      );
    }

    // Seed scans
    const scans = [
      {
        id: uuidv4(),
        campaign_id: campaigns[0].id,
        scanned_at: new Date(),
        lat: -41.2865,
        lon: 174.7762,
        city: 'Wellington',
        suburb: 'Te Aro',
        region: 'Wellington',
        weather: { temp: 13, condition: 'Cloudy' },
        distance_to_store_m: 50,
        nearest_poi: 'Bus Stop',
        distance_to_poi_m: 10,
        user_agent: 'Mozilla/5.0'
      },
      {
        id: uuidv4(),
        campaign_id: campaigns[1].id,
        scanned_at: new Date(),
        lat: -36.8485,
        lon: 174.7633,
        city: 'Auckland',
        suburb: 'CBD',
        region: 'Auckland',
        weather: { temp: 18, condition: 'Sunny' },
        distance_to_store_m: 100,
        nearest_poi: 'Mall',
        distance_to_poi_m: 30,
        user_agent: 'Mozilla/5.0'
      },
      {
        id: uuidv4(),
        campaign_id: campaigns[2].id,
        scanned_at: new Date(),
        lat: -43.5321,
        lon: 172.6362,
        city: 'Christchurch',
        suburb: 'Riccarton',
        region: 'Canterbury',
        weather: { temp: 10, condition: 'Rain' },
        distance_to_store_m: 200,
        nearest_poi: 'School',
        distance_to_poi_m: 100,
        user_agent: 'Mozilla/5.0'
      }
    ];
    for (const s of scans) {
      await client.query(
        `INSERT INTO scans (
          id, campaign_id, scanned_at, lat, lon, city, suburb, region, weather,
          distance_to_store_m, nearest_poi, distance_to_poi_m, user_agent
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )`,
        [
          s.id, s.campaign_id, s.scanned_at, s.lat, s.lon, s.city, s.suburb, s.region,
          JSON.stringify(s.weather), s.distance_to_store_m, s.nearest_poi, s.distance_to_poi_m, s.user_agent
        ]
      );
    }

    console.log('✅ Rich seed data inserted successfully!');
  } catch (err) {
    console.error('❌ Error inserting seed data:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();

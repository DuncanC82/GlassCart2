// seed.js
// A richer seed script for GlassCart, with deeper, interlinked examples
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.NODE_ENV === 'production' ? { ssl: { rejectUnauthorized: false } } : {})
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('▶️ Dropping and recreating tables…');
    await client.query(`
      DROP TABLE IF EXISTS scans CASCADE;
      DROP TABLE IF EXISTS analytics CASCADE;
      DROP TABLE IF EXISTS payouts CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS campaigns CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS users CASCADE;

      CREATE TABLE users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK(role IN ('customer','advertiser','distributor','retailer','admin')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE products (
        id UUID PRIMARY KEY,
        distributor_id UUID REFERENCES users(id),
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        description TEXT,
        image_url TEXT,
        stock_quantity INTEGER NOT NULL,
        product_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE campaigns (
        id UUID PRIMARY KEY,
        retailer_id UUID REFERENCES users(id),
        product_id   UUID REFERENCES products(id),
        campaign_name TEXT NOT NULL,
        start_date    TIMESTAMPTZ,
        end_date      TIMESTAMPTZ,
        qr_code_identifier TEXT NOT NULL UNIQUE,
        commission_percent INTEGER NOT NULL,
        location      TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE orders (
        id UUID PRIMARY KEY,
        customer_id UUID REFERENCES users(id),
        product_id  UUID REFERENCES products(id),
        campaign_id UUID REFERENCES campaigns(id),
        quantity    INTEGER NOT NULL,
        total_amount NUMERIC NOT NULL,
        commission_amount NUMERIC NOT NULL,
        shipping_address TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE payouts (
        id UUID PRIMARY KEY,
        recipient_id UUID REFERENCES users(id),
        order_id     UUID REFERENCES orders(id),
        amount       NUMERIC NOT NULL,
        type         TEXT NOT NULL CHECK(type IN ('advertiser_commission','distributor_revenue')),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE analytics (
        id UUID PRIMARY KEY,
        adlocation TEXT NOT NULL,
        format     TEXT NOT NULL,
        clicks     INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE scans (
        id UUID PRIMARY KEY,
        campaign_id UUID REFERENCES campaigns(id),
        scanned_at  TIMESTAMPTZ NOT NULL,
        lat         NUMERIC NOT NULL,
        lon         NUMERIC NOT NULL,
        city        TEXT,
        suburb      TEXT,
        region      TEXT,
        weather     JSONB,
        distance_to_store_m INTEGER,
        nearest_poi TEXT,
        distance_to_poi_m INTEGER,
        user_agent  TEXT,
        converted_order_id UUID REFERENCES orders(id),
        device_type TEXT,
        referrer    TEXT,
        scan_source TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('▶️ Seeding users…');
    const users = [
      { name: 'Kathmandu', email: 'retailer@kathmandu.co.nz', role: 'retailer' },
      { name: 'Sample Distributor', email: 'dist@sample.com', role: 'distributor' },
      { name: 'OutDoor Ads Ltd',      email: 'ads@outdoorads.co.nz', role: 'advertiser' },
      { name: 'UrbanMedia Agency',    email: 'ads@urbanmedia.nz',   role: 'advertiser' },
      { name: 'Jane Customer',        email: 'jane@customer.com',    role: 'customer' },
      { name: 'John Shopper',         email: 'john@shopper.net',     role: 'customer' },
      { name: 'Mall Admin',           email: 'admin@mall.com',       role: 'admin' }
    ].map(u => ({ id: uuidv4(), ...u }));

    for (const u of users) {
      await client.query(
        `INSERT INTO users(id,name,email,role) VALUES($1,$2,$3,$4)`,
        [u.id, u.name, u.email, u.role]
      );
    }

    console.log('▶️ Seeding products…');
    const products = [
      {
        distributor_id: users[0].id,
        name: 'Hybrid Trolley v5 - 70L - Black Stingray',
        price: 399.98,
        description: 'A durable, versatile travel trolley for adventure and business travel.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/b0293_o4w_hybrid_trolley_v5_70l_b_a_600x600.jpg?v=1744066168',
        stock_quantity: 50,
        product_url: 'https://www.kathmandu.co.nz/products/hybrid-trolley-v5-70l-black-stingray'
      },
      {
        distributor_id: users[0].id,
        name: 'Hybrid Trolley v5 - 70L - Pure Navy',
        price: 399.98,
        description: 'Spacious and stylish trolley in Pure Navy for all your travel needs.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/b0293_oje_hybrid_trolley_a_600x600.jpg?v=1744066166',
        stock_quantity: 40,
        product_url: 'https://www.kathmandu.co.nz/products/hybrid-trolley-v5-70l-pure-navy'
      },
      {
        distributor_id: users[0].id,
        name: "Women's Andulo 2-layer Rain Jacket - Black",
        price: 199.98,
        description: 'Waterproof, windproof, and breathable rain jacket for women.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/a1066_902_andulo_womens_rain_jacket_v3_b_a_600x600.jpg?v=1744064620',
        stock_quantity: 100,
        product_url: 'https://www.kathmandu.co.nz/products/andulo-wmns-rain-jacket-v3-black'
      },
      {
        distributor_id: users[0].id,
        name: "Women's Epiq Hooded Down Jacket v2 - Black",
        price: 299.98,
        description: 'Warm, lightweight, and packable down jacket for women.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/a0956_902_epiq_womens_hooded_down_jacket_v2_f_600x600.jpg?v=1744584404',
        stock_quantity: 80,
        product_url: 'https://www.kathmandu.co.nz/products/epiq-wmns-hooded-down-jacket-v2-black'
      },
      {
        distributor_id: users[0].id,
        name: "Men's Federate Travel Pants - Black",
        price: 149.98,
        description: 'Versatile, quick-dry travel pants for men.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/a1127_902_federate_mens_travel_pants_a_600x600.jpg?v=1744064620',
        stock_quantity: 120,
        product_url: 'https://www.kathmandu.co.nz/products/federate-mens-travel-pants-black'
      },
      {
        distributor_id: users[0].id,
        name: 'Litehaul 38L Carry-On Pack - Black',
        price: 249.98,
        description: 'Carry-on travel pack with multiple compartments and laptop sleeve.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/b0222_902_litehaul_38l_carry_on_pack_a_600x600.jpg?v=1744066168',
        stock_quantity: 60,
        product_url: 'https://www.kathmandu.co.nz/products/litehaul-38l-carry-on-pack-black'
      },
      {
        distributor_id: users[0].id,
        name: 'Flinders Merino Wool Beanie - Charcoal',
        price: 39.98,
        description: 'Soft, warm merino wool beanie for cold weather.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/a1128_901_flinders_merino_wool_beanie_a_600x600.jpg?v=1744064620',
        stock_quantity: 200,
        product_url: 'https://www.kathmandu.co.nz/products/flinders-merino-wool-beanie-charcoal'
      },
      {
        distributor_id: users[0].id,
        name: 'Pocket It Rain Jacket - Black',
        price: 99.98,
        description: 'Lightweight, packable rain jacket for everyday use.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/a1129_902_pocket_it_rain_jacket_a_600x600.jpg?v=1744064620',
        stock_quantity: 150,
        product_url: 'https://www.kathmandu.co.nz/products/pocket-it-rain-jacket-black'
      },
      {
        distributor_id: users[0].id,
        name: 'XT Series 70L Backpack - Black',
        price: 349.98,
        description: 'Technical hiking backpack with adjustable harness and rain cover.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/b0223_902_xt_series_70l_backpack_a_600x600.jpg?v=1744066168',
        stock_quantity: 30,
        product_url: 'https://www.kathmandu.co.nz/products/xt-series-70l-backpack-black'
      },
      {
        distributor_id: users[0].id,
        name: 'KMDLogo Organic Cotton T-Shirt - White',
        price: 49.98,
        description: 'Classic fit organic cotton t-shirt with Kathmandu logo.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/a1130_100_kmdlogo_organic_cotton_tshirt_a_600x600.jpg?v=1744064620',
        stock_quantity: 180,
        product_url: 'https://www.kathmandu.co.nz/products/kmdlogo-organic-cotton-t-shirt-white'
      },
      {
        distributor_id: users[0].id,
        name: 'Straw Lid Insulated Bottle - 950 ml - Vanilla',
        price: 59.98,
        description: 'Double-walled insulated bottle with straw lid. Colour: Vanilla. Unisex. Member price: $41.99.',
        image_url: 'https://cdn.shopify.com/s/files/1/0919/0116/5858/files/b1488_427_straw_lid_insulated_bottle_950ml_a_600x600.jpg?v=1747267944',
        stock_quantity: 1753,
        product_url: 'https://www.kathmandu.co.nz/products/straw-lid-insulated-bottle-950-ml-vanilla'
      }
    ].map(p => ({ id: uuidv4(), ...p }));

    for (const p of products) {
      await client.query(
        `INSERT INTO products(id,distributor_id,name,price,description,image_url,stock_quantity,product_url)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.id,p.distributor_id,p.name,p.price,p.description,p.image_url,p.stock_quantity,p.product_url]
      );
    }

    console.log('▶️ Seeding campaigns…');
    const campaigns = [
      {
        retailer_id: users[0].id, // Kathmandu as retailer
        product_id:    products[0].id,
        campaign_name: 'Hybrid Trolley v5 - Black Stingray QR',
        start_date:    new Date('2025-06-01T00:00Z'),
        end_date:      new Date('2025-07-01T00:00Z'),
        qr_code_identifier: 'kathmandu_black_stingray',
        commission_percent: 10,
        location:      'Wellington Storefront',
        campaign_url:  products[0].product_url
      },
      {
        retailer_id: users[0].id,
        product_id:    products[1].id,
        campaign_name: 'Hybrid Trolley v5 - Pure Navy QR',
        start_date:    new Date('2025-06-01T00:00Z'),
        end_date:      new Date('2025-07-01T00:00Z'),
        qr_code_identifier: 'kathmandu_pure_navy',
        commission_percent: 10,
        location:      'Auckland Storefront',
        campaign_url:  products[1].product_url
      },
      {
        retailer_id: users[0].id,
        product_id:    products[2].id,
        campaign_name: "Women's Andulo Rain Jacket QR",
        start_date:    new Date('2025-06-01T00:00Z'),
        end_date:      new Date('2025-07-01T00:00Z'),
        qr_code_identifier: 'kathmandu_andulo_jacket',
        commission_percent: 10,
        location:      'Christchurch Storefront',
        campaign_url:  products[2].product_url
      },
      {
        retailer_id: users[0].id,
        product_id:    products[3].id,
        campaign_name: 'Cap Off Season Sale',
        start_date:    new Date('2025-08-01T00:00Z'),
        end_date:      new Date('2025-09-01T00:00Z'),
        qr_code_identifier: 'cap_sale',
        commission_percent: 8,
        location:      'Dunedin Main Street'
      }
    ].map(c => ({ id: uuidv4(), ...c }));

    for (const c of campaigns) {
      await client.query(
        `INSERT INTO campaigns(
           id,retailer_id,product_id,campaign_name,
           start_date,end_date,qr_code_identifier,
           commission_percent,location
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          c.id,c.retailer_id,c.product_id,c.campaign_name,
          c.start_date,c.end_date,c.qr_code_identifier,
          c.commission_percent,c.location
        ]
      );
    }

    console.log('▶️ Seeding orders…');
    const orders = [
      // Jane buys 2 T-Shirts via Winter Warmth Tee
      {
        customer_id: users[3].id,
        product_id:  products[0].id,
        campaign_id: campaigns[0].id,
        quantity:    2,
        total_amount: 79.98,
        commission_amount: 7.99,
        shipping_address: '123 Queen St, Wellington'
      },
      // John buys 1 Bottle via Summer Hydrate
      {
        customer_id: users[4].id,
        product_id:  products[1].id,
        campaign_id: campaigns[1].id,
        quantity:    1,
        total_amount: 24.99,
        commission_amount: 3.00,
        shipping_address: '456 K Road, Auckland'
      },
      // Jane buys 3 Totes directly (no campaign)
      {
        customer_id: users[3].id,
        product_id:  products[2].id,
        campaign_id: null,
        quantity:    3,
        total_amount: 44.97,
        commission_amount: 0,
        shipping_address: '123 Queen St, Wellington'
      }
    ].map(o => ({ id: uuidv4(), created_at: new Date(), ...o }));

    for (const o of orders) {
      await client.query(
        `INSERT INTO orders(
           id,customer_id,product_id,campaign_id,
           quantity,total_amount,commission_amount,shipping_address,created_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          o.id,o.customer_id,o.product_id,o.campaign_id,
          o.quantity,o.total_amount,o.commission_amount,
          o.shipping_address,o.created_at
        ]
      );
    }

    console.log('▶️ Seeding payouts…');
    const payouts = [
      // For Jane’s T-Shirt order
      { recipient_id: users[1].id, order_id: orders[0].id, amount: 7.99, type: 'advertiser_commission' },
      { recipient_id: users[0].id, order_id: orders[0].id, amount: 71.99, type: 'distributor_revenue' },
      // For John’s Bottle order
      { recipient_id: users[1].id, order_id: orders[1].id, amount: 3.00, type: 'advertiser_commission' },
      { recipient_id: users[0].id, order_id: orders[1].id, amount: 21.99, type: 'distributor_revenue' },
      // Direct Tote purchase (no commission)
      { recipient_id: users[0].id, order_id: orders[2].id, amount: 44.97, type: 'distributor_revenue' }
    ].map(p => ({ id: uuidv4(), created_at: new Date(), ...p }));

    for (const p of payouts) {
      await client.query(
        `INSERT INTO payouts(
           id,recipient_id,order_id,amount,type,created_at
         ) VALUES($1,$2,$3,$4,$5,$6)`,
        [p.id,p.recipient_id,p.order_id,p.amount,p.type,p.created_at]
      );
    }

    console.log('▶️ Seeding analytics logs…');
    const analytics = [
      { adlocation: 'Wellington Bus Stop', format: 'Static QR', clicks: 120, conversions: 5 },
      { adlocation: 'Auckland CBD Window', format: 'Static QR', clicks: 95, conversions: 4 },
      { adlocation: 'Christchurch Mall', format: 'Poster', clicks: 200, conversions: 15 },
      { adlocation: 'Dunedin Main Street', format: 'Digital Billboard', clicks: 80, conversions: 2 }
    ].map(a => ({ id: uuidv4(), created_at: new Date(), ...a }));

    for (const a of analytics) {
      await client.query(
        `INSERT INTO analytics(id,adlocation,format,clicks,conversions,created_at)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [a.id,a.adlocation,a.format,a.clicks,a.conversions,a.created_at]
      );
    }

    console.log('▶️ Seeding scan events…');
    const scans = [
      // Jane scans T-Shirt QR in Wellington
      {
        campaign_id:   campaigns[0].id,
        scanned_at:    new Date('2025-05-10T18:30:00Z'),
        lat:           -41.2865, lon: 174.7762,
        city:          'Wellington', suburb: 'Te Aro', region: 'Wellington',
        weather:       { temp: 12, condition: 'Cloudy' },
        distance_to_store_m:  40, nearest_poi: 'Bus Stop', distance_to_poi_m: 10,
        user_agent:    'Mozilla/5.0 (iPhone)',
        converted_order_id: orders[0].id,
        device_type:   'mobile', referrer: 'fb_campaign', scan_source: 'QR'
      },
      // John scans Bottle QR on a sunny Auckland afternoon
      {
        campaign_id:   campaigns[1].id,
        scanned_at:    new Date('2025-11-05T14:00:00Z'),
        lat:           -36.8485, lon: 174.7633,
        city:          'Auckland', suburb: 'CBD', region: 'Auckland',
        weather:       { temp: 25, condition: 'Sunny' },
        distance_to_store_m: 120, nearest_poi: 'Mall', distance_to_poi_m: 30,
        user_agent:    'Mozilla/5.0 (Android)',
        converted_order_id: orders[1].id,
        device_type:   'mobile', referrer: 'ig_ad',     scan_source: 'QR'
      },
      // Anonymous scan at Christchurch Mall (no conversion)
      {
        campaign_id:   campaigns[2].id,
        scanned_at:    new Date('2025-07-20T11:00:00Z'),
        lat:           -43.5321, lon: 172.6362,
        city:          'Christchurch', suburb: 'Riccarton', region: 'Canterbury',
        weather:       { temp: 10, condition: 'Rain' },
        distance_to_store_m: 220, nearest_poi: 'School', distance_to_poi_m: 100,
        user_agent:    'Mozilla/5.0 (Windows NT)',
        converted_order_id: null,
        device_type:   'desktop', referrer: 'twitter', scan_source: 'QR'
      },
      // Evening scan outside Dunedin store after hours
      {
        campaign_id:   campaigns[3].id,
        scanned_at:    new Date('2025-08-15T21:30:00Z'),
        lat:           -45.8742, lon: 170.5036,
        city:          'Dunedin', suburb: 'City Centre', region: 'Otago',
        weather:       { temp: 8,  condition: 'Clear' },
        distance_to_store_m:  80, nearest_poi: 'Pub', distance_to_poi_m: 20,
        user_agent:    'Mozilla/5.0 (iPad)',
        converted_order_id: null,
        device_type:   'tablet', referrer: 'direct', scan_source: 'QR'
      }
    ].map(s => ({ id: uuidv4(), created_at: new Date(), ...s }));

    for (const s of scans) {
      await client.query(
        `INSERT INTO scans(
          id,campaign_id,scanned_at,lat,lon,
          city,suburb,region,weather,
          distance_to_store_m,nearest_poi,distance_to_poi_m,
          user_agent,converted_order_id,device_type,referrer,scan_source,created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15,$16,$17,$18
        )`,
        [
          s.id,s.campaign_id,s.scanned_at,s.lat,s.lon,
          s.city,s.suburb,s.region,JSON.stringify(s.weather),
          s.distance_to_store_m,s.nearest_poi,s.distance_to_poi_m,
          s.user_agent,s.converted_order_id,s.device_type,s.referrer,s.scan_source,s.created_at
        ]
      );
    }

    console.log('✅ Deep seed complete!');
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

/*
Summary of recent backend changes for GlassCart:

- The database schema and seed data were upgraded for richer analytics and e-commerce tracking.
- The `scans` table now stores detailed info for every QR scan, including:
    - Geo location (lat/lon, city, suburb, region)
    - Weather at time of scan
    - Device type, user agent, referrer, scan source (QR, NFC, etc)
    - Whether the scan led to a conversion (linked order)
    - Proximity to store and points of interest
- New endpoints let you fetch both summary and detailed analytics per campaign.
- The seed script now creates realistic, interlinked demo data for users, products, campaigns, orders, payouts, analytics, and scans.
- Swagger docs now group endpoints by Products, Campaigns, Orders, Payouts, Analytics, and QR for easier navigation.
- The backend is ready for advanced dashboards: you can analyze scan locations, conversion rates, weather impact, device usage, and more.

This makes GlassCart a much more powerful platform for tracking and optimizing QR-driven commerce!
*/

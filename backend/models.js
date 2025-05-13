const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Example: Product model (repeat for other models as needed)

async function getAllProducts() {
  const res = await pool.query('SELECT * FROM products');
  return res.rows;
}

async function getProductById(id) {
  const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return res.rows[0];
}

async function createProduct({ id, name, price }) {
  const res = await pool.query(
    'INSERT INTO products (id, name, price) VALUES ($1, $2, $3) RETURNING *',
    [id, name, price]
  );
  return res.rows[0];
}

async function updateProduct(id, { name, price }) {
  const res = await pool.query(
    'UPDATE products SET name = $1, price = $2 WHERE id = $3 RETURNING *',
    [name, price, id]
  );
  return res.rows[0];
}

async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
  // Add other model helpers here
};

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const seedData = require('./utils/seed');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Seed Route
app.post('/api/seed', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Seeding database is disabled in production.' });
  }
  try {
    await seedData();
    res.json({ success: true, message: 'Database seeded successfully with growth opportunities.' });
  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Register API Routes
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/agent', require('./routes/agent'));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Auto-seed database on first startup if no products exist
  const Product = require('./models/Product');
  Product.countDocuments().then(count => {
    if (count === 0) {
      console.log('No products found. Auto-seeding database...');
      seedData().catch(err => console.error('Auto-seeding failed:', err.message));
    }
  });
});

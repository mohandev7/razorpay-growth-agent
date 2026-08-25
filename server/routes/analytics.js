const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

router.get('/summary', async (req, res) => {
  try {
    const orders = await Order.find({});
    const products = await Product.find({});
    const customers = await Customer.find({});

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Calculate top products
    const productSalesMap = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const prodId = item.productId.toString();
        productSalesMap[prodId] = (productSalesMap[prodId] || 0) + item.quantity;
      });
    });

    const topProducts = Object.keys(productSalesMap).map(id => {
      const prod = products.find(p => p._id.toString() === id);
      return {
        name: prod ? prod.name : 'Unknown Product',
        sales: productSalesMap[id],
        revenue: (prod ? prod.price : 0) * productSalesMap[id]
      };
    }).sort((a, b) => b.sales - a.sales).slice(0, 3);

    // Sales over time (simulate 7 days chart data based on orders)
    const salesOverTime = Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - idx));
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const dayOrders = orders.filter(o => {
        const oDate = new Date(o.createdAt);
        return oDate.toDateString() === date.toDateString();
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      return { name: dateStr, sales: dayRevenue };
    });

    res.json({
      success: true,
      metrics: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        conversionRate: 4.8 // Seed conversion rate
      },
      topProducts,
      salesOverTime
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

module.exports = router;

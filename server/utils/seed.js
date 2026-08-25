const mongoose = require('mongoose');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');

const seedData = async () => {
  // Clear collections
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await Order.deleteMany({});
  await Campaign.deleteMany({});
  await Message.deleteMany({});

  console.log('Database cleared.');

  // Create products
  const products = await Product.create([
    {
      name: 'Premium Espresso Machine',
      description: '15-bar Italian pump espresso maker with milk frothing wand.',
      price: 24999,
      category: 'Equipment',
      sku: 'EQ-ESP-01',
      stock: 15
    },
    {
      name: 'Smart Coffee Grinder',
      description: 'Conical burr coffee grinder with 30 precise grind settings.',
      price: 5499,
      category: 'Equipment',
      sku: 'EQ-GRD-02',
      stock: 25
    },
    {
      name: 'Organic Dark Roast Beans (1kg)',
      description: 'Rich, bold organic dark roast whole beans with chocolate undertones.',
      price: 1200,
      category: 'Beans',
      sku: 'BN-DRK-03',
      stock: 100
    },
    {
      name: 'Ethiopian Single Origin Beans (1kg)',
      description: 'Light-medium roast with floral notes and citrus acidity.',
      price: 1500,
      category: 'Beans',
      sku: 'BN-ETH-04',
      stock: 80
    }
  ]);

  const [espressoMachine, grinder, darkRoast, ethiopian] = products;

  // Create customers
  const customers = await Customer.create([
    { name: 'Aditya Sharma', email: 'aditya.sharma@example.com', phone: '9876543210' },
    { name: 'Priya Patel', email: 'priya.patel@example.com', phone: '9812345678' },
    { name: 'Rohan Mehta', email: 'rohan.mehta@example.com', phone: '9765432109' },
    { name: 'Sneha Reddy', email: 'sneha.reddy@example.com', phone: '9654321098' },
    { name: 'Vikram Singh', email: 'vikram.singh@example.com', phone: '9543210987' },
    { name: 'Ananya Rao', email: 'ananya.rao@example.com', phone: '9432109876' },
    { name: 'Amit Kumar', email: 'amit.kumar@example.com', phone: '9321098765' }
  ]);

  // Create orders
  // 5 high-value customers bought the Espresso Machine but NO beans (Opportunity!)
  const orders = [
    // Aditya Sharma bought espresso machine
    {
      customerId: customers[0]._id,
      items: [{ productId: espressoMachine._id, quantity: 1, price: espressoMachine.price }],
      totalAmount: espressoMachine.price,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
    },
    // Priya Patel bought espresso machine
    {
      customerId: customers[1]._id,
      items: [{ productId: espressoMachine._id, quantity: 1, price: espressoMachine.price }],
      totalAmount: espressoMachine.price,
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) // 12 days ago
    },
    // Rohan Mehta bought espresso machine
    {
      customerId: customers[2]._id,
      items: [{ productId: espressoMachine._id, quantity: 1, price: espressoMachine.price }],
      totalAmount: espressoMachine.price,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    },
    // Sneha Reddy bought espresso machine
    {
      customerId: customers[3]._id,
      items: [{ productId: espressoMachine._id, quantity: 1, price: espressoMachine.price }],
      totalAmount: espressoMachine.price,
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
    },
    // Vikram Singh bought espresso machine
    {
      customerId: customers[4]._id,
      items: [{ productId: espressoMachine._id, quantity: 1, price: espressoMachine.price }],
      totalAmount: espressoMachine.price,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    },

    // Ananya Rao bought Grinder and Dark Roast (Normal buyer)
    {
      customerId: customers[5]._id,
      items: [
        { productId: grinder._id, quantity: 1, price: grinder.price },
        { productId: darkRoast._id, quantity: 1, price: darkRoast.price }
      ],
      totalAmount: grinder.price + darkRoast.price,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    },
    // Amit Kumar bought Ethiopian beans
    {
      customerId: customers[6]._id,
      items: [{ productId: ethiopian._id, quantity: 2, price: ethiopian.price }],
      totalAmount: ethiopian.price * 2,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  ];

  await Order.insertMany(orders);
  console.log('Database seeded successfully.');
};

module.exports = seedData;

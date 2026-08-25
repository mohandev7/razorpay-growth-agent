const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Order = require('../models/Order');
const Product = require('../models/Product');
const WebhookEvent = require('../models/WebhookEvent');
const { generateRazorpayPaymentLinkForCampaignTool } = require('../services/agentService');
const { verifyCallbackSignature, verifyWebhookSignature, isMockMode } = require('../services/razorpayService');

// Middleware to validate MongoDB ObjectId
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }
  next();
};

// Get all campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find({})
      .populate('targetCustomer')
      .populate('targetProduct')
      .sort({ createdAt: -1 });
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Fetch campaigns error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Approve and execute campaign (creates Razorpay Payment Link)
router.post('/:id/approve', validateObjectId, async (req, res) => {
  try {
    const campaignId = req.params.id;

    // ATOMIC LOCKING APPROVAL: Transition status pending_approval -> approved atomically
    const campaign = await Campaign.findOneAndUpdate(
      { _id: campaignId, status: 'pending_approval' },
      { status: 'approved' },
      { new: true }
    );

    if (!campaign) {
      // Transition failed: Campaign is already approved, executed, or not found.
      // Fetch current campaign state to return details idempotently.
      const currentCampaign = await Campaign.findById(campaignId)
        .populate('targetCustomer')
        .populate('targetProduct');

      if (!currentCampaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      // If already creating or created link, call agent tool to return the existing link
      if (currentCampaign.status === 'payment_link_created' || currentCampaign.status === 'executed') {
        const result = await generateRazorpayPaymentLinkForCampaignTool({ campaignId });
        if (result.success) {
          const updated = await Campaign.findById(campaignId)
            .populate('targetCustomer')
            .populate('targetProduct');
          return res.json({ success: true, campaign: updated, message: 'Campaign already executed or link already exists.' });
        }
      }

      return res.json({ success: true, campaign: currentCampaign, message: 'Campaign is already approved or being processed.' });
    }

    // Call Agent service tool to execute Razorpay Link generation
    const result = await generateRazorpayPaymentLinkForCampaignTool({ campaignId });
    if (result.success) {
      const updated = await Campaign.findById(campaignId)
        .populate('targetCustomer')
        .populate('targetProduct');
      res.json({ success: true, campaign: updated });
    } else {
      // Revert status on failure
      await Campaign.findOneAndUpdate({ _id: campaignId, status: 'approved' }, { status: 'pending_approval' });
      res.status(500).json({ success: false, message: result.error || 'Failed to generate payment link.' });
    }
  } catch (error) {
    console.error('Campaign approval error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Reject campaign
router.post('/:id/reject', validateObjectId, async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    ).populate('targetCustomer').populate('targetProduct');
    res.json({ success: true, campaign });
  } catch (error) {
    console.error('Campaign rejection error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Simulate clicks
router.post('/:id/click', validateObjectId, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (campaign) {
      campaign.metrics.clicks += 1;
      await campaign.save();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Click tracking error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Callback success endpoint (Redirect target after checkout)
// Webhook is the authoritative source for order generation.
// This callback only verifies the signature and returns status.
router.post('/:id/success', validateObjectId, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const { 
      razorpay_payment_id, 
      razorpay_payment_link_id, 
      razorpay_payment_link_status, 
      razorpay_signature, 
      razorpay_payment_link_reference_id 
    } = req.body;

    // Simulation / local testing bypass in mock mode
    if (isMockMode()) {
      if (campaign.status !== 'executed') {
        campaign.status = 'executed';
        campaign.razorpayPaymentId = razorpay_payment_id || `pay_mock_${Math.random().toString(36).substring(2, 9)}`;
        campaign.metrics.conversions += 1;
        await campaign.save();

        const product = await Product.findById(campaign.targetProduct);
        const discountedPrice = Math.round(product.price * (1 - (campaign.discountPercent / 100)));

        await Order.create({
          customerId: campaign.targetCustomer,
          items: [{
            productId: campaign.targetProduct,
            quantity: 1,
            price: discountedPrice
          }],
          totalAmount: discountedPrice,
          razorpayPaymentId: campaign.razorpayPaymentId,
          razorpayPaymentLinkId: campaign.razorpayPaymentLinkId
        });
      }
      const order = await Order.findOne({ razorpayPaymentLinkId: campaign.razorpayPaymentLinkId });
      return res.json({ success: true, status: 'executed', order });
    }

    // Real Mode: Verify callback signature
    if (!razorpay_payment_id || !razorpay_payment_link_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment signature verification parameters.' });
    }

    const isValid = verifyCallbackSignature(
      razorpay_payment_link_id,
      razorpay_payment_id,
      razorpay_payment_link_status,
      razorpay_payment_link_reference_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid callback payment signature.' });
    }

    // WEBHOOK SECURITY RULE: Do NOT create order or conversions count in callback!
    // Simply return verification state.
    if (campaign.status !== 'executed') {
      return res.json({ 
        success: true, 
        status: 'pending_webhook', 
        message: 'Payment signature verified. Awaiting webhook confirmation to credit order.' 
      });
    }

    const order = await Order.findOne({ razorpayPaymentId: razorpay_payment_id });
    res.json({ success: true, status: 'executed', order });
  } catch (error) {
    console.error('Success callback verify error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Authoritative Webhook Endpoint
router.post('/webhook', async (req, res) => {
  // Extract event ID from the x-razorpay-event-id request header (exactly as documented by Razorpay)
  const eventId = req.headers['x-razorpay-event-id'];
  const signature = req.headers['x-razorpay-signature'];

  if (!eventId) {
    return res.status(400).json({ success: false, message: 'Missing webhook x-razorpay-event-id header.' });
  }

  try {
    // 1. Idempotency Check: Verify if event has already been processed
    const existingEvent = await WebhookEvent.findOne({ eventId });
    if (existingEvent) {
      console.log(`Duplicate webhook event ignored: ${eventId}`);
      return res.json({ success: true, message: 'Duplicate event ignored.' });
    }

    // 2. Validate Signature in Real Mode
    if (!isMockMode()) {
      if (!signature || !req.rawBody) {
        return res.status(400).json({ success: false, message: 'Missing signature header or request body.' });
      }
      const isValid = verifyWebhookSignature(req.rawBody, signature);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
      }
    }

    // Register Webhook Event ID
    await WebhookEvent.create({ eventId, event: req.body.event || 'payment_link.paid' });

    // Handle payment_link.paid event
    if (req.body.event === 'payment_link.paid') {
      const paymentLinkPayload = req.body.payload.payment_link;
      const paymentPayload = req.body.payload.payment;

      if (!paymentLinkPayload || !paymentPayload) {
        return res.status(400).json({ success: false, message: 'Invalid webhook payload structure.' });
      }

      const paymentLinkEntity = paymentLinkPayload.entity;
      const paymentEntity = paymentPayload.entity;

      const paymentLinkId = paymentLinkEntity.id;
      const paymentId = paymentEntity.id;
      const amountPaid = paymentLinkEntity.amount_paid; // in paise
      const currency = paymentLinkEntity.currency; // 'INR'

      // 3. Find Campaign matching paymentLinkId
      const campaign = await Campaign.findOne({ razorpayPaymentLinkId: paymentLinkId });
      if (!campaign) {
        console.warn(`Campaign not found for payment link: ${paymentLinkId}`);
        return res.status(404).json({ success: false, message: 'Campaign matching payment link not found.' });
      }

      // 4. Validate Currency (INR only)
      if (currency !== 'INR') {
        return res.status(400).json({ success: false, message: 'Invalid currency. Only INR payments are supported.' });
      }

      // Fetch expected product price
      const product = await Product.findById(campaign.targetProduct);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Campaign target product not found.' });
      }

      const expectedPrice = Math.round(product.price * (1 - (campaign.discountPercent / 100)));
      const expectedAmountPaise = expectedPrice * 100;

      // 5. Validate Amount Paid matches expected discounted total
      if (amountPaid !== expectedAmountPaise) {
        console.warn(`Webhook amount mismatch: paid ${amountPaid}, expected ${expectedAmountPaise}`);
        return res.status(400).json({ success: false, message: 'Payment amount mismatch.' });
      }

      // 6. Idempotency Check: Verify if order has already been credited or campaign executed
      if (campaign.status === 'executed' || campaign.razorpayPaymentId) {
        console.log(`Campaign ${campaign._id} has already been executed.`);
        return res.json({ success: true, message: 'Campaign already executed.' });
      }

      const existingOrder = await Order.findOne({ razorpayPaymentId: paymentId });
      if (existingOrder) {
        console.log(`Order already created for payment ID: ${paymentId}`);
        return res.json({ success: true, message: 'Order already exists.' });
      }

      // Webhook is authoritative source to process payment updates
      campaign.status = 'executed';
      campaign.razorpayPaymentId = paymentId;
      campaign.metrics.conversions += 1;
      await campaign.save();

      const order = await Order.create({
        customerId: campaign.targetCustomer,
        items: [{
          productId: campaign.targetProduct,
          quantity: 1,
          price: expectedPrice
        }],
        totalAmount: expectedPrice,
        razorpayPaymentId: paymentId,
        razorpayPaymentLinkId: paymentLinkId
      });

      console.log(`Authoritative order ${order._id} created successfully from Webhook event: ${eventId}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

module.exports = router;

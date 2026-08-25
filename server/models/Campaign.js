const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['cross_sell', 'upsell', 're_engagement'], required: true },
  status: { type: String, enum: ['pending_approval', 'approved', 'payment_link_created', 'executed', 'rejected'], default: 'pending_approval' },
  targetCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  targetProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  discountPercent: { type: Number, required: true, min: 5, max: 50 },
  razorpayPaymentLinkId: { type: String, unique: true, sparse: true, index: true },
  razorpayPaymentLinkUrl: { type: String },
  razorpayPaymentId: { type: String, unique: true, sparse: true, index: true },
  metrics: {
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', CampaignSchema);

const mongoose = require('mongoose');

const WebhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  event: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '7d' } // Auto-expiry after 7 days
});

module.exports = mongoose.model('WebhookEvent', WebhookEventSchema);

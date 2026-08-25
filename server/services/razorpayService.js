const Razorpay = require('razorpay');

let razorpay = null;
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (keyId && keySecret && keyId !== 'your_razorpay_key_id') {
  try {
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    console.log('Razorpay SDK Initialized (Test Mode).');
  } catch (error) {
    console.error('Error initializing Razorpay SDK:', error.message);
  }
} else {
  console.log('Razorpay credentials missing or placeholder. Running in Mock Payment Mode.');
}

/**
 * Creates a Payment Link for the growth campaign.
 * @param {Object} campaign - Campaign document
 * @param {Object} product - Product document
 * @param {Object} customer - Customer document
 */
const createCampaignPaymentLink = async (campaign, product, customer) => {
  // Calculate discount price
  const discountedPrice = Math.round(product.price * (1 - (campaign.discountPercent / 100)));
  
  if (razorpay) {
    try {
      const callbackUrl = process.env.PUBLIC_CALLBACK_URL || `http://localhost:5173/dashboard`;
      const options = {
        amount: discountedPrice * 100, // in paise
        currency: 'INR',
        accept_partial: false,
        description: `Promo Deal: ${campaign.title} (${campaign.discountPercent}% Off)`,
        customer: {
          name: customer.name,
          email: customer.email,
          contact: customer.phone.startsWith('+91') ? customer.phone : `+91${customer.phone}`
        },
        notify: {
          sms: false,
          email: true
        },
        reminder_enable: false,
        notes: {
          campaignId: campaign._id.toString(),
          targetProductId: product._id.toString(),
          targetCustomerId: customer._id.toString()
        },
        callback_url: `${callbackUrl}?status=success&campaignId=${campaign._id}`,
        callback_method: 'get'
      };

      const link = await razorpay.paymentLink.create(options);
      return {
        success: true,
        razorpayPaymentLinkId: link.id,
        razorpayPaymentLinkUrl: link.short_url,
        isMock: false
      };
    } catch (err) {
      console.error('Razorpay API error:', err.message);
      // Strictly propagate error to block mock fallback in production
      return {
        success: false,
        error: 'Razorpay API execution failed: ' + err.message
      };
    }
  }

  // Mock Payment Link fallback
  const mockLinkId = `plink_${Math.random().toString(36).substring(2, 11)}`;
  // Point to client mock checkout screen
  const mockUrl = `http://localhost:5173/mock-checkout?campaignId=${campaign._id}&amount=${discountedPrice}&customerName=${encodeURIComponent(customer.name)}&productName=${encodeURIComponent(product.name)}`;

  return {
    success: true,
    razorpayPaymentLinkId: mockLinkId,
    razorpayPaymentLinkUrl: mockUrl,
    isMock: true
  };
};

/**
 * Verifies Razorpay Callback Signature.
 */
const verifyCallbackSignature = (paymentLinkId, paymentId, paymentLinkStatus, paymentLinkRefId, signature) => {
  if (!razorpay) {
    return true; // Bypass signature verification in Mock mode
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const crypto = require('crypto');
  const payload = `${paymentLinkId}|${paymentLinkRefId || ''}|${paymentLinkStatus}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (err) {
    return false;
  }
};

/**
 * Verifies Razorpay Webhook Signature.
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!razorpay) {
    return true; // Bypass signature verification in Mock mode
  }
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Webhook signature validation failed: RAZORPAY_WEBHOOK_SECRET is missing.');
    return false;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (err) {
    return false;
  }
};

module.exports = {
  createCampaignPaymentLink,
  verifyCallbackSignature,
  verifyWebhookSignature,
  isMockMode: () => !razorpay
};

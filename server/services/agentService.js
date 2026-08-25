const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');
const { createCampaignPaymentLink, isMockMode } = require('./razorpayService');

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
let useRealAgent = false;

if (apiKey && apiKey !== 'your_gemini_api_key') {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    useRealAgent = true;
    console.log('Gemini AI Agent Initialized (Tool calling enabled).');
  } catch (error) {
    console.error('Failed to initialize Gemini AI client:', error.message);
  }
} else {
  console.log('Gemini API Key missing or placeholder. Running in Mock Agent Mode.');
}

// 1. Tool Implementations (Functions the agent can call)

const getSalesDataTool = async () => {
  try {
    const products = await Product.find({});
    const customers = await Customer.find({});
    const orders = await Order.find({});
    return {
      success: true,
      productsCount: products.length,
      customersCount: customers.length,
      ordersCount: orders.length,
      products: products.map(p => ({ id: p._id, name: p.name, price: p.price, category: p.category, sku: p.sku })),
      customers: customers.map(c => ({ id: c._id, name: c.name, email: c.email })),
      orders: orders.map(o => ({
        id: o._id,
        customerId: o.customerId,
        items: o.items.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price })),
        totalAmount: o.totalAmount,
        createdAt: o.createdAt
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const createCampaignDraftTool = async (args) => {
  try {
    const { title, description, campaignType, customerId, productId, discountPercent } = args;
    
    // Validate range limits (min: 5, max: 50)
    const discount = Number(discountPercent);
    if (isNaN(discount) || discount < 5 || discount > 50) {
      return { success: false, error: 'Invalid discount percentage. Must be between 5 and 50.' };
    }
    
    // Check if campaign already exists for this product and customer
    const existing = await Campaign.findOne({
      targetCustomer: customerId,
      targetProduct: productId,
      status: 'pending_approval'
    });

    if (existing) {
      return { success: true, isDuplicate: true, campaign: existing };
    }

    const campaign = await Campaign.create({
      title,
      description,
      type: campaignType,
      targetCustomer: customerId,
      targetProduct: productId,
      discountPercent: discount,
      status: 'pending_approval'
    });

    return { success: true, isDuplicate: false, campaignId: campaign._id, campaign };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const generateRazorpayPaymentLinkForCampaignTool = async (args) => {
  try {
    const { campaignId } = args;
    
    // First retrieve targets to validate customer and product before trying atomic update
    let campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return { success: false, error: 'Campaign not found.' };
    }

    const customer = await Customer.findById(campaign.targetCustomer);
    const product = await Product.findById(campaign.targetProduct);

    if (!customer || !product) {
      return { success: false, error: 'Target customer or product not found.' };
    }

    // Atomic check: Transition from approved to payment_link_created to lock the status
    // If it is already payment_link_created or executed, return existing payment link details
    if (campaign.status === 'payment_link_created' || campaign.status === 'executed') {
      if (campaign.razorpayPaymentLinkId && campaign.razorpayPaymentLinkId !== 'pending_generation') {
        return {
          success: true,
          paymentLinkId: campaign.razorpayPaymentLinkId,
          paymentLinkUrl: campaign.razorpayPaymentLinkUrl,
          isMock: isMockMode()
        };
      }
    }

    // Claim the lock atomically by transitioning from approved -> payment_link_created
    const lockedCampaign = await Campaign.findOneAndUpdate(
      { _id: campaignId, status: 'approved' },
      { status: 'payment_link_created', razorpayPaymentLinkId: 'pending_generation' },
      { new: true }
    );

    if (!lockedCampaign) {
      // Failed to transition: either another concurrent request won, or the status is incorrect
      const current = await Campaign.findById(campaignId);
      if (current && (current.status === 'payment_link_created' || current.status === 'executed')) {
        if (current.razorpayPaymentLinkId && current.razorpayPaymentLinkId !== 'pending_generation') {
          return {
            success: true,
            paymentLinkId: current.razorpayPaymentLinkId,
            paymentLinkUrl: current.razorpayPaymentLinkUrl,
            isMock: isMockMode()
          };
        }
      }
      return { success: false, error: 'Campaign execution blocked: Campaign must be approved and not already processing.' };
    }

    // Now call the Razorpay API to generate the link
    const rzpResult = await createCampaignPaymentLink(lockedCampaign, product, customer);
    if (rzpResult.success) {
      lockedCampaign.razorpayPaymentLinkId = rzpResult.razorpayPaymentLinkId;
      lockedCampaign.razorpayPaymentLinkUrl = rzpResult.razorpayPaymentLinkUrl;
      // Keep state as payment_link_created (Webhook is authoritative source for executing it!)
      lockedCampaign.status = 'payment_link_created';
      await lockedCampaign.save();

      return {
        success: true,
        paymentLinkId: rzpResult.razorpayPaymentLinkId,
        paymentLinkUrl: rzpResult.razorpayPaymentLinkUrl,
        isMock: rzpResult.isMock
      };
    } else {
      // Revert lock on failure
      await Campaign.findByIdAndUpdate(campaignId, { status: 'approved', $unset: { razorpayPaymentLinkId: 1, razorpayPaymentLinkUrl: 1 } });
      return { success: false, error: rzpResult.error || 'Razorpay payment link creation failed.' };
    }
  } catch (error) {
    console.error('Error generating payment link in tool:', error);
    // Revert lock on exception
    try {
      await Campaign.findByIdAndUpdate(args.campaignId, { status: 'approved', $unset: { razorpayPaymentLinkId: 1, razorpayPaymentLinkUrl: 1 } });
    } catch (e) {
      console.error('Failed to revert status lock:', e);
    }
    return { success: false, error: error.message };
  }
};

// 2. Gemini Tool Declarations

const tools = [
  {
    functionDeclarations: [
      {
        name: 'getSalesData',
        description: 'Retrieves sales metrics, top selling products, customers, and order history from the store database.',
        parameters: {
          type: 'OBJECT',
          properties: {},
          required: []
        }
      },
      {
        name: 'createCampaignDraft',
        description: 'Drafts a new growth/marketing campaign in the store for merchant approval. Recommended before executing any promo action.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Attractive title for the campaign (e.g. Organic Beans Cross-Sell to Espresso Buyers)' },
            description: { type: 'STRING', description: 'Brief reasoning and customer segment description' },
            campaignType: { type: 'STRING', description: 'Must be: cross_sell, upsell, or re_engagement' },
            customerId: { type: 'STRING', description: 'MongoDB ObjectId of the target customer segment' },
            productId: { type: 'STRING', description: 'MongoDB ObjectId of the product to promote/discount' },
            discountPercent: { type: 'NUMBER', description: 'Discount percentage value between 5 and 50' }
          },
          required: ['title', 'description', 'campaignType', 'customerId', 'productId', 'discountPercent']
        }
      },
      {
        name: 'generateRazorpayPaymentLinkForCampaign',
        description: 'Creates and sends a live Razorpay test-mode payment link for an approved campaign. Call ONLY when customer or merchant has approved the draft.',
        parameters: {
          type: 'OBJECT',
          properties: {
            campaignId: { type: 'STRING', description: 'The database ObjectId of the campaign' }
          },
          required: ['campaignId']
        }
      }
    ]
  }
];

const systemInstruction = `
You are the AI Merchant Growth Agent. Your goal is to analyze the merchant's store data (products, orders, customers) to discover concrete opportunities to increase revenue through targeted cross-sells, upsells, or re-engagements.
Whenever you analyze data, you must search for distinct co-purchase or buying patterns. For example, look for customers who bought a premium espresso machine but did not purchase any coffee beans.
Once you identify an opportunity:
1. Explain it clearly to the merchant.
2. Use the 'createCampaignDraft' tool to register the opportunity in the store's system.
Wait for the merchant's approval. Do NOT call the 'generateRazorpayPaymentLinkForCampaign' tool until the merchant explicitly requests or approves execution.
Always respond in clear, concise markdown with metrics and visual bullet points.
`;

// Helper: Run the tool-calling loop using Gemini
const runGeminiAgent = async (chatHistory, userPrompt) => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    tools: tools,
    systemInstruction: systemInstruction
  });

  // Map messages to Gemini's expected Content format
  // Content role must be either 'user' or 'model'
  const contents = chatHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Append new user prompt
  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }]
  });

  // Call Gemini generateContent
  let result = await model.generateContent({ contents });
  let responseText = '';
  let functionCalls = result.response.getFunctionCalls();
  const toolExecLogs = [];

  // Loop as long as model returns function calls
  while (functionCalls && functionCalls.length > 0) {
    const functionResponses = [];

    for (const call of functionCalls) {
      const { name, args } = call;
      console.log(`AI executing tool: ${name} with args:`, args);
      
      let toolResult;
      if (name === 'getSalesData') {
        toolResult = await getSalesDataTool();
        toolExecLogs.push({ name, args, outcome: `Retrieved ${toolResult.productsCount} products, ${toolResult.ordersCount} orders` });
      } else if (name === 'createCampaignDraft') {
        toolResult = await createCampaignDraftTool(args);
        toolExecLogs.push({ name, args, outcome: `Drafted campaign: ${args.title}` });
      } else if (name === 'generateRazorpayPaymentLinkForCampaign') {
        toolResult = await generateRazorpayPaymentLinkForCampaignTool(args);
        toolExecLogs.push({ name, args, outcome: `Generated payment link: ${toolResult.paymentLinkUrl}` });
      }

      functionResponses.push({
        functionResponse: {
          name,
          response: toolResult
        }
      });
    }

    // Include function result in conversation and get next response
    contents.push(result.response);
    contents.push({
      role: 'user',
      parts: functionResponses
    });

    result = await model.generateContent({ contents });
    functionCalls = result.response.getFunctionCalls();
  }

  responseText = result.response.text();
  return { text: responseText, toolExecLogs };
};

// 3. Mock Agent Logic for Local Fallback
const runMockAgent = async (userPrompt) => {
  const normalized = userPrompt.toLowerCase();
  let text = '';
  const toolExecLogs = [];

  if (normalized.includes('analyze') || normalized.includes('growth') || normalized.includes('sales')) {
    // 1. Run Data analytics programmatically
    const data = await getSalesDataTool();
    toolExecLogs.push({ name: 'getSalesData', args: {}, outcome: `Retrieved ${data.productsCount} products, ${data.ordersCount} orders` });

    // Look for Espresso Machine & Coffee Bean cross-sell pattern
    const espressoMachine = data.products.find(p => p.sku === 'EQ-ESP-01');
    const darkRoast = data.products.find(p => p.sku === 'BN-DRK-03');
    
    let targetCustomer = null;
    if (data.ordersCount > 0 && espressoMachine && darkRoast) {
      // Find a customer who bought Espresso Machine
      const buyers = data.orders
        .filter(o => o.items.some(item => item.productId.toString() === espressoMachine.id.toString()))
        .map(o => o.customerId.toString());
      
      if (buyers.length > 0) {
        // Find if any buyer has NOT bought dark roast beans
        for (const buyerId of buyers) {
          const boughtBeans = data.orders.some(o => 
            o.customerId.toString() === buyerId && 
            o.items.some(item => item.productId.toString() === darkRoast.id.toString())
          );
          if (!boughtBeans) {
            targetCustomer = data.customers.find(c => c.id.toString() === buyerId);
            break;
          }
        }
      }
    }

    if (targetCustomer && espressoMachine && darkRoast) {
      // 2. Draft a campaign programmatically
      const campaignArgs = {
        title: 'Espresso Bean Cross-Sell Promotion',
        description: `Create a 15% discount link on Organic Dark Roast Beans for customer ${targetCustomer.name} who purchased a Premium Espresso Machine 10 days ago but has not bought any coffee beans.`,
        campaignType: 'cross_sell',
        customerId: targetCustomer.id,
        productId: darkRoast.id,
        discountPercent: 15
      };

      const draftResult = await createCampaignDraftTool(campaignArgs);
      toolExecLogs.push({ name: 'createCampaignDraft', args: campaignArgs, outcome: `Drafted campaign: ${campaignArgs.title}` });

      text = `### Store Sales Analysis Complete 🚀\n\nI analyzed **${data.ordersCount} store orders** and identified a high-value revenue opportunity:\n\n* **Pattern Identified:** Customers purchasing the **Premium Espresso Machine** (₹24,999) without purchasing any coffee beans from your catalog.\n* **Target Customer:** **${targetCustomer.name}** (${targetCustomer.email}) bought an espresso machine recently, but has zero coffee beans purchases.\n* **Growth Action:** Offer a **15% discount** on **Organic Dark Roast Beans (1kg)** (reducing price from ₹1,200 to ₹1,020).\n\nI have **automatically drafted** a cross-sell campaign for this customer. Please review the campaign card on the dashboard or reply **"Approve campaign"** here to execute the Razorpay Test Link!`;
    } else {
      text = `### Analysis Summary\n\nI scanned the store data but could not find any active cross-sell targets. Please ensure you have run the database seed endpoint to inject the demo scenario.`;
    }
  } else if (normalized.includes('approve') || normalized.includes('execute')) {
    // Approve the latest campaign
    const latestCampaign = await Campaign.findOne({ status: 'pending_approval' }).sort({ createdAt: -1 });
    if (latestCampaign) {
      latestCampaign.status = 'approved';
      await latestCampaign.save();
      const linkResult = await generateRazorpayPaymentLinkForCampaignTool({ campaignId: latestCampaign._id });
      toolExecLogs.push({ name: 'generateRazorpayPaymentLinkForCampaign', args: { campaignId: latestCampaign._id }, outcome: `Payment Link created: ${linkResult.paymentLinkUrl}` });

      text = `### Campaign Executed Successfully! 💳\n\nI have generated the Razorpay Test Mode Payment Link for **${latestCampaign.title}**:\n\n* **Payment Link URL:** [Open Test Checkout](${linkResult.paymentLinkUrl})\n* **Campaign Status:** Executed\n\nYou can click the link to simulate the payment in test mode. Once done, the dashboard will update with the conversion metrics!`;
    } else {
      text = `I couldn't find any pending campaigns requiring approval. Try typing **"Analyze data"** to let me scan for growth opportunities first!`;
    }
  } else {
    text = `Hello! I am your AI Merchant Growth Agent. I scan your orders, products, and customers to identify upsell/cross-sell suggestions. \n\nTry typing **"Analyze data"** or click the **Analyze Store** button on the dashboard to scan for growth campaigns.`;
  }

  return { text, toolExecLogs };
};

// Main entry point for router
const processMessage = async (userPrompt, chatHistory = []) => {
  if (useRealAgent) {
    try {
      return await runGeminiAgent(chatHistory, userPrompt);
    } catch (error) {
      console.error('Gemini error, running fallback simulation:', error.message);
      return await runMockAgent(userPrompt);
    }
  } else {
    return await runMockAgent(userPrompt);
  }
};

module.exports = {
  processMessage,
  generateRazorpayPaymentLinkForCampaignTool
};

# 🚀 Razorpay Growth Agent
### AI-Powered Merchant Growth & Revenue Optimization Platform

[![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb)](https://www.mongodb.com/)
[![Razorpay](https://img.shields.io/badge/Payments-Razorpay-02042B)](https://razorpay.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-8E75B2)](https://ai.google.dev/)

**Razorpay Growth Agent** is an AI-powered merchant growth platform that helps businesses identify revenue opportunities, understand customer behavior, and execute targeted growth campaigns.

Instead of relying on manual analysis and generic marketing strategies, the platform uses an AI agent to analyze merchant data, identify actionable opportunities, and recommend personalized campaigns. Merchants remain in control by reviewing and approving campaigns before execution.

🔗 **GitHub Repository:** https://github.com/mohandev7/razorpay-growth-agent

---

## 📌 Problem Statement

Businesses often lose potential revenue because of:

- Failed or incomplete payments.
- Customers who abandon their purchases.
- Low customer engagement and repeat purchases.
- Difficulty identifying high-value growth opportunities.
- Time-consuming manual campaign creation and execution.

Traditional dashboards provide business data, but merchants still need to interpret that data and decide what actions to take.

## 💡 Solution

Razorpay Growth Agent bridges the gap between business analytics and business actions.

It uses an AI-powered agent to:

1. Analyze merchant, customer, product, and order data.
2. Identify potential revenue growth opportunities.
3. Generate targeted marketing and recovery campaigns.
4. Present campaign recommendations for merchant approval.
5. Execute approved payment-related actions through Razorpay Test Mode.
6. Track campaign outcomes and payment events through webhooks.

**The goal:** Turn merchant data into actionable growth strategies with human approval and controlled execution.

---

## ✨ Key Features

### 🤖 AI-Powered Growth Agent
- Uses Google Gemini AI to understand merchant data.
- Identifies potential revenue opportunities.
- Generates contextual campaign recommendations.
- Provides an interactive AI chat interface.

### 📊 Merchant Analytics Dashboard
- Displays business performance metrics.
- Analyzes products, orders, and customer information.
- Highlights potential growth opportunities.
- Provides campaign performance insights.

### 🎯 Intelligent Campaign Generation
- Creates personalized campaign recommendations.
- Identifies relevant customer segments.
- Supports payment recovery and customer engagement workflows.
- Allows merchants to review recommendations before execution.

### 💳 Razorpay Payment Integration
- Integrates with Razorpay APIs.
- Creates payment links for approved campaign actions.
- Uses Razorpay Test Mode for payment testing.
- Tracks payment completion through webhooks.

### 🔐 Secure Payment Workflow
- Implements Razorpay webhook signature verification.
- Uses environment variables for API credentials.
- Requires merchant approval before campaign execution.
- Processes payment events to update campaign status.

### 📈 Campaign Tracking
- Tracks campaign execution status.
- Updates payment-related campaign outcomes.
- Maintains campaign and webhook event records.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend user interface |
| Vite | Frontend development and build |
| Node.js | Backend runtime |
| Express.js | REST API development |
| MongoDB Atlas | Cloud database |
| Mongoose | Database modeling |
| Google Gemini AI | AI agent and campaign generation |
| Razorpay API | Payment integration |
| Razorpay Webhooks | Payment event handling |
| JavaScript | Application development |
| Git & GitHub | Version control |

---

## 🏗️ System Architecture

```text
             MERCHANT
                 |
                 v
       React + Vite Frontend
                 |
                 v
          Express.js API
                 |
       +---------+----------+
       |         |          |
       v         v          v
    Gemini AI  MongoDB   Razorpay API
    Agent      Atlas         |
       |         |           |
       v         v           v
  Growth       Merchant   Payment Links
  Analysis     Data            |
       |                       |
       v                       v
  Campaign                 Customer
  Recommendations          Payment
       |                       |
       v                       v
  Merchant Approval      Razorpay Webhook
       |                       |
       v                       v
  Campaign Execution     Signature Verification
       |                       |
       +-----------+-----------+
                   |
                   v
          Campaign Status Update
```

---

## 📂 Project Structure

```text
razorpay-growth-agent/
│
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/
│   ├── config/
│   │   └── db.js
│   │
│   ├── models/
│   │   ├── Campaign.js
│   │   ├── Customer.js
│   │   ├── Message.js
│   │   ├── Order.js
│   │   ├── Product.js
│   │   └── WebhookEvent.js
│   │
│   ├── routes/
│   │   ├── agent.js
│   │   ├── analytics.js
│   │   └── campaigns.js
│   │
│   ├── services/
│   │   ├── agentService.js
│   │   └── razorpayService.js
│   │
│   ├── utils/
│   │   ├── seed.js
│   │   └── test_security.js
│   │
│   ├── .env.example
│   ├── server.js
│   └── package.json
│
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Getting Started

Follow these steps to run the project locally.

### 1. Prerequisites

Make sure you have installed:

- Node.js (v18 or later recommended)
- npm
- MongoDB Atlas account or local MongoDB
- Google Gemini API key
- Razorpay account with Test Mode enabled

### 2. Clone the Repository

```bash
git clone https://github.com/mohandev7/razorpay-growth-agent.git

cd razorpay-growth-agent
```

### 3. Install Dependencies

Install dependencies for the root, frontend, and backend:

```bash
npm run install-all
```

### 4. Configure Environment Variables

Navigate to the server directory:

```bash
cd server
```

Create a `.env` file using `.env.example` as a reference.

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

GEMINI_API_KEY=your_gemini_api_key

RAZORPAY_KEY_ID=your_razorpay_key_id

RAZORPAY_KEY_SECRET=your_razorpay_key_secret

RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

PUBLIC_CALLBACK_URL=http://localhost:5173/dashboard

CLIENT_ORIGIN=http://localhost:5173
```

Replace the placeholder values with your actual credentials.

**Important:** Never commit your `.env` file or expose API secrets in the frontend.

### 5. Run the Application

Return to the project root:

```bash
cd ..
```

Start both frontend and backend:

```bash
npm run dev
```

The application will run at:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000 |

---

## 🔌 API Endpoints

The backend exposes REST APIs for analytics, campaign management, and AI agent interactions.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/summary` | Retrieve merchant analytics |
| GET | `/api/campaigns` | Retrieve campaigns |
| GET | `/api/agent/chat-history` | Retrieve AI chat history |
| POST | `/api/campaigns/:campaignId/success` | Update campaign success |
| POST | `/api/campaigns/webhook` | Handle Razorpay payment events |
| POST | `/api/seed` | Seed development database |

---

## 💳 Payment Workflow

The payment integration follows an approval-based execution process.

1. **Data Analysis:** The AI agent analyzes available merchant and transaction data.
2. **Opportunity Identification:** The agent identifies potential revenue opportunities.
3. **Campaign Generation:** The agent generates a relevant campaign recommendation.
4. **Merchant Approval:** The merchant reviews and approves the proposed campaign.
5. **Payment Link Creation:** The backend creates a Razorpay payment link for the approved action.
6. **Customer Payment:** The customer completes the payment through Razorpay.
7. **Webhook Notification:** Razorpay sends a payment event to the backend.
8. **Signature Verification:** The backend verifies the webhook signature before processing the event.
9. **Status Update:** The application updates the corresponding campaign and payment status.

This workflow ensures that AI-generated recommendations do not automatically execute payment actions without merchant approval.

---

## 🔒 Security Considerations

- API credentials are stored in environment variables.
- Razorpay webhook signatures are verified before processing payment events.
- Merchant approval is required before campaign execution.
- Database seeding is disabled in production.
- Razorpay Test Mode is used for development and payment testing.

---

## 🚀 Future Improvements

- Advanced customer segmentation using machine learning.
- Predictive analytics for customer churn and purchase behavior.
- Automated campaign performance optimization.
- Support for additional payment and communication providers.
- Role-based authentication and merchant access control.
- Advanced revenue forecasting and reporting.
- Production-grade monitoring, logging, and retry mechanisms.

---

## 🧪 Testing

The project includes security-related testing utilities.

To validate payment-related workflows:

1. Configure Razorpay Test Mode credentials.
2. Generate a campaign recommendation.
3. Approve the campaign.
4. Test the payment link.
5. Verify webhook signature handling.
6. Confirm campaign status updates.

Use test credentials and simulated transactions during development.

---

## 👨‍💻 Author

**Mohan Jalamadula**

- GitHub: [@mohandev7](https://github.com/mohandev7)
- Project: [Razorpay Growth Agent](https://github.com/mohandev7/razorpay-growth-agent)

---

## 📄 License

No license has currently been specified for this repository.

---

⭐ If you find this project interesting, consider giving the repository a star!

**Built to transform merchant data into intelligent, actionable growth opportunities.**

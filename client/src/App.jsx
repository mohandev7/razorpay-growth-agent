import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Percent, 
  Sparkles, 
  Send, 
  Check, 
  X, 
  ExternalLink, 
  RotateCcw,
  Zap,
  CheckCircle,
  Database
} from 'lucide-react';

function App() {
  // Simple State Router
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  
  // Dashboard & Campaigns states
  const [metrics, setMetrics] = useState({ totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, conversionRate: 4.8 });
  const [topProducts, setTopProducts] = useState([]);
  const [salesOverTime, setSalesOverTime] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Chat states
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const chatEndRef = useRef(null);

  // Sync state route on navigation
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoadingStats(true);
      const resStats = await fetch('/api/analytics/summary');
      const dataStats = await resStats.json();
      if (dataStats.success) {
        setMetrics(dataStats.metrics);
        setTopProducts(dataStats.topProducts);
        setSalesOverTime(dataStats.salesOverTime);
      }

      const resCamp = await fetch('/api/campaigns');
      const dataCamp = await resCamp.json();
      if (dataCamp.success) {
        setCampaigns(dataCamp.campaigns);
      }
    } catch (err) {
      console.error('Error loading analytics/campaigns:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch('/api/agent/chat-history');
      const data = await res.json();
      if (data.success) {
        setChatHistory(data.messages);
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  };

  useEffect(() => {
    if (currentPath === '/' || currentPath === '/dashboard' || currentPath.includes('/dashboard')) {
      fetchData();
      fetchChatHistory();

      // Check if redirected back with success
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const campaignId = params.get('campaignId');
      if (status === 'success' && campaignId) {
        handlePaymentSuccess(campaignId);
      }
    }
  }, [currentPath]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  const handlePaymentSuccess = async (campaignId) => {
    try {
      const params = new URLSearchParams(window.location.search);
      const payload = {
        razorpay_payment_id: params.get('razorpay_payment_id'),
        razorpay_payment_link_id: params.get('razorpay_payment_link_id'),
        razorpay_payment_link_status: params.get('razorpay_payment_link_status'),
        razorpay_signature: params.get('razorpay_signature'),
        razorpay_payment_link_reference_id: params.get('razorpay_payment_link_reference_id')
      };

      const res = await fetch(`/api/campaigns/${campaignId}/success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        // Clear query parameters
        window.history.replaceState({}, document.title, '/dashboard');
        fetchData();
        
        let alertMessage = '💰 Alert: Customer completed payment on campaign deal!';
        if (data.status === 'pending_webhook') {
          alertMessage = '⏳ Alert: Payment signature verified! Awaiting webhook confirmation to credit order.';
        } else if (data.order) {
          alertMessage = `💰 Alert: Payment processed! Store total revenue increased by ₹${data.order.totalAmount}.`;
        }

        // Append system notification message in chat
        setChatHistory(prev => [
          ...prev,
          {
            _id: `sys_${Date.now()}`,
            role: 'system',
            content: alertMessage
          }
        ]);
      } else {
        alert('Payment verification failed: ' + data.message);
      }
    } catch (err) {
      console.error('Error recording payment success:', err);
    }
  };

  // Trigger seeding
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Database successfully seeded with demo espresso machine buyers!');
        fetchData();
        fetchChatHistory();
      }
    } catch (err) {
      alert('Error seeding database: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Clear chat
  const handleClearChat = async () => {
    try {
      await fetch('/api/agent/clear', { method: 'POST' });
      setChatHistory([]);
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  // Send message to agent
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatInput('');
    setIsTyping(true);

    // Optimistically update UI
    setChatHistory(prev => [...prev, { role: 'user', content: userText }]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userText })
      });
      const data = await res.json();
      if (data.success) {
        // Reload campaigns and stats in case tools modified them
        fetchData();
        setChatHistory(prev => [...prev, data.modelMessage]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsTyping(false);
    }
  };

  // Trigger quick agent scan
  const handleTriggerAnalysis = async () => {
    setIsTyping(true);
    setChatHistory(prev => [...prev, { role: 'user', content: 'Run growth analysis on store metrics.' }]);
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Run growth analysis on store metrics and draft campaign.' })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setChatHistory(prev => [...prev, data.modelMessage]);
      }
    } catch (err) {
      console.error('Error running store analysis:', err);
    } finally {
      setIsTyping(false);
    }
  };

  // Campaign approval / rejection
  const handleApproveCampaign = async (id) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchData();
        // Append confirmation in chat
        setChatHistory(prev => [
          ...prev, 
          { 
            _id: `sys_${Date.now()}`,
            role: 'system',
            content: `✅ Approved campaign: "${data.campaign.title}". Razorpay Payment Link successfully created.` 
          }
        ]);
      } else {
        alert('Failed to approve campaign: ' + data.message);
      }
    } catch (err) {
      console.error('Error approving campaign:', err);
    }
  };

  const handleRejectCampaign = async (id) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.error('Error rejecting campaign:', err);
    }
  };

  // Render SVG Area Chart
  const renderSVGChart = () => {
    if (!salesOverTime.length) return null;
    const maxVal = Math.max(...salesOverTime.map(s => s.sales), 1000);
    const height = 140;
    const width = 500;
    const padding = 30;

    const points = salesOverTime.map((s, idx) => {
      const x = padding + (idx * (width - padding * 2) / (salesOverTime.length - 1));
      const y = height - padding - (s.sales * (height - padding * 2) / maxVal);
      return { x, y, label: s.name, val: s.sales };
    });

    const dPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const dArea = `${dPath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3395ff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3395ff" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.06)" />
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" />

        {/* Fill Area */}
        <path d={dArea} fill="url(#chartGlow)" />

        {/* Line Curve */}
        <path d={dPath} fill="none" stroke="#3395ff" strokeWidth="2.5" strokeLinecap="round" />

        {/* Markers */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="4" fill="#0b0f19" stroke="#3395ff" strokeWidth="2" />
            <text x={p.x} y={height - 10} fill="#9ca3af" fontSize="9" textAnchor="middle">{p.label}</text>
            {p.val > 0 && (
              <text x={p.x} y={p.y - 8} fill="#f3f4f6" fontSize="8" fontWeight="bold" textAnchor="middle">
                ₹{p.val >= 1000 ? `${(p.val/1000).toFixed(1)}k` : p.val}
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  };

  // ROUTE 1: Render Mock Checkout
  if (currentPath.startsWith('/mock-checkout')) {
    const params = new URLSearchParams(window.location.search);
    const campaignId = params.get('campaignId');
    const amount = params.get('amount') || '0';
    const customerName = params.get('customerName') || 'Merchant Test';
    const productName = params.get('productName') || 'Deal Product';

    const [isSuccess, setIsSuccess] = useState(false);
    const [paying, setPaying] = useState(false);

    const handlePay = async () => {
      setPaying(true);
      try {
        // Record campaign link click
        await fetch(`/api/campaigns/${campaignId}/click`, { method: 'POST' });
        
        // Simulating 1.5s gateway processing
        setTimeout(async () => {
          setIsSuccess(true);
          setPaying(false);
          // Redirect back after success screen
          setTimeout(() => {
            const mockPayId = `pay_mock_${Math.random().toString(36).substring(2, 9)}`;
            const mockLinkId = `plink_mock_${Math.random().toString(36).substring(2, 9)}`;
            window.location.href = `/dashboard?status=success&campaignId=${campaignId}&razorpay_payment_id=${mockPayId}&razorpay_payment_link_id=${mockLinkId}&razorpay_payment_link_status=paid&razorpay_signature=mock_signature`;
          }, 2000);
        }, 1500);
      } catch (err) {
        console.error(err);
        setPaying(false);
      }
    };

    return (
      <div className="mock-checkout-container">
        <div className="rzp-header">
          <span className="rzp-logo">
            <Zap size={18} fill="#3395ff" /> Razorpay
          </span>
          <span className="rzp-badge">TEST MODE</span>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle size={64} color="#10b981" style={{ marginBottom: '1rem', animation: 'scaleUp 0.3s ease-out' }} />
            <h3 style={{ marginBottom: '0.5rem', color: '#10b981' }}>Payment Successful</h3>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Redirecting you back to the merchant dashboard...</p>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paying To</p>
              <h3 style={{ fontSize: '1.1rem', marginTop: '0.2rem' }}>AI Growth Merchant Store</h3>
            </div>

            <div className="checkout-details">
              <div className="checkout-row">
                <span className="details-label">Product Bundle Offer</span>
                <span className="details-value">{productName}</span>
              </div>
              <div className="checkout-row">
                <span className="details-label">Target Customer</span>
                <span className="details-value">{customerName}</span>
              </div>
              <div className="checkout-row" style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                <span className="details-label" style={{ fontWeight: 'bold' }}>Amount Due</span>
                <span className="checkout-amount">₹{Number(amount).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem' }}
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? 'Processing Test Payment...' : `Simulate Test Payment (₹${Number(amount).toLocaleString('en-IN')})`}
            </button>
            
            <p style={{ color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center', marginTop: '1.25rem', lineHeight: '1.4' }}>
              This is a secure Sandbox payment checkout page simulated for the Razorpay Buildathon.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ROUTE 2: Render Main Dashboard
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <span className="logo-icon">🚀</span>
          <div className="logo-info">
            <h1 className="logo-text">AI Growth Agent</h1>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Commerce & Agentic Promotion Agent</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleSeed} disabled={seeding}>
            <Database size={16} />
            {seeding ? 'Seeding...' : 'Seed Store Data'}
          </button>
          
          <span className="badge badge-executed" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Zap size={10} fill="currentColor" /> Razorpay Test Mode
          </span>
        </div>
      </header>

      {/* Stats row */}
      <section className="stats-row" aria-label="Store Analytics Summary">
        <div className="stat-card">
          <div className="stat-icon-wrapper">
            <TrendingUp size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">₹{metrics.totalRevenue.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon-wrapper">
            <ShoppingBag size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Orders Count</span>
            <span className="stat-value">{metrics.totalOrders}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper">
            <Users size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Average Order Value</span>
            <span className="stat-value">₹{metrics.averageOrderValue.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon-wrapper">
            <Percent size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Conversion Rate</span>
            <span className="stat-value">{metrics.conversionRate}%</span>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <main className="dashboard-grid">
        {/* Left Panel: Campaigns */}
        <section className="dashboard-panel" aria-label="Campaign Overview">
          <div className="panel-header">
            <h2 className="panel-title">
              💼 Growth & Marketing Campaigns
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={fetchData}>
              Refresh
            </button>
          </div>

          {/* Sales Chart inside campaigns panel */}
          <div className="chart-container-box">
            <h3 className="chart-title">Revenue Trajectory (Last 7 Days)</h3>
            {renderSVGChart()}
          </div>

          <div className="campaigns-container">
            {campaigns.length === 0 ? (
              <div className="empty-placeholder">
                <span className="empty-icon">📢</span>
                <p>No growth campaigns generated yet.</p>
                <p style={{ fontSize: '0.8rem' }}>Ask the AI Agent to run a store analysis or click the analyze button in the chat panel!</p>
              </div>
            ) : (
              campaigns.map((camp) => (
                <div key={camp._id} className={`campaign-card ${camp.status === 'payment_link_created' ? 'approved' : camp.status}`}>
                  <div className="campaign-meta">
                    <span className="campaign-title">{camp.title}</span>
                    <span className={`badge badge-${
                      camp.status === 'pending_approval' ? 'pending' : 
                      camp.status === 'approved' || camp.status === 'payment_link_created' ? 'approved' : 
                      camp.status === 'executed' ? 'executed' : 'rejected'
                    }`}>
                      {camp.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  <p className="campaign-desc">{camp.description}</p>

                  <div className="campaign-details-box">
                    <span className="details-label">Product to Sell</span>
                    <span className="details-value">{camp.targetProduct?.name || 'Beans'}</span>
                    <span className="details-label">Customer Target</span>
                    <span className="details-value">{camp.targetCustomer?.name || 'Customer'}</span>
                    <span className="details-label">Promo Discount</span>
                    <span className="details-value">{camp.discountPercent}% Off</span>
                    {camp.status === 'executed' && (
                      <>
                        <span className="details-label">Conversions</span>
                        <span className="details-value" style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
                          {camp.metrics?.conversions || 0}
                        </span>
                      </>
                    )}
                  </div>

                  {camp.status === 'pending_approval' && (
                    <div className="campaign-actions">
                      <button className="btn btn-primary" onClick={() => handleApproveCampaign(camp._id)}>
                        <Check size={14} /> Approve & Create Link
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleRejectCampaign(camp._id)}>
                        <X size={14} /> Decline
                      </button>
                    </div>
                  )}

                  {(camp.status === 'payment_link_created' || camp.status === 'executed') && camp.razorpayPaymentLinkUrl && (
                    <a 
                      href={camp.razorpayPaymentLinkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <ExternalLink size={14} /> Open Razorpay Payment Link
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Panel: Chat interface */}
        <section className="dashboard-panel" aria-label="AI Growth Assistant Chat">
          <div className="panel-header">
            <h2 className="panel-title">
              <Sparkles size={18} color="var(--color-primary)" fill="var(--color-primary-glow)" /> AI Assistant Panel
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={handleTriggerAnalysis}>
                Analyze Store
              </button>
              <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={handleClearChat} title="Clear Chat">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          <div className="chat-container">
            <div className="chat-history">
              {chatHistory.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: 'auto 0' }}>
                  <Sparkles size={32} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                  <p>Welcome! I'm your Growth Agent.</p>
                  <p style={{ marginTop: '0.5rem' }}>Click <strong>Analyze Store</strong> or type <strong>"Analyze store data"</strong> below to find sales trends.</p>
                </div>
              )}
              
              {chatHistory.map((msg) => (
                <div key={msg._id} className={`chat-message ${msg.role}`}>
                  <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
                  
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="agent-logs-container">
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                        Agent Tools Triggered:
                      </p>
                      {msg.toolCalls.map((log, index) => (
                        <div key={index} className="agent-log-item">
                          <Zap size={10} fill="currentColor" />
                          <span>{log.name}() &rarr; {log.outcome}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="chat-message model" style={{ minWidth: '80px' }}>
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-form">
              <input 
                type="text" 
                className="chat-input"
                placeholder="Ask agent to run analysis, approve a campaign..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isTyping}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }} disabled={isTyping}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { processMessage } = require('../services/agentService');

// Get chat history
router.get('/chat-history', async (req, res) => {
  try {
    const messages = await Message.find({}).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Agent chat-history error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Post a chat message
router.post('/chat', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    // Save user message to database
    const userMessage = await Message.create({
      role: 'user',
      content: content
    });

    // Retrieve previous messages for context
    const dbHistory = await Message.find({}).sort({ createdAt: 1 });
    // Map to simple structure for processing
    const history = dbHistory.map(m => ({ role: m.role, content: m.content }));

    // Send user prompt to Agent Service
    const agentResult = await processMessage(content, history);

    // Save agent response to database
    const modelMessage = await Message.create({
      role: 'model',
      content: agentResult.text,
      toolCalls: agentResult.toolExecLogs
    });

    res.json({
      success: true,
      userMessage,
      modelMessage
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Clear chat history
router.post('/clear', async (req, res) => {
  try {
    await Message.deleteMany({});
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    console.error('Agent clear error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

module.exports = router;

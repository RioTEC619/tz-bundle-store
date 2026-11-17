require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Bundle Catalog
const BUNDLES = {
  '6GB': { name: '6GB Data Bundle', price: 3000 },
  '9GB': { name: '9GB Data Bundle', price: 5000 }
};

// Helper: Normalize Tanzanian phone numbers to 255XXXXXXXXX
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '255' + cleaned.substring(1);
  } else if (!cleaned.startsWith('255')) {
    cleaned = '255' + cleaned;
  }
  return cleaned;
}

// Endpoint to initiate USSD Push Payment
app.post('/api/buy-bundle', async (req, res) => {
  try {
    const { network, bundleId, phone } = req.body;

    if (!network || !BUNDLES[bundleId] || !phone) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (formattedPhone.length !== 12) {
      return res.status(400).json({ success: false, message: 'Invalid Tanzanian phone number.' });
    }

    const selectedBundle = BUNDLES[bundleId];
    const reference = `BND-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // TODO: Adjust payload keys & endpoint URL once HarakaPesa docs are provided
    const payload = {
      phone_number: formattedPhone,
      amount: selectedBundle.price,
      network: network.toUpperCase(),
      reference: reference,
      description: `${network} ${selectedBundle.name}`,
      callback_url: `${req.protocol}://${req.get('host')}/api/webhook/harakapesa`
    };

    const response = await axios.post(
      `${process.env.HARAKAPESA_BASE_URL}/payments/push`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.HARAKAPESA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.json({
      success: true,
      message: 'USSD Push sent! Please check your phone and enter your PIN.',
      reference,
      providerResponse: response.data
    });

  } catch (error) {
    console.error('Payment Push Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate payment push. Check API credentials or endpoint.',
      error: error.response?.data || error.message
    });
  }
});

// Webhook endpoint to receive payment confirmation from HarakaPesa
app.post('/api/webhook/harakapesa', (req, res) => {
  console.log('HarakaPesa Webhook Received:', req.body);
  // TODO: Verify signature & trigger bundle fulfillment / database log here
  res.status(200).json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// server.js - Complete backend with Paystack integration
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paystack Configuration - IMPORTANT: Use environment variables in production!
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'https://edith-edna-closet.onrender.com';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'https://edith-edna-closet.onrender.com';

// Verify Paystack webhook signature
function verifyWebhookSignature(req) {
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    return signature === hash;
}

// ============================================
// INITIALIZE MOBILE MONEY PAYMENT
// ============================================
app.post('/api/initialize-payment', async (req, res) => {
    try {
        const { email, amount, name, cart, metadata, provider, phoneNumber } = req.body;

        // Validate required fields
        if (!email || !amount || !name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: email, amount, name' 
            });
        }

        // Validate amount (minimum 1 GHS = 100 pesewas)
        const amountInPesewas = Math.round(amount * 100);
        if (amountInPesewas < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum payment amount is GHS 1.00'
            });
        }

        // Generate unique reference
        const reference = `EDITH-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

        console.log('📱 Initializing mobile money payment:', { 
            email, 
            amount: amountInPesewas, 
            reference, 
            provider,
            phoneNumber 
        });

        // Map provider to Paystack's expected values
        let mobileMoneyProvider = 'mtn';
        if (provider === 'vodafone') mobileMoneyProvider = 'vodafone';
        if (provider === 'airteltigo') mobileMoneyProvider = 'airteltigo';

        // Initialize transaction with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                amount: amountInPesewas,
                reference: reference,
                callback_url: `${req.protocol}://${req.get('host')}/api/payment-callback`,
                metadata: {
                    customer_name: name,
                    cart: JSON.stringify(cart),
                    provider: provider,
                    phone_number: phoneNumber,
                    ...metadata
                },
                channels: ['mobile_money'], // ONLY mobile money
                currency: 'GHS'
            })
        });

        const data = await response.json();
        
        if (data.status) {
            console.log('✅ Mobile money payment initialized successfully:', data.data.reference);
            
            res.json({
                success: true,
                data: {
                    reference: data.data.reference,
                    authorization_url: data.data.authorization_url,
                    mobile_money_number: phoneNumber,
                    provider: provider,
                    amount: amount
                }
            });
        } else {
            console.error('❌ Paystack error:', data);
            res.status(400).json({ 
                success: false, 
                message: data.message || 'Payment initialization failed'
            });
        }
    } catch (error) {
        console.error('❌ Payment initialization failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Payment initialization failed',
            error: error.message 
        });
    }
});

// ============================================
// VERIFY PAYMENT
// ============================================
app.get('/api/verify-payment/:reference', async (req, res) => {
    try {
        const { reference } = req.params;
        
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.status && data.data.status === 'success') {
            console.log('✅ Payment verified successfully:', reference);
            res.json({
                success: true,
                data: data.data
            });
        } else {
            console.log('❌ Payment verification failed:', data);
            res.json({
                success: false,
                message: data.message || 'Payment verification failed',
                status: data.data?.status
            });
        }
    } catch (error) {
        console.error('❌ Verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification failed',
            error: error.message
        });
    }
});

// ============================================
// PAYMENT CALLBACK (Webhook)
// ============================================

// Support both webhook paths (for flexibility)
app.post('/paystack-webhook', async (req, res) => {
    console.log('📢 Webhook received at /paystack-webhook');
    // Forward to the main webhook handler
    return app.handle(req, res, '/api/payment-callback');
});

// Keep your existing /api/payment-callback route
app.post('/api/payment-callback', async (req, res) => {
    // Your existing webhook code here
    console.log('📢 Webhook received at /api/payment-callback');
    
    try {
        // Verify webhook signature
        const signature = req.headers['x-paystack-signature'];
        const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');
        
        if (signature !== hash) {
            console.log('❌ Invalid webhook signature');
            return res.status(401).send('Invalid signature');
        }
        
        const event = req.body;
        
        if (event.event === 'charge.success') {
            const transaction = event.data;
            const metadata = transaction.metadata;
            
            console.log('💰 Payment successful:', {
                reference: transaction.reference,
                amount: transaction.amount / 100,
                customer: transaction.customer.email
            });
            
            // Here you would save the order to your database
            // For now, we'll just log it
            
            // You can also send a confirmation email here
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.sendStatus(500);
    }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Backend is working!',
        endpoints: {
            health: '/api/health',
            initPayment: '/api/initialize-payment',
            verifyPayment: '/api/verify-payment/:reference',
            webhook: '/api/payment-callback'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
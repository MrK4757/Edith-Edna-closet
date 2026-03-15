const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Your Paystack secret key - will be set via environment variable
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Test endpoint to verify server is running
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Edith & Edna Payment Server is running',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Health check endpoint (Render uses this)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Endpoint to initialize payment
app.post('/initialize-payment', async (req, res) => {
    try {
        const { email, amount, name, cart, metadata } = req.body;

        // Validate required fields
        if (!email || !amount || !name) {
            return res.status(400).json({ 
                status: false, 
                message: 'Missing required fields: email, amount, name' 
            });
        }

        // Generate unique reference
        const reference = `EDITH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        console.log('Initializing payment:', { email, amount, reference });

        // Initialize transaction with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                amount: amount,
                reference: reference,
                callback_url: `${req.protocol}://${req.get('host')}/payment-callback`,
                metadata: {
                    customer_name: name,
                    cart: cart,
                    ...metadata
                },
                channels: ['mobile_money', 'card'] // Allow both mobile money and card
            })
        });

        const data = await response.json();
        
        if (data.status) {
            console.log('Payment initialized successfully:', data.data.reference);
        } else {
            console.error('Paystack error:', data);
        }
        
        res.json(data);
    } catch (error) {
        console.error('Payment initialization failed:', error);
        res.status(500).json({ 
            status: false, 
            message: 'Payment initialization failed',
            error: error.message 
        });
    }
});

// Webhook endpoint (called by Paystack after payment)
app.post('/paystack-webhook', async (req, res) => {
    try {
        // Verify webhook signature (security)
        const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');
        
        if (hash !== req.headers['x-paystack-signature']) {
            console.warn('Invalid webhook signature');
            return res.status(401).send('Unauthorized');
        }

        const event = req.body;
        
        // Handle successful payment
        if (event.event === 'charge.success') {
            const { reference, metadata, amount, customer } = event.data;
            
            console.log('✅ Payment successful:', {
                reference,
                amount: amount / 100, // Convert from pesewas
                customer: metadata?.customer_name || customer?.email,
                email: customer?.email,
                timestamp: new Date().toISOString()
            });

            // Here you would:
            // 1. Save order to database (if you add one)
            // 2. Update inventory
            // 3. Send confirmation email
            // For now, just log it
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Callback endpoint (user returns here after payment)
app.get('/payment-callback', (req, res) => {
    const { reference, status } = req.query;
    
    // Redirect back to your store with payment status
    // Replace with your actual store URL
    const storeUrl = process.env.STORE_URL || 'https://www.edithednacloset.org';
    res.redirect(`${storeUrl}/cart.html?payment=${status || 'completed'}&ref=${reference}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        status: false, 
        message: 'Internal server error',
        error: err.message 
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
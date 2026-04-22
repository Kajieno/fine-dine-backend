import prisma from '../lib/prisma.js';

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const BRANCH_PRICE_USD = 29;

async function getExchangeRate() {
  return parseFloat(process.env.PAYMOB_USD_TO_EGP_RATE || '50');
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paymob API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function paymobAuthToken() {
  const data = await postJson('https://accept.paymob.com/api/auth/tokens', {
    api_key: PAYMOB_API_KEY,
  });
  return data.token;
}

async function createPaymobOrder(authToken, amountCents) {
  return postJson('https://accept.paymob.com/api/ecommerce/orders', {
    auth_token: authToken,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: 'EGP',
    items: [],
  });
}

async function createPaymentKey(authToken, amountCents, orderId, billingData) {
  const data = await postJson('https://accept.paymob.com/api/acceptance/payment_keys', {
    auth_token: authToken,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: orderId,
    billing_data: billingData,
    currency: 'EGP',
    integration_id: parseInt(PAYMOB_INTEGRATION_ID),
  });
  return data.token;
}

function buildBillingData(brand) {
  return {
    first_name: brand.owner_name || brand.name,
    last_name: 'N/A',
    email: brand.owner_email || 'noemail@finedine.app',
    phone_number: brand.owner_phone || '+20000000000',
    apartment: 'N/A', floor: 'N/A', street: 'N/A',
    building: 'N/A', shipping_method: 'N/A',
    postal_code: 'N/A', city: 'Cairo', country: 'EG', state: 'Cairo',
  };
}

// POST /api/subscription/register
export async function registerBrand(req, res) {
  try {
    const { name, slug, owner_name, owner_email, owner_phone } = req.body;
    if (!name || !slug || !owner_email) {
      return res.status(400).json({ error: 'name, slug, and owner_email are required' });
    }
    const slugExists = await prisma.brand.findUnique({ where: { slug } });
    if (slugExists) return res.status(409).json({ error: 'Slug already taken' });
    const emailExists = await prisma.brand.findFirst({ where: { owner_email } });
    if (emailExists) return res.status(409).json({ error: 'Email already registered' });

    const brand = await prisma.brand.create({
      data: { name, slug, owner_name, owner_email, owner_phone, status: 'PENDING_PAYMENT' },
    });
    return res.status(201).json({
      message: 'Brand registered. Complete payment to activate.',
      brand_id: brand.id,
      brand_slug: brand.slug,
    });
  } catch (err) {
    console.error('registerBrand error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

// POST /api/subscription/initiate-payment
export async function initiateSubscriptionPayment(req, res) {
  try {
    const { brand_id, plan } = req.body;
    if (!brand_id || !plan) {
      return res.status(400).json({ error: 'brand_id and plan are required' });
    }
    const brand = await prisma.brand.findUnique({ where: { id: parseInt(brand_id) } });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const priceUsd = plan === 'YEARLY' ? 199 : 29;
    const rate = await getExchangeRate();
    const amountCents = Math.round(priceUsd * rate * 100);

    const authToken = await paymobAuthToken();
    const order = await createPaymobOrder(authToken, amountCents);
    const paymentKey = await createPaymentKey(authToken, amountCents, order.id, buildBillingData(brand));

    await prisma.paymobPayment.create({
      data: {
        brand_id: brand.id,
        type: 'SUBSCRIPTION',
        amount_usd: priceUsd,
        paymob_order_id: String(order.id),
        status: 'PENDING',
        metadata: { plan },
      },
    });

    const iframeId = process.env.PAYMOB_IFRAME_ID;
    const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;
    return res.json({ payment_url: paymentUrl, payment_token: paymentKey });
  } catch (err) {
    console.error('initiateSubscriptionPayment error:', err);
    return res.status(500).json({ error: 'Payment initiation failed' });
  }
}

// POST /api/subscription/paymob/webhook
export async function paymobWebhook(req, res) {
  try {
    const obj = req.body?.obj || req.body;
    const success = obj.success === true || obj.success === 'true';
    const orderId = String(obj.order?.id || obj.order_id || '');
    const transactionId = String(obj.id || '');

    const payment = await prisma.paymobPayment.findFirst({ where: { paymob_order_id: orderId } });
    if (!payment) return res.status(200).json({ received: true });

    if (success) {
      await prisma.paymobPayment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', paymob_txn_id: transactionId },
      });

      if (payment.type === 'SUBSCRIPTION') {
        const meta = payment.metadata;
        const plan = meta?.plan || 'MONTHLY';
        const priceUsd = plan === 'YEARLY' ? 199 : 29;
        const now = new Date();
        const expires = new Date(now);
        if (plan === 'YEARLY') expires.setFullYear(expires.getFullYear() + 1);
        else expires.setMonth(expires.getMonth() + 1);

        const sub = await prisma.subscription.create({
          data: {
            brand_id: payment.brand_id,
            plan,
            status: 'ACTIVE',
            price_usd: priceUsd,
            starts_at: now,
            expires_at: expires,
            branch_count: 1,
          },
        });
        await prisma.paymobPayment.update({ where: { id: payment.id }, data: { subscription_id: sub.id } });
        await prisma.brand.update({ where: { id: payment.brand_id }, data: { status: 'ACTIVE' } });
      } else if (payment.type === 'BRANCH') {
        await prisma.brand.update({ where: { id: payment.brand_id }, data: { status: 'ACTIVE' } });
      }
    } else {
      await prisma.paymobPayment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('paymobWebhook error:', err);
    return res.status(200).json({ received: true });
  }
}

// GET /api/subscription/status/:brandId
export async function getSubscriptionStatus(req, res) {
  try {
    const brandId = parseInt(req.params.brandId);
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        subscriptions: { orderBy: { created_at: 'desc' }, take: 1 },
        _count: { select: { locations: true } },
      },
    });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    return res.json({
      brand_id: brand.id,
      brand_name: brand.name,
      status: brand.status,
      subscription: brand.subscriptions[0] || null,
      branch_count: brand._count.locations,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get status' });
  }
}

// POST /api/subscription/add-branch/:brandId
export async function addBranchPayment(req, res) {
  try {
    const brandId = parseInt(req.params.brandId);
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const rate = await getExchangeRate();
    const amountCents = Math.round(BRANCH_PRICE_USD * rate * 100);

    const authToken = await paymobAuthToken();
    const order = await createPaymobOrder(authToken, amountCents);
    const paymentKey = await createPaymentKey(authToken, amountCents, order.id, buildBillingData(brand));

    await prisma.paymobPayment.create({
      data: {
        brand_id: brand.id,
        type: 'BRANCH',
        amount_usd: BRANCH_PRICE_USD,
        paymob_order_id: String(order.id),
        status: 'PENDING',
        metadata: { purpose: 'new_branch' },
      },
    });

    const iframeId = process.env.PAYMOB_IFRAME_ID;
    const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;
    return res.json({ payment_url: paymentUrl, amount_usd: BRANCH_PRICE_USD });
  } catch (err) {
    console.error('addBranchPayment error:', err);
    return res.status(500).json({ error: 'Failed to initiate branch payment' });
  }
}

// GET /api/subscription/brands
export async function listBrands(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = status ? { status } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: {
          subscriptions: { orderBy: { created_at: 'desc' }, take: 1 },
          _count: { select: { locations: true } },
        },
      }),
      prisma.brand.count({ where }),
    ]);
    return res.json({ brands, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list brands' });
  }
}

// PATCH /api/subscription/brands/:brandId/activate
export async function activateBrand(req, res) {
  try {
    const brand = await prisma.brand.update({
      where: { id: parseInt(req.params.brandId) },
      data: { status: 'ACTIVE' },
    });
    return res.json({ message: 'Brand activated', brand });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to activate brand' });
  }
}

// PATCH /api/subscription/brands/:brandId/suspend
export async function suspendBrand(req, res) {
  try {
    const brand = await prisma.brand.update({
      where: { id: parseInt(req.params.brandId) },
      data: { status: 'SUSPENDED' },
    });
    return res.json({ message: 'Brand suspended', brand });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to suspend brand' });
  }
}

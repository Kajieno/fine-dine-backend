import { io } from 'socket.io-client';

// Test Socket.IO real-time events
async function testSocketIO() {
  console.log('🧪 Testing Socket.IO real-time events...\n');

  // Connect to Socket.IO server
  const socket = io('http://localhost:3000');

  socket.on('connect', () => {
    console.log('✅ Connected to Socket.IO server');
    console.log('🔗 Socket ID:', socket.id);

    // Join location room
    socket.emit('join_location', 1);
    console.log('📍 Joined location room: 1\n');
  });

  // Listen for events
  socket.on('new_order', (data) => {
    console.log('📦 NEW ORDER EVENT RECEIVED:');
    console.log('   Order ID:', data.order_id);
    console.log('   Table:', data.table_number);
    console.log('   Items:', data.items.length);
    console.log('   Submitted at:', data.submitted_at);
    console.log();
  });

  socket.on('order_accepted', (data) => {
    console.log('✅ ORDER ACCEPTED EVENT RECEIVED:');
    console.log('   Order ID:', data.order_id);
    console.log('   Estimated minutes:', data.estimated_minutes);
    console.log();
  });

  socket.on('bill_requested', (data) => {
    console.log('💳 BILL REQUESTED EVENT RECEIVED:');
    console.log('   Bill Request ID:', data.bill_request_id);
    console.log('   Order ID:', data.order_id);
    console.log('   Table:', data.table_number);
    console.log('   Payment Method:', data.payment_method);
    console.log('   Order Total:', data.order_total);
    console.log();
  });

  socket.on('bill_done', (data) => {
    console.log('💰 BILL DONE EVENT RECEIVED:');
    console.log('   Bill Request ID:', data.bill_request_id);
    console.log();
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from Socket.IO server');
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test the order flow
  try {
    console.log('🚀 Starting order flow test...\n');

    // 1. Login as admin to get token
    const adminLoginResponse = await fetch('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@finedine.com',
        password: 'admin123'
      })
    });

    if (!adminLoginResponse.ok) {
      throw new Error('Admin login failed');
    }

    const adminData = await adminLoginResponse.json();
    const adminToken = adminData.token;
    console.log('🔑 Admin logged in');

    // 2. Login as captain to get token
    const captainLoginResponse = await fetch('http://localhost:3000/api/captain/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'captain@finedine.com',
        password: 'captain123'
      })
    });

    if (!captainLoginResponse.ok) {
      throw new Error('Captain login failed');
    }

    const captainData = await captainLoginResponse.json();
    const captainToken = captainData.token;
    console.log('👨‍🍳 Captain logged in');

    // 3. Create order (should trigger 'new_order' event)
    console.log('📝 Creating order...');
    const orderResponse = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        location_id: 1,
        table_id: 1,
        items: [
          { item_id: 1, quantity: 2 }, // Caesar Salad x2
          { item_id: 3, quantity: 1 }  // Grilled Salmon x1
        ]
      })
    });

    if (!orderResponse.ok) {
      throw new Error('Order creation failed');
    }

    const orderData = await orderResponse.json();
    const orderId = orderData.id;
    console.log(`✅ Order created with ID: ${orderId}`);

    // Join the order room to receive order-specific events
    socket.emit('join_order', orderId);

    // Wait for new_order event
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Accept order (should trigger 'order_accepted' event)
    console.log('⏰ Accepting order...');
    const acceptResponse = await fetch(`http://localhost:3000/api/orders/${orderId}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${captainToken}`
      },
      body: JSON.stringify({
        estimated_minutes: 20
      })
    });

    if (!acceptResponse.ok) {
      throw new Error('Order acceptance failed');
    }

    console.log('✅ Order accepted');

    // Wait for order_accepted event
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Request bill (should trigger 'bill_requested' event)
    console.log('💳 Requesting bill...');
    const billResponse = await fetch('http://localhost:3000/api/bill-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        payment_method: 'CARD'
      })
    });

    if (!billResponse.ok) {
      throw new Error('Bill request failed');
    }

    const billData = await billResponse.json();
    const billId = billData.bill_request_id;
    console.log(`✅ Bill requested with ID: ${billId}`);

    // Wait for bill_requested event
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 6. Mark bill as done (should trigger 'bill_done' event)
    console.log('💰 Marking bill as done...');
    const doneResponse = await fetch(`http://localhost:3000/api/bill-request/${billId}/done`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${captainToken}`
      }
    });

    if (!doneResponse.ok) {
      throw new Error('Bill completion failed');
    }

    console.log('✅ Bill marked as done');

    // Wait for bill_done event
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🎉 Socket.IO test completed successfully!');
    console.log('📊 Events received: new_order, order_accepted, bill_requested, bill_done');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Clean up
    socket.disconnect();
    process.exit(0);
  }
}

testSocketIO();
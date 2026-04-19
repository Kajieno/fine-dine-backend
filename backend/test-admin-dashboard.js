import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

async function testAdminDashboard() {
  console.log('🧪 Testing Admin Dashboard Analytics & Management Features\n');

  let adminToken = '';

  try {
    // 1. Admin Authentication
    console.log('🔐 Testing Admin Authentication...');
    const loginResponse = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@finedine.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Admin login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    adminToken = loginData.token;
    console.log('✅ Admin authenticated successfully\n');

    // 2. Analytics Testing
    console.log('📊 Testing Analytics Endpoints...\n');

    // Orders Analytics
    console.log('📈 Orders Analytics:');
    const ordersAnalytics = await fetch(`${BASE_URL}/analytics/orders`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (ordersAnalytics.ok) {
      const data = await ordersAnalytics.json();
      console.log('✅ Orders analytics retrieved');
      console.log(`   Total Orders: ${data.total_orders || 'N/A'}`);
      console.log(`   Revenue: $${data.total_revenue || 'N/A'}`);
      console.log(`   Average Order: $${data.average_order_value || 'N/A'}`);
    } else {
      console.log('❌ Orders analytics failed');
    }

    // Cancellations Analytics
    console.log('\n🚫 Cancellations Analytics:');
    const cancellationsAnalytics = await fetch(`${BASE_URL}/analytics/cancellations`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (cancellationsAnalytics.ok) {
      const data = await cancellationsAnalytics.json();
      console.log('✅ Cancellations analytics retrieved');
      console.log(`   Total Cancellations: ${data.total_cancellations || 'N/A'}`);
      console.log(`   Cancellation Rate: ${data.cancellation_rate || 'N/A'}%`);
    } else {
      console.log('❌ Cancellations analytics failed');
    }

    // Menu Performance Analytics
    console.log('\n🍽️ Menu Performance Analytics:');
    const menuPerformance = await fetch(`${BASE_URL}/analytics/menu-performance`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (menuPerformance.ok) {
      const data = await menuPerformance.json();
      console.log('✅ Menu performance analytics retrieved');
      console.log(`   Top Items: ${data.top_items?.length || 0} items`);
      if (data.top_items?.length > 0) {
        console.log(`   Best Seller: ${data.top_items[0].name} (${data.top_items[0].orders_count} orders)`);
      }
    } else {
      console.log('❌ Menu performance analytics failed');
    }

    // Captain Performance Analytics
    console.log('\n👨‍🍳 Captain Performance Analytics:');
    const captainPerformance = await fetch(`${BASE_URL}/analytics/captain-performance`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (captainPerformance.ok) {
      const data = await captainPerformance.json();
      console.log('✅ Captain performance analytics retrieved');
      console.log(`   Active Captains: ${data.captains?.length || 0}`);
      if (data.captains?.length > 0) {
        const topCaptain = data.captains[0];
        console.log(`   Top Captain: ${topCaptain.name} (${topCaptain.accepted_orders} orders)`);
      }
    } else {
      console.log('❌ Captain performance analytics failed');
    }

    // Offers Performance Analytics
    console.log('\n🎯 Offers Performance Analytics:');
    const offersPerformance = await fetch(`${BASE_URL}/analytics/offers-performance`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (offersPerformance.ok) {
      const data = await offersPerformance.json();
      console.log('✅ Offers performance analytics retrieved');
      console.log(`   Active Offers: ${data.offers?.length || 0}`);
      if (data.offers?.length > 0) {
        const topOffer = data.offers[0];
        console.log(`   Top Offer: ${topOffer.name} (${topOffer.usage_count} uses)`);
      }
    } else {
      console.log('❌ Offers performance analytics failed');
    }

    // 3. Management Features Testing
    console.log('\n🏢 Testing Management Features...\n');

    // Brand Management
    console.log('🏷️ Brand Management:');
    const brandResponse = await fetch(`${BASE_URL}/brand`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (brandResponse.ok) {
      const brand = await brandResponse.json();
      console.log('✅ Brand retrieved successfully');
      console.log(`   Brand: ${brand.name}`);
      console.log(`   Description: ${brand.description}`);
    } else {
      console.log('❌ Brand retrieval failed');
    }

    // Location Management
    console.log('\n📍 Location Management:');
    const locationsResponse = await fetch(`${BASE_URL}/locations`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (locationsResponse.ok) {
      const locations = await locationsResponse.json();
      console.log('✅ Locations retrieved successfully');
      console.log(`   Total Locations: ${locations.length}`);
      if (locations.length > 0) {
        console.log(`   First Location: ${locations[0].name} (${locations[0].address})`);
      }
    } else {
      console.log('❌ Locations retrieval failed');
    }

    // Menu Management
    console.log('\n🍽️ Menu Management:');
    const menusResponse = await fetch(`${BASE_URL}/menus`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    let menusData = null;
    if (menusResponse.ok) {
      menusData = await menusResponse.json();
      console.log('✅ Menus retrieved successfully');
      console.log(`   Total Menus: ${menusData.length}`);
      if (menusData.length > 0) {
        const menu = menusData[0];
        console.log(`   First Menu: ${menu.name} (${menu.is_active ? 'Active' : 'Inactive'})`);
      }
    } else {
      console.log('❌ Menus retrieval failed');
    }

    // Captain Management
    console.log('\n👨‍🍳 Captain Management:');
    const captainsResponse = await fetch(`${BASE_URL}/captains`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (captainsResponse.ok) {
      const captains = await captainsResponse.json();
      console.log('✅ Captains retrieved successfully');
      console.log(`   Total Captains: ${captains.length}`);
      if (captains.length > 0) {
        const captain = captains[0];
        console.log(`   First Captain: ${captain.name} (${captain.email})`);
      }
    } else {
      console.log('❌ Captains retrieval failed');
    }

    // Offer Management
    console.log('\n🎯 Offer Management:');
    const offersResponse = await fetch(`${BASE_URL}/offers?location_id=1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (offersResponse.ok) {
      const offers = await offersResponse.json();
      console.log('✅ Offers retrieved successfully');
      console.log(`   Total Offers: ${offers.length}`);
      if (offers.length > 0) {
        const offer = offers[0];
        console.log(`   First Offer: ${offer.display_label} (${offer.discount_percentage}% off)`);
      }
    } else {
      console.log('❌ Offers retrieval failed');
    }

    // Test Menu Categories and Items (using first menu if available)
    if (menusData && menusData.length > 0) {
      const menuId = menusData[0].id;
      console.log(`\n📋 Testing Menu ${menuId} Categories & Items:`);

      // Categories
      const categoriesResponse = await fetch(`${BASE_URL}/menus/${menuId}/categories`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (categoriesResponse.ok) {
        const categories = await categoriesResponse.json();
        console.log(`✅ Categories retrieved: ${categories.length} categories`);
        if (categories.length > 0) {
          const category = categories[0];
          console.log(`   First Category: ${category.name.en || category.name}`);

          // Items in first category
          const itemsResponse = await fetch(`${BASE_URL}/menus/categories/${category.id}/items`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
          });
          if (itemsResponse.ok) {
            const items = await itemsResponse.json();
            console.log(`✅ Items retrieved: ${items.length} items`);
            if (items.length > 0) {
              const item = items[0];
              console.log(`   First Item: ${item.name.en || item.name} - $${item.price}`);
            }
          } else {
            console.log('❌ Items retrieval failed');
          }
        }
      } else {
        console.log('❌ Categories retrieval failed');
      }
    }

    // Test Table Management
    console.log('\n🪑 Table Management:');
    const tablesResponse = await fetch(`${BASE_URL}/tables?location_id=1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (tablesResponse.ok) {
      const tables = await tablesResponse.json();
      console.log('✅ Tables retrieved successfully');
      console.log(`   Total Tables: ${tables.length}`);
      if (tables.length > 0) {
        const table = tables[0];
        console.log(`   First Table: Table ${table.number} (${table.capacity} seats)`);
      }
    } else {
      console.log('❌ Tables retrieval failed');
    }

    console.log('\n🎉 Admin Dashboard Testing Complete!');
    console.log('✅ All major analytics and management features tested');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testAdminDashboard();
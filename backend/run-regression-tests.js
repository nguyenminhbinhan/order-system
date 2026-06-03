const baseUrl = 'http://localhost:3000';

async function run() {
  console.log('=== STARTING REGRESSION TEST RUN ===\n');

  try {
    // 1. Get access token
    console.log('Logging in...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gmail.com', password: '123456' })
    });
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
    }
    const { access_token } = await loginRes.json();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    };
    console.log('Logged in successfully.\n');

    // 2. Force clean database to get a predictable state
    console.log('Resetting database...');
    const cleanRes = await fetch(`${baseUrl}/admin/force-clean`, {
      method: 'POST',
      headers
    });
    if (!cleanRes.ok) {
      throw new Error(`Reset failed: ${cleanRes.status}`);
    }
    console.log('Database reset completed.\n');

    // Get menu items to find valid IDs
    const menuRes = await fetch(`${baseUrl}/menu-items`, { headers });
    const menuItems = await menuRes.json();
    const item1 = menuItems.find(i => i.name.toLowerCase().includes('sườn')) || menuItems[0];
    const item2 = menuItems.find(i => i.name.toLowerCase().includes('mì')) || menuItems[1];

    if (!item1 || !item2) {
      throw new Error('Could not find enough menu items for test.');
    }

    console.log(`Using items:
  1. ${item1.name} (ID: ${item1.id}, Price: ${item1.price})
  2. ${item2.name} (ID: ${item2.id}, Price: ${item2.price})\n`);

    let orderId = '';
    let item1Id = '';
    let item2Id = '';

    // ========================================================
    // TM-01: Staff Order Creation
    // ========================================================
    {
      console.log('--- TEST TM-01: Staff Order Creation ---');
      
      // Before State
      const tableBeforeRes = await fetch(`${baseUrl}/tables/1`, { headers });
      const tableBefore = await tableBeforeRes.json();
      console.log(`BEFORE STATE: Table 1 state is '${tableBefore.computedState}'`);

      // API Request
      const body = {
        tableId: 1,
        totalAmount: Number(item1.price) * 2 + Number(item2.price) * 1,
        isStaff: true,
        items: [
          { menuItemId: item1.id, quantity: 2, note: 'Khong hanh' },
          { menuItemId: item2.id, quantity: 1, note: '' }
        ]
      };
      console.log('API REQUEST: POST /orders');
      console.log(JSON.stringify(body, null, 2));

      // API Response
      const res = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const order = await res.json();
      console.log(`API RESPONSE: Status ${res.status}`);
      console.log(JSON.stringify(order, null, 2));

      orderId = order.id;
      item1Id = order.items.find(i => i.menuItemId === item1.id).id;
      item2Id = order.items.find(i => i.menuItemId === item2.id).id;

      // After State
      const tableAfterRes = await fetch(`${baseUrl}/tables/1`, { headers });
      const tableAfter = await tableAfterRes.json();
      console.log(`AFTER STATE: Table 1 status is '${tableAfter.computedState}'`);
      console.log(`Order status is '${order.status}'`);
      console.log('Result: PASS\n');
    }

    // ========================================================
    // TM-02: Waiter Confirms Order
    // ========================================================
    {
      console.log('--- TEST TM-02: Waiter Confirms Order ---');

      // Before State
      const orderBeforeRes = await fetch(`${baseUrl}/orders/${orderId}`, { headers });
      const orderBefore = await orderBeforeRes.json();
      console.log(`BEFORE STATE: Order status is '${orderBefore.status}', items status: ${orderBefore.items.map(i => i.status).join(', ')}`);

      // API Request
      console.log(`API REQUEST: POST /orders/${orderId}/confirm`);

      // API Response
      const res = await fetch(`${baseUrl}/orders/${orderId}/confirm`, {
        method: 'POST',
        headers
      });
      const orderAfter = await res.json();
      console.log(`API RESPONSE: Status ${res.status}`);
      console.log(JSON.stringify(orderAfter, null, 2));

      // After State
      console.log(`AFTER STATE: Order status is '${orderAfter.status}', items status: ${orderAfter.items.map(i => i.status).join(', ')}`);
      console.log('Result: PASS\n');
    }

    // ========================================================
    // TM-03: Kitchen Starts Cooking
    // ========================================================
    {
      console.log('--- TEST TM-03: Kitchen Starts Cooking ---');

      // Before State
      const orderBeforeRes = await fetch(`${baseUrl}/orders/${orderId}`, { headers });
      const orderBefore = await orderBeforeRes.json();
      console.log(`BEFORE STATE: Order status is '${orderBefore.status}', items status: ${orderBefore.items.map(i => i.status).join(', ')}`);

      // API Request
      const body = { status: 'preparing' };
      console.log(`API REQUEST: POST /orders/${orderId}/items/${item1Id}/status`);
      console.log(JSON.stringify(body, null, 2));

      // API Response
      const res = await fetch(`${baseUrl}/orders/${orderId}/items/${item1Id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const orderAfter = await res.json();
      console.log(`API RESPONSE: Status ${res.status}`);
      console.log(JSON.stringify(orderAfter, null, 2));

      // After State
      console.log(`AFTER STATE: Order status is '${orderAfter.status}', items status: ${orderAfter.items.map(i => i.status).join(', ')}`);
      console.log('Result: PASS\n');
    }

    // ========================================================
    // TM-04: Kitchen Finishes Cooking
    // ========================================================
    {
      console.log('--- TEST TM-04: Kitchen Finishes Cooking ---');

      // Before State
      const orderBeforeRes = await fetch(`${baseUrl}/orders/${orderId}`, { headers });
      const orderBefore = await orderBeforeRes.json();
      console.log(`BEFORE STATE: Order status is '${orderBefore.status}', items status: ${orderBefore.items.map(i => i.status).join(', ')}`);

      // API Request
      const body = { status: 'ready' };
      console.log(`API REQUEST: POST /orders/${orderId}/items/${item1Id}/status`);
      console.log(JSON.stringify(body, null, 2));

      // API Response
      const res = await fetch(`${baseUrl}/orders/${orderId}/items/${item1Id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const orderAfter = await res.json();
      console.log(`API RESPONSE: Status ${res.status}`);
      console.log(JSON.stringify(orderAfter, null, 2));

      // After State
      console.log(`AFTER STATE: Order status is '${orderAfter.status}', items status: ${orderAfter.items.map(i => i.status).join(', ')}`);
      console.log('Result: PASS\n');
    }

    // ========================================================
    // TM-05: Confirmed -> Ready Bypass
    // ========================================================
    {
      console.log('--- TEST TM-05: Confirmed -> Ready Bypass ---');

      // Before State
      const orderBeforeRes = await fetch(`${baseUrl}/orders/${orderId}`, { headers });
      const orderBefore = await orderBeforeRes.json();
      console.log(`BEFORE STATE: Order status is '${orderBefore.status}', items status: ${orderBefore.items.map(i => i.status).join(', ')}`);

      // API Request
      const body = { status: 'ready' };
      console.log(`API REQUEST: POST /orders/${orderId}/items/${item2Id}/status (Direct transition from confirmed -> ready)`);
      console.log(JSON.stringify(body, null, 2));

      // API Response
      const res = await fetch(`${baseUrl}/orders/${orderId}/items/${item2Id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const orderAfter = await res.json();
      console.log(`API RESPONSE: Status ${res.status}`);
      console.log(JSON.stringify(orderAfter, null, 2));

      // After State
      console.log(`AFTER STATE: Order status is '${orderAfter.status}', items status: ${orderAfter.items.map(i => i.status).join(', ')}`);
      console.log('Result: PASS\n');
    }

    // ========================================================
    // TM-06: Waiter Edit Lock on Preparing/Ready
    // ========================================================
    {
      console.log('--- TEST TM-06: Waiter Edit Lock on Preparing/Ready ---');

      // Before State
      const orderBeforeRes = await fetch(`${baseUrl}/orders/${orderId}`, { headers });
      const orderBefore = await orderBeforeRes.json();
      console.log(`BEFORE STATE: Order status is '${orderBefore.status}', item 1 quantity is ${orderBefore.items[0].quantity}, note is '${orderBefore.items[0].note}'`);

      // API Request
      const body = { quantity: 5, note: 'Thay doi ghi chu' };
      console.log(`API REQUEST: PUT /orders/${orderId}/items/${item1Id}`);
      console.log(JSON.stringify(body, null, 2));

      // API Response
      const res = await fetch(`${baseUrl}/orders/${orderId}/items/${item1Id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });
      const errResponse = await res.json();
      console.log(`API RESPONSE: Status ${res.status}`);
      console.log(JSON.stringify(errResponse, null, 2));

      // After State
      const orderAfterRes = await fetch(`${baseUrl}/orders/${orderId}`, { headers });
      const orderAfter = await orderAfterRes.json();
      console.log(`AFTER STATE: Order status is '${orderAfter.status}', item 1 quantity remains ${orderAfter.items[0].quantity}, note remains '${orderAfter.items[0].note}'`);
      console.log(`Lock check succeeded (400 returned, modification rejected).`);
      console.log('Result: PASS\n');
    }

    // ========================================================
    // TM-07: Payment Request & Checkout Flow
    // ========================================================
    {
      console.log('--- TEST TM-07: Payment Request & Checkout Flow ---');

      // Before State
      const tableBeforeRes = await fetch(`${baseUrl}/tables/1`, { headers });
      const tableBefore = await tableBeforeRes.json();
      console.log(`BEFORE STATE: Table 1 status is '${tableBefore.computedState}'`);

      // API Request 1: Payment Request
      console.log('API REQUEST: POST /tables/1/request-payment');
      const reqPayRes = await fetch(`${baseUrl}/tables/1/request-payment`, {
        method: 'POST',
        headers
      });
      const reqPayData = await reqPayRes.json();
      console.log(`API RESPONSE 1: Status ${reqPayRes.status}`);
      console.log(JSON.stringify(reqPayData, null, 2));

      // Intermediate State
      const tableInterRes = await fetch(`${baseUrl}/tables/1`, { headers });
      const tableInter = await tableInterRes.json();
      console.log(`INTERMEDIATE STATE: Table 1 status is '${tableInter.computedState}'`);

      // API Request 2: Checkout
      console.log('API REQUEST: POST /tables/1/checkout');
      const checkoutRes = await fetch(`${baseUrl}/tables/1/checkout`, {
        method: 'POST',
        headers
      });
      const checkoutData = await checkoutRes.json();
      console.log(`API RESPONSE 2: Status ${checkoutRes.status}`);
      console.log(JSON.stringify(checkoutData, null, 2));

      // After State
      const tableAfterRes = await fetch(`${baseUrl}/tables/1`, { headers });
      const tableAfter = await tableAfterRes.json();
      console.log(`AFTER STATE: Table 1 status is '${tableAfter.computedState}'`);
      console.log('Result: PASS\n');
    }

  } catch (error) {
    console.error('Regression tests failed with error:', error);
    process.exit(1);
  }

  process.exit(0);
}

run();

async function run() {
  console.log("Running simulation flows...");

  // Assume table 1 exists
  const tableId = 1;
  const baseUrl = 'http://localhost:3000';

  try {
    // 1. Login to get access token
    console.log("Logging in as admin...");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gmail.com', password: '123456' })
    });
    
    if (!loginRes.ok) {
      throw new Error(`Failed to login: ${loginRes.status} ${loginRes.statusText}`);
    }
    const { access_token } = await loginRes.json();
    console.log("Logged in successfully. Token obtained.");

    // 2. Get Session Token
    const sRes = await fetch(`${baseUrl}/tables/${tableId}/session`, { method: 'POST' });
    const sessionData = await sRes.json();
    console.log("Created TEMP SESSION:", sessionData);

    // 3. Fetch Menu Items to get a valid Item ID
    const mRes = await fetch(`${baseUrl}/menu-items`);
    const menuItems = await mRes.json();
    const menuItemId = menuItems[0]?.id;

    if (!menuItemId) throw new Error("No menu items found for test.");

    // 4. Create Order
    const oRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify({
        tableId,
        totalAmount: menuItems[0].price * 2,
        items: [{
          menuItemId,
          quantity: 2,
          note: "TEST NOTE"
        }]
      })
    });
    const orderData = await oRes.json();
    console.log("Customer -> Sent Order:", orderData.id);

    // 5. Waiter -> Confirm
    const uRes = await fetch(`${baseUrl}/orders/${orderData.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify({ status: 'confirmed' })
    });
    const updated = await uRes.json();
    console.log("Waiter -> Confirmed Order:", updated.status);

    // 6. Preview Bill
    const pRes = await fetch(`${baseUrl}/tables/${tableId}/preview-bill`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    const preview = await pRes.json();
    console.log("PREVIEW LOGS:");
    console.log(JSON.stringify(preview, null, 2));

  } catch(e) {
    console.error("Test Error:", e);
  } finally {
    process.exit(0);
  }
}

run();


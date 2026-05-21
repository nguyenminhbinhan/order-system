async function testAuthAndBill() {
  try {
    // 1. We need a token for an admin
    const loginRes = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gmail.com', password: '123' })
    });
    
    let token;
    if (!loginRes.ok) {
        console.log('Login failed with 123, trying 123456');
        const loginRes2 = await fetch('http://localhost:3000/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@gmail.com', password: '123456' })
        });
        const data2 = await loginRes2.json();
        token = data2.access_token;
    } else {
        const data1 = await loginRes.json();
        token = data1.access_token;
    }
    
    console.log('Got Token:', token.substring(0, 15) + '...');
    
    // 2. Test test-force-clean
    console.log('\n--- TESTING FORCE CLEAN ---');
    try {
      const cleanRes = await fetch('http://localhost:3000/admin/force-clean', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const cleanData = await cleanRes.json();
      console.log('Force Clean Result:', cleanData);
    } catch (err) {
      console.error('Force Clean Error:', err.message);
    }

    // 3. Test Preview Bill for all tables to find one with an active session
    console.log('\n--- FINDING TABLE WITH ACTIVE SESSION ---');
    const tablesRes = await fetch('http://localhost:3000/tables', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const tablesData = await tablesRes.json();
    
    const occupiedTable = tablesData.find(t => t.computedState === 'occupied' || t.computedState === 'paying' || t.computedState === 'waiting_confirm');
    
    if (occupiedTable) {
      console.log(`Found occupied table: ${occupiedTable.id} - ${occupiedTable.name}`);
      console.log('\n--- TESTING PREVIEW BILL ---');
      try {
        const previewRes = await fetch(`http://localhost:3000/tables/${occupiedTable.id}/preview-bill`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const previewData = await previewRes.json();
        console.log('Preview Result SUCCESS');
      } catch(err) {
        console.error('Preview Error:', err.message);
      }
    } else {
      console.log('No occupied tables found to test preview.');
    }
  } catch(err) {
    console.error('Test Execution failed:', err.message);
  }
}

testAuthAndBill();

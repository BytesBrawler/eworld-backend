// Simple test to check if the new endpoints exist
// Test the markSuccess and markFailed endpoints

const testEndpoint = async (url, method = 'GET', data = null) => {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        return {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
        };
    } catch (error) {
        return {
            error: error.message
        };
    }
};

const baseUrl = 'http://localhost:4000/api/v1';

async function testEndpoints() {
    console.log('Testing new Getepay endpoints...\n');
    
    // Test markSuccess endpoint (should require auth, so expect 401)
    console.log('1. Testing /wallet/getepay/markSuccess');
    const markSuccessTest = await testEndpoint(`${baseUrl}/wallet/getepay/markSuccess`, 'POST', {
        order_id: 'test',
        amount: 100
    });
    console.log('Response:', markSuccessTest);
    
    // Test markFailed endpoint (should require auth, so expect 401)
    console.log('\n2. Testing /wallet/getepay/markFailed');
    const markFailedTest = await testEndpoint(`${baseUrl}/wallet/getepay/markFailed`, 'POST', {
        order_id: 'test',
        reason: 'test reason'
    });
    console.log('Response:', markFailedTest);
    
    console.log('\n--- Test Results ---');
    console.log('If both endpoints return status 401 (Unauthorized), it means the endpoints exist but require authentication.');
    console.log('If they return status 404 (Not Found), it means the endpoints were not properly registered.');
    console.log('Expected: Both should return status 401 since we are not providing auth tokens.');
}

// Run the test
testEndpoints().catch(console.error);
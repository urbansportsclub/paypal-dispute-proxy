export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // Get access token from request header
      const accessToken = request.headers.get('x-paypal-access-token');

      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Missing x-paypal-access-token header' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Read remaining parameters from JSON body
      const body = await request.json();
      const { disputeId, fileName, base64File, evidenceType, notes } = body;

      if (!disputeId || !fileName || !base64File || !evidenceType) {
        return new Response(JSON.stringify({ error: 'Missing required body fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Decode base64 string back to binary buffer
      const binaryString = atob(base64File);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Build multipart/form-data payload for PayPal
      const formData = new FormData();

      const metaData = {
        evidence_type: evidenceType,
        notes: notes || ''
      };

      formData.append(
        'input',
        new Blob([JSON.stringify(metaData)], { type: 'application/json' })
      );

      formData.append(
        'file',
        new Blob([bytes], { type: 'application/pdf' }),
        fileName
      );

      // Forward to PayPal Dispute API
      const paypalUrl = `https://api-m.paypal.com/v1/customer/disputes/${disputeId}/provide-evidence`;
      const paypalResponse = await fetch(paypalUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paypalAccessToken}`
        },
        body: formData
      });

      const responseData = await paypalResponse.text();

      return new Response(responseData, {
        status: paypalResponse.status,
        headers: {
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

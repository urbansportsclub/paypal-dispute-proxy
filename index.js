export default {
  async fetch(request, env, ctx) {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check custom Bearer token stored in Cloudflare Environment Variables
    const authHeader = request.headers.get('Authorization');
    if (!env.PROXY_AUTH_TOKEN || authHeader !== `Bearer ${env.PROXY_AUTH_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing Bearer token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const paypalAccessToken = request.headers.get('X-PayPal-Access-Token');
      const body = await request.json();
      const { disputeId, fileName, base64File, evidenceType, notes } = body;
      if (!paypalAccessToken || !disputeId || !base64File) {
        return new Response(JSON.stringify({ error: 'Missing required fields (X-PayPal-Access-Token header, disputeId, base64File)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Convert Base64 to Binary ArrayBuffer
      const binaryString = atob(base64File);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

      // Build Multipart Form
      const formData = new FormData();
      
      const metadata = {
        evidences: [
          {
            evidence_type: evidenceType || 'PROOF_OF_FULFILLMENT',
            notes: notes || 'Uploaded supporting evidence.'
          }
        ]
      };

      // Add input JSON part
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      formData.append('input', metadataBlob);

      // Add file part
      formData.append('evidence-file', pdfBlob, fileName || 'evidence.pdf');

      // Send to PayPal
      const paypalUrl = `https://api-m.sandbox.paypal.com/v1/customer/disputes/${disputeId}/provide-evidence`;
      
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
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

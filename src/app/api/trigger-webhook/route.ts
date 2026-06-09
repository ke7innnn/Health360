import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error('N8N_WEBHOOK_URL is not configured in .env.local');
      return NextResponse.json(
        { error: 'n8n webhook URL is not configured on the server.' },
        { status: 500 }
      );
    }

    console.log(`Forwarding payload to n8n webhook: ${webhookUrl}`);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`n8n webhook returned status ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `n8n webhook returned status ${response.status}` },
        { status: response.status }
      );
    }

    let responseData = {};
    try {
      responseData = await response.json();
    } catch {
      // n8n webhooks might return plain text or empty response on success
    }

    return NextResponse.json({ success: true, data: responseData });
  } catch (error: any) {
    console.error('Error in n8n webhook proxy route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

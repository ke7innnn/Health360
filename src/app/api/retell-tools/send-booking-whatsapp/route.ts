import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[Retell Tool: send-booking-whatsapp] Received payload:', JSON.stringify(body));

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneId || !token) {
      console.error('[Retell Tool: send-booking-whatsapp] Missing WhatsApp credentials in environment.');
      return NextResponse.json({
        result: 'WhatsApp credentials not configured on the server.'
      }, { status: 200 }); // Always 200 so Retell gets a readable error result
    }

    // 1. Extract phone number from Retell payload
    const rawPhone = body.args?.patient_phone || body.call?.from_number || body.call?.user_number;

    if (!rawPhone) {
      console.error('[Retell Tool: send-booking-whatsapp] No phone number provided in payload.');
      return NextResponse.json({
        result: 'Could not detect caller phone number to send WhatsApp message.'
      }, { status: 200 });
    }

    // 2. Format phone number for Meta WhatsApp Cloud API (digits only, e.g. 919876543210)
    let cleanPhone = rawPhone.replace(/\D/g, '');
    
    // If it's a 10-digit Indian number, prepend 91
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://health360-nu.vercel.app'}/projects`;
    const messageText = `Hello from Health 360 Physiotherapy Clinic! 🩺\n\nYou can book your appointment online using the link below:\n\n👉 ${bookingLink}\n\nWe look forward to seeing you!`;

    // 3. Call Meta WhatsApp Cloud API
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: true,
          body: messageText
        }
      })
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error('[Retell Tool: send-booking-whatsapp] Meta API Error:', resData);
      return NextResponse.json({
        result: `Failed to send WhatsApp message: ${resData.error?.message || 'API error'}`
      }, { status: 200 });
    }

    console.log('[Retell Tool: send-booking-whatsapp] Successfully sent message to:', cleanPhone, resData);

    return NextResponse.json({
      result: `Successfully sent the online booking link to WhatsApp number +${cleanPhone}.`
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Retell Tool: send-booking-whatsapp] Unexpected error:', error);
    return NextResponse.json({
      result: 'An unexpected error occurred while sending the WhatsApp message.'
    }, { status: 200 });
  }
}

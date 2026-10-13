import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[Retell Tool: send-booking-whatsapp] Received payload:', JSON.stringify(body));

    // WhatsApp Cloud API credentials
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1264792810055065';
    const token = process.env.WHATSAPP_ACCESS_TOKEN || 'EAASaZAfwerw4BSPy41mNBLZB5kW7MC5TNDkNH9smpbnZAagtzjhWC1yi6pM1N4WZAqm3GfZA9hFNdrMtXsfepd89PXHj0rxYXCouZApit9YCPvXnJC0PSiRFh8N3a0rXDaEM0OkUL1XkTNqrNxAEbXnx3XZAEOZBb3iv3QMuwBCCE2UOK54NRtQZAMdMx3aFwbZCa5QQZDZD';

    if (!phoneId || !token) {
      console.error('[Retell Tool: send-booking-whatsapp] Missing WhatsApp credentials in environment.');
      return NextResponse.json({
        result: 'WhatsApp credentials not configured on the server.'
      }, { status: 200 });
    }

    // 1. Extract phone number and caller name from Retell payload
    const rawPhone = 
      body.args?.patient_phone || 
      body.args?.phone_number || 
      body.call?.from_number || 
      body.call?.user_number ||
      body.from_number ||
      body.user_number;

    const callerName = 
      body.args?.patient_name || 
      body.call?.retell_llm_dynamic_variables?.patient_name || 
      body.retell_llm_dynamic_variables?.patient_name || 
      'Patient';

    if (!rawPhone) {
      console.error('[Retell Tool: send-booking-whatsapp] No phone number provided in payload.');
      return NextResponse.json({
        result: 'Could not detect caller phone number to send WhatsApp message.'
      }, { status: 200 });
    }

    // 2. Format phone number for Meta WhatsApp Cloud API (digits only, e.g. 919876543210)
    let cleanPhone = String(rawPhone).replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = `91${cleanPhone.slice(1)}`;
    } else if (cleanPhone.length > 10 && !cleanPhone.startsWith('91') && cleanPhone.length <= 11) {
      cleanPhone = `91${cleanPhone.slice(-10)}`;
    }

    console.log(`[Retell Tool: send-booking-whatsapp] Dispatching to +${cleanPhone} for caller "${callerName}"...`);

    const websiteUrl = 'https://www.thehealth360.in/';
    const mapsUrl = 'https://maps.app.goo.gl/VpvTzGtZy3kCZZWGA';

    let deliverySuccess = false;
    let deliveryMethod = '';
    let messageId = '';

    // 3. PRIORITY 1: Send approved Meta template (health360_clinic_info with "Book Appointment" button)
    // NOTE: Meta Cloud API requires templates to initiate messages to users outside the 24h window.
    try {
      const templatePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: 'health360_clinic_info',
          language: { code: 'en' }
        }
      };

      const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templatePayload)
      });

      const data = await res.json();
      if (res.ok && data.messages?.[0]?.id) {
        deliverySuccess = true;
        deliveryMethod = 'meta_template_health360_clinic_info';
        messageId = data.messages[0].id;
        console.log('[Retell Tool: send-booking-whatsapp] Successfully sent health360_clinic_info template:', messageId);
      } else {
        console.warn('[Retell Tool: send-booking-whatsapp] health360_clinic_info failed:', data.error?.message || data);
      }
    } catch (err: any) {
      console.error('[Retell Tool: send-booking-whatsapp] Error calling health360_clinic_info template:', err.message);
    }

    // 4. PRIORITY 2 (Fallback): Send approved welcome_clinic_info template with patient name parameter
    if (!deliverySuccess) {
      try {
        const welcomePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'template',
          template: {
            name: 'welcome_clinic_info',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: callerName || 'Patient' }
                ]
              }
            ]
          }
        };

        const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(welcomePayload)
        });

        const data = await res.json();
        if (res.ok && data.messages?.[0]?.id) {
          deliverySuccess = true;
          deliveryMethod = 'meta_template_welcome_clinic_info';
          messageId = data.messages[0].id;
          console.log('[Retell Tool: send-booking-whatsapp] Successfully sent welcome_clinic_info template:', messageId);
        } else {
          console.warn('[Retell Tool: send-booking-whatsapp] welcome_clinic_info failed:', data.error?.message || data);
        }
      } catch (err: any) {
        console.error('[Retell Tool: send-booking-whatsapp] Error calling welcome_clinic_info template:', err.message);
      }
    }

    // 5. Rich text fallback (only if both templates failed, or to add rich context)
    if (!deliverySuccess) {
      try {
        const richMessage = `🌿 *Health 360 Physiotherapy & Craniosacral Clinic* 🌿\n\nHello ${callerName}! Thank you for calling Dr. Rashmita's Clinic.\n\n🌐 *Website & Online Booking:*\n👉 ${websiteUrl}\n\n📍 *Clinic Address:*\nHealth 360 Clinic, Shop no. 1 & 2, Amardeep Society, Om Nagar, Vasai West.\n\n🗺️ *Google Maps Location:*\n${mapsUrl}\n\n🕙 *Clinic Timings:*\n• Morning: 10:00 AM – 2:00 PM\n• Evening: 5:00 PM – 9:00 PM\n\n☎️ *Contact:* 8482812859 / 9834848981\n\nWe look forward to welcoming you! 🌸`;

        const textRes = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
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
              body: richMessage
            }
          })
        });

        const textData = await textRes.json();
        if (textRes.ok && textData.messages?.[0]?.id) {
          deliverySuccess = true;
          deliveryMethod = 'meta_text';
          messageId = textData.messages[0].id;
          console.log('[Retell Tool: send-booking-whatsapp] Sent plain text message:', messageId);
        }
      } catch (e: any) {
        console.warn('[Retell Tool: send-booking-whatsapp] Rich text fallback error:', e.message);
      }
    }

    if (deliverySuccess) {
      return NextResponse.json({
        result: `Successfully sent WhatsApp message with clinic details, booking link (${websiteUrl}), and address to +${cleanPhone}.`,
        method: deliveryMethod,
        message_id: messageId
      }, { status: 200 });
    }

    return NextResponse.json({
      result: 'Failed to deliver WhatsApp message via Meta Cloud API.'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Retell Tool: send-booking-whatsapp] Unexpected error:', error);
    return NextResponse.json({
      result: 'An unexpected error occurred while sending the WhatsApp message.'
    }, { status: 200 });
  }
}


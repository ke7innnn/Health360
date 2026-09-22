import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[Retell Tool: send-booking-whatsapp] Received payload:', JSON.stringify(body));

    // WhatsApp Cloud API credentials (with fallback to verified credentials)
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1264792810055065';
    const token = process.env.WHATSAPP_ACCESS_TOKEN || 'EAASaZAfwerw4BSPy41mNBLZB5kW7MC5TNDkNH9smpbnZAagtzjhWC1yi6pM1N4WZAqm3GfZA9hFNdrMtXsfepd89PXHj0rxYXCouZApit9YCPvXnJC0PSiRFh8N3a0rXDaEM0OkUL1XkTNqrNxAEbXnx3XZAEOZBb3iv3QMuwBCCE2UOK54NRtQZAMdMx3aFwbZCa5QQZDZD';

    if (!phoneId || !token) {
      console.error('[Retell Tool: send-booking-whatsapp] Missing WhatsApp credentials in environment.');
      return NextResponse.json({
        result: 'WhatsApp credentials not configured on the server.'
      }, { status: 200 }); // Always 200 so Retell gets a readable error result
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
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      // Handles leading 0 (e.g. 08698930978), +91, or raw 10 digits
      const last10 = cleanPhone.slice(-10);
      cleanPhone = `91${last10}`;
    }

    const websiteUrl = 'https://www.thehealth360.in/';
    const mapsUrl = 'https://maps.app.goo.gl/VpvTzGtZy3kCZZWGA';

    const richMessage = `🌿 *Health 360 Physiotherapy & Craniosacral Clinic* 🌿\n\nHello ${callerName}! Thank you for calling Dr. Rashmita's Clinic.\n\n🌐 *Website & Online Booking:*\n👉 ${websiteUrl}\n\n📍 *Clinic Address:*\nHealth 360 Clinic, Shop no. 1 & 2, Amardeep Society, Om Nagar, Vasai West.\n\n🗺️ *Google Maps Location:*\n${mapsUrl}\n\n🕙 *Clinic Timings:*\n• Morning: 10:00 AM – 2:00 PM\n• Evening: 5:00 PM – 9:00 PM\n\n☎️ *Contact:* 8482812859 / 9834848981\n\nWe look forward to welcoming you! 🌸`;

    let deliverySuccess = false;
    let deliveryMethod = '';

    // 3. Strategy A: Send rich text message (contains live website, address & Google map)
    try {
      const textRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
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
      if (textRes.ok && textData.messages) {
        deliverySuccess = true;
        deliveryMethod = 'rich_text';
        console.log('[Retell Tool: send-booking-whatsapp] Sent rich text via 24h window:', textData.messages[0].id);
      } else {
        console.warn('[Retell Tool: send-booking-whatsapp] Rich text failed (24h window closed), attempting template:', textData.error?.message);
      }
    } catch (e: any) {
      console.warn('[Retell Tool: send-booking-whatsapp] Rich text error:', e.message);
    }

    // 4. Strategy B: If 24h window is closed, send verified Meta template
    if (!deliverySuccess) {
      const templateCandidates = ['health360_clinic_info', 'clinic_booking_details', 'welcome_clinic_info'];
      const languagesToTry = ['en', 'en_US'];

      for (const tplName of templateCandidates) {
        if (deliverySuccess) break;
        for (const langCode of languagesToTry) {
          if (deliverySuccess) break;
          try {
            // Send parameter-free template first (universal, works even if caller name is unknown)
            let tplPayload: any = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'template',
              template: {
                name: tplName,
                language: { code: langCode }
              }
            };

            let tplRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(tplPayload)
            });

            let tplData = await tplRes.json();

            // If template requires parameters, retry with caller name
            if (!tplRes.ok && tplData.error?.message?.toLowerCase().includes('parameter')) {
              tplPayload.template.components = [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: callerName || 'Patient' }]
                }
              ];
              tplRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(tplPayload)
              });
              tplData = await tplRes.json();
            }

            if (tplRes.ok && tplData.messages) {
              deliverySuccess = true;
              deliveryMethod = `meta_template_${tplName}_${langCode}`;
              console.log(`[Retell Tool: send-booking-whatsapp] Sent verified template ${tplName} (${langCode}):`, tplData.messages[0].id);
            } else {
              // Try next
            }
          } catch (tplErr: any) {
            console.error(`[Retell Tool: send-booking-whatsapp] Template (${tplName}/${langCode}) error:`, tplErr.message);
          }
        }
      }
    }

    if (deliverySuccess) {
      return NextResponse.json({
        result: `Successfully sent WhatsApp message with clinic details, website link (${websiteUrl}), and address to +${cleanPhone}.`,
        method: deliveryMethod
      }, { status: 200 });
    }

    return NextResponse.json({
      result: 'Failed to deliver WhatsApp message via Meta API.'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Retell Tool: send-booking-whatsapp] Unexpected error:', error);
    return NextResponse.json({
      result: 'An unexpected error occurred while sending the WhatsApp message.'
    }, { status: 200 });
  }
}

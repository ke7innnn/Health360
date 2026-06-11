import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY || '';
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'Groq API Key is not configured. Please add GROQ_API_KEY to your environment variables.' },
        { status: 400 }
      );
    }

    const { transcript } = await request.json();

    if (!transcript || transcript.trim() === '') {
      return NextResponse.json(
        { error: 'Transcript content is required for summarization.' },
        { status: 400 }
      );
    }

    console.log(`[Groq Summarize] Summarizing transcript of length ${transcript.length}`);

    // Call Groq Chat Completions API directly
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Physio clinical assistant. Summarize call transcript in English only. Output exactly:
- **Patient Recovery Status**: (compliance & state)
- **Reported Symptoms & Pain**: (pain/stiffness)
- **Next Steps & Appointments**: (follow-ups)
Be concise. Write "Not discussed" if missing.`,
          },
          {
            role: 'user',
            content: `Here is the transcript:\n${transcript}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 350,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Groq API Error] Status: ${res.status} | Details: ${err}`);
      return NextResponse.json(
        { error: `Groq API returned an error: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const summary = data?.choices?.[0]?.message?.content || '';

    return NextResponse.json({ summary }, { status: 200 });

  } catch (error: any) {
    console.error('[Groq Summarize Exception]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const model = process.env.OLLAMA_MODEL || 'qwen3:4b';

async function main() {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise assistant for a property rental support system.',
        },
        {
          role: 'user',
          content:
            'Tra loi 1 cau ngan gon bang tieng Viet: he thong AI local da san sang chua?',
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data?.message?.content;

  if (!content) {
    throw new Error('Ollama response did not contain message.content');
  }

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Model: ${model}`);
  console.log('Smoke test OK');
  console.log('Response:');
  console.log(content.trim());
}

main().catch((error) => {
  console.error('Smoke test FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

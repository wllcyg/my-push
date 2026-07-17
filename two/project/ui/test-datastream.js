import { createDataStreamResponse } from 'ai';

async function main() {
  const response = createDataStreamResponse({
    execute: async (dataStream) => {
      dataStream.writeText('Hello');
      dataStream.writeText(' World');
      dataStream.writeMessageAnnotation({ type: 'test' });
      dataStream.writeToolCall({
        toolCallId: 'call-1',
        toolName: 'testTool',
        args: { test: '123' },
      });
      dataStream.writeToolResult({
        toolCallId: 'call-1',
        result: { success: true },
      });
    }
  });

  console.log("Headers:");
  for (const [key, value] of response.headers.entries()) {
    console.log(`${key}: ${value}`);
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  console.log("\nPayload:");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value));
  }
}
main();

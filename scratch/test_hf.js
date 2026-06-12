import fetch from 'node-fetch';

async function testHF() {
  // 1x1 transparent PNG base64
  const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const sessionHash = Math.random().toString(36).substring(2);

  try {
    console.log("Sending queue join request with base64 in FileData...");
    const joinResponse = await fetch('https://briaai-bria-rmbg-1-4.hf.space/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          {
            path: base64Image,
            orig_name: "image.png",
            mime_type: "image/png"
          }
        ],
        fn_index: 0,
        session_hash: sessionHash
      })
    });

    const joinJson = await joinResponse.json();
    if (joinJson.event_id) {
      console.log(`Event ID received: ${joinJson.event_id}. Fetching stream...`);
      const streamResponse = await fetch(`https://briaai-bria-rmbg-1-4.hf.space/queue/data?session_hash=${sessionHash}`);
      
      const text = await streamResponse.text();
      const lines = text.split('\n');
      let path = null;
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.substring(6));
            if (parsed.msg === 'process_completed' && parsed.success && parsed.output && parsed.output.data) {
              path = parsed.output.data[0].path;
              break;
            }
          } catch (e) {}
        }
      }

      if (path) {
        console.log(`Successfully parsed output path: ${path}`);
        const fileUrl = `https://briaai-bria-rmbg-1-4.hf.space/file=${path}`;
        console.log(`Fetching from file URL: ${fileUrl}`);
        const fileRes = await fetch(fileUrl);
        console.log(`File response status: ${fileRes.status}`);
        const arrayBuffer = await fileRes.arrayBuffer();
        console.log(`Downloaded image of size ${arrayBuffer.byteLength} bytes.`);
      } else {
        console.error("Could not find success process_completed output path in stream.");
        console.log("Stream full output was:", text);
      }
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testHF();

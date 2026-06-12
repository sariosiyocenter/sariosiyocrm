import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function main() {
  try {
    const student = await prisma.student.findUnique({
      where: { id: 1 }
    });

    if (!student || !student.photo) {
      console.error("Student or photo not found!");
      return;
    }

    console.log(`Student Photo length: ${student.photo.length}`);

    // Parse base64 string into a buffer
    const base64Data = student.photo.replace(/^data:image\/[\w+]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 1. Upload to HuggingFace Space /upload using native Blob and FormData
    console.log("Uploading file buffer to HuggingFace /upload...");
    
    // Create Blob from buffer
    const blob = new Blob([buffer], { type: 'image/png' });
    const form = new FormData();
    form.append('files', blob, 'input.png');

    const uploadResponse = await fetch('https://briaai-bria-rmbg-1-4.hf.space/upload', {
      method: 'POST',
      body: form
    });

    console.log(`Upload response status: ${uploadResponse.status}`);
    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error(`Upload failed: ${errText}`);
      return;
    }

    const uploadJson = await uploadResponse.json();
    console.log("Upload response JSON:", uploadJson);

    const tempFilePath = uploadJson[0];
    if (!tempFilePath) {
      console.error("No temp file path returned from upload!");
      return;
    }

    console.log(`Successfully uploaded. Temp file path: ${tempFilePath}`);

    // 2. Join queue with the temp file path
    const sessionHash = Math.random().toString(36).substring(2);
    console.log("Sending queue join request with uploaded temp path...");
    
    const joinResponse = await fetch('https://briaai-bria-rmbg-1-4.hf.space/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          {
            path: tempFilePath,
            orig_name: "input.png"
          }
        ],
        fn_index: 0,
        session_hash: sessionHash
      })
    });

    console.log(`Join response status: ${joinResponse.status}`);
    const joinJson = await joinResponse.json();
    console.log("Join response JSON:", joinJson);

    if (joinJson.event_id) {
      console.log(`Event ID received: ${joinJson.event_id}. Fetching stream...`);
      const streamResponse = await fetch(`https://briaai-bria-rmbg-1-4.hf.space/queue/data?session_hash=${sessionHash}`);
      console.log(`Stream response status: ${streamResponse.status}`);
      
      const text = await streamResponse.text();
      console.log("Stream full output length:", text.length);
      
      // Parse output path
      const lines = text.split('\n');
      let outputPath = null;
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.substring(6));
            if (parsed.msg === 'process_completed' && parsed.success && parsed.output && parsed.output.data) {
              outputPath = parsed.output.data[0].path;
              break;
            }
          } catch (e) {}
        }
      }

      if (outputPath) {
        console.log(`SUCCESS! Process completed. Output path: ${outputPath}`);
        const fileUrl = `https://briaai-bria-rmbg-1-4.hf.space/file=${outputPath}`;
        console.log(`Result file download URL: ${fileUrl}`);
      } else {
        console.error("Failed to parse output path. Stream full output was:", text);
      }
    }
  } catch (error) {
    console.error("Error in test:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

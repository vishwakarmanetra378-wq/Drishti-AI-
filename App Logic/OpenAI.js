// Convert raw vision data into human-friendly descriptions
async function generateContextualDescription(visionData) {
  const apiUrl = "https://YOUR_RESOURCE.openai.azure.com/openai/deployments/gpt-4-vision/chat/completions?api-version=2024-02-15-preview";
  
  const prompt = `As Drishti AI, provide a safety-first audio description for a visually impaired user based on this scene analysis: ${JSON.stringify(visionData)}. 
  Prioritize: 1) Immediate hazards 2) Navigation guidance 3) Important objects. Speak naturally in Hindi.`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': 'YOUR_AZURE_OPENAI_KEY'
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You are Drishti AI, a helpful assistant for blind users. Provide clear, concise, safety-first audio descriptions in Hindi." },
        { role: "user", content: prompt }
      ],
      max_tokens: 150
    })
  });
  
  return await response.json();
}

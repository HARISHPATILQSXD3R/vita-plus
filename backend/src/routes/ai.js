import express from "express";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
     console.log("GROQ KEY:", process.env.GROQ_API_KEY);
    const { messages } = req.body;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          temperature: 0.7,
          max_tokens: 200
        })
      }
    );

    const data = await response.json();
    console.log("GROQ RESPONSE:", data);
    const reply =
      data?.choices?.[0]?.message?.content ||
      "I'm here with you.";

    res.json({ reply });

  } catch (err) {
    console.error("AI error:", err);
    res.json({ reply: "I'm here with you." });
  }
});

export default router;

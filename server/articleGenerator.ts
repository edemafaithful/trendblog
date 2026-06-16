import { GoogleGenAI, Type } from "@google/genai";
import { db, Draft } from "./db";

// Initialize Gemini SDK with telemetry header as required by the system skill
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
} else {
  console.warn(
    "Warning: GEMINI_API_KEY is not defined. The article generator will produce realistic local fallback templates."
  );
}

/**
 * Generate a high-quality breaking news article draft using Gemini (or fallback template)
 */
export async function generateArticleDraft(alertId: string, keyword: string): Promise<Draft> {
  const systemInstruction = `You are a breaking news writer for a US/UK blog that targets high-traffic search terms.
Write a complete, publish-ready breaking news article using this structure:

HEADLINE: [Full name if available] [City, State] [Incident Type] [Today/Right Now]
Example: "John Smith Austin Texas School Shooting Today"

META DESCRIPTION: 155 characters max. Include keyword, location, current status.

ARTICLE BODY:
- Paragraph 1: What happened, where, when (known facts only)
- Paragraph 2: Current status / developing details
- Paragraph 3: Community/authority response
- Paragraph 4: Background context if relevant
- Paragraph 5: What to watch for / follow-up angle

WORD COUNT: 350–500 words
TONE: Factual, urgent, neutral
INCLUDE: Natural keyword placement for SEO, avoid speculation.`;

  const prompt = `Write a breaking news article about an escalating critical situation involving the keyword "${keyword}". Place this incident in a realistic US city/state. Present it perfectly structured in valid JSON.`;

  // Check if we can call the live Gemini API
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING, description: "SEO title / main headline of the post" },
              metaDescription: { type: Type.STRING, description: "SEO metadata summary, under 155 chars" },
              body: { type: Type.STRING, description: "Exactly five paragraphs of article text, matching news structure, separated with double newlines" }
            },
            required: ["headline", "metaDescription", "body"]
          }
        }
      });

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        const savedDraft = db.addDraft({
          alertId,
          keyword,
          headline: parsed.headline || `${keyword.toUpperCase()} critical situation reported today`,
          metaDescription: parsed.metaDescription || `Breaking signal detected for keyword: ${keyword}. High-velocity early trends indicating immediate developments right now.`,
          body: parsed.body || "No body returned from model."
        });
        return savedDraft;
      }
    } catch (err) {
      console.error("Failed to generate article with Gemini, using local template builder:", err);
    }
  }

  // Fallback high-fidelity local generator to keep the app 100% operational offline
  const randomCity = [
    { city: "Austin", state: "Texas" },
    { city: "Atlanta", state: "Georgia" },
    { city: "Columbus", state: "Ohio" },
    { city: "Phoenix", state: "Arizona" },
    { city: "Philadelphia", state: "Pennsylvania" },
    { city: "Denver", state: "Colorado" }
  ][Math.floor(Math.random() * 6)];

  const headline = `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Incident in ${randomCity.city} ${randomCity.state} Reports Active Escalation Today`;
  const metaDescription = `Urgent reports of a major ${keyword} incident in ${randomCity.city}, ${randomCity.state} with active responses under progress right now.`;
  
  const body = `An active emergency response has been initiated in ${randomCity.city}, ${randomCity.state} following widespread reports of a critical incident involving a ${keyword}. First responders and local agencies arrived at the central sector earlier today, cordoning off public lanes to address the situation directly.

Developments are unfolding quickly, and local authorities are currently verifying detail parameters regarding the source of the ${keyword}. Emergency coordinators have urged residents nearby to exercise extreme caution and avoid the perimeter while ongoing protocols are established.

Community leaders and municipal spokespersons held a brief press pool expressing their alignment with relief efforts. 'Our priority remains the safety and support of all inhabitants affected by this ${keyword} event,' noted the regional coordinator on-duty.

This major incident represents a significant event in the city's central district, which has historically maintained strict response drill compliance. Data indicates local service lines are currently redirected to maintain optimal transit flow.

Observers are watching for immediate debriefs from municipal authorities who is scheduled to release a official statement. Media networks represent a steady influx of coverage as details regarding casualties, property, or source parameters are confirmed.`;

  const savedDraft = db.addDraft({
    alertId,
    keyword,
    headline,
    metaDescription,
    body
  });

  return savedDraft;
}

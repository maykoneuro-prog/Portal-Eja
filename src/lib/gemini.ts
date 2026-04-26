import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function validateDocumentOCR(base64Image: string, expectedType: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `Identify if this document is a valid ${expectedType}. 
            Extract the following fields in JSON format:
            {
              "isValid": boolean,
              "documentType": string,
              "name": string,
              "cpf": string,
              "birthDate": string,
              "confidence": number (0-1),
              "feedback": string (if not valid or fields missing)
            }
            Ensure the response is ONLY the JSON object.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    return { isValid: false, feedback: "Erro ao processar documento com IA." };
  }
}

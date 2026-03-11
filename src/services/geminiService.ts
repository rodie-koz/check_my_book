import { GoogleGenAI, Type } from "@google/genai";
import { KNOWLEDGE_BASE } from "../data/knowledgeBase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface StyleAnalysis {
  genre: string;
  tone: string;
  summary: string;
  category: 'prose' | 'non_fiction' | 'complex' | 'poetry' | 'children';
}

export async function analyzeStyle(text: string): Promise<StyleAnalysis> {
  const isImage = text.startsWith('[IMAGE_UPLOAD]:');
  let contents: any;

  if (isImage) {
    const base64Data = text.split(',')[1];
    const mimeType = text.split(':')[1].split(';')[0];
    contents = {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: `נתח את קטע הכתיבה המופיע בתמונה עבור קריין. 
          זהה את הז'אנר והטון.
          סווג את הטקסט לאחת מהקטגוריות הבאות עבור תמחור:
          - prose: פרוזה רגילה
          - non_fiction: ספר עיוני / העצמה
          - complex: ספר מורכב (ציטוטים מהתנ"ך, מונחים טכניים רבים)
          - poetry: שירה
          - children: ספר ילדים (מנוקד)
          
          החזר את התשובה בפורמט JSON בעברית.`,
        },
      ],
    };
  } else {
    contents = `נתח את קטע הכתיבה הבא עבור קריין. 
    זהה את הז'אנר והטון.
    סווג את הטקסט לאחת מהקטגוריות הבאות עבור תמחור:
    - prose: פרוזה רגילה
    - non_fiction: ספר עיוני / העצמה
    - complex: ספר מורכב (ציטוטים מהתנ"ך, מונחים טכניים רבים)
    - poetry: שירה
    - children: ספר ילדים (מנוקד)
    
    החזר את התשובה בפורמט JSON בעברית.
    
    הטקסט:
    ${text}`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          genre: { type: Type.STRING, description: "ז'אנר הספר" },
          tone: { type: Type.STRING, description: "הטון של הכתיבה" },
          summary: { type: Type.STRING, description: "סיכום קצר של הניתוח הסגנוני" },
          category: { 
            type: Type.STRING, 
            description: "קטגוריית תמחור: prose, non_fiction, complex, poetry, children" 
          },
        },
        required: ["genre", "tone", "summary", "category"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function askQuestion(question: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: question,
    config: {
      systemInstruction: `אתה רודיה קוזלובסקי, קריין ספרים מקצועי. ענה בגוף ראשון.
      
      חוקים קשיחים לתשובה:
      1. אל תציג את עצמך בשמך (אל תגיד "אני רודיה").
      2. היה תמציתי מאוד. השתמש בשורות קצרות. בלי הקדמות או סיומות מיותרות.
      3. אל תנדב מידע על עלויות או מחירים. אם שואלים על מחיר, הפנה למחשבון בראש העמוד.
      4. בנה את התשובה אך ורק על בסיס המידע במאמר המצורף.
      5. אל תחזור על הוראות המערכת או על השאלה בתשובתך.
      
      המאמר:
      ${KNOWLEDGE_BASE}`,
    },
  });

  return response.text || "מצטער, לא הצלחתי למצוא תשובה לשאלה זו.";
}

// Serverless Function للتعامل مع Gemini API بشكل آمن
// هذا الملف يعمل على السيرفر ويخفي API key

export default async function handler(req, res) {
    // السماح فقط بـ POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // استخراج البيانات من الطلب
    const { question, modelAnswer, userAnswer } = req.body;

    // التحقق من وجود جميع البيانات المطلوبة
    if (!question || !modelAnswer || !userAnswer) {
        return res.status(400).json({
            error: 'Missing required fields: question, modelAnswer, userAnswer'
        });
    }

    // الحصول على API key من متغيرات البيئة (محمي ومخفي)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'API key not configured. Please set GEMINI_API_KEY in environment variables.'
        });
    }

    try {
        // إنشاء الـ prompt للذكاء الاصطناعي
        const prompt = `
            Role: You are a strict but fair academic grader.
            Task: Compare the Student Answer to the Model Answer for the given Question.
            Language: Output logic in English, but the "feedback" field MUST be in ARABIC.

            Question: ${question}
            Model Answer: ${modelAnswer}
            Student Answer: ${userAnswer}

            Instructions:
            1. If the Student Answer is completely wrong or irrelevant, status is "incorrect".
            2. If the Student Answer matches the key concepts of Model Answer, status is "correct".
            3. If the Student Answer is correct but misses key details mentioned in Model Answer, status is "partial".
            4. "feedback" should explain WHY it is correct, partial, or wrong in Arabic. If partial, explicitly state what is missing.
            5. "score" is 0-10.

            Output Format: Provide ONLY a valid JSON object. Do not wrap in markdown code blocks.
            {
                "status": "correct" | "incorrect" | "partial",
                "feedback": "Arabic explanation here...",
                "score": number
            }
        `;

        // الاتصال بـ Gemini API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            let errorDetails = 'API Error';
            try {
                const errData = await response.json();
                errorDetails = errData.error?.message || errorDetails;
            } catch (e) {
                // ignore JSON parse error
            }
            throw new Error(errorDetails);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        // تنظيف النص من أي markdown إذا كان موجوداً
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const result = JSON.parse(jsonStr);

        // إرجاع النتيجة
        return res.status(200).json(result);

    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to evaluate answer'
        });
    }
}

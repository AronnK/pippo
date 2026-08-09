export const FLASHCARD_PROMPT = `Based on all uploaded sources, generate 50 flashcards covering the key concepts.
Output ONLY valid JSON in this exact format, no markdown code fences, no explanation before or after:

{
  "subject": "short subject name",
  "flashcards": [
    {"question": "string", "answer": "string"}
  ]
}`;

export const MCQ_PROMPT = `Based on all uploaded sources, generate 30 multiple-choice questions covering the key concepts.
Output ONLY valid JSON in this exact format, no markdown code fences, no explanation before or after:

{
  "subject": "short subject name",
  "questions": [
    {"question": "string", "options": ["string","string","string","string"], "correctIndex": 0, "explanation": "string"}
  ]
}`;

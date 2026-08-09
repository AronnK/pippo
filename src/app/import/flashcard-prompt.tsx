import { PromptScreen } from '@/components/PromptScreen';
import { FLASHCARD_PROMPT } from '@/constants/notebookLmPrompts';

export default function FlashcardPromptScreen() { return <PromptScreen prompt={FLASHCARD_PROMPT} kind="flashcards" />; }

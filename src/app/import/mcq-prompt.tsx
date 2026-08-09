import { PromptScreen } from "@/components/PromptScreen";
import { MCQ_PROMPT } from "@/constants/notebookLmPrompts";

export default function McqPromptScreen() {
  return <PromptScreen prompt={MCQ_PROMPT} kind="mcqs" />;
}

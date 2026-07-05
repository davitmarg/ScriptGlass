import { useState } from 'react';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';

export const useAi = (
  settings: { geminiKey: string },
  setIsSettingsOpen: (open: boolean) => void
) => {
  const [aiSnippet, setAiSnippet] = useState('');
  const [aiOptions, setAiOptions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGetAiSuggestions = async () => {
    if (!aiSnippet.trim()) return;
    if (!settings.geminiKey) {
      toast.error("Please add your Gemini API Key in Settings");
      setIsSettingsOpen(true);
      return;
    }

    setIsAiLoading(true);
    setAiOptions([]);

    try {
      const trimmedKey = settings.geminiKey.trim();
      if (!trimmedKey) {
        toast.error("Please add your Gemini API Key in Settings");
        setIsSettingsOpen(true);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: trimmedKey });
      const prompt = `You are a professional Hollywood script doctor. 
Enhance the following screenplay snippet. Provide 3 distinct variations that are better aligned with standard screenwriting conventions, tight dialogue, and evocative action descriptions.

CRITICAL INSTRUCTIONS:
- Do NOT add scene headings (sluglines), transitions, or any character names if not present in the input.
- Maintain the EXACT element type. If the input is dialogue, output ONLY enhanced dialogue. If it is action, output ONLY enhanced action.
- Do NOT add any surrounding context or framing.
- Return ONLY a valid JSON array of exactly 3 strings.

Snippet:
"${aiSnippet}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const rawText = response.text || '[]';
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      const text = jsonMatch ? jsonMatch[0] : rawText;
      
      try {
        const parsed = JSON.parse(text);
        setAiOptions(Array.isArray(parsed) ? parsed : []);
      } catch (parseError) {
        console.error("JSON Parsing Error:", parseError, "Raw Text:", rawText);
        toast.error("AI returned malformed data. Please try again.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to get AI suggestions. Check your API key.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return {
    aiSnippet,
    setAiSnippet,
    aiOptions,
    setAiOptions,
    isAiLoading,
    copiedIndex,
    handleGetAiSuggestions,
    copyToClipboard,
  };
};

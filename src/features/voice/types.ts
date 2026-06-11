export type SpeechRecognitionState = {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
};

export type SpeechSynthesisState = {
  isSpeaking: boolean;
  isSupported: boolean;
};

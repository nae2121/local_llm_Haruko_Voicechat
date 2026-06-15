export type SpeechRecognitionState = {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
};

export type SpeechSynthesisState = {
  isSpeaking: boolean;
  isSupported: boolean;
};

export type VoiceInputMode = "browser" | "local_whisper";

export type VoiceState =
  | "disabled"
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

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

export type VoiceOutputMode = "browser" | "local_tts";

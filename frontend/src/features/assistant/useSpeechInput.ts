import { useEffect, useRef, useState } from "react";
interface SpeechResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useSpeechInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [speechError, setError] = useState("");
  const [interim, setInterim] = useState("");
  const active = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  callback.current = onText;
  const Engine =
    (window as SpeechWindow).SpeechRecognition ??
    (window as SpeechWindow).webkitSpeechRecognition;
  useEffect(
    () => () => {
      if (active.current) {
        active.current.onend = null;
        active.current.onresult = null;
        active.current.onerror = null;
        active.current.abort();
      }
    },
    [],
  );
  function stop() {
    active.current?.stop();
    setListening(false);
  }
  function toggle(language: string) {
    if (listening) {
      stop();
      return;
    }
    setError("");
    if (!Engine) {
      setError(
        "Speech recognition is not supported in this browser. Use Chrome or Edge, or type your message.",
      );
      return;
    }
    const recognition = new Engine();
    active.current = recognition;
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let final = "",
        draft = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript + " ";
        else draft += result[0].transcript;
      }
      if (final.trim()) callback.current(final.trim());
      setInterim(draft);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setInterim("");
      setError(
        event.error === "not-allowed"
          ? "Microphone access was denied. Allow it in browser settings or type instead."
          : event.error === "no-speech"
            ? "No speech was detected. Try again or type your message."
            : "Speech recognition could not start. Check your microphone and connection, or type instead.",
      );
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Microphone could not start. Please try again.");
      setListening(false);
    }
  }
  return { listening, speechError, interim, toggle, stop, supported: !!Engine };
}

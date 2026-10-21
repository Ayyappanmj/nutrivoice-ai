import React, { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Sparkles, Send, Volume2, ArrowRight, Radio, BellRing } from 'lucide-react'
import { AudioWaveform } from './AudioWaveform'
import { ThoughtProcessBreakdown } from './ThoughtProcessBreakdown'

// Synthesize the classic pleasant Alexa dual-tone chime using Web Audio API
const playAlexaChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    
    // Tone 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime)
    gain1.gain.setValueAtTime(0.18, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start()
    osc1.stop(ctx.currentTime + 0.18)

    // Tone 2: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880.0, ctx.currentTime + 0.10)
    gain2.gain.setValueAtTime(0.22, ctx.currentTime + 0.10)
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(ctx.currentTime + 0.10)
    osc2.stop(ctx.currentTime + 0.45)
  } catch (e) {
    // AudioContext blocked or unsupported
  }
}

export function VoiceAssistantHero({ onSendPrompt, isProcessing, thoughtData }) {
  const [promptText, setPromptText] = useState("Alexa, log a grilled salmon with quinoa and avocado")
  const [isListening, setIsListening] = useState(true)
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [isAmbientListening, setIsAmbientListening] = useState(false)
  const [wakeWordTriggered, setWakeWordTriggered] = useState(false)
  const [lastHeardUtterance, setLastHeardUtterance] = useState("")

  const ambientRecognizerRef = useRef(null)
  const isAmbientListeningRef = useRef(false)
  const onSendPromptRef = useRef(onSendPrompt)
  const isStartingRef = useRef(false)
  const rearmTimerRef = useRef(null)

  const quickPrompts = [
    { label: "Salmon & Quinoa Bowl", prompt: "Alexa, log a grilled salmon with quinoa and avocado" },
    { label: "Pizza (Ambiguity Fallback)", prompt: "Alexa, log a slice of pizza" },
    { label: "Daily Protein Summary", prompt: "Alexa, what's my daily protein summary?" },
    { label: "Muscle Gain Dinner", prompt: "Alexa, recommend a high-protein dinner for muscle gain" }
  ]

  // Keep references updated on every render without triggering re-initialization
  useEffect(() => {
    onSendPromptRef.current = onSendPrompt
  }, [onSendPrompt])

  useEffect(() => {
    isAmbientListeningRef.current = isAmbientListening
  }, [isAmbientListening])

  // Continuous Alexa Wake-Word Engine (Persistent, never torn down by parent re-renders)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognizer = new SpeechRecognition()
    recognizer.continuous = true
    recognizer.interimResults = false
    recognizer.lang = 'en-US'
    ambientRecognizerRef.current = recognizer

    // Safe re-arming helper with debounce & try-catch to prevent InvalidStateError
    const rearmListener = () => {
      if (!isAmbientListeningRef.current) return
      if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current)

      rearmTimerRef.current = setTimeout(() => {
        if (!isAmbientListeningRef.current) return
        try {
          recognizer.start()
          console.log("🟢 NutriVoice Ambient Listener re-armed for next meal")
        } catch (err) {
          // Suppress InvalidStateError if recognizer is already running or busy
          if (err.name !== 'InvalidStateError') {
            console.warn("Recognizer re-arm notice:", err)
          }
        }
      }, 300)
    }

    recognizer.onstart = () => {
      isStartingRef.current = false
      console.log("🟢 NutriVoice Ambient Wake-Word Engine active. Say 'Alexa...'")
    }

    recognizer.onresult = (event) => {
      // Don't trigger if Alexa is currently speaking back through the speaker
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        console.log("Ignoring speech while Alexa is speaking aloud...")
        return
      }

      // Root Cause 1 Fix: Always read the latest speech result
      const lastIndex = event.results.length - 1
      if (lastIndex < 0 || !event.results[lastIndex] || !event.results[lastIndex][0]) return

      const spokenText = event.results[lastIndex][0].transcript.trim()
      const lower = spokenText.toLowerCase()
      setLastHeardUtterance(spokenText)
      console.log(`[Result #${lastIndex}] Ambient voice heard:`, spokenText)

      // Check if utterance includes wake word "alexa"
      if (lower.includes("alexa")) {
        playAlexaChime()
        setWakeWordTriggered(true)
        setTimeout(() => setWakeWordTriggered(false), 3000)

        // Extract everything following the last occurrence of the word "alexa"
        const parts = lower.split("alexa")
        const command = parts[parts.length - 1].replace(/^[,.\s]+/, "").trim()

        if (command.length > 0) {
          const formattedPrompt = `Alexa, ${command}`
          console.log("⚡ Alexa Wake Word Triggered! Command:", formattedPrompt)
          setPromptText(formattedPrompt)
          
          // Dispatch prompt via stable ref
          if (onSendPromptRef.current) {
            onSendPromptRef.current(formattedPrompt)
          }
        } else {
          setPromptText("Alexa, ")
        }
      }
    }

    recognizer.onerror = (err) => {
      // Routine timeouts ('no-speech') occur when room is silent for 10s
      if (err.error !== 'no-speech') {
        console.warn("Ambient speech listener status:", err.error)
      }
      // Re-arm so subsequent meals are never missed
      rearmListener()
    }

    // Root Cause 3 Fix: Auto-restart loop with safety delay
    recognizer.onend = () => {
      if (isAmbientListeningRef.current) {
        console.log("Ambient stream paused; re-arming audio pipe...")
        rearmListener()
      }
    }

    return () => {
      isAmbientListeningRef.current = false
      if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current)
      try {
        recognizer.abort()
      } catch (e) {}
    }
  }, []) // Empty dependency array: starts once and stays alive across all renders!

  // Toggle Ambient Listening
  const toggleAmbientListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Continuous Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.")
      return
    }

    const nextState = !isAmbientListening
    setIsAmbientListening(nextState)
    isAmbientListeningRef.current = nextState

    if (nextState) {
      playAlexaChime()
      try {
        ambientRecognizerRef.current?.start()
      } catch (e) {
        if (e.name !== 'InvalidStateError') {
          console.log("Recognizer start catch:", e)
        }
      }
    } else {
      if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current)
      try {
        ambientRecognizerRef.current?.stop()
      } catch (e) {}
    }
  }

  // Push-to-Talk One-Shot Mic
  const startPushToTalk = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.")
      return
    }

    if (isVoiceRecording) return

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsVoiceRecording(true)
        playAlexaChime()
      }

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setPromptText(transcript)
        setIsVoiceRecording(false)
        if (onSendPromptRef.current) {
          onSendPromptRef.current(transcript)
        }
      }

      recognition.onerror = () => {
        setIsVoiceRecording(false)
      }

      recognition.onend = () => {
        setIsVoiceRecording(false)
      }

      recognition.start()
    } catch (err) {
      setIsVoiceRecording(false)
    }
  }

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!promptText.trim() || isProcessing) return
    if (onSendPromptRef.current) {
      onSendPromptRef.current(promptText)
    }
  }

  const handleSelectPrompt = (p) => {
    setPromptText(p)
    if (onSendPromptRef.current) {
      onSendPromptRef.current(p)
    }
  }

  return (
    <div className={`relative rounded-3xl glass-card p-6 md:p-8 overflow-hidden transition-all duration-500 ${
      wakeWordTriggered ? 'ring-2 ring-cyan-400/80 shadow-2xl shadow-cyan-500/30' : ''
    }`}>
      {/* Background radial gradient glow */}
      <div className={`absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
        wakeWordTriggered ? 'bg-cyan-500/30 scale-125' : 'bg-emerald-500/10'
      }`} />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        
        {/* Top bar of Hero: Title & Audio Waveform */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2">
            
            {/* Ambient Echo Wake Word Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Voice Agentic Telemetry</span>
              </div>

              {/* Ambient Wake Word Button */}
              <button
                type="button"
                onClick={toggleAmbientListening}
                className={`inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 ${
                  isAmbientListening
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 ring-2 ring-cyan-400/60 shadow-cyan-500/25 animate-pulse'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-white/10 hover:border-cyan-500/40'
                }`}
                title="Toggle continuous background wake-word listening"
              >
                <Radio className={`w-3.5 h-3.5 ${isAmbientListening ? 'animate-spin text-slate-950' : 'text-slate-400'}`} />
                <span>
                  {isAmbientListening ? 'Echo Ambient Mode: Listening for "Alexa..."' : 'Enable Echo Wake-Word ("Alexa")'}
                </span>
                <span className={`w-2 h-2 rounded-full ${isAmbientListening ? 'bg-slate-950' : 'bg-slate-500'}`} />
              </button>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Alexa+ Voice Assistant Hero</span>
              {wakeWordTriggered && (
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-cyan-400 text-slate-950 font-bold uppercase tracking-wider animate-bounce flex items-center gap-1 shadow-lg shadow-cyan-400/50">
                  <BellRing className="w-3.5 h-3.5" />
                  Wake Word Detected!
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-400 max-w-lg">
              {isAmbientListening
                ? 'Speak aloud in your room without clicking: "Alexa, add 2 slices of pizza" or "Alexa, log a salmon bowl".'
                : 'Sub-second speech-to-nutrition parsing powered by AWS Bedrock Converse API and Model Context Protocol.'}
            </p>
          </div>

          {/* Glowing Animated Audio Waveform Box */}
          <div className={`w-full md:w-auto flex-1 max-w-md rounded-2xl p-3 border transition-all duration-300 flex flex-col items-center ${
            wakeWordTriggered
              ? 'bg-cyan-950/40 border-cyan-400/60 shadow-lg shadow-cyan-500/20'
              : 'bg-slate-900/60 border-white/10'
          }`}>
            <div className="w-full flex items-center justify-between px-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className={`w-2 h-2 rounded-full ${
                  wakeWordTriggered ? 'bg-cyan-400 animate-ping' :
                  isVoiceRecording ? 'bg-rose-400 animate-ping' :
                  isAmbientListening ? 'bg-emerald-400 animate-pulse' :
                  isListening ? 'bg-cyan-400' : 'bg-slate-500'
                }`} />
                {wakeWordTriggered ? 'Alexa Wake Word Triggered!' :
                 isVoiceRecording ? 'Microphone Active (Listening...)' :
                 isAmbientListening ? 'Echo Ambient Mode Active' :
                 isProcessing ? 'Processing Bedrock Converse...' :
                 isListening ? 'Live Audio Stream' : 'Muted'}
              </span>
              <button
                onClick={() => setIsListening(!isListening)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono"
              >
                {isListening ? "Pause Waveform" : "Resume"}
              </button>
            </div>
            <AudioWaveform
              isActive={isListening || isVoiceRecording || isAmbientListening || wakeWordTriggered}
              isProcessing={isProcessing || isVoiceRecording || wakeWordTriggered}
            />
          </div>
        </div>

        {/* Live Transcription Card */}
        <div className={`rounded-2xl border p-5 shadow-inner transition-all duration-300 ${
          wakeWordTriggered
            ? 'bg-slate-950/90 border-cyan-400/60 ring-1 ring-cyan-400/40'
            : 'bg-slate-950/70 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 text-xs font-mono text-cyan-300">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span className="uppercase tracking-wider font-semibold">Live Voice Transcription Card</span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              Echo Show 10 • us-east-1
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              {/* Clickable Microphone Button */}
              <button
                type="button"
                onClick={startPushToTalk}
                title="Click to speak (Push-to-Talk) or use Ambient Wake-Word above"
                className={`absolute inset-y-0 left-0 pl-3.5 pr-2.5 flex items-center z-20 transition-all ${
                  isVoiceRecording
                    ? 'text-rose-400 scale-125 animate-pulse'
                    : 'text-emerald-400 hover:text-emerald-300 hover:scale-110 cursor-pointer'
                }`}
              >
                <Mic className="w-4 h-4" />
                {isVoiceRecording && (
                  <span className="absolute -top-7 left-1 px-2 py-0.5 rounded bg-rose-600 text-[10px] text-white font-mono font-bold tracking-wider uppercase whitespace-nowrap shadow-xl animate-bounce">
                    Listening...
                  </span>
                )}
              </button>

              <input
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder={isAmbientListening ? 'Ambient mode active! Say aloud: "Alexa, log a pizza"...' : "Click the mic, toggle ambient mode, or type: 'Alexa, log a salmon bowl'..."}
                className={`w-full pl-11 pr-4 py-3 bg-slate-900/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                  wakeWordTriggered
                    ? 'border-cyan-400 ring-2 ring-cyan-400/40 text-cyan-200'
                    : isVoiceRecording
                    ? 'border-rose-500/70 ring-2 ring-rose-500/30'
                    : 'border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || isVoiceRecording}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/25 transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Parsing Speech...</span>
                </>
              ) : (
                <>
                  <span>Simulate Voice Prompt</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Clickable Quick Prompts */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Quick Alexa Prompts:</span>
            {quickPrompts.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPrompt(item.prompt)}
                disabled={isProcessing || isVoiceRecording}
                className="text-xs px-3 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5 hover:border-cyan-500/30 transition-all font-mono active:scale-95 disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Ambient utterance debug indicator */}
          {isAmbientListening && lastHeardUtterance && (
            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span className="truncate">Last ambient audio: <strong className="text-slate-300">"{lastHeardUtterance}"</strong></span>
              <span className="text-emerald-400 flex-shrink-0 ml-2">● Continuous listener active</span>
            </div>
          )}
        </div>

        {/* Real-time Agent Thought Process Breakdown */}
        <ThoughtProcessBreakdown
          pipeline={thoughtData?.thought_pipeline}
          latencyMs={thoughtData?.latency_ms}
          tokens={thoughtData?.tokens}
          hasAmbiguity={thoughtData?.has_ambiguity}
          disambiguationPrompt={thoughtData?.disambiguation_prompt}
        />

      </div>
    </div>
  )
}

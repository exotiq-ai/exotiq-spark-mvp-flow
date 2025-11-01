import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Send, Volume2, Loader2, WifiOff, RotateCcw, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  error?: boolean;
  retryable?: boolean;
}

// Timeout wrapper for fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw error;
  }
};

// Exponential backoff retry logic
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === maxRetries - 1) throw error;
      
      // Don't retry on rate limits or auth errors
      if (error.message?.includes('429') || error.message?.includes('402') || error.message?.includes('401')) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
};

class AudioQueue {
  private queue: string[] = [];
  private isPlaying = false;
  private onPlaybackStart?: () => void;
  private onPlaybackEnd?: () => void;
  private audioElements: HTMLAudioElement[] = [];

  constructor(callbacks?: { onPlaybackStart?: () => void; onPlaybackEnd?: () => void }) {
    this.onPlaybackStart = callbacks?.onPlaybackStart;
    this.onPlaybackEnd = callbacks?.onPlaybackEnd;
  }

  addToQueue(base64Audio: string) {
    this.queue.push(base64Audio);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  clear() {
    this.queue = [];
    this.audioElements.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    this.audioElements = [];
    this.isPlaying = false;
    this.onPlaybackEnd?.();
  }

  stopAll() {
    // Clear queue and stop all audio immediately (for interruption)
    this.clear();
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.onPlaybackEnd?.();
      console.log('🎵 Audio queue empty, playback ended');
      return;
    }

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.onPlaybackStart?.();
      console.log('🎵 Audio playback started');
    }

    const base64Audio = this.queue.shift()!;
    const startTime = performance.now();

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = 1.1; // Slightly faster for more natural cadence
      this.audioElements.push(audio);

      audio.onended = () => {
        const duration = performance.now() - startTime;
        console.log(`🎵 Audio chunk finished (${duration.toFixed(0)}ms)`);
        URL.revokeObjectURL(url);
        this.audioElements = this.audioElements.filter(a => a !== audio);
        this.playNext();
      };

      audio.onerror = (error) => {
        console.error('🎵 Audio playback error:', error);
        URL.revokeObjectURL(url);
        this.audioElements = this.audioElements.filter(a => a !== audio);
        this.playNext();
      };

      await audio.play();
    } catch (error) {
      console.error('🎵 Error playing audio:', error);
      this.playNext();
    }
  }
}

export default function RariVoiceInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputText, setInputText] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [performanceMetrics, setPerformanceMetrics] = useState<{ operation: string; duration: number }[]>([]);
  const [isDegraded, setIsDegraded] = useState(false);
  const [consecutiveFallbacks, setConsecutiveFallbacks] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioQueueRef = useRef<AudioQueue>(
    new AudioQueue({
      onPlaybackStart: () => setIsSpeaking(true),
      onPlaybackEnd: () => setIsSpeaking(false),
    })
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: "Connection Restored", description: "You're back online!" });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({ 
        title: "Connection Lost", 
        description: "Please check your internet connection.",
        variant: "destructive"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioQueueRef.current.clear();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // No longer needed - using ReactMarkdown for safe rendering

  const startRecording = async () => {
    try {
      // INTERRUPT: Stop any playing audio and clear queue
      audioQueueRef.current.stopAll();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Track recording start time
      recordingStartTimeRef.current = Date.now();
      setRecordingDuration(0);

      // Update duration every 100ms
      recordingTimerRef.current = setInterval(() => {
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingDuration(duration);
      }, 100);

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const recordingDuration = (Date.now() - recordingStartTimeRef.current) / 1000;
        
        // Check minimum duration (0.5 seconds)
        if (recordingDuration < 0.5) {
          toast({
            title: "Recording Too Short",
            description: "Please hold the button for at least 0.5 seconds to record.",
            variant: "destructive",
          });
          stream.getTracks().forEach(track => track.stop());
          setRecordingDuration(0);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        setRecordingDuration(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudioInput = async (audioBlob: Blob) => {
    const startTime = performance.now();
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        const { data: transcription, error: transcriptionError } = await retryWithBackoff(
          async () => {
            const result = await supabase.functions.invoke(
              'voice-to-text',
              { body: { audio: base64Audio } }
            );
            if (result.error) throw result.error;
            return result;
          }
        );

        if (transcriptionError) throw transcriptionError;

        const duration = performance.now() - startTime;
        console.log(`⏱️ Voice-to-text: ${duration.toFixed(0)}ms`);
        setPerformanceMetrics(prev => [...prev.slice(-4), { operation: 'voice-to-text', duration }]);

        const userMessage: Message = {
          role: 'user',
          content: transcription.text,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        await sendToRari(transcription.text);
      };
    } catch (error: any) {
      console.error('Audio processing error:', error);
      
      let errorMessage = "Could not process audio. Please try again.";
      if (error.message?.includes('timeout')) {
        errorMessage = "Request timed out. Please check your connection and try again.";
      } else if (error.message?.includes('429')) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (error.message?.includes('402')) {
        errorMessage = "Service unavailable. Please contact support.";
      }
      
      toast({
        title: "Processing Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sendToRari = async (text: string, retryAttempt = 0) => {
    const chatStartTime = performance.now();
    const maxRetries = 1; // Auto-retry once for 500 errors
    setIsProcessing(true);
    let hasSpokenPartial = false; // Track if we've already generated TTS

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      if (!isOnline) {
        throw new Error('No internet connection');
      }

      const conversationMessages = messages
        .filter(m => !m.error) // Exclude error messages
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      conversationMessages.push({ role: 'user', content: text });

      // Show "Retrying..." if this is a retry attempt
      if (retryAttempt > 0) {
        setIsRetrying(true);
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.role === 'assistant' && lastMessage.error) {
            lastMessage.content = "Retrying connection...";
          }
          return newMessages;
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay before retry
      }

      const { data: chatResponse, error: chatError } = await supabase.functions.invoke(
        'fleet-copilot-chat',
        {
          body: { messages: conversationMessages },
        }
      );

      if (chatError) {
        // Parse structured error codes if present
        let errorCode = 'UNKNOWN';
        let errorMessage = chatError.message;
        let retryable = true;

        try {
          const errorData = JSON.parse(chatError.message);
          errorCode = errorData.error || errorCode;
          errorMessage = errorData.message || errorMessage;
          retryable = errorData.retryable !== false;
          
          // Track fallback usage for degraded mode detection
          if (errorData.usedFallback) {
            setConsecutiveFallbacks(prev => {
              const newCount = prev + 1;
              if (newCount >= 3 && !isDegraded) {
                setIsDegraded(true);
                toast({
                  title: "Running in Backup Mode",
                  description: "Rari is using backup AI model due to high demand.",
                  variant: "default",
                });
              }
              return newCount;
            });
          } else {
            // Reset degraded mode on successful primary model
            if (consecutiveFallbacks >= 3) {
              setIsDegraded(false);
              toast({
                title: "Service Restored",
                description: "Rari is back to full performance!",
              });
            }
            setConsecutiveFallbacks(0);
          }
        } catch (e) {
          // Not a structured error, use legacy handling
        }

        // Auto-retry logic for 500 errors
        if ((errorCode === 'AI_GATEWAY_ERROR' || errorCode === 'AI_GATEWAY_500') && retryAttempt < maxRetries) {
          console.log(`🔄 Auto-retry ${retryAttempt + 1}/${maxRetries} for ${errorCode}`);
          return sendToRari(text, retryAttempt + 1);
        }

        // Handle specific error codes
        if (errorCode === 'RATE_LIMIT_EXCEEDED' || errorMessage?.includes('429')) {
          throw new Error('RATE_LIMIT:Too many requests. Please wait 30 seconds and try again.');
        } else if (errorCode === 'SERVICE_UNAVAILABLE' || errorMessage?.includes('402')) {
          throw new Error('SERVICE_UNAVAILABLE:Service credits depleted. Please contact support.');
        } else if (errorCode === 'AI_GATEWAY_TIMEOUT') {
          throw new Error('TIMEOUT:Request timed out. Please check your connection.');
        }
        
        throw new Error(`${errorCode}:${errorMessage}`);
      }

      const reader = chatResponse.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let firstTokenTime: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                if (!firstTokenTime) {
                  firstTokenTime = performance.now();
                  const ttft = firstTokenTime - chatStartTime;
                  console.log(`⏱️ Time to first token: ${ttft.toFixed(0)}ms`);
                  setPerformanceMetrics(prev => [...prev.slice(-4), { operation: 'ttft', duration: ttft }]);
                }
                
                assistantMessage += content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.role === 'assistant' && !lastMessage.error) {
                    lastMessage.content = assistantMessage;
                  } else {
                    newMessages.push({
                      role: 'assistant',
                      content: assistantMessage,
                      timestamp: new Date(),
                    });
                  }
                  return newMessages;
                });

                // Pre-buffer TTS: Only once when first complete sentence arrives
                if (!hasSpokenPartial && assistantMessage.includes('.') && assistantMessage.length > 50) {
                  speakText(assistantMessage, true);
                  hasSpokenPartial = true;
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      const totalDuration = performance.now() - chatStartTime;
      console.log(`⏱️ Total chat response: ${totalDuration.toFixed(0)}ms`);
      setPerformanceMetrics(prev => [...prev.slice(-4), { operation: 'chat', duration: totalDuration }]);

      // Only speak if we haven't already done partial TTS
      if (assistantMessage && !hasSpokenPartial) {
        await speakText(assistantMessage);
      }
    } catch (error: any) {
      console.error('Rari chat error:', error);
      
      // Parse error code and message
      let errorCode = 'UNKNOWN';
      let errorMessage = "Could not connect to Rari. Please try again.";
      let retryable = true;

      if (error.message?.includes(':')) {
        const [code, msg] = error.message.split(':');
        errorCode = code;
        errorMessage = msg;
      }

      // Map error codes to user-friendly messages
      const errorMapping: Record<string, { message: string; retryable: boolean; variant?: 'default' | 'destructive' }> = {
        'RATE_LIMIT': {
          message: "⏱️ Too busy right now. Please wait 30 seconds and try again.",
          retryable: false,
          variant: 'destructive'
        },
        'SERVICE_UNAVAILABLE': {
          message: "🔧 Service temporarily unavailable. Please contact support.",
          retryable: false,
          variant: 'destructive'
        },
        'TIMEOUT': {
          message: "⏱️ Connection slow. Please check your network and try again.",
          retryable: true,
        },
        'AI_GATEWAY_ERROR': {
          message: "🔄 Rari is temporarily unavailable. Retrying automatically...",
          retryable: true,
        },
        'AI_GATEWAY_TIMEOUT': {
          message: "⏱️ Request timed out. Please try again.",
          retryable: true,
        },
        'No internet': {
          message: "📡 No internet connection. Please check your network.",
          retryable: true,
          variant: 'destructive'
        },
      };

      const mappedError = errorMapping[errorCode] || { 
        message: errorMessage, 
        retryable: true 
      };

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: mappedError.message,
        timestamp: new Date(),
        error: true,
        retryable: mappedError.retryable,
      }]);
      
      toast({
        title: mappedError.retryable ? "Connection Issue" : "Service Error",
        description: mappedError.message,
        variant: mappedError.variant || "destructive",
      });
    } finally {
      setIsProcessing(false);
      setIsRetrying(false);
      abortControllerRef.current = null;
    }
  };

  // Clean text for speech: strip markdown, format numbers/currency
  const cleanTextForSpeech = (text: string): string => {
    let cleaned = text;
    
    // Remove markdown formatting
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1'); // Bold
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1'); // Italic
    cleaned = cleaned.replace(/`(.+?)`/g, '$1'); // Code
    cleaned = cleaned.replace(/^#+\s+/gm, ''); // Headers
    cleaned = cleaned.replace(/^[*-]\s+/gm, ''); // Bullet points
    cleaned = cleaned.replace(/^\d+\.\s+/gm, ''); // Numbered lists
    
    // Format currency for speech ($5,000 → "5 thousand dollars")
    cleaned = cleaned.replace(/\$(\d{1,3}),(\d{3})/g, '$1 thousand dollars');
    cleaned = cleaned.replace(/\$(\d+)/g, '$1 dollars');
    
    // Format percentages
    cleaned = cleaned.replace(/(\d+)%/g, '$1 percent');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  };

  const speakText = async (text: string, isPartial = false) => {
    const startTime = performance.now();
    const cleanedText = cleanTextForSpeech(text);
    
    try {
      const { data: audioData, error: audioError } = await retryWithBackoff(
        async () => {
          const result = await supabase.functions.invoke(
            'text-to-speech',
            { body: { text: cleanedText } }
          );
          if (result.error) throw result.error;
          return result;
        }
      );

      if (audioError) throw audioError;

      const duration = performance.now() - startTime;
      console.log(`⏱️ TTS generation: ${duration.toFixed(0)}ms (${isPartial ? 'partial' : 'full'})`);
      
      if (!isPartial) {
        setPerformanceMetrics(prev => [...prev.slice(-4), { operation: 'tts', duration }]);
      }

      audioQueueRef.current.addToQueue(audioData.audioContent);
    } catch (error: any) {
      console.error('TTS error:', error);
      
      // Only show toast for non-partial failures
      if (!isPartial) {
        let errorMessage = "Could not generate Rari's voice.";
        if (error.message?.includes('429')) {
          errorMessage = "Voice generation rate limit. Try again in a moment.";
        } else if (error.message?.includes('402')) {
          errorMessage = "Voice service unavailable.";
        }
        
        toast({
          title: "Voice Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const retryMessage = async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message || message.role !== 'user') return;

    // Remove the error message and retry
    setMessages(prev => prev.slice(0, messageIndex + 1));
    await sendToRari(message.content, 0);
  };

  const sendTextMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: inputText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    await sendToRari(inputText);
  };

  const demoQueries = [
    "What's my total revenue this month?",
    "Which vehicle should I increase pricing on?",
    "Do I have any damage reports?",
    "What's my fleet utilization right now?",
  ];

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Volume2 className={`w-6 h-6 text-primary ${isSpeaking ? 'animate-pulse' : ''}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">Rari FleetCopilot</h3>
            {isOnline ? (
              <Badge variant="outline" className="text-xs gap-1">
                <Wifi className="w-3 h-3" /> Online
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs gap-1">
                <WifiOff className="w-3 h-3" /> Offline
              </Badge>
            )}
            {isDegraded && (
              <Badge variant="secondary" className="text-xs">
                Backup Mode
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isProcessing ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {isRetrying ? 'Retrying connection...' : 'Processing...'}
              </span>
            ) : isSpeaking ? (
              'Speaking...'
            ) : isDegraded ? (
              'Running in backup mode'
            ) : (
              'Ready to help'
            )}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 overflow-y-auto" ref={scrollAreaRef}>
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-center py-8">
              Hi! I'm Rari, your FleetCopilot AI. Ask me anything about your fleet operations!
            </p>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Try asking:</p>
              {demoQueries.map((query, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-2 px-3"
                  onClick={() => {
                    setInputText(query);
                  }}
                >
                  {query}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, idx) => (
              <Card
                key={idx}
                className={`p-3 ${
                  message.role === 'user'
                    ? 'bg-primary/10 ml-auto max-w-[80%]'
                    : message.error
                    ? 'bg-destructive/10 border-destructive/50 mr-auto max-w-[80%]'
                    : 'bg-accent/10 mr-auto max-w-[80%]'
                }`}
              >
                <p className="text-sm font-medium mb-1">
                  {message.role === 'user' ? 'You' : 'Rari'}
                </p>
                <ReactMarkdown
                  className="text-sm whitespace-pre-wrap break-words overflow-y-auto max-h-[400px] prose prose-sm max-w-none dark:prose-invert"
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                  {message.error && message.retryable && idx > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => retryMessage(idx - 1)}
                      className="h-6 text-xs gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Retry
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
            placeholder="Type or use voice..."
            className="flex-1 px-3 py-2 rounded-md border bg-background text-sm"
            disabled={isProcessing}
          />
          <Button
            onClick={sendTextMessage}
            disabled={!inputText.trim() || isProcessing}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className="rounded-full w-16 h-16"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          {isRecording 
            ? `Recording: ${recordingDuration.toFixed(1)}s (min 0.5s)` 
            : 'Hold to talk'}
        </p>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Send, Volume2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

class AudioQueue {
  private queue: string[] = [];
  private isPlaying = false;

  addToQueue(base64Audio: string) {
    this.queue.push(base64Audio);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const base64Audio = this.queue.shift()!;

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.playNext();
      };

      audio.onerror = () => {
        console.error('Audio playback error');
        URL.revokeObjectURL(url);
        this.playNext();
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioQueueRef = useRef<AudioQueue>(new AudioQueue());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const startRecording = async () => {
    try {
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
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        const { data: transcription, error: transcriptionError } = await supabase.functions.invoke(
          'voice-to-text',
          { body: { audio: base64Audio } }
        );

        if (transcriptionError) throw transcriptionError;

        const userMessage: Message = {
          role: 'user',
          content: transcription.text,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        await sendToRari(transcription.text);
      };
    } catch (error) {
      console.error('Audio processing error:', error);
      toast({
        title: "Processing Error",
        description: "Could not process audio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sendToRari = async (text: string) => {
    setIsProcessing(true);

    try {
      const conversationMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      conversationMessages.push({ role: 'user', content: text });

      const { data: chatResponse, error: chatError } = await supabase.functions.invoke(
        'fleet-copilot-chat',
        {
          body: {
            messages: conversationMessages,
          },
        }
      );

      if (chatError) throw chatError;

      const reader = chatResponse.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

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
                assistantMessage += content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.role === 'assistant') {
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
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      if (assistantMessage) {
        await speakText(assistantMessage);
      }
    } catch (error) {
      console.error('Rari chat error:', error);
      toast({
        title: "Chat Error",
        description: "Could not connect to Rari. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = async (text: string) => {
    setIsSpeaking(true);

    try {
      const { data: audioData, error: audioError } = await supabase.functions.invoke(
        'text-to-speech',
        { body: { text } }
      );

      if (audioError) throw audioError;

      audioQueueRef.current.addToQueue(audioData.audioContent);
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setIsSpeaking(false);
    }
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
        <div>
          <h3 className="font-semibold text-lg">Rari FleetCopilot</h3>
          <p className="text-sm text-muted-foreground">
            {isProcessing ? 'Processing...' : isSpeaking ? 'Speaking...' : 'Ready to help'}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
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
                    : 'bg-accent/10 mr-auto max-w-[80%]'
                }`}
              >
                <p className="text-sm font-medium mb-1">
                  {message.role === 'user' ? 'You' : 'Rari'}
                </p>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
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

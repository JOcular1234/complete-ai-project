'use client';

import { useState, useEffect, useRef } from 'react';
import {
  PaperAirplaneIcon,
  SunIcon,
  MoonIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import { toast, Toaster } from 'react-hot-toast';
import { CldImage } from 'next-cloudinary';
import styles from './sidebar.module.css';

export default function Home() {
  // State for service selection
  const [currentService, setCurrentService] = useState('chat'); // 'chat', 'stt', 'tts', or 'tti'

  // Chat-related state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatHistory');
      setChatHistory(saved ? JSON.parse(saved) : []);
      setIsHydrated(true);
    }
  }, []);
  const [currentChatId, setCurrentChatId] = useState(null);

  // Speech-to-text-related state
  const [audioFile, setAudioFile] = useState(null);
  const [transcription, setTranscription] = useState(null);
  const [isLoadingSTT, setIsLoadingSTT] = useState(false);
  const [sttHistory, setSttHistory] = useState([]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sttHistory');
      setSttHistory(saved ? JSON.parse(saved) : []);
    }
  }, []);
  const [downloadFormat, setDownloadFormat] = useState('json');
  const [isDragging, setIsDragging] = useState(false);

  // Text-to-speech-related state
  const [ttsPrompt, setTtsPrompt] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);
  const [ttsHistory, setTtsHistory] = useState([]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ttsHistory');
      setTtsHistory(saved ? JSON.parse(saved) : []);
    }
  }, []);

  // Text-to-image-related state
  const [ttiPrompt, setTtiPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoadingTTI, setIsLoadingTTI] = useState(false);
  const [ttiHistory, setTtiHistory] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ttiHistory');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Sample prompts for TTI
  const samplePrompts = [
    'A futuristic city at sunset',
    'A serene forest with glowing fireflies',
    'A dragon flying over mountains',
    'A cyberpunk street scene at night',
    'A steampunk robot in a desert',
  ];

  // Shared state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  // Persist histories to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
      localStorage.setItem('sttHistory', JSON.stringify(sttHistory));
      localStorage.setItem('ttsHistory', JSON.stringify(ttsHistory));
      localStorage.setItem('ttiHistory', JSON.stringify(ttiHistory));
    }
  }, [chatHistory, sttHistory, ttsHistory, ttiHistory]);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Scroll to bottom for chat
  useEffect(() => {
    if (chatRef.current && currentService === 'chat') {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, currentService]);

  // Chat Handlers
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };

    if (!currentChatId) {
      const newChatId = Date.now();
      const newChat = {
        id: newChatId,
        title: input.slice(0, 20) + '...',
        chat: [userMessage],
      };
      setChatHistory((prev) => [newChat, ...prev]);
      setCurrentChatId(newChatId);
      setMessages([userMessage]);
    } else {
      setMessages((prev) => [...prev, userMessage]);
      setChatHistory((prev) =>
        prev.map((item) =>
          item.id === currentChatId
            ? { ...item, chat: [...item.chat, userMessage] }
            : item
        )
      );
    }

    setInput('');
    setIsLoadingChat(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      setMessages((prev) => [...prev, { role: 'ai', content: '', isStreaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiResponse += decoder.decode(value);
        setMessages((prev) =>
          prev.map((msg, idx) =>
            idx === prev.length - 1 ? { ...msg, content: aiResponse } : msg
          )
        );
      }

      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === prev.length - 1 ? { ...msg, isStreaming: false } : msg
        )
      );

      setChatHistory((prev) =>
        prev.map((item) =>
          item.id === currentChatId
            ? { ...item, chat: [...item.chat, { role: 'ai', content: aiResponse }] }
            : item
        )
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: 'Error: Failed to fetch response. Try again.' },
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const loadChatFromHistory = (chatObj) => {
    setMessages(chatObj.chat);
    setCurrentChatId(chatObj.id);
    setCurrentService('chat');
  };

  const deleteChatHistoryItem = (id) => {
    setChatHistory((prev) => prev.filter((h) => h.id !== id));
    if (currentChatId === id) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  const deleteAllChatHistory = () => {
    setChatHistory([]);
    setMessages([]);
    setCurrentChatId(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Speech-to-Text Handlers
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && ['audio/mpeg', 'audio/wav'].includes(file.type)) {
      setAudioFile(file);
    } else {
      toast.error('Please upload a valid audio file (MP3 or WAV)');
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) {
      toast.error('Please select an audio file');
      return;
    }

    setIsLoadingSTT(true);
    setTranscription(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const res = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setTranscription(data);
        setSttHistory((prev) => [
          {
            fileName: audioFile.name,
            transcription: data.text,
            fullTranscription: data,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 9),
        ]);
        toast.success('Transcription generated successfully!');
      } else {
        toast.error(data.error || 'Failed to transcribe audio');
      }
    } catch (err) {
      console.error('Frontend STT error:', err);
      toast.error('Something went wrong');
    } finally {
      setIsLoadingSTT(false);
    }
  };

  const handleDownloadTranscription = () => {
    if (!transcription) return;
    const filename = `transcription-${Date.now()}`;
    if (downloadFormat === 'json') {
      const blob = new Blob([JSON.stringify(transcription, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (downloadFormat === 'txt') {
      const text = transcription.text || '';
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (downloadFormat === 'pdf') {
      const doc = new jsPDF();
      const margin = 15;
      let y = margin;
      const loadLogo = (url) => {
        return new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'Anonymous';
          img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = url;
        });
      };
      loadLogo('/mindseeklightmode.png').then((logoDataUrl) => {
        if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'PNG', margin, y, 40, 13);
        }
        y += 18;
        doc.setFontSize(18);
        doc.setTextColor(36, 41, 46);
        doc.text('Transcription Report', margin, y);
        y += 10;
        doc.setDrawColor(36, 41, 46);
        doc.setLineWidth(0.5);
        doc.line(margin, y, 195 - margin, y);
        y += 7;
        doc.setFontSize(11);
        doc.setTextColor(70, 70, 70);
        doc.text(`File: ${audioFile?.name || '-'}`.substring(0, 60), margin, y);
        y += 6;
        doc.text(`Language: ${transcription.language || 'Unknown'}`, margin, y);
        y += 6;
        doc.text(
          `Confidence: ${
            transcription.language_confidence != null &&
            !isNaN(transcription.language_confidence)
              ? `${(transcription.language_confidence * 100).toFixed(1)}%`
              : 'N/A'
          }`,
          margin,
          y
        );
        y += 6;
        doc.text(`Date: ${new Date().toLocaleString()}`, margin, y);
        y += 10;
        doc.setFontSize(13);
        doc.setTextColor(36, 41, 46);
        doc.text('Transcription', margin, y);
        y += 7;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.2);
        doc.line(margin, y, 195 - margin, y);
        y += 8;
        doc.setFontSize(12);
        doc.setTextColor(33, 33, 33);
        const splitText = doc.splitTextToSize(
          transcription.text || 'No transcription available',
          180
        );
        doc.text(splitText, margin, y);
        doc.save(`${filename}.pdf`);
      });
    }
  };

  const clearSttHistory = () => {
    setSttHistory([]);
    setTranscription(null);
    setAudioFile(null);
    toast.success('Transcription history cleared');
  };

  const loadSttFromHistory = (item) => {
    setTranscription(item.fullTranscription);
    setCurrentService('stt');
  };

  // Text-to-Speech Handlers
  const handleGenerateTTS = async () => {
    if (!ttsPrompt) {
      toast.error('Please enter a text prompt');
      return;
    }
    setIsLoadingTTS(true);
    setAudioUrl('');

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsPrompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate audio');
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioUrl);
      setTtsHistory((prev) => [
        { prompt: ttsPrompt, audioUrl, type: 'tts', timestamp: Date.now() },
        ...prev.slice(0, 9),
      ]);
      toast.success('Audio generated successfully!');
    } catch (err) {
      console.error('Frontend TTS error:', err);
      toast.error(err.message || 'Something went wrong');
    } finally {
      setIsLoadingTTS(false);
    }
  };

  const loadTtsFromHistory = (item) => {
    setTtsPrompt(item.prompt);
    setAudioUrl(item.audioUrl);
    setCurrentService('tts');
  };

  const clearTtsHistory = () => {
    setTtsHistory([]);
    setTtsPrompt('');
    setAudioUrl('');
    toast.success('Text-to-speech history cleared');
  };

  // Text-to-Image Handlers
  const handleGenerateTTI = async () => {
    if (!ttiPrompt) {
      toast.error('Please enter a prompt');
      return;
    }
    setIsLoadingTTI(true);
    setImageUrl('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: ttiPrompt }),
      });

      const data = await res.json();
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        setTtiHistory((prev) => [
          { prompt: ttiPrompt, imageUrl: data.imageUrl, timestamp: Date.now() },
          ...prev.slice(0, 9),
        ]);
        toast.success('Image generated successfully!');
      } else {
        toast.error(data.error || 'Failed to generate image');
      }
    } catch (err) {
      console.error('Frontend TTI error:', err);
      toast.error('Something went wrong');
    } finally {
      setIsLoadingTTI(false);
    }
  };

  const handleSamplePrompt = (sample) => {
    setTtiPrompt(sample);
  };

  const loadTtiFromHistory = (item) => {
    setTtiPrompt(item.prompt);
    setImageUrl(item.imageUrl);
    setCurrentService('tti');
  };

  const clearTtiHistory = () => {
    setTtiHistory([]);
    setTtiPrompt('');
    setImageUrl('');
    toast.success('Text-to-image history cleared');
  };

  const handleDownloadImage = async () => {
    if (imageUrl) {
      try {
        const response = await fetch(imageUrl, { mode: 'cors' });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        toast.error('Failed to download image');
      }
    }
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  if (!isHydrated) return null;

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter transition-colors duration-300">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <aside
        className={`w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col ${styles.sidebar} ${
          isHistoryOpen ? styles.open : ''
        }`}
      >
        <div className="p-4 font-bold text-lg border-b dark:border-gray-700">
          <div className="flex flex-col gap-2 mb-4">
            <button
              onClick={() => { setCurrentService('chat'); setIsHistoryOpen(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                currentService === 'chat'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => { setCurrentService('stt'); setIsHistoryOpen(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                currentService === 'stt'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Speech-to-Text
            </button>
            <button
              onClick={() => { setCurrentService('tts'); setIsHistoryOpen(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                currentService === 'tts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Text-to-Speech
            </button>
            <button
              onClick={() => { setCurrentService('tti'); setIsHistoryOpen(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                currentService === 'tti'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Text-to-Image
            </button>
          </div>
          <span className="text-sm text-gray-500">
            {currentService === 'chat'
              ? 'Chat History'
              : currentService === 'stt'
              ? 'Transcription History'
              : currentService === 'tts'
              ? 'Text-to-Speech History'
              : 'Text-to-Image History'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {currentService === 'chat' ? (
            chatHistory.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No chat history yet</p>
            ) : (
              chatHistory.map((item) => (
                <div key={item.id} className="flex items-center group">
                  <button
                    onClick={() => { setMessages(chatObj.chat); setCurrentChatId(chatObj.id); setCurrentService('chat'); setIsHistoryOpen(false); }}
                    className="flex-1 text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {item.title}
                  </button>
                  <button
                    onClick={() => deleteChatHistoryItem(item.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete this chat"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              ))
            )
          ) : currentService === 'stt' ? (
            sttHistory.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No transcription history yet</p>
            ) : (
              sttHistory.map((item, index) => (
                <div key={index} className="flex items-center group">
                  <button
                    onClick={() => { setTranscription(item.fullTranscription); setCurrentService('stt'); setIsHistoryOpen(false); }}
                    className="flex-1 text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <p className="text-sm truncate">{item.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </button>
                  <button
                    onClick={() =>
                      setSttHistory((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete this transcription"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              ))
            )
          ) : currentService === 'tts' ? (
            ttsHistory.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No text-to-speech history yet</p>
            ) : (
              ttsHistory.map((item, index) => (
                <div key={index} className="flex items-center group">
                  <button
                    onClick={() => { setTtsPrompt(item.prompt); setAudioUrl(item.audioUrl); setCurrentService('tts'); setIsHistoryOpen(false); }}
                    className="flex-1 text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <p className="text-sm truncate">{item.prompt}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </button>
                  <button
                    onClick={() =>
                      setTtsHistory((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete this audio"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              ))
            )
          ) : (
            ttiHistory.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No text-to-image history yet</p>
            ) : (
              ttiHistory.map((item, index) => (
                <div key={index} className="flex items-center group">
                  <button
                    onClick={() => { setTtiPrompt(item.prompt); setImageUrl(item.imageUrl); setCurrentService('tti'); setIsHistoryOpen(false); }}
                    className="flex-1 text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <CldImage
                      src={item.imageUrl}
                      width="80"
                      height="80"
                      alt={`Thumbnail: ${item.prompt}`}
                      crop="fill"
                      className="inline-block mr-2 rounded-md"
                    />
                    <p className="text-sm truncate">{item.prompt}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </button>
                  <button
                    onClick={() =>
                      setTtiHistory((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete this image"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              ))
            )
          )}
        </div>
        <button
          onClick={
            currentService === 'chat'
              ? deleteAllChatHistory
              : currentService === 'stt'
              ? clearSttHistory
              : currentService === 'tts'
              ? clearTtsHistory
              : clearTtiHistory
          }
          className="p-4 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Delete All{' '}
          {currentService === 'chat'
            ? 'Chat'
            : currentService === 'stt'
            ? 'Transcription'
            : currentService === 'tts'
            ? 'Text-to-Speech'
            : 'Text-to-Image'}{' '}
          History
        </button>
      </aside>

      {/* Sidebar Toggle */}
      <button
        onClick={() => setIsHistoryOpen((prev) => !prev)}
        className="fixed top-1/2 left-0 -translate-y-1/2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 p-2 rounded-r-lg shadow-md z-50"
      >
        {isHistoryOpen ? (
          <ChevronLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        ) : (
          <ChevronRightIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        )}
      </button>

      {/* Close button inside sidebar for mobile/UX */}
      <button
        onClick={() => setIsHistoryOpen(false)}
        className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-full z-50 md:hidden"
        aria-label="Close sidebar"
      >
        <ChevronLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="fixed top-0 w-full h-16 flex justify-between items-center px-6 bg-white dark:bg-gray-800 shadow-lg z-10">
          <div className="flex items-center gap-3">
            <img
              src="/mindseekdark.png"
              alt="MindSeek"
              className="w-24 hidden dark:block"
            />
            <img
              src="/mindseeklightmode.png"
              alt="MindSeek"
              className="w-24 block dark:hidden"
            />
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            {isDarkMode ? (
              <SunIcon className="w-6 h-6 text-white" />
            ) : (
              <MoonIcon className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </header>

        {/* Content Area */}
        {currentService === 'chat' ? (
          <main
            className="flex-1 max-w-4xl mx-auto mt-20 mb-24 px-4 sm:px-6 overflow-y-auto"
            ref={chatRef}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                <img
                  src="/mindseekdark.png"
                  alt="MindSeek Logo"
                  className="w-48 hidden dark:block mb-4"
                />
                <img
                  src="/mindseeklightmode.png"
                  alt="MindSeek Logo"
                  className="w-48 block dark:hidden mb-4"
                />
                <p className="text-lg">Ask anything to start the conversation!</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`my-3 p-4 rounded-xl max-w-[80%] sm:max-w-[70%] ${
                  msg.role === 'user'
                    ? 'ml-auto bg-blue-600 text-white'
                    : msg.role === 'error'
                    ? 'mr-auto bg-red-500 text-white'
                    : 'mr-auto bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                } shadow-sm`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
                {msg.isStreaming && (
                  <span className="ml-2 inline-block animate-pulse text-gray-400">...</span>
                )}
              </div>
            ))}
          </main>
        ) : currentService === 'stt' ? (
          <main className="container mx-auto px-4 py-12 mt-20 mb-24">
            <h1 className="text-5xl font-extrabold text-center mb-10 tracking-tight">
              AI Speech-to-Text Transcriber
            </h1>
            <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
              Upload an audio file to generate accurate transcriptions using advanced AI technology.
            </p>

            <div
              className={`max-w-2xl mx-auto mb-10 p-6 rounded-xl shadow-lg bg-white dark:bg-gray-800 border-2 transition-all duration-300 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center text-center">
                <CloudArrowUpIcon className="w-12 h-12 text-blue-500 dark:text-blue-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {audioFile ? audioFile.name : 'Drag and drop your audio file here'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Supported formats: MP3, WAV
                </p>
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Select File
                </button>
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
              </div>
            </div>

            <div className="max-w-2xl mx-auto mb-10">
              <button
                onClick={handleTranscribe}
                disabled={isLoadingSTT || !audioFile}
                className={`w-full py-3 px-6 text-lg font-semibold rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isLoadingSTT || !audioFile
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                }`}
              >
                {isLoadingSTT ? (
                  <svg
                    className="animate-spin h-6 w-6 mr-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
                    />
                  </svg>
                ) : null}
                {isLoadingSTT ? 'Transcribing...' : 'Transcribe Audio'}
              </button>
            </div>

            {transcription && (
              <div className="max-w-4xl mx-auto mb-10 animate-fade-in">
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
                  Transcription Result
                </h3>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    {transcription.text || 'No transcription available'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      Language: {transcription.language || 'Unknown'}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      Confidence:{' '}
                      {transcription.language_confidence != null &&
                      !isNaN(transcription.language_confidence)
                        ? `${(transcription.language_confidence * 100).toFixed(1)}%`
                        : 'N/A'}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      Words: {transcription.words?.length || 0}
                    </span>
                    {transcription.words?.some((w) => w.speaker_id) && (
                      <span className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        Speakers:{' '}
                        {new Set(
                          transcription.words.map((w) => w.speaker_id || 'Unknown')
                        ).size}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <select
                    value={downloadFormat}
                    onChange={(e) => setDownloadFormat(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="json">JSON</option>
                    <option value="txt">TXT</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <button
                    onClick={handleDownloadTranscription}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Download Transcription ({downloadFormat.toUpperCase()})
                  </button>
                </div>
              </div>
            )}
          </main>
        ) : currentService === 'tts' ? (
          <main className="container mx-auto px-4 py-12 mt-20 mb-24">
            <h1 className="text-5xl font-extrabold text-center mb-10 tracking-tight">
              AI Text-to-Speech Generator
            </h1>
            <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
              Enter text to generate high-quality audio using advanced AI technology.
            </p>

            <div className="max-w-2xl mx-auto mb-10">
              <textarea
                value={ttsPrompt}
                onChange={(e) => setTtsPrompt(e.target.value)}
                placeholder="Enter your text prompt here..."
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                rows={4}
              />
            </div>

            <div className="max-w-2xl mx-auto mb-10">
              <button
                onClick={handleGenerateTTS}
                disabled={isLoadingTTS || !ttsPrompt}
                className={`w-full py-3 px-6 text-lg font-semibold rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isLoadingTTS || !ttsPrompt
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white'
                }`}
              >
                {isLoadingTTS ? (
                  <svg
                    className="animate-spin h-6 w-6 mr-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
                    />
                  </svg>
                ) : null}
                {isLoadingTTS ? 'Generating Audio...' : 'Generate Audio'}
              </button>
            </div>

            {audioUrl && (
              <div className="max-w-2xl mx-auto mb-10 animate-fade-in">
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
                  Generated Audio
                </h3>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  className="w-full max-w-md mx-auto rounded-lg border border-gray-200 dark:border-gray-600"
                />
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = audioUrl;
                    link.download = `mindseek-tts.mp3`;
                    link.click();
                  }}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download Audio
                </button>
              </div>
            )}
          </main>
        ) : (
          <main className="container mx-auto px-4 py-12 mt-20 mb-24">
            <h1 className="text-5xl font-extrabold text-center mb-10 tracking-tight">
              AI Text-to-Image Generator
            </h1>
            <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
              Describe an image to generate stunning visuals using advanced AI technology.
            </p>

            <div className="max-w-2xl mx-auto mb-10">
              <div className="relative">
                <textarea
                  value={ttiPrompt}
                  onChange={(e) => setTtiPrompt(e.target.value)}
                  placeholder="Describe the image you want..."
                  className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  rows={4}
                  maxLength={200}
                />
                <span className="absolute bottom-2 right-2 text-sm text-gray-500 dark:text-gray-400">
                  {ttiPrompt.length}/200
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {samplePrompts.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => handleSamplePrompt(sample)}
                    className="px-3 py-1 text-sm bg-blue-100 dark:bg-gray-700 text-blue-700 dark:text-gray-300 rounded-full hover:bg-blue-200 dark:hover:bg-gray-600 transition"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-w-2xl mx-auto mb-10">
              <button
                onClick={handleGenerateTTI}
                disabled={isLoadingTTI || !ttiPrompt}
                className={`w-full py-3 px-6 text-lg font-semibold rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isLoadingTTI || !ttiPrompt
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                }`}
              >
                {isLoadingTTI ? (
                  <svg
                    className="animate-spin h-6 w-6 mr-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
                    />
                  </svg>
                ) : null}
                {isLoadingTTI ? 'Generating Image...' : 'Generate Image'}
              </button>
            </div>

            {imageUrl && (
              <div className="max-w-2xl mx-auto mb-10 animate-fade-in">
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
                  Generated Image
                </h3>
                <div className="relative group">
                  <CldImage
                    src={imageUrl}
                    width="512"
                    height="512"
                    alt="Generated Image"
                    crop="fill"
                    sizes="100vw"
                    className="rounded-lg shadow-md w-full transition-transform group-hover:scale-105 border border-gray-200 dark:border-gray-600"
                  />
                  <button
                    onClick={handleDownloadImage}
                    className="absolute bottom-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
                  >
                    Download
                  </button>
                </div>
              </div>
            )}
          </main>
        )}

        {/* Input Box for Chat */}
        {currentService === 'chat' && (
          <div className="fixed left-1/2 bottom-10 transform -translate-x-1/2 w-full max-w-4xl p-2 bg-white dark:bg-gray-800 shadow-[0_-4px_6px_rgba(0,0,0,0.1)] flex items-center gap-3 rounded-full">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 p-3 mx-0 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-700 focus:outline-none resize-none transition-all duration-200"
              rows="1"
              disabled={isLoadingChat}
            />
            <button
              onClick={sendMessage}
              className="p-1 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white"
              disabled={!input.trim() || isLoadingChat}
            >
              <PaperAirplaneIcon className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-3 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
          <p>© {new Date().getFullYear()} MindSeek. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
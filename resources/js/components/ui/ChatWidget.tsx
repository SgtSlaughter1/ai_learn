import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { db } from '@/db/database';
import 'katex/dist/katex.min.css';

interface Message {
    role: 'user' | 'model';
    content: string;
}

async function generateOfflineResponse(message: string): Promise<string> {
    const query = message.toLowerCase();

    try {
        // 1. Suggest recommendations
        if (query.includes('recommend') || query.includes('what should i study') || query.includes('suggest') || query.includes('study next') || query.includes('todo')) {
            const progress = await db.learnerProgress.toArray();
            const subjects = await db.subjects.toArray();
            const topics = await db.topics.toArray();

            if (subjects.length === 0) {
                return "I don't see any cached subjects in your database yet. Connect to the internet to download and suggest topics for you!";
            }

            // Find topics with progress < 80% or unattempted
            const lowProgressTopics = topics.filter(t => {
                const p = progress.find(pr => pr.topic_id === t.id);
                return !p || (p.mastery_score ?? 0) < 80;
            });

            if (lowProgressTopics.length === 0) {
                return "🎉 Excellent work! You have mastered all topics. You can review your flashcards or take standard quizzes to maintain your score.";
            }

            const recommendations = lowProgressTopics.slice(0, 3).map(t => {
                const sub = subjects.find(s => s.id === t.subject_id);
                const p = progress.find(pr => pr.topic_id === t.id);
                const scoreText = p ? `(Current Mastery: ${p.mastery_score}%)` : '(Not started yet)';
                return `- **${t.name}** in *${sub?.name || 'Curriculum'}* ${scoreText}`;
            }).join('\n');

            return `Here are the top topics you should focus on next to achieve mastery:\n\n${recommendations}\n\nWould you like to study one of these?`;
        }

        // 2. List subjects
        if (query.includes('subject') || query.includes('curriculum') || query.includes('list') || query.includes('course')) {
            const subjects = await db.subjects.toArray();
            if (subjects.length === 0) {
                return "No subjects are cached locally yet. Log in while online to preload your curriculum!";
            }
            const list = subjects.map(s => `- **${s.name}**: ${s.description || 'No description available.'}`).join('\n');
            return `Here are the subjects available in your offline study library:\n\n${list}\n\nSelect a subject from the menu to start studying!`;
        }

        // 3. Search for specific topics
        const topics = await db.topics.toArray();
        const matchedTopic = topics.find(t => query.includes(t.name.toLowerCase()) || query.includes(t.slug.replace('-', ' ')));
        if (matchedTopic) {
            const subjects = await db.subjects.toArray();
            const sub = subjects.find(s => s.id === matchedTopic.subject_id);

            // Look for sample explanation in cached quizzes
            const quizzes = await db.quizzes.toArray();
            let keyConcept = '';
            for (const q of quizzes) {
                const found = q.questions?.find((item: any) => item.topic_id === matchedTopic.id && item.explanation);
                if (found?.explanation) {
                    keyConcept = found.explanation;
                    break;
                }
            }

            let response = `Here is what I found in your offline library about **${matchedTopic.name}** (Level: ${matchedTopic.level.toUpperCase()}):\n\n*${matchedTopic.description || 'No description cached.'}*\n\nThis topic is part of your **${sub?.name || 'Curriculum'}** course.`;
            if (keyConcept) {
                response += `\n\n💡 **Key Concept:**\n${keyConcept}`;
            }
            response += `\n\nYou can practice this topic by taking the quiz for ${sub?.name || 'this subject'}!`;
            return response;
        }

        // 4. Search for specific subjects
        const subjects = await db.subjects.toArray();
        const matchedSubject = subjects.find(s => query.includes(s.name.toLowerCase()) || query.includes(s.slug));
        if (matchedSubject) {
            const subTopics = topics.filter(t => t.subject_id === matchedSubject.id);
            const topicList = subTopics.map(t => `- **${t.name}** (Level: ${t.level.toUpperCase()})`).join('\n');
            return `Here are the topics available in **${matchedSubject.name}**:\n\n${topicList || 'No topics cached yet.'}\n\nAsk me about any of these topics or practice them in the Subjects menu!`;
        }

        // 5. Concept & Question Bank Search across cached quizzes
        const cleanWords = query.replace(/[^\w\s]/g, '').split(' ').filter(w => w.length >= 4);
        if (cleanWords.length > 0) {
            const quizzes = await db.quizzes.toArray();
            for (const q of quizzes) {
                const qn = q.questions?.find((item: any) =>
                    cleanWords.some(w => item.question_text?.toLowerCase().includes(w) || item.explanation?.toLowerCase().includes(w))
                );
                if (qn) {
                    const sub = subjects.find(s => s.id === (q as any).subject_id);
                    const t = topics.find(tp => tp.id === qn.topic_id);
                    return `Here is what your offline curriculum notes say:\n\n* **${sub?.name || 'Curriculum'}** → **${t?.name || 'Concept'}**\n\n**Explanation:**\n${qn.explanation || qn.question_text}\n\nWould you like to practice more on this topic?`;
                }
            }
        }
    } catch (e) {
        console.warn('Offline AI helper error:', e);
    }

    // 6. Default Dynamic Offline fallback message
    const cachedSubjects = await db.subjects.toArray().catch(() => []);
    const cachedTopics = await db.topics.toArray().catch(() => []);
    const subjectList = cachedSubjects.length > 0 ? cachedSubjects.map(s => s.name).join(', ') : 'all enrolled subjects';
    const sampleTopics = cachedTopics.slice(0, 3).map(t => `**${t.name}**`).join(', ');

    return `🤖 **Offline AI Tutor Mode**\n\nI am operating in offline mode using your local curriculum library for **${subjectList}**.\n\nWhile offline, I can help you with:\n1. **"Recommend what to study"**: I will analyze your local mastery and suggest topics.\n2. **"List subjects"**: View your offline curriculum and descriptions.\n3. Ask about any topic in your library (e.g. ${sampleTopics || 'your topics'}) to see concept notes.`;
}

export default function ChatWidget() {
    const [chatOpen, setChatOpen] = useState<boolean>(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: "Hi! I'm your AI Study Companion. Ask me to recommend what to study, explain a topic, or plan your schedule!" }
    ]);
    const [chatInput, setChatInput] = useState<string>('');
    const [chatLoading, setChatLoading] = useState<boolean>(false);

    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll chat to bottom on new message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, chatOpen]);

    const getCsrfToken = () => {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] || '';
    };

    const handleSendChatMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || chatLoading) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setChatLoading(true);

        // If offline, use the local offline AI response generator
        if (!navigator.onLine) {
            setTimeout(async () => {
                const response = await generateOfflineResponse(userMessage);
                setMessages((prev) => [...prev, { role: 'model', content: response }]);
                setChatLoading(false);
            }, 800);
            return;
        }

        try {
            const res = await fetch('/api/v1/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(getCsrfToken())
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: messages
                })
            });

            if (!res.ok) throw new Error('Failed to send message');
            const data = await res.json();

            setMessages((prev) => [...prev, { role: 'model', content: data.response }]);
        } catch (error) {
            console.error(error);
            // Fallback to offline response generator even if request fails (network error)
            const response = await generateOfflineResponse(userMessage);
            setMessages((prev) => [...prev, { role: 'model', content: response }]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end">
            {/* Chat Panel Box */}
            {chatOpen && (
                <div className="mb-3 w-[calc(100vw-2rem)] sm:w-[400px] max-h-[75vh] h-[480px] bg-[var(--color-surface)]/95 border border-[var(--color-border)] rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="p-4 bg-[var(--color-background)]/60 border-b border-[var(--color-border)] flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                            <div>
                                <h4 className="text-sm font-extrabold text-[var(--color-text)]">AI Study Companion</h4>
                                <span className="text-[10px] text-[var(--color-muted)] block font-semibold">Online/Offline Hybrid</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setChatOpen(false)}
                            className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-5)] rounded-lg transition-colors cursor-pointer min-h-[32px] flex items-center justify-center"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Message log */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={msg.role === 'user' ? 'chat-bubble-user font-medium p-3.5 text-xs leading-relaxed max-w-[80%]' : 'bg-[var(--color-background)]/50 text-[var(--color-text)] border border-[var(--color-border)] rounded-2xl rounded-tl-none p-3.5 text-xs leading-relaxed max-w-[80%] font-medium'}>
                                    <Markdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                            li: ({ children }) => <li className="mb-0.5">{children}</li>,
                                            strong: ({ children }) => <strong className="font-bold text-[var(--color-text)]">{children}</strong>,
                                            a: ({ href, children }) => <a href={href} className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                                        }}
                                    >
                                        {msg.content}
                                    </Markdown>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-[var(--color-background)]/50 text-[var(--color-muted)] border border-[var(--color-border)] rounded-2xl rounded-tl-none p-3.5 text-xs animate-pulse font-semibold">
                                    Tutor is thinking...
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendChatMessage} className="p-3 bg-[var(--color-background)]/40 border-t border-[var(--color-border)] flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask AI anything..."
                            disabled={chatLoading}
                            className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-teal-500 min-h-[38px]"
                        />
                        <button
                            type="submit"
                            disabled={chatLoading || !chatInput.trim()}
                            className="px-3.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all min-h-[38px] flex items-center justify-center cursor-pointer"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}

            {/* Floating Bubble Button */}
            <button
                onClick={() => setChatOpen(!chatOpen)}
                className="h-14 w-14 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white flex items-center justify-center shadow-lg hover:shadow-teal-500/20 shadow-teal-600/30 transition-transform active:scale-95 cursor-pointer focus:outline-none"
                title="Open AI Companion"
            >
                {chatOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )}
            </button>
        </div>
    );
}

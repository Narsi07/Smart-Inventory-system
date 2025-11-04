
'use client';

import * as React from 'react';
import { inventoryChat } from '@/ai/flows/inventory-chatbot';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { InventoryChatHistory, Part } from '@/types';


export function InventoryChatbot() {
  const [messages, setMessages] = React.useState<InventoryChatHistory[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({
            top: scrollAreaRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Part[] = [{ text: input }];

    const newMessages: InventoryChatHistory[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const botResponse = await inventoryChat(newMessages);
      setMessages([...newMessages, { role: 'model', content: botResponse }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages([
        ...newMessages,
        { role: 'model', content: [{text: 'Sorry, I encountered an error. Please try again.'}] },
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const extractTextFromContent = (content: Part[]) => {
    // Check if content is valid, otherwise return an empty string
    if (!content || !Array.isArray(content)) return '';
    return content.map(part => part.text).join('');
  }

  return (
    <Card className="flex flex-col h-[60vh] w-full shadow-none border-none">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'model' && (
                <div className="p-2 bg-primary rounded-full text-primary-foreground">
                  <Bot size={16} />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[75%] rounded-lg p-3',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <div className="prose prose-sm text-inherit prose-p:my-0 prose-headings:my-2">
                    <ReactMarkdown>{extractTextFromContent(message.content)}</ReactMarkdown>
                </div>
              </div>
              {message.role === 'user' && (
                 <div className="p-2 bg-muted rounded-full text-foreground">
                  <User size={16} />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3 justify-start">
              <div className="p-2 bg-primary rounded-full text-primary-foreground">
                <Bot size={16} />
              </div>
              <div className="bg-muted rounded-lg p-3 flex items-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your inventory..."
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}


'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Bot, X } from 'lucide-react';
import { InventoryChatbot } from '@/components/inventory-chatbot';
import { cn } from '@/lib/utils';

export function FloatingChatbot() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Bot /> Inventory Assistant
            </DialogTitle>
            <DialogDescription>
              Ask questions about your inventory in plain English.
            </DialogDescription>
          </DialogHeader>
          <InventoryChatbot />
        </DialogContent>
      </Dialog>
      
      <Button
        size="icon"
        className={cn(
            "fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg transition-transform transform hover:scale-110",
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bot className={cn("h-8 w-8 transition-opacity", { 'opacity-100': !isOpen })} />
        <span className="sr-only">Toggle Chatbot</span>
      </Button>
    </>
  );
}

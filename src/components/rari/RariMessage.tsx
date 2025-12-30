import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useEntityDetection, splitContentWithEntities } from '@/hooks/useEntityDetection';
import { useEntityEnrichment } from '@/hooks/useEntityEnrichment';
import { EntityLink } from './EntityLink';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface RariMessageProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
}

export const RariMessage = ({ message, isOwn, showAvatar = true }: RariMessageProps) => {
  const entities = useEntityDetection(message.content);
  const enrichedEntities = useEntityEnrichment(entities);
  const segments = splitContentWithEntities(message.content, enrichedEntities);

  const renderContent = () => {
    return segments.map((segment, idx) => {
      if (segment.type === 'entity' && segment.entity) {
        return (
          <EntityLink 
            key={idx} 
            entity={segment.entity}
            isOwnMessage={isOwn}
          />
        );
      }
      return <span key={idx}>{segment.content}</span>;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 mb-4",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {!isOwn && showAvatar && (
        <Avatar className="h-8 w-8 border-2 border-gulf-blue/20 flex-shrink-0">
          <AvatarFallback className="bg-gulf-blue/10 text-gulf-blue text-xs font-semibold">
            R
          </AvatarFallback>
        </Avatar>
      )}
      
      {!isOwn && !showAvatar && <div className="w-8 flex-shrink-0" />}
      
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
        isOwn 
          ? "bg-primary text-primary-foreground rounded-tr-sm" 
          : "bg-muted rounded-tl-sm"
      )}>
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {renderContent()}
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <span className={cn(
            "text-[10px]",
            isOwn ? "opacity-70" : "opacity-60"
          )}>
            {format(message.timestamp, 'HH:mm')}
          </span>
          {entities.length > 0 && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              isOwn 
                ? "bg-primary-foreground/10" 
                : "bg-primary/10"
            )}>
              {entities.length} link{entities.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      
      {isOwn && showAvatar && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            You
          </AvatarFallback>
        </Avatar>
      )}
      
      {isOwn && !showAvatar && <div className="w-8 flex-shrink-0" />}
    </motion.div>
  );
};

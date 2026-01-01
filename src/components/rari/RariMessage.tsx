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
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex gap-2 md:gap-3 mb-3 md:mb-4",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {!isOwn && showAvatar && (
        <Avatar className="h-7 w-7 md:h-8 md:w-8 border-2 border-gulf-blue/20 flex-shrink-0 ring-2 ring-gulf-blue/5">
          <AvatarFallback className="bg-gradient-to-br from-gulf-blue/20 to-gulf-blue/10 text-gulf-blue text-xs font-semibold">
            R
          </AvatarFallback>
        </Avatar>
      )}
      
      {!isOwn && !showAvatar && <div className="w-7 md:w-8 flex-shrink-0" />}
      
      <div className={cn(
        "max-w-[85%] md:max-w-[75%] rounded-2xl px-3 py-2 md:px-4 md:py-3 shadow-sm hover:shadow-md transition-shadow duration-200",
        isOwn 
          ? "bg-gradient-to-br from-gulf-blue to-gulf-blue/90 text-white rounded-tr-sm" 
          : "bg-muted/80 backdrop-blur-sm rounded-tl-sm border border-border/50"
      )}>
        <div className="text-xs md:text-sm whitespace-pre-wrap break-words leading-relaxed">
          {renderContent()}
        </div>
        
        <div className="flex items-center gap-2 mt-1.5 md:mt-2">
          <span className={cn(
            "text-[10px]",
            isOwn ? "text-white/70" : "text-muted-foreground/80"
          )}>
            {format(message.timestamp, 'HH:mm')}
          </span>
          {entities.length > 0 && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              isOwn 
                ? "bg-white/20 text-white/90" 
                : "bg-gulf-blue/15 text-gulf-blue"
            )}>
              {entities.length} link{entities.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      
      {isOwn && showAvatar && (
        <Avatar className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 ring-2 ring-primary/5">
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-semibold">
            You
          </AvatarFallback>
        </Avatar>
      )}
      
      {isOwn && !showAvatar && <div className="w-7 md:w-8 flex-shrink-0" />}
    </motion.div>
  );
};

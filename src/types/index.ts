export interface Message {
  id: string;
  chatId?: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isExpanded?: boolean;
  visualization?: string;
  visualization_data?: string;
  hasStoredVisualization?: boolean;
  isCentered?: boolean;
  isFavorited?: boolean;
  messageType?: 'user' | 'astra' | 'system';
  isReply?: boolean;
  replyToId?: string;
  metadata?: any;
}

export interface VisualizationState {
  messageId: string;
  isGenerating: boolean;
  content: string | null;
  isVisible: boolean;
}

export interface GroupMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  message_content: string;
  message_type: 'user' | 'astra' | 'system';
  mentions: string[];
  astra_prompt?: string | null;
  visualization_data?: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface ReplyState {
  isReplying: boolean;
  messageId: string | null;
  messageSnippet: string | null;
  originalMessage?: {
    id: string;
    content: string;
    userName: string;
    timestamp: string;
  } | null;
}

export interface FavoriteMessage {
  id: string;
  text: string;
  createdAt: Date;
}

export type ChatMode = 'private' | 'team';
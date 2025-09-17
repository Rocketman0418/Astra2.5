import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Search, X, Users, MessageSquare, Plus, Image as ImageIcon, Reply, FileText } from 'lucide-react';
import { useGroupChat } from '../hooks/useGroupChat';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useVisualization } from '../hooks/useVisualization';
import { GroupMessage } from './GroupMessage';
import { MentionInput } from './MentionInput';
import { VisualizationView } from './VisualizationView';
import { GroupMessage as GroupMessageType, ReplyState } from '../types';

interface GroupChatProps {
  showTeamMenu: boolean;
  onCloseTeamMenu: () => void;
  onSwitchToPrivateChat: (conversationId: string) => void;
}

export const GroupChat: React.FC<GroupChatProps> = ({
  showTeamMenu,
  onCloseTeamMenu,
  onSwitchToPrivateChat
}) => {
  const { user } = useAuth();
  const {
    messages,
    hasMoreMessages,
    loadingMore,
    totalMessageCount,
    loading,
    error,
    isAstraThinking,
    sendMessage,
    loadMoreMessages,
    searchMessages,
    updateVisualizationData,
    setError
  } = useGroupChat();

  const {
    notifications,
    markAsSeen,
    clearMentions,
    requestNotificationPermission,
    isTabActive
  } = useNotifications();

  const {
    generateVisualization,
    showVisualization,
    hideVisualization,
    getVisualization,
    currentVisualization,
    messageToHighlight,
    clearHighlight
  } = useVisualization();

  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GroupMessageType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; filename: string; size: number } | null>(null);
  const [replyState, setReplyState] = useState<ReplyState>({
    isReplying: false,
    messageId: null,
    messageSnippet: null,
    originalMessage: null
  });
  const [visualizationStates, setVisualizationStates] = useState<Record<string, any>>({});
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [showSummarizeOptions, setShowSummarizeOptions] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enhanced scroll to bottom function with PWA detection
  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    console.log('📱 GroupChat: scrollToBottom called with behavior:', behavior);
    
    if (messagesEndRef.current) {
      // For PWA, use immediate scroll first, then smooth if needed
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                   (window.navigator as any).standalone === true ||
                   document.referrer.includes('android-app://');
      
      if (isPWA) {
        console.log('📱 GroupChat: PWA detected, using immediate scroll');
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        // Small delay then smooth scroll to ensure it reaches the bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        console.log('📱 GroupChat: Web version, using smooth scroll');
        messagesEndRef.current.scrollIntoView({ behavior });
      }
    }
  }, []);

  // Force scroll to bottom when messages change (especially for initial load)
  useEffect(() => {
    console.log('📱 GroupChat: Messages changed, length:', messages.length, 'hasScrolledToBottom:', hasScrolledToBottom);
    
    if (messages.length > 0) {
      // Always scroll to bottom when messages first load or new messages arrive
      if (!hasScrolledToBottom || messages.length > 0) {
        console.log('📱 GroupChat: Scrolling to bottom due to message changes');
        scrollToBottom('auto'); // Use immediate scroll for initial load
        setHasScrolledToBottom(true);
      }
    }
  }, [messages.length, scrollToBottom, hasScrolledToBottom]);

  // Enhanced initial scroll effect for PWA
  useEffect(() => {
    console.log('📱 GroupChat: Initial mount effect, messages length:', messages.length);
    
    // Multiple attempts to ensure scroll works in PWA
    const scrollAttempts = [100, 300, 500, 1000];
    
    scrollAttempts.forEach((delay) => {
      setTimeout(() => {
        console.log(`📱 GroupChat: Scroll attempt after ${delay}ms`);
        scrollToBottom('auto');
      }, delay);
    });

    // Mark messages as seen when component mounts and user is active
    if (isTabActive && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      markAsSeen(latestMessage.id);
    }
  }, []); // Only run on mount

  // Scroll to bottom when new messages arrive (not from load more)
  useEffect(() => {
    if (messages.length > 0 && !loadingMore) {
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        
        // Auto-scroll if user is near bottom or if it's a new message from current user
        const latestMessage = messages[messages.length - 1];
        const isOwnMessage = latestMessage.user_id === user?.id;
        
        if (isNearBottom || isOwnMessage) {
          console.log('📱 GroupChat: Auto-scrolling due to new message');
          scrollToBottom('smooth');
        }
      }
    }
  }, [messages, loadingMore, scrollToBottom, user?.id]);

  // Handle scroll events for load more and mark as seen
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Load more messages when scrolled to top
    if (container.scrollTop === 0 && hasMoreMessages && !loadingMore && !loading) {
      console.log('📱 GroupChat: Loading more messages due to scroll to top');
      loadMoreMessages();
    }

    // Mark messages as seen when scrolled to bottom
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    if (isAtBottom && isTabActive && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      markAsSeen(latestMessage.id);
    }
  }, [hasMoreMessages, loadingMore, loading, loadMoreMessages, isTabActive, messages, markAsSeen]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('File size must be less than 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setSelectedImage({
          url: result,
          filename: file.name,
          size: file.size
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !selectedImage) || loading) return;

    const messageText = inputValue.trim();
    const imageData = selectedImage;
    const replyData = replyState.isReplying ? replyState.originalMessage : undefined;

    // Clear input and states immediately
    setInputValue('');
    setSelectedImage(null);
    setReplyState({
      isReplying: false,
      messageId: null,
      messageSnippet: null,
      originalMessage: null
    });

    try {
      await sendMessage(messageText, imageData, replyData);
      console.log('📱 GroupChat: Message sent successfully');
      
      // Ensure scroll to bottom after sending
      setTimeout(() => {
        scrollToBottom('smooth');
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    }
  };

  // Handle search
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchMessages(query);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle team members
  const handleShowTeamMembers = () => {
    setShowTeamMembers(true);
    onCloseTeamMenu();
  };

  // Handle summarize chat
  const handleSummarizeChat = () => {
    setShowSummarizeOptions(true);
    onCloseTeamMenu();
  };

  // Handle summarize with time period
  const handleSummarizeWithPeriod = async (period: string) => {
    setShowSummarizeOptions(false);
    
    const prompts = {
      '24hours': 'Please provide a comprehensive summary of our team chat from the last 24 hours. Include key decisions, action items, and important discussions.',
      '7days': 'Please provide a comprehensive summary of our team chat from the last 7 days. Include key decisions, action items, and important discussions.',
      '30days': 'Please provide a comprehensive summary of our team chat from the last 30 days. Include key decisions, action items, and important discussions.'
    };

    const prompt = prompts[period as keyof typeof prompts];
    if (prompt) {
      await sendMessage(prompt);
    }
  };

  // Team members data
  const teamMembers = [
    {
      name: 'Astra',
      email: 'AI Intelligence',
      avatar: '🚀',
      isAI: true
    },
    {
      name: 'Clay Speakman',
      email: 'clay@rockethub.ai',
      avatar: 'C'
    },
    {
      name: 'Derek Tellier',
      email: 'derek@rockethub.ai',
      avatar: 'D'
    },
    {
      name: 'Marshall Briggs',
      email: 'marshall@rockethub.ai',
      avatar: 'M'
    }
  ];

  // Handle reply
  const handleReply = useCallback((messageId: string, messageContent: string, userName: string, timestamp: string) => {
    setReplyState({
      isReplying: true,
      messageId,
      messageSnippet: messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent,
      originalMessage: {
        id: messageId,
        content: messageContent,
        userName,
        timestamp
      }
    });
    console.log('🔄 GroupChat: Started reply to message:', messageId);
  }, []);

  // Cancel reply
  const cancelReply = useCallback(() => {
    setReplyState({
      isReplying: false,
      messageId: null,
      messageSnippet: null,
      originalMessage: null
    });
    console.log('❌ GroupChat: Cancelled reply');
  }, []);

  // Handle visualization creation
  const handleCreateVisualization = useCallback(async (messageId: string, messageContent: string) => {
    console.log('🎯 Team chat: Starting visualization generation for messageId:', messageId);
    
    // Set generating state
    setVisualizationStates(prev => ({
      ...prev,
      [messageId]: {
        isGenerating: true,
        content: null,
        hasVisualization: false
      }
    }));

    try {
      await generateVisualization(messageId, messageContent);
      
      // Update state to show visualization is ready
      setVisualizationStates(prev => ({
        ...prev,
        [messageId]: {
          isGenerating: false,
          content: 'generated',
          hasVisualization: true
        }
      }));
      
      console.log('✅ Team chat: Visualization generation completed for message:', messageId);
    } catch (error) {
      console.error('❌ Team chat: Error during visualization generation:', error);
      setVisualizationStates(prev => ({
        ...prev,
        [messageId]: {
          isGenerating: false,
          content: null,
          hasVisualization: false
        }
      }));
    }
  }, [generateVisualization]);

  // Handle viewing visualization
  const handleViewVisualization = useCallback((messageId: string, visualizationData?: string) => {
    console.log('👁️ Team chat: handleViewVisualization called for messageId:', messageId);
    
    // Find the message to get visualization data
    const message = messages.find(m => m.id === messageId);
    
    if (message?.visualization_data) {
      console.log('📊 Team chat: Using message visualization_data directly');
      showVisualization(messageId);
      return;
    }
    
    // Check local state
    const localState = visualizationStates[messageId];
    if (localState?.content && localState.content !== 'generated') {
      console.log('📊 Team chat: Using local state visualization data');
      showVisualization(messageId);
      return;
    }
    
    console.log('❌ Team chat: No visualization data found for message:', messageId);
  }, [messages, visualizationStates, showVisualization]);

  // Show visualization view if one is currently active
  if (currentVisualization) {
    const message = messages.find(m => m.id === currentVisualization);
    const visualizationContent = message?.visualization_data || getVisualization(currentVisualization)?.content;
    
    if (visualizationContent && visualizationContent !== 'generated') {
      return (
        <VisualizationView
          content={visualizationContent}
          onBack={hideVisualization}
        />
      );
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Team Menu Sidebar */}
      {showTeamMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onCloseTeamMenu}
          />
          <div className="fixed top-16 left-0 h-[calc(100vh-4rem)] w-80 bg-gray-800 border-r border-gray-700 z-50 transform transition-transform duration-300 ease-in-out">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Team Chat Tools</h2>
                <button
                  onClick={onCloseTeamMenu}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-2">
                {/* Team Members Button */}
                <div
                  onClick={handleShowTeamMembers}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 cursor-pointer flex items-center justify-center space-x-3"
                >
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="text-lg font-semibold">Team Members</span>
                </div>
                
                {/* Summarize Chat Button */}
                <div
                  onClick={handleSummarizeChat}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 cursor-pointer flex items-center justify-center space-x-3"
                >
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="text-lg font-semibold">Summarize Chat</span>
                </div>
                
                {/* Search Messages Section */}
                <div className="mt-6">
                  <h3 className="text-white font-medium mb-3">Search Messages</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search messages..."
                      className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && searchInput.trim()) {
                          handleSearch(searchInput);
                        }
                      }}
                    />
                  </div>
                  
                  {!showSearchResults && !isSearching && (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">Start typing to search</p>
                    </div>
                  )}
                </div>
                
              </div>

              {/* Notifications Summary */}
              {(notifications.unreadCount > 0 || notifications.mentions.length > 0) && (
                <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                  <h3 className="text-white font-medium mb-2">Notifications</h3>
                  {notifications.unreadCount > 0 && (
                    <p className="text-gray-300 text-sm mb-2">
                      {notifications.unreadCount} unread messages
                    </p>
                  )}
                  {notifications.mentions.length > 0 && (
                    <div>
                      <p className="text-red-400 text-sm font-medium mb-2">
                        {notifications.mentions.length} mentions
                      </p>
                      <button
                        onClick={clearMentions}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Clear mentions
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Team Members Modal */}
      {showTeamMembers && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Team Members</h2>
              <button
                onClick={() => setShowTeamMembers(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {teamMembers.map((member, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    member.isAI 
                      ? 'bg-gradient-to-br from-blue-600 to-purple-600' 
                      : 'bg-gray-600'
                  }`}>
                    {member.avatar}
                  </div>
                  <div>
                    <p className="text-white font-medium">{member.name}</p>
                    <p className="text-gray-400 text-sm">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summarize Chat Options Modal */}
      {showSummarizeOptions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Summarize Chat</h2>
              </div>
              <button
                onClick={() => setShowSummarizeOptions(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => handleSummarizeWithPeriod('24hours')}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <span className="text-white font-medium">Last 24 Hours</span>
              </button>
              <button
                onClick={() => handleSummarizeWithPeriod('7days')}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <span className="text-white font-medium">Last 7 Days</span>
              </button>
              <button
                onClick={() => handleSummarizeWithPeriod('30days')}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <span className="text-white font-medium">Last 30 Days</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results Modal */}
      {showSearchResults && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Search Results</h2>
              <button
                onClick={() => {
                  setShowSearchResults(false);
                  setSearchResults([]);
                  setSearchInput('');
                }}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isSearching ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Searching...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-4">
                  {searchResults.map((result) => (
                    <div key={result.id} className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          result.message_type === 'astra' 
                            ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}>
                          {result.message_type === 'astra' ? '🚀' : result.user_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-blue-300">{result.user_name}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(result.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300">{result.message_content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No results found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        onScroll={handleScroll}
        style={{ 
          scrollBehavior: 'smooth',
          overscrollBehavior: 'contain' // Prevent bounce scrolling on iOS
        }}
      >
        {/* Load More Button */}
        {hasMoreMessages && (
          <div className="text-center py-4">
            <button
              onClick={loadMoreMessages}
              disabled={loadingMore}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg transition-colors"
            >
              {loadingMore ? 'Loading...' : `Load More (${totalMessageCount - messages.length} remaining)`}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && messages.length === 0 && (
          <div className="flex justify-center items-center py-8">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading team messages...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-200 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <div key={message.id} id={`message-${message.id}`}>
            <GroupMessage
              message={message}
              currentUserId={user?.id || ''}
              currentUserEmail={user?.email || ''}
              isCurrentUserAdmin={false}
              onViewVisualization={handleViewVisualization}
              onCreateVisualization={handleCreateVisualization}
              onReply={handleReply}
              visualizationState={visualizationStates[message.id]}
            />
          </div>
        ))}

        {/* Astra Thinking Indicator */}
        {isAstraThinking && (
          <div className="flex justify-start mb-4">
            <div className="flex-shrink-0 mr-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                🚀
              </div>
            </div>
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-2xl px-4 py-3 shadow-sm border border-blue-500/20">
              <div className="flex items-center space-x-2">
                <span className="text-sm">Astra is thinking</span>
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-gray-900 border-t border-gray-700 p-4 safe-area-padding-bottom">
        {/* Reply Preview */}
        {replyState.isReplying && (
          <div className="mb-3 bg-gray-800 border border-gray-600 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <Reply className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">
                    Replying to {replyState.originalMessage?.userName}
                  </span>
                </div>
                <p className="text-sm text-gray-300 line-clamp-2">
                  {replyState.messageSnippet}
                </p>
              </div>
              <button
                onClick={cancelReply}
                className="p-1 hover:bg-gray-700 rounded transition-colors ml-2"
                title="Cancel reply"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        {/* Selected Image Preview */}
        {selectedImage && (
          <div className="mb-3 bg-gray-800 border border-gray-600 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.filename}
                  className="w-12 h-12 object-cover rounded"
                />
                <div>
                  <p className="text-sm text-white font-medium">{selectedImage.filename}</p>
                  <p className="text-xs text-gray-400">
                    {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="Remove image"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end space-x-3 max-w-4xl mx-auto">
          {/* Message Input */}
          <div className="w-full relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <MentionInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              disabled={loading}
              placeholder="Send a message...use @astra for Astra Intelligence"
              onImageUpload={() => fileInputRef.current?.click()}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
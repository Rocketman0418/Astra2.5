import React, { useState } from 'react';
import { Header } from './Header';
import { ChatSidebar } from './ChatSidebar';
import { ChatContainer } from './ChatContainer';
import { GroupChat } from './GroupChat';
import { ReportsView } from './Reports/ReportsView';
import { ChatModeToggle } from './ChatModeToggle';
import { ChatMode } from '../types';

export const MainContainer: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('reports');
  const [conversationToLoad, setConversationToLoad] = useState<string | null>(null);
  const [shouldStartNewChat, setShouldStartNewChat] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);

  // Close sidebar when switching away from private chat mode
  React.useEffect(() => {
    if (chatMode === 'private') {
      setSidebarOpen(false);
    }
  }, [chatMode]);

  const handleLoadConversation = (conversationId: string) => {
    setConversationToLoad(conversationId);
    setSidebarOpen(false);
  };

  const handleStartNewConversation = () => {
    setShouldStartNewChat(true);
    setSidebarOpen(false);
  };

  const handleSwitchToPrivateChat = (conversationId: string) => {
    setChatMode('private');
    setConversationToLoad(conversationId);
  };

  const handleToggleTeamMenu = () => {
    setShowTeamMenu(!showTeamMenu);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Sidebar - only show for private chat mode */}
      {chatMode === 'private' && (
        <ChatSidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          onLoadConversation={handleLoadConversation}
          onStartNewConversation={handleStartNewConversation}
        />
      )}
      
      <div className="flex flex-col h-screen">
        <Header 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showSidebarToggle={chatMode === 'private'}
          chatMode={chatMode}
          onToggleTeamMenu={handleToggleTeamMenu}
        />
        
        {/* Chat Mode Toggle */}
        <div className="pt-16">
          <ChatModeToggle mode={chatMode} onModeChange={setChatMode} />
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          {chatMode === 'reports' ? (
            <ReportsView />
          ) : chatMode === 'private' ? (
            <ChatContainer 
              sidebarOpen={sidebarOpen}
              onCloseSidebar={() => setSidebarOpen(false)}
              conversationToLoad={conversationToLoad}
              shouldStartNewChat={shouldStartNewChat}
              onConversationLoaded={() => setConversationToLoad(null)}
              onNewChatStarted={() => setShouldStartNewChat(false)}
            />
          ) : (
            <GroupChat 
              showTeamMenu={showTeamMenu}
              onCloseTeamMenu={() => setShowTeamMenu(false)}
              onSwitchToPrivateChat={handleSwitchToPrivateChat}
            />
          )}
        </div>
      </div>
    </div>
  );
};
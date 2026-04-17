import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [newNotification, setNewNotification] = useState(null);

  useEffect(() => {
    const connectSocket = async () => {
      if (!user?._id) return;

      try {
        const { io } = await import('socket.io-client');
        const socket = io('https://find-your-item-oxzn.onrender.com', {
          transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
          console.log('🔌 Socket connected');
          socket.emit('join', user._id);
          socket.emit('getOnlineUsers');
          setIsConnected(true);
        });

        socket.on('disconnect', () => {
          console.log('🔌 Socket disconnected');
          setIsConnected(false);
        });

        // Online/Offline tracking
        socket.on('userOnline', ({ userId }) => {
          setOnlineUsers(prev => {
            const updated = new Set(prev);
            updated.add(userId);
            return updated;
          });
        });

        socket.on('userOffline', ({ userId }) => {
          setOnlineUsers(prev => {
            const updated = new Set(prev);
            updated.delete(userId);
            return updated;
          });
        });

        socket.on('onlineUsersList', (userIds) => {
          setOnlineUsers(new Set(userIds));
        });

        // Notification listener
        socket.on('newNotification', (notification) => {
          setNewNotification(notification);
        });

        socketRef.current = socket;
      } catch (err) {
        console.log('Socket.io client not available, chat will use polling');
      }
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [user]);

  // Join a chat room
  const joinChatRoom = useCallback((otherUserId) => {
    if (socketRef.current && user?._id) {
      const ids = [user._id, otherUserId].sort();
      const chatRoomId = `chat_${ids[0]}_${ids[1]}`;
      socketRef.current.emit('joinChat', { chatRoomId });
      return chatRoomId;
    }
    return null;
  }, [user]);

  // Leave a chat room
  const leaveChatRoom = useCallback((chatRoomId) => {
    if (socketRef.current && chatRoomId) {
      socketRef.current.emit('leaveChat', { chatRoomId });
    }
  }, []);

  // Clear notification after consuming
  const clearNewNotification = useCallback(() => {
    setNewNotification(null);
  }, []);

  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const value = {
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    isUserOnline,
    joinChatRoom,
    leaveChatRoom,
    newNotification,
    clearNewNotification,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

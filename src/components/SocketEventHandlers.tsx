import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent, SocketEvents } from '../context/SocketContext';
import logger from '../lib/logger';

// Component that listens for socket events and updates contexts
export function SocketEventHandlers() {
  const { refreshAuth } = useAuth();
  const queryClient = useQueryClient();

  // Handle user/organization updates
  const handleUserUpdate = useCallback(() => {
    logger.log('[SocketEventHandlers] User update received via socket');
    refreshAuth();
  }, [refreshAuth]);

  const handleOrgUpdate = useCallback(() => {
    logger.log('[SocketEventHandlers] Organization update received via socket');
    refreshAuth();
  }, [refreshAuth]);

  // Handle event updates
  const handleEventUpdate = useCallback(() => {
    logger.log('[SocketEventHandlers] Event update received via socket');
    queryClient.invalidateQueries({ queryKey: ['events'] });
  }, [queryClient]);

  useSocketEvent(SocketEvents.USER_UPDATED, handleUserUpdate);
  useSocketEvent(SocketEvents.ORGANIZATION_UPDATED, handleOrgUpdate);
  useSocketEvent(SocketEvents.EVENT_CREATED, handleEventUpdate);
  useSocketEvent(SocketEvents.EVENT_UPDATED, handleEventUpdate);
  useSocketEvent(SocketEvents.EVENT_DELETED, handleEventUpdate);

  // This component doesn't render anything
  return null;
}

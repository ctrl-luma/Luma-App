import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent, SocketEvents } from '../context/SocketContext';

// Component that listens for socket events and updates contexts
export function SocketEventHandlers() {
  const { refreshAuth } = useAuth();

  // Handle user/organization updates
  const handleUserUpdate = useCallback(() => {
    console.log('User update received via socket');
    refreshAuth();
  }, [refreshAuth]);

  const handleOrgUpdate = useCallback(() => {
    console.log('Organization update received via socket');
    refreshAuth();
  }, [refreshAuth]);

  useSocketEvent(SocketEvents.USER_UPDATED, handleUserUpdate);
  useSocketEvent(SocketEvents.ORGANIZATION_UPDATED, handleOrgUpdate);

  // This component doesn't render anything
  return null;
}

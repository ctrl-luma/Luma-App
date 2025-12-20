import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authService, User, Organization } from '../lib/api';

interface Profile {
  user: User;
  organization: Organization;
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => authService.getProfile(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<User>) => apiClient.patch<User>('/auth/profile', data),
    onSuccess: (updatedUser) => {
      // Update the profile cache
      queryClient.setQueryData(['profile'], (old: Profile | undefined) => {
        if (!old) return old;
        return { ...old, user: { ...old.user, ...updatedUser } };
      });
    },
  });
}

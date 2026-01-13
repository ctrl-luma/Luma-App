/**
 * Hook to track Tap to Pay education first-use state
 * Apple TTPOi Requirement 3.2: Make merchants aware that TTP is available
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EDUCATION_SEEN_KEY = '@luma/tap_to_pay_education_seen';
const EDUCATION_DISMISSED_KEY = '@luma/tap_to_pay_education_dismissed';

interface UseTapToPayEducationReturn {
  hasSeenEducation: boolean;
  hasDismissedEducation: boolean;
  isLoading: boolean;
  markEducationSeen: () => Promise<void>;
  markEducationDismissed: () => Promise<void>;
  shouldShowEducationPrompt: boolean;
  resetEducationState: () => Promise<void>;
}

export function useTapToPayEducation(): UseTapToPayEducationReturn {
  const [hasSeenEducation, setHasSeenEducation] = useState(false);
  const [hasDismissedEducation, setHasDismissedEducation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load state from AsyncStorage
  useEffect(() => {
    const loadState = async () => {
      try {
        const [seen, dismissed] = await Promise.all([
          AsyncStorage.getItem(EDUCATION_SEEN_KEY),
          AsyncStorage.getItem(EDUCATION_DISMISSED_KEY),
        ]);
        setHasSeenEducation(seen === 'true');
        setHasDismissedEducation(dismissed === 'true');
      } catch (error) {
        console.warn('[TapToPayEducation] Failed to load state:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadState();
  }, []);

  // Mark education as seen (user completed the education flow)
  const markEducationSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(EDUCATION_SEEN_KEY, 'true');
      setHasSeenEducation(true);
    } catch (error) {
      console.warn('[TapToPayEducation] Failed to mark as seen:', error);
    }
  }, []);

  // Mark education as dismissed (user skipped/closed without completing)
  const markEducationDismissed = useCallback(async () => {
    try {
      await AsyncStorage.setItem(EDUCATION_DISMISSED_KEY, 'true');
      setHasDismissedEducation(true);
    } catch (error) {
      console.warn('[TapToPayEducation] Failed to mark as dismissed:', error);
    }
  }, []);

  // Reset state (for testing/development)
  const resetEducationState = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(EDUCATION_SEEN_KEY),
        AsyncStorage.removeItem(EDUCATION_DISMISSED_KEY),
      ]);
      setHasSeenEducation(false);
      setHasDismissedEducation(false);
    } catch (error) {
      console.warn('[TapToPayEducation] Failed to reset state:', error);
    }
  }, []);

  // Show education prompt if user hasn't seen it and hasn't dismissed it
  const shouldShowEducationPrompt = !isLoading && !hasSeenEducation && !hasDismissedEducation;

  return {
    hasSeenEducation,
    hasDismissedEducation,
    isLoading,
    markEducationSeen,
    markEducationDismissed,
    shouldShowEducationPrompt,
    resetEducationState,
  };
}

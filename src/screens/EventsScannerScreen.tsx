import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { eventsApi, type EventScanResult, type OrgEvent, type RecentScan } from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import { glass } from '../lib/colors';
import { StarBackground } from '../components/StarBackground';

// Dynamically import expo-camera (may not be installed)
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const mod = require('expo-camera');
  CameraView = mod.CameraView;
  useCameraPermissions = mod.useCameraPermissions;
} catch {
  // expo-camera not installed
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.65;

interface ScanRecord {
  id: string;
  customerName: string | null;
  tierName: string;
  timestamp: Date;
  valid: boolean;
  message?: string;
  ticketEvent?: string;
}

export function EventsScannerScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const glassColors = isDark ? glass.dark : glass.light;
  const { subscription, isLoading: authLoading } = useAuth();
  const { deviceId } = useDevice();

  const [selectedEvent, setSelectedEvent] = useState<OrgEvent | null>(null);
  const [lastScan, setLastScan] = useState<ScanRecord | null>(null);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [processing, setProcessing] = useState(false);
  const lastScannedRef = useRef<string>('');

  // Fetch recent scans when event is selected
  useEffect(() => {
    if (!selectedEvent) {
      setRecentScans([]);
      return;
    }

    const fetchRecentScans = async () => {
      setLoadingScans(true);
      try {
        const response = await eventsApi.getRecentScans(selectedEvent.id, deviceId, 20);
        const scans: ScanRecord[] = response.scans.map((s: RecentScan) => ({
          id: s.id,
          customerName: s.customerName,
          tierName: s.tierName,
          timestamp: new Date(s.usedAt),
          valid: true,
          message: 'Ticket verified',
        }));
        setRecentScans(scans);
      } catch (err) {
        console.error('[EventsScanner] Failed to fetch recent scans:', err);
      } finally {
        setLoadingScans(false);
      }
    };

    fetchRecentScans();
  }, [selectedEvent, deviceId]);

  const resultAnim = useRef(new Animated.Value(0)).current;

  // Camera permissions
  const permissionHook = useCameraPermissions ? useCameraPermissions() : [null, null];
  const [permission, requestPermission] = permissionHook || [null, null];

  // Fetch org events for context
  const { data: eventsData, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      console.log('[EventsScanner] Fetching events...');
      const result = await eventsApi.list();
      console.log('[EventsScanner] Fetch result:', JSON.stringify(result, null, 2));
      return result;
    },
    staleTime: 60 * 1000,
  });

  // Log any errors
  if (eventsError) {
    console.error('[EventsScanner] Error fetching events:', eventsError);
  }

  const isPro = subscription?.tier === 'pro' || subscription?.tier === 'enterprise';

  // Show loading while auth/subscription is loading to prevent flash
  const isInitializing = authLoading || (subscription === undefined && !authLoading);

  // Handle both { events: [...] } and [...] response formats
  const allEvents: OrgEvent[] = Array.isArray(eventsData)
    ? eventsData
    : (eventsData?.events || []);

  console.log('[EventsScanner] Raw events data:', JSON.stringify(eventsData, null, 2));
  console.log('[EventsScanner] All events count:', allEvents.length);

  // Filter to published events: upcoming, ongoing, or within 24h after ending
  const activeEvents = allEvents.filter((e: OrgEvent) => {
    const isPublished = e.status === 'published';
    const endTime = new Date(e.endsAt).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const isNotExpired = Date.now() < endTime + oneDayMs;

    console.log(`[EventsScanner] Event "${e.name}": status=${e.status}, isPublished=${isPublished}, endsAt=${e.endsAt}, isNotExpired=${isNotExpired}`);

    return isPublished && isNotExpired;
  });

  console.log('[EventsScanner] Filtered activeEvents:', activeEvents.length);

  const showResult = useCallback((record: ScanRecord) => {
    setLastScan(record);
    setRecentScans(prev => [record, ...prev].slice(0, 20));

    Animated.sequence([
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(resultAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setLastScan(null);
      lastScannedRef.current = '';
    });
  }, [resultAnim]);

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (processing || data === lastScannedRef.current || !selectedEvent) return;

    lastScannedRef.current = data;
    setProcessing(true);

    try {
      const result = await eventsApi.scan(data, selectedEvent.id, deviceId);
      const record: ScanRecord = {
        id: Date.now().toString(),
        customerName: result.customerName ?? null,
        tierName: result.tierName || 'Unknown',
        timestamp: new Date(),
        valid: result.valid,
        message: result.message,
        ticketEvent: result.ticketEvent,
      };
      showResult(record);
    } catch (err: any) {
      const record: ScanRecord = {
        id: Date.now().toString(),
        customerName: null,
        tierName: 'Unknown',
        timestamp: new Date(),
        valid: false,
        message: err?.error || 'Failed to verify ticket',
      };
      showResult(record);
    } finally {
      setProcessing(false);
    }
  }, [processing, showResult, selectedEvent, deviceId]);

  // Format event date/time for display
  const formatEventDateTime = (event: OrgEvent) => {
    const start = new Date(event.startsAt);
    return start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Unified loading state - show skeleton while auth or events are loading
  // Also check if eventsData is undefined (query hasn't returned yet)
  const isLoading = isInitializing || eventsLoading || (eventsData === undefined && !eventsError);

  // Event selection screen (or loading/empty states)
  if (!selectedEvent) {
    return (
      <StarBackground colors={colors} isDark={isDark}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Header - always visible */}
          <View style={styles.selectHeader}>
          <Text style={[styles.selectTitle, { color: colors.text }]}>Ticket Scanner</Text>
          <Text style={[styles.selectSubtitle, { color: colors.textSecondary }]}>
            {isPro ? 'Select an event to start scanning' : 'Scan QR codes to check in guests'}
          </Text>
        </View>

        {/* Content area */}
        {isLoading ? (
          // Skeleton loading
          <View style={styles.skeletonContainer}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.skeletonContent}>
                  <View style={[styles.skeletonTitle, { backgroundColor: colors.border }]} />
                  <View style={[styles.skeletonSubtitle, { backgroundColor: colors.border }]} />
                  <View style={styles.skeletonStats}>
                    <View style={[styles.skeletonStat, { backgroundColor: colors.border }]} />
                    <View style={[styles.skeletonStat, { backgroundColor: colors.border }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : !isPro ? (
          // Pro gate - shown after loading completes
          <View style={styles.proGateContent}>
            {/* Features */}
            <View style={[styles.proFeaturesCard, { backgroundColor: glassColors.background, borderColor: glassColors.border }]}>
              {[
                { icon: 'qr-code-outline', text: 'Instant QR code scanning' },
                { icon: 'checkmark-circle-outline', text: 'Real-time ticket validation' },
                { icon: 'people-outline', text: 'Track check-in progress' },
              ].map((feature, index) => (
                <View key={index} style={styles.proFeatureRow}>
                  <Ionicons name={feature.icon as any} size={18} color={colors.primary} />
                  <Text style={[styles.proFeatureText, { color: colors.textSecondary }]}>
                    {feature.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Upgrade Button */}
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => navigation.navigate('Upgrade')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeButtonGradient}
              >
                <Ionicons name="diamond" size={18} color="#fff" />
                <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : !CameraView ? (
          // Camera not available
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.textMuted + '15' }]}>
              <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Camera Not Available
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              The camera module is not installed.{'\n'}Please use a development build.
            </Text>
          </View>
        ) : !permission?.granted ? (
          // Camera permission needed
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="camera-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Camera Access Required
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              To scan ticket QR codes, please allow{'\n'}camera access for Luma
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Enable Camera</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : eventsError ? (
          // Error state
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.error + '15' }]}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Unable to Load Events
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Please check your connection and try again
            </Text>
          </View>
        ) : activeEvents.length === 0 ? (
          // No events
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.textMuted + '10' }]}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Active Events
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Create and publish an event from the{'\n'}vendor dashboard to start scanning tickets
            </Text>
          </View>
        ) : (
          <FlatList
            data={activeEvents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.eventList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedEvent(item)}
                activeOpacity={0.7}
              >
                <View style={styles.eventCardContent}>
                  <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.eventDate, { color: colors.textSecondary }]}>
                    {formatEventDateTime(item)}
                  </Text>
                  <View style={styles.eventStats}>
                    <View style={styles.eventStat}>
                      <Ionicons name="ticket-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.eventStatText, { color: colors.textMuted }]}>
                        {item.ticketsSold} sold
                      </Text>
                    </View>
                    <View style={styles.eventStat}>
                      <Ionicons name="scan-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.eventStatText, { color: colors.textMuted }]}>
                        {item.ticketsScanned ?? 0} scanned
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
        </View>
      </StarBackground>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        {/* Top section: Header + Scan area */}
        <View style={styles.topSection}>
          {/* Header with selected event */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.eventSelector}
              onPress={() => {
                setSelectedEvent(null);
                setRecentScans([]);
                lastScannedRef.current = '';
              }}
              activeOpacity={0.7}
            >
              <View style={styles.eventSelectorContent}>
                <Text style={styles.headerTitle} numberOfLines={1}>{selectedEvent.name}</Text>
                <Text style={styles.headerSubtitle}>
                  {selectedEvent.ticketsScanned ?? 0}/{selectedEvent.ticketsSold} scanned · Tap to change
                </Text>
              </View>
              <Ionicons name="swap-horizontal" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Scan area indicator */}
          <View style={styles.scanAreaContainer}>
            <View style={styles.scanArea}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanHint}>
              {processing ? 'Verifying...' : 'Point camera at ticket QR code'}
            </Text>
          </View>

          {/* Result overlay */}
          {lastScan && (
            <Animated.View
              style={[
                styles.resultCard,
                {
                  opacity: resultAnim,
                  transform: [{
                    translateY: resultAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  }],
                  backgroundColor: lastScan.valid ? '#065F46' : '#7F1D1D',
                  borderColor: lastScan.valid ? '#10B981' : '#EF4444',
                },
              ]}
            >
              <Ionicons
                name={lastScan.valid ? 'checkmark-circle' : 'close-circle'}
                size={32}
                color={lastScan.valid ? '#10B981' : '#EF4444'}
              />
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle}>
                  {lastScan.valid ? 'Valid Ticket' : 'Invalid'}
                </Text>
                <Text style={styles.resultMessage}>
                  {lastScan.message}
                </Text>
                {lastScan.customerName && (
                  <Text style={styles.resultDetail}>
                    {lastScan.customerName}
                  </Text>
                )}
                {lastScan.tierName && lastScan.tierName !== 'Unknown' && (
                  <Text style={styles.resultDetail}>
                    {lastScan.tierName}
                  </Text>
                )}
                {lastScan.ticketEvent && (
                  <Text style={styles.resultDetail}>
                    Ticket is for: {lastScan.ticketEvent}
                  </Text>
                )}
              </View>
            </Animated.View>
          )}
        </View>

        {/* Recent scans - always visible at bottom */}
        <View style={[styles.recentContainer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.recentTitle}>
            Recent Scans {recentScans.length > 0 ? `(${recentScans.length})` : ''}
          </Text>
          {loadingScans ? (
            <View style={styles.emptyScans}>
              <Text style={styles.emptyScansText}>Loading scans...</Text>
            </View>
          ) : recentScans.length === 0 ? (
            <View style={styles.emptyScans}>
              <Text style={styles.emptyScansText}>No scans yet</Text>
            </View>
          ) : (
            <FlatList
              data={recentScans.slice(0, 5)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.recentItem}>
                  <Ionicons
                    name={item.valid ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={item.valid ? '#10B981' : '#EF4444'}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.recentName}>
                      {item.customerName || item.message}
                    </Text>
                    <Text style={styles.recentMeta}>
                      {item.tierName} — {item.timestamp.toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              )}
              scrollEnabled={false}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Empty state styles (shared)
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
  // Skeleton loading styles
  skeletonContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  skeletonContent: {
    gap: 12,
  },
  skeletonTitle: {
    height: 18,
    width: '60%',
    borderRadius: 8,
  },
  skeletonSubtitle: {
    height: 14,
    width: '40%',
    borderRadius: 6,
  },
  skeletonStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  skeletonStat: {
    height: 12,
    width: 70,
    borderRadius: 6,
  },
  // Pro gate styles
  proGateContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  proFeaturesCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 32,
    gap: 16,
  },
  proFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proFeatureText: {
    fontSize: 15,
    flex: 1,
  },
  // Buttons
  upgradeButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 24,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Event selection styles
  selectHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  selectTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  eventList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  eventCardContent: {
    flex: 1,
  },
  eventName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    marginBottom: 8,
  },
  eventStats: {
    flexDirection: 'row',
    gap: 16,
  },
  eventStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventStatText: {
    fontSize: 13,
  },
  // Scanner overlay styles
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topSection: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  eventSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  eventSelectorContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  scanAreaContainer: {
    alignItems: 'center',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#2563EB',
    borderWidth: 3,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  resultMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  resultDetail: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  recentContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  recentTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  recentName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  recentMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  emptyScans: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyScansText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
});

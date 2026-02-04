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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { eventsApi, type EventScanResult, type OrgEvent, type RecentScan } from '../lib/api';
import { useQuery } from '@tanstack/react-query';

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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { subscription } = useAuth();
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

  // Pro gate
  if (!isPro) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color={colors.textMuted} />
          <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>
            Pro Feature
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Upgrade to Pro to scan event tickets
          </Text>
        </View>
      </View>
    );
  }

  // Camera not available
  if (!CameraView) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>
            Camera Not Available
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Install expo-camera to enable QR scanning
          </Text>
        </View>
      </View>
    );
  }

  // Permission not granted
  if (!permission?.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>
            Camera Access Required
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, marginBottom: 24 }]}>
            Allow camera access to scan ticket QR codes
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

  // Event selection screen
  if (!selectedEvent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.selectHeader}>
          <Text style={[styles.selectTitle, { color: colors.text }]}>Select Event</Text>
          <Text style={[styles.selectSubtitle, { color: colors.textSecondary }]}>
            Choose an event to scan tickets for
          </Text>
        </View>

        {eventsLoading ? (
          <View style={styles.center}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Loading events...</Text>
          </View>
        ) : eventsError ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>
              Failed to Load Events
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {(eventsError as Error)?.message || 'Unknown error'}
            </Text>
          </View>
        ) : activeEvents.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>
              No Active Events
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You don't have any published events to scan tickets for.
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Event selection styles
  selectHeader: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  selectTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
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

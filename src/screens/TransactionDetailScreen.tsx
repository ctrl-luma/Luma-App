import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { StarBackground } from '../components/StarBackground';
import { transactionsApi } from '../lib/api';
import { glass } from '../lib/colors';
import { fonts } from '../lib/fonts';
import { shadows } from '../lib/shadows';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Star component for Apple-style sparkle effect
function Star({ style, size = 8, color = 'rgba(255,255,255,0.8)' }: { style?: any; size?: number; color?: string }) {
  return (
    <View style={[{ position: 'absolute' }, style]}>
      <View style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: size / 2,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: size * 1.5,
      }} />
    </View>
  );
}

// Four-point star for larger sparkles
function FourPointStar({ style, size = 16, color = 'rgba(255,255,255,0.9)' }: { style?: any; size?: number; color?: string }) {
  return (
    <View style={[{ position: 'absolute', width: size, height: size }, style]}>
      <View style={{
        position: 'absolute',
        left: size / 2 - 1,
        top: 0,
        width: 2,
        height: size,
        backgroundColor: color,
        borderRadius: 1,
      }} />
      <View style={{
        position: 'absolute',
        top: size / 2 - 1,
        left: 0,
        width: size,
        height: 2,
        backgroundColor: color,
        borderRadius: 1,
      }} />
      <View style={{
        position: 'absolute',
        left: size / 2 - 2,
        top: size / 2 - 2,
        width: 4,
        height: 4,
        backgroundColor: color,
        borderRadius: 2,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: size / 2,
      }} />
    </View>
  );
}

// Central glowing star for loading
function GlowingStar({ size = 32, color, glowColor, pulseAnim }: { size?: number; color: string; glowColor: string; pulseAnim: Animated.Value }) {
  return (
    <Animated.View style={{
      width: size * 2,
      height: size * 2,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: pulseAnim,
      transform: [{ scale: pulseAnim }],
    }}>
      <View style={{
        position: 'absolute',
        width: size * 1.5,
        height: size * 1.5,
        borderRadius: size,
        backgroundColor: glowColor,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: size,
      }} />
      <View style={{
        position: 'absolute',
        width: 3,
        height: size,
        backgroundColor: color,
        borderRadius: 1.5,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
      }} />
      <View style={{
        position: 'absolute',
        width: size,
        height: 3,
        backgroundColor: color,
        borderRadius: 1.5,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
      }} />
      <View style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
      }} />
    </Animated.View>
  );
}

// Loading component with stars
function LoadingWithStars({ colors, isDark }: { colors: any; isDark: boolean }) {
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const starColor = isDark ? '#fff' : colors.primary;
  const glowColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(99,102,241,0.2)';

  return (
    <Animated.View style={[starLoadingStyles.container, { backgroundColor: isDark ? '#09090b' : colors.background, opacity: fadeAnim }]}>
      <LinearGradient
        colors={isDark
          ? ['transparent', 'rgba(99, 102, 241, 0.08)', 'rgba(139, 92, 246, 0.05)', 'transparent']
          : ['transparent', 'rgba(99, 102, 241, 0.05)', 'rgba(139, 92, 246, 0.03)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sparkleAnim }]}>
        <FourPointStar style={{ top: 40, left: 30 }} size={14} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(99,102,241,0.4)'} />
        <Star style={{ top: 80, left: 70 }} size={4} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
        <Star style={{ top: 60, right: 50 }} size={6} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(139,92,246,0.35)'} />
        <FourPointStar style={{ top: 100, right: 35 }} size={12} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
        <Star style={{ top: 130, left: 45 }} size={3} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(139,92,246,0.25)'} />
        <Star style={{ top: 70, left: SCREEN_WIDTH * 0.45 }} size={5} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(99,102,241,0.3)'} />
        <Star style={{ top: 150, right: 80 }} size={4} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(139,92,246,0.25)'} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, sparkleAnim) }]}>
        <Star style={{ top: 50, left: 50 }} size={5} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(99,102,241,0.3)'} />
        <FourPointStar style={{ top: 85, right: 40 }} size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(139,92,246,0.35)'} />
        <Star style={{ top: 120, left: 30 }} size={4} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(99,102,241,0.25)'} />
        <Star style={{ top: 75, left: SCREEN_WIDTH * 0.55 }} size={6} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(139,92,246,0.3)'} />
        <FourPointStar style={{ top: 35, right: 90 }} size={10} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.25)'} />
        <Star style={{ top: 140, right: 55 }} size={3} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(139,92,246,0.25)'} />
        <Star style={{ top: 95, left: 90 }} size={5} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(99,102,241,0.3)'} />
      </Animated.View>

      <View style={starLoadingStyles.content}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <GlowingStar size={36} color={starColor} glowColor={glowColor} pulseAnim={pulseAnim} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const starLoadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 10,
  },
});

type RouteParams = {
  TransactionDetail: { id: string };
};

export function TransactionDetailScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'TransactionDetail'>>();
  const glassColors = isDark ? glass.dark : glass.light;
  const queryClient = useQueryClient();

  const { id } = route.params;

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState({ title: '', message: '', isError: false });

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionsApi.get(id),
  });

  const refundMutation = useMutation({
    mutationFn: () => transactionsApi.refund(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowRefundModal(false);
      setResultMessage({ title: 'Success', message: 'Refund processed successfully', isError: false });
      setShowResultModal(true);
    },
    onError: (error: any) => {
      setShowRefundModal(false);
      setResultMessage({ title: 'Error', message: error.message || 'Failed to process refund', isError: true });
      setShowResultModal(true);
    },
  });

  const handleRefund = () => {
    setShowRefundModal(true);
  };

  const confirmRefund = () => {
    refundMutation.mutate();
  };

  const handleViewReceipt = () => {
    if (transaction?.receiptUrl) {
      Linking.openURL(transaction.receiptUrl);
    }
  };

  const styles = createStyles(colors, glassColors);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return colors.success;
      case 'refunded':
      case 'partially_refunded':
        return colors.warning;
      case 'failed':
        return colors.error;
      default:
        return colors.textMuted;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingWithStars colors={colors} isDark={isDark} />
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canRefund =
    transaction.status === 'succeeded' && transaction.amountRefunded === 0;

  return (
    <StarBackground colors={colors} isDark={isDark}>
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amount}>
            ${(transaction.amount / 100).toFixed(2)}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(transaction.status) + '20' },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(transaction.status) },
              ]}
            />
            <Text
              style={[styles.statusText, { color: getStatusColor(transaction.status) }]}
            >
              {transaction.status.charAt(0).toUpperCase() +
                transaction.status.slice(1).replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(transaction.created)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction ID</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {transaction.id}
            </Text>
          </View>

          {transaction.description && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{transaction.description}</Text>
            </View>
          )}

          {transaction.paymentMethod && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>
                {transaction.paymentMethod.brand?.toUpperCase() || 'Card'} ****
                {transaction.paymentMethod.last4}
              </Text>
            </View>
          )}

          {transaction.customerEmail && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Customer Email</Text>
              <Text style={styles.detailValue}>{transaction.customerEmail}</Text>
            </View>
          )}

          {transaction.amountRefunded > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount Refunded</Text>
              <Text style={[styles.detailValue, { color: colors.warning }]}>
                ${(transaction.amountRefunded / 100).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Refunds Section */}
        {transaction.refunds && transaction.refunds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Refund History</Text>
            {transaction.refunds.map((refund) => (
              <View key={refund.id} style={styles.refundItem}>
                <View>
                  <Text style={styles.refundAmount}>
                    -${(refund.amount / 100).toFixed(2)}
                  </Text>
                  <Text style={styles.refundDate}>
                    {formatDate(refund.created)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.refundStatus,
                    { color: refund.status === 'succeeded' ? colors.success : colors.warning },
                  ]}
                >
                  {refund.status}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {transaction.receiptUrl && (
            <TouchableOpacity style={styles.actionButton} onPress={handleViewReceipt}>
              <Ionicons name="receipt-outline" size={20} color={colors.text} />
              <Text style={styles.actionButtonText}>View Receipt</Text>
            </TouchableOpacity>
          )}

          {canRefund && (
            <TouchableOpacity
              style={[styles.actionButton, styles.refundButton]}
              onPress={handleRefund}
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons name="arrow-undo-outline" size={20} color={colors.error} />
                  <Text style={[styles.actionButtonText, { color: colors.error }]}>
                    Issue Refund
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Refund Confirmation Modal */}
      <Modal
        visible={showRefundModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRefundModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="arrow-undo" size={32} color={colors.error} />
            </View>
            <Text style={styles.modalTitle}>Issue Refund</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to refund this transaction? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowRefundModal(false)}
                disabled={refundMutation.isPending}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDestructive]}
                onPress={confirmRefund}
                disabled={refundMutation.isPending}
              >
                {refundMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonDestructiveText}>Refund</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      <Modal
        visible={showResultModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: resultMessage.isError ? colors.errorBg : colors.successBg }]}>
              <Ionicons
                name={resultMessage.isError ? 'close-circle' : 'checkmark-circle'}
                size={32}
                color={resultMessage.isError ? colors.error : colors.success}
              />
            </View>
            <Text style={styles.modalTitle}>{resultMessage.title}</Text>
            <Text style={styles.modalMessage}>{resultMessage.message}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary, { marginTop: 20, flex: 0, width: '100%' }]}
              onPress={() => setShowResultModal(false)}
            >
              <Text style={styles.modalButtonPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </StarBackground>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 56,
      paddingHorizontal: 16,
      backgroundColor: glassColors.backgroundSubtle,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.borderSubtle,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: glassColors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    amountCard: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    amountLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    amount: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '500',
    },
    section: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    detailLabel: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    detailValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
      maxWidth: '60%',
      textAlign: 'right',
    },
    refundItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    refundAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.warning,
    },
    refundDate: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    refundStatus: {
      fontSize: 13,
      fontWeight: '500',
    },
    actions: {
      padding: 20,
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    refundButton: {
      backgroundColor: colors.errorBg,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
    },
    modalIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.errorBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    modalMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    modalButtons: {
      flexDirection: 'row',
      marginTop: 24,
      gap: 12,
      width: '100%',
    },
    modalButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    modalButtonCancel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalButtonCancelText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    modalButtonDestructive: {
      backgroundColor: colors.errorBg,
    },
    modalButtonDestructiveText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.error,
    },
    modalButtonPrimary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalButtonPrimaryText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.text,
    },
  });
};

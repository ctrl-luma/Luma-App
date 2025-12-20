import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../context/ThemeContext';
import { transactionsApi } from '../lib/api';

type RouteParams = {
  TransactionDetail: { id: string };
};

export function TransactionDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'TransactionDetail'>>();
  const queryClient = useQueryClient();

  const { id } = route.params;

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionsApi.get(id),
  });

  const refundMutation = useMutation({
    mutationFn: () => transactionsApi.refund(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      Alert.alert('Success', 'Refund processed successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to process refund');
    },
  });

  const handleRefund = () => {
    Alert.alert(
      'Issue Refund',
      'Are you sure you want to refund this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: () => refundMutation.mutate(),
        },
      ]
    );
  };

  const handleViewReceipt = () => {
    if (transaction?.receiptUrl) {
      Linking.openURL(transaction.receiptUrl);
    }
  };

  const styles = createStyles(colors);

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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
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
  });

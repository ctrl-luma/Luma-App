import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { transactionsApi, Transaction } from '../lib/api';
import { glass } from '../lib/colors';
import { fonts } from '../lib/fonts';
import { shadows } from '../lib/shadows';

type FilterType = 'all' | 'succeeded' | 'refunded' | 'failed';

// Animated transaction item component
function AnimatedTransactionItem({
  item,
  onPress,
  colors,
  styles,
  getStatusColor,
  getStatusLabel,
  formatDate,
}: {
  item: Transaction;
  onPress: () => void;
  colors: any;
  styles: any;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  formatDate: (timestamp: number) => string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 150,
      friction: 10,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 8,
    }).start();
  }, [scaleAnim]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.transactionItem, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.transactionLeft}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          />
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionAmount}>
              ${(item.amount / 100).toFixed(2)}
            </Text>
            <Text style={styles.transactionMeta}>
              {item.paymentMethod
                ? `${item.paymentMethod.brand?.toUpperCase() || 'Card'} ****${item.paymentMethod.last4}`
                : 'Card payment'}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={styles.transactionDate}>{formatDate(item.created)}</Text>
          <Text style={[styles.statusBadge, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Animated.View>
    </Pressable>
  );
}

export function TransactionsScreen() {
  const { colors, isDark } = useTheme();
  const { selectedCatalog } = useCatalog();
  const navigation = useNavigation<any>();
  const glassColors = isDark ? glass.dark : glass.light;
  const [filter, setFilter] = useState<FilterType>('all');

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['transactions', selectedCatalog?.id],
    queryFn: ({ pageParam }) =>
      transactionsApi.list({
        limit: 25,
        starting_after: pageParam,
        catalog_id: selectedCatalog?.id,
      }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.data.length === 0) return undefined;
      return lastPage.data[lastPage.data.length - 1].id;
    },
    initialPageParam: undefined as string | undefined,
  });

  // Get all transactions and apply client-side filter
  const allTransactions = data?.pages.flatMap((page) => page.data) || [];
  const transactions = allTransactions.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'succeeded') return t.status === 'succeeded';
    if (filter === 'refunded') return t.status === 'refunded' || t.status === 'partially_refunded';
    if (filter === 'failed') return t.status === 'failed';
    return true;
  });

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'Succeeded';
      case 'refunded':
        return 'Refunded';
      case 'partially_refunded':
        return 'Partial Refund';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <AnimatedTransactionItem
      item={item}
      onPress={() => navigation.navigate('TransactionDetail', { id: item.id })}
      colors={colors}
      styles={styles}
      getStatusColor={getStatusColor}
      getStatusLabel={getStatusLabel}
      formatDate={formatDate}
    />
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'succeeded', 'refunded', 'failed'] as FilterType[]).map((f) => {
          const isActive = filter === f;
          const filterColors = {
            all: { bg: colors.primary + '20', border: colors.primary + '40', text: colors.primary },
            succeeded: { bg: colors.success + '20', border: colors.success + '40', text: colors.success },
            refunded: { bg: colors.warning + '20', border: colors.warning + '40', text: colors.warning },
            failed: { bg: colors.error + '20', border: colors.error + '40', text: colors.error },
          };
          const colorSet = filterColors[f];

          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterTab,
                isActive && { backgroundColor: colorSet.bg, borderColor: colorSet.border },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterText,
                  isActive && { color: colorSet.text, fontFamily: fonts.semiBold },
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={styles.skeletonItem}>
              <View style={styles.skeletonLeft}>
                <View style={styles.skeletonDot} />
                <View style={styles.skeletonInfo}>
                  <View style={[styles.skeletonBox, { width: 80, height: 20 }]} />
                  <View style={[styles.skeletonBox, { width: 120, height: 14, marginTop: 6 }]} />
                </View>
              </View>
              <View style={styles.skeletonRight}>
                <View style={[styles.skeletonBox, { width: 50, height: 14 }]} />
                <View style={[styles.skeletonBox, { width: 70, height: 12, marginTop: 6 }]} />
              </View>
            </View>
          ))}
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No transactions</Text>
          <Text style={styles.emptyText}>
            Transactions will appear here after you accept payments
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      paddingHorizontal: 16,
      backgroundColor: glassColors.backgroundSubtle,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.borderSubtle,
    },
    title: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    filterContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      backgroundColor: glassColors.backgroundSubtle,
    },
    filterTab: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: glassColors.backgroundElevated,
      borderWidth: 1.5,
      borderColor: glassColors.border,
    },
    filterText: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    list: {
      padding: 16,
      paddingTop: 12,
      paddingBottom: 20,
    },
    transactionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 16,
      marginBottom: 12,
      ...shadows.sm,
    },
    transactionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    statusIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 14,
    },
    transactionInfo: {
      flex: 1,
    },
    transactionAmount: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 4,
    },
    transactionMeta: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textMuted,
    },
    transactionRight: {
      alignItems: 'flex-end',
      marginRight: 10,
    },
    transactionDate: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    statusBadge: {
      fontSize: 12,
      fontFamily: fonts.medium,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: fonts.bold,
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footerLoader: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    // Skeleton styles
    skeletonList: {
      padding: 16,
      paddingTop: 12,
    },
    skeletonItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      padding: 16,
      marginBottom: 12,
    },
    skeletonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    skeletonDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: glassColors.background,
      marginRight: 14,
    },
    skeletonInfo: {
      flex: 1,
    },
    skeletonRight: {
      alignItems: 'flex-end',
    },
    skeletonBox: {
      backgroundColor: glassColors.background,
      borderRadius: 6,
    },
  });
};

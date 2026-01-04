import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Platform,
  Animated,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import { useSocketEvent, SocketEvents } from '../context/SocketContext';
import { productsApi, Product, categoriesApi, Category, CatalogLayoutType } from '../lib/api';
import { openVendorDashboard } from '../lib/auth-handoff';

const isWeb = Platform.OS === 'web';

// Layout configurations for catalog layout types
const GRID_PADDING = 16; // Padding on left and right of the list
const GRID_GAP = 12; // Gap between cards

const getLayoutConfig = (layoutType: CatalogLayoutType, screenWidth: number) => {
  switch (layoutType) {
    case 'list':
      return { numColumns: 1, cardWidth: screenWidth - (GRID_PADDING * 2) }; // Full width minus padding
    case 'large-grid':
      return { numColumns: 1, cardWidth: screenWidth - (GRID_PADDING * 2) }; // Single column large tiles
    case 'compact':
      return { numColumns: 1, cardWidth: screenWidth - (GRID_PADDING * 2) }; // Minimal text-based list
    case 'grid':
    default:
      // Responsive grid configuration
      if (isWeb && screenWidth >= 1024) {
        return { numColumns: 4, cardWidth: 240 };
      } else if (isWeb && screenWidth >= 768) {
        return { numColumns: 3, cardWidth: 220 };
      } else if (screenWidth >= 600) {
        const numColumns = 3;
        const totalGaps = (numColumns - 1) * GRID_GAP;
        const cardWidth = (screenWidth - (GRID_PADDING * 2) - totalGaps) / numColumns;
        return { numColumns, cardWidth };
      }
      // Mobile: 2 columns
      // Available width = screenWidth - (padding left + padding right) - gap between cards
      const numColumns = 2;
      const totalGaps = (numColumns - 1) * GRID_GAP;
      const cardWidth = (screenWidth - (GRID_PADDING * 2) - totalGaps) / numColumns;
      return { numColumns, cardWidth };
  }
};

// Floating Category Pill Component
interface CategoryPillProps {
  label: string;
  count?: number;
  isActive: boolean;
  onPress: () => void;
  colors: any;
}

function CategoryPill({ label, count, isActive, onPress, colors }: CategoryPillProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const pillStyles = StyleSheet.create({
    container: {
      marginRight: 10,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: isActive ? colors.primary : colors.card,
      borderWidth: 1,
      borderColor: isActive ? colors.primary : colors.cardBorder,
      ...Platform.select({
        ios: {
          shadowColor: isActive ? colors.primary : '#000',
          shadowOffset: { width: 0, height: isActive ? 4 : 2 },
          shadowOpacity: isActive ? 0.4 : 0.15,
          shadowRadius: isActive ? 12 : 6,
        },
        android: {
          elevation: isActive ? 8 : 3,
        },
        web: {
          boxShadow: isActive
            ? `0 4px 20px ${colors.primary}50`
            : '0 2px 8px rgba(0,0,0,0.2)',
        },
      }),
    },
    label: {
      fontSize: 15,
      fontWeight: isActive ? '700' : '500',
      color: isActive ? '#fff' : colors.textSecondary,
      letterSpacing: 0.3,
    },
    countBadge: {
      marginLeft: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.surface,
      minWidth: 24,
      alignItems: 'center',
    },
    countText: {
      fontSize: 12,
      fontWeight: '600',
      color: isActive ? '#fff' : colors.textMuted,
    },
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={pillStyles.container}
    >
      <Animated.View style={[pillStyles.pill, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={pillStyles.label}>{label}</Text>
        {count !== undefined && count > 0 && (
          <View style={pillStyles.countBadge}>
            <Text style={pillStyles.countText}>{count}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function MenuScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { selectedCatalog } = useCatalog();
  const { addItem, getItemQuantity, itemCount } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  const {
    data: products,
    isLoading: productsLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['products', selectedCatalog?.id],
    queryFn: () => productsApi.list(selectedCatalog!.id),
    enabled: !!selectedCatalog,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', selectedCatalog?.id],
    queryFn: () => categoriesApi.list(selectedCatalog!.id),
    enabled: !!selectedCatalog,
  });

  // Listen for real-time updates to products and categories
  // Use refetchQueries instead of invalidateQueries for immediate updates (bypasses stale time)
  const handleProductsUpdate = useCallback(() => {
    if (selectedCatalog) {
      queryClient.refetchQueries({ queryKey: ['products', selectedCatalog.id], type: 'active' });
    }
  }, [queryClient, selectedCatalog]);

  const handleCategoriesUpdate = useCallback(() => {
    if (selectedCatalog) {
      queryClient.refetchQueries({ queryKey: ['categories', selectedCatalog.id], type: 'active' });
    }
  }, [queryClient, selectedCatalog]);

  // Subscribe to socket events for real-time updates
  // CATALOG_UPDATED is also triggered when catalog products are changed (add/update/remove)
  useSocketEvent(SocketEvents.PRODUCT_CREATED, handleProductsUpdate);
  useSocketEvent(SocketEvents.PRODUCT_UPDATED, handleProductsUpdate);
  useSocketEvent(SocketEvents.PRODUCT_DELETED, handleProductsUpdate);
  useSocketEvent(SocketEvents.CATALOG_UPDATED, handleProductsUpdate); // Catalog product changes emit this
  useSocketEvent(SocketEvents.CATEGORY_CREATED, handleCategoriesUpdate);
  useSocketEvent(SocketEvents.CATEGORY_UPDATED, handleCategoriesUpdate);
  useSocketEvent(SocketEvents.CATEGORY_DELETED, handleCategoriesUpdate);

  // Filter active products and by category
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let filtered = products.filter((p) => p.isActive);
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.categoryId === selectedCategory);
    }
    return filtered;
  }, [products, selectedCategory]);

  // Get categories that have products, sorted by sortOrder
  const activeCategories = useMemo(() => {
    if (!categories || !products) return [];
    const productCategoryIds = new Set(products.filter(p => p.isActive).map((p) => p.categoryId).filter(Boolean));
    return categories
      .filter((c) => c.isActive && productCategoryIds.has(c.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, products]);

  // Count products per category (only active products)
  const productCountByCategory = useMemo(() => {
    if (!products) return new Map<string | null, number>();
    const counts = new Map<string | null, number>();
    const activeProducts = products.filter(p => p.isActive);

    // Count all products
    counts.set(null, activeProducts.length);

    // Count per category
    activeProducts.forEach((p) => {
      const categoryId = p.categoryId || 'uncategorized';
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    });

    return counts;
  }, [products]);

  // Get the layout type from the catalog (layout is per-catalog, not per-category)
  const currentLayoutType: CatalogLayoutType = useMemo(() => {
    return selectedCatalog?.layoutType || 'grid';
  }, [selectedCatalog]);

  // Get layout configuration for current layout type (responsive to screen width changes)
  const { numColumns, cardWidth } = useMemo(
    () => getLayoutConfig(currentLayoutType, screenWidth),
    [currentLayoutType, screenWidth]
  );

  const handleAddToCart = (product: Product) => {
    addItem(product);
  };

  const styles = createStyles(colors, cardWidth, currentLayoutType);

  // Render product card based on layout type
  const renderProduct = ({ item }: { item: Product }) => {
    const quantity = getItemQuantity(item.id);

    // List layout - horizontal card with image on left
    if (currentLayoutType === 'list') {
      return (
        <TouchableOpacity
          style={styles.listCard}
          onPress={() => handleAddToCart(item)}
          activeOpacity={0.8}
        >
          <View style={styles.listImageContainer}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.listImage} />
            ) : (
              <View style={styles.listImagePlaceholder}>
                <Ionicons name="image-outline" size={24} color={colors.textMuted} />
              </View>
            )}
            {quantity > 0 && (
              <View style={styles.listQuantityBadge}>
                <Text style={styles.quantityText}>{quantity}</Text>
              </View>
            )}
          </View>
          <View style={styles.listInfo}>
            <Text style={styles.listName} numberOfLines={2}>
              {item.name}
            </Text>
            {item.description && (
              <Text style={styles.listDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <Text style={styles.listPrice}>
              ${(item.price / 100).toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.listAddButton}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }

    // Large grid layout - single column large tiles
    if (currentLayoutType === 'large-grid') {
      return (
        <TouchableOpacity
          style={styles.largeCard}
          onPress={() => handleAddToCart(item)}
          activeOpacity={0.8}
        >
          <View style={styles.largeImageContainer}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.largeImage} />
            ) : (
              <View style={styles.largeImagePlaceholder}>
                <Ionicons name="image-outline" size={48} color={colors.textMuted} />
              </View>
            )}
            {quantity > 0 && (
              <View style={styles.largeQuantityBadge}>
                <Text style={styles.largeQuantityText}>{quantity}</Text>
              </View>
            )}
          </View>
          <View style={styles.largeInfo}>
            <View style={styles.largeTextContainer}>
              <Text style={styles.largeName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={styles.largeDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </View>
            <View style={styles.largePriceRow}>
              <Text style={styles.largePrice}>
                ${(item.price / 100).toFixed(2)}
              </Text>
              <TouchableOpacity
                style={styles.largeAddButton}
                onPress={() => handleAddToCart(item)}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Compact layout - minimal text-based list
    if (currentLayoutType === 'compact') {
      return (
        <TouchableOpacity
          style={styles.compactCard}
          onPress={() => handleAddToCart(item)}
          activeOpacity={0.8}
        >
          <View style={styles.compactInfo}>
            <Text style={styles.compactName} numberOfLines={1}>
              {item.name}
            </Text>
            {quantity > 0 && (
              <View style={styles.compactQuantityBadge}>
                <Text style={styles.compactQuantityText}>{quantity}</Text>
              </View>
            )}
          </View>
          <Text style={styles.compactPrice}>
            ${(item.price / 100).toFixed(2)}
          </Text>
          <TouchableOpacity
            style={styles.compactAddButton}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }

    // Default grid layout
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => handleAddToCart(item)}
        activeOpacity={0.8}
      >
        <View style={styles.productImageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="image-outline" size={32} color={colors.textMuted} />
            </View>
          )}
          {quantity > 0 && (
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityText}>{quantity}</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.productPrice}>
            ${(item.price / 100).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddToCart(item)}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (!selectedCatalog) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No catalog selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (productsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.catalogName}>{selectedCatalog.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => navigation.navigate('Cart')}
        >
          <Ionicons name="cart-outline" size={20} color={colors.text} />
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Pills */}
      {activeCategories.length > 0 && (
        <View style={styles.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContainer}
          >
            <CategoryPill
              label="All"
              count={productCountByCategory.get(null)}
              isActive={!selectedCategory}
              onPress={() => setSelectedCategory(null)}
              colors={colors}
            />
            {activeCategories.map((category) => (
              <CategoryPill
                key={category.id}
                label={category.name}
                count={productCountByCategory.get(category.id)}
                isActive={selectedCategory === category.id}
                onPress={() => setSelectedCategory(category.id)}
                colors={colors}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Products Grid/List */}
      {filteredProducts.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No products available</Text>
          <Text style={styles.emptySubtext}>
            Add products to this catalog in the Vendor Portal
          </Text>
          <TouchableOpacity
            style={[styles.vendorPortalButton, { backgroundColor: colors.primary }]}
            onPress={openVendorDashboard}
          >
            <Ionicons name="storefront" size={18} color="#fff" />
            <Text style={styles.vendorPortalButtonText}>Open Vendor Portal</Text>
            <Ionicons name="open-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={`${currentLayoutType}-${numColumns}`} // Force re-render when layout changes
          contentContainerStyle={styles.productList}
          columnWrapperStyle={numColumns > 1 ? styles.productRow : undefined}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, cardWidth: number, layoutType: CatalogLayoutType) =>
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
      height: 56,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flex: 1,
    },
    catalogName: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    cartButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cartBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    cartBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    categorySection: {
      paddingVertical: 8,
      marginBottom: 8,
    },
    categoryScroll: {
      flexGrow: 0,
    },
    categoryContainer: {
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    productList: {
      paddingHorizontal: GRID_PADDING,
      paddingTop: 16,
      paddingBottom: 20,
    },
    productRow: {
      justifyContent: 'flex-start',
      gap: GRID_GAP,
    },
    // Grid layout styles
    productCard: {
      width: cardWidth,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: GRID_GAP,
      overflow: 'hidden',
    },
    productImageContainer: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: colors.surface,
    },
    productImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    productImagePlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quantityBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    quantityText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    productInfo: {
      padding: 12,
    },
    productName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    productPrice: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    addButton: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // List layout styles
    listCard: {
      width: cardWidth,
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 12,
      overflow: 'hidden',
      alignItems: 'center',
      padding: 12,
    },
    listImageContainer: {
      width: 80,
      height: 80,
      borderRadius: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    listImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    listImagePlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    listQuantityBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    listInfo: {
      flex: 1,
      marginLeft: 16,
      marginRight: 12,
    },
    listName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    listDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    listPrice: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    listAddButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Large grid layout styles
    largeCard: {
      width: cardWidth,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 16,
      overflow: 'hidden',
    },
    largeImageContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: colors.surface,
    },
    largeImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    largeImagePlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    largeQuantityBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: colors.primary,
      borderRadius: 14,
      minWidth: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    largeQuantityText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    largeInfo: {
      padding: 16,
    },
    largeTextContainer: {
      marginBottom: 12,
    },
    largeName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    largeDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    largePriceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    largePrice: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    largeAddButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Compact layout styles
    compactCard: {
      width: cardWidth,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 6,
    },
    compactInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    compactName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    compactQuantityBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    compactQuantityText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    compactPrice: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
      marginRight: 12,
    },
    compactAddButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
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
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    vendorPortalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 24,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    vendorPortalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });

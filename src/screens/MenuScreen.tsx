import React, { useState, useMemo, useCallback, useRef, memo } from 'react';
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
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent, SocketEvents } from '../context/SocketContext';
import { productsApi, Product, categoriesApi, Category, CatalogLayoutType } from '../lib/api';
import { openVendorDashboard } from '../lib/auth-handoff';
import { SetupRequired } from '../components/SetupRequired';
import { glass } from '../lib/colors';
import { shadows } from '../lib/shadows';

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
  glassColors: typeof glass.dark;
}

function CategoryPill({ label, count, isActive, onPress, colors, glassColors }: CategoryPillProps) {
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
      friction: 5,
      tension: 150,
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
      borderRadius: 20,
      backgroundColor: isActive ? colors.primary : glassColors.backgroundElevated,
      borderWidth: 1,
      borderColor: isActive ? colors.primary : glassColors.border,
      ...Platform.select({
        ios: {
          shadowColor: isActive ? colors.primary : '#000',
          shadowOffset: { width: 0, height: isActive ? 0 : 4 },
          shadowOpacity: isActive ? 0.4 : 0.2,
          shadowRadius: isActive ? 12 : 8,
        },
        android: {
          elevation: isActive ? 8 : 4,
        },
        web: {
          boxShadow: isActive
            ? `0 0 20px ${colors.primary}50`
            : '0 4px 12px rgba(0,0,0,0.25)',
        },
      }),
    },
    label: {
      fontSize: 14,
      fontWeight: isActive ? '700' : '500',
      color: isActive ? '#fff' : colors.text,
      letterSpacing: 0.2,
    },
    countBadge: {
      marginLeft: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : glassColors.background,
      minWidth: 24,
      alignItems: 'center',
    },
    countText: {
      fontSize: 12,
      fontWeight: '600',
      color: isActive ? '#fff' : colors.textSecondary,
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

// Animated pressable wrapper for product cards
const AnimatedPressable = memo(function AnimatedPressable({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
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
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
});

export function MenuScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const glassColors = isDark ? glass.dark : glass.light;
  const { isLoading: authLoading, user, completeOnboarding } = useAuth();
  const { selectedCatalog, catalogs, isLoading: catalogsLoading } = useCatalog();
  const { addItem, getItemQuantity, itemCount, subtotal } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const { width: screenWidth } = useWindowDimensions();

  // Navigate new users to education screen (which now includes Enable step)
  React.useEffect(() => {
    if (user && user.onboardingCompleted === false && !authLoading) {
      // Mark onboarding as complete immediately to prevent re-triggering
      completeOnboarding();
      // Navigate to education screen with the Enable step
      navigation.navigate('TapToPayEducation' as never);
    }
  }, [user, authLoading, completeOnboarding, navigation]);

  const {
    data: products,
    isLoading: productsLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['products', selectedCatalog?.id],
    queryFn: () => productsApi.list(selectedCatalog!.id),
    enabled: !!selectedCatalog,
    staleTime: Infinity, // Never auto-refetch - updates via socket events or pull-to-refresh
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', selectedCatalog?.id],
    queryFn: () => categoriesApi.list(selectedCatalog!.id),
    enabled: !!selectedCatalog,
    staleTime: Infinity, // Never auto-refetch - updates via socket events or pull-to-refresh
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

  // Filter active products by category and search query
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let filtered = products.filter((p) => p.isActive);

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.categoryId === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [products, selectedCategory, searchQuery]);

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

  const styles = createStyles(colors, glassColors, cardWidth, currentLayoutType);

  // Render product card based on layout type
  const renderProduct = ({ item }: { item: Product }) => {
    const quantity = getItemQuantity(item.id);

    // List layout - horizontal card with image on left
    if (currentLayoutType === 'list') {
      return (
        <AnimatedPressable
          style={styles.listCard}
          onPress={() => handleAddToCart(item)}
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
            {item.description ? (
              <Text style={styles.listDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
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
        </AnimatedPressable>
      );
    }

    // Large grid layout - single column large tiles
    if (currentLayoutType === 'large-grid') {
      return (
        <AnimatedPressable
          style={styles.largeCard}
          onPress={() => handleAddToCart(item)}
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
              {item.description ? (
                <Text style={styles.largeDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
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
        </AnimatedPressable>
      );
    }

    // Compact layout - minimal text-based list
    if (currentLayoutType === 'compact') {
      return (
        <AnimatedPressable
          style={styles.compactCard}
          onPress={() => handleAddToCart(item)}
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
        </AnimatedPressable>
      );
    }

    // Default grid layout
    return (
      <AnimatedPressable
        style={styles.productCard}
        onPress={() => handleAddToCart(item)}
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
      </AnimatedPressable>
    );
  };

  // Show skeleton loading while auth or catalogs are being fetched
  if (authLoading || catalogsLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Skeleton Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.skeletonBox, { width: 160, height: 24, borderRadius: 6 }]} />
            <View style={[styles.skeletonBox, { width: 100, height: 14, borderRadius: 4, marginTop: 6 }]} />
          </View>
          <View style={[styles.skeletonBox, { width: 48, height: 48, borderRadius: 16 }]} />
        </View>

        {/* Skeleton Category Pills */}
        <View style={styles.categorySection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContainer}>
            {[80, 100, 90, 85].map((width, i) => (
              <View key={i} style={[styles.skeletonBox, { width, height: 44, borderRadius: 20, marginRight: 10 }]} />
            ))}
          </ScrollView>
        </View>

        {/* Skeleton Product Grid */}
        <View style={[styles.productList, { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={[styles.skeletonBox, { width: (screenWidth - GRID_PADDING * 2 - GRID_GAP) / 2, height: 200, borderRadius: 20 }]} />
          ))}
        </View>
      </View>
    );
  }

  // Show setup guidance if no catalogs exist
  if (catalogs.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <SetupRequired type="no-catalogs" />
      </View>
    );
  }

  if (!selectedCatalog) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No catalog selected</Text>
        </View>
      </View>
    );
  }

  if (productsLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header with catalog name */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.catalogName}>{selectedCatalog.name}</Text>
            {selectedCatalog.location ? (
              <Text style={styles.catalogLocation}>{selectedCatalog.location}</Text>
            ) : null}
          </View>
          <View style={[styles.skeletonBox, { width: 48, height: 48, borderRadius: 16 }]} />
        </View>

        {/* Skeleton Category Pills */}
        <View style={styles.categorySection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContainer}>
            {[80, 100, 90, 85].map((width, i) => (
              <View key={i} style={[styles.skeletonBox, { width, height: 44, borderRadius: 20, marginRight: 10 }]} />
            ))}
          </ScrollView>
        </View>

        {/* Skeleton Product Grid */}
        <View style={[styles.productList, { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={[styles.skeletonBox, { width: (screenWidth - GRID_PADDING * 2 - GRID_GAP) / 2, height: 200, borderRadius: 20 }]} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with glass effect */}
      <View style={styles.header}>
        {isSearching ? (
          // Search mode - show search input
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelSearchButton}
              onPress={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
            >
              <Text style={styles.cancelSearchText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Normal mode - show catalog name and buttons
          <>
            <View style={styles.headerLeft}>
              <Text style={styles.catalogName}>{selectedCatalog.name}</Text>
              {selectedCatalog.location ? (
                <Text style={styles.catalogLocation}>{selectedCatalog.location}</Text>
              ) : null}
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => {
                  setIsSearching(true);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="search" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cartButton, itemCount === 0 && styles.cartButtonDisabled]}
                onPress={() => {
                  if (itemCount > 0) {
                    navigation.navigate('Checkout', { total: subtotal });
                  }
                }}
                activeOpacity={itemCount > 0 ? 0.8 : 1}
              >
                <Ionicons
                  name="cart-outline"
                  size={22}
                  color={itemCount > 0 ? colors.text : colors.textMuted}
                />
                {itemCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{itemCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
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
              glassColors={glassColors}
            />
            {activeCategories.map((category) => (
              <CategoryPill
                key={category.id}
                label={category.name}
                count={productCountByCategory.get(category.id)}
                isActive={selectedCategory === category.id}
                onPress={() => setSelectedCategory(category.id)}
                colors={colors}
                glassColors={glassColors}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search Results Count */}
      {searchQuery.trim() ? (
        <View style={styles.searchResultsBar}>
          <Text style={styles.searchResultsText}>
            {filteredProducts.length === 0
              ? 'No results'
              : `${filteredProducts.length} result${filteredProducts.length === 1 ? '' : 's'}`}
            {' for "'}
            <Text style={styles.searchQueryText}>{searchQuery}</Text>
            {'"'}
          </Text>
        </View>
      ) : null}

      {/* Products Grid/List */}
      {filteredProducts.length === 0 ? (
        <View style={styles.centered}>
          {searchQuery.trim() ? (
            // No search results
            <>
              <Ionicons name="search-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySubtext}>
                Try a different search term
              </Text>
              <TouchableOpacity
                style={[styles.clearSearchButton, { borderColor: colors.primary }]}
                onPress={() => setSearchQuery('')}
              >
                <Text style={[styles.clearSearchButtonText, { color: colors.primary }]}>
                  Clear Search
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            // No products in catalog
            <>
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
            </>
          )}
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

    </View>
  );
}

const createStyles = (colors: any, glassColors: typeof glass.dark, cardWidth: number, layoutType: CatalogLayoutType) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: glassColors.backgroundSubtle,
      borderBottomWidth: 1,
      borderBottomColor: glassColors.borderSubtle,
    },
    headerLeft: {
      flex: 1,
    },
    catalogName: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    catalogLocation: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 2,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: glassColors.backgroundElevated,
      borderWidth: 1,
      borderColor: glassColors.border,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    searchContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: glassColors.border,
      paddingHorizontal: 12,
      height: 44,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingVertical: 8,
    },
    cancelSearchButton: {
      paddingLeft: 8,
    },
    cancelSearchText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.primary,
    },
    cartButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: glassColors.backgroundElevated,
      borderWidth: 1,
      borderColor: glassColors.border,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    cartButtonDisabled: {
      opacity: 0.5,
    },
    cartBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.primary,
      borderRadius: 12,
      minWidth: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      borderWidth: 2,
      borderColor: colors.background,
      ...shadows.sm,
    },
    cartBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    categorySection: {
      paddingVertical: 4,
      marginBottom: 4,
    },
    categoryScroll: {
      flexGrow: 0,
    },
    categoryContainer: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    productList: {
      paddingHorizontal: GRID_PADDING,
      paddingTop: 12,
      paddingBottom: 120, // Extra padding for floating tab bar
    },
    productRow: {
      justifyContent: 'flex-start',
      gap: GRID_GAP,
    },
    // Grid layout styles with glass effect
    productCard: {
      width: cardWidth,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      marginBottom: GRID_GAP,
      overflow: 'hidden',
      ...shadows.md,
    },
    productImageContainer: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: glassColors.background,
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
      backgroundColor: glassColors.backgroundSubtle,
    },
    quantityBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: colors.primary,
      borderRadius: 14,
      minWidth: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderWidth: 2,
      borderColor: 'rgba(0,0,0,0.2)',
      ...shadows.sm,
    },
    quantityText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    productInfo: {
      padding: 14,
    },
    productName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
      lineHeight: 18,
    },
    productPrice: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.primary,
    },
    addButton: {
      position: 'absolute',
      bottom: 14,
      right: 14,
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    // List layout styles with glass effect
    listCard: {
      width: cardWidth,
      flexDirection: 'row',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassColors.border,
      marginBottom: 12,
      overflow: 'hidden',
      alignItems: 'center',
      padding: 14,
      ...shadows.sm,
    },
    listImageContainer: {
      width: 80,
      height: 80,
      borderRadius: 14,
      backgroundColor: glassColors.background,
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
    // Large grid layout styles with glass effect
    largeCard: {
      width: cardWidth,
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: glassColors.border,
      marginBottom: 16,
      overflow: 'hidden',
      ...shadows.lg,
    },
    largeImageContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: glassColors.background,
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
    // Compact layout styles with glass effect
    compactCard: {
      width: cardWidth,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: glassColors.backgroundElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: glassColors.borderSubtle,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 8,
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
    // Search results styles
    searchResultsBar: {
      paddingHorizontal: GRID_PADDING,
      paddingVertical: 8,
    },
    searchResultsText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    searchQueryText: {
      fontWeight: '600',
      color: colors.text,
    },
    clearSearchButton: {
      marginTop: 24,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      borderWidth: 1,
    },
    clearSearchButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    // Skeleton loading styles
    skeletonBox: {
      backgroundColor: glassColors.backgroundElevated,
      opacity: 0.6,
    },
  });
};

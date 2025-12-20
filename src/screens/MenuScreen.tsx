import React, { useState, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import { productsApi, Product, categoriesApi, Category } from '../lib/api';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 52) / 2; // 20px padding on each side + 12px gap

export function MenuScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { selectedCatalog } = useCatalog();
  const { addItem, getItemQuantity, itemCount } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });

  // Filter active products and by category
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let filtered = products.filter((p) => p.isActive);
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.categoryId === selectedCategory);
    }
    return filtered;
  }, [products, selectedCategory]);

  // Get categories that have products
  const activeCategories = useMemo(() => {
    if (!categories || !products) return [];
    const productCategoryIds = new Set(products.map((p) => p.categoryId).filter(Boolean));
    return categories.filter((c) => c.isActive && productCategoryIds.has(c.id));
  }, [categories, products]);

  const handleAddToCart = (product: Product) => {
    addItem(product);
  };

  const styles = createStyles(colors);

  const renderProduct = ({ item }: { item: Product }) => {
    const quantity = getItemQuantity(item.id);

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
          <Ionicons name="cart-outline" size={24} color={colors.text} />
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      {activeCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          <TouchableOpacity
            style={[
              styles.categoryTab,
              !selectedCategory && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text
              style={[
                styles.categoryText,
                !selectedCategory && styles.categoryTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {activeCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryTab,
                selectedCategory === category.id && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>No products available</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productList}
          columnWrapperStyle={styles.productRow}
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
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerLeft: {
      flex: 1,
    },
    catalogName: {
      fontSize: 24,
      fontWeight: '700',
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
    categoryScroll: {
      maxHeight: 44,
    },
    categoryContainer: {
      paddingHorizontal: 16,
      gap: 8,
    },
    categoryTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      marginRight: 8,
    },
    categoryTabActive: {
      backgroundColor: colors.primary,
    },
    categoryText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    categoryTextActive: {
      color: '#fff',
    },
    productList: {
      padding: 20,
      paddingTop: 16,
    },
    productRow: {
      justifyContent: 'space-between',
    },
    productCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 12,
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
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 16,
    },
  });

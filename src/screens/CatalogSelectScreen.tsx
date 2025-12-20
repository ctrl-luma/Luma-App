import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { Catalog } from '../lib/api';

export function CatalogSelectScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { catalogs, selectedCatalog, setSelectedCatalog, refreshCatalogs, isLoading } = useCatalog();

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Check if this screen is presented as a modal (from settings)
  const isModal = navigation.canGoBack();

  const handleSelectCatalog = async (catalog: Catalog) => {
    await setSelectedCatalog(catalog);
    if (isModal) {
      navigation.goBack();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshCatalogs();
    setIsRefreshing(false);
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const styles = createStyles(colors);

  const renderCatalog = ({ item }: { item: Catalog }) => {
    const isSelected = selectedCatalog?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.catalogCard, isSelected && styles.catalogCardSelected]}
        onPress={() => handleSelectCatalog(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.catalogIcon, isSelected && styles.catalogIconSelected]}>
          <Ionicons
            name="grid-outline"
            size={24}
            color={isSelected ? '#fff' : colors.primary}
          />
        </View>
        <View style={styles.catalogInfo}>
          <Text style={styles.catalogName}>{item.name}</Text>
          {item.location && (
            <View style={styles.catalogMeta}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.catalogMetaText}>{item.location}</Text>
            </View>
          )}
          {item.date && (
            <View style={styles.catalogMeta}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={styles.catalogMetaText}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
          )}
          <Text style={styles.productCount}>
            {item.productCount} {item.productCount === 1 ? 'product' : 'products'}
          </Text>
        </View>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading && catalogs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading catalogs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeCatalogs = catalogs.filter((c) => c.isActive);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{isModal ? 'Switch Catalog' : 'Select a Menu'}</Text>
          <Text style={styles.subtitle}>
            {isModal
              ? 'Choose a different catalog for this device'
              : 'Choose which catalog to use for this session'}
          </Text>
        </View>
        {isModal && (
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {activeCatalogs.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="folder-open-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Catalogs Available</Text>
          <Text style={styles.emptyText}>
            Create catalogs in the vendor portal to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeCatalogs}
          renderItem={renderCatalog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
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
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flex: 1,
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -8,
      marginRight: -8,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    list: {
      padding: 20,
      paddingTop: 16,
    },
    catalogCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginBottom: 12,
    },
    catalogCardSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    catalogIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    catalogIconSelected: {
      backgroundColor: colors.primary,
    },
    catalogInfo: {
      flex: 1,
    },
    catalogName: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    catalogMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    catalogMetaText: {
      fontSize: 13,
      color: colors.textMuted,
      marginLeft: 4,
    },
    productCount: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

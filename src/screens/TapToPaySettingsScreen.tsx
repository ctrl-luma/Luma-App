import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { useCatalog } from '../context/CatalogContext';
import { catalogsApi } from '../lib/api';
import { Toggle } from '../components/Toggle';
import { ConfirmModal } from '../components/ConfirmModal';
import { fonts } from '../lib/fonts';

interface CatalogSettings {
  showTipScreen: boolean;
  promptForEmail: boolean;
  tipPercentages: number[];
  allowCustomTip: boolean;
}

export function TapToPaySettingsScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const { selectedCatalog, refreshCatalogs } = useCatalog();

  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<CatalogSettings>({
    showTipScreen: selectedCatalog?.showTipScreen ?? true,
    promptForEmail: selectedCatalog?.promptForEmail ?? true,
    tipPercentages: selectedCatalog?.tipPercentages ?? [15, 18, 20, 25],
    allowCustomTip: selectedCatalog?.allowCustomTip ?? true,
  });
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [editingTipIndex, setEditingTipIndex] = useState<number | null>(null);
  const [editingTipValue, setEditingTipValue] = useState('');

  const originalSettings: CatalogSettings = useMemo(() => ({
    showTipScreen: selectedCatalog?.showTipScreen ?? true,
    promptForEmail: selectedCatalog?.promptForEmail ?? true,
    tipPercentages: selectedCatalog?.tipPercentages ?? [15, 18, 20, 25],
    allowCustomTip: selectedCatalog?.allowCustomTip ?? true,
  }), [selectedCatalog]);

  const hasChanges = useMemo(() => {
    return settings.showTipScreen !== originalSettings.showTipScreen ||
           settings.promptForEmail !== originalSettings.promptForEmail ||
           settings.allowCustomTip !== originalSettings.allowCustomTip ||
           JSON.stringify(settings.tipPercentages) !== JSON.stringify(originalSettings.tipPercentages);
  }, [settings, originalSettings]);

  const handleBack = () => {
    if (hasChanges) {
      setShowDiscardModal(true);
      return;
    }
    navigation.goBack();
  };

  const isDiscardingRef = React.useRef(false);

  const handleDiscardConfirm = () => {
    isDiscardingRef.current = true;
    setShowDiscardModal(false);
    navigation.goBack();
  };

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasChanges || isDiscardingRef.current) return;
      e.preventDefault();
      setShowDiscardModal(true);
    });
    return unsubscribe;
  }, [navigation, hasChanges]);

  // Update local state when catalog changes
  React.useEffect(() => {
    if (selectedCatalog) {
      setSettings({
        showTipScreen: selectedCatalog.showTipScreen ?? true,
        promptForEmail: selectedCatalog.promptForEmail ?? true,
        tipPercentages: selectedCatalog.tipPercentages ?? [15, 18, 20, 25],
        allowCustomTip: selectedCatalog.allowCustomTip ?? true,
      });
    }
  }, [selectedCatalog]);

  const saveSettings = async () => {
    if (!selectedCatalog?.id || !hasChanges) return;

    setIsSaving(true);
    try {
      await catalogsApi.update(selectedCatalog.id, {
        showTipScreen: settings.showTipScreen,
        promptForEmail: settings.promptForEmail,
        tipPercentages: settings.tipPercentages,
        allowCustomTip: settings.allowCustomTip,
      });
      await refreshCatalogs();
      Alert.alert('Success', 'Settings saved successfully.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTipPercentage = () => {
    if (settings.tipPercentages.length >= 6) {
      Alert.alert('Limit Reached', 'You can have up to 6 tip options.');
      return;
    }
    const common = [5, 10, 15, 18, 20, 22, 25, 30];
    const next = common.find(p => !settings.tipPercentages.includes(p)) || 15;
    setSettings({
      ...settings,
      tipPercentages: [...settings.tipPercentages, next].sort((a, b) => a - b),
    });
  };

  const handleRemoveTipPercentage = (index: number) => {
    if (settings.tipPercentages.length <= 1) {
      Alert.alert('Minimum Required', 'You must have at least one tip option.');
      return;
    }
    setSettings({
      ...settings,
      tipPercentages: settings.tipPercentages.filter((_, i) => i !== index),
    });
  };

  const handleStartEditTip = (index: number) => {
    setEditingTipIndex(index);
    setEditingTipValue(settings.tipPercentages[index].toString());
  };

  const handleSaveTipEdit = () => {
    if (editingTipIndex === null) return;
    const value = parseInt(editingTipValue, 10);
    if (!isNaN(value) && value > 0 && value <= 100) {
      const newPercentages = [...settings.tipPercentages];
      newPercentages[editingTipIndex] = value;
      setSettings({
        ...settings,
        tipPercentages: newPercentages.sort((a, b) => a - b),
      });
    }
    setEditingTipIndex(null);
    setEditingTipValue('');
  };

  const styles = createStyles(colors, isDark);

  if (!selectedCatalog) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout Settings</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No catalog selected</Text>
          <Text style={styles.emptySubtext}>Please select a catalog first</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout Settings</Text>
        <TouchableOpacity
          style={styles.saveButtonContainer}
          onPress={saveSettings}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.saveText, !hasChanges && styles.saveTextDisabled]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Catalog Info */}
        <View style={styles.catalogInfo}>
          <Ionicons name="folder-outline" size={20} color={colors.primary} />
          <Text style={styles.catalogName}>{selectedCatalog.name}</Text>
        </View>

        {/* Tip Settings Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <Ionicons name="cash-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Tips</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Tip Screen</Text>
              <Text style={styles.settingDescription}>Display tip options during checkout</Text>
            </View>
            <Toggle
              value={settings.showTipScreen}
              onValueChange={(v) => setSettings({ ...settings, showTipScreen: v })}
            />
          </View>

          {settings.showTipScreen && (
            <>
              {/* Tip Percentages */}
              <View style={styles.tipPercentagesSection}>
                <Text style={styles.tipPercentagesLabel}>Tip Percentages</Text>
                <Text style={styles.tipPercentagesDescription}>
                  Tap to edit, long press to remove
                </Text>
                <View style={styles.tipPercentagesRow}>
                  {settings.tipPercentages.map((pct, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.tipChip,
                        editingTipIndex === index && styles.tipChipEditing,
                      ]}
                      onPress={() => handleStartEditTip(index)}
                      onLongPress={() => handleRemoveTipPercentage(index)}
                    >
                      {editingTipIndex === index ? (
                        <TextInput
                          style={styles.tipChipInput}
                          value={editingTipValue}
                          onChangeText={setEditingTipValue}
                          onBlur={handleSaveTipEdit}
                          onSubmitEditing={handleSaveTipEdit}
                          keyboardType="number-pad"
                          autoFocus
                          selectTextOnFocus
                          maxLength={3}
                        />
                      ) : (
                        <Text style={styles.tipChipText}>{pct}%</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  {settings.tipPercentages.length < 6 && (
                    <TouchableOpacity
                      style={styles.tipChipAdd}
                      onPress={handleAddTipPercentage}
                    >
                      <Ionicons name="add" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Allow Custom Tip */}
              <View style={[styles.settingRow, styles.settingRowBorder]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Allow Custom Tip</Text>
                  <Text style={styles.settingDescription}>Let customers enter their own amount</Text>
                </View>
                <Toggle
                  value={settings.allowCustomTip}
                  onValueChange={(v) => setSettings({ ...settings, allowCustomTip: v })}
                />
              </View>
            </>
          )}
        </View>

        {/* Receipt Settings Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Receipts</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Prompt for Email</Text>
              <Text style={styles.settingDescription}>Ask customer for email to send receipt</Text>
            </View>
            <Toggle
              value={settings.promptForEmail}
              onValueChange={(v) => setSettings({ ...settings, promptForEmail: v })}
            />
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.infoNoteText}>
            These settings only apply to the "{selectedCatalog.name}" catalog. Each catalog can have different checkout settings.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmModal
        visible={showDiscardModal}
        title="Discard changes?"
        message="You have unsaved changes that will be lost."
        confirmText="Discard"
        cancelText="Keep Editing"
        confirmStyle="destructive"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setShowDiscardModal(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
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
      width: 50,
      height: 40,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: colors.text,
      textAlign: 'center',
    },
    headerRight: {
      width: 50,
    },
    saveButtonContainer: {
      width: 50,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    saveText: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: colors.primary,
    },
    saveTextDisabled: {
      color: colors.textMuted,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textMuted,
      marginTop: 4,
    },
    scroll: {
      flex: 1,
      padding: 16,
    },
    catalogInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 16,
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      marginBottom: 16,
    },
    catalogName: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      marginBottom: 16,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cardHeaderIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      fontFamily: fonts.medium,
      color: colors.text,
      marginBottom: 2,
    },
    settingDescription: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textMuted,
    },
    settingRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    tipPercentagesSection: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    tipPercentagesLabel: {
      fontSize: 14,
      fontWeight: '500',
      fontFamily: fonts.medium,
      color: colors.text,
      marginBottom: 4,
    },
    tipPercentagesDescription: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: colors.textMuted,
      marginBottom: 12,
    },
    tipPercentagesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tipChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tipChipEditing: {
      borderColor: colors.primary,
    },
    tipChipText: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    tipChipInput: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: fonts.semiBold,
      color: colors.text,
      minWidth: 30,
      textAlign: 'center',
      padding: 0,
    },
    tipChipAdd: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.primary + '15',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      borderStyle: 'dashed',
    },
    infoNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      gap: 10,
    },
    infoNoteText: {
      flex: 1,
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textMuted,
      lineHeight: 18,
    },
  });

import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type AppConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor?: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'destructive';
  loading?: boolean;
  onCancel?: () => void;
  onConfirm: () => void;
};

const AppConfirmModal = ({
  visible,
  title,
  message,
  icon = 'help-circle-outline',
  iconColor = '#2A93F4',
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmVariant = 'primary',
  loading = false,
  onCancel,
  onConfirm,
}: AppConfirmModalProps) => {
  const showCancel = Boolean(onCancel);
  const confirmBtnStyle =
    confirmVariant === 'destructive' ? styles.modalDestructiveBtn : styles.modalPrimaryBtnFlex;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      accessibilityViewIsModal
      onRequestClose={onCancel}>
      <View style={styles.modalOverlay} accessibilityLabel={title}>
        <View style={styles.modalCard}>
          <MaterialCommunityIcons name={icon} size={56} color={iconColor} accessibilityLabel="" />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>{message}</Text>
          <View style={showCancel ? styles.modalButtonRow : styles.modalButtonSingle}>
            {showCancel ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                disabled={loading}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.modalSecondaryBtn,
                  pressed && !loading && styles.pressed,
                  loading && styles.btnDisabled,
                ]}>
                <Text style={styles.modalSecondaryBtnText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                showCancel ? confirmBtnStyle : styles.modalPrimaryBtn,
                pressed && !loading && styles.pressed,
                loading && styles.btnDisabled,
              ]}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.modalPrimaryBtnText,
                    confirmVariant === 'destructive' && styles.modalDestructiveBtnText,
                  ]}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AppConfirmModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFF8EF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E6D5C3',
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2d1f0e',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5A3A0A',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  modalButtonSingle: {
    marginTop: 8,
    width: '100%',
  },
  modalSecondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FF',
    borderWidth: 2,
    borderColor: '#2A93F4',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  modalSecondaryBtnText: {
    color: '#2A93F4',
    fontWeight: '900',
    fontSize: 15,
  },
  modalPrimaryBtn: {
    width: '100%',
    backgroundColor: '#72BE2C',
    borderWidth: 2,
    borderColor: '#4E961B',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnFlex: {
    flex: 1,
    backgroundColor: '#72BE2C',
    borderWidth: 2,
    borderColor: '#4E961B',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDestructiveBtn: {
    flex: 1,
    backgroundColor: '#E74C3C',
    borderWidth: 2,
    borderColor: '#C0392B',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  modalDestructiveBtnText: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  btnDisabled: {
    opacity: 0.65,
  },
});

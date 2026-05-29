import type { IAPItemDetails } from 'expo-in-app-purchases';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import subscriptionService, {
  type ProductId,
  PRODUCT_IDS,
  type SubscriptionStatus,
} from '../services/subscriptionService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubscribed: (status: SubscriptionStatus) => void;
}

const FEATURES = {
  free: ['1 pet', 'Basic health records', 'Appointment reminders'],
  premium: [
    'Unlimited pets',
    'Advanced health analytics',
    'Medication tracking',
    'QR pet profiles',
    'Community access',
    'Priority support',
  ],
};

const PaywallModal: React.FC<Props> = ({ visible, onClose, onSubscribed }) => {
  const [products, setProducts] = useState<IAPItemDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    subscriptionService
      .getProducts()
      .then(setProducts)
      .catch(() => setError('Could not load plans. Check your connection.'));
  }, [visible]);

  const handlePurchase = useCallback(
    async (productId: ProductId) => {
      setLoading(true);
      setError(null);
      try {
        const status = await subscriptionService.purchasePlan(productId);
        if (status.isPremium) onSubscribed(status);
        else onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Purchase failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [onSubscribed, onClose],
  );

  const handleRestore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await subscriptionService.restorePurchases();
      if (status.isPremium) onSubscribed(status);
      else setError('No previous purchases found.');
    } catch {
      setError('Restore failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onSubscribed]);

  const priceFor = (id: ProductId) =>
    products.find((p) => p.productId === id)?.price ??
    (id === PRODUCT_IDS.annual ? '$95.88/yr' : '$9.99/mo');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Upgrade to Premium</Text>
          <Text style={styles.subtitle}>Add unlimited pets and unlock all features</Text>

          {/* Feature comparison */}
          <View style={styles.comparison}>
            <View style={styles.col}>
              <Text style={styles.colHeader}>Free</Text>
              {FEATURES.free.map((f) => (
                <Text key={f} style={styles.featureRow}>
                  {'✓ ' + f}
                </Text>
              ))}
            </View>
            <View style={[styles.col, styles.premiumCol]}>
              <Text style={[styles.colHeader, styles.premiumHeader]}>Premium ⭐</Text>
              {FEATURES.premium.map((f) => (
                <Text key={f} style={[styles.featureRow, styles.premiumFeature]}>
                  {'✓ ' + f}
                </Text>
              ))}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator color="#4CAF50" style={{ marginVertical: 16 }} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.planBtn, styles.annualBtn]}
                onPress={() => void handlePurchase(PRODUCT_IDS.annual)}
                accessibilityRole="button"
                accessibilityLabel="Subscribe annually"
              >
                <Text style={styles.planBtnText}>Annual — {priceFor(PRODUCT_IDS.annual)}</Text>
                <Text style={styles.saveBadge}>Save 20%</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.planBtn}
                onPress={() => void handlePurchase(PRODUCT_IDS.monthly)}
                accessibilityRole="button"
                accessibilityLabel="Subscribe monthly"
              >
                <Text style={styles.planBtnText}>Monthly — {priceFor(PRODUCT_IDS.monthly)}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => void handleRestore()} style={styles.restoreBtn}>
                <Text style={styles.restoreTxt}>Restore Purchases</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  closeBtn: { alignSelf: 'flex-end', padding: 4 },
  closeTxt: { fontSize: 18, color: '#666' },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4, marginBottom: 16 },
  comparison: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  col: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12 },
  premiumCol: { backgroundColor: '#e8f5e9', borderWidth: 1.5, borderColor: '#4CAF50' },
  colHeader: { fontWeight: '700', fontSize: 14, color: '#333', marginBottom: 8 },
  premiumHeader: { color: '#2e7d32' },
  featureRow: { fontSize: 12, color: '#555', marginBottom: 4 },
  premiumFeature: { color: '#2e7d32' },
  error: { color: '#c62828', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  planBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  annualBtn: { backgroundColor: '#2e7d32' },
  planBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  saveBadge: {
    backgroundColor: '#fff',
    color: '#2e7d32',
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  restoreBtn: { alignItems: 'center', marginTop: 4 },
  restoreTxt: { color: '#4CAF50', fontSize: 13, fontWeight: '600' },
});

export default PaywallModal;

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../src/components/AppButton';
import { AppScreen } from '../src/components/AppScreen';
import { AppText } from '../src/components/AppText';
import { theme } from '../src/constants/theme';
import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';

export default function EditPurchaseRoute() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { findPurchaseById, updatePurchase } = usePurchases();
  const purchaseDetails = findPurchaseById(itemId);

  const returnToPurchases = () => {
    router.replace('/purchases');
  };

  if (!purchaseDetails) {
    return (
      <AppScreen style={styles.screen}>
        <View style={styles.notFoundCard}>
          <AppText style={styles.notFoundTitle} variant="body">
            Purchase not found
          </AppText>
          <AppText style={styles.notFoundBody} variant="caption">
            This item may have been deleted.
          </AppText>
          <AppButton
            onPress={returnToPurchases}
            title="Back to purchases"
            variant="outline"
          />
        </View>
      </AppScreen>
    );
  }

  const detailsRoute = {
    pathname: '/purchase-details',
    params: {
      itemId: purchaseDetails.id,
    },
  } as const;

  const returnToDetails = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(detailsRoute);
  };

  return (
    <AddFirstPurchaseScreen
      initialValues={purchaseDetails}
      key={purchaseDetails.id}
      mode="editPurchase"
      onBack={returnToDetails}
      onSaveItem={(input) => {
        updatePurchase(purchaseDetails.id, input);
        returnToDetails();
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  notFoundCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  notFoundTitle: {
    fontWeight: theme.fontWeight.semibold,
    textAlign: 'center',
  },
  notFoundBody: {
    textAlign: 'center',
  },
});

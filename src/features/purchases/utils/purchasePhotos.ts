import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const PHOTO_DIRECTORY_NAME = 'rettrack-purchase-photos';
const DEFAULT_PHOTO_EXTENSION = 'jpg';

type PurchasePhotoResult =
  | {
      status: 'cancelled' | 'denied' | 'error';
    }
  | {
      status: 'selected';
    } & PurchasePhotoDraft;

export type PurchasePhotoDraft = {
  fileName?: string | null;
  mimeType?: string;
  uri: string;
};

function getPurchasePhotoDirectory() {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${PHOTO_DIRECTORY_NAME}/`
    : null;
}

function getPhotoExtension(asset: PurchasePhotoDraft) {
  const extensionSource = asset.fileName ?? asset.uri.split('?')[0];
  const extension = extensionSource.match(/\.([a-zA-Z0-9]+)$/)?.[1];

  if (extension) {
    return extension.toLowerCase();
  }

  if (asset.mimeType?.includes('png')) {
    return 'png';
  }

  if (asset.mimeType?.includes('webp')) {
    return 'webp';
  }

  if (asset.mimeType?.includes('heic') || asset.mimeType?.includes('heif')) {
    return 'heic';
  }

  return DEFAULT_PHOTO_EXTENSION;
}

function getPhotoFileName(asset: PurchasePhotoDraft) {
  const extension = getPhotoExtension(asset);
  const randomSuffix = Math.random().toString(36).slice(2, 9);

  return `purchase-photo-${Date.now()}-${randomSuffix}.${extension}`;
}

async function ensurePurchasePhotoDirectory() {
  const photoDirectory = getPurchasePhotoDirectory();

  if (!photoDirectory) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(photoDirectory, {
    intermediates: true,
  });

  return photoDirectory;
}

export async function storePurchasePhoto(asset: PurchasePhotoDraft) {
  const photoDirectory = await ensurePurchasePhotoDirectory();

  if (!photoDirectory) {
    return null;
  }

  const copiedPhotoUri = `${photoDirectory}${getPhotoFileName(asset)}`;

  await FileSystem.copyAsync({
    from: asset.uri,
    to: copiedPhotoUri,
  });

  return copiedPhotoUri;
}

async function ensureMediaLibraryPermission() {
  const currentPermission =
    await ImagePicker.getMediaLibraryPermissionsAsync(false);

  if (currentPermission.granted) {
    return true;
  }

  const nextPermission =
    await ImagePicker.requestMediaLibraryPermissionsAsync(false);

  return nextPermission.granted;
}

export async function pickPurchasePhotoDraft(): Promise<PurchasePhotoResult> {
  try {
    const hasPermission = await ensureMediaLibraryPermission();

    if (!hasPermission) {
      return {
        status: 'denied',
      };
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (pickerResult.canceled) {
      return {
        status: 'cancelled',
      };
    }

    const selectedAsset = pickerResult.assets[0];

    if (!selectedAsset?.uri) {
      return {
        status: 'cancelled',
      };
    }

    return {
      fileName: selectedAsset.fileName,
      mimeType: selectedAsset.mimeType,
      status: 'selected',
      uri: selectedAsset.uri,
    };
  } catch {
    return {
      status: 'error',
    };
  }
}

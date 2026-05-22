import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const PHOTO_DIRECTORY_NAME = 'rettrack-purchase-photos';
const DEFAULT_PHOTO_EXTENSION = 'jpg';

type PurchasePhotoResult =
  | {
      status: 'cancelled' | 'denied' | 'error';
    }
  | {
      assets: PurchasePhotoDraft[];
      status: 'selected';
    };

export type PurchasePhotoDraft = {
  fileName?: string | null;
  mimeType?: string;
  uri: string;
};

type PurchasePhotoPickerOptions = {
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
};

function getPurchasePhotoDirectory() {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${PHOTO_DIRECTORY_NAME}/`
    : null;
}

function getCopiedPurchasePhotoFileUri(uri: string | null | undefined) {
  const photoDirectory = getPurchasePhotoDirectory();
  const normalizedUri = uri?.trim();

  if (
    !photoDirectory ||
    !normalizedUri ||
    !normalizedUri.startsWith(photoDirectory) ||
    normalizedUri.endsWith('/')
  ) {
    return null;
  }

  const relativePhotoPath = normalizedUri.slice(photoDirectory.length);

  if (
    !relativePhotoPath ||
    relativePhotoPath.includes('\\') ||
    relativePhotoPath.split('/').includes('..')
  ) {
    return null;
  }

  return normalizedUri;
}

export function isCopiedPurchasePhotoUri(
  uri: string | null | undefined,
): uri is string {
  return Boolean(getCopiedPurchasePhotoFileUri(uri));
}

export async function deleteCopiedPurchasePhotoFiles(
  photoUris: Array<string | null | undefined>,
) {
  const copiedPhotoUris = Array.from(
    new Set(
      photoUris
        .map(getCopiedPurchasePhotoFileUri)
        .filter((photoUri): photoUri is string => Boolean(photoUri)),
    ),
  );

  await Promise.all(
    copiedPhotoUris.map((photoUri) =>
      FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(
        () => undefined,
      ),
    ),
  );
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

export async function pickPurchasePhotoDraft({
  allowsMultipleSelection = false,
  selectionLimit,
}: PurchasePhotoPickerOptions = {}): Promise<PurchasePhotoResult> {
  try {
    const hasPermission = await ensureMediaLibraryPermission();

    if (!hasPermission) {
      return {
        status: 'denied',
      };
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      allowsMultipleSelection,
      mediaTypes: ['images'],
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 0.8,
    };

    if (allowsMultipleSelection) {
      pickerOptions.orderedSelection = true;
      pickerOptions.selectionLimit = selectionLimit;
    } else {
      pickerOptions.allowsEditing = false;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync(
      pickerOptions,
    );

    if (pickerResult.canceled) {
      return {
        status: 'cancelled',
      };
    }

    const selectedAssets = pickerResult.assets
      .map((asset) => ({
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        uri: asset.uri,
      }))
      .filter((asset) => Boolean(asset.uri));

    if (!selectedAssets.length) {
      return {
        status: 'cancelled',
      };
    }

    return {
      assets: selectedAssets,
      status: 'selected',
    };
  } catch {
    return {
      status: 'error',
    };
  }
}

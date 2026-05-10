import type { PostgrestError } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '../lib/supabase';

const PURCHASE_PHOTOS_BUCKET = 'purchase-photos';
const SIGNED_PHOTO_URL_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const SUPPORTED_PHOTO_MIME_TYPE = 'image/jpeg';
const JPEG_COMPRESSION = 0.85;

export type SupabasePurchasePhotoRow = {
  created_at?: string;
  file_size_bytes: number | null;
  id?: string;
  mime_type: string | null;
  position: number;
  purchase_id: string;
  storage_path: string;
  updated_at?: string;
  user_id: string;
};

export type PurchasePhotoSyncResult<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: PostgrestError | Error;
    };

export type PurchasePhotosSyncSummary = {
  didError: boolean;
  rows: SupabasePurchasePhotoRow[];
};

type UploadedPurchasePhoto = {
  fileSizeBytes: number | null;
  mimeType: string;
  storagePath: string;
};

function base64ToBytes(base64: string) {
  const sanitizedBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const paddingLength = sanitizedBase64.endsWith('==')
    ? 2
    : sanitizedBase64.endsWith('=')
      ? 1
      : 0;
  const outputLength = Math.floor((sanitizedBase64.length * 3) / 4) - paddingLength;
  const bytes = new Uint8Array(outputLength);
  const lookup =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let byteIndex = 0;

  for (let index = 0; index < sanitizedBase64.length; index += 4) {
    const encodedChunk =
      (lookup.indexOf(sanitizedBase64[index] ?? 'A') << 18) |
      (lookup.indexOf(sanitizedBase64[index + 1] ?? 'A') << 12) |
      ((lookup.indexOf(sanitizedBase64[index + 2] ?? 'A') & 63) << 6) |
      (lookup.indexOf(sanitizedBase64[index + 3] ?? 'A') & 63);

    if (byteIndex < outputLength) {
      bytes[byteIndex] = (encodedChunk >> 16) & 255;
      byteIndex += 1;
    }

    if (byteIndex < outputLength) {
      bytes[byteIndex] = (encodedChunk >> 8) & 255;
      byteIndex += 1;
    }

    if (byteIndex < outputLength) {
      bytes[byteIndex] = encodedChunk & 255;
      byteIndex += 1;
    }
  }

  return bytes;
}

function isJpegPhoto(bytes: Uint8Array) {
  return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

function isLocalPhotoUri(uri: string) {
  return uri.startsWith('file:') || uri.startsWith('content:');
}

function getPhotoStoragePath(userId: string, purchaseId: string, photoId: string) {
  return `${userId}/${purchaseId}/${photoId}.jpg`;
}

function getAlignedStoragePaths(
  storagePaths: Array<string | null | undefined> | undefined,
  photoCount: number,
) {
  return Array.from(
    { length: photoCount },
    (_, index) => storagePaths?.[index] ?? null,
  );
}

async function getConvertedJpegPhoto(localUri: string) {
  const jpegPhoto = await manipulateAsync(
    localUri,
    [],
    {
      base64: true,
      compress: JPEG_COMPRESSION,
      format: SaveFormat.JPEG,
    },
  );

  if (!jpegPhoto.base64) {
    throw new Error('JPEG conversion did not return image bytes.');
  }

  const fileInfo = await FileSystem.getInfoAsync(jpegPhoto.uri);
  const bytes = base64ToBytes(jpegPhoto.base64);

  return {
    arrayBuffer: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ),
    bytes,
    fileSizeBytes:
      fileInfo.exists && !fileInfo.isDirectory ? fileInfo.size : null,
  };
}

function sortPhotoRows(rows: SupabasePurchasePhotoRow[]) {
  return [...rows].sort((firstRow, secondRow) => {
    if (firstRow.position !== secondRow.position) {
      return firstRow.position - secondRow.position;
    }

    return firstRow.storage_path.localeCompare(secondRow.storage_path);
  });
}

function getPhotoRowsByPosition(rows: SupabasePurchasePhotoRow[]) {
  const rowsByPosition = new Map<number, SupabasePurchasePhotoRow[]>();

  rows.forEach((row) => {
    const rowsAtPosition = rowsByPosition.get(row.position) ?? [];

    rowsByPosition.set(row.position, [...rowsAtPosition, row]);
  });

  return rowsByPosition;
}

function getUnclaimedPhotoRowAtPosition({
  claimedStoragePaths,
  position,
  rowsByPosition,
}: {
  claimedStoragePaths: Set<string>;
  position: number;
  rowsByPosition: Map<number, SupabasePurchasePhotoRow[]>;
}) {
  return (
    rowsByPosition
      .get(position)
      ?.find((row) => !claimedStoragePaths.has(row.storage_path)) ?? null
  );
}

function getUniqueStoragePaths(rows: SupabasePurchasePhotoRow[]) {
  return [...new Set(rows.map((row) => row.storage_path))];
}

export async function fetchPurchasePhotos(
  userId: string,
  purchaseIds: string[],
): Promise<PurchasePhotoSyncResult<SupabasePurchasePhotoRow[]>> {
  if (!purchaseIds.length) {
    return {
      data: [],
      error: null,
    };
  }

  const { data, error } = await supabase
    .from('purchase_photos')
    .select('*')
    .eq('user_id', userId)
    .in('purchase_id', purchaseIds)
    .order('position', { ascending: true });

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data ?? []) as SupabasePurchasePhotoRow[],
    error: null,
  };
}

export async function getSignedPhotoUrls(storagePaths: string[]) {
  if (!storagePaths.length) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase.storage
    .from(PURCHASE_PHOTOS_BUCKET)
    .createSignedUrls(storagePaths, SIGNED_PHOTO_URL_EXPIRES_IN_SECONDS);

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map(
    data
      .filter((item) => item.path && item.signedUrl && !item.error)
      .map((item) => [item.path as string, item.signedUrl as string]),
  );
}

export async function uploadPurchasePhoto({
  localUri,
  purchaseId,
  userId,
}: {
  localUri: string;
  purchaseId: string;
  userId: string;
}): Promise<PurchasePhotoSyncResult<UploadedPurchasePhoto>> {
  try {
    const photoId = Crypto.randomUUID();
    const storagePath = getPhotoStoragePath(userId, purchaseId, photoId);
    let convertedPhoto: Awaited<ReturnType<typeof getConvertedJpegPhoto>>;

    try {
      convertedPhoto = await getConvertedJpegPhoto(localUri);
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error('JPEG photo conversion failed.'),
      };
    }

    if (!isJpegPhoto(convertedPhoto.bytes)) {
      const error = new Error('Converted photo is not valid JPEG data.');

      return {
        data: null,
        error,
      };
    }

    const resolvedMimeType = SUPPORTED_PHOTO_MIME_TYPE;
    const uploadResult = await supabase.storage
      .from(PURCHASE_PHOTOS_BUCKET)
      .upload(storagePath, convertedPhoto.arrayBuffer, {
        contentType: resolvedMimeType,
        upsert: false,
      });

    if (uploadResult.error) {
      return {
        data: null,
        error: new Error(uploadResult.error.message),
      };
    }

    return {
      data: {
        fileSizeBytes: convertedPhoto.fileSizeBytes,
        mimeType: resolvedMimeType,
        storagePath,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Photo upload failed.'),
    };
  }
}

export async function deletePurchasePhotoMetadata({
  purchaseId,
  storagePaths,
  userId,
}: {
  purchaseId: string;
  storagePaths: string[];
  userId: string;
}): Promise<PurchasePhotoSyncResult<null>> {
  if (!storagePaths.length) {
    return {
      data: null,
      error: null,
    };
  }

  const { error } = await supabase
    .from('purchase_photos')
    .delete()
    .eq('user_id', userId)
    .eq('purchase_id', purchaseId)
    .in('storage_path', storagePaths);

  if (error) {
    return { data: null, error };
  }

  return {
    data: null,
    error: null,
  };
}

export async function deletePurchasePhotoStorageObjects(
  storagePaths: string[],
): Promise<PurchasePhotoSyncResult<null>> {
  if (!storagePaths.length) {
    return {
      data: null,
      error: null,
    };
  }

  const { error } = await supabase.storage
    .from(PURCHASE_PHOTOS_BUCKET)
    .remove(storagePaths);

  if (error) {
    return {
      data: null,
      error: new Error(error.message),
    };
  }

  return {
    data: null,
    error: null,
  };
}

async function insertPurchasePhotoMetadata({
  fileSizeBytes,
  mimeType,
  position,
  purchaseId,
  storagePath,
  userId,
}: {
  fileSizeBytes: number | null;
  mimeType: string;
  position: number;
  purchaseId: string;
  storagePath: string;
  userId: string;
}): Promise<PurchasePhotoSyncResult<SupabasePurchasePhotoRow>> {
  const { data, error } = await supabase
    .from('purchase_photos')
    .insert({
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      position,
      purchase_id: purchaseId,
      storage_path: storagePath,
      user_id: userId,
    })
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data as SupabasePurchasePhotoRow,
    error: null,
  };
}

async function updatePurchasePhotoMetadata({
  currentStoragePath,
  fileSizeBytes,
  mimeType,
  position,
  purchaseId,
  nextStoragePath,
  userId,
}: {
  currentStoragePath: string;
  fileSizeBytes: number | null;
  mimeType: string;
  position: number;
  purchaseId: string;
  nextStoragePath: string;
  userId: string;
}): Promise<PurchasePhotoSyncResult<SupabasePurchasePhotoRow>> {
  const { data, error } = await supabase
    .from('purchase_photos')
    .update({
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      position,
      storage_path: nextStoragePath,
    })
    .eq('user_id', userId)
    .eq('purchase_id', purchaseId)
    .eq('storage_path', currentStoragePath)
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data as SupabasePurchasePhotoRow,
    error: null,
  };
}

async function updatePurchasePhotoPosition({
  position,
  purchaseId,
  storagePath,
  userId,
}: {
  position: number;
  purchaseId: string;
  storagePath: string;
  userId: string;
}): Promise<PurchasePhotoSyncResult<SupabasePurchasePhotoRow>> {
  const { data, error } = await supabase
    .from('purchase_photos')
    .update({ position })
    .eq('user_id', userId)
    .eq('purchase_id', purchaseId)
    .eq('storage_path', storagePath)
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data as SupabasePurchasePhotoRow,
    error: null,
  };
}

export async function syncPurchasePhotos({
  existingStoragePaths,
  photoUris,
  purchaseId,
  userId,
}: {
  existingStoragePaths?: Array<string | null | undefined>;
  photoUris?: string[];
  purchaseId: string;
  userId: string;
}): Promise<PurchasePhotosSyncSummary> {
  const currentPhotosResult = await fetchPurchasePhotos(userId, [purchaseId]);

  if (currentPhotosResult.error) {
    return {
      didError: true,
      rows: [],
    };
  }

  const localPhotoUris = photoUris ?? [];
  const alignedExistingStoragePaths = getAlignedStoragePaths(
    existingStoragePaths,
    localPhotoUris.length,
  );
  const currentPhotoRows = sortPhotoRows(currentPhotosResult.data);
  const currentRowsByPath = new Map(
    currentPhotoRows.map((row) => [row.storage_path, row]),
  );
  const currentRowsByPosition = getPhotoRowsByPosition(currentPhotoRows);
  const claimedStoragePaths = new Set<string>();
  const nextRows: SupabasePurchasePhotoRow[] = [];
  const deferredPositionUpdates: Array<{
    position: number;
    row: SupabasePurchasePhotoRow;
  }> = [];
  const replacedStoragePaths = new Set<string>();
  let didError = false;

  for (const [position, photoUri] of localPhotoUris.entries()) {
    const existingStoragePath = alignedExistingStoragePaths[position];
    const existingRow = existingStoragePath
      ? currentRowsByPath.get(existingStoragePath)
      : null;
    const existingRowAtPosition = getUnclaimedPhotoRowAtPosition({
      claimedStoragePaths,
      position,
      rowsByPosition: currentRowsByPosition,
    });

    if (existingRow && !claimedStoragePaths.has(existingRow.storage_path)) {
      claimedStoragePaths.add(existingRow.storage_path);

      if (existingRow.position !== position) {
        deferredPositionUpdates.push({ position, row: existingRow });
      }

      nextRows.push({
        ...existingRow,
        position,
      });
      continue;
    }

    if (!isLocalPhotoUri(photoUri)) {
      if (existingRowAtPosition) {
        claimedStoragePaths.add(existingRowAtPosition.storage_path);
        nextRows.push({
          ...existingRowAtPosition,
          position,
        });
        continue;
      }

      didError = true;
      continue;
    }

    const uploadResult = await uploadPurchasePhoto({
      localUri: photoUri,
      purchaseId,
      userId,
    });

    if (uploadResult.error) {
      didError = true;
      continue;
    }

    if (existingRowAtPosition) {
      claimedStoragePaths.add(existingRowAtPosition.storage_path);

      const replacedStorageDeleteResult =
        await deletePurchasePhotoStorageObjects([
          existingRowAtPosition.storage_path,
        ]);

      if (replacedStorageDeleteResult.error) {
        await deletePurchasePhotoStorageObjects([
          uploadResult.data.storagePath,
        ]);

        didError = true;
        continue;
      }

      const metadataUpdateResult = await updatePurchasePhotoMetadata({
        currentStoragePath: existingRowAtPosition.storage_path,
        fileSizeBytes: uploadResult.data.fileSizeBytes,
        mimeType: uploadResult.data.mimeType,
        nextStoragePath: uploadResult.data.storagePath,
        position,
        purchaseId,
        userId,
      });

      if (metadataUpdateResult.error) {
        await deletePurchasePhotoStorageObjects([
          uploadResult.data.storagePath,
        ]);

        didError = true;
        continue;
      }

      replacedStoragePaths.add(existingRowAtPosition.storage_path);
      nextRows.push(metadataUpdateResult.data);
      continue;
    }

    const metadataInsertResult = await insertPurchasePhotoMetadata({
      fileSizeBytes: uploadResult.data.fileSizeBytes,
      mimeType: uploadResult.data.mimeType,
      position,
      purchaseId,
      storagePath: uploadResult.data.storagePath,
      userId,
    });

    if (metadataInsertResult.error) {
      await deletePurchasePhotoStorageObjects([
        uploadResult.data.storagePath,
      ]);

      didError = true;
      continue;
    }

    nextRows.push(metadataInsertResult.data);
  }

  const nextStoragePaths = new Set(nextRows.map((row) => row.storage_path));
  const staleStoragePaths = getUniqueStoragePaths(
    currentPhotoRows.filter(
      (row) =>
        !nextStoragePaths.has(row.storage_path) &&
        !replacedStoragePaths.has(row.storage_path),
    ),
  );

  if (!didError && staleStoragePaths.length) {
    const storageDeleteResult =
      await deletePurchasePhotoStorageObjects(staleStoragePaths);

    if (storageDeleteResult.error) {
      didError = true;
    } else {
      const metadataDeleteResult = await deletePurchasePhotoMetadata({
        purchaseId,
        storagePaths: staleStoragePaths,
        userId,
      });

      if (metadataDeleteResult.error) {
        didError = true;
      }
    }
  }

  if (!didError && deferredPositionUpdates.length) {
    for (const [index, { row }] of deferredPositionUpdates.entries()) {
      const temporaryPositionResult = await updatePurchasePhotoPosition({
        position: 1000 + index,
        purchaseId,
        storagePath: row.storage_path,
        userId,
      });

      if (temporaryPositionResult.error) {
        didError = true;
        break;
      }
    }
  }

  if (!didError && deferredPositionUpdates.length) {
    for (const { position, row } of deferredPositionUpdates) {
      const positionUpdateResult = await updatePurchasePhotoPosition({
        position,
        purchaseId,
        storagePath: row.storage_path,
        userId,
      });

      if (positionUpdateResult.error) {
        didError = true;
        break;
      }
    }
  }

  return {
    didError,
    rows: sortPhotoRows(nextRows),
  };
}

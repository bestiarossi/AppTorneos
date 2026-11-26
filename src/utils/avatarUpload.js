import { supabase } from '../lib/supabase';

const MAX_DIMENSION = 256;
const MAX_RAW_FILE_BYTES = 15 * 1024 * 1024; // 15 MB antes de comprimir

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };

    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
- Redimensiona y recorta al centro (máx. 256x256px) en formato WebP (o JPEG fallback).
 */
export async function compressAvatarImage(file, maxSize = MAX_DIMENSION) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido (JPG, PNG o WebP).');
  }

  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error('La imagen supera el límite máximo permitido (15 MB).');
  }

  let bitmap = null;
  let imgElement = null;
  let srcWidth = 0;
  let srcHeight = 0;

  try {
    if (typeof window.createImageBitmap === 'function') {
      bitmap = await window.createImageBitmap(file);
      srcWidth = bitmap.width;
      srcHeight = bitmap.height;
    } else {
      imgElement = await loadImageElement(file);
      srcWidth = imgElement.naturalWidth || imgElement.width;
      srcHeight = imgElement.naturalHeight || imgElement.height;
    }

    if (!srcWidth || !srcHeight) {
      throw new Error('La imagen no tiene dimensiones válidas.');
    }

    // Recorte cuadrado centrado para avatares circulares nítidos
    const cropSize = Math.min(srcWidth, srcHeight);
    const sx = Math.floor((srcWidth - cropSize) / 2);
    const sy = Math.floor((srcHeight - cropSize) / 2);
    const targetSize = Math.min(maxSize, cropSize);

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Tu navegador no pudo procesar la imagen.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      bitmap || imgElement,
      sx,
      sy,
      cropSize,
      cropSize,
      0,
      0,
      targetSize,
      targetSize
    );

    let blob = await canvasToBlob(canvas, 'image/webp', 0.85);
    let contentType = 'image/webp';
    let ext = 'webp';

    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.86);
      contentType = 'image/jpeg';
      ext = 'jpg';
    }

    if (!blob) {
      throw new Error('No se pudo comprimir la imagen.');
    }

    return {
      blob,
      contentType,
      ext,
      width: targetSize,
      height: targetSize,
      sizeBytes: blob.size,
    };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}

export async function uploadUserAvatar(userId, file) {
  if (!supabase || !userId) {
    throw new Error('Sesión no disponible para subir el avatar.');
  }

  const compressed = await compressAvatarImage(file);
  const path = `profiles/${userId}/avatar_${Date.now()}.${compressed.ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, compressed.blob, {
      contentType: compressed.contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return {
    publicUrl: data.publicUrl,
    sizeBytes: compressed.sizeBytes,
  };
}

export async function uploadParticipantAvatar(tournamentId, participantId, file) {
  if (!supabase || !tournamentId || !participantId) {
    throw new Error('Datos insuficientes para subir el avatar del participante.');
  }

  const compressed = await compressAvatarImage(file);
  const path = `tournaments/${tournamentId}/participants/${participantId}_${Date.now()}.${compressed.ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, compressed.blob, {
      contentType: compressed.contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return {
    publicUrl: data.publicUrl,
    sizeBytes: compressed.sizeBytes,
  };
}

export function resolveParticipantAvatar(participant, profileMap = null) {
  if (!participant) return null;
  if (participant.avatar_url) return participant.avatar_url;
  if (participant.profile?.avatar_url) return participant.profile.avatar_url;
  if (participant.user_id && profileMap instanceof Map) {
    return profileMap.get(participant.user_id)?.avatar_url || null;
  }
  return null;
}
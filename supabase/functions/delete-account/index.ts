// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const PURCHASE_PHOTOS_BUCKET = 'purchase-photos';
const STORAGE_REMOVE_BATCH_SIZE = 100;

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function getBearerToken(request) {
  const authorization = request.headers.get('Authorization') ?? '';
  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function getJsonEnvValue(envName) {
  const rawValue = Deno.env.get(envName);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    const defaultValue = parsedValue?.default;

    return typeof defaultValue === 'string' && defaultValue ? defaultValue : null;
  } catch {
    return null;
  }
}

function getSupabaseKey({
  jsonEnvName,
  legacyEnvName,
  localEnvName,
}) {
  return (
    Deno.env.get(legacyEnvName) ??
    Deno.env.get(localEnvName) ??
    getJsonEnvValue(jsonEnvName)
  );
}

function getSupabaseConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = getSupabaseKey({
    jsonEnvName: 'SUPABASE_PUBLISHABLE_KEYS',
    legacyEnvName: 'SUPABASE_ANON_KEY',
    localEnvName: 'SUPABASE_PUBLISHABLE_KEY',
  });
  const supabaseServiceRoleKey = getSupabaseKey({
    jsonEnvName: 'SUPABASE_SECRET_KEYS',
    legacyEnvName: 'SUPABASE_SERVICE_ROLE_KEY',
    localEnvName: 'SUPABASE_SECRET_KEY',
  });

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return null;
  }

  return {
    supabaseAnonKey,
    supabaseServiceRoleKey,
    supabaseUrl,
  };
}

function createUserClient({ supabaseAnonKey, supabaseUrl }, token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function createAdminClient({ supabaseServiceRoleKey, supabaseUrl }) {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isStorageFolder(item) {
  return item?.id === null;
}

async function listStorageObjectPaths(adminClient, prefix) {
  const storagePaths = [];

  async function visit(currentPrefix) {
    let offset = 0;

    while (true) {
      const { data, error } = await adminClient.storage
        .from(PURCHASE_PHOTOS_BUCKET)
        .list(currentPrefix, {
          limit: 1000,
          offset,
          sortBy: {
            column: 'name',
            order: 'asc',
          },
        });

      if (error) {
        throw error;
      }

      if (!data?.length) {
        return;
      }

      for (const item of data) {
        if (!item?.name) {
          continue;
        }

        const storagePath = `${currentPrefix}/${item.name}`;

        if (isStorageFolder(item)) {
          await visit(storagePath);
        } else {
          storagePaths.push(storagePath);
        }
      }

      if (data.length < 1000) {
        return;
      }

      offset += data.length;
    }
  }

  await visit(prefix);

  return storagePaths;
}

function isMissingStorageObjectError(error) {
  const message = error?.message?.toLowerCase?.() ?? '';

  return message.includes('not found') || message.includes('does not exist');
}

async function removeStorageObjects(adminClient, storagePaths) {
  for (let index = 0; index < storagePaths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = storagePaths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await adminClient.storage
      .from(PURCHASE_PHOTOS_BUCKET)
      .remove(batch);

    if (error && !isMissingStorageObjectError(error)) {
      throw error;
    }
  }
}

async function deleteRowsForUser(adminClient, tableName, userId) {
  const { error } = await adminClient.from(tableName).delete().eq('user_id', userId);

  if (error) {
    throw error;
  }
}

function isMissingColumnError(error, columnName) {
  const message = error?.message?.toLowerCase?.() ?? '';
  const details = error?.details?.toLowerCase?.() ?? '';
  const hint = error?.hint?.toLowerCase?.() ?? '';
  const column = columnName.toLowerCase();

  return (
    (error?.code === '42703' || error?.code === 'PGRST204') &&
    (message.includes(column) || details.includes(column) || hint.includes(column))
  );
}

async function deleteProfileRowsForUser(adminClient, userId) {
  const profileUserColumns = ['id', 'user_id'];
  let matchedKnownSchemaColumn = false;

  for (const columnName of profileUserColumns) {
    const { error } = await adminClient
      .from('profiles')
      .delete()
      .eq(columnName, userId);

    if (!error) {
      matchedKnownSchemaColumn = true;
      continue;
    }

    if (!isMissingColumnError(error, columnName)) {
      throw error;
    }
  }

  if (!matchedKnownSchemaColumn) {
    throw new Error('Profiles table does not match a known user column.');
  }
}

async function deleteAuthUser(adminClient, userId) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        error: 'Account deletion must be requested from the app.',
        success: false,
      },
      405,
    );
  }

  const token = getBearerToken(request);

  if (!token) {
    return jsonResponse(
      {
        error: 'Please sign in again before deleting your account.',
        success: false,
      },
      401,
    );
  }

  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    return jsonResponse(
      {
        error: 'Account deletion is not available right now. Please try again later.',
        success: false,
      },
      500,
    );
  }

  const userClient = createUserClient(supabaseConfig, token);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const userId = userData?.user?.id;

  if (userError || !userId) {
    return jsonResponse(
      {
        error: 'Please sign in again before deleting your account.',
        success: false,
      },
      401,
    );
  }

  const adminClient = createAdminClient(supabaseConfig);

  try {
    const storagePaths = await listStorageObjectPaths(adminClient, userId);

    await removeStorageObjects(adminClient, storagePaths);
    await deleteRowsForUser(adminClient, 'purchase_photos', userId);
    await deleteRowsForUser(adminClient, 'purchases', userId);
    await deleteProfileRowsForUser(adminClient, userId);
    await deleteAuthUser(adminClient, userId);

    return jsonResponse({
      success: true,
    });
  } catch {
    return jsonResponse(
      {
        error:
          'We could not finish deleting your account. Please try again before signing out.',
        success: false,
      },
      500,
    );
  }
});

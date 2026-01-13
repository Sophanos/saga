/**
 * Root Index - Entry point / Auth router
 *
 * Uses Convex Auth's gating components to prevent race conditions
 * where routing happens before auth code is consumed.
 *
 * - AuthLoading → Show spinner
 * - Authenticated → Redirect to app
 * - Unauthenticated → Redirect to sign-in
 */

import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';
import { palette } from '@/design-system/colors';

function LoadingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? palette.gray[950] : palette.white,
      }}
    >
      <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
    </View>
  );
}

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default function RootIndex() {
  const params = useLocalSearchParams();
  const code = normalizeParam(params.code);
  const state = normalizeParam(params.state);
  const error = normalizeParam(params.error);
  const errorDescription = normalizeParam(params.error_description);

  if (code || state || error || errorDescription) {
    return (
      <Redirect
        href={{
          pathname: '/(auth)/callback',
          params: {
            code,
            state,
            error,
            error_description: errorDescription,
          },
        }}
      />
    );
  }

  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>

      <Authenticated>
        <Redirect href="/(app)" />
      </Authenticated>

      <Unauthenticated>
        <Redirect href="/(auth)/sign-in" />
      </Unauthenticated>
    </>
  );
}

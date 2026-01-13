/**
 * Auth Layout
 *
 * Stack navigator for authentication screens.
 */

import { Stack } from "expo-router";
import { useTheme } from "@/design-system";

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.bgApp,
        },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="callback" />
    </Stack>
  );
}

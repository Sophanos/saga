/**
 * Auth Group Layout
 *
 * Layout for authentication-related screens (sign-in, sign-up, etc.)
 * Uses a simple Stack navigator with consistent dark theme styling.
 */

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#07070a" },
          animation: "fade",
        }}
      >
        <Stack.Screen
          name="sign-in"
          options={{
            title: "Sign In",
          }}
        />
      </Stack>
    </>
  );
}

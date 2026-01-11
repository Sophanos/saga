/**
 * Marketing Layout
 * Minimal layout for landing/marketing pages
 */

import { Stack } from 'expo-router';

export default function MarketingLayout(): JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}

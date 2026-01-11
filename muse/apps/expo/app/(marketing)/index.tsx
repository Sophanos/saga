/**
 * Marketing Index (Native)
 * Redirects to auth - native users don't need landing page
 */

import { Redirect } from 'expo-router';

export default function MarketingIndexNative(): JSX.Element {
  return <Redirect href="/(auth)/sign-in" />;
}

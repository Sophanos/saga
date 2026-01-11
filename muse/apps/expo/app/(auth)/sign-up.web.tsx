/**
 * Sign Up (Web Only)
 * Redirects to apps/web auth
 */

import { useEffect } from 'react';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL || 'http://localhost:3005';

export default function SignUpWeb(): null {
  useEffect(() => {
    window.location.href = `${WEB_APP_URL}/signup`;
  }, []);

  return null;
}

/**
 * useTemplateBuilderAgent - Expo platform wrapper
 *
 * Configures shared hook with Expo-specific settings.
 */

import {
  useTemplateBuilderAgent as sharedUseTemplateBuilderAgent,
  type UseTemplateBuilderAgentResult,
  type BuilderMessage,
  type BuilderToolInvocation,
} from '@mythos/ai/hooks';
import { useApiKey } from '../../../hooks/useApiKey';
import { api } from '../../../../../../convex/_generated/api';
import type { ProjectType } from '@mythos/core';

export type { UseTemplateBuilderAgentResult, BuilderMessage, BuilderToolInvocation };

const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || 'https://cascada.vision';

export interface UseTemplateBuilderAgentOptions {
  projectType: ProjectType;
}

export function useTemplateBuilderAgent({
  projectType,
}: UseTemplateBuilderAgentOptions): UseTemplateBuilderAgentResult {
  const { key: apiKey } = useApiKey();

  return sharedUseTemplateBuilderAgent({
    projectType,
    baseUrl: CONVEX_SITE_URL,
    apiKey: apiKey || undefined,
    api,
  });
}

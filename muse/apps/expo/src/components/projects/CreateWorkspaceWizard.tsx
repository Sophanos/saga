/**
 * CreateWorkspaceWizard - Multi-step project creation wizard
 *
 * Steps:
 * 1. Template selection (Work, Daily Life, Learning, AI Builder)
 * 2. AI Builder (if selected)
 * 3. Name + Icon input
 * 4. Project created → auto-selected
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { useTheme, spacing, typography, radii, shadows, palette } from '@/design-system';
import { useProjectStore } from '@mythos/state';
import { createProjectFromBootstrap, type ProjectType } from '@mythos/core';
import type { GenesisEntity, TemplateDraft } from '@mythos/agent-protocol';
import { AITemplateBuilder } from './AITemplateBuilder';

type WizardStep = 'template' | 'ai_builder' | 'details';

type TemplateCategory = 'work' | 'daily' | 'learning' | 'ai';

interface TemplateCategoryDef {
  id: TemplateCategory;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description: string;
  templateId: string;
  accentColor: string;
}

const TEMPLATE_CATEGORIES: TemplateCategoryDef[] = [
  {
    id: 'work',
    icon: 'briefcase',
    label: 'For Work',
    description: 'Track projects, goals, and meeting notes',
    templateId: 'product',
    accentColor: palette.amber[400],
  },
  {
    id: 'daily',
    icon: 'home',
    label: 'For Daily Life',
    description: 'Write better, think clearer, stay organized',
    templateId: 'writer',
    accentColor: palette.purple[400],
  },
  {
    id: 'learning',
    icon: 'book-open',
    label: 'For Learning',
    description: 'Keep notes, research, and tasks in one place',
    templateId: 'comms',
    accentColor: palette.green[400],
  },
  {
    id: 'ai',
    icon: 'zap',
    label: 'Let AI help me',
    description: 'Describe your project, AI creates a custom template',
    templateId: 'custom',
    accentColor: palette.cyan[400],
  },
];

interface CreateWorkspaceWizardProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function CreateWorkspaceWizard({
  visible,
  onClose,
  onCreated,
}: CreateWorkspaceWizardProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState<WizardStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCategoryDef | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Builder state
  const [aiProjectType, setAiProjectType] = useState<ProjectType>('story');
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [starterEntities, setStarterEntities] = useState<GenesisEntity[]>([]);

  const bootstrapProject = useMutation(api.projectBootstrap.bootstrap);
  const setProject = useProjectStore((s) => s.setProject);

  const handleSelectTemplate = useCallback((template: TemplateCategoryDef) => {
    setSelectedTemplate(template);
    if (template.id === 'ai') {
      // Open AI Template Builder
      setStep('ai_builder');
    } else {
      setStep('details');
    }
  }, []);

  const handleAITemplateComplete = useCallback((draft: TemplateDraft, entities?: GenesisEntity[]) => {
    setTemplateDraft(draft);
    setStarterEntities(entities ?? []);
    // Set project name from draft if available
    if (draft.name) {
      setProjectName(draft.name);
    }
    setStep('details');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'details') {
      if (selectedTemplate?.id === 'ai' && templateDraft) {
        // Go back to AI builder
        setStep('ai_builder');
      } else {
        setStep('template');
        setProjectName('');
        setError(null);
      }
    } else if (step === 'ai_builder') {
      setStep('template');
      setTemplateDraft(null);
      setStarterEntities([]);
    }
  }, [step, selectedTemplate, templateDraft]);

  const handleClose = useCallback(() => {
    setStep('template');
    setSelectedTemplate(null);
    setProjectName('');
    setError(null);
    setTemplateDraft(null);
    setStarterEntities([]);
    onClose();
  }, [onClose]);

  const handleCreate = useCallback(async () => {
    if (!projectName.trim() || !selectedTemplate || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      // Determine template ID and overrides
      const isCustomTemplate = selectedTemplate.id === 'ai' && templateDraft;
      const templateId = isCustomTemplate ? 'custom' : selectedTemplate.templateId;

      // Build bootstrap args
      const bootstrapArgs: Parameters<typeof bootstrapProject>[0] = {
        name: projectName.trim(),
        templateId,
        initialDocumentType: 'chapter',
        initialDocumentTitle: 'Chapter 1',
      };

      if (isCustomTemplate && templateDraft) {
        bootstrapArgs.templateOverrides = {
          entityKinds: templateDraft.entityKinds,
          relationshipKinds: templateDraft.relationshipKinds,
          documentKinds: templateDraft.documentKinds,
          linterRules: templateDraft.linterRules,
          uiModules: templateDraft.uiModules,
          starterEntities: starterEntities.length > 0 ? starterEntities : undefined,
        };
      }

      const result = await bootstrapProject(bootstrapArgs);

      // Use shared mapper to create properly typed project
      const project = createProjectFromBootstrap({
        projectId: result.projectId,
        name: projectName.trim(),
        templateId,
      });

      setProject(project);

      handleClose();
      onCreated(result.projectId);
    } catch (err) {
      console.error('Failed to create project:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  }, [projectName, selectedTemplate, isCreating, bootstrapProject, setProject, handleClose, onCreated, templateDraft, starterEntities]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdropPressable} onPress={handleClose}>
          <Pressable
            style={[
              styles.modal,
              {
                backgroundColor: colors.bgElevated,
                borderColor: colors.border,
                ...shadows.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerLeft}>
                {(step === 'details' || step === 'ai_builder') && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.backButton,
                      { backgroundColor: pressed ? colors.bgHover : 'transparent' },
                    ]}
                    onPress={handleBack}
                  >
                    <Feather name="chevron-left" size={20} color={colors.textMuted} />
                  </Pressable>
                )}
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {step === 'template' ? 'New Workspace' : step === 'ai_builder' ? 'AI Template Builder' : 'Create Workspace'}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: pressed ? colors.bgHover : 'transparent' },
                ]}
                onPress={handleClose}
              >
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Content */}
            <View style={step === 'ai_builder' ? styles.aiBuilderContent : styles.content}>
              {step === 'template' && (
                <TemplateStep
                  onSelect={handleSelectTemplate}
                />
              )}

              {step === 'ai_builder' && (
                <AITemplateBuilder
                  projectType={aiProjectType}
                  onUseTemplate={handleAITemplateComplete}
                  onCancel={() => setStep('template')}
                />
              )}

              {step === 'details' && selectedTemplate && (
                <DetailsStep
                  template={selectedTemplate}
                  projectName={projectName}
                  onNameChange={setProjectName}
                  onSubmit={handleCreate}
                  isCreating={isCreating}
                  error={error}
                  hasCustomTemplate={!!templateDraft}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface TemplateStepProps {
  onSelect: (template: TemplateCategoryDef) => void;
}

function TemplateStep({ onSelect }: TemplateStepProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.templateStep}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        How do you want to use Mythos?
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        Choose a template to get started quickly
      </Text>

      <View style={styles.templateList}>
        {TEMPLATE_CATEGORIES.map((template) => (
          <Pressable
            key={template.id}
            style={({ pressed, hovered }) => [
              styles.templateCard,
              {
                borderColor: colors.border,
                backgroundColor: pressed || hovered ? colors.bgHover : colors.bgSurface,
              },
            ]}
            onPress={() => onSelect(template)}
          >
            <View
              style={[
                styles.templateIcon,
                { backgroundColor: `${template.accentColor}20` },
              ]}
            >
              <Feather
                name={template.icon}
                size={20}
                color={template.accentColor}
              />
            </View>
            <View style={styles.templateInfo}>
              <Text style={[styles.templateLabel, { color: colors.text }]}>
                {template.label}
              </Text>
              <Text style={[styles.templateDescription, { color: colors.textMuted }]}>
                {template.description}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

interface DetailsStepProps {
  template: TemplateCategoryDef;
  projectName: string;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  isCreating: boolean;
  error: string | null;
  hasCustomTemplate?: boolean;
}

function DetailsStep({
  template,
  projectName,
  onNameChange,
  onSubmit,
  isCreating,
  error,
  hasCustomTemplate,
}: DetailsStepProps) {
  const { colors } = useTheme();
  const initial = getInitial(projectName);

  return (
    <View style={styles.detailsStep}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        {hasCustomTemplate ? 'Finalize your workspace' : 'Give your workspace a name'}
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        Details help new members
      </Text>

      {/* Icon Preview */}
      <View style={styles.iconPreview}>
        <View
          style={[
            styles.iconPreviewBox,
            { backgroundColor: colors.bgHover },
          ]}
        >
          <Text style={[styles.iconPreviewText, { color: colors.text }]}>
            {initial}
          </Text>
        </View>
        <Text style={[styles.iconHint, { color: colors.textMuted }]}>
          Icon (auto-generated)
        </Text>
      </View>

      {/* Name Input */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          Workspace Name
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="My Workspace"
          placeholderTextColor={colors.textGhost}
          value={projectName}
          onChangeText={onNameChange}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          editable={!isCreating}
        />
        <Text style={[styles.inputHint, { color: colors.textMuted }]}>
          The name of your company or organization
        </Text>
      </View>

      {/* Error */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: `${palette.red[400]}15` }]}>
          <Text style={[styles.errorText, { color: palette.red[400] }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: pressed ? colors.accentHover : colors.accent,
            opacity: !projectName.trim() || isCreating ? 0.5 : 1,
          },
        ]}
        onPress={onSubmit}
        disabled={!projectName.trim() || isCreating}
      >
        {isCreating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Continue</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  backdropPressable: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modal: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing[2],
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing[4],
  },
  aiBuilderContent: {
    flex: 1,
    minHeight: 500,
    maxHeight: 600,
  },
  templateStep: {
    gap: spacing[4],
  },
  stepTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: typography.sm,
    textAlign: 'center',
    marginTop: -spacing[2],
  },
  templateList: {
    gap: spacing[2],
    marginTop: spacing[2],
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing[3],
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateLabel: {
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
  templateDescription: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  detailsStep: {
    gap: spacing[4],
    alignItems: 'center',
  },
  iconPreview: {
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  iconPreviewBox: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPreviewText: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
  },
  iconHint: {
    fontSize: typography.xs,
  },
  inputContainer: {
    width: '100%',
    gap: spacing[1],
  },
  inputLabel: {
    fontSize: typography.xs,
  },
  input: {
    width: '100%',
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    fontSize: typography.base,
  },
  inputHint: {
    fontSize: typography.xs,
  },
  errorContainer: {
    width: '100%',
    padding: spacing[3],
    borderRadius: radii.md,
  },
  errorText: {
    fontSize: typography.sm,
  },
  submitButton: {
    width: '100%',
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
  },
  submitButtonText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
});

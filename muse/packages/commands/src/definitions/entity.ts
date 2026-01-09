/**
 * Entity-related commands
 */

import type { Command } from '../types';

export const entityCommands: Command[] = [
  {
    id: 'entity.create.character',
    label: 'Create Character',
    description: 'Create a new character',
    icon: 'user',
    category: 'entity',
    keywords: ['new', 'character', 'person', 'npc'],
    shortcut: '⌘⇧C',
    when: (ctx) => ctx.projectId !== null,
    execute: () => {
      console.log('Create character');
    },
  },
  {
    id: 'entity.create.location',
    label: 'Create Location',
    description: 'Create a new location',
    icon: 'map-pin',
    category: 'entity',
    keywords: ['new', 'location', 'place', 'setting'],
    shortcut: '⌘⇧L',
    when: (ctx) => ctx.projectId !== null,
    execute: () => {
      console.log('Create location');
    },
  },
  {
    id: 'entity.create.item',
    label: 'Create Item',
    description: 'Create a new item or artifact',
    icon: 'box',
    category: 'entity',
    keywords: ['new', 'item', 'artifact', 'object'],
    shortcut: '⌘⇧I',
    when: (ctx) => ctx.projectId !== null,
    execute: () => {
      console.log('Create item');
    },
  },
  {
    id: 'entity.create.faction',
    label: 'Create Faction',
    description: 'Create a new faction or organization',
    icon: 'users',
    category: 'entity',
    keywords: ['new', 'faction', 'organization', 'group'],
    when: (ctx) => ctx.projectId !== null,
    execute: () => {
      console.log('Create faction');
    },
  },
  {
    id: 'entity.create.chapter',
    label: 'Create Chapter',
    description: 'Create a new chapter',
    icon: 'file-text',
    category: 'entity',
    keywords: ['new', 'chapter', 'document'],
    shortcut: '⌘⇧N',
    when: (ctx) => ctx.projectId !== null,
    execute: () => {
      console.log('Create chapter');
    },
  },
  {
    id: 'entity.create.scene',
    label: 'Create Scene',
    description: 'Create a new scene',
    icon: 'film',
    category: 'entity',
    keywords: ['new', 'scene'],
    when: (ctx) => ctx.projectId !== null,
    execute: () => {
      console.log('Create scene');
    },
  },
];

import type { Command } from '../types';

export const entityCommands: Command[] = [
  {
    id: 'node.create',
    label: 'Create Node',
    description: 'Add node to project graph',
    icon: 'plus-circle',
    category: 'graph',
    keywords: ['new', 'node', 'entity', 'character', 'location', 'item', 'create'],
    shortcut: '⌘⇧N',
    when: (ctx) => ctx.projectId !== null,
    execute: () => {
      window.dispatchEvent(new CustomEvent('command:create-node'));
    },
  },
  {
    id: 'graph.open',
    label: 'Open Project Graph',
    description: 'View project graph',
    icon: 'network',
    category: 'graph',
    keywords: ['graph', 'network', 'nodes', 'entities', 'relationships'],
    shortcut: '⌘⇧G',
    when: (ctx) => ctx.projectId !== null,
    execute: () => {
      window.dispatchEvent(new CustomEvent('command:open-graph'));
    },
  },
];

export const Selectors = {
  settings: {
    sidebarMarkers: ['Privacy & Safety', 'Log Out'],
    insertBeforeHeader: 'GENERAL',
    templateItem: 'Language',
    footerPrefix: 'Fenrid Web v',
  },
  contextMenus: {
    message: {
      anchors: ['Copy Message ID', 'Copy Message Link', 'Copy Text'],
      markers: ['Reply', 'Add Reaction', 'Copy Text'],
    },
    channel: {
      anchors: ['Copy Channel ID'],
      markers: ['Invite People', 'Edit Channel', 'Delete Channel'],
    },
    category: {
      anchors: ['Copy Category ID'],
      markers: ['Edit Category', 'Delete Category', 'Mark as read', 'Notification Settings'],
    },
    user: {
      anchors: ['Copy User ID'],
      markers: ['Copy Username', 'Block', 'Unblock'],
    },
    server: {
      anchors: ['Copy Server ID'],
      markers: ['Invite People', 'Leave Server', 'Create Channel'],
    },
  },
  message: '[data-message-id]',
  messageContent: '.relative > .break-words',
  channelLink: 'a[href^="/channels/"]',
  channelName: '.truncate',
  profileTrigger: '[data-profile-preview-trigger]',
  profileBadges: '[aria-label="Profile badges"]',
  voiceParticipant: '.group\\/vcuser',
  serverRail: '.bg-server-sidebar:has(a[href="/channels/me"])',
  serverList: ':scope > .flex-1',
  folderToggle: 'button[aria-expanded]',
  folderNameInput: '#folder-settings-name',
  reactionChip: '[data-reaction-chip]',
  replyBar: '.border-l-\\[3px\\].border-primary-action\\/70',
  replyMentionToggle: 'button:not([aria-label])',
  replyMentionOn: 'button.text-primary-action',
  composer: '[contenteditable="true"][role="textbox"], textarea',
  gatewayHost: 'gateway.fenrid.com',
  cdn: 'https://cdn.fenrid.com',
} as const
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
  reactionChip: '[data-reaction-chip]',
  replyBar: '.border-l-\\[3px\\].border-primary-action\\/70',
  replyMentionToggle: 'button:not([aria-label])',
  replyMentionOn: 'button.text-primary-action',
  composer: '[contenteditable="true"][role="textbox"], textarea',
  gatewayHost: 'gateway.fenrid.com',
  cdn: 'https://cdn.fenrid.com',
} as const
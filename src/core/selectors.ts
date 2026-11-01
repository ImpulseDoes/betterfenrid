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
  },
  message: '[data-message-id]',
  profileTrigger: '[data-profile-preview-trigger]',
  composer: '[contenteditable="true"][role="textbox"], textarea',
  gatewayHost: 'gateway.fenrid.com',
} as const
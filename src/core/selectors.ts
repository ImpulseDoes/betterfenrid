export const Selectors = {
  settings: {
    sidebarMarkers: ['Privacy & Safety', 'Log Out'],
    insertBeforeHeader: 'GENERAL',
    templateItem: 'Language',
    footerPrefix: 'Fenrid Web v',
  },
  messageMenu: {
    anchors: ['Copy Message ID', 'Copy Message Link', 'Copy Text'],
    markers: ['Reply', 'Add Reaction', 'Copy Text'],
  },
  composer: '[contenteditable="true"][role="textbox"], textarea',
} as const
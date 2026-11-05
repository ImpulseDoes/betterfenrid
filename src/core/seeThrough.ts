export const SEE_THROUGH_CSS = `
html:root > body {
  --background: transparent !important;
  --main-chat-area: transparent !important;
  --server-sidebar: color-mix(in srgb, var(--bf-wall-base) 35%, transparent) !important;
  --channel-sidebar: color-mix(in srgb, var(--bf-wall-base) 20%, transparent) !important;
  --member-list: color-mix(in srgb, var(--bf-wall-base) 20%, transparent) !important;
  --sidebar: color-mix(in srgb, var(--bf-wall-base) 20%, transparent) !important;
  background: transparent !important;
}

html:root > body .text-background,
html:root > body .text-main-chat-area {
  color: var(--bf-wall-base);
}

.bg-popups-and-modals,
.bg-popover,
[role="menu"] {
  backdrop-filter: blur(8px);
}
`
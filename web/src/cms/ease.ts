/* Motion constants shared by the CMS shell and the field kit. Kept in a
   leaf module so kit pieces can import them without pulling in ui.tsx. */
export const EASE = [0.25, 1, 0.5, 1] as const;
export const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

/* Collapsible rail sidebar (Aceternity `sidebar`, ported to this stack).
   Differences from the upstream registry component:
     · framer-motion instead of motion/react
     · no next/link — routing is left to the consumer (SidebarLink `render`)
     · drenched-navy / amber register instead of the neutral defaults

   Desktop: 72px icon rail that expands to 268px on hover.
   Mobile:  slide-in drawer over a navy scrim, driven by the same `open` state.

   Both surfaces stay mounted, so anything with a layoutId is namespaced by
   surface — otherwise the two rails fight over the same shared-layout node. */

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const RAIL_COLLAPSED = 72;
export const RAIL_EXPANDED = 268;

const EASE = [0.25, 1, 0.5, 1] as const;
const WIDTH_TRANSITION = { duration: 0.34, ease: EASE };
const FADE_TRANSITION = { duration: 0.22, ease: EASE };

/* ── Context ───────────────────────────────────────────────── */

type SidebarContextValue = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  animate: boolean;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

/** Which rail a row is rendering into — the mobile drawer is never collapsed. */
const SurfaceContext = createContext<'desktop' | 'mobile'>('desktop');

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  const surface = useContext(SurfaceContext);
  if (!ctx) throw new Error('useSidebar must be used inside a <Sidebar>');
  return { ...ctx, surface, expanded: surface === 'mobile' || !ctx.animate || ctx.open };
}

export function SidebarProvider({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: ReactNode;
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  animate?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = setOpenProp ?? setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar(props: {
  children: ReactNode;
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  animate?: boolean;
}) {
  return <SidebarProvider {...props} />;
}

/* ── Surfaces ──────────────────────────────────────────────── */

type SurfaceProps = { className?: string; children?: ReactNode };

export function SidebarBody({ className, children }: SurfaceProps) {
  return (
    <>
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
      <MobileSidebar className={className}>{children}</MobileSidebar>
    </>
  );
}

export function DesktopSidebar({ className, children }: SurfaceProps) {
  const { open, setOpen, animate } = useSidebar();

  return (
    <motion.aside
      className={cn(
        'sticky top-0 z-30 hidden h-[100dvh] shrink-0 flex-col overflow-hidden border-r bg-paper-grid lg:flex',
        className,
      )}
      style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
      animate={{ width: animate ? (open ? RAIL_EXPANDED : RAIL_COLLAPSED) : RAIL_EXPANDED }}
      transition={WIDTH_TRANSITION}
      onMouseEnter={() => animate && setOpen(true)}
      onMouseLeave={() => animate && setOpen(false)}
    >
      <SurfaceContext.Provider value="desktop">{children}</SurfaceContext.Provider>
    </motion.aside>
  );
}

export function MobileSidebar({ className, children }: SurfaceProps) {
  const { open, setOpen } = useSidebar();

  return (
    <AnimatePresence>
      {open && (
        <div className="lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE_TRANSITION}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 backdrop-blur-[2px]"
            style={{ background: 'oklch(0.165 0.040 260 / 0.55)' }}
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.4, ease: EASE }}
            className={cn(
              'fixed inset-y-0 left-0 z-50 flex w-[282px] flex-col overflow-hidden border-r bg-paper-grid',
              className,
            )}
            style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
          >
            <SurfaceContext.Provider value="mobile">{children}</SurfaceContext.Provider>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── Pieces ────────────────────────────────────────────────── */

/** Text that fades out and leaves layout as the rail collapses. */
export function SidebarLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { expanded } = useSidebar();

  return (
    <motion.span
      animate={{ opacity: expanded ? 1 : 0, display: expanded ? 'inline-block' : 'none' }}
      transition={FADE_TRANSITION}
      className={cn('whitespace-pre', className)}
    >
      {children}
    </motion.span>
  );
}

/** Section eyebrow — the label swaps for a hairline tick when collapsed. */
export function SidebarSection({ heading, children }: { heading: string; children: ReactNode }) {
  const { expanded } = useSidebar();

  return (
    <div>
      <div className="relative flex h-4 items-center px-[26px]">
        <motion.span
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={FADE_TRANSITION}
          className="mono whitespace-pre text-[9px] uppercase tracking-[0.24em] text-graphite"
        >
          {heading}
        </motion.span>
        <motion.span
          animate={{ opacity: expanded ? 0 : 1 }}
          transition={FADE_TRANSITION}
          className="absolute left-[26px] h-px w-[17px]"
          style={{ background: 'color-mix(in oklab, var(--color-ink) 18%, transparent)' }}
        />
      </div>
      <div className="mt-3 flex flex-col">{children}</div>
    </div>
  );
}

export type SidebarLinkItem = {
  label: string;
  href?: string;
  icon: ReactNode;
  /** Right-aligned mono code, hidden while collapsed. */
  code?: string;
};

/** Generic row. Pass `render` to route it through NavLink/Link/button instead of <a>. */
export function SidebarLink({
  link,
  active = false,
  className,
  onClick,
  render,
}: {
  link: SidebarLinkItem;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  render?: (body: ReactNode) => ReactNode;
}) {
  const body = <SidebarRow link={link} active={active} />;

  if (render) return <>{render(body)}</>;

  return (
    <a href={link.href ?? '#'} onClick={onClick} title={link.label} className={cn('block', className)}>
      {body}
    </a>
  );
}

/** The visual row itself — amber active tick, icon, label, code. */
export function SidebarRow({ link, active = false }: { link: SidebarLinkItem; active?: boolean }) {
  const { surface } = useSidebar();

  return (
    <span
      className={cn(
        'relative flex items-center gap-3.5 py-2.5 pl-[26px] pr-5 text-[13.5px] transition-colors duration-300',
        active ? 'text-ink' : 'text-slate hover:text-ink',
      )}
    >
      {active && (
        <>
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, color-mix(in oklab, var(--color-amber) 9%, transparent), transparent 72%)',
            }}
          />
          <motion.span
            layoutId={`cms-rail-tick-${surface}`}
            transition={{ duration: 0.35, ease: EASE }}
            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2"
            style={{ background: 'var(--color-amber)' }}
          />
        </>
      )}
      <span
        className={cn(
          'relative z-10 shrink-0 transition-colors duration-300',
          active && 'text-[color:var(--color-amber)]',
        )}
      >
        {link.icon}
      </span>
      <SidebarLabel className="relative z-10">{link.label}</SidebarLabel>
      {link.code && (
        <SidebarLabel className="mono relative z-10 ml-auto text-[9.5px] tracking-[0.14em] text-silver">
          {link.code}
        </SidebarLabel>
      )}
    </span>
  );
}

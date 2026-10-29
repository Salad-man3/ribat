import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { cn } from '../../lib/utils';

type NavButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  to: string;
  replace?: boolean;
  state?: unknown;
  /** NavLink `end`: active only on exact path match. */
  end?: boolean;
  /** Longest-prefix active match (e.g. `/staff/members`). */
  matchPrefix?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  children: ReactNode;
};

export function NavButton({
  to,
  replace,
  state,
  end,
  matchPrefix,
  activeClassName,
  inactiveClassName,
  className,
  children,
  onClick,
  type = 'button',
  ...props
}: NavButtonProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const prefix = matchPrefix ?? to;
  const active = end
    ? pathname === to
    : prefix === '/staff'
      ? pathname === '/staff'
      : pathname === prefix || pathname.startsWith(`${prefix}/`);

  return (
    <button
      type={type}
      {...props}
      className={cn(
        className,
        active ? activeClassName : inactiveClassName,
      )}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        navigate(to, { replace, state });
      }}
    >
      {children}
    </button>
  );
}

/** In-page section jump (not a route). */
export function ScrollButton({
  targetId,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  targetId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      {...props}
      onClick={() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }}
    >
      {children}
    </button>
  );
}

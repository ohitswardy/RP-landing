import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PortalAuth, { type PortalConfig } from '../components/PortalAuth';
import { usePortal } from '../portal/auth';

const CONFIG: PortalConfig = {
  code: '001 / Auth',
  identityLabel: 'User ID / Email',
  identityPlaceholder: 'Your Regis user id, or you@firm.com',
  cta: 'Enter portal',
  stamp: 'Regis · Secure',
  glyph: 'top-right',
  forgotHref: '/forgot-password',
  footnote: (
    <>
      Not yet a Regis client?{' '}
      <Link to="/contact" className="text-[#0d0d0d] underline-offset-4 hover:underline">
        Request institutional onboarding
      </Link>
      . Coverage is allocated by mandate and capacity.
    </>
  ),
};

export default function Login() {
  const { client, signIn } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; notice?: string } | null;
  const from = state?.from ?? '/portal';

  if (client) return <Navigate to={from} replace />;

  return (
    <PortalAuth
      config={CONFIG}
      notice={state?.notice ?? null}
      onSubmit={async (identity, password, remember) => {
        const err = await signIn(identity, password, remember);
        if (!err) navigate(from, { replace: true });
        return err;
      }}
    />
  );
}

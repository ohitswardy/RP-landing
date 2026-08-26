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
  const from = (location.state as { from?: string } | null)?.from ?? '/portal';

  if (client) return <Navigate to={from} replace />;

  return (
    <PortalAuth
      config={CONFIG}
      onSubmit={async (identity, password) => {
        const err = await signIn(identity, password);
        if (!err) navigate(from, { replace: true });
        return err;
      }}
    />
  );
}

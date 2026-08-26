import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PortalAuth, { type PortalConfig } from '../components/PortalAuth';
import { useAuth } from '../cms/auth';

const CONFIG: PortalConfig = {
  code: '002 / CMS',
  system: 'Content Management System',
  identityLabel: 'Staff ID / Email',
  identityPlaceholder: 'name@regis.ph',
  identityType: 'email',
  cta: 'Enter CMS',
  stamp: 'Regis CMS · Internal',
  glyph: 'bottom-left',
  footnote: (
    <>
      Publishing access is provisioned to Regis staff only. Credential issues?{' '}
      <Link to="/contact" className="text-[#0d0d0d] underline-offset-4 hover:underline">
        Contact systems administration
      </Link>
      . All publishing actions are logged.
    </>
  ),
};

export default function LoginCMS() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/cms';

  if (session) return <Navigate to={from} replace />;

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

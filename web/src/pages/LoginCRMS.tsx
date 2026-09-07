import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PortalAuth, { type PortalConfig } from '../components/PortalAuth';
import { useAuth } from '../cms/auth';

const CONFIG: PortalConfig = {
  code: '003 / CRMS',
  system: 'Client Relationship Management',
  identityLabel: 'Desk ID / Email',
  identityPlaceholder: 'name@regis.ph',
  identityType: 'email',
  cta: 'Enter CRMS',
  stamp: 'Regis CRMS · Restricted',
  glyph: 'center',
  footnote: (
    <>
      Coverage, mandate, and client records are restricted to authorised desks.{' '}
      <Link to="/contact" className="text-[#0d0d0d] underline-offset-4 hover:underline">
        Request desk access
      </Link>
      . Sessions expire after 30 minutes idle.
    </>
  ),
};

/**
 * The CRMS door. Same staff account as the CMS, but the API refuses any
 * role without crms.access, so an Editor is told so here rather than
 * landing in an empty workspace.
 */
export default function LoginCRMS() {
  const { session, can, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/crms';

  if (session && can('crms.access')) return <Navigate to={from} replace />;

  return (
    <PortalAuth
      config={CONFIG}
      onSubmit={async (identity, password) => {
        const err = await signIn(identity, password, 'crms');
        if (!err) navigate(from, { replace: true });
        return err;
      }}
    />
  );
}

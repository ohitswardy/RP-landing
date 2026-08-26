import { Link } from 'react-router-dom';
import PortalAuth, { type PortalConfig } from '../components/PortalAuth';

const CONFIG: PortalConfig = {
  code: '003 / CRMS',
  system: 'Client Relationship Management',
  identityLabel: 'Desk ID / Email',
  identityPlaceholder: 'name@regis.ph',
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

export default function LoginCRMS() {
  return <PortalAuth config={CONFIG} />;
}

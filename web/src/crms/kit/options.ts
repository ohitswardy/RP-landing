import { useMemo } from 'react';
import { useCrms } from '../store';
import type { Option } from './fields';

/** The master-data collections as picker options, memoised per collection. */
export function useOptions() {
  const { clients, clientContacts, corporates, corporateContacts, sellsideContacts, sectorGroups, interactionTypes, meta } = useCrms();
  const generic = meta.genericClientId;

  return useMemo(() => ({
    clients: clients.map((c): Option => ({ id: c.id, label: c.name, hint: c.region })),
    contacts: clientContacts.map((c): Option => ({ id: c.id, label: c.name, hint: c.clientName })),
    contactsOf: (clientId: string | null): Option[] =>
      clientContacts.filter((c) => !clientId || c.clientId === clientId).map((c) => ({ id: c.id, label: c.name, hint: c.position })),
    corporates: corporates.map((c): Option => ({ id: c.id, label: c.name, hint: c.ticker })),
    corporateContacts: corporateContacts.map((c): Option => ({ id: c.id, label: c.name, hint: c.corporateName })),
    corporateContactsOf: (corporateId: string | null): Option[] =>
      corporateContacts.filter((c) => !corporateId || c.corporateId === corporateId).map((c) => ({ id: c.id, label: c.name, hint: c.position })),
    sellside: sellsideContacts.map((s): Option => ({ id: s.id, label: s.name, hint: s.type })),
    sectorGroups: sectorGroups.map((g): Option => ({ id: g.id, label: g.name, hint: g.scope })),
    /** A client's own types plus the shared ones (global, or filed under the "Generic Form" client), plus whatever is already picked. */
    typesFor: (clientId: string | null, currentId: string | null = null): Option[] =>
      interactionTypes
        .filter((t) => !t.clientId || t.clientId === clientId || t.clientId === generic || t.id === currentId)
        .map((t) => ({ id: t.id, label: t.type, hint: t.clientId && t.clientId !== generic ? 'client' : 'shared' })),
  }), [clients, clientContacts, corporates, corporateContacts, sellsideContacts, sectorGroups, interactionTypes, generic]);
}

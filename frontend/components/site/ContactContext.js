'use client';

import { createContext, useContext } from 'react';
import { CONTACT } from '@/lib/site';

const ContactCtx = createContext(CONTACT);

/** Hands the resort's contact details (read once on the server) to client components. */
export function ContactProvider({ contact, children }) {
  return <ContactCtx.Provider value={contact}>{children}</ContactCtx.Provider>;
}

/** Phone, WhatsApp, email, address, check-in times — as set in Admin → Settings. */
export const useContact = () => useContext(ContactCtx);

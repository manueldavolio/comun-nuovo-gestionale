-- Social Studio: template locandine weekend (Attività di Base / Settore Agonistico).
-- ADDITIVA: aggiunge solo valori enum. Non tocca Event, User, dati ufficiali.
-- NON applicare in produzione senza autorizzazione esplicita.

ALTER TYPE "SocialGraphicTemplate" ADD VALUE IF NOT EXISTS 'WEEKEND_BASE';
ALTER TYPE "SocialGraphicTemplate" ADD VALUE IF NOT EXISTS 'WEEKEND_AGONISTICO';

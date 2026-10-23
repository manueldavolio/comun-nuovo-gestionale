-- AlterEnum: ruolo dedicato al calendario partite in sola lettura.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SOCIAL_MEDIA_MANAGER';

// A private 1-on-1 chat stored at dms/{uidA_uidB}.
export type Thread = {
  id: string;        // pairId
  title: string;     // the other person's name
  peerUid: string;   // the other person's uid
};

export const pairId = (a: string, b: string) => [a, b].sort().join('_');
export const isStaffRole = (role: string) => ['admin', 'officer', 'treasurer', 'auditor'].includes(role);

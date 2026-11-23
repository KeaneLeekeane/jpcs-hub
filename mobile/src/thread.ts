// A chat thread: the student ↔ JPCS Officers conversation, or a direct chat.
export type Thread = {
  kind: 'student' | 'dm';
  id: string;
  base: string; // conversations/{studentUid} or dms/{uidA_uidB}
  title: string;
  peerUid?: string;
  memberId?: string;
};

export const pairId = (a: string, b: string) => [a, b].sort().join('_');
export const isStaffRole = (role: string) => ['admin', 'officer', 'treasurer', 'auditor'].includes(role);

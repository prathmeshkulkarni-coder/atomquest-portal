/** Who approves a submitted goal sheet for this role. */
export const getApproverLabel = (role) => {
  if (role === 'Manager') return 'Admin (HR)';
  if (role === 'Admin') return 'HR records';
  return 'your manager';
};

export const getSubmitSuccessMessage = (role) => {
  if (role === 'Manager') return 'Submitted to Admin for approval.';
  if (role === 'Admin') return 'HR goal sheet submitted and locked (no manager approval required).';
  return 'Submitted to your manager for approval.';
};

/** Users an Admin can review in Team review (everyone except self). */
export const isReviewableByAdmin = (user, requesterId) =>
  user.id !== requesterId && (user.role === 'Employee' || user.role === 'Manager');

/** Users a Manager can review (direct-report employees only). */
export const isReviewableByManager = (user, managerId) =>
  user.role === 'Employee' && user.manager_id === managerId;

export const canReviewGoalSheet = (reviewer, subject) => {
  if (!subject) return false;
  if (reviewer.role === 'Admin') return subject.role === 'Employee' || subject.role === 'Manager';
  if (reviewer.role === 'Manager') {
    return subject.role === 'Employee' && subject.manager_id === reviewer.id;
  }
  return false;
};

export const getSubmitSuccessMessage = (role) => {
  if (role === 'Manager') return 'Submitted to Admin for approval.';
  if (role === 'Admin') return 'HR goal sheet submitted and locked (no manager approval required).';
  return 'Submitted to your manager for approval.';
};

export const getLockedHint = (role, sheetStatus) => {
  if (role === 'Admin') {
    if (sheetStatus === 'approved') return 'HR sheet locked — log quarterly check-ins';
    if (sheetStatus === 'submitted') return 'Legacy state — unlock from Administration or re-submit';
    return 'Editable until you submit';
  }
  if (sheetStatus === 'approved') {
    return role === 'Manager' ? 'Approved by Admin' : 'Approved by manager';
  }
  if (sheetStatus === 'submitted') {
    return role === 'Manager' ? 'Awaiting Admin review' : 'Awaiting manager review';
  }
  return 'Editable until you submit';
};

export const getCheckinSubtitle = (role, sheetStatus) => {
  if (role === 'Admin') return 'Switch quarter to log HR check-ins (your sheet does not need manager approval).';
  if (sheetStatus === 'submitted') return 'Switch quarter to log check-ins after your manager approves the sheet.';
  return 'Switch quarter to log check-ins (available once your sheet is submitted).';
};

export const getSheetStatusLabel = (sheetStatus) => {
  if (sheetStatus === 'approved') return 'Approved';
  if (sheetStatus === 'submitted') return 'Submitted';
  return 'Draft';
};

export const getManagerSheetSubtitle = (sheetStatus, totalWeightage, weightOk) => {
  const weight = `Total weightage: ${totalWeightage}%${!weightOk ? ' — must equal 100%' : ''}`;
  if (sheetStatus === 'approved') return `${weight} · Sheet approved`;
  if (sheetStatus === 'submitted') return `${weight} · Pending your approval`;
  return `${weight} · Draft (not submitted)`;
};

export const getLockedPanelText = (role, sheetStatus) => {
  if (role === 'Admin') {
    return sheetStatus === 'approved'
      ? 'Your HR goal sheet is locked. Update quarterly achievements in the table below.'
      : 'Sheet is locked. Use Administration → Exceptions to unlock if you need to edit goals.';
  }
  if (role === 'Manager') return 'Goals are with Admin for approval. Update quarterly achievements in the table.';
  return 'Goals are with your manager. Update quarterly achievements in the table.';
};

export const filterReviewableUsers = (users, currentUser) => {
  if (currentUser.role === 'Admin') {
    return users.filter((u) => u.id !== currentUser.id && (u.role === 'Employee' || u.role === 'Manager'));
  }
  if (currentUser.role === 'Manager') {
    return users.filter((u) => u.role === 'Employee' && u.manager_id === currentUser.id);
  }
  return [];
};

/** Whether goal-sheet mutations are allowed for this role when the BRD window is closed. */
export const canBypassGoalSettingWindow = (role) => role === 'Manager' || role === 'Admin';

export const assertGoalSettingForRole = (cycleCheck, role) => {
  if (cycleCheck.allowed || canBypassGoalSettingWindow(role)) {
    return { allowed: true };
  }
  return cycleCheck;
};

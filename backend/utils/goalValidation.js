export const MAX_GOALS = 8;
export const MIN_WEIGHTAGE = 10;
export const REQUIRED_WEIGHTAGE_TOTAL = 100;

export const isWeightageTotalValid = (goals) => {
  const total = goals.reduce((sum, g) => sum + parseFloat(g.weightage), 0);
  return Math.abs(total - REQUIRED_WEIGHTAGE_TOTAL) <= 0.01;
};

export const isIndividualWeightageValid = (weightage) => parseFloat(weightage) >= MIN_WEIGHTAGE;

export const canAddGoal = (currentCount) => currentCount < MAX_GOALS;

/** Resolve target employee for sheet actions (submit / create goal). */
export const resolveSheetUserId = (requester, requestedUserId) => {
  const selfId = requester.id;

  if (requestedUserId === undefined || requestedUserId === null || requestedUserId === '') {
    return { ok: true, userId: selfId };
  }

  const targetId = parseInt(requestedUserId, 10);
  if (Number.isNaN(targetId)) {
    return { ok: false, status: 400, message: 'Invalid user ID' };
  }

  if (targetId === selfId) {
    return { ok: true, userId: selfId };
  }

  if (requester.role === 'Admin') {
    return { ok: true, userId: targetId };
  }

  if (requester.role === 'Manager') {
    return { ok: true, userId: targetId, requiresManagerCheck: true };
  }

  return {
    ok: false,
    status: 403,
    message: 'Access Denied: You can only submit your own goal sheet.',
  };
};

/** @deprecated alias — use resolveSheetUserId */
export const resolveSubmitUserId = resolveSheetUserId;

export type CompletionState = 'both' | 'viewer' | 'other' | 'none';

export function getCompletionDetails({
  viewerRole,
  viewerId,
  donorId,
  ngoId,
  donorCompletedAt,
  ngoCompletedAt,
}: {
  viewerRole?: 'donor' | 'ngo';
  viewerId?: string;
  donorId?: string;
  ngoId?: string;
  donorCompletedAt?: string | null;
  ngoCompletedAt?: string | null;
}): { state: CompletionState; viewerIsDonor: boolean; viewerIsNgo: boolean } {
  const donorCompleted = Boolean(donorCompletedAt);
  const ngoCompleted = Boolean(ngoCompletedAt);
  const viewerIsDonor = Boolean(viewerRole === 'donor' && donorId && viewerId && donorId === viewerId);
  const viewerIsNgo = Boolean(viewerRole === 'ngo' && ngoId && viewerId && ngoId === viewerId);

  if (donorCompleted && ngoCompleted) {
    return { state: 'both', viewerIsDonor, viewerIsNgo };
  }

  if (!viewerRole || !viewerId) {
    return { state: donorCompleted || ngoCompleted ? 'other' : 'none', viewerIsDonor, viewerIsNgo };
  }

  if (viewerRole === 'donor' && donorId && viewerId === donorId) {
    return {
      state: donorCompleted ? 'viewer' : ngoCompleted ? 'other' : 'none',
      viewerIsDonor: true,
      viewerIsNgo: false,
    };
  }

  if (viewerRole === 'ngo' && ngoId && viewerId === ngoId) {
    return {
      state: ngoCompleted ? 'viewer' : donorCompleted ? 'other' : 'none',
      viewerIsDonor: false,
      viewerIsNgo: true,
    };
  }

  if (viewerRole === 'donor') {
    return {
      state: donorCompleted ? 'viewer' : ngoCompleted ? 'other' : 'none',
      viewerIsDonor: viewerIsDonor || (donorId === viewerId),
      viewerIsNgo: false,
    };
  }

  if (viewerRole === 'ngo') {
    return {
      state: ngoCompleted ? 'viewer' : donorCompleted ? 'other' : 'none',
      viewerIsDonor: false,
      viewerIsNgo: viewerIsNgo || (ngoId === viewerId),
    };
  }

  return { state: donorCompleted || ngoCompleted ? 'other' : 'none', viewerIsDonor, viewerIsNgo };
}

export function getCompletionState({
  viewerRole,
  viewerId,
  donorId,
  ngoId,
  donorCompletedAt,
  ngoCompletedAt,
}: {
  viewerRole?: 'donor' | 'ngo';
  viewerId?: string;
  donorId?: string;
  ngoId?: string;
  donorCompletedAt?: string | null;
  ngoCompletedAt?: string | null;
}): CompletionState {
  return getCompletionDetails({
    viewerRole,
    viewerId,
    donorId,
    ngoId,
    donorCompletedAt,
    ngoCompletedAt,
  }).state;
}

export function getCompletionMessage({
  completionState,
  viewerRole,
}: {
  completionState: CompletionState;
  viewerRole?: 'donor' | 'ngo';
}) {
  if (completionState === 'both') {
    return 'Completed';
  }

  if (completionState === 'viewer') {
    return viewerRole === 'ngo'
      ? 'Your completion is confirmed. Waiting for the donor to confirm completion.'
      : 'Your completion is confirmed. Waiting for the NGO to confirm completion.';
  }

  if (completionState === 'other') {
    return viewerRole === 'ngo'
      ? 'The donor has confirmed completion. Please confirm completion when the food has been handed over.'
      : 'The NGO has confirmed completion. Please confirm completion when the food has been handed over.';
  }

  return 'Please confirm completion when the food has been handed over.';
}
